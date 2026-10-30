import React, { useState, useEffect, useRef } from 'react';
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
  Bot,
  Trash2,
  RotateCcw,
  Plus,
  Minus,
  Search,
  Zap,
  Hourglass,
} from 'lucide-react';
import '../styles/multiplayer.css';
import { getLocalPlayerName, MATCHMAKING_MIN_PLAYERS } from '../services/multiplayerAdapter.js';
import MatchmakingScreen from './MatchmakingScreen.jsx';


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
  const roomParamMatch = text.match(/[?&]room=([A-Za-z0-9_-]{4,10})/i);
  if (roomParamMatch) {
    return roomParamMatch[1].toUpperCase();
  }

  // 2. Check for explicit game prefix pattern (B2-XXXX, R41-XXXX, SV-XXXX)
  const prefixMatch = text.match(/\b(B2-[A-Za-z0-9]{3,6}|R41-[A-Za-z0-9]{3,6}|SV-[A-Za-z0-9]{3,6})\b/i);
  if (prefixMatch) {
    return prefixMatch[1].toUpperCase();
  }

  // 3. Check for explicit "Room CODE" or "Kode CODE" pattern
  const roomWordMatch = text.match(/(?:room|kode)\s*[:#-]?\s*([A-Za-z0-9_-]{4,10})/i);
  if (roomWordMatch) {
    return roomWordMatch[1].toUpperCase();
  }

  // 4. Standalone 6-character alphanumeric word in text
  const standaloneMatch = text.match(/\b([A-Za-z0-9]{6})\b/i);
  if (standaloneMatch) {
    return standaloneMatch[1].toUpperCase();
  }

  // 5. Direct typing / clean characters allowing letters, numbers, and hyphens (max 10 chars)
  return text.replace(/[^A-Za-z0-9-]/g, '').slice(0, 10).toUpperCase();
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
  onFindMatch,
  onFillBotsAndStart,
  onTouchRoom,
  onAddBot,
  onRemoveBot,
  onUpdateRoomConfig,
  onSwitchToLocal,
  onBackToMenu,
  isSupabaseConfigured,
  inviteRoomCode = null,
  activeGameType = 'sevens',
  initialDeckMode = 'double',
  onClaimHost = null,
  onResetRoom = null,
  onForceResetAndJoin = null,
  isVoiceConnected = false,
  isVoiceMuted = true,
  speakingPlayers = new Set(),
  onToggleVoice = null,
}) {
  const players = room?.players || [];
  const isParticipant = Boolean(room && players.some((p) => p.id === myPlayerId));
  const effectiveInviteCode = inviteRoomCode || (!isParticipant && room?.code ? room.code : null);
  const hasActiveHost = players.some((p) => (p.id === room?.host_id || p.isHost) && !p.isBot);

  const [activeTab, setActiveTab] = useState(() =>
    effectiveInviteCode ? 'join' : 'match'
  );
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(initialPlayerCount || 4);
  const [deckMode, setDeckMode] = useState(initialDeckMode || 'double');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [usernameInput, setUsernameInput] = useState(() => getLocalPlayerName() || '');
  const [roomCodeInput, setRoomCodeInput] = useState(() =>
    extractCleanRoomCode(effectiveInviteCode || '')
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // MATCHMAKING LOBBY STATE (dynamic table 4-6 players):
  //  - < 4 players  : keep searching, host gets "wait or add bots" prompt after 20s
  //  - >= 4 players : auto-start after a quiet period (10s without new joiners)
  //  - full (6)     : auto-start after 5s
  // ---------------------------------------------------------------------------
  const isMatchmakingRoom = Boolean(room?.game_state?.matchmaking);
  const seatTarget =
    room?.game_state?.config?.roomPlayerCount || room?.game_state?.config?.playerCount || 4;
  const isRoomFull = players.length >= seatTarget;
  const hasEnoughToStart = players.length >= MATCHMAKING_MIN_PLAYERS;
  const playerCountNow = players.length;
  const roomCodeNow = room?.code;

  const [countdown, setCountdown] = useState(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  const onStartGameRef = useRef(onStartGame);
  const onTouchRoomRef = useRef(onTouchRoom);

  useEffect(() => {
    onStartGameRef.current = onStartGame;
    onTouchRoomRef.current = onTouchRoom;
  });

  // Waiting timer while below the minimum (restarts whenever someone joins/leaves)
  useEffect(() => {
    setWaitSeconds(0);
    setSnoozeUntil(0);
    if (!(isParticipant && isMatchmakingRoom && !hasEnoughToStart)) return undefined;
    const id = setInterval(() => setWaitSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isParticipant, isMatchmakingRoom, hasEnoughToStart, playerCountNow, roomCodeNow]);

  // Auto-start: with >= 4 players count down (5s if full, otherwise a 10s quiet period that
  // restarts whenever someone joins/leaves), then the HOST starts the game
  useEffect(() => {
    if (!(isParticipant && isMatchmakingRoom && hasEnoughToStart)) {
      setCountdown(null);
      return undefined;
    }
    let remaining = isRoomFull ? 5 : 10;
    setCountdown(remaining);
    const id = setInterval(() => {
      remaining -= 1;
      setCountdown(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(id);
        if (isHost && onStartGameRef.current) onStartGameRef.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isParticipant, isMatchmakingRoom, hasEnoughToStart, isRoomFull, isHost, playerCountNow, roomCodeNow]);

  // Heartbeat keeps the room visible in the matchmaking queue (drops ghost rooms)
  useEffect(() => {
    if (!(isParticipant && isMatchmakingRoom && !isRoomFull)) return undefined;
    const id = setInterval(() => {
      if (onTouchRoomRef.current) onTouchRoomRef.current();
    }, 20000);
    return () => clearInterval(id);
  }, [isParticipant, isMatchmakingRoom, isRoomFull, roomCodeNow]);

  const showBotPrompt =
    isHost && isMatchmakingRoom && !hasEnoughToStart && waitSeconds >= Math.max(20, snoozeUntil);

  const meta = GAME_META[activeGameType] || GAME_META.sevens;

  // Sync effectiveInviteCode if changed
  useEffect(() => {
    if (effectiveInviteCode) {
      setRoomCodeInput(extractCleanRoomCode(effectiveInviteCode));
      setActiveTab('join');
    }
  }, [effectiveInviteCode]);


  // Generate invite share link (Clean URL with room and game type)
  const getInviteUrl = () => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const gameParam = activeGameType ? `&game=${activeGameType}` : '';
    return `${origin}${pathname}?room=${room?.code || ''}${gameParam}`;
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

  // Handle Matchmaking (Cari Lawan)
  const handleFindMatchClick = async (e) => {
    e?.preventDefault();
    if (!usernameInput.trim()) {
      setErrorMsg('Silakan masukkan nama panggilan Anda terlebih dahulu!');
      return;
    }
    if (!onFindMatch) return;
    setErrorMsg('');
    setIsLoading(true);
    const res = await onFindMatch(usernameInput.trim(), activeGameType);
    setIsLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Gagal mencari lawan.');
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
  if (!room || !isParticipant) {
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

            {effectiveInviteCode && (
              <div className="mp-invite-banner">
                <div className="mp-invite-icon">
                  <Link2 size={20} />
                </div>
                <div className="mp-invite-text">
                  <strong>Undangan Room Ditemukan!</strong>
                  <span>
                    Anda diundang ke Room{' '}
                    <code className="mp-code-chip">{effectiveInviteCode}</code>. Isi
                    nama Anda lalu klik <strong>Gabung ke Meja</strong>.
                  </span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="mp-alert mp-alert-error mp-alert-with-action">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} />
                  <span>{errorMsg}</span>
                </div>
                {(errorMsg.includes('berlangsung') || errorMsg.includes('penuh') || errorMsg.includes('sudah')) && onForceResetAndJoin && (
                  <button
                    type="button"
                    className="btn-alert-force-reset"
                    disabled={isLoading}
                    onClick={async () => {
                      if (!usernameInput.trim()) {
                        setErrorMsg('Silakan isi nama panggilan Anda terlebih dahulu.');
                        return;
                      }
                      const codeToUse = extractCleanRoomCode(roomCodeInput || effectiveInviteCode || '');
                      if (!codeToUse) {
                        setErrorMsg('Masukkan kode room yang valid terlebih dahulu.');
                        return;
                      }
                      setIsLoading(true);
                      setErrorMsg('');
                      await onForceResetAndJoin(codeToUse, usernameInput.trim());
                      setIsLoading(false);
                    }}
                  >
                    <RotateCcw size={15} />
                    <span>Reset Meja Ini & Masuk Sebagai Host Baru</span>
                  </button>
                )}
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
                      else if (activeTab === 'match') handleFindMatchClick();
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
                aria-selected={activeTab === 'match'}
                className={`mp-tab-btn ${activeTab === 'match' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('match');
                  setErrorMsg('');
                }}
              >
                <Search size={16} />
                <span>Cari Lawan</span>
              </button>

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
                <span>Buat Room</span>
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
                <span>Gabung Kode</span>
                {effectiveInviteCode && <span className="mp-tab-dot" />}
              </button>
            </div>

            {/* TAB CONTENT 0: MATCHMAKING (CARI LAWAN) */}
            {activeTab === 'match' ? (
              <div className="mp-tab-content">
                <div className="mp-capacity-section">
                  <div className="mp-capacity-header">
                    <span className="mp-capacity-label">
                      <Users size={14} />
                      <span>Meja Dinamis</span>
                    </span>
                    <span className="mp-capacity-badge">4–6 Pemain</span>
                  </div>

                  <div className="mp-deal-note">
                    <Zap size={15} className="mp-note-icon" />
                    <span>
                      Semua pemain masuk satu antrean. Pemain yang pertama masuk otomatis jadi{' '}
                      <strong>Host</strong>. Game dimulai otomatis saat sudah {MATCHMAKING_MIN_PLAYERS}{' '}
                      pemain dan tidak ada yang bergabung lagi (atau langsung saat meja penuh 6
                      pemain).
                      {activeGameType === 'bigtwo'
                        ? ' Big Two 5–6 pemain memakai Double Deck (104 kartu).'
                        : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`mp-cta-btn cta-${meta.theme}`}
                  onClick={handleFindMatchClick}
                  disabled={isLoading}
                >
                  <Search size={18} />
                  <span>{isLoading ? 'Mencari Lawan...' : 'Cari Lawan'}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : activeTab === 'create' ? (
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
                      Masukkan Kode Room (cth: {activeGameType === 'bigtwo' ? 'B2-XXXX' : activeGameType === 'game41' ? 'R41-XXXX' : 'SV-XXXX'}) atau Link Undangan
                    </span>
                  </label>

                  <div className="mp-code-input-row">
                    <input
                      id="room-code-input"
                      type="text"
                      placeholder={
                        activeGameType === 'bigtwo'
                          ? 'CONTOH: B2-K7P9'
                          : activeGameType === 'game41'
                          ? 'CONTOH: R41-K7P9'
                          : 'CONTOH: SV-K7P9'
                      }
                      maxLength={12}
                      value={roomCodeInput}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text');
                        setRoomCodeInput(extractCleanRoomCode(pasted));
                      }}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 10).toUpperCase();
                        setRoomCodeInput(val);
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

                {onForceResetAndJoin && (
                  <button
                    type="button"
                    className="btn-quick-force-reset"
                    disabled={isLoading}
                    onClick={async () => {
                      if (!usernameInput.trim()) {
                        setErrorMsg('Silakan isi nama panggilan Anda terlebih dahulu.');
                        return;
                      }
                      const codeToUse = extractCleanRoomCode(roomCodeInput || effectiveInviteCode || '');
                      if (!codeToUse) {
                        setErrorMsg('Masukkan kode room yang valid terlebih dahulu.');
                        return;
                      }
                      if (!window.confirm(`Reset permainan di Room ${codeToUse} dan masuk sebagai Host baru?`)) return;
                      setIsLoading(true);
                      setErrorMsg('');
                      await onForceResetAndJoin(codeToUse, usernameInput.trim());
                      setIsLoading(false);
                    }}
                    title="Gunakan ini jika room sebelumnya macet, ditinggalkan pemain lama, atau ingin memulai sesi baru"
                  >
                    <RotateCcw size={14} />
                    <span>Reset Meja Ini & Ambil Alih Sebagai Host</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW B-1: MATCHMAKING SCREEN (MOBILE LEGENDS STYLE RADAR & PARTICLES)
  // ---------------------------------------------------------------------------
  const targetPlayerCount = room?.game_state?.config?.roomPlayerCount || room?.game_state?.config?.playerCount || 6;

  if (isMatchmakingRoom) {
    return (
      <MatchmakingScreen
        meta={meta}
        players={players}
        myPlayerId={myPlayerId}
        seatTarget={targetPlayerCount}
        minPlayers={MATCHMAKING_MIN_PLAYERS}
        isHost={isHost}
        isRoomFull={isRoomFull}
        hasEnoughToStart={hasEnoughToStart}
        countdown={countdown}
        showBotPrompt={showBotPrompt}
        onWaitMore={() => setSnoozeUntil(waitSeconds + 30)}
        onFillBots={onFillBotsAndStart}
        onAddBot={onAddBot}
        onRemoveBot={onRemoveBot}
        onStartGame={() => onStartGame(room)}
        onLeave={onLeaveRoom}
        roomCode={room?.code}
        isVoiceConnected={isVoiceConnected}
        isVoiceMuted={isVoiceMuted}
        speakingPlayers={speakingPlayers}
        onToggleVoice={onToggleVoice}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW B-2: INSIDE ROOM WAITING LOBBY (MEJA KARTU VIP UNTUK ROOM KODE / PRIVATE)
  // ---------------------------------------------------------------------------
  const myPlayer = players.find((p) => p.id === myPlayerId) || {};
  const isReady = Boolean(myPlayer.isReady);
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
                {isMatchmakingRoom ? (
                  <>
                    <strong>Matchmaking otomatis</strong> — permainan dimulai sendiri saat
                    meja penuh.
                  </>
                ) : (
                  <>
                    Permainan dapat langsung dimulai saat minimal{' '}
                    <strong>2 pemain</strong> bergabung (tidak wajib menunggu penuh).
                  </>
                )}
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

          {!hasActiveHost && (
            <div className="mp-alert mp-alert-host-missing">
              <div className="mp-host-missing-text">
                <Crown size={18} />
                <span>
                  <strong>Kursi Host Kosong:</strong> Host meja ini telah keluar atau offline. Anda dapat mengambil alih kendali meja sekarang.
                </span>
              </div>
              {onClaimHost && (
                <button
                  type="button"
                  className="btn-claim-host-chip"
                  onClick={onClaimHost}
                >
                  <Crown size={14} />
                  <span>Ambil Alih Host</span>
                </button>
              )}
            </div>
          )}

          {/* Matchmaking status banner */}
          {isMatchmakingRoom && (
            <div className={`mm-banner ${isRoomFull ? 'mm-banner-full' : ''}`}>
              <div className="mm-banner-icon">
                {isRoomFull ? <Zap size={20} /> : <Search size={20} className="mm-spin-icon" />}
              </div>
              <div className="mm-banner-text">
                <strong>
                  {isRoomFull
                    ? `Meja penuh! Permainan dimulai dalam ${countdown ?? 0} detik...`
                    : hasEnoughToStart
                    ? `Pemain cukup (${players.length})! Mulai dalam ${countdown ?? 0} detik jika tidak ada yang bergabung...`
                    : `Mencari pemain... (${players.length}/${MATCHMAKING_MIN_PLAYERS} minimal)`}
                </strong>
                <span>
                  {isHost
                    ? 'Kamu masuk antrean paling awal, jadi Host meja ini.'
                    : 'Host meja adalah pemain yang masuk antrean paling awal.'}
                </span>
              </div>
            </div>
          )}

          {showBotPrompt && (
            <div className="mm-prompt">
              <p>
                ⏳ Belum ada pemain baru. Mau menunggu pemain lain atau isi{' '}
                <strong>{Math.max(MATCHMAKING_MIN_PLAYERS - players.length, 0)} kursi kosong</strong>{' '}
                dengan bot?
              </p>
              <div className="mm-prompt-actions">
                <button
                  type="button"
                  className="mm-btn mm-btn-wait"
                  onClick={() => setSnoozeUntil(waitSeconds + 30)}
                >
                  <Hourglass size={15} />
                  <span>Tunggu Pemain Lain</span>
                </button>
                <button
                  type="button"
                  className="mm-btn mm-btn-bot"
                  onClick={onFillBotsAndStart}
                >
                  <Bot size={15} />
                  <span>Tambah Bot &amp; Mulai</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Bar Kursi & Host Controls */}
          <div className="vip-seats-meta-bar">
            <span className="seats-counter-title">
              <Users size={15} />
              <span>
                {isMatchmakingRoom
                  ? `Daftar Pemain (${players.length} • meja 4–6 pemain)`
                  : `Daftar Kursi (${players.length}/${targetPlayerCount} Kursi)`}
              </span>
            </span>

            <div className="vip-meta-actions-cluster">
              {/* Host Stepper: Tambah / Kurangi Kursi Meja */}
              {isHost && !isMatchmakingRoom && (
                <div className="vip-seat-stepper" title="Atur kapasitas kursi meja permainan">
                  <span className="seat-stepper-label">Kapasitas Kursi:</span>
                  <button
                    type="button"
                    className="btn-seat-step"
                    disabled={targetPlayerCount <= Math.max(2, players.length)}
                    onClick={() => {
                      const nextCount = Math.max(2, targetPlayerCount - 1);
                      if (onUpdateRoomConfig) {
                        onUpdateRoomConfig({
                          playerCount: nextCount,
                          roomPlayerCount: nextCount,
                          ...(activeGameType === 'bigtwo' && nextCount <= 4 ? { deckMode: 'single' } : {}),
                        });
                      }
                    }}
                    title={
                      targetPlayerCount <= Math.max(2, players.length)
                        ? `Tidak bisa kurang dari ${Math.max(2, players.length)} kursi (sedang ada ${players.length} pemain)`
                        : 'Kurangi 1 kursi meja'
                    }
                  >
                    <Minus size={13} />
                  </button>

                  <span className="seat-stepper-value">
                    <strong>{targetPlayerCount}</strong> Kursi
                  </span>

                  <button
                    type="button"
                    className="btn-seat-step"
                    disabled={targetPlayerCount >= 6}
                    onClick={() => {
                      const nextCount = Math.min(6, targetPlayerCount + 1);
                      if (onUpdateRoomConfig) {
                        onUpdateRoomConfig({
                          playerCount: nextCount,
                          roomPlayerCount: nextCount,
                          ...(activeGameType === 'bigtwo' && nextCount > 4 ? { deckMode: 'double' } : {}),
                        });
                      }
                    }}
                    title={targetPlayerCount >= 6 ? 'Maksimal 6 kursi permainan' : 'Tambah 1 kursi meja'}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              )}

              {isHost && !isMatchmakingRoom && players.length < targetPlayerCount && (
                <button
                  type="button"
                  className="btn-meta-add-bot"
                  onClick={onAddBot}
                  title="Tambahkan Bot AI ke meja ini"
                >
                  <Bot size={14} />
                  <span>+ Tambah Bot</span>
                </button>
              )}

              <span className="seats-progress-pill">
                {isMatchmakingRoom
                  ? `${players.length} Pemain`
                  : `${players.length} / ${targetPlayerCount} Kursi Terisi`}
              </span>
            </div>
          </div>

          {/* Opsi / Status Mode Deck khusus Big Two jika pemain atau kapasitas > 4 */}
          {activeGameType === 'bigtwo' && (players.length > 4 || targetPlayerCount > 4) && (
            <div className="vip-deck-config-bar">
              <div className="vip-deck-info-col">
                <span className="vip-deck-title">
                  <Layers size={14} />
                  <span>Mode Deck ({players.length > 4 ? players.length : targetPlayerCount} Pemain):</span>
                </span>
                <span className="vip-deck-desc">
                  {(room.game_state?.config?.deckMode || 'double') === 'double'
                    ? 'Double Deck (104 Kartu) • Setiap pemain dapat 20–21 kartu penuh'
                    : 'Single Deck (52 Kartu) • Setiap pemain dapat 10–11 kartu'}
                </span>
              </div>

              {isHost ? (
                <div className="vip-deck-toggle-group">
                  <button
                    type="button"
                    className={`btn-vip-deck ${
                      (room.game_state?.config?.deckMode || 'double') === 'single'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      onUpdateRoomConfig &&
                      onUpdateRoomConfig({ deckMode: 'single' })
                    }
                  >
                    Single (52)
                  </button>
                  <button
                    type="button"
                    className={`btn-vip-deck ${
                      (room.game_state?.config?.deckMode || 'double') === 'double'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      onUpdateRoomConfig &&
                      onUpdateRoomConfig({ deckMode: 'double' })
                    }
                  >
                    Double (104)
                  </button>
                </div>
              ) : (
                <span
                  className={`vip-deck-badge ${
                    (room.game_state?.config?.deckMode || 'double') === 'double'
                      ? 'badge-double'
                      : ''
                  }`}
                >
                  {(room.game_state?.config?.deckMode || 'double') === 'double'
                    ? 'Double Deck (104 Kartu)'
                    : 'Single Deck (52 Kartu)'}
                </span>
              )}
            </div>
          )}

          {/* Grid Kursi Pemain */}
          <div className="vip-seats-grid">
            {slots.map((slotPlayer, idx) => {
              if (slotPlayer) {
                const isMe = slotPlayer.id === myPlayerId;
                const isBot = Boolean(slotPlayer.isBot);

                return (
                  <div
                    key={slotPlayer.id}
                    className={`vip-seat-card seat-occupied ${
                      isMe ? 'seat-is-me' : ''
                    } ${isBot ? 'seat-is-bot' : ''} ${slotPlayer.isReady || slotPlayer.isHost ? 'seat-is-ready' : ''}`}
                  >
                    <div className="seat-avatar-wrap">
                      <span className="seat-avatar-emoji">
                        {slotPlayer.avatar || (isBot ? '🤖' : '🃏')}
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
                        {isBot ? (
                          <span className="seat-pill pill-bot">
                            🤖 BOT (AI)
                          </span>
                        ) : slotPlayer.isReady ? (
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

                    {isHost && isBot && (
                      <button
                        type="button"
                        className="btn-seat-remove-bot"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRemoveBot) onRemoveBot(slotPlayer.id);
                        }}
                        title={`Keluarkan ${slotPlayer.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div key={`empty-${idx}`} className="vip-seat-card seat-empty seat-empty-interactive">
                  <div
                    className="seat-empty-main"
                    onClick={handleShareLink}
                    title="Klik untuk menyalin link undangan teman"
                  >
                    <div className="seat-empty-avatar">
                      <UserPlus size={18} />
                    </div>
                    <div className="seat-empty-info">
                      <span className="seat-empty-title">Kursi #{idx + 1} Kosong</span>
                      <span className="seat-empty-sub">+ Undang Teman</span>
                    </div>
                  </div>

                  {isHost && (
                    <button
                      type="button"
                      className="btn-seat-add-bot"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAddBot) onAddBot();
                      }}
                      title="Tambahkan Bot AI ke kursi ini"
                    >
                      <Bot size={13} />
                      <span>+ Bot</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Action Controls */}
          <div className="vip-lobby-footer">
            <div className="vip-secondary-actions">
              <button
                type="button"
                className="btn-leave-room"
                onClick={onLeaveRoom}
              >
                <LogOut size={16} />
                <span>Keluar Meja</span>
              </button>

              {!isHost && !hasActiveHost && onClaimHost && (
                <button
                  type="button"
                  className="btn-claim-host"
                  onClick={onClaimHost}
                  title="Ambil alih peran Host karena Host sebelumnya keluar atau tidak aktif"
                >
                  <Crown size={16} />
                  <span>Ambil Alih Host</span>
                </button>
              )}

              {isHost && onResetRoom && (
                <button
                  type="button"
                  className="btn-reset-room"
                  onClick={onResetRoom}
                  title="Reset status permainan dan skor meja kembali ke awal"
                >
                  <RotateCcw size={16} />
                  <span>Reset Game & Skor</span>
                </button>
              )}
            </div>

            <div className="vip-primary-actions">
              {!isHost && !isMatchmakingRoom && (
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
