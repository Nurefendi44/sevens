import React from 'react';
import CardView from './CardView.jsx';
import { SUITS, SUIT_SYMBOLS, RANKS, RANK_LABELS } from '../engine/constants.js';

// Slot definitions for Horizontal and Vertical layouts
const HORIZONTAL_SLOTS = [
  { key: 'ace-bottom', type: 'ace-bottom', rank: 1, label: 'A' },
  { key: 'rank-2', type: 'regular', rank: 2, label: '2' },
  { key: 'rank-3', type: 'regular', rank: 3, label: '3' },
  { key: 'rank-4', type: 'regular', rank: 4, label: '4' },
  { key: 'rank-5', type: 'regular', rank: 5, label: '5' },
  { key: 'rank-6', type: 'regular', rank: 6, label: '6' },
  { key: 'rank-7', type: 'regular', rank: 7, label: '7', isCenterSeven: true },
  { key: 'rank-8', type: 'regular', rank: 8, label: '8' },
  { key: 'rank-9', type: 'regular', rank: 9, label: '9' },
  { key: 'rank-10', type: 'regular', rank: 10, label: '10' },
  { key: 'rank-11', type: 'regular', rank: 11, label: 'J' },
  { key: 'rank-12', type: 'regular', rank: 12, label: 'Q' },
  { key: 'rank-13', type: 'regular', rank: 13, label: 'K' },
  { key: 'ace-top', type: 'ace-top', rank: 1, label: 'A' },
];

// In vertical layout:
// Cards above 7 (8 -> K -> A) flow UPWARDS (8 is right above 7, A top is highest)
// Cards below 7 (6 -> 2 -> A) flow DOWNWARDS (6 is right below 7, A bottom is lowest)
const VERTICAL_SLOTS = [
  { key: 'ace-top', type: 'ace-top', rank: 1, label: 'A' },
  { key: 'rank-13', type: 'regular', rank: 13, label: 'K' },
  { key: 'rank-12', type: 'regular', rank: 12, label: 'Q' },
  { key: 'rank-11', type: 'regular', rank: 11, label: 'J' },
  { key: 'rank-10', type: 'regular', rank: 10, label: '10' },
  { key: 'rank-9', type: 'regular', rank: 9, label: '9' },
  { key: 'rank-8', type: 'regular', rank: 8, label: '8' },
  { key: 'rank-7', type: 'regular', rank: 7, label: '7', isCenterSeven: true },
  { key: 'rank-6', type: 'regular', rank: 6, label: '6' },
  { key: 'rank-5', type: 'regular', rank: 5, label: '5' },
  { key: 'rank-4', type: 'regular', rank: 4, label: '4' },
  { key: 'rank-3', type: 'regular', rank: 3, label: '3' },
  { key: 'rank-2', type: 'regular', rank: 2, label: '2' },
  { key: 'ace-bottom', type: 'ace-bottom', rank: 1, label: 'A' },
];

function resolveSlotState(slot, suitBoard, playedMap, globalAceDirection, suitName, suitSymbol) {
  const { type, rank, label } = slot;
  const aceCard = playedMap.get(1);

  // 1. ACE TOP (After King)
  if (type === 'ace-top') {
    const isClosedHere =
      suitBoard.closedAt === 'top' ||
      (!suitBoard.closedAt && aceCard && suitBoard.maxRank === 13);

    if (isClosedHere && aceCard) {
      return {
        playedCard: aceCard,
        isBlocked: false,
        isAceCapping: true,
        tooltip: `As ${suitName} penutup rangkaian atas (Tutup Atas)`,
      };
    }

    // Blocked if suit closed at bottom, or global direction locked to bottom,
    // or suit is completed without top closure
    const isBlocked =
      suitBoard.closedAt === 'bottom' ||
      globalAceDirection === 'bottom' ||
      (suitBoard.isCompleted && !isClosedHere);

    return {
      playedCard: null,
      isBlocked,
      isAceCapping: false,
      tooltip: isBlocked
        ? `🚫 Rangkaian ditutup ke arah bawah. Slot As atas terkunci.`
        : `Slot As penutup rangkaian atas (setelah King)`,
    };
  }

  // 2. ACE BOTTOM (Before 2)
  if (type === 'ace-bottom') {
    const isClosedHere =
      suitBoard.closedAt === 'bottom' ||
      (!suitBoard.closedAt && aceCard && suitBoard.minRank === 2);

    if (isClosedHere && aceCard) {
      return {
        playedCard: aceCard,
        isBlocked: false,
        isAceCapping: true,
        tooltip: `As ${suitName} penutup rangkaian bawah (Tutup Bawah)`,
      };
    }

    // Blocked if suit closed at top, or global direction locked to top,
    // or suit is completed without bottom closure
    const isBlocked =
      suitBoard.closedAt === 'top' ||
      globalAceDirection === 'top' ||
      (suitBoard.isCompleted && !isClosedHere);

    return {
      playedCard: null,
      isBlocked,
      isAceCapping: false,
      tooltip: isBlocked
        ? `🚫 Rangkaian ditutup ke arah atas. Slot As bawah terkunci.`
        : `Slot As penutup rangkaian bawah (sebelum angka 2)`,
    };
  }

  // 3. REGULAR CARD SLOTS (2 to 13)
  const playedCard = playedMap.get(rank);
  const isBlocked = suitBoard.isCompleted && !playedCard;

  return {
    playedCard,
    isBlocked,
    isAceCapping: false,
    tooltip: playedCard
      ? `${playedCard.label}${playedCard.symbol}`
      : isBlocked
      ? `🚫 Rangkaian telah ditutup! Slot ${label}${suitSymbol} terkunci.`
      : `Slot ${label}${suitSymbol}`,
  };
}

export default function Board({ board = {}, globalAceDirection, layout = 'horizontal' }) {
  const suitList = [SUITS.SPADES, SUITS.HEARTS, SUITS.DIAMONDS, SUITS.CLUBS];

  const suitNames = {
    [SUITS.SPADES]: 'Sekop',
    [SUITS.HEARTS]: 'Hati',
    [SUITS.DIAMONDS]: 'Wajik',
    [SUITS.CLUBS]: 'Keriting',
  };

  const isVertical = layout === 'vertical';
  const slotsTemplate = isVertical ? VERTICAL_SLOTS : HORIZONTAL_SLOTS;

  return (
    <div className={`board-container ${isVertical ? 'layout-vertical' : 'layout-horizontal'}`}>
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
        (suitBoard.playedCards || []).forEach((card) => {
          playedMap.set(card.rank, card);
        });

        if (isVertical) {
          // VERTICAL COLUMN LAYOUT (4 Columns side-by-side)
          return (
            <div
              key={suit}
              className={`board-suit-col ${suitBoard.isCompleted ? 'suit-completed-col' : ''}`}
            >
              {/* Suit Column Header: Only Symbol */}
              <div className="suit-col-header" title={suitNames[suit]}>
                <span className={`suit-icon ${suit}`}>{SUIT_SYMBOLS[suit]}</span>
                {suitBoard.isCompleted && (
                  <span
                    className="suit-completion-tag"
                    title={`Rangkaian telah ditutup dengan As.`}
                  >
                    🔒 {suitBoard.closedAt === 'top' ? 'Atas' : 'Bawah'}
                  </span>
                )}
              </div>

              {/* Vertical 14 Slots Track */}
              <div className="suit-col-slots">
                {slotsTemplate.map((slot) => {
                  const state = resolveSlotState(
                    slot,
                    suitBoard,
                    playedMap,
                    globalAceDirection,
                    suitNames[suit],
                    SUIT_SYMBOLS[suit]
                  );

                  if (state.playedCard) {
                    return (
                      <div
                        key={slot.key}
                        className={`board-card-slot slot-occupied ${
                          state.isAceCapping ? 'slot-ace-capping' : ''
                        }`}
                        title={state.tooltip}
                      >
                        <CardView card={state.playedCard} mini />
                      </div>
                    );
                  }

                  const isAceSlot = slot.type.startsWith('ace');

                  return (
                    <div
                      key={slot.key}
                      className={`board-card-slot ${slot.isCenterSeven ? 'center-seven' : ''} ${
                        isAceSlot ? 'slot-ace-gate' : ''
                      } ${state.isBlocked ? 'slot-blocked' : ''}`}
                      title={state.tooltip}
                    >
                      <span className="slot-label">{state.isBlocked ? '✕' : slot.label}</span>
                      <span className={`slot-suit ${suit}`}>{SUIT_SYMBOLS[suit]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // HORIZONTAL ROW LAYOUT (Standard 4 Rows)
        return (
          <div
            key={suit}
            className={`board-suit-row ${suitBoard.isCompleted ? 'suit-completed-row' : ''}`}
          >
            {/* Suit Header Badge: Only Symbol */}
            <div className="suit-header-badge" title={suitNames[suit]}>
              <span className={`suit-icon ${suit}`}>{SUIT_SYMBOLS[suit]}</span>
              {suitBoard.isCompleted && (
                <span
                  className="suit-completion-tag"
                  title={`Rangkaian telah ditutup dengan As.`}
                >
                  {suitBoard.closedAt === 'top' ? '🔒 Atas' : '🔒 Bawah'}
                </span>
              )}
            </div>

            {/* Horizontal 14 Slots Track */}
            <div className="suit-slots-track">
              {slotsTemplate.map((slot) => {
                const state = resolveSlotState(
                  slot,
                  suitBoard,
                  playedMap,
                  globalAceDirection,
                  suitNames[suit],
                  SUIT_SYMBOLS[suit]
                );

                if (state.playedCard) {
                  return (
                    <div
                      key={slot.key}
                      className={`board-card-slot slot-occupied ${
                        state.isAceCapping ? 'slot-ace-capping' : ''
                      }`}
                      title={state.tooltip}
                    >
                      <CardView card={state.playedCard} mini />
                    </div>
                  );
                }

                const isAceSlot = slot.type.startsWith('ace');

                return (
                  <div
                    key={slot.key}
                    className={`board-card-slot ${slot.isCenterSeven ? 'center-seven' : ''} ${
                      isAceSlot ? 'slot-ace-gate' : ''
                    } ${state.isBlocked ? 'slot-blocked' : ''}`}
                    title={state.tooltip}
                  >
                    <span className="slot-label">{state.isBlocked ? '✕' : slot.label}</span>
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
