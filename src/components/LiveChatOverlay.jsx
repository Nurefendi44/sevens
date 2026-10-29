import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import '../styles/livechat.css';

export const QUICK_CHAT_PRESETS = [
  'Halo semua! 👋',
  'Ayo buruan jalan ⏳',
  'Waduh kartu jelek 😅',
  'Santai dulu bos ☕',
  'GGWP! Mantap 👏',
  'Jangan tutup kartu dulu!',
  'Siap-siap kena banting! 💥',
  'Good Luck Have Fun! 🍀',
  'Maaf tadi AFK sebentar 🙏',
  'Gaskeun ronde berikutnya! 🚀',
];

export default function LiveChatOverlay({
  myPlayerId,
  myPlayerName,
  myAvatar = '👤',
  activeMessages = [],
  onSendMessage,
  isOpen: externalIsOpen,
  onToggleOpen,
  showTrigger = true,
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (val) => {
    if (onToggleOpen) onToggleOpen(val);
    setInternalIsOpen(val);
  };

  const [customText, setCustomText] = useState('');
  const inputRef = useRef(null);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const handleSend = (textToSend) => {
    const text = (textToSend || customText).trim();
    if (!text) return;
    if (onSendMessage) {
      onSendMessage(text);
    }
    setCustomText('');
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* 1. FLOATING ACTIVE SPEECH BUBBLES POPUP (Auto-dismisses in 4.5s) */}
      {activeMessages.length > 0 && (
        <div className="live-chat-bubbles-layer" aria-live="polite">
          {activeMessages.map((msg) => {
            const isMe = msg.senderId === myPlayerId;
            return (
              <div
                key={msg.id}
                className={`live-chat-bubble-item ${isMe ? 'is-me' : ''} ${
                  msg.isFading ? 'is-fading' : ''
                }`}
              >
                <div className="bubble-avatar">
                  {msg.senderAvatar || '🃏'}
                </div>
                <div className="bubble-content">
                  <span className={`bubble-sender ${isMe ? 'sender-me' : ''}`}>
                    {msg.senderName} {isMe ? '(Anda)' : ''}
                  </span>
                  <span className="bubble-text">{msg.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. FLOATING CHAT BUTTON (TRIGGER) */}
      {showTrigger && (
        <button
          type="button"
          className={`live-chat-trigger-btn ${activeMessages.length > 0 ? 'has-recent' : ''}`}
          onClick={() => setIsOpen(true)}
          title="Buka Live Chat & Quick Emote"
          aria-label="Kirim Pesan Chat Meja"
        >
          <MessageSquare size={16} />
          {activeMessages.length > 0 && <span className="live-chat-unread-dot" />}
        </button>
      )}

      {/* 3. QUICK CHAT & CUSTOM INPUT POPOVER MODAL */}
      {isOpen && (
        <div
          className="live-chat-popover-backdrop"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="live-chat-popover-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="live-chat-header">
              <div className="live-chat-title-group">
                <MessageSquare size={16} color="#38bdf8" />
                <h4 className="live-chat-heading">Chat Cepat Mabar</h4>
              </div>
              <button
                type="button"
                className="live-chat-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup Chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick 1-Click Presets */}
            <div className="live-chat-quick-section">
              <span className="quick-chat-label">⚡ Pesan Kilat (1-Klik)</span>
              <div className="quick-chat-grid">
                {QUICK_CHAT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn-quick-chat"
                    onClick={() => handleSend(preset)}
                    title={preset}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input Field */}
            <div className="live-chat-input-form">
              <input
                ref={inputRef}
                type="text"
                className="live-chat-text-input"
                placeholder="Ketik pesan..."
                value={customText}
                maxLength={70}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                className="live-chat-send-btn"
                disabled={!customText.trim()}
                onClick={() => handleSend()}
                title="Kirim Pesan"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
