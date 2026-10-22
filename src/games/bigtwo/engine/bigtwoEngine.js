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
  starterCardMandatory: false, // Kartu 3 tidak perlu dikeluarkan di awal (Giliran Bebas)
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

  // Find lowest card (for reference, but card 3 is no longer mandatory to start)
  let lowestCardFound = null;
  for (const p of players) {
    const playerHand = hands[p.id];
    for (const card of playerHand) {
      if (!lowestCardFound) {
        lowestCardFound = card;
      } else {
        const rankDiff = getCardRank(card) - getCardRank(lowestCardFound);
        if (rankDiff < 0 || (rankDiff === 0 && getCardSuitValue(card) < getCardSuitValue(lowestCardFound))) {
          lowestCardFound = card;
        }
      }
    }
  }

  // Determine starting player:
  // Random pick or explicit override (no longer forced to lowest card 3♦)
  let startingPlayerId = configOverrides.startingPlayerId;
  if (!startingPlayerId || !players.some((p) => p.id === startingPlayerId)) {
    const randomIdx = Math.floor(Math.random() * players.length);
    startingPlayerId = players[randomIdx].id;
  }

  const isFromPreviousWinner = Boolean(
    configOverrides.startingPlayerId && players.some((p) => p.id === configOverrides.startingPlayerId)
  );

  const startMessage = isFromPreviousWinner
    ? `Permainan Big Two baru dimulai. ${startingPlayer.name} (Pemenang game sebelumnya) memegang giliran awal (Meja Bebas)!`
    : `Permainan Big Two (Capsa Banting) dimulai (${playerCount} pemain, ${config.deckMode === 'double' ? 'Double Deck' : 'Single Deck'}). Giliran pertama ditentukan secara acak: ${startingPlayer.name} terpilih jalan pertama (Giliran Bebas)!`;

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
    passedPlayers: [], // Player IDs who have passed during the current trick/round
    isFirstPlayOfGame: true,
    lowestCard: lowestCardFound,
    currentPlayer: startingPlayerId,
    gameStatus: GAME_STATUS_BIGTWO.PLAYING,
    winner: null,
    disqualifiedPlayer: null,
    disqualifiedPlayerName: null,
    endReason: null,
    rankings: null,
    finishedPlayers: [], // [{ id, name, avatar, rank, remainingCards: 0 }]
    history: [
      {
        turn: 1,
        message: startMessage,
      },
    ],
  };

  return initialState;
}

/**
 * Finds the next player clockwise from currentId who has NOT passed in the current trick
 * and has NOT finished all their cards.
 * @param {Array<Object>} players 
 * @param {string} currentId 
 * @param {Array<string>} passedPlayerIds 
 * @param {Array<string>} finishedPlayerIds 
 * @returns {Object|null}
 */
export function getNextActivePlayer(players = [], currentId, passedPlayerIds = [], finishedPlayerIds = []) {
  if (!players || players.length === 0) return null;
  const count = players.length;
  const currentIdx = players.findIndex((p) => p.id === currentId);
  const startIdx = currentIdx === -1 ? 0 : currentIdx;

  for (let i = 1; i <= count; i++) {
    const candidate = players[(startIdx + i) % count];
    if (
      candidate.id !== currentId &&
      !finishedPlayerIds.includes(candidate.id) &&
      !passedPlayerIds.includes(candidate.id)
    ) {
      return candidate;
    }
  }
  return null;
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

  // Check if player's hand is empty (Finished all cards!)
  if (newPlayerHand.length === 0) {
    // RULE 1: Kartu angka 2 tidak boleh menjadi kartu terakhir yang dikeluarkan/dipegang!
    const hasTwoAsLastCard = selectedCards.some(
      (c) => c.rank === 2 || getCardRank(c) === 15
    );

    if (hasTwoAsLastCard) {
      // RULE 1 VIOLATION: Pemain mengeluarkan kartu 2 terakhir -> OTOMATIS KALAH!
      const otherPlayersRanked = gameState.players
        .filter((p) => p.id !== playerId)
        .map((p) => {
          const remaining = updatedHands[p.id]?.length || 0;
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            remainingCards: remaining,
            isWinner: false,
          };
        })
        .sort((a, b) => a.remainingCards - b.remainingCards);

      if (otherPlayersRanked.length > 0) {
        otherPlayersRanked[0].isWinner = true;
      }
      const actualWinner = otherPlayersRanked[0];

      const rankings = [
        ...otherPlayersRanked,
        {
          id: playerId,
          name: playerName,
          avatar: gameState.players.find((p) => p.id === playerId)?.avatar || '👤',
          remainingCards: 0,
          isWinner: false,
          isDisqualified: true,
          penaltyReason: 'Mengeluarkan Kartu 2 Terakhir (Dilarang)',
        },
      ];

      const actionPayload = {
        type: 'PLAY_COMBO',
        playerId,
        playerName,
        avatar: gameState.players.find((p) => p.id === playerId)?.avatar || '👤',
        cards: selectedCards,
        combo,
        isDisqualified: true,
        message: `⚠️ PELANGGARAN ATURAN: ${playerName} mengeluarkan kartu 2 sebagai kartu terakhir! ${playerName} OTOMATIS KALAH!`,
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
        winner: actualWinner?.id || null,
        disqualifiedPlayer: playerId,
        disqualifiedPlayerName: playerName,
        endReason: 'LAST_CARD_TWO_DISQUALIFICATION',
        rankings,
        history: [
          ...gameState.history,
          {
            turn: gameState.history.length + 1,
            message: `🚫 PELANGGARAN ATURAN: ${playerName} mengeluarkan kartu 2 sebagai kartu terakhir! ${playerName} OTOMATIS KALAH! Pemenang adalah ${actualWinner?.name}.`,
          },
        ],
      };

      return { success: true, gameState: finishedState };
    }

    // NORMAL FINISH: Player finishes all cards!
    const previousFinished = gameState.finishedPlayers || [];
    const finishRank = previousFinished.length + 1;
    const playerObj = gameState.players.find((p) => p.id === playerId);
    const newFinishedEntry = {
      id: playerId,
      name: playerName,
      avatar: playerObj?.avatar || '👤',
      rank: finishRank,
      remainingCards: 0,
      isWinner: finishRank === 1,
    };
    const nextFinishedPlayers = [...previousFinished, newFinishedEntry];
    const finishedIds = nextFinishedPlayers.map((f) => f.id);

    // Check remaining active players who still hold cards
    const remainingActivePlayers = gameState.players.filter(
      (p) => !finishedIds.includes(p.id) && (updatedHands[p.id]?.length || 0) > 0
    );

    // If only 1 (or 0) player left with cards: GAME OVER!
    if (remainingActivePlayers.length <= 1) {
      const lastPlayer = remainingActivePlayers[0] || null;
      const lastRemaining = lastPlayer ? (updatedHands[lastPlayer.id]?.length || 0) : 0;
      const finalRankings = [
        ...nextFinishedPlayers,
        ...(lastPlayer ? [{
          id: lastPlayer.id,
          name: lastPlayer.name,
          avatar: lastPlayer.avatar,
          rank: nextFinishedPlayers.length + 1,
          remainingCards: lastRemaining,
          isWinner: false,
        }] : []),
      ];

      const actionPayload = {
        type: 'PLAY_COMBO',
        playerId,
        playerName,
        avatar: playerObj?.avatar || '👤',
        cards: selectedCards,
        combo,
        message: `🏆 ${playerName} mengeluarkan ${combo.label} dan menghabiskan seluruh kartunya! (Juara ${finishRank})`,
        timestamp: Date.now(),
      };

      const finalState = {
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
        winner: nextFinishedPlayers[0]?.id || playerId,
        endReason: 'NORMAL_WIN',
        finishedPlayers: nextFinishedPlayers,
        rankings: finalRankings,
        history: [
          ...gameState.history,
          {
            turn: gameState.history.length + 1,
            message: `🏆 ${playerName} mengeluarkan ${combo.label} dan menghabiskan seluruh kartu (Juara ${finishRank})! Seluruh putaran selesai.`,
          },
        ],
      };

      return { success: true, gameState: finalState };
    }

    // GAME CONTINUES! 2 or more players still hold cards!
    const nextPlayer = getNextActivePlayer(gameState.players, playerId, gameState.passedPlayers || [], finishedIds);

    let clearedTable = false;
    let nextCurrentPlayerId = null;
    let nextTrickLeaderId = playerId;

    if (!nextPlayer) {
      // All other remaining players have passed in this trick: clear table!
      clearedTable = true;
      const nextFreeLeader = getNextActivePlayer(gameState.players, playerId, [], finishedIds) || remainingActivePlayers[0];
      nextCurrentPlayerId = nextFreeLeader.id;
      nextTrickLeaderId = nextFreeLeader.id;
    } else {
      nextCurrentPlayerId = nextPlayer.id;
    }

    const actionPayload = {
      type: 'PLAY_COMBO',
      playerId,
      playerName,
      avatar: playerObj?.avatar || '👤',
      cards: selectedCards,
      combo,
      message: `🎉 ${playerName} menghabiskan seluruh kartunya (Juara ${finishRank} 👑)! Permainan berlanjut untuk pemain lain...`,
      timestamp: Date.now(),
    };

    const nextGameState = {
      ...gameState,
      hands: updatedHands,
      finishedPlayers: nextFinishedPlayers,
      currentTrick: clearedTable
        ? { cards: [], combo: null, playedBy: null, playedByName: null }
        : { cards: selectedCards, combo, playedBy: playerId, playedByName: playerName },
      lastPlayedCombo: combo,
      lastAction: actionPayload,
      trickLeaderId: nextTrickLeaderId,
      passedPlayers: clearedTable ? [] : (gameState.passedPlayers || []),
      consecutivePassCount: 0,
      isFirstPlayOfGame: false,
      currentPlayer: nextCurrentPlayerId,
      history: [
        ...gameState.history,
        {
          turn: gameState.history.length + 1,
          message: `🎉 ${playerName} menghabiskan seluruh kartunya (Juara ${finishRank})! Giliran dilanjutkan oleh ${gameState.players.find(p => p.id === nextCurrentPlayerId)?.name}.`,
        },
      ],
    };

    return { success: true, gameState: nextGameState };
  }

  // Determine Next Player (Clockwise) among players who have NOT passed and have NOT finished
  const finishedIds = (gameState.finishedPlayers || []).map((f) => f.id);
  const currentPassed = gameState.passedPlayers || [];
  const nextPlayer = getNextActivePlayer(gameState.players, playerId, currentPassed, finishedIds);

  // If every other active player already passed in this trick, trick clears immediately!
  if (!nextPlayer || nextPlayer.id === playerId) {
    const actionPayload = {
      type: 'PLAY_COMBO',
      playerId,
      playerName,
      avatar: gameState.players.find((p) => p.id === playerId)?.avatar || '👤',
      cards: selectedCards,
      combo,
      message: `${playerName} mengeluarkan ${combo.label}. Semua lawan telah lewat! Meja dibersihkan.`,
      timestamp: Date.now(),
    };

    const clearedNextState = {
      ...gameState,
      hands: updatedHands,
      currentTrick: {
        cards: [],
        combo: null,
        playedBy: null,
        playedByName: null,
      },
      lastPlayedCombo: combo,
      lastAction: actionPayload,
      trickLeaderId: playerId,
      passedPlayers: [], // Meja bebas: reset daftar pass untuk putaran baru!
      consecutivePassCount: 0,
      isFirstPlayOfGame: false,
      currentPlayer: playerId,
      history: [
        ...gameState.history,
        {
          turn: gameState.history.length + 1,
          message: `${playerName} mengeluarkan ${combo.label}. Semua lawan telah lewat. Meja dibersihkan! Giliran Bebas untuk ${playerName}.`,
        },
      ],
    };

    return { success: true, gameState: clearedNextState };
  }

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
 * RULE 2: Players who pass during a trick are skipped until the trick clears ("meja bebas").
 * When all other players have passed, the trick leader wins the trick and gets a free turn.
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
  const finishedIds = (gameState.finishedPlayers || []).map((f) => f.id);
  const activePlayers = gameState.players.filter((p) => !finishedIds.includes(p.id));

  const currentPassed = gameState.passedPlayers || [];
  const updatedPassed = [...new Set([...currentPassed, playerId])];

  const leaderId = gameState.trickLeaderId;
  const isLeaderStillActive = !finishedIds.includes(leaderId);

  // All active players other than the trick leader
  const otherActivePlayers = activePlayers.filter((p) => p.id !== leaderId);
  const allOthersPassed = otherActivePlayers.every((p) => updatedPassed.includes(p.id));

  // If all other active players have passed in this trick: MEJA BEBAS!
  if (allOthersPassed || otherActivePlayers.length === 0) {
    let newLeaderId = leaderId;
    if (!isLeaderStillActive) {
      const nextFreeLeader = getNextActivePlayer(gameState.players, leaderId, [], finishedIds) || activePlayers[0];
      newLeaderId = nextFreeLeader?.id || activePlayers[0]?.id;
    }
    const newLeaderPlayer = gameState.players.find((p) => p.id === newLeaderId) || activePlayers[0];

    const clearedState = {
      ...gameState,
      currentTrick: {
        cards: [],
        combo: null,
        playedBy: null,
        playedByName: null,
      },
      passedPlayers: [], // Meja bebas: reset daftar pass untuk putaran baru!
      consecutivePassCount: 0,
      trickLeaderId: newLeaderId,
      currentPlayer: newLeaderId,
      lastAction: {
        type: 'PASS',
        playerId,
        playerName,
        avatar: gameState.players.find((p) => p.id === playerId)?.avatar || '👤',
        message: `${playerName} Lewat (Pass). Semua pemain telah lewat. Meja dibersihkan! Giliran Bebas untuk ${newLeaderPlayer?.name}.`,
        timestamp: Date.now(),
      },
      history: [
        ...gameState.history,
        {
          turn: gameState.history.length + 1,
          message: `${playerName} LEWAT (Pass). Semua pemain lain telah lewat dalam rangkaian ini. Meja dibersihkan! Giliran Bebas untuk ${newLeaderPlayer?.name}.`,
        },
      ],
    };

    return { success: true, gameState: clearedState };
  }

  // Next active player who has NOT passed in this trick and NOT finished
  const nextPlayer = getNextActivePlayer(gameState.players, playerId, updatedPassed, finishedIds) || activePlayers[0];

  const nextState = {
    ...gameState,
    passedPlayers: updatedPassed,
    consecutivePassCount: (gameState.consecutivePassCount || 0) + 1,
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
        message: `${playerName} LEWAT (Pass). Giliran ${nextPlayer.name}. (Pemain yang sudah lewat dilewati hingga meja bebas).`,
      },
    ],
  };

  return { success: true, gameState: nextState };
}
