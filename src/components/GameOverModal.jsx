import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Award, X, Sparkles } from 'lucide-react';
import { SUIT_SYMBOLS } from '../engine/constants.js';
import AvatarDisplay from './AvatarDisplay.jsx';
import { resolvePlayerAvatar, getLocalPlayerProfile } from '../services/leaderboardService.js';
import { removeFriend } from '../services/friendService.js';
import FriendActionButton, { FriendUnfriendModal } from './FriendActionButton.jsx';
import '../styles/animations.css';
import '../styles/friendsModal.css';

export default function GameOverModal({
  results,
  onRestart,
  onClose,
  isHost = true,
  isMultiplayer = false,
  onOpenScoreboard,
  myPlayerId = null,
  myPlayerName = null,
}) {
  const localProfile = useMemo(() => getLocalPlayerProfile(), []);
  const effectiveMyName = myPlayerName || localProfile?.name || '';
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [friendToast, setFriendToast] = useState(null);

  const showToast = (msg) => {
    setFriendToast(msg);
    setTimeout(() => setFriendToast(null), 3000);
  };

  const isPlayerMe = (p) => {
    if (!p) return false;
    if (myPlayerId && p.id && p.id === myPlayerId) return true;
    if (!isMultiplayer && (p.isHuman || p.isLocalPlayer)) return true;
    const pName = String(p.name || '').trim().toLowerCase();
    const myName = String(effectiveMyName || '').trim().toLowerCase();
    return Boolean(pName && myName && pName === myName);
  };

  const isPlayerBot = (p) => {
    if (!p) return false;
    if (p.isBot) return true;
    const pInResults = (results?.players || []).find((pl) => pl.id === p.id);
    if (pInResults?.isBot) return true;
    const name = String(p.name || '').trim().toLowerCase();
    return name.startsWith('bot') || name.startsWith('ai_') || name.startsWith('ai ');
  };
  useEffect(() => {
    try {
      confetti({
        particleCount: 95,
        spread: 75,
        origin: { y: 0.55 },
        colors: ['#fbbf24', '#f59e0b', '#38bdf8', '#10b981'],
      });
    } catch {
      // Ignore confetti error in test environment
    }
  }, []);

  if (!results || !results.rankings) return null;

  const { rankings, aceDirectionUsed } = results;
  const winner = rankings[0];

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-xl mlbb-gameover-card">
        {/* MLBB VICTORY CREST HEADER */}
        <div className="mlbb-victory-header">
          {onClose && (
            <button
              type="button"
              className="mlbb-victory-close-btn"
              onClick={onClose}
              title="Tutup dan lihat meja"
            >
              <X size={16} />
            </button>
          )}
          <span className="mlbb-victory-kicker">
            <Sparkles size={11} style={{ display: 'inline', marginRight: '4px' }} />
            SEVENS ROYAL • BATTLE RESULT
          </span>
          <div className="mlbb-victory-banner-title">VICTORY</div>
          <div className="mlbb-victory-subtitle">
            Klasemen Akhir & Rekapitulasi Poin Tujuh Sekop
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          {/* MVP / CHAMPION SPOTLIGHT CARD */}
          {winner && (
            <div className="mlbb-mvp-spotlight">
              <div className="mlbb-mvp-left">
                <div className="mlbb-mvp-avatar-wrap">
                  <span className="mlbb-mvp-crown">👑</span>
                  <AvatarDisplay
                    avatar={resolvePlayerAvatar(winner, '🧙‍♂️')}
                    fallback="🧙‍♂️"
                    size={44}
                    playerName={winner.name}
                  />
                  <span className="mlbb-mvp-ribbon">MVP • JUARA 1</span>
                </div>
                <div className="mlbb-mvp-info">
                  <span className="mlbb-mvp-tag">ROYAL KING • TUJUH SEKOP</span>
                  <div className="mlbb-mvp-name" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <span>{winner.name}</span>
                    {!isPlayerMe(winner) && !isPlayerBot(winner) && (
                      <FriendActionButton
                        targetPlayer={winner}
                        myUsername={effectiveMyName}
                        myProfile={localProfile}
                        onStatusChange={showToast}
                        onRequestUnfriend={setFriendToDelete}
                        size="sm"
                      />
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Poin Kartu Tertutup: {winner.closedCardsPoints} • Penalti 6&8: +{winner.faultBonusTotal}
                  </span>
                </div>
              </div>

              <div className="mlbb-mvp-stats">
                <div className="mlbb-mvp-score-pill">
                  TOTAL SKOR: {winner.finalScore > 0 ? `+${winner.finalScore}` : winner.finalScore}
                </div>
              </div>
            </div>
          )}

          {/* PODIUM TOP 3 */}
          <div className="podium-container">
            {rankings.slice(0, 3).map((player, idx) => (
              <div
                key={player.id}
                className={`podium-seat ${idx === 0 ? 'first-place' : ''}`}
                style={{
                  background:
                    idx === 0
                      ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.22) 0%, rgba(15, 23, 42, 0.92) 100%)'
                      : 'rgba(15, 23, 42, 0.8)',
                  borderColor:
                    idx === 0
                      ? 'rgba(251, 191, 36, 0.65)'
                      : 'rgba(148, 163, 184, 0.25)',
                }}
              >
                {idx === 0 && <div className="winner-crown">👑</div>}
                <div className={`rank-medal rank-${idx + 1}`}>{player.rank}</div>
                <div style={{ fontSize: '1.75rem', display: 'flex', justifyContent: 'center' }}>
                  <AvatarDisplay
                    avatar={resolvePlayerAvatar(player, '👤')}
                    fallback="👤"
                    size={36}
                    playerName={player.name}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>
                    {player.name}
                  </span>
                  {isPlayerMe(player) && (
                    <span className="mlbb-you-chip" style={{ fontSize: '0.58rem', padding: '0.06rem 0.35rem' }}>
                      KAMU
                    </span>
                  )}
                  {!isPlayerMe(player) && !isPlayerBot(player) && (
                    <FriendActionButton
                      targetPlayer={player}
                      myUsername={effectiveMyName}
                      myProfile={localProfile}
                      onStatusChange={showToast}
                      onRequestUnfriend={setFriendToDelete}
                      size="sm"
                    />
                  )}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    color:
                      player.finalScore >= 0
                        ? '#34d399'
                        : '#f87171',
                  }}
                >
                  {player.finalScore > 0 ? `+${player.finalScore}` : player.finalScore} pts
                </div>
              </div>
            ))}
          </div>

          {/* Global Ace Direction Indicator */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.78)',
              padding: '0.6rem 1rem',
              borderRadius: '10px',
              border: '1px solid rgba(251, 191, 36, 0.28)',
              fontSize: '0.8rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.4rem',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              Aturan Penilaian Kartu As (Tertutup):
            </span>
            <strong style={{ color: '#fbbf24' }}>
              {aceDirectionUsed === 'top'
                ? '⬆️ Rangkai Atas Terkunci (As = -11 Poin)'
                : '⬇️ Rangkai Bawah / Default (As = -1 Poin)'}
            </strong>
          </div>

          {/* Detailed Score Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="score-breakdown-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pemain</th>
                  <th>Kartu Tertutup</th>
                  <th>Poin Kartu</th>
                  <th>Bonus & Penalti (6 & 8)</th>
                  <th>Skor Akhir</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800, color: r.rank === 1 ? '#fbbf24' : 'inherit' }}>
                      #{r.rank}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <AvatarDisplay
                          avatar={resolvePlayerAvatar(r, '👤')}
                          fallback="👤"
                          size={22}
                          playerName={r.name}
                        />
                        <span style={{ fontWeight: 700 }}>{r.name}</span>
                        {isPlayerMe(r) && (
                          <span className="mlbb-you-chip" style={{ fontSize: '0.55rem', padding: '0.04rem 0.3rem' }}>
                            KAMU
                          </span>
                        )}
                        {!isPlayerMe(r) && !isPlayerBot(r) && (
                          <FriendActionButton
                            targetPlayer={r}
                            myUsername={effectiveMyName}
                            myProfile={localProfile}
                            onStatusChange={showToast}
                            onRequestUnfriend={setFriendToDelete}
                            size="sm"
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      {r.closedCardDetails.length === 0 ? (
                        <span style={{ color: 'var(--color-success)', fontSize: '0.75rem', fontWeight: 700 }}>
                          ✨ Bersih (0 kartu)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {r.closedCardDetails.map((c) => (
                            <span
                              key={c.id}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 5px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                fontFamily: 'var(--font-mono)',
                              }}
                              title={`Nilai poin: ${c.pointValue}`}
                            >
                              {c.label}
                              {SUIT_SYMBOLS[c.suit]} ({c.pointValue})
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: r.closedCardsPoints < 0 ? 'var(--color-danger)' : 'var(--text-primary)',
                      }}
                    >
                      {r.closedCardsPoints}
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color:
                          r.faultBonusTotal > 0
                            ? 'var(--color-success)'
                            : r.faultBonusTotal < 0
                            ? 'var(--color-danger)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {r.faultBonusTotal > 0 ? `+${r.faultBonusTotal}` : r.faultBonusTotal}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        ({r.faultCount}x fault)
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 900,
                        fontSize: '0.95rem',
                        color: r.finalScore >= 0 ? 'var(--color-success)' : '#f87171',
                      }}
                    >
                      {r.finalScore > 0 ? `+${r.finalScore}` : r.finalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MLBB POST-MATCH ACTION FOOTER */}
        <div className="modal-footer mlbb-gameover-footer">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onClose && (
              <button
                type="button"
                className="mlbb-btn-action mlbb-btn-slate"
                onClick={onClose}
              >
                <span>Lihat Papan Meja</span>
              </button>
            )}
            {onOpenScoreboard && (
              <button
                type="button"
                className="mlbb-btn-action mlbb-btn-cyan"
                onClick={onOpenScoreboard}
              >
                <Award size={16} />
                <span>Top Global & Skor</span>
              </button>
            )}
          </div>

          {!isMultiplayer || isHost ? (
            <button
              type="button"
              className="mlbb-btn-action mlbb-btn-gold"
              onClick={onRestart}
            >
              <RotateCcw size={16} />
              <span>Main Lagi (Ronde Baru)</span>
            </button>
          ) : (
            <span style={{ fontSize: '0.82rem', color: '#fde68a', fontWeight: 700 }}>
              ⏳ Menunggu Host memulai ronde baru...
            </span>
          )}
        </div>

        {/* Friend Action Toast */}
        {friendToast && (
          <div className="victory-friend-toast">
            <Sparkles size={13} color="#fde047" />
            <span>{friendToast}</span>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Pertemanan */}
        {friendToDelete && (
          <FriendUnfriendModal
            friendToDelete={friendToDelete}
            onClose={() => setFriendToDelete(null)}
            onConfirm={async () => {
              await removeFriend(effectiveMyName, friendToDelete.name);
              setFriendToDelete(null);
              showToast(`Pertemanan dengan ${friendToDelete.name} telah dihapus.`);
            }}
          />
        )}
      </div>
    </div>
  );
}
