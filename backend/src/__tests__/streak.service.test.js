// src/__tests__/streak.service.test.js
'use strict';

const mongoose = require('mongoose');
const { connect, disconnect, clearCollections } = require('../__test_helpers__/db');
const { createUser, ensureStreakConfig, ensureStreakRewards } = require('../__test_helpers__/factories');
const streakService = require('../services/streak.service');
const walletService = require('../services/wallet.service');
const StreakCycle = require('../models/StreakCycle');
const StreakClaim = require('../models/StreakClaim');
const { setClockOffset, resetClock } = require('../utils/clock');

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

beforeEach(async () => {
  await clearCollections('User', 'Wallet', 'WalletTransaction', 'AuditLog', 'StreakConfig', 'StreakReward', 'StreakCycle', 'StreakClaim');
  await ensureStreakConfig();
  await ensureStreakRewards();
});

describe('streak.service', () => {
  describe('Edge Cases / Core Logic', () => {
    it('1. New user Day 1 flow (lazy creates cycle)', async () => {
      const { user } = await createUser();
      const status = await streakService.getStreakStatus(user._id);

      expect(status.streak.currentDay).toBe(1);
      expect(status.streak.status).toBe('ACTIVE');
      expect(status.rewards.find(r => r.day === 1).status).toBe('AVAILABLE');
    });

    it('4. Fake day (client {day:7} while eligible for 2) uses actual eligible day', async () => {
      const { user } = await createUser();
      // First claim (day 1)
      await streakService.claimReward(user._id, null);
      
      // Override time to allow day 2
      await StreakCycle.updateOne({ userId: user._id }, { $set: { nextClaimAt: new Date(Date.now() - 10000) } });

      // Client sends malicious hint of day 7
      const claimResult = await streakService.claimReward(user._id, 7);
      
      expect(claimResult.claimed.day).toBe(2); // Should ignore the 7 and grant 2
      expect(claimResult.claimed.amount).toBe(10); // Day 2 amount
    });

    it('7. Duplicate POST /claim (idempotency/unique index test)', async () => {
      const { user } = await createUser();
      
      // Lazy-create the active cycle first so concurrent requests don't both try to create one
      await streakService.getStreakStatus(user._id);
      
      // Send two claims concurrently
      const [res1, res2] = await Promise.allSettled([
        streakService.claimReward(user._id, null),
        streakService.claimReward(user._id, null)
      ]);

      // Exactly one should succeed
      const statuses = [res1.status, res2.status];
      expect(statuses).toContain('fulfilled');
      expect(statuses).toContain('rejected');

      // The rejected one should have the duplicate error
      const rejected = res1.status === 'rejected' ? res1 : res2;
      expect(rejected.reason.message).toMatch(/already.*claimed|conflict/i);
    });

    it('11. Missed day resets to Day 1', async () => {
      const { user } = await createUser();
      
      await streakService.claimReward(user._id, null);
      const cycle = await StreakCycle.findOne({ userId: user._id });

      // Simulate missing a day past grace window (24h + 24h grace = 48h, advance 49h)
      setClockOffset(49 * 60 * 60 * 1000);

      try {
        await expect(streakService.claimReward(user._id, null)).rejects.toMatchObject({
          code: 'STREAK_RESET',
          status: 400,
        });
        const activeCycle = await StreakCycle.findOne({ userId: user._id, status: 'ACTIVE' });
        expect(activeCycle.currentDay).toBe(1);
      } finally {
        resetClock();
      }
    });
    
    it('Cycle completes on Day 7 and creates new Day 1 cycle', async () => {
      const { user } = await createUser();
      
      // Setup user at day 7, ready to claim
      let cycle = await StreakCycle.create({
        userId: user._id,
        cycleNumber: 1,
        status: 'ACTIVE',
        startedAt: new Date(),
        currentDay: 7,
        lastClaimAt: new Date(Date.now() - 25 * 3600000),
        nextClaimAt: new Date(Date.now() - 1000)
      });
      
      await streakService.claimReward(user._id, null);
      
      // Look at cycles
      const completedCycle = await StreakCycle.findById(cycle._id);
      expect(completedCycle.status).toBe('COMPLETED');
      
      const activeCycle = await StreakCycle.findOne({ userId: user._id, status: 'ACTIVE' });
      expect(activeCycle).toBeDefined();
      expect(activeCycle.currentDay).toBe(1);
      expect(activeCycle.cycleNumber).toBe(2);
      expect(activeCycle.nextClaimAt).toBeDefined();
      expect(activeCycle.lastClaimAt).toBeDefined();
    });
  });
});
