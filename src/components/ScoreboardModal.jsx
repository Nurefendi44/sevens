import React, { useState, useEffect, useMemo } from 'react';
import { X, Trophy, RotateCcw, Globe, RotateCw, Search, Crown, Flame } from 'lucide-react';
import { fetchGlobalLeaderboard } from '../services/leaderboardService';
import '../styles/scoreboardModal.css';

const GAME_TABS = [
  { id: 'all', label: 'Semua Game', icon: '👑' },
  { id: 'sevens', label: 'Tujuh Sekop', icon: '♠️' },
  { id: 'bigtwo', label: 'Big Two', icon: '🃏' },
  { id: 'game41', label: 'Game 41', icon: '🎯' },
];

export default function ScoreboardModal({
  isOpen,
  onClose,
  scoreboardData = [],
  onResetScoreboard,
  activeGameTitle = 'Game Info',
  activeGameType = 'sevens',
  currentMyId = '',
}) {
  const [activeMainTab, setActiveMainTab] = useState('global'); // 'global' | 'session'
  const [globalCategory, setGlobalCategory] = useState(activeGameType || 'all');
  const [globalList, setGlobalList] = useState([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [tableNotFound, setTableNotFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Synchronize category when modal opens with a specific activeGameType
  useEffect(() => {
    if (isOpen && activeGameType) {
      setGlobalCategory(activeGameType);
    }
  }, [isOpen, activeGameType]);

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
    if (isOpen && activeMainTab === 'global') {
      loadGlobalData(globalCategory);
    }
  }, [isOpen, activeMainTab, globalCategory]);

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
    if (!currentMyId || globalList.length === 0) return null;
    const index = globalList.findIndex((item) => item.player_id === currentMyId);
    if (index === -1) return null;
    return {
      rank: index + 1,
      ...globalList[index],
    };
  }, [globalList, currentMyId]);

  if (!isOpen) return null;

  // Local session sorting
  const sortedLocalScores = [...scoreboardData].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.games - a.games;
  });

  return (
    <div className="scoreboard-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="scoreboard-modal-card scoreboard-modal-expanded" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="scoreboard-modal-header">
          <div className="scoreboard-header-left">
            <h2 className="scoreboard-modal-title">Papan Peringkat</h2>
            <span className="scoreboard-subtitle-badge">
              {activeMainTab === 'global' ? '🌍 Top Global' : `📊 Sesi: ${activeGameTitle}`}
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

        {/* Main Tab Switcher: [Top Global] vs [Sesi Ini] */}
        <div className="scoreboard-main-tabs" role="tablist">
          <button
            type="button"
            className={`main-tab-btn ${activeMainTab === 'global' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('global')}
          >
            <Globe size={16} />
            <span>Top Global</span>
            <span className="main-tab-pill">Online</span>
          </button>
          <button
            type="button"
            className={`main-tab-btn ${activeMainTab === 'session' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('session')}
          >
            <Trophy size={16} />
            <span>Sesi Ini</span>
            <span className="main-tab-pill">Lokal</span>
          </button>
        </div>

        {/* ======================= TAB: TOP GLOBAL ======================= */}
        {activeMainTab === 'global' && (
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

            {/* Search & Refresh Bar */}
            <div className="global-toolbar">
              <div className="global-search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Cari nama pemain..."
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
                    <th className="col-games">MAIN</th>
                    <th className="col-wins">MENANG</th>
                    <th className="col-winrate">WINRATE</th>
                    <th className="col-score">SKOR</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingGlobal && globalList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-scoreboard-cell">
                        <div className="leaderboard-loader">
                          <RotateCw size={22} className="is-spinning" />
                          <span>Mengambil data Top Global...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredGlobalList.length > 0 ? (
                    filteredGlobalList.map((item, index) => {
                      const rankNumber = index + 1;
                      const isMe = currentMyId && item.player_id === currentMyId;
                      const games = Number(item.games_played || 0);
                      const wins = Number(item.wins || 0);
                      const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

                      return (
                        <tr
                          key={item.player_id || index}
                          className={`rank-row rank-${rankNumber} ${isMe ? 'is-current-user-row' : ''}`}
                        >
                          <td className="col-rank">
                            {rankNumber === 1 ? (
                              <span className="rank-podium rank-gold" title="Juara 1">
                                🥇
                              </span>
                            ) : rankNumber === 2 ? (
                              <span className="rank-podium rank-silver" title="Juara 2">
                                🥈
                              </span>
                            ) : rankNumber === 3 ? (
                              <span className="rank-podium rank-bronze" title="Juara 3">
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
                            <strong className="wins-value">
                              {wins}
                              {wins >= 5 && <Flame size={12} className="wins-flame" />}
                            </strong>
                          </td>
                          <td className="col-winrate">
                            <span className={`winrate-tag ${winRate >= 60 ? 'winrate-high' : ''}`}>
                              {winRate}%
                            </span>
                          </td>
                          <td className="col-score">
                            <strong className="score-value">{item.score || 0}</strong>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="empty-scoreboard-cell">
                        {searchQuery
                          ? `Tidak ditemukan pemain dengan nama "${searchQuery}".`
                          : 'Belum ada catatan kemenangan multiplayer di kategori ini.'}
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
                    <span className="my-standing-title">Posisi Kamu di {GAME_TABS.find((t) => t.id === globalCategory)?.label || 'Global'}:</span>
                    <strong className="my-standing-rank">Peringkat #{myStanding.rank}</strong>
                    <span className="my-standing-stats">
                      • {myStanding.wins} Menang • Winrate{' '}
                      {myStanding.games_played > 0
                        ? Math.round((myStanding.wins / myStanding.games_played) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              ) : (
                <div className="my-standing-content unranked">
                  <span className="my-standing-icon">🎮</span>
                  <span className="my-standing-info">
                    Menangkan pertandingan <strong>Multiplayer</strong> untuk masuk ke Top Global!
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= TAB: SESI INI (LOKAL) ======================= */}
        {activeMainTab === 'session' && (
          <div className="session-leaderboard-view">
            <div className="scoreboard-section-title-wrap">
              <span className="scoreboard-trophy-icon">🏆</span>
              <h3 className="scoreboard-section-title">Scoreboard Sesi Ini</h3>
            </div>

            <div className="scoreboard-table-container">
              <table className="scoreboard-table">
                <thead>
                  <tr>
                    <th className="col-rank">RANK</th>
                    <th className="col-name">NAME</th>
                    <th className="col-games">GAMES *</th>
                    <th className="col-score">SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLocalScores.length > 0 ? (
                    sortedLocalScores.map((item, index) => {
                      const rankNumber = index + 1;
                      const isMe = currentMyId && (item.id === currentMyId || item.isLocalPlayer);
                      return (
                        <tr
                          key={item.id || item.name || index}
                          className={`rank-row rank-${rankNumber} ${isMe ? 'is-current-user-row' : ''}`}
                        >
                          <td className="col-rank">
                            <span className="rank-badge">{rankNumber}</span>
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
                          <td className="col-score">
                            <strong className="score-value">{item.score || 0}</strong>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="empty-scoreboard-cell">
                        Belum ada riwayat permainan yang tercatat di sesi ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer info & optional reset */}
            <div className="scoreboard-modal-footer">
              <span className="scoreboard-footnote">* Total ronde / permainan yang telah dimainkan pada perangkat ini</span>
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
