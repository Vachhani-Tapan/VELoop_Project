// src/services/wallet.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Per Architecture A9: the ONLY place any currency balance is changed.
// No feature service may call Wallet.updateOne() directly — ever.
//
// Every function enforces:
//   1. Input validation (amount > 0, known currency)
//   2. Idempotency via referenceId (no-op if WalletTransaction already exists)
//   3. Atomicity — runs inside the caller's Mongoose session/transaction
//   4. Ledger write (WalletTransaction) + AuditLog, every time, every currency
//   5. debitWallet: conditional $gte update — balance can never go negative
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const { v4: uuidv4 } = require('uuid');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');
const { CURRENCIES } = require('../config/constants');

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Credit a user's wallet for a specific currency.
 *
 * Idempotent: if a WalletTransaction with this referenceId already exists,
 * returns its recorded result without applying a second credit.
 *
 * @param {string|ObjectId}  userId       From JWT — never from client body
 * @param {string}           currency     One of CURRENCIES enum
 * @param {number}           amount       Must be > 0
 * @param {string}           source       e.g. 'DAILY_STREAK'
 * @param {string}           referenceId  e.g. StreakClaim._id.toString()
 * @param {ClientSession}    session      Mongoose session from the caller's transaction
 * @param {number}           [streakDay]  Optional — set when source=DAILY_STREAK
 * @returns {Promise<{balanceBefore:number, balanceAfter:number, transactionId:string}>}
 */
async function creditWallet(userId, currency, amount, source, referenceId, session, streakDay) {
  _validateInputs(currency, amount);

  // ── Idempotency check ────────────────────────────────────────────────────
  const existing = await WalletTransaction.findOne({ referenceId }).session(session);
  if (existing) {
    return {
      balanceBefore: existing.balanceBefore,
      balanceAfter: existing.balanceAfter,
      transactionId: existing.transactionId,
    };
  }

  // ── Read current balance (within same session) ───────────────────────────
  const wallet = await Wallet.findOne({ userId }).session(session);
  if (!wallet) {
    const err = new Error('Wallet not found for user.');
    err.status = 500;
    throw err;
  }
  const balanceBefore = wallet.balances[currency] ?? 0;
  const balanceAfter = balanceBefore + amount;

  // ── Atomic balance increment ─────────────────────────────────────────────
  await Wallet.updateOne(
    { userId },
    { $inc: { [`balances.${currency}`]: amount }, $set: { updatedAt: new Date() } },
    { session }
  );

  // ── Write WalletTransaction ledger row ───────────────────────────────────
  const transactionId = generateTransactionId('STREAK');
  await WalletTransaction.create(
    [
      {
        transactionId,
        userId,
        type: 'CREDIT',
        amount,
        currency,
        source,
        streakDay: streakDay ?? null,
        referenceId,
        balanceBefore,
        balanceAfter,
      },
    ],
    { session }
  );

  // ── AuditLog ─────────────────────────────────────────────────────────────
  await AuditLog.create(
    [
      {
        userId,
        eventType: 'WALLET_CREDIT',
        detail: { currency, amount, source, referenceId, balanceBefore, balanceAfter, transactionId },
      },
    ],
    { session }
  );

  return { balanceBefore, balanceAfter, transactionId };
}

/**
 * Debit a user's wallet for a specific currency.
 *
 * Uses a conditional $gte update — the operation is rejected atomically if the
 * balance would go negative (no feature can overdraft even under a race).
 *
 * No feature currently calls this (only DAILY_STREAK credits VEs). Fully
 * guarded so a future withdrawal/spend route is a thin controller on top.
 *
 * @param {string|ObjectId}  userId
 * @param {string}           currency
 * @param {number}           amount       Must be > 0
 * @param {string}           source
 * @param {string}           referenceId
 * @param {ClientSession}    session
 * @returns {Promise<{balanceBefore:number, balanceAfter:number, transactionId:string}>}
 * @throws 402 if insufficient balance
 */
async function debitWallet(userId, currency, amount, source, referenceId, session) {
  _validateInputs(currency, amount);

  // Idempotency
  const existing = await WalletTransaction.findOne({ referenceId }).session(session);
  if (existing) {
    return {
      balanceBefore: existing.balanceBefore,
      balanceAfter: existing.balanceAfter,
      transactionId: existing.transactionId,
    };
  }

  // Read current balance
  const wallet = await Wallet.findOne({ userId }).session(session);
  if (!wallet) {
    const err = new Error('Wallet not found for user.');
    err.status = 500;
    throw err;
  }
  const balanceBefore = wallet.balances[currency] ?? 0;

  if (balanceBefore < amount) {
    await AuditLog.create(
      [{ userId, eventType: 'WALLET_DEBIT_REJECTED', detail: { currency, amount, source, referenceId, balanceBefore } }],
      { session }
    );
    const err = new Error('Insufficient balance.');
    err.status = 402;
    throw err;
  }

  const balanceAfter = balanceBefore - amount;

  // Conditional atomic decrement — rejects if balance was changed concurrently
  const result = await Wallet.updateOne(
    { userId, [`balances.${currency}`]: { $gte: amount } },
    { $inc: { [`balances.${currency}`]: -amount }, $set: { updatedAt: new Date() } },
    { session }
  );

  if (result.modifiedCount === 0) {
    // Race: another debit beat us and reduced the balance
    const err = new Error('Insufficient balance (concurrent update).');
    err.status = 402;
    throw err;
  }

  const transactionId = generateTransactionId('DEBIT');
  await WalletTransaction.create(
    [{ transactionId, userId, type: 'DEBIT', amount, currency, source, streakDay: null, referenceId, balanceBefore, balanceAfter }],
    { session }
  );

  await AuditLog.create(
    [{ userId, eventType: 'WALLET_DEBIT', detail: { currency, amount, source, referenceId, balanceBefore, balanceAfter, transactionId } }],
    { session }
  );

  return { balanceBefore, balanceAfter, transactionId };
}

/**
 * Get the current balance for one currency.
 * Read-only — no session required.
 * @param {string|ObjectId} userId
 * @param {string}          currency
 * @returns {Promise<number>}
 */
async function getBalance(userId, currency) {
  if (!CURRENCIES.includes(currency)) {
    const err = new Error(`Unknown currency: ${currency}`);
    err.status = 400;
    throw err;
  }
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) return 0;
  return wallet.balances[currency] ?? 0;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _validateInputs(currency, amount) {
  if (!CURRENCIES.includes(currency)) {
    const err = new Error(`Invalid currency: ${currency}`);
    err.status = 400;
    throw err;
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    const err = new Error('Amount must be a positive finite number.');
    err.status = 400;
    throw err;
  }
}

/**
 * Generate a transaction ID.
 * Format: "STREAK-XXXXXXXX" (8 uppercase hex chars).
 * Exported so seed.js and tests can produce matching IDs.
 */
function generateTransactionId(prefix = 'STREAK') {
  return `${prefix}-${uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

module.exports = { creditWallet, debitWallet, getBalance, generateTransactionId };
