// src/__tests__/streak.full.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Full Automated Test Suite: Covers all 15 Edge Cases and Security Scenarios
// Uses mongodb-memory-server Replica Set for real multi-document transactions.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connect, disconnect, clearCollections } = require('../__test_helpers__/db');
const {
  createUser,
  ensureStreakConfig,
  ensureStreakRewards,
  generateToken,
} = require('../__test_helpers__/factories');
const streakService = require('../services/streak.service');
const walletService = require('../services/wallet.service');
const { setClockOffset, resetClock, getServerNow } = require('../utils/clock');
const StreakCycle = require('../models/StreakCycle');
const StreakClaim = require('../models/StreakClaim');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

beforeEach(async () => {
  resetClock();
  await clearCollections(
    'User',
    'Wallet',
    'WalletTransaction',
    'AuditLog',
    'StreakConfig',
    'StreakReward',
    'StreakCycle',
    'StreakClaim'
  );
  await ensureStreakConfig({ cycleLengthDays: 7, claimIntervalHours: 24 });
  await ensureStreakRewards();
});

afterEach(() => {
  resetClock();
  jest.restoreAllMocks();
});

describe('Daily Streak & Rewards: 15 Core Anti-Cheat & Concurrency Scenarios', () => {
  // Scenario 1: First successful claim (Day 1) credits correct reward
  it('Scenario 1: First successful claim (Day 1) credits correct reward from DB config', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.day).toBe(1);
    expect(res.body.reward.amount).toBe(5); // Day 1 configured amount
    expect(res.body.reward.currency).toBe('VES');

    // Balance in DB is credited
    const balance = await walletService.getBalance(user._id, 'VES');
    expect(balance).toBe(5);

    // Ledger documents verified
    const claim = await StreakClaim.findOne({ userId: user._id, day: 1 });
    expect(claim).toBeTruthy();
    expect(claim.status).toBe('SUCCESS');
  });

  // Scenario 2: Claim at 23h59m after last claim → rejected (REWARD_COOLDOWN)
  it('Scenario 2: Claim at 23h59m after last claim is rejected with REWARD_COOLDOWN', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    // Claim Day 1
    await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    // Advance clock to 23 hours and 59 minutes (1 minute before unlock)
    const ms23h59m = (23 * 60 + 59) * 60 * 1000;
    setClockOffset(ms23h59m);

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('REWARD_COOLDOWN');

    // Balance must not increase
    const balance = await walletService.getBalance(user._id, 'VES');
    expect(balance).toBe(5);
  });

  // Scenario 3: Claim exactly at interval boundary (24h) → allowed
  it('Scenario 3: Claim exactly at interval boundary (24h) is allowed', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    // Day 1
    await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);

    // Fast-forward exactly 24 hours
    setClockOffset(24 * 60 * 60 * 1000);

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.day).toBe(2);
    expect(res.body.reward.amount).toBe(10); // Day 2 configured reward

    const balance = await walletService.getBalance(user._id, 'VES');
    expect(balance).toBe(15); // 5 + 10
  });

  // Scenario 4: Claim 25h after → allowed, streak continues
  it('Scenario 4: Claim 25h after last claim is allowed and streak continues to Day 2', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);

    // 25 hours elapsed (well within 24h grace window)
    setClockOffset(25 * 60 * 60 * 1000);

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.day).toBe(2);
    expect(res.body.streak.currentStreak).toBe(2);
  });

  // Scenario 5: Claim after missed window → streak reset to Day 1
  it('Scenario 5: Claim after missed window triggers streak reset to Day 1', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);

    // Advance clock past 24h + 24h grace = 49 hours
    setClockOffset(49 * 60 * 60 * 1000);

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('STREAK_RESET');

    // Verify in database: old cycle is RESET, new cycle is ACTIVE at Day 1
    const activeCycle = await StreakCycle.findOne({ userId: user._id, status: 'ACTIVE' });
    expect(activeCycle.currentDay).toBe(1);
    expect(activeCycle.cycleNumber).toBe(2);
  });

  // Scenario 6: 20 simultaneous claim requests → exactly one success
  it('Scenario 6: 20 simultaneous claim requests results in exactly one success and one credit', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    // Ensure cycle and wallet are primed
    await request(app).get('/api/daily-streak').set('Authorization', `Bearer ${token}`);

    // Send 20 concurrent requests
    const promises = Array.from({ length: 20 }, () =>
      request(app).post('/api/daily-streak/claim').set('Authorization', `Bearer ${token}`).send({})
    );

    const responses = await Promise.all(promises);

    const successes = responses.filter((r) => r.status === 200);
    const conflicts = responses.filter((r) => r.status === 409);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(19);

    // Balance credited exactly once (5 VEs for Day 1)
    const wallet = await Wallet.findOne({ userId: user._id });
    expect(wallet.balances.VES).toBe(5);

    // Exactly one claim and one wallet transaction in DB
    const claimCount = await StreakClaim.countDocuments({ userId: user._id });
    const txCount = await WalletTransaction.countDocuments({ userId: user._id });
    expect(claimCount).toBe(1);
    expect(txCount).toBe(1);
  });

  // Scenario 7: Same user, multiple devices/tokens → still one claim per day
  it('Scenario 7: Same user with multiple tokens cannot double-claim', async () => {
    const { user } = await createUser();
    const device1Token = generateToken(user);
    const device2Token = generateToken(user);

    const res1 = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${device1Token}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${device2Token}`);
    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe('ALREADY_CLAIMED');
  });

  // Scenario 8: Modified client payload is completely ignored
  it('Scenario 8: Modified client payload (fake day/reward/amount/userId) is ignored', async () => {
    const { user } = await createUser();
    const otherUser = new mongoose.Types.ObjectId();
    const token = generateToken(user);

    const maliciousPayload = {
      day: 7,
      reward: 100000,
      currency: 'INR',
      amount: 9999,
      userId: otherUser.toString(),
      streak: 99,
      timestamp: '2099-01-01T00:00:00Z',
    };

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`)
      .send(maliciousPayload);

    expect(res.status).toBe(200);
    expect(res.body.day).toBe(1); // Server-derived Day 1
    expect(res.body.reward.amount).toBe(5); // DB config Day 1 amount
    expect(res.body.reward.currency).toBe('VES');

    // Verified in DB
    const wallet = await Wallet.findOne({ userId: user._id });
    expect(wallet.balances.VES).toBe(5);
    expect(wallet.balances.INR).toBe(0);
  });

  // Scenario 9: Invalid / expired / missing JWT → 401
  it('Scenario 9: Missing or invalid JWT is rejected with 401', async () => {
    const resNoAuth = await request(app).post('/api/daily-streak/claim').send({});
    expect(resNoAuth.status).toBe(401);
    expect(resNoAuth.body.code).toBe('UNAUTHORIZED');

    const resBadToken = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', 'Bearer invalid-token-xyz')
      .send({});
    expect(resBadToken.status).toBe(401);
  });

  // Scenario 10: Forced DB failure mid-transaction → full rollback
  it('Scenario 10: Forced DB failure mid-transaction rolls back all writes', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    // Mock creditWallet to throw halfway through
    jest.spyOn(walletService, 'creditWallet').mockImplementationOnce(async () => {
      throw new Error('Simulated database crash mid-transaction');
    });

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);

    // Verify absolute rollback in MongoDB
    const claims = await StreakClaim.find({ userId: user._id });
    expect(claims.length).toBe(0);

    const txs = await WalletTransaction.find({ userId: user._id });
    expect(txs.length).toBe(0);

    const wallet = await Wallet.findOne({ userId: user._id });
    expect(wallet?.balances?.VES || 0).toBe(0);

    const cycle = await StreakCycle.findOne({ userId: user._id });
    expect(cycle.currentDay).toBe(1);
    expect(cycle.lastClaimAt).toBeNull();
  });

  // Scenario 11: Repeated request after success → idempotent ALREADY_CLAIMED
  it('Scenario 11: Repeated request after success returns ALREADY_CLAIMED without second credit', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    const first = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('ALREADY_CLAIMED');

    const balance = await walletService.getBalance(user._id, 'VES');
    expect(balance).toBe(5);
  });

  // Scenario 12: Concurrent first claims for brand-new user → one cycle, one claim
  it('Scenario 12: Concurrent first claims for brand new user results in exactly one active cycle', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    // Send 10 simultaneous first claims without calling GET first
    const promises = Array.from({ length: 10 }, () =>
      request(app).post('/api/daily-streak/claim').set('Authorization', `Bearer ${token}`).send({})
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.status === 200).length;
    expect(successCount).toBe(1);

    const activeCycles = await StreakCycle.find({ userId: user._id, status: 'ACTIVE' });
    expect(activeCycles.length).toBe(1);
  });

  // Scenario 13: Transaction retry on transient error
  it('Scenario 13: Recovers cleanly from transient write conflict with bounded retry', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    let attempts = 0;
    const originalFindOneAndUpdate = StreakCycle.findOneAndUpdate;
    jest.spyOn(StreakCycle, 'findOneAndUpdate').mockImplementation(function (...args) {
      attempts++;
      if (attempts === 1) {
        const transientErr = new Error('WriteConflict in mongod');
        transientErr.code = 112;
        throw transientErr;
      }
      return originalFindOneAndUpdate.apply(this, args);
    });

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(attempts).toBeGreaterThanOrEqual(2);
  });

  // Scenario 14: Day-skip attempt → granted or rejected according to server cycle
  it('Scenario 14: Day-skip attempt ({ day: 5 } on Day 1) grants Day 1, never Day 5', async () => {
    const { user } = await createUser();
    const token = generateToken(user);

    const res = await request(app)
      .post('/api/daily-streak/claim')
      .set('Authorization', `Bearer ${token}`)
      .send({ day: 5 });

    expect(res.status).toBe(200);
    expect(res.body.day).toBe(1);
    expect(res.body.reward.amount).toBe(5); // Day 1, not Day 5
  });

  // Scenario 15: User A cannot read or claim User B's streak
  it('Scenario 15: User A cannot read or claim User B streak state', async () => {
    const { user: userA } = await createUser();
    const { user: userB } = await createUser();
    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);

    // User A claims Day 1
    await request(app).post('/api/daily-streak/claim').set('Authorization', `Bearer ${tokenA}`);

    // User B checks streak
    const resB = await request(app).get('/api/daily-streak').set('Authorization', `Bearer ${tokenB}`);
    expect(resB.body.streak.currentStreak).toBe(0);
    expect(resB.body.streak.currentDay).toBe(1);

    // User A checks streak
    const resA = await request(app).get('/api/daily-streak').set('Authorization', `Bearer ${tokenA}`);
    expect(resA.body.streak.currentStreak).toBe(1);
    expect(resA.body.streak.currentDay).toBe(2);
  });
});
