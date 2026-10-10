// src/controllers/streak.controller.js
// Thin controller — calls streak.service, shapes response. No business logic.
// Stubs ready for Phase 1 service implementation.
const streakService = require('../services/streak.service');

/**
 * GET /api/daily-streak
 * Full state: streak + 7 reward cards + wallet balance
 */
async function getStreak(req, res, next) {
  try {
    const data = await streakService.getStreakStatus(req.userId);
    res.json({ success: true, serverTime: new Date().toISOString(), ...data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/daily-streak/status
 * Lightweight poll — eligibility + serverTime only
 */
async function getStatus(req, res, next) {
  try {
    const data = await streakService.getEligibilityStatus(req.userId);
    res.json({ success: true, serverTime: new Date().toISOString(), ...data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/daily-streak/claim
 * Body is advisory (day hint only). All values re-derived server-side.
 */
async function claimReward(req, res, next) {
  try {
    // client body is advisory only — day hint accepted but not trusted
    const hint = req.body && typeof req.body.day === 'number' ? req.body.day : null;
    const data = await streakService.claimReward(req.userId, hint);
    res.json({ success: true, serverTime: new Date().toISOString(), ...data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/daily-streak/history
 * Paginated StreakClaim ledger
 */
async function getHistory(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const data = await streakService.getClaimHistory(req.userId, page, limit);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStreak, getStatus, claimReward, getHistory };
