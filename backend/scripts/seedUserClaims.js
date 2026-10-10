require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const StreakCycle = require('../src/models/StreakCycle');
const StreakClaim = require('../src/models/StreakClaim');
const StreakReward = require('../src/models/StreakReward');
const WalletTransaction = require('../src/models/WalletTransaction');
const Wallet = require('../src/models/Wallet');

async function seedUserClaims() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const rand = Math.floor(Math.random() * 10000);
  const username = `demoUser${rand}`;
  let user = await User.findOne({ username });
  
  if (!user) {
    user = await User.create({ 
      username, 
      email: `demo${rand}@example.com`, 
      passwordHash: 'password123' // The pre-save hook in User model will hash this automatically!
    });
    console.log(`Created user: ${username} (password: password123)`);
  } else {
    console.log(`User ${username} already exists. Resetting their streak...`);
    await StreakCycle.deleteMany({ userId: user._id });
    await StreakClaim.deleteMany({ userId: user._id });
    await WalletTransaction.deleteMany({ userId: user._id });
    await Wallet.deleteMany({ userId: user._id });
  }

  // Create active cycle
  const now = new Date();
  const cycle = await StreakCycle.create({
    userId: user._id,
    cycleNumber: 1,
    status: 'COMPLETED',
    startedAt: now,
    currentDay: 7, // All 7 days claimed
    lastClaimAt: now,
    nextClaimAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  });

  console.log('Created Streak Cycle.');

  // Fetch rewards to create claims
  const rewards = await StreakReward.find({ active: true }).sort({ day: 1 });
  let totalVES = 0;
  let totalINR = 0;

  for (const reward of rewards) {
    await StreakClaim.create({
      userId: user._id,
      cycleId: cycle._id,
      day: reward.day,
      rewardId: reward._id,
      status: 'SUCCESS',
      claimedAt: new Date(now.getTime() - (7 - reward.day) * 24 * 60 * 60 * 1000),
      transactionId: `STREAK-SEED-${reward.day}`
    });

    if (reward.currency === 'VES') totalVES += reward.amount;
    if (reward.currency === 'INR') totalINR += reward.amount;
  }

  // Update wallet
  await Wallet.create({
    userId: user._id,
    balances: {
      VES: totalVES,
      INR: totalINR
    }
  });

  console.log('Inserted all claims and updated wallet balances.');
  console.log('--------------------------------------------------');
  console.log(`Login with Username: ${username}`);
  console.log(`Password: password123`);
  console.log(`They have ${totalVES} VES and ${totalINR} INR in their wallet.`);
  console.log('--------------------------------------------------');

  await mongoose.disconnect();
}

seedUserClaims().catch(err => {
  console.error(err);
  process.exit(1);
});
