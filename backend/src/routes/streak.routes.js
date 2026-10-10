// src/routes/streak.routes.js
// All 4 daily-streak endpoints from A3. All require JWT authentication.
// Rate limiting on /claim is applied here (Phase 2 will tighten this).
const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { getStreak, getStatus, claimReward, getHistory } = require('../controllers/streak.controller');

const router = express.Router();

// Rate limiter for the claim endpoint — the only live balance-changing route in this project.
// Conservative initial setting; Phase 2 will configure per A9 risk tiers.
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 claim attempts per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many claim attempts. Please try again later.' },
});

router.get('/', auth, getStreak);
router.get('/status', auth, getStatus);
router.post('/claim', auth, claimLimiter, claimReward);
router.get('/history', auth, getHistory);

module.exports = router;
