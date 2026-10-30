import React, { useEffect, useState } from 'react';
import { Crown, LogOut, Bot, Hourglass, Swords, Radar } from 'lucide-react';
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
  onLeave,
  roomCode,
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
          <span className="mmx-room-chip">Room {roomCode}</span>
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
                <div className="mmx-slot-avatar">
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

        {/* Host decision: wait or add bots */}
        {showBotPrompt && (
          <div className="mmx-prompt" role="dialog" aria-label="Pilihan menunggu atau tambah bot">
            <p>
              Belum ada pemain baru. Mau menunggu atau isi{' '}
              <strong>{Math.max(minPlayers - players.length, 0)} kursi</strong> dengan bot?
            </p>
            <div className="mmx-prompt-actions">
              <button type="button" className="mmx-btn mmx-btn-ghost" onClick={onWaitMore}>
                <Hourglass size={16} />
                <span>Tunggu</span>
              </button>
              <button type="button" className="mmx-btn mmx-btn-gold" onClick={onFillBots}>
                <Bot size={16} />
                <span>Tambah Bot &amp; Mulai</span>
              </button>
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
