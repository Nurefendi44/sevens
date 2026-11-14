/**
 * LEADERBOARD SERVICE
 * Manages fetching and recording stats for Top Global Leaderboard across games.
 * - MENANG (wins): Diambil dari jumlah kemenangan Juara 1
 * - SKOR (score): Total akumulasi poin yang didapatkan dari keseluruhan permainan
 * - Akumulasi berdasarkan Username yang sama (case-insensitive)
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js';

const LOCAL_STORAGE_KEY_FALLBACK = 'poker_global_leaderboard_cache';
const STORAGE_PLAYER_NAME = 'sevens_player_name';
const STORAGE_PLAYER_AVATAR = 'sevens_player_avatar';
const STORAGE_PLAYER_PIN = 'sevens_player_pin';

export const PROFILE_AVATARS = [
  '👑', '🐉', '🦁', '🦊', '🐼', '🐯', '🥷', '🧙‍♂️', '🧛', '⚡', '🔥', '💎', '👤', '🐨'
];

/**
 * Deterministic fast hash for (username + 4-digit PIN) so raw PIN is never exposed in plain text
 */
export function hashProfilePin(username, pin) {
  const normUser = String(username || '').trim().toLowerCase();
  const cleanPin = String(pin || '').trim();
  if (!normUser || !/^\d{4}$/.test(cleanPin)) return '';
  const payload = `royal_pin_v1::${normUser}::${cleanPin}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Extracts PIN hash from a `player_id` string or array of `player_ids` (format: `user_<name>__pin_<hash>`)
 */
export function extractPinHashFromItem(itemOrId) {
  if (!itemOrId) return null;
  const candidates = [];
  if (typeof itemOrId === 'string') {
    candidates.push(itemOrId);
  } else if (typeof itemOrId === 'object') {
    if (itemOrId.player_id) candidates.push(itemOrId.player_id);
    if (Array.isArray(itemOrId.player_ids)) candidates.push(...itemOrId.player_ids);
  }
  for (const idStr of candidates) {
    const match = String(idStr || '').match(/__pin_([a-f0-9]{6,16})/i);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

/**
 * Get saved local player profile (username, avatar, pin).
 * Also auto-recovers username from cached room or local scoreboard if `sevens_player_name` was cleared.
 */
export function getLocalPlayerProfile() {
  if (typeof localStorage === 'undefined') {
    return { name: '', avatar: '👑', pin: '' };
  }
  let name = (localStorage.getItem(STORAGE_PLAYER_NAME) || '').trim();
  let avatar = localStorage.getItem(STORAGE_PLAYER_AVATAR) || '';
  const pin = (localStorage.getItem(STORAGE_PLAYER_PIN) || '').trim();
  const localId = localStorage.getItem('sevens_player_id') || '';

  if (!name && localId) {
    try {
      const cachedRoomRaw = localStorage.getItem('sevens_cached_room');
      if (cachedRoomRaw) {
        const parsedRoom = JSON.parse(cachedRoomRaw);
        const meInRoom = (parsedRoom?.players || []).find((p) => p.id === localId && !p.isBot);
        if (meInRoom?.name) {
          name = String(meInRoom.name).trim();
          if (!avatar && meInRoom.avatar) avatar = meInRoom.avatar;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!name && localId) {
    try {
      const rawScores = localStorage.getItem('poker_scoreboard_data');
      if (rawScores) {
        const parsedScores = JSON.parse(rawScores);
        for (const sessionObj of Object.values(parsedScores || {})) {
          if (sessionObj && typeof sessionObj === 'object' && sessionObj[localId]?.name) {
            const candidate = String(sessionObj[localId].name).trim();
            if (candidate && candidate !== 'Anda' && !candidate.startsWith('Bot ')) {
              name = candidate;
              if (!avatar && sessionObj[localId].avatar) avatar = sessionObj[localId].avatar;
              break;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (name && !localStorage.getItem(STORAGE_PLAYER_NAME)) {
    try {
      localStorage.setItem(STORAGE_PLAYER_NAME, name);
    } catch {
      // ignore
    }
  }

  return {
    name,
    avatar: avatar || '👑',
    pin,
  };
}

/**
 * Save local player profile (username, avatar, pin) to localStorage
 */
export function saveLocalPlayerProfile({ name, avatar, pin }) {
  if (typeof localStorage === 'undefined') return;
  const current = getLocalPlayerProfile();
  let changed = false;

  if (typeof name === 'string') {
    const clean = name.trim();
    if (clean && clean !== current.name) {
      localStorage.setItem(STORAGE_PLAYER_NAME, clean);
      changed = true;
    }
  }
  if (avatar && avatar !== current.avatar) {
    localStorage.setItem(STORAGE_PLAYER_AVATAR, avatar);
    changed = true;
    try {
      const localId = localStorage.getItem('sevens_player_id') || '';
      const cachedRoomRaw = localStorage.getItem('sevens_cached_room');
      if (cachedRoomRaw && localId) {
        const parsedRoom = JSON.parse(cachedRoomRaw);
        let roomChanged = false;
        if (Array.isArray(parsedRoom?.players)) {
          parsedRoom.players = parsedRoom.players.map((p) => {
            if (p.id === localId && !p.isBot) {
              roomChanged = true;
              return { ...p, avatar };
            }
            return p;
          });
        }
        if (roomChanged) {
          localStorage.setItem('sevens_cached_room', JSON.stringify(parsedRoom));
        }
      }
    } catch {
      // ignore
    }
  }
  if (typeof pin === 'string' && /^\d{4}$/.test(pin.trim())) {
    const cleanPin = pin.trim();
    if (cleanPin !== current.pin) {
      localStorage.setItem(STORAGE_PLAYER_PIN, cleanPin);
      changed = true;
    }
  }

  // Only dispatch event if data actually changed
  if (changed && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('profile_avatar_updated', {
          detail: {
            name: typeof name === 'string' ? name.trim() : localStorage.getItem(STORAGE_PLAYER_NAME) || '',
            avatar: avatar || localStorage.getItem(STORAGE_PLAYER_AVATAR) || '👑',
          },
        })
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Verifies or binds a 4-digit PIN for a Nickname against the Global Leaderboard in Supabase.
 * - If the Nickname already has a PIN in Supabase, verifies that `pin` matches before allowing save.
 * - If the Nickname exists in Supabase WITHOUT a PIN yet (legacy account like `pardi`), binds the new PIN to all its rows!
 * - If the Nickname is brand new, saves the profile + PIN locally and registers it in Supabase.
 */
export async function verifyAndSaveProfileWithPin({
  name,
  avatar,
  pin,
  preserveRemoteAvatar = false,
  explicitAvatarChange = false,
}) {
  const cleanName = String(name || '').trim();
  const cleanPin = String(pin || '').trim();
  let chosenAvatar = avatar || '👑';

  if (!cleanName) {
    return { success: false, error: 'Masukkan Nickname terlebih dahulu!' };
  }
  if (!/^\d{4}$/.test(cleanPin)) {
    return { success: false, error: 'PIN Keamanan harus berupa 4 digit angka (contoh: 1234)!' };
  }

  const expectedHash = hashProfilePin(cleanName, cleanPin);
  const normName = cleanName.toLowerCase();
  const lockedPlayerId = `user_${normName}__pin_${expectedHash}`;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: rows, error } = await supabase
        .from('leaderboard')
        .select('id, player_id, player_name, avatar, game_type')
        .ilike('player_name', cleanName.replace(/[\\%_]/g, (c) => '\\' + c));

      if (!error && Array.isArray(rows) && rows.length > 0) {
        const existingHash = extractPinHashFromItem({
          player_ids: rows.map((r) => r.player_id),
        });

        if (existingHash && existingHash !== expectedHash) {
          return {
            success: false,
            error: `🔒 Nickname "${cleanName}" sudah dilindungi PIN pemiliknya! Masukkan 4 digit PIN yang benar jika ini akun Anda, atau gunakan Nickname lain.`,
          };
        }

        const remotePhoto = rows.find(
          (r) => typeof r.avatar === 'string' && r.avatar.startsWith('data:image/')
        )?.avatar;
        const remoteAny =
          rows.find((r) => r.avatar && r.avatar !== '👤' && r.avatar !== '👑')?.avatar ||
          rows.find((r) => r.avatar)?.avatar;

        // If logging in on a second device (Device B) without explicitly changing the avatar,
        // ALWAYS restore the existing remote photo/avatar from Supabase so it is never lost!
        const shouldRestoreRemote =
          preserveRemoteAvatar ||
          !explicitAvatarChange ||
          (Boolean(remotePhoto) && !String(chosenAvatar).startsWith('data:image/'));

        if (shouldRestoreRemote && (remotePhoto || remoteAny)) {
          if (remotePhoto) {
            chosenAvatar = remotePhoto;
          } else if (!explicitAvatarChange && remoteAny) {
            chosenAvatar = remoteAny;
          }
        }

        // Either PIN matched OR legacy account didn't have a PIN yet -> lock all rows with `lockedPlayerId` & sync avatar
        for (const r of rows) {
          await supabase
            .from('leaderboard')
            .update({
              player_id: lockedPlayerId,
              player_name: cleanName,
              avatar: chosenAvatar,
            })
            .eq('id', r.id);
        }

        saveLocalPlayerProfile({ name: cleanName, avatar: chosenAvatar, pin: cleanPin });
        invalidateLeaderboardCache();
        return {
          success: true,
          avatar: chosenAvatar,
          status: existingHash ? 'verified' : 'locked_existing',
        };
      } else if (!error && Array.isArray(rows) && rows.length === 0) {
        // Brand-new account: register initial row so avatar & PIN lock are stored in Supabase immediately
        await supabase.from('leaderboard').upsert(
          {
            player_id: lockedPlayerId,
            player_name: cleanName,
            avatar: chosenAvatar,
            game_type: 'sevens',
            wins: 0,
            games_played: 0,
            score: 0,
            last_played_at: new Date().toISOString(),
          },
          { onConflict: 'player_id, game_type' }
        );
      }
    } catch (e) {
      console.warn('[Leaderboard] PIN verification check warning:', e);
    }
  }

  saveLocalPlayerProfile({ name: cleanName, avatar: chosenAvatar, pin: cleanPin });
  invalidateLeaderboardCache();
  return { success: true, avatar: chosenAvatar, status: 'saved_new' };
}

/**
 * Updates the current player's avatar/profile photo locally and in Supabase leaderboard (if registered).
 */
export async function updatePlayerAvatarEverywhere(newAvatar) {
  const chosenAvatar = newAvatar || '👑';
  const current = getLocalPlayerProfile();
  saveLocalPlayerProfile({
    name: current.name,
    avatar: chosenAvatar,
    pin: current.pin,
  });

  if (current.name && isSupabaseConfigured && supabase) {
    try {
      const cleanName = current.name.trim();
      const normName = cleanName.toLowerCase();
      const myHash = current.pin ? hashProfilePin(cleanName, current.pin) : '';
      const lockedPlayerId = myHash ? `user_${normName}__pin_${myHash}` : `user_${normName}`;

      const { data: rows } = await supabase
        .from('leaderboard')
        .select('id, player_id, player_name')
        .ilike('player_name', cleanName.replace(/[\\%_]/g, (c) => '\\' + c));

      if (Array.isArray(rows) && rows.length > 0) {
        const existingHash = extractPinHashFromItem({
          player_ids: rows.map((r) => r.player_id),
        });
        if (!existingHash || !myHash || existingHash === myHash) {
          for (const r of rows) {
            await supabase
              .from('leaderboard')
              .update({
                avatar: chosenAvatar,
                last_played_at: new Date().toISOString(),
              })
              .eq('id', r.id);
          }
        }
      } else if (myHash) {
        await supabase.from('leaderboard').upsert(
          {
            player_id: lockedPlayerId,
            player_name: cleanName,
            avatar: chosenAvatar,
            game_type: 'sevens',
            wins: 0,
            games_played: 0,
            score: 0,
            last_played_at: new Date().toISOString(),
          },
          { onConflict: 'player_id, game_type' }
        );
      }
      invalidateLeaderboardCache();
    } catch (e) {
      console.warn('[Leaderboard] Failed to sync new avatar to server:', e);
    }
  }

  return { success: true, avatar: chosenAvatar };
}

/**
 * Fetches & restores the saved avatar/photo from Supabase for a given username (and optional PIN).
 * Used when logging in on a new device (Device B) or syncing profile on startup.
 */
const SERVER_PROFILE_CACHE = new Map();
const SERVER_PROFILE_INFLIGHT = new Map();
const LEADERBOARD_MEM_CACHE = new Map();
const LEADERBOARD_INFLIGHT = new Map();

export function invalidateLeaderboardCache() {
  LEADERBOARD_MEM_CACHE.clear();
  SERVER_PROFILE_CACHE.clear();
}

export async function syncPlayerProfileFromServer(username, pin = '', forceRefresh = false) {
  const cleanName = String(username || '').trim();
  if (!cleanName || !isSupabaseConfigured || !supabase) return null;

  const cacheKey = `${cleanName.toLowerCase()}_${String(pin || '').trim()}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = SERVER_PROFILE_CACHE.get(cacheKey);
    if (cached && now - cached.timestamp < 60000) {
      return cached.data;
    }
    if (SERVER_PROFILE_INFLIGHT.has(cacheKey)) {
      return SERVER_PROFILE_INFLIGHT.get(cacheKey);
    }
  }

  const fetchPromise = (async () => {
    try {
      const { data: rows, error } = await supabase
        .from('leaderboard')
        .select('id, player_id, player_name, avatar')
        .ilike('player_name', cleanName.replace(/[\\%_]/g, (c) => '\\' + c))
        .limit(10);

      if (error || !Array.isArray(rows) || rows.length === 0) {
        if (!error) {
          SERVER_PROFILE_CACHE.set(cacheKey, { timestamp: Date.now(), data: null });
        }
        return null;
      }

      const existingHash = extractPinHashFromItem({
        player_ids: rows.map((r) => r.player_id),
      });

      const remotePhoto = rows.find(
        (r) => typeof r.avatar === 'string' && r.avatar.startsWith('data:image/')
      )?.avatar;
      const remoteAny =
        rows.find((r) => r.avatar && r.avatar !== '👤' && r.avatar !== '👑')?.avatar ||
        rows.find((r) => r.avatar)?.avatar;
      const bestAvatar = remotePhoto || remoteAny || '👑';

      // Only update local profile if something actually differs
      if (pin && /^\d{4}$/.test(String(pin).trim())) {
        const myHash = hashProfilePin(cleanName, pin);
        if (!existingHash || existingHash === myHash) {
          const current = getLocalPlayerProfile();
          if (current.avatar !== bestAvatar || current.pin !== String(pin).trim()) {
            saveLocalPlayerProfile({
              name: rows[0]?.player_name || cleanName,
              avatar: bestAvatar,
              pin: String(pin).trim(),
            });
          }
        }
      }

      const result = {
        name: rows[0]?.player_name || cleanName,
        avatar: bestAvatar,
        hasPin: Boolean(existingHash),
        pinHash: existingHash || null,
      };

      SERVER_PROFILE_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch {
      return null;
    } finally {
      SERVER_PROFILE_INFLIGHT.delete(cacheKey);
    }
  })();

  SERVER_PROFILE_INFLIGHT.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * In-memory & localStorage cached lookup for player avatar/photo by player name or ID.
 * Resolves avatar for opponents/teammates across match tables, scoreboards, and battle results.
 */
const KNOWN_AVATAR_CACHE = new Map();

export function cachePlayerAvatar(nameOrId, avatar) {
  if (!nameOrId || !avatar) return;
  const key = String(nameOrId).trim().toLowerCase();
  if (key) {
    KNOWN_AVATAR_CACHE.set(key, avatar);
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('sevens_known_avatars');
        const map = raw ? JSON.parse(raw) : {};
        map[key] = avatar;
        // Limit cache size to 100 entries
        const keys = Object.keys(map);
        if (keys.length > 100) {
          delete map[keys[0]];
        }
        localStorage.setItem('sevens_known_avatars', JSON.stringify(map));
      }
    } catch {}
  }
}

export function getCachedPlayerAvatar(nameOrId, fallback = null) {
  if (!nameOrId) return fallback;
  const key = String(nameOrId).trim().toLowerCase();
  if (KNOWN_AVATAR_CACHE.has(key)) {
    return KNOWN_AVATAR_CACHE.get(key);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('sevens_known_avatars');
      if (raw) {
        const map = JSON.parse(raw);
        if (map && map[key]) {
          KNOWN_AVATAR_CACHE.set(key, map[key]);
          return map[key];
        }
      }
    }
  } catch {}
  return fallback;
}

/**
 * Resolves the best available avatar for a player:
 * 1. If player is current local human viewer, returns local profile avatar / photo.
 * 2. If player already has a custom image avatar (data:image or http), returns it.
 * 3. Checks known avatar cache by player name or ID.
 * 4. Falls back to player.avatar or fallback emoji.
 */
export function resolvePlayerAvatar(player, fallback = '👤') {
  if (!player) return fallback;
  const localProfile = getLocalPlayerProfile();
  const cleanName = (player.name || '').trim().toLowerCase();
  const localName = (localProfile.name || '').trim().toLowerCase();
  const localId = (typeof localStorage !== 'undefined' && localStorage.getItem('sevens_player_id')) || '';

  // 1. Is this the current local player?
  if (
    (localId && player.id === localId) ||
    (localName && cleanName === localName && !player.isBot)
  ) {
    if (localProfile.avatar && localProfile.avatar !== '👤' && localProfile.avatar !== '👑') {
      return localProfile.avatar;
    }
    const localAvatar = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_PLAYER_AVATAR)) || '';
    if (localAvatar) return localAvatar;
  }

  // 2. Player already carries custom photo
  if (typeof player.avatar === 'string' && (player.avatar.startsWith('data:image/') || player.avatar.startsWith('http'))) {
    cachePlayerAvatar(cleanName, player.avatar);
    cachePlayerAvatar(player.id, player.avatar);
    return player.avatar;
  }

  // 3. Check cached avatar by name or id
  const fromCache = getCachedPlayerAvatar(cleanName) || getCachedPlayerAvatar(player.id);
  if (fromCache && (fromCache.startsWith('data:image/') || fromCache.startsWith('http'))) {
    return fromCache;
  }

  return player.avatar || fromCache || fallback;
}

/**
 * Permata & Kasino Rank Tier calculator:
 * Bronze ➔ Silver ➔ Gold ➔ Diamond ➔ Crown ➔ Ace ➔ Royal King
 * Computed from player's accumulated Global Score (points) and Wins (Juara 1).
 */
export function getPlayerRankTier(score = 0, wins = 0) {
  const s = Math.max(0, Number(score || 0));
  const w = Math.max(0, Number(wins || 0));
  // Effective rating combines score + bonus weight for 1st place wins
  const rating = s + w * 2;

  if (s >= 85 || w >= 20 || rating >= 120) {
    return {
      id: 'immortal',
      name: 'Royal King',
      shortName: 'Royal King',
      subTier: 'Royal King ★ ' + s,
      icon: '🦁',
      color: '#ff4d4d',
      accent: '#fde047',
      borderGlow: 'rgba(239, 68, 68, 0.65)',
      minScore: 85,
      nextTierName: null,
      nextMinScore: null,
      progress: 100,
    };
  }
  if (s >= 50 || w >= 12 || rating >= 70) {
    return {
      id: 'glory',
      name: 'Ace',
      shortName: 'Ace',
      subTier: 'Ace ★ ' + s,
      icon: '♠️',
      color: '#f59e0b',
      accent: '#fef08a',
      borderGlow: 'rgba(245, 158, 11, 0.6)',
      minScore: 50,
      nextTierName: 'Royal King',
      nextMinScore: 85,
      progress: Math.min(99, Math.round(((s - 50) / 35) * 100)),
    };
  }
  if (s >= 28 || w >= 7 || rating >= 40) {
    return {
      id: 'mythic',
      name: 'Crown',
      shortName: 'Crown',
      subTier: 'Crown ★ ' + s,
      icon: '👑',
      color: '#c084fc',
      accent: '#f5d0fe',
      borderGlow: 'rgba(192, 132, 252, 0.55)',
      minScore: 28,
      nextTierName: 'Ace',
      nextMinScore: 50,
      progress: Math.min(99, Math.round(((s - 28) / 22) * 100)),
    };
  }
  if (s >= 14 || w >= 4 || rating >= 20) {
    return {
      id: 'honor',
      name: 'Diamond',
      shortName: 'Diamond',
      subTier: 'Diamond I',
      icon: '💎',
      color: '#38bdf8',
      accent: '#bae6fd',
      borderGlow: 'rgba(56, 189, 248, 0.55)',
      minScore: 14,
      nextTierName: 'Crown',
      nextMinScore: 28,
      progress: Math.min(99, Math.round(((s - 14) / 14) * 100)),
    };
  }
  if (s >= 6 || w >= 2 || rating >= 9) {
    return {
      id: 'legend',
      name: 'Gold',
      shortName: 'Gold',
      subTier: 'Gold I',
      icon: '🥇',
      color: '#fbbf24',
      accent: '#fde68a',
      borderGlow: 'rgba(251, 191, 36, 0.45)',
      minScore: 6,
      nextTierName: 'Diamond',
      nextMinScore: 14,
      progress: Math.min(99, Math.round(((s - 6) / 8) * 100)),
    };
  }
  if (s >= 2 || w >= 1 || rating >= 3) {
    return {
      id: 'grandmaster',
      name: 'Silver',
      shortName: 'Silver',
      subTier: 'Silver II',
      icon: '🥈',
      color: '#93c5fd',
      accent: '#dbeafe',
      borderGlow: 'rgba(147, 197, 253, 0.45)',
      minScore: 2,
      nextTierName: 'Gold',
      nextMinScore: 6,
      progress: Math.min(99, Math.round(((s - 2) / 4) * 100)),
    };
  }
  return {
    id: 'warrior',
    name: 'Bronze',
    shortName: 'Bronze',
    subTier: 'Bronze III',
    icon: '🥉',
    color: '#d97706',
    accent: '#fde68a',
    borderGlow: 'rgba(217, 119, 6, 0.35)',
    minScore: 0,
    nextTierName: 'Silver',
    nextMinScore: 2,
    progress: Math.min(99, Math.round((s / 2) * 100)),
  };
}

/**
 * Returns Permata & Kasino Global Title badge for a given leaderboard rank
 */
export function getSupremeTitle(rankNumber, gameType = 'all') {
  const gameLabels = {
    all: 'Global',
    sevens: 'Tujuh Sekop',
    bigtwo: 'Big Two',
    game41: 'Remi 41',
  };
  const label = gameLabels[gameType] || 'Global';

  if (rankNumber === 1) {
    return {
      badge: `ROYAL KING #1`,
      fullTitle: `Royal King #1 ${label}`,
      tier: 'supreme-1',
      icon: '👑',
    };
  }
  if (rankNumber === 2) {
    return {
      badge: `ACE #2`,
      fullTitle: `Ace Master #2 ${label}`,
      tier: 'supreme-2',
      icon: '♠️',
    };
  }
  if (rankNumber === 3) {
    return {
      badge: `ACE #3`,
      fullTitle: `Ace Master #3 ${label}`,
      tier: 'supreme-3',
      icon: '♠️',
    };
  }
  if (rankNumber <= 10) {
    return {
      badge: `CROWN #${rankNumber}`,
      fullTitle: `Top 10 Crown ${label}`,
      tier: 'top-10',
      icon: '💎',
    };
  }
  return {
    badge: `#${rankNumber}`,
    fullTitle: `Top Global ${label}`,
    tier: 'global',
    icon: '🎖️',
  };
}

/**
 * Helper to normalize username key for consistent aggregation across sessions/devices
 */
export function normalizeUsernameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

/**
 * Merges raw leaderboard rows by normalized username (case-insensitive)
 * so using the same username always summarizes wins & total score into one entry.
 */
function aggregateRowsByUsername(rows = [], gameType = 'all') {
  const playerMap = new Map();

  rows.forEach((row) => {
    const cleanName = String(row.player_name || 'Pemain').trim() || 'Pemain';
    const nameKey = normalizeUsernameKey(cleanName) || row.player_id;
    if (!nameKey) return;

    const rowWins = Math.max(0, Number(row.wins || 0));
    const rowGames = Math.max(0, Number(row.games_played || 0));
    const rowScore = Math.max(0, Number(row.score || 0));
    const existing = playerMap.get(nameKey);

    if (!existing) {
      playerMap.set(nameKey, {
        player_id: row.player_id,
        player_ids: [row.player_id].filter(Boolean),
        player_name: cleanName,
        avatar: row.avatar || '👤',
        game_type: gameType === 'all' ? 'all' : (row.game_type || gameType),
        wins: rowWins,
        games_played: rowGames,
        score: rowScore,
        last_played_at: row.last_played_at || new Date().toISOString(),
      });
    } else {
      existing.wins += rowWins;
      existing.games_played += rowGames;
      existing.score += rowScore;
      if (row.player_id && !existing.player_ids.includes(row.player_id)) {
        existing.player_ids.push(row.player_id);
      }
      if (typeof row.avatar === 'string' && row.avatar.startsWith('data:image/')) {
        existing.avatar = row.avatar;
      }
      if (
        row.last_played_at &&
        (!existing.last_played_at || new Date(row.last_played_at) >= new Date(existing.last_played_at))
      ) {
        existing.player_id = row.player_id || existing.player_id;
        existing.player_name = cleanName || existing.player_name;
        if (
          row.avatar &&
          !(
            typeof existing.avatar === 'string' &&
            existing.avatar.startsWith('data:image/') &&
            !String(row.avatar).startsWith('data:image/')
          )
        ) {
          existing.avatar = row.avatar;
        }
        existing.last_played_at = row.last_played_at;
      }
    }
  });

  // Top Global hanya menampilkan akun yang sudah login/terdaftar (punya PIN pada player_id)
  const result = Array.from(playerMap.values()).filter((p) => Boolean(extractPinHashFromItem(p)));
  result.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.score !== a.score) return b.score - a.score;
    return a.games_played - b.games_played;
  });

  return result;
}

/**
 * Fetch Top Global Leaderboard from Supabase
 * @param {'all'|'sevens'|'bigtwo'|'game41'} gameType
 * @param {number} limit
 * @returns {Promise<{ success: boolean, data: Array, tableNotFound?: boolean, error?: string }>}
 */
export async function fetchGlobalLeaderboard(gameType = 'all', limit = 50, forceRefresh = false) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      tableNotFound: false,
      error: 'Supabase belum terkonfigurasi',
      data: getCachedLeaderboard(gameType),
    };
  }

  const normType = gameType || 'all';
  const now = Date.now();
  const cachedEntry = LEADERBOARD_MEM_CACHE.get(normType);
  if (!forceRefresh && cachedEntry && now - cachedEntry.timestamp < 45000) {
    return { success: true, data: cachedEntry.data.slice(0, limit) };
  }

  // If raw rows for 'all' were fetched within the last 45s, derive category leaderboard locally without another DB query!
  const rawAllEntry = LEADERBOARD_MEM_CACHE.get('__raw_all__');
  if (!forceRefresh && rawAllEntry && now - rawAllEntry.timestamp < 45000) {
    const filteredRows =
      normType === 'all'
        ? rawAllEntry.rows
        : rawAllEntry.rows.filter((r) => r.game_type === normType);
    const aggregated = aggregateRowsByUsername(filteredRows, normType);
    LEADERBOARD_MEM_CACHE.set(normType, { timestamp: rawAllEntry.timestamp, data: aggregated });
    cacheLeaderboard(normType, aggregated.slice(0, limit));
    return { success: true, data: aggregated.slice(0, limit) };
  }

  if (!forceRefresh && LEADERBOARD_INFLIGHT.has(normType)) {
    const inflightRes = await LEADERBOARD_INFLIGHT.get(normType);
    return { ...inflightRes, data: (inflightRes.data || []).slice(0, limit) };
  }

  const fetchPromise = (async () => {
    try {
      // Explicit column selection + SQL limit to avoid unbounded full-table scan
      let query = supabase
        .from('leaderboard')
        .select('id, player_id, player_name, avatar, game_type, wins, games_played, score, last_played_at')
        .order('wins', { ascending: false })
        .order('score', { ascending: false })
        .limit(200);

      if (normType !== 'all') {
        query = query.eq('game_type', normType);
      }

      const { data: tableData, error: tableError } = await query;

      if (!tableError && Array.isArray(tableData)) {
        if (normType === 'all') {
          LEADERBOARD_MEM_CACHE.set('__raw_all__', { timestamp: Date.now(), rows: tableData });
        }
        const aggregated = aggregateRowsByUsername(tableData, normType);
        aggregated.forEach((p) => {
          if (p.avatar && (p.avatar.startsWith('data:image/') || p.avatar.startsWith('http'))) {
            cachePlayerAvatar(p.player_name, p.avatar);
          }
        });
        LEADERBOARD_MEM_CACHE.set(normType, { timestamp: Date.now(), data: aggregated });
        cacheLeaderboard(normType, aggregated.slice(0, limit));
        return { success: true, data: aggregated };
      }

      // Fallback to RPC if direct table select had an issue
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_leaderboard', {
        p_game_type: normType,
        p_limit: Math.min(limit, 200),
      });

      if (!rpcError && Array.isArray(rpcData)) {
        const aggregated = aggregateRowsByUsername(rpcData, normType);
        LEADERBOARD_MEM_CACHE.set(normType, { timestamp: Date.now(), data: aggregated });
        cacheLeaderboard(normType, aggregated.slice(0, limit));
        return { success: true, data: aggregated };
      }

      const errToReport = tableError || rpcError;
      const isNotFound =
        errToReport?.code === 'PGRST205' || errToReport?.message?.includes('schema cache');

      return {
        success: false,
        tableNotFound: isNotFound,
        error: errToReport?.message || 'Gagal memuat data Top Global',
        data: getCachedLeaderboard(normType),
      };
    } catch (err) {
      console.warn('[Leaderboard] Error fetching leaderboard:', err);
      return {
        success: false,
        error: err.message,
        data: getCachedLeaderboard(normType),
      };
    } finally {
      LEADERBOARD_INFLIGHT.delete(normType);
    }
  })();

  LEADERBOARD_INFLIGHT.set(normType, fetchPromise);
  const finalRes = await fetchPromise;
  return { ...finalRes, data: (finalRes.data || []).slice(0, limit) };
}

const RECORDED_MATCH_CACHE = new Set();
const RECORDING_INFLIGHT_MAP = new Map();

/**
 * Record player results from a finished multiplayer game
 * (Excludes solo vs bot games and all-bot online rooms to keep global integrity)
 *
 * Rules:
 * - MENANG (wins): Hanya bertambah (+1) jika pemain meraih Juara 1
 * - SKOR (score): Bertambah sesuai jumlah poin yang didapatkan dari permainan tersebut
 * - Menggunakan username yang sama (case-insensitive) akan merangkum statistik ke profil yang sama
 * - Pertandingan Online di mana seluruh lawan adalah Bot (kurang dari 2 pemain manusia) TIDAK masuk Top Global
 */

/**
 * Checks whether a ranking entry represents an AI bot opponent.
 */
export function isBotRankingEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const pObj = entry.player || entry;
  if (Boolean(entry.isBot || pObj?.isBot)) return true;
  const id = String(entry.id || pObj?.id || '').trim().toLowerCase();
  if (id.startsWith('bot_') || id.startsWith('bot-')) return true;
  const name = String(entry.name || pObj?.name || '').trim();
  if (/^bot(\s|$|\d)/i.test(name)) return true;
  return false;
}

/**
 * Returns true only when a match includes at least 2 real human participants
 * (i.e. not a match where all opponents are bots).
 */
export function hasRealHumanOpponent(rankings = []) {
  if (!Array.isArray(rankings) || rankings.length < 2) return false;
  let humanCount = 0;
  for (const r of rankings) {
    if (!isBotRankingEntry(r)) {
      humanCount += 1;
      if (humanCount >= 2) return true;
    }
  }
  return false;
}

/**
 * @param {Object} params
 * @param {string} params.gameType - 'sevens' | 'bigtwo' | 'game41'
 * @param {Array} params.rankings - Array of player results
 * @param {string|Object|Array} params.winnerId
 * @param {boolean} params.isMultiplayer - Only record if multiplayer
 * @param {string} params.myPlayerId - Current client's player ID (prevents duplicate recording across clients)
 * @param {boolean} params.isHost - Whether current client is room host
 * @param {string} params.matchSignature - Unique ID/signature for this finished match
 * @param {string} params.roomCode - Room code
 */
export async function recordMultiplayerGameStats({
  gameType,
  rankings = [],
  winnerId = null,
  isMultiplayer = false,
  myPlayerId = null,
  isHost = false,
  matchSignature = '',
  roomCode = '',
}) {
  if (!isMultiplayer) return { skipped: true, reason: 'not_multiplayer' }; // Only multiplayer counts for Top Global
  if (!rankings || rankings.length < 2) return { skipped: true, reason: 'insufficient_players' };
  if (!hasRealHumanOpponent(rankings)) {
    return { skipped: true, reason: 'bot_only_match' };
  }
  if (!isSupabaseConfigured || !supabase) return { skipped: true, reason: 'supabase_offline' };

  const totalPlayers = rankings.length;
  const resolvedWinnerId =
    winnerId && typeof winnerId === 'object' && !Array.isArray(winnerId)
      ? winnerId.id || winnerId.player?.id
      : winnerId;

  // Deduplication check: prevent multiple recordings of the exact same finished game
  const uniqueSig =
    matchSignature ||
    `${gameType}_${roomCode || 'noroom'}_${resolvedWinnerId || 'nowin'}_${rankings.map((r) => r.id || r.name).sort().join('_')}`;

  if (RECORDED_MATCH_CACHE.has(uniqueSig)) {
    return;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const storedKey = `poker_rec_match_${uniqueSig}`;
      if (localStorage.getItem(storedKey)) {
        RECORDED_MATCH_CACHE.add(uniqueSig);
        return;
      }
      localStorage.setItem(storedKey, '1');
    } catch {}
  }
  RECORDED_MATCH_CACHE.add(uniqueSig);

  if (RECORDING_INFLIGHT_MAP.has(uniqueSig)) {
    return RECORDING_INFLIGHT_MAP.get(uniqueSig);
  }

  const recordingPromise = (async () => {
    try {

  // Normalize rankings from any game engine (Big Two, Game 41, Sevens)
  const normalizedRankings = rankings.map((r, idx) => {
    const pObj = r.player || r;
    const id = r.id || pObj?.id;
    const name = String(r.name || pObj?.name || 'Pemain').trim();
    const avatar = r.avatar || pObj?.avatar || '👤';
    const isBot = isBotRankingEntry(r);
    const isBotTakeover = Boolean(r.isBotTakeover || pObj?.isBotTakeover);
    const rank = r.rank !== undefined ? Number(r.rank) : idx + 1;
    const isDisqualified = Boolean(r.isDisqualified || r.isBusted);

    // Juara 1 determination
    const isFirstPlace = Boolean(
      !isDisqualified &&
        (rank === 1 ||
          r.isWinner === true ||
          (r.rank === undefined &&
            r.isWinner === undefined &&
            (idx === 0 ||
              (resolvedWinnerId && id === resolvedWinnerId) ||
              (Array.isArray(resolvedWinnerId) && resolvedWinnerId.includes(id)))))
    );

    // Points earned in this game (rumus seragam untuk semua game):
    // Poin = Jumlah pemain - Peringkat. Contoh 4 pemain: Juara 1 = 3, Juara 2 = 2, Juara 3 = 1, terakhir = 0.
    // Big Two memakai pointsEarned dari engine (rumus yang sama). Diskualifikasi / gagal tutup kartu = 0.
    let pointsEarned = 0;
    if (isDisqualified) {
      pointsEarned = 0;
    } else if (r.pointsEarned !== undefined) {
      pointsEarned = Math.max(0, Number(r.pointsEarned || 0));
    } else {
      pointsEarned = Math.max(0, totalPlayers - rank);
    }

    return {
      id,
      name,
      avatar,
      isBot,
      isBotTakeover,
      rank,
      isWinner: isFirstPlace,
      pointsEarned,
    };
  });

  // Filter to real human players that THIS client is responsible for recording:
  // - If myPlayerId is provided, record only myPlayerId (plus if isHost, any human under Bot Takeover whose tab may be closed)
  // This guarantees 4 human browsers in a room don't record the same player 4 times!
  const targetPlayers = normalizedRankings.filter((p) => {
    if (p.isBot || !p.id || !p.name) return false;
    if (!myPlayerId) return true;
    if (p.id === myPlayerId) return true;
    if (isHost && p.isBotTakeover) return true;
    return false;
  });

  if (targetPlayers.length === 0) return;

  const localProfile = getLocalPlayerProfile();

  for (const player of targetPlayers) {
    const cleanName = player.name.trim() || 'Pemain';
    const normName = normalizeUsernameKey(cleanName);
    const isWinner = Boolean(player.isWinner);
    const safeScore = Math.max(0, Math.round(Number(player.pointsEarned || 0)));
    const isMe = !myPlayerId || player.id === myPlayerId;
    const myPinHash = isMe && localProfile.pin ? hashProfilePin(cleanName, localProfile.pin) : '';

    try {
      // Check across all game_types if this username already has a PIN lock in `leaderboard`
      const { data: allNameRows } = await supabase
        .from('leaderboard')
        .select('id, player_id, player_name, avatar, wins, games_played, score, game_type')
        .ilike('player_name', cleanName.replace(/[\\%_]/g, (c) => '\\' + c));

      const existingPinHash = extractPinHashFromItem({
        player_ids: (allNameRows || []).map((r) => r.player_id),
      });

      // If this username is PIN-locked by its owner and this client is the player (not a bot takeover),
      // block recording if the local PIN does not match the owner's PIN!
      if (existingPinHash && isMe && !player.isBotTakeover && existingPinHash !== myPinHash) {
        console.warn(`[Leaderboard] Blocked unauthorized score update for PIN-protected user "${cleanName}"`);
        continue;
      }

      // Hanya pemain yang sudah "login" (punya PIN terdaftar) yang masuk Top Global:
      // - Pemain sendiri: wajib punya PIN lokal
      // - Pemain digantikan bot (takeover): hanya jika username-nya sudah terdaftar dengan PIN
      if (isMe && !player.isBotTakeover && !myPinHash) {
        continue;
      }
      if (player.isBotTakeover && !existingPinHash) {
        continue;
      }

      const effectivePinHash = existingPinHash || myPinHash;
      const canonicalPlayerId = effectivePinHash
        ? `user_${normName}__pin_${effectivePinHash}`
        : `user_${normName}`;

      const existingRows = (allNameRows || []).filter((r) => r.game_type === gameType);

      if (Array.isArray(existingRows) && existingRows.length > 0) {
        // Sum across any existing rows for this username and update the primary row
        const primaryRow = existingRows[0];
        const totalExistingWins = existingRows.reduce((acc, r) => acc + Number(r.wins || 0), 0);
        const totalExistingGames = existingRows.reduce((acc, r) => acc + Number(r.games_played || 0), 0);
        const totalExistingScore = existingRows.reduce((acc, r) => acc + Number(r.score || 0), 0);

        await supabase
          .from('leaderboard')
          .update({
            player_id: canonicalPlayerId,
            player_name: cleanName,
            avatar: player.avatar || primaryRow.avatar || '👤',
            wins: totalExistingWins + (isWinner ? 1 : 0),
            games_played: totalExistingGames + 1,
            score: totalExistingScore + safeScore,
            last_played_at: new Date().toISOString(),
          })
          .eq('id', primaryRow.id);

        // If there were duplicate rows for the same username & game_type, remove extras
        if (existingRows.length > 1) {
          for (let i = 1; i < existingRows.length; i++) {
            await supabase
              .from('leaderboard')
              .delete()
              .eq('id', existingRows[i].id);
          }
        }
        continue;
      }

      // 2. Otherwise, insert/upsert with canonicalPlayerId (including PIN hash if set)
      const { error: upsertErr } = await supabase.from('leaderboard').upsert(
        {
          player_id: canonicalPlayerId,
          player_name: cleanName,
          avatar: player.avatar || '👤',
          game_type: gameType,
          wins: isWinner ? 1 : 0,
          games_played: 1,
          score: safeScore,
          last_played_at: new Date().toISOString(),
        },
        { onConflict: 'player_id, game_type' }
      );

      if (upsertErr) {
        // Fallback to RPC if direct upsert fails
        await supabase.rpc('record_game_stats', {
          p_player_id: canonicalPlayerId,
          p_player_name: cleanName,
          p_avatar: player.avatar || '👤',
          p_game_type: gameType,
          p_is_win: isWinner,
          p_score: safeScore,
        });
      }
      invalidateLeaderboardCache();
    } catch (e) {
      console.warn('[Leaderboard] Failed to save player result:', player.name, e);
    }
  }
  } finally {
    RECORDING_INFLIGHT_MAP.delete(uniqueSig);
  }
  })();

  RECORDING_INFLIGHT_MAP.set(uniqueSig, recordingPromise);
  return recordingPromise;
}

/**
 * Local helper caching to prevent empty UI on quick tab switching or network jitter
 */
function cacheLeaderboard(gameType, data) {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_FALLBACK);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[gameType] = {
      updatedAt: Date.now(),
      data,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY_FALLBACK, JSON.stringify(parsed));
  } catch (e) {}
}

function getCachedLeaderboard(gameType) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_FALLBACK);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed[gameType]?.data || [];
  } catch (e) {
    return [];
  }
}
