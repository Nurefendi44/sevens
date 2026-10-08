/**
 * UNIT TEST: TUTUP RANGKAI AS, GLOBAL ACE DIRECTION, 6/8 PENALTIES, AND DEAD CARDS
 */
import { initGame, playCard, closeCard, calculateScore } from './gameEngine.js';
import { getValidMoves, checkFault } from './rules.js';
import { SUITS } from './constants.js';

console.log('=== TEST 1: TUTUP RANGKAI ATAS (HEARTS K -> A) ===');
const game = initGame();

// 1. Initial State
if (game.globalAceDirection !== null) {
  throw new Error('FAIL: Initial globalAceDirection should be null');
}

// Player 1 plays 7♠ to start game
const p1Hand = game.hands['player_1'];
const sevenSpades = p1Hand.find(c => c.suit === SUITS.SPADES && c.rank === 7);
if (!sevenSpades) {
  // Give 7♠ to player_1 if dealt elsewhere for test consistency
  const starterOwner = Object.keys(game.hands).find(pid => game.hands[pid].some(c => c.suit === SUITS.SPADES && c.rank === 7));
  const starterCard = game.hands[starterOwner].find(c => c.suit === SUITS.SPADES && c.rank === 7);
  game.hands[starterOwner] = game.hands[starterOwner].filter(c => c !== starterCard);
  game.hands['player_1'].push(starterCard);
  game.currentPlayer = 'player_1';
}

const startRes = playCard(game, 'player_1', { id: 'spades-7', suit: SUITS.SPADES, rank: 7, label: '7', symbol: '♠' });
if (!startRes.success) throw new Error('FAIL: Starter 7♠ move failed');
let state = startRes.state;

// Set up Hearts board manually: 7, 8, 9, 10, J, Q, K are on the board
state.board[SUITS.HEARTS].isOpen = true;
state.board[SUITS.HEARTS].minRank = 7;
state.board[SUITS.HEARTS].maxRank = 13;
state.board[SUITS.HEARTS].playedCards = [
  { suit: SUITS.HEARTS, rank: 7, label: '7', symbol: '♥' },
  { suit: SUITS.HEARTS, rank: 8, label: '8', symbol: '♥' },
  { suit: SUITS.HEARTS, rank: 9, label: '9', symbol: '♥' },
  { suit: SUITS.HEARTS, rank: 10, label: '10', symbol: '♥' },
  { suit: SUITS.HEARTS, rank: 11, label: 'J', symbol: '♥' },
  { suit: SUITS.HEARTS, rank: 12, label: 'Q', symbol: '♥' },
  { suit: SUITS.HEARTS, rank: 13, label: 'K', symbol: '♥' },
];

// Setup player hands:
// Player 1 holds A♥ (can play top)
state.hands['player_1'] = [
  { id: 'hearts-1', suit: SUITS.HEARTS, rank: 1, label: 'A', symbol: '♥' },
];
// Player 2 holds 6♥ (holding 6 when top is closed -> penalty -60)
state.hands['player_2'] = [
  { id: 'hearts-6', suit: SUITS.HEARTS, rank: 6, label: '6', symbol: '♥' },
];
// Player 3 holds 5♥ (dead card that can be used for close later)
state.hands['player_3'] = [
  { id: 'hearts-5', suit: SUITS.HEARTS, rank: 5, label: '5', symbol: '♥' },
];
// Player 4 holds random cards
state.hands['player_4'] = [
  { id: 'clubs-3', suit: SUITS.CLUBS, rank: 3, label: '3', symbol: '♣' },
];

state.currentPlayer = 'player_1';

// Verify A♥ is valid for Player 1
const p1Moves = getValidMoves(state, 'player_1');
console.log('Player 1 valid moves count:', p1Moves.length);
if (!p1Moves.some(c => c.suit === SUITS.HEARTS && c.rank === 1)) {
  throw new Error('FAIL: A♥ should be a valid move to cap Hearts at top!');
}

// Player 1 plays A♥ -> TUTUP RANGKAI ATAS!
console.log('Player 1 plays A♥ to cap top sequence...');
const playAceRes = playCard(state, 'player_1', state.hands['player_1'][0]);
if (!playAceRes.success) {
  throw new Error('FAIL: Playing A♥ failed: ' + playAceRes.error);
}

state = playAceRes.state;

console.log('globalAceDirection after Tutup Rangkai Atas:', state.globalAceDirection);
if (state.globalAceDirection !== 'top') {
  throw new Error(`FAIL: Expected globalAceDirection to be "top", got ${state.globalAceDirection}`);
}

console.log('Hearts board isCompleted:', state.board[SUITS.HEARTS].isCompleted);
if (!state.board[SUITS.HEARTS].isCompleted) {
  throw new Error('FAIL: Hearts board should be marked isCompleted!');
}

console.log('Rule 6 Penalties recorded:', state.rule6Penalties);
if (state.rule6Penalties.length !== 1 || state.rule6Penalties[0].playerId !== 'player_2' || state.rule6Penalties[0].penalty !== -60) {
  throw new Error('FAIL: Player 2 holding 6♥ should have received -60 penalty!');
}

// Verify that 6♥ or 5♥ can NO LONGER be played to the board (Hearts is completed)
state.currentPlayer = 'player_2';
const p2Moves = getValidMoves(state, 'player_2');
console.log('Player 2 valid moves count (should be 0 because 6♥ is disabled):', p2Moves.length);
if (p2Moves.length !== 0) {
  throw new Error('FAIL: 6♥ should NOT be valid because Hearts is completed/disabled!');
}

// Verify that Player 2 (having 0 valid moves) CAN CLOSE 6♥ face-down without fault
console.log('Player 2 closes 6♥ face-down...');
const p2CloseRes = closeCard(state, 'player_2', state.hands['player_2'][0]);
if (!p2CloseRes.success) {
  throw new Error('FAIL: Player 2 should be allowed to close 6♥ face-down when having 0 valid moves!');
}
state = p2CloseRes.state;

// Verify Player 3 (holding 5♥) also has 0 valid moves and can close 5♥
state.currentPlayer = 'player_3';
const p3Moves = getValidMoves(state, 'player_3');
if (p3Moves.length !== 0) {
  throw new Error('FAIL: 5♥ should NOT be valid to play on board!');
}
const p3CloseRes = closeCard(state, 'player_3', state.hands['player_3'][0]);
if (!p3CloseRes.success) {
  throw new Error('FAIL: Player 3 should be allowed to close 5♥ face-down!');
}
state = p3CloseRes.state;

console.log('=== TEST 2: SUBSEQUENT SUIT CAN ONLY PLAY ACE AT TOP ===');
// Open Clubs on board up to 2 (bottom) and up to King (top)
state.board[SUITS.CLUBS].isOpen = true;
state.board[SUITS.CLUBS].minRank = 2; // Clubs reached 2
state.board[SUITS.CLUBS].maxRank = 13; // Clubs reached K

// Hand has A♣
const testHandWithAceClubs = [
  { id: 'clubs-1', suit: SUITS.CLUBS, rank: 1, label: 'A', symbol: '♣' },
];
state.hands['player_4'] = testHandWithAceClubs;
state.currentPlayer = 'player_4';

// Check valid moves for Player 4
const p4Moves = getValidMoves(state, 'player_4');
console.log('Player 4 valid moves with A♣ when direction is "top":', p4Moves.length);
// Since globalAceDirection is 'top' and maxRank is 13, A♣ is valid at top!
if (p4Moves.length !== 1) {
  throw new Error('FAIL: A♣ should be valid at top!');
}

// Now test if Clubs was only reached down to 2 (minRank 2, but maxRank only 10)
state.board[SUITS.CLUBS].maxRank = 10; // K is not reached yet
const p4MovesBottomOnly = getValidMoves(state, 'player_4');
console.log('Player 4 valid moves when Clubs reached 2 but direction is "top":', p4MovesBottomOnly.length);
// Because globalAceDirection is 'top', Ace can NOT be played at bottom after 2!
if (p4MovesBottomOnly.length !== 0) {
  throw new Error('FAIL: A♣ should NOT be valid at bottom because globalAceDirection is "top"!');
}

console.log('=== TEST 3: SCORING EVALUATION ===');
// Setup closed Ace for Player 1
state.closedCards['player_1'] = [
  { id: 'spades-1', suit: SUITS.SPADES, rank: 1, label: 'A', symbol: '♠' },
];

const scoresTop = calculateScore(state);
console.log('Closed Ace penalty under "top" direction (should be -11):', scoresTop['player_1'].baseClosedScore);
if (scoresTop['player_1'].baseClosedScore !== -11) {
  throw new Error(`FAIL: Expected -11 for Ace under "top", got ${scoresTop['player_1'].baseClosedScore}`);
}

console.log('Player 2 Rule 6 penalty (should be -60):', scoresTop['player_2'].rule6PenaltyScore);
if (scoresTop['player_2'].rule6PenaltyScore !== -60) {
  throw new Error(`FAIL: Expected -60 for Player 2 holding 6, got ${scoresTop['player_2'].rule6PenaltyScore}`);
}

// Test with globalAceDirection = 'bottom'
const stateBottom = {
  ...state,
  globalAceDirection: 'bottom',
};
const scoresBottom = calculateScore(stateBottom);
console.log('Closed Ace penalty under "bottom" direction (should be -1):', scoresBottom['player_1'].baseClosedScore);
if (scoresBottom['player_1'].baseClosedScore !== -1) {
  throw new Error(`FAIL: Expected -1 for Ace under "bottom", got ${scoresBottom['player_1'].baseClosedScore}`);
}// Test J, Q, K penalty is -10 (not -11, -12, -13)
const stateFaceCards = {
  ...state,
  closedCards: {
    player_1: [
      { id: 'spades-11', suit: SUITS.SPADES, rank: 11, label: 'J', symbol: '♠' },
      { id: 'hearts-12', suit: SUITS.HEARTS, rank: 12, label: 'Q', symbol: '♥' },
      { id: 'clubs-13', suit: SUITS.CLUBS, rank: 13, label: 'K', symbol: '♣' },
      { id: 'diamonds-10', suit: SUITS.DIAMONDS, rank: 10, label: '10', symbol: '♦' },
      { id: 'diamonds-5', suit: SUITS.DIAMONDS, rank: 5, label: '5', symbol: '♦' },
    ],
  },
};
const scoresFace = calculateScore(stateFaceCards);
console.log('J, Q, K, 10, 5 penalty total (should be -45):', scoresFace['player_1'].baseClosedScore);
if (scoresFace['player_1'].baseClosedScore !== -45) {
  throw new Error(`FAIL: Expected -45 for J(-10)+Q(-10)+K(-10)+10(-10)+5(-5), got ${scoresFace['player_1'].baseClosedScore}`);
}

console.log('=== TEST 4: TUTUP RANGKAI BAWAH (DIAMONDS 2 -> A) ===');
const gameBawah = initGame();
gameBawah.firstMoveMade = true;
gameBawah.board[SUITS.DIAMONDS].isOpen = true;
gameBawah.board[SUITS.DIAMONDS].minRank = 2;
gameBawah.board[SUITS.DIAMONDS].maxRank = 7;
gameBawah.board[SUITS.DIAMONDS].playedCards = [
  { suit: SUITS.DIAMONDS, rank: 7, label: '7', symbol: '♦' },
  { suit: SUITS.DIAMONDS, rank: 6, label: '6', symbol: '♦' },
  { suit: SUITS.DIAMONDS, rank: 5, label: '5', symbol: '♦' },
  { suit: SUITS.DIAMONDS, rank: 4, label: '4', symbol: '♦' },
  { suit: SUITS.DIAMONDS, rank: 3, label: '3', symbol: '♦' },
  { suit: SUITS.DIAMONDS, rank: 2, label: '2', symbol: '♦' },
];

gameBawah.hands['player_1'] = [
  { id: 'diamonds-1', suit: SUITS.DIAMONDS, rank: 1, label: 'A', symbol: '♦' },
];
gameBawah.hands['player_2'] = [];
gameBawah.hands['player_3'] = [
  { id: 'diamonds-8', suit: SUITS.DIAMONDS, rank: 8, label: '8', symbol: '♦' },
];
gameBawah.hands['player_4'] = [];
gameBawah.currentPlayer = 'player_1';

const playAceBawahRes = playCard(gameBawah, 'player_1', gameBawah.hands['player_1'][0]);
if (!playAceBawahRes.success) {
  throw new Error('FAIL: Playing A♦ at bottom failed: ' + playAceBawahRes.error);
}

const stateBawah = playAceBawahRes.state;
console.log('globalAceDirection after Tutup Rangkai Bawah:', stateBawah.globalAceDirection);
if (stateBawah.globalAceDirection !== 'bottom') {
  throw new Error(`FAIL: Expected globalAceDirection to be "bottom", got ${stateBawah.globalAceDirection}`);
}

console.log('Diamonds board isCompleted:', stateBawah.board[SUITS.DIAMONDS].isCompleted);
if (!stateBawah.board[SUITS.DIAMONDS].isCompleted) {
  throw new Error('FAIL: Diamonds board should be isCompleted!');
}

console.log('Rule 6 penalty for 8♦ held by Player 3:', stateBawah.rule6Penalties);
if (stateBawah.rule6Penalties.length !== 1 || stateBawah.rule6Penalties[0].playerId !== 'player_3' || stateBawah.rule6Penalties[0].penalty !== -80) {
  throw new Error('FAIL: Player 3 holding 8♦ should have received -80 penalty!');
}

console.log('=== TEST 5: USER SCREENSHOT SCENARIO (PLAYING ACE IS OPTIONAL, CLOSING IS NOT A FAULT) ===');
// Player 4 has A♠ (Spades reached 2..10), A♣, 2♣, etc.
const gameScreenshot = initGame();
gameScreenshot.firstMoveMade = true;
gameScreenshot.board[SUITS.SPADES].isOpen = true;
gameScreenshot.board[SUITS.SPADES].minRank = 2; // reached 2
gameScreenshot.board[SUITS.SPADES].maxRank = 10; // only reached 10
gameScreenshot.hands['player_4'] = [
  { id: 'spades-1', suit: SUITS.SPADES, rank: 1, label: 'A', symbol: '♠' },
  { id: 'clubs-1', suit: SUITS.CLUBS, rank: 1, label: 'A', symbol: '♣' },
  { id: 'clubs-2', suit: SUITS.CLUBS, rank: 2, label: '2', symbol: '♣' },
  { id: 'diamonds-5', suit: SUITS.DIAMONDS, rank: 5, label: '5', symbol: '♦' },
];
gameScreenshot.currentPlayer = 'player_4';

// Check valid moves: A♠ is valid to play
const movesP4 = getValidMoves(gameScreenshot, 'player_4');
console.log('P4 playable moves:', movesP4.map(c => c.id));
if (!movesP4.some(c => c.id === 'spades-1')) {
  throw new Error('FAIL: A♠ should be playable at bottom!');
}

// But Player 4 decides NOT to play A♠, and instead closes A♣ face-down!
console.log('Player 4 decides to close A♣ instead of playing A♠...');
const closeOptionalAceRes = closeCard(gameScreenshot, 'player_4', gameScreenshot.hands['player_4'][1]);
console.log('Close success:', closeOptionalAceRes.success);
console.log('P4 faults count (should be 0):', closeOptionalAceRes.state.faults['player_4'].length);

if (!closeOptionalAceRes.success) {
  throw new Error('FAIL: Player 4 should be allowed to close a card when the only playable card is an Ace!');
}
if (closeOptionalAceRes.state.faults['player_4'].length !== 0) {
  throw new Error('FAIL: Closing card when only Ace is playable should NOT incur a FAULT!');
}

console.log('=== TEST 6: SUIT COMPLETE 2..K WITH DIRECTION CHOICE ===');
const gameBothEnds = initGame();
gameBothEnds.firstMoveMade = true;
gameBothEnds.board[SUITS.SPADES].isOpen = true;
gameBothEnds.board[SUITS.SPADES].minRank = 2; // bottom reached 2
gameBothEnds.board[SUITS.SPADES].maxRank = 13; // top reached K
gameBothEnds.hands['player_1'] = [
  { id: 'spades-1', suit: SUITS.SPADES, rank: 1, label: 'A', symbol: '♠' },
];
gameBothEnds.hands['player_2'] = [
  { id: 'spades-6', suit: SUITS.SPADES, rank: 6, label: '6', symbol: '♠' },
];
gameBothEnds.hands['player_3'] = [
  { id: 'spades-8', suit: SUITS.SPADES, rank: 8, label: '8', symbol: '♠' },
];
gameBothEnds.hands['player_4'] = [];
gameBothEnds.currentPlayer = 'player_1';

// Player 1 plays A♠ and CHOOSES 'bottom'!
const playChooseBottomRes = playCard(gameBothEnds, 'player_1', gameBothEnds.hands['player_1'][0], 'bottom');
if (!playChooseBottomRes.success) throw new Error('FAIL: Play A♠ with choice "bottom" failed');
if (playChooseBottomRes.state.globalAceDirection !== 'bottom') {
  throw new Error(`FAIL: Expected globalAceDirection to be "bottom", got ${playChooseBottomRes.state.globalAceDirection}`);
}
if (playChooseBottomRes.state.board[SUITS.SPADES].closedAt !== 'bottom') {
  throw new Error(`FAIL: Expected closedAt to be "bottom", got ${playChooseBottomRes.state.board[SUITS.SPADES].closedAt}`);
}
// Player 3 holding 8♠ gets -80
if (!playChooseBottomRes.state.rule6Penalties.some(r => r.playerId === 'player_3' && r.penalty === -80)) {
  throw new Error('FAIL: Player 3 holding 8♠ should have received -80 penalty when bottom chosen!');
}

console.log('\n🎉 ALL TUTUP RANGKAI AS TESTS PASSED WITH 100% ACCURACY! 🎉');
