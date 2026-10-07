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
  isSupabaseConfigured,
  inviteRoomCode = null,
}) {
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
    const res = await onCreateRoom(usernameInput.trim());
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
            <h2>SEVENS ONLINE MULTIPLAYER</h2>
            <p>Mainkan kartu Tujuh Sekop bersama teman secara realtime (4 Pemain)</p>
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
              <p>Mulai room baru sebagai Host dan bagikan Kode atau Link.</p>
              <button
                className="btn-secondary btn-block"
                onClick={handleCreate}
                disabled={isLoading}
              >
                {isLoading ? 'Membuat...' : 'Buat Room (Host)'}
              </button>
            </div>
          </div>

          {/* Switch to Local Mode */}
          <div className="local-mode-footer">
            <button className="btn-text-mode" onClick={onSwitchToLocal}>
              <Gamepad2 size={16} />
              <span>Beralih ke Mode Simulasi Lokal (Pass-and-Play)</span>
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
  const canStart = players.length === 4;

  // Fill up to 4 slots
  const slots = [0, 1, 2, 3].map((idx) => players[idx] || null);

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
          Ajak teman bergabung dengan <strong>Kode Room: {room.code}</strong> atau klik tombol <strong>Bagikan Link</strong> di atas. Permainan siap dimulai jika 4 pemain telah berkumpul.
        </p>

        {errorMsg && (
          <div className="alert-box error-box">
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 4 Player Slots */}
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
                  {canStart
                    ? 'Mulai Permainan (Start Game)'
                    : `Menunggu ${4 - players.length} Pemain Lagi (${players.length}/4)`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
