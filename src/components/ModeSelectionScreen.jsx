import React from 'react';
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
          <div className="mode-brand-badge">
            <span>♠</span>
            <span>Permainan Kartu Klasik Nusantara</span>
          </div>

          <h1 className="mode-main-title">
            SEVENS <span className="mode-title-gold">TUJUH SEKOP</span>
          </h1>

          <p className="mode-main-subtitle">
            Selamat datang di meja kartu Sevens. Silakan pilih mode permainan di bawah untuk memulai!
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
                  <span>Realtime Supabase</span>
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
                  <span>4 Pemain di perangkat masing-masing</span>
                </div>
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-online" />
                  <span>Bisa via Kode Room atau Bagikan Link</span>
                </div>
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-online" />
                  <span>Sinkronisasi realtime & fair play anti-hint</span>
                </div>
              </div>
            </div>

            <button className="btn-select-mode btn-mode-online">
              <span>Pilih Mode Online</span>
              <ArrowRight size={18} />
            </button>
          </div>

          {/* CARD 2: MAIN OFFLINE (LOKAL) */}
          <div
            className="mode-card mode-card-offline"
            onClick={() => onSelectMode('local')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectMode('local');
              }
            }}
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
                <h2 className="mode-card-title">Main Offline (Lokal)</h2>
                <p className="mode-card-desc">
                  Main santai dalam 1 perangkat secara bergantian (Pass-and-play). Sangat cocok saat kumpul bareng teman tanpa butuh kuota internet.
                </p>
              </div>

              <div className="mode-feature-list">
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-offline" />
                  <span>1 HP / Komputer bergantian 4 pemain</span>
                </div>
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-offline" />
                  <span>100% Offline tanpa internet & tanpa login</span>
                </div>
                <div className="mode-feature-item">
                  <span className="feature-dot feature-dot-offline" />
                  <span>Simulasi lengkap dengan aturan resmi</span>
                </div>
              </div>
            </div>

            <button className="btn-select-mode btn-mode-offline">
              <span>Pilih Mode Offline</span>
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
