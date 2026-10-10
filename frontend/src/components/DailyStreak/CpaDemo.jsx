import React, { useState, useEffect } from 'react';
import styles from './DailyStreak.module.css'; // we'll use a local class or just inline styles for the demo

export default function CpaDemo({ onComplete, onCancel }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'

  useEffect(() => {
    let timer;
    if (status === 'loading') {
      timer = setInterval(() => {
        setProgress(prev => {
          return prev >= 100 ? 100 : prev + 20;
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (progress >= 100 && status === 'loading') {
      setStatus('success');
    }
  }, [progress, status]);

  useEffect(() => {
    if (status === 'success') {
      const timeout = setTimeout(() => onComplete(), 500);
      return () => clearTimeout(timeout);
    }
  }, [status, onComplete]);

  return (
    <div className={styles.cpaContainer} style={{
      background: 'rgba(0,0,0,0.5)',
      padding: '2rem',
      borderRadius: 'var(--ui-radius)',
      textAlign: 'center',
      border: '1px solid var(--ui-glass-border)'
    }}>
      <h3 style={{ marginBottom: '1rem' }}>Sponsor Offer</h3>
      
      {status === 'loading' && (
        <>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Please wait while we verify your offer completion...
          </p>
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            margin: '1rem 0'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--color-primary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </>
      )}

      {status === 'success' && (
        <div style={{ color: 'var(--color-success)', margin: '1rem 0', fontWeight: 'bold' }}>
          ✓ Verification Complete!
        </div>
      )}

      <button 
        className={styles.cancelBtn} 
        onClick={onCancel}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          textDecoration: 'underline'
        }}
      >
        Cancel
      </button>
    </div>
  );
}
