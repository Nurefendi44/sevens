/**
 * GAME ENGINE FOR KARTU 41 (REMI 41)
 * Supports 4, 5, or 6 players.
 */

import { createDeck, shuffleDeck, cardEquals } from '../../../engine/deck.js';
import { GAME_STATUS_41, TURN_PHASE_41, DRAW_SOURCE_41 } from './constants41.js';
import { calculateHandScore41, determineWinners41 } from './scoring41.js';

export const DEFAULT_CONFIG_41 = {
  playerCount: 4,
  allowInstantWin41: true,
};

/**
 * Initializes a new Kartu 41 match.
 */
export function initGame41(config = DEFAULT_CONFIG_41, customPlayers = null) {
  const playerCount = Math.max(4, Math.min(6, config.playerCount || 4));

  // Default avatars & seats
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

  // Shuffle 52-card standard deck
  const deck = shuffleDeck(createDeck());

  // Deal 4 cards to each player
  const hands = {};
  players.forEach((p) => {
    hands[p.id] = [];
  });

  for (let round = 0; round < 4; round++) {
    players.forEach((p) => {
      hands[p.id].push(deck.pop());
    });
  }

  // 1 card flipped face-up onto table as initial discard opportunity for Player 1
  const initialDiscardCard = deck.pop();
  const discardPile = [initialDiscardCard];

  // Remaining cards form the Draw Pile (Stock)
  const drawPile = [...deck];

  const firstPlayerId = players[0].id;

  const initialState = {
    gameType: 'game41',
    config: { ...config, playerCount },
    players,
    hands,
    drawPile,
    discardPile,
    graveyard: [], // Discarded cards that were skipped / unpicked
    passedDiscard: {
      card: initialDiscardCard,
      fromPlayerId: 'system',
      fromPlayerName: 'Meja Awal',
      toPlayerId: firstPlayerId,
      toPlayerName: players[0].name,
    },
    currentPlayer: firstPlayerId,
    turnPhase: TURN_PHASE_41.DRAW,
    turnNumber: 1,
    gameStatus: GAME_STATUS_41.PLAYING,
    winner: null,
    endReason: null,
    rankings: null,
    history: [
      {
        turn: 1,
        message: `Permainan Kartu 41 dimulai (${playerCount} pemain). Giliran ${players[0].name} untuk mengambil kartu.`,
      },
    ],
    lastAction: null,
  };

  return initialState;
}

/**
 * Draws a card from either Stock (Draw Pile) or Discard passed from previous player.
 * Hand increases from 4 to 5 cards.
 */
export function drawCard41(gameState, playerId, source = DRAW_SOURCE_41.STOCK) {
  if (gameState.gameStatus !== GAME_STATUS_41.PLAYING) {
    return { success: false, error: 'Permainan telah selesai.' };
  }

  if (gameState.currentPlayer !== playerId) {
    return { success: false, error: 'Bukan giliran Anda!' };
  }

  if (gameState.turnPhase !== TURN_PHASE_41.DRAW) {
    return { success: false, error: 'Anda sudah mengambil kartu. Sekarang giliran membuang kartu.' };
  }

  const nextDrawPile = [...gameState.drawPile];
  const nextDiscardPile = [...gameState.discardPile];
  const nextGraveyard = [...(gameState.graveyard || [])];
  const currentHand = [...(gameState.hands[playerId] || [])];
  let drawnCard = null;

  if (source === DRAW_SOURCE_41.STOCK) {
    if (nextDrawPile.length === 0) {
      return { success: false, error: 'Tumpukan ambil (Draw Pile) sudah habis!' };
    }
    drawnCard = nextDrawPile.pop();

    // If there was a pending discard passed to this player that was not taken, it goes to graveyard
    if (gameState.passedDiscard && gameState.passedDiscard.card) {
      nextGraveyard.push(gameState.passedDiscard.card);
    }
  } else if (source === DRAW_SOURCE_41.DISCARD) {
    if (!gameState.passedDiscard || !gameState.passedDiscard.card) {
      return { success: false, error: 'Tidak ada kartu buangan yang dioper ke Anda!' };
    }
    if (gameState.passedDiscard.toPlayerId && gameState.passedDiscard.toPlayerId !== playerId) {
      return { success: false, error: 'Kartu buangan ini bukan untuk Anda!' };
    }
    drawnCard = gameState.passedDiscard.card;
  } else {
    return { success: false, error: 'Sumber kartu tidak valid.' };
  }

  const nextHand = [...currentHand, drawnCard];
  const nextHands = {
    ...gameState.hands,
    [playerId]: nextHand,
  };

  const playerName = gameState.players.find((p) => p.id === playerId)?.name || playerId;
  const sourceLabel = source === DRAW_SOURCE_41.STOCK
    ? 'Tumpukan Dek'
    : `Buangan dari ${gameState.passedDiscard?.fromPlayerName || 'pemain sebelumnya'} (${drawnCard.label}${drawnCard.symbol})`;

  const nextState = {
    ...gameState,
    drawPile: nextDrawPile,
    discardPile: nextDiscardPile,
    graveyard: nextGraveyard,
    passedDiscard: null, // Consumed or archived
    hands: nextHands,
    turnPhase: TURN_PHASE_41.DISCARD,
    lastAction: {
      type: 'DRAW',
      playerId,
      source,
      card: drawnCard,
    },
    history: [
      ...gameState.history,
      {
        turn: gameState.turnNumber,
        message: `${playerName} mengambil kartu dari ${sourceLabel}.`,
      },
    ],
  };

  return { success: true, state: nextState, drawnCard };
}

/**
 * Discards 1 card from hand to Discard Pile.
 * Hand decreases from 5 to 4 cards.
 * Evaluates 41 Murni (Instant Win) or Deck Out conditions.
 */
export function discardCard41(gameState, playerId, cardToDiscard) {
  if (gameState.gameStatus !== GAME_STATUS_41.PLAYING) {
    return { success: false, error: 'Permainan telah selesai.' };
  }

  if (gameState.currentPlayer !== playerId) {
    return { success: false, error: 'Bukan giliran Anda!' };
  }

  if (gameState.turnPhase !== TURN_PHASE_41.DISCARD) {
    return { success: false, error: 'Anda harus mengambil kartu terlebih dahulu sebelum membuang kartu!' };
  }

  const currentHand = gameState.hands[playerId] || [];
  const cardIndex = currentHand.findIndex((c) => cardEquals(c, cardToDiscard));

  if (cardIndex === -1) {
    return { success: false, error: 'Kartu yang ingin dibuang tidak ada di tangan Anda!' };
  }

  const nextHand = currentHand.filter((_, idx) => idx !== cardIndex);
  const nextDiscardPile = [...gameState.discardPile, cardToDiscard];
  const nextHands = {
    ...gameState.hands,
    [playerId]: nextHand,
  };

  const playerName = gameState.players.find((p) => p.id === playerId)?.name || playerId;

  // 1. Evaluate 41 Murni on the discarded player's 4-card hand
  const handEval = calculateHandScore41(nextHand);

  if (handEval.is41 && gameState.config.allowInstantWin41 !== false) {
    // 🎉 INSTANT WIN 41 MURNI!
    const result = determineWinners41(gameState.players, nextHands);

    const nextState = {
      ...gameState,
      hands: nextHands,
      discardPile: nextDiscardPile,
      gameStatus: GAME_STATUS_41.GAME_OVER,
      winner: gameState.players.find((p) => p.id === playerId),
      endReason: '41_MURNI',
      rankings: result.rankings,
      lastAction: {
        type: 'DISCARD',
        playerId,
        card: cardToDiscard,
        is41: true,
      },
      history: [
        ...gameState.history,
        {
          turn: gameState.turnNumber,
          message: `🔥 ${playerName} membuang ${cardToDiscard.label}${cardToDiscard.symbol} dan MENCAPAI 41 MURNI! Permainan Selesai!`,
        },
      ],
    };

    return { success: true, state: nextState, isGameOver: true, is41: true };
  }

  // 2. Check if Draw Pile is now empty (Deck Out)
  if (gameState.drawPile.length === 0) {
    // Permainan selesai karena kartu ambil habis!
    const result = determineWinners41(gameState.players, nextHands);

    const nextState = {
      ...gameState,
      hands: nextHands,
      discardPile: nextDiscardPile,
      gameStatus: GAME_STATUS_41.GAME_OVER,
      winner: result.winner?.player || null,
      endReason: 'DECK_OUT',
      rankings: result.rankings,
      lastAction: {
        type: 'DISCARD',
        playerId,
        card: cardToDiscard,
      },
      history: [
        ...gameState.history,
        {
          turn: gameState.turnNumber,
          message: `${playerName} membuang ${cardToDiscard.label}${cardToDiscard.symbol}. Tumpukan kartu telah habis! Permainan Selesai.`,
        },
      ],
    };

    return { success: true, state: nextState, isGameOver: true, isDeckOut: true };
  }

  // 3. Normal turn progression: Next player's turn
  const currentPlayerIndex = gameState.players.findIndex((p) => p.id === playerId);
  const nextPlayerIndex = (currentPlayerIndex + 1) % gameState.players.length;
  const nextPlayer = gameState.players[nextPlayerIndex];

  const nextPassedDiscard = {
    card: cardToDiscard,
    fromPlayerId: playerId,
    fromPlayerName: playerName,
    toPlayerId: nextPlayer.id,
    toPlayerName: nextPlayer.name,
  };

  const nextState = {
    ...gameState,
    hands: nextHands,
    discardPile: nextDiscardPile,
    passedDiscard: nextPassedDiscard,
    currentPlayer: nextPlayer.id,
    turnPhase: TURN_PHASE_41.DRAW,
    turnNumber: gameState.turnNumber + 1,
    lastAction: {
      type: 'DISCARD',
      playerId,
      card: cardToDiscard,
      toPlayerId: nextPlayer.id,
    },
    history: [
      ...gameState.history,
      {
        turn: gameState.turnNumber,
        message: `${playerName} membuang ${cardToDiscard.label}${cardToDiscard.symbol} ke ${nextPlayer.name}. Giliran ${nextPlayer.name}.`,
      },
    ],
  };

  return { success: true, state: nextState, isGameOver: false };
}
