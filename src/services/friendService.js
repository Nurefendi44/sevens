/**
 * FRIEND SERVICE (FITUR PERTEMANAN & SOSIAL ROYAL CARDS)
 * Mengelola daftar pertemanan, permintaan pertemanan (pending/acc),
 * pencarian profil pemain, sinkronisasi realtime, dan notifikasi mabar.
 */

import { normalizeUsernameKey, getPlayerRankTier } from './leaderboardService';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { audio } from './audioService';

const FRIENDS_PREFIX = 'royal_cards_friends_v1_';
const REQ_IN_PREFIX = 'royal_cards_friend_reqs_in_v1_';
const REQ_OUT_PREFIX = 'royal_cards_friend_reqs_out_v1_';
const RESPECT_PREFIX = 'royal_cards_friend_respect_v1_';

let socialChannel = null;
let broadcastChannel = null;
const friendSubscribers = new Set();

// Inisialisasi BroadcastChannel untuk tab yang sama di browser
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('royal_cards_social_bc');
    broadcastChannel.onmessage = (event) => {
      const data = event?.data;
      if (data && data.type) {
        handleIncomingSocialEvent(data);
      }
    };
  }

  // Sinkronisasi lintas tab saat localStorage diperbarui
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (
        e.key &&
        (e.key.startsWith(FRIENDS_PREFIX) ||
          e.key.startsWith(REQ_IN_PREFIX) ||
          e.key.startsWith(REQ_OUT_PREFIX))
      ) {
        handleIncomingSocialEvent({ type: 'local_storage_sync' });
      }
    });
  }
} catch (e) {
  // Ignore
}

/**
 * Tangani event sosial yang masuk (baik dari Supabase maupun BroadcastChannel)
 */
function handleIncomingSocialEvent(eventPayload) {
  friendSubscribers.forEach((cb) => {
    try {
      cb(eventPayload);
    } catch (err) {
      console.warn('[FriendService] subscriber error:', err);
    }
  });
}

/**
 * Ambil daftar teman yang sudah di-accept
 */
export function getFriendsList(username) {
  if (typeof localStorage === 'undefined' || !username) return [];
  const norm = normalizeUsernameKey(username);
  if (!norm) return [];

  try {
    const raw = localStorage.getItem(`${FRIENDS_PREFIX}${norm}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Deduplikasi berdasarkan nama
      const seen = new Set();
      return parsed.filter((f) => {
        if (!f || !f.name) return false;
        const k = normalizeUsernameKey(f.name);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  } catch (e) {
    // Ignore error
  }
  return [];
}

/**
 * Cek apakah sudah berteman
 */
export function isFriend(myUsername, targetUsername) {
  if (!myUsername || !targetUsername) return false;
  const targetNorm = normalizeUsernameKey(targetUsername);
  const friends = getFriendsList(myUsername);
  return friends.some((f) => normalizeUsernameKey(f.name) === targetNorm);
}

/**
 * Ambil daftar permintaan pertemanan MASUK (Incoming)
 */
export function getIncomingFriendRequests(username) {
  if (typeof localStorage === 'undefined' || !username) return [];
  const norm = normalizeUsernameKey(username);
  if (!norm) return [];

  try {
    const raw = localStorage.getItem(`${REQ_IN_PREFIX}${norm}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const friends = getFriendsList(username);
      const friendKeys = new Set(friends.map((f) => normalizeUsernameKey(f.name)));
      const seen = new Set();
      return parsed.filter((r) => {
        if (!r || !r.name) return false;
        const k = normalizeUsernameKey(r.name);
        // Jika sudah berteman, otomatis jangan tampilkan di permintaan
        if (friendKeys.has(k)) return false;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  } catch (e) {
    // Ignore error
  }
  return [];
}

/**
 * Ambil daftar permintaan pertemanan KELUAR (Outgoing / Menunggu ACC)
 */
export function getSentFriendRequests(username) {
  if (typeof localStorage === 'undefined' || !username) return [];
  const norm = normalizeUsernameKey(username);
  if (!norm) return [];

  try {
    const raw = localStorage.getItem(`${REQ_OUT_PREFIX}${norm}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const friends = getFriendsList(username);
      const friendKeys = new Set(friends.map((f) => normalizeUsernameKey(f.name)));
      const seen = new Set();
      return parsed.filter((r) => {
        if (!r || !r.name) return false;
        const k = normalizeUsernameKey(r.name);
        // Jika sudah berteman, otomatis jangan tampilkan di pending outgoing
        if (friendKeys.has(k)) return false;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  } catch (e) {
    // Ignore error
  }
  return [];
}

/**
 * Cek apakah ada permintaan pertemanan gantung (baik masuk maupun keluar)
 */
export function getFriendshipStatus(myUsername, targetUsername) {
  if (!myUsername || !targetUsername) return 'none';
  const myNorm = normalizeUsernameKey(myUsername);
  const targetNorm = normalizeUsernameKey(targetUsername);
  if (myNorm === targetNorm) return 'self';

  if (isFriend(myUsername, targetUsername)) return 'friend';

  const outList = getSentFriendRequests(myUsername);
  if (outList.some((r) => normalizeUsernameKey(r.name) === targetNorm)) {
    return 'pending_outgoing'; // Sedang menunggu di-acc oleh target
  }

  const inList = getIncomingFriendRequests(myUsername);
  if (inList.some((r) => normalizeUsernameKey(r.name) === targetNorm)) {
    return 'pending_incoming'; // Target meminta pertemanan, kita tinggal acc
  }

  return 'none';
}

/**
 * Cari profil pemain berdasarkan username (leaderboard Supabase / cache lokal)
 */
export async function lookupPlayerByUsername(query) {
  const clean = String(query || '').trim();
  if (!clean) return { found: false, results: [] };

  const sanitized = clean.replace(/[\\%_]/g, (c) => '\\' + c);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('player_name, avatar, score, wins')
        .ilike('player_name', `%${sanitized}%`)
        .limit(8);

      if (!error && Array.isArray(data) && data.length > 0) {
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
        const results = Array.from(map.values());
        return { found: true, results };
      }
    } catch (e) {
      console.warn('[FriendService] lookup error:', e);
    }
  }

  return { found: false, results: [] };
}

/**
 * Tambahkan teman langsung ke storage (internal helper)
 */
export function addFriend(myUsername, friendObj) {
  if (!myUsername || !friendObj || !friendObj.name) {
    return { success: false, error: 'Data teman tidak valid.' };
  }
  const myNorm = normalizeUsernameKey(myUsername);
  const targetNorm = normalizeUsernameKey(friendObj.name);

  if (myNorm === targetNorm) {
    return { success: false, error: 'Tidak dapat menambahkan diri sendiri sebagai teman.' };
  }

  const existingList = getFriendsList(myUsername);
  if (existingList.some((f) => normalizeUsernameKey(f.name) === targetNorm)) {
    return { success: true, friends: existingList, alreadyFriend: true };
  }

  const tier = friendObj.tier || getPlayerRankTier(friendObj.score || 0, friendObj.wins || 0);

  const newFriend = {
    name: friendObj.name.trim(),
    avatar: friendObj.avatar || '👤',
    tier: tier || {
      id: 'warrior',
      name: 'Bronze',
      shortName: 'Bronze',
      icon: '🥉',
      color: '#d97706',
      accent: '#fde68a',
    },
    score: Number(friendObj.score || 0),
    wins: Number(friendObj.wins || 0),
    addedAt: Date.now(),
  };

  const updated = [newFriend, ...existingList];
  try {
    localStorage.setItem(`${FRIENDS_PREFIX}${myNorm}`, JSON.stringify(updated));
  } catch (e) {
    // Ignore error
  }

  // Bersihkan dari pending incoming dan outgoing jika ada
  cleanPendingRequests(myNorm, targetNorm);

  return { success: true, friends: updated };
}

/**
 * Hapus pending request internal
 */
function cleanPendingRequests(myNorm, targetNorm) {
  try {
    const inList = getIncomingFriendRequests(myNorm).filter(
      (r) => normalizeUsernameKey(r.name) !== targetNorm
    );
    localStorage.setItem(`${REQ_IN_PREFIX}${myNorm}`, JSON.stringify(inList));

    const outList = getSentFriendRequests(myNorm).filter(
      (r) => normalizeUsernameKey(r.name) !== targetNorm
    );
    localStorage.setItem(`${REQ_OUT_PREFIX}${myNorm}`, JSON.stringify(outList));
  } catch {}
}

/**
 * Kirim Permintaan Pertemanan (Add Friend Request - Harus di-ACC)
 */
export async function sendFriendRequest(myUsername, myProfile, targetUser) {
  if (!myUsername || !targetUser?.name) {
    return { success: false, error: 'Data pemain tidak lengkap.' };
  }

  const myNorm = normalizeUsernameKey(myUsername);
  const targetNorm = normalizeUsernameKey(targetUser.name);

  if (myNorm === targetNorm) {
    return { success: false, error: 'Kamu tidak dapat mengirim pertemanan ke diri sendiri.' };
  }

  if (isFriend(myUsername, targetUser.name)) {
    return { success: false, error: 'Kamu sudah berteman dengan pemain ini.' };
  }

  // Simpan di outgoing requests pengirim
  const outList = getSentFriendRequests(myUsername);
  if (!outList.some((r) => normalizeUsernameKey(r.name) === targetNorm)) {
    const outItem = {
      name: targetUser.name.trim(),
      avatar: targetUser.avatar || '👤',
      tier: targetUser.tier || null,
      score: targetUser.score || 0,
      wins: targetUser.wins || 0,
      sentAt: Date.now(),
    };
    try {
      localStorage.setItem(`${REQ_OUT_PREFIX}${myNorm}`, JSON.stringify([outItem, ...outList]));
    } catch {}
  }

  // Simpan juga di target incoming request lokal (untuk multi-profil / browser yang sama)
  try {
    const targetInList = getIncomingFriendRequests(targetNorm);
    if (!targetInList.some((r) => normalizeUsernameKey(r.name) === myNorm)) {
      const inItem = {
        name: myUsername.trim(),
        avatar: myProfile?.avatar || '👑',
        tier: myProfile?.tier || null,
        score: myProfile?.score || 0,
        wins: myProfile?.wins || 0,
        sentAt: Date.now(),
      };
      localStorage.setItem(`${REQ_IN_PREFIX}${targetNorm}`, JSON.stringify([inItem, ...targetInList]));
    }
  } catch {}

  const payload = {
    id: `freq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'friend_request_send',
    from: myUsername.trim(),
    to: targetUser.name.trim(),
    senderProfile: {
      name: myUsername.trim(),
      avatar: myProfile?.avatar || '👑',
      tier: myProfile?.tier || null,
      score: myProfile?.score || 0,
      wins: myProfile?.wins || 0,
    },
    targetProfile: {
      name: targetUser.name.trim(),
      avatar: targetUser.avatar || '👤',
    },
    timestamp: Date.now(),
  };

  // Broadcast via BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {}
  }

  // Broadcast via Supabase Realtime
  if (isSupabaseConfigured && supabase) {
    try {
      initSocialChannel();
      if (socialChannel) {
        await socialChannel.send({
          type: 'broadcast',
          event: 'social_event',
          payload,
        });
      }
    } catch (e) {
      console.warn('[FriendService] broadcast sendFriendRequest warning:', e);
    }
  }

  return { success: true };
}

/**
 * Batalkan Permintaan Pertemanan yang sudah terkirim (Cancel pending request)
 */
export function cancelFriendRequest(myUsername, targetUsername) {
  if (!myUsername || !targetUsername) return { success: false };
  const myNorm = normalizeUsernameKey(myUsername);
  const targetNorm = normalizeUsernameKey(targetUsername);

  try {
    const outList = getSentFriendRequests(myUsername).filter(
      (r) => normalizeUsernameKey(r.name) !== targetNorm
    );
    localStorage.setItem(`${REQ_OUT_PREFIX}${myNorm}`, JSON.stringify(outList));

    const targetInList = getIncomingFriendRequests(targetNorm).filter(
      (r) => normalizeUsernameKey(r.name) !== myNorm
    );
    localStorage.setItem(`${REQ_IN_PREFIX}${targetNorm}`, JSON.stringify(targetInList));
  } catch {}

  return { success: true };
}

/**
 * Terima Permintaan Pertemanan (Accept Request)
 */
export async function acceptFriendRequest(myUsername, myProfile, targetSender) {
  if (!myUsername || !targetSender?.name) {
    return { success: false, error: 'Data permintaan tidak valid.' };
  }

  const myNorm = normalizeUsernameKey(myUsername);
  const targetNorm = normalizeUsernameKey(targetSender.name);

  // 1. Tambahkan target ke daftar teman penerima
  addFriend(myUsername, targetSender);

  // 2. Tambahkan penerima ke daftar teman target pengirim (di storage lokal jika satu device)
  try {
    addFriend(targetSender.name, {
      name: myUsername,
      avatar: myProfile?.avatar || '👑',
      tier: myProfile?.tier || null,
      score: myProfile?.score || 0,
      wins: myProfile?.wins || 0,
    });
  } catch {}

  // 3. Bersihkan pending request dari kedua belah pihak
  cleanPendingRequests(myNorm, targetNorm);
  cleanPendingRequests(targetNorm, myNorm);

  const payload = {
    id: `facc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'friend_request_accept',
    from: myUsername.trim(),
    to: targetSender.name.trim(),
    accepterProfile: {
      name: myUsername.trim(),
      avatar: myProfile?.avatar || '👑',
      tier: myProfile?.tier || null,
      score: myProfile?.score || 0,
      wins: myProfile?.wins || 0,
    },
    timestamp: Date.now(),
  };

  try {
    audio.playVictorySound?.();
  } catch {}

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {}
  }

  if (isSupabaseConfigured && supabase) {
    try {
      initSocialChannel();
      if (socialChannel) {
        await socialChannel.send({
          type: 'broadcast',
          event: 'social_event',
          payload,
        });
      }
    } catch (e) {
      console.warn('[FriendService] broadcast acceptFriendRequest warning:', e);
    }
  }

  return { success: true, friends: getFriendsList(myUsername) };
}

/**
 * Tolak Permintaan Pertemanan (Reject Request)
 */
export async function rejectFriendRequest(myUsername, targetUsername) {
  if (!myUsername || !targetUsername) return { success: false };
  const myNorm = normalizeUsernameKey(myUsername);
  const targetNorm = normalizeUsernameKey(targetUsername);

  try {
    const inList = getIncomingFriendRequests(myUsername).filter(
      (r) => normalizeUsernameKey(r.name) !== targetNorm
    );
    localStorage.setItem(`${REQ_IN_PREFIX}${myNorm}`, JSON.stringify(inList));

    const targetOutList = getSentFriendRequests(targetNorm).filter(
      (r) => normalizeUsernameKey(r.name) !== myNorm
    );
    localStorage.setItem(`${REQ_OUT_PREFIX}${targetNorm}`, JSON.stringify(targetOutList));
  } catch {}

  const payload = {
    id: `frej_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'friend_request_reject',
    from: myUsername.trim(),
    to: targetUsername.trim(),
    timestamp: Date.now(),
  };

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {}
  }

  if (isSupabaseConfigured && supabase) {
    try {
      initSocialChannel();
      if (socialChannel) {
        await socialChannel.send({
          type: 'broadcast',
          event: 'social_event',
          payload,
        });
      }
    } catch {}
  }

  return { success: true, incomingRequests: getIncomingFriendRequests(myUsername) };
}

/**
 * Hapus Teman dari daftar (Unfriend)
 */
export function removeFriend(myUsername, targetUsername) {
  if (!myUsername || !targetUsername) return { success: false };
  const myNorm = normalizeUsernameKey(myUsername);
  const targetNorm = normalizeUsernameKey(targetUsername);

  const existingList = getFriendsList(myUsername);
  const updated = existingList.filter((f) => normalizeUsernameKey(f.name) !== targetNorm);

  try {
    localStorage.setItem(`${FRIENDS_PREFIX}${myNorm}`, JSON.stringify(updated));
  } catch (e) {
    // Ignore error
  }

  // Hapus juga di sisi target jika satu perangkat
  try {
    const targetExisting = getFriendsList(targetUsername);
    const targetUpdated = targetExisting.filter((f) => normalizeUsernameKey(f.name) !== myNorm);
    localStorage.setItem(`${FRIENDS_PREFIX}${targetNorm}`, JSON.stringify(targetUpdated));
  } catch {}

  const payload = {
    id: `frem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'friend_remove',
    from: myUsername.trim(),
    to: targetUsername.trim(),
    timestamp: Date.now(),
  };

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {}
  }

  if (isSupabaseConfigured && supabase) {
    try {
      initSocialChannel();
      if (socialChannel) {
        socialChannel.send({
          type: 'broadcast',
          event: 'social_event',
          payload,
        });
      }
    } catch {}
  }

  return { success: true, friends: updated };
}

/**
 * Kirim Respect / Apresiasi GG ke Teman (Fitur Interaksi Sosial)
 */
export function sendFriendRespect(myUsername, targetUsername, emoji = '🔥') {
  if (!myUsername || !targetUsername) return { success: false };
  const myNorm = normalizeUsernameKey(myUsername);
  const targetNorm = normalizeUsernameKey(targetUsername);

  const todayKey = `${RESPECT_PREFIX}${myNorm}_${targetNorm}_${new Date().toDateString()}`;
  if (typeof localStorage !== 'undefined' && localStorage.getItem(todayKey)) {
    return { success: false, alreadyGiven: true, message: 'Kamu sudah memberi respect ke teman ini hari ini!' };
  }

  try {
    localStorage.setItem(todayKey, 'true');
  } catch {}

  const payload = {
    id: `frespect_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'friend_respect',
    from: myUsername.trim(),
    to: targetUsername.trim(),
    emoji,
    message: `${myUsername} mengirimkan energi respect ${emoji} ke kamu!`,
    timestamp: Date.now(),
  };

  try {
    audio.playChatPopSound?.();
  } catch {}

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {}
  }

  if (isSupabaseConfigured && supabase) {
    try {
      initSocialChannel();
      if (socialChannel) {
        socialChannel.send({
          type: 'broadcast',
          event: 'social_event',
          payload,
        });
      }
    } catch {}
  }

  return { success: true, message: `Respect ${emoji} berhasil dikirim ke ${targetUsername}!` };
}

/**
 * Inisialisasi kanal Supabase Realtime untuk event sosial
 */
function initSocialChannel() {
  if (!socialChannel && isSupabaseConfigured && supabase) {
    socialChannel = supabase.channel('global_social_events', {
      config: {
        broadcast: { self: false },
      },
    });

    socialChannel
      .on('broadcast', { event: 'social_event' }, ({ payload }) => {
        if (!payload || !payload.type) return;
        handleIncomingSocialEvent(payload);
      })
      .subscribe();
  }
}

/**
 * Subscribe ke event sosial (permintaan teman masuk, pertemanan diterima, respect, dll)
 * @param {string} currentUsername Nickname pemain aktif
 * @param {Function} onEvent Callback yang dipanggil saat ada event terkait pemain
 * @returns {Function} Unsubscribe cleanup function
 */
export function subscribeToFriendEvents(currentUsername, onEvent) {
  const norm = normalizeUsernameKey(currentUsername);

  const wrappedListener = (payload) => {
    if (!payload) return;

    if (payload.type === 'local_storage_sync') {
      try {
        onEvent(payload);
      } catch (e) {
        console.warn('[FriendService] onEvent error:', e);
      }
      return;
    }

    if (!norm) return;
    const toNorm = normalizeUsernameKey(payload.to);
    const fromNorm = normalizeUsernameKey(payload.from);

    // Filter hanya jika relevan untuk user aktif
    const isTarget = toNorm === norm;
    const isSender = fromNorm === norm;

    if (!isTarget && !isSender) return;

    // Sinkronisasi otomatis data pertemanan jika permintaan di-acc
    if (payload.type === 'friend_request_accept') {
      // User A (target penerima event accept) otomatis menambahkan User B sebagai teman dan menghapus pending request
      if (isTarget && payload.accepterProfile) {
        addFriend(currentUsername, payload.accepterProfile);
        cleanPendingRequests(norm, fromNorm);
        try {
          audio.playVictorySound?.();
        } catch {}
      }
    } else if (payload.type === 'friend_request_reject') {
      if (isTarget) {
        cleanPendingRequests(norm, fromNorm);
      }
    } else if (payload.type === 'friend_remove') {
      if (isTarget) {
        removeFriend(currentUsername, payload.from);
      }
    } else if (payload.type === 'friend_request_send' && isTarget) {
      // Simpan ke incoming requests
      if (payload.senderProfile) {
        const inList = getIncomingFriendRequests(currentUsername);
        if (!inList.some((r) => normalizeUsernameKey(r.name) === fromNorm)) {
          const updated = [payload.senderProfile, ...inList];
          try {
            localStorage.setItem(`${REQ_IN_PREFIX}${norm}`, JSON.stringify(updated));
          } catch {}
        }
      }
      try {
        audio.playChatPopSound?.();
      } catch {}
    }

    try {
      onEvent(payload);
    } catch (e) {
      console.warn('[FriendService] onEvent error:', e);
    }
  };

  friendSubscribers.add(wrappedListener);
  initSocialChannel();

  return () => {
    friendSubscribers.delete(wrappedListener);
  };
}
