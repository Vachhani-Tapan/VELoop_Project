// src/models/StreakConfig.js
// Singleton document — only one active config should exist.
// cycleLengthDays: total days in a cycle (7)
// claimIntervalHours: hours between eligible claims (24)
const mongoose = require('mongoose');

const streakConfigSchema = new mongoose.Schema(
  {
    cycleLengthDays: {
      type: Number,
      required: true,
      default: 7,
    },
    claimIntervalHours: {
      type: Number,
      required: true,
      default: 24,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StreakConfig', streakConfigSchema);
