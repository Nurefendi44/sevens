import React, { useEffect, useState } from 'react';
import { Crown, LogOut, Bot, Hourglass, Swords, Radar, Play, Sparkles, X, Mic, MicOff } from 'lucide-react';
import '../styles/matchmaking.css';

const SUIT_PARTICLES = ['♠', '♥', '♦', '♣', '♠', '♥', '♦', '♣', '♠', '♥'];

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Full-screen "Mobile Legends"-style matchmaking screen.
 * Pure presentation: all matchmaking logic (countdown, auto start, bot fill) lives in MultiplayerLobby.
 */
export default function MatchmakingScreen({
  meta,
  players = [],
  myPlayerId,
  seatTarget = 6,
  minPlayers = 4,
  isHost,
  isRoomFull,
  hasEnoughToStart,
  countdown,
  showBotPrompt,
  onWaitMore,
  onFillBots,
  onAddBot,
  onRemoveBot,
  onStartGame,
  onLeave,
  roomCode,
  isVoiceConnected = false,
  isVoiceMuted = true,
  speakingPlayers = new Set(),
  onToggleVoice = null,
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const phase = isRoomFull ? 'full' : hasEnoughToStart ? 'found' : 'searching';

  const extraSlot = players.length >= minPlayers && players.length < seatTarget ? 1 : 0;
  const slotCount = Math.min(seatTarget, Math.max(minPlayers, players.length + extraSlot));
  const slots = Array.from({ length: slotCount }).map((_, i) => players[i] || null);

  const totalCountdown = isRoomFull ? 5 : 10;
  const ringRadius = 54;
  const ringCirc = 2 * Math.PI * ringRadius;
  const progress = countdown == null ? 1 : Math.max(0, Math.min(1, countdown / totalCountdown));

  const title =
    phase === 'full'
      ? 'MEJA PENUH!'
      : phase === 'found'
      ? 'LAWAN DITEMUKAN!'
      : 'MENCARI LAWAN';

  const subtitle =
    phase === 'full'
      ? 'Bersiap, pertandingan segera dimulai'
      : phase === 'found'
      ? 'Menunggu pemain lain bergabung...'
      : `Menunggu minimal ${minPlayers} pemain`;

  return (
    <div className={`mmx-screen theme-${meta?.theme || 'gold'} mmx-phase-${phase}`}>
      {/* Background FX */}
      <div className="mmx-bg" aria-hidden="true">
        <div className="mmx-bg-glow" />
        <div className="mmx-beams">
          <span />
          <span />
          <span />
        </div>
        {SUIT_PARTICLES.map((suit, i) => (
          <span key={i} className={`mmx-particle p${i + 1}`}>
            {suit}
          </span>
        ))}
        <div className="mmx-vignette" />
      </div>

      {phase === 'full' && <div className="mmx-flash" aria-hidden="true" />}

      <div className="mmx-content">
        {/* Top bar */}
        <div className="mmx-topbar">
          <span className="mmx-game-pill">{meta?.badge || 'MATCHMAKING'}</span>
          <div className="mmx-topbar-right">
            {onToggleVoice && (
              <button
                type="button"
                className={`mmx-voice-btn ${isVoiceConnected && !isVoiceMuted ? 'active' : ''}`}
                onClick={onToggleVoice}
                title={
                  isVoiceConnected
                    ? isVoiceMuted
                      ? 'Nyalakan Mic (Unmute)'
                      : 'Matikan Mic (Mute)'
                    : 'Nyalakan Live Voice Chat'
                }
              >
                {isVoiceConnected && !isVoiceMuted ? (
                  <Mic size={14} className={speakingPlayers?.has?.(myPlayerId) ? 'pulse-speaking' : ''} />
                ) : (
                  <MicOff size={14} />
                )}
                <span>{isVoiceConnected ? (isVoiceMuted ? 'Muted' : 'Voice On') : 'Voice'}</span>
              </button>
            )}
            <span className="mmx-room-chip">Room {roomCode}</span>
          </div>
        </div>

        {/* Radar / countdown center */}
        <div className="mmx-radar-wrap">
          <div className="mmx-radar">
            <span className="mmx-ring r1" />
            <span className="mmx-ring r2" />
            <span className="mmx-ring r3" />
            <span className="mmx-sweep" />

            {phase === 'searching' ? (
              <div className="mmx-radar-core">
                <Radar size={34} />
                <strong className="mmx-timer">{formatElapsed(elapsed)}</strong>
              </div>
            ) : (
              <div className="mmx-radar-core mmx-core-countdown">
                <svg className="mmx-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="mmx-ring-track" cx="60" cy="60" r={ringRadius} />
                  <circle
                    className="mmx-ring-progress"
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringCirc * (1 - progress)}
                  />
                </svg>
                <strong key={countdown} className="mmx-count-num">
                  {countdown ?? 0}
                </strong>
              </div>
            )}
          </div>
        </div>

        <h1 className="mmx-title" data-text={title}>
          {title}
          {phase === 'searching' && (
            <span className="mmx-dots" aria-hidden="true">
              <i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
          )}
        </h1>
        <p className="mmx-subtitle">{subtitle}</p>

        {/* Player cards */}
        <div className="mmx-slots">
          {slots.map((p, idx) => {
            if (!p) {
              return (
                <div key={`empty-${idx}`} className="mmx-slot mmx-slot-empty">
                  <div className="mmx-slot-avatar">
                    <span>?</span>
                  </div>
                  <span className="mmx-slot-name">Mencari...</span>
                </div>
              );
            }
            const isMe = p.id === myPlayerId;
            const isSpeaking = speakingPlayers?.has?.(p.id);
            return (
              <div
                key={p.id}
                className={`mmx-slot mmx-slot-filled ${isMe ? 'is-me' : ''} ${
                  p.isBot ? 'is-bot' : ''
                } ${p.isHost ? 'is-host' : ''}`}
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                {p.isHost && (
                  <span className="mmx-host-badge" title="Host">
                    <Crown size={13} />
                  </span>
                )}
                {p.isBot && isHost && onRemoveBot && (
                  <button
                    type="button"
                    className="mmx-bot-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBot(p.id);
                    }}
                    title="Keluarkan Bot Ini"
                    aria-label="Keluarkan Bot Ini"
                  >
                    <X size={12} />
                  </button>
                )}
                <div className={`mmx-slot-avatar ${isSpeaking ? 'speaking-avatar-ring' : ''}`}>
                  <span>{p.avatar || (p.isBot ? '🤖' : '🃏')}</span>
                </div>
                <span className="mmx-slot-name">{p.name}</span>
                <span className="mmx-slot-tag">
                  {isMe ? 'KAMU' : p.isBot ? 'BOT' : p.isHost ? 'HOST' : 'SIAP'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mmx-count-line">
          <Swords size={15} />
          <span>
            <strong>{players.length}</strong> pemain di meja &bull; maks. {seatTarget}
          </span>
        </div>

        {/* Host Controls: Add individual bot or Start immediately */}
        {isHost && (
          <div className="mmx-host-controls">
            {players.length < seatTarget && onAddBot && (
              <button
                type="button"
                className="mmx-btn mmx-btn-cyan"
                onClick={onAddBot}
                title="Tambahkan 1 Bot ke kursi kosong"
              >
                <Bot size={16} />
                <span>+ Tambah 1 Bot ({players.length}/{seatTarget})</span>
              </button>
            )}

            {players.length >= 2 && onStartGame && (
              <button
                type="button"
                className="mmx-btn mmx-btn-gold"
                onClick={onStartGame}
                title="Mulai permainan sekarang dengan susunan pemain saat ini"
              >
                <Play size={16} fill="currentColor" />
                <span>Mulai Sekarang ({players.length} Pemain)</span>
              </button>
            )}
          </div>
        )}

        {/* Host decision prompt when queue is quiet */}
        {showBotPrompt && (
          <div className="mmx-prompt" role="dialog" aria-label="Pilihan menunggu atau tambah bot">
            <p>
              Belum ada pemain baru bergabung. Anda dapat menambah bot satuan, isi hingga 4 kursi, atau menunggu pemain lain:
            </p>
            <div className="mmx-prompt-actions">
              <button type="button" className="mmx-btn mmx-btn-ghost" onClick={onWaitMore}>
                <Hourglass size={15} />
                <span>Tunggu</span>
              </button>
              {players.length < seatTarget && onAddBot && (
                <button type="button" className="mmx-btn mmx-btn-cyan" onClick={onAddBot}>
                  <Bot size={15} />
                  <span>+ Tambah 1 Bot</span>
                </button>
              )}
              {players.length < minPlayers && onFillBots && (
                <button type="button" className="mmx-btn mmx-btn-gold" onClick={onFillBots}>
                  <Sparkles size={15} />
                  <span>Isi Sampai 4 &amp; Mulai</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mmx-footer">
          <button type="button" className="mmx-btn mmx-btn-cancel" onClick={onLeave}>
            <LogOut size={16} />
            <span>{phase === 'searching' ? 'Batal Cari' : 'Keluar'}</span>
          </button>
          {!isHost && phase === 'searching' && (
            <span className="mmx-footer-hint">Host: pemain yang masuk antrean paling awal</span>
          )}
        </div>
      </div>
    </div>
  );
}
