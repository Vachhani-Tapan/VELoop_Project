import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle } from 'lucide-react';
import styles from './DailyStreak.module.css';
import ClaimModal from './ClaimModal';

export default function RewardGrid({ rewards, streak, serverTime, onStateRefresh }) {
  const [claimingDay, setClaimingDay] = useState(null);
  const [now, setNow] = useState(() => {
    return serverTime ? new Date(serverTime).getTime() : Date.now();
  });
  
  useEffect(() => {
    const startServerTime = serverTime ? new Date(serverTime).getTime() : Date.now();
    setNow(startServerTime);

    if (!streak?.nextClaimAt) return;

    const startPerf = performance.now();

    const interval = setInterval(() => {
      const elapsed = performance.now() - startPerf;
      setNow(startServerTime + elapsed);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [streak?.nextClaimAt, serverTime]);

  const handleClaimClick = (day) => {
    setClaimingDay(day);
  };

  const handleClaimSuccess = (newState) => {
    setClaimingDay(null);
    onStateRefresh(newState);
  };

  const getIcon = (day) => {
    switch (day) {
      case 4: return <img src="/assets/Day-4.png" alt="Gift" className={`${styles.rewardImg} ${styles.softFloat}`} />;
      case 5: return <img src="/assets/Day-5.png" alt="Amazon Gift Card" className={styles.rewardImg} />;
      case 7: return <img src="/assets/Day-7.png" alt="Crown" className={`${styles.rewardImg} ${styles.gentleShine}`} />;
      default: return <img src="/assets/VEs_Coin.png" alt="Coins" className={styles.rewardImg} />;
    }
  };

  return (
    <>
      <div className={styles.grid}>
        {rewards.map((r) => {
          const isToday = r.status === 'TODAY';
          const isClaimed = r.status === 'CLAIMED';
          const isLocked = r.status === 'LOCKED';
          
          let isReady = false;
          if (isToday) {
            isReady = !streak.nextClaimAt || now >= new Date(streak.nextClaimAt).getTime();
          }

          let cardClass = `${styles.rewardCard}`;
          if (isToday && isReady) cardClass += ` ${styles.today}`;
          if (isClaimed) cardClass += ` ${styles.claimed}`;
          if (isLocked || (isToday && !isReady)) cardClass += ` ${styles.locked}`;

          return (
            <div 
              key={r.day} 
              className={cardClass}
              onClick={() => { if (isToday && isReady) handleClaimClick(r.day); }}
              role={isToday && isReady ? "button" : undefined}
              tabIndex={isToday && isReady ? 0 : undefined}
            >
              {isClaimed && (
                <div className={styles.checkmark}>
                  <CheckCircle size={16} color="#fff" fill="var(--color-success)" />
                </div>
              )}
              {isToday && isReady && (
                <div className={styles.todayBadge}>Today</div>
              )}
              <div className={styles.dayLabel}>Day {r.day}</div>
              <div className={styles.rewardIconWrapper}>
                {getIcon(r.day)}
              </div>
              <div className={styles.rewardTitle}>
                Daily Reward
              </div>
              <div className={styles.rewardAmount} style={{ color: r.day >= 4 ? 'var(--color-accent)' : 'var(--color-success)' }}>
                {r.reward.amount > 0 ? (r.reward.type === 'Amazon Gift Card' ? `₹${r.reward.amount}` : `+${r.reward.amount}`) : ''}
              </div>
              <div className={styles.rewardSubtitle}>
                {r.reward.type === 'Amazon Gift Card' ? 'Amazon Gift Card' : `${r.reward.amount} VEs`}
              </div>
              
              <div className={styles.claimStateArea}>
                {isClaimed && <span className={styles.stateSuccess}><CheckCircle size={14}/> Claimed</span>}
                {isLocked && <span className={styles.stateLocked}><Lock size={14}/> Locked</span>}
                {isToday && !isReady && <span className={styles.stateLocked}><Lock size={14}/> Locked</span>}
                {isToday && isReady && <button className={styles.claimNowBtn}>Claim Now &gt;</button>}
              </div>
            </div>
          );
        })}
      </div>

      {claimingDay !== null && (
        <ClaimModal 
          day={claimingDay} 
          onClose={() => setClaimingDay(null)}
          onSuccess={handleClaimSuccess}
        />
      )}
    </>
  );
}
