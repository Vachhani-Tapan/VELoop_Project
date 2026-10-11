// src/components/DailyStreak/ClaimModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Claim confirmation and engagement modal.
// Disables action buttons during in-flight requests to prevent double submissions.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import CpaDemo from './CpaDemo';

export default function ClaimModal({ day, claiming, onClose, onConfirm }) {
  const [phase, setPhase] = useState('cpa'); // 'cpa' | 'claiming'

  const handleCpaComplete = async () => {
    setPhase('claiming');
    try {
      await onConfirm();
    } catch {
      setPhase('cpa');
    }
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-surface, #1e293b)',
          padding: '2rem',
          borderRadius: '16px',
          maxWidth: '420px',
          width: '90%',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          animation: 'modalFadeIn 0.3s ease-out forwards',
          color: '#fff',
        }}
      >
        {phase === 'cpa' && !claiming && (
          <CpaDemo onComplete={handleCpaComplete} onCancel={onClose} />
        )}

        {(phase === 'claiming' || claiming) && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h4 style={{ marginBottom: '1.25rem' }}>Securing Your Reward...</h4>
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p style={{ marginTop: '1.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>
              Recording transaction and verifying server timestamps.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
