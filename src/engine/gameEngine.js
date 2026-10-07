/**
 * SEVENS GAME ENGINE
 * Core state machine and game orchestration.
 * Completely decoupled from React and the UI layer.
 */

import { SUITS, GAME_STATUS, ACTION_TYPES } from './constants.js';
import { createDeck, shuffleDeck, dealCards, cardEquals, sortHand } from './deck.js';
import { findStartingPlayer, getValidMoves, canPlayCard, canCloseCard, checkFault } from './rules.js';
import { calculateScore, determineWinners } from './scoring.js';
import { createConfig } from './config.js';

/**
 * Creates initial 4-player game state.
 * @param {Object} [configOverrides] 
 * @returns {Object} Complete game state
 */
export function initGame(configOverrides = {}, customPlayers = null) {
  const config = createConfig(configOverrides);

  const playerCount = (customPlayers && Array.isArray(customPlayers) && customPlayers.length >= 4)
    ? customPlayers.length
    : (config.playerCount || 4);

  const defaultAllPlayers = [
    { id: 'player_1', name: 'Player 1 (Anda)', seat: 'bottom', isHuman: true, avatar: '👤' },
    { id: 'player_2', name: 'Player 2 (Barat)', seat: 'left', isHuman: true, avatar: '🦊' },
    { id: 'player_3', name: 'Player 3 (Utara)', seat: 'top', isHuman: true, avatar: '🐼' },
    { id: 'player_4', name: 'Player 4 (Timur)', seat: 'right', isHuman: true, avatar: '🦁' },
    { id: 'player_5', name: 'Player 5 (Tenggara)', seat: 'seat_5', isHuman: true, avatar: '🐯' },
    { id: 'player_6', name: 'Player 6 (Barat Daya)', seat: 'seat_6', isHuman: true, avatar: '🐨' },
  ];

  const players = (customPlayers && Array.isArray(customPlayers) && customPlayers.length >= 4)
    ? customPlayers
    : defaultAllPlayers.slice(0, playerCount);

  let deck = createDeck();

  // Initialize board for all 4 suits
  const board = {
    [SUITS.SPADES]: { suit: SUITS.SPADES, isOpen: false, minRank: null, maxRank: null, playedCards: [], isCompleted: false, closedAt: null, hasAce: false },
    [SUITS.HEARTS]: { suit: SUITS.HEARTS, isOpen: false, minRank: null, maxRank: null, playedCards: [], isCompleted: false, closedAt: null, hasAce: false },
    [SUITS.DIAMONDS]: { suit: SUITS.DIAMONDS, isOpen: false, minRank: null, maxRank: null, playedCards: [], isCompleted: false, closedAt: null, hasAce: false },
    [SUITS.CLUBS]: { suit: SUITS.CLUBS, isOpen: false, minRank: null, maxRank: null, playedCards: [], isCompleted: false, closedAt: null, hasAce: false },
  };

  let systemTableCards = [];
  let firstMoveMade = false;

  if (playerCount === 5) {
    // 5 PEMAIN: ♠7 dan ♥7 otomatis tertata di meja oleh sistem (sisa 50 kartu dibagikan, 10 kartu per pemain)
    const spades7 = deck.find(c => c.suit === SUITS.SPADES && c.rank === 7);
    const hearts7 = deck.find(c => c.suit === SUITS.HEARTS && c.rank === 7);

    deck = deck.filter(c => !( (c.suit === SUITS.SPADES && c.rank === 7) || (c.suit === SUITS.HEARTS && c.rank === 7) ));

    board[SUITS.SPADES] = { suit: SUITS.SPADES, isOpen: true, minRank: 7, maxRank: 7, playedCards: [spades7], isCompleted: false, closedAt: null, hasAce: false };
    board[SUITS.HEARTS] = { suit: SUITS.HEARTS, isOpen: true, minRank: 7, maxRank: 7, playedCards: [hearts7], isCompleted: false, closedAt: null, hasAce: false };
    systemTableCards = [spades7, hearts7];
    firstMoveMade = true;
  } else if (playerCount === 6) {
    // 6 PEMAIN: Semua kartu 7 (♠7, ♥7, ♦7, ♣7) otomatis tertata di meja oleh sistem (sisa 48 kartu dibagikan, 8 kartu per pemain)
    const allSevens = deck.filter(c => c.rank === 7);
    deck = deck.filter(c => c.rank !== 7);

    allSevens.forEach(c7 => {
      board[c7.suit] = { suit: c7.suit, isOpen: true, minRank: 7, maxRank: 7, playedCards: [c7], isCompleted: false, closedAt: null, hasAce: false };
    });
    systemTableCards = allSevens;
    firstMoveMade = true;
  }

  const shuffledDeck = shuffleDeck(deck);
  const playerIds = players.map(p => p.id);
  const hands = dealCards(shuffledDeck, playerIds);

  let startingPlayerId;
  if (playerCount === 4) {
    startingPlayerId = findStartingPlayer(hands, config.starterCard);
  } else {
    // 5 atau 6 pemain: ♠7 sudah di meja oleh sistem, giliran dimulai oleh player pertama
    startingPlayerId = playerIds[0];
  }

  const closedCards = {};
  const faults = {};
  players.forEach(p => {
    closedCards[p.id] = [];
    faults[p.id] = [];
  });

  const startingPlayer = players.find(p => p.id === startingPlayerId);

  let welcomeMessage = `Permainan dimulai (${playerCount} pemain). Giliran ${startingPlayer.name}.`;
  if (playerCount === 5) {
    welcomeMessage = `Permainan 5 Pemain dimulai. ♠7 dan ♥7 otomatis tertata di meja oleh sistem (10 kartu per pemain). Giliran pertama: ${startingPlayer.name}.`;
  } else if (playerCount === 6) {
    welcomeMessage = `Permainan 6 Pemain dimulai. Semua kartu 7 otomatis tertata di meja oleh sistem (8 kartu per pemain). Giliran pertama: ${startingPlayer.name}.`;
  }

  const initialState = {
    config: { ...config, playerCount },
    players,
    hands,
    board,
    playedCards: systemTableCards,
    closedCards,
    currentPlayer: startingPlayerId,
    startingPlayerId,
    turnNumber: 1,
    firstMoveMade,
    faults,
    scores: {},
    globalAceDirection: null, // Global Ace direction: null | 'top' | 'bottom'
    closureDirection: null,   // Alias for backwards compatibility
    rule6Penalties: [],       // Recorded -60 / -80 penalties when Tutup Rangkai occurs
    suitClosureEvents: [],
    gameStatus: GAME_STATUS.PLAYING,
    winner: null,
    winners: [],
    aceClosedEvents: [],
    actionLog: [
      {
        turn: 1,
        type: 'SYSTEM',
        playerId: startingPlayerId,
        message: welcomeMessage,
        timestamp: Date.now(),
      },
    ],
    lastAction: null,
  };

  return initialState;
}

/**
 * Resets or starts a new game.
 */
export function resetGame(configOverrides = {}, customPlayers = null) {
  return initGame(configOverrides, customPlayers);
}

/**
 * Checks if the game has concluded (all players' hands are empty).
 * @param {Object} gameState 
 * @returns {boolean}
 */
export function checkGameOver(gameState) {
  const { hands, players } = gameState;
  const allEmpty = players.every(p => !hands[p.id] || hands[p.id].length === 0);
  return allEmpty;
}

/**
 * Advances the turn to the next player clockwise.
 * @param {Object} gameState 
 * @returns {Object} Updated gameState
 */
export function nextTurn(gameState) {
  const { players, currentPlayer, hands } = gameState;
  const currentIndex = players.findIndex(p => p.id === currentPlayer);

  // Check if all empty
  if (checkGameOver(gameState)) {
    const scores = calculateScore(gameState);
    const winners = determineWinners(scores);
    return {
      ...gameState,
      gameStatus: GAME_STATUS.GAME_OVER,
      scores,
      winners,
      winner: winners[0] || null,
      lastAction: {
        type: 'GAME_OVER',
        message: 'Permainan telah selesai! Semua kartu telah dimainkan / ditutup.',
      },
    };
  }

  // Find next player who still has cards clockwise
  let nextIndex = (currentIndex + 1) % players.length;
  let attempts = 0;
  while (hands[players[nextIndex].id].length === 0 && attempts < players.length) {
    nextIndex = (nextIndex + 1) % players.length;
    attempts++;
  }

  const nextPlayerId = players[nextIndex].id;

  return {
    ...gameState,
    currentPlayer: nextPlayerId,
    turnNumber: gameState.turnNumber + 1,
  };
}

/**
 * Executes PLAY CARD action.
 * Pure state transition function.
 * 
 * @param {Object} gameState 
 * @param {string} playerId 
 * @param {Object} card 
 * @returns {{ success: boolean, state: Object, error?: string, fault?: Object }}
 */
export function playCard(gameState, playerId, card, chosenDirection = null) {
  if (gameState.gameStatus !== GAME_STATUS.PLAYING) {
    return { success: false, state: gameState, error: 'Permainan belum aktif atau sudah selesai.' };
  }

  // Engine validation & fault detection
  const faultCheck = checkFault(gameState, ACTION_TYPES.PLAY, playerId, card);

  // If card is simply illegal to play right now: reject action with generic error, no hint
  if (faultCheck.isInvalidPlay) {
    return {
      success: false,
      state: gameState,
      error: 'Kartu tidak dapat dimainkan.',
    };
  }

  if (faultCheck.isFault) {
    // Record fault in engine state
    const faultRecord = {
      turn: gameState.turnNumber,
      playerId,
      code: faultCheck.code,
      message: faultCheck.message,
      penalty: faultCheck.penalty,
      card,
      timestamp: Date.now(),
    };

    const nextFaults = {
      ...gameState.faults,
      [playerId]: [...(gameState.faults[playerId] || []), faultRecord],
    };

    const playerName = gameState.players.find(p => p.id === playerId)?.name || playerId;
    const nextLog = [
      {
        turn: gameState.turnNumber,
        type: 'FAULT',
        playerId,
        message: `⚠️ FAULT oleh ${playerName}: ${faultCheck.message}`,
        timestamp: Date.now(),
      },
      ...gameState.actionLog,
    ];

    const nextState = {
      ...gameState,
      faults: nextFaults,
      actionLog: nextLog,
      lastAction: {
        type: 'FAULT',
        playerId,
        card,
        message: faultCheck.message,
      },
    };

    return {
      success: false,
      state: nextState,
      error: faultCheck.message,
      fault: faultRecord,
    };
  }

  // Remove card from hand
  const currentHand = gameState.hands[playerId] || [];
  const nextHand = currentHand.filter(c => !cardEquals(c, card));

  // Update board
  const suitBoard = { ...gameState.board[card.suit] };
  const nextPlayedCardsSuit = [...suitBoard.playedCards, card];
  const playerName = gameState.players.find(p => p.id === playerId)?.name || playerId;

  let nextGlobalAceDirection = gameState.globalAceDirection || gameState.closureDirection || null;
  const nextRule6Penalties = [...(gameState.rule6Penalties || [])];
  const nextSuitClosureEvents = [...(gameState.suitClosureEvents || [])];
  let closureEventDetails = null;

  if (card.rank === 7) {
    suitBoard.isOpen = true;
    suitBoard.minRank = 7;
    suitBoard.maxRank = 7;
  } else if (card.rank === 1) {
    // TUTUP RANGKAI: Playing Ace to board to cap sequence
    const canCapTop = suitBoard.maxRank === 13 && (!nextGlobalAceDirection || nextGlobalAceDirection === 'top');
    const canCapBottom = suitBoard.minRank === 2 && (!nextGlobalAceDirection || nextGlobalAceDirection === 'bottom');

    let shouldCapTop = false;
    let shouldCapBottom = false;

    if (canCapTop && canCapBottom && !nextGlobalAceDirection) {
      if (chosenDirection === 'bottom') {
        shouldCapBottom = true;
      } else {
        shouldCapTop = true;
      }
    } else if (canCapTop) {
      shouldCapTop = true;
    } else if (canCapBottom) {
      shouldCapBottom = true;
    }

    if (shouldCapTop) {
      suitBoard.isCompleted = true;
      suitBoard.closedAt = 'top';
      suitBoard.hasAce = true;
      if (!nextGlobalAceDirection) {
        nextGlobalAceDirection = 'top';
      }

      // Rule: Pemain lain yang masih memiliki kartu 6 dari suit ini terkena penalti -60
      let penalizedPlayer = null;
      for (const p of gameState.players) {
        const hand = p.id === playerId ? nextHand : (gameState.hands[p.id] || []);
        const hasSix = hand.some(c => c.suit === card.suit && c.rank === 6);
        if (hasSix) {
          penalizedPlayer = p;
          const penaltyAmount = gameState.config?.penalty6 !== undefined ? gameState.config.penalty6 : -60;
          nextRule6Penalties.push({
            turn: gameState.turnNumber,
            playerId: p.id,
            playerName: p.name,
            suit: card.suit,
            rank: 6,
            card: { suit: card.suit, rank: 6, label: '6', symbol: card.symbol },
            penalty: penaltyAmount,
            reason: `Memegang 6${card.symbol} saat Tutup Rangkai Atas (${card.label}${card.symbol}) oleh ${playerName}`,
          });
          break;
        }
      }

      closureEventDetails = {
        type: 'TOP',
        directionName: 'ATAS',
        suit: card.suit,
        penalizedPlayer,
        penaltyCardRank: 6,
        penaltyAmount: -60,
      };

      nextSuitClosureEvents.push({
        turn: gameState.turnNumber,
        type: 'TOP',
        suit: card.suit,
        playerId,
        playerName,
        penalizedPlayerId: penalizedPlayer?.id || null,
        timestamp: Date.now(),
      });
    } else if (shouldCapBottom) {
      suitBoard.isCompleted = true;
      suitBoard.closedAt = 'bottom';
      suitBoard.hasAce = true;
      if (!nextGlobalAceDirection) {
        nextGlobalAceDirection = 'bottom';
      }

      // Rule: Pemain lain yang masih memiliki kartu 8 dari suit ini terkena penalti -80
      let penalizedPlayer = null;
      for (const p of gameState.players) {
        const hand = p.id === playerId ? nextHand : (gameState.hands[p.id] || []);
        const hasEight = hand.some(c => c.suit === card.suit && c.rank === 8);
        if (hasEight) {
          penalizedPlayer = p;
          const penaltyAmount = gameState.config?.penalty8 !== undefined ? gameState.config.penalty8 : -80;
          nextRule6Penalties.push({
            turn: gameState.turnNumber,
            playerId: p.id,
            playerName: p.name,
            suit: card.suit,
            rank: 8,
            card: { suit: card.suit, rank: 8, label: '8', symbol: card.symbol },
            penalty: penaltyAmount,
            reason: `Memegang 8${card.symbol} saat Tutup Rangkai Bawah (${card.label}${card.symbol}) oleh ${playerName}`,
          });
          break;
        }
      }

      closureEventDetails = {
        type: 'BOTTOM',
        directionName: 'BAWAH',
        suit: card.suit,
        penalizedPlayer,
        penaltyCardRank: 8,
        penaltyAmount: -80,
      };

      nextSuitClosureEvents.push({
        turn: gameState.turnNumber,
        type: 'BOTTOM',
        suit: card.suit,
        playerId,
        playerName,
        penalizedPlayerId: penalizedPlayer?.id || null,
        timestamp: Date.now(),
      });
    }
  } else if (card.rank < suitBoard.minRank) {
    suitBoard.minRank = card.rank;
  } else if (card.rank > suitBoard.maxRank) {
    suitBoard.maxRank = card.rank;
  }
  suitBoard.playedCards = nextPlayedCardsSuit;

  const nextBoard = {
    ...gameState.board,
    [card.suit]: suitBoard,
  };

  let logMessage = `${playerName} memainkan ${card.label}${card.symbol}`;

  if (closureEventDetails) {
    const dirInfo = closureEventDetails.type === 'TOP' ? 'ATAS (As=-11)' : 'BAWAH (As=-1)';
    let penInfo = '';
    if (closureEventDetails.penalizedPlayer) {
      penInfo = ` ⚠️ ${closureEventDetails.penalizedPlayer.name} memegang ${closureEventDetails.penaltyCardRank}${card.symbol} terkena penalti ${closureEventDetails.penaltyAmount}!`;
    }
    logMessage = `🔒 TUTUP RANGKAI ${closureEventDetails.directionName}! ${playerName} merangkai ${card.label}${card.symbol}. Arah As terkunci ke ${dirInfo}. Rangkaian ${card.suit} SELESAI.${penInfo}`;
  }

  const nextLog = [
    {
      turn: gameState.turnNumber,
      type: 'PLAY',
      playerId,
      card,
      message: logMessage,
      timestamp: Date.now(),
    },
    ...gameState.actionLog,
  ];

  let nextState = {
    ...gameState,
    globalAceDirection: nextGlobalAceDirection,
    closureDirection: nextGlobalAceDirection, // sync for backwards compatibility
    rule6Penalties: nextRule6Penalties,
    suitClosureEvents: nextSuitClosureEvents,
    hands: {
      ...gameState.hands,
      [playerId]: nextHand,
    },
    board: nextBoard,
    playedCards: [...gameState.playedCards, { turn: gameState.turnNumber, playerId, card }],
    firstMoveMade: true,
    actionLog: nextLog,
    lastAction: {
      type: 'PLAY',
      playerId,
      card,
      message: logMessage,
    },
  };

  // Advance turn or conclude
  nextState = nextTurn(nextState);

  return { success: true, state: nextState };
}

/**
 * Executes CLOSE CARD action (face-down discard when player has 0 valid moves).
 * Pure state transition function.
 * 
 * @param {Object} gameState 
 * @param {string} playerId 
 * @param {Object} card 
 * @returns {{ success: boolean, state: Object, error?: string, fault?: Object }}
 */
export function closeCard(gameState, playerId, card) {
  if (gameState.gameStatus !== GAME_STATUS.PLAYING) {
    return { success: false, state: gameState, error: 'Permainan belum aktif atau sudah selesai.' };
  }

  // Validate action against rules (checks that player has 0 valid moves)
  const faultCheck = checkFault(gameState, ACTION_TYPES.CLOSE, playerId, card);
  if (faultCheck.isFault) {
    const faultRecord = {
      turn: gameState.turnNumber,
      playerId,
      code: faultCheck.code,
      message: faultCheck.message,
      penalty: faultCheck.penalty,
      card,
      timestamp: Date.now(),
    };

    const nextFaults = {
      ...gameState.faults,
      [playerId]: [...(gameState.faults[playerId] || []), faultRecord],
    };

    const playerName = gameState.players.find(p => p.id === playerId)?.name || playerId;
    const nextLog = [
      {
        turn: gameState.turnNumber,
        type: 'FAULT',
        playerId,
        message: `⚠️ FAULT oleh ${playerName}: ${faultCheck.message}`,
        timestamp: Date.now(),
      },
      ...gameState.actionLog,
    ];

    const nextState = {
      ...gameState,
      faults: nextFaults,
      actionLog: nextLog,
      lastAction: {
        type: 'FAULT',
        playerId,
        card,
        message: faultCheck.message,
      },
    };

    return {
      success: false,
      state: nextState,
      error: faultCheck.message,
      fault: faultRecord,
    };
  }

  // Remove card from player hand and put into player's closed cards
  const currentHand = gameState.hands[playerId] || [];
  const nextHand = currentHand.filter(c => !cardEquals(c, card));
  const currentClosed = gameState.closedCards[playerId] || [];
  const nextClosed = [...currentClosed, card];

  const playerName = gameState.players.find(p => p.id === playerId)?.name || playerId;
  const logMessage = `${playerName} menutup (CLOSE) satu kartu`;

  const nextLog = [
    {
      turn: gameState.turnNumber,
      type: 'CLOSE',
      playerId,
      card,
      message: logMessage,
      timestamp: Date.now(),
    },
    ...gameState.actionLog,
  ];

  let nextState = {
    ...gameState,
    hands: {
      ...gameState.hands,
      [playerId]: nextHand,
    },
    closedCards: {
      ...gameState.closedCards,
      [playerId]: nextClosed,
    },
    actionLog: nextLog,
    lastAction: {
      type: 'CLOSE',
      playerId,
      card,
      message: logMessage,
    },
  };

  // Advance turn
  nextState = nextTurn(nextState);

  return { success: true, state: nextState };
}

// Export all required engine functions as a unified interface
export {
  createDeck,
  shuffleDeck,
  dealCards,
  findStartingPlayer,
  getValidMoves,
  canPlayCard,
  canCloseCard,
  checkFault,
  calculateScore,
  sortHand,
};
