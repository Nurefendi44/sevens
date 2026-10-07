import React from 'react';
import CardView from './CardView.jsx';
import { cardEquals } from '../engine/deck.js';
import { ArrowUpDown } from 'lucide-react';

export default function PlayerHand({
  player,
  hand = [],
  selectedCard,
  onSelectCard,
  onPlayCard,
  onCloseCard,
  sortBy = 'suit',
  onToggleSort,
  isCurrentTurn = false,
}) {
  const isSelectedInHand = selectedCard && hand.some(c => cardEquals(c, selectedCard));

  return (
    <div className="player-tray">
      {/* Tray Header */}
      <div className="tray-header">
        <div className="tray-title-group">
          <div className="tray-player-badge">
            <span style={{ fontSize: '1.25rem' }}>{player.avatar}</span>
            <span>{player.name}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              ({hand.length} kartu)
            </span>
          </div>
        </div>

        {/* Card Sorting Toggle */}
        <div className="tray-toggles">
          <button
            className="toggle-chip"
            onClick={onToggleSort}
            title="Urutkan kartu berdasarkan Suit (simbol) atau Rank (angka)"
          >
            <ArrowUpDown size={13} />
            <span>Urut: {sortBy === 'suit' ? 'Suit' : 'Rank'}</span>
          </button>
        </div>
      </div>

      {/* Cards Fan / Row - All cards visually equal, NO hints */}
      <div className="hand-cards-container">
        {hand.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1.5rem' }}>
            Tangan kosong. Semua kartu telah dimainkan atau ditutup.
          </div>
        ) : (
          hand.map((card) => {
            const isSelected = cardEquals(selectedCard, card);

            return (
              <CardView
                key={card.id}
                card={card}
                isSelected={isSelected}
                onClick={() => onSelectCard(card)}
              />
            );
          })
        )}
      </div>

      {/* Action Controls Bar */}
      <div className="action-controls-bar">
        <div className="action-status-indicator">
          {isCurrentTurn ? (
            <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              Giliran Anda. Pilih kartu dari tangan Anda untuk dimainkan atau ditutup.
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Menunggu giliran pemain lain...
            </div>
          )}
        </div>

        <div className="action-buttons-group">
          {/* Play Card Button */}
          <button
            className="btn-action btn-play"
            disabled={!isCurrentTurn || !isSelectedInHand}
            onClick={() => selectedCard && onPlayCard(selectedCard)}
          >
            <span>Mainkan</span>
            {selectedCard && isSelectedInHand && (
              <span style={{ fontWeight: 800 }}>({selectedCard.label}{selectedCard.symbol})</span>
            )}
          </button>

          {/* Close Card Button */}
          <button
            className="btn-action btn-close-card"
            disabled={!isCurrentTurn || !isSelectedInHand}
            onClick={() => selectedCard && onCloseCard(selectedCard)}
          >
            <span>Tutup Kartu (Close)</span>
            {selectedCard && isSelectedInHand && (
              <span style={{ fontWeight: 800 }}>({selectedCard.label}{selectedCard.symbol})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
