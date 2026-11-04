/**
 * LOBBY CHAT SERVICE (MLBB STYLE WORLD CHAT)
 * Realtime Global Lobby & Recruitment Chat for Main Menu / Home Screen.
 * Uses Supabase Realtime Broadcast over channel 'global_lobby_chat'.
 * Supports cross-tab BroadcastChannel fallback and persistent localStorage cache.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { audio } from './audioService';

const STORAGE_KEY = 'royal_cards_global_lobby_chat_v1';
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
      // Remove any leftover dummy/seed messages from storage
      return parsed.filter((m) => m && !m.id?.startsWith('seed_'));
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
 * Subscribes to Realtime Lobby Chat
 * @param {Function} onNewMessage Callback receiving incoming chat message
 * @returns {Function} Unsubscribe function
 */
export function subscribeToLobbyChat(onNewMessage) {
  activeSubscribers.add(onNewMessage);

  if (!lobbyChannel && isSupabaseConfigured && supabase) {
    lobbyChannel = supabase
      .channel('global_lobby_chat')
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
        lobbyChannel = supabase.channel('global_lobby_chat');
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
