import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Home, Award, Sparkles, X } from 'lucide-react';
import Card from '../../../components/CardView.jsx';
import '../../../styles/animations.css';

export default function GameOverBigTwoModal({
  results,
  onRestart,
  onBackToMenu,
  onOpenScoreboard,
  isHost = true,
  isMultiplayer = false,
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

  if (!results) return null;

  const rankings = results.rankings || [];
  const winner = rankings[0];

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-xl mlbb-gameover-card" style={{ maxWidth: '720px' }}>
        {/* MLBB VICTORY CREST HEADER */}
        <div className="mlbb-victory-header">
          {onOpenScoreboard && (
            <button
              type="button"
              className="mlbb-victory-close-btn"
              onClick={onBackToMenu}
              title="Kembali ke Lobby"
            >
              <X size={16} />
            </button>
          )}
          <span className="mlbb-victory-kicker">
            <Sparkles size={11} style={{ display: 'inline', marginRight: '4px' }} />
            IMPERIAL BIG TWO • BATTLE RESULT
          </span>
          <div className="mlbb-victory-banner-title">VICTORY</div>
          <div className="mlbb-victory-subtitle">
            Urutan Kemenangan & Poin Klasemen Capsa Banting
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
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
                  <span className="mlbb-mvp-tag">SUPREME COMMANDER</span>
                  <div className="mlbb-mvp-name">
                    <span>{winner.name}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Berhasil menghabiskan seluruh kartu pertama kali!
                  </span>
                </div>
              </div>

              <div className="mlbb-mvp-stats">
                <div className="mlbb-mvp-score-pill">
                  +{winner.pointsEarned !== undefined ? winner.pointsEarned : 3} ★ POIN
                </div>
              </div>
            </div>
          )}

          {/* RANKING BATTLE ROWS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {rankings.map((player) => {
              const isFirst = player.rank === 1;
              const isSecond = player.rank === 2;
              const isThird = player.rank === 3;
              const rankBadge = isFirst
                ? '🥇 JUARA 1'
                : isSecond
                ? '🥈 JUARA 2'
                : isThird
                ? '🥉 JUARA 3'
                : `PERINGKAT ${player.rank}`;

              const pointsEarned =
                player.pointsEarned !== undefined
                  ? player.pointsEarned
                  : isFirst
                  ? 3
                  : isSecond
                  ? 2
                  : isThird
                  ? 1
                  : 0;

              return (
                <div
                  key={player.id}
                  className={`mlbb-battle-row rank-${player.rank}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span
                        style={{
                          fontSize: '1.3rem',
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: isFirst
                            ? '1.5px solid #fbbf24'
                            : '1px solid rgba(148, 163, 184, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {player.avatar || '🤖'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem' }}>
                          {player.name}
                        </div>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            color: isFirst
                              ? '#fbbf24'
                              : isSecond
                              ? '#38bdf8'
                              : isThird
                              ? '#f59e0b'
                              : '#94a3b8',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {rankBadge}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 900,
                          padding: '0.24rem 0.65rem',
                          borderRadius: '999px',
                          background:
                            pointsEarned > 0
                              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(180, 83, 9, 0.2))'
                              : 'rgba(100, 116, 139, 0.2)',
                          color: pointsEarned > 0 ? '#fde047' : '#94a3b8',
                          border:
                            pointsEarned > 0
                              ? '1px solid rgba(250, 204, 21, 0.5)'
                              : '1px solid rgba(148, 163, 184, 0.2)',
                        }}
                      >
                        +{pointsEarned} Poin
                      </span>

                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          padding: '0.24rem 0.65rem',
                          borderRadius: '999px',
                          background:
                            player.remainingCount === 0
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(239, 68, 68, 0.16)',
                          color: player.remainingCount === 0 ? '#34d399' : '#fca5a5',
                          border:
                            player.remainingCount === 0
                              ? '1px solid rgba(52, 211, 153, 0.4)'
                              : '1px solid rgba(248, 113, 113, 0.35)',
                        }}
                      >
                        {player.remainingCount === 0
                          ? '✨ Kartu Habis!'
                          : `Sisa ${player.remainingCount} Kartu`}
                      </span>
                    </div>
                  </div>

                  {/* Show remaining cards for players who didn't finish */}
                  {player.remainingCards && player.remainingCards.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.35rem',
                        marginTop: '0.6rem',
                        flexWrap: 'wrap',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {player.remainingCards.map((c, idx) => (
                        <Card key={c.id || idx} card={c} mini />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MLBB POST-MATCH ACTION FOOTER */}
        <div className="modal-footer mlbb-gameover-footer">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="mlbb-btn-action mlbb-btn-slate"
              onClick={onBackToMenu}
            >
              <Home size={16} />
              <span>Lobby Utama</span>
            </button>

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
            <span style={{ color: '#fde68a', fontSize: '0.82rem', fontWeight: 700 }}>
              ⏳ Menunggu Host memulai ronde baru...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
