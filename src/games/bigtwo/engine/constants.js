/**
 * CONSTANTS FOR BIG TWO (CAPSA BANTING)
 */

export const GAME_STATUS_BIGTWO = {
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER',
};

// Card values in Big Two: 3 is lowest (3), 2 is highest (15)
export const BIGTWO_RANK_VALUES = {
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11, // Jack
  12: 12, // Queen
  13: 13, // King
  14: 14, // Ace
  15: 15, // Two (BIG TWO!)
};

// Suit rankings in standard Capsa Banting: Diamonds (1) < Clubs (2) < Hearts (3) < Spades (4)
export const BIGTWO_SUIT_VALUES = {
  diamonds: 1, // ♦ Wajik (Terendah)
  clubs: 2,    // ♣ Keriting
  hearts: 3,   // ♥ Hati
  spades: 4,   // ♠ Sekop (Tertinggi)
};

export const HAND_TYPE_BIGTWO = {
  INVALID: 'INVALID',
  SINGLE: 'SINGLE',                 // 1 kartu
  PAIR: 'PAIR',                     // 2 kartu angka sama
  TRIPLE: 'TRIPLE',                 // 3 kartu angka sama
  // 5-Card Poker Hands (Hierarki sesuai standar poker)
  STRAIGHT: 'STRAIGHT',             // 5 kartu berurutan
  FLUSH: 'FLUSH',                   // 5 kartu suit sama
  FULL_HOUSE: 'FULL_HOUSE',         // 3 kartu angka sama + 1 pair
  FOUR_OF_A_KIND: 'FOUR_OF_A_KIND', // 4 kartu angka sama + 1 kicker buangan (Total 5 kartu)
  STRAIGHT_FLUSH: 'STRAIGHT_FLUSH', // 5 kartu berurutan suit sama
  ROYAL_FLUSH: 'ROYAL_FLUSH',       // 10-J-Q-K-A suit sama
};

// Hierarchy level for 5-card hands (higher number beats lower number)
export const FIVE_CARD_TIER = {
  [HAND_TYPE_BIGTWO.STRAIGHT]: 1,
  [HAND_TYPE_BIGTWO.FLUSH]: 2,
  [HAND_TYPE_BIGTWO.FULL_HOUSE]: 3,
  [HAND_TYPE_BIGTWO.FOUR_OF_A_KIND]: 4,
  [HAND_TYPE_BIGTWO.STRAIGHT_FLUSH]: 5,
  [HAND_TYPE_BIGTWO.ROYAL_FLUSH]: 6,
};
