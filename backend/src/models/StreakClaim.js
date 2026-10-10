// src/models/StreakClaim.js
// Immutable ledger — one document per successful claim.
// The UNIQUE compound index on {userId, cycleId, day} is the DB-level
// backstop against duplicate/concurrent claims (architecture A2 + A4 step 9a).
const mongoose = require('mongoose');
const { CLAIM_STATUSES } = require('../config/constants');

const streakClaimSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StreakCycle',
      required: true,
    },
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    rewardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StreakReward',
      required: true,
    },
    status: {
      type: String,
      enum: CLAIM_STATUSES,
      default: 'SUCCESS',
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    transactionId: {
      type: String, // "STREAK-xxxxxxxx" — matches WalletTransaction.transactionId
      required: true,
    },
  },
  { timestamps: false } // claimedAt is the canonical timestamp
);

// THE critical unique index — prevents duplicate/concurrent claims at the DB layer
streakClaimSchema.index({ userId: 1, cycleId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('StreakClaim', streakClaimSchema);
