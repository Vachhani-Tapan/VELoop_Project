// src/utils/clock.js
// ─────────────────────────────────────────────────────────────────────────────
// Trusted Server Clock Utility.
// Single source of truth for all date/time decisions in the application.
// In tests or simulations, offset can be set to simulate time passage without
// modifying system time or polluting global Date.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

let customOffsetMs = 0;

/**
 * Get current trusted server time as UTC Date.
 * @returns {Date}
 */
function getServerNow() {
  return new Date(Date.now() + customOffsetMs);
}

/**
 * Get current trusted server time in ISO 8601 string.
 * @returns {string}
 */
function getServerIsoNow() {
  return getServerNow().toISOString();
}

/**
 * Offset the server clock by a given number of milliseconds (for automated tests).
 * @param {number} ms 
 */
function setClockOffset(ms) {
  customOffsetMs = ms;
}

/**
 * Reset simulated clock back to true system time.
 */
function resetClock() {
  customOffsetMs = 0;
}

module.exports = {
  getServerNow,
  getServerIsoNow,
  setClockOffset,
  resetClock,
};
