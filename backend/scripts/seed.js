// scripts/seed.js
// Idempotent seed for StreakConfig and StreakReward (7 days).
// Safe to re-run: uses upsert/replaceOne so existing data is updated, not duplicated.
//
// Usage: node scripts/seed.js
//        or: npm run seed  (from backend/)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const StreakConfig = require('../src/models/StreakConfig');
const StreakReward = require('../src/models/StreakReward');

// ─── Seed data ───────────────────────────────────────────────────────────────
// Reward amounts and assets per the design reference in the architecture brief.
// Day 4 = gift-box (special), Day 7 = crown (ultimate prize).
// All rewards are VES currency per A9 scope decision.
const STREAK_REWARDS = [
  { day: 1, rewardType: 'VES', currency: 'VES', amount: 5,   title: 'Day 1 Reward',        assetType: 'coin',     active: true, metadata: { badge: 'Daily' } },
  { day: 2, rewardType: 'VES', currency: 'VES', amount: 10,  title: 'Day 2 Reward',        assetType: 'coin',     active: true, metadata: { badge: 'Daily' } },
  { day: 3, rewardType: 'VES', currency: 'VES', amount: 15,  title: 'Day 3 Reward',        assetType: 'coin',     active: true, metadata: { badge: 'Daily' } },
  { day: 4, rewardType: 'Amazon Gift Card', currency: 'INR', amount: 1,  title: 'Day 4 Special Gift',  assetType: 'gift-box', active: true, metadata: { badge: 'Special' } },
  { day: 5, rewardType: 'Amazon Gift Card', currency: 'INR', amount: 2,  title: 'Day 5 Reward',        assetType: 'gift-card', active: true, metadata: { badge: 'Daily' } },
  { day: 6, rewardType: 'VES', currency: 'VES', amount: 30,  title: 'Day 6 Reward',        assetType: 'coin',     active: true, metadata: { badge: 'Daily' } },
  { day: 7, rewardType: 'Amazon Gift Card', currency: 'INR', amount: 5, title: 'Day 7 Ultimate Reward', assetType: 'crown',  active: true, metadata: { badge: 'Ultimate' } },
];

const STREAK_CONFIG = {
  cycleLengthDays: 7,
  claimIntervalHours: 24,
  active: true,
};

// ─── Seed runner ─────────────────────────────────────────────────────────────
async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[Seed] MONGO_URI is not set. Create a .env from .env.example first.');
    process.exit(1);
  }

  console.log('[Seed] Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('[Seed] Connected.');

  // ── StreakConfig (singleton — upsert the one active doc) ─────────────────
  const configResult = await StreakConfig.findOneAndUpdate(
    { active: true },
    { $set: STREAK_CONFIG },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`[Seed] StreakConfig upserted: _id=${configResult._id}`);

  // ── StreakReward (one per day — upsert keyed on day) ─────────────────────
  let upsertCount = 0;
  for (const reward of STREAK_REWARDS) {
    await StreakReward.findOneAndUpdate(
      { day: reward.day },
      { $set: reward },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upsertCount++;
    console.log(`[Seed]   Day ${reward.day}: ${reward.amount} ${reward.currency} (${reward.assetType})`);
  }
  console.log(`[Seed] StreakReward: ${upsertCount} days upserted.`);

  console.log('[Seed] Done. Disconnecting.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
