/**
 * LEADERBOARD SERVICE
 * Manages fetching and recording stats for Top Global Leaderboard across games.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const LOCAL_STORAGE_KEY_FALLBACK = 'poker_global_leaderboard_cache';
const LOCAL_STORAGE_KEY_MY_STATS = 'poker_my_global_stats';

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
    // 1. Try RPC get_global_leaderboard first
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_leaderboard', {
      p_game_type: gameType,
      p_limit: limit,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      cacheLeaderboard(gameType, rpcData);
      return { success: true, data: rpcData };
    }

    // 2. Fallback: Direct table query if RPC is not deployed yet
    let query = supabase.from('leaderboard').select('*');
    if (gameType && gameType !== 'all') {
      query = query.eq('game_type', gameType);
    }

    const { data: tableData, error: tableError } = await query;

    if (tableError) {
      const isNotFound = tableError.code === 'PGRST205' || tableError.message?.includes('schema cache');
      return {
        success: false,
        tableNotFound: isNotFound,
        error: tableError.message,
        data: getCachedLeaderboard(gameType),
      };
    }

    // Process and sort table data
    let processedData = [];
    if (gameType === 'all') {
      const playerMap = new Map();
      tableData.forEach((row) => {
        const existing = playerMap.get(row.player_id);
        if (!existing) {
          playerMap.set(row.player_id, {
            player_id: row.player_id,
            player_name: row.player_name,
            avatar: row.avatar || '👤',
            game_type: 'all',
            wins: Number(row.wins || 0),
            games_played: Number(row.games_played || 0),
            score: Number(row.score || 0),
            last_played_at: row.last_played_at,
          });
        } else {
          existing.wins += Number(row.wins || 0);
          existing.games_played += Number(row.games_played || 0);
          existing.score += Number(row.score || 0);
          if (new Date(row.last_played_at) > new Date(existing.last_played_at)) {
            existing.player_name = row.player_name;
            existing.avatar = row.avatar || existing.avatar;
            existing.last_played_at = row.last_played_at;
          }
        }
      });
      processedData = Array.from(playerMap.values());
    } else {
      processedData = tableData.map((row) => ({
        player_id: row.player_id,
        player_name: row.player_name,
        avatar: row.avatar || '👤',
        game_type: row.game_type,
        wins: Number(row.wins || 0),
        games_played: Number(row.games_played || 0),
        score: Number(row.score || 0),
        last_played_at: row.last_played_at,
      }));
    }

    processedData.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.score !== a.score) return b.score - a.score;
      return a.games_played - b.games_played;
    });

    const sliced = processedData.slice(0, limit);
    cacheLeaderboard(gameType, sliced);
    return { success: true, data: sliced };
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
 * @param {Object} params
 * @param {string} params.gameType - 'sevens' | 'bigtwo' | 'game41'
 * @param {Array} params.rankings - Array of player results [{ id, name, avatar, score, isWinner }]
 * @param {string|Array} params.winnerId
 * @param {boolean} params.isMultiplayer - Only record if multiplayer
 */
export async function recordMultiplayerGameStats({
  gameType,
  rankings = [],
  winnerId = null,
  isMultiplayer = false,
}) {
  if (!isMultiplayer) return; // Only multiplayer counts for Top Global
  if (!rankings || rankings.length < 2) return;
  if (!isSupabaseConfigured || !supabase) return;

  const realPlayers = rankings.filter((p) => !p.isBot && !p.name?.startsWith('Bot '));
  if (realPlayers.length === 0) return;

  for (const player of realPlayers) {
    if (!player.id) continue;

    const isWinner = Boolean(
      player.isWinner ||
      player.id === winnerId ||
      (Array.isArray(winnerId) && winnerId.includes(player.id)) ||
      (typeof winnerId === 'string' && winnerId.split(',').map((s) => s.trim()).includes(player.id))
    );

    const safeScore = Math.max(0, Number(player.score || 0));

    try {
      // Try RPC first
      const { error: rpcErr } = await supabase.rpc('record_game_stats', {
        p_player_id: player.id,
        p_player_name: player.name || 'Pemain',
        p_avatar: player.avatar || '👤',
        p_game_type: gameType,
        p_is_win: isWinner,
        p_score: safeScore,
      });

      if (rpcErr) {
        // Fallback: Direct Upsert
        const { data: existing } = await supabase
          .from('leaderboard')
          .select('wins, games_played, score')
          .eq('player_id', player.id)
          .eq('game_type', gameType)
          .maybeSingle();

        const newWins = (existing?.wins || 0) + (isWinner ? 1 : 0);
        const newGames = (existing?.games_played || 0) + 1;
        const newScore = (existing?.score || 0) + safeScore;

        await supabase.from('leaderboard').upsert({
          player_id: player.id,
          player_name: player.name || 'Pemain',
          avatar: player.avatar || '👤',
          game_type: gameType,
          wins: newWins,
          games_played: newGames,
          score: newScore,
          last_played_at: new Date().toISOString(),
        }, { onConflict: 'player_id, game_type' });
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
