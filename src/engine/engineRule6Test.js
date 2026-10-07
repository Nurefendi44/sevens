/**
 * UNIT TEST: RULE 5 & RULE 6
 */
import { initGame, playCard, closeCard, calculateScore } from './gameEngine.js';
import { getValidMoves, checkFault } from './rules.js';
import { SUITS } from './constants.js';

console.log('--- TESTING RULE 5 & RULE 6 ---');
const game = initGame();

// Initial setup: 7♠ is played
game.firstMoveMade = true;
game.board[SUITS.SPADES].isOpen = true;
game.board[SUITS.SPADES].minRank = 7;
game.board[SUITS.SPADES].maxRank = 7;

// P1 has 7♥ (valid) and 3♣ (invalid)
game.currentPlayer = 'player_1';
game.hands['player_1'] = [
  { id: 'hearts-7', suit: SUITS.HEARTS, rank: 7, label: '7', symbol: '♥' },
  { id: 'diamonds-13', suit: SUITS.DIAMONDS, rank: 13, label: 'K', symbol: '♦' },
];

// Check valid moves for Player 1: 7♥ is valid to open Hearts!
const validP1 = getValidMoves(game, 'player_1');
console.log('P1 valid moves:', validP1.map(c => c.id));

// P1 tries to CLOSE 3♣ -> Should FAULT under Rule 5!
const faultRule5 = checkFault(game, 'CLOSE', 'player_1', game.hands['player_1'][1]);
console.log('Rule 5 check fault:', faultRule5.isFault, faultRule5.code, faultRule5.message);
if (!faultRule5.isFault || faultRule5.code !== 'MUST_PLAY_SEVEN_NOT_CLOSE') {
  throw new Error('FAIL: Rule 5 did not catch avoiding 7!');
}

// Now test Rule 6:
// Spades sequence reaches King (7, 8, 9, 10, J, Q, K)
game.board[SUITS.SPADES].maxRank = 13;

// Player 2 holds 6♠
game.hands['player_2'] = [
  { id: 'spades-6', suit: SUITS.SPADES, rank: 6, label: '6', symbol: '♠' },
];

// Player 3 holds A♠
game.currentPlayer = 'player_3';
game.hands['player_3'] = [
  { id: 'spades-1', suit: SUITS.SPADES, rank: 1, label: 'A', symbol: '♠' },
];

// P3 plays A♠ on King -> Tutup Rangkai Atas!
const playAceResult = playCard(game, 'player_3', game.hands['player_3'][0]);
console.log('Play A♠ success:', playAceResult.success);
const stateAfterAce = playAceResult.state;

console.log('Recorded Rule 6 penalties:', stateAfterAce.rule6Penalties);

// Calculate score: Player 2 should have -60 for holding 6♠
const scores = calculateScore(stateAfterAce);
console.log('P2 Score breakdown:', scores['player_2']);
if (scores['player_2'].rule6PenaltyScore !== -60) {
  throw new Error(`FAIL: Expected -60 penalty for Player 2, got ${scores['player_2'].rule6PenaltyScore}`);
}

console.log('--- ALL RULE 5 AND RULE 6 TESTS PASSED FLAWLESSLY! ---');
