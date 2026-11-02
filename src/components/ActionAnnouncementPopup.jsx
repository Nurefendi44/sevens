import React, { useEffect } from 'react';

export default function ActionAnnouncementPopup({ action, onDismiss }) {
  useEffect(() => {
    if (!action) return;
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 1100);
    return () => clearTimeout(timer);
  }, [action, onDismiss]);

  if (!action) return null;

  const isPass = action.type === 'PASS';

  const getShortActionLabel = () => {
    if (isPass) return 'LEWAT';
    if (action.type === 'PLAY_COMBO') {
      return action.combo?.label || action.combo?.type?.replace(/_/g, ' ') || 'MAIN';
    }
    if (action.type === 'CLOSE') return 'TUTUP';
    if (action.type === 'DISCARD') return 'BUANG';
    return 'MAIN';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '56px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9980,
        pointerEvents: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${
          isPass ? 'rgba(248, 113, 113, 0.35)' : 'rgba(56, 189, 248, 0.35)'
        }`,
        borderRadius: '999px',
        padding: '0.2rem 0.65rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
        animation: 'slideDownFade 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '85vw',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '0.82rem', lineHeight: 1 }}>
        {action.avatar || (isPass ? '⏭️' : '⚡')}
      </span>

      <strong
        style={{
          color: '#f8fafc',
          fontSize: '0.72rem',
          fontWeight: 700,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100px',
        }}
      >
        {action.playerName}
      </strong>

      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem' }}>•</span>

      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: 800,
          padding: '0.1rem 0.45rem',
          borderRadius: '999px',
          background: isPass
            ? 'rgba(239, 68, 68, 0.18)'
            : 'rgba(56, 189, 248, 0.18)',
          color: isPass ? '#fca5a5' : '#7dd3fc',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {getShortActionLabel()}
      </span>
    </div>
  );
}
