import React, { useState, useEffect, useMemo } from 'react';
import { X, Trophy, RotateCcw, Globe, RotateCw, Search, Flame, Info } from 'lucide-react';
import { fetchGlobalLeaderboard, normalizeUsernameKey } from '../services/leaderboardService';
import '../styles/scoreboardModal.css';

const GAME_TABS = [
  { id: 'all', label: 'Semua Game', icon: '👑' },
  { id: 'sevens', label: 'Tujuh Sekop', icon: '♠️' },
  { id: 'bigtwo', label: 'Big Two', icon: '🃏' },
  { id: 'game41', label: 'Remi 41', icon: '🎯' },
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
}) {
  const isGlobalMode = mode === 'global';
  const [globalCategory, setGlobalCategory] = useState(activeGameType || 'all');
  const [globalList, setGlobalList] = useState([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [tableNotFound, setTableNotFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const myNormalizedName = useMemo(() => normalizeUsernameKey(currentMyName), [currentMyName]);

  const isPlayerMe = (item) => {
    if (!item) return false;
    if (currentMyId && (item.player_id === currentMyId || item.id === currentMyId)) return true;
    if (currentMyId && Array.isArray(item.player_ids) && item.player_ids.includes(currentMyId)) {
      return true;
    }
    const itemNameKey = normalizeUsernameKey(item.player_name || item.name);
    if (myNormalizedName && itemNameKey && itemNameKey === myNormalizedName) return true;
    return false;
  };

  // Filtered Global List
  const filteredGlobalList = useMemo(() => {
    if (!searchQuery.trim()) return globalList;
    const q = searchQuery.toLowerCase().trim();
    return globalList.filter((item) =>
      (item.player_name || '').toLowerCase().includes(q)
    );
  }, [globalList, searchQuery]);

  // Current User's standing in Top Global
  const myStanding = useMemo(() => {
    if (globalList.length === 0) return null;
    const index = globalList.findIndex((item) => isPlayerMe(item));
    if (index === -1) return null;
    return {
      rank: index + 1,
      ...globalList[index],
    };
  }, [globalList, currentMyId, myNormalizedName]);

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

  return (
    <div className="scoreboard-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="scoreboard-modal-card scoreboard-modal-expanded" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="scoreboard-modal-header">
          <div className="scoreboard-header-left">
            <h2 className="scoreboard-modal-title">
              {isGlobalMode ? 'Top Global Leaderboard' : 'Papan Skor Sesi'}
            </h2>
            <span className="scoreboard-subtitle-badge">
              {isGlobalMode ? '🌍 Hall of Fame Online' : `📊 ${activeGameTitle}`}
            </span>
          </div>
          <button
            type="button"
            className="scoreboard-btn-close"
            onClick={onClose}
            aria-label="Tutup Scoreboard"
          >
            <X size={20} />
          </button>
        </div>

        {/* ======================= VIEW: TOP GLOBAL (MENU UTAMA) ======================= */}
        {isGlobalMode ? (
          <div className="global-leaderboard-view">
            {/* Category Filter Pills */}
            <div className="scoreboard-category-pills">
              {GAME_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`category-pill-btn ${globalCategory === tab.id ? 'active' : ''}`}
                  onClick={() => setGlobalCategory(tab.id)}
                >
                  <span className="cat-icon">{tab.icon}</span>
                  <span className="cat-label">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Himbauan Username Sama & Info Perhitungan */}
            <div className="global-username-notice">
              <div className="username-notice-icon">
                <Info size={16} />
              </div>
              <div className="username-notice-text">
                <strong>💡 Himbauan Top Global:</strong> Gunakan <strong>Username yang sama</strong> setiap
                kali bermain Online agar jumlah <strong>Menang (Juara 1)</strong> dan{' '}
                <strong>Skor (Total Poin)</strong> kamu otomatis terangkum menjadi satu di Top Global!
              </div>
            </div>

            {/* Search & Refresh Bar */}
            <div className="global-toolbar">
              <div className="global-search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Cari username pemain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="global-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="button"
                className={`btn-refresh-global ${isLoadingGlobal ? 'is-spinning' : ''}`}
                onClick={() => loadGlobalData()}
                title="Muat ulang Top Global"
                disabled={isLoadingGlobal}
              >
                <RotateCw size={14} />
                <span>Segarkan</span>
              </button>
            </div>

            {/* Notice if migration hasn't been executed yet in Supabase */}
            {tableNotFound && (
              <div className="global-setup-notice">
                <span className="notice-icon">⚙️</span>
                <div className="notice-content">
                  <strong>Tabel Top Global Belum Aktif di Supabase</strong>
                  <p>
                    Silakan jalankan file migrasi{' '}
                    <code>20261103_global_leaderboard.sql</code> di Supabase SQL Editor untuk
                    mengaktifkan sinkronisasi peringkat global realtime.
                  </p>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="scoreboard-table-container global-table-wrap">
              <table className="scoreboard-table">
                <thead>
                  <tr>
                    <th className="col-rank">RANK</th>
                    <th className="col-name">PEMAIN</th>
                    <th className="col-games" title="Total Permainan">MAIN</th>
                    <th className="col-wins" title="Jumlah Kemenangan Juara 1">MENANG</th>
                    <th className="col-score" title="Total Poin dari Keseluruhan Permainan">SKOR</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingGlobal && globalList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-scoreboard-cell">
                        <div className="leaderboard-loader">
                          <RotateCw size={22} className="is-spinning" />
                          <span>Mengambil data Top Global...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredGlobalList.length > 0 ? (
                    filteredGlobalList.map((item, index) => {
                      const rankNumber = index + 1;
                      const isMe = isPlayerMe(item);
                      const games = Number(item.games_played || 0);
                      const wins = Number(item.wins || 0);
                      const totalScore = Number(item.score || 0);

                      return (
                        <tr
                          key={item.player_id || item.player_name || index}
                          className={`rank-row rank-${rankNumber} ${isMe ? 'is-current-user-row' : ''}`}
                        >
                          <td className="col-rank">
                            {rankNumber === 1 ? (
                              <span className="rank-podium rank-gold" title="Top 1 Global">
                                🥇
                              </span>
                            ) : rankNumber === 2 ? (
                              <span className="rank-podium rank-silver" title="Top 2 Global">
                                🥈
                              </span>
                            ) : rankNumber === 3 ? (
                              <span className="rank-podium rank-bronze" title="Top 3 Global">
                                🥉
                              </span>
                            ) : (
                              <span className="rank-badge">{rankNumber}</span>
                            )}
                          </td>
                          <td className="col-name">
                            <div className="player-name-cell">
                              <span className="player-avatar">{item.avatar || '👤'}</span>
                              <span className="player-name-text">
                                {item.player_name}
                                {isMe && <span className="badge-you">Kamu</span>}
                              </span>
                            </div>
                          </td>
                          <td className="col-games">{games}</td>
                          <td className="col-wins">
                            <strong className="wins-value" title={`${wins}x Juara 1`}>
                              {wins}
                              {wins >= 5 && <Flame size={12} className="wins-flame" />}
                            </strong>
                          </td>
                          <td className="col-score">
                            <strong className="score-value" title={`Total ${totalScore} Poin`}>
                              {totalScore}
                            </strong>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty-scoreboard-cell">
                        {searchQuery
                          ? `Tidak ditemukan pemain dengan username "${searchQuery}".`
                          : 'Belum ada catatan pertandingan multiplayer di kategori ini.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Status Card: My Standing */}
            <div className="my-standing-card">
              {myStanding ? (
                <div className="my-standing-content">
                  <span className="my-standing-icon">🏅</span>
                  <div className="my-standing-info">
                    <span className="my-standing-title">
                      Posisi Kamu ({myStanding.player_name}) di{' '}
                      {GAME_TABS.find((t) => t.id === globalCategory)?.label || 'Global'}:
                    </span>
                    <strong className="my-standing-rank">Peringkat #{myStanding.rank}</strong>
                    <span className="my-standing-stats">
                      • <strong>{myStanding.wins || 0}</strong> Menang (Juara 1) •{' '}
                      <strong>{myStanding.score || 0}</strong> Skor Poin
                    </span>
                  </div>
                </div>
              ) : (
                <div className="my-standing-content unranked">
                  <span className="my-standing-icon">🎮</span>
                  <span className="my-standing-info">
                    Mainkan mode <strong>Online Multiplayer</strong> dengan username tetap untuk masuk ke{' '}
                    <strong>Top Global</strong>!
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ======================= VIEW: SESI INI (DI DALAM PERMAINAN) ======================= */
          <div className="session-leaderboard-view">
            <div className="scoreboard-table-container">
              <table className="scoreboard-table">
                <thead>
                  <tr>
                    <th className="col-rank">RANK</th>
                    <th className="col-name">PEMAIN</th>
                    <th className="col-games">MAIN</th>
                    <th className="col-wins">MENANG</th>
                    <th className="col-score">SKOR</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLocalScores.length > 0 ? (
                    sortedLocalScores.map((item, index) => {
                      const rankNumber = index + 1;
                      const isMe = isPlayerMe(item) || item.isLocalPlayer;
                      return (
                        <tr
                          key={item.id || item.name || index}
                          className={`rank-row rank-${rankNumber} ${isMe ? 'is-current-user-row' : ''}`}
                        >
                          <td className="col-rank">
                            {rankNumber === 1 ? (
                              <span className="rank-podium rank-gold">🥇</span>
                            ) : rankNumber === 2 ? (
                              <span className="rank-podium rank-silver">🥈</span>
                            ) : rankNumber === 3 ? (
                              <span className="rank-podium rank-bronze">🥉</span>
                            ) : (
                              <span className="rank-badge">{rankNumber}</span>
                            )}
                          </td>
                          <td className="col-name">
                            <div className="player-name-cell">
                              {item.avatar && <span className="player-avatar">{item.avatar}</span>}
                              <span className="player-name-text">
                                {item.name}
                                {isMe && <span className="badge-you">Kamu</span>}
                              </span>
                            </div>
                          </td>
                          <td className="col-games">{item.games || 0}</td>
                          <td className="col-wins">
                            <strong className="wins-value">{item.wins || 0}</strong>
                          </td>
                          <td className="col-score">
                            <strong className="score-value">{item.score || 0}</strong>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty-scoreboard-cell">
                        Belum ada riwayat permainan yang tercatat di sesi ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer info & optional reset */}
            <div className="scoreboard-modal-footer">
              <span className="scoreboard-footnote">
                * Menang = Jumlah Juara 1 • Skor = Total poin yang didapatkan selama sesi ini
              </span>
              {onResetScoreboard && (
                <button
                  type="button"
                  className="btn-reset-scoreboard"
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
      </div>
    </div>
  );
}
