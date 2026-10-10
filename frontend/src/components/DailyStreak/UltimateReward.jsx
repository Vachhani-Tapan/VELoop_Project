import React from 'react';
import { Lock, CheckCircle } from 'lucide-react';
import styles from './DailyStreak.module.css';

export default function UltimateReward({ streak, rewards }) {
  const day7Claimed = rewards?.find(r => r.day === 7)?.status === 'CLAIMED';
  const isUnlocked = streak?.status === 'COMPLETED' || day7Claimed;

  return (
    <div className={styles.ultimateRewardCard}>
      <div className={styles.ultimateLeft}>
        <div className={styles.crownGlow}>
          <img src="/assets/Day-7.png" alt="Crown" className={styles.ultimateCrownImg} />
        </div>
      </div>
      
      <div className={styles.ultimateCenter}>
        <div className={styles.ultimateTitle}>Ultimate Reward</div>
        <div className={styles.ultimateAmount}>₹5</div>
        <div className={styles.ultimateSubtitle}>
          <span className={styles.amazonIcon}>a</span> Amazon Gift Card
        </div>
      </div>

      <div className={styles.ultimateRight}>
        <div className={styles.lockCircle}>
          {isUnlocked ? <CheckCircle size={20} color="var(--color-success)" /> : <Lock size={20} color="var(--color-text-muted)" />}
        </div>
        <div className={styles.unlockText}>
          {isUnlocked ? 'Unlocked!' : 'Unlock on\nDay 7'}
        </div>
      </div>
    </div>
  );
}
