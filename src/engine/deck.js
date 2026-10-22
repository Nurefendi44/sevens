/**
 * DECK & CARD MANAGEMENT
 */

import { SUITS, RANKS, RANK_LABELS, SUIT_SYMBOLS } from './constants.js';

/**
 * Creates a standard 52-card deck.
 * @returns {Array<Object>} 52 cards
 */
export function createDeck() {
  const deck = [];
  const suitList = [SUITS.SPADES, SUITS.HEARTS, SUITS.DIAMONDS, SUITS.CLUBS];

  for (const suit of suitList) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        label: RANK_LABELS[rank],
        symbol: SUIT_SYMBOLS[suit],
      });
    }
  }

  return deck;
}

/**
 * Generates cryptographically secure random float [0, 1) with Math.random fallback.
 */
function secureRandom() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

/**
 * Multi-pass Cryptographic Fisher-Yates (Knuth) Shuffle.
 * Completely eliminates clump bias, packet runs, and factory sort order residue.
 * 
 * @param {Array<Object>} deck 
 * @param {number} passes - Number of full shuffle passes (default: 5 passes for maximum entropy)
 * @returns {Array<Object>} Shuffled deck with 100% fair uniform distribution
 */
export function shuffleDeck(deck, passes = 5) {
  const cards = [...deck];
  const n = cards.length;
  if (n <= 1) return cards;

  for (let pass = 0; pass < passes; pass++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(secureRandom() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  return cards;
}

/**
 * Deals cards evenly to 4 players (13 cards each).
 * @param {Array<Object>} deck 52 cards
 * @param {Array<string>} playerIds Array of 4 player IDs
 * @returns {Object} { [playerId]: Card[] }
 */
export function dealCards(deck, playerIds = ['player_1', 'player_2', 'player_3', 'player_4']) {
  const hands = {};
  playerIds.forEach(id => {
    hands[id] = [];
  });

  // Deal 1 by 1 clockwise
  deck.forEach((card, index) => {
    const playerId = playerIds[index % playerIds.length];
    hands[playerId].push(card);
  });

  // Sort each hand by default for easy viewing
  playerIds.forEach(id => {
    hands[id] = sortHand(hands[id], 'suit');
  });

  return hands;
}

/**
 * Sorts a hand of cards either by suit or by rank.
 * @param {Array<Object>} hand 
 * @param {'suit'|'rank'} sortBy 
 * @returns {Array<Object>} Sorted cards
 */
export function sortHand(hand, sortBy = 'suit') {
  const suitOrder = {
    [SUITS.SPADES]: 1,
    [SUITS.HEARTS]: 2,
    [SUITS.DIAMONDS]: 3,
    [SUITS.CLUBS]: 4,
  };

  return [...hand].sort((a, b) => {
    if (sortBy === 'suit') {
      if (suitOrder[a.suit] !== suitOrder[b.suit]) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.rank - b.rank;
    } else {
      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
  });
}

/**
 * Checks if two card objects are identical.
 */
export function cardEquals(a, b) {
  if (!a || !b) return false;
  return a.suit === b.suit && a.rank === b.rank;
}

/**
 * Finds a specific card in a hand.
 */
export function findCardInHand(hand, suit, rank) {
  return hand.find(c => c.suit === suit && c.rank === rank) || null;
}
