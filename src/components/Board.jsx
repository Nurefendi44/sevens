import React from 'react';
import CardView from './CardView.jsx';
import { SUITS, SUIT_SYMBOLS, RANKS, RANK_LABELS } from '../engine/constants.js';

export default function Board({ board, globalAceDirection }) {
  const suitList = [SUITS.SPADES, SUITS.HEARTS, SUITS.DIAMONDS, SUITS.CLUBS];

  return (
    <div className="board-container">
      {suitList.map((suit) => {
        const suitBoard = board[suit] || {
          isOpen: false,
          minRank: null,
          maxRank: null,
          playedCards: [],
          isCompleted: false,
          closedAt: null,
        };
        const playedMap = new Map();
        (suitBoard.playedCards || []).forEach(card => {
          playedMap.set(card.rank, card);
        });

        // Determine ranks order based on closure direction
        // If top-closed or global top: A is at the end (after K)
        // If bottom-closed or global bottom: A is at the beginning (before 2)
        const isTopOriented = suitBoard.closedAt === 'top' || (globalAceDirection === 'top' && suitBoard.closedAt !== 'bottom');
        const displayRanks = isTopOriented
          ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1]
          : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

        return (
          <div
            key={suit}
            className={`board-suit-row ${suitBoard.isCompleted ? 'suit-completed-row' : ''}`}
          >
            {/* Suit Header */}
            <div className="suit-header-badge">
              <span className={`suit-icon ${suit}`}>{SUIT_SYMBOLS[suit]}</span>
              <span className="suit-name-text">
                {suit === SUITS.SPADES
                  ? 'Sekop'
                  : suit === SUITS.HEARTS
                  ? 'Hati'
                  : suit === SUITS.DIAMONDS
                  ? 'Wajik'
                  : 'Keriting'}
              </span>
              {suitBoard.isCompleted && (
                <span
                  className="suit-completion-tag"
                  title={`Rangkaian ${suit} telah ditutup dengan As. Tidak dapat ditambah lagi.`}
                >
                  {suitBoard.closedAt === 'top' ? '🔒 Tutup Atas' : '🔒 Tutup Bawah'}
                </span>
              )}
            </div>

            {/* 13 Slots */}
            <div className="suit-slots-track">
              {displayRanks.map((rank) => {
                const playedCard = playedMap.get(rank);
                const isCenterSeven = rank === 7;
                const isAce = rank === 1;

                if (playedCard) {
                  return (
                    <div
                      key={rank}
                      className={`board-card-slot slot-occupied ${isAce ? 'slot-ace-capping' : ''}`}
                      title={isAce ? `As penutup rangkaian (${suitBoard.closedAt === 'top' ? 'Tutup Atas' : 'Tutup Bawah'})` : undefined}
                    >
                      <CardView card={playedCard} mini />
                    </div>
                  );
                }

                // If suit is completed and this rank was never played, it is permanently blocked/disabled!
                const isBlocked = suitBoard.isCompleted && !playedCard;

                return (
                  <div
                    key={rank}
                    className={`board-card-slot ${isCenterSeven ? 'center-seven' : ''} ${isBlocked ? 'slot-blocked' : ''}`}
                    title={
                      isBlocked
                        ? `🚫 Rangkaian telah ditutup! Slot ${RANK_LABELS[rank]}${SUIT_SYMBOLS[suit]} terkunci permanen.`
                        : `Slot ${RANK_LABELS[rank]}${SUIT_SYMBOLS[suit]}`
                    }
                  >
                    <span className="slot-label">{isBlocked ? '✕' : RANK_LABELS[rank]}</span>
                    <span className={`slot-suit ${suit}`}>{SUIT_SYMBOLS[suit]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
