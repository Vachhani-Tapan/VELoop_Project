// src/middleware/errorHandler.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized security error handler.
// Standardized JSON format: { success: false, code, message }
// Sanitizes all database exceptions, prevents leaking stack traces,
// connection strings, or internal query parameters.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const { ERROR_CODES } = require('../config/constants');

function errorHandler(err, req, res, _next) {
  // Always log raw error server-side for observability/diagnostics
  console.error('[Error Pipeline]', {
    message: err.message,
    code: err.code,
    status: err.status,
    path: req.originalUrl,
    method: req.method,
    userId: req.userId,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // 1. Explicit domain / business logic error thrown by services
  if (err.status && err.code) {
    return res.status(err.status).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  // 2. Mongoose unique index violation (E11000)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      code: ERROR_CODES.ALREADY_CLAIMED,
      message: 'This reward has already been claimed for today.',
    });
  }

  // 3. Mongoose validation errors / CastError
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      code: ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid request data.',
    });
  }

  // 4. JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Please log in to continue.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      code: ERROR_CODES.INVALID_TOKEN,
      message: 'Session has expired. Please log in again.',
    });
  }

  // 5. MongoDB transient / write conflict not caught
  if (err.hasErrorLabel?.('TransientTransactionError') || err.code === 112) {
    return res.status(409).json({
      success: false,
      code: ERROR_CODES.CLAIM_CONFLICT,
      message: 'System is currently processing conflicting claims. Please try again.',
    });
  }

  // 6. Generic internal server error fallback (never leak internals)
  const status = err.status || 500;
  return res.status(status).json({
    success: false,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'Unable to process your request at this time. Please try again.',
  });
}

module.exports = errorHandler;
