// src/config/db.js
const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas.
 * Exits the process if the initial connection fails so the server never
 * silently runs without a DB.
 */
async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('[DB] MONGO_URI or MONGODB_URI is not set in environment.');
    throw new Error('MONGO_URI or MONGODB_URI is not set in environment.');
  }

  try {
    await mongoose.connect(uri);
    console.log('[DB] Connected to MongoDB');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    throw err;
  }
}

module.exports = connectDB;
