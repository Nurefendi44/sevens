import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import AvatarDisplay from './AvatarDisplay.jsx';
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
  chatHistory = [],
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
  const chatHistoryScrollRef = useRef(null);
  const chatHistoryEndRef = useRef(null);

  // Auto-scroll handler to ensure view is always at the newest bubble
  const scrollToBottom = (smooth = false) => {
    if (chatHistoryScrollRef.current) {
      chatHistoryScrollRef.current.scrollTop = chatHistoryScrollRef.current.scrollHeight;
    }
    if (chatHistoryEndRef.current) {
      chatHistoryEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    }
  };

  // Focus input when popover opens and auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 80);
      }
      scrollToBottom(false);
      requestAnimationFrame(() => scrollToBottom(false));
      setTimeout(() => scrollToBottom(false), 50);
      setTimeout(() => scrollToBottom(false), 150);
    }
  }, [isOpen]);

  // Auto-scroll whenever a new room chat bubble arrives
  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false);
      requestAnimationFrame(() => scrollToBottom(false));
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [chatHistory, isOpen]);

  const handleSend = (textToSend) => {
    const text = (textToSend || customText).trim();
    if (!text) return;
    if (onSendMessage) {
      onSendMessage(text);
    }
    setCustomText('');
    setTimeout(() => scrollToBottom(false), 40);
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
                  <AvatarDisplay avatar={msg.senderAvatar} fallback="🃏" size={24} />
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
                <h4 className="live-chat-heading">Chat Meja Permainan</h4>
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

            {/* Room Chat History Area (Auto-scrolls to the newest bubble) */}
            <div className="live-chat-history-scroll" ref={chatHistoryScrollRef}>
              {chatHistory.length === 0 ? (
                <div className="live-chat-empty-hint">
                  <Sparkles size={14} color="#38bdf8" />
                  <span>Obrolan meja permainan. Ketik atau klik pesan kilat di bawah!</span>
                </div>
              ) : (
                chatHistory.map((msg) => {
                  const isMe = msg.senderId === myPlayerId;
                  const timeStr = msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={msg.id}
                      className={`room-chat-msg-row ${isMe ? 'is-me' : ''}`}
                    >
                      <div className="room-chat-avatar">
                        <AvatarDisplay
                          avatar={isMe ? myAvatar : msg.senderAvatar}
                          fallback="👤"
                          size={24}
                          playerName={msg.senderName}
                        />
                      </div>
                      <div className="room-chat-bubble-wrap">
                        <div className="room-chat-meta">
                          <span className={`room-chat-sender ${isMe ? 'sender-me' : ''}`}>
                            {msg.senderName} {isMe ? '(Anda)' : ''}
                          </span>
                          {timeStr && <span className="room-chat-time">{timeStr}</span>}
                        </div>
                        <div className="room-chat-bubble-body">
                          <span>{msg.message}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatHistoryEndRef} />
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
