import React from 'react';
import '../styles/soundboard.css';

export default function SoundboardNotification({ activeSounds = [] }) {
  if (!activeSounds || activeSounds.length === 0) return null;

  return (
    <div className="soundboard-toast-container" aria-live="polite">
      {activeSounds.map((item) => (
        <div key={item.id} className="soundboard-toast-item">
          <span className="soundboard-toast-icon">{item.soundIcon || '🔊'}</span>
          <span className="soundboard-toast-title">
            <span className="soundboard-toast-name">{item.senderName || 'Pemain'}</span> memutar{' '}
            <strong>"{item.soundTitle || 'Sound'}"</strong>
          </span>
        </div>
      ))}
    </div>
  );
}
