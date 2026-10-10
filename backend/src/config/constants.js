// src/config/constants.js
// Central home for enum values and configuration constants referenced by
// multiple parts of the system. Never duplicate these inline.

const CURRENCIES = Object.freeze(['VES', 'SVES', 'GEMS', 'TOKENS', 'SPINS', 'INR']);

const REWARD_TYPES = Object.freeze(['VES', 'GIFT_CARD', 'Amazon Gift Card']);

const ASSET_TYPES = Object.freeze(['coin', 'gift-box', 'crown']);

const CYCLE_STATUSES = Object.freeze(['ACTIVE', 'COMPLETED', 'RESET']);

const CLAIM_STATUSES = Object.freeze(['SUCCESS', 'FAILED']);

const TRANSACTION_TYPES = Object.freeze(['CREDIT', 'DEBIT']);

const TRANSACTION_SOURCES = Object.freeze(['DAILY_STREAK']);

const AUDIT_EVENT_TYPES = Object.freeze([
  'STREAK_CLAIM_REQUEST',
  'STREAK_CLAIM_SUCCESS',
  'STREAK_CLAIM_REJECTED',
  'STREAK_RESET',
  'DUPLICATE_CLAIM',
  'INVALID_CLAIM',
  'WALLET_CREDIT',
  'WALLET_DEBIT',
  'WALLET_DEBIT_REJECTED',
]);

module.exports = {
  CURRENCIES,
  REWARD_TYPES,
  ASSET_TYPES,
  CYCLE_STATUSES,
  CLAIM_STATUSES,
  TRANSACTION_TYPES,
  TRANSACTION_SOURCES,
  AUDIT_EVENT_TYPES,
};
