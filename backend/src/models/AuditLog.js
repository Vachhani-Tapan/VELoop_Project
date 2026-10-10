// src/models/AuditLog.js
// Write-only event log. Never updated — only inserted.
// Written at every meaningful pipeline decision point (streak-level AND wallet-level).
const mongoose = require('mongoose');
const { AUDIT_EVENT_TYPES } = require('../config/constants');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: AUDIT_EVENT_TYPES,
      required: true,
    },
    detail: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Index on createdAt for time-based queries / admin dashboards
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
