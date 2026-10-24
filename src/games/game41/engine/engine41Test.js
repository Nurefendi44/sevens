/**
 * UNIT TESTS FOR KARTU 41 ENGINE
 */

import { initGame41, drawCard41, discardCard41, closeHand41 } from './engine41.js';
import { calculateHandScore41, determineWinners41 } from './scoring41.js';
import { SUITS } from '../../../engine/constants.js';

console.log('=== TEST 1: INITIALIZATION (4, 5, 6 PLAYERS) ===');

// Test 4 Players
const game4 = initGame41({ playerCount: 4 });
if (game4.players.length !== 4) throw new Error('FAIL: Expected 4 players');
Object.values(game4.hands).forEach((h) => {
  if (h.length !== 4) throw new Error(`FAIL: Expected 4 cards per hand, got ${h.length}`);
});
if (game4.discardPile.length !== 1) throw new Error('FAIL: Expected 1 discard card');
if (game4.drawPile.length !== 35) throw new Error(`FAIL: Expected 35 cards in draw pile, got ${game4.drawPile.length}`);
console.log('✓ 4 Players Init: 16 in hands + 1 discard + 35 draw = 52 cards verified!');

// Test 5 Players
const game5 = initGame41({ playerCount: 5 });
if (game5.players.length !== 5) throw new Error('FAIL: Expected 5 players');
if (game5.drawPile.length !== 31) throw new Error(`FAIL: Expected 31 cards in draw pile, got ${game5.drawPile.length}`);
console.log('✓ 5 Players Init: 20 in hands + 1 discard + 31 draw = 52 cards verified!');

// Test 6 Players
const game6 = initGame41({ playerCount: 6 });
if (game6.players.length !== 6) throw new Error('FAIL: Expected 6 players');
if (game6.drawPile.length !== 27) throw new Error(`FAIL: Expected 27 cards in draw pile, got ${game6.drawPile.length}`);
console.log('✓ 6 Players Init: 24 in hands + 1 discard + 27 draw = 52 cards verified!');

console.log('\n=== TEST 2: SCORING & 41 MURNI EVALUATION ===');

// 41 Murni: A♠(11) + K♠(10) + Q♠(10) + J♠(10) = 41
const hand41 = [
  { suit: SUITS.SPADES, rank: 1, label: 'A', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 13, label: 'K', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 12, label: 'Q', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 11, label: 'J', symbol: '♠' },
];
const eval41 = calculateHandScore41(hand41);
console.log('Hand 41 eval:', eval41.bestScore, 'is41:', eval41.is41);
if (!eval41.is41 || eval41.bestScore !== 41) throw new Error('FAIL: Hand should be 41 Murni!');

// Hand with 3 Spades and 1 Heart: A♠(11) + K♠(10) + 9♠(9) - 4♥(4) = 30 - 4 = 26
const handMixed = [
  { suit: SUITS.SPADES, rank: 1, label: 'A', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 13, label: 'K', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 9, label: '9', symbol: '♠' },
  { suit: SUITS.HEARTS, rank: 4, label: '4', symbol: '♥' },
];
const evalMixed = calculateHandScore41(handMixed);
console.log('Mixed hand eval score (should be 26):', evalMixed.bestScore);
if (evalMixed.bestScore !== 26) throw new Error(`FAIL: Expected score 26, got ${evalMixed.bestScore}`);

// All different suits: A♠(11), K♥(10), Q♦(10), J♣(10)
// Spades: 11 - (10+10+10) = -19
const handScattered = [
  { suit: SUITS.SPADES, rank: 1, label: 'A', symbol: '♠' },
  { suit: SUITS.HEARTS, rank: 13, label: 'K', symbol: '♥' },
  { suit: SUITS.DIAMONDS, rank: 12, label: 'Q', symbol: '♦' },
  { suit: SUITS.CLUBS, rank: 11, label: 'J', symbol: '♣' },
];
const evalScattered = calculateHandScore41(handScattered);
console.log('Scattered hand eval score (should be -19):', evalScattered.bestScore);
if (evalScattered.bestScore !== -19) throw new Error(`FAIL: Expected score -19, got ${evalScattered.bestScore}`);

console.log('✓ Scoring engine passes all edge cases!');

console.log('\n=== TEST 3: TURN FLOW (DRAW & DISCARD) ===');
const state = initGame41({ playerCount: 4, firstPlayerId: 'player_1' });
const p1 = 'player_1';

// Player 1 draws from stock
const drawRes = drawCard41(state, p1, 'stock');
if (!drawRes.success) throw new Error('FAIL: Draw failed: ' + drawRes.error);
if (drawRes.state.hands[p1].length !== 5) throw new Error('FAIL: Expected 5 cards after draw');
if (drawRes.state.turnPhase !== 'DISCARD') throw new Error('FAIL: Expected turnPhase DISCARD');

// Player 1 discards 1 card
const cardToDiscard = drawRes.state.hands[p1][0];
const discardRes = discardCard41(drawRes.state, p1, cardToDiscard);
if (!discardRes.success) throw new Error('FAIL: Discard failed: ' + discardRes.error);
if (discardRes.state.hands[p1].length !== 4) throw new Error('FAIL: Expected 4 cards after discard');
if (discardRes.state.currentPlayer !== state.players[1].id) throw new Error('FAIL: Expected turn to pass to Player 2');
if (discardRes.state.turnPhase !== 'DRAW') throw new Error('FAIL: Expected next player turnPhase DRAW');
console.log('✓ Turn flow (draw 5th card -> discard to 4 cards -> next turn) verified!');

console.log('\n=== TEST 4: INSTANT WIN 41 MURNI DETECTION ===');
const winGame = initGame41({ playerCount: 4, firstPlayerId: 'player_1' });
// Setup Player 1 hand so when they draw and discard, they achieve 41
winGame.hands['player_1'] = [
  { suit: SUITS.SPADES, rank: 1, label: 'A', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 13, label: 'K', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 12, label: 'Q', symbol: '♠' },
  { suit: SUITS.HEARTS, rank: 2, label: '2', symbol: '♥' }, // unwanted card
];
// Put J♠ as passed discard to player 1 so player 1 can pick it!
winGame.passedDiscard = {
  card: { suit: SUITS.SPADES, rank: 11, label: 'J', symbol: '♠' },
  fromPlayerId: 'system',
  fromPlayerName: 'Meja',
  toPlayerId: 'player_1',
  toPlayerName: 'Pemain 1 (Anda)',
};

// Player 1 draws J♠ from discard pile
const draw41Res = drawCard41(winGame, 'player_1', 'discard');
if (!draw41Res.success) throw new Error('FAIL: Draw discard failed: ' + draw41Res.error);

// Player 1 discards 2♥
const discard2Hearts = draw41Res.state.hands['player_1'].find(c => c.suit === SUITS.HEARTS && c.rank === 2);
const winDiscardRes = discardCard41(draw41Res.state, 'player_1', discard2Hearts);
if (!winDiscardRes.success) throw new Error('FAIL: Discard failed: ' + winDiscardRes.error);
if (!winDiscardRes.is41 || winDiscardRes.state.gameStatus !== 'game_over') {
  throw new Error('FAIL: Expected Instant Win 41 Murni game over!');
}
if (winDiscardRes.state.winner.id !== 'player_1') {
  throw new Error('FAIL: Expected Player 1 to be the winner!');
}
console.log('✓ 41 Murni Instant Win successfully detected and ended game!');

console.log('\n=== TEST 5: USER EXAMPLE SCORING (10♠, 9♠, 8♠, 10♥ = 17) & DISCARD TRACKING ===');
const handUserExample = [
  { suit: SUITS.SPADES, rank: 10, label: '10', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 9, label: '9', symbol: '♠' },
  { suit: SUITS.SPADES, rank: 8, label: '8', symbol: '♠' },
  { suit: SUITS.HEARTS, rank: 10, label: '10', symbol: '♥' },
];
const evalUserExample = calculateHandScore41(handUserExample);
console.log('User example eval score:', evalUserExample.bestScore, 'formula:', evalUserExample.formula);
if (evalUserExample.bestScore !== 17) {
  throw new Error(`FAIL: Expected score 17 for [10♠, 9♠, 8♠, 10♥], got ${evalUserExample.bestScore}`);
}
if (evalUserExample.dominantPoints !== 27 || evalUserExample.penaltyPoints !== 10) {
  throw new Error(`FAIL: Expected 27 dominant and 10 penalty, got ${evalUserExample.dominantPoints} and ${evalUserExample.penaltyPoints}`);
}
console.log('✓ User example 10♠, 9♠, 8♠, 10♥ evaluated to exactly 17 points (27 - 10 = 17 pts)!');

// Test Discard Tracking: P1 discards -> P2 takes it -> verify P1's outgoing history shows takenByNextPlayer: true
const trackGame = initGame41({ playerCount: 4, firstPlayerId: 'player_1' });
const player1Id = 'player_1';
const player2Id = 'player_2';
const player3Id = 'player_3';

const d1 = drawCard41(trackGame, player1Id, 'stock');
if (!d1.success) throw new Error('d1 failed: ' + d1.error);
const cardDiscardedByP1 = d1.state.hands[player1Id][0];
const disc1 = discardCard41(d1.state, player1Id, cardDiscardedByP1);
if (!disc1.success) throw new Error('disc1 failed: ' + disc1.error);

// P1's outgoing discard history should have takenByNextPlayer: null (pending)
const p1PendingEntry = disc1.state.playerDiscardHistory[player1Id][0];
if (p1PendingEntry.takenByNextPlayer !== null) {
  throw new Error('FAIL: Expected pending discard to have takenByNextPlayer: null');
}

// P2 takes the discard from P1
const d2 = drawCard41(disc1.state, player2Id, 'discard');
if (!d2.success) throw new Error('d2 failed: ' + d2.error);
const p1UpdatedEntry = d2.state.playerDiscardHistory[player1Id][0];
if (p1UpdatedEntry.takenByNextPlayer !== true || p1UpdatedEntry.takenByPlayerName !== disc1.state.players[1].name) {
  throw new Error('FAIL: Expected p1 discard entry to have takenByNextPlayer: true and takenByPlayerName');
}
console.log('✓ Discard tracking when taken by next player verified!');

// P2 discards a card -> P3 takes from stock (skips P2's discard)
const cardDiscardedByP2 = d2.state.hands[player2Id][0];
const disc2 = discardCard41(d2.state, player2Id, cardDiscardedByP2);
if (!disc2.success) throw new Error('disc2 failed: ' + disc2.error);
const d3 = drawCard41(disc2.state, player3Id, 'stock');
if (!d3.success) throw new Error('d3 failed: ' + d3.error);
const p2UpdatedEntry = d3.state.playerDiscardHistory[player2Id][0];
if (p2UpdatedEntry.takenByNextPlayer !== false) {
  throw new Error('FAIL: Expected p2 discard entry to have takenByNextPlayer: false when skipped');
}
console.log('✓ Discard tracking when skipped by next player verified!');

console.log('\n=== TEST 6: MINIMAL 4 PUTARAN UNTUK TUTUP KARTU ===');
const roundTestGame = initGame41({ playerCount: 4, firstPlayerId: 'player_1' });
// Try to close hand in Putaran 1
const failClose = closeHand41(roundTestGame, 'player_1');
if (failClose.success) {
  throw new Error('FAIL: Tutup kartu should NOT be allowed in Putaran 1!');
}
console.log('✓ Successfully blocked Tutup Kartu in Putaran 1:', failClose.error);

// Set game state to Putaran 4 (turnNumber = 13 for 4 players)
const round4State = {
  ...roundTestGame,
  turnNumber: 13,
  currentRound: 4,
  currentPlayer: 'player_1',
};
const successClose = closeHand41(round4State, 'player_1');
if (!successClose.success) {
  throw new Error('FAIL: Tutup kartu should be allowed in Putaran 4: ' + successClose.error);
}
console.log('✓ Successfully allowed Tutup Kartu in Putaran 4!');

console.log('\n=== TEST 7: RANDOM FIRST TURN & RESTART WITH PREVIOUS WINNER ===');
const starters = new Set();
for (let i = 0; i < 60; i++) {
  const g = initGame41({ playerCount: 4 });
  starters.add(g.currentPlayer);
}
if (starters.size < 2) {
  throw new Error('FAIL: First turn should be randomized among all players! Got: ' + Array.from(starters).join(', '));
}
console.log(`✓ First turn is randomized across players (observed ${starters.size} different starting players)!`);

// Verify when firstPlayerId is provided (restart with previous winner), that winner starts!
const restartState = initGame41({ playerCount: 4, firstPlayerId: 'player_3' });
if (restartState.currentPlayer !== 'player_3') {
  throw new Error('FAIL: Expected player_3 (previous winner) to start on restart, got ' + restartState.currentPlayer);
}
console.log('✓ Previous winner (player_3) correctly starts on restart/play again!');

console.log('\n🎉 ALL KARTU 41 TESTS PASSED WITH 100% SUCCESS! 🎉');
