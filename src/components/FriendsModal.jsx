/**
 * FRIENDS MODAL COMPONENT (MLBB STYLE SOCIAL & SQUAD HUB)
 * Fitur Daftar Teman, Tambah Teman dengan Pencarian Username & Sistem ACC/Konfirmasi,
 * Pop-up Konfirmasi Hapus Pertemanan, dan Kirim Undangan Mabar.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  MessageSquare,
  Swords,
  Flame,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Trophy,
  Star,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  getFriendsList,
  getIncomingFriendRequests,
  getSentFriendRequests,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  sendFriendRespect,
  lookupPlayerByUsername,
  subscribeToFriendEvents,
  getFriendshipStatus,
  syncFriendsWithLeaderboard,
} from '../services/friendService';
import { fetchGlobalLeaderboard } from '../services/leaderboardService';
import AvatarDisplay from './AvatarDisplay';
import '../styles/friendsModal.css';

export default function FriendsModal({
  isOpen,
  onClose,
  myProfile,
  myRankTier,
  onOpenDirectChat,
  onInviteToRoom,
}) {
  const currentDisplayName = myProfile?.name || '';

  // Tab State: 'all' | 'requests' | 'add'
  const [activeTab, setActiveTab] = useState('all');

  // Friends & Requests Data State
  const [friendsList, setFriendsList] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  // Search in Friends Tab
  const [friendFilterQuery, setFriendFilterQuery] = useState('');

  // Add Friend Tab State
  const [searchUsernameInput, setSearchUsernameInput] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [topGlobalSuggestions, setTopGlobalSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Unfriend Confirmation Modal State
  const [friendToDelete, setFriendToDelete] = useState(null);

  // Feedback Toast / Alert
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Reload local lists & sync stats with Top Global Leaderboard
  const reloadFriendsData = () => {
    if (!currentDisplayName) return;
    setFriendsList(getFriendsList(currentDisplayName));
    setIncomingRequests(getIncomingFriendRequests(currentDisplayName));
    setSentRequests(getSentFriendRequests(currentDisplayName));
    syncFriendsWithLeaderboard(currentDisplayName)
      .then((res) => {
        if (res?.friends) setFriendsList(res.friends);
        if (res?.incomingRequests) setIncomingRequests(res.incomingRequests);
        if (res?.sentRequests) setSentRequests(res.sentRequests);
      })
      .catch(() => {});
  };

  // Sync data on open or username change
  useEffect(() => {
    if (isOpen && currentDisplayName) {
      reloadFriendsData();
    }
  }, [isOpen, currentDisplayName]);

  // Subscribe to realtime social events
  useEffect(() => {
    if (!currentDisplayName) return;

    const unsubscribe = subscribeToFriendEvents(currentDisplayName, (event) => {
      reloadFriendsData();

      if (event.type === 'friend_request_send') {
        showToast(`${event.from} mengirimkan permintaan pertemanan!`, 'info');
      } else if (event.type === 'friend_request_accept') {
        showToast(`${event.from} menerima permintaan pertemananmu! 🎉`, 'success');
      } else if (event.type === 'friend_respect') {
        showToast(`${event.from} memberimu energi respect! ${event.emoji || '🔥'}`, 'gold');
      }
    });

    return () => unsubscribe();
  }, [currentDisplayName]);

  // Load top global recommendations on mount or when opening Add Friend tab
  useEffect(() => {
    if (isOpen && activeTab === 'add' && topGlobalSuggestions.length === 0) {
      setIsLoadingSuggestions(true);
      fetchGlobalLeaderboard('all', 12)
        .then((res) => {
          const list = (res.data || []).filter(
            (p) => p.player_name?.toLowerCase() !== currentDisplayName.toLowerCase()
          );
          setTopGlobalSuggestions(list);
        })
        .catch(() => {})
        .finally(() => setIsLoadingSuggestions(false));
    }
  }, [isOpen, activeTab, currentDisplayName, topGlobalSuggestions.length]);

  // Handle Search for Player to Add
  const handleSearchPlayer = async (e) => {
    if (e) e.preventDefault();
    const query = searchUsernameInput.trim();
    if (!query) return;

    setIsSearchingUser(true);
    setHasSearched(true);
    try {
      const res = await lookupPlayerByUsername(query);
      setSearchResults(res.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearchingUser(false);
    }
  };

  // Handle Send Friend Request (Harus di-ACC)
  const handleSendRequest = async (targetUser) => {
    if (!currentDisplayName) {
      showToast('Atur nickname profilmu terlebih dahulu.', 'error');
      return;
    }
    const res = await sendFriendRequest(
      currentDisplayName,
      {
        name: currentDisplayName,
        avatar: myProfile?.avatar || '👑',
        tier: myRankTier,
        score: myProfile?.score || 0,
        wins: myProfile?.wins || 0,
      },
      targetUser
    );

    if (res.success) {
      showToast(`Permintaan pertemanan terkirim ke ${targetUser.name}! Menunggu konfirmasi.`, 'success');
      reloadFriendsData();
    } else {
      showToast(res.error || 'Gagal mengirim permintaan.', 'error');
    }
  };

  // Handle Cancel Outgoing Request
  const handleCancelOutgoing = (targetName) => {
    cancelFriendRequest(currentDisplayName, targetName);
    showToast(`Permintaan ke ${targetName} dibatalkan.`, 'info');
    reloadFriendsData();
  };

  // Handle Accept Incoming Request
  const handleAcceptRequest = async (senderUser) => {
    const res = await acceptFriendRequest(
      currentDisplayName,
      {
        name: currentDisplayName,
        avatar: myProfile?.avatar || '👑',
        tier: myRankTier,
        score: myProfile?.score || 0,
        wins: myProfile?.wins || 0,
      },
      senderUser
    );

    if (res.success) {
      showToast(`Sekarang kamu berteman dengan ${senderUser.name}! 🤝`, 'success');
      reloadFriendsData();
    } else {
      showToast(res.error || 'Gagal menerima permintaan.', 'error');
    }
  };

  // Handle Reject Incoming Request
  const handleRejectRequest = async (senderName) => {
    await rejectFriendRequest(currentDisplayName, senderName);
    showToast(`Permintaan dari ${senderName} ditolak.`, 'info');
    reloadFriendsData();
  };

  // Handle Confirm Unfriend
  const handleConfirmDeleteFriend = () => {
    if (!friendToDelete) return;
    const res = removeFriend(currentDisplayName, friendToDelete.name);
    if (res.success) {
      showToast(`${friendToDelete.name} dihapus dari daftar teman.`, 'info');
      setFriendToDelete(null);
      reloadFriendsData();
    }
  };

  // Handle Send Respect
  const handleSendRespect = (friend) => {
    const res = sendFriendRespect(currentDisplayName, friend.name, '🔥');
    if (res.success) {
      showToast(res.message, 'gold');
    } else {
      showToast(res.message || 'Gagal memberi respect.', 'info');
    }
  };

  // Filtered friends list
  const filteredFriends = useMemo(() => {
    if (!friendFilterQuery.trim()) return friendsList;
    const q = friendFilterQuery.toLowerCase();
    return friendsList.filter((f) => f.name.toLowerCase().includes(q));
  }, [friendsList, friendFilterQuery]);

  if (!isOpen) return null;

  return (
    <div className="friends-modal-backdrop" onClick={onClose}>
      <div
        className="friends-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-modal-title"
      >
        {/* Toast Floating Notification */}
        {toastMessage && (
          <div className={`friends-toast toast-${toastMessage.type}`}>
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Mobile Bottom Sheet Drag Handle */}
        <div className="sheet-drag-handle" aria-hidden="true">
          <div className="sheet-drag-bar" />
        </div>

        {/* ===================================================================
            HEADER: Title & Close Button
            =================================================================== */}
        <div className="friends-modal-header">
          <div className="friends-header-left">
            <div className="friends-header-icon-box">
              <Users size={22} className="friends-gold-icon" />
            </div>
            <div>
              <h2 id="friends-modal-title" className="friends-modal-title">
                DAFTAR TEMAN & MABAR
              </h2>
              <p className="friends-modal-sub">
                Kelola Sahabat Kartu • Kirim Undangan Mabar Realtime
              </p>
            </div>
          </div>

          <button
            type="button"
            className="friends-modal-close-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {/* ===================================================================
            NAV TABS: Daftar Teman | Permintaan Masuk | Tambah Teman
            =================================================================== */}
        <div className="friends-nav-tabs">
          <button
            type="button"
            className={`friends-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <Users size={15} />
            <span>Semua Teman</span>
            <span className="friends-tab-counter">{friendsList.length}</span>
          </button>

          <button
            type="button"
            className={`friends-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <UserCheck size={15} />
            <span>Permintaan</span>
            {incomingRequests.length > 0 && (
              <span className="friends-tab-badge-glow">{incomingRequests.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`friends-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            <UserPlus size={15} />
            <span>Tambah Teman</span>
          </button>
        </div>

        {/* ===================================================================
            BODY CONTENT PER TAB
            =================================================================== */}
        <div className="friends-modal-body">
          {/* -------------------------------------------------------------
              TAB 1: DAFTAR SEMUA TEMAN
              ------------------------------------------------------------- */}
          {activeTab === 'all' && (
            <div className="friends-tab-content">
              {friendsList.length > 0 && (
                <div className="friends-search-bar">
                  <Search size={15} className="friends-search-icon" />
                  <input
                    type="text"
                    value={friendFilterQuery}
                    onChange={(e) => setFriendFilterQuery(e.target.value)}
                    placeholder="Cari teman di daftar kamu..."
                    className="friends-filter-input"
                  />
                  {friendFilterQuery && (
                    <button
                      type="button"
                      className="friends-clear-btn"
                      onClick={() => setFriendFilterQuery('')}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {filteredFriends.length === 0 ? (
                <div className="friends-empty-state">
                  <div className="friends-empty-bubble">
                    <Users size={34} />
                  </div>
                  <h3>
                    {friendsList.length === 0
                      ? 'Belum Ada Teman Terdaftar'
                      : 'Teman Tidak Ditemukan'}
                  </h3>
                  <p>
                    {friendsList.length === 0
                      ? 'Cari nickname pemain di tab "Tambah Teman" atau ajak pemain lain dari Top Global untuk berteman!'
                      : 'Tidak ada teman yang cocok dengan kata kunci pencarian kamu.'}
                  </p>
                  {friendsList.length === 0 && (
                    <button
                      type="button"
                      className="friends-btn-accent"
                      onClick={() => setActiveTab('add')}
                    >
                      <UserPlus size={15} />
                      <span>Cari Teman Sekarang</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="friends-cards-list">
                  {filteredFriends.map((friend) => (
                    <div key={friend.name} className="friend-card-row">
                      {/* Avatar & Online Dot */}
                      <div className="friend-card-avatar-wrap">
                        <AvatarDisplay
                          avatar={friend.avatar}
                          fallback="👤"
                          className="friend-card-avatar"
                        />
                        <span className="friend-online-dot" title="Online di game" />
                      </div>

                      {/* Info & Tier */}
                      <div className="friend-card-info">
                        <div className="friend-card-name-row">
                          <strong className="friend-card-name">{friend.name}</strong>
                          {friend.tier && (
                            <span
                              className="friend-tier-chip"
                              style={{
                                borderColor: friend.tier.color,
                                color: friend.tier.accent || friend.tier.color,
                              }}
                            >
                              {friend.tier.icon} {friend.tier.shortName}
                            </span>
                          )}
                        </div>

                        <div className="friend-card-stats-row">
                          <span className="friend-stat-item">
                            <Trophy size={12} className="stat-icon-gold" />
                            <span>{friend.wins || 0} Juara 1</span>
                          </span>
                          <span className="friend-stat-item">
                            <Star size={12} className="stat-icon-star" />
                            <span>{friend.score || 0} Skor</span>
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="friend-card-actions">
                        <button
                          type="button"
                          className="friend-action-btn btn-respect"
                          onClick={() => handleSendRespect(friend)}
                          title="Kirim Energi Respect 🔥"
                        >
                          <Flame size={15} />
                          <span className="action-label">Respect</span>
                        </button>

                        {onOpenDirectChat && (
                          <button
                            type="button"
                            className="friend-action-btn btn-dm"
                            onClick={() => {
                              onClose();
                              onOpenDirectChat(friend);
                            }}
                            title="Buka Obrolan Pribadi (DM)"
                          >
                            <MessageSquare size={15} />
                            <span className="action-label">DM</span>
                          </button>
                        )}

                        {onInviteToRoom && (
                          <button
                            type="button"
                            className="friend-action-btn btn-mabar"
                            onClick={() => {
                              onInviteToRoom(friend);
                              showToast(`Undangan mabar dikirim ke ${friend.name}!`, 'success');
                            }}
                            title="Ajak Mabar Masuk Room"
                          >
                            <Swords size={15} />
                            <span className="action-label">Ajak Mabar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="friend-action-btn btn-delete"
                          onClick={() => setFriendToDelete(friend)}
                          title="Hapus Pertemanan"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------------------------------
              TAB 2: PERMINTAAN PERTEMANAN (INCOMING & OUTGOING)
              ------------------------------------------------------------- */}
          {activeTab === 'requests' && (
            <div className="friends-tab-content">
              {/* Seksi Permintaan Masuk */}
              <div className="friends-requests-section">
                <div className="friends-section-title-row">
                  <UserCheck size={16} className="text-gold" />
                  <h4>Permintaan Masuk ({incomingRequests.length})</h4>
                </div>

                {incomingRequests.length === 0 ? (
                  <div className="friends-sub-empty">
                    <p>Tidak ada permintaan pertemanan baru saat ini.</p>
                  </div>
                ) : (
                  <div className="friends-cards-list">
                    {incomingRequests.map((req) => (
                      <div key={req.name} className="friend-request-row">
                        <div className="friend-card-avatar-wrap">
                          <AvatarDisplay
                            avatar={req.avatar}
                            fallback="👤"
                            className="friend-card-avatar"
                          />
                        </div>

                        <div className="friend-card-info">
                          <div className="friend-card-name-row">
                            <strong className="friend-card-name">{req.name}</strong>
                            {req.tier && (
                              <span
                                className="friend-tier-chip"
                                style={{
                                  borderColor: req.tier.color,
                                  color: req.tier.accent || req.tier.color,
                                }}
                              >
                                {req.tier.icon} {req.tier.shortName}
                              </span>
                            )}
                          </div>
                          <span className="friend-request-note">
                            Ingin menjadi teman mabar kamu
                          </span>
                        </div>

                        <div className="friend-req-btn-group">
                          <button
                            type="button"
                            className="btn-acc-friend"
                            onClick={() => handleAcceptRequest(req)}
                          >
                            <Check size={14} />
                            <span>Terima</span>
                          </button>
                          <button
                            type="button"
                            className="btn-reject-friend"
                            onClick={() => handleRejectRequest(req.name)}
                          >
                            <X size={14} />
                            <span>Tolak</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seksi Permintaan Keluar (Pending ACC) */}
              <div className="friends-requests-section" style={{ marginTop: '1.25rem' }}>
                <div className="friends-section-title-row">
                  <Clock size={16} className="text-cyan" />
                  <h4>Menunggu Konfirmasi ({sentRequests.length})</h4>
                </div>

                {sentRequests.length === 0 ? (
                  <div className="friends-sub-empty">
                    <p>Kamu tidak memiliki permintaan pertemanan yang sedang pending.</p>
                  </div>
                ) : (
                  <div className="friends-cards-list">
                    {sentRequests.map((req) => (
                      <div key={req.name} className="friend-request-row is-pending-out">
                        <div className="friend-card-avatar-wrap">
                          <AvatarDisplay
                            avatar={req.avatar}
                            fallback="👤"
                            className="friend-card-avatar"
                          />
                        </div>

                        <div className="friend-card-info">
                          <div className="friend-card-name-row">
                            <strong className="friend-card-name">{req.name}</strong>
                            {req.tier && (
                              <span
                                className="friend-tier-chip"
                                style={{
                                  borderColor: req.tier.color,
                                  color: req.tier.accent || req.tier.color,
                                }}
                              >
                                {req.tier.icon} {req.tier.shortName}
                              </span>
                            )}
                          </div>
                          <span className="friend-request-note text-yellow">
                            ⏳ Menunggu persetujuan dari pemain...
                          </span>
                        </div>

                        <div className="friend-req-btn-group">
                          <button
                            type="button"
                            className="btn-cancel-pending"
                            onClick={() => handleCancelOutgoing(req.name)}
                          >
                            <span>Batalkan</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -------------------------------------------------------------
              TAB 3: CARI & TAMBAH TEMAN
              ------------------------------------------------------------- */}
          {activeTab === 'add' && (
            <div className="friends-tab-content">
              {/* Form Input Pencarian Username Unik */}
              <form onSubmit={handleSearchPlayer} className="friends-search-form">
                <div className="friends-input-wrapper">
                  <Search size={16} className="friends-search-icon" />
                  <input
                    type="text"
                    value={searchUsernameInput}
                    onChange={(e) => setSearchUsernameInput(e.target.value)}
                    placeholder="Ketik nickname pemain (cth: lipia, pardi)..."
                    className="friends-add-input"
                  />
                </div>
                <button
                  type="submit"
                  className="friends-search-submit-btn"
                  disabled={!searchUsernameInput.trim() || isSearchingUser}
                >
                  {isSearchingUser ? (
                    <RefreshCw size={15} className="spin-icon" />
                  ) : (
                    <Search size={15} />
                  )}
                  <span>Cari Pemain</span>
                </button>
              </form>

              {/* Hasil Pencarian */}
              {hasSearched && (
                <div className="friends-search-results-box">
                  <div className="friends-section-title-row">
                    <Sparkles size={16} className="text-gold" />
                    <h4>Hasil Pencarian Nickname</h4>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="friends-empty-search">
                      <p>
                        Pemain dengan nickname &quot;<strong>{searchUsernameInput}</strong>&quot;
                        belum ditemukan di server. Pastikan ejaan nickname sudah sesuai.
                      </p>
                    </div>
                  ) : (
                    <div className="friends-cards-list">
                      {searchResults.map((player) => {
                        const status = getFriendshipStatus(currentDisplayName, player.name);

                        return (
                          <div key={player.name} className="friend-showcase-card">
                            <div className="showcase-avatar-box">
                              <AvatarDisplay
                                avatar={player.avatar}
                                fallback="👤"
                                className="showcase-avatar"
                              />
                            </div>

                            <div className="showcase-details">
                              <div className="showcase-name-row">
                                <h3 className="showcase-player-name">{player.name}</h3>
                                {player.tier && (
                                  <span
                                    className="friend-tier-chip"
                                    style={{
                                      borderColor: player.tier.color,
                                      color: player.tier.accent || player.tier.color,
                                    }}
                                  >
                                    {player.tier.icon} {player.tier.name}
                                  </span>
                                )}
                              </div>

                              <div className="showcase-stats-strip">
                                <div className="stat-pill">
                                  <Star size={12} className="stat-icon-star" />
                                  <span>{player.score || 0} Skor Global</span>
                                </div>
                                <div className="stat-pill">
                                  <Trophy size={12} className="stat-icon-gold" />
                                  <span>{player.wins || 0} Kali Juara 1</span>
                                </div>
                              </div>
                            </div>

                            <div className="showcase-action-box">
                              {status === 'self' && (
                                <span className="friend-badge-self">Ini Akun Kamu</span>
                              )}

                              {status === 'friend' && (
                                <span className="friend-badge-already">
                                  <Check size={14} /> Sudah Berteman
                                </span>
                              )}

                              {status === 'pending_outgoing' && (
                                <button
                                  type="button"
                                  className="btn-pending-outgoing"
                                  onClick={() => handleCancelOutgoing(player.name)}
                                  title="Klik untuk membatalkan permintaan"
                                >
                                  <Clock size={13} />
                                  <span>Menunggu ACC</span>
                                </button>
                              )}

                              {status === 'pending_incoming' && (
                                <button
                                  type="button"
                                  className="btn-acc-friend"
                                  onClick={() => handleAcceptRequest(player)}
                                >
                                  <Check size={14} />
                                  <span>Terima Permintaan</span>
                                </button>
                              )}

                              {status === 'none' && (
                                <button
                                  type="button"
                                  className="btn-add-friend-primary"
                                  onClick={() => handleSendRequest(player)}
                                >
                                  <UserPlus size={15} />
                                  <span>Kirim Permintaan</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Rekomendasi Pemain Top Global */}
              <div className="friends-recommendations-section">
                <div className="friends-section-title-row">
                  <Trophy size={16} className="text-gold" />
                  <h4>Rekomendasi Pemain Top Global</h4>
                </div>

                {isLoadingSuggestions ? (
                  <div className="friends-sub-empty">
                    <p>Memuat pemain Top Global...</p>
                  </div>
                ) : (
                  <div className="friends-recommendations-grid">
                    {topGlobalSuggestions.slice(0, 6).map((player) => {
                      const status = getFriendshipStatus(currentDisplayName, player.player_name);

                      return (
                        <div key={player.player_name} className="friend-rec-chip">
                          <AvatarDisplay
                            avatar={player.avatar}
                            fallback="👤"
                            size={24}
                            className="friend-rec-avatar"
                          />
                          <div className="friend-rec-info">
                            <span className="friend-rec-name">{player.player_name}</span>
                            <span className="friend-rec-score">★ {player.score} Skor</span>
                          </div>

                          <div className="friend-rec-action">
                            {status === 'friend' ? (
                              <span className="badge-check-mini">✓</span>
                            ) : status === 'pending_outgoing' ? (
                              <span className="badge-pending-mini">⏳</span>
                            ) : (
                              <button
                                type="button"
                                className="btn-rec-add"
                                onClick={() =>
                                  handleSendRequest({
                                    name: player.player_name,
                                    avatar: player.avatar,
                                    score: player.score,
                                    wins: player.wins,
                                    tier: player.tier,
                                  })
                                }
                                title="Tambah Teman"
                              >
                                <UserPlus size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================
            POPUP KONFIRMASI HAPUS TEMAN (CONFIRMATION DIALOG)
            =================================================================== */}
        {friendToDelete && (
          <div
            className="friends-confirm-overlay"
            onClick={() => setFriendToDelete(null)}
          >
            <div
              className="friends-confirm-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirm-icon-box">
                <AlertTriangle size={28} className="confirm-warning-icon" />
              </div>

              <h3 className="confirm-title">Hapus Pertemanan?</h3>

              <div className="confirm-profile-preview">
                <AvatarDisplay
                  avatar={friendToDelete.avatar}
                  fallback="👤"
                  size={28}
                  className="confirm-avatar"
                />
                <strong>{friendToDelete.name}</strong>
              </div>

              <p className="confirm-desc">
                Apakah kamu yakin ingin menghapus{' '}
                <strong style={{ color: '#f8fafc' }}>{friendToDelete.name}</strong> dari daftar
                teman? Kalian tidak akan lagi terhubung di daftar sahabat dan obrolan mabar.
              </p>

              <div className="confirm-btn-row">
                <button
                  type="button"
                  className="btn-confirm-cancel"
                  onClick={() => setFriendToDelete(null)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn-confirm-delete"
                  onClick={handleConfirmDeleteFriend}
                >
                  <Trash2 size={15} />
                  <span>Ya, Hapus Teman</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
