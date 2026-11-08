import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Home, Award, Sparkles, X } from 'lucide-react';
import { SUIT_SYMBOLS, SUIT_NAMES as SUIT_NAMES_ID } from '../../../engine/constants.js';
import Card from '../../../components/CardView.jsx';
import AvatarDisplay from '../../../components/AvatarDisplay.jsx';
import '../../../styles/animations.css';

export default function GameOver41Modal({
  results,
  onRestart,
  onClose,
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

  const is41Hit = results.reason === '41_hit';
  const isClosedHand = results.reason === 'closed_hand';
  const rankings = results.rankings || [];
  const winner = rankings[0];

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-xl mlbb-gameover-card" style={{ maxWidth: '680px' }}>
        {/* MLBB VICTORY CREST HEADER */}
        <div className="mlbb-victory-header">
          {onClose && (
            <button
              type="button"
              className="mlbb-victory-close-btn"
              onClick={onClose}
              title="Tutup"
            >
              <X size={16} />
            </button>
          )}
          <span className="mlbb-victory-kicker">
            <Sparkles size={11} style={{ display: 'inline', marginRight: '4px' }} />
            REMI 41 ROYAL • BATTLE RESULT
          </span>
          <div className="mlbb-victory-banner-title">
            {is41Hit ? 'PERFECT 41 VICTORY!' : 'MATCH RESULT'}
          </div>
          <div className="mlbb-victory-subtitle">
            {is41Hit
              ? `🎉 ${results.winnerName} mencapai Nilai Sempurna 41 satu kembang!`
              : isClosedHand
              ? `🔒 ${results.closedByName || results.winnerName} menutup kartu! Pemenang: ${results.winnerName}`
              : `📦 Stok Dek Habis! Pemenang Nilai Tertinggi: ${results.winnerName}`}
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* MVP / CHAMPION SPOTLIGHT CARD */}
          {winner && (
            <div className="mlbb-mvp-spotlight">
              <div className="mlbb-mvp-left">
                <div className="mlbb-mvp-avatar-wrap">
                  <span className="mlbb-mvp-crown">👑</span>
                  <AvatarDisplay avatar={winner.avatar} fallback="🃏" size={44} />
                  <span className="mlbb-mvp-ribbon">MVP • JUARA 1</span>
                </div>
                <div className="mlbb-mvp-info">
                  <span className="mlbb-mvp-tag">ROYAL KING • REMI 41</span>
                  <div className="mlbb-mvp-name">
                    <span>{winner.name}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Kembang Terbaik: {SUIT_SYMBOLS[winner.bestSuit]} {SUIT_NAMES_ID[winner.bestSuit]} ({winner.bestSuitScore} pts)
                  </span>
                </div>
              </div>

              <div className="mlbb-mvp-stats">
                <div className="mlbb-mvp-score-pill">
                  SKOR AKHIR: {winner.score > 0 ? `+${winner.score}` : winner.score}
                </div>
              </div>
            </div>
          )}

          {/* PLAYER RANKING BATTLE ROWS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {rankings.map((player, index) => {
              const isWinner = index === 0;
              return (
                <div
                  key={player.id}
                  className={`mlbb-battle-row rank-${index + 1}`}
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
                          fontSize: '1.25rem',
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: isWinner
                            ? '1.5px solid #fbbf24'
                            : '1px solid rgba(148, 163, 184, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <AvatarDisplay avatar={player.avatar} fallback="🤖" />
                      </span>
                      <div>
                        <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem' }}>
                          {isWinner ? '🥇 ' : `#${index + 1} `}
                          {player.name}
                        </div>
                        <span style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                          Kembang Utama: <strong>{SUIT_SYMBOLS[player.bestSuit]} {SUIT_NAMES_ID[player.bestSuit]}</strong> (+{player.bestSuitScore})
                          {player.otherCardsPenalty > 0 ? ` • Penalti Beda Kembang: -${player.otherCardsPenalty}` : ' • Tanpa Penalti!'}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: isWinner
                          ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                          : player.score >= 0
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                        color: isWinner
                          ? '#090d16'
                          : player.score >= 0
                          ? '#34d399'
                          : '#f87171',
                        border: isWinner
                          ? '1px solid #fde68a'
                          : player.score >= 0
                          ? '1px solid rgba(52, 211, 153, 0.4)'
                          : '1px solid rgba(248, 113, 113, 0.4)',
                        padding: '0.28rem 0.78rem',
                        borderRadius: '9999px',
                        fontWeight: 900,
                        fontSize: '0.86rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Skor: {player.score > 0 ? `+${player.score}` : player.score} / 41
                    </div>
                  </div>

                  {/* Show final cards in hand */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.45rem',
                      marginTop: '0.65rem',
                      flexWrap: 'wrap',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    {(player.hand || []).map((c) => {
                      const isBestSuit = c.suit === player.bestSuit;
                      return (
                        <div
                          key={c.id}
                          style={{
                            position: 'relative',
                            opacity: isBestSuit ? 1 : 0.6,
                            transform: isBestSuit ? 'scale(1)' : 'scale(0.94)',
                          }}
                        >
                          <Card card={c} mini />
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '-6px',
                              right: '-4px',
                              fontSize: '0.62rem',
                              fontWeight: 900,
                              padding: '1px 4px',
                              borderRadius: '4px',
                              background: isBestSuit ? '#059669' : '#dc2626',
                              color: '#fff',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            }}
                          >
                            {isBestSuit ? '+' : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MLBB POST-MATCH ACTION FOOTER */}
        <div className="modal-footer mlbb-gameover-footer">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onBackToMenu && (
              <button
                type="button"
                className="mlbb-btn-action mlbb-btn-slate"
                onClick={onBackToMenu}
              >
                <Home size={16} />
                <span>Lobby Utama</span>
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
            <span style={{ color: '#fde68a', fontSize: '0.82rem', fontWeight: 700 }}>
              ⏳ Menunggu Host memulai ronde baru...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
