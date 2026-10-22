/**
 * BIG TWO (CAPSA BANTING) GAME ENGINE
 * Supports 2 to 6 players, Single Deck & Double Deck modes.
 */

import { createDeck, shuffleDeck } from '../../../engine/deck.js';
import {
  GAME_STATUS_BIGTWO,
  BIGTWO_RANK_VALUES,
  BIGTWO_SUIT_VALUES,
  HAND_TYPE_BIGTWO,
} from './constants.js';
import {
  evaluateCombo,
  canBeatCombo,
  sortBigTwoCards,
  getCardRank,
  getCardSuitValue,
} from './handEvaluator.js';

export const DEFAULT_CONFIG_BIGTWO = {
  playerCount: 4,
  deckMode: 'single', // 'single' (52 kartu) | 'double' (104 kartu)
  starterCardMandatory: true, // Wajib menyertakan 3♦ di putaran pertama
};

/**
 * Creates and initializes a new Big Two match
 */
export function initBigTwo(configOverrides = {}, customPlayers = null) {
  const desiredCount = customPlayers ? customPlayers.length : (configOverrides.playerCount || 4);
  const playerCount = Math.max(2, Math.min(6, desiredCount));

  // Determine deck mode:
  // For 4 players or fewer, ALWAYS use Single Deck (52 cards).
  // Double Deck (104 cards) is strictly and only allowed for > 4 players (5 or 6 players) if explicitly chosen.
  const isEligibleForDouble = playerCount > 4;
  const deckMode = isEligibleForDouble && configOverrides.deckMode === 'double' ? 'double' : 'single';

  const config = {
    ...DEFAULT_CONFIG_BIGTWO,
    ...configOverrides,
    playerCount,
    deckMode,
  };

  // Hard safety: never allow double deck on <= 4 players under any circumstance
  if (playerCount <= 4) {
    config.deckMode = 'single';
  }

  const defaultAvatars = ['👑', '⚡', '🌟', '💎', '🔥', '🎲'];
  const defaultNames = ['Pemain 1 (Anda)', 'Pemain 2', 'Pemain 3', 'Pemain 4', 'Pemain 5', 'Pemain 6'];

  const players = customPlayers && customPlayers.length >= playerCount
    ? customPlayers.slice(0, playerCount)
    : Array.from({ length: playerCount }, (_, idx) => ({
        id: `player_${idx + 1}`,
        name: defaultNames[idx],
        avatar: defaultAvatars[idx],
        isHuman: idx === 0,
        isHost: idx === 0,
      }));

  // Create Deck
  let fullDeck = [];
  if (config.deckMode === 'double' && playerCount > 4) {
    // 2 Decks (104 cards): pre-shuffle each deck independently first to scatter factory order, then combine and multi-pass shuffle
    const deck1 = shuffleDeck(createDeck().map((c) => ({ ...c, id: `${c.id}_d1` })), 3);
    const deck2 = shuffleDeck(createDeck().map((c) => ({ ...c, id: `${c.id}_d2` })), 3);
    fullDeck = shuffleDeck([...deck1, ...deck2], 5);
  } else {
    // 1 Deck (52 cards)
    fullDeck = shuffleDeck(createDeck(), 5);
  }

  // Deal cards to each player round-robin until deck is completely exhausted (kartu dibagi habis)
  // Single Deck (52 cards): 2p = 26 cards each, 3p = 18/17/17 cards, 4p = 13 cards each, etc.
  // Double Deck (104 cards): 2p = 52 cards each, 4p = 26 cards each, etc.
  const hands = {};
  players.forEach((p) => {
    hands[p.id] = [];
  });

  const availableDeck = [...fullDeck];
  while (availableDeck.length > 0) {
    for (const p of players) {
      if (availableDeck.length === 0) break;

      // In Double Deck mode, ensure no player holds twin identical cards in their hand
      const existingKeys = new Set(hands[p.id].map((c) => `${c.suit}-${c.rank}`));
      const nonTwinIndex = availableDeck.findIndex((c) => !existingKeys.has(`${c.suit}-${c.rank}`));

      if (nonTwinIndex !== -1) {
        hands[p.id].push(availableDeck.splice(nonTwinIndex, 1)[0]);
      } else {
        hands[p.id].push(availableDeck.pop());
      }
    }
  }

  // Sort each player's hand by Big Two rank (3..2)
  players.forEach((p) => {
    hands[p.id] = sortBigTwoCards(hands[p.id]);
  });

  // Find player who has the lowest card to start the first round
  // Lowest card is 3 of diamonds (rank 3, diamonds)
  let startingPlayerId = players[0].id;
  let lowestCardFound = null;

  for (const p of players) {
    const playerHand = hands[p.id];
    for (const card of playerHand) {
      if (!lowestCardFound) {
        lowestCardFound = card;
        startingPlayerId = p.id;
      } else {
        const rankDiff = getCardRank(card) - getCardRank(lowestCardFound);
        if (rankDiff < 0 || (rankDiff === 0 && getCardSuitValue(card) < getCardSuitValue(lowestCardFound))) {
          lowestCardFound = card;
          startingPlayerId = p.id;
        }
      }
    }
  }

  const startingPlayer = players.find((p) => p.id === startingPlayerId) || players[0];

  const initialState = {
    gameType: 'bigtwo',
    config,
    players,
    hands,
    undealtCards: fullDeck,
    currentTrick: {
      cards: [],
      combo: null,
      playedBy: null,
      playedByName: null,
    },
    lastPlayedCombo: null,
    trickLeaderId: startingPlayerId,
    consecutivePassCount: 0,
    isFirstPlayOfGame: true,
    lowestCard: lowestCardFound,
    currentPlayer: startingPlayerId,
    gameStatus: GAME_STATUS_BIGTWO.PLAYING,
    winner: null,
    rankings: null,
    history: [
      {
        turn: 1,
        message: `Permainan Big Two (Capsa Banting) dimulai (${playerCount} pemain, ${config.deckMode === 'double' ? 'Double Deck' : 'Single Deck'}). Pemegang kartu terendah (${lowestCardFound?.label || 3}${lowestCardFound?.symbol || '♦'}) adalah ${startingPlayer.name} yang berhak jalan pertama.`,
      },
    ],
  };

  return initialState;
}

/**
 * Player plays a card combination to the table.
 * 
 * @param {Object} gameState 
 * @param {string} playerId 
 * @param {Array<Object>} selectedCards 
 * @returns {{ success: boolean, gameState?: Object, error?: string }}
 */
export function playComboBigTwo(gameState, playerId, selectedCards = []) {
  if (gameState.gameStatus !== GAME_STATUS_BIGTWO.PLAYING) {
    return { success: false, error: 'Permainan telah selesai.' };
  }

  if (gameState.currentPlayer !== playerId) {
    return { success: false, error: 'Bukan giliran Anda!' };
  }

  if (!selectedCards || selectedCards.length === 0) {
    return { success: false, error: 'Silakan pilih kartu yang ingin dikeluarkan.' };
  }

  const playerHand = gameState.hands[playerId] || [];
  // Verify player actually holds all selected cards
  for (const card of selectedCards) {
    const holds = playerHand.some((c) => c.id === card.id || (c.rank === card.rank && c.suit === card.suit));
    if (!holds) {
      return { success: false, error: 'Kartu tidak ada di tangan Anda!' };
    }
  }

  // 1. Evaluate Combination
  const combo = evaluateCombo(selectedCards);
  if (!combo.isValid) {
    return { success: false, error: combo.error || 'Kombinasi kartu tidak valid.' };
  }

  // 2. First play of the game mandatory lowest card check (e.g. 3♦)
  if (gameState.isFirstPlayOfGame && gameState.config.starterCardMandatory && gameState.lowestCard) {
    const hasLowest = selectedCards.some(
      (c) => getCardRank(c) === getCardRank(gameState.lowestCard) && c.suit === gameState.lowestCard.suit
    );
    if (!hasLowest) {
      return {
        success: false,
        error: `Putaran pertama wajib menyertakan kartu pembuka (${gameState.lowestCard.label || 3}${gameState.lowestCard.symbol || '♦'})!`,
      };
    }
  }

  // 3. Beat Table Combo check
  const activeTableCombo = gameState.currentTrick?.combo || null;
  const beatCheck = canBeatCombo(combo, activeTableCombo);
  if (!beatCheck.canBeat) {
    return { success: false, error: beatCheck.reason || 'Kombinasi kartu tidak dapat mengalahkan meja!' };
  }

  // 4. Remove cards from player's hand
  const newPlayerHand = playerHand.filter(
    (c) => !selectedCards.some((sc) => sc.id === c.id || (sc.rank === c.rank && sc.suit === c.suit))
  );

  const playerName = gameState.players.find((p) => p.id === playerId)?.name || 'Pemain';

  const updatedHands = {
    ...gameState.hands,
    [playerId]: sortBigTwoCards(newPlayerHand),
  };

  // Check Game Over (Hand empty = WINNER!)
  if (newPlayerHand.length === 0) {
    // Player wins! Calculate rankings
    const rankings = gameState.players
      .map((p) => {
        const remaining = p.id === playerId ? 0 : (updatedHands[p.id]?.length || 0);
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          remainingCards: remaining,
          isWinner: p.id === playerId,
        };
      })
      .sort((a, b) => a.remainingCards - b.remainingCards);

    const actionPayload = {
      type: 'PLAY_COMBO',
      playerId,
      playerName,
      avatar: gameState.players.find((p) => p.id === playerId)?.avatar || '👤',
      cards: selectedCards,
      combo,
      message: `${playerName} mengeluarkan ${combo.label}`,
      timestamp: Date.now(),
    };

    const finishedState = {
      ...gameState,
      hands: updatedHands,
      currentTrick: {
        cards: selectedCards,
        combo,
        playedBy: playerId,
        playedByName: playerName,
      },
      lastPlayedCombo: combo,
      lastAction: actionPayload,
      gameStatus: GAME_STATUS_BIGTWO.GAME_OVER,
      winner: playerId,
      rankings,
      history: [
        ...gameState.history,
        {
          turn: gameState.history.length + 1,
          message: `🏆 ${playerName} mengeluarkan ${combo.label} dan menghabiskan seluruh kartu! ${playerName} MENANG!`,
        },
      ],
    };

    return { success: true, gameState: finishedState };
  }

  // Determine Next Player (Clockwise)
  const playerIdx = gameState.players.findIndex((p) => p.id === playerId);
  const nextPlayer = gameState.players[(playerIdx + 1) % gameState.players.length];

  const actionPayload = {
    type: 'PLAY_COMBO',
    playerId,
    playerName,
    avatar: gameState.players.find((p) => p.id === playerId)?.avatar || '👤',
    cards: selectedCards,
    combo,
    message: `${playerName} mengeluarkan ${combo.label}`,
    timestamp: Date.now(),
  };

  const nextState = {
    ...gameState,
    hands: updatedHands,
    currentTrick: {
      cards: selectedCards,
      combo,
      playedBy: playerId,
      playedByName: playerName,
    },
    lastPlayedCombo: combo,
    lastAction: actionPayload,
    trickLeaderId: playerId,
    consecutivePassCount: 0,
    isFirstPlayOfGame: false,
    currentPlayer: nextPlayer.id,
    history: [
      ...gameState.history,
      {
        turn: gameState.history.length + 1,
        message: `${playerName} mengeluarkan ${combo.label}. Giliran ${nextPlayer.name}.`,
      },
    ],
  };

  return { success: true, gameState: nextState };
}

/**
 * Player passes their turn.
 * If all other players pass in a row, the trick is cleared and current player gets a free turn.
 * 
 * @param {Object} gameState 
 * @param {string} playerId 
 * @returns {{ success: boolean, gameState?: Object, error?: string }}
 */
export function passTurnBigTwo(gameState, playerId) {
  if (gameState.gameStatus !== GAME_STATUS_BIGTWO.PLAYING) {
    return { success: false, error: 'Permainan telah selesai.' };
  }

  if (gameState.currentPlayer !== playerId) {
    return { success: false, error: 'Bukan giliran Anda!' };
  }

  // Cannot pass if table is empty (free turn)
  if (!gameState.currentTrick?.combo || gameState.currentTrick.cards.length === 0) {
    return { success: false, error: 'Meja kosong (Giliran Bebas)! Anda wajib mengeluarkan kartu.' };
  }

  const playerName = gameState.players.find((p) => p.id === playerId)?.name || 'Pemain';
  const newPassCount = gameState.consecutivePassCount + 1;
  const otherPlayersCount = gameState.players.length - 1;

  const playerIdx = gameState.players.findIndex((p) => p.id === playerId);
  const nextPlayer = gameState.players[(playerIdx + 1) % gameState.players.length];

  // If (otherPlayersCount) players have passed consecutively, the trick leader wins the trick!
  // The table is cleared and the trick leader gets a free turn!
  if (newPassCount >= otherPlayersCount) {
    const leaderPlayer = gameState.players.find((p) => p.id === gameState.trickLeaderId) || nextPlayer;

    const clearedState = {
      ...gameState,
      currentTrick: {
        cards: [],
        combo: null,
        playedBy: null,
        playedByName: null,
      },
      consecutivePassCount: 0,
      currentPlayer: leaderPlayer.id,
      lastAction: {
        type: 'PASS',
        playerId,
        playerName,
        avatar: gameState.players.find((p) => p.id === playerId)?.avatar || '👤',
        message: `${playerName} Lewat (Pass). Meja dibersihkan! Giliran Bebas untuk ${leaderPlayer.name}.`,
        timestamp: Date.now(),
      },
      history: [
        ...gameState.history,
        {
          turn: gameState.history.length + 1,
          message: `${playerName} LEWAT (Pass). Semua pemain telah lewat. Meja dibersihkan! Giliran Bebas untuk ${leaderPlayer.name}.`,
        },
      ],
    };

    return { success: true, gameState: clearedState };
  }

  // Standard Pass to next player
  const nextState = {
    ...gameState,
    consecutivePassCount: newPassCount,
    currentPlayer: nextPlayer.id,
    lastAction: {
      type: 'PASS',
      playerId,
      playerName,
      avatar: gameState.players.find((p) => p.id === playerId)?.avatar || '👤',
      message: `${playerName} Lewat (Pass)`,
      timestamp: Date.now(),
    },
    history: [
      ...gameState.history,
      {
        turn: gameState.history.length + 1,
        message: `${playerName} LEWAT (Pass). Giliran ${nextPlayer.name}.`,
      },
    ],
  };

  return { success: true, gameState: nextState };
}
