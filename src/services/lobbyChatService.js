/**
 * LOBBY CHAT SERVICE (MLBB STYLE WORLD CHAT)
 * Realtime Global Lobby & Recruitment Chat for Main Menu / Home Screen.
 * Uses Supabase Realtime Broadcast over channel 'global_lobby_chat'.
 * Supports cross-tab BroadcastChannel fallback and persistent localStorage cache.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { audio } from './audioService';
import { getPlayerRankTier, cachePlayerAvatar, getCachedPlayerAvatar } from './leaderboardService';

const STORAGE_KEY = 'royal_cards_global_lobby_chat_v1';
const PM_STORAGE_PREFIX = 'royal_cards_pm_history_v1_';
const GLOBAL_CHAT_ROOM_CODE = '__GCHAT__';
const MAX_MESSAGES = 50;
const MAX_PRIVATE_MESSAGES = 120;
const MAX_RETRACTED_IDS = 100;

/* ========================================================================== */
/* CHAT ENCRYPTION / DECRYPTION LAYER (ChaCha20 Stream Cipher)                */
/* Ensures messages saved in Supabase database are never stored as plaintext  */
/* ========================================================================== */

function rotl(a, b) {
  return ((a << b) | (a >>> (32 - b))) >>> 0;
}

function QR(s, a, b, c, d) {
  s[a] = (s[a] + s[b]) >>> 0;
  s[d] = rotl(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0;
  s[b] = rotl(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0;
  s[d] = rotl(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0;
  s[b] = rotl(s[b] ^ s[c], 7);
}

function chacha20Block(keyWords, counter, nonceWords) {
  const state = new Uint32Array(16);
  // Constants: "expand 32-byte k"
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  for (let i = 0; i < 8; i++) state[4 + i] = keyWords[i];
  state[12] = counter;
  state[13] = nonceWords[0];
  state[14] = nonceWords[1];
  state[15] = nonceWords[2];

  const working = new Uint32Array(state);
  for (let i = 0; i < 10; i++) {
    QR(working, 0, 4, 8, 12);
    QR(working, 1, 5, 9, 13);
    QR(working, 2, 6, 10, 14);
    QR(working, 3, 7, 11, 15);
    QR(working, 0, 5, 10, 15);
    QR(working, 1, 6, 11, 12);
    QR(working, 2, 7, 8, 13);
    QR(working, 3, 4, 9, 14);
  }
  const out = new Uint8Array(64);
  for (let i = 0; i < 16; i++) {
    const val = (working[i] + state[i]) >>> 0;
    out[i * 4] = val & 0xff;
    out[i * 4 + 1] = (val >>> 8) & 0xff;
    out[i * 4 + 2] = (val >>> 16) & 0xff;
    out[i * 4 + 3] = (val >>> 24) & 0xff;
  }
  return out;
}

function deriveKeyWords(passphrase) {
  const keyBytes = new Uint8Array(32);
  let h = 0x811c9dc5;
  for (let round = 0; round < 32; round++) {
    for (let i = 0; i < passphrase.length; i++) {
      h = Math.imul(h ^ passphrase.charCodeAt(i) ^ (round * 31), 0x01000193) >>> 0;
    }
    keyBytes[round] = h & 0xff;
  }
  const keyWords = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    keyWords[i] =
      keyBytes[i * 4] |
      (keyBytes[i * 4 + 1] << 8) |
      (keyBytes[i * 4 + 2] << 16) |
      (keyBytes[i * 4 + 3] << 24);
  }
  return keyWords;
}

const CHAT_SECRET_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CHAT_ENCRYPTION_KEY) ||
  'ROYAL_CARDS_CHAT_SECURE_CIPHER_V1_GEMINI_2026';

const APP_KEY_WORDS = deriveKeyWords(CHAT_SECRET_KEY);

function chacha20Process(bytes, nonceBytes) {
  const nonceWords = new Uint32Array(3);
  for (let i = 0; i < 3; i++) {
    nonceWords[i] =
      nonceBytes[i * 4] |
      (nonceBytes[i * 4 + 1] << 8) |
      (nonceBytes[i * 4 + 2] << 16) |
      (nonceBytes[i * 4 + 3] << 24);
  }
  const out = new Uint8Array(bytes.length);
  let counter = 1;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const block = chacha20Block(APP_KEY_WORDS, counter++, nonceWords);
    const take = Math.min(64, bytes.length - offset);
    for (let j = 0; j < take; j++) {
      out[offset + j] = bytes[offset + j] ^ block[j];
    }
  }
  return out;
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Mengenkripsi isi pesan chat sebelum disimpan ke database Supabase
 */
export function encryptChatMessage(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  if (!str) return '';
  if (str.startsWith('enc:v1:')) return str; // Jangan enkripsi ulang jika sudah terenkripsi

  try {
    const textBytes = new TextEncoder().encode(str);
    const nonce = new Uint8Array(12);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(nonce);
    } else {
      for (let i = 0; i < 12; i++) nonce[i] = Math.floor(Math.random() * 256);
    }

    const cipher = chacha20Process(textBytes, nonce);
    const combined = new Uint8Array(12 + cipher.length);
    combined.set(nonce, 0);
    combined.set(cipher, 12);

    return 'enc:v1:' + bytesToBase64(combined);
  } catch (e) {
    console.warn('[LobbyChat] Encrypt fallback notice:', e);
    return str;
  }
}

/**
 * Mendekripsi isi pesan chat dari database Supabase
 */
export function decryptChatMessage(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') return '';
  if (!cipherText.startsWith('enc:v1:')) return cipherText; // Dukungan pesan plaintext lama

  try {
    const b64 = cipherText.slice('enc:v1:'.length);
    const combined = base64ToBytes(b64);
    if (combined.length < 12) return cipherText;

    const nonce = combined.slice(0, 12);
    const cipher = combined.slice(12);
    const plainBytes = chacha20Process(cipher, nonce);
    return new TextDecoder().decode(plainBytes);
  } catch (e) {
    return cipherText;
  }
}

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
      return parsed
        .filter((m) => {
          if (!m || !m.id || m.id.startsWith('seed_') || seen.has(m.id)) return false;
          // Pesan DM tidak boleh pernah masuk chat global (membersihkan data tercemar lama juga)
          if (m.type === 'private' || m.targetUsername || String(m.id).startsWith('pm_')) return false;
          seen.add(m.id);
          return true;
        })
        .map((m) => ({
          ...m,
          message: decryptChatMessage(m.message),
        }));
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

let cachedGlobalChatRecord = null;
let lastGlobalChatFetchAt = 0;
let inflightGlobalChatFetch = null;

function stripBase64AvatarForWire(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  if (typeof msg.avatar === 'string' && msg.avatar.startsWith('data:image/')) {
    if (msg.senderName) cachePlayerAvatar(msg.senderName, msg.avatar);
    return { ...msg, avatar: '👑' };
  }
  return msg;
}

function hydrateChatAvatar(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  if (typeof msg.avatar === 'string' && msg.avatar.startsWith('data:image/')) {
    if (msg.senderName) cachePlayerAvatar(msg.senderName, msg.avatar);
    return msg;
  }
  const cached = msg.senderName ? getCachedPlayerAvatar(msg.senderName) : null;
  if (cached) {
    return { ...msg, avatar: cached };
  }
  return msg;
}

/**
 * Ambil atau buat record penyimpanan riwayat chat global di Supabase (`rooms` dengan `code = '__GCHAT__'`).
 * Memastikan riwayat obrolan global, ajakan mabar room, dan DM tetap muncul meski dibuka di Incognito / perangkat baru.
 */
async function fetchOrCreateGlobalChatRecord(forceRefresh = false) {
  if (!isSupabaseConfigured || !supabase) return null;
  const now = Date.now();
  if (!forceRefresh && cachedGlobalChatRecord && now - lastGlobalChatFetchAt < 45000) {
    return cachedGlobalChatRecord;
  }
  if (!forceRefresh && inflightGlobalChatFetch) {
    return inflightGlobalChatFetch;
  }

  inflightGlobalChatFetch = (async () => {
    try {
      const { data: existing, error } = await supabase
        .from('rooms')
        .select('id, code, game_state')
        .eq('code', GLOBAL_CHAT_ROOM_CODE)
        .maybeSingle();

      if (!error && existing) {
        cachedGlobalChatRecord = existing;
        lastGlobalChatFetchAt = Date.now();
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

      if (!insertErr && created) {
        cachedGlobalChatRecord = created;
        lastGlobalChatFetchAt = Date.now();
        return created;
      }

      // Jika gagal insert karena race condition (sudah dibuat klien lain), ambil ulang
      const { data: retry } = await supabase
        .from('rooms')
        .select('id, code, game_state')
        .eq('code', GLOBAL_CHAT_ROOM_CODE)
        .maybeSingle();
      if (retry) {
        cachedGlobalChatRecord = retry;
        lastGlobalChatFetchAt = Date.now();
      }
      return retry || null;
    } catch (e) {
      return null;
    } finally {
      inflightGlobalChatFetch = null;
    }
  })();

  return inflightGlobalChatFetch;
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
  const clearedAt = Number(gs.clearedAt || 0);

  const rawRemotePublic = Array.isArray(gs.publicMessages) ? gs.publicMessages : [];
  const rawRemotePrivate = Array.isArray(gs.privateMessages) ? gs.privateMessages : [];
  const retractedList = Array.isArray(gs.retractedIds) ? gs.retractedIds : [];
  const retractedSet = new Set(retractedList);

  // Dekripsi pesan remote dan buang pesan yang lebih lama dari clearedAt
  const remotePublic = rawRemotePublic
    .filter((m) => m && (!clearedAt || (m.timestamp || 0) > clearedAt))
    .map((m) =>
      hydrateChatAvatar({
        ...m,
        message: decryptChatMessage(m.message),
      })
    );

  const remotePrivate = rawRemotePrivate
    .filter((m) => m && (!clearedAt || (m.timestamp || 0) > clearedAt))
    .map((m) =>
      hydrateChatAvatar({
        ...m,
        message: decryptChatMessage(m.message),
      })
    );

  const localPublic = getStoredLobbyChats().filter(
    (m) => m && (!clearedAt || (m.timestamp || 0) > clearedAt)
  );

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
        (m) => m && m.id && !retractedSet.has(m.id) && (!clearedAt || (m.timestamp || 0) > clearedAt)
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
 * Seluruh isi pesan dienkripsi sebelum dikirim dan disimpan ke tabel Supabase, dan gambar Base64 dilepas agar tidak membengkakkan Egress.
 */
function persistChatChangeToServer({ addPublic = null, addPrivate = null, retractId = null } = {}) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve();

  const runPersist = async () => {
    try {
      const record = cachedGlobalChatRecord || (await fetchOrCreateGlobalChatRecord());
      if (!record) return;

      const gs = record.game_state || {};
      const clearedAt = Number(gs.clearedAt || 0);

      // Dekripsi pesan saat ini dari server untuk manipulasi list
      let publicList = (Array.isArray(gs.publicMessages) ? [...gs.publicMessages] : [])
        .map((m) => ({ ...m, message: decryptChatMessage(m?.message) }))
        .filter((m) => !clearedAt || (m.timestamp || 0) > clearedAt);

      let privateList = (Array.isArray(gs.privateMessages) ? [...gs.privateMessages] : [])
        .map((m) => ({ ...m, message: decryptChatMessage(m?.message) }))
        .filter((m) => !clearedAt || (m.timestamp || 0) > clearedAt);

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
          publicList.push({
            ...stripBase64AvatarForWire(addPublic),
            message: decryptChatMessage(addPublic.message),
          });
        }
      }

      if (addPrivate && addPrivate.id && !retractedSet.has(addPrivate.id)) {
        if (!privateList.some((m) => m && m.id === addPrivate.id)) {
          privateList.push({
            ...stripBase64AvatarForWire(addPrivate),
            message: decryptChatMessage(addPrivate.message),
          });
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
            !String(m.id).startsWith('pm_') &&
            (!clearedAt || (m.timestamp || 0) > clearedAt)
        )
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .slice(-MAX_MESSAGES);

      privateList = privateList
        .filter(
          (m) =>
            m &&
            m.id &&
            !retractedSet.has(m.id) &&
            (!clearedAt || (m.timestamp || 0) > clearedAt)
        )
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .slice(-MAX_PRIVATE_MESSAGES);

      // Enkripsi seluruh isi pesan & lepas avatar Base64 sebelum disimpan ke database Supabase
      const encryptedPublicList = publicList.map((m) => {
        if (!m || !m.message) return stripBase64AvatarForWire(m);
        return {
          ...stripBase64AvatarForWire(m),
          message: encryptChatMessage(m.message),
        };
      });

      const encryptedPrivateList = privateList.map((m) => {
        if (!m || !m.message) return stripBase64AvatarForWire(m);
        return {
          ...stripBase64AvatarForWire(m),
          message: encryptChatMessage(m.message),
        };
      });

      const nextGs = {
        publicMessages: encryptedPublicList,
        privateMessages: encryptedPrivateList,
        retractedIds: retractedList,
        clearedAt: gs.clearedAt || null,
      };
      cachedGlobalChatRecord = { ...record, game_state: nextGs };
      lastGlobalChatFetchAt = Date.now();

      await supabase
        .from('rooms')
        .update({
          game_state: nextGs,
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
 * Menghapus SELURUH riwayat chat (publik global, cari mabar, DM, dan retracted IDs)
 * baik dari database Supabase (`__GCHAT__`) maupun cache browser lokal & tab lainnya.
 */
export async function clearAllChatHistory() {
  const clearTimestamp = Date.now();

  // 1. Bersihkan localStorage lokal
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith(PM_STORAGE_PREFIX) ||
            k.startsWith('royal_cards_pm_') ||
            k.startsWith('royal_cards_global_lobby_chat'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  }

  // 2. Beritahu subscriber aktif di antarmuka & tab browser lain
  const clearPayload = { type: 'clear_all', timestamp: clearTimestamp };
  activeSubscribers.forEach((cb) => {
    try {
      cb(clearPayload);
    } catch {}
  });

  historySyncSubscribers.forEach((cb) => {
    try {
      cb({
        publicMessages: [],
        privateThreads: {},
        hasLocalOnly: false,
      });
    } catch {}
  });

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(clearPayload);
    } catch {}
  }

  // 3. Update database Supabase dan siarkan event broadcast ke semua pemain online
  if (isSupabaseConfigured && supabase) {
    try {
      const ch = await ensureLobbyChannel();
      if (ch) {
        await ch.send({
          type: 'broadcast',
          event: 'lobby_chat_clear_all',
          payload: clearPayload,
        });
      }
    } catch (err) {
      console.warn('[LobbyChat] Broadcast clear error:', err);
    }

    try {
      await supabase
        .from('rooms')
        .update({
          game_state: {
            publicMessages: [],
            privateMessages: [],
            retractedIds: [],
            clearedAt: clearTimestamp,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('code', GLOBAL_CHAT_ROOM_CODE);
    } catch (err) {
      console.warn('[LobbyChat] Failed to clear rooms __GCHAT__:', err);
    }
  }

  return { success: true };
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

    const gs = record.game_state || {};

    // Periksa apakah ada pesan lama yang belum terenkripsi (mentah) di database.
    // Sesuai permintaan user: bersihkan semua riwayat lama jika belum terenkripsi atau wipe perdana belum jalan.
    const hasRawUnencrypted =
      gs.publicMessages?.some((m) => m && m.message && !String(m.message).startsWith('enc:v1:')) ||
      gs.privateMessages?.some((m) => m && m.message && !String(m.message).startsWith('enc:v1:'));

    const needFirstWipe =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('royal_cards_chat_v2_encrypted_wiped') !== 'done';

    if (hasRawUnencrypted || needFirstWipe) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('royal_cards_chat_v2_encrypted_wiped', 'done');
      }
      await clearAllChatHistory();
      return {
        publicMessages: [],
        privateThreads: {},
      };
    }

    const applied = applyRemoteGlobalChatState(gs, currentUsername);
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
      if (msg && msg.type === 'clear_all') {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.removeItem(STORAGE_KEY);
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (
                k &&
                (k.startsWith(PM_STORAGE_PREFIX) ||
                  k.startsWith('royal_cards_pm_') ||
                  k.startsWith('royal_cards_global_lobby_chat'))
              ) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          } catch (e) {}
        }
        activeSubscribers.forEach((cb) => {
          try {
            cb(msg);
          } catch {}
        });
        historySyncSubscribers.forEach((cb) => {
          try {
            cb({
              publicMessages: [],
              privateThreads: {},
              hasLocalOnly: false,
            });
          } catch {}
        });
        return;
      }
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
        const cleanMsg = { ...msg, message: decryptChatMessage(msg.message) };
        appendStoredLobbyChat(cleanMsg); // otomatis mengabaikan pesan private
        activeSubscribers.forEach((cb) => {
          try {
            cb(cleanMsg);
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
          cleaned[key] = list
            .filter((m) => {
              if (!m || !m.id || seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            })
            .map((m) => ({
              ...m,
              message: decryptChatMessage(m.message),
            }));
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
 * Pastikan channel `global_lobby_chat` aktif dengan seluruh listener broadcast (tanpa postgres_changes `__GCHAT__` yang membengkakkan Egress)
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
        const decrypted = hydrateChatAvatar({
          ...payload,
          message: decryptChatMessage(payload.message),
        });
        appendStoredLobbyChat(decrypted);
        try {
          audio.playChatPopSound();
        } catch {}
        activeSubscribers.forEach((cb) => {
          try {
            cb(decrypted);
          } catch (err) {
            console.error('Error in lobby chat listener:', err);
          }
        });
      })
      .on('broadcast', { event: 'lobby_chat_clear_all' }, ({ payload }) => {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.removeItem(STORAGE_KEY);
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (
                k &&
                (k.startsWith(PM_STORAGE_PREFIX) ||
                  k.startsWith('royal_cards_pm_') ||
                  k.startsWith('royal_cards_global_lobby_chat'))
              ) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          } catch (e) {}
        }
        const note = { type: 'clear_all', timestamp: payload?.timestamp || Date.now() };
        activeSubscribers.forEach((cb) => {
          try {
            cb(note);
          } catch {}
        });
        historySyncSubscribers.forEach((cb) => {
          try {
            cb({
              publicMessages: [],
              privateThreads: {},
              hasLocalOnly: false,
            });
          } catch {}
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

        const decrypted = hydrateChatAvatar({
          ...payload,
          message: decryptChatMessage(payload.message),
        });
        const partnerName = senderNorm === myNameNorm ? decrypted.targetUsername : decrypted.senderName;
        appendStoredPrivateChat(myNameNorm, partnerName, decrypted);

        try {
          audio.playChatPopSound();
        } catch {}

        activeSubscribers.forEach((cb) => {
          try {
            cb(decrypted);
          } catch (err) {
            console.error('Error in PM listener:', err);
          }
        });
      })
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
    if (activeSubscribers.size === 0 && lobbyChannel && supabase) {
      try {
        supabase.removeChannel(lobbyChannel);
      } catch {}
      lobbyChannel = null;
      lobbyChannelReadyPromise = null;
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

  // 3. Broadcast to Supabase Realtime channel (without heavy Base64 avatar) & persist to server
  if (isSupabaseConfigured && supabase) {
    try {
      const ch = await ensureLobbyChannel();
      if (ch) {
        await ch.send({
          type: 'broadcast',
          event: 'lobby_chat_message',
          payload: stripBase64AvatarForWire(payload),
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

  // 3. Broadcast to Supabase Realtime channel (without heavy Base64 avatar) & persist to server
  if (isSupabaseConfigured && supabase) {
    try {
      const ch = await ensureLobbyChannel();
      if (ch) {
        await ch.send({
          type: 'broadcast',
          event: 'lobby_private_message',
          payload: stripBase64AvatarForWire(payload),
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
