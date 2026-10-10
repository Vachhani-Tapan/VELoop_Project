import React, { useEffect, useState, useRef } from 'react';
import { getStreak, register, login } from '../../services/streakApi';
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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const pageRef = useRef(null);

  useEffect(() => {
    async function init() {
      try {
        const state = await getStreak();
        setData(state);
      } catch (err) {
        console.error('Failed to initialize streak page:', err);
        if (err.response?.status === 401) {
          onLogout();
        } else {
          setError('Unable to load Daily Streak. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [onLogout]);

  useEffect(() => {
    if (!loading && data && window.gsap && pageRef.current) {
      window.gsap.fromTo(pageRef.current, 
        { opacity: 0, y: 30 }, 
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
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

  if (error) {
    return (
      <div className={styles.container}>
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <>
      <BackgroundEffects />
      <div className={styles.container} ref={pageRef} style={{ opacity: 0 }}>
        <div className={styles.content}>
          <StreakHeader wallet={data.wallet} onLogout={onLogout} />
          <HeroBanner />
          <StreakStats streak={data.streak} serverTime={data.serverTime} />
          <UltimateReward streak={data.streak} rewards={data.rewards} />
          <RewardGrid 
            rewards={data.rewards} 
            streak={data.streak} 
            serverTime={data.serverTime} 
            onStateRefresh={setData} 
          />
          <HowItWorks />
          <Testimonials />
          <WhyStreak />
        </div>
        <TrustFooter />
      </div>
    </>
  );
}
