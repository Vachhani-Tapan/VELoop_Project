// src/routes/streak.routes.js
// ─────────────────────────────────────────────────────────────────────────────
// Daily streak API routes — all protected by JWT auth.
// Rate limiting and body validation strictly applied on balance-changing POST /claim.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { validateClaimRequest } = require('../middleware/validate');
const {
  getStreak,
  getStatus,
  getWallet,
  claimReward,
  getHistory,
} = require('../controllers/streak.controller');
const { ERROR_CODES } = require('../config/constants');

const router = express.Router();

// Rate limiter for claim requests: 10 attempts per IP per 15 minutes window
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many claim requests. Please wait a moment and try again.',
    });
  },
});

router.get('/', auth, getStreak);
router.get('/status', auth, getStatus);
router.get('/wallet', auth, getWallet);
router.get('/history', auth, getHistory);
router.post('/claim', auth, claimLimiter, validateClaimRequest, claimReward);

module.exports = router;
