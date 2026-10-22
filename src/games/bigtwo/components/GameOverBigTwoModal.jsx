import React from 'react';
import { Trophy, RotateCcw, Home, Sparkles } from 'lucide-react';

export default function GameOverBigTwoModal({
  gameState,
  onPlayAgain,
  onRestart,
  onBackToMenu,
  isMultiplayer = false,
  isHost = true,
}) {
  if (!gameState || gameState.gameStatus !== 'GAME_OVER') return null;

  const winnerId = gameState.winner;
  const winnerPlayer = gameState.players.find((p) => p.id === winnerId);
  const rankings = gameState.rankings || [];

  const handleRestartClick = () => {
    if (onPlayAgain) onPlayAgain();
    else if (onRestart) onRestart();
  };

  const handleMenuClick = () => {
    if (onBackToMenu) onBackToMenu();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '600px', width: '92vw' }}>
        {/* Header */}
        <div className="modal-header" style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column' }}>
          <div style={{ fontSize: '3rem', margin: '0.25rem 0' }}>
            {gameState.endReason === 'LAST_CARD_TWO_DISQUALIFICATION' ? '🚫' : '🏆'}
          </div>
          <h2 style={{
            margin: '0 0 0.25rem 0',
            color: gameState.endReason === 'LAST_CARD_TWO_DISQUALIFICATION' ? '#f87171' : '#38bdf8',
            fontSize: '1.5rem',
            fontWeight: 900
          }}>
            {gameState.endReason === 'LAST_CARD_TWO_DISQUALIFICATION'
              ? 'PELANGGARAN: KARTU 2 TERAKHIR!'
              : 'PERMAINAN BIG TWO SELESAI!'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {gameState.endReason === 'LAST_CARD_TWO_DISQUALIFICATION' ? (
              <>
                <strong>{gameState.disqualifiedPlayerName || 'Pemain'}</strong> mengeluarkan kartu 2 sebagai kartu terakhir (dilarang).
                <br />
                Pemenang: <strong style={{ color: '#38bdf8' }}>{winnerPlayer?.name}</strong> (sisa kartu paling sedikit)!
              </>
            ) : (
              <>
                <strong>{winnerPlayer?.name || 'Pemain'}</strong> berhasil menghabiskan seluruh kartunya terlebih dahulu!
              </>
            )}
          </p>
        </div>

        {/* Leaderboard Table */}
        <div className="modal-body" style={{ padding: '1rem 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rankings.map((r, index) => {
              const isWinner = r.isWinner ?? (index === 0 && !r.isDisqualified);
              const isDisqualified = r.isDisqualified;

              return (
                <div
                  key={r.id}
                  style={{
                    background: isDisqualified
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(15, 23, 42, 0.9))'
                      : isWinner
                      ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(15, 23, 42, 0.9))'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: isDisqualified
                      ? '1.5px solid #ef4444'
                      : isWinner
                      ? '1.5px solid #38bdf8'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>
                      {isDisqualified ? '❌' : index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </span>
                    <span style={{ fontSize: '1.25rem' }}>{r.avatar}</span>
                    <div>
                      <strong style={{ color: isDisqualified ? '#f87171' : isWinner ? '#38bdf8' : '#f8fafc', fontSize: '0.95rem' }}>
                        {r.name}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: isDisqualified ? '#fca5a5' : '#94a3b8' }}>
                        {isDisqualified
                          ? 'KALAH (Kartu 2 Terakhir Dilarang)'
                          : isWinner
                          ? (gameState.endReason === 'LAST_CARD_TWO_DISQUALIFICATION'
                              ? `MENANG (Sisa ${r.remainingCards} kartu)`
                              : 'KARTU HABIS (MENANG!)')
                          : `Sisa ${r.remainingCards} kartu`}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {isDisqualified ? (
                      <span style={{ background: '#dc2626', color: '#ffffff', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem' }}>
                        KALAH OTOMATIS ⚠️
                      </span>
                    ) : isWinner ? (
                      <span className="badge-ready" style={{ background: '#0284c7', color: '#ffffff', padding: '0.25rem 0.65rem' }}>
                        PEMENANG 👑
                      </span>
                    ) : (
                      <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>
                        +{r.remainingCards} penalti
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          {(!isMultiplayer || isHost) ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleRestartClick}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #0284c7, #2563eb)', cursor: 'pointer' }}
            >
              <RotateCcw size={16} />
              <span>{isMultiplayer ? 'Main Lagi (Host)' : 'Main Lagi (Play Again)'}</span>
            </button>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem' }}>
              Menunggu Host untuk memulai babak berikutnya...
            </div>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleMenuClick}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            <Home size={16} />
            <span>Menu Utama</span>
          </button>
        </div>
      </div>
    </div>
  );
}
