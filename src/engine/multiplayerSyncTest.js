import assert from 'node:assert/strict';
import { initBigTwo, playComboBigTwo, passTurnBigTwo } from '../games/bigtwo/engine/bigtwoEngine.js';
import { initGame41, drawCard41, discardCard41 } from '../games/game41/engine/engine41.js';
import { initGame, playCard, closeCard, getValidMoves } from './gameEngine.js';
import { chooseBigTwoBotMove, chooseGame41BotMove, chooseSevensBotMove, isBotPlayer } from './botAI.js';
import { shouldApplyIncomingGameState } from '../utils/gameStateSync.js';
import {
  isBotRankingEntry,
  hasRealHumanOpponent,
  recordMultiplayerGameStats,
} from '../services/leaderboardService.js';
import { multiplayerAdapter } from '../services/multiplayerAdapter.js';

console.log('=== MULTIPLAYER SYNC, REFRESH & BOT TURN SIMULATION TEST ===');

// ---------------------------------------------------------------------------
// 1. Test shouldApplyIncomingGameState invariants
// ---------------------------------------------------------------------------
{
  const players = [
    { id: 'host_1', name: 'Pardi', isHuman: true, isBot: false },
    { id: 'friend_1', name: 'Lipia', isHuman: true, isBot: false },
    { id: 'bot_1', name: 'Bot 1', isHuman: false, isBot: true },
    { id: 'bot_2', name: 'Bot 2', isHuman: false, isBot: true },
  ];

  const turn1 = initBigTwo({ playerCount: 4, startingPlayerId: 'host_1' }, players);
  const turn1Clone = structuredClone(turn1);

  const m1 = chooseBigTwoBotMove(turn1, 'host_1');
  const r2 = playComboBigTwo(turn1, 'host_1', m1.cards);
  assert.equal(r2.success, true);
  const turn2 = r2.gameState;

  const r3 = passTurnBigTwo(turn2, turn2.currentPlayer);
  assert.equal(r3.success, true);
  const turn3 = r3.gameState;

  assert.equal(turn1.stateVersion, 1);
  assert.equal(turn2.stateVersion, 2);
  assert.equal(turn3.stateVersion, 3);

  // Stale Turn 1 snapshot MUST NEVER overwrite Turn 3 (previously caused refresh/reset bug!)
  assert.equal(
    shouldApplyIncomingGameState(turn3, turn1Clone),
    false,
    'Stale stateVersion=1 snapshot must NOT overwrite stateVersion=3 of the same matchId'
  );

  // Duplicate Turn 3 snapshot (e.g. postgres_changes echo after local optimistic update) MUST NOT re-apply
  assert.equal(
    shouldApplyIncomingGameState(turn3, structuredClone(turn3)),
    false,
    'Duplicate snapshot at same stateVersion must NOT re-apply'
  );

  // Newer Turn 3 snapshot arriving on a peer still at Turn 1 (e.g. after missed delta) MUST apply
  assert.equal(
    shouldApplyIncomingGameState(turn1, turn3),
    true,
    'Newer snapshot (v3) must heal peer stuck at v1'
  );

  // Bot takeover change on same version MUST apply
  const takeover3 = {
    ...turn3,
    players: turn3.players.map((p) => (p.id === 'friend_1' ? { ...p, isBotTakeover: true } : p)),
  };
  assert.equal(
    shouldApplyIncomingGameState(turn3, takeover3),
    true,
    'Bot takeover flag change must apply'
  );

  // New match (Play Again / Kocok Ulang -> new matchId, stateVersion=1) MUST apply even if prev stateVersion=15
  const newMatch = initBigTwo({ playerCount: 4, startingPlayerId: 'friend_1' }, players);
  const oldMatchLate = { ...turn3, stateVersion: 15 };
  assert.notEqual(newMatch.matchId, oldMatchLate.matchId);
  assert.equal(
    shouldApplyIncomingGameState(oldMatchLate, newMatch),
    true,
    'New matchId with stateVersion=1 must replace old match stateVersion=15'
  );
  console.log('✓ Test 1 passed: shouldApplyIncomingGameState blocks stale Turn-1 resets & heals missed deltas.');
}

// ---------------------------------------------------------------------------
// 2. Simulate Full Big Two Multiplayer Match (Host + Friend + 2 Bots)
//    with simulated dropped delta + refresh mid-game
// ---------------------------------------------------------------------------
{
  const players = [
    { id: 'host_1', name: 'Pardi', isHuman: true, isBot: false },
    { id: 'friend_1', name: 'Lipia', isHuman: true, isBot: false },
    { id: 'bot_1', name: 'Bot 1', isHuman: false, isBot: true },
    { id: 'bot_2', name: 'Bot 2', isHuman: false, isBot: true },
  ];

  // Server DB holds latest synced state
  let serverDbState = initBigTwo({ playerCount: 4, startingPlayerId: 'host_1' }, players);
  let hostState = structuredClone(serverDbState);
  let friendState = structuredClone(serverDbState);

  const syncMove = (actingClient, nextState, delta, { dropDeltaForPeer = false } = {}) => {
    // Update acting client & DB (simulating fixed syncGameState)
    serverDbState = structuredClone(nextState);
    if (actingClient === 'host') hostState = nextState;
    else friendState = nextState;

    // 1. Instant delta delivery (unless simulated drop)
    if (!dropDeltaForPeer) {
      if (actingClient === 'host') {
        if (
          delta.matchId === friendState.matchId &&
          delta.stateVersion === (friendState.stateVersion || 0) + 1
        ) {
          const res =
            delta.type === 'PLAY_COMBO'
              ? playComboBigTwo(friendState, delta.playerId, delta.cards)
              : passTurnBigTwo(friendState, delta.playerId);
          assert.equal(res.success, true);
          friendState = res.gameState;
        }
      } else {
        if (
          delta.matchId === hostState.matchId &&
          delta.stateVersion === (hostState.stateVersion || 0) + 1
        ) {
          const res =
            delta.type === 'PLAY_COMBO'
              ? playComboBigTwo(hostState, delta.playerId, delta.cards)
              : passTurnBigTwo(hostState, delta.playerId);
          assert.equal(res.success, true);
          hostState = res.gameState;
        }
      }
    }

    // 2. Subsequent postgres_changes DB checkpoint heals any dropped delta!
    if (shouldApplyIncomingGameState(hostState, serverDbState)) {
      hostState = structuredClone(serverDbState);
    }
    if (shouldApplyIncomingGameState(friendState, serverDbState)) {
      friendState = structuredClone(serverDbState);
    }
  };

  let steps = 0;
  let friendRefreshed = false;
  let hostRefreshed = false;

  while (hostState.gameStatus === 'PLAYING' && steps < 300) {
    steps++;
    const curId = hostState.currentPlayer;
    assert.equal(
      friendState.currentPlayer,
      curId,
      `Step ${steps}: Friend and Host must agree on currentPlayer!`
    );

    const move = chooseBigTwoBotMove(hostState, curId);
    const actingClient = curId === 'friend_1' ? 'friend' : 'host';
    const baseState = actingClient === 'friend' ? friendState : hostState;

    const res =
      move.action === 'play'
        ? playComboBigTwo(baseState, curId, move.cards)
        : passTurnBigTwo(baseState, curId);
    assert.equal(res.success, true, `Step ${steps}: Move failed for ${curId}: ${res.error}`);

    const delta = {
      type: move.action === 'play' ? 'PLAY_COMBO' : 'PASS_TURN',
      playerId: curId,
      cards: move.cards,
      stateVersion: res.gameState.stateVersion,
      matchId: res.gameState.matchId,
    };

    // Simulate a dropped delta every 7th move (previously got Friend stuck on Bot's turn!)
    const dropDelta = steps % 7 === 0;
    syncMove(actingClient, res.gameState, delta, { dropDeltaForPeer: dropDelta });

    // Simulate Friend refreshing browser at step 10
    if (steps === 10 && !friendRefreshed) {
      friendRefreshed = true;
      const versionBeforeRefresh = friendState.stateVersion;
      // On refresh, client loads from serverDbState
      friendState = structuredClone(serverDbState);
      assert.equal(
        friendState.stateVersion,
        versionBeforeRefresh,
        'Friend refresh must resume at exact stateVersion, NOT reset to 1!'
      );
      assert.equal(friendState.currentPlayer, hostState.currentPlayer);
    }

    // Simulate Host refreshing browser at step 15
    if (steps === 15 && !hostRefreshed) {
      hostRefreshed = true;
      const versionBeforeRefresh = hostState.stateVersion;
      hostState = structuredClone(serverDbState);
      assert.equal(
        hostState.stateVersion,
        versionBeforeRefresh,
        'Host refresh must resume at exact stateVersion, NOT reset to 1!'
      );
      assert.equal(hostState.currentPlayer, friendState.currentPlayer);
    }
  }

  assert.equal(hostState.gameStatus, 'GAME_OVER', 'Big Two multiplayer match must finish cleanly');
  assert.equal(friendState.gameStatus, 'GAME_OVER', 'Friend must also see GAME_OVER');
  console.log(`✓ Test 2 passed: Full Big Two match (${steps} turns) completed with simulated dropped deltas & mid-game refreshes.`);
}

// ---------------------------------------------------------------------------
// 3. Verify Game 41 & Sevens stateVersion increments + refresh resilience
// ---------------------------------------------------------------------------
{
  const players = [
    { id: 'host_1', name: 'Pardi', isHuman: true, isBot: false },
    { id: 'friend_1', name: 'Lipia', isHuman: true, isBot: false },
    { id: 'bot_1', name: 'Bot 1', isHuman: false, isBot: true },
    { id: 'bot_2', name: 'Bot 2', isHuman: false, isBot: true },
  ];

  // Game 41
  let g41 = initGame41({ playerCount: 4, firstPlayerId: 'host_1' }, players);
  assert.equal(g41.stateVersion, 1);
  const drawRes = drawCard41(g41, 'host_1', 'stock');
  assert.equal(drawRes.success, true);
  assert.equal(drawRes.state.stateVersion, 2);
  const discardMove = chooseGame41BotMove(drawRes.state, 'host_1');
  const discRes = discardCard41(drawRes.state, 'host_1', discardMove.card);
  assert.equal(discRes.success, true);
  assert.equal(discRes.state.stateVersion, 3);
  assert.equal(shouldApplyIncomingGameState(discRes.state, g41), false);
  assert.equal(shouldApplyIncomingGameState(g41, discRes.state), true);

  // Sevens (4 players: holder of 7♠ starts automatically)
  let sev = initGame({ playerCount: 4 }, players);
  assert.equal(sev.stateVersion, 1);
  const sevStarter = sev.currentPlayer;
  const sevMove = chooseSevensBotMove(sev, sevStarter);
  const sevRes =
    sevMove.action === 'play'
      ? playCard(sev, sevStarter, sevMove.card, sevMove.direction)
      : closeCard(sev, sevStarter, sevMove.card);
  assert.equal(sevRes.success, true);
  assert.equal(sevRes.state.stateVersion, 2);
  assert.equal(shouldApplyIncomingGameState(sevRes.state, sev), false);
  assert.equal(shouldApplyIncomingGameState(sev, sevRes.state), true);

  console.log('✓ Test 3 passed: Game 41 and Sevens stateVersion & stale-snapshot protection verified.');
}

// ---------------------------------------------------------------------------
// 4. Verify Bot-Only Online Matches NEVER Enter Top Global Leaderboard
// ---------------------------------------------------------------------------
{
  const soloOnlineVsBots = [
    { id: 'human_1', name: 'Pardi', isBot: false, rank: 1, pointsEarned: 3 },
    { id: 'bot_1', name: 'Bot 1', isBot: true, rank: 2, pointsEarned: 2 },
    { id: 'bot_2', name: 'Bot 2', isBot: true, rank: 3, pointsEarned: 1 },
    { id: 'bot_3', name: 'Bot 3', isBot: true, rank: 4, pointsEarned: 0 },
  ];
  // Even without explicit isBot flag (e.g., older serialized ranking snapshot)
  const inferredBotsOnly = [
    { id: 'human_1', name: 'Pardi', rank: 1, pointsEarned: 3 },
    { id: 'bot_1', name: 'Bot 1', rank: 2, pointsEarned: 2 },
    { id: 'bot-2', name: 'Bot 2', rank: 3, pointsEarned: 1 },
  ];
  const withHumanOpponent = [
    { id: 'human_1', name: 'Pardi', isBot: false, rank: 1, pointsEarned: 3 },
    { id: 'human_2', name: 'Lipia', isBot: false, rank: 2, pointsEarned: 2 },
    { id: 'bot_1', name: 'Bot 1', isBot: true, rank: 3, pointsEarned: 1 },
    { id: 'bot_2', name: 'Bot 2', isBot: true, rank: 4, pointsEarned: 0 },
  ];

  assert.equal(isBotRankingEntry(soloOnlineVsBots[0]), false);
  assert.equal(isBotRankingEntry(soloOnlineVsBots[1]), true);
  assert.equal(isBotRankingEntry(inferredBotsOnly[1]), true);
  assert.equal(isBotRankingEntry(inferredBotsOnly[2]), true);

  assert.equal(hasRealHumanOpponent(soloOnlineVsBots), false);
  assert.equal(hasRealHumanOpponent(inferredBotsOnly), false);
  assert.equal(hasRealHumanOpponent(withHumanOpponent), true);

  const skipRes1 = await recordMultiplayerGameStats({
    gameType: 'bigtwo',
    rankings: soloOnlineVsBots,
    winnerId: 'human_1',
    isMultiplayer: true,
    myPlayerId: 'human_1',
    isHost: true,
    roomCode: 'BOTONLY1',
  });
  assert.equal(skipRes1?.skipped, true);
  assert.equal(skipRes1?.reason, 'bot_only_match');

  const skipRes2 = await recordMultiplayerGameStats({
    gameType: 'sevens',
    rankings: inferredBotsOnly,
    winnerId: 'human_1',
    isMultiplayer: true,
    myPlayerId: 'human_1',
    isHost: true,
    roomCode: 'BOTONLY2',
  });
  assert.equal(skipRes2?.skipped, true);
  assert.equal(skipRes2?.reason, 'bot_only_match');

  // With >= 2 humans, guard passes (in Node test without env vars it stops cleanly at supabase_offline)
  const validRes = await recordMultiplayerGameStats({
    gameType: 'bigtwo',
    rankings: withHumanOpponent,
    winnerId: 'human_1',
    isMultiplayer: true,
    myPlayerId: 'human_1',
    isHost: true,
    roomCode: 'REALPVP1',
  });
  assert.notEqual(validRes?.reason, 'bot_only_match');

  console.log('✓ Test 4 passed: Bot-only online matches are excluded from Top Global Leaderboard.');
}

// ---------------------------------------------------------------------------
// 5. Verify Room Channel Queue Serialization & Wire Avatar Sanitization
// ---------------------------------------------------------------------------
{
  const order = [];
  const p1 = multiplayerAdapter._enqueueRoomChannelOp('TESTROOM', async () => {
    order.push('start_1');
    await new Promise((r) => setTimeout(r, 20));
    order.push('end_1');
  });
  const p2 = multiplayerAdapter._enqueueRoomChannelOp('TESTROOM', async () => {
    order.push('start_2');
    order.push('end_2');
  });
  await Promise.all([p1, p2]);
  assert.deepEqual(order, ['start_1', 'end_1', 'start_2', 'end_2']);

  assert.equal(multiplayerAdapter._sanitizeWireAvatar('data:image/png;base64,abc123'), '👤');
  assert.equal(multiplayerAdapter._sanitizeWireAvatar('😎'), '😎');
  assert.equal(multiplayerAdapter._sanitizeWireAvatar(''), '👤');

  // Verify _sendChannelBroadcastWithFallback delivers via httpSend when socket is not joined yet
  let httpCalled = null;
  const joiningChannel = {
    state: 'joining',
    channelAdapter: { canPush: () => false },
    send: async () => 'timed out',
    httpSend: async (event, payload) => {
      httpCalled = { event, payload };
      return { success: true };
    },
  };
  const fbRes = await multiplayerAdapter._sendChannelBroadcastWithFallback(
    joiningChannel,
    'room_reaction',
    { emoji: '🔥' },
    'reaction'
  );
  assert.equal(fbRes.success, true);
  assert.equal(fbRes.status, 'http_fallback');
  assert.deepEqual(httpCalled, { event: 'room_reaction', payload: { emoji: '🔥' } });

  // Verify closed channel recovers & sends cleanly
  let recoveredUsed = false;
  const closedChannel = {
    state: 'closed',
    channelAdapter: { canPush: () => false },
    send: async () => 'error',
  };
  const healthyRecovered = {
    state: 'joined',
    channelAdapter: { canPush: () => true },
    send: async () => 'ok',
    httpSend: async () => {
      recoveredUsed = true;
      return { success: true };
    },
  };
  const recRes = await multiplayerAdapter._sendChannelBroadcastWithFallback(
    closedChannel,
    'room_chat',
    { message: 'tes' },
    'chat',
    () => healthyRecovered
  );
  assert.equal(recRes.success, true);
  assert.equal(recoveredUsed, true);

  console.log('✓ Test 5 passed: Room channel ops serialize cleanly, sanitize avatars, and recover/fallback broadcasts.');
}

console.log('\n🎉 ALL MULTIPLAYER SYNC & REFRESH TESTS PASSED!');
