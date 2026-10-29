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

export function getBotChatReply(userMessage) {
  const msg = (userMessage || '').toLowerCase();
  if (msg.includes('halo') || msg.includes('hi') || msg.includes('hai')) {
    const replies = ['Halo juga! Siap bertanding 🤖', 'Hai hai! Semoga hoki ya 🃏', 'Halo bos! Ayo kita mulai 🔥'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  if (msg.includes('buruan') || msg.includes('jalan') || msg.includes('lama') || msg.includes('cepet')) {
    const replies = ['Sabar bos, lagi ngitung kombinasi kartu nih ⏳', 'Tenang tenang, langsung jalan kok! 🚀', 'Bentar lagi mikir trik banting kartu 🤖'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  if (msg.includes('jelek') || msg.includes('waduh') || msg.includes('gawat') || msg.includes('aduh')) {
    const replies = ['Wkwk sama nih bos, kartu saya juga berantakan 😅', 'Tetap tenang dan kuasai kartu! 💪', 'Jangan panik dulu, masih ada harapan 😂'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  if (msg.includes('gg') || msg.includes('mantap') || msg.includes('keren') || msg.includes('nice')) {
    const replies = ['GGWP! Main bareng Anda seru banget 👏', 'Makasih bos! Permainan yang sengit 🔥', 'Nice game! Ronde depan kita balas ya 🃏'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  if (msg.includes('santai') || msg.includes('ngopi') || msg.includes('kopi')) {
    const replies = ['Sambil seruput kopi dulu bos ☕', 'Santai tapi pasti menang wkwk 😎', 'Ngopi dulu biar ga salah buang kartu ☕'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  if (msg.includes('banting') || msg.includes('capsa') || msg.includes('bom')) {
    const replies = ['Awas kena banting balik ya! 💥', 'Waduh siap-siap pasang sabuk pengaman 😱', 'Keluarkan kartu terbaikmu bos! 🃏'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  if (msg.includes('tutup') || msg.includes('as')) {
    const replies = ['Tenang, saya usahakan ga nutup kartu penting 🔒', 'Siap bos, ikuti alur permainan! 👍'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  if (msg.includes('gaskeun') || msg.includes('gas') || msg.includes('mulai')) {
    const replies = ['Gaskeun tanpa ampun! 🚀', 'Siap 100%! Ayo lanjut ronde baru 🔥', 'Let’s gooo! 🃏'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  const defaultReplies = [
    'Siap bos, pantau terus mejanya! 👀',
    'Hehe seru banget nih permainannya 🃏',
    'Ayo fokus, kartu saya udah siap jalan! 🤖',
    'Mantap, lanjut gaskeun! 🚀',
    'Wkwk asyik banget mabar kartu ☕',
  ];
  return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
}

export default function LiveChatOverlay({
  myPlayerId,
  myPlayerName,
  myAvatar = '👤',
  activeMessages = [],
  onSendMessage,
  isOpen: externalIsOpen,
  onToggleOpen,
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
