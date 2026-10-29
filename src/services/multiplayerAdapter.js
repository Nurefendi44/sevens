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

export const AVATARS = ['👤', '🦊', '🐼', '🦁', '🐯', '🐨'];
export const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right', 'top_left', 'top_right'];

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

export const multiplayerAdapter = {
  isConfigured() {
    return isSupabaseConfigured;
  },

  /**
   * Fetches room by code
   */
  async getRoom(roomCode) {
    if (!supabase) return { error: 'Supabase belum terkonfigurasi.' };
    const code = extractCleanRoomCode(roomCode);
    if (!code) return { error: 'Kode room tidak valid.' };

    // 1. Direct search with cleaned code
    let { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) return { error: error.message };
    if (data) return { room: data };

    // 2. Fallback: If code has hyphen, try without hyphen (e.g. SV-ABCD -> SVABCD)
    if (code.includes('-')) {
      const altCode = code.replace(/-/g, '');
      const altRes = await supabase
        .from('rooms')
        .select('*')
        .eq('code', altCode)
        .maybeSingle();
      if (altRes.data) return { room: altRes.data };
    } else {
      // 3. Fallback: If code starts with B2, SV, or R41 without hyphen, try with hyphen
      let formattedWithHyphen = null;
      if (code.startsWith('B2') && code.length > 2) formattedWithHyphen = `B2-${code.slice(2)}`;
      else if (code.startsWith('SV') && code.length > 2) formattedWithHyphen = `SV-${code.slice(2)}`;
      else if (code.startsWith('R41') && code.length > 3) formattedWithHyphen = `R41-${code.slice(3)}`;

      if (formattedWithHyphen) {
        const altRes = await supabase
          .from('rooms')
          .select('*')
          .eq('code', formattedWithHyphen)
          .maybeSingle();
        if (altRes.data) return { room: altRes.data };
      }
    }

    return { room: null };
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
      avatar: AVATARS[0],
      joinedAt: Date.now(),
    };

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: playerId,
        status: 'lobby',
        players: [hostPlayer],
        game_state: {
          config: {
            playerCount: targetMax,
            roomPlayerCount: targetMax,
            deckMode: effectiveDeckMode,
          },
          gameType,
        },
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    setLocalSession(playerId, name, code);
    return { success: true, room: data, player: hostPlayer };
  },

  /**
   * Joins an existing room
   */
  async joinRoom(roomCode, playerName) {
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
      return {
        success: true,
        room,
        player: existingPlayer,
        isReconnected: true,
      };
    }

    // Reuse scenario: Room empty, no real humans, or game was abandoned/stale (> 2 mins without moves)
    const humanPlayers = players.filter((p) => !p.isBot);
    const isStaleGame =
      room.updated_at &&
      Date.now() - new Date(room.updated_at).getTime() > 120000;

    if (players.length === 0 || humanPlayers.length === 0 || (room.status !== 'lobby' && isStaleGame)) {
      const newHostPlayer = {
        id: playerId,
        name,
        seatIndex: 0,
        isHost: true,
        isReady: true,
        avatar: AVATARS[0] || '👤',
        joinedAt: Date.now(),
      };

      const prevConfig = room.game_state?.config || {};
      const targetSeats = prevConfig.roomPlayerCount || prevConfig.playerCount || 4;
      const targetDeck = prevConfig.deckMode || (targetSeats > 4 ? 'double' : 'single');
      const targetType = room.game_state?.gameType || getGameTypeFromRoomCode(code) || 'sevens';

      const { data: updatedRoom, error: updateErr } = await supabase
        .from('rooms')
        .update({
          host_id: playerId,
          players: [newHostPlayer],
          status: 'lobby',
          game_state: {
            config: {
              playerCount: targetSeats,
              roomPlayerCount: targetSeats,
              deckMode: targetDeck,
            },
            gameType: targetType,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id)
        .select()
        .single();

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

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
      avatar: AVATARS[seatIdx] || '👤',
      joinedAt: Date.now(),
    };

    const updatedPlayers = [...players, newPlayer];

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', room.id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    setLocalSession(playerId, name, code);
    return { success: true, room: updatedRoom, player: newPlayer };
  },

  /**
   * Toggles ready state for a player
   */
  async toggleReady(roomCode, playerId, isReady) {
    if (!supabase) return;
    const { room } = await this.getRoom(roomCode);
    if (!room) return;
    const code = room.code;

    const updatedPlayers = (room.players || []).map((p) => {
      if (p.id === playerId) {
        return { ...p, isReady };
      }
      return p;
    });

    await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code);
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

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, room: updatedRoom, bot: botPlayer };
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

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, room: updatedRoom };
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

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        game_state: updatedGameState,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, room: updatedRoom };
  },

  /**
   * Host starts the game for all players
   */
  async startGame(roomCode, hostId, configOverrides = {}, forceGameType = null) {
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

    // Initialize state from decoupled Game Engine with correct player count & gameType
    const determinedGameType =
      forceGameType ||
      configOverrides?.gameType ||
      room.game_state?.gameType ||
      getGameTypeFromRoomCode(code) ||
      'sevens';

    let gameState;
    if (determinedGameType === 'bigtwo') {
      const effectiveDeckMode = actualPlayerCount > 4
        ? (configOverrides.deckMode || room.game_state?.config?.deckMode || 'double')
        : 'single';
      gameState = initBigTwo({ ...configOverrides, playerCount: actualPlayerCount, deckMode: effectiveDeckMode }, formattedPlayers);
    } else if (determinedGameType === 'game41') {
      gameState = initGame41({ ...configOverrides, playerCount: actualPlayerCount }, formattedPlayers);
    } else {
      gameState = initGame({ ...configOverrides, playerCount: actualPlayerCount }, formattedPlayers);
    }

    // Preserve original room capacity seats so room capacity is never lost after starting a match
    const targetRoomSeats = configOverrides.roomPlayerCount ||
      configOverrides.playerCount ||
      room.game_state?.config?.roomPlayerCount ||
      room.game_state?.config?.playerCount ||
      actualPlayerCount;

    if (gameState && gameState.config) {
      gameState.config.roomPlayerCount = targetRoomSeats;
      gameState.config.desiredPlayerCount = targetRoomSeats;
    }

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        status: 'playing',
        game_state: gameState,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, room: updatedRoom, gameState };
  },

  /**
   * Synchronizes updated Game Engine state to Supabase
   */
  async syncGameState(roomCode, nextGameState) {
    if (!supabase) return { success: false };
    const code = roomCode.trim().toUpperCase();
    const isOver =
      nextGameState.gameStatus === GAME_STATUS.GAME_OVER ||
      nextGameState.gameStatus === 'GAME_OVER' ||
      nextGameState.gameStatus === 'game_over';
    const nextStatus = isOver ? 'game_over' : 'playing';

    const { error } = await supabase
      .from('rooms')
      .update({
        game_state: nextGameState,
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

    const actualPlayerCount = formattedPlayers.length;
    const determinedGameType =
      configOverrides?.gameType ||
      room.game_state?.gameType ||
      getGameTypeFromRoomCode(code) ||
      'sevens';
    const prevWinnerId = configOverrides?.firstPlayerId || room.game_state?.winner?.id || null;
    let nextGameState;
    const carriedSessionScores = room.game_state?.sessionScores || {};
    if (determinedGameType === 'bigtwo') {
      const effectiveDeckMode = actualPlayerCount > 4
        ? (configOverrides.deckMode || room.game_state?.config?.deckMode || 'double')
        : 'single';
      nextGameState = initBigTwo(
        {
          ...configOverrides,
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
          ...configOverrides,
          firstPlayerId: prevWinnerId,
          playerCount: actualPlayerCount,
          sessionScores: carriedSessionScores,
        },
        formattedPlayers
      );
    } else {
      nextGameState = initGame(
        {
          ...configOverrides,
          playerCount: actualPlayerCount,
          sessionScores: carriedSessionScores,
        },
        formattedPlayers
      );
    }

    await supabase
      .from('rooms')
      .update({
        status: 'playing',
        game_state: nextGameState,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code);

    return { success: true, gameState: nextGameState };
  },

  /**
   * Leaves room and handles host migration / deletion
   */
  async leaveRoom(roomCode, playerId) {
    clearLocalSession();
    if (!supabase) return;

    const { room } = await this.getRoom(roomCode);
    if (!room) return;
    const code = room.code;

    const remainingPlayers = (room.players || []).filter((p) => p.id !== playerId);
    const remainingHumans = remainingPlayers.filter((p) => !p.isBot);
    const prevConfig = room.game_state?.config || {};
    const prevSeats = prevConfig.roomPlayerCount || prevConfig.playerCount || 4;
    const prevDeck = prevConfig.deckMode || (prevSeats > 4 ? 'double' : 'single');
    const prevType = room.game_state?.gameType || getGameTypeFromRoomCode(code) || 'sevens';

    if (remainingPlayers.length === 0 || remainingHumans.length === 0) {
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
   * Sets or clears Bot Takeover for an AFK player
   */
  async toggleBotTakeover(roomCode, playerId, isTakeover = true) {
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
        players: gsPlayers,
        turnStartedAt: Date.now(),
      };
    }

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        players: updatedPlayers,
        game_state: updatedGameState,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

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

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        host_id: newHostId,
        players: updatedPlayers,
        game_state: updatedGameState,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .select()
      .single();

    if (updateErr) return { success: false, error: updateErr.message };
    return { success: true, room: updatedRoom };
  },

  /**
   * Resets room to lobby: clears game_state, resets scores, sets status to lobby
   */
  async resetRoomState(roomCode, requesterId) {
    if (!supabase) return { success: false, error: 'Supabase offline' };
    const { room, error } = await this.getRoom(roomCode);
    if (error || !room) return { success: false, error: error || 'Room tidak ditemukan.' };
    const code = room.code;

    const prevConfig = room.game_state?.config || {};
    const prevSeats = prevConfig.roomPlayerCount || prevConfig.playerCount || 4;
    const prevDeck = prevConfig.deckMode || (prevSeats > 4 ? 'double' : 'single');
    const prevType = room.game_state?.gameType || getGameTypeFromRoomCode(code) || 'sevens';

    // Reset players ready status, reset any bot takeover
    const cleanPlayers = (room.players || []).map((p) => ({
      ...p,
      isReady: p.id === (room.host_id || requesterId),
      isBotTakeover: false,
    }));

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        status: 'lobby',
        game_state: {
          config: {
            playerCount: prevSeats,
            roomPlayerCount: prevSeats,
            deckMode: prevDeck,
          },
          gameType: prevType,
        },
        players: cleanPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .select()
      .single();

    if (updateErr) return { success: false, error: updateErr.message };
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

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        host_id: playerId,
        players: [newHostPlayer],
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
      .eq('code', code)
      .select()
      .single();

    if (updateErr) return { success: false, error: updateErr.message };

    setLocalSession(playerId, name, code);
    return { success: true, room: updatedRoom, player: newHostPlayer };
  },

  activeChannels: {},

  /**
   * Sends an ephemeral live chat / quick emote message via Realtime Broadcast
   */
  async sendRoomChat(roomCode, chatPayload) {
    if (!supabase) return { success: false, error: 'Supabase offline' };
    const code = roomCode.trim().toUpperCase();
    const channelName = `room_channel_${code}`;
    let channel = this.activeChannels[code];
    if (!channel) {
      channel = supabase.channel(channelName);
      this.activeChannels[code] = channel;
      channel.subscribe();
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: 'room_chat',
        payload: {
          ...chatPayload,
          id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
        },
      });
      return { success: true };
    } catch (err) {
      console.warn('Gagal mengirim broadcast chat:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sends a floating reaction emote (Google Meet style) via Realtime Broadcast
   */
  async sendRoomReaction(roomCode, reactionPayload) {
    if (!supabase) return { success: false, error: 'Supabase offline' };
    const code = roomCode.trim().toUpperCase();
    const channelName = `room_channel_${code}`;
    let channel = this.activeChannels[code];
    if (!channel) {
      channel = supabase.channel(channelName);
      this.activeChannels[code] = channel;
      channel.subscribe();
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: 'room_reaction',
        payload: {
          ...reactionPayload,
          id: `react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
        },
      });
      return { success: true };
    } catch (err) {
      console.warn('Gagal mengirim broadcast reaction:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Broadcasts WebRTC Voice Chat signaling message (offer, answer, ICE, speaking)
   */
  async sendVoiceSignal(roomCode, signalPayload) {
    if (!supabase) return { success: false };
    const code = roomCode.trim().toUpperCase();
    const channelName = `room_channel_${code}`;

    let channel = this.activeChannels[code];
    if (!channel) {
      channel = supabase.channel(channelName);
      this.activeChannels[code] = channel;
      channel.subscribe();
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: 'voice_signal',
        payload: signalPayload,
      });
      return { success: true };
    } catch (err) {
      console.warn('Gagal mengirim broadcast voice signal:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Subscribes to Realtime updates, live chat, reactions, and voice signaling for a specific room
   */
  subscribeToRoom(roomCode, onRoomUpdate, onStatusChange = null, onChatMessage = null, onReaction = null, onVoiceSignal = null) {
    if (!supabase) return () => {};
    const code = roomCode.trim().toUpperCase();
    const channelName = `room_channel_${code}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${code}`,
        },
        (payload) => {
          if (payload.new) {
            onRoomUpdate(payload.new);
          }
        }
      )
      .on('broadcast', { event: 'room_chat' }, ({ payload }) => {
        if (onChatMessage && payload) {
          onChatMessage(payload);
        }
      })
      .on('broadcast', { event: 'room_reaction' }, ({ payload }) => {
        if (onReaction && payload) {
          onReaction(payload);
        }
      })
      .on('broadcast', { event: 'voice_signal' }, ({ payload }) => {
        if (onVoiceSignal && payload) {
          onVoiceSignal(payload);
        }
      })
      .subscribe((status) => {
        if (onStatusChange) onStatusChange(status);
        if (status === 'SUBSCRIBED') {
          // Channel connected
        }
      });

    this.activeChannels[code] = channel;

    return () => {
      delete this.activeChannels[code];
      supabase.removeChannel(channel);
    };
  },
};
