/**
 * Pure state-version comparison helper shared by Multiplayer Adapter, App.jsx, and tests.
 * Determines whether an incoming gameState snapshot (from DB, broadcast, or postgres_changes)
 * should replace the currently active local gameState.
 */
export function shouldApplyIncomingGameState(prev, next) {
  if (!next || !next.players || !next.hands) return false;
  if (!prev || !prev.players || !prev.hands) return true;

  // Different match (restart / kocok ulang / new game): always apply!
  if (next.matchId && prev.matchId && next.matchId !== prev.matchId) return true;

  const prevOver = prev.gameStatus === 'GAME_OVER' || prev.gameStatus === 'game_over';
  const nextOver = next.gameStatus === 'GAME_OVER' || next.gameStatus === 'game_over';
  if (prevOver && !nextOver) return true;
  if (!prevOver && nextOver) return true;

  const prevVersion = Number(prev.stateVersion || 0);
  const nextVersion = Number(next.stateVersion || 0);
  if (nextVersion > 0 && prevVersion > 0) {
    if (nextVersion < prevVersion) return false;
    if (nextVersion === prevVersion) {
      const prevTakeover = (prev.players || []).map((p) => `${p.id}:${Boolean(p.isBotTakeover)}`).join(',');
      const nextTakeover = (next.players || []).map((p) => `${p.id}:${Boolean(p.isBotTakeover)}`).join(',');
      return prevTakeover !== nextTakeover;
    }
    return true;
  }

  const prevTurns = Number(prev.turnNumber || prev.history?.length || 0);
  const nextTurns = Number(next.turnNumber || next.history?.length || 0);
  if (nextTurns > prevTurns) return true;
  if (nextTurns < prevTurns) return false;
  return false;
}

