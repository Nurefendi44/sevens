import React, { useState, useEffect } from 'react';
import {
  Users,
  Copy,
  Check,
  Play,
  LogOut,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Gamepad2,
  Share2,
  Link2,
  ArrowLeft,
  Crown,
  UserPlus,
  ClipboardPaste,
  Layers,
  KeyRound,
  User,
} from 'lucide-react';
import '../styles/multiplayer.css';

/**
 * Intelligent parser to extract pure 6-character room code from:
 * - Direct codes (e.g., "3C5RZP")
 * - Full invite URLs (e.g., "https://domain.com/?room=3C5RZP")
 * - Shared chat messages (e.g., "3C5RZP Ayo gabung main kartu Sevens di Room 3C5RZP!...")
 */
export function extractCleanRoomCode(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const text = rawText.trim();

  // 1. Check if URL contains query param ?room=CODE or &room=CODE
  const roomParamMatch = text.match(/[?&]room=([A-Za-z0-9]{4,8})/i);
  if (roomParamMatch) {
    return roomParamMatch[1].toUpperCase();
  }

  // 2. Check for explicit "Room CODE" or "Kode CODE" pattern
  const roomWordMatch = text.match(/(?:room|kode)\s*[:#-]?\s*([A-Za-z0-9]{4,8})/i);
  if (roomWordMatch) {
    return roomWordMatch[1].toUpperCase();
  }

  // 3. If starts with 6-character alphanumeric code followed by space/text
  const startCodeMatch = text.match(/^([A-Za-z0-9]{6})\b/i);
  if (startCodeMatch) {
    return startCodeMatch[1].toUpperCase();
  }

  // 4. Any standalone 6-character alphanumeric word in text
  const standaloneMatch = text.match(/\b([A-Za-z0-9]{6})\b/i);
  if (standaloneMatch) {
    return standaloneMatch[1].toUpperCase();
  }

  // 5. Direct typing / clean alphanumeric characters (max 6 chars)
  return text.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
}

const GAME_META = {
  sevens: {
    title: 'Tujuh Sekop',
    subtitle: 'SEVENS ONLINE MULTIPLAYER',
    badge: '♠ ROYAL SEVENS',
    theme: 'gold',
    cards: [
      { rank: '7', suit: '♠', tone: 'gold' },
      { rank: 'A', suit: '♥', tone: 'red' },
    ],
  },
  game41: {
    title: 'Remi 41',
    subtitle: 'KARTU 41 ONLINE MULTIPLAYER',
    badge: '♥ REMI 41 INDONESIA',
    theme: 'emerald',
    cards: [
      { rank: 'A', suit: '♥', tone: 'gold' },
      { rank: 'K', suit: '♥', tone: 'red' },
    ],
  },
  bigtwo: {
    title: 'Big Two',
    subtitle: 'CAPSA BANTING MULTIPLAYER',
    badge: '♦ BIG TWO (CAPSA)',
    theme: 'purple',
    cards: [
      { rank: '2', suit: '♠', tone: 'gold' },
      { rank: '2', suit: '♦', tone: 'red' },
    ],
  },
};

export default function MultiplayerLobby({
  room,
  myPlayerId,
  isHost,
  onStartGame,
  onToggleReady,
  onLeaveRoom,
  onCreateRoom,
  onJoinRoom,
  onSwitchToLocal,
  onBackToMenu,
  isSupabaseConfigured,
  inviteRoomCode = null,
  activeGameType = 'sevens',
}) {
  const [activeTab, setActiveTab] = useState(() =>
    inviteRoomCode ? 'join' : 'create'
  );
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const [deckMode, setDeckMode] = useState('single');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState(() =>
    extractCleanRoomCode(inviteRoomCode || '')
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const meta = GAME_META[activeGameType] || GAME_META.sevens;

  // Sync inviteRoomCode if changed
  useEffect(() => {
    if (inviteRoomCode) {
      setRoomCodeInput(extractCleanRoomCode(inviteRoomCode));
      setActiveTab('join');
    }
  }, [inviteRoomCode]);

  // Generate invite share link (Clean URL)
  const getInviteUrl = () => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?room=${room?.code || ''}`;
  };

  // Copy room code to clipboard
  const handleCopyCode = async () => {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Copy or Share Invite Link
  const handleShareLink = async () => {
    if (!room?.code) return;
    const shareUrl = getInviteUrl();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Room ${meta.title}: ${room.code}`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Quick paste from clipboard for room code
  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRoomCodeInput(extractCleanRoomCode(text));
        setErrorMsg('');
      }
    } catch {
      // Fallback if clipboard permission denied
    }
  };

  // Handle Create Room
  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!usernameInput.trim()) {
      setErrorMsg('Silakan masukkan nama panggilan Anda terlebih dahulu!');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    const effectiveDeckMode =
      activeGameType === 'bigtwo' && selectedPlayerCount > 4
        ? deckMode
        : 'single';

    const res = await onCreateRoom(
      usernameInput.trim(),
      selectedPlayerCount,
      activeGameType,
      { deckMode: effectiveDeckMode }
    );
    setIsLoading(false);
    if (!res.success) {
      if (
        res.error &&
        (res.error.includes('schema cache') ||
          res.error.includes('PGRST205') ||
          res.error.includes('rooms'))
      ) {
        setErrorMsg(
          "Tabel 'rooms' belum dibuat di Supabase! Buka Supabase Dashboard → SQL Editor → Jalankan script SQL migration yang telah disediakan."
        );
      } else {
        setErrorMsg(res.error || 'Gagal membuat room.');
      }
    }
  };

  // Handle Join Room
  const handleJoin = async (e) => {
    e?.preventDefault();
    if (!usernameInput.trim()) {
      setErrorMsg('Silakan masukkan nama panggilan Anda terlebih dahulu!');
      return;
    }
    const cleanCode = extractCleanRoomCode(roomCodeInput);
    if (!cleanCode) {
      setErrorMsg('Silakan masukkan kode room (6 karakter)!');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    const res = await onJoinRoom(cleanCode, usernameInput.trim());
    setIsLoading(false);
    if (!res.success) {
      if (
        res.error &&
        (res.error.includes('schema cache') ||
          res.error.includes('PGRST205') ||
          res.error.includes('rooms'))
      ) {
        setErrorMsg(
          "Tabel 'rooms' belum dibuat di Supabase! Buka Supabase Dashboard → SQL Editor → Jalankan script SQL migration yang telah disediakan."
        );
      } else {
        setErrorMsg(res.error || 'Gagal bergabung ke room.');
      }
    }
  };

  // Helper text for card distribution
  const getCapacityDescription = (count) => {
    if (activeGameType === 'bigtwo') {
      if (count === 2) {
        return 'Single Deck (52 kartu) • Duel 1 vs 1: Setiap pemain mendapat 26 kartu penuh. Pemegang 3♦ jalan pertama.';
      }
      if (count === 3) {
        return 'Single Deck (52 kartu) • 3 Pemain: Setiap pemain mendapat 17–18 kartu (semua 52 kartu dibagi habis). Pemegang 3♦ jalan pertama.';
      }
      if (count === 4) {
        return 'Single Deck (52 kartu) • Standar 4 Pemain: Setiap pemain mendapat 13 kartu penuh. Pemegang 3♦ jalan pertama.';
      }
      if (count === 5) {
        return deckMode === 'double'
          ? 'Double Deck (104 kartu) • 5 Pemain: Setiap pemain mendapat 20–21 kartu (semua 104 kartu dibagi habis).'
          : 'Single Deck (52 kartu) • 5 Pemain: Setiap pemain mendapat 10–11 kartu (semua 52 kartu dibagi habis).';
      }
      if (count === 6) {
        return deckMode === 'double'
          ? 'Double Deck (104 kartu) • 6 Pemain: Setiap pemain mendapat 17–18 kartu (semua 104 kartu dibagi habis).'
          : 'Single Deck (52 kartu) • 6 Pemain: Setiap pemain mendapat 8–9 kartu (semua 52 kartu dibagi habis).';
      }
    }
    if (activeGameType === 'game41') {
      return 'Setiap pemain memegang 4 kartu • Kumpulkan kombinasi 41 poin satu kembang!';
    }
    // Sevens
    if (count === 2) return 'Duel 1 vs 1 • Setiap pemain memegang 26 kartu.';
    if (count === 3) return 'Setiap pemain mendapat 17 kartu (7♠ otomatis terbuka di meja).';
    if (count === 4) return 'Standar Klasik • Setiap pemain mendapat 13 kartu penuh.';
    if (count === 5) return 'Setiap pemain mendapat 10 kartu (7♠ & 7♥ otomatis di meja).';
    return 'Setiap pemain mendapat 8 kartu (semua angka 7 otomatis di meja).';
  };

  // ---------------------------------------------------------------------------
  // VIEW A: NOT IN A ROOM YET (CREATE / JOIN SCREEN WITH TAB SWITCHER)
  // ---------------------------------------------------------------------------
  if (!room) {
    return (
      <div className="mp-overlay">
        <div className="mp-ambient-bg" aria-hidden="true">
          <div className="mp-spotlight" />
          <span className="mp-bg-suit s1">♠</span>
          <span className="mp-bg-suit s2">♥</span>
          <span className="mp-bg-suit s3">♦</span>
          <span className="mp-bg-suit s4">♣</span>
        </div>

        <div className={`mp-container theme-${meta.theme}`}>
          {/* Top Navigation Bar */}
          <div className="mp-top-nav">
            {onBackToMenu && (
              <button
                type="button"
                className="mp-nav-btn"
                onClick={onBackToMenu}
              >
                <ArrowLeft size={15} />
                <span>Ganti Permainan</span>
              </button>
            )}

            <button
              type="button"
              className="mp-nav-btn mp-nav-btn-alt"
              onClick={onSwitchToLocal}
            >
              <Gamepad2 size={15} />
              <span>Mode Offline (1 HP)</span>
            </button>
          </div>

          {/* Main Card */}
          <div className="mp-panel">
            {/* Header Identitas Game */}
            <header className="mp-header">
              <div className="mp-mini-cards" aria-hidden="true">
                {meta.cards.map((c, i) => (
                  <div
                    key={i}
                    className={`mp-mini-card tone-${c.tone} pos-${i}`}
                  >
                    <strong>{c.rank}</strong>
                    <span>{c.suit}</span>
                  </div>
                ))}
              </div>

              <span className={`mp-game-pill pill-${meta.theme}`}>
                {meta.badge}
              </span>

              <h1 className="mp-title">
                Lobby Mabar <span>{meta.title}</span>
              </h1>
              <p className="mp-subtitle">
                Bermain kartu secara <strong>Realtime Online</strong> bersama
                teman (2 s/d 6 Pemain)
              </p>
            </header>

            {/* Alerts */}
            {!isSupabaseConfigured && (
              <div className="mp-alert mp-alert-warning">
                <AlertCircle size={18} />
                <div>
                  <strong>Supabase Belum Dikonfigurasi</strong>
                  <p>
                    Tambahkan <code>VITE_SUPABASE_URL</code> dan{' '}
                    <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> pada file{' '}
                    <code>.env</code>.
                  </p>
                </div>
              </div>
            )}

            {inviteRoomCode && (
              <div className="mp-invite-banner">
                <div className="mp-invite-icon">
                  <Link2 size={20} />
                </div>
                <div className="mp-invite-text">
                  <strong>Undangan Room Ditemukan!</strong>
                  <span>
                    Anda diundang ke Room{' '}
                    <code className="mp-code-chip">{inviteRoomCode}</code>. Isi
                    nama Anda lalu klik <strong>Gabung ke Meja</strong>.
                  </span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="mp-alert mp-alert-error">
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: Input Nama Pemain */}
            <div className="mp-field-group">
              <label htmlFor="username-input" className="mp-label">
                <User size={14} />
                <span>Nama Panggilan Anda di Meja</span>
              </label>
              <div className="mp-input-wrapper">
                <input
                  id="username-input"
                  type="text"
                  placeholder="Ketik nama Anda (contoh: Farid, Budi, Andi)..."
                  maxLength={15}
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (activeTab === 'join') handleJoin();
                      else handleCreate();
                    }
                  }}
                  className="mp-text-input"
                  autoFocus
                />
                {usernameInput.trim() && (
                  <span className="mp-input-counter">
                    {usernameInput.length}/15
                  </span>
                )}
              </div>
            </div>

            {/* Step 2: Segmented Tab Switcher (Buat Room vs Gabung Room) */}
            <div className="mp-tabs-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'create'}
                className={`mp-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('create');
                  setErrorMsg('');
                }}
              >
                <Crown size={16} />
                <span>Buat Room Baru (Host)</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'join'}
                className={`mp-tab-btn ${activeTab === 'join' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('join');
                  setErrorMsg('');
                }}
              >
                <KeyRound size={16} />
                <span>Gabung Kode Room</span>
                {inviteRoomCode && <span className="mp-tab-dot" />}
              </button>
            </div>

            {/* TAB CONTENT 1: BUAT ROOM BARU */}
            {activeTab === 'create' ? (
              <div className="mp-tab-content">
                <div className="mp-capacity-section">
                  <div className="mp-capacity-header">
                    <span className="mp-capacity-label">
                      <Users size={14} />
                      <span>Kapasitas Maksimal Kursi Meja</span>
                    </span>
                    <span className="mp-capacity-badge">
                      Maks. {selectedPlayerCount} Pemain
                    </span>
                  </div>

                  {/* 5 Pill Buttons Horizontal */}
                  <div className="mp-count-grid">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`mp-count-pill ${
                          selectedPlayerCount === num ? 'active' : ''
                        }`}
                        onClick={() => setSelectedPlayerCount(num)}
                      >
                        <span className="mp-count-num">{num}</span>
                        <span className="mp-count-unit">Pemain</span>
                      </button>
                    ))}
                  </div>

                  {/* Opsi Single / Double Deck khusus Big Two > 4 Pemain */}
                  {activeGameType === 'bigtwo' && selectedPlayerCount > 4 && (
                    <div className="mp-deck-row">
                      <span className="mp-deck-label">
                        <Layers size={14} />
                        <span>Pilihan Deck ({selectedPlayerCount} Pemain):</span>
                      </span>
                      <div className="mp-deck-segmented">
                        <button
                          type="button"
                          className={`mp-deck-btn ${
                            deckMode === 'single' ? 'active' : ''
                          }`}
                          onClick={() => setDeckMode('single')}
                        >
                          Single Deck (52)
                        </button>
                        <button
                          type="button"
                          className={`mp-deck-btn ${
                            deckMode === 'double' ? 'active' : ''
                          }`}
                          onClick={() => setDeckMode('double')}
                        >
                          Double Deck (104)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Keterangan Pembagian Kartu */}
                  <div className="mp-deal-note">
                    <Sparkles size={15} className="mp-note-icon" />
                    <span>{getCapacityDescription(selectedPlayerCount)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`mp-cta-btn cta-${meta.theme}`}
                  onClick={handleCreate}
                  disabled={isLoading}
                >
                  <Crown size={18} />
                  <span>
                    {isLoading
                      ? 'Sedang Membuat Meja...'
                      : `Buat Room ${selectedPlayerCount} Pemain (Host)`}
                  </span>
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              /* TAB CONTENT 2: GABUNG KODE ROOM */
              <div className="mp-tab-content">
                <div className="mp-join-section">
                  <label htmlFor="room-code-input" className="mp-capacity-label">
                    <KeyRound size={14} />
                    <span>
                      Masukkan 6 Digit Kode Room atau Tempel Link Undangan WA
                    </span>
                  </label>

                  <div className="mp-code-input-row">
                    <input
                      id="room-code-input"
                      type="text"
                      placeholder="CONTOH: 3C5RZP"
                      maxLength={6}
                      value={roomCodeInput}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text');
                        setRoomCodeInput(extractCleanRoomCode(pasted));
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.length > 6 || /[\s?&=:#-]/.test(val)) {
                          setRoomCodeInput(extractCleanRoomCode(val));
                        } else {
                          setRoomCodeInput(
                            val
                              .replace(/[^A-Za-z0-9]/g, '')
                              .slice(0, 6)
                              .toUpperCase()
                          );
                        }
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                      className="mp-code-field"
                    />

                    <button
                      type="button"
                      className="mp-paste-btn"
                      onClick={handlePasteCode}
                      title="Tempel Kode dari Clipboard"
                    >
                      <ClipboardPaste size={16} />
                      <span>Tempel</span>
                    </button>
                  </div>

                  <p className="mp-join-hint">
                    Tips: Anda bisa langsung menempel (paste) pesan undangan
                    WhatsApp lengkap, sistem akan otomatis mengambil 6 huruf kode
                    room-nya.
                  </p>
                </div>

                <button
                  type="button"
                  className="mp-cta-btn cta-blue"
                  onClick={handleJoin}
                  disabled={isLoading}
                >
                  <span>
                    {isLoading ? 'Menghubungkan ke Meja...' : 'Gabung ke Meja Sekarang'}
                  </span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW B: INSIDE ROOM WAITING LOBBY (MEJA KARTU VIP)
  // ---------------------------------------------------------------------------
  const players = room.players || [];
  const myPlayer = players.find((p) => p.id === myPlayerId) || {};
  const isReady = Boolean(myPlayer.isReady);
  const targetPlayerCount = room.game_state?.config?.playerCount || 4;
  const canStart = players.length >= 2;

  const slots = Array.from({ length: targetPlayerCount }).map(
    (_, idx) => players[idx] || null
  );

  return (
    <div className="mp-overlay">
      <div className="mp-ambient-bg" aria-hidden="true">
        <div className="mp-spotlight" />
      </div>

      <div className={`mp-container mp-lobby-wide theme-${meta.theme}`}>
        <div className="mp-panel mp-vip-room-panel">
          {/* VIP Ticket Top Header */}
          <div className="vip-room-header">
            <div className="vip-room-title-area">
              <div className="vip-live-Row">
                <span className="vip-live-badge">
                  <span className="pulsing-dot" />
                  <span>MEJA VIP REALTIME</span>
                </span>
                <span className={`mp-game-pill pill-${meta.theme}`}>
                  {meta.badge}
                </span>
              </div>

              <h2 className="vip-room-heading">
                Ruang Tunggu <span>{meta.title}</span>
              </h2>
              <p className="vip-room-sub">
                Permainan dapat langsung dimulai saat minimal{' '}
                <strong>2 pemain</strong> bergabung (tidak wajib menunggu penuh).
              </p>
            </div>

            {/* VIP Ticket Code Box */}
            <div className="vip-ticket-box">
              <div className="vip-ticket-code-col">
                <span className="vip-ticket-label">KODE ROOM</span>
                <strong className="vip-ticket-code">{room.code}</strong>
              </div>

              <div className="vip-ticket-actions">
                <button
                  type="button"
                  className="btn-ticket-action"
                  onClick={handleCopyCode}
                  title="Salin Kode Room"
                >
                  {copiedCode ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedCode ? 'Tersalin!' : 'Salin Kode'}</span>
                </button>

                <button
                  type="button"
                  className="btn-ticket-action btn-ticket-share"
                  onClick={handleShareLink}
                  title="Bagikan Link Undangan ke WhatsApp"
                >
                  {copiedLink ? <Check size={15} /> : <Share2 size={15} />}
                  <span>{copiedLink ? 'Link Tersalin!' : 'Undang Teman'}</span>
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mp-alert mp-alert-error">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Status Bar Kursi */}
          <div className="vip-seats-meta-bar">
            <span className="seats-counter-title">
              <Users size={15} />
              <span>Daftar Kursi Pemain</span>
            </span>
            <span className="seats-progress-pill">
              {players.length} / {targetPlayerCount} Kursi Terisi
            </span>
          </div>

          {/* Grid Kursi Pemain */}
          <div className="vip-seats-grid">
            {slots.map((slotPlayer, idx) => {
              if (slotPlayer) {
                const isMe = slotPlayer.id === myPlayerId;
                return (
                  <div
                    key={slotPlayer.id}
                    className={`vip-seat-card seat-occupied ${
                      isMe ? 'seat-is-me' : ''
                    } ${slotPlayer.isReady || slotPlayer.isHost ? 'seat-is-ready' : ''}`}
                  >
                    <div className="seat-avatar-wrap">
                      <span className="seat-avatar-emoji">
                        {slotPlayer.avatar || '🃏'}
                      </span>
                      {slotPlayer.isHost && (
                        <span className="seat-crown-badge" title="Host Room">
                          👑
                        </span>
                      )}
                    </div>

                    <div className="seat-details">
                      <div className="seat-name-line">
                        <span className="seat-player-name">
                          {slotPlayer.name}
                        </span>
                        {isMe && <span className="seat-you-tag">Anda</span>}
                      </div>

                      <div className="seat-status-row">
                        {slotPlayer.isHost && (
                          <span className="seat-pill pill-host">HOST MEJA</span>
                        )}
                        {slotPlayer.isReady ? (
                          <span className="seat-pill pill-ready">
                            ● SIAP MAIN
                          </span>
                        ) : (
                          <span className="seat-pill pill-waiting">
                            ⏳ MENUNGGU
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={`empty-${idx}`}
                  type="button"
                  className="vip-seat-card seat-empty"
                  onClick={handleShareLink}
                  title="Klik untuk menyalin link undangan"
                >
                  <div className="seat-empty-avatar">
                    <UserPlus size={20} />
                  </div>
                  <div className="seat-empty-info">
                    <span className="seat-empty-title">
                      Kursi #{idx + 1} Kosong
                    </span>
                    <span className="seat-empty-sub">
                      + Klik untuk undang teman
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Action Controls */}
          <div className="vip-lobby-footer">
            <button
              type="button"
              className="btn-leave-room"
              onClick={onLeaveRoom}
            >
              <LogOut size={16} />
              <span>Keluar Meja</span>
            </button>

            <div className="vip-primary-actions">
              {!isHost && (
                <button
                  type="button"
                  className={`btn-ready-toggle ${isReady ? 'active' : ''}`}
                  onClick={() => onToggleReady(!isReady)}
                >
                  <ShieldCheck size={18} />
                  <span>
                    {isReady ? 'Status: Siap (Klik Batal)' : 'Tandai Saya Siap!'}
                  </span>
                </button>
              )}

              {isHost && (
                <button
                  type="button"
                  className={`mp-cta-btn cta-${meta.theme} btn-host-start`}
                  disabled={!canStart}
                  onClick={onStartGame}
                >
                  <Play size={18} />
                  <span>
                    {players.length < 2
                      ? `Menunggu Minimal 2 Pemain (${players.length}/${targetPlayerCount})`
                      : players.length === targetPlayerCount
                      ? `Mulai Permainan (${players.length} Pemain Lengkap)`
                      : `Mulai Sekarang (${players.length}/${targetPlayerCount} Pemain)`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
