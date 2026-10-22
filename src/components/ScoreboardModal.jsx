import React from 'react';
import { X, Trophy, RotateCcw } from 'lucide-react';
import '../styles/scoreboardModal.css';

export default function ScoreboardModal({
  isOpen,
  onClose,
  scoreboardData = [],
  onResetScoreboard,
  activeGameTitle = 'Game Info',
}) {
  if (!isOpen) return null;

  // Sort by score descending, then by games played descending
  const sortedScores = [...scoreboardData].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.games - a.games;
  });

  return (
    <div className="scoreboard-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="scoreboard-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="scoreboard-modal-header">
          <h2 className="scoreboard-modal-title">{activeGameTitle || 'Game Info'}</h2>
          <button
            type="button"
            className="scoreboard-btn-close"
            onClick={onClose}
            aria-label="Tutup Scoreboard"
          >
            <X size={20} />
          </button>
        </div>

        {/* Section Header: Trophy + Scoreboard */}
        <div className="scoreboard-section-title-wrap">
          <span className="scoreboard-trophy-icon">🏆</span>
          <h3 className="scoreboard-section-title">Scoreboard</h3>
        </div>

        {/* Scoreboard Table */}
        <div className="scoreboard-table-container">
          <table className="scoreboard-table">
            <thead>
              <tr>
                <th className="col-rank">RANK</th>
                <th className="col-name">NAME</th>
                <th className="col-games">GAMES *</th>
                <th className="col-score">SCORE</th>
              </tr>
            </thead>
            <tbody>
              {sortedScores.length > 0 ? (
                sortedScores.map((item, index) => {
                  const rankNumber = index + 1;
                  return (
                    <tr key={item.id || item.name || index} className={`rank-row rank-${rankNumber}`}>
                      <td className="col-rank">
                        <span className="rank-badge">{rankNumber}</span>
                      </td>
                      <td className="col-name">
                        <div className="player-name-cell">
                          {item.avatar && <span className="player-avatar">{item.avatar}</span>}
                          <span className="player-name-text">{item.name}</span>
                        </div>
                      </td>
                      <td className="col-games">{item.games || 0}</td>
                      <td className="col-score">
                        <strong className="score-value">{item.score || 0}</strong>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="empty-scoreboard-cell">
                    Belum ada riwayat permainan yang tercatat di sesi ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & optional reset */}
        <div className="scoreboard-modal-footer">
          <span className="scoreboard-footnote">* Total ronde / permainan yang telah dimainkan</span>
          {onResetScoreboard && (
            <button
              type="button"
              className="btn-reset-scoreboard"
              onClick={onResetScoreboard}
              title="Reset Akumulasi Skor"
            >
              <RotateCcw size={13} />
              <span>Reset Skor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
