import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Users,
  Sparkles,
  Zap,
  Swords,
  ChevronUp,
  Volume2,
} from 'lucide-react';
import {
  getStoredLobbyChats,
  subscribeToLobbyChat,
  sendLobbyChatMessage,
  extractRoomCodeFromMessage,
} from '../services/lobbyChatService';
import '../styles/lobbyChat.css';

const QUICK_PRESETS = [
  '⚔️ Ayo mabar Tujuh Sekop!',
  '🃏 Gas Big Two (Capsa)!',
  '🎯 Ada yang mau Remi 41?',
  '👑 Cari kawan push rank Top Global!',
  '☕ Mabar santai yuk!',
];

export default function LobbyChatDrawer({
  isOpen = false,
  onToggleOpen,
  myProfile = { name: '', avatar: '👑' },
  myRankTier = null,
  onJoinRoomFromChat,
  onOpenProfileModal,
}) {
  const [messages, setMessages] = useState(() => getStoredLobbyChats());
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'recruit'
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);

  // Subscribe to realtime global lobby chat
  useEffect(() => {
    const unsubscribe = subscribeToLobbyChat((newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      if (!isOpen) {
        setUnreadCount((count) => count + 1);
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Reset unread count when opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen]);

  // Auto-scroll on new message if open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Filter messages by tab
  const filteredMessages = useMemo(() => {
    if (activeTab === 'recruit') {
      return messages.filter(
        (m) => m.type === 'mabar_invite' || Boolean(m.roomCode) || extractRoomCodeFromMessage(m.message)
      );
    }
    return messages;
  }, [messages, activeTab]);

  // Latest message preview for bottom ticker
  const latestMessage = messages[messages.length - 1];

  // Send a message
  const handleSendMessage = async (customText = null) => {
    const textToSend = typeof customText === 'string' ? customText : inputText;
    if (!textToSend.trim()) return;

    if (!myProfile.name) {
      if (onOpenProfileModal) {
        onOpenProfileModal();
      }
      return;
    }

    setIsSending(true);
    await sendLobbyChatMessage({
      senderName: myProfile.name,
      avatar: myProfile.avatar || '👑',
      tier: myRankTier,
      message: textToSend.trim(),
    });

    setIsSending(false);
    if (!customText) {
      setInputText('');
    }
  };

  return (
    <>
      {/* ===================================================================
          1. MINI TICKER / FLOATING DOCK BAR (ALWAYS VISIBLE IN MAIN MENU)
          =================================================================== */}
      {!isOpen && (
        <div
          className="mlbb-chat-ticker-bar"
          onClick={onToggleOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleOpen();
            }
          }}
          title="Buka Obrolan Global & Mabar"
        >
          <div className="ticker-icon-box">
            <MessageSquare size={16} />
            {unreadCount > 0 && <span className="ticker-unread-dot" />}
          </div>

          <div className="ticker-content">
            <span className="ticker-label">
              <Sparkles size={11} />
              CHAT GLOBAL:
            </span>
            {latestMessage ? (
              <>
                <span className="ticker-sender">
                  {latestMessage.senderName}:
                </span>
                <span className="ticker-msg-preview">
                  {latestMessage.message}
                </span>
              </>
            ) : (
              <span className="ticker-msg-preview">Ayo cari kawan mabar kartu online!</span>
            )}
          </div>

          <div className="ticker-expand-hint">
            <span>Buka</span>
            <ChevronUp size={13} />
          </div>
        </div>
      )}

      {/* ===================================================================
          2. EXPANDED WORLD CHAT & RECRUITMENT DRAWER (MLBB CHAT WINDOW)
          =================================================================== */}
      {isOpen && (
        <div className="mlbb-chat-drawer-backdrop" onClick={onToggleOpen}>
          <div
            className="mlbb-chat-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="mlbb-chat-header">
              <div className="chat-header-brand">
                <div className="chat-header-icon">
                  <MessageSquare size={18} />
                </div>
                <div className="chat-header-titles">
                  <span className="chat-title-main">Obrolan Global & Mabar</span>
                  <span className="chat-title-sub">
                    <span className="chat-live-pulse" />
                    <span>Live Server • Rekrutmen Realtime</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn-chat-close"
                onClick={onToggleOpen}
                aria-label="Tutup Obrolan"
              >
                <X size={16} />
              </button>
            </div>

            {/* Channels / Tabs: Semua vs Cari Mabar */}
            <div className="mlbb-chat-tabs">
              <button
                type="button"
                className={`chat-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <span>🌐 Semua</span>
              </button>
              <button
                type="button"
                className={`chat-tab-btn ${activeTab === 'recruit' ? 'active' : ''}`}
                onClick={() => setActiveTab('recruit')}
              >
                <Swords size={13} />
                <span>Cari Mabar (Undangan)</span>
              </button>
            </div>

            {/* Chat Messages Stream */}
            <div className="mlbb-chat-messages-area">
              {filteredMessages.length === 0 ? (
                <div className="chat-empty-state">
                  <MessageSquare size={30} className="chat-empty-icon" />
                  <strong>Belum ada pesan obrolan</strong>
                  <span>Kirim pesan atau gunakan tombol ajak mabar di bawah untuk memulai!</span>
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isMe =
                    myProfile.name &&
                    msg.senderName.toLowerCase() === myProfile.name.toLowerCase();
                  const isSystem = msg.type === 'system';
                  const detectedCode = msg.roomCode || extractRoomCodeFromMessage(msg.message);
                  const timeString = new Date(msg.timestamp || Date.now()).toLocaleTimeString(
                    [],
                    { hour: '2-digit', minute: '2-digit' }
                  );

                  return (
                    <div
                      key={msg.id}
                      className={`chat-msg-row ${isMe ? 'is-me' : ''} ${
                        isSystem ? 'is-system' : ''
                      }`}
                    >
                      <div className="chat-msg-avatar">
                        <span>{msg.avatar || '👑'}</span>
                      </div>

                      <div className="chat-msg-body">
                        <div className="chat-msg-meta">
                          <span className="chat-msg-sender">{msg.senderName}</span>
                          {msg.tier && (
                            <span
                              className="chat-tier-chip"
                              style={{
                                borderColor: msg.tier.color,
                                color: msg.tier.accent || msg.tier.color,
                              }}
                            >
                              {msg.tier.icon} {msg.tier.shortName}
                            </span>
                          )}
                          <span className="chat-msg-time">{timeString}</span>
                        </div>

                        <div className="chat-msg-bubble">
                          <span>{msg.message}</span>

                          {/* Interactive Join Room Card */}
                          {detectedCode && onJoinRoomFromChat && (
                            <div className="chat-room-action-box">
                              <div className="room-action-info">
                                <span className="room-code-title">ROOM MABAR ONLINE</span>
                                <span className="room-code-tag">{detectedCode}</span>
                              </div>
                              <button
                                type="button"
                                className="btn-join-from-chat"
                                onClick={() => {
                                  onJoinRoomFromChat(detectedCode);
                                  onToggleOpen();
                                }}
                              >
                                <Zap size={13} />
                                <span>Gabung Room</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Preset Shortcuts (MLBB Fast Chat) */}
            <div className="mlbb-quick-presets-bar">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="btn-quick-preset"
                  onClick={() => handleSendMessage(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="mlbb-chat-input-form"
            >
              <input
                type="text"
                placeholder={
                  myProfile.name
                    ? 'Kirim pesan atau ajak mabar...'
                    : 'Atur Nickname profil terlebih dahulu...'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                maxLength={100}
                className="chat-input-text"
              />

              <button
                type="submit"
                className="btn-chat-send"
                disabled={isSending || !inputText.trim()}
              >
                <Send size={14} />
                <span>Kirim</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
