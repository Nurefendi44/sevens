import React from 'react';
import { Mic, MicOff, Smile, MessageSquare } from 'lucide-react';
import '../styles/socialDock.css';

export default function UnifiedSocialDock({
  isVisible = true,
  isVoiceConnected = false,
  isVoiceMuted = true,
  isSpeaking = false,
  onToggleVoice,
  isReactionOpen = false,
  onToggleReaction,
  isChatOpen = false,
  onToggleChat,
  hasUnreadChat = false,
}) {
  if (!isVisible) return null;

  return (
    <div
      className="unified-social-dock"
      role="toolbar"
      aria-label="Toolbar Interaksi Meja (Voice, Reaksi, Chat)"
    >
      {/* 1. Live Voice Chat Button (Mic) */}
      <button
        type="button"
        className={`btn-social-dock btn-social-mic ${
          isVoiceConnected && !isVoiceMuted ? 'active-speaking' : 'muted'
        }`}
        onClick={onToggleVoice}
        title={
          isVoiceConnected
            ? isVoiceMuted
              ? 'Nyalakan Mikrofon (Unmute)'
              : 'Matikan Mikrofon (Mute)'
            : 'Gabung Live Voice Chat'
        }
        aria-label="Kontrol Mikrofon"
      >
        {isVoiceConnected && !isVoiceMuted ? (
          <Mic size={17} className={isSpeaking ? 'pulse-speaking' : ''} />
        ) : (
          <MicOff size={17} />
        )}
      </button>

      <div className="social-dock-divider" />

      {/* 2. Google Meet Floating Reaction Button */}
      <button
        type="button"
        className={`btn-social-dock btn-social-reaction ${isReactionOpen ? 'active' : ''}`}
        onClick={onToggleReaction}
        title="Kirim Reaksi Emote Terbang (Google Meet)"
        aria-label="Pilih Reaksi Emote"
      >
        <Smile size={17} />
      </button>

      <div className="social-dock-divider" />

      {/* 3. Live Chat Button */}
      <button
        type="button"
        className={`btn-social-dock btn-social-chat ${isChatOpen ? 'active' : ''}`}
        onClick={onToggleChat}
        title="Kirim Pesan Chat Meja"
        aria-label="Buka Chat Meja"
      >
        <MessageSquare size={17} />
        {hasUnreadChat && <span className="social-unread-dot" />}
      </button>
    </div>
  );
}
