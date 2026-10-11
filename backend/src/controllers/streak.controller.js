// src/controllers/streak.controller.js
// ─────────────────────────────────────────────────────────────────────────────
// Thin controller delegating to streak.service.
// Strips and ignores unverified client values, passes authenticated req.userId.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const streakService = require('../services/streak.service');

/**
 * GET /api/daily-streak
 * Full state: serverTime, streak summary, rewards[], wallet balances.
 */
async function getStreak(req, res, next) {
  try {
    const data = await streakService.getStreakStatus(req.userId);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/daily-streak/status
 * Full state poll endpoint used when countdown reaches 0.
 */
async function getStatus(req, res, next) {
  try {
    const data = await streakService.getEligibilityStatus(req.userId);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/daily-streak/wallet
 * Current user wallet balance across all currencies.
 */
async function getWallet(req, res, next) {
  try {
    const data = await streakService.getWalletBalance(req.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/daily-streak/claim
 * Validates, executes atomic claim, returns updated day, reward, balance, timers.
 */
async function claimReward(req, res, next) {
  try {
    const dayHint = req.validatedClaim?.dayHint ?? null;
    const idempotencyKey = req.validatedClaim?.idempotencyKey ?? null;

    const data = await streakService.claimReward(req.userId, dayHint, idempotencyKey);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/daily-streak/history
 * Paginated claim ledger history.
 */
async function getHistory(req, res, next) {
  try {
    const page = req.query.page;
    const limit = req.query.limit;
    const data = await streakService.getClaimHistory(req.userId, page, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStreak,
  getStatus,
  getWallet,
  claimReward,
  getHistory,
};
