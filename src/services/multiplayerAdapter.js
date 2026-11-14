/**
 * SUPABASE MULTIPLAYER ADAPTER
 * Manages Room Lifecycle, Player Join/Leave, Realtime Subscriptions,
 * and Game State Synchronization for 4-Player Online Sevens.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { initGame } from '../engine/gameEngine.js';
import { GAME_STATUS } from '../engine/constants.js';
import { initGame41 } from '../games/game41/engine/engine41.js';
import { initBigTwo } from '../games/bigtwo/engine/bigtwoEngine.js';
import { cachePlayerAvatar, getCachedPlayerAvatar } from './leaderboardService.js';
export { shouldApplyIncomingGameState } from '../utils/gameStateSync.js';

export const AVATARS = ['👤', '🦊', '🐼', '🦁', '🐯', '🐨'];
export const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right', 'top_left', 'top_right'];

// Matchmaking: minimum humans/bots needed before an auto-start countdown begins (max is 6)
export const MATCHMAKING_MIN_PLAYERS = 4;

// Local storage session keys
const STORAGE_PLAYER_ID = 'sevens_player_id';
const STORAGE_PLAYER_NAME = 'sevens_player_name';
const STORAGE_ROOM_CODE = 'sevens_room_code';

/**
 * Detects gameType from unique room code prefix (B2- = Big Two, R41- = Remi 41, SV- = Sevens)
 */
export function getGameTypeFromRoomCode(code) {
  if (!code || typeof code !== 'string') return null;
  const upper = code.trim().toUpperCase();
  if (upper.startsWith('B2-') || upper.startsWith('B2_') || upper.startsWith('BT-') || (upper.startsWith('B2') && upper.length >= 6)) return 'bigtwo';
  if (upper.startsWith('R41-') || upper.startsWith('R41_') || upper.startsWith('41-') || (upper.startsWith('R41') && upper.length >= 7)) return 'game41';
  if (upper.startsWith('SV-') || upper.startsWith('SV_') || upper.startsWith('7K-') || (upper.startsWith('SV') && upper.length >= 6)) return 'sevens';
  return null;
}

/**
 * Extracts and cleans room code from URL or raw text, preserving game prefixes and hyphens
 */
export function extractCleanRoomCode(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const text = rawText.trim();

  // 1. URL query param ?room=B2-XXXX or &room=SV-XXXX
  const urlParamMatch = text.match(/[?&]room=([A-Za-z0-9_-]{3,12})/i);
  if (urlParamMatch) return urlParamMatch[1].toUpperCase();

  // 2. Explicit game prefix pattern with hyphen (B2-XXXX, R41-XXXX, SV-XXXX)
  const prefixMatch = text.match(/\b(B2-[A-Za-z0-9]{2,8}|R41-[A-Za-z0-9]{2,8}|SV-[A-Za-z0-9]{2,8})\b/i);
  if (prefixMatch) return prefixMatch[1].toUpperCase();

  // 3. Explicit game prefix pattern without hyphen (B2XXXX -> B2-XXXX)
  const noHyphenMatch = text.match(/\b(B2[A-Za-z0-9]{4}|SV[A-Za-z0-9]{4})\b/i);
  if (noHyphenMatch) {
    const val = noHyphenMatch[1].toUpperCase();
    return `${val.slice(0, 2)}-${val.slice(2)}`;
  }
  const noHyphenR41 = text.match(/\b(R41[A-Za-z0-9]{4})\b/i);
  if (noHyphenR41) {
    const val = noHyphenR41[1].toUpperCase();
    return `R41-${val.slice(3)}`;
  }

  // 4. Explicit "Room/Kode: CODE" pattern
  const roomWordMatch = text.match(/(?:room|kode)\s*[:#-]?\s*([A-Za-z0-9_-]{3,12})/i);
  if (roomWordMatch) return roomWordMatch[1].toUpperCase();

  // 5. Standalone 6-character legacy code (e.g. K7P9X2)
  const legacyMatch = text.match(/\b([A-Za-z0-9]{6})\b/i);
  if (legacyMatch) return legacyMatch[1].toUpperCase();

  // 6. Clean fallback allowing letters, digits, and hyphens
  return text.replace(/[^A-Za-z0-9-]/g, '').slice(0, 12).toUpperCase();
}

/**
 * Generates random unique room code with game-specific prefix:
 * - Big Two: 'B2-XXXX'
 * - Remi 41: 'R41-XXXX'
 * - Sevens: 'SV-XXXX'
 */
export function generateRoomCode(gameType = 'sevens') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const normalizedGame = (gameType || 'sevens').toLowerCase();
  if (normalizedGame === 'bigtwo') return `B2-${rand}`;
  if (normalizedGame === 'game41') return `R41-${rand}`;
  return `SV-${rand}`;
}

/**
 * Gets or creates persistent local player ID
 */
export function getLocalPlayerId() {
  if (typeof localStorage === 'undefined') return 'test_player';
  let id = localStorage.getItem(STORAGE_PLAYER_ID);
  if (!id) {
    id = `p_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem(STORAGE_PLAYER_ID, id);
  }
  return id;
}

/**
 * Gets cached player name
 */
export function getLocalPlayerName() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(STORAGE_PLAYER_NAME) || '';
}

export function getLocalPlayerAvatar(fallback = null) {
  if (typeof localStorage === 'undefined') return fallback || AVATARS[0];
  const saved = localStorage.getItem('sevens_player_avatar');
  if (saved && saved.trim()) return saved.trim();
  try {
    const rawProfile = localStorage.getItem('sevens_user_profile');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (parsed?.avatar && typeof parsed.avatar === 'string' && parsed.avatar.trim()) {
        return parsed.avatar.trim();
      }
    }
  } catch {}
  return fallback || AVATARS[0];
}

/**
 * Saves active session info to localStorage
 */
export function setLocalSession(playerId, name, roomCode) {
  if (typeof localStorage === 'undefined') return;
  if (playerId) localStorage.setItem(STORAGE_PLAYER_ID, playerId);
  if (name) localStorage.setItem(STORAGE_PLAYER_NAME, name);
  if (roomCode) localStorage.setItem(STORAGE_ROOM_CODE, roomCode);
}

/**
 * Clears active room session
 */
export function clearLocalSession() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_ROOM_CODE);
  localStorage.removeItem('sevens_cached_room');
}

/**
 * Gets active session info
 */
export function getActiveSession() {
  if (typeof localStorage === 'undefined') {
    return { playerId: null, playerName: '', roomCode: null };
  }
  return {
    playerId: localStorage.getItem(STORAGE_PLAYER_ID) || null,
    playerName: localStorage.getItem(STORAGE_PLAYER_NAME) || '',
    roomCode: localStorage.getItem(STORAGE_ROOM_CODE) || null,
  };
}

/**
 * Computes clockwise relative seats so viewer is always at 'bottom'
 * Supports 4, 5, or 6 players with responsive seating around the table.
 */
export function getRelativeSeats(players = [], viewerPlayerId) {
  if (!players || players.length === 0) {
    return { bottom: null, left: null, top: null, right: null, topPlayers: [] };
  }

  const myIndex = players.findIndex((p) => p.id === viewerPlayerId);
  const safeIdx = myIndex !== -1 ? myIndex : 0;
  const count = players.length;

  // 2 Players: Head-to-Head (Viewer at Bottom, Opponent directly at Top)
  if (count === 2) {
    const opponent = players[(safeIdx + 1) % 2] || null;
    return {
      bottom: players[safeIdx],
      left: null,
      top: opponent,
      topPlayers: opponent ? [opponent] : [],
      right: null,
    };
  }

  // 3 Players: Triangle (Viewer at Bottom, Next player at Left, Previous player at Right)
  if (count === 3) {
    const pLeft = players[(safeIdx + 1) % 3] || null;
    const pRight = players[(safeIdx + 2) % 3] || null;
    return {
      bottom: players[safeIdx],
      left: pLeft,
      top: null,
      topPlayers: [],
      right: pRight,
    };
  }

  // 4 Players: Standard Cross
  if (count === 4) {
    const topPlayer = players[(safeIdx + 2) % 4] || null;
    return {
      bottom: players[safeIdx],
      left: players[(safeIdx + 1) % 4] || null,
      top: topPlayer,
      topPlayers: topPlayer ? [topPlayer] : [],
      right: players[(safeIdx + 3) % 4] || null,
    };
  }

  // 5 Players: Left (1), Top (2), Right (1)
  if (count === 5) {
    const top1 = players[(safeIdx + 2) % count];
    const top2 = players[(safeIdx + 3) % count];
    return {
      bottom: players[safeIdx],
      left: players[(safeIdx + 1) % count] || null,
      top: top1,
      topPlayers: [top1, top2],
      right: players[(safeIdx + 4) % count] || null,
    };
  }

  // 6 Players: Left (1), Top (3), Right (1)
  const top1 = players[(safeIdx + 2) % count];
  const top2 = players[(safeIdx + 3) % count];
  const top3 = players[(safeIdx + 4) % count];
  return {
    bottom: players[safeIdx],
    left: players[(safeIdx + 1) % count] || null,
    top: top2,
    topPlayers: [top1, top2, top3],
    right: players[(safeIdx + 5) % count] || null,
  };
}

const ROOM_SELECT_COLS = 'id, code, host_id, status, players, game_state, updated_at';
const ROOM_META_COLS = 'id, code, host_id, status, players, updated_at';

// In-memory avatar cache to avoid sending 20-150KB Base64 strings inside rooms.players or game_state
const playerAvatarCache = new Map();
const inflightGetRoom = new Map();

function cacheAvatarsFromPlayers(players = []) {
  if (!Array.isArray(players)) return;
  for (const p of players) {
    if (!p || !p.avatar || p.avatar === '__CACHED__') continue;
    const isCustomImg = typeof p.avatar === 'string' && (p.avatar.startsWith('data:image/') || p.avatar.startsWith('http'));
    const normName = p.name ? String(p.name).trim().toLowerCase() : '';
    if (p.id) {
      const existing = playerAvatarCache.get(`id:${p.id}`);
      if (isCustomImg || !existing || !String(existing).startsWith('data:image/')) {
        playerAvatarCache.set(`id:${p.id}`, p.avatar);
      }
      if (isCustomImg) cachePlayerAvatar(p.id, p.avatar);
    }
    if (normName) {
      const existing = playerAvatarCache.get(`name:${normName}`);
      if (isCustomImg || !existing || !String(existing).startsWith('data:image/')) {
        playerAvatarCache.set(`name:${normName}`, p.avatar);
      }
      if (isCustomImg) cachePlayerAvatar(normName, p.avatar);
    }
  }
}

function resolveCachedAvatar(p, roomPlayers = []) {
  if (!p) return '👤';
  if (typeof p.avatar === 'string' && p.avatar.startsWith('data:image/')) {
    cacheAvatarsFromPlayers([p]);
    return p.avatar;
  }
  const normName = p.name ? String(p.name).trim().toLowerCase() : '';
  if (p.id && playerAvatarCache.has(`id:${p.id}`)) {
    const cached = playerAvatarCache.get(`id:${p.id}`);
    if (cached && cached !== '__CACHED__') return cached;
  }
  if (normName && playerAvatarCache.has(`name:${normName}`)) {
    const cached = playerAvatarCache.get(`name:${normName}`);
    if (cached && cached !== '__CACHED__') return cached;
  }
  const fromGlobalCache = (normName && getCachedPlayerAvatar(normName)) || (p.id && getCachedPlayerAvatar(p.id));
  if (fromGlobalCache && fromGlobalCache !== '__CACHED__') {
    return fromGlobalCache;
  }
  if (Array.isArray(roomPlayers)) {
    const match = roomPlayers.find(
      (rp) =>
        (p.id && rp.id === p.id) ||
        (normName && rp.name && String(rp.name).trim().toLowerCase() === normName)
    );
    if (match?.avatar && match.avatar !== '__CACHED__') {
      cacheAvatarsFromPlayers([match]);
      return match.avatar;
    }
  }
  if (p.avatar && p.avatar !== '__CACHED__') {
    return p.avatar;
  }
  return '👤';
}

function compactPlayersForWire(players = []) {
  if (!Array.isArray(players)) return players;
  cacheAvatarsFromPlayers(players);
  return players.map((p, idx) => {
    if (typeof p?.avatar === 'string' && p.avatar.startsWith('data:image/')) {
      return {
        ...p,
        avatar: AVATARS[(p.seatIndex ?? idx) % AVATARS.length] || '👤',
      };
    }
    return p;
  });
}

function hydratePlayersAvatars(players = []) {
  if (!Array.isArray(players)) return players;
  cacheAvatarsFromPlayers(players);
  return players.map((p) => ({
    ...p,
    avatar: resolveCachedAvatar(p, players),
  }));
}

function hydrateGameStateAvatars(gameState, roomPlayers = []) {
  if (!gameState || typeof gameState !== 'object') return gameState;
  cacheAvatarsFromPlayers(roomPlayers);
  if (Array.isArray(gameState.players)) {
    cacheAvatarsFromPlayers(gameState.players);
  }

  let nextPlayers = gameState.players;
  if (Array.isArray(gameState.players)) {
    nextPlayers = gameState.players.map((p) => ({
      ...p,
      avatar: resolveCachedAvatar(p, roomPlayers),
    }));
  }

  let nextRankings = gameState.rankings;
  if (Array.isArray(gameState.rankings)) {
    nextRankings = gameState.rankings.map((r) => {
      const resolved = resolveCachedAvatar(r.player || r, roomPlayers);
      if (r.player) {
        return {
          ...r,
          avatar: resolved,
          player: { ...r.player, avatar: resolved },
        };
      }
      return { ...r, avatar: resolved };
    });
  }

  let nextLastAction = gameState.lastAction;
  if (nextLastAction && typeof nextLastAction === 'object' && nextLastAction.playerId) {
    const resolvedActionAvatar = resolveCachedAvatar(
      {
        id: nextLastAction.playerId,
        name: nextLastAction.playerName,
        avatar: nextLastAction.avatar,
      },
       nextPlayers || roomPlayers
    );
    if (resolvedActionAvatar && nextLastAction.avatar !== resolvedActionAvatar) {
      nextLastAction = { ...nextLastAction, avatar: resolvedActionAvatar };
    }
  }

  return {
    ...gameState,
    ...(nextPlayers ? { players: nextPlayers } : {}),
    ...(nextRankings ? { rankings: nextRankings } : {}),
    ...(nextLastAction ? { lastAction: nextLastAction } : {}),
  };
}

function hydrateRoomRecord(room, fallbackPlayers = []) {
  if (!room || typeof room !== 'object') return room;
  const rawPlayers = Array.isArray(room.players) && room.players.length > 0 ? room.players : fallbackPlayers;
  const hydratedPlayers = hydratePlayersAvatars(rawPlayers);
  if (room.game_state && typeof room.game_state === 'object') {
    return {
      ...room,
      ...(Array.isArray(room.players) ? { players: hydratedPlayers } : {}),
      game_state: hydrateGameStateAvatars(room.game_state, hydratedPlayers),
    };
  }
  return {
    ...room,
    ...(Array.isArray(room.players) ? { players: hydratedPlayers } : {}),
  };
}

/**
 * Strips heavy Base64 data:image strings & trims unbounded history from game_state
 * before broadcasting / updating on checkpoints (reduces payload by ~95% and prevents Postgres TOAST).
 */
function compactGameStateForWire(gameState) {
  if (!gameState || typeof gameState !== 'object') return gameState;

  if (Array.isArray(gameState.players)) {
    cacheAvatarsFromPlayers(gameState.players);
  }

  const compactPlayers = Array.isArray(gameState.players)
    ? gameState.players.map((p, idx) => {
        if (typeof p?.avatar === 'string' && p.avatar.startsWith('data:image/')) {
          return { ...p, avatar: AVATARS[idx % AVATARS.length] || '__CACHED__' };
        }
        return p;
      })
    : gameState.players;

  const compactRankings = Array.isArray(gameState.rankings)
    ? gameState.rankings.map((r) => {
        const nextR = { ...r };
        if (typeof nextR.avatar === 'string' && nextR.avatar.startsWith('data:image/')) {
          nextR.avatar = '__CACHED__';
        }
        if (nextR.player && typeof nextR.player.avatar === 'string' && nextR.player.avatar.startsWith('data:image/')) {
          nextR.player = { ...nextR.player, avatar: '__CACHED__' };
        }
        return nextR;
      })
    : gameState.rankings;

  const compactHistory =
    Array.isArray(gameState.history) && gameState.history.length > 8
      ? gameState.history.slice(-8)
      : gameState.history;

  const compactActionLog =
    Array.isArray(gameState.actionLog) && gameState.actionLog.length > 8
      ? gameState.actionLog.slice(0, 8)
      : gameState.actionLog;

  let compactLastAction = gameState.lastAction;
  if (
    compactLastAction &&
    typeof compactLastAction === 'object' &&
    typeof compactLastAction.avatar === 'string' &&
    compactLastAction.avatar.startsWith('data:image/')
  ) {
    compactLastAction = { ...compactLastAction, avatar: '__CACHED__' };
  }

  let compactWheel = gameState.firstTurnWheel;
  if (compactWheel && Array.isArray(compactWheel.players)) {
    compactWheel = {
      ...compactWheel,
      players: compactPlayersForWire(compactWheel.players),
    };
  }

  let compactSessionScores = gameState.sessionScores;
  if (compactSessionScores && typeof compactSessionScores === 'object') {
    const nextScores = {};
    for (const [k, v] of Object.entries(compactSessionScores)) {
      if (v && typeof v === 'object' && typeof v.avatar === 'string' && v.avatar.startsWith('data:image/')) {
        nextScores[k] = { ...v, avatar: '__CACHED__' };
      } else {
        nextScores[k] = v;
      }
    }
    compactSessionScores = nextScores;
  }

  return {
    ...gameState,
    ...(compactPlayers ? { players: compactPlayers } : {}),
    ...(compactRankings ? { rankings: compactRankings } : {}),
    ...(compactHistory ? { history: compactHistory } : {}),
    ...(compactActionLog ? { actionLog: compactActionLog } : {}),
    ...(compactLastAction ? { lastAction: compactLastAction } : {}),
    ...(compactWheel ? { firstTurnWheel: compactWheel } : {}),
    ...(compactSessionScores ? { sessionScores: compactSessionScores } : {}),
  };
}

const syncWriteQueue = new Map();
const syncLatestVersion = new Map();

export const multiplayerAdapter = {
  isConfigured() {
    return isSupabaseConfigured;
  },

  hydrateGameState(gameState, roomPlayers = []) {
    return hydrateGameStateAvatars(gameState, roomPlayers);
  },

  /**
   * Fetches room by code (with in-flight deduplication and explicit column selection)
   */
  async getRoom(roomCode) {
    if (!supabase) return { error: 'Supabase belum terkonfigurasi.' };
    const code = extractCleanRoomCode(roomCode);
    if (!code) return { error: 'Kode room tidak valid.' };

    if (inflightGetRoom.has(code)) {
      return inflightGetRoom.get(code);
    }

    const fetchPromise = (async () => {
      try {
        // 1. Direct search with cleaned code
        let { data, error } = await supabase
          .from('rooms')
          .select(ROOM_SELECT_COLS)
          .eq('code', code)
          .maybeSingle();

        if (error) return { error: error.message };
        if (data) return { room: hydrateRoomRecord(data) };

        // 2. Fallback: If code has hyphen, try without hyphen (e.g. SV-ABCD -> SVABCD)
        if (code.includes('-')) {
          const altCode = code.replace(/-/g, '');
          const altRes = await supabase
            .from('rooms')
            .select(ROOM_SELECT_COLS)
            .eq('code', altCode)
            .maybeSingle();
          if (altRes.data) return { room: hydrateRoomRecord(altRes.data) };
        } else {
          // 3. Fallback: If code starts with B2, SV, or R41 without hyphen, try with hyphen
          let formattedWithHyphen = null;
          if (code.startsWith('B2') && code.length > 2) formattedWithHyphen = `B2-${code.slice(2)}`;
          else if (code.startsWith('SV') && code.length > 2) formattedWithHyphen = `SV-${code.slice(2)}`;
          else if (code.startsWith('R41') && code.length > 3) formattedWithHyphen = `R41-${code.slice(3)}`;

          if (formattedWithHyphen) {
            const altRes = await supabase
              .from('rooms')
              .select(ROOM_SELECT_COLS)
              .eq('code', formattedWithHyphen)
              .maybeSingle();
            if (altRes.data) return { room: hydrateRoomRecord(altRes.data) };
          }
        }

        return { room: null };
      } finally {
        inflightGetRoom.delete(code);
      }
    })();

    inflightGetRoom.set(code, fetchPromise);
    return fetchPromise;
  },

  /**
   * Creates a new room as Host with configurable player count (4, 5, or 6) and gameType
   */
  async createRoom(hostName, maxPlayers = 4, gameType = 'sevens', options = {}) {
    if (!supabase) {
      return { success: false, error: 'Supabase belum terkonfigurasi pada .env file.' };
    }

    const name = hostName.trim() || 'Host';
    const code = generateRoomCode(gameType);
    const playerId = getLocalPlayerId();
    const targetMax = [2, 3, 4, 5, 6].includes(Number(maxPlayers)) ? Number(maxPlayers) : 4;
    const effectiveDeckMode = targetMax > 4
      ? (options?.deckMode || (gameType === 'bigtwo' ? 'double' : 'single'))
      : 'single';

    const hostPlayer = {
      id: playerId,
      name,
      seatIndex: 0,
      isHost: true,
      isReady: true,
      avatar: getLocalPlayerAvatar(AVATARS[0]),
      joinedAt: Date.now(),
    };
    cacheAvatarsFromPlayers([hostPlayer]);

    const initialGameState = {
      config: {
        playerCount: targetMax,
        roomPlayerCount: targetMax,
        deckMode: effectiveDeckMode,
      },
      gameType,
    };
    const nowIso = new Date().toISOString();

    const compactPlayers = compactPlayersForWire([hostPlayer]);
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: playerId,
        status: 'lobby',
        players: compactPlayers,
        game_state: initialGameState,
        updated_at: nowIso,
      })
      .select('id, updated_at')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const createdRoom = {
      id: data?.id,
      code,
      host_id: playerId,
      status: 'lobby',
      players: [hostPlayer],
      game_state: initialGameState,
      updated_at: data?.updated_at || nowIso,
    };

    setLocalSession(playerId, name, code);
    return { success: true, room: createdRoom, player: hostPlayer };
  },

  /**
   * Joins an existing room
   */
  async joinRoom(roomCode, playerName, _attempt = 0) {
    if (!supabase) {
      return { success: false, error: 'Supabase belum terkonfigurasi pada .env file.' };
    }

    const name = playerName.trim() || 'Pemain';
    const playerId = getLocalPlayerId();

    const { room, error } = await this.getRoom(roomCode);

    if (error) {
      return { success: false, error: error };
    }
    if (!room) {
      return { success: false, error: `Room ${roomCode} tidak ditemukan! Pastikan kode room benar.` };
    }
    const code = room.code;

    const players = room.players || [];
    const maxPlayers = room.game_state?.config?.playerCount || 4;

    // Check if player already in room (reconnect scenario)
    const normalizedName = name.trim().toLowerCase();
    const existingPlayer =
      players.find(
        (p) => p.id === playerId || (p.name && p.name.trim().toLowerCase() === normalizedName)
      ) ||
      (room.game_state?.players || []).find(
        (p) => p.id === playerId || (p.name && p.name.trim().toLowerCase() === normalizedName)
      );

    if (existingPlayer) {
      // Reconnect: persist matching player id and name
      setLocalSession(existingPlayer.id, existingPlayer.name, code);

      // Check if local profile has a newer custom photo/avatar not yet updated in room
      const localAvatar = getLocalPlayerAvatar();
      if (localAvatar && existingPlayer.avatar !== localAvatar && !existingPlayer.isBot) {
        existingPlayer.avatar = localAvatar;
        cacheAvatarsFromPlayers([existingPlayer]);
        // Only sync non-Base64 emoji avatars to database (Base64 stays local-only to save egress)
        if (!String(localAvatar).startsWith('data:image/')) {
          this.syncPlayerAvatarInRoom(code, existingPlayer.id, localAvatar).catch(() => {});
        }
      }

      return {
        success: true,
        room: hydrateRoomRecord(room),
        player: existingPlayer,
        isReconnected: true,
      };
    }

    // Reuse scenario: Room empty, no real humans, or game was abandoned/stale (> 15 mins without moves)
    const humanPlayers = players.filter((p) => !p.isBot);
    const isStaleGame =
      room.updated_at &&
      Date.now() - new Date(room.updated_at).getTime() > 900000;

    if (players.length === 0 || humanPlayers.length === 0 || (room.status !== 'lobby' && isStaleGame)) {
      const newHostPlayer = {
        id: playerId,
        name,
        seatIndex: 0,
        isHost: true,
        isReady: true,
        avatar: getLocalPlayerAvatar(AVATARS[0] || '👤'),
        joinedAt: Date.now(),
      };
      cacheAvatarsFromPlayers([newHostPlayer]);

      const prevConfig = room.game_state?.config || {};
      const targetSeats = prevConfig.roomPlayerCount || prevConfig.playerCount || 4;
      const targetDeck = prevConfig.deckMode || (targetSeats > 4 ? 'double' : 'single');
      const targetType = room.game_state?.gameType || getGameTypeFromRoomCode(code) || 'sevens';
      const nowIso = new Date().toISOString();
      const nextGs = {
        config: {
          playerCount: targetSeats,
          roomPlayerCount: targetSeats,
          deckMode: targetDeck,
        },
        gameType: targetType,
      };

      const compactPlayers = compactPlayersForWire([newHostPlayer]);
      const { error: updateErr } = await supabase
        .from('rooms')
        .update({
          host_id: playerId,
          players: compactPlayers,
          status: 'lobby',
          game_state: nextGs,
          updated_at: nowIso,
        })
        .eq('id', room.id);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      const updatedRoom = {
        ...room,
        host_id: playerId,
        players: [newHostPlayer],
        status: 'lobby',
        game_state: nextGs,
        updated_at: nowIso,
      };

      setLocalSession(playerId, name, code);
      return { success: true, room: updatedRoom, player: newHostPlayer };
    }

    // Room status checks
    if (room.status !== 'lobby') {
      return { success: false, error: 'Permainan di room ini sudah berlangsung.' };
    }

    if (players.length >= maxPlayers) {
      return { success: false, error: `Room sudah penuh (maksimal ${maxPlayers} pemain).` };
    }

    const seatIdx = players.length;
    const newPlayer = {
      id: playerId,
      name,
      seatIndex: seatIdx,
      isHost: false,
      isReady: false,
      avatar: getLocalPlayerAvatar(AVATARS[seatIdx] || '👤'),
      joinedAt: Date.now(),
    };
    cacheAvatarsFromPlayers([newPlayer]);

    const updatedPlayers = [...players, newPlayer];
    const compactPlayers = compactPlayersForWire(updatedPlayers);
    const nowIso = new Date().toISOString();

    // Optimistic lock: hanya ambil kolom `id` untuk mengecek apakah update berhasil (hemat egress)
    const { data: updatedRows, error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: compactPlayers,
        updated_at: nowIso,
      })
      .eq('id', room.id)
      .eq('status', 'lobby')
      .eq('updated_at', room.updated_at)
      .select('id');

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Room berubah di tengah jalan: ulangi dengan data terbaru (akan menolak jika game sudah mulai)
      if (_attempt < 4) return this.joinRoom(roomCode, playerName, _attempt + 1);
      return { success: false, error: 'Room sedang berubah, coba lagi.' };
    }

    const updatedRoom = {
      ...room,
      players: updatedPlayers,
      updated_at: nowIso,
    };

    setLocalSession(playerId, name, code);
    return { success: true, room: updatedRoom, player: newPlayer };
  },

  /**
   * MATCHMAKING: finds the oldest open matchmaking room for this game (single dynamic 4-6 player queue),
   * or creates a new one where the caller becomes HOST (earliest in queue = host).
   * Backed by atomic Postgres RPC `matchmake` (see supabase/migrations/20261030_matchmaking.sql).
   */
  async findMatch(playerName, gameType = 'sevens') {
    if (!supabase) {
      return { success: false, error: 'Supabase belum terkonfigurasi pada .env file.' };
    }

    const name = (playerName || '').trim() || 'Pemain';
    const playerId = getLocalPlayerId();

    const myAvatar = getLocalPlayerAvatar(AVATARS[0]);
    const wireAvatar = (typeof myAvatar === 'string' && myAvatar.startsWith('data:image/'))
      ? '👤'
      : (myAvatar || '👤');
    cachePlayerAvatar(playerId, myAvatar);
    if (name) cachePlayerAvatar(name, myAvatar);

    const { data, error } = await supabase.rpc('matchmake', {
      p_game_type: gameType || 'sevens',
      p_player: { id: playerId, name, avatar: wireAvatar, joinedAt: Date.now() },
    });

    if (error) {
      const msg = error.message || '';
      if (error.code === 'PGRST202' || /could not find the function/i.test(msg)) {
        return {
          success: false,
          error:
            "Fungsi matchmaking belum dipasang di Supabase. Jalankan file supabase/migrations/20261030_matchmaking.sql di SQL Editor.",
        };
      }
      return { success: false, error: msg || 'Gagal mencari lawan.' };
    }

    if (!data || !data.room || !data.player) {
      return { success: false, error: 'Matchmaking tidak mengembalikan room.' };
    }

    // Ensure player object carries local profile avatar if RPC used default/fallback
    const returnedRoom = data.room;
    const returnedPlayer = { ...data.player, avatar: myAvatar || data.player.avatar };
    if (returnedRoom && Array.isArray(returnedRoom.players)) {
      returnedRoom.players = returnedRoom.players.map((p) => {
        if (p.id === playerId && !p.isBot) {
          return { ...p, avatar: myAvatar };
        }
        return p;
      });
      cacheAvatarsFromPlayers(returnedRoom.players);
    }

    setLocalSession(playerId, name, returnedRoom.code);

    // Sync non-Base64 emoji avatar update to database if RPC created/joined with default emoji
    if (myAvatar && !String(myAvatar).startsWith('data:image/') && data.player.avatar !== myAvatar) {
      this.syncPlayerAvatarInRoom(returnedRoom.code, playerId, myAvatar).catch(() => {});
    }

    return { success: true, room: hydrateRoomRecord(returnedRoom), player: returnedPlayer, created: Boolean(data.created) };
  },

  /**
   * Keeps a matchmaking room "alive" so ghost rooms (host closed the tab) drop out of the queue.
   */
  async touchRoom(roomCode) {
    if (!supabase || !roomCode) return;
    await supabase
      .from('rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('code', roomCode)
      .eq('status', 'lobby');
  },

  /**
   * Host fills ALL empty seats with bots in one update (used by matchmaking prompt)
   */
  async fillBots(roomCode, hostId, targetCount = null, _attempt = 0) {
    if (!supabase) return { success: false, error: 'Supabase offline.' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };

    if (room.host_id !== hostId) {
      return { success: false, error: 'Hanya Host yang dapat menambahkan bot!' };
    }
    if (room.status !== 'lobby') {
      return { success: false, error: 'Permainan sudah dimulai.' };
    }

    const currentPlayers = room.players || [];
    const seatCapacity = room.game_state?.config?.roomPlayerCount || room.game_state?.config?.playerCount || 4;
    const maxPlayers = targetCount ? Math.min(targetCount, seatCapacity) : seatCapacity;
    const missing = maxPlayers - currentPlayers.length;
    if (missing <= 0) return { success: true, room };

    const botAvatars = ['🤖', '👾', '🦾', '🧠', '⚙️', '🛸'];
    const existingBots = currentPlayers.filter((p) => p.isBot).length;
    const newBots = Array.from({ length: missing }).map((_, i) => {
      const botNumber = existingBots + i + 1;
      return {
        id: `bot_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        name: `Bot ${botNumber}`,
        seatIndex: currentPlayers.length + i,
        isHost: false,
        isReady: true,
        isBot: true,
        avatar: botAvatars[(botNumber - 1) % botAvatars.length],
        joinedAt: Date.now(),
      };
    });

    const updatedPlayers = [...currentPlayers, ...newBots];
    const nowIso = new Date().toISOString();

    const { data: botRows, error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        updated_at: nowIso,
      })
      .eq('code', room.code)
      .eq('status', 'lobby')
      .eq('updated_at', room.updated_at)
      .select('id');

    // Ada pemain yang baru join / berubah: ulangi agar pemain itu tidak tertimpa
    if (!updateErr && (!botRows || botRows.length === 0)) {
      if (_attempt < 4) return this.fillBots(roomCode, hostId, targetCount, _attempt + 1);
      return { success: false, error: 'Room sedang berubah, coba lagi.' };
    }

    if (updateErr) return { success: false, error: updateErr.message };
    return {
      success: true,
      room: { ...room, players: updatedPlayers, updated_at: nowIso },
    };
  },

  /**
   * Toggles ready state for a player (fetches only metadata columns, not full game_state)
   */
  async toggleReady(roomCode, playerId, isReady, _attempt = 0) {
    if (!supabase) return;
    const code = extractCleanRoomCode(roomCode);
    if (!code) return;

    const { data: room } = await supabase
      .from('rooms')
      .select(ROOM_META_COLS)
      .eq('code', code)
      .maybeSingle();

    if (!room || room.status !== 'lobby') return;

    const updatedPlayers = (room.players || []).map((p) => {
      if (p.id === playerId) {
        return { ...p, isReady };
      }
      return p;
    });
    const compactPlayers = compactPlayersForWire(updatedPlayers);

    const { data: rows } = await supabase
      .from('rooms')
      .update({
        players: compactPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .eq('status', 'lobby')
      .eq('updated_at', room.updated_at)
      .select('id');

    if ((!rows || rows.length === 0) && _attempt < 4) {
      return this.toggleReady(roomCode, playerId, isReady, _attempt + 1);
    }
  },

  /**
   * Host adds a Bot into the room
   */
  async addBot(roomCode, hostId) {
    if (!supabase) return { success: false, error: 'Supabase offline.' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    if (room.host_id !== hostId) {
      return { success: false, error: 'Hanya Host yang dapat menambahkan bot!' };
    }

    if (room.status !== 'lobby') {
      return { success: false, error: 'Permainan sudah dimulai.' };
    }

    const currentPlayers = room.players || [];
    const maxPlayers = room.game_state?.config?.playerCount || 4;
    if (currentPlayers.length >= maxPlayers) {
      return { success: false, error: `Meja sudah penuh (maksimal ${maxPlayers} pemain)!` };
    }

    const botCount = currentPlayers.filter((p) => p.isBot).length + 1;
    const botAvatars = ['🤖', '👾', '🦾', '🧠', '⚙️', '🛸'];
    const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextSeat = currentPlayers.length;

    const botPlayer = {
      id: botId,
      name: `Bot ${botCount}`,
      seatIndex: nextSeat,
      isHost: false,
      isReady: true,
      isBot: true,
      avatar: botAvatars[(botCount - 1) % botAvatars.length],
      joinedAt: Date.now(),
    };

    const updatedPlayers = [...currentPlayers, botPlayer];
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        updated_at: nowIso,
      })
      .eq('code', code);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return {
      success: true,
      room: { ...room, players: updatedPlayers, updated_at: nowIso },
      bot: botPlayer,
    };
  },

  /**
   * Host removes a Bot from the room
   */
  async removeBot(roomCode, hostId, botId) {
    if (!supabase) return { success: false, error: 'Supabase offline.' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    if (room.host_id !== hostId) {
      return { success: false, error: 'Hanya Host yang dapat mengeluarkan bot!' };
    }

    if (room.status !== 'lobby') {
      return { success: false, error: 'Permainan sudah dimulai.' };
    }

    const currentPlayers = room.players || [];
    const updatedPlayers = currentPlayers
      .filter((p) => p.id !== botId)
      .map((p, idx) => ({ ...p, seatIndex: idx }));
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        updated_at: nowIso,
      })
      .eq('code', code);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return {
      success: true,
      room: { ...room, players: updatedPlayers, updated_at: nowIso },
    };
  },

  /**
   * Host updates room config (e.g. deckMode: 'double' | 'single')
   */
  async updateRoomConfig(roomCode, hostId, configUpdates = {}) {
    if (!supabase) return { success: false, error: 'Supabase offline.' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    if (room.host_id !== hostId) {
      return { success: false, error: 'Hanya Host yang dapat mengubah konfigurasi meja!' };
    }

    const currentConfig = room.game_state?.config || {};
    const updatedConfig = { ...currentConfig, ...configUpdates };
    const updatedGameState = {
      ...(room.game_state || {}),
      config: updatedConfig,
    };
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('rooms')
      .update({
        game_state: updatedGameState,
        updated_at: nowIso,
      })
      .eq('code', code);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return {
      success: true,
      room: { ...room, game_state: updatedGameState, updated_at: nowIso },
    };
  },

  /**
   * Merges two sessionScores maps so neither server nor client ever overwrites a more complete session history.
   * Matches entries consistently by player name or ID to prevent duplicates.
   */
  mergeSessionScoreMaps(mapA = {}, mapB = {}) {
    const merged = {};
    const addEntries = (src) => {
      if (!src || typeof src !== 'object') return;
      Object.entries(src).forEach(([rawKey, val]) => {
        if (!val || typeof val !== 'object') return;
        const normName = val.name ? val.name.trim().toLowerCase() : '';
        const normKey = normName || val.id || rawKey;
        if (!normKey) return;

        // Cari apakah sudah ada entri dengan normName atau normKey
        const existingKey = Object.keys(merged).find(
          (k) => k === normKey || (normName && merged[k]?.name && merged[k].name.trim().toLowerCase() === normName)
        );
        const existing = existingKey ? merged[existingKey] : null;

        const gamesNew = Number(val.games || 0);
        const winsNew = Number(val.wins || 0);
        const scoreNew = Number(val.score || 0);

        if (!existing) {
          merged[normKey] = {
            ...val,
            id: val.id || normKey,
            games: gamesNew,
            wins: winsNew,
            score: scoreNew,
          };
        } else {
          const gamesOld = Number(existing.games || 0);
          const winsOld = Number(existing.wins || 0);
          const scoreOld = Number(existing.score || 0);
          const bestGames = Math.max(gamesNew, gamesOld);
          const bestWins = Math.max(winsNew, winsOld);
          const bestScore = Math.max(scoreNew, scoreOld);

          merged[existingKey] = {
            ...existing,
            ...val,
            name: val.name || existing.name,
            avatar: val.avatar || existing.avatar,
            id: val.id || existing.id,
            games: bestGames,
            wins: bestWins,
            score: bestScore,
          };
        }
      });
    };
    addEntries(mapA);
    addEntries(mapB);
    return merged;
  },

  /**
   * Host starts the game for all players
   */
  async startGame(roomCode, hostId, configOverrides = {}, forceGameType = null, _attempt = 0) {
    if (!supabase) return { success: false, error: 'Supabase offline.' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    if (room.host_id !== hostId) {
      return { success: false, error: 'Hanya HOST yang dapat memulai permainan!' };
    }

    const players = room.players || [];
    if (players.length < 2) {
      return {
        success: false,
        error: `Permainan membutuhkan minimal 2 pemain untuk dimulai (saat ini baru ${players.length} pemain)!`,
      };
    }

    const actualPlayerCount = players.length;

    // Format players into Engine structure (preserving isBot and isHuman flags)
    const formattedPlayers = players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      seat: SEAT_POSITIONS[idx] || `seat_${idx + 1}`,
      isHuman: !p.isBot,
      isBot: Boolean(p.isBot),
      avatar: p.avatar,
      isHost: Boolean(p.isHost),
    }));

    const safeOverrides =
      configOverrides && typeof configOverrides === 'object' && !configOverrides.nativeEvent
        ? configOverrides
        : {};

    // Initialize state from decoupled Game Engine with correct player count & gameType
    const determinedGameType =
      forceGameType ||
      safeOverrides?.gameType ||
      room.game_state?.gameType ||
      getGameTypeFromRoomCode(code) ||
      'sevens';

    // Preserve any accumulated sessionScores for this room across rounds
    const carriedSessionScores = this.mergeSessionScoreMaps(
      room.game_state?.sessionScores,
      safeOverrides?.sessionScores
    );

    let gameState;
    if (determinedGameType === 'bigtwo') {
      const effectiveDeckMode = actualPlayerCount > 4
        ? (safeOverrides.deckMode || room.game_state?.config?.deckMode || 'double')
        : 'single';
      gameState = initBigTwo(
        {
          ...safeOverrides,
          playerCount: actualPlayerCount,
          deckMode: effectiveDeckMode,
          sessionScores: carriedSessionScores,
        },
        formattedPlayers
      );
    } else if (determinedGameType === 'game41') {
      gameState = initGame41(
        { ...safeOverrides, playerCount: actualPlayerCount, sessionScores: carriedSessionScores },
        formattedPlayers
      );
      gameState.sessionScores = carriedSessionScores;
    } else {
      gameState = initGame(
        { ...safeOverrides, playerCount: actualPlayerCount, sessionScores: carriedSessionScores },
        formattedPlayers
      );
      gameState.sessionScores = carriedSessionScores;
    }

    // Preserve original room capacity seats so room capacity is never lost after starting a match
    const targetRoomSeats = safeOverrides.roomPlayerCount ||
      safeOverrides.playerCount ||
      room.game_state?.config?.roomPlayerCount ||
      room.game_state?.config?.playerCount ||
      actualPlayerCount;

    if (gameState && gameState.config) {
      gameState.config.roomPlayerCount = targetRoomSeats;
      gameState.config.desiredPlayerCount = targetRoomSeats;
      delete gameState.config.sessionScores;
    }

    const chosenStartId = safeOverrides.startingPlayerId || safeOverrides.firstPlayerId;
    if (gameState && chosenStartId) {
      gameState.currentPlayer = chosenStartId;
      if (determinedGameType === 'bigtwo') {
        gameState.trickLeaderId = chosenStartId;
      }
    }

    if (gameState && safeOverrides.firstTurnWheel) {
      gameState.firstTurnWheel = safeOverrides.firstTurnWheel;
    }

    const nowIso = new Date().toISOString();
    const compactState = compactGameStateForWire(gameState);

    // Optimistic lock: jika ada pemain yang baru join saat kartu dikocok, ulangi dengan roster terbaru
    const { data: startedRows, error: updateErr } = await supabase
      .from('rooms')
      .update({
        status: 'playing',
        game_state: compactState,
        updated_at: nowIso,
      })
      .eq('code', code)
      .eq('updated_at', room.updated_at)
      .select('id');

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }
    if (!startedRows || startedRows.length === 0) {
      if (_attempt < 4) return this.startGame(roomCode, hostId, configOverrides, forceGameType, _attempt + 1);
      return { success: false, error: 'Room sedang berubah, coba mulai lagi.' };
    }

    const startedRoom = hydrateRoomRecord({
      ...room,
      status: 'playing',
      game_state: gameState,
      updated_at: nowIso,
    });
    this.broadcastRoomState(code, {
      ...room,
      status: 'playing',
      game_state: compactState,
      updated_at: nowIso,
    });
    return { success: true, room: startedRoom, gameState };
  },

  /**
   * Broadcasts room state directly over WebSocket channel (compacted to avoid large Base64 payloads)
   */
  async broadcastRoomState(roomCode, roomRecord) {
    if (!supabase || !roomCode || !roomRecord) return;
    const code = roomCode.trim().toUpperCase();
    const ch = await this.ensureRoomChannel(code);
    if (!ch) return;
    try {
      const compactPayload = roomRecord.game_state
        ? { ...roomRecord, game_state: compactGameStateForWire(roomRecord.game_state) }
        : roomRecord;
      await ch.send({
        type: 'broadcast',
        event: 'room_state_sync',
        payload: compactPayload,
      });
    } catch {}
  },

  /**
   * Broadcasts a minimal game action delta (e.g. CARD_PLAYED, PASS_TURN) without sending full state
   */
  async sendGameActionDelta(roomCode, deltaPayload) {
    if (!supabase || !roomCode || !deltaPayload) return;
    const code = roomCode.trim().toUpperCase();
    const ch = await this.ensureRoomChannel(code);
    if (!ch) return;
    try {
      await ch.send({
        type: 'broadcast',
        event: 'game_action_delta',
        payload: {
          ...deltaPayload,
          roomCode: code,
          timestamp: Date.now(),
        },
      });
    } catch (e) {
      console.warn('[multiplayerAdapter] Failed to send game action delta:', e);
    }
  },

  /**
   * Request state snapshot from host or peers when client desyncs or reconnects
   */
  async requestRoomStateSync(roomCode, requesterId) {
    if (!supabase || !roomCode) return;
    const code = roomCode.trim().toUpperCase();
    const ch = await this.ensureRoomChannel(code);
    if (!ch) return;
    try {
      await ch.send({
        type: 'broadcast',
        event: 'request_state_sync',
        payload: {
          roomCode: code,
          requesterId,
          timestamp: Date.now(),
        },
      });
    } catch (e) {}
  },

  /**
   * Synchronizes updated Game Engine state to Supabase.
   * Sends minimal actionDelta over WebSocket Broadcast for instant peer animation,
   * and persists compacted game_state (~2-3KB without Base64) to Supabase sequentially per room
   * so page refresh/reconnect never resets to Turn 1 and missed deltas self-heal automatically.
   */
  async syncGameState(roomCode, nextGameState, actionDelta = null) {
    if (!supabase || !roomCode || !nextGameState) return { success: false };
    const code = roomCode.trim().toUpperCase();
    const isOver =
      nextGameState.gameStatus === GAME_STATUS.GAME_OVER ||
      nextGameState.gameStatus === 'GAME_OVER' ||
      nextGameState.gameStatus === 'game_over';
    const nextStatus = isOver ? 'game_over' : 'playing';
    const nowIso = new Date().toISOString();
    const stateVersion = Number(nextGameState.stateVersion || 0);
    const matchId = nextGameState.matchId || null;

    // 1. Broadcast minimal delta immediately for instant peer responsiveness
    if (actionDelta) {
      this.sendGameActionDelta(code, {
        ...actionDelta,
        ...(stateVersion ? { stateVersion } : {}),
        ...(matchId ? { matchId } : {}),
      }).catch(() => {});
    }

    const compactState = compactGameStateForWire(nextGameState);

    // 2. For full checkpoint syncs (no delta: e.g. wheel complete) or Game Over, also broadcast full snapshot
    if (isOver || !actionDelta) {
      this.broadcastRoomState(code, {
        code,
        status: nextStatus,
        game_state: compactState,
        updated_at: nowIso,
      });
    }

    // Track highest version seen for this room+matchId so out-of-order queued writes are skipped
    const prevLatest = syncLatestVersion.get(code);
    if (
      prevLatest &&
      prevLatest.matchId === matchId &&
      stateVersion > 0 &&
      prevLatest.version > stateVersion
    ) {
      return { success: true };
    }
    syncLatestVersion.set(code, { matchId, version: stateVersion });

    // Serialize DB writes per room so consecutive moves (e.g. rapid bots) never commit out of order
    const prevWrite = syncWriteQueue.get(code) || Promise.resolve();
    const nextWrite = prevWrite
      .catch(() => {})
      .then(async () => {
        const latest = syncLatestVersion.get(code);
        if (
          latest &&
          latest.matchId === matchId &&
          stateVersion > 0 &&
          latest.version > stateVersion
        ) {
          return { success: true };
        }

        const { error } = await supabase
          .from('rooms')
          .update({
            game_state: compactState,
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('code', code)
          .neq('status', 'lobby');

        if (error) {
          console.error('Failed to sync game state:', error);
          return { success: false, error: error.message };
        }
        return { success: true };
      });

    syncWriteQueue.set(code, nextWrite);
    return nextWrite;
  },

  /**
   * Restarts the game (Play Again)
   */
  async restartGame(roomCode, hostId, configOverrides = {}) {
    if (!supabase) return { success: false };
    const { room } = await this.getRoom(roomCode);
    if (!room || room.host_id !== hostId) return { success: false };
    const code = room.code;

    const formattedPlayers = (room.players || []).map((p, idx) => ({
      id: p.id,
      name: p.name,
      seat: SEAT_POSITIONS[idx] || `seat_${idx + 1}`,
      isHuman: !p.isBot,
      isBot: Boolean(p.isBot),
      avatar: p.avatar,
      isHost: Boolean(p.isHost),
    }));

    if (formattedPlayers.length < 2) {
      return { success: false, error: 'Minimal 2 pemain untuk memulai ulang permainan.' };
    }

    const safeOverrides =
      configOverrides && typeof configOverrides === 'object' && !configOverrides.nativeEvent
        ? configOverrides
        : {};

    const actualPlayerCount = formattedPlayers.length;
    const determinedGameType =
      safeOverrides?.gameType ||
      room.game_state?.gameType ||
      getGameTypeFromRoomCode(code) ||
      'sevens';
    const prevWinnerId =
      safeOverrides?.startingPlayerId ||
      safeOverrides?.firstPlayerId ||
      room.game_state?.winner?.id ||
      (typeof room.game_state?.winner === 'string' ? room.game_state.winner : null) ||
      null;

    // Merge server room.game_state.sessionScores and client safeOverrides.sessionScores so neither loses games
    const carriedSessionScores = this.mergeSessionScoreMaps(
      room.game_state?.sessionScores,
      safeOverrides?.sessionScores
    );

    let nextGameState;
    if (determinedGameType === 'bigtwo') {
      const effectiveDeckMode = actualPlayerCount > 4
        ? (safeOverrides.deckMode || room.game_state?.config?.deckMode || 'double')
        : 'single';
      nextGameState = initBigTwo(
        {
          ...safeOverrides,
          startingPlayerId: prevWinnerId,
          firstPlayerId: prevWinnerId,
          playerCount: actualPlayerCount,
          deckMode: effectiveDeckMode,
          sessionScores: carriedSessionScores,
        },
        formattedPlayers
      );
    } else if (determinedGameType === 'game41') {
      nextGameState = initGame41(
        {
          ...safeOverrides,
          firstPlayerId: prevWinnerId,
          playerCount: actualPlayerCount,
          sessionScores: carriedSessionScores,
        },
        formattedPlayers
      );
      nextGameState.sessionScores = carriedSessionScores;
    } else {
      nextGameState = initGame(
        {
          ...safeOverrides,
          playerCount: actualPlayerCount,
          sessionScores: carriedSessionScores,
        },
        formattedPlayers
      );
      nextGameState.sessionScores = carriedSessionScores;
    }

    if (nextGameState?.config) {
      delete nextGameState.config.sessionScores;
    }

    const nowIso = new Date().toISOString();
    const compactState = compactGameStateForWire(nextGameState);

    await supabase
      .from('rooms')
      .update({
        status: 'playing',
        game_state: compactState,
        updated_at: nowIso,
      })
      .eq('code', code);

    this.broadcastRoomState(code, {
      code,
      status: 'playing',
      players: room.players,
      game_state: compactState,
      updated_at: nowIso,
    });

    return { success: true, gameState: nextGameState };
  },

  /**
   * Leaves room and handles host migration / deletion
   */
  async leaveRoom(roomCode, playerId, playerName = '') {
    clearLocalSession();
    if (!supabase) return;

    const { room } = await this.getRoom(roomCode);
    if (!room) return;
    const code = room.code;

    const cleanName = (playerName || '').trim().toLowerCase();
    const remainingPlayers = (room.players || []).filter(
      (p) => p.id !== playerId && (!cleanName || (p.name || '').trim().toLowerCase() !== cleanName)
    );
    const remainingHumans = remainingPlayers.filter((p) => !p.isBot);
    const prevConfig = room.game_state?.config || {};
    const prevSeats = prevConfig.roomPlayerCount || prevConfig.playerCount || 4;
    const prevDeck = prevConfig.deckMode || (prevSeats > 4 ? 'double' : 'single');
    const prevType = room.game_state?.gameType || getGameTypeFromRoomCode(code) || 'sevens';

    if (remainingPlayers.length === 0 || remainingHumans.length === 0) {
      if (room.game_state?.matchmaking) {
        // If it's a matchmaking queue room and all humans left, DELETE immediately so it doesn't linger
        await supabase.from('rooms').delete().eq('code', code);
        return;
      }
      // Room empty or no humans left: preserve room in database for reuse!
      // Keep existing non-null host_id, clean players, reset status to lobby, preserve configured seats!
      await supabase
        .from('rooms')
        .update({
          players: [],
          status: 'lobby',
          game_state: {
            config: {
              playerCount: prevSeats,
              roomPlayerCount: prevSeats,
              deckMode: prevDeck,
            },
            gameType: prevType,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('code', code);
      return;
    }

    let nextHostId = room.host_id;
    if (room.host_id === playerId) {
      // Transfer host to first remaining human player, or first remaining player
      const nextHuman = remainingPlayers.find((p) => !p.isBot);
      if (nextHuman) {
        nextHuman.isHost = true;
        nextHostId = nextHuman.id;
      } else if (remainingPlayers[0]) {
        remainingPlayers[0].isHost = true;
        nextHostId = remainingPlayers[0].id;
      }
    }

    await supabase
      .from('rooms')
      .update({
        host_id: nextHostId,
        players: remainingPlayers,
        status: remainingPlayers.length < 2 && room.status === 'playing' ? 'lobby' : room.status,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code);
  },

  /**
   * Sets or clears Bot Takeover for an AFK player (with optimistic lock so concurrent card plays are never overwritten)
   */
  async toggleBotTakeover(roomCode, playerId, isTakeover = true, _attempt = 0) {
    if (!supabase) return { success: false, error: 'Supabase offline' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    const updatedPlayers = (room.players || []).map((p) => {
      if (p.id === playerId) {
        return { ...p, isBotTakeover: Boolean(isTakeover) };
      }
      return p;
    });

    let updatedGameState = room.game_state;
    if (updatedGameState && updatedGameState.players) {
      const gsPlayers = updatedGameState.players.map((p) => {
        if (p.id === playerId) {
          return { ...p, isBotTakeover: Boolean(isTakeover) };
        }
        return p;
      });
      updatedGameState = {
        ...updatedGameState,
        stateVersion: (updatedGameState.stateVersion || 1) + 1,
        players: gsPlayers,
        turnStartedAt: Date.now(),
      };
    }

    const nowIso = new Date().toISOString();
    const compactState = compactGameStateForWire(updatedGameState);

    const { data: updatedRows, error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        game_state: compactState,
        updated_at: nowIso,
      })
      .eq('code', code)
      .eq('updated_at', room.updated_at)
      .select('id');

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      if (_attempt < 4) {
        return this.toggleBotTakeover(roomCode, playerId, isTakeover, _attempt + 1);
      }
      return { success: false, error: 'Status permainan sedang diperbarui, coba lagi.' };
    }

    const updatedRoom = hydrateRoomRecord({
      ...room,
      players: updatedPlayers,
      game_state: updatedGameState,
      updated_at: nowIso,
    });
    this.broadcastRoomState(code, {
      ...room,
      players: updatedPlayers,
      game_state: compactState,
      updated_at: nowIso,
    });
    return { success: true, room: updatedRoom };
  },

  /**
   * Transfers or claims host role to a player
   */
  async claimHost(roomCode, newHostId) {
    if (!supabase) return { success: false, error: 'Supabase offline' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    const updatedPlayers = (room.players || []).map((p) => ({
      ...p,
      isHost: p.id === newHostId,
    }));

    let updatedGameState = room.game_state;
    if (updatedGameState && updatedGameState.players) {
      updatedGameState = {
        ...updatedGameState,
        players: updatedGameState.players.map((p) => ({
          ...p,
          isHost: p.id === newHostId,
        })),
      };
    }

    const nowIso = new Date().toISOString();
    const compactState = compactGameStateForWire(updatedGameState);

    const { error: updateErr } = await supabase
      .from('rooms')
      .update({
        host_id: newHostId,
        players: updatedPlayers,
        game_state: compactState,
        updated_at: nowIso,
      })
      .eq('code', code);

    if (updateErr) return { success: false, error: updateErr.message };
    const updatedRoom = hydrateRoomRecord({
      ...room,
      host_id: newHostId,
      players: updatedPlayers,
      game_state: updatedGameState,
      updated_at: nowIso,
    });
    return { success: true, room: updatedRoom };
  },

  /**
   * Synchronizes the player's emoji avatar in the active room (Base64 photos stay local-only to avoid egress & state clobbering)
   */
  async syncPlayerAvatarInRoom(roomCode, playerId, newAvatar) {
    if (!supabase || !roomCode || !playerId || !newAvatar) return { success: false };
    if (String(newAvatar).startsWith('data:image/')) {
      playerAvatarCache.set(playerId, newAvatar);
      return { success: true };
    }
    const code = roomCode.trim().toUpperCase();
    try {
      const { room } = await this.getRoom(code);
      if (!room) return { success: false };

      let changed = false;
      const updatedPlayers = (room.players || []).map((p) => {
        if (p.id === playerId && !p.isBot && p.avatar !== newAvatar) {
          changed = true;
          playerAvatarCache.set(p.id, newAvatar);
          if (p.name) playerAvatarCache.set(`name:${p.name.trim().toLowerCase()}`, newAvatar);
          return { ...p, avatar: newAvatar };
        }
        return p;
      });

      if (!changed) return { success: true, room };

      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('rooms')
        .update({
          players: compactPlayersForWire(updatedPlayers),
          updated_at: nowIso,
        })
        .eq('code', code);

      if (!updateErr) {
        const updatedRoom = hydrateRoomRecord({
          ...room,
          players: updatedPlayers,
          updated_at: nowIso,
        });
        return { success: true, room: updatedRoom };
      }
    } catch (e) {
      console.warn('[multiplayerAdapter] Failed to sync player avatar in room:', e);
    }
    return { success: false };
  },

  /**
   * Resets room to lobby: clears active cards/hands, sets status to lobby, preserves sessionScores unless clearScores is true
   */
  async resetRoomState(roomCode, requesterId, clearScores = false) {
    if (!supabase) return { success: false, error: 'Supabase offline' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    const prevConfig = room.game_state?.config || {};
    const prevSeats = prevConfig.roomPlayerCount || prevConfig.playerCount || 4;
    const prevDeck = prevConfig.deckMode || (prevSeats > 4 ? 'double' : 'single');
    const prevType = room.game_state?.gameType || getGameTypeFromRoomCode(code) || 'sevens';
    const prevSessionScores = clearScores ? {} : (room.game_state?.sessionScores || {});

    // Reset players ready status, reset any bot takeover
    const cleanPlayers = (room.players || []).map((p) => ({
      ...p,
      isReady: p.id === (room.host_id || requesterId),
      isBotTakeover: false,
    }));

    const nowIso = new Date().toISOString();
    const nextGameState = {
      config: {
        playerCount: prevSeats,
        roomPlayerCount: prevSeats,
        deckMode: prevDeck,
      },
      gameType: prevType,
      sessionScores: prevSessionScores,
    };

    const { error: updateErr } = await supabase
      .from('rooms')
      .update({
        status: 'lobby',
        game_state: nextGameState,
        players: cleanPlayers,
        updated_at: nowIso,
      })
      .eq('code', code);

    if (updateErr) return { success: false, error: updateErr.message };
    const updatedRoom = hydrateRoomRecord({
      ...room,
      status: 'lobby',
      game_state: nextGameState,
      players: cleanPlayers,
      updated_at: nowIso,
    });
    return { success: true, room: updatedRoom };
  },

  /**
   * Clears accumulated session scores for the current room in Supabase and broadcasts to all peers
   */
  async resetRoomSessionScores(roomCode) {
    if (!supabase || !roomCode) return { success: false };
    const code = roomCode.trim().toUpperCase();
    const { room, error } = await this.getRoom(code);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };

    const nextGameState = {
      ...(room.game_state || {}),
      sessionScores: {},
    };
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('rooms')
      .update({
        game_state: nextGameState,
        updated_at: nowIso,
      })
      .eq('code', code);

    if (updateErr) return { success: false, error: updateErr.message };

    const updatedRoom = hydrateRoomRecord({
      ...room,
      game_state: nextGameState,
      updated_at: nowIso,
    });
    this.broadcastRoomState(code, updatedRoom);
    return { success: true, room: updatedRoom };
  },

  /**
   * Force resets an abandoned or stuck room and joins directly as the new Host
   */
  async forceResetAndJoinRoom(roomCode, playerName) {
    if (!supabase) return { success: false, error: 'Supabase offline' };
    const name = playerName.trim() || 'Host';
    const playerId = getLocalPlayerId();

    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    const prevConfig = room.game_state?.config || {};
    const prevSeats = prevConfig.roomPlayerCount || prevConfig.playerCount || 4;
    const prevDeck = prevConfig.deckMode || (prevSeats > 4 ? 'double' : 'single');
    const prevType = room.game_state?.gameType || getGameTypeFromRoomCode(code) || 'sevens';

    const newHostPlayer = {
      id: playerId,
      name,
      seatIndex: 0,
      isHost: true,
      isReady: true,
      avatar: AVATARS[0] || '👤',
      joinedAt: Date.now(),
    };

    const nowIso = new Date().toISOString();
    const nextGameState = {
      config: {
        playerCount: prevSeats,
        roomPlayerCount: prevSeats,
        deckMode: prevDeck,
      },
      gameType: prevType,
    };

    const { error: updateErr } = await supabase
      .from('rooms')
      .update({
        host_id: playerId,
        players: [newHostPlayer],
        status: 'lobby',
        game_state: nextGameState,
        updated_at: nowIso,
      })
      .eq('code', code);

    if (updateErr) return { success: false, error: updateErr.message };

    const updatedRoom = hydrateRoomRecord({
      ...room,
      host_id: playerId,
      players: [newHostPlayer],
      status: 'lobby',
      game_state: nextGameState,
      updated_at: nowIso,
    });
    setLocalSession(playerId, name, code);
    return { success: true, room: updatedRoom, player: newHostPlayer };
  },

  activeChannels: {},
  _channelChains: {},

  /**
   * Serializes channel create/teardown operations per room so Supabase's async
   * `removeChannel()` teardown finishes before a new `channel()` with the same topic opens.
   */
  _enqueueRoomChannelOp(code, opFn) {
    const prev = this._channelChains[code] || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(() => opFn());
    this._channelChains[code] = next.finally(() => {
      if (this._channelChains[code] === next) {
        delete this._channelChains[code];
      }
    });
    return next;
  },

  async _cleanupExistingRoomChannel(code) {
    if (!supabase || !code) return;
    const channelName = `room_channel_${code}`;
    const targetTopic = `realtime:${channelName}`;
    const toRemove = new Set();

    if (this.activeChannels[code]) {
      toRemove.add(this.activeChannels[code]);
      delete this.activeChannels[code];
    }

    if (typeof supabase.getChannels === 'function') {
      try {
        for (const ch of supabase.getChannels()) {
          if (ch && (ch.topic === targetTopic || ch.subTopic === channelName)) {
            toRemove.add(ch);
          }
        }
      } catch {}
    }

    for (const ch of toRemove) {
      try {
        await supabase.removeChannel(ch);
      } catch {}
    }
  },

  /**
   * Helper to get or create a room channel with self: false to avoid echo traffic
   */
  getOrCreateRoomChannel(roomCode) {
    if (!supabase || !roomCode) return null;
    const code = roomCode.trim().toUpperCase();
    const existing = this.activeChannels[code];
    if (existing) {
      const st = existing.state;
      if (st !== 'closed' && st !== 'errored' && st !== 'leaving') {
        return existing;
      }
      delete this.activeChannels[code];
      try {
        supabase.removeChannel(existing);
      } catch {}
    }
    const channelName = `room_channel_${code}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });
    this.activeChannels[code] = channel;
    channel.subscribe();
    return channel;
  },

  async ensureRoomChannel(roomCode) {
    if (!supabase || !roomCode) return null;
    const code = roomCode.trim().toUpperCase();
    if (this._channelChains[code]) {
      try {
        await this._channelChains[code];
      } catch {}
    }
    return this.getOrCreateRoomChannel(code);
  },

  _sanitizeWireAvatar(avatar) {
    return (typeof avatar === 'string' && avatar.startsWith('data:image/'))
      ? '👤'
      : (avatar || '👤');
  },

  async _sendRoomBroadcast(roomCode, event, payload, label = event) {
    if (!supabase || !roomCode) return { success: false, error: 'Supabase offline' };
    const code = roomCode.trim().toUpperCase();
    let channel = await this.ensureRoomChannel(code);
    if (!channel) return { success: false, error: 'Channel offline' };

    try {
      let status = await channel.send({
        type: 'broadcast',
        event,
        payload,
      });

      // Fallback / recovery if socket push timed out or channel entered a closing state
      if (status && status !== 'ok') {
        const st = channel.state;
        if (st === 'closed' || st === 'errored' || st === 'leaving') {
          delete this.activeChannels[code];
          channel = this.getOrCreateRoomChannel(code);
          if (channel) {
            status = await channel.send({
              type: 'broadcast',
              event,
              payload,
            });
          }
        }
        if (status && status !== 'ok' && channel && typeof channel.httpSend === 'function') {
          await channel.httpSend(event, payload);
          return { success: true, status: 'http_fallback' };
        }
      }

      if (status && status !== 'ok') {
        return { success: false, error: `Broadcast ${label} gagal (${status})`, status };
      }
      return { success: true, status: status || 'ok' };
    } catch (err) {
      console.warn(`Gagal mengirim broadcast ${label}:`, err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sends an ephemeral live chat / quick emote message via Realtime Broadcast
   */
  async sendRoomChat(roomCode, chatPayload) {
    return this._sendRoomBroadcast(
      roomCode,
      'room_chat',
      {
        ...chatPayload,
        senderAvatar: this._sanitizeWireAvatar(chatPayload?.senderAvatar),
        id: chatPayload?.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: chatPayload?.timestamp || Date.now(),
      },
      'chat'
    );
  },

  /**
   * Sends a floating reaction emote (Google Meet style) via Realtime Broadcast
   */
  async sendRoomReaction(roomCode, reactionPayload) {
    return this._sendRoomBroadcast(
      roomCode,
      'room_reaction',
      {
        ...reactionPayload,
        senderAvatar: this._sanitizeWireAvatar(reactionPayload?.senderAvatar),
        id: reactionPayload?.id || `react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: reactionPayload?.timestamp || Date.now(),
      },
      'reaction'
    );
  },

  /**
   * Sends a Soundboard audio trigger to all players in the room via Realtime Broadcast
   */
  async sendRoomSoundboard(roomCode, soundboardPayload) {
    return this._sendRoomBroadcast(
      roomCode,
      'room_soundboard',
      {
        ...soundboardPayload,
        senderAvatar: this._sanitizeWireAvatar(soundboardPayload?.senderAvatar),
        id: soundboardPayload?.id || `sb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: soundboardPayload?.timestamp || Date.now(),
      },
      'soundboard'
    );
  },

  /**
   * Broadcasts WebRTC Voice Chat signaling message (offer, answer, ICE, speaking)
   */
  async sendVoiceSignal(roomCode, signalPayload) {
    return this._sendRoomBroadcast(roomCode, 'voice_signal', signalPayload, 'voice signal');
  },

  /**
   * Subscribes to Realtime updates, live chat, reactions, voice signaling, soundboard, and game deltas
   */
  subscribeToRoom(
    roomCode,
    onRoomUpdate,
    onStatusChange = null,
    onChatMessage = null,
    onReaction = null,
    onVoiceSignal = null,
    onSoundboard = null,
    onGameActionDelta = null,
    onRequestStateSync = null
  ) {
    if (!supabase || !roomCode) return () => {};
    const code = roomCode.trim().toUpperCase();
    const channelName = `room_channel_${code}`;

    let lastBroadcastAt = 0;
    let cachedPlayers = [];
    let cancelled = false;
    let subscribedChannel = null;

    this._enqueueRoomChannelOp(code, async () => {
      if (cancelled) return;
      await this._cleanupExistingRoomChannel(code);
      if (cancelled) return;

      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rooms',
            filter: `code=eq.${code}`,
          },
          (payload) => {
            if (cancelled) return;
            if (payload.new) {
              const incoming = payload.new;
              if (Array.isArray(incoming.players) && incoming.players.length > 0) {
                cachedPlayers = incoming.players;
              }
              // Use payload.new directly without re-fetching from PostgREST!
              // If game_state was omitted by Postgres TOAST (>8KB), room_state_sync Broadcast already delivered it.
              // Only fall back to getRoom if no Broadcast was received in the last 6 seconds.
              if (
                incoming.status !== 'lobby' &&
                (!incoming.game_state || !incoming.game_state.players)
              ) {
                if (Date.now() - lastBroadcastAt < 6000) {
                  onRoomUpdate(hydrateRoomRecord(incoming));
                  return;
                }
                this.getRoom(code)
                  .then(({ room }) => {
                    if (!cancelled) onRoomUpdate(room || hydrateRoomRecord(incoming));
                  })
                  .catch(() => {
                    if (!cancelled) onRoomUpdate(hydrateRoomRecord(incoming));
                  });
              } else {
                onRoomUpdate(hydrateRoomRecord(incoming));
              }
            }
          }
        )
        .on('broadcast', { event: 'room_state_sync' }, ({ payload }) => {
          if (!cancelled && payload && payload.game_state && onRoomUpdate) {
            lastBroadcastAt = Date.now();
            if (Array.isArray(payload.players) && payload.players.length > 0) {
              cachedPlayers = payload.players;
            }
            const hydrated = hydrateRoomRecord({
              ...payload,
              players: payload.players || cachedPlayers,
            });
            onRoomUpdate(hydrated);
          }
        })
        .on('broadcast', { event: 'game_action_delta' }, ({ payload }) => {
          if (!cancelled && onGameActionDelta && payload) {
            onGameActionDelta(payload);
          }
        })
        .on('broadcast', { event: 'request_state_sync' }, ({ payload }) => {
          if (!cancelled && onRequestStateSync && payload) {
            onRequestStateSync(payload);
          }
        })
        .on('broadcast', { event: 'room_chat' }, ({ payload }) => {
          if (!cancelled && onChatMessage && payload) {
            onChatMessage(payload);
          }
        })
        .on('broadcast', { event: 'room_reaction' }, ({ payload }) => {
          if (!cancelled && onReaction && payload) {
            onReaction(payload);
          }
        })
        .on('broadcast', { event: 'room_soundboard' }, ({ payload }) => {
          if (!cancelled && onSoundboard && payload) {
            onSoundboard(payload);
          }
        })
        .on('broadcast', { event: 'voice_signal' }, ({ payload }) => {
          if (!cancelled && onVoiceSignal && payload) {
            onVoiceSignal(payload);
          }
        })
        .subscribe((status) => {
          if (!cancelled && onStatusChange) onStatusChange(status);
        });

      subscribedChannel = channel;
      this.activeChannels[code] = channel;
    });

    return () => {
      cancelled = true;
      this._enqueueRoomChannelOp(code, async () => {
        if (subscribedChannel) {
          if (this.activeChannels[code] === subscribedChannel) {
            delete this.activeChannels[code];
          }
          try {
            await supabase.removeChannel(subscribedChannel);
          } catch {}
          subscribedChannel = null;
        }
      });
    };
  },
};
