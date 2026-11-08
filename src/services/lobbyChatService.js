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
const GLOBAL_CHAT_ROOM_CODE = '__GCHAT__';
const MAX_MESSAGES = 50;
const MAX_PRIVATE_MESSAGES = 120;
const MAX_RETRACTED_IDS = 100;

/**
 * Extract room code from text if explicitly mentioned with prefixes
 * e.g. "B2-EG7W", "Room: SV-9988", "Kode: 3C5RZP"
 */
export function extractRoomCodeFromMessage(text) {
  if (!text || typeof text !== 'string') return null;
  const prefixMatch = text.match(/\b(B2-[A-Za-z0-9]{3,6}|R41-[A-Za-z0-9]{3,6}|SV-[A-Za-z0-9]{3,6})\b/i);
  if (prefixMatch) return prefixMatch[1].toUpperCase();

  const roomWordMatch = text.match(/(?:room|kode\s*room)\s*[:#-]?\s*([A-Za-z0-9_-]{4,8})/i);
  if (roomWordMatch) return roomWordMatch[1].toUpperCase();

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
        // Pesan DM tidak boleh pernah masuk chat global (membersihkan data tercemar lama juga)
        if (m.type === 'private' || m.targetUsername || String(m.id).startsWith('pm_')) return false;
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
  if (msg && (msg.type === 'private' || msg.targetUsername)) return;
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

function removeStoredLobbyChat(id) {
  if (typeof localStorage === 'undefined' || !id) return;
  try {
    const list = getStoredLobbyChats().filter((m) => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
}

function removeStoredPrivateChat(myUsername, partnerUsername, id) {
  if (typeof localStorage === 'undefined' || !myUsername || !partnerUsername || !id) return;
  const myNorm = String(myUsername).trim().toLowerCase();
  const partnerNorm = String(partnerUsername).trim().toLowerCase();
  try {
    const all = getStoredPrivateChats(myNorm);
    if (!all[partnerNorm]) return;
    all[partnerNorm] = all[partnerNorm].filter((m) => m.id !== id);
    localStorage.setItem(`${PM_STORAGE_PREFIX}${myNorm}`, JSON.stringify(all));
  } catch (e) {}
}

/**
 * Ambil atau buat record penyimpanan riwayat chat global di Supabase (`rooms` dengan `code = '__GCHAT__'`).
 * Memastikan riwayat obrolan global, ajakan mabar room, dan DM tetap muncul meski dibuka di Incognito / perangkat baru.
 */
async function fetchOrCreateGlobalChatRecord() {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data: existing, error } = await supabase
      .from('rooms')
      .select('id, code, game_state')
      .eq('code', GLOBAL_CHAT_ROOM_CODE)
      .maybeSingle();

    if (!error && existing) {
      return existing;
    }

    const initialState = {
      publicMessages: [],
      privateMessages: [],
      retractedIds: [],
    };

    const { data: created, error: insertErr } = await supabase
      .from('rooms')
      .insert({
        code: GLOBAL_CHAT_ROOM_CODE,
        host_id: 'system_global_chat',
        status: 'system_chat',
        players: [],
        game_state: initialState,
      })
      .select('id, code, game_state')
      .single();

    if (!insertErr && created) return created;

    // Jika gagal insert karena race condition (sudah dibuat klien lain), ambil ulang
    const { data: retry } = await supabase
      .from('rooms')
      .select('id, code, game_state')
      .eq('code', GLOBAL_CHAT_ROOM_CODE)
      .maybeSingle();
    return retry || null;
  } catch (e) {
    return null;
  }
}

// In-memory active channel reference (kept alive across screen transitions)
let lobbyChannel = null;
let lobbyChannelReadyPromise = null;
let currentSubscribedUsername = '';
let activeSubscribers = new Set();
let historySyncSubscribers = new Set();
let broadcastChannel = null;
let persistQueue = Promise.resolve();

/**
 * Terapkan state `game_state` dari record `__GCHAT__` ke localStorage dan beritahu subscriber UI
 */
function applyRemoteGlobalChatState(gs, usernameOverride = '') {
  if (!gs || typeof gs !== 'object') return null;
  const effectiveUser = String(usernameOverride || currentSubscribedUsername || '').trim();
  const remotePublic = Array.isArray(gs.publicMessages) ? gs.publicMessages : [];
  const remotePrivate = Array.isArray(gs.privateMessages) ? gs.privateMessages : [];
  const retractedList = Array.isArray(gs.retractedIds) ? gs.retractedIds : [];
  const retractedSet = new Set(retractedList);

  const localPublic = getStoredLobbyChats();
  const mapPub = new Map();
  let hasLocalOnlyPublic = false;

  for (const m of remotePublic) {
    if (
      m &&
      m.id &&
      !m.id.startsWith('seed_') &&
      !retractedSet.has(m.id) &&
      m.type !== 'private' &&
      !m.targetUsername &&
      !String(m.id).startsWith('pm_')
    ) {
      mapPub.set(m.id, m);
    }
  }

  for (const m of localPublic) {
    if (
      m &&
      m.id &&
      !m.id.startsWith('seed_') &&
      !retractedSet.has(m.id) &&
      m.type !== 'private' &&
      !m.targetUsername &&
      !String(m.id).startsWith('pm_')
    ) {
      if (!mapPub.has(m.id)) {
        hasLocalOnlyPublic = true;
        mapPub.set(m.id, m);
      }
    }
  }

  const mergedPublic = Array.from(mapPub.values())
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .slice(-MAX_MESSAGES);

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedPublic));
    } catch {}
  }

  let hasLocalOnlyPrivate = false;
  const myNorm = effectiveUser.toLowerCase();
  if (myNorm && typeof localStorage !== 'undefined') {
    const currentThreads = getStoredPrivateChats(myNorm);
    const remotePrivIds = new Set(remotePrivate.map((pm) => pm?.id).filter(Boolean));

    for (const pKey of Object.keys(currentThreads)) {
      const filtered = (currentThreads[pKey] || []).filter(
        (m) => m && m.id && !retractedSet.has(m.id)
      );
      for (const locPm of filtered) {
        if (!remotePrivIds.has(locPm.id)) {
          hasLocalOnlyPrivate = true;
        }
      }
      currentThreads[pKey] = filtered;
    }

    for (const pm of remotePrivate) {
      if (!pm || !pm.id || retractedSet.has(pm.id)) continue;
      const senderNorm = String(pm.senderName || '').trim().toLowerCase();
      const targetNorm = String(pm.targetUsername || '').trim().toLowerCase();
      if (senderNorm !== myNorm && targetNorm !== myNorm) continue;

      const partnerNorm = senderNorm === myNorm ? targetNorm : senderNorm;
      if (!partnerNorm) continue;

      const list = currentThreads[partnerNorm] || [];
      if (!list.some((m) => m.id === pm.id)) {
        currentThreads[partnerNorm] = [...list, pm]
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .slice(-MAX_MESSAGES);
      }
    }

    try {
      localStorage.setItem(`${PM_STORAGE_PREFIX}${myNorm}`, JSON.stringify(currentThreads));
    } catch {}
  }

  const result = {
    publicMessages: mergedPublic,
    privateThreads: getStoredPrivateChats(effectiveUser),
    hasLocalOnly: hasLocalOnlyPublic || hasLocalOnlyPrivate,
  };

  historySyncSubscribers.forEach((cb) => {
    try {
      cb(result);
    } catch {}
  });

  return result;
}

/**
 * Simpan perubahan pesan (tambah publik, tambah DM, atau tarik pesan) ke server Supabase secara berurutan (antrean)
 */
function persistChatChangeToServer({ addPublic = null, addPrivate = null, retractId = null } = {}) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve();

  const runPersist = async () => {
    try {
      const record = await fetchOrCreateGlobalChatRecord();
      if (!record) return;

      const gs = record.game_state || {};
      let publicList = Array.isArray(gs.publicMessages) ? [...gs.publicMessages] : [];
      let privateList = Array.isArray(gs.privateMessages) ? [...gs.privateMessages] : [];
      let retractedList = Array.isArray(gs.retractedIds) ? [...gs.retractedIds] : [];

      if (retractId) {
        if (!retractedList.includes(retractId)) {
          retractedList = [...retractedList, retractId].slice(-MAX_RETRACTED_IDS);
        }
        publicList = publicList.filter((m) => m && m.id !== retractId);
        privateList = privateList.filter((m) => m && m.id !== retractId);
      }

      const retractedSet = new Set(retractedList);

      if (addPublic && addPublic.id && !retractedSet.has(addPublic.id)) {
        if (!publicList.some((m) => m && m.id === addPublic.id)) {
          publicList.push(addPublic);
        }
      }

      if (addPrivate && addPrivate.id && !retractedSet.has(addPrivate.id)) {
        if (!privateList.some((m) => m && m.id === addPrivate.id)) {
          privateList.push(addPrivate);
        }
      }

      // Gabungkan juga dengan pesan publik lokal yang belum ada di server (agar pesan lama ikut terunggah)
      const localPublic = getStoredLobbyChats();
      for (const locMsg of localPublic) {
        if (
          locMsg &&
          locMsg.id &&
          !retractedSet.has(locMsg.id) &&
          locMsg.type !== 'private' &&
          !locMsg.targetUsername &&
          !String(locMsg.id).startsWith('pm_') &&
          !publicList.some((m) => m && m.id === locMsg.id)
        ) {
          publicList.push(locMsg);
        }
      }

      // Gabungkan juga DM lokal milik user aktif jika belum ada di server
      if (currentSubscribedUsername) {
        const localThreads = getStoredPrivateChats(currentSubscribedUsername);
        for (const list of Object.values(localThreads)) {
          if (!Array.isArray(list)) continue;
          for (const pm of list) {
            if (
              pm &&
              pm.id &&
              !retractedSet.has(pm.id) &&
              !privateList.some((m) => m && m.id === pm.id)
            ) {
              privateList.push(pm);
            }
          }
        }
      }

      publicList = publicList
        .filter(
          (m) =>
            m &&
            m.id &&
            !m.id.startsWith('seed_') &&
            !retractedSet.has(m.id) &&
            m.type !== 'private' &&
            !m.targetUsername &&
            !String(m.id).startsWith('pm_')
        )
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .slice(-MAX_MESSAGES);

      privateList = privateList
        .filter((m) => m && m.id && !retractedSet.has(m.id))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .slice(-MAX_PRIVATE_MESSAGES);

      await supabase
        .from('rooms')
        .update({
          game_state: {
            publicMessages: publicList,
            privateMessages: privateList,
            retractedIds: retractedList,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('code', GLOBAL_CHAT_ROOM_CODE);
    } catch (e) {
      console.warn('[LobbyChat] Failed to persist chat history:', e);
    }
  };

  persistQueue = persistQueue.then(runPersist, runPersist);
  return persistQueue;
}

/**
 * Sinkronkan riwayat chat global, ajakan mabar, & DM dari Supabase ke browser saat ini (termasuk Incognito)
 */
export async function syncLobbyChatHistory(currentUsername = '') {
  if (currentUsername) {
    currentSubscribedUsername = String(currentUsername).trim();
  }
  if (!isSupabaseConfigured || !supabase) {
    return {
      publicMessages: getStoredLobbyChats(),
      privateThreads: getStoredPrivateChats(currentUsername),
    };
  }

  try {
    const record = await fetchOrCreateGlobalChatRecord();
    if (!record) {
      return {
        publicMessages: getStoredLobbyChats(),
        privateThreads: getStoredPrivateChats(currentUsername),
      };
    }

    const applied = applyRemoteGlobalChatState(record.game_state || {}, currentUsername);
    if (applied?.hasLocalOnly) {
      await persistChatChangeToServer({});
    }

    return {
      publicMessages: applied?.publicMessages || getStoredLobbyChats(),
      privateThreads: applied?.privateThreads || getStoredPrivateChats(currentUsername),
    };
  } catch (e) {
    return {
      publicMessages: getStoredLobbyChats(),
      privateThreads: getStoredPrivateChats(currentUsername),
    };
  }
}

/**
 * Subscribe ke pembaruan sinkronisasi riwayat chat dari server (`__GCHAT__`)
 */
export function subscribeToChatHistorySync(cb) {
  historySyncSubscribers.add(cb);
  return () => {
    historySyncSubscribers.delete(cb);
  };
}

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('royal_lobby_chat_bc');
    broadcastChannel.onmessage = (event) => {
      const msg = event?.data;
      if (msg && msg.type === 'retract' && msg.id) {
        if (msg.scope !== 'private') removeStoredLobbyChat(msg.id);
        activeSubscribers.forEach((cb) => {
          try {
            cb(msg);
          } catch {}
        });
        return;
      }
      if (msg && msg.id) {
        appendStoredLobbyChat(msg); // otomatis mengabaikan pesan private
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
 * Pastikan channel `global_lobby_chat` aktif dengan seluruh listener broadcast & postgres_changes (`__GCHAT__`)
 */
function ensureLobbyChannel() {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(null);
  if (lobbyChannel && lobbyChannelReadyPromise) {
    return lobbyChannelReadyPromise;
  }

  lobbyChannelReadyPromise = new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve(lobbyChannel);
      }
    };

    const timeout = setTimeout(finish, 2500);

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
      .on('broadcast', { event: 'lobby_chat_retract' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        const myNameNorm = String(currentSubscribedUsername || '').trim().toLowerCase();
        const senderNorm = String(payload.senderName || '').trim().toLowerCase();
        const targetNorm = String(payload.targetUsername || '').trim().toLowerCase();
        if (payload.scope === 'private') {
          if (!myNameNorm || (targetNorm !== myNameNorm && senderNorm !== myNameNorm)) return;
          removeStoredPrivateChat(myNameNorm, senderNorm === myNameNorm ? targetNorm : senderNorm, payload.id);
        } else {
          removeStoredLobbyChat(payload.id);
        }
        const note = { ...payload, type: 'retract' };
        activeSubscribers.forEach((cb) => {
          try {
            cb(note);
          } catch {}
        });
      })
      .on('broadcast', { event: 'lobby_private_message' }, ({ payload }) => {
        if (!payload || !payload.id) return;

        const myNameNorm = String(currentSubscribedUsername || '').trim().toLowerCase();
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${GLOBAL_CHAT_ROOM_CODE}`,
        },
        (changePayload) => {
          const newGs = changePayload?.new?.game_state;
          if (newGs) {
            applyRemoteGlobalChatState(newGs, currentSubscribedUsername);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          finish();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          finish();
        }
      });
  });

  return lobbyChannelReadyPromise;
}

/**
 * Subscribes to Realtime Lobby Chat (both global public & direct messages)
 * @param {Function} onNewMessage Callback receiving incoming chat message
 * @param {string} currentUsername Current user's nickname for direct message filtering
 * @returns {Function} Unsubscribe function
 */
export function subscribeToLobbyChat(onNewMessage, currentUsername = '') {
  if (currentUsername) {
    currentSubscribedUsername = String(currentUsername).trim();
  }
  activeSubscribers.add(onNewMessage);
  ensureLobbyChannel();

  return () => {
    activeSubscribers.delete(onNewMessage);
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
  isRoomInvite = false,
}) {
  const cleanMsg = String(message || '').trim();
  const cleanSender = String(senderName || '').trim() || 'Player';

  if (!cleanMsg) {
    return { success: false, error: 'Pesan tidak boleh kosong.' };
  }

  // Pesan biasa dari input chat TIDAK boleh otomatis jadi kartu undangan mabar.
  // Hanya undangan eksplisit (tombol ajak mabar di lobby) yang memiliki isRoomInvite & roomCode.
  const isInvite = Boolean(isRoomInvite && roomCode);

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
    gameType: isInvite ? gameType : null,
    roomCode: isInvite ? roomCode : null,
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

  // 3. Broadcast to Supabase Realtime channel & persist to server
  if (isSupabaseConfigured && supabase) {
    try {
      const ch = await ensureLobbyChannel();
      if (ch) {
        await ch.send({
          type: 'broadcast',
          event: 'lobby_chat_message',
          payload,
        });
      }
    } catch (err) {
      console.warn('[LobbyChat] Supabase broadcast notice:', err);
    }
    // 4. Simpan ke server Supabase agar riwayat tetap muncul di Incognito / perangkat baru
    await persistChatChangeToServer({ addPublic: payload });
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
  isRoomInvite = false,
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

  const isInvite = Boolean(isRoomInvite && roomCode);

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
    roomCode: isInvite ? roomCode : null,
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

  // 3. Broadcast to Supabase Realtime channel & persist to server
  if (isSupabaseConfigured && supabase) {
    try {
      const ch = await ensureLobbyChannel();
      if (ch) {
        await ch.send({
          type: 'broadcast',
          event: 'lobby_private_message',
          payload,
        });
      }
    } catch (err) {
      console.warn('[LobbyChat] Send private message broadcast warning:', err);
    }
    // 4. Simpan ke server Supabase agar riwayat DM muncul saat login di Incognito / perangkat baru
    await persistChatChangeToServer({ addPrivate: payload });
  }

  return { success: true, message: payload };
}

/**
 * Batal kirim: menarik kembali pesan milik sendiri (global maupun DM) dari semua perangkat.
 * Hanya pengirim asli (senderName cocok) yang boleh menarik pesan.
 */
export async function retractChatMessage({ id, scope = 'public', senderName, targetUsername = null }) {
  if (!id || !senderName) return { success: false, error: 'Data pesan tidak lengkap.' };

  const payload = {
    id,
    scope: scope === 'private' ? 'private' : 'public',
    senderName: String(senderName).trim(),
    targetUsername: targetUsername ? String(targetUsername).trim() : null,
    type: 'retract',
  };

  // 1. Hapus lokal
  if (payload.scope === 'private') {
    removeStoredPrivateChat(payload.senderName, payload.targetUsername, id);
  } else {
    removeStoredLobbyChat(id);
  }

  // 2. Beritahu subscriber lokal & tab lain
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

  // 3. Siarkan ke pemain lain & hapus dari server
  if (isSupabaseConfigured && supabase) {
    try {
      const ch = await ensureLobbyChannel();
      if (ch) {
        await ch.send({ type: 'broadcast', event: 'lobby_chat_retract', payload });
      }
    } catch (err) {
      console.warn('[LobbyChat] Retract broadcast warning:', err);
    }
    // 4. Hapus juga dari server Supabase agar tidak muncul kembali di Incognito / perangkat baru
    await persistChatChangeToServer({ retractId: id });
  }

  return { success: true };
}
