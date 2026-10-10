import React from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './DailyStreak.module.css';

export default function TrustFooter() {
  return (
    <div className={styles.trustFooter}>
      <img src="/assets/Trust.png" alt="VR Shield" className={styles.trustIcon} />
      <div className={styles.trustTextContent}>
        <div className={styles.trustTitle}>Official rewards only on <span className={styles.trustHighlight}>VeloopRewards.in</span></div>
        <div className={styles.trustSubtitle}>Stay active, stay rewarded!</div>
      </div>
      <ChevronRight size={20} color="var(--color-text-muted)" className={styles.trustChevron} />
    </div>
  );
}
