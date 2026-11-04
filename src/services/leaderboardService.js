/**
 * LEADERBOARD SERVICE
 * Manages fetching and recording stats for Top Global Leaderboard across games.
 * - MENANG (wins): Diambil dari jumlah kemenangan Juara 1
 * - SKOR (score): Total akumulasi poin yang didapatkan dari keseluruhan permainan
 * - Akumulasi berdasarkan Username yang sama (case-insensitive)
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const LOCAL_STORAGE_KEY_FALLBACK = 'poker_global_leaderboard_cache';
const STORAGE_PLAYER_NAME = 'sevens_player_name';
const STORAGE_PLAYER_AVATAR = 'sevens_player_avatar';

export const PROFILE_AVATARS = [
  '👑', '🐉', '🦁', '🦊', '🐼', '🐯', '🥷', '🧙‍♂️', '🧛', '⚡', '🔥', '💎', '👤', '🐨'
];

/**
 * Get saved local player profile (username & avatar)
 */
export function getLocalPlayerProfile() {
  if (typeof localStorage === 'undefined') {
    return { name: '', avatar: '👑' };
  }
  return {
    name: localStorage.getItem(STORAGE_PLAYER_NAME) || '',
    avatar: localStorage.getItem(STORAGE_PLAYER_AVATAR) || '👑',
  };
}

/**
 * Save local player profile (username & avatar) to localStorage
 */
export function saveLocalPlayerProfile({ name, avatar }) {
  if (typeof localStorage === 'undefined') return;
  if (typeof name === 'string') {
    const clean = name.trim();
    if (clean) {
      localStorage.setItem(STORAGE_PLAYER_NAME, clean);
    }
  }
  if (avatar) {
    localStorage.setItem(STORAGE_PLAYER_AVATAR, avatar);
  }
}

/**
 * Mobile Legends: Bang Bang (MLBB) inspired Rank Tier calculator
 * Computed from player's accumulated Global Score (points) and Wins (Juara 1).
 */
export function getPlayerRankTier(score = 0, wins = 0) {
  const s = Math.max(0, Number(score || 0));
  const w = Math.max(0, Number(wins || 0));
  // Effective rating combines score + bonus weight for 1st place wins
  const rating = s + w * 2;

  if (s >= 100 || w >= 25 || rating >= 140) {
    return {
      id: 'immortal',
      name: 'Mythical Immortal',
      shortName: 'Immortal',
      subTier: 'Supreme ★ ' + s,
      icon: '🐦‍🔥',
      color: '#ff4d4d',
      accent: '#fde047',
      borderGlow: 'rgba(239, 68, 68, 0.65)',
      minScore: 100,
      nextTierName: null,
      nextMinScore: null,
      progress: 100,
    };
  }
  if (s >= 60 || w >= 15 || rating >= 85) {
    return {
      id: 'glory',
      name: 'Mythical Glory',
      shortName: 'Glory',
      subTier: 'Glory ★ ' + s,
      icon: '👑',
      color: '#f59e0b',
      accent: '#fef08a',
      borderGlow: 'rgba(245, 158, 11, 0.6)',
      minScore: 60,
      nextTierName: 'Mythical Immortal',
      nextMinScore: 100,
      progress: Math.min(99, Math.round(((s - 60) / 40) * 100)),
    };
  }
  if (s >= 35 || w >= 9 || rating >= 50) {
    return {
      id: 'honor',
      name: 'Mythical Honor',
      shortName: 'Honor',
      subTier: 'Honor ★ ' + s,
      icon: '💠',
      color: '#38bdf8',
      accent: '#bae6fd',
      borderGlow: 'rgba(56, 189, 248, 0.55)',
      minScore: 35,
      nextTierName: 'Mythical Glory',
      nextMinScore: 60,
      progress: Math.min(99, Math.round(((s - 35) / 25) * 100)),
    };
  }
  if (s >= 20 || w >= 5 || rating >= 30) {
    return {
      id: 'mythic',
      name: 'Mythic',
      shortName: 'Mythic',
      subTier: 'Mythic ★ ' + s,
      icon: '🔮',
      color: '#c084fc',
      accent: '#f5d0fe',
      borderGlow: 'rgba(192, 132, 252, 0.55)',
      minScore: 20,
      nextTierName: 'Mythical Honor',
      nextMinScore: 35,
      progress: Math.min(99, Math.round(((s - 20) / 15) * 100)),
    };
  }
  if (s >= 12 || w >= 3 || rating >= 18) {
    return {
      id: 'legend',
      name: 'Legend',
      shortName: 'Legend',
      subTier: 'Legend I',
      icon: '🦁',
      color: '#fbbf24',
      accent: '#fde68a',
      borderGlow: 'rgba(251, 191, 36, 0.45)',
      minScore: 12,
      nextTierName: 'Mythic',
      nextMinScore: 20,
      progress: Math.min(99, Math.round(((s - 12) / 8) * 100)),
    };
  }
  if (s >= 6 || w >= 2 || rating >= 9) {
    return {
      id: 'epic',
      name: 'Epic',
      shortName: 'Epic',
      subTier: 'Epic II',
      icon: '🦏',
      color: '#10b981',
      accent: '#6ee7b7',
      borderGlow: 'rgba(16, 185, 129, 0.45)',
      minScore: 6,
      nextTierName: 'Legend',
      nextMinScore: 12,
      progress: Math.min(99, Math.round(((s - 6) / 6) * 100)),
    };
  }
  if (s >= 2 || w >= 1 || rating >= 3) {
    return {
      id: 'grandmaster',
      name: 'Grandmaster',
      shortName: 'Grandmaster',
      subTier: 'GM III',
      icon: '⚔️',
      color: '#60a5fa',
      accent: '#bfdbfe',
      borderGlow: 'rgba(96, 165, 250, 0.4)',
      minScore: 2,
      nextTierName: 'Epic',
      nextMinScore: 6,
      progress: Math.min(99, Math.round(((s - 2) / 4) * 100)),
    };
  }
  return {
    id: 'warrior',
    name: 'Warrior',
    shortName: 'Warrior',
    subTier: 'Warrior III',
    icon: '🛡️',
    color: '#94a3b8',
    accent: '#e2e8f0',
    borderGlow: 'rgba(148, 163, 184, 0.3)',
    minScore: 0,
    nextTierName: 'Grandmaster',
    nextMinScore: 2,
    progress: Math.min(99, Math.round((s / 2) * 100)),
  };
}

/**
 * Returns MLBB-style Supreme / Global Title badge for a given leaderboard rank
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
      badge: `SUPREME #1`,
      fullTitle: `Supreme No.1 ${label}`,
      tier: 'supreme-1',
      icon: '👑',
    };
  }
  if (rankNumber === 2) {
    return {
      badge: `SUPREME #2`,
      fullTitle: `Supreme No.2 ${label}`,
      tier: 'supreme-2',
      icon: '⚜️',
    };
  }
  if (rankNumber === 3) {
    return {
      badge: `SUPREME #3`,
      fullTitle: `Supreme No.3 ${label}`,
      tier: 'supreme-3',
      icon: '⚜️',
    };
  }
  if (rankNumber <= 10) {
    return {
      badge: `TOP #${rankNumber}`,
      fullTitle: `Top 10 ${label}`,
      tier: 'top-10',
      icon: '🏅',
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
      if (
        row.last_played_at &&
        (!existing.last_played_at || new Date(row.last_played_at) >= new Date(existing.last_played_at))
      ) {
        existing.player_id = row.player_id || existing.player_id;
        existing.player_name = cleanName || existing.player_name;
        existing.avatar = row.avatar || existing.avatar;
        existing.last_played_at = row.last_played_at;
      }
    }
  });

  const result = Array.from(playerMap.values());
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
export async function fetchGlobalLeaderboard(gameType = 'all', limit = 50) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      tableNotFound: false,
      error: 'Supabase belum terkonfigurasi',
      data: getCachedLeaderboard(gameType),
    };
  }

  try {
    // Query table directly so we can aggregate rows by username
    let query = supabase.from('leaderboard').select('*');
    if (gameType && gameType !== 'all') {
      query = query.eq('game_type', gameType);
    }

    const { data: tableData, error: tableError } = await query;

    if (!tableError && Array.isArray(tableData)) {
      const aggregated = aggregateRowsByUsername(tableData, gameType).slice(0, limit);
      cacheLeaderboard(gameType, aggregated);
      return { success: true, data: aggregated };
    }

    // Fallback to RPC if direct table select had an issue
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_leaderboard', {
      p_game_type: gameType,
      p_limit: limit,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      const aggregated = aggregateRowsByUsername(rpcData, gameType).slice(0, limit);
      cacheLeaderboard(gameType, aggregated);
      return { success: true, data: aggregated };
    }

    const errToReport = tableError || rpcError;
    const isNotFound =
      errToReport?.code === 'PGRST205' || errToReport?.message?.includes('schema cache');

    return {
      success: false,
      tableNotFound: isNotFound,
      error: errToReport?.message || 'Gagal memuat data Top Global',
      data: getCachedLeaderboard(gameType),
    };
  } catch (err) {
    console.warn('[Leaderboard] Error fetching leaderboard:', err);
    return {
      success: false,
      error: err.message,
      data: getCachedLeaderboard(gameType),
    };
  }
}

/**
 * Record player results from a finished multiplayer game
 * (Excludes solo vs bot games to keep global integrity)
 *
 * Rules:
 * - MENANG (wins): Hanya bertambah (+1) jika pemain meraih Juara 1
 * - SKOR (score): Bertambah sesuai jumlah poin yang didapatkan dari permainan tersebut
 * - Menggunakan username yang sama (case-insensitive) akan merangkum statistik ke profil yang sama
 *
 * @param {Object} params
 * @param {string} params.gameType - 'sevens' | 'bigtwo' | 'game41'
 * @param {Array} params.rankings - Array of player results
 * @param {string|Object|Array} params.winnerId
 * @param {boolean} params.isMultiplayer - Only record if multiplayer
 * @param {string} params.myPlayerId - Current client's player ID (prevents duplicate recording across clients)
 * @param {boolean} params.isHost - Whether current client is room host
 */
export async function recordMultiplayerGameStats({
  gameType,
  rankings = [],
  winnerId = null,
  isMultiplayer = false,
  myPlayerId = null,
  isHost = false,
}) {
  if (!isMultiplayer) return; // Only multiplayer counts for Top Global
  if (!rankings || rankings.length < 2) return;
  if (!isSupabaseConfigured || !supabase) return;

  const totalPlayers = rankings.length;
  const resolvedWinnerId =
    winnerId && typeof winnerId === 'object' && !Array.isArray(winnerId)
      ? winnerId.id || winnerId.player?.id
      : winnerId;

  // Normalize rankings from any game engine (Big Two, Game 41, Sevens)
  const normalizedRankings = rankings.map((r, idx) => {
    const pObj = r.player || r;
    const id = r.id || pObj?.id;
    const name = String(r.name || pObj?.name || 'Pemain').trim();
    const avatar = r.avatar || pObj?.avatar || '👤';
    const isBot = Boolean(r.isBot || pObj?.isBot || name.startsWith('Bot '));
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

  for (const player of targetPlayers) {
    const cleanName = player.name.trim() || 'Pemain';
    const isWinner = Boolean(player.isWinner);
    const safeScore = Math.max(0, Math.round(Number(player.pointsEarned || 0)));

    try {
      // 1. Check if there is already a row in `leaderboard` for this username (case-insensitive) & gameType
      const { data: existingRows, error: selectErr } = await supabase
        .from('leaderboard')
        .select('id, player_id, player_name, avatar, wins, games_played, score')
        .eq('game_type', gameType)
        .ilike('player_name', cleanName.replace(/[\\%_]/g, (c) => '\\' + c));

      if (!selectErr && Array.isArray(existingRows) && existingRows.length > 0) {
        // Sum across any existing rows for this username and update the primary row
        const primaryRow = existingRows[0];
        const totalExistingWins = existingRows.reduce((acc, r) => acc + Number(r.wins || 0), 0);
        const totalExistingGames = existingRows.reduce((acc, r) => acc + Number(r.games_played || 0), 0);
        const totalExistingScore = existingRows.reduce((acc, r) => acc + Number(r.score || 0), 0);

        await supabase
          .from('leaderboard')
          .update({
            player_name: cleanName,
            avatar: player.avatar || primaryRow.avatar || '👤',
            wins: totalExistingWins + (isWinner ? 1 : 0),
            games_played: totalExistingGames + 1,
            score: totalExistingScore + safeScore,
            last_played_at: new Date().toISOString(),
          })
          .eq('player_id', primaryRow.player_id)
          .eq('game_type', gameType);

        // If there were duplicate rows for the same username & game_type, remove extras
        if (existingRows.length > 1) {
          for (let i = 1; i < existingRows.length; i++) {
            await supabase
              .from('leaderboard')
              .delete()
              .eq('player_id', existingRows[i].player_id)
              .eq('game_type', gameType);
          }
        }
        continue;
      }

      // 2. Otherwise, use deterministic username-based player_id so future sessions with same username merge cleanly
      const canonicalPlayerId = `user_${normalizeUsernameKey(cleanName)}`;

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
    } catch (e) {
      console.warn('[Leaderboard] Failed to save player result:', player.name, e);
    }
  }
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
