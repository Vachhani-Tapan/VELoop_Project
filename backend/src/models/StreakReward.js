// src/models/StreakReward.js
// Config data: one document per day (days 1–7).
// These are read by the backend during the claim pipeline — client values are DISCARDED.
const mongoose = require('mongoose');
const { REWARD_TYPES, CURRENCIES, ASSET_TYPES } = require('../config/constants');

const streakRewardSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
      unique: true,
    },
    rewardType: {
      type: String,
      enum: REWARD_TYPES,
      required: true,
    },
    currency: {
      type: String,
      enum: CURRENCIES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    title: {
      type: String,
      required: true,
    },
    assetType: {
      type: String,
      enum: ASSET_TYPES,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StreakReward', streakRewardSchema);
