/**
 * LEADERBOARD SERVICE
 * Manages fetching and recording stats for Top Global Leaderboard across games.
 * - MENANG (wins): Diambil dari jumlah kemenangan Juara 1
 * - SKOR (score): Total akumulasi poin yang didapatkan dari keseluruhan permainan
 * - Akumulasi berdasarkan Username yang sama (case-insensitive)
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const LOCAL_STORAGE_KEY_FALLBACK = 'poker_global_leaderboard_cache';

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
