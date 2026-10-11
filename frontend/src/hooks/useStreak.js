// src/hooks/useStreak.js
// ─────────────────────────────────────────────────────────────────────────────
// Authoritative Streak State Hook.
//
// Rules enforced:
// 1. All UI state is derived directly from MongoDB responses.
// 2. No optimistic balance or card patching — always re-fetches full state
//    from the backend upon successful claim.
// 3. Translates backend error codes into user-friendly messages.
// 4. Manages reset alerts when backend reports STREAK_RESET.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { getStreak, getStreakStatus, claimStreak } from '../services/streakApi';
import { getFriendlyErrorMessage } from '../utils/errorMap';

export function useStreak(onUnauthorized) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [resetNotice, setResetNotice] = useState(null);

  // Initial full state load
  const loadStreak = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getStreak();
      setData(res);
    } catch (err) {
      if (err.response?.status === 401 && typeof onUnauthorized === 'function') {
        onUnauthorized();
      } else {
        const friendly = getFriendlyErrorMessage(err);
        setError(friendly.message);
      }
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  // Lightweight status refresh (triggered when countdown timer hits 0)
  const refreshStatus = useCallback(async () => {
    try {
      const res = await getStreakStatus();
      setData(res);
    } catch (err) {
      if (err.response?.status === 401 && typeof onUnauthorized === 'function') {
        onUnauthorized();
      }
    }
  }, [onUnauthorized]);

  // Execute claim through backend pipeline
  const claim = useCallback(async (dayHint = null) => {
    if (claiming) return;

    try {
      setClaiming(true);
      setNotification(null);
      setResetNotice(null);

      // Unique idempotency key per button press attempt
      const idempotencyKey = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const claimResponse = await claimStreak(dayHint, idempotencyKey);

      // Re-fetch authoritative state from MongoDB (never patch locally)
      const freshState = await getStreak();
      setData(freshState);

      const rewardDesc = claimResponse.reward?.amount
        ? `${claimResponse.reward.amount} ${claimResponse.reward.currency}`
        : 'your reward';

      setNotification({
        type: 'success',
        title: 'Reward Claimed!',
        message: `Successfully claimed Day ${claimResponse.day} reward (${rewardDesc}).`,
      });

      return claimResponse;
    } catch (err) {
      const friendly = getFriendlyErrorMessage(err);

      if (friendly.code === 'STREAK_RESET') {
        setResetNotice(friendly.message);
        // Refresh state to show Day 1
        await loadStreak();
      } else {
        setNotification({
          type: 'error',
          title: 'Claim Failed',
          message: friendly.message,
        });
      }

      if (err.response?.status === 401 && typeof onUnauthorized === 'function') {
        onUnauthorized();
      }

      throw err;
    } finally {
      setClaiming(false);
    }
  }, [claiming, loadStreak, onUnauthorized]);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  return {
    data,
    loading,
    claiming,
    error,
    notification,
    resetNotice,
    claim,
    refreshStatus,
    reload: loadStreak,
    clearNotification: () => setNotification(null),
    clearResetNotice: () => setResetNotice(null),
  };
}
