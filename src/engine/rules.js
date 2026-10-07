/**
 * SEVENS GAME RULES & VALIDATION
 * Source of truth for Rule 1, Rule 2, Rule 3, Rule 4, Rule 5.
 * Strictly avoids leaking valid moves or cards in any feedback message.
 */

import { ACTION_TYPES, FAULT_CODES, SUITS } from './constants.js';
import { cardEquals } from './deck.js';

/**
 * RULE 1: Finds the starting player holding 7 of Spades.
 * @param {Object} hands { [playerId]: Card[] }
 * @param {Object} starterCard { suit: 'spades', rank: 7 }
 * @returns {string} playerId
 */
export function findStartingPlayer(hands, starterCard = { suit: SUITS.SPADES, rank: 7 }) {
  for (const [playerId, hand] of Object.entries(hands)) {
    const hasStarter = hand.some(c => c.suit === starterCard.suit && c.rank === starterCard.rank);
    if (hasStarter) {
      return playerId;
    }
  }
  throw new Error(`Starter card (${starterCard.rank} of ${starterCard.suit}) not found in any player's hand!`);
}

/**
 * Calculates legal card plays internally for game engine validation.
 * NEVER exposed to the player UI as hints or recommendation lists.
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {Array<Object>} List of valid cards
 */
export function getValidMoves(gameState, playerId) {
  const { board, hands, firstMoveMade, config, globalAceDirection } = gameState;
  const hand = hands[playerId] || [];

  if (hand.length === 0) {
    return [];
  }

  // RULE 1: If game just started and 7♠ hasn't been played yet
  if (!firstMoveMade) {
    const starterCard = config?.starterCard || { suit: SUITS.SPADES, rank: 7 };
    const starter = hand.find(c => c.suit === starterCard.suit && c.rank === starterCard.rank);
    return starter ? [starter] : [];
  }

  const validMoves = [];

  for (const card of hand) {
    const suitBoard = board[card.suit];

    // Card 7 opens the suit sequence
    if (card.rank === 7) {
      if (!suitBoard.isOpen) {
        validMoves.push(card);
      }
      continue;
    }

    // Suit must be open, and if already capped by Ace (isCompleted), no more cards can be played
    if (!suitBoard.isOpen || suitBoard.isCompleted) {
      continue;
    }

    // Ace (rank 1) validation
    if (card.rank === 1) {
      const canPlayAceTop = suitBoard.maxRank === 13 && (!globalAceDirection || globalAceDirection === 'top');
      const canPlayAceBottom = suitBoard.minRank === 2 && (!globalAceDirection || globalAceDirection === 'bottom');
      if (canPlayAceTop || canPlayAceBottom) {
        validMoves.push(card);
      }
      continue;
    }

    // Sequence check around minRank and maxRank (2..6 and 8..13)
    const canPlayLow = suitBoard.minRank !== null && card.rank === suitBoard.minRank - 1;
    const canPlayHigh = suitBoard.maxRank !== null && card.rank === suitBoard.maxRank + 1;

    if (canPlayLow || canPlayHigh) {
      validMoves.push(card);
    }
  }

  return validMoves;
}

/**
 * Checks if a specific card can be played by the player right now.
 * Returns generic rejection with no hints if invalid.
 * @param {Object} gameState
 * @param {string} playerId
 * @param {Object} card
 * @returns {{ valid: boolean, reason?: string }}
 */
export function canPlayCard(gameState, playerId, card) {
  if (gameState.currentPlayer !== playerId) {
    return { valid: false, reason: 'Bukan giliran Anda!' };
  }

  const validMoves = getValidMoves(gameState, playerId);
  const isValid = validMoves.some(c => cardEquals(c, card));

  if (!isValid) {
    return {
      valid: false,
      reason: 'Kartu tidak dapat dimainkan.',
    };
  }

  return { valid: true };
}

/**
 * RULE 3 & RULE 4:
 * Checks if the player is legally permitted to CLOSE a card.
 * A player MAY ONLY close a card if they have ZERO valid moves.
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canCloseCard(gameState, playerId) {
  if (gameState.currentPlayer !== playerId) {
    return { allowed: false, reason: 'Bukan giliran Anda!' };
  }

  const hand = gameState.hands[playerId] || [];
  if (hand.length === 0) {
    return { allowed: false, reason: 'Tangan pemain sudah kosong.' };
  }

  const validMoves = getValidMoves(gameState, playerId);
  // Ace sequence closure (rank === 1) is an optional strategic play, NOT mandatory
  const mandatoryMoves = validMoves.filter(c => c.rank !== 1);

  if (mandatoryMoves.length > 0) {
    return {
      allowed: false,
      reason: 'FAULT: Anda masih memiliki kartu yang dapat dimainkan! Dilarang menutup kartu.',
    };
  }

  return { allowed: true };
}

/**
 * RULE 4 & RULE 5: Engine fault validator.
 * Validates ANY proposed action against the game rules.
 * Keeps all error messages generic and strictly hint-free.
 * 
 * @param {Object} gameState 
 * @param {'PLAY'|'CLOSE'} actionType 
 * @param {string} playerId 
 * @param {Object} card 
 * @returns {{ isFault: boolean, code: string, message: string, penalty: number }}
 */
export function checkFault(gameState, actionType, playerId, card) {
  const faultPenalty = gameState.config?.faultPenalty !== undefined ? gameState.config.faultPenalty : 0;

  // Turn check
  if (gameState.currentPlayer !== playerId) {
    return {
      isFault: true,
      code: FAULT_CODES.NOT_YOUR_TURN,
      message: 'Bukan giliran Anda!',
      penalty: faultPenalty,
    };
  }

  const hand = gameState.hands[playerId] || [];
  const cardInHand = hand.find(c => cardEquals(c, card));
  if (!cardInHand) {
    return {
      isFault: true,
      code: FAULT_CODES.CARD_NOT_IN_HAND,
      message: 'Kartu tidak ada di tangan Anda.',
      penalty: faultPenalty,
    };
  }

  // Turn 1 Rule 1 checks: Generic feedback, no hint
  if (!gameState.firstMoveMade) {
    const starterCard = gameState.config?.starterCard || { suit: SUITS.SPADES, rank: 7 };
    const isStarter = card.suit === starterCard.suit && card.rank === starterCard.rank;

    if (actionType === ACTION_TYPES.CLOSE) {
      return {
        isFault: true,
        code: FAULT_CODES.MUST_PLAY_SEVEN_SPADES,
        message: 'FAULT: Tidak dapat menutup kartu pada giliran pertama.',
        penalty: faultPenalty,
      };
    }

    if (!isStarter) {
      // User requested: "Rule 7♠ tetap wajib divalidasi oleh game engine, tetapi JANGAN memberikan hint bahwa 7♠ harus dimainkan.
      // Jika pemain memilih kartu ilegal: tolak action, tampilkan feedback generik saja seperti 'Kartu tidak dapat dimainkan.'"
      return {
        isFault: false, // rejected as invalid play without leaking
        isInvalidPlay: true,
        code: FAULT_CODES.CARD_NOT_VALID,
        message: 'Kartu tidak dapat dimainkan.',
        penalty: 0,
      };
    }
  }

  // PLAY action check (Rule 2)
  if (actionType === ACTION_TYPES.PLAY) {
    const playCheck = canPlayCard(gameState, playerId, card);
    if (!playCheck.valid) {
      return {
        isFault: false,
        isInvalidPlay: true,
        code: FAULT_CODES.CARD_NOT_VALID,
        message: 'Kartu tidak dapat dimainkan.',
        penalty: 0,
      };
    }
  }

  // CLOSE action check (Rule 4 & Rule 5)
  if (actionType === ACTION_TYPES.CLOSE) {
    // Check if player has mandatory valid moves (Rule 4 & Rule 5 FAULT)
    // Ace sequence closure (rank === 1) is optional, so holding an Ace does not force FAULT
    const validMoves = getValidMoves(gameState, playerId);
    const mandatoryMoves = validMoves.filter(c => c.rank !== 1);

    if (mandatoryMoves.length > 0) {
      const validSeven = mandatoryMoves.find(c => c.rank === 7);
      if (validSeven) {
        return {
          isFault: true,
          code: FAULT_CODES.MUST_PLAY_SEVEN_NOT_CLOSE,
          message: 'FAULT: Anda masih memiliki kartu yang wajib dimainkan! Dilarang menutup kartu.',
          penalty: faultPenalty,
        };
      }

      return {
        isFault: true,
        code: FAULT_CODES.CLOSE_WHILE_HAVING_VALID_MOVES,
        message: 'FAULT: Anda masih memiliki kartu yang dapat dimainkan! Dilarang menutup kartu.',
        penalty: faultPenalty,
      };
    }
  }

  return {
    isFault: false,
    code: FAULT_CODES.NONE,
    message: 'Aksi valid.',
    penalty: 0,
  };
}
