// src/models/StreakCycle.js
// One active cycle per user at a time.
// After Day 7 is claimed → status=COMPLETED and a new cycle at Day 1 is
// created in the same transaction (no cooldown). See architecture A4 step 9c.
const mongoose = require('mongoose');
const { CYCLE_STATUSES } = require('../config/constants');

const streakCycleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cycleNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: CYCLE_STATUSES,
      default: 'ACTIVE',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    currentDay: {
      type: Number,
      default: 1,
      min: 1,
      max: 7,
    },
    lastClaimAt: {
      type: Date,
      default: null,
    },
    nextClaimAt: {
      type: Date,
      default: null, // null = Day 1 has no time gate
    },
  },
  { timestamps: true }
);

// Unique partial index: exactly one ACTIVE cycle per user at the database level.
// Prevents race conditions during initial cycle creation.
streakCycleSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

module.exports = mongoose.model('StreakCycle', streakCycleSchema);

