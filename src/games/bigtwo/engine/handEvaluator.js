/**
 * HAND EVALUATOR FOR BIG TWO (CAPSA BANTING)
 * 
 * Rules supported:
 * 1. Single (1 kartu)
 * 2. Pair (2 kartu bernilai sama)
 * 3. Triple (3 kartu bernilai sama)
 * 4. STRICT RULE: Double Pair DILARANG (2 pair / 4 kartu tidak boleh dikeluarkan)
 * 5. STRICT RULE: Bomb 4 kartu DILARANG. Four of a Kind WAJIB 5 kartu (4 kembar + 1 kartu buangan)
 * 6. 5-Card Poker Hands: Straight < Flush < Full House < Four of a Kind (+1 kicker) < Straight Flush < Royal Flush
 */

import {
  BIGTWO_RANK_VALUES,
  BIGTWO_SUIT_VALUES,
  HAND_TYPE_BIGTWO,
  FIVE_CARD_TIER,
} from './constants.js';

/**
 * Returns Big Two rank value (3=3 ... King=13, Ace=14, Two=15)
 */
export function getCardRank(card) {
  if (!card) return 0;
  if (card.rank === 1) return 14; // Ace
  if (card.rank === 2) return 15; // Two (Tertinggi)
  return card.rank;
}

/**
 * Returns suit weight (diamonds=1, clubs=2, hearts=3, spades=4)
 */
export function getCardSuitValue(card) {
  if (!card) return 0;
  return BIGTWO_SUIT_VALUES[card.suit] || 0;
}

/**
 * Sorts cards in ascending order for Big Two:
 * First by Big Two rank (3..2), then by suit (♦..♠)
 */
export function sortBigTwoCards(cards = []) {
  return [...cards].sort((a, b) => {
    const rankDiff = getCardRank(a) - getCardRank(b);
    if (rankDiff !== 0) return rankDiff;
    return getCardSuitValue(a) - getCardSuitValue(b);
  });
}

/**
 * Compares two single cards.
 * Returns > 0 if a > b, < 0 if a < b, 0 if identical.
 */
export function compareSingleCard(a, b) {
  const rankDiff = getCardRank(a) - getCardRank(b);
  if (rankDiff !== 0) return rankDiff;
  return getCardSuitValue(a) - getCardSuitValue(b);
}

/**
 * Evaluates whether a set of cards forms a valid Big Two combination.
 * 
 * @param {Array<Object>} rawCards 
 * @returns {Object} { isValid, type, tier, primaryRank, highestCard, label, error }
 */
export function evaluateCombo(rawCards = []) {
  if (!rawCards || rawCards.length === 0) {
    return { isValid: false, type: HAND_TYPE_BIGTWO.INVALID, error: 'Pilih kartu terlebih dahulu.' };
  }

  const cards = sortBigTwoCards(rawCards);
  const count = cards.length;

  // ---------------------------------------------------------------------------
  // 1. SINGLE (1 KARTU)
  // ---------------------------------------------------------------------------
  if (count === 1) {
    const card = cards[0];
    return {
      isValid: true,
      type: HAND_TYPE_BIGTWO.SINGLE,
      cards,
      primaryRank: getCardRank(card),
      highestCard: card,
      label: `Single ${card.label || card.rank}${card.symbol || ''}`,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. PAIR (2 KARTU ANGKA SAMA)
  // ---------------------------------------------------------------------------
  if (count === 2) {
    if (getCardRank(cards[0]) === getCardRank(cards[1])) {
      const highestCard = cards[1]; // Already sorted, last card has higher suit
      return {
        isValid: true,
        type: HAND_TYPE_BIGTWO.PAIR,
        cards,
        primaryRank: getCardRank(cards[0]),
        highestCard,
        label: `Pair ${cards[0].label || cards[0].rank}`,
      };
    }
    return {
      isValid: false,
      type: HAND_TYPE_BIGTWO.INVALID,
      error: '2 kartu harus bernilai sama (Pair).',
    };
  }

  // ---------------------------------------------------------------------------
  // 3. TRIPLE / THREE OF A KIND (3 KARTU ANGKA SAMA)
  // ---------------------------------------------------------------------------
  if (count === 3) {
    if (
      getCardRank(cards[0]) === getCardRank(cards[1]) &&
      getCardRank(cards[1]) === getCardRank(cards[2])
    ) {
      return {
        isValid: true,
        type: HAND_TYPE_BIGTWO.TRIPLE,
        cards,
        primaryRank: getCardRank(cards[0]),
        highestCard: cards[2],
        label: `Triple ${cards[0].label || cards[0].rank}`,
      };
    }
    return {
      isValid: false,
      type: HAND_TYPE_BIGTWO.INVALID,
      error: '3 kartu harus bernilai sama (Triple).',
    };
  }

  // ---------------------------------------------------------------------------
  // 4 KARTU: PENOLAKAN EKSPLISIT SESUAI ATURAN USER
  // Rule 2: "tidak boleh mengeluarkan double pair"
  // Rule 3: "tidak boleh mengeluarkan bomb (4 kartu yang sama) hanya four of a kind aja"
  // ---------------------------------------------------------------------------
  if (count === 4) {
    const rankMap = {};
    cards.forEach((c) => {
      const r = getCardRank(c);
      rankMap[r] = (rankMap[r] || 0) + 1;
    });
    const counts = Object.values(rankMap);

    if (counts.includes(4)) {
      return {
        isValid: false,
        type: HAND_TYPE_BIGTWO.INVALID,
        error: 'Bomb 4 kartu tidak diperbolehkan! Four of a Kind harus 5 kartu (4 kembar + 1 kartu buangan).',
      };
    }

    if (counts.filter((cnt) => cnt === 2).length === 2) {
      return {
        isValid: false,
        type: HAND_TYPE_BIGTWO.INVALID,
        error: 'Double Pair tidak diperbolehkan! Kombinasi yang sah adalah Single, Pair, Triple, atau kombinasi 5 kartu.',
      };
    }

    return {
      isValid: false,
      type: HAND_TYPE_BIGTWO.INVALID,
      error: 'Kombinasi 4 kartu tidak diperbolehkan. Gunakan 1, 2, 3, atau 5 kartu.',
    };
  }

  // ---------------------------------------------------------------------------
  // 5. KOMBINASI 5 KARTU (5-CARD POKER HANDS)
  // ---------------------------------------------------------------------------
  if (count === 5) {
    return evaluateFiveCardHand(cards);
  }

  return {
    isValid: false,
    type: HAND_TYPE_BIGTWO.INVALID,
    error: `Jumlah kartu (${count}) tidak valid. Gunakan 1, 2, 3, atau 5 kartu.`,
  };
}

/**
 * Evaluates 5-Card Poker Hands for Big Two
 */
function evaluateFiveCardHand(cards) {
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  // Group by Big Two rank
  const rankCount = {};
  cards.forEach((c) => {
    const r = getCardRank(c);
    rankCount[r] = (rankCount[r] || 0) + 1;
  });
  const uniqueRanks = Object.keys(rankCount).map(Number);
  const counts = Object.values(rankCount).sort((a, b) => b - a);

  // Check Straight
  // In Big Two, consecutive sequences can be:
  // 3-4-5-6-7, 4-5-6-7-8, ..., 10-J-Q-K-A, J-Q-K-A-2, A-2-3-4-5
  const ranksSorted = cards.map((c) => getCardRank(c));
  let isStraight = false;
  let straightHighestCard = cards[4];

  // Standard consecutive sequence (e.g. 3-4-5-6-7 or 8-9-10-J-Q)
  if (
    uniqueRanks.length === 5 &&
    ranksSorted[4] - ranksSorted[0] === 4 &&
    ranksSorted[1] - ranksSorted[0] === 1 &&
    ranksSorted[2] - ranksSorted[1] === 1 &&
    ranksSorted[3] - ranksSorted[2] === 1
  ) {
    isStraight = true;
    straightHighestCard = cards[4];
  } else if (
    // Wheel sequences with 2 and A:
    // A-2-3-4-5 -> Big Two ranks: [3, 4, 5, 14, 15]
    uniqueRanks.length === 5 &&
    ranksSorted[0] === 3 &&
    ranksSorted[1] === 4 &&
    ranksSorted[2] === 5 &&
    ranksSorted[3] === 14 &&
    ranksSorted[4] === 15
  ) {
    isStraight = true;
    straightHighestCard = cards[4]; // Two is highest
  } else if (
    // 2-3-4-5-6 -> Big Two ranks: [3, 4, 5, 6, 15]
    uniqueRanks.length === 5 &&
    ranksSorted[0] === 3 &&
    ranksSorted[1] === 4 &&
    ranksSorted[2] === 5 &&
    ranksSorted[3] === 6 &&
    ranksSorted[4] === 15
  ) {
    isStraight = true;
    straightHighestCard = cards[4]; // Two is highest
  }

  // 5.1. ROYAL FLUSH (10-J-Q-K-A of the same suit)
  if (
    isFlush &&
    uniqueRanks.length === 5 &&
    ranksSorted[0] === 10 &&
    ranksSorted[1] === 11 &&
    ranksSorted[2] === 12 &&
    ranksSorted[3] === 13 &&
    ranksSorted[4] === 14
  ) {
    return {
      isValid: true,
      type: HAND_TYPE_BIGTWO.ROYAL_FLUSH,
      tier: FIVE_CARD_TIER[HAND_TYPE_BIGTWO.ROYAL_FLUSH],
      cards,
      primaryRank: 14,
      highestCard: cards[4],
      suitValue: getCardSuitValue(cards[4]),
      label: `Royal Flush ${cards[4].suit.toUpperCase()}`,
    };
  }

  // 5.2. STRAIGHT FLUSH (5 kartu berurutan satu suit)
  if (isStraight && isFlush) {
    return {
      isValid: true,
      type: HAND_TYPE_BIGTWO.STRAIGHT_FLUSH,
      tier: FIVE_CARD_TIER[HAND_TYPE_BIGTWO.STRAIGHT_FLUSH],
      cards,
      primaryRank: getCardRank(straightHighestCard),
      highestCard: straightHighestCard,
      suitValue: getCardSuitValue(straightHighestCard),
      label: `Straight Flush ${straightHighestCard.label || straightHighestCard.rank} tinggi (${straightHighestCard.suit})`,
    };
  }

  // 5.3. FOUR OF A KIND (4 kembar + 1 kicker buangan)
  if (counts[0] === 4) {
    const quadRank = uniqueRanks.find((r) => rankCount[r] === 4);
    const kickerRank = uniqueRanks.find((r) => rankCount[r] === 1);
    const quadCards = cards.filter((c) => getCardRank(c) === quadRank);
    const kickerCard = cards.find((c) => getCardRank(c) === kickerRank);

    return {
      isValid: true,
      type: HAND_TYPE_BIGTWO.FOUR_OF_A_KIND,
      tier: FIVE_CARD_TIER[HAND_TYPE_BIGTWO.FOUR_OF_A_KIND],
      cards,
      primaryRank: quadRank,
      highestCard: quadCards[3], // Highest of the 4 cards
      kickerCard,
      label: `Four of a Kind ${quadCards[0].label || quadRank} (+${kickerCard.label || kickerRank})`,
    };
  }

  // 5.4. FULL HOUSE (3 kembar + 1 pair)
  if (counts[0] === 3 && counts[1] === 2) {
    const tripleRank = uniqueRanks.find((r) => rankCount[r] === 3);
    const tripleCards = cards.filter((c) => getCardRank(c) === tripleRank);
    const pairRank = uniqueRanks.find((r) => rankCount[r] === 2);

    return {
      isValid: true,
      type: HAND_TYPE_BIGTWO.FULL_HOUSE,
      tier: FIVE_CARD_TIER[HAND_TYPE_BIGTWO.FULL_HOUSE],
      cards,
      primaryRank: tripleRank,
      highestCard: tripleCards[2],
      label: `Full House ${tripleCards[0].label || tripleRank} over ${pairRank}`,
    };
  }

  // 5.5. FLUSH (5 kartu suit sama)
  if (isFlush) {
    const highestCard = cards[4];
    return {
      isValid: true,
      type: HAND_TYPE_BIGTWO.FLUSH,
      tier: FIVE_CARD_TIER[HAND_TYPE_BIGTWO.FLUSH],
      cards,
      primaryRank: getCardRank(highestCard),
      highestCard,
      suitValue: getCardSuitValue(highestCard),
      label: `Flush ${highestCard.suit.toUpperCase()} (Tinggi ${highestCard.label || highestCard.rank})`,
    };
  }

  // 5.6. STRAIGHT (5 kartu berurutan)
  if (isStraight) {
    return {
      isValid: true,
      type: HAND_TYPE_BIGTWO.STRAIGHT,
      tier: FIVE_CARD_TIER[HAND_TYPE_BIGTWO.STRAIGHT],
      cards,
      primaryRank: getCardRank(straightHighestCard),
      highestCard: straightHighestCard,
      suitValue: getCardSuitValue(straightHighestCard),
      label: `Straight (Tinggi ${straightHighestCard.label || straightHighestCard.rank}${straightHighestCard.symbol || ''})`,
    };
  }

  return {
    isValid: false,
    type: HAND_TYPE_BIGTWO.INVALID,
    error: 'Bukan kombinasi 5 kartu yang sah (harus Straight, Flush, Full House, Four of a Kind, atau Straight Flush).',
  };
}

/**
 * Checks if newCombo can beat tableCombo.
 * 
 * @param {Object} newCombo 
 * @param {Object} tableCombo 
 * @returns {{ canBeat: boolean, reason?: string }}
 */
export function canBeatCombo(newCombo, tableCombo) {
  if (!newCombo || !newCombo.isValid) {
    return { canBeat: false, reason: newCombo?.error || 'Kombinasi kartu tidak valid.' };
  }

  // Free turn (table is empty): any valid combo can be played
  if (!tableCombo || !tableCombo.cards || tableCombo.cards.length === 0) {
    return { canBeat: true };
  }

  // Must match the exact number of cards on table
  if (newCombo.cards.length !== tableCombo.cards.length) {
    return {
      canBeat: false,
      reason: `Harus mengeluarkan ${tableCombo.cards.length} kartu sesuai meja!`,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. SINGLE VS SINGLE
  // ---------------------------------------------------------------------------
  if (tableCombo.type === HAND_TYPE_BIGTWO.SINGLE) {
    const diff = compareSingleCard(newCombo.highestCard, tableCombo.highestCard);
    if (diff > 0) return { canBeat: true };
    return {
      canBeat: false,
      reason: `Kartu ${newCombo.highestCard.label}${newCombo.highestCard.symbol} tidak cukup tinggi untuk mengalahkan ${tableCombo.highestCard.label}${tableCombo.highestCard.symbol}.`,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. PAIR VS PAIR
  // ---------------------------------------------------------------------------
  if (tableCombo.type === HAND_TYPE_BIGTWO.PAIR) {
    if (newCombo.type !== HAND_TYPE_BIGTWO.PAIR) {
      return { canBeat: false, reason: 'Harus mengeluarkan Pair untuk melawan Pair di meja!' };
    }
    const rankDiff = newCombo.primaryRank - tableCombo.primaryRank;
    if (rankDiff > 0) return { canBeat: true };
    if (rankDiff === 0) {
      // In same rank (e.g. Double Deck, or suit comparison): compare highest card's suit
      const suitDiff = getCardSuitValue(newCombo.highestCard) - getCardSuitValue(tableCombo.highestCard);
      if (suitDiff > 0) return { canBeat: true };
    }
    return {
      canBeat: false,
      reason: `${newCombo.label} tidak cukup tinggi untuk mengalahkan ${tableCombo.label}.`,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. TRIPLE VS TRIPLE
  // ---------------------------------------------------------------------------
  if (tableCombo.type === HAND_TYPE_BIGTWO.TRIPLE) {
    if (newCombo.type !== HAND_TYPE_BIGTWO.TRIPLE) {
      return { canBeat: false, reason: 'Harus mengeluarkan Triple untuk melawan Triple di meja!' };
    }
    const rankDiff = newCombo.primaryRank - tableCombo.primaryRank;
    if (rankDiff > 0) return { canBeat: true };
    if (rankDiff === 0) {
      const suitDiff = getCardSuitValue(newCombo.highestCard) - getCardSuitValue(tableCombo.highestCard);
      if (suitDiff > 0) return { canBeat: true };
    }
    return {
      canBeat: false,
      reason: `${newCombo.label} tidak cukup tinggi untuk mengalahkan ${tableCombo.label}.`,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. 5-CARD HAND VS 5-CARD HAND
  // Straight < Flush < Full House < Four of a Kind < Straight Flush < Royal Flush
  // ---------------------------------------------------------------------------
  if (newCombo.cards.length === 5 && tableCombo.cards.length === 5) {
    const newTier = FIVE_CARD_TIER[newCombo.type] || 0;
    const tableTier = FIVE_CARD_TIER[tableCombo.type] || 0;

    // Higher tier combination beats lower tier directly
    if (newTier > tableTier) {
      return { canBeat: true };
    }
    if (newTier < tableTier) {
      return {
        canBeat: false,
        reason: `${newCombo.type} kalah tingkat dari ${tableCombo.type} di meja.`,
      };
    }

    // Identical tier: compare within the same hand type
    // A. STRAIGHT VS STRAIGHT
    if (newCombo.type === HAND_TYPE_BIGTWO.STRAIGHT) {
      const diff = compareSingleCard(newCombo.highestCard, tableCombo.highestCard);
      if (diff > 0) return { canBeat: true };
      return { canBeat: false, reason: 'Straight lawan lebih tinggi.' };
    }

    // B. FLUSH VS FLUSH (Ranked by suit first, then highest card)
    if (newCombo.type === HAND_TYPE_BIGTWO.FLUSH) {
      const suitDiff = (newCombo.suitValue || 0) - (tableCombo.suitValue || 0);
      if (suitDiff > 0) return { canBeat: true };
      if (suitDiff < 0) return { canBeat: false, reason: 'Suit flush lawan lebih tinggi.' };
      const diff = compareSingleCard(newCombo.highestCard, tableCombo.highestCard);
      if (diff > 0) return { canBeat: true };
      return { canBeat: false, reason: 'Flush lawan memiliki kartu lebih tinggi.' };
    }

    // C. FULL HOUSE VS FULL HOUSE (Ranked by triple rank)
    if (newCombo.type === HAND_TYPE_BIGTWO.FULL_HOUSE) {
      const rankDiff = newCombo.primaryRank - tableCombo.primaryRank;
      if (rankDiff > 0) return { canBeat: true };
      return { canBeat: false, reason: 'Full House lawan memiliki Triple yang lebih tinggi.' };
    }

    // D. FOUR OF A KIND VS FOUR OF A KIND (Ranked by quad rank)
    if (newCombo.type === HAND_TYPE_BIGTWO.FOUR_OF_A_KIND) {
      const rankDiff = newCombo.primaryRank - tableCombo.primaryRank;
      if (rankDiff > 0) return { canBeat: true };
      return { canBeat: false, reason: 'Four of a Kind lawan memiliki angka 4 kembar yang lebih tinggi.' };
    }

    // E. STRAIGHT FLUSH VS STRAIGHT FLUSH
    if (newCombo.type === HAND_TYPE_BIGTWO.STRAIGHT_FLUSH || newCombo.type === HAND_TYPE_BIGTWO.ROYAL_FLUSH) {
      const diff = compareSingleCard(newCombo.highestCard, tableCombo.highestCard);
      if (diff > 0) return { canBeat: true };
      return { canBeat: false, reason: 'Straight Flush lawan lebih tinggi.' };
    }
  }

  return { canBeat: false, reason: 'Kombinasi kartu tidak dapat mengalahkan meja.' };
}
