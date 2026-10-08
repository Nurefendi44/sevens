import React, { useState } from 'react';
import {
  Globe,
  Gamepad2,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Wifi,
  WifiOff,
  Flame,
  Sparkles,
  Crown,
  Layers,
  Lock,
} from 'lucide-react';
import '../styles/modeSelection.css';

export default function ModeSelectionScreen({
  selectedGame = 'sevens',
  onSelectGame,
  onSelectMode,
  onOpenRules,
}) {
  // Navigation step: 'catalog' (3 Game Cards) | 'config' (Player count & Online/Offline mode)
  const [currentStep, setCurrentStep] = useState('catalog');
  const [activeGame, setActiveGame] = useState(selectedGame || 'sevens');
  const [offlinePlayerCount, setOfflinePlayerCount] = useState(4);

  const handlePickGame = (gameId) => {
    setActiveGame(gameId);
    if (onSelectGame) onSelectGame(gameId);
    setCurrentStep('config');
  };

  const isSevens = activeGame === 'sevens';

  return (
    <div className="mode-selection-overlay">
      {/* Ambient Floating Playing Card Suits */}
      <div className="mode-bg-decor" aria-hidden="true">
        <span className="decor-suit decor-suit-1">♠</span>
        <span className="decor-suit decor-suit-2">♥</span>
        <span className="decor-suit decor-suit-3">♦</span>
        <span className="decor-suit decor-suit-4">♣</span>
      </div>

      <div className="mode-selection-container">
        {/* ===================================================================
            STEP 1: 3-CARD GAME CATALOG (SEVENS, REMI 41, POKER COMING SOON)
            =================================================================== */}
        {currentStep === 'catalog' ? (
          <>
            <header className="mode-selection-header">
              <div className="catalog-top-pill">
                <Crown size={14} color="#fbbf24" />
                <span>PORTAL GAME KARTU</span>
              </div>
              <h1 className="mode-main-title">
                ROYAL CARD <span className="mode-title-gold">PORTAL</span>
              </h1>
              <p className="mode-main-subtitle">
                Pilih permainan kartu favorit Anda untuk dimainkan bersama teman secara online atau pass & play offline.
              </p>
            </header>

            {/* 3 Game Cards Grid */}
            <div className="game-catalog-grid">
              {/* CARD 1: SEVENS (TUJUH SEKOP) */}
              <div
                className="game-catalog-card active-card card-sevens"
                onClick={() => handlePickGame('sevens')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePickGame('sevens')}
              >
                <div className="catalog-card-header">
                  <span className="catalog-badge badge-gold">4 - 6 Pemain</span>
                  <span className="catalog-suit-symbol">♠</span>
                </div>

                <div className="catalog-icon-wrapper">
                  <span className="catalog-hero-icon">♠️</span>
                </div>

                <div className="catalog-card-body">
                  <h3 className="catalog-card-title">Tujuh Sekop</h3>
                  <span className="catalog-card-subtitle">SEVENS CARD GAME</span>
                  <p className="catalog-card-desc">
                    Rangkai kartu secara taktis dari angka 7 hingga As. Pasang perangkap kartu angka 6 & 8 dan hindari menutup kartu poin besar!
                  </p>

                  <div className="catalog-features-tags">
                    <span className="feature-pill">4 - 6 Pemain</span>
                    <span className="feature-pill">Online & Offline</span>
                    <span className="feature-pill">Penalti 6 & 8</span>
                  </div>
                </div>

                <div className="catalog-card-footer">
                  <button type="button" className="btn-catalog-play btn-gold">
                    <span>Pilih Tujuh Sekop</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* CARD 2: REMI 41 (KARTU 41) */}
              <div
                className="game-catalog-card active-card card-game41"
                onClick={() => handlePickGame('game41')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePickGame('game41')}
              >
                <div className="catalog-card-header">
                  <span className="catalog-badge badge-emerald">4 - 6 Pemain</span>
                  <span className="catalog-suit-symbol">🃏</span>
                </div>

                <div className="catalog-icon-wrapper">
                  <span className="catalog-hero-icon">🃏</span>
                </div>

                <div className="catalog-card-body">
                  <h3 className="catalog-card-title">Remi 41</h3>
                  <span className="catalog-card-subtitle">KARTU 41 INDONESIA</span>
                  <p className="catalog-card-desc">
                    Kumpulkan 4 kartu bernilai 41 poin dari satu suit. Buang kartu ke pemain berikutnya, raih kombinasi tertinggi, atau 41 Murni instan!
                  </p>

                  <div className="catalog-features-tags">
                    <span className="feature-pill">4 - 6 Pemain</span>
                    <span className="feature-pill">Oper Buangan</span>
                    <span className="feature-pill">Instant Win 41</span>
                  </div>
                </div>

                <div className="catalog-card-footer">
                  <button type="button" className="btn-catalog-play btn-emerald">
                    <span>Pilih Remi 41</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* CARD 3: TEXAS HOLD'EM POKER (COMING SOON) */}
              <div className="game-catalog-card disabled-card card-poker" aria-disabled="true">
                <div className="catalog-card-header">
                  <span className="catalog-badge badge-purple">
                    <Lock size={12} style={{ marginRight: '4px' }} />
                    Coming Soon
                  </span>
                  <span className="catalog-suit-symbol">♦</span>
                </div>

                <div className="catalog-icon-wrapper">
                  <span className="catalog-hero-icon">👑</span>
                </div>

                <div className="catalog-card-body">
                  <h3 className="catalog-card-title">Texas Poker</h3>
                  <span className="catalog-card-subtitle">NO-LIMIT HOLD'EM</span>
                  <p className="catalog-card-desc">
                    Permainan poker legendaris dunia. Adu strategi taruhan chip, raise, bluffing, dan taklukkan meja lawan Anda!
                  </p>

                  <div className="catalog-features-tags">
                    <span className="feature-pill">2 - 9 Pemain</span>
                    <span className="feature-pill">Turnamen Chip</span>
                    <span className="feature-pill">Bluffing & All-in</span>
                  </div>
                </div>

                <div className="catalog-card-footer">
                  <button type="button" className="btn-catalog-play btn-disabled" disabled>
                    <span>Segera Hadir</span>
                    <Lock size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ===================================================================
             STEP 2: GAME CONFIGURATION (MODE: ONLINE VS OFFLINE PASS & PLAY)
             =================================================================== */
          <>
            {/* Top Back Navigation to Game Catalog */}
            <div className="mode-back-nav">
              <button
                type="button"
                className="btn-back-to-catalog"
                onClick={() => setCurrentStep('catalog')}
              >
                <ArrowLeft size={16} />
                <span>Pilih Permainan Lain</span>
              </button>

              <span className="game-active-indicator-tag">
                {isSevens ? '♠️ Tujuh Sekop Terpilih' : '🃏 Remi 41 Terpilih'}
              </span>
            </div>

            {/* Brand Header for Config */}
            <header className="mode-selection-header">
              {isSevens ? (
                <>
                  <h1 className="mode-main-title">
                    SEVENS <span className="mode-title-gold">TUJUH SEKOP</span>
                  </h1>
                  <p className="mode-main-subtitle">
                    Rangkai kartu dari angka 7 hingga As. Pilih mode bermain bersama teman di bawah ini:
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mode-main-title">
                    REMI 41 <span className="mode-title-gold">EMPAT SATU</span>
                  </h1>
                  <p className="mode-main-subtitle">
                    Kumpulkan 4 kartu bernilai 41 poin dari suit sama. Oper buangan ke pemain berikutnya!
                  </p>
                </>
              )}
            </header>

            {/* 2 Interactive Mode Cards Grid */}
            <div className="mode-cards-grid">
              {/* CARD 1: MAIN ONLINE (MULTIPLAYER) */}
              <div
                className="mode-card mode-card-online"
                onClick={() => onSelectMode('multiplayer', null, activeGame)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMode('multiplayer', null, activeGame);
                  }
                }}
              >
                <div className="mode-card-top">
                  <div className="mode-card-header-row">
                    <span className="mode-card-badge badge-online">
                      <Wifi size={13} />
                      <span>Realtime Online</span>
                    </span>
                  </div>

                  <div className="mode-card-icon-bubble bubble-online">
                    <Globe size={40} className="icon-pulse" />
                  </div>

                  <h2 className="mode-card-title">Main Online</h2>
                  <p className="mode-card-subtitle">Bersama Teman Jarak Jauh</p>
                </div>

                <div className="mode-card-body">
                  <ul className="mode-perks-list">
                    <li>
                      <span className="perk-bullet">✦</span>
                      <span>Buat room privat atau gabung via kode 6 digit</span>
                    </li>
                    <li>
                      <span className="perk-bullet">✦</span>
                      <span>Bagikan tautan / share link instan via WA</span>
                    </li>
                    <li>
                      <span className="perk-bullet">✦</span>
                      <span>Sinkronisasi meja dan giliran realtime (4 - 6 Pemain)</span>
                    </li>
                  </ul>
                </div>

                <div className="mode-card-footer">
                  <button type="button" className="btn-mode-action btn-online">
                    <span>Masuk Lobby Online</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* CARD 2: MAIN OFFLINE (SIMULASI / PASS-AND-PLAY) */}
              <div
                className="mode-card mode-card-offline"
                onClick={() => onSelectMode('local', offlinePlayerCount, activeGame)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMode('local', offlinePlayerCount, activeGame);
                  }
                }}
              >
                <div className="mode-card-top">
                  <div className="mode-card-header-row">
                    <span className="mode-card-badge badge-offline">
                      <WifiOff size={13} />
                      <span>Pass-and-Play Offline</span>
                    </span>
                  </div>

                  <div className="mode-card-icon-bubble bubble-offline">
                    <Gamepad2 size={40} />
                  </div>

                  <h2 className="mode-card-title">Main Offline</h2>
                  <p className="mode-card-subtitle">1 Perangkat Bersama</p>
                </div>

                <div className="mode-card-body">
                  {/* Player Count Selector Buttons (4, 5, or 6 players) */}
                  <div
                    className="offline-player-selector"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="selector-title">Pilih Jumlah Pemain:</label>
                    <div className="player-count-buttons">
                      {[4, 5, 6].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`btn-player-pill ${offlinePlayerCount === count ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOfflinePlayerCount(count);
                          }}
                        >
                          {count} Pemain
                        </button>
                      ))}
                    </div>

                    <div className="player-count-detail-note">
                      {isSevens ? (
                        offlinePlayerCount === 6 ? (
                          <span>Setiap pemain dapat <strong>8 kartu</strong> (semua angka 7 tertata di meja)</span>
                        ) : offlinePlayerCount === 5 ? (
                          <span>Setiap pemain dapat <strong>10 kartu</strong> (7♠ dan 7♥ tertata di meja)</span>
                        ) : (
                          <span>Setiap pemain dapat <strong>13 kartu</strong> penuh</span>
                        )
                      ) : (
                        <span>Setiap pemain memegang <strong>4 kartu</strong> di tangan</span>
                      )}
                    </div>
                  </div>

                  <ul className="mode-perks-list">
                    <li>
                      <span className="perk-bullet">✦</span>
                      <span>Bermain bersama 1 HP / komputer bergantian</span>
                    </li>
                    <li>
                      <span className="perk-bullet">✦</span>
                      <span>Animasi kocok kartu & pembagian kartu otomatis</span>
                    </li>
                    <li>
                      <span className="perk-bullet">✦</span>
                      <span>Tidak memerlukan koneksi internet</span>
                    </li>
                  </ul>
                </div>

                <div className="mode-card-footer">
                  <button type="button" className="btn-mode-action btn-offline">
                    <span>Mulai Main ({offlinePlayerCount} Pemain)</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Rules Guide Button */}
            <div className="mode-footer-help">
              <button
                type="button"
                className="btn-rules-preview"
                onClick={() => onOpenRules && onOpenRules(activeGame)}
              >
                <BookOpen size={16} />
                <span>
                  {isSevens ? 'Buku Panduan & Aturan Tujuh Sekop' : 'Buku Panduan & Aturan Remi 41'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
