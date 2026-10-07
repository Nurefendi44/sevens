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
 * Simulates human riffle shuffle (Gilbert-Shannon-Reeds model with human thumb variance).
 */
function riffleShuffle(deck) {
  const cutPoint = Math.floor(deck.length / 2) + Math.floor(secureRandom() * 7) - 3;
  const left = deck.slice(0, cutPoint);
  const right = deck.slice(cutPoint);
  const result = [];

  while (left.length > 0 || right.length > 0) {
    if (left.length === 0) {
      result.push(...right);
      break;
    }
    if (right.length === 0) {
      result.push(...left);
      break;
    }

    const probLeft = left.length / (left.length + right.length);
    const dropLeft = secureRandom() < probLeft;

    // Human thumb variance: sometimes 1, 2, or 3 cards fall together
    const clumpSize = Math.min(
      Math.floor(secureRandom() * 3) + 1,
      dropLeft ? left.length : right.length
    );

    if (dropLeft) {
      for (let k = 0; k < clumpSize; k++) {
        result.push(left.shift());
      }
    } else {
      for (let k = 0; k < clumpSize; k++) {
        result.push(right.shift());
      }
    }
  }

  return result;
}

/**
 * Simulates human overhand shuffle: taking small packets of cards and dropping them in reverse.
 */
function overhandShuffle(deck) {
  let remaining = [...deck];
  const result = [];

  while (remaining.length > 0) {
    const packetSize = Math.min(
      remaining.length,
      Math.floor(secureRandom() * 6) + 3 // packet of 3-8 cards
    );
    const packet = remaining.slice(remaining.length - packetSize);
    remaining = remaining.slice(0, remaining.length - packetSize);
    result.push(...packet);
  }

  return result;
}

/**
 * Simulates a table cut (dividing deck into segments and reordering).
 */
function cutShuffle(deck) {
  const c1 = Math.floor(deck.length * 0.3) + Math.floor(secureRandom() * 5);
  const c2 = Math.floor(deck.length * 0.7) + Math.floor(secureRandom() * 5);
  return [...deck.slice(c1, c2), ...deck.slice(0, c1), ...deck.slice(c2)];
}

/**
 * Multi-stage authentic human casino shuffle:
 * 1. Cut
 * 2. 4x Human Riffle shuffles with clump variance
 * 3. 2x Human Overhand packet shuffles
 * 4. Multi-segment Strip Cut
 * 5. Cryptographic Fisher-Yates final entropy sweep
 * 
 * @param {Array<Object>} deck 
 * @returns {Array<Object>} Shuffled deck with realistic human distribution
 */
export function shuffleDeck(deck) {
  let cards = [...deck];

  // 1. Initial human cut
  cards = cutShuffle(cards);

  // 2. Multi-pass riffle shuffles (as real dealers do)
  for (let r = 0; r < 4; r++) {
    cards = riffleShuffle(cards);
  }

  // 3. Overhand shuffles
  for (let o = 0; o < 2; o++) {
    cards = overhandShuffle(cards);
  }

  // 4. Second cut
  cards = cutShuffle(cards);

  // 5. Final Cryptographic Fisher-Yates sweep for 100% fair entropy
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
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
  if (deck.length % playerIds.length !== 0) {
    throw new Error(`Deck containing ${deck.length} cards cannot be dealt evenly to ${playerIds.length} players`);
  }

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
