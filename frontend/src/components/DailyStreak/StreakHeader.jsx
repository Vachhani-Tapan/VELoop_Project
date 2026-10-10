import React from 'react';
import { LogOut } from 'lucide-react';
import styles from './DailyStreak.module.css';

export default function StreakHeader({ wallet, onLogout }) {
  // Fallback to 0 if wallet data is missing
  const vesBalance = wallet?.vesBalance || 0;
  const inrBalance = wallet?.inrBalance || 0;

  return (
    <header className={styles.header}>
      <button className={styles.backBtn} onClick={onLogout} aria-label="Log Out" title="Log Out">
        <LogOut size={18} />
      </button>

      {/* <div className={styles.headerTitleContainer}>
        <h2 className={styles.headerTitle}>Daily Streak</h2>
        <img src="/assets/Flame.png" alt="Flame" className={styles.headerFlame} />
      </div> */}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div className={styles.walletBadge} title="Wallet Balance">
          <img src="/assets/VEs_Coin.png" alt="VEs" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
          <span>{vesBalance}</span>
        </div>
          <div className={styles.walletBadge} title="Amazon Gift Card Balance" style={{ background: 'rgba(255, 153, 0, 0.15)', borderColor: 'rgba(255, 153, 0, 0.3)' }}>
            <span style={{ fontWeight: 'bold', color: '#ff9900', marginRight: '2px' }}>₹</span>
            <span>{inrBalance}</span>
          </div>
      </div>
    </header>
  );
}
