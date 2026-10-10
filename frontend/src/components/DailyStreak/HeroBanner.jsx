import React from 'react';
import styles from './DailyStreak.module.css';

export default function HeroBanner() {
  return (
    <div className={styles.heroBanner}>
      <img src="/assets/Top_Left.png" alt="Calendar" className={styles.heroLeftImg} />
      <div className={styles.heroTextContent}>
        <h1 className={styles.heroTitle}>Login Daily & Earn <span style={{ color: 'var(--color-accent)' }}>Bigger Rewards!</span></h1>
        <p className={styles.heroSubtitle}>Maintain your streak and unlock <span style={{ color: 'var(--color-primary-hover)' }}>exciting rewards</span> every day.</p>
      </div>
      <img src="/assets/Top_right.png" alt="Gift Box" className={styles.heroRightImg} />
    </div>
  );
}
