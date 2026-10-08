import React from 'react';
import { Trophy, RotateCcw, Home, Sparkles, Flame } from 'lucide-react';
import CardView from '../../../components/CardView.jsx';

export default function GameOver41Modal({
  gameState,
  onPlayAgain,
  onBackToMenu,
}) {
  if (!gameState || gameState.gameStatus !== 'game_over') return null;

  const winner = gameState.winner;
  const rankings = gameState.rankings || [];
  const is41Murni = gameState.endReason === '41_MURNI';

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '640px', width: '92vw' }}>
        {/* Header */}
        <div className="modal-header" style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column' }}>
          <div style={{ fontSize: '3rem', margin: '0.25rem 0' }}>
            {is41Murni ? '🔥' : '🏆'}
          </div>
          <h2 style={{ margin: '0 0 0.25rem 0', color: '#fbbf24', fontSize: '1.5rem', fontWeight: 900 }}>
            {is41Murni ? '41 MURNI! KEMENANGAN MUTLAK!' : 'PERMAINAN KARTU 41 SELESAI'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {is41Murni
              ? `${winner?.name || 'Pemain'} berhasil mengumpulkan kombinasi 41 poin sempurna!`
              : `Pemenang: ${winner?.name || 'Pemain'} dengan skor tertinggi!`}
          </p>
        </div>

        {/* Leaderboard Table */}
        <div className="modal-body" style={{ padding: '1rem 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rankings.map((r, index) => {
              const isWinner = index === 0;
              const p = r.player;

              return (
                <div
                  key={p.id}
                  style={{
                    background: isWinner
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(15, 23, 42, 0.9))'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: isWinner ? '1.5px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.1)',
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
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
                      <span style={{ fontSize: '1.2rem' }}>{p.avatar}</span>
                      <strong style={{ color: isWinner ? '#fbbf24' : '#f8fafc', fontSize: '0.95rem' }}>
                        {p.name}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                      <span style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        color: isWinner ? '#fbbf24' : '#e2e8f0',
                      }}>
                        {r.score} poin
                      </span>
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
        <div className="modal-footer" style={{ justifyContent: 'center', gap: '1rem' }}>
          <button className="btn-header" onClick={onBackToMenu}>
            <Home size={15} />
            <span>Pilihan Game</span>
          </button>
          <button className="btn-header btn-gold" onClick={onPlayAgain}>
            <RotateCcw size={15} />
            <span>Kocok Ulang & Main Lagi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
