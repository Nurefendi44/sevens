/**
 * SEVENS SCORING & PENALTY ENGINE
 * Contains logic for:
 * - Base closed cards scoring
 * - RULE 6: Penalti kartu 6 (-60) & 8 (-80) saat As ditutup
 * - Fault penalty deductions
 */

import { DEFAULT_CONFIG } from './config.js';

/**
 * Calculates base penalty points for a single closed card.
 * @param {Object} card 
 * @param {Object} config 
 * @returns {number} Negative penalty value
 */
export function getCardBasePenalty(card, config = DEFAULT_CONFIG, globalAceDirection = null) {
  const multiplier = config.closedCardMultiplier !== undefined ? config.closedCardMultiplier : -1;

  if (config.closedCardScoringMode === 'flat_ten') {
    return -10;
  }

  // Nilai As untuk scoring ditentukan oleh arah Tutup Rangkai global:
  // Tutup Rangkai ATAS: J -> Q -> K -> A maka kartu As ditutup bernilai -11
  // Tutup Rangkai BAWAH: A -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 maka kartu As ditutup bernilai -1
  let faceValue = card.rank;
  if (card.rank === 1) {
    if (globalAceDirection === 'top') {
      faceValue = 11;
    } else if (globalAceDirection === 'bottom') {
      faceValue = 1;
    } else {
      faceValue = config.aceDefaultValue !== undefined ? config.aceDefaultValue : 11;
    }
  }

  return faceValue * multiplier;
}

/**
 * RULE 6: Evaluates penalties for holding card 6 and 8 when an Ace has been closed.
 * 
 * Configurable parameters:
 * - config.penalty6: default -60
 * - config.penalty8: default -80
 * - config.penalty68Scope: 'same_suit' | 'all_suits'
 * - config.penalty68EvaluationMode: 'held_when_ace_closed' | 'unplayed_at_end'
 * 
 * @param {Object} gameState 
 * @param {string} playerId 
 * @param {Object} config 
 * @returns {{ penaltyTotal: number, items: Array<Object> }}
 */
export function evaluateRule6Penalties(gameState, playerId, config = DEFAULT_CONFIG) {
  const { aceClosedEvents = [], hands, closedCards } = gameState;
  const items = [];

  if (aceClosedEvents.length === 0) {
    return { penaltyTotal: 0, items };
  }

  const penalty6Val = config.penalty6 !== undefined ? config.penalty6 : -60;
  const penalty8Val = config.penalty8 !== undefined ? config.penalty8 : -80;
  const scope = config.penalty68Scope || 'same_suit';
  const evalMode = config.penalty68EvaluationMode || 'held_when_ace_closed';

  if (evalMode === 'held_when_ace_closed') {
    // Check against the snapshots recorded at the time each Ace was closed
    for (const evt of aceClosedEvents) {
      const snapshot = evt.held68Snapshot?.[playerId] || [];
      for (const card of snapshot) {
        // Suit matching based on scope
        const isMatch = scope === 'all_suits' || card.suit === evt.suit;
        if (isMatch) {
          // Prevent duplicate penalty for same card
          const alreadyPenalized = items.some(it => it.card.suit === card.suit && it.card.rank === card.rank);
          if (!alreadyPenalized) {
            const amount = card.rank === 6 ? penalty6Val : penalty8Val;
            items.push({
              card,
              amount,
              reason: `Kartu ${card.label}${card.symbol} di-keep saat As (${evt.aceCard.label}${evt.aceCard.symbol}) ditutup oleh ${evt.closedByName} (Turn ${evt.turn})`,
            });
          }
        }
      }
    }
  } else {
    // 'unplayed_at_end': check cards that were never played to board and either remain in hand or were closed
    const unplayedCards = [
      ...(hands[playerId] || []),
      ...(closedCards[playerId] || []),
    ];

    for (const evt of aceClosedEvents) {
      for (const card of unplayedCards) {
        if (card.rank === 6 || card.rank === 8) {
          const isMatch = scope === 'all_suits' || card.suit === evt.suit;
          if (isMatch) {
            const alreadyPenalized = items.some(it => it.card.suit === card.suit && it.card.rank === card.rank);
            if (!alreadyPenalized) {
              const amount = card.rank === 6 ? penalty6Val : penalty8Val;
              items.push({
                card,
                amount,
                reason: `Kartu ${card.label}${card.symbol} tidak pernah dimainkan setelah As (${evt.aceCard.label}${evt.aceCard.symbol}) ditutup`,
              });
            }
          }
        }
      }
    }
  }

  const penaltyTotal = items.reduce((sum, it) => sum + it.amount, 0);
  return { penaltyTotal, items };
}

/**
 * Calculates complete score breakdown for all players.
 * @param {Object} gameState 
 * @param {Object} customConfig 
 * @returns {Object} { [playerId]: ScoreBreakdown }
 */
export function calculateScore(gameState, customConfig) {
  const config = customConfig || gameState.config || DEFAULT_CONFIG;
  const {
    players,
    closedCards = {},
    faults = {},
    globalAceDirection = null,
    closureDirection = null,
    rule6Penalties = [],
  } = gameState;
  const activeDirection = globalAceDirection || closureDirection;
  const scores = {};

  players.forEach(player => {
    const pid = player.id;
    const playerClosed = closedCards[pid] || [];
    const playerFaults = faults[pid] || [];

    // 1. Base Closed Cards penalty (with Ace valued according to activeDirection)
    let baseClosedScore = 0;
    const closedCardBreakdown = playerClosed.map(card => {
      const penalty = getCardBasePenalty(card, config, activeDirection);
      baseClosedScore += penalty;
      return { card, penalty };
    });

    // 2. Rule 6 Penalties (6 & 8 kept when Tutup Rangkai occurs)
    const recordedRule6 = (rule6Penalties || []).filter(item => item.playerId === pid);
    const rule6FromEvents = evaluateRule6Penalties(gameState, pid, config);

    const rule6Items = recordedRule6.map(r => ({
      card: r.card,
      amount: r.penalty,
      reason: r.reason,
    }));

    for (const it of rule6FromEvents.items) {
      const exists = rule6Items.some(r => r.card?.suit === it.card?.suit && r.card?.rank === it.card?.rank);
      if (!exists) {
        rule6Items.push(it);
      }
    }

    const rule6PenaltyTotal = rule6Items.reduce((sum, it) => sum + it.amount, 0);

    // 3. Fault Penalties
    const faultScore = playerFaults.reduce((sum, f) => sum + (f.penalty !== undefined ? f.penalty : (config.faultPenalty !== undefined ? config.faultPenalty : 0)), 0);

    // Total Score
    const totalScore = baseClosedScore + rule6PenaltyTotal + faultScore;

    scores[pid] = {
      playerId: pid,
      playerName: player.name,
      totalScore,
      baseClosedScore,
      rule6PenaltyScore: rule6PenaltyTotal,
      faultScore,
      closedCardsCount: playerClosed.length,
      closedCards: closedCardBreakdown,
      rule6Details: rule6Items,
      faultsCount: playerFaults.length,
      faults: playerFaults,
    };
  });

  return scores;
}

/**
 * Evaluates winners based on highest total score (least penalties).
 * @param {Object} scores { [playerId]: ScoreBreakdown }
 * @returns {Array<string>} Array of winning player IDs (can be multiple if tie)
 */
export function determineWinners(scores) {
  const scoreEntries = Object.entries(scores);
  if (scoreEntries.length === 0) return [];

  let highestScore = -Infinity;
  scoreEntries.forEach(([_, data]) => {
    if (data.totalScore > highestScore) {
      highestScore = data.totalScore;
    }
  });

  return scoreEntries
    .filter(([_, data]) => data.totalScore === highestScore)
    .map(([pid]) => pid);
}
