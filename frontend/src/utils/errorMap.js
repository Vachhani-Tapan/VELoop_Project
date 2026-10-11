// src/utils/errorMap.js
// ─────────────────────────────────────────────────────────────────────────────
// Maps backend error codes to clear, friendly user notifications.
// Never renders raw stack traces, database strings, or internal errors.
// ─────────────────────────────────────────────────────────────────────────────

export const ERROR_MESSAGES = {
  REWARD_COOLDOWN: 'Your next daily reward is currently cooling down. Please check the countdown timer.',
  ALREADY_CLAIMED: "You have already claimed today's reward! Return tomorrow to keep your streak going.",
  CYCLE_COMPLETE: 'Congratulations! You have completed all 7 days of the streak.',
  STREAK_RESET: 'Your previous streak expired and was reset to Day 1. Start your new streak today!',
  RATE_LIMITED: 'You are making requests too quickly. Please pause for a moment.',
  CLAIM_CONFLICT: 'A concurrent claim was detected. Refreshing your streak status.',
  UNAUTHORIZED: 'Please log in to claim your streak rewards.',
  INVALID_TOKEN: 'Your session has expired. Please log in again.',
  INVALID_REQUEST: 'Invalid request data. Please try again.',
  SERVICE_UNAVAILABLE: 'Rewards service is temporarily busy. Please try again in a few moments.',
  INTERNAL_SERVER_ERROR: 'Unable to process reward at this time. Please try again later.',
};

/**
 * Translate backend error response into a human-readable notification.
 * @param {object} err Axios error object
 * @returns {{ code: string, message: string }}
 */
export function getFriendlyErrorMessage(err) {
  const backendCode = err.response?.data?.code;
  const backendMsg = err.response?.data?.message;

  if (backendCode && ERROR_MESSAGES[backendCode]) {
    return {
      code: backendCode,
      message: ERROR_MESSAGES[backendCode],
    };
  }

  if (backendMsg && typeof backendMsg === 'string' && !backendMsg.includes('Mongo') && !backendMsg.includes('at ')) {
    return {
      code: backendCode || 'GENERIC_ERROR',
      message: backendMsg,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Something went wrong. Please check your connection and try again.',
  };
}
