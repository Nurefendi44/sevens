import React, { useState } from 'react';
import {
  Globe,
  Gamepad2,
  ArrowRight,
  BookOpen,
  Wifi,
  WifiOff,
} from 'lucide-react';
import '../styles/modeSelection.css';

export default function ModeSelectionScreen({ onSelectMode, onOpenRules }) {
  const [offlinePlayerCount, setOfflinePlayerCount] = useState(4);

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
        {/* Brand Header */}
        <header className="mode-selection-header">
          <h1 className="mode-main-title">
            SEVENS <span className="mode-title-gold">TUJUH SEKOP</span>
          </h1>

          <p className="mode-main-subtitle">
            Selamat datang di meja kartu Sevens. Silakan pilih mode permainan (4, 5, atau 6 pemain) untuk memulai!
          </p>
        </header>

        {/* 2 Interactive Cards Grid */}
        <div className="mode-cards-grid">
          {/* CARD 1: MAIN ONLINE (MULTIPLAYER) */}
          <div
            className="mode-card mode-card-online"
            onClick={() => onSelectMode('multiplayer')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectMode('multiplayer');
              }
            }}
          >
            <div className="mode-card-top">
              <div className="mode-card-header-row">
                <span className="mode-card-badge badge-online">
                  <Wifi size={13} />
                  <span>Realtime</span>
                </span>
              </div>

              <div className="mode-card-icon-wrapper icon-online-wrap">
                <Globe size={34} />
              </div>

              <div className="mode-card-title-group">
                <h2 className="mode-card-title">Main Online</h2>
                <p className="mode-card-desc">
                  Bermain bersama teman dari HP atau laptop masing-masing secara realtime. Cukup buat room atau masukkan kode undangan!
                </p>
              </div>

              <div className="mode-feature-list">
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-online" />
                  <span>Bisa 4, 5, atau 6 pemain (dipilih Host saat buat room)</span>
                </div>
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-online" />
                  <span>Sistem otomatis menata kartu 7 di meja jika 5 / 6 pemain</span>
                </div>
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-online" />
                  <span>Bisa via Kode Room atau Bagikan Link undangan</span>
                </div>
              </div>
            </div>

            <button className="btn-select-mode btn-mode-online">
              <span>Masuk Lobby Online</span>
              <ArrowRight size={18} />
            </button>
          </div>

          {/* CARD 2: MAIN OFFLINE (LOKAL) */}
          <div
            className="mode-card mode-card-offline"
            role="region"
            aria-label="Mode Main Offline"
          >
            <div className="mode-card-top">
              <div className="mode-card-header-row">
                <span className="mode-card-badge badge-offline">
                  <WifiOff size={13} />
                  <span>Pass & Play</span>
                </span>
              </div>

              <div className="mode-card-icon-wrapper icon-offline-wrap">
                <Gamepad2 size={34} />
              </div>

              <div className="mode-card-title-group">
                <h2 className="mode-card-title">Main Offline</h2>
                <p className="mode-card-desc">
                  Main santai dalam 1 perangkat secara bergantian (Pass-and-play). Sangat cocok saat kumpul bareng teman tanpa butuh kuota internet.
                </p>
              </div>

              {/* Player Count Selector for Offline */}
              <div className="player-count-picker">
                <span className="picker-label">Pilih Jumlah Pemain Offline:</span>
                <div className="picker-buttons">
                  {[4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`btn-count-chip ${offlinePlayerCount === num ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOfflinePlayerCount(num);
                      }}
                    >
                      {num} Orang
                    </button>
                  ))}
                </div>
              </div>

              <div className="mode-feature-list">
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-offline" />
                  {offlinePlayerCount === 4 && (
                    <span><strong>4 Pemain:</strong> 13 kartu per pemain (meja mulai kosong)</span>
                  )}
                  {offlinePlayerCount === 5 && (
                    <span><strong>5 Pemain:</strong> 10 kartu/orang (♠7 & ♥7 otomatis di meja)</span>
                  )}
                  {offlinePlayerCount === 6 && (
                    <span><strong>6 Pemain:</strong> 8 kartu/orang (semua 7 otomatis di meja)</span>
                  )}
                </div>
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-offline" />
                  <span>1 HP / Komputer bergantian secara pass-and-play</span>
                </div>
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-offline" />
                  <span>100% Offline tanpa kuota & tanpa login</span>
                </div>
              </div>
            </div>

            <button
              className="btn-select-mode btn-mode-offline"
              onClick={() => onSelectMode('local', offlinePlayerCount)}
            >
              <span>Mulai Main Offline ({offlinePlayerCount} Orang)</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Footer Quick Links */}
        <footer className="mode-selection-footer">
          <button className="btn-rules-guide" onClick={onOpenRules}>
            <BookOpen size={16} />
            <span>Buku Aturan Permainan Sevens</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
