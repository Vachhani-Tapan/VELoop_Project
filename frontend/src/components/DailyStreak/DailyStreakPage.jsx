// src/components/DailyStreak/DailyStreakPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Daily Streak Page — Presentation Layer.
// All values (streak, day, reward, status, balance, timer) come strictly from API.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { useStreak } from '../../hooks/useStreak';
import styles from './DailyStreak.module.css';

// Subcomponents
import StreakHeader from './StreakHeader';
import HeroBanner from './HeroBanner';
import StreakStats from './StreakStats';
import UltimateReward from './UltimateReward';
import RewardGrid from './RewardGrid';
import StreakSkeleton from './StreakSkeleton';
import WhyStreak from './WhyStreak';
import TrustFooter from './TrustFooter';
import BackgroundEffects from './BackgroundEffects';
import HowItWorks from './HowItWorks';
import Testimonials from './Testimonials';

export default function DailyStreakPage({ onLogout }) {
  const {
    data,
    loading,
    claiming,
    error,
    notification,
    resetNotice,
    claim,
    refreshStatus,
    clearNotification,
    clearResetNotice,
  } = useStreak(onLogout);

  const pageRef = useRef(null);

  useEffect(() => {
    if (!loading && data && window.gsap && pageRef.current) {
      window.gsap.fromTo(
        pageRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
      );
    }
  }, [loading, data]);

  if (loading) {
    return (
      <div className={styles.container}>
        <StreakSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.container}>
        <div className="alert alert-danger" role="alert" style={{ margin: '2rem' }}>
          <strong>Error: </strong> {error}
        </div>
      </div>
    );
  }

  return (
    <>
      <BackgroundEffects />
      <div className={styles.container} ref={pageRef} style={{ opacity: data ? 1 : 0 }}>
        <div className={styles.content}>
          {/* Streak Reset Alert Banner */}
          {resetNotice && (
            <div className="alert alert-warning alert-dismissible fade show" role="alert" style={{ margin: '1rem' }}>
              <strong>Notice: </strong> {resetNotice}
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={clearResetNotice}
              />
            </div>
          )}

          {/* Toast / Notification Banner */}
          {notification && (
            <div
              className={`alert alert-${notification.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`}
              role="alert"
              style={{ margin: '1rem' }}
            >
              <strong>{notification.title}: </strong> {notification.message}
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={clearNotification}
              />
            </div>
          )}

          {data && (
            <>
              <StreakHeader wallet={data.wallet} onLogout={onLogout} />
              <HeroBanner />
              <StreakStats
                streak={data.streak}
                serverTime={data.serverTime}
                onCountdownZero={refreshStatus}
              />
              <UltimateReward streak={data.streak} rewards={data.rewards} />
              <RewardGrid
                rewards={data.rewards}
                streak={data.streak}
                serverTime={data.serverTime}
                claiming={claiming}
                onClaim={claim}
              />
              <HowItWorks />
              <Testimonials />
              <WhyStreak />
            </>
          )}
        </div>
        <TrustFooter />
      </div>
    </>
  );
}
