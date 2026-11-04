import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Globe,
  Gamepad2,
  ArrowRight,
  BookOpen,
  Wifi,
  WifiOff,
  Crown,
  Users,
  Sparkles,
  Layers,
  X,
  CheckCircle2,
  Bot,
  Trophy,
  Volume2,
  VolumeX,
  Edit3,
  Flame,
  Swords,
  Shield,
  ChevronRight,
  RotateCw,
  Check,
} from 'lucide-react';
import {
  fetchGlobalLeaderboard,
  normalizeUsernameKey,
  getPlayerRankTier,
  getSupremeTitle,
  getLocalPlayerProfile,
  saveLocalPlayerProfile,
  PROFILE_AVATARS,
} from '../services/leaderboardService';
import '../styles/modeSelection.css';

const BOT_PREVIEWS = [
  { name: 'Bot Raka', avatar: '🤖', style: 'Taktis & Agresif' },
  { name: 'Bot Sinta', avatar: '👾', style: 'Cermat & Waspada' },
  { name: 'Bot Dimas', avatar: '🦾', style: 'Solid & Konsisten' },
  { name: 'Bot Maya', avatar: '🎯', style: 'Presisi Tinggi' },
  { name: 'Bot Joko', avatar: '🧠', style: 'Ahli Kalkulasi' },
];

const GAME_CATALOG = [
  {
    id: 'sevens',
    title: 'Tujuh Sekop',
    subtitle: 'SEVENS TACTICAL RANKED',
    modeTag: '⚔️ RANKED FAVORITE',
    theme: 'gold',
    playersLabel: '2 - 6 Pemain',
    cornerSuit: '♠',
    description:
      'Rangkai kartu secara taktis dari angka 7 hingga As. Pasang perangkap kartu angka 6 & 8 dan hindari menutup kartu poin besar!',
    tags: ['Strategi Urutan', 'Penalti 6 & 8', 'Online & Bot AI'],
    ctaText: 'MULAI TUJUH SEKOP',
    fannedCards: [
      { rank: '6', suit: '♠', color: 'dark' },
      { rank: '7', suit: '♠', color: 'gold-highlight' },
      { rank: '8', suit: '♥', color: 'red' },
    ],
  },
  {
    id: 'game41',
    title: 'Remi 41',
    subtitle: 'KARTU 41 BATTLE ROYALE',
    modeTag: '💎 INSTANT WIN 41',
    theme: 'emerald',
    playersLabel: '2 - 6 Pemain',
    cornerSuit: '♥',
    description:
      'Kumpulkan 4 kartu bernilai 41 poin dari satu kembang. Oper kartu buangan ke lawan, raih skor tertinggi, atau menang instan 41 Murni!',
    tags: ['Oper Buangan', 'Instant Win 41', 'Satu Kembang'],
    ctaText: 'MULAI REMI 41',
    fannedCards: [
      { rank: '10', suit: '♥', color: 'red' },
      { rank: 'K', suit: '♥', color: 'red' },
      { rank: 'A', suit: '♥', color: 'gold-highlight' },
    ],
  },
  {
    id: 'bigtwo',
    title: 'Big Two',
    subtitle: 'CAPSA BANTING ARENA',
    modeTag: '🔥 POKER COMBO',
    theme: 'purple',
    playersLabel: '2 - 6 Pemain',
    cornerSuit: '♦',
    description:
      'Adu taktik habiskan kartu paling cepat! Kombinasikan Single, Pair, Triple, hingga 5 Kartu Poker. Angka 2 adalah raja tertinggi!',
    tags: ['Kombinasi Poker', 'Angka 2 Tertinggi', 'Single / Double Deck'],
    ctaText: 'MULAI BIG TWO',
    fannedCards: [
      { rank: '2', suit: '♣', color: 'dark' },
      { rank: '2', suit: '♥', color: 'red' },
      { rank: '2', suit: '♠', color: 'gold-highlight' },
    ],
  },
];

const MINI_LEADERBOARD_TABS = [
  { id: 'all', label: 'Global', icon: '👑' },
  { id: 'sevens', label: '7 Sekop', icon: '♠️' },
  { id: 'bigtwo', label: 'Big Two', icon: '🃏' },
  { id: 'game41', label: 'Remi 41', icon: '🎯' },
];

export default function ModeSelectionScreen({
  selectedGame = 'sevens',
  onSelectGame,
  onSelectMode,
  onOpenRules,
  onOpenScoreboard,
  isMuted = false,
  onToggleSound,
  currentMyId = '',
}) {
  const [activeGame, setActiveGame] = useState(selectedGame || 'sevens');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [offlinePlayerCount, setOfflinePlayerCount] = useState(4);
  const [botCount, setBotCount] = useState(1);
  const [deckMode, setDeckMode] = useState('double');

  // Player Profile State (MLBB Top-Left Profile Bar)
  const [profile, setProfile] = useState(() => getLocalPlayerProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editNameInput, setEditNameInput] = useState(() => getLocalPlayerProfile().name || '');
  const [editAvatarInput, setEditAvatarInput] = useState(() => getLocalPlayerProfile().avatar || '👑');

  // Live Top Global Preview State on Homepage
  const [previewCategory, setPreviewCategory] = useState('all');
  const [previewLeaderboard, setPreviewLeaderboard] = useState([]);
  const [allGlobalLeaderboard, setAllGlobalLeaderboard] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (selectedGame) {
      setActiveGame(selectedGame);
    }
  }, [selectedGame]);

  // Fetch All Global once for Player Rank Tier calculation, plus active preview category
  const loadHomepageLeaderboard = async (cat = previewCategory) => {
    setIsLoadingPreview(true);
    try {
      const res = await fetchGlobalLeaderboard(cat, 25);
      setPreviewLeaderboard(res.data || []);
      if (cat === 'all') {
        setAllGlobalLeaderboard(res.data || []);
      } else if (allGlobalLeaderboard.length === 0) {
        const allRes = await fetchGlobalLeaderboard('all', 50);
        setAllGlobalLeaderboard(allRes.data || []);
      }
    } catch (e) {
      console.warn('Failed to load homepage leaderboard preview:', e);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    loadHomepageLeaderboard(previewCategory);
  }, [previewCategory]);

  // Identify current player's global standing for Top-Left Profile Bar
  const myGlobalStats = useMemo(() => {
    const normName = normalizeUsernameKey(profile.name);
    const sourceList = allGlobalLeaderboard.length > 0 ? allGlobalLeaderboard : previewLeaderboard;
    if (!sourceList || sourceList.length === 0) return null;

    const idx = sourceList.findIndex((item) => {
      if (currentMyId && (item.player_id === currentMyId || (item.player_ids || []).includes(currentMyId))) {
        return true;
      }
      const itemNorm = normalizeUsernameKey(item.player_name);
      return Boolean(normName && itemNorm && itemNorm === normName);
    });

    if (idx === -1) return null;
    return {
      rank: idx + 1,
      ...sourceList[idx],
    };
  }, [allGlobalLeaderboard, previewLeaderboard, profile.name, currentMyId]);

  const myRankTier = useMemo(
    () => getPlayerRankTier(myGlobalStats?.score || 0, myGlobalStats?.wins || 0),
    [myGlobalStats]
  );

  const handleSaveProfile = (e) => {
    if (e) e.preventDefault();
    const cleanedName = editNameInput.trim() || 'Player';
    const chosenAvatar = editAvatarInput || '👑';
    saveLocalPlayerProfile({ name: cleanedName, avatar: chosenAvatar });
    setProfile({ name: cleanedName, avatar: chosenAvatar });
    setIsProfileModalOpen(false);
  };

  // Mobile bottom sheet drag-down-to-close gesture handling
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartYRef = useRef(0);
  const currentDragYRef = useRef(0);
  const sheetRef = useRef(null);

  const startDrag = (clientY) => {
    dragStartYRef.current = clientY;
    currentDragYRef.current = clientY;
    setIsDraggingSheet(true);
  };

  const updateDrag = (clientY, cancelableEvent = null) => {
    if (!isDraggingSheet) return;
    currentDragYRef.current = clientY;
    const deltaY = clientY - dragStartYRef.current;

    if (deltaY > 0) {
      if (cancelableEvent && cancelableEvent.cancelable) {
        cancelableEvent.preventDefault();
      }
      setDragOffsetY(deltaY);
    } else {
      setDragOffsetY(0);
    }
  };

  const endDrag = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    const deltaY = currentDragYRef.current - dragStartYRef.current;

    if (deltaY > 55) {
      setDragOffsetY(window.innerHeight);
      setTimeout(() => {
        setIsModalOpen(false);
        setDragOffsetY(0);
      }, 180);
    } else {
      setDragOffsetY(0);
    }
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      startDrag(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      updateDrag(e.touches[0].clientY, e);
    }
  };

  const handleTouchEnd = () => {
    endDrag();
  };

  const handleMouseDown = (e) => {
    startDrag(e.clientY);
    const handleMouseMove = (ev) => updateDrag(ev.clientY, ev);
    const handleMouseUp = () => {
      endDrag();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (!isModalOpen) {
      setDragOffsetY(0);
      setIsDraggingSheet(false);
    }
  }, [isModalOpen]);

  const currentGameObj =
    GAME_CATALOG.find((g) => g.id === activeGame) || GAME_CATALOG[0];

  const handlePickGame = (gameId) => {
    setActiveGame(gameId);
    if (onSelectGame) onSelectGame(gameId);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (isProfileModalOpen) setIsProfileModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isProfileModalOpen]);

  const renderDealInfoForCount = (count) => {
    if (activeGame === 'sevens') {
      if (count === 6)
        return (
          <span>
            Setiap pemain dapat <strong>8 kartu</strong> (semua angka 7 otomatis di meja)
          </span>
        );
      if (count === 5)
        return (
          <span>
            Setiap pemain dapat <strong>10 kartu</strong> (7♠ & 7♥ otomatis di meja)
          </span>
        );
      if (count === 3)
        return (
          <span>
            Setiap pemain dapat <strong>17 kartu</strong> (7♠ otomatis di meja)
          </span>
        );
      if (count === 2)
        return (
          <span>
            Duel 1 vs 1 • Setiap pemain dapat <strong>26 kartu</strong>
          </span>
        );
      return (
        <span>
          Standar Klasik • Setiap pemain dapat <strong>13 kartu</strong> penuh
        </span>
      );
    }

    if (activeGame === 'bigtwo') {
      if (count === 2) {
        return (
          <span>
            Single Deck (52 kartu) • Duel 1 vs 1: Setiap pemain dapat <strong>26 kartu</strong> penuh. Pemegang{' '}
            <strong>3♦</strong> jalan pertama.
          </span>
        );
      }
      if (count === 3) {
        return (
          <span>
            Single Deck (52 kartu) • 3 Pemain: Setiap pemain dapat <strong>17–18 kartu</strong> (semua 52 kartu dibagi habis). Pemegang{' '}
            <strong>3♦</strong> jalan pertama.
          </span>
        );
      }
      if (count === 4) {
        return (
          <span>
            Single Deck (52 kartu) • Standar 4 Pemain: Setiap pemain dapat <strong>13 kartu</strong> penuh. Pemegang{' '}
            <strong>3♦</strong> jalan pertama.
          </span>
        );
      }
      if (count === 5) {
        return (
          <span>
            {deckMode === 'double' ? (
              <>
                Mode <strong>Double Deck (104 kartu)</strong> • 5 Pemain: Setiap pemain dapat <strong>20–21 kartu</strong> (dibagi habis).
              </>
            ) : (
              <>
                Mode <strong>Single Deck (52 kartu)</strong> • 5 Pemain: Setiap pemain dapat <strong>10–11 kartu</strong> (dibagi habis).
              </>
            )}
          </span>
        );
      }
      if (count === 6) {
        return (
          <span>
            {deckMode === 'double' ? (
              <>
                Mode <strong>Double Deck (104 kartu)</strong> • 6 Pemain: Setiap pemain dapat <strong>17–18 kartu</strong> (dibagi habis).
              </>
            ) : (
              <>
                Mode <strong>Single Deck (52 kartu)</strong> • 6 Pemain: Setiap pemain dapat <strong>8–9 kartu</strong> (dibagi habis).
              </>
            )}
          </span>
        );
      }
    }

    return (
      <span>
        Setiap pemain memegang <strong>4 kartu</strong> di tangan • Kumpulkan skor{' '}
        <strong>41 poin</strong> satu kembang!
      </span>
    );
  };

  const topThreePreview = previewLeaderboard.slice(0, 3);

  return (
    <div className="mode-selection-overlay mlbb-lobby-screen">
      {/* Latar Atmosfer Land of Dawn / Royal Arena */}
      <div className="mode-bg-decor" aria-hidden="true">
        <div className="felt-radial-spotlight" />
        <div className="mlbb-arcane-halo halo-left" />
        <div className="mlbb-arcane-halo halo-right" />
        <span className="decor-suit decor-suit-1">♠</span>
        <span className="decor-suit decor-suit-2">♥</span>
        <span className="decor-suit decor-suit-3">♦</span>
        <span className="decor-suit decor-suit-4">♣</span>
      </div>

      <div className="mode-selection-container">
        {/* ===================================================================
            1. TOP MLBB HUD BAR (Player Profile Left • Season Center • Actions Right)
            =================================================================== */}
        <nav className="mlbb-top-hud" aria-label="Lobby HUD">
          {/* LEFT: Player Profile & Rank Tier Corner (Clickable) */}
          <button
            type="button"
            className="mlbb-profile-corner"
            onClick={() => {
              setEditNameInput(profile.name || '');
              setEditAvatarInput(profile.avatar || '👑');
              setIsProfileModalOpen(true);
            }}
            title="Klik untuk mengganti Nickname & Avatar Profil Top Global"
          >
            <div className={`mlbb-avatar-hex tier-border-${myRankTier.id}`}>
              <span className="mlbb-avatar-icon">{profile.avatar || '👑'}</span>
              <span className="mlbb-avatar-tier-mini">{myRankTier.icon}</span>
            </div>

            <div className="mlbb-profile-info">
              <div className="mlbb-profile-name-row">
                <span className="mlbb-profile-nickname">
                  {profile.name || 'Atur Nickname'}
                </span>
                <span className="mlbb-edit-badge">
                  <Edit3 size={11} />
                </span>
              </div>

              <div className="mlbb-profile-rank-row">
                <span
                  className="mlbb-rank-chip"
                  style={{ borderColor: myRankTier.color, color: myRankTier.accent }}
                >
                  {myRankTier.icon} {myRankTier.shortName}
                </span>
                <span className="mlbb-star-chip">
                  ★ {myGlobalStats?.score || 0}
                </span>
                {myGlobalStats?.rank && (
                  <span className="mlbb-global-pos-chip">
                    #{myGlobalStats.rank} Global
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* CENTER: Season & Server Crest */}
          <div className="mlbb-hud-center">
            <div className="mlbb-season-banner">
              <Crown size={14} className="season-crown-svg" />
              <span>SEASON 1 • ROYAL CARD ARENA</span>
              <span className="mlbb-ping-dot" title="Server Online • Realtime">
                <i /> 14ms
              </span>
            </div>
          </div>

          {/* RIGHT: Leaderboard & Audio Controls */}
          <div className="mlbb-hud-right">
            {onToggleSound && (
              <button
                type="button"
                className={`mlbb-hud-icon-btn ${isMuted ? 'is-muted' : ''}`}
                onClick={onToggleSound}
                title={isMuted ? 'Nyalakan Efek Suara' : 'Matikan Efek Suara'}
              >
                {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
            )}

            <button
              type="button"
              className="mlbb-hud-icon-btn"
              onClick={() => onOpenRules && onOpenRules(activeGame)}
              title="Buku Panduan & Aturan Main"
            >
              <BookOpen size={17} />
              <span className="hud-btn-label">Panduan</span>
            </button>

            {onOpenScoreboard && (
              <button
                type="button"
                className="mlbb-hud-leaderboard-btn"
                onClick={() => onOpenScoreboard('all')}
                title="Buka Peringkat Supreme Top Global"
              >
                <Trophy size={17} className="trophy-gold-svg" />
                <span>TOP GLOBAL</span>
                <span className="hud-live-tag">SUPREME</span>
              </button>
            )}
          </div>
        </nav>

        {/* ===================================================================
            2. HERO TITLE & LIVE TOP GLOBAL SUPREME DOCK
            =================================================================== */}
        <section className="mlbb-hero-showcase">
          {/* Left: Lobby Title & Rank Callout */}
          <div className="mlbb-hero-copy">
            <div className="mlbb-title-eyebrow">
              <Swords size={14} />
              <span>MULTIPLAYER COMPETITIVE CARD LOUNGE</span>
            </div>

            <h1 className="mode-main-title">
              LAND OF <span className="mode-title-gold">ROYAL CARDS</span>
            </h1>

            <p className="mode-main-subtitle">
              Pilih arena pertempuran kartu favoritmu. Menangkan <strong>Juara 1 di Mode Online</strong>{' '}
              untuk mengumpulkan <strong>★ Bintang Skor</strong> dan raih gelar{' '}
              <strong>Supreme Top Global</strong>!
            </p>

            <div className="mlbb-hero-cta-group">
              <button
                type="button"
                className="btn-mlbb-quick-rank"
                onClick={() => onOpenScoreboard && onOpenScoreboard('all')}
              >
                <Crown size={18} />
                <span>Lihat Hall of Fame Top Global</span>
                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                className="btn-mlbb-set-nick"
                onClick={() => {
                  setEditNameInput(profile.name || '');
                  setEditAvatarInput(profile.avatar || '👑');
                  setIsProfileModalOpen(true);
                }}
              >
                <span>{profile.avatar || '👑'}</span>
                <span>
                  {profile.name ? `Profil: ${profile.name}` : 'Pasang Nickname Top Global'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Live Top Global Mini Podium Dock (MLBB Ranking Widget) */}
          <div className="mlbb-live-rank-dock">
            <div className="rank-dock-header">
              <div className="rank-dock-title-wrap">
                <Trophy size={16} className="text-gold" />
                <div>
                  <h2 className="rank-dock-title">SUPREME TOP GLOBAL</h2>
                  <span className="rank-dock-sub">Live Hall of Fame</span>
                </div>
              </div>

              <div className="rank-dock-tabs">
                {MINI_LEADERBOARD_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`dock-tab-btn ${previewCategory === t.id ? 'active' : ''}`}
                    onClick={() => setPreviewCategory(t.id)}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rank-dock-list">
              {isLoadingPreview && topThreePreview.length === 0 ? (
                <div className="rank-dock-empty">
                  <RotateCw size={18} className="is-spinning text-gold" />
                  <span>Memuat Supreme Champions...</span>
                </div>
              ) : topThreePreview.length > 0 ? (
                topThreePreview.map((player, index) => {
                  const rankNum = index + 1;
                  const wins = Number(player.wins || 0);
                  const score = Number(player.score || 0);
                  const games = Number(player.games_played || 0);
                  const wr = games > 0 ? Math.round((wins / games) * 100) : 0;
                  const tier = getPlayerRankTier(score, wins);
                  const supreme = getSupremeTitle(rankNum, previewCategory);

                  return (
                    <div
                      key={player.player_id || player.player_name || rankNum}
                      className={`rank-dock-item dock-rank-${rankNum}`}
                      onClick={() => onOpenScoreboard && onOpenScoreboard(previewCategory)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenScoreboard && onOpenScoreboard(previewCategory);
                        }
                      }}
                    >
                      <div className={`dock-rank-badge badge-pos-${rankNum}`}>
                        {rankNum === 1 ? '👑 #1' : rankNum === 2 ? '🥈 #2' : '🥉 #3'}
                      </div>

                      <div className={`dock-player-avatar tier-border-${tier.id}`}>
                        <span>{player.avatar || '👑'}</span>
                      </div>

                      <div className="dock-player-info">
                        <div className="dock-player-name-row">
                          <strong className="dock-player-name">{player.player_name}</strong>
                          <span
                            className="dock-tier-pill"
                            style={{ borderColor: `${tier.color}88`, color: tier.accent }}
                          >
                            {tier.icon} {tier.shortName}
                          </span>
                        </div>
                        <span className="dock-supreme-title">{supreme.fullTitle} • {wr}% WR</span>
                      </div>

                      <div className="dock-player-stats">
                        <span className="dock-stat-wins" title="Juara 1">
                          🏆 {wins}
                        </span>
                        <span className="dock-stat-score" title="Total Bintang Skor">
                          ★ {score}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rank-dock-empty">
                  <span>🏆 Belum ada Supreme Champion di kategori ini.</span>
                  <small>Main Online sekarang untuk merebut Tahta #1!</small>
                </div>
              )}
            </div>

            <div className="rank-dock-footer">
              <span className="dock-my-standing">
                {myGlobalStats
                  ? `Posisi Kamu: #${myGlobalStats.rank} (${myRankTier.icon} ${myRankTier.shortName} • ★ ${myGlobalStats.score})`
                  : 'Status Kamu: Unranked (Main Online untuk masuk Top Global)'}
              </span>
              <button
                type="button"
                className="btn-dock-full"
                onClick={() => onOpenScoreboard && onOpenScoreboard(previewCategory)}
              >
                <span>Semua Ranking</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================================
            3. KATALOG 3 GAME MODE KARTU (MLBB MODE SELECTION CARDS)
            =================================================================== */}
        <div className="mlbb-section-heading">
          <div className="section-heading-left">
            <span className="section-diamond">◆</span>
            <h2>PILIH MODE PERMAINAN</h2>
            <span className="section-sub-pill">RANKED • CLASSIC • VS AI</span>
          </div>
          <span className="section-heading-hint">
            Klik kartu game untuk memilih lawan (Bot AI, Online Mabar, atau Offline)
          </span>
        </div>

        <div className="game-catalog-grid">
          {GAME_CATALOG.map((game) => (
            <div
              key={game.id}
              className={`game-catalog-card mlbb-mode-banner theme-${game.theme} ${
                activeGame === game.id ? 'is-selected-card' : ''
              }`}
              onClick={() => handlePickGame(game.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePickGame(game.id);
                }
              }}
            >
              {/* Glow Aksen Kartu */}
              <div className="card-ambient-glow" aria-hidden="true" />
              <div className="mlbb-card-corner-tl" aria-hidden="true" />
              <div className="mlbb-card-corner-br" aria-hidden="true" />

              {/* Baris Atas: Mode Tag + Tombol Cepat Top Global & Aturan */}
              <div className="catalog-card-header">
                <span className={`catalog-badge badge-${game.theme}`}>
                  <span>{game.modeTag}</span>
                </span>

                <div className="catalog-header-actions-right">
                  {onOpenScoreboard && (
                    <button
                      type="button"
                      className="btn-card-rules-mini btn-card-rank-mini"
                      title={`Lihat Top Global ${game.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenScoreboard(game.id);
                      }}
                    >
                      <Trophy size={12} className="card-mini-trophy" />
                      <span>Top Global</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-card-rules-mini"
                    title={`Aturan Main ${game.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenRules) onOpenRules(game.id);
                    }}
                  >
                    <BookOpen size={12} />
                    <span>Aturan</span>
                  </button>
                </div>
              </div>

              {/* Ilustrasi Tumpukan Kartu Remi 3D (Fanned Cards) */}
              <div className="catalog-fanned-stage" aria-hidden="true">
                <div className="fanned-cards-group">
                  {game.fannedCards.map((c, idx) => (
                    <div
                      key={idx}
                      className={`mini-playing-card card-pos-${idx} card-tone-${c.color}`}
                    >
                      <span className="mini-card-corner">
                        <strong>{c.rank}</strong>
                        <small>{c.suit}</small>
                      </span>
                      <span className="mini-card-center-suit">{c.suit}</span>
                    </div>
                  ))}
                </div>
                <span className="stage-players-pill">
                  <Users size={11} /> {game.playersLabel}
                </span>
                <span className="stage-watermark-suit">{game.cornerSuit}</span>
              </div>

              {/* Konten Teks & Fitur */}
              <div className="catalog-card-body">
                <div className="catalog-title-group">
                  <span className="catalog-card-subtitle">{game.subtitle}</span>
                  <h3 className="catalog-card-title">{game.title}</h3>
                </div>

                <p className="catalog-card-desc">{game.description}</p>

                <div className="catalog-features-tags">
                  {game.tags.map((tag) => (
                    <span key={tag} className="feature-pill">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="catalog-card-footer">
                <button type="button" className={`btn-catalog-play btn-${game.theme}`}>
                  <span>{game.ctaText}</span>
                  <ArrowRight size={17} className="btn-arrow-icon" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===================================================================
          MODAL EDIT PROFIL & NICKNAME TOP GLOBAL (MLBB PROFILE CARD)
          =================================================================== */}
      {isProfileModalOpen && (
        <div
          className="mode-modal-backdrop"
          onClick={() => setIsProfileModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="mlbb-profile-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mlbb-profile-modal-header">
              <div className="profile-modal-title-group">
                <Crown size={20} className="text-gold" />
                <div>
                  <h3>PROFIL PEMAIN & TOP GLOBAL</h3>
                  <span>Identitas Resmi untuk Match Online & Leaderboard</span>
                </div>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsProfileModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Rank Banner */}
            <div className="mlbb-profile-rank-showcase">
              <div className={`showcase-avatar tier-border-${myRankTier.id}`}>
                <span>{editAvatarInput || '👑'}</span>
              </div>
              <div className="showcase-details">
                <div className="showcase-tier-line">
                  <span
                    className="showcase-tier-badge"
                    style={{ borderColor: myRankTier.color, color: myRankTier.accent }}
                  >
                    {myRankTier.icon} {myRankTier.name}
                  </span>
                  <span className="showcase-rank-pos">
                    {myGlobalStats ? `Peringkat #${myGlobalStats.rank} Global` : 'Unranked'}
                  </span>
                </div>
                <div className="showcase-stats-line">
                  <span>🏆 <strong>{myGlobalStats?.wins || 0}</strong> Juara 1</span>
                  <span>•</span>
                  <span>★ <strong>{myGlobalStats?.score || 0}</strong> Skor Poin</span>
                  <span>•</span>
                  <span>🎮 <strong>{myGlobalStats?.games_played || 0}</strong> Match</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="mlbb-profile-form">
              <label className="mlbb-form-label">
                <span>Nickname Pemain (Digunakan saat Online & Top Global)</span>
                <input
                  type="text"
                  className="mlbb-form-input"
                  placeholder="Masukkan Nickname andalanmu..."
                  maxLength={20}
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  autoFocus
                />
              </label>

              <div className="mlbb-form-label">
                <span>Pilih Avatar Commander</span>
                <div className="mlbb-avatar-picker-grid">
                  {PROFILE_AVATARS.map((av) => (
                    <button
                      key={av}
                      type="button"
                      className={`mlbb-avatar-option ${editAvatarInput === av ? 'selected' : ''}`}
                      onClick={() => setEditAvatarInput(av)}
                    >
                      <span>{av}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mlbb-profile-tip">
                💡 <strong>Tips Supreme:</strong> Selalu gunakan Nickname yang sama agar setiap kemenangan{' '}
                <strong>Juara 1</strong> dan <strong>★ Skor</strong> kamu terus terakumulasi di Top Global!
              </div>

              <div className="mlbb-profile-modal-actions">
                <button
                  type="button"
                  className="btn-profile-cancel"
                  onClick={() => setIsProfileModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-profile-save">
                  <Check size={16} />
                  <span>Simpan Profil</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL / BOTTOM SHEET KONFIGURASI MODE & JUMLAH PEMAIN
          =================================================================== */}
      {isModalOpen && (
        <div
          className="mode-modal-backdrop"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-game-title"
          style={{
            opacity: dragOffsetY > 0 ? Math.max(0.15, 1 - dragOffsetY / 350) : undefined,
            transition: isDraggingSheet ? 'none' : 'opacity 0.2s ease',
          }}
        >
          <div
            ref={sheetRef}
            className={`mode-modal-sheet theme-${currentGameObj.theme}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
              transition: isDraggingSheet ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.4, 1)',
            }}
          >
            {/* Indikator Geser untuk Mobile Bottom Sheet */}
            <div
              className="sheet-drag-handle"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onClick={() => setIsModalOpen(false)}
              role="button"
              tabIndex={0}
              aria-label="Tarik ke bawah atau klik untuk menutup"
              title="Tarik ke bawah atau klik untuk menutup"
            >
              <div className="sheet-drag-bar" />
            </div>

            {/* Header Modal */}
            <div
              className="mode-modal-header"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
            >
              <div className="modal-game-identity">
                <div className="modal-mini-fan" aria-hidden="true">
                  {currentGameObj.fannedCards.slice(1).map((c, idx) => (
                    <div
                      key={idx}
                      className={`modal-tiny-card card-tone-${c.color}`}
                    >
                      <span>{c.rank}</span>
                      <small>{c.suit}</small>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="modal-game-badge-row">
                    <span className={`catalog-badge badge-${currentGameObj.theme}`}>
                      {currentGameObj.subtitle}
                    </span>
                  </div>
                  <h2 id="modal-game-title" className="modal-game-title">
                    Pilih Lobby Pertandingan — <span>{currentGameObj.title}</span>
                  </h2>
                </div>
              </div>

              <div className="modal-header-actions">
                {onOpenScoreboard && (
                  <button
                    type="button"
                    className="btn-modal-rules"
                    onClick={() => {
                      setIsModalOpen(false);
                      onOpenScoreboard(activeGame);
                    }}
                  >
                    <Trophy size={14} className="text-gold" />
                    <span>Top Global</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn-modal-rules"
                  onClick={() => onOpenRules && onOpenRules(activeGame)}
                >
                  <BookOpen size={15} />
                  <span>Panduan & Aturan</span>
                </button>

                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Tutup"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Grid 3 Pilihan Mode: Single Player Bot vs Online vs Offline Pass & Play */}
            <div className="mode-cards-grid">
              {/* OPSI 1: SINGLE PLAYER (LAWAN BOT AI) */}
              <div
                className="mode-card mode-card-single"
                onClick={() =>
                  onSelectMode('single', botCount + 1, activeGame, {
                    botCount,
                    deckMode: botCount + 1 > 4 ? deckMode : 'single',
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMode('single', botCount + 1, activeGame, {
                      botCount,
                      deckMode: botCount + 1 > 4 ? deckMode : 'single',
                    });
                  }
                }}
              >
                <div className="mode-card-top">
                  <span className="mode-card-badge badge-single">
                    <Bot size={13} />
                    <span>VS AI • Custom Training</span>
                  </span>

                  <div className="mode-card-title-row">
                    <div className="mode-card-icon-bubble bubble-single">
                      <Bot size={28} className="icon-pulse" />
                    </div>
                    <div>
                      <h3 className="mode-card-title">Main Lawan Bot</h3>
                      <p className="mode-card-subtitle">
                        Latihan Taktik Lawan AI Commander
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="mode-card-body"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="offline-player-selector">
                    <div className="selector-header-row">
                      <label className="selector-title">
                        <Bot size={14} />
                        <span>Jumlah Bot AI</span>
                      </label>
                      <span className="selector-active-pill pill-single">
                        {botCount} Bot ({botCount + 1} Pemain)
                      </span>
                    </div>

                    <div className="player-count-buttons">
                      {[1, 2, 3, 4, 5].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`btn-player-pill btn-bot-pill ${
                            botCount === count ? 'active' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setBotCount(count);
                          }}
                        >
                          <span className="count-num">{count}</span>
                          <span className="count-unit">Bot</span>
                        </button>
                      ))}
                    </div>

                    <div className="bot-roster-preview">
                      <span className="bot-roster-label">Lawan Anda:</span>
                      <div className="bot-roster-chips">
                        {BOT_PREVIEWS.slice(0, botCount).map((b, idx) => (
                          <span key={idx} className="bot-chip-pill" title={b.style}>
                            <span className="bot-chip-avatar">{b.avatar}</span>
                            <span className="bot-chip-name">{b.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {activeGame === 'bigtwo' && botCount + 1 > 4 && (
                      <div className="deck-mode-selector">
                        <span className="deck-mode-label">
                          <Layers size={13} />
                          <span>Tipe Deck:</span>
                        </span>
                        <div className="deck-toggle-group">
                          <button
                            type="button"
                            className={`btn-deck-toggle ${
                              deckMode === 'single' ? 'active' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeckMode('single');
                            }}
                          >
                            Single (52)
                          </button>
                          <button
                            type="button"
                            className={`btn-deck-toggle ${
                              deckMode === 'double' ? 'active' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeckMode('double');
                            }}
                          >
                            Double (104)
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="player-count-detail-note">
                      <Sparkles size={14} className="note-sparkle-icon" />
                      {renderDealInfoForCount(botCount + 1)}
                    </div>
                  </div>
                </div>

                <div className="mode-card-footer">
                  <button
                    type="button"
                    className="btn-mode-action btn-single-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMode('single', botCount + 1, activeGame, {
                        botCount,
                        deckMode: botCount + 1 > 4 ? deckMode : 'single',
                      });
                    }}
                  >
                    <span>Mulai Match (1 vs {botCount} Bot AI)</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>

              {/* OPSI 2: MAIN ONLINE (MULTIPLAYER RANKED) */}
              <div
                className="mode-card mode-card-online"
                onClick={() =>
                  onSelectMode('multiplayer', null, activeGame, {
                    deckMode,
                    playerCount: botCount + 1,
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMode('multiplayer', null, activeGame, {
                      deckMode,
                      playerCount: botCount + 1,
                    });
                  }
                }}
              >
                <div className="mode-card-top">
                  <span className="mode-card-badge badge-online">
                    <Wifi size={13} />
                    <span>RANKED • Online Multiplayer</span>
                  </span>

                  <div className="mode-card-title-row">
                    <div className="mode-card-icon-bubble bubble-online">
                      <Globe size={28} className="icon-pulse" />
                    </div>
                    <div>
                      <h3 className="mode-card-title">Main Online (Ranked)</h3>
                      <p className="mode-card-subtitle">
                        Mabar Realtime & Push Top Global
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mode-card-body">
                  <ul className="mode-perks-list">
                    <li>
                      <CheckCircle2 size={15} className="perk-check online-check" />
                      <span>Menang Juara 1 otomatis menambah ★ Skor Top Global</span>
                    </li>
                    <li>
                      <CheckCircle2 size={15} className="perk-check online-check" />
                      <span>Matchmaking cepat atau buat Room Mabar 6 digit</span>
                    </li>
                    <li>
                      <CheckCircle2 size={15} className="perk-check online-check" />
                      <span>Dilengkapi Live Voice Chat (On-Mic), Soundboard & Emote</span>
                    </li>
                  </ul>
                </div>

                <div className="mode-card-footer">
                  <button
                    type="button"
                    className="btn-mode-action btn-online"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMode('multiplayer', null, activeGame, {
                        deckMode,
                        playerCount: botCount + 1,
                      });
                    }}
                  >
                    <span>Masuk Lobby Ranked Online</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>

              {/* OPSI 3: MAIN OFFLINE (PASS & PLAY 1 PERANGKAT) */}
              <div
                className="mode-card mode-card-offline"
                onClick={() =>
                  onSelectMode('local', offlinePlayerCount, activeGame, {
                    deckMode: offlinePlayerCount > 4 ? deckMode : 'single',
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMode('local', offlinePlayerCount, activeGame, {
                      deckMode: offlinePlayerCount > 4 ? deckMode : 'single',
                    });
                  }
                }}
              >
                <div className="mode-card-top">
                  <span className="mode-card-badge badge-offline">
                    <WifiOff size={13} />
                    <span>LOCAL • Pass & Play</span>
                  </span>

                  <div className="mode-card-title-row">
                    <div className="mode-card-icon-bubble bubble-offline">
                      <Gamepad2 size={28} />
                    </div>
                    <div>
                      <h3 className="mode-card-title">Main Offline</h3>
                      <p className="mode-card-subtitle">
                        1 Perangkat Bergantian Tanpa Kuota
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="mode-card-body"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="offline-player-selector">
                    <div className="selector-header-row">
                      <label className="selector-title">
                        <Users size={14} />
                        <span>Jumlah Pemain</span>
                      </label>
                      <span className="selector-active-pill">
                        {offlinePlayerCount} Orang
                      </span>
                    </div>

                    <div className="player-count-buttons">
                      {[2, 3, 4, 5, 6].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`btn-player-pill ${
                            offlinePlayerCount === count ? 'active' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOfflinePlayerCount(count);
                          }}
                        >
                          <span className="count-num">{count}</span>
                          <span className="count-unit">Pemain</span>
                        </button>
                      ))}
                    </div>

                    {activeGame === 'bigtwo' && offlinePlayerCount > 4 && (
                      <div className="deck-mode-selector">
                        <span className="deck-mode-label">
                          <Layers size={13} />
                          <span>Tipe Deck:</span>
                        </span>
                        <div className="deck-toggle-group">
                          <button
                            type="button"
                            className={`btn-deck-toggle ${
                              deckMode === 'single' ? 'active' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeckMode('single');
                            }}
                          >
                            Single (52 Kartu)
                          </button>
                          <button
                            type="button"
                            className={`btn-deck-toggle ${
                              deckMode === 'double' ? 'active' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeckMode('double');
                            }}
                          >
                            Double (104 Kartu)
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="player-count-detail-note">
                      <Sparkles size={14} className="note-sparkle-icon" />
                      {renderDealInfoForCount(offlinePlayerCount)}
                    </div>
                  </div>
                </div>

                <div className="mode-card-footer">
                  <button
                    type="button"
                    className="btn-mode-action btn-offline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMode('local', offlinePlayerCount, activeGame, {
                        deckMode: offlinePlayerCount > 4 ? deckMode : 'single',
                      });
                    }}
                  >
                    <span>Mulai Match ({offlinePlayerCount} Pemain)</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
