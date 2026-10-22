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
  HelpCircle,
  Gamepad2,
  Share2,
  Link2,
  ArrowLeft,
} from 'lucide-react';

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
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const [deckMode, setDeckMode] = useState('double');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState(() => extractCleanRoomCode(inviteRoomCode || ''));
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync inviteRoomCode if changed
  useEffect(() => {
    if (inviteRoomCode) {
      setRoomCodeInput(extractCleanRoomCode(inviteRoomCode));
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

    // If mobile browser supports native Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Room Sevens: ${room.code}`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share dismissed, fallback to copy
      }
    }

    // Clipboard copy fallback
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Handle Create Room
  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!usernameInput.trim()) {
      setErrorMsg('Silakan masukkan nama pemain terlebih dahulu!');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    const res = await onCreateRoom(usernameInput.trim(), selectedPlayerCount, activeGameType, { deckMode });
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
      setErrorMsg('Silakan masukkan nama pemain terlebih dahulu!');
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

  // ---------------------------------------------------------------------------
  // VIEW A: NOT IN A ROOM YET (CREATE / JOIN SCREEN)
  // ---------------------------------------------------------------------------
  if (!room) {
    return (
      <div className="multiplayer-screen-overlay">
        <div className="multiplayer-card">
          {/* Header */}
          <div className="multiplayer-header">
            <div className="multiplayer-brand-icon">
              <Users size={32} />
            </div>
            <h2>
              {activeGameType === 'bigtwo'
                ? '💎 BIG TWO (CAPSA BANTING) ONLINE'
                : activeGameType === 'game41'
                ? '🃏 REMI 41 ONLINE MULTIPLAYER'
                : '♠ SEVENS ONLINE MULTIPLAYER'}
            </h2>
            <p>
              {activeGameType === 'bigtwo'
                ? 'Mainkan kartu Big Two (Capsa Banting) bersama teman secara realtime (2 s/d 6 Pemain)'
                : activeGameType === 'game41'
                ? 'Mainkan kartu Remi 41 bersama teman secara realtime (2 s/d 6 Pemain)'
                : 'Mainkan kartu Tujuh Sekop bersama teman secara realtime (2 s/d 6 Pemain)'}
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="alert-box warning-box">
              <AlertCircle size={20} />
              <div>
                <strong>Supabase Belum Dikonfigurasi</strong>
                <p>
                  Tambahkan <code>VITE_SUPABASE_URL</code> dan{' '}
                  <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> pada file <code>.env</code>.
                </p>
              </div>
            </div>
          )}

          {/* Incoming Invite Link Banner */}
          {inviteRoomCode && (
            <div className="invite-banner">
              <div className="invite-banner-icon">
                <Link2 size={22} />
              </div>
              <div className="invite-banner-info">
                <h4>Undangan Bergabung!</h4>
                <p>
                  Anda diundang bergabung ke Room{' '}
                  <span className="invite-code-tag">{inviteRoomCode}</span>. Masukkan nama Anda di bawah lalu klik Gabung.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="alert-box error-box">
              <AlertCircle size={20} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Player Name Input */}
          <div className="form-group">
            <label htmlFor="username-input">Nama Anda (Username Bebas)</label>
            <input
              id="username-input"
              type="text"
              placeholder="Contoh: Farid, Budi, Andi..."
              maxLength={15}
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (inviteRoomCode || roomCodeInput) handleJoin();
                  else handleCreate();
                }
              }}
              className="text-input"
              autoFocus
            />
          </div>

          <div className="multiplayer-actions-grid">
            {/* Join Room Box (Highlighted if opened via invite link) */}
            <div className={`action-box ${inviteRoomCode ? 'action-box-highlight' : ''}`}>
              <div className="action-box-icon">
                <ArrowRight size={22} />
              </div>
              <h3>Gabung Room</h3>
              <p>
                {inviteRoomCode
                  ? 'Kode room terisi otomatis dari link undangan.'
                  : 'Masukkan Room Code 6 digit dari teman Anda.'}
              </p>
              <div className="join-input-group">
                <input
                  type="text"
                  placeholder="KODE ROOM"
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
                      setRoomCodeInput(val.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase());
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  className="text-input code-input"
                />
                <button
                  className="btn-primary"
                  onClick={handleJoin}
                  disabled={isLoading}
                >
                  {isLoading ? '...' : 'Gabung'}
                </button>
              </div>
            </div>

            {/* Create Room Box */}
            <div className="action-box">
              <div className="action-box-icon">
                <Sparkles size={22} />
              </div>
              <h3>Buat Room Baru</h3>
              <p>Mulai room baru sebagai Host dan tentukan kapasitas pemain:</p>

              {/* Player Count Picker */}
              <div className="lobby-count-picker">
                <span className="picker-title">Kapasitas Maksimal Pemain:</span>
                <div className="lobby-count-options">
                  {[2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`btn-lobby-count ${selectedPlayerCount === num ? 'active' : ''}`}
                      onClick={() => setSelectedPlayerCount(num)}
                    >
                      <span style={{ fontWeight: 800 }}>{num} Orang</span>
                      <small>
                        {num === 2
                          ? (activeGameType === 'bigtwo' ? '13 kartu • 1 vs 1' : activeGameType === 'game41' ? '4 kartu • 1 vs 1' : '26 kartu/orang')
                          : num === 3
                          ? (activeGameType === 'bigtwo' ? '13 kartu/orang' : activeGameType === 'game41' ? '4 kartu/orang' : '17 kartu • ♠7 meja')
                          : num === 4
                          ? (activeGameType === 'bigtwo' ? '13 kartu/orang' : activeGameType === 'game41' ? '4 kartu/orang' : '13 kartu/orang')
                          : num === 5
                          ? (activeGameType === 'bigtwo' ? (deckMode === 'double' ? '13 kartu (Double)' : '10 kartu (Single)') : activeGameType === 'game41' ? '4 kartu/orang' : '10 kartu • ♠7,♥7 meja')
                          : (activeGameType === 'bigtwo' ? (deckMode === 'double' ? '13 kartu (Double)' : '8 kartu (Single)') : activeGameType === 'game41' ? '4 kartu/orang' : '8 kartu • semua 7 meja')}
                      </small>
                    </button>
                  ))}
                </div>

                {/* Deck Mode selector for Big Two when > 4 players */}
                {activeGameType === 'bigtwo' && selectedPlayerCount > 4 && (
                  <div style={{ marginTop: '0.75rem', background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700, marginBottom: '0.4rem' }}>
                      Pilihan Deck ({selectedPlayerCount} Pemain):
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className={`btn-lobby-count ${deckMode === 'single' ? 'active' : ''}`}
                        style={{ flex: 1, padding: '0.4rem' }}
                        onClick={() => setDeckMode('single')}
                      >
                        <span style={{ fontWeight: 800 }}>Single Deck</span>
                        <small>52 Kartu</small>
                      </button>
                      <button
                        type="button"
                        className={`btn-lobby-count ${deckMode === 'double' ? 'active' : ''}`}
                        style={{ flex: 1, padding: '0.4rem' }}
                        onClick={() => setDeckMode('double')}
                      >
                        <span style={{ fontWeight: 800 }}>Double Deck</span>
                        <small>104 Kartu</small>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                className="btn-secondary btn-block"
                onClick={handleCreate}
                disabled={isLoading}
              >
                {isLoading ? 'Membuat...' : `Buat Room ${selectedPlayerCount} Pemain (Host)`}
              </button>
            </div>
          </div>

          {/* Switch to Local Mode or Back to Menu */}
          <div className="local-mode-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {onBackToMenu && (
              <button className="btn-text-mode" onClick={onBackToMenu}>
                <ArrowLeft size={16} />
                <span>Pilihan Mode Permainan</span>
              </button>
            )}
            <button className="btn-text-mode" onClick={onSwitchToLocal}>
              <Gamepad2 size={16} />
              <span>Main Offline (Lokal)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW B: IN A ROOM LOBBY
  // ---------------------------------------------------------------------------
  const players = room.players || [];
  const myPlayer = players.find((p) => p.id === myPlayerId) || {};
  const isReady = Boolean(myPlayer.isReady);
  const targetPlayerCount = room.game_state?.config?.playerCount || 4;
  const canStart = players.length >= 2;

  // Fill up to targetPlayerCount slots (2 to 6)
  const slots = Array.from({ length: targetPlayerCount }).map((_, idx) => players[idx] || null);

  return (
    <div className="multiplayer-screen-overlay">
      <div className="multiplayer-card lobby-card">
        {/* Room Header & Code & Share Buttons */}
        <div className="lobby-top-bar">
          <div>
            <div className="lobby-status-pill">
              <span className="pulsing-green-dot" />
              Lobby Realtime
            </div>
            <h2>
              ROOM: <span className="room-code-highlight">{room.code}</span>
            </h2>
          </div>

          <div className="lobby-share-actions">
            {/* Option 1: Copy Code */}
            <button
              className="copy-code-btn"
              onClick={handleCopyCode}
              title="Salin Kode Room 6 Karakter"
            >
              {copiedCode ? (
                <>
                  <Check size={16} className="text-success" />
                  <span>Kode Disalin!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Salin Kode</span>
                </>
              )}
            </button>

            {/* Option 2: Share / Copy Link */}
            <button
              className="share-link-btn"
              onClick={handleShareLink}
              title="Bagikan Tautan Undangan (Bisa langsung dibuka di WhatsApp / Browser)"
            >
              {copiedLink ? (
                <>
                  <Check size={16} className="text-success" />
                  <span>Link Disalin!</span>
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  <span>Bagikan Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        <p className="lobby-helper-text">
          Ajak teman bergabung dengan <strong>Kode Room: {room.code}</strong> atau klik tombol <strong>Bagikan Link</strong> di atas. Kapasitas room <strong>{targetPlayerCount} Pemain</strong>. Permainan bisa langsung dimulai begitu ada minimal <strong>2 pemain</strong> bergabung (tidak harus menunggu slot penuh)!
        </p>

        {errorMsg && (
          <div className="alert-box error-box">
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Player Slots Grid */}
        <div className="lobby-players-grid">
          {slots.map((slotPlayer, idx) => {
            if (slotPlayer) {
              const isMe = slotPlayer.id === myPlayerId;
              return (
                <div
                  key={slotPlayer.id}
                  className={`player-slot-card slot-occupied ${isMe ? 'slot-me' : ''}`}
                >
                  <div className="slot-avatar">{slotPlayer.avatar}</div>
                  <div className="slot-info">
                    <div className="slot-name-row">
                      <span className="slot-name">
                        {slotPlayer.name} {isMe && '(Anda)'}
                      </span>
                    </div>
                    <div className="slot-badges">
                      {slotPlayer.isHost && (
                        <span className="badge-host">👑 HOST</span>
                      )}
                      {slotPlayer.isReady ? (
                        <span className="badge-ready">SIAP ✅</span>
                      ) : (
                        <span className="badge-waiting">MENUNGGU ⏳</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={`empty-${idx}`} className="player-slot-card slot-empty">
                <div className="slot-empty-icon">
                  <Users size={28} />
                </div>
                <div className="slot-empty-text">
                  <span>Slot {idx + 1} Kosong</span>
                  <small>Menunggu pemain bergabung...</small>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lobby Controls */}
        <div className="lobby-footer">
          <button className="btn-secondary btn-danger-hover" onClick={onLeaveRoom}>
            <LogOut size={16} />
            <span>Keluar Room</span>
          </button>

          <div className="lobby-action-buttons">
            {!isHost && (
              <button
                className={`btn-action-ready ${isReady ? 'is-ready' : ''}`}
                onClick={() => onToggleReady(!isReady)}
              >
                <ShieldCheck size={18} />
                <span>{isReady ? 'Batal Siap' : 'Saya Siap (Ready)'}</span>
              </button>
            )}

            {isHost && (
              <button
                className="btn-primary btn-start-game"
                disabled={!canStart}
                onClick={onStartGame}
              >
                <Play size={18} />
                <span>
                  {players.length < 2
                    ? `Menunggu Pemain Lain (${players.length}/${targetPlayerCount})`
                    : players.length === targetPlayerCount
                    ? `Mulai Permainan (${players.length} Pemain - Lengkap)`
                    : `Mulai Permainan Sekarang (${players.length}/${targetPlayerCount} Pemain)`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
