/**
 * SEVENS GAME CONFIGURATION
 * All penalty and scoring parameters are decoupled and configurable.
 */

import { SUITS } from './constants.js';

export const DEFAULT_CONFIG = {
  // Jumlah Pemain: 4, 5, atau 6
  // - 4 pemain: 13 kartu per pemain, meja mulai kosong
  // - 5 pemain: 10 kartu per pemain, ♠7 & ♥7 otomatis tertata di meja
  // - 6 pemain: 8 kartu per pemain, semua kartu 7 otomatis tertata di meja
  playerCount: 4,

  // RULE 1: Starter card requirement
  starterCard: {
    suit: SUITS.SPADES,
    rank: 7,
  },

  // RULE 6: Penalti Kartu 6 dan 8
  // "Jika kartu 6 dan 8 tetap di-KEEP / disimpan dan terus tidak dimainkan
  // sampai ada kartu yang DITUTUP menggunakan AS, maka: 6 = -60, 8 = -80"
  penalty6: -60,
  penalty8: -80,

  /**
   * Lingkup suit untuk penalti 6 & 8:
   * - 'same_suit': (Default Tradisional) Menutup As Sekop hanya memicu penalti bagi pemegang 6♠ dan 8♠ suit tersebut.
   * - 'all_suits': Menutup As apa pun memicu penalti bagi siapa pun yang masih memegang 6 atau 8 di suit mana pun.
   */
  penalty68Scope: 'same_suit',

  /**
   * Evaluasi pemegang kartu 6 & 8:
   * - 'held_when_ace_closed': Dievaluasi pada saat As ditutup (siapa pemain yang saat itu sedang memegang 6 atau 8 di hand).
   * - 'unplayed_at_end': Dievaluasi di akhir permainan bagi siapa pun yang kartu 6 atau 8-nya tidak pernah dimainkan ke board.
   */
  penalty68EvaluationMode: 'held_when_ace_closed',

  // Penalti dasar untuk setiap kartu yang ditutup (Closed Cards)
  // 'face_value': A=-1, 2=-2, ..., J=-11, Q=-12, K=-13
  // 'flat_ten': setiap kartu tutup = -10
  closedCardScoringMode: 'face_value',
  closedCardMultiplier: -1, // membuat nilai kartu menjadi negatif

  // Penalti untuk setiap FAULT yang dilakukan pemain (default: 0)
  faultPenalty: 0,

  // Bonus poin untuk pemain dengan closed card paling sedikit / skor tertinggi
  winnerBonus: 0,
};

export function createConfig(overrides = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}
