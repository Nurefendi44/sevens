import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import '../styles/modeSelection.css';

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
  const [deckMode, setDeckMode] = useState('double');

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

  const renderDealInfo = () => {
    if (activeGame === 'sevens') {
      if (offlinePlayerCount === 6)
        return (
          <span>
            Setiap pemain dapat <strong>8 kartu</strong> (semua angka 7 otomatis di meja)
          </span>
        );
      if (offlinePlayerCount === 5)
        return (
          <span>
            Setiap pemain dapat <strong>10 kartu</strong> (7♠ & 7♥ otomatis di meja)
          </span>
        );
      if (offlinePlayerCount === 3)
        return (
          <span>
            Setiap pemain dapat <strong>17 kartu</strong> (7♠ otomatis di meja)
          </span>
        );
      if (offlinePlayerCount === 2)
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
      if (offlinePlayerCount <= 4) {
        return (
          <span>
            Setiap pemain dapat <strong>13 kartu</strong> (Single Deck 52 kartu). Pemegang{' '}
            <strong>3♦</strong> jalan pertama.
          </span>
        );
      }
      return (
        <span>
          {deckMode === 'double' ? (
            <>
              Mode <strong>Double Deck (104 kartu)</strong> • Setiap pemain dapat{' '}
              <strong>13 kartu</strong>.
            </>
          ) : (
            <>
              Mode <strong>Single Deck (52 kartu)</strong> • Setiap pemain dapat{' '}
              <strong>{offlinePlayerCount === 5 ? '10' : '8'} kartu</strong>.
            </>
          )}
        </span>
      );
    }

    // Remi 41
    return (
      <span>
        Setiap pemain memegang <strong>4 kartu</strong> di tangan • Kumpulkan skor{' '}
        <strong>41 satu kembang</strong>!
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
        >
          <div
            className={`mode-modal-sheet theme-${currentGameObj.theme}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Indikator Geser untuk Mobile Bottom Sheet */}
            <div className="sheet-drag-handle" aria-hidden="true" />

            {/* Header Modal */}
            <div className="mode-modal-header">
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

            {/* Grid Pilihan Mode: Online vs Offline Pass & Play */}
            <div className="mode-cards-grid">
              {/* OPSI 1: MAIN ONLINE (MULTIPLAYER) */}
              <div
                className="mode-card mode-card-online"
                onClick={() =>
                  onSelectMode('multiplayer', null, activeGame, { deckMode })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMode('multiplayer', null, activeGame, { deckMode });
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
                  <button type="button" className="btn-mode-action btn-online">
                    <span>Masuk Lobby Online</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>

              {/* OPSI 2: MAIN OFFLINE (PASS & PLAY 1 PERANGKAT) */}
              <div
                className="mode-card mode-card-offline"
                onClick={() =>
                  onSelectMode('local', offlinePlayerCount, activeGame, {
                    deckMode,
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMode('local', offlinePlayerCount, activeGame, {
                      deckMode,
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
                      {renderDealInfo()}
                    </div>
                  </div>
                </div>

                <div className="mode-card-footer">
                  <button type="button" className="btn-mode-action btn-offline">
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