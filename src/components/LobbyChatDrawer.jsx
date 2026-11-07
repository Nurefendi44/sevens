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
  Lock,
  Search,
  ArrowLeft,
  MessageCircle,
  UserPlus,
  UserCheck,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  getStoredLobbyChats,
  subscribeToLobbyChat,
  sendLobbyChatMessage,
  sendPrivateChatMessage,
  retractChatMessage,
  getStoredPrivateChats,
  searchRegisteredPlayers,
  extractRoomCodeFromMessage,
} from '../services/lobbyChatService';
import {
  getFriendsList,
  removeFriend,
  addFriend,
  isFriend,
} from '../services/friendService';
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
  initialDmPartner = null,
  hideTicker = false,
}) {
  const [messages, setMessages] = useState(() => getStoredLobbyChats());
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'recruit' | 'private'
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Private Messaging States
  const [pmThreads, setPmThreads] = useState({});
  const [activeDmPartner, setActiveDmPartner] = useState(null); // { name, avatar, tier }
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [isSearchingDm, setIsSearchingDm] = useState(false);

  const messagesEndRef = useRef(null);

  // Temporary guest nickname if player hasn't set one yet
  const guestName = useMemo(() => {
    if (typeof localStorage === 'undefined') return 'Pemain #1001';
    try {
      let g = localStorage.getItem('royal_cards_guest_name');
      if (!g) {
        g = `Pemain #${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem('royal_cards_guest_name', g);
      }
      return g;
    } catch {
      return 'Pemain #1001';
    }
  }, []);

  const currentDisplayName = String(myProfile.name || '').trim() || guestName;

  // Load private chat history for current user on mount & user change
  useEffect(() => {
    if (currentDisplayName) {
      setPmThreads(getStoredPrivateChats(currentDisplayName));
      setFriendsList(getFriendsList(currentDisplayName));
    }
  }, [currentDisplayName, isOpen]);

  // Friends List State
  const [friendsList, setFriendsList] = useState([]);
  const [friendToDelete, setFriendToDelete] = useState(null);

  // If opened with initialDmPartner, switch to DM tab with that partner
  useEffect(() => {
    if (initialDmPartner) {
      setActiveDmPartner(initialDmPartner);
      setActiveTab('private');
    }
  }, [initialDmPartner]);

  const handleAddFriendFromChat = (user) => {
    if (!currentDisplayName || !user?.name) return;
    const res = addFriend(currentDisplayName, user);
    if (res.success) {
      setFriendsList(res.friends || []);
    }
  };

  const handleRemoveFriend = (friendName) => {
    if (!currentDisplayName || !friendName) return;
    const res = removeFriend(currentDisplayName, friendName);
    if (res.success) {
      setFriendsList(res.friends || []);
    }
  };

  // Subscribe to realtime global lobby chat & direct private messages
  useEffect(() => {
    const unsubscribe = subscribeToLobbyChat((newMsg) => {
      if (newMsg.type === 'retract') {
        if (newMsg.scope === 'private') {
          setPmThreads((prev) => {
            const next = {};
            Object.entries(prev).forEach(([k, list]) => {
              next[k] = list.filter((m) => m.id !== newMsg.id);
            });
            return next;
          });
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== newMsg.id));
        }
        return;
      }
      if (newMsg.type === 'private') {
        const myNorm = currentDisplayName.toLowerCase();
        const isMine = newMsg.senderName?.toLowerCase() === myNorm;
        const partnerName = isMine ? newMsg.targetUsername : newMsg.senderName;
        const partnerKey = (partnerName || '').toLowerCase();

        if (partnerKey) {
          setPmThreads((prev) => {
            const thread = prev[partnerKey] || [];
            if (thread.some((m) => m.id === newMsg.id)) return prev;
            return {
              ...prev,
              [partnerKey]: [...thread, newMsg],
            };
          });
        }
      } else {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }

      if (!isOpen) {
        setUnreadCount((count) => count + 1);
      }
    }, currentDisplayName);

    return () => unsubscribe();
  }, [isOpen, currentDisplayName]);

  // Live search registered players as user types in PM tab
  useEffect(() => {
    if (!dmSearchQuery.trim()) {
      setDmSearchResults([]);
      setIsSearchingDm(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingDm(true);
      const results = await searchRegisteredPlayers(dmSearchQuery.trim());
      // Filter out self
      const filtered = results.filter(
        (u) => u.name.toLowerCase() !== currentDisplayName.toLowerCase()
      );
      setDmSearchResults(filtered);
      setIsSearchingDm(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [dmSearchQuery, currentDisplayName]);

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
    const publicOnly = messages.filter((m) => m.type !== 'private' && !m.targetUsername);
    if (activeTab === 'recruit') {
      return publicOnly.filter(
        (m) => m.type === 'mabar_invite' || Boolean(m.roomCode) || extractRoomCodeFromMessage(m.message)
      );
    }
    return publicOnly;
  }, [messages, activeTab]);

  // Latest message preview for bottom ticker
  const latestMessage = messages.filter((m) => m.type !== 'private' && !m.targetUsername).slice(-1)[0];

  // Send a message (Global or Private DM)
  const handleSendMessage = async (customText = null) => {
    const textToSend = typeof customText === 'string' ? customText : inputText;
    if (!textToSend.trim() || isSending) return;

    if (!customText) {
      setInputText('');
    }
    setIsSending(true);

    try {
      if (activeTab === 'private' && activeDmPartner) {
        await sendPrivateChatMessage({
          senderName: currentDisplayName,
          targetUsername: activeDmPartner.name,
          avatar: myProfile.avatar || '👑',
          tier: myRankTier,
          message: textToSend.trim(),
        });
      } else {
        await sendLobbyChatMessage({
          senderName: currentDisplayName,
          avatar: myProfile.avatar || '👤',
          tier: myRankTier,
          message: textToSend.trim(),
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  // Batal kirim pesan milik sendiri
  const handleRetractMessage = async (msg, scope) => {
    if (!msg?.id) return;
    if (!window.confirm('Batalkan pengiriman pesan ini untuk semua orang?')) return;
    await retractChatMessage({
      id: msg.id,
      scope,
      senderName: currentDisplayName,
      targetUsername: scope === 'private' ? msg.targetUsername || activeDmPartner?.name : null,
    });
  };

  // Helper to start direct chat with any user
  const startDirectChatWith = (partnerName, partnerAvatar = '👤', partnerTier = null) => {
    if (!partnerName || partnerName.toLowerCase() === currentDisplayName.toLowerCase()) return;
    setActiveDmPartner({
      name: partnerName,
      avatar: partnerAvatar,
      tier: partnerTier,
    });
    setActiveTab('private');
    setDmSearchQuery('');
  };

  return (
    <>
      {/* ===================================================================
          1. MINI TICKER / FLOATING DOCK BAR (ALWAYS VISIBLE IN MAIN MENU)
          =================================================================== */}
      {!isOpen && !hideTicker && (
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

            {/* Channels / Tabs: Semua vs Cari Mabar vs Private (DM) */}
            <div className="mlbb-chat-tabs">
              <button
                type="button"
                className={`chat-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('all');
                  setActiveDmPartner(null);
                }}
              >
                <span>🌐 Semua</span>
              </button>
              <button
                type="button"
                className={`chat-tab-btn ${activeTab === 'recruit' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('recruit');
                  setActiveDmPartner(null);
                }}
              >
                <Swords size={13} />
                <span>Cari Mabar</span>
              </button>
              <button
                type="button"
                className={`chat-tab-btn ${activeTab === 'private' ? 'active' : ''}`}
                onClick={() => setActiveTab('private')}
              >
                <Lock size={12} />
                <span>Private (DM)</span>
                {Object.keys(pmThreads).length > 0 && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 900,
                      padding: '0.05rem 0.35rem',
                      borderRadius: '999px',
                      background: 'rgba(251, 191, 36, 0.25)',
                      color: '#fef08a',
                    }}
                  >
                    {Object.keys(pmThreads).length}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`chat-tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('friends');
                  setActiveDmPartner(null);
                }}
              >
                <Users size={12} />
                <span>Teman</span>
                {friendsList.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 900,
                      padding: '0.05rem 0.35rem',
                      borderRadius: '999px',
                      background: 'rgba(56, 189, 248, 0.25)',
                      color: '#7dd3fc',
                    }}
                  >
                    {friendsList.length}
                  </span>
                )}
              </button>
            </div>

            {/* ================= VIEW: DAFTAR TEMAN MABAR ================= */}
            {activeTab === 'friends' ? (
              <div className="pm-container">
                <div className="pm-header-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Users size={15} className="text-gold" />
                    <strong style={{ fontSize: '0.82rem', color: '#fde047' }}>
                      DAFTAR TEMAN MABAR ({friendsList.length})
                    </strong>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                    Teman Terhubung
                  </span>
                </div>

                <div className="pm-threads-list">
                  {friendsList.length > 0 ? (
                    friendsList.map((friend) => (
                      <div key={friend.name} className="pm-thread-card" style={{ cursor: 'default' }}>
                        <div className="pm-user-left">
                          <div className="chat-msg-avatar" style={{ width: 34, height: 34 }}>
                            <span>{friend.avatar || '👤'}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ fontSize: '0.82rem', color: '#f8fafc' }}>
                                {friend.name}
                              </strong>
                              {friend.tier && (
                                <span
                                  className="chat-tier-chip"
                                  style={{
                                    borderColor: friend.tier.color,
                                    color: friend.tier.accent || friend.tier.color,
                                  }}
                                >
                                  {friend.tier.icon} {friend.tier.shortName}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.66rem', color: '#6ee7b7' }}>
                              ★ {friend.score || 0} Skor • 🏆 {friend.wins || 0} Menang
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn-start-pm"
                            onClick={() => startDirectChatWith(friend.name, friend.avatar, friend.tier)}
                            title={`Kirim Pesan Pribadi ke ${friend.name}`}
                          >
                            <MessageCircle size={11} />
                            <span>Chat DM</span>
                          </button>
                          <button
                            type="button"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#fca5a5',
                              borderRadius: 6,
                              padding: '0.22rem 0.4rem',
                              cursor: 'pointer',
                            }}
                            onClick={() => setFriendToDelete(friend)}
                            title={`Hapus ${friend.name} dari teman`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="chat-empty-state" style={{ padding: '2.5rem 1rem' }}>
                      <Users size={32} className="chat-empty-icon" />
                      <strong>Belum Memiliki Teman</strong>
                      <span>
                        Buka menu <strong>Top Global</strong> atau klik nama pemain di obrolan untuk menambahkan teman mabar!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'private' ? (
              <div className="pm-container">
                {activeDmPartner ? (
                  <>
                    {/* Partner Header */}
                    <div className="pm-header-bar">
                      <div className="pm-partner-info">
                        <button
                          type="button"
                          className="pm-back-btn"
                          onClick={() => setActiveDmPartner(null)}
                          title="Kembali ke Daftar DM"
                        >
                          <ArrowLeft size={13} />
                          <span>Daftar DM</span>
                        </button>
                        <div className="chat-msg-avatar" style={{ width: 28, height: 28, fontSize: '0.9rem' }}>
                          <span>{activeDmPartner.avatar || '👤'}</span>
                        </div>
                        <strong style={{ fontSize: '0.82rem', color: '#f8fafc' }}>
                          {activeDmPartner.name}
                        </strong>
                        {activeDmPartner.tier && (
                          <span
                            className="chat-tier-chip"
                            style={{
                              borderColor: activeDmPartner.tier.color,
                              color: activeDmPartner.tier.accent || activeDmPartner.tier.color,
                            }}
                          >
                            {activeDmPartner.tier.icon} {activeDmPartner.tier.shortName}
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.65rem', color: '#6ee7b7', fontWeight: 800 }}>
                        🔒 Private DM
                      </span>
                    </div>

                    {/* Messages with this partner */}
                    <div className="mlbb-chat-messages-area">
                      {(() => {
                        const rawThread = pmThreads[activeDmPartner.name.toLowerCase()] || [];
                        const seenIds = new Set();
                        const thread = rawThread.filter((m) => {
                          if (!m || !m.id || seenIds.has(m.id)) return false;
                          seenIds.add(m.id);
                          return true;
                        });

                        if (thread.length === 0) {
                          return (
                            <div className="chat-empty-state">
                              <Lock size={30} className="chat-empty-icon" />
                              <strong>Mulai Percakapan Pribadi</strong>
                              <span>
                                Kirim pesan atau bagikan kode room secara privat ke{' '}
                                <strong style={{ color: '#fde047' }}>{activeDmPartner.name}</strong>!
                              </span>
                            </div>
                          );
                        }
                        return thread.map((msg) => {
                          const isMe =
                            Boolean(currentDisplayName) &&
                            msg.senderName?.toLowerCase() === currentDisplayName.toLowerCase();
                          const detectedCode =
                            msg.roomCode || extractRoomCodeFromMessage(msg.message);
                          const timeString = new Date(msg.timestamp || Date.now()).toLocaleTimeString(
                            [],
                            { hour: '2-digit', minute: '2-digit' }
                          );

                          return (
                            <div key={msg.id} className={`chat-msg-row ${isMe ? 'is-me' : ''}`}>
                              <div className="chat-msg-avatar">
                                <span>{msg.avatar || '👤'}</span>
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
                                  {isMe && (
                                    <button
                                      type="button"
                                      className="chat-retract-btn"
                                      title="Batal kirim"
                                      onClick={() => handleRetractMessage(msg, 'private')}
                                    >
                                      <Trash2 size={10} /> Batal
                                    </button>
                                  )}
                                  </div>
                                <div className="chat-msg-bubble">
                                  <span>{msg.message}</span>
                                  {detectedCode && onJoinRoomFromChat && (
                                    <div className="chat-room-action-box">
                                      <div className="room-action-info">
                                        <span className="room-code-title">ROOM UNDANGAN MABAR</span>
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
                        });
                      })()}
                      <div ref={messagesEndRef} />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Search Registered Player Section */}
                    <div className="pm-search-section">
                      <div className="pm-search-input-wrap">
                        <Search size={14} className="pm-search-icon" />
                        <input
                          type="text"
                          placeholder="Cari username pemain terdaftar (cth: lipia, pardi)..."
                          value={dmSearchQuery}
                          onChange={(e) => setDmSearchQuery(e.target.value)}
                          className="pm-search-input"
                        />
                        {dmSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDmSearchQuery('')}
                            style={{
                              position: 'absolute',
                              right: 8,
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Live Search Results */}
                      {dmSearchQuery.trim() && (
                        <div className="pm-search-results">
                          {isSearchingDm ? (
                            <div style={{ padding: '0.45rem', fontSize: '0.72rem', color: '#fde68a', textAlign: 'center' }}>
                              Mencari pemain terdaftar...
                            </div>
                          ) : dmSearchResults.length > 0 ? (
                            dmSearchResults.map((user) => (
                              <div
                                key={user.name}
                                className="pm-user-result-item"
                                onClick={() => startDirectChatWith(user.name, user.avatar, user.tier)}
                              >
                                <div className="pm-user-left">
                                  <div className="chat-msg-avatar" style={{ width: 28, height: 28, fontSize: '0.9rem' }}>
                                    <span>{user.avatar || '👤'}</span>
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: '0.8rem', color: '#f8fafc', display: 'block' }}>
                                      {user.name}
                                    </strong>
                                    {user.tier && (
                                      <span
                                        className="chat-tier-chip"
                                        style={{
                                          borderColor: user.tier.color,
                                          color: user.tier.accent || user.tier.color,
                                        }}
                                      >
                                        {user.tier.icon} {user.tier.shortName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button type="button" className="btn-start-pm">
                                  <MessageCircle size={12} />
                                  <span>Chat</span>
                                </button>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: '0.45rem', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
                              Tidak ditemukan pemain terdaftar dengan nama "{dmSearchQuery}".
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Existing Conversation Threads */}
                    <div className="pm-threads-list">
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                        Percakapan Pribadi Terkini
                      </span>
                      {Object.keys(pmThreads).length > 0 ? (
                        Object.entries(pmThreads).map(([partnerKey, threadMsgs]) => {
                          const lastMsg = threadMsgs[threadMsgs.length - 1];
                          const partnerName =
                            lastMsg?.senderName?.toLowerCase() === currentDisplayName.toLowerCase()
                              ? lastMsg.targetUsername
                              : lastMsg?.senderName || partnerKey;
                          const partnerAvatar = lastMsg?.avatar || '👤';
                          const partnerTier = lastMsg?.tier || null;

                          return (
                            <div
                              key={partnerKey}
                              className="pm-thread-card"
                              onClick={() => startDirectChatWith(partnerName, partnerAvatar, partnerTier)}
                            >
                              <div className="pm-user-left">
                                <div className="chat-msg-avatar" style={{ width: 34, height: 34 }}>
                                  <span>{partnerAvatar}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <strong style={{ fontSize: '0.82rem', color: '#f8fafc' }}>
                                      {partnerName}
                                    </strong>
                                    {partnerTier && (
                                      <span
                                        className="chat-tier-chip"
                                        style={{
                                          borderColor: partnerTier.color,
                                          color: partnerTier.accent || partnerTier.color,
                                        }}
                                      >
                                        {partnerTier.icon} {partnerTier.shortName}
                                      </span>
                                    )}
                                  </div>
                                  <span className="pm-thread-preview">
                                    {lastMsg?.message || 'Percakapan kosong'}
                                  </span>
                                </div>
                              </div>
                              <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                                {lastMsg?.timestamp
                                  ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="chat-empty-state" style={{ padding: '2rem 1rem' }}>
                          <MessageCircle size={28} className="chat-empty-icon" />
                          <strong>Belum ada pesan pribadi</strong>
                          <span>Cari username pemain terdaftar di atas untuk memulai obrolan private!</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* ================= VIEW: GLOBAL CHAT (SEMUA / REKRUTMEN) ================= */
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
                      Boolean(currentDisplayName) &&
                      msg.senderName?.toLowerCase() === currentDisplayName.toLowerCase();
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
                        <div
                          className="chat-msg-avatar"
                          style={{ cursor: !isMe && !isSystem ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (!isMe && !isSystem) {
                              startDirectChatWith(msg.senderName, msg.avatar, msg.tier);
                            }
                          }}
                          title={!isMe && !isSystem ? `Klik untuk Chat Pribadi dengan ${msg.senderName}` : ''}
                        >
                          <span>{msg.avatar || '👑'}</span>
                        </div>

                        <div className="chat-msg-body">
                          <div className="chat-msg-meta">
                            <span
                              className={`chat-msg-sender ${!isMe && !isSystem ? 'chat-sender-clickable' : ''}`}
                              onClick={() => {
                                if (!isMe && !isSystem) {
                                  startDirectChatWith(msg.senderName, msg.avatar, msg.tier);
                                }
                              }}
                              title={!isMe && !isSystem ? `Chat Pribadi dengan ${msg.senderName}` : ''}
                            >
                              {msg.senderName}
                            </span>
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
                            {!isMe && !isSystem && (
                              <button
                                type="button"
                                className="btn-dm-quick"
                                onClick={() => startDirectChatWith(msg.senderName, msg.avatar, msg.tier)}
                                title={`Kirim pesan pribadi (DM) ke ${msg.senderName}`}
                              >
                                <Lock size={9} />
                                <span>DM</span>
                              </button>
                            )}
                            {!isMe && !isSystem && (
                              <button
                                type="button"
                                className="btn-dm-quick"
                                onClick={() => handleAddFriendFromChat({ name: msg.senderName, avatar: msg.avatar, tier: msg.tier })}
                                title={isFriend(currentDisplayName, msg.senderName) ? 'Sudah berteman' : `Tambah ${msg.senderName} sebagai teman`}
                                style={{
                                  background: isFriend(currentDisplayName, msg.senderName) ? 'rgba(16, 185, 129, 0.2)' : undefined,
                                  borderColor: isFriend(currentDisplayName, msg.senderName) ? 'rgba(16, 185, 129, 0.45)' : undefined,
                                  color: isFriend(currentDisplayName, msg.senderName) ? '#6ee7b7' : undefined,
                                }}
                              >
                                {isFriend(currentDisplayName, msg.senderName) ? <UserCheck size={9} /> : <UserPlus size={9} />}
                              </button>
                            )}
                            <span className="chat-msg-time">{timeString}</span>
                            {isMe && !isSystem && (
                              <button
                                type="button"
                                className="chat-retract-btn"
                                title="Batal kirim"
                                onClick={() => handleRetractMessage(msg, 'public')}
                              >
                                <Trash2 size={10} /> Batal
                              </button>
                            )}
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
            )}

            {/* Quick Preset Shortcuts (MLBB Fast Chat) */}
            {!(activeTab === 'private' && !activeDmPartner) && (
              <div className="mlbb-quick-presets-bar">
                {(activeTab === 'private'
                  ? [
                      '⚔️ Ayo mabar berdua!',
                      '🃏 Gas push rank bareng!',
                      'Hai, lagi online?',
                      'Masuk room sekarang yuk!',
                    ]
                  : QUICK_PRESETS
                ).map((preset) => (
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
            )}

            {/* Input Form (Only shown in Global/Recruit OR when DM Partner is selected) */}
            {!(activeTab === 'private' && !activeDmPartner) && (
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
                    activeTab === 'private' && activeDmPartner
                      ? `Kirim pesan pribadi ke ${activeDmPartner.name}...`
                      : myProfile.name
                      ? 'Kirim pesan atau ajak mabar...'
                      : `Ketik pesan (mengirim sebagai ${currentDisplayName})...`
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
            )}

            {!myProfile.name && onOpenProfileModal && (
              <div
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.68rem',
                  color: '#94a3b8',
                  background: 'rgba(15, 23, 42, 0.95)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span>
                  Mengirim sebagai: <strong style={{ color: '#fde047' }}>{currentDisplayName}</strong>
                </span>
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    fontWeight: 800,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Pasang Nickname & PIN
                </button>
              </div>
            )}
            {/* Popup Konfirmasi Hapus Pertemanan */}
            {friendToDelete && (
              <div
                className="friends-confirm-overlay"
                onClick={() => setFriendToDelete(null)}
              >
                <div
                  className="friends-confirm-dialog"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="confirm-icon-box">
                    <AlertTriangle size={22} className="confirm-warning-icon" />
                  </div>
                  <h4 className="confirm-title" style={{ fontSize: '1.05rem', margin: '0 0 0.5rem 0' }}>
                    Hapus Pertemanan?
                  </h4>
                  <div className="confirm-profile-preview">
                    <span>{friendToDelete.avatar || '👤'}</span>
                    <strong>{friendToDelete.name}</strong>
                  </div>
                  <p className="confirm-desc">
                    Yakin ingin menghapus <strong style={{ color: '#fde047' }}>{friendToDelete.name}</strong> dari daftar teman?
                  </p>
                  <div className="confirm-btn-row">
                    <button
                      type="button"
                      className="btn-confirm-cancel"
                      onClick={() => setFriendToDelete(null)}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn-confirm-delete"
                      onClick={() => {
                        handleRemoveFriend(friendToDelete.name);
                        setFriendToDelete(null);
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Ya, Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
