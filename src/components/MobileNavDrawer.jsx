import React from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  BookOpen,
  Settings,
  History,
  RotateCcw,
  Globe,
  Gamepad2,
  LogOut,
  Volume2,
  VolumeX,
  Users,
} from 'lucide-react';

export default function MobileNavDrawer({
  isOpen,
  onClose,
  isMultiplayerMode,
  currentRoom,
  onCopyRoomCode,
  onShareRoomLink,
  copiedRoomCode,
  gameState,
  onOpenRules,
  onOpenConfig,
  onOpenHistory,
  isMuted,
  onToggleSound,
  onRestart,
  isHost,
  onLeaveRoom,
  onSwitchMode,
}) {
  if (!isOpen) return null;

  const currentTurnPlayer = gameState.players.find(
    (p) => p.id === gameState.currentPlayer
  );

  return (
    <div className="mobile-menu-backdrop" onClick={onClose}>
      <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-brand">
            <span style={{ color: '#fbbf24', fontSize: '1.25rem' }}>♠</span>
            <span>MENU SEVENS</span>
          </div>
          <button
            className="mobile-drawer-close-btn"
            onClick={onClose}
            aria-label="Tutup menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Game Status Info Card */}
        <div className="mobile-drawer-status-card">
          {isMultiplayerMode && currentRoom?.code && (
            <div className="drawer-room-section">
              <div className="drawer-room-code-badge">
                <Users size={14} />
                <span>
                  ROOM: <strong>{currentRoom.code}</strong>
                </span>
              </div>
              <div className="drawer-room-actions">
                <button
                  className="drawer-action-btn"
                  onClick={onCopyRoomCode}
                  title="Salin Kode Room"
                >
                  {copiedRoomCode ? (
                    <Check size={14} className="text-success" />
                  ) : (
                    <Copy size={14} />
                  )}
                  <span>{copiedRoomCode ? 'Tersalin' : 'Salin Kode'}</span>
                </button>
                <button
                  className="drawer-action-btn btn-green"
                  onClick={onShareRoomLink}
                  title="Bagikan Tautan Undangan"
                >
                  <Share2 size={14} />
                  <span>Bagikan</span>
                </button>
              </div>
            </div>
          )}

          <div className="drawer-status-row">
            <span className="drawer-label">Arah Rangkai As:</span>
            {gameState.globalAceDirection === 'bottom' && (
              <span className="drawer-tag tag-green">⬇️ BAWAH (A=-1)</span>
            )}
            {gameState.globalAceDirection === 'top' && (
              <span className="drawer-tag tag-gold">⬆️ ATAS (A=-11)</span>
            )}
            {!gameState.globalAceDirection && (
              <span className="drawer-tag tag-neutral">Terbuka</span>
            )}
          </div>

          <div className="drawer-status-row">
            <span className="drawer-label">Babak Turn:</span>
            <span className="drawer-value">Turn #{gameState.turnNumber}</span>
          </div>

          {currentTurnPlayer && (
            <div className="drawer-status-row">
              <span className="drawer-label">Giliran Aktif:</span>
              <span className="drawer-value highlight">
                {currentTurnPlayer.avatar} {currentTurnPlayer.name}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Action Buttons List */}
        <div className="mobile-drawer-menu-list">
          {/* Switch Mode Button */}
          <button
            className="mobile-menu-item"
            onClick={() => {
              onSwitchMode();
              onClose();
            }}
          >
            <div className="menu-item-icon">
              {isMultiplayerMode ? <Gamepad2 size={18} /> : <Globe size={18} />}
            </div>
            <div className="menu-item-text">
              <span>{isMultiplayerMode ? 'Mode Simulasi Lokal' : 'Mode Online Multiplayer'}</span>
              <small>{isMultiplayerMode ? 'Beralih ke pass-and-play' : 'Bermain realtime bersama teman'}</small>
            </div>
          </button>

          {/* Rules Guide */}
          <button
            className="mobile-menu-item"
            onClick={() => {
              onOpenRules();
              onClose();
            }}
          >
            <div className="menu-item-icon">
              <BookOpen size={18} />
            </div>
            <div className="menu-item-text">
              <span>Buku Aturan Permainan</span>
              <small>Penjelasan Rule 1 - 6 & Kartu As</small>
            </div>
          </button>

          {/* Settings & Config (Exclusive to Host / Local mode) */}
          {(!isMultiplayerMode || isHost) && (
            <button
              className="mobile-menu-item"
              onClick={() => {
                onOpenConfig();
                onClose();
              }}
            >
              <div className="menu-item-icon">
                <Settings size={18} />
              </div>
              <div className="menu-item-text">
                <span>Pengaturan & Penalti {isMultiplayerMode && '(Host)'}</span>
                <small>Konfigurasi kartu 6 & 8 dan penalti</small>
              </div>
            </button>
          )}

          {/* Match History */}
          <button
            className="mobile-menu-item"
            onClick={() => {
              onOpenHistory();
              onClose();
            }}
          >
            <div className="menu-item-icon">
              <History size={18} />
            </div>
            <div className="menu-item-text">
              <span>Riwayat Pertandingan</span>
              <small>Log aksi giliran dan pelanggaran</small>
            </div>
          </button>

          {/* Sound Toggle */}
          <button className="mobile-menu-item" onClick={onToggleSound}>
            <div className="menu-item-icon">
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </div>
            <div className="menu-item-text">
              <span>Suara Efek: {isMuted ? 'Mati (Bisu)' : 'Aktif'}</span>
              <small>Klik untuk mengubah status suara</small>
            </div>
          </button>

          {/* Restart / Game Baru (if Host or Local) */}
          {(!isMultiplayerMode || isHost) && (
            <button
              className="mobile-menu-item item-gold"
              onClick={() => {
                onRestart();
                onClose();
              }}
            >
              <div className="menu-item-icon">
                <RotateCcw size={18} />
              </div>
              <div className="menu-item-text">
                <span>Kocok Ulang & Mulai Baru</span>
                <small>Kocok 52 kartu dan mulai ronde baru</small>
              </div>
            </button>
          )}

          {/* Leave Room (if in multiplayer) */}
          {isMultiplayerMode && currentRoom && (
            <button
              className="mobile-menu-item item-danger"
              onClick={() => {
                onLeaveRoom();
                onClose();
              }}
            >
              <div className="menu-item-icon">
                <LogOut size={18} />
              </div>
              <div className="menu-item-text">
                <span>Tinggalkan Room Online</span>
                <small>Keluar dari room {currentRoom.code}</small>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
