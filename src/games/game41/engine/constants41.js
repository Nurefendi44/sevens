/**
 * CONSTANTS FOR KARTU 41 (REMI 41)
 */

export const GAME_STATUS_41 = {
  IDLE: 'idle',
  LOBBY: 'lobby',
  PLAYING: 'playing',
  GAME_OVER: 'game_over',
};

export const TURN_PHASE_41 = {
  DRAW: 'DRAW',        // Pemain wajib mengambil 1 kartu (dari Stock/Draw Pile atau Discard Pile)
  DISCARD: 'DISCARD',  // Pemain wajib membuang 1 kartu dari tangan ke Discard Pile
};

export const DRAW_SOURCE_41 = {
  STOCK: 'stock',      // Mengambil dari tumpukan tertutup (Draw Pile)
  DISCARD: 'discard',  // Mengambil kartu teratas tumpukan terbuka (Discard Pile)
};

export const CARD_VALUES_41 = {
  1: 11,   // As (A) = 11 poin
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 10,  // Jack (J) = 10 poin
  12: 10,  // Queen (Q) = 10 poin
  13: 10,  // King (K) = 10 poin
};
