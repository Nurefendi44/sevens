import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Award, X, Sparkles } from 'lucide-react';
import { SUIT_SYMBOLS } from '../engine/constants.js';
import '../styles/animations.css';

export default function GameOverModal({
  results,
  onRestart,
  onClose,
  isHost = true,
  isMultiplayer = false,
  onOpenScoreboard,
}) {
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
                  <span>{winner.avatar || '🧙‍♂️'}</span>
                  <span className="mlbb-mvp-ribbon">MVP • JUARA 1</span>
                </div>
                <div className="mlbb-mvp-info">
                  <span className="mlbb-mvp-tag">MYTHIC SOVEREIGN</span>
                  <div className="mlbb-mvp-name">
                    <span>{winner.name}</span>
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
                <div style={{ fontSize: '1.75rem' }}>{player.avatar}</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>
                  {player.name}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{r.avatar}</span>
                        <span style={{ fontWeight: 700 }}>{r.name}</span>
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
      </div>
    </div>
  );
}
