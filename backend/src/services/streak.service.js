// src/services/streak.service.js
// ─────────────────────────────────────────────────────────────────────────────
// ALL streak business logic lives here. Controllers are thin wrappers.
// Backend is authoritative for every value — streak, day, reward, timer, wallet.
// Client-supplied values (day, reward, userId) are NEVER trusted.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const mongoose = require('mongoose');
const StreakConfig  = require('../models/StreakConfig');
const StreakCycle   = require('../models/StreakCycle');
const StreakClaim   = require('../models/StreakClaim');
const StreakReward  = require('../models/StreakReward');
const Wallet        = require('../models/Wallet');
const AuditLog      = require('../models/AuditLog');
const walletService = require('./wallet.service');

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * GET /api/daily-streak — full state.
 * Lazy-creates Cycle #1 if no active cycle exists (edge case 1).
 * Returns shape defined in A3.
 */
async function getStreakStatus(userId) {
  const config = await _getConfig();
  let cycle = await _getOrCreateActiveCycle(userId, config);

  // Check for a missed day on every GET so state is always current
  const resetResult = await _checkAndResetIfMissed(userId, cycle, config);
  if (resetResult.wasReset) cycle = resetResult.newCycle;

  const rewards   = await _buildRewardsArray(userId, cycle);
  const vesBalance = await walletService.getBalance(userId, 'VES');
  const inrBalance = await walletService.getBalance(userId, 'INR');

  return {
    streak: _buildStreakPayload(cycle),
    rewards,
    wallet: { vesBalance, inrBalance },
  };
}

/**
 * GET /api/daily-streak/status — lightweight poll.
 * Used by frontend when countdown timer hits zero.
 */
async function getEligibilityStatus(userId) {
  const config = await _getConfig();
  const cycle  = await _getOrCreateActiveCycle(userId, config);

  const now = new Date();
  const eligible =
    !cycle.nextClaimAt ||                        // Day 1 — no gate
    now >= new Date(cycle.nextClaimAt);          // gate passed

  return {
    eligible,
    nextClaimAt: cycle.nextClaimAt,
    currentDay:  cycle.currentDay,
  };
}

/**
 * POST /api/daily-streak/claim — full A4 pipeline.
 * dayHint is advisory only; actual eligible day always derived server-side.
 */
async function claimReward(userId, dayHint) {
  const config = await _getConfig();

  // ── Step 2: Load (or lazy-create) active cycle ───────────────────────────
  let cycle = await _getOrCreateActiveCycle(userId, config);

  // ── AuditLog: claim request received ────────────────────────────────────
  await AuditLog.create({
    userId,
    eventType: 'STREAK_CLAIM_REQUEST',
    detail: { dayHint, currentDay: cycle.currentDay, cycleId: cycle._id },
  });

  // ── Step 3: Check for missed day — reset FIRST if so ────────────────────
  const resetResult = await _checkAndResetIfMissed(userId, cycle, config);
  if (resetResult.wasReset) {
    cycle = resetResult.newCycle;
    // Return immediately so client shows the reset state
    const rewards    = await _buildRewardsArray(userId, cycle);
    const vesBalance = await walletService.getBalance(userId, 'VES');
    const inrBalance = await walletService.getBalance(userId, 'INR');
    return {
      status:  'JUST_RESET',
      message: 'Your streak has been reset. Start again from Day 1.',
      streak:  _buildStreakPayload(cycle),
      rewards,
      wallet:  { vesBalance, inrBalance },
    };
  }

  // ── Step 4: Derive eligible day server-side (ignore client hint) ─────────
  const eligibleDay = cycle.currentDay;

  // ── Step 5: Check previous day was claimed (day > 1 must have prior claim) ─
  // currentDay is already the NEXT unclaimed day in the cycle — this invariant
  // is maintained by the claim pipeline below, so we only need the time gate.

  // ── Step 6: Server-time gate — now >= nextClaimAt (Day 1 is gated-free) ──
  const now = new Date();
  if (cycle.nextClaimAt && now < new Date(cycle.nextClaimAt)) {
    await AuditLog.create({
      userId,
      eventType: 'STREAK_CLAIM_REJECTED',
      detail: { reason: 'TOO_EARLY', nextClaimAt: cycle.nextClaimAt, now },
    });
    const err = new Error('Your next reward is not available yet.');
    err.status = 403;
    throw err;
  }

  // ── Step 7: Not already claimed today? ───────────────────────────────────
  const alreadyClaimed = await StreakClaim.findOne({ userId, cycleId: cycle._id, day: eligibleDay });
  if (alreadyClaimed) {
    await AuditLog.create({
      userId,
      eventType: 'DUPLICATE_CLAIM',
      detail: { cycleId: cycle._id, day: eligibleDay },
    });
    const err = new Error('This reward has already been claimed.');
    err.status = 409;
    throw err;
  }

  // ── Step 8: Look up StreakReward config (server-owned, client value discarded) ─
  const rewardConfig = await StreakReward.findOne({ day: eligibleDay, active: true });
  if (!rewardConfig) {
    const err = new Error('Reward configuration not found for this day.');
    err.status = 500;
    throw err;
  }

  // ── Step 9: MongoDB transaction ──────────────────────────────────────────
  let claimDoc;
  let txResult;

  const performOperations = async (sessionOpt) => {
    // 9a: Insert StreakClaim — unique index rejects concurrent dupes
    const transactionId = walletService.generateTransactionId('STREAK');

    [claimDoc] = await StreakClaim.create(
      [
        {
          userId,
          cycleId:       cycle._id,
          day:           eligibleDay,
          rewardId:      rewardConfig._id,
          status:        'SUCCESS',
          claimedAt:     now,
          transactionId,
        },
      ],
      { session: sessionOpt }
    );

    // 9b: creditWallet (idempotent, writes WalletTransaction + AuditLog internally)
    txResult = await walletService.creditWallet(
      userId,
      rewardConfig.currency,
      rewardConfig.amount,
      'DAILY_STREAK',
      claimDoc._id.toString(),
      sessionOpt,
      eligibleDay
    );

    // 9c: Advance cycle
    const isLastDay    = eligibleDay === config.cycleLengthDays;
    const nextClaimAt  = new Date(now.getTime() + config.claimIntervalHours * 60 * 60 * 1000);

    if (isLastDay) {
      // Mark current cycle COMPLETED
      await StreakCycle.updateOne(
        { _id: cycle._id },
        { $set: { status: 'COMPLETED', lastClaimAt: now, nextClaimAt } },
        { session: sessionOpt }
      );

      // Create new cycle at Day 1 enforcing the 24-hour cooldown after Day 7 claim
      const prevCycleNumber = cycle.cycleNumber || 1;
      await StreakCycle.create(
        [
          {
            userId,
            cycleNumber: prevCycleNumber + 1,
            status:      'ACTIVE',
            startedAt:   now,
            currentDay:  1,
            lastClaimAt: now,
            nextClaimAt: nextClaimAt, // 24-hour time gate applies after Day 7 claim
          },
        ],
        { session: sessionOpt }
      );
    } else {
      // Advance currentDay and set nextClaimAt
      await StreakCycle.updateOne(
        { _id: cycle._id },
        {
          $set: {
            currentDay:  eligibleDay + 1,
            lastClaimAt: now,
            nextClaimAt,
          },
        },
        { session: sessionOpt }
      );
    }

    // 9d: AuditLog success
    await AuditLog.create(
      [
        {
          userId,
          eventType: 'STREAK_CLAIM_SUCCESS',
          detail: {
            day:           eligibleDay,
            cycleId:       cycle._id,
            rewardId:      rewardConfig._id,
            currency:      rewardConfig.currency,
            amount:        rewardConfig.amount,
            transactionId: txResult.transactionId,
            balanceAfter:  txResult.balanceAfter,
          },
        },
      ],
      { session: sessionOpt }
    );
  };

  try {
    // Attempt transaction if the deployment supports it
    // A standalone MongoDB has topology type 'Single'. Replica sets have 'ReplicaSetWithPrimary'
    const topologyType = mongoose.connection.client.topology?.s?.description?.type || 'Unknown';
    const isReplicaSet = topologyType !== 'Single' && topologyType !== 'Unknown';
    
    if (isReplicaSet) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await performOperations(session);
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback for local standalone MongoDB (e.g. dev environment without replica set)
      await performOperations(undefined);
    }
  } catch (err) {
    // Duplicate key from unique index = concurrent claim — map to 409
    if (err.code === 11000) {
      const dupErr = new Error('This reward has already been claimed.');
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  }

  // ── Step 10: Return fresh state (re-fetch after transaction commits) ──────
  const freshCycle  = await _getOrCreateActiveCycle(userId, config);
  const rewards     = await _buildRewardsArray(userId, freshCycle);
  const vesBalance  = await walletService.getBalance(userId, 'VES');
  const inrBalance  = await walletService.getBalance(userId, 'INR');

  return {
    status:  'CLAIMED',
    streak:  _buildStreakPayload(freshCycle),
    rewards,
    wallet:  { vesBalance, inrBalance },
    claimed: {
      day:           eligibleDay,
      currency:      rewardConfig.currency,
      amount:        rewardConfig.amount,
      transactionId: txResult.transactionId,
    },
  };
}

/**
 * GET /api/daily-streak/history — paginated StreakClaim ledger.
 */
async function getClaimHistory(userId, page, limit) {
  const skip  = (page - 1) * limit;
  const total = await StreakClaim.countDocuments({ userId });
  const claims = await StreakClaim.find({ userId })
    .sort({ claimedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('rewardId', 'day title amount currency assetType')
    .lean();

  return {
    claims,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Load the active StreakConfig singleton. Throws 500 if none seeded.
 */
async function _getConfig() {
  const config = await StreakConfig.findOne({ active: true });
  if (!config) {
    const err = new Error('StreakConfig not found. Run the seed script.');
    err.status = 500;
    throw err;
  }
  return config;
}

/**
 * Find the active cycle for a user, or lazy-create Cycle #1 (edge case 1).
 * Never creates a second active cycle if one already exists.
 */
async function _getOrCreateActiveCycle(userId, config) {
  let cycle = await StreakCycle.findOne({ userId, status: 'ACTIVE' });
  if (!cycle) {
    cycle = await StreakCycle.create({
      userId,
      cycleNumber: await _nextCycleNumber(userId),
      status:     'ACTIVE',
      startedAt:  new Date(),
      currentDay: 1,
      lastClaimAt: null,
      nextClaimAt: null,
    });
  }
  return cycle;
}

/**
 * Compute the next cycle number for a user (max existing + 1, or 1).
 */
async function _nextCycleNumber(userId) {
  const last = await StreakCycle.findOne({ userId }).sort({ cycleNumber: -1 }).lean();
  return last ? last.cycleNumber + 1 : 1;
}

/**
 * Check if the user missed a claim window.
 * Per architecture A4 step 3 + decision 1:
 *   A day is "missed" when now > nextClaimAt + claimIntervalHours
 *   (i.e., a full extra cycle has elapsed with no claim).
 * If missed: mark current cycle RESET, create new Cycle at Day 1.
 * Returns { wasReset: bool, newCycle? }
 */
async function _checkAndResetIfMissed(userId, cycle, config) {
  if (!cycle.nextClaimAt) {
    // Day 1 — no gate has been set yet, can't have missed anything
    return { wasReset: false };
  }

  const now          = new Date();
  const nextClaimAt  = new Date(cycle.nextClaimAt);
  const missDeadline = new Date(nextClaimAt.getTime() + config.claimIntervalHours * 60 * 60 * 1000);

  if (now <= missDeadline) {
    return { wasReset: false };
  }

  // Missed — reset
  await StreakCycle.updateOne({ _id: cycle._id }, { $set: { status: 'RESET' } });

  await AuditLog.create({
    userId,
    eventType: 'STREAK_RESET',
    detail: {
      previousCycleId: cycle._id,
      previousDay:     cycle.currentDay,
      nextClaimAt:     cycle.nextClaimAt,
      missDeadline,
    },
  });

  const newCycle = await StreakCycle.create({
    userId,
    cycleNumber: await _nextCycleNumber(userId),
    status:      'ACTIVE',
    startedAt:   now,
    currentDay:  1,
    lastClaimAt: null,
    nextClaimAt: null,
  });

  return { wasReset: true, newCycle };
}

/**
 * Build the rewards array for the GET response (A3).
 * Each card has: day, status (CLAIMED | TODAY | LOCKED), reward config.
 */
async function _buildRewardsArray(userId, cycle) {
  const allRewards = await StreakReward.find({ active: true }).sort({ day: 1 }).lean();
  const claims     = await StreakClaim.find({ userId, cycleId: cycle._id }).lean();
  const claimedDays = new Set(claims.map((c) => c.day));

  return allRewards.map((r) => {
    let status;
    if (claimedDays.has(r.day)) {
      status = 'CLAIMED';
    } else if (r.day === cycle.currentDay) {
      status = 'TODAY';
    } else {
      status = 'LOCKED';
    }

    return {
      day: r.day,
      status,
      reward: {
        type:      r.rewardType,
        currency:  r.currency,
        amount:    r.amount,
        title:     r.title,
        assetType: r.assetType,
        metadata:  r.metadata,
      },
    };
  });
}

/**
 * Build the streak sub-payload for the GET response (A3).
 */
function _buildStreakPayload(cycle) {
  return {
    currentStreak: cycle.currentDay - 1, // days completed so far in this cycle
    currentDay:    cycle.currentDay,
    checkedIn:     cycle.currentDay - 1,
    totalRewards:  7,
    status:        cycle.status,
    nextClaimAt:   cycle.nextClaimAt,
    lastClaimAt:   cycle.lastClaimAt,
    cycleNumber:   cycle.cycleNumber,
  };
}

module.exports = { getStreakStatus, getEligibilityStatus, claimReward, getClaimHistory };
