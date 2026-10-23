import React from 'react';
import { Trophy, RotateCcw, Home, Sparkles, Flame } from 'lucide-react';
import CardView from '../../../components/CardView.jsx';

export default function GameOver41Modal({
  gameState,
  onPlayAgain,
  onRestart,
  onBackToMenu,
  isMultiplayer = false,
  isHost = true,
}) {
  if (!gameState || (gameState.gameStatus !== 'game_over' && gameState.gameStatus !== 'GAME_OVER')) return null;

  const winner = gameState.winner;
  const rankings = gameState.rankings || [];
  const is41Murni = gameState.endReason === '41_MURNI';
  const isBustedKnock = gameState.endReason === 'FAILED_KNOCK' || Boolean(gameState.isBusted);
  const isSuccessfulKnock = gameState.endReason === 'SUCCESSFUL_KNOCK';
  const closerEntry = rankings.find((r) => r.isCloser);

  const handleRestartClick = () => {
    if (onPlayAgain) onPlayAgain();
    else if (onRestart) onRestart();
  };

  const handleMenuClick = () => {
    if (onBackToMenu) onBackToMenu();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '640px', width: '92vw' }}>
        {/* Header */}
        <div className="modal-header" style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column' }}>
          <div style={{ fontSize: '3rem', margin: '0.25rem 0' }}>
            {is41Murni ? '🔥' : isBustedKnock ? '⚠️' : isSuccessfulKnock ? '🛡️' : '🏆'}
          </div>
          <h2 style={{
            margin: '0 0 0.25rem 0',
            color: isBustedKnock ? '#f87171' : '#fbbf24',
            fontSize: '1.5rem',
            fontWeight: 900
          }}>
            {is41Murni
              ? '41 MURNI! KEMENANGAN MUTLAK!'
              : isBustedKnock
              ? 'TUTUP KARTU DILAMPAUI!'
              : isSuccessfulKnock
              ? 'TUTUP KARTU BERHASIL!'
              : 'PERMAINAN KARTU 41 SELESAI'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', maxWidth: '520px' }}>
            {is41Murni
              ? `${winner?.name || 'Pemain'} berhasil mengumpulkan kombinasi 41 poin sempurna!`
              : isBustedKnock
              ? `${closerEntry?.player?.name || 'Pemain'} menutup kartu dengan ${closerEntry?.score} poin, tetapi dilampaui oleh ${winner?.name} (${rankings[0]?.score} poin)! Sesuai aturan, penutup kartu langsung kalah di urutan paling bawah.`
              : isSuccessfulKnock
              ? `${winner?.name || 'Pemain'} menutup kartu dengan ${rankings[0]?.score} poin dan berhasil menang tanpa ada yang melampaui!`
              : `Pemenang: ${winner?.name || 'Pemain'} dengan skor tertinggi!`}
          </p>
        </div>

        {/* Leaderboard Table */}
        <div className="modal-body" style={{ padding: '1rem 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rankings.map((r, index) => {
              const isWinner = index === 0;
              const p = r.player;
              const isBustedCloser = r.isCloser && isBustedKnock;

              return (
                <div
                  key={p.id}
                  style={{
                    background: isBustedCloser
                      ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.18), rgba(15, 23, 42, 0.9))'
                      : isWinner
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(15, 23, 42, 0.9))'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: isBustedCloser
                      ? '1.5px solid #ef4444'
                      : isWinner
                      ? '1.5px solid #fbbf24'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>
                        {isBustedCloser
                          ? '❌'
                          : index === 0
                          ? '🥇'
                          : index === 1
                          ? '🥈'
                          : index === 2
                          ? '🥉'
                          : `#${index + 1}`}
                      </span>
                      <span style={{ fontSize: '1.2rem' }}>{p.avatar}</span>
                      <strong style={{
                        color: isBustedCloser ? '#fca5a5' : isWinner ? '#fbbf24' : '#f8fafc',
                        fontSize: '0.95rem'
                      }}>
                        {p.name}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isBustedCloser && (
                        <span style={{
                          background: '#dc2626',
                          color: '#fff',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          letterSpacing: '0.02em',
                        }}>
                          KALAH TUTUP KARTU (POSISI TERBAWAH)
                        </span>
                      )}
                      {r.isCloser && isSuccessfulKnock && (
                        <span style={{
                          background: '#16a34a',
                          color: '#fff',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}>
                          SUKSES TUTUP KARTU
                        </span>
                      )}
                      {r.is41 && (
                        <span style={{
                          background: '#dc2626',
                          color: '#fff',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}>
                          41 MURNI
                        </span>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '1.1rem',
                          fontWeight: 900,
                          color: isBustedCloser ? '#f87171' : isWinner ? '#fbbf24' : '#e2e8f0',
                        }}>
                          {r.score} poin
                        </span>
                        {r.evaluation?.formula && (
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>
                            {r.bestSuit} • {r.evaluation.formula}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cards Display */}
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
                    {r.hand.map((card, cIdx) => (
                      <div key={card.id || cIdx} style={{ transform: 'scale(0.85)', transformOrigin: 'top left' }}>
                        <CardView card={card} mini />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ justifyContent: 'center', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-header" onClick={handleMenuClick} style={{ cursor: 'pointer' }}>
            <Home size={15} />
            <span>Menu Utama</span>
          </button>
          {(!isMultiplayer || isHost) ? (
            <button className="btn-header btn-gold" onClick={handleRestartClick} style={{ cursor: 'pointer' }}>
              <RotateCcw size={15} />
              <span>{isMultiplayer ? 'Main Lagi (Host)' : 'Kocok Ulang & Main Lagi'}</span>
            </button>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem' }}>
              Menunggu Host untuk memulai babak berikutnya...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
