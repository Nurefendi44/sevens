/**
 * Test script to verify all engine rules and functions directly
 */
import {
  initGame,
  getValidMoves,
  canPlayCard,
  canCloseCard,
  checkFault,
  playCard,
  closeCard,
  calculateScore,
} from './gameEngine.js';
import { SUITS } from './constants.js';

console.log('--- 1. TESTING INIT GAME ---');
const game = initGame();
console.log('Game initialized.');
console.log('Current player:', game.currentPlayer);
console.log('Starting player:', game.startingPlayerId);

// Check starting player holds 7 of spades
const starterHand = game.hands[game.startingPlayerId];
const has7Spades = starterHand.some(c => c.suit === SUITS.SPADES && c.rank === 7);
console.log('Starter holds 7♠:', has7Spades);

// Check valid moves for starter
const starterValid = getValidMoves(game, game.startingPlayerId);
console.log('Starter valid moves count:', starterValid.length);
console.log('Starter valid move:', starterValid[0]);

if (starterValid.length !== 1 || starterValid[0].suit !== SUITS.SPADES || starterValid[0].rank !== 7) {
  throw new Error('FAIL: Turn 1 did not mandate 7 of Spades!');
}

console.log('--- 2. TESTING RULE 4: CLOSE WHILE HAVING VALID MOVES ---');
const closeAttempt = checkFault(game, 'CLOSE', game.startingPlayerId, starterHand[0]);
console.log('Attempting close on turn 1 fault result:', closeAttempt.isFault, closeAttempt.code);
if (!closeAttempt.isFault) {
  throw new Error('FAIL: Rule 4/1 fault was not detected when trying to close with 7♠ valid!');
}

console.log('--- 3. TESTING PLAYING 7♠ ---');
const play7 = playCard(game, game.startingPlayerId, starterValid[0]);
console.log('Play 7♠ success:', play7.success);
if (!play7.success) {
  throw new Error('FAIL: Could not play 7 of Spades!');
}
const state2 = play7.state;
console.log('Next player:', state2.currentPlayer);
console.log('Turn number:', state2.turnNumber);
console.log('Board spades open:', state2.board[SUITS.SPADES].isOpen);

console.log('--- 4. TESTING ALL RULES SUCCESSFUL! ---');
