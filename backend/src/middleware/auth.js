// src/middleware/auth.js
// ─────────────────────────────────────────────────────────────────────────────
// JWT verification middleware.
// Extracts and verifies JWT from Authorization: Bearer <token>.
// req.userId is strictly bound to the authenticated subject.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const jwt = require('jsonwebtoken');
const { ERROR_CODES } = require('../config/constants');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication required. Please log in to continue.',
    });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication token missing.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    req.userId = decoded.userId || decoded.id || decoded._id;

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Invalid authentication token payload.',
      });
    }

    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? ERROR_CODES.INVALID_TOKEN : ERROR_CODES.UNAUTHORIZED;
    return res.status(401).json({
      success: false,
      code,
      message: 'Session expired or invalid. Please log in again.',
    });
  }
}

module.exports = auth;
