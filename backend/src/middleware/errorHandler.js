// src/middleware/errorHandler.js
// Central error-mapping middleware (A8).
// Raw exceptions are NEVER sent to the client — only logged server-side and
// written to AuditLog (that part is handled inside service functions).
// Must be the LAST app.use() in app.js.

function errorHandler(err, req, res, _next) {
  // Log raw error server-side only
  console.error('[ErrorHandler]', err);

  // Map known error types to spec-defined HTTP codes and user messages
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }

  // Mongoose duplicate key (e.g. duplicate claim hitting the unique index)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'This reward has already been claimed.',
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Invalid request data.' });
  }

  // JWT errors (should be caught by middleware, but belt-and-suspenders)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }

  // Fallback — generic 500, no leak
  return res.status(500).json({
    success: false,
    message: 'Unable to process your reward. Please try again.',
  });
}

module.exports = errorHandler;
