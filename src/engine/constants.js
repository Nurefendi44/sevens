/**
 * SEVENS CARD GAME - CONSTANTS
 */

export const SUITS = {
  SPADES: 'spades',
  HEARTS: 'hearts',
  DIAMONDS: 'diamonds',
  CLUBS: 'clubs',
};

export const SUIT_SYMBOLS = {
  [SUITS.SPADES]: '♠',
  [SUITS.HEARTS]: '♥',
  [SUITS.DIAMONDS]: '♦',
  [SUITS.CLUBS]: '♣',
};

export const SUIT_NAMES = {
  [SUITS.SPADES]: 'Sekop (Spades)',
  [SUITS.HEARTS]: 'Hati (Hearts)',
  [SUITS.DIAMONDS]: 'Wajik (Diamonds)',
  [SUITS.CLUBS]: 'Keriting (Clubs)',
};

export const SUIT_COLORS = {
  [SUITS.SPADES]: '#1e293b',
  [SUITS.HEARTS]: '#dc2626',
  [SUITS.DIAMONDS]: '#ea580c',
  [SUITS.CLUBS]: '#0f766e',
};

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const RANK_LABELS = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export const GAME_STATUS = {
  IDLE: 'idle',
  PLAYING: 'playing',
  GAME_OVER: 'game_over',
};

export const ACTION_TYPES = {
  PLAY: 'PLAY',
  CLOSE: 'CLOSE',
};

export const CLOSURE_DIRECTION = {
  TOP: 'top',       // ATAS (8, 9, 10, J, Q, K, A=11)
  BOTTOM: 'bottom', // BAWAH (A=1, 2, 3, 4, 5, 6)
};

export const FAULT_CODES = {
  NONE: 'NONE',
  MUST_PLAY_SEVEN_SPADES: 'MUST_PLAY_SEVEN_SPADES',
  CARD_NOT_VALID: 'CARD_NOT_VALID',
  CLOSE_WHILE_HAVING_VALID_MOVES: 'CLOSE_WHILE_HAVING_VALID_MOVES',
  MUST_PLAY_SEVEN_NOT_CLOSE: 'MUST_PLAY_SEVEN_NOT_CLOSE',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  CARD_NOT_IN_HAND: 'CARD_NOT_IN_HAND',
  WRONG_CLOSURE_DIRECTION: 'WRONG_CLOSURE_DIRECTION',
};

