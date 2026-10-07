/**
 * SUPABASE MULTIPLAYER ADAPTER
 * Manages Room Lifecycle, Player Join/Leave, Realtime Subscriptions,
 * and Game State Synchronization for 4-Player Online Sevens.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { initGame } from '../engine/gameEngine.js';
import { GAME_STATUS } from '../engine/constants.js';

export const AVATARS = ['👤', '🦊', '🐼', '🦁'];
export const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'];

// Local storage session keys
const STORAGE_PLAYER_ID = 'sevens_player_id';
const STORAGE_PLAYER_NAME = 'sevens_player_name';
const STORAGE_ROOM_CODE = 'sevens_room_code';

/**
 * Generates random 6-character alphanumeric room code (e.g. 'K7P9X2')
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
 */
export function getRelativeSeats(players = [], viewerPlayerId) {
  if (!players || players.length === 0) {
    return { bottom: null, left: null, top: null, right: null };
  }

  const myIndex = players.findIndex((p) => p.id === viewerPlayerId);
  if (myIndex === -1) {
    return {
      bottom: players[0] || null,
      left: players[1] || null,
      top: players[2] || null,
      right: players[3] || null,
    };
  }

  const count = players.length;
  return {
    bottom: players[myIndex],
    left: players[(myIndex + 1) % count] || null,
    top: players[(myIndex + 2) % count] || null,
    right: players[(myIndex + 3) % count] || null,
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
    const code = roomCode.trim().toUpperCase();
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) return { error: error.message };
    return { room: data };
  },

  /**
   * Creates a new room as Host
   */
  async createRoom(hostName) {
    if (!supabase) {
      return { success: false, error: 'Supabase belum terkonfigurasi pada .env file.' };
    }

    const name = hostName.trim() || 'Host';
    const code = generateRoomCode();
    const playerId = getLocalPlayerId();

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
        game_state: null,
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

    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim() || 'Pemain';
    const playerId = getLocalPlayerId();

    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!room) {
      return { success: false, error: `Room ${code} tidak ditemukan! Pastikan kode room benar.` };
    }

    const players = room.players || [];

    // Check if player already in room (reconnect scenario)
    const existingPlayer = players.find(
      (p) => p.id === playerId || p.name.toLowerCase() === name.toLowerCase()
    );

    if (existingPlayer) {
      // Reconnect
      setLocalSession(existingPlayer.id, existingPlayer.name, code);
      return {
        success: true,
        room,
        player: existingPlayer,
        isReconnected: true,
      };
    }

    // Room status checks
    if (room.status !== 'lobby') {
      return { success: false, error: 'Permainan di room ini sudah berlangsung.' };
    }

    if (players.length >= 4) {
      return { success: false, error: 'Room sudah penuh (maksimal 4 pemain).' };
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
    const code = roomCode.trim().toUpperCase();
    const { room } = await this.getRoom(code);
    if (!room) return;

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
   * Host starts the game for all 4 players
   */
  async startGame(roomCode, hostId, configOverrides = {}) {
    if (!supabase) return { success: false, error: 'Supabase offline.' };
    const code = roomCode.trim().toUpperCase();
    const { room, error } = await this.getRoom(code);
    if (error || !room) return { success: false, error: error || 'Room not found.' };

    if (room.host_id !== hostId) {
      return { success: false, error: 'Hanya HOST yang dapat memulai permainan!' };
    }

    const players = room.players || [];
    if (players.length !== 4) {
      return { success: false, error: 'Permainan membutuhkan tepat 4 pemain untuk dimulai!' };
    }

    // Format players into Engine structure
    const formattedPlayers = players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      seat: SEAT_POSITIONS[idx],
      isHuman: true,
      avatar: p.avatar,
      isHost: p.isHost,
    }));

    // Initialize state from decoupled Game Engine
    const gameState = initGame(configOverrides, formattedPlayers);

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
    const nextStatus =
      nextGameState.gameStatus === GAME_STATUS.GAME_OVER ? 'game_over' : 'playing';

    const { error } = await supabase
      .from('rooms')
      .update({
        game_state: nextGameState,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code);

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
    const code = roomCode.trim().toUpperCase();
    const { room } = await this.getRoom(code);
    if (!room || room.host_id !== hostId) return { success: false };

    const formattedPlayers = (room.players || []).map((p, idx) => ({
      id: p.id,
      name: p.name,
      seat: SEAT_POSITIONS[idx],
      isHuman: true,
      avatar: p.avatar,
      isHost: p.isHost,
    }));

    const nextGameState = initGame(configOverrides, formattedPlayers);

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

    const code = roomCode.trim().toUpperCase();
    const { room } = await this.getRoom(code);
    if (!room) return;

    const remainingPlayers = (room.players || []).filter((p) => p.id !== playerId);

    if (remainingPlayers.length === 0) {
      // Room empty, delete or archive
      await supabase.from('rooms').delete().eq('code', code);
      return;
    }

    let nextHostId = room.host_id;
    if (room.host_id === playerId) {
      // Transfer host to first remaining player
      remainingPlayers[0].isHost = true;
      nextHostId = remainingPlayers[0].id;
    }

    await supabase
      .from('rooms')
      .update({
        host_id: nextHostId,
        players: remainingPlayers,
        status: remainingPlayers.length < 4 && room.status === 'playing' ? 'lobby' : room.status,
        updated_at: new Date().toISOString(),
      })
      .eq('code', code);
  },

  /**
   * Subscribes to Realtime updates for a specific room
   */
  subscribeToRoom(roomCode, onRoomUpdate) {
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Channel connected
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
