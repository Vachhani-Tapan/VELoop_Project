// src/models/Wallet.js
// Per A9: generalized multi-currency balance map — balances.VES, .SVES, .GEMS, .TOKENS, .SPINS
// All writes MUST go through wallet.service.js creditWallet/debitWallet — never Wallet.updateOne() directly.
const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

// Build the balances sub-schema dynamically from the canonical currency list
const balancesSchema = {};
CURRENCIES.forEach((c) => {
  balancesSchema[c] = { type: Number, default: 0, min: 0 };
});

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    balances: {
      type: balancesSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', walletSchema);
