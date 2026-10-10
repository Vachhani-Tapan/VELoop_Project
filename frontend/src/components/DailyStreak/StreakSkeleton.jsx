import React from 'react';
import styles from './DailyStreak.module.css';

export default function StreakSkeleton() {
  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <div className={styles.skeletonCard} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
        <div className={styles.skeletonCard} style={{ width: '120px', height: '40px', borderRadius: '24px' }} />
      </div>
      
      <div className={styles.skeletonCard} style={{ height: '150px' }} />
      
      <div className={styles.statsContainer}>
        <div className={styles.skeletonCard} style={{ height: '80px' }} />
        <div className={styles.skeletonCard} style={{ height: '80px' }} />
        <div className={styles.skeletonCard} style={{ height: '80px' }} />
      </div>
      
      <div className={styles.grid}>
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className={styles.skeletonCard} style={{ height: '120px' }} />
        ))}
      </div>
    </div>
  );
}
