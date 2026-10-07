import React from 'react';

export default function CardView({
  card,
  isSelected = false,
  mini = false,
  faceDown = false,
  onClick,
  style = {},
  title,
}) {
  if (faceDown) {
    return (
      <div
        className={`card-back ${mini ? 'mini' : ''}`}
        style={style}
        title={title || 'Kartu Tertutup'}
      />
    );
  }

  if (!card) return null;

  const suitClass = `suit-${card.suit}`;
  const rankClass = `rank-${card.rank}`;
  const stateClasses = [
    isSelected ? 'selected' : '',
    mini ? 'mini' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`playing-card ${suitClass} ${rankClass} ${stateClasses}`}
      style={style}
      onClick={onClick}
      title={title || `${card.label} ${card.symbol} (${card.suit})`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Top Left Corner */}
      <div className="card-corner top-left">
        <span className="card-rank">{card.label}</span>
        <span className="card-suit-mini">{card.symbol}</span>
      </div>

      {/* Center Big Suit Emblem */}
      <div className="card-center">
        <span className="card-suit-big">{card.symbol}</span>
      </div>

      {/* Bottom Right Corner */}
      <div className="card-corner bottom-right">
        <span className="card-rank">{card.label}</span>
        <span className="card-suit-mini">{card.symbol}</span>
      </div>
    </div>
  );
}
