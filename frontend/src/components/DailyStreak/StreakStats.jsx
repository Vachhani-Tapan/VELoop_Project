// src/components/DailyStreak/StreakStats.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Displays current streak count, check-in count, and trusted server countdown.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useServerCountdown } from '../../hooks/useServerCountdown';
import styles from './DailyStreak.module.css';

export default function StreakStats({ streak, serverTime, onCountdownZero }) {
  const { formatted, isZero } = useServerCountdown(
    streak?.nextClaimAt,
    serverTime,
    onCountdownZero
  );

  if (!streak) return null;

  const timerText = isZero || !streak.nextClaimAt ? 'Ready Now!' : formatted;

  return (
    <div className={styles.statsContainer}>
      <div className={`glass-panel ${styles.statCard}`}>
        <div className={styles.statValue}>{streak.currentStreak}</div>
        <div className={styles.statLabel}>Current Streak</div>
      </div>
      <div className={`glass-panel ${styles.statCard}`}>
        <div className={styles.statValue}>
          {streak.checkedIn}/{streak.totalRewards}
        </div>
        <div className={styles.statLabel}>Checked In</div>
      </div>
      <div className={`glass-panel ${styles.statCard}`}>
        <div
          className={styles.statValue}
          style={{
            fontSize: '1.25rem',
            color: timerText === 'Ready Now!' ? 'var(--color-success)' : 'inherit',
          }}
        >
          {timerText}
        </div>
        <div className={styles.statLabel}>Next Reward</div>
      </div>
    </div>
  );
}
