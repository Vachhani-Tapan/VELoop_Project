// src/services/streak.service.js
// ─────────────────────────────────────────────────────────────────────────────
// VELoop Rewards — Daily Streak & Rewards Service Layer
//
// Core Security & Invariants:
// 1. Single Trusted Server Clock: All timestamps generated via clock.getServerNow().
// 2. Client is 0% Trusted: dayHint, reward, currency, amounts from client are ignored.
// 3. Atomicity & Concurrency: Conditional Compare-And-Set + Multi-document Transaction
//    with bounded retry for transient write conflicts.
// 4. Double Idempotency: Unique compound index on StreakClaim(userId, cycleId, day)
//    + unique index on deterministic WalletTransaction.referenceId (STREAK-<cycleId>-<day>).
// 5. Missed Window Evaluation: Evaluated purely on timestamps on every status read and claim.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const mongoose = require('mongoose');
const StreakConfig = require('../models/StreakConfig');
const StreakCycle = require('../models/StreakCycle');
const StreakClaim = require('../models/StreakClaim');
const StreakReward = require('../models/StreakReward');
const Wallet = require('../models/Wallet');
const AuditLog = require('../models/AuditLog');
const walletService = require('./wallet.service');
const { getServerNow, getServerIsoNow } = require('../utils/clock');
const { ERROR_CODES } = require('../config/constants');

/**
 * Custom application error with HTTP status and machine-readable error code.
 */
function createError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * GET /api/daily-streak — Fetch full state.
 * Evaluates missed window, builds 7-day card statuses, calculates remaining cooldown.
 */
async function getStreakStatus(userId) {
  const now = getServerNow();
  const config = await _getConfig();
  let cycle = await _getOrCreateActiveCycle(userId, config, now);

  // Check missed window on every status read
  const missedCheck = await checkMissedWindow(userId, cycle, config, now);
  if (missedCheck.wasReset) {
    cycle = missedCheck.newCycle;
  }

  const rewards = await _buildRewardsArray(userId, cycle, config, now);
  const vesBalance = await walletService.getBalance(userId, 'VES');
  const inrBalance = await walletService.getBalance(userId, 'INR');

  const streakSummary = _buildStreakSummary(cycle, config, now);

  return {
    serverTime: now.toISOString(),
    streak: streakSummary,
    rewards,
    wallet: { vesBalance, inrBalance },
  };
}

/**
 * GET /api/daily-streak/status — Lightweight/countdown refresh endpoint.
 * Returns the exact same authoritative full payload so UI stays 100% in sync.
 */
async function getEligibilityStatus(userId) {
  return getStreakStatus(userId);
}

/**
 * GET /api/daily-streak/wallet — Dedicated wallet balance endpoint.
 */
async function getWalletBalance(userId) {
  const vesBalance = await walletService.getBalance(userId, 'VES');
  const inrBalance = await walletService.getBalance(userId, 'INR');
  return {
    success: true,
    serverTime: getServerIsoNow(),
    balances: {
      VES: vesBalance,
      INR: inrBalance,
    },
    vesBalance,
    inrBalance,
  };
}

/**
 * Check if the active cycle has missed its claim window.
 * Window rule: if now > nextClaimAt + (missedWindowHours || claimIntervalHours), cycle resets to Day 1.
 */
async function checkMissedWindow(userId, cycle, config, providedNow) {
  const now = providedNow || getServerNow();

  if (!cycle.nextClaimAt) {
    // Day 1 of fresh cycle has no gate set yet, cannot be missed
    return { wasReset: false };
  }

  const nextClaimTime = new Date(cycle.nextClaimAt).getTime();
  const graceHours = config.missedWindowHours || config.claimIntervalHours || 24;
  const missDeadline = new Date(nextClaimTime + graceHours * 60 * 60 * 1000);

  if (now.getTime() <= missDeadline.getTime()) {
    return { wasReset: false };
  }

  // Missed window exceeded — perform streak reset
  const newCycle = await resetStreak(userId, cycle, missDeadline, now);
  return { wasReset: true, newCycle };
}

/**
 * Reset an active cycle and atomically establish a new active cycle at Day 1.
 */
async function resetStreak(userId, currentCycle, missDeadline, now) {
  const currentTime = now || getServerNow();

  // Mark previous cycle as RESET
  await StreakCycle.updateOne(
    { _id: currentCycle._id },
    { $set: { status: 'RESET', updatedAt: currentTime } }
  );

  // Audit log the reset event
  await AuditLog.create({
    userId,
    eventType: 'STREAK_RESET',
    detail: {
      previousCycleId: currentCycle._id,
      previousDay: currentCycle.currentDay,
      nextClaimAt: currentCycle.nextClaimAt,
      missDeadline,
      resetAt: currentTime,
    },
  });

  // Calculate next cycle number
  const nextNum = await _nextCycleNumber(userId);

  // Create brand new active cycle starting at Day 1
  const newCycle = await StreakCycle.create({
    userId,
    cycleNumber: nextNum,
    status: 'ACTIVE',
    startedAt: currentTime,
    currentDay: 1,
    lastClaimAt: null,
    nextClaimAt: null,
  });

  return newCycle;
}

/**
 * POST /api/daily-streak/claim — Atomic Reward Claim Pipeline
 *
 * Enforces:
 * 1. Server-side day calculation (dayHint ignored for authorization)
 * 2. Missed window check before claim
 * 3. Rolling cooldown time gate
 * 4. DB-backed StreakReward lookup
 * 5. Multi-document transaction with Compare-and-Set on StreakCycle
 * 6. Deterministic idempotency reference: STREAK-<cycleId>-<day>
 * 7. Bounded retry on TransientTransactionError / WriteConflict
 */
async function claimReward(userId, dayHint, idempotencyKey = null) {
  const now = getServerNow();
  const config = await _getConfig();

  // Step 1: Fetch or safely initialize active cycle
  let cycle = await _getOrCreateActiveCycle(userId, config, now);

  // Step 2: Audit request received
  await AuditLog.create({
    userId,
    eventType: 'STREAK_CLAIM_REQUEST',
    detail: {
      dayHint,
      currentDay: cycle.currentDay,
      cycleId: cycle._id,
      idempotencyKey,
      receivedAt: now,
    },
  });

  // Step 3: Check missed window first
  const missedCheck = await checkMissedWindow(userId, cycle, config, now);
  if (missedCheck.wasReset) {
    cycle = missedCheck.newCycle;
    const freshState = await getStreakStatus(userId);
    throw createError(
      'Your claim window expired. Streak has been reset to Day 1.',
      400,
      ERROR_CODES.STREAK_RESET
    );
  }

  // Step 4: Authoritative eligible day from DB cycle state
  const eligibleDay = cycle.currentDay;

  // Step 5: Enforce rolling cooldown time gate (Day 1 with null nextClaimAt has no gate)
  if (cycle.nextClaimAt && now.getTime() < new Date(cycle.nextClaimAt).getTime()) {
    const diffMs = new Date(cycle.nextClaimAt).getTime() - now.getTime();

    // If claim was made recently in this cycle (e.g., immediate duplicate/re-claim), return ALREADY_CLAIMED
    const elapsedSinceLastClaim = cycle.lastClaimAt
      ? now.getTime() - new Date(cycle.lastClaimAt).getTime()
      : Infinity;

    if (elapsedSinceLastClaim < 12 * 60 * 60 * 1000) {
      await AuditLog.create({
        userId,
        eventType: 'DUPLICATE_CLAIM',
        detail: {
          cycleId: cycle._id,
          day: cycle.currentDay - 1,
          reason: 'ALREADY_CLAIMED',
          lastClaimAt: cycle.lastClaimAt,
          now,
        },
      });
      throw createError(
        'This reward has already been claimed.',
        409,
        ERROR_CODES.ALREADY_CLAIMED
      );
    }

    await AuditLog.create({
      userId,
      eventType: 'STREAK_CLAIM_REJECTED',
      detail: {
        reason: 'REWARD_COOLDOWN',
        nextClaimAt: cycle.nextClaimAt,
        now,
        remainingMs: diffMs,
      },
    });
    throw createError(
      'Reward is currently on cooldown. Please wait until unlock time.',
      403,
      ERROR_CODES.REWARD_COOLDOWN
    );
  }

  // Step 6: Verify not already claimed for this day in this cycle
  const existingClaim = await StreakClaim.findOne({
    userId,
    cycleId: cycle._id,
    day: eligibleDay,
  });

  if (existingClaim) {
    await AuditLog.create({
      userId,
      eventType: 'DUPLICATE_CLAIM',
      detail: { cycleId: cycle._id, day: eligibleDay },
    });
    throw createError(
      'This reward has already been claimed.',
      409,
      ERROR_CODES.ALREADY_CLAIMED
    );
  }

  // Step 7: Load backend reward configuration (ignore client amounts)
  const rewardConfig = await StreakReward.findOne({ day: eligibleDay, active: true });
  if (!rewardConfig) {
    throw createError(
      'Configured reward not found for this day.',
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }

  // Step 8: Execute atomic claim inside transaction with bounded retry
  const isLastDay = eligibleDay >= config.cycleLengthDays;
  const nextClaimIntervalMs = config.claimIntervalHours * 60 * 60 * 1000;
  const nextClaimAt = new Date(now.getTime() + nextClaimIntervalMs);
  const deterministicRefId = `STREAK-${cycle._id.toString()}-${eligibleDay}`;

  const claimResult = await _executeClaimTransaction({
    userId,
    cycle,
    eligibleDay,
    isLastDay,
    rewardConfig,
    now,
    nextClaimAt,
    deterministicRefId,
    config,
  });

  // Step 9: Re-fetch fresh state and return
  const freshState = await getStreakStatus(userId);

  return {
    success: true,
    serverTime: now.toISOString(),
    day: eligibleDay,
    reward: {
      day: eligibleDay,
      type: rewardConfig.rewardType,
      currency: rewardConfig.currency,
      amount: rewardConfig.amount,
      title: rewardConfig.title,
      assetType: rewardConfig.assetType,
    },
    claimed: {
      day: eligibleDay,
      currency: rewardConfig.currency,
      amount: rewardConfig.amount,
      transactionId: claimResult.transactionId,
    },
    balance: claimResult.balanceAfter,
    nextClaimAt: freshState.streak.nextClaimAt,
    remainingMs: freshState.streak.remainingMs,
    streak: freshState.streak,
    rewards: freshState.rewards,
    wallet: freshState.wallet,
  };
}

/**
 * GET /api/daily-streak/history — Paginated claims ledger.
 */
async function getClaimHistory(userId, page = 1, limit = 10) {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const skip = (safePage - 1) * safeLimit;

  const total = await StreakClaim.countDocuments({ userId });
  const claims = await StreakClaim.find({ userId })
    .sort({ claimedAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .populate('rewardId', 'day title amount currency assetType')
    .lean();

  return {
    success: true,
    serverTime: getServerIsoNow(),
    claims,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

// ─── Internal Transaction & Concurrency Implementation ─────────────────────────

/**
 * Execute atomic claim operations with bounded retry on transient write conflicts.
 */
async function _executeClaimTransaction(params, maxRetries = 3) {
  let lastErr = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const topologyType = mongoose.connection.client?.topology?.s?.description?.type || 'Unknown';
    const isReplicaSet = topologyType !== 'Single' && topologyType !== 'Unknown';

    if (!isReplicaSet) {
      // Local standalone fallback without replica set
      try {
        return await _performClaimOperations(null, params);
      } catch (err) {
        _handleClaimError(err);
      }
    }

    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await _performClaimOperations(session, params);
      });
      return result;
    } catch (err) {
      lastErr = err;
      const isTransient =
        err.hasErrorLabel?.('TransientTransactionError') ||
        err.message?.includes('WriteConflict') ||
        err.code === 112;

      if (isTransient && attempt < maxRetries) {
        // Backoff and retry
        await new Promise((res) => setTimeout(res, attempt * 50));
        continue;
      }

      _handleClaimError(err);
    } finally {
      await session.endSession();
    }
  }

  throw createError(
    'Server is busy processing transactions. Please try again.',
    409,
    ERROR_CODES.CLAIM_CONFLICT
  );
}

/**
 * Atomic operations executed strictly within transaction session.
 */
async function _performClaimOperations(session, {
  userId,
  cycle,
  eligibleDay,
  isLastDay,
  rewardConfig,
  now,
  nextClaimAt,
  deterministicRefId,
}) {
  // Step A: Conditional Atomic Update (Compare-And-Set) on StreakCycle
  // Guarantees that only ONE concurrent claim matches the current state
  const casFilter = {
    _id: cycle._id,
    userId,
    status: 'ACTIVE',
    currentDay: eligibleDay,
    $or: [{ nextClaimAt: null }, { nextClaimAt: { $lte: now } }],
  };

  const cycleUpdate = isLastDay
    ? {
        $set: {
          status: 'COMPLETED',
          lastClaimAt: now,
          nextClaimAt,
          updatedAt: now,
        },
      }
    : {
        $set: {
          currentDay: eligibleDay + 1,
          lastClaimAt: now,
          nextClaimAt,
          updatedAt: now,
        },
      };

  const updatedCycle = await StreakCycle.findOneAndUpdate(casFilter, cycleUpdate, {
    session,
    new: true,
  });

  if (!updatedCycle) {
    // CAS failed: either another request already advanced currentDay, or gate locked
    const existing = await StreakClaim.findOne({
      userId,
      cycleId: cycle._id,
      day: eligibleDay,
    }).session(session);

    if (existing) {
      throw createError(
        'This reward has already been claimed.',
        409,
        ERROR_CODES.ALREADY_CLAIMED
      );
    }

    throw createError(
      'Concurrent claim conflict detected. Please refresh state.',
      409,
      ERROR_CODES.CLAIM_CONFLICT
    );
  }

  // Step B: Insert StreakClaim document (Unique index userId+cycleId+day acts as DB backstop)
  const transactionId = walletService.generateTransactionId('STREAK');

  const [claimDoc] = await StreakClaim.create(
    [
      {
        userId,
        cycleId: cycle._id,
        day: eligibleDay,
        rewardId: rewardConfig._id,
        status: 'SUCCESS',
        claimedAt: now,
        transactionId,
      },
    ],
    { session }
  );

  // Step C: Atomically credit wallet via wallet service
  // Uses deterministic referenceId (STREAK-<cycleId>-<day>) for double idempotency
  const creditResult = await walletService.creditWallet(
    userId,
    rewardConfig.currency,
    rewardConfig.amount,
    'DAILY_STREAK',
    deterministicRefId,
    session,
    eligibleDay
  );

  // Step D: If Day 7 claimed, complete cycle and launch Cycle N+1
  if (isLastDay) {
    const nextNum = (cycle.cycleNumber || 1) + 1;
    await StreakCycle.create(
      [
        {
          userId,
          cycleNumber: nextNum,
          status: 'ACTIVE',
          startedAt: now,
          currentDay: 1,
          lastClaimAt: now,
          nextClaimAt, // Rolling cooldown applies before Day 1 of next cycle can be claimed
        },
      ],
      { session }
    );
  }

  // Step E: Write immutable AuditLog
  await AuditLog.create(
    [
      {
        userId,
        eventType: 'STREAK_CLAIM_SUCCESS',
        detail: {
          day: eligibleDay,
          cycleId: cycle._id,
          rewardId: rewardConfig._id,
          currency: rewardConfig.currency,
          amount: rewardConfig.amount,
          transactionId: creditResult.transactionId,
          referenceId: deterministicRefId,
          balanceAfter: creditResult.balanceAfter,
          isCycleCompleted: isLastDay,
          claimedAt: now,
        },
      },
    ],
    { session }
  );

  return {
    transactionId: creditResult.transactionId,
    balanceBefore: creditResult.balanceBefore,
    balanceAfter: creditResult.balanceAfter,
  };
}

/**
 * Error translation helper
 */
function _handleClaimError(err) {
  if (err.code === 11000) {
    // E11000 Duplicate Key: hit StreakClaim or WalletTransaction unique index
    throw createError(
      'This reward has already been claimed.',
      409,
      ERROR_CODES.ALREADY_CLAIMED
    );
  }
  throw err;
}

// ─── Internal Query & Payload Helpers ──────────────────────────────────────────

/**
 * Retrieve StreakConfig singleton document.
 */
async function _getConfig() {
  let config = await StreakConfig.findOne({ active: true });
  if (!config) {
    // Graceful default if seed not yet executed
    config = await StreakConfig.create({
      cycleLengthDays: 7,
      claimIntervalHours: 24,
      missedWindowHours: 24,
      active: true,
    });
  }
  return config;
}

/**
 * Race-safe active cycle retrieval.
 * Uses atomic findOneAndUpdate with upsert or catches E11000 to prevent duplicate active cycles.
 */
async function _getOrCreateActiveCycle(userId, config, now) {
  let cycle = await StreakCycle.findOne({ userId, status: 'ACTIVE' });
  if (cycle) return cycle;

  const cycleNum = await _nextCycleNumber(userId);

  try {
    cycle = await StreakCycle.create({
      userId,
      cycleNumber: cycleNum,
      status: 'ACTIVE',
      startedAt: now,
      currentDay: 1,
      lastClaimAt: null,
      nextClaimAt: null,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Race condition won by a concurrent request: retrieve the newly created active cycle
      cycle = await StreakCycle.findOne({ userId, status: 'ACTIVE' });
    } else {
      throw err;
    }
  }

  // Ensure user also has a Wallet
  await Wallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, balances: { VES: 0, INR: 0 } } },
    { upsert: true }
  );

  return cycle;
}

/**
 * Compute the next cycle number for a given user.
 */
async function _nextCycleNumber(userId) {
  const last = await StreakCycle.findOne({ userId }).sort({ cycleNumber: -1 }).lean();
  return last ? (last.cycleNumber || 1) + 1 : 1;
}

/**
 * Build the 7-day rewards array with per-day statuses:
 * LOCKED | AVAILABLE | TODAY_LOCKED | CLAIMED | MISSED
 */
async function _buildRewardsArray(userId, cycle, config, now) {
  const allRewards = await StreakReward.find({ active: true }).sort({ day: 1 }).lean();
  const claims = await StreakClaim.find({ userId, cycleId: cycle._id }).lean();
  const claimedDays = new Set(claims.map((c) => c.day));

  const totalDays = config.cycleLengthDays || 7;
  const isCooldownActive = cycle.nextClaimAt && now.getTime() < new Date(cycle.nextClaimAt).getTime();

  return allRewards.slice(0, totalDays).map((r) => {
    let status;

    if (claimedDays.has(r.day)) {
      status = 'CLAIMED';
    } else if (r.day === cycle.currentDay) {
      status = isCooldownActive ? 'TODAY_LOCKED' : 'AVAILABLE';
    } else if (r.day < cycle.currentDay) {
      // Prior day not claimed in active cycle
      status = 'MISSED';
    } else {
      // Future day
      status = 'LOCKED';
    }

    return {
      day: r.day,
      status,
      reward: {
        type: r.rewardType,
        currency: r.currency,
        amount: r.amount,
        title: r.title,
        assetType: r.assetType,
        isUltimate: r.day === totalDays,
        metadata: r.metadata,
      },
    };
  });
}

/**
 * Build streak summary object for frontend rendering.
 */
function _buildStreakSummary(cycle, config, now) {
  const totalRewards = config.cycleLengthDays || 7;
  const currentStreak = cycle.currentDay - 1;
  const checkedIn = cycle.currentDay - 1;

  let remainingMs = 0;
  if (cycle.nextClaimAt && now.getTime() < new Date(cycle.nextClaimAt).getTime()) {
    remainingMs = Math.max(0, new Date(cycle.nextClaimAt).getTime() - now.getTime());
  }

  const nextRewardDay = Math.min(cycle.currentDay, totalRewards);

  return {
    currentStreak,
    currentDay: cycle.currentDay,
    checkedIn,
    totalRewards,
    nextClaimAt: cycle.nextClaimAt ? new Date(cycle.nextClaimAt).toISOString() : null,
    lastClaimAt: cycle.lastClaimAt ? new Date(cycle.lastClaimAt).toISOString() : null,
    remainingMs,
    nextReward: nextRewardDay,
    status: cycle.status,
    cycleNumber: cycle.cycleNumber || 1,
  };
}

module.exports = {
  getStreakStatus,
  getEligibilityStatus,
  getWalletBalance,
  checkMissedWindow,
  resetStreak,
  claimReward,
  getClaimHistory,
};
