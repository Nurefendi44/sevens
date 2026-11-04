import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Trophy,
  RotateCcw,
  RotateCw,
  Search,
  Flame,
  Info,
  Crown,
  Sparkles,
  Shield,
  Swords,
  Star,
  UserPlus,
  UserCheck,
  MessageCircle,
  Clock,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import {
  fetchGlobalLeaderboard,
  normalizeUsernameKey,
  getPlayerRankTier,
  getSupremeTitle,
  getLocalPlayerProfile,
  extractPinHashFromItem,
  hashProfilePin,
} from '../services/leaderboardService';
import {
  getFriendsList,
  isFriend,
  getFriendshipStatus,
  sendFriendRequest,
  removeFriend,
  subscribeToFriendEvents,
} from '../services/friendService';
import '../styles/scoreboardModal.css';

const GAME_TABS = [
  { id: 'all', label: 'Semua Game', shortLabel: 'Global', icon: '👑', subtitle: 'Hall of Fame Gabungan' },
  { id: 'sevens', label: 'Tujuh Sekop', shortLabel: '7 Sekop', icon: '♠️', subtitle: 'Supreme Sevens' },
  { id: 'bigtwo', label: 'Big Two', shortLabel: 'Big Two', icon: '🃏', subtitle: 'Supreme Capsa Banting' },
  { id: 'game41', label: 'Remi 41', shortLabel: 'Remi 41', icon: '🎯', subtitle: 'Supreme Kartu 41' },
];

export default function ScoreboardModal({
  isOpen,
  onClose,
  scoreboardData = [],
  onResetScoreboard,
  activeGameTitle = 'Game Info',
  activeGameType = 'all',
  currentMyId = '',
  currentMyName = '',
  mode = 'global', // 'global' (Menu Utama) | 'session' (Di dalam meja permainan)
  onStartDirectChat = null,
}) {
  const isGlobalMode = mode === 'global';
  const [globalCategory, setGlobalCategory] = useState(activeGameType || 'all');
  const [globalList, setGlobalList] = useState([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [tableNotFound, setTableNotFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const localProfile = useMemo(() => getLocalPlayerProfile(), [isOpen, currentMyName]);
  const effectiveMyName = currentMyName || localProfile.name || '';
  const myNormalizedName = useMemo(() => normalizeUsernameKey(effectiveMyName), [effectiveMyName]);

  const [friendsList, setFriendsList] = useState(() => getFriendsList(effectiveMyName));
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [friendActionNotice, setFriendActionNotice] = useState(null);

  const refreshFriends = () => {
    if (effectiveMyName) {
      setFriendsList(getFriendsList(effectiveMyName));
    }
  };

  useEffect(() => {
    refreshFriends();
    if (effectiveMyName) {
      const unsub = subscribeToFriendEvents(effectiveMyName, () => {
        refreshFriends();
      });
      return () => unsub();
    }
  }, [effectiveMyName, isOpen]);

  const handleToggleFriend = async (targetPlayer, tier = null) => {
    const targetName = targetPlayer.player_name || targetPlayer.name;
    if (!targetName || !effectiveMyName) return;

    const currentStatus = getFriendshipStatus(effectiveMyName, targetName);

    if (currentStatus === 'friend') {
      // Buka popup konfirmasi hapus pertemanan
      setFriendToDelete({
        name: targetName,
        avatar: targetPlayer.avatar,
      });
    } else if (currentStatus === 'none') {
      // Kirim permintaan pertemanan (harus di-ACC)
      const res = await sendFriendRequest(
        effectiveMyName,
        localProfile,
        {
          name: targetName,
          avatar: targetPlayer.avatar,
          tier: tier || targetPlayer.tier,
          score: targetPlayer.score,
          wins: targetPlayer.wins,
        }
      );
      if (res.success) {
        setFriendActionNotice(`Permintaan pertemanan dikirim ke ${targetName}!`);
        setTimeout(() => setFriendActionNotice(null), 3000);
      }
      refreshFriends();
    }
  };

  // Synchronize category when modal opens
  useEffect(() => {
    if (isOpen && isGlobalMode) {
      setGlobalCategory(activeGameType || 'all');
    }
  }, [isOpen, isGlobalMode, activeGameType]);

  // Load Top Global data when modal opens or category changes
  const loadGlobalData = async (cat = globalCategory) => {
    setIsLoadingGlobal(true);
    try {
      const res = await fetchGlobalLeaderboard(cat, 50);
      if (res.tableNotFound) {
        setTableNotFound(true);
      } else {
        setTableNotFound(false);
      }
      setGlobalList(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch global leaderboard', e);
    } finally {
      setIsLoadingGlobal(false);
    }
  };

  useEffect(() => {
    if (isOpen && isGlobalMode) {
      loadGlobalData(globalCategory);
    }
  }, [isOpen, isGlobalMode, globalCategory]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const isPlayerMe = (item) => {
    if (!item) return false;
    if (currentMyId && (item.player_id === currentMyId || item.id === currentMyId)) return true;
    if (currentMyId && Array.isArray(item.player_ids) && item.player_ids.includes(currentMyId)) {
      return true;
    }
    const itemNameKey = normalizeUsernameKey(item.player_name || item.name);
    if (myNormalizedName && itemNameKey && itemNameKey === myNormalizedName) {
      const lockedHash = extractPinHashFromItem(item);
      if (lockedHash) {
        const myPinHash = hashProfilePin(effectiveMyName, localProfile.pin);
        return Boolean(myPinHash && myPinHash === lockedHash);
      }
      return true;
    }
    return false;
  };

  // Filtered Global List with preserved original rank number
  const rankedGlobalList = useMemo(() => {
    return globalList.map((item, idx) => ({
      ...item,
      trueRank: idx + 1,
    }));
  }, [globalList]);

  const filteredGlobalList = useMemo(() => {
    if (!searchQuery.trim()) return rankedGlobalList;
    const q = searchQuery.toLowerCase().trim();
    return rankedGlobalList.filter((item) =>
      (item.player_name || '').toLowerCase().includes(q)
    );
  }, [rankedGlobalList, searchQuery]);

  // Top 3 Podium players (from full list before search)
  const podiumPlayers = useMemo(() => {
    if (rankedGlobalList.length === 0) return [];
    return rankedGlobalList.slice(0, 3);
  }, [rankedGlobalList]);

  // Current User's standing in Top Global
  const myStanding = useMemo(() => {
    if (rankedGlobalList.length === 0) return null;
    const found = rankedGlobalList.find((item) => isPlayerMe(item));
    if (!found) return null;
    return {
      rank: found.trueRank,
      ...found,
    };
  }, [rankedGlobalList, currentMyId, myNormalizedName]);

  if (!isOpen) return null;

  // Local session sorting: sort by wins (Juara 1) DESC, then score (total points) DESC, then games ASC
  const sortedLocalScores = [...scoreboardData].sort((a, b) => {
    const winsA = Number(a.wins || 0);
    const winsB = Number(b.wins || 0);
    if (winsB !== winsA) return winsB - winsA;
    const scoreA = Number(a.score || 0);
    const scoreB = Number(b.score || 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return Number(b.games || 0) - Number(a.games || 0);
  });

  const activeTabMeta = GAME_TABS.find((t) => t.id === globalCategory) || GAME_TABS[0];
  const myTier = getPlayerRankTier(myStanding?.score || 0, myStanding?.wins || 0);

  // Helper to render a Podium Card (#2 Left, #1 Center, #3 Right)
  const renderPodiumSlot = (player, targetRank) => {
    if (!player) {
      return (
        <div key={`empty-${targetRank}`} className={`mlbb-podium-card podium-rank-${targetRank} is-empty`}>
          <div className="podium-crown-badge">#{targetRank}</div>
          <div className="podium-avatar-frame empty-frame">
            <span>?</span>
          </div>
          <div className="podium-player-name">Belum Terisi</div>
          <span className="podium-empty-sub">Rebut Tahta Ini!</span>
        </div>
      );
    }

    const wins = Number(player.wins || 0);
    const games = Number(player.games_played || 0);
    const score = Number(player.score || 0);
    const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
    const tier = getPlayerRankTier(score, wins);
    const supreme = getSupremeTitle(targetRank, globalCategory);
    const isMe = isPlayerMe(player);

    return (
      <div
        key={player.player_id || player.player_name || targetRank}
        className={`mlbb-podium-card podium-rank-${targetRank} ${isMe ? 'is-me-podium' : ''}`}
      >
        <div className="podium-ambient-light" />

        {/* Top Crown / Rank Crest */}
        <div className="podium-rank-crest">
          {targetRank === 1 ? (
            <span className="crest-supreme-1">👑 ROYAL KING #1</span>
          ) : targetRank === 2 ? (
            <span className="crest-supreme-2">♠️ ACE MASTER #2</span>
          ) : (
            <span className="crest-supreme-3">♠️ ACE MASTER #3</span>
          )}
        </div>

        {/* Avatar with Rank Frame */}
        <div className={`podium-avatar-frame tier-ring-${tier.id}`}>
          <span className="podium-avatar-emoji">{player.avatar || '👑'}</span>
          <span className="podium-tier-corner" title={tier.name}>
            {tier.icon}
          </span>
        </div>

        {/* Player Name */}
        <div className="podium-player-name" title={player.player_name}>
          <span>{player.player_name}</span>
          {isMe && <span className="mlbb-you-chip">KAMU</span>}
        </div>

        {/* Supreme Title Ribbon */}
        <div className={`podium-title-ribbon ribbon-${targetRank}`}>
          <span>{supreme.fullTitle}</span>
        </div>

        {/* Rank Tier Name */}
        <div className="podium-tier-pill" style={{ borderColor: tier.color, color: tier.accent }}>
          <span>{tier.icon}</span>
          <span>{tier.shortName}</span>
        </div>

        {/* Stats Row: Wins, Score, WR */}
        <div className="podium-stats-strip">
          <div className="podium-stat-box">
            <span className="podium-stat-val text-gold">🏆 {wins}</span>
            <span className="podium-stat-lbl">Menang</span>
          </div>
          <div className="podium-stat-divider" />
          <div className="podium-stat-box">
            <span className="podium-stat-val text-cyan">★ {score}</span>
            <span className="podium-stat-lbl">Skor</span>
          </div>
          <div className="podium-stat-divider" />
          <div className="podium-stat-box">
            <span className="podium-stat-val text-emerald">{winrate}%</span>
            <span className="podium-stat-lbl">WR ({games})</span>
          </div>
        </div>

        {/* Actions for other players: Chat DM & Add Friend */}
        {!isMe && (
          <div className="podium-action-btns">
            {onStartDirectChat && (
              <button
                type="button"
                className="btn-podium-dm"
                onClick={() => {
                  onClose();
                  onStartDirectChat({
                    name: player.player_name,
                    avatar: player.avatar,
                    tier,
                    score,
                    wins,
                  });
                }}
                title={`Kirim Pesan Pribadi (DM) ke ${player.player_name}`}
              >
                <MessageCircle size={11} />
                <span>DM</span>
              </button>
            )}
            {(() => {
              const fStatus = getFriendshipStatus(effectiveMyName, player.player_name);
              return (
                <button
                  type="button"
                  className={`btn-podium-friend ${fStatus === 'friend' ? 'is-friend' : ''}`}
                  onClick={() => handleToggleFriend(player, tier)}
                  title={
                    fStatus === 'friend'
                      ? 'Hapus dari Teman'
                      : fStatus === 'pending_outgoing'
                      ? 'Menunggu Konfirmasi'
                      : 'Kirim Permintaan Teman'
                  }
                >
                  {fStatus === 'friend' ? (
                    <UserCheck size={11} />
                  ) : fStatus === 'pending_outgoing' ? (
                    <Clock size={11} />
                  ) : (
                    <UserPlus size={11} />
                  )}
                  <span>
                    {fStatus === 'friend'
                      ? 'Teman'
                      : fStatus === 'pending_outgoing'
                      ? 'Pending'
                      : '+ Teman'}
                  </span>
                </button>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mlbb-scoreboard-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="mlbb-scoreboard-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ornamental Metallic Corner Accents */}
        <div className="mlbb-corner-decor corner-tl" aria-hidden="true" />
        <div className="mlbb-corner-decor corner-tr" aria-hidden="true" />
        <div className="mlbb-corner-decor corner-bl" aria-hidden="true" />
        <div className="mlbb-corner-decor corner-br" aria-hidden="true" />

        {/* ======================= HEADER ======================= */}
        <div className="mlbb-scoreboard-header">
          <div className="mlbb-header-brand">
            <div className="mlbb-header-emblem">
              <Crown size={22} className="emblem-crown-svg" />
            </div>
            <div>
              <div className="mlbb-header-top-tags">
                <span className="mlbb-season-chip">SEASON 1 • LAND OF CARDS</span>
                <span className="mlbb-mode-chip">
                  {isGlobalMode ? '🌍 HALL OF FAME' : `📊 ${activeGameTitle}`}
                </span>
              </div>
              <h2 className="mlbb-scoreboard-title">
                {isGlobalMode ? 'TOP GLOBAL LEADERBOARD' : 'PAPAN SKOR PERTANDINGAN'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="mlbb-btn-close"
            onClick={onClose}
            aria-label="Tutup Leaderboard"
          >
            <X size={20} />
          </button>
        </div>

        {/* ======================= VIEW: TOP GLOBAL (MENU UTAMA) ======================= */}
        {isGlobalMode ? (
          <div className="mlbb-global-body">
            {/* Category Switcher Tabs (MLBB Metallic Tabs) */}
            <div className="mlbb-category-tabs">
              {GAME_TABS.map((tab) => {
                const isActive = globalCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`mlbb-cat-tab ${isActive ? 'active' : ''}`}
                    onClick={() => setGlobalCategory(tab.id)}
                  >
                    <span className="mlbb-cat-icon">{tab.icon}</span>
                    <div className="mlbb-cat-text">
                      <span className="mlbb-cat-name">{tab.label}</span>
                      <span className="mlbb-cat-sub">{tab.subtitle}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Inner Area (Podium + Toolbar + Table) */}
            <div className="mlbb-global-scroll-area">
              {/* TOP 3 SUPREME PODIUM STAGE (Shown when not filtering by search) */}
              {!searchQuery.trim() && (isLoadingGlobal && globalList.length === 0 ? null : (
                <div className="mlbb-podium-stage">
                  {renderPodiumSlot(podiumPlayers[1], 2)}
                  {renderPodiumSlot(podiumPlayers[0], 1)}
                  {renderPodiumSlot(podiumPlayers[2], 3)}
                </div>
              ))}

              {/* Search & Refresh Toolbar + Info */}
              <div className="mlbb-toolbar-row">
                <div className="mlbb-search-box">
                  <Search size={14} className="mlbb-search-icon" />
                  <input
                    type="text"
                    placeholder={`Cari Top Global di ${activeTabMeta.label}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mlbb-search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="mlbb-clear-search"
                      onClick={() => setSearchQuery('')}
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="mlbb-info-pill" title="Gunakan username yang sama setiap bermain Online agar Menang & Skor otomatis terakumulasi!">
                  <Info size={13} className="info-pill-icon" />
                  <span>Username sama = Akumulasi Skor & Menang</span>
                </div>

                <button
                  type="button"
                  className={`mlbb-btn-refresh ${isLoadingGlobal ? 'is-loading' : ''}`}
                  onClick={() => loadGlobalData()}
                  title="Segarkan Data Top Global"
                  disabled={isLoadingGlobal}
                >
                  <RotateCw size={14} className={isLoadingGlobal ? 'is-spinning' : ''} />
                  <span>{isLoadingGlobal ? 'Memuat...' : 'Refresh'}</span>
                </button>
              </div>

              {/* Notice if migration hasn't been executed yet in Supabase */}
              {tableNotFound && (
                <div className="mlbb-setup-warning">
                  <span>⚙️</span>
                  <div>
                    <strong>Tabel Top Global Belum Aktif di Supabase</strong>
                    <p>
                      Jalankan file migrasi <code>20261103_global_leaderboard.sql</code> di Supabase SQL
                      Editor untuk mengaktifkan sinkronisasi Top Global.
                    </p>
                  </div>
                </div>
              )}

              {/* Ranking Table */}
              <div className="mlbb-table-wrap">
                <table className="mlbb-ranking-table">
                  <thead>
                    <tr>
                      <th className="col-rank">RANK</th>
                      <th className="col-player">NICKNAME & TITLE</th>
                      <th className="col-tier">TIER</th>
                      <th className="col-wr" title="Winrate & Total Match">MATCH / WR</th>
                      <th className="col-wins" title="Jumlah Kemenangan Juara 1">JUARA 1</th>
                      <th className="col-score" title="Total Akumulasi Bintang / Poin">★ SKOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingGlobal && globalList.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="mlbb-empty-cell">
                          <div className="mlbb-loader-box">
                            <RotateCw size={24} className="is-spinning text-gold" />
                            <span>Memuat Data Supreme Top Global...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredGlobalList.length > 0 ? (
                      filteredGlobalList.map((item, idx) => {
                        const rankNumber = item.trueRank || idx + 1;
                        const isMe = isPlayerMe(item);
                        const games = Number(item.games_played || 0);
                        const wins = Number(item.wins || 0);
                        const totalScore = Number(item.score || 0);
                        const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
                        const tier = getPlayerRankTier(totalScore, wins);
                        const supreme = getSupremeTitle(rankNumber, globalCategory);

                        return (
                          <tr
                            key={item.player_id || item.player_name || idx}
                            className={`mlbb-rank-row rank-pos-${rankNumber} ${isMe ? 'is-me-row' : ''}`}
                          >
                            {/* RANK */}
                            <td className="col-rank">
                              {rankNumber === 1 ? (
                                <span className="mlbb-rank-medal medal-1" title="Top 1 Supreme">
                                  👑 1
                                </span>
                              ) : rankNumber === 2 ? (
                                <span className="mlbb-rank-medal medal-2" title="Top 2 Supreme">
                                  🥈 2
                                </span>
                              ) : rankNumber === 3 ? (
                                <span className="mlbb-rank-medal medal-3" title="Top 3 Supreme">
                                  🥉 3
                                </span>
                              ) : rankNumber <= 10 ? (
                                <span className="mlbb-rank-top10">#{rankNumber}</span>
                              ) : (
                                <span className="mlbb-rank-num">{rankNumber}</span>
                              )}
                            </td>

                            {/* PLAYER & TITLE */}
                            <td className="col-player">
                              <div className="mlbb-player-cell">
                                <div className={`mlbb-row-avatar tier-ring-${tier.id}`}>
                                  <span>{item.avatar || '👤'}</span>
                                </div>
                                <div className="mlbb-player-meta">
                                  <div className="mlbb-player-name-line">
                                    <span className="mlbb-player-name">{item.player_name}</span>
                                    {isMe && <span className="mlbb-you-chip">KAMU</span>}
                                    {!isMe && (
                                      <div className="mlbb-row-actions">
                                        {onStartDirectChat && (
                                          <button
                                            type="button"
                                            className="btn-row-dm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onClose();
                                              onStartDirectChat({
                                                name: item.player_name,
                                                avatar: item.avatar,
                                                tier,
                                                score: totalScore,
                                                wins,
                                              });
                                            }}
                                            title={`Kirim Pesan Pribadi ke ${item.player_name}`}
                                          >
                                            <MessageCircle size={10} />
                                            <span>DM</span>
                                          </button>
                                        )}
                                        {(() => {
                                          const fStatus = getFriendshipStatus(effectiveMyName, item.player_name);
                                          return (
                                            <button
                                              type="button"
                                              className={`btn-row-friend ${fStatus === 'friend' ? 'is-friend' : ''}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleFriend(item, tier);
                                              }}
                                              title={
                                                fStatus === 'friend'
                                                  ? 'Hapus dari Teman'
                                                  : fStatus === 'pending_outgoing'
                                                  ? 'Menunggu Konfirmasi'
                                                  : 'Kirim Permintaan Teman'
                                              }
                                            >
                                              {fStatus === 'friend' ? (
                                                <UserCheck size={10} />
                                              ) : fStatus === 'pending_outgoing' ? (
                                                <Clock size={10} />
                                              ) : (
                                                <UserPlus size={10} />
                                              )}
                                            </button>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                  {rankNumber <= 10 && (
                                    <span className={`mlbb-supreme-sub sub-${supreme.tier}`}>
                                      {supreme.icon} {supreme.fullTitle}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* TIER */}
                            <td className="col-tier">
                              <span
                                className="mlbb-tier-badge"
                                style={{
                                  borderColor: `${tier.color}66`,
                                  color: tier.accent,
                                }}
                              >
                                <span>{tier.icon}</span>
                                <span>{tier.shortName}</span>
                              </span>
                            </td>

                            {/* MATCH & WINRATE */}
                            <td className="col-wr">
                              <div className="mlbb-wr-cell">
                                <span className={`mlbb-wr-pill ${winrate >= 50 ? 'wr-high' : ''}`}>
                                  {winrate}% WR
                                </span>
                                <span className="mlbb-match-count">{games} Match</span>
                              </div>
                            </td>

                            {/* WINS */}
                            <td className="col-wins">
                              <span className="mlbb-wins-badge">
                                🏆 {wins}
                                {wins >= 3 && <Flame size={13} className="mlbb-flame-icon" />}
                              </span>
                            </td>

                            {/* SCORE */}
                            <td className="col-score">
                              <span className="mlbb-score-star">
                                <span className="star-glyph">★</span>
                                <strong>{totalScore}</strong>
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="mlbb-empty-cell">
                          {searchQuery
                            ? `Tidak ditemukan pemain dengan nickname "${searchQuery}".`
                            : 'Belum ada catatan pertandingan Online Multiplayer di kategori ini. Jadilah Supreme #1 Pertama!'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ======================= MY RANK FOOTER (MLBB STICKY BAR) ======================= */}
            <div className="mlbb-my-standing-bar">
              {myStanding ? (
                <div className="mlbb-standing-inner">
                  <div className="standing-left">
                    <div className="standing-rank-box">
                      <span className="standing-rank-lbl">RANK KAMU</span>
                      <strong className="standing-rank-num">#{myStanding.rank}</strong>
                    </div>

                    <div className={`standing-avatar tier-ring-${myTier.id}`}>
                      <span>{myStanding.avatar || localProfile.avatar || '👑'}</span>
                    </div>

                    <div className="standing-identity">
                      <div className="standing-name-row">
                        <strong>{myStanding.player_name}</strong>
                        <span
                          className="standing-tier-tag"
                          style={{ borderColor: myTier.color, color: myTier.accent }}
                        >
                          {myTier.icon} {myTier.name}
                        </span>
                      </div>
                      {myTier.nextTierName ? (
                        <div className="standing-progress-wrap">
                          <div className="standing-progress-bar">
                            <div
                              className="standing-progress-fill"
                              style={{ width: `${myTier.progress}%` }}
                            />
                          </div>
                          <span className="standing-progress-text">
                            Menuju {myTier.nextTierName} ({myStanding.score}/{myTier.nextMinScore} ★)
                          </span>
                        </div>
                      ) : (
                        <span className="standing-progress-text text-gold">
                          ✨ Tier Tertinggi Tercapai (Royal King)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="standing-right-stats">
                    <div className="standing-mini-stat">
                      <span className="stat-k">MAIN</span>
                      <strong className="stat-v">{myStanding.games_played || 0}</strong>
                    </div>
                    <div className="standing-mini-stat">
                      <span className="stat-k">JUARA 1</span>
                      <strong className="stat-v text-gold">🏆 {myStanding.wins || 0}</strong>
                    </div>
                    <div className="standing-mini-stat">
                      <span className="stat-k">TOTAL SKOR</span>
                      <strong className="stat-v text-cyan">★ {myStanding.score || 0}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mlbb-standing-inner is-unranked">
                  <div className="standing-left">
                    <div className="standing-rank-box unranked-box">
                      <span className="standing-rank-lbl">STATUS</span>
                      <strong className="standing-rank-num">UNRANKED</strong>
                    </div>
                    <div className="standing-avatar">
                      <span>{localProfile.avatar || '👑'}</span>
                    </div>
                    <div className="standing-identity">
                      <div className="standing-name-row">
                        <strong>{effectiveMyName || 'Player Baru'}</strong>
                        <span className="standing-tier-tag">🥉 Bronze</span>
                      </div>
                      <span className="standing-progress-text">
                        Mainkan mode <strong>Online Multiplayer</strong> untuk masuk ke Peringkat Top Global!
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ======================= VIEW: SESI INI (DI DALAM MEJA PERMAINAN) ======================= */
          <div className="mlbb-session-body">
            <div className="mlbb-table-wrap session-table-wrap">
              <table className="mlbb-ranking-table">
                <thead>
                  <tr>
                    <th className="col-rank">RANK</th>
                    <th className="col-player">PEMAIN</th>
                    <th className="col-tier">TIER SESI</th>
                    <th className="col-wr">MAIN</th>
                    <th className="col-wins">JUARA 1</th>
                    <th className="col-score">★ SKOR</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLocalScores.length > 0 ? (
                    sortedLocalScores.map((item, index) => {
                      const rankNumber = index + 1;
                      const isMe = isPlayerMe(item) || item.isLocalPlayer;
                      const wins = Number(item.wins || 0);
                      const score = Number(item.score || 0);
                      const games = Number(item.games || 0);
                      const tier = getPlayerRankTier(score, wins);

                      return (
                        <tr
                          key={item.id || item.name || index}
                          className={`mlbb-rank-row rank-pos-${rankNumber} ${isMe ? 'is-me-row' : ''}`}
                        >
                          <td className="col-rank">
                            {rankNumber === 1 ? (
                              <span className="mlbb-rank-medal medal-1">👑 1</span>
                            ) : rankNumber === 2 ? (
                              <span className="mlbb-rank-medal medal-2">🥈 2</span>
                            ) : rankNumber === 3 ? (
                              <span className="mlbb-rank-medal medal-3">🥉 3</span>
                            ) : (
                              <span className="mlbb-rank-num">{rankNumber}</span>
                            )}
                          </td>
                          <td className="col-player">
                            <div className="mlbb-player-cell">
                              <div className={`mlbb-row-avatar tier-ring-${tier.id}`}>
                                <span>{item.avatar || '👤'}</span>
                              </div>
                              <div className="mlbb-player-meta">
                                <div className="mlbb-player-name-line">
                                  <span className="mlbb-player-name">{item.name}</span>
                                  {isMe && <span className="mlbb-you-chip">KAMU</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="col-tier">
                            <span
                              className="mlbb-tier-badge"
                              style={{ borderColor: `${tier.color}66`, color: tier.accent }}
                            >
                              <span>{tier.icon}</span>
                              <span>{tier.shortName}</span>
                            </span>
                          </td>
                          <td className="col-wr">
                            <span className="mlbb-match-count">{games} Match</span>
                          </td>
                          <td className="col-wins">
                            <span className="mlbb-wins-badge">🏆 {wins}</span>
                          </td>
                          <td className="col-score">
                            <span className="mlbb-score-star">
                              <span className="star-glyph">★</span>
                              <strong>{score}</strong>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="mlbb-empty-cell">
                        Belum ada riwayat pertandingan yang selesai di sesi meja ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mlbb-session-footer">
              <span className="mlbb-session-note">
                * Juara 1 = Jumlah Menang • ★ Skor = Total poin yang dikumpulkan selama sesi ini
              </span>
              {onResetScoreboard && (
                <button
                  type="button"
                  className="mlbb-btn-reset"
                  onClick={onResetScoreboard}
                  title="Reset Akumulasi Skor Sesi"
                >
                  <RotateCcw size={13} />
                  <span>Reset Skor Sesi</span>
                </button>
              )}
            </div>
          </div>
        )}
        {/* Toast Notifikasi Aksi Teman */}
        {friendActionNotice && (
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(16, 185, 129, 0.95)',
              border: '1px solid #34d399',
              color: '#ffffff',
              padding: '0.5rem 1.1rem',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 800,
              zIndex: 100,
              boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
            }}
          >
            <span>{friendActionNotice}</span>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Pertemanan */}
        {friendToDelete && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(3, 7, 18, 0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => setFriendToDelete(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 360,
                background: 'linear-gradient(180deg, #1e1b29 0%, #110e19 100%)',
                border: '1.5px solid rgba(239, 68, 68, 0.45)',
                borderRadius: 16,
                padding: '1.4rem 1.2rem',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                color: '#f8fafc',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1.5px solid rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.8rem auto',
                }}
              >
                <AlertTriangle size={26} color="#ef4444" />
              </div>

              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 900 }}>
                Hapus Pertemanan?
              </h3>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.8rem',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 999,
                  marginBottom: '0.8rem',
                  fontSize: '0.88rem',
                  color: '#fde047',
                  fontWeight: 800,
                }}
              >
                <span>{friendToDelete.avatar || '👤'}</span>
                <span>{friendToDelete.name}</span>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45, margin: '0 0 1.2rem 0' }}>
                Apakah kamu yakin ingin menghapus <strong style={{ color: '#fff' }}>{friendToDelete.name}</strong> dari daftar teman? Kalian tidak lagi bisa saling mengirim DM cepat.
              </p>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setFriendToDelete(null)}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: 9,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#cbd5e1',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeFriend(effectiveMyName, friendToDelete.name);
                    refreshFriends();
                    setFriendToDelete(null);
                  }}
                  style={{
                    flex: 1.2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem',
                    borderRadius: 9,
                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                  }}
                >
                  <Trash2 size={14} />
                  <span>Ya, Hapus</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
