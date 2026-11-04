/**
 * LOBBY CHAT SERVICE (MLBB STYLE WORLD CHAT)
 * Realtime Global Lobby & Recruitment Chat for Main Menu / Home Screen.
 * Uses Supabase Realtime Broadcast over channel 'global_lobby_chat'.
 * Supports cross-tab BroadcastChannel fallback and persistent localStorage cache.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { audio } from './audioService';
import { getPlayerRankTier } from './leaderboardService';

const STORAGE_KEY = 'royal_cards_global_lobby_chat_v1';
const PM_STORAGE_PREFIX = 'royal_cards_pm_history_v1_';
const MAX_MESSAGES = 50;

/**
 * Extract room code from text if mentioned
 * e.g. "Ayo mabar B2-EG7W", "Room: SV-9988", "3C5RZP"
 */
export function extractRoomCodeFromMessage(text) {
  if (!text || typeof text !== 'string') return null;
  const prefixMatch = text.match(/\b(B2-[A-Za-z0-9]{3,6}|R41-[A-Za-z0-9]{3,6}|SV-[A-Za-z0-9]{3,6})\b/i);
  if (prefixMatch) return prefixMatch[1].toUpperCase();

  const roomWordMatch = text.match(/(?:room|kode)\s*[:#-]?\s*([A-Za-z0-9_-]{4,8})/i);
  if (roomWordMatch) return roomWordMatch[1].toUpperCase();

  const standaloneMatch = text.match(/\b([A-Za-z0-9]{6})\b/);
  if (standaloneMatch) return standaloneMatch[1].toUpperCase();

  return null;
}

/**
 * Get stored chat history
 */
export function getStoredLobbyChats() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Remove any leftover dummy/seed messages from storage and deduplicate by ID
      const seen = new Set();
      return parsed.filter((m) => {
        if (!m || !m.id || m.id.startsWith('seed_') || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    }
  } catch (e) {
    // Ignore error
  }
  return [];
}

/**
 * Save chat message to localStorage cache
 */
function appendStoredLobbyChat(msg) {
  if (typeof localStorage === 'undefined') return;
  try {
    const list = getStoredLobbyChats();
    // Avoid duplicate IDs
    if (list.some((m) => m.id === msg.id)) return;
    const updated = [...list, msg].slice(-MAX_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    // Ignore error
  }
}

// In-memory active channel reference
let lobbyChannel = null;
let activeSubscribers = new Set();
let broadcastChannel = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('royal_lobby_chat_bc');
    broadcastChannel.onmessage = (event) => {
      const msg = event?.data;
      if (msg && msg.id) {
        appendStoredLobbyChat(msg);
        activeSubscribers.forEach((cb) => {
          try {
            cb(msg);
          } catch {}
        });
      }
    };
  }
} catch (e) {
  // Ignore
}

/**
 * Search registered players in the Supabase leaderboard table
 */
export async function searchRegisteredPlayers(query) {
  const clean = String(query || '').trim();
  if (!clean) return [];

  if (isSupabaseConfigured && supabase) {
    try {
      const sanitized = clean.replace(/[\\%_]/g, (c) => '\\' + c);
      const { data, error } = await supabase
        .from('leaderboard')
        .select('player_name, avatar, score, wins')
        .ilike('player_name', `%${sanitized}%`)
        .limit(12);

      if (!error && Array.isArray(data)) {
        const map = new Map();
        for (const row of data) {
          const name = String(row.player_name || '').trim();
          if (!name) continue;
          const key = name.toLowerCase();
          const existing = map.get(key);
          const score = Number(row.score || 0) + (existing ? existing.score : 0);
          const wins = Number(row.wins || 0) + (existing ? existing.wins : 0);
          const tier = getPlayerRankTier(score, wins);
          map.set(key, {
            name,
            avatar: row.avatar || existing?.avatar || '👤',
            score,
            wins,
            tier,
          });
        }
        return Array.from(map.values());
      }
    } catch (e) {
      console.warn('[LobbyChat] searchRegisteredPlayers warning:', e);
    }
  }

  return [];
}

/**
 * Get stored private chat conversation threads for a specific user
 */
export function getStoredPrivateChats(myUsername) {
  if (typeof localStorage === 'undefined' || !myUsername) return {};
  const norm = String(myUsername).trim().toLowerCase();
  try {
    const raw = localStorage.getItem(`${PM_STORAGE_PREFIX}${norm}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const cleaned = {};
      for (const [key, list] of Object.entries(parsed)) {
        if (Array.isArray(list)) {
          const seen = new Set();
          cleaned[key] = list.filter((m) => {
            if (!m || !m.id || seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
        }
      }
      return cleaned;
    }
  } catch (e) {
    // Ignore error
  }
  return {};
}

/**
 * Append a private message to local conversation history
 */
export function appendStoredPrivateChat(myUsername, partnerUsername, messageObj) {
  if (typeof localStorage === 'undefined' || !myUsername || !partnerUsername || !messageObj) return;
  const myNorm = String(myUsername).trim().toLowerCase();
  const partnerNorm = String(partnerUsername).trim().toLowerCase();

  try {
    const allThreads = getStoredPrivateChats(myNorm);
    const thread = allThreads[partnerNorm] || [];
    if (thread.some((m) => m.id === messageObj.id)) return;

    allThreads[partnerNorm] = [...thread, messageObj].slice(-MAX_MESSAGES);
    localStorage.setItem(`${PM_STORAGE_PREFIX}${myNorm}`, JSON.stringify(allThreads));
  } catch (e) {
    // Ignore error
  }
}

/**
 * Subscribes to Realtime Lobby Chat (both global public & direct messages)
 * @param {Function} onNewMessage Callback receiving incoming chat message
 * @param {string} currentUsername Current user's nickname for direct message filtering
 * @returns {Function} Unsubscribe function
 */
export function subscribeToLobbyChat(onNewMessage, currentUsername = '') {
  activeSubscribers.add(onNewMessage);

  if (!lobbyChannel && isSupabaseConfigured && supabase) {
    lobbyChannel = supabase
      .channel('global_lobby_chat', {
        config: {
          broadcast: { self: false },
        },
      })
      .on('broadcast', { event: 'lobby_chat_message' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        appendStoredLobbyChat(payload);
        try {
          audio.playChatPopSound();
        } catch {}
        activeSubscribers.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error('Error in lobby chat listener:', err);
          }
        });
      })
      .on('broadcast', { event: 'lobby_private_message' }, ({ payload }) => {
        if (!payload || !payload.id) return;

        // Verify if message is meant for or sent by this client
        const myNameNorm = String(currentUsername || '').trim().toLowerCase();
        const targetNorm = String(payload.targetUsername || '').trim().toLowerCase();
        const senderNorm = String(payload.senderName || '').trim().toLowerCase();

        const isForMe = myNameNorm && (targetNorm === myNameNorm || senderNorm === myNameNorm);
        if (!isForMe) return;

        const partnerName = senderNorm === myNameNorm ? payload.targetUsername : payload.senderName;
        appendStoredPrivateChat(myNameNorm, partnerName, payload);

        try {
          audio.playChatPopSound();
        } catch {}

        activeSubscribers.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error('Error in PM listener:', err);
          }
        });
      })
      .subscribe((status) => {
        // Connected to Realtime channel
      });
  }

  return () => {
    activeSubscribers.delete(onNewMessage);
    if (activeSubscribers.size === 0 && lobbyChannel && supabase) {
      try {
        supabase.removeChannel(lobbyChannel);
      } catch {}
      lobbyChannel = null;
    }
  };
}

/**
 * Broadcasts a chat or recruitment message to the World Lobby Chat
 */
export async function sendLobbyChatMessage({
  senderName,
  avatar = '👑',
  tier = null,
  message,
  gameType = null,
  roomCode = null,
}) {
  const cleanMsg = String(message || '').trim();
  const cleanSender = String(senderName || '').trim() || 'Player';

  if (!cleanMsg) {
    return { success: false, error: 'Pesan tidak boleh kosong.' };
  }

  const detectedCode = roomCode || extractRoomCodeFromMessage(cleanMsg);
  const isInvite = Boolean(detectedCode || cleanMsg.toLowerCase().includes('mabar') || cleanMsg.toLowerCase().includes('room'));

  const payload = {
    id: `lchat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    senderName: cleanSender,
    avatar: avatar || '👑',
    tier: tier || {
      id: 'warrior',
      name: 'Bronze',
      shortName: 'Bronze',
      icon: '🥉',
      color: '#d97706',
      accent: '#fde68a',
    },
    message: cleanMsg,
    type: isInvite ? 'mabar_invite' : 'chat',
    gameType: gameType || null,
    roomCode: detectedCode || null,
    timestamp: Date.now(),
  };

  // 1. Store locally
  appendStoredLobbyChat(payload);

  // 2. Notify local subscribers & other browser tabs
  try {
    audio.playChatPopSound();
  } catch {}

  activeSubscribers.forEach((cb) => {
    try {
      cb(payload);
    } catch {}
  });

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {}
  }

  // 3. Broadcast to Supabase Realtime channel if available
  if (isSupabaseConfigured && supabase) {
    try {
      if (!lobbyChannel) {
        lobbyChannel = supabase.channel('global_lobby_chat', {
          config: { broadcast: { self: false } },
        });
        await lobbyChannel.subscribe();
      }

      await lobbyChannel.send({
        type: 'broadcast',
        event: 'lobby_chat_message',
        payload,
      });
    } catch (err) {
      console.warn('[LobbyChat] Supabase broadcast notice:', err);
    }
  }

  return { success: true, message: payload };
}

/**
 * Send a direct 1-on-1 private message to a specific registered user
 */
export async function sendPrivateChatMessage({
  senderName,
  targetUsername,
  avatar = '👑',
  tier = null,
  message,
  roomCode = null,
}) {
  const cleanMsg = String(message || '').trim();
  const cleanSender = String(senderName || '').trim() || 'Player';
  const cleanTarget = String(targetUsername || '').trim();

  if (!cleanMsg) {
    return { success: false, error: 'Pesan tidak boleh kosong.' };
  }
  if (!cleanTarget) {
    return { success: false, error: 'Tujuan penerima pesan tidak ditemukan.' };
  }

  const detectedCode = roomCode || extractRoomCodeFromMessage(cleanMsg);

  const payload = {
    id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    senderName: cleanSender,
    targetUsername: cleanTarget,
    avatar: avatar || '👑',
    tier: tier || {
      id: 'warrior',
      name: 'Bronze',
      shortName: 'Bronze',
      icon: '🥉',
      color: '#d97706',
      accent: '#fde68a',
    },
    message: cleanMsg,
    type: 'private',
    roomCode: detectedCode || null,
    timestamp: Date.now(),
  };

  // 1. Store in sender's local direct message history
  appendStoredPrivateChat(cleanSender, cleanTarget, payload);

  // 2. Notify local subscribers & tabs
  try {
    audio.playChatPopSound();
  } catch {}

  activeSubscribers.forEach((cb) => {
    try {
      cb(payload);
    } catch {}
  });

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {}
  }

  // 3. Broadcast to Supabase Realtime channel
  if (isSupabaseConfigured && supabase) {
    try {
      if (!lobbyChannel) {
        lobbyChannel = supabase.channel('global_lobby_chat', {
          config: { broadcast: { self: false } },
        });
        await lobbyChannel.subscribe();
      }

      await lobbyChannel.send({
        type: 'broadcast',
        event: 'lobby_private_message',
        payload,
      });
    } catch (err) {
      console.warn('[LobbyChat] Send private message broadcast warning:', err);
    }
  }

  return { success: true, message: payload };
}
