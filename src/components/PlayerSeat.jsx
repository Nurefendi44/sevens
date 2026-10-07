import React from 'react';

export default function PlayerSeat({
  player,
  isTurn = false,
  cardCount = 0,
  closedCount = 0,
  faultCount = 0,
}) {
  return (
    <div className={`player-seat ${isTurn ? 'active-turn' : ''}`}>
      <div className="seat-header">
        <div className="player-avatar">{player.avatar}</div>
        <div className="player-info">
          <div className="player-name">
            {player.name}
          </div>
          {isTurn ? (
            <div className="turn-pulse-indicator">
              <span className="turn-dot" />
              <span>Giliran Bermain</span>
            </div>
          ) : (
            <span className="player-role-badge">Menunggu</span>
          )}
        </div>
      </div>

      <div className="seat-stats">
        <div className="stat-pill" title="Jumlah sisa kartu di tangan">
          <span className="stat-label">Kartu</span>
          <span className="stat-value">{cardCount}</span>
        </div>
        <div className="stat-pill" title="Jumlah kartu yang ditutup (Closed)">
          <span className="stat-label">Tutup</span>
          <span className={`stat-value ${closedCount > 0 ? 'warning' : ''}`}>{closedCount}</span>
        </div>
        <div className="stat-pill" title="Pelanggaran FAULT">
          <span className="stat-label">Fault</span>
          <span className={`stat-value ${faultCount > 0 ? 'danger' : ''}`}>{faultCount}</span>
        </div>
      </div>
    </div>
  );
}
