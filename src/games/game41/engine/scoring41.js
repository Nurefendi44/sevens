/**
 * SCORING ENGINE FOR KARTU 41
 * 
 * Rules:
 * - As = 11 poin
 * - J, Q, K, 10 = masing-masing 10 poin
 * - 2..9 = 2..9 poin
 * - 4 kartu suit sama dengan total 41 poin = 41 MURNI (Instant Win!)
 * - Jika bukan 41: Skor dihitung dari suit dengan nilai tertinggi dikurangi kartu beda suit
 */

import { CARD_VALUES_41 } from './constants41.js';
import { SUITS } from '../../../engine/constants.js';

/**
 * Returns point value of a single card in 41
 */
export function getCardValue41(card) {
  if (!card) return 0;
  return CARD_VALUES_41[card.rank] || card.rank;
}

/**
 * Calculates current score and optimal dominant suit for a hand.
 * @param {Array<Object>} hand (usually 4 cards, or 5 cards during draw phase)
 * @returns {Object} { bestSuit, bestScore, is41, suitBreakdown, dominantCards }
 */
export function calculateHandScore41(hand = []) {
  if (!hand || hand.length === 0) {
    return {
      bestSuit: null,
      bestScore: 0,
      is41: false,
      suitBreakdown: {},
      dominantCards: [],
    };
  }

  const suitsList = [SUITS.SPADES, SUITS.HEARTS, SUITS.DIAMONDS, SUITS.CLUBS];
  const suitCards = {
    [SUITS.SPADES]: [],
    [SUITS.HEARTS]: [],
    [SUITS.DIAMONDS]: [],
    [SUITS.CLUBS]: [],
  };

  // Group cards by suit
  hand.forEach((card) => {
    if (suitCards[card.suit]) {
      suitCards[card.suit].push(card);
    }
  });

  const totalHandPoints = hand.reduce((sum, c) => sum + getCardValue41(c), 0);
  const suitBreakdown = {};
  let bestSuit = null;
  let bestScore = -Infinity;
  let dominantCards = [];

  for (const suit of suitsList) {
    const cardsOfSuit = suitCards[suit];
    const suitPoints = cardsOfSuit.reduce((sum, c) => sum + getCardValue41(c), 0);
    const otherPoints = totalHandPoints - suitPoints;
    const netScore = suitPoints - otherPoints;

    suitBreakdown[suit] = {
      count: cardsOfSuit.length,
      points: suitPoints,
      penalty: otherPoints,
      netScore,
      cards: cardsOfSuit,
    };

    if (netScore > bestScore) {
      bestScore = netScore;
      bestSuit = suit;
      dominantCards = cardsOfSuit;
    } else if (netScore === bestScore) {
      // Tie breaker: suit with more cards wins
      if (cardsOfSuit.length > (suitBreakdown[bestSuit]?.count || 0)) {
        bestSuit = suit;
        dominantCards = cardsOfSuit;
      }
    }
  }

  // 41 Murni: exactly 4 cards, all of the same suit, and bestScore === 41
  const is41 = hand.length === 4 && dominantCards.length === 4 && bestScore === 41;

  return {
    bestSuit,
    bestScore: bestScore === -Infinity ? 0 : bestScore,
    is41,
    suitBreakdown,
    dominantCards,
  };
}

/**
 * Ranks all players and determines winner(s) at end of game.
 * @param {Array<Object>} players 
 * @param {Object} hands { [playerId]: Array<Card> }
 * @returns {Array<Object>} Ranked leaderboard with detailed score breakdowns
 */
export function determineWinners41(players = [], hands = {}) {
  const playerScores = players.map((p) => {
    const playerHand = hands[p.id] || [];
    const evaluation = calculateHandScore41(playerHand);

    return {
      player: p,
      hand: playerHand,
      score: evaluation.bestScore,
      is41: evaluation.is41,
      bestSuit: evaluation.bestSuit,
      dominantCount: evaluation.dominantCards.length,
      evaluation,
    };
  });

  // Sort: 41 Murni first, then highest net score, then most cards of dominant suit
  playerScores.sort((a, b) => {
    if (a.is41 && !b.is41) return -1;
    if (!a.is41 && b.is41) return 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.dominantCount - a.dominantCount;
  });

  const winner = playerScores[0] || null;

  return {
    winner,
    rankings: playerScores,
  };
}
