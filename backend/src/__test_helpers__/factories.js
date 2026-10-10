// src/__tests__/helpers/factories.js
// Test data factories — create real DB documents for use in tests.
'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');
const Wallet   = require('../models/Wallet');
const StreakConfig  = require('../models/StreakConfig');
const StreakReward  = require('../models/StreakReward');

/**
 * Create a test user + wallet pair.
 * Password is stored as a bcrypt hash so auth tests work.
 */
async function createUser(overrides = {}) {
  const email    = overrides.email    || `test_${Date.now()}@example.com`;
  const password = overrides.password || 'TestPass123!';
  const hash     = await bcrypt.hash(password, 10);

  const user   = await User.create({ email, passwordHash: hash });
  const wallet = await Wallet.create({ userId: user._id });
  return { user, wallet, password };
}

/**
 * Seed StreakConfig singleton (idempotent).
 */
async function ensureStreakConfig(overrides = {}) {
  return StreakConfig.findOneAndUpdate(
    { active: true },
    {
      $set: {
        cycleLengthDays:    overrides.cycleLengthDays    ?? 7,
        claimIntervalHours: overrides.claimIntervalHours ?? 24,
        active:             true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Seed all 7 StreakReward docs (idempotent).
 */
async function ensureStreakRewards() {
  const REWARDS = [
    { day: 1, rewardType: 'VES', currency: 'VES', amount: 5,   title: 'Day 1', assetType: 'coin'    },
    { day: 2, rewardType: 'VES', currency: 'VES', amount: 10,  title: 'Day 2', assetType: 'coin'    },
    { day: 3, rewardType: 'VES', currency: 'VES', amount: 15,  title: 'Day 3', assetType: 'coin'    },
    { day: 4, rewardType: 'VES', currency: 'VES', amount: 25,  title: 'Day 4', assetType: 'gift-box'},
    { day: 5, rewardType: 'VES', currency: 'VES', amount: 30,  title: 'Day 5', assetType: 'coin'    },
    { day: 6, rewardType: 'VES', currency: 'VES', amount: 40,  title: 'Day 6', assetType: 'coin'    },
    { day: 7, rewardType: 'VES', currency: 'VES', amount: 100, title: 'Day 7', assetType: 'crown'   },
  ];
  for (const r of REWARDS) {
    await StreakReward.findOneAndUpdate(
      { day: r.day },
      { $set: { ...r, active: true } },
      { upsert: true, new: true }
    );
  }
}

module.exports = { createUser, ensureStreakConfig, ensureStreakRewards };
