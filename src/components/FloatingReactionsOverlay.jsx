import React, { useRef, useEffect } from 'react';
import { Smile, X } from 'lucide-react';
import '../styles/reactions.css';
import { audio } from '../services/audioService.js';

export const MEET_REACTIONS = [
  { emoji: '💖', label: 'Cinta / Love' },
  { emoji: '👍', label: 'Mantap / Thumbs Up' },
  { emoji: '🎉', label: 'Hore / Party' },
  { emoji: '😂', label: 'Ketawa / Haha' },
  { emoji: '😮', label: 'Kaget / Wow' },
  { emoji: '👏', label: 'Tepuk Tangan / Clap' },
  { emoji: '🔥', label: 'Menyala / Fire' },
  { emoji: '🚀', label: 'Gaskeun / Rocket' },
];

export default function FloatingReactionsOverlay({
  activeReactions = [],
  onSendReaction,
  isOpen = false,
  onToggleOpen,
  myPlayerId,
}) {
  const dockRef = useRef(null);
  const triggerRef = useRef(null);

  // Close dock when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        dockRef.current &&
        !dockRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        if (onToggleOpen) onToggleOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen, onToggleOpen]);

  const handleEmojiClick = (emoji) => {
    audio.playReactionSound();
    if (onSendReaction) {
      // Slight random horizontal start position around the trigger or center
      const randomStart = 45 + (Math.random() - 0.5) * 35;
      onSendReaction(emoji, randomStart);
    }
  };

  return (
    <>
      {/* 1. FLOATING EMOJI PARTICLES LAYER (Flying upwards to the sky) */}
      <div className="floating-reactions-layer" aria-hidden="true">
        {activeReactions.map((item) => {
          const isMe = item.senderId === myPlayerId;
          const driftX = item.driftX || (Math.random() - 0.5) * 60;
          const rot1 = (Math.random() - 0.5) * 16;
          const rot2 = (Math.random() - 0.5) * 20;
          const rot3 = (Math.random() - 0.5) * 12;

          return (
            <div
              key={item.id}
              className="floating-reaction-item"
              style={{
                left: `${item.startX || 50}%`,
                '--anim-duration': `${item.duration || 2.8}s`,
                '--drift-x': `${driftX}px`,
                '--rot-1': `${rot1}deg`,
                '--rot-2': `${rot2}deg`,
                '--rot-3': `${rot3}deg`,
                '--target-scale': `${item.scale || 1.1}`,
              }}
            >
              <span className="floating-emoji-char">{item.emoji}</span>
              {item.senderName && (
                <span className={`floating-sender-badge ${isMe ? 'is-me' : ''}`}>
                  {item.senderAvatar || '👤'} {item.senderName}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. FLOATING REACTION TRIGGER BUTTON (FAB / PILL) */}
      <button
        ref={triggerRef}
        type="button"
        className={`reaction-trigger-btn ${isOpen ? 'active' : ''}`}
        onClick={() => onToggleOpen && onToggleOpen(!isOpen)}
        title="Kirim Reaksi Emote (Google Meet Style)"
        aria-label="Kirim Reaksi Emote"
      >
        <span style={{ fontSize: '1.1rem' }}>😊</span>
        <span>Reaksi</span>
      </button>

      {/* 3. GOOGLE MEET HORIZONTAL EMOJI DOCK BAR */}
      {isOpen && (
        <div ref={dockRef} className="meet-reaction-dock" role="toolbar" aria-label="Pilih Reaksi Emote">
          {MEET_REACTIONS.map((item) => (
            <button
              key={item.emoji}
              type="button"
              className="btn-meet-emoji"
              onClick={() => handleEmojiClick(item.emoji)}
              title={item.label}
              aria-label={item.label}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
