/**
 * BOT AI (SINGLE PLAYER MODE)
 * Pure decision functions for computer-controlled players in all 3 games.
 * Bots only READ game state and return a move; the App applies the move
 * through the same engine functions a human uses, so rules are always enforced.
 */

import { getValidMoves } from './rules.js';
import { getCardBasePenalty } from './scoring.js';
import { calculateHandScore41 } from '../games/game41/engine/scoring41.js';
import { TURN_PHASE_41, DRAW_SOURCE_41 } from '../games/game41/engine/constants41.js';
import {
  evaluateCombo,
  canBeatCombo,
  sortBigTwoCards,
  getCardRank,
} from '../games/bigtwo/engine/handEvaluator.js';

// ---------------------------------------------------------------------------
// ROSTER
// ---------------------------------------------------------------------------
export const SINGLE_HUMAN_ID = 'player_1';

const SEATS = ['bottom', 'left', 'top', 'right', 'seat_5', 'seat_6'];
const BOT_NAMES = ['Bot Raka', 'Bot Sinta', 'Bot Dimas', 'Bot Maya', 'Bot Joko'];
const BOT_AVATARS = ['🤖', '👾', '🦾', '🎯', '🧠'];

/**
 * Builds a roster of 1 human (always player_1) + N bots.
 * @param {number} totalPlayers 2..6
 */
export function createSinglePlayerRoster(totalPlayers = 2) {
  const count = Math.max(2, Math.min(6, Number(totalPlayers) || 2));
  return Array.from({ length: count }, (_, idx) => {
    if (idx === 0) {
      return {
        id: SINGLE_HUMAN_ID,
        name: 'Anda',
        seat: SEATS[0],
        avatar: '👑',
        isHuman: true,
        isBot: false,
        isHost: true,
      };
    }
    return {
      id: `bot_${idx}`,
      name: BOT_NAMES[idx - 1],
      seat: SEATS[idx],
      avatar: BOT_AVATARS[idx - 1],
      isHuman: false,
      isBot: true,
      isHost: false,
    };
  });
}

export function isBotPlayer(gameState, playerId) {
  if (!playerId) return false;
  const p = gameState?.players?.find((pl) => pl.id === playerId);
  if (p) {
    if (p.isBot === true) return true;
    if (p.isHuman === false) return true;
    if (p.isBotTakeover === true) return true;
  }
  return String(playerId).startsWith('bot_');
}

// ---------------------------------------------------------------------------
// SEVENS (TUJUH SEKOP)
// ---------------------------------------------------------------------------
/**
 * Returns { action: 'play', card, direction } or { action: 'close', card }.
 * Strategy: play the card that "unlocks" the most of its own follow-up cards
 * (keeps the bot's own sequences flowing). If no legal move, close the card
 * with the smallest penalty.
 */
export function chooseSevensBotMove(gameState, botId) {
  const hand = gameState.hands?.[botId] || [];
  if (hand.length === 0) return null;

  const valid = getValidMoves(gameState, botId);
  const nonAce = valid.filter((c) => c.rank !== 1);
  const candidates = nonAce.length > 0 ? nonAce : valid;

  if (candidates.length > 0) {
    let best = null;
    let bestScore = -Infinity;
    for (const card of candidates) {
      // Count own cards further along the same direction of this suit
      const sameSuit = hand.filter((c) => c.suit === card.suit && c.rank !== card.rank);
      let follow = 0;
      if (card.rank === 7) {
        follow = sameSuit.length;
      } else if (card.rank > 7) {
        follow = sameSuit.filter((c) => c.rank > card.rank || c.rank === 1).length;
      } else if (card.rank !== 1) {
        follow = sameSuit.filter((c) => c.rank < card.rank).length;
      }
      // Prefer getting rid of high-penalty cards slightly, add a bit of randomness
      const penalty = Math.abs(getCardBasePenalty(card, gameState.config || {}, gameState.globalAceDirection));
      const score = follow * 10 + penalty * 0.5 + Math.random();
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }

    let direction = null;
    if (best.rank === 1) {
      const sb = gameState.board[best.suit];
      const canTop = sb.maxRank === 13;
      const canBottom = sb.minRank === 2;
      direction = canTop ? 'top' : canBottom ? 'bottom' : null;
    }
    return { action: 'play', card: best, direction };
  }

  // No legal move: close the cheapest card
  let cheapest = hand[0];
  let cheapestPenalty = Infinity;
  for (const card of hand) {
    const pen = Math.abs(getCardBasePenalty(card, gameState.config || {}, gameState.globalAceDirection));
    if (pen < cheapestPenalty) {
      cheapestPenalty = pen;
      cheapest = card;
    }
  }
  return { action: 'close', card: cheapest };
}

// ---------------------------------------------------------------------------
// REMI 41
// ---------------------------------------------------------------------------
function bestScoreAfterDiscard(hand) {
  let best = { score: -Infinity, discard: hand[0] };
  for (let i = 0; i < hand.length; i++) {
    const remaining = hand.filter((_, idx) => idx !== i);
    const { bestScore } = calculateHandScore41(remaining);
    if (bestScore > best.score) best = { score: bestScore, discard: hand[i] };
  }
  return best;
}

/**
 * Returns { action: 'draw', source } or { action: 'discard', card }.
 */
export function chooseGame41BotMove(gameState, botId) {
  const hand = gameState.hands?.[botId] || [];

  if (gameState.turnPhase === TURN_PHASE_41.DRAW) {
    const passed = gameState.passedDiscard;
    const canTakeDiscard = passed?.card && (!passed.toPlayerId || passed.toPlayerId === botId);
    const stockEmpty = !gameState.drawPile || gameState.drawPile.length === 0;

    if (canTakeDiscard) {
      if (stockEmpty) return { action: 'draw', source: DRAW_SOURCE_41.DISCARD };
      const currentScore = calculateHandScore41(hand).bestScore;
      const withDiscard = bestScoreAfterDiscard([...hand, passed.card]).score;
      // Take the passed card only if it clearly improves the hand
      if (withDiscard > currentScore + 1) {
        return { action: 'draw', source: DRAW_SOURCE_41.DISCARD };
      }
    }
    return { action: 'draw', source: DRAW_SOURCE_41.STOCK };
  }

  // DISCARD phase: drop the card whose removal keeps the highest score
  const best = bestScoreAfterDiscard(hand);
  const currentRound = gameState.currentRound || Math.floor(((gameState.turnNumber || 1) - 1) / (gameState.players?.length || 4)) + 1;
  if (best.score >= 34 && currentRound >= 4) {
    return { action: 'closeHand', card: best.discard };
  }
  return { action: 'discard', card: best.discard };
}

// ---------------------------------------------------------------------------
// BIG TWO (CAPSA BANTING)
// ---------------------------------------------------------------------------
function combinations(arr, k, mustInclude = null) {
  const result = [];
  const pool = mustInclude ? arr.filter((c) => c !== mustInclude) : arr;
  const need = mustInclude ? k - 1 : k;
  const pick = [];
  const recurse = (start) => {
    if (pick.length === need) {
      result.push(mustInclude ? [mustInclude, ...pick] : [...pick]);
      return;
    }
    for (let i = start; i <= pool.length - (need - pick.length); i++) {
      pick.push(pool[i]);
      recurse(i + 1);
      pick.pop();
    }
  };
  recurse(0);
  return result;
}

function groupByRank(hand) {
  const map = {};
  hand.forEach((c) => {
    const r = getCardRank(c);
    (map[r] = map[r] || []).push(c);
  });
  return map;
}

/** All valid combos of a given size, optionally containing a specific card */
function generateCombos(hand, size, mustInclude = null) {
  const out = [];
  if (size === 1) {
    (mustInclude ? [mustInclude] : hand).forEach((c) => out.push(evaluateCombo([c])));
  } else if (size === 2 || size === 3) {
    Object.values(groupByRank(hand)).forEach((group) => {
      if (group.length < size) return;
      combinations(group, size).forEach((set) => {
        if (mustInclude && !set.includes(mustInclude)) return;
        out.push(evaluateCombo(set));
      });
    });
  } else if (size === 5 && hand.length >= 5) {
    combinations(hand, 5, mustInclude).forEach((set) => out.push(evaluateCombo(set)));
  }
  return out.filter((c) => c.isValid);
}

/** Picks the weakest combo from a list (using engine's own comparator) */
function weakest(combos) {
  let best = null;
  for (const c of combos) {
    if (!best) best = c;
    else if (canBeatCombo(best, c).canBeat) best = c;
  }
  return best;
}

function isTwo(card) {
  return getCardRank(card) === 15 || card.rank === 2;
}

/**
 * Checks if playing this combo would violate Rule 1 or trap the bot into violating Rule 1:
 * - Finishing with a 2 (selected has 2 and empties hand) -> automatic loss!
 * - Leaving ONLY 2s in hand (leaves 1 or more cards, all of which are 2) -> will force finishing with 2 later and lose!
 */
function isSuicidalRule1Move(hand, comboCards) {
  const remaining = hand.filter(
    (c) => !comboCards.some((sc) => sc.id === c.id || (sc.rank === c.rank && sc.suit === c.suit))
  );
  // Finishing with a 2 causes immediate loss
  if (remaining.length === 0 && comboCards.some(isTwo)) {
    return true;
  }
  // Leaving only 2s in hand traps player into finishing with a 2 later
  if (remaining.length > 0 && remaining.every(isTwo)) {
    return true;
  }
  return false;
}

/**
 * Returns { action: 'play', cards } or { action: 'pass' }.
 */
export function chooseBigTwoBotMove(gameState, botId) {
  const hand = sortBigTwoCards(gameState.hands?.[botId] || []);
  if (hand.length === 0) return { action: 'pass' };

  // If bot already passed in this trick, it cannot move (Rule 2)
  if (gameState.passedPlayers?.includes(botId)) {
    return { action: 'pass' };
  }

  const tableCombo = gameState.currentTrick?.combo || null;
  const isFreeTurn = !tableCombo || !gameState.currentTrick?.cards?.length;

  // FREE TURN:
  if (isFreeTurn) {
    // If bot has a 2 and other non-2 cards, and hand is very small (2-3 cards),
    // prioritize getting rid of the 2 so it is NOT the last card!
    const twos = hand.filter(isTwo);
    const nonTwos = hand.filter((c) => !isTwo(c));

    if (twos.length > 0 && nonTwos.length > 0 && hand.length <= 3) {
      // Dump the 2 now to stay safe!
      return { action: 'play', cards: [twos[0]] };
    }

    let anchor = hand[0];
    if (gameState.isFirstPlayOfGame && gameState.config?.starterCardMandatory && gameState.lowestCard) {
      anchor =
        hand.find(
          (c) => getCardRank(c) === getCardRank(gameState.lowestCard) && c.suit === gameState.lowestCard.suit
        ) || hand[0];
    }

    for (const size of [5, 3, 2]) {
      const combos = generateCombos(hand, size, anchor).filter(
        (c) => !isSuicidalRule1Move(hand, c.cards)
      );
      if (combos.length > 0) return { action: 'play', cards: weakest(combos).cards };
    }

    // Single card lead: pick lowest card that is not suicidal
    const nonSuicidalSingles = hand.filter((c) => !isSuicidalRule1Move(hand, [c]));
    if (nonSuicidalSingles.length > 0) {
      // If anchor is in nonSuicidalSingles, play anchor, else weakest non-suicidal
      const pick = nonSuicidalSingles.includes(anchor) ? anchor : nonSuicidalSingles[0];
      return { action: 'play', cards: [pick] };
    }

    return { action: 'play', cards: [anchor] };
  }

  // RESPOND: same size, must beat table, choose the weakest that beats it
  const size = gameState.currentTrick.cards.length;
  const beating = generateCombos(hand, size).filter((c) => canBeatCombo(c, tableCombo).canBeat);
  if (beating.length === 0) return { action: 'pass' };

  // Filter out suicidal moves (Rule 1: don't leave only 2s and don't finish with 2)
  const safeBeating = beating.filter((c) => !isSuicidalRule1Move(hand, c.cards));

  // If all beating moves are suicidal, choose to pass instead of losing!
  if (safeBeating.length === 0) {
    return { action: 'pass' };
  }

  const choice = weakest(safeBeating);
  // Save "2" cards early in the game unless we're close to finishing
  if (choice.cards.some(isTwo) && hand.length > 6 && Math.random() < 0.5) {
    return { action: 'pass' };
  }
  return { action: 'play', cards: choice.cards };
}
