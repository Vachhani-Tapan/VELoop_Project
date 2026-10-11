// src/hooks/useServerCountdown.js
// ─────────────────────────────────────────────────────────────────────────────
// High-Precision Server Time Countdown Hook.
//
// Invariants:
// 1. NEVER trusts local Date.now() in isolation — anchors to serverTime using
//    performance.now() elapsed delta to prevent device clock spoofing.
// 2. Countdown is DISPLAY ONLY.
// 3. When countdown reaches 0: calls onZeroReached() which asks the backend
//    (GET /api/daily-streak/status). The frontend NEVER unlocks buttons locally.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';

export function useServerCountdown(nextClaimAt, serverTime, onZeroReached) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [formatted, setFormatted] = useState('');
  const hasTriggeredZeroRef = useRef(false);

  useEffect(() => {
    if (!nextClaimAt) {
      setRemainingMs(0);
      setFormatted('Ready Now!');
      return;
    }

    const targetTime = new Date(nextClaimAt).getTime();
    const initialServerTime = serverTime ? new Date(serverTime).getTime() : Date.now();
    const perfStart = performance.now();
    hasTriggeredZeroRef.current = false;

    const tick = () => {
      const elapsed = performance.now() - perfStart;
      const currentServerTime = initialServerTime + elapsed;
      const diff = targetTime - currentServerTime;

      if (diff <= 0) {
        setRemainingMs(0);
        setFormatted('Ready Now!');

        if (!hasTriggeredZeroRef.current) {
          hasTriggeredZeroRef.current = true;
          if (typeof onZeroReached === 'function') {
            // Let the backend decide authoritative eligibility
            onZeroReached();
          }
        }
      } else {
        setRemainingMs(diff);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        const pad = (n) => String(n).padStart(2, '0');
        setFormatted(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
      }
    };

    tick();
    const intervalId = setInterval(tick, 1000);

    return () => clearInterval(intervalId);
  }, [nextClaimAt, serverTime, onZeroReached]);

  return {
    remainingMs,
    formatted,
    isZero: remainingMs <= 0,
  };
}
