// src/controllers/auth.controller.js
// Thin controller — calls service, shapes response. No business logic here.
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const jwt = require('jsonwebtoken');

/**
 * POST /api/auth/register
 * Body: { email, password }
 */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Create user (pre-save hook hashes password)
    const user = await User.create({ email, passwordHash: password });

    // Create wallet immediately so it always exists
    await Wallet.create({ userId: user._id });

    const token = signToken(user._id);
    res.status(201).json({ success: true, token, userId: user._id });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Select passwordHash explicitly (field has select:false)
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = signToken(user._id);
    res.json({ success: true, token, userId: user._id });
  } catch (err) {
    next(err);
  }
}

function signToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = { register, login };
