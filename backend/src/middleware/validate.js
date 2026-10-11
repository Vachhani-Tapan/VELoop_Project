// src/middleware/validate.js
// ─────────────────────────────────────────────────────────────────────────────
// Request validation and sanitization middleware.
// Rejects malformed JSON bodies. Unknown fields are stripped/ignored, never trusted.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const { ERROR_CODES } = require('../config/constants');

function validateClaimRequest(req, res, next) {
  // Reject malformed bodies (e.g., body that is not a plain object)
  if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({
      success: false,
      code: ERROR_CODES.INVALID_REQUEST,
      message: 'Malformed request body.',
    });
  }

  // Extract optional day hint if provided (advisory only)
  let dayHint = null;
  if (req.body && 'day' in req.body) {
    if (typeof req.body.day === 'number' && Number.isInteger(req.body.day) && req.body.day >= 1) {
      dayHint = req.body.day;
    } else if (req.body.day !== null && req.body.day !== undefined) {
      return res.status(400).json({
        success: false,
        code: ERROR_CODES.INVALID_REQUEST,
        message: 'Invalid day parameter in request body.',
      });
    }
  }

  // Check optional Idempotency-Key header
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || null;

  req.validatedClaim = {
    dayHint,
    idempotencyKey,
  };

  next();
}

module.exports = {
  validateClaimRequest,
};
