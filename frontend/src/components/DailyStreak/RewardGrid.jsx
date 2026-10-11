// src/components/DailyStreak/RewardGrid.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Authoritative 7-Day Rewards Grid Component.
//
// Invariants:
// - Statuses strictly dictated by backend: AVAILABLE | TODAY_LOCKED | CLAIMED | LOCKED | MISSED
// - Claim button is DISABLED unless backend reports AVAILABLE and no request is in-flight.
// - Even if button is force-enabled via DevTools, backend rejects unauthorized requests.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Lock, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import styles from './DailyStreak.module.css';
import ClaimModal from './ClaimModal';

export default function RewardGrid({ rewards, streak, serverTime, claiming, onClaim }) {
  const [activeModalDay, setActiveModalDay] = useState(null);

  const handleCardClick = (rewardItem) => {
    if (rewardItem.status === 'AVAILABLE' && !claiming) {
      setActiveModalDay(rewardItem.day);
    }
  };

  const getRewardIcon = (day, assetType) => {
    switch (day) {
      case 4:
        return <img src="/assets/Day-4.png" alt="Gift Box" className={`${styles.rewardImg} ${styles.softFloat}`} />;
      case 5:
        return <img src="/assets/Day-5.png" alt="Amazon Card" className={styles.rewardImg} />;
      case 7:
        return <img src="/assets/Day-7.png" alt="Grand Crown" className={`${styles.rewardImg} ${styles.gentleShine}`} />;
      default:
        return <img src="/assets/VEs_Coin.png" alt="VE Coins" className={styles.rewardImg} />;
    }
  };

  return (
    <>
      <div className={styles.grid}>
        {rewards.map((r) => {
          const isAvailable = r.status === 'AVAILABLE';
          const isTodayLocked = r.status === 'TODAY_LOCKED';
          const isClaimed = r.status === 'CLAIMED';
          const isMissed = r.status === 'MISSED';
          const isLocked = r.status === 'LOCKED';

          let cardClass = styles.rewardCard;
          if (isAvailable) cardClass += ` ${styles.today}`;
          if (isClaimed) cardClass += ` ${styles.claimed}`;
          if (isLocked || isTodayLocked) cardClass += ` ${styles.locked}`;
          if (isMissed) cardClass += ` ${styles.missed || styles.locked}`;

          return (
            <div
              key={r.day}
              className={cardClass}
              onClick={() => handleCardClick(r)}
              role={isAvailable ? 'button' : undefined}
              tabIndex={isAvailable ? 0 : undefined}
              aria-disabled={!isAvailable || claiming}
            >
              {isClaimed && (
                <div className={styles.checkmark}>
                  <CheckCircle size={16} color="#fff" fill="var(--color-success)" />
                </div>
              )}

              {isAvailable && <div className={styles.todayBadge}>Available Now</div>}
              {isTodayLocked && <div className={styles.todayBadge} style={{ background: '#f59e0b' }}>Cooldown</div>}

              <div className={styles.dayLabel}>Day {r.day}</div>

              <div className={styles.rewardIconWrapper}>
                {getRewardIcon(r.day, r.reward?.assetType)}
              </div>

              <div className={styles.rewardTitle}>
                {r.reward?.title || `Day ${r.day} Reward`}
              </div>

              <div
                className={styles.rewardAmount}
                style={{
                  color: r.day >= 4 ? 'var(--color-accent)' : 'var(--color-success)',
                }}
              >
                {r.reward?.currency === 'INR' ? `₹${r.reward?.amount}` : `+${r.reward?.amount} VEs`}
              </div>

              <div className={styles.rewardSubtitle}>
                {r.reward?.type === 'Amazon Gift Card' ? 'Gift Voucher' : `${r.reward?.currency} Balance`}
              </div>

              <div className={styles.claimStateArea}>
                {isClaimed && (
                  <span className={styles.stateSuccess}>
                    <CheckCircle size={14} /> Claimed
                  </span>
                )}
                {isLocked && (
                  <span className={styles.stateLocked}>
                    <Lock size={14} /> Locked
                  </span>
                )}
                {isTodayLocked && (
                  <span className={styles.stateLocked} style={{ color: '#f59e0b' }}>
                    <Clock size={14} /> In Cooldown
                  </span>
                )}
                {isMissed && (
                  <span className={styles.stateLocked} style={{ color: '#ef4444' }}>
                    <AlertTriangle size={14} /> Missed
                  </span>
                )}
                {isAvailable && (
                  <button
                    className={styles.claimNowBtn}
                    disabled={claiming}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveModalDay(r.day);
                    }}
                  >
                    {claiming ? 'Processing...' : 'Claim Now →'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeModalDay !== null && (
        <ClaimModal
          day={activeModalDay}
          claiming={claiming}
          onClose={() => setActiveModalDay(null)}
          onConfirm={async () => {
            await onClaim(activeModalDay);
            setActiveModalDay(null);
          }}
        />
      )}
    </>
  );
}
