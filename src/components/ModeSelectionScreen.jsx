import React, { useState, useEffect, useRef } from 'react';
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
  Plus,
  Minus,
} from 'lucide-react';
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
    subtitle: 'SEVENS CARD GAME',
    theme: 'gold',
    playersLabel: '2 - 6 Pemain',
    cornerSuit: '♠',
    description:
      'Rangkai kartu secara taktis dari angka 7 hingga As. Pasang perangkap kartu angka 6 & 8 dan hindari menutup kartu poin besar!',
    tags: ['Strategi Urutan', 'Penalti 6 & 8', 'Online & Offline'],
    ctaText: 'Main Tujuh Sekop',
    fannedCards: [
      { rank: '6', suit: '♠', color: 'dark' },
      { rank: '7', suit: '♠', color: 'gold-highlight' },
      { rank: '8', suit: '♥', color: 'red' },
    ],
  },
  {
    id: 'game41',
    title: 'Remi 41',
    subtitle: 'KARTU 41 INDONESIA',
    theme: 'emerald',
    playersLabel: '2 - 6 Pemain',
    cornerSuit: '♥',
    description:
      'Kumpulkan 4 kartu bernilai 41 poin dari satu kembang. Oper kartu buangan ke lawan, raih skor tertinggi, atau menang instan 41 Murni!',
    tags: ['Oper Buangan', 'Instant Win 41', 'Satu Kembang'],
    ctaText: 'Main Remi 41',
    fannedCards: [
      { rank: '10', suit: '♥', color: 'red' },
      { rank: 'K', suit: '♥', color: 'red' },
      { rank: 'A', suit: '♥', color: 'gold-highlight' },
    ],
  },
  {
    id: 'bigtwo',
    title: 'Big Two',
    subtitle: 'CAPSA BANTING',
    theme: 'purple',
    playersLabel: '2 - 6 Pemain',
    cornerSuit: '♦',
    description:
      'Adu taktik habiskan kartu paling cepat! Kombinasikan Single, Pair, Triple, hingga 5 Kartu Poker. Angka 2 adalah raja tertinggi!',
    tags: ['Kombinasi Poker', 'Angka 2 Tertinggi', 'Single / Double Deck'],
    ctaText: 'Main Big Two',
    fannedCards: [
      { rank: '2', suit: '♣', color: 'dark' },
      { rank: '2', suit: '♥', color: 'red' },
      { rank: '2', suit: '♠', color: 'gold-highlight' },
    ],
  },
];

export default function ModeSelectionScreen({
  selectedGame = 'sevens',
  onSelectGame,
  onSelectMode,
  onOpenRules,
}) {
  const [activeGame, setActiveGame] = useState(selectedGame || 'sevens');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [offlinePlayerCount, setOfflinePlayerCount] = useState(4);
  const [botCount, setBotCount] = useState(1); // Default: 1 Bot (Main berdua: Anda + 1 Bot)
  const [deckMode, setDeckMode] = useState('double');

  useEffect(() => {
    if (selectedGame) {
      setActiveGame(selectedGame);
    }
  }, [selectedGame]);

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

    // Only allow dragging downwards
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

    // If dragged down by more than 55px, dismiss bottom sheet smoothly
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

  // Reset drag position when modal opens or closes
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

  // Tutup modal dengan tombol Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

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

    // Remi 41
    return (
      <span>
        Setiap pemain memegang <strong>4 kartu</strong> di tangan • Kumpulkan skor{' '}
        <strong>41 poin</strong> satu kembang!
      </span>
    );
  };

  return (
    <div className="mode-selection-overlay">
      {/* Ornamen Latar Meja Kasino */}
      <div className="mode-bg-decor" aria-hidden="true">
        <div className="felt-radial-spotlight" />
        <span className="decor-suit decor-suit-1">♠</span>
        <span className="decor-suit decor-suit-2">♥</span>
        <span className="decor-suit decor-suit-3">♦</span>
        <span className="decor-suit decor-suit-4">♣</span>
      </div>

      <div className="mode-selection-container">
        {/* ===================================================================
            HEADER PORTAL
            =================================================================== */}
        <header className="mode-selection-header">
          <div className="catalog-top-pill">
            <Crown size={14} className="pill-crown-icon" />
            <span>ROYAL TABLETOP LOUNGE</span>
          </div>

          <h1 className="mode-main-title">
            ROYAL CARD <span className="mode-title-gold">PORTAL</span>
          </h1>

          <p className="mode-main-subtitle">
            Pilih permainan kartu favorit Anda. Mainkan secara <strong>Realtime Online</strong>{' '}
            bersama teman atau <strong>Pass & Play Offline</strong> dalam satu perangkat.
          </p>
        </header>

        {/* ===================================================================
            KATALOG 3 GAME KARTU DENGAN ILUSTRASI KARTU 3D
            =================================================================== */}
        <div className="game-catalog-grid">
          {GAME_CATALOG.map((game) => (
            <div
              key={game.id}
              className={`game-catalog-card theme-${game.theme} ${
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

              {/* Baris Atas: Jumlah Pemain + Tombol Cepat Buku Panduan */}
              <div className="catalog-card-header">
                <span className={`catalog-badge badge-${game.theme}`}>
                  <Users size={12} />
                  <span>{game.playersLabel}</span>
                </span>

                <button
                  type="button"
                  className="btn-card-rules-mini"
                  title={`Aturan Main ${game.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenRules) onOpenRules(game.id);
                  }}
                >
                  <BookOpen size={13} />
                  <span>Aturan</span>
                </button>
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
                <span className="stage-watermark-suit">{game.cornerSuit}</span>
              </div>

              {/* Konten Teks & Fitur */}
              <div className="catalog-card-body">
                <div className="catalog-title-group">
                  <span className="catalog-card-subtitle">{game.subtitle}</span>
                  <h2 className="catalog-card-title">{game.title}</h2>
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
            {/* Indikator Geser untuk Mobile Bottom Sheet (Dapat di-drag ke bawah atau diklik) */}
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

            {/* Header Modal - juga mendukung drag ke bawah untuk menutup */}
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
                    Pilih Mode Bermain — <span>{currentGameObj.title}</span>
                  </h2>
                </div>
              </div>

              <div className="modal-header-actions">
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
                    <span>Single Player vs Bot</span>
                  </span>

                  <div className="mode-card-title-row">
                    <div className="mode-card-icon-bubble bubble-single">
                      <Bot size={28} className="icon-pulse" />
                    </div>
                    <div>
                      <h3 className="mode-card-title">Main Lawan Bot</h3>
                      <p className="mode-card-subtitle">
                        Main Sendiri Lawan Komputer Cerdas
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

                    {/* Roster Bot yang akan ikut main */}
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

                    {/* Opsi Single / Double Deck khusus Big Two > 4 Pemain */}
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

                    {/* Info Pembagian Kartu */}
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
                    <span>Mulai Main (1 vs {botCount} Bot AI)</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>

              {/* OPSI 2: MAIN ONLINE (MULTIPLAYER) */}
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
                    <span>Realtime Multiplayer</span>
                  </span>

                  <div className="mode-card-title-row">
                    <div className="mode-card-icon-bubble bubble-online">
                      <Globe size={28} className="icon-pulse" />
                    </div>
                    <div>
                      <h3 className="mode-card-title">Main Online</h3>
                      <p className="mode-card-subtitle">
                        Mabar Jarak Jauh (Beda Perangkat)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mode-card-body">
                  <ul className="mode-perks-list">
                    <li>
                      <CheckCircle2 size={15} className="perk-check online-check" />
                      <span>Buat room privat atau gabung via kode 6 digit</span>
                    </li>
                    <li>
                      <CheckCircle2 size={15} className="perk-check online-check" />
                      <span>Bagikan tautan undangan instan ke WhatsApp</span>
                    </li>
                    <li>
                      <CheckCircle2 size={15} className="perk-check online-check" />
                      <span>Sinkronisasi meja otomatis (2 – 6 Pemain)</span>
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
                    <span>Masuk Lobby Online</span>
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
                    <span>Pass & Play Offline</span>
                  </span>

                  <div className="mode-card-title-row">
                    <div className="mode-card-icon-bubble bubble-offline">
                      <Gamepad2 size={28} />
                    </div>
                    <div>
                      <h3 className="mode-card-title">Main Offline</h3>
                      <p className="mode-card-subtitle">
                        1 HP / Laptop Bergantian Tanpa Internet
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="mode-card-body"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Pemilih Jumlah Pemain */}
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

                    {/* Opsi Single / Double Deck khusus Big Two > 4 Pemain */}
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

                    {/* Info Pembagian Kartu */}
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
                    <span>Mulai Main ({offlinePlayerCount} Pemain)</span>
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