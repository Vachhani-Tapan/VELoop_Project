import React, { useEffect, useRef } from 'react';
import { Calendar, Gift, Zap } from 'lucide-react';
import styles from './DailyStreak.module.css';

export default function HowItWorks() {
  const sectionRef = useRef(null);

  useEffect(() => {
    if (window.gsap && window.ScrollTrigger) {
      const cards = sectionRef.current.querySelectorAll('.hiw-card');
      window.gsap.fromTo(cards, 
        { y: 50, opacity: 0 }, 
        { 
          y: 0, 
          opacity: 1, 
          duration: 0.6, 
          stagger: 0.2, 
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
          }
        }
      );
    }
  }, []);

  return (
    <div ref={sectionRef} style={{ padding: '3rem 0', textAlign: 'center' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '2rem', color: 'var(--color-accent)' }}>How It Works</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '2rem'
      }}>
        <div className="hiw-card glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ background: 'rgba(138,43,226,0.2)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <Calendar size={32} color="var(--color-primary)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>1. Check In Daily</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Log in every day to keep your streak alive. Don't miss a day!</p>
        </div>
        <div className="hiw-card glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ background: 'rgba(255,215,0,0.2)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <Gift size={32} color="var(--color-accent)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>2. Claim Rewards</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Instantly unlock VEs coins and special gift cards as you progress.</p>
        </div>
        <div className="hiw-card glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ background: 'rgba(0,210,106,0.2)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <Zap size={32} color="var(--color-success)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>3. Ultimate Prize</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Reach Day 7 for a guaranteed premium reward to boost your wallet!</p>
        </div>
      </div>
    </div>
  );
}
