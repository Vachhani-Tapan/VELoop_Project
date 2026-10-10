// src/models/WalletTransaction.js
// Currency-generic ledger row. Written by wallet.service.js only — never directly.
// transactionId format: "STREAK-<8-char-uuid-fragment>" (see A2)
const mongoose = require('mongoose');
const { TRANSACTION_TYPES, TRANSACTION_SOURCES, CURRENCIES } = require('../config/constants');

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true, // idempotency key — same referenceId → same transactionId → no-op on dupe
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: CURRENCIES,
      required: true,
    },
    source: {
      type: String,
      enum: TRANSACTION_SOURCES,
      required: true,
    },
    streakDay: {
      type: Number,
      default: null,
    },
    referenceId: {
      type: String, // StreakClaim._id.toString() or other feature reference
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
