import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import CpaDemo from './CpaDemo';
import { claimStreak } from '../../services/streakApi';

export default function ClaimModal({ day, onClose, onSuccess }) {
  const [phase, setPhase] = useState('cpa'); // 'cpa' | 'claiming' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleCpaComplete = async () => {
    setPhase('claiming');
    try {
      const newState = await claimStreak(day);
      onSuccess(newState);
    } catch (err) {
      setPhase('error');
      // Extract error message as per A8 mapping
      setErrorMsg(err.response?.data?.message || err.message || 'Unable to process your reward.');
    }
  };

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--color-bg-surface)',
        padding: '2rem',
        borderRadius: 'var(--ui-radius)',
        maxWidth: '400px',
        width: '90%',
        border: '1px solid var(--ui-glass-border)',
        boxShadow: 'var(--ui-glass-shadow)',
        animation: 'modalFadeIn 0.3s ease-out forwards'
      }}>
        {phase === 'cpa' && (
          <CpaDemo onComplete={handleCpaComplete} onCancel={onClose} />
        )}
        
        {phase === 'claiming' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Claiming Reward...</h3>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>Oops!</h3>
            <p>{errorMsg}</p>
            <button 
              onClick={onClose}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                padding: '0.5rem 1.5rem',
                borderRadius: 'var(--ui-radius-sm)',
                marginTop: '1rem',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
