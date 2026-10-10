// src/middleware/auth.js
// JWT verification middleware.
// userId is ALWAYS taken from the decoded token — never from body/query/params.
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }

  const token = header.slice(7); // strip "Bearer "
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach only userId — nothing else is needed downstream
    req.userId = decoded.userId || decoded.id || decoded._id;
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Invalid token payload.' });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
}

module.exports = auth;
