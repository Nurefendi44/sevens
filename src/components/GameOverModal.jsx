import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw } from 'lucide-react';

export default function GameOverModal({
  gameState,
  onRestart,
  isMultiplayer = false,
  isHost = true,
}) {
  const { scores = {}, players = [], winners = [] } = gameState;

  useEffect(() => {
    // Fire celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // Ignore in non-browser env
    }
  }, []);

  // Sort players by totalScore descending (highest score / least negative points wins)
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = scores[a.id]?.totalScore ?? -999;
    const scoreB = scores[b.id]?.totalScore ?? -999;
    return scoreB - scoreA;
  });

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '780px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy color="#fbbf24" size={24} />
            <h2 className="modal-title">PERMAINAN SELESAI</h2>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Turn ke-{gameState.turnNumber}
          </span>
        </div>

        <div className="modal-body">
          {/* Podium Top 3 */}
          <div className="podium-container">
            {sortedPlayers.map((player, idx) => {
              const pScore = scores[player.id];
              const isWinner = winners.includes(player.id);

              return (
                <div
                  key={player.id}
                  className={`podium-seat ${isWinner ? 'winner' : ''}`}
                >
                  {isWinner && <div className="winner-crown">👑</div>}
                  <div style={{ fontSize: '1.75rem' }}>{player.avatar}</div>
                  <div style={{ fontWeight: 800, marginTop: '4px', fontSize: '0.9rem' }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Peringkat #{idx + 1}
                  </div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      fontFamily: 'var(--font-mono)',
                      color: isWinner ? '#fbbf24' : 'var(--text-primary)',
                      marginTop: '6px',
                    }}
                  >
                    {pScore?.totalScore ?? 0}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Score Breakdown Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
              📊 Rincian Skor & Penalti
            </h3>

            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '8px 12px' }}>Pemain</th>
                    <th style={{ padding: '8px 12px' }}>Kartu Ditutup (Base)</th>
                    <th style={{ padding: '8px 12px' }}>Penalti Rule 6 (6 & 8)</th>
                    <th style={{ padding: '8px 12px' }}>Penalti FAULT</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player) => {
                    const pScore = scores[player.id];
                    if (!pScore) return null;

                    return (
                      <tr key={player.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                          <span style={{ marginRight: '6px' }}>{player.avatar}</span>
                          {player.name}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {pScore.baseClosedScore}
                            </span>
                            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                              ({pScore.closedCardsCount} kartu)
                            </span>
                          </div>
                          {pScore.closedCards?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                              {pScore.closedCards.map((it, cIdx) => (
                                <span
                                  key={cIdx}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                  }}
                                >
                                  {it.card.label}{it.card.symbol} ({it.penalty})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: pScore.rule6PenaltyScore < 0 ? '#f87171' : 'inherit',
                            }}
                          >
                            {pScore.rule6PenaltyScore}
                          </span>
                          {pScore.rule6Details?.map((r6, rIdx) => (
                            <div key={rIdx} style={{ fontSize: '0.675rem', color: '#fca5a5', marginTop: '2px' }}>
                              • {r6.card.label}{r6.card.symbol}: {r6.amount} ({r6.reason})
                            </div>
                          ))}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: pScore.faultScore < 0 ? '#ef4444' : 'inherit',
                            }}
                          >
                            {pScore.faultScore}
                          </span>
                          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                            ({pScore.faultsCount}x)
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '1rem',
                            fontWeight: 900,
                            color: pScore.totalScore >= 0 ? '#34d399' : '#f87171',
                          }}
                        >
                          {pScore.totalScore}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {(!isMultiplayer || isHost) ? (
            <button className="btn-header btn-gold" onClick={onRestart}>
              <RotateCcw size={16} />
              <span>{isMultiplayer ? 'Kocok Ulang & Main Lagi (Host)' : 'Kocok Ulang & Main Lagi'}</span>
            </button>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              Menunggu Host untuk memulai babak berikutnya...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
