import React, { useEffect } from 'react';
import CardView from './CardView.jsx';

export default function ActionAnnouncementPopup({ action, onDismiss }) {
  useEffect(() => {
    if (!action) return;
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 2800);
    return () => clearTimeout(timer);
  }, [action, onDismiss]);

  if (!action) return null;

  const isPlay = action.type === 'PLAY_COMBO' || action.type === 'PLAY' || action.type === 'DISCARD';
  const isPass = action.type === 'PASS';

  return (
    <div
      style={{
        position: 'fixed',
        top: '75px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `2px solid ${isPass ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.6)'}`,
        borderRadius: '16px',
        padding: '0.65rem 1.25rem',
        boxShadow: `0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px ${isPass ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.35)'}`,
        animation: 'slideDownFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '90vw',
      }}
    >
      <span style={{ fontSize: '1.4rem' }}>{action.avatar || (isPass ? '🛑' : '🃏')}</span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{action.playerName}</strong>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.1rem 0.5rem',
              borderRadius: '6px',
              background: isPass ? '#ef4444' : '#0284c7',
              color: '#ffffff',
              textTransform: 'uppercase',
            }}
          >
            {action.type === 'PASS'
              ? 'PASS'
              : action.type === 'PLAY_COMBO'
              ? (action.combo?.type?.replace(/_/g, ' ') || 'COMBO')
              : action.type === 'PLAY'
              ? 'MAIN'
              : 'BUANG'}
          </span>
        </div>

        <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
          {action.message || (isPass ? 'Lewat giliran ini' : 'Mengeluarkan kartu')}
        </span>
      </div>

      {/* Mini Cards Preview */}
      {action.cards && action.cards.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '6px' }}>
          {action.cards.map((c, idx) => {
            const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
            return (
              <div
                key={c.id || idx}
                style={{
                  background: '#ffffff',
                  color: isRed ? '#dc2626' : '#1e293b',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.35rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <span>{c.label || c.rank}</span>
                <span>{c.symbol}</span>
              </div>
            );
          })}
        </div>
      )}

      {action.card && (
        <div
          style={{
            background: '#ffffff',
            color: action.card.suit === 'hearts' || action.card.suit === 'diamonds' ? '#dc2626' : '#1e293b',
            fontWeight: 800,
            fontSize: '0.75rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <span>{action.card.label || action.card.rank}</span>
          <span>{action.card.symbol}</span>
        </div>
      )}
    </div>
  );
}
