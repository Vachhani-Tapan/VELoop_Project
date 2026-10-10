// src/__tests__/wallet.service.test.js
'use strict';

const mongoose = require('mongoose');
const { connect, disconnect, clearCollections } = require('../__test_helpers__/db');
const { createUser } = require('../__test_helpers__/factories');
const walletService = require('../services/wallet.service');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

beforeEach(async () => {
  await clearCollections('User', 'Wallet', 'WalletTransaction', 'AuditLog');
});

describe('wallet.service', () => {
  describe('creditWallet', () => {
    it('successfully credits and creates ledger entries', async () => {
      const { user } = await createUser();
      const session = await mongoose.startSession();
      const refId = new mongoose.Types.ObjectId().toString();

      let result;
      await session.withTransaction(async () => {
        result = await walletService.creditWallet(user._id, 'VES', 15, 'DAILY_STREAK', refId, session);
      });
      await session.endSession();

      expect(result.balanceBefore).toBe(0);
      expect(result.balanceAfter).toBe(15);
      expect(result.transactionId).toMatch(/^STREAK-/);

      const wallet = await Wallet.findOne({ userId: user._id });
      expect(wallet.balances.VES).toBe(15);

      const tx = await WalletTransaction.findOne({ referenceId: refId });
      expect(tx).toBeDefined();
      expect(tx.amount).toBe(15);
      expect(tx.type).toBe('CREDIT');
    });

    it('is idempotent given the same referenceId', async () => {
      const { user } = await createUser();
      const refId = new mongoose.Types.ObjectId().toString();

      // First credit
      const session1 = await mongoose.startSession();
      await session1.withTransaction(async () => {
        await walletService.creditWallet(user._id, 'VES', 20, 'DAILY_STREAK', refId, session1);
      });
      await session1.endSession();

      // Second credit with SAME refId
      const session2 = await mongoose.startSession();
      let result2;
      await session2.withTransaction(async () => {
        result2 = await walletService.creditWallet(user._id, 'VES', 20, 'DAILY_STREAK', refId, session2);
      });
      await session2.endSession();

      const wallet = await Wallet.findOne({ userId: user._id });
      expect(wallet.balances.VES).toBe(20); // Not 40!
      
      const txCount = await WalletTransaction.countDocuments({ referenceId: refId });
      expect(txCount).toBe(1);
    });
  });

  describe('debitWallet', () => {
    it('successfully debits when sufficient balance exists', async () => {
      const { user } = await createUser();
      const ref1 = new mongoose.Types.ObjectId().toString();
      const ref2 = new mongoose.Types.ObjectId().toString();

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        await walletService.creditWallet(user._id, 'VES', 50, 'DAILY_STREAK', ref1, session);
      });

      let result;
      await session.withTransaction(async () => {
        result = await walletService.debitWallet(user._id, 'VES', 20, 'DAILY_STREAK', ref2, session);
      });
      await session.endSession();

      expect(result.balanceBefore).toBe(50);
      expect(result.balanceAfter).toBe(30);

      const wallet = await Wallet.findOne({ userId: user._id });
      expect(wallet.balances.VES).toBe(30);
    });

    it('rejects with 402 if balance is insufficient', async () => {
      const { user } = await createUser();
      const ref = new mongoose.Types.ObjectId().toString();
      const session = await mongoose.startSession();

      await expect(
        session.withTransaction(async () => {
          await walletService.debitWallet(user._id, 'VES', 10, 'DAILY_STREAK', ref, session);
        })
      ).rejects.toThrow('Insufficient balance');

      await session.endSession();
    });
  });
});
