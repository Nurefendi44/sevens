import React, { useEffect } from 'react';

export default function ActionAnnouncementPopup({ action, onDismiss }) {
  useEffect(() => {
    if (!action) return;
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 2000);
    return () => clearTimeout(timer);
  }, [action, onDismiss]);

  if (!action) return null;

  const isPass = action.type === 'PASS';

  const getShortActionLabel = () => {
    if (isPass) return 'LEWAT (PASS)';
    if (action.type === 'PLAY_COMBO') {
      return action.combo?.label || action.combo?.type?.replace(/_/g, ' ') || 'MAIN COMBO';
    }
    if (action.type === 'CLOSE') return 'TUTUP KARTU';
    if (action.type === 'DISCARD') return 'BUANG KARTU';
    return 'MAIN KARTU';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        pointerEvents: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid ${
          isPass ? 'rgba(248, 113, 113, 0.45)' : 'rgba(56, 189, 248, 0.45)'
        }`,
        borderRadius: '999px',
        padding: '0.38rem 0.9rem',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.45)',
        animation: 'slideDownFade 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '92vw',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>
        {action.avatar || (isPass ? '⏭️' : '⚡')}
      </span>

      <strong
        style={{
          color: '#f8fafc',
          fontSize: '0.8rem',
          fontWeight: 700,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '130px',
        }}
      >
        {action.playerName}
      </strong>

      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>•</span>

      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          padding: '0.14rem 0.55rem',
          borderRadius: '999px',
          background: isPass
            ? 'rgba(239, 68, 68, 0.22)'
            : 'rgba(56, 189, 248, 0.22)',
          color: isPass ? '#fca5a5' : '#7dd3fc',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
        }}
      >
        {getShortActionLabel()}
      </span>
    </div>
  );
}
