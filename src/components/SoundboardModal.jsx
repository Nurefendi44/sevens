import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, X, Square, Sparkles, Radio } from 'lucide-react';
import { SOUNDBOARD_TRACKS, SOUNDBOARD_CATEGORIES } from '../constants/soundboardTracks.js';
import { audio } from '../services/audioService.js';
import '../styles/soundboard.css';

export default function SoundboardModal({
  isOpen = false,
  onClose,
  onPlaySound,
  isMuted = false,
  onToggleSound,
  isMultiplayer = false,
}) {
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const modalRef = useRef(null);
  const cooldownTimerRef = useRef(null);

  // Subscribe to audioService soundboard playback state
  useEffect(() => {
    const unsubscribe = audio.subscribeSoundboard(({ isPlaying, soundId }) => {
      setCurrentlyPlayingId(isPlaying ? soundId : null);
    });
    return () => unsubscribe();
  }, []);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clean cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const filteredTracks = SOUNDBOARD_TRACKS.filter((track) => {
    if (selectedCategory === 'Semua') return true;
    return track.category === selectedCategory;
  });

  const handleCardClick = (track) => {
    if (cooldownRemaining > 0) return;

    // Trigger local play and multiplayer broadcast
    if (onPlaySound) {
      onPlaySound(track);
    } else {
      audio.playSoundboard(track);
    }

    // Set 1.2s spam prevention cooldown
    setCooldownRemaining(1200);
    const start = Date.now();
    const duration = 1200;

    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, duration - elapsed);
      setCooldownRemaining(left);
      if (left <= 0) {
        clearInterval(cooldownTimerRef.current);
      }
    }, 100);
  };

  const handleStopSound = (e) => {
    e.stopPropagation();
    audio.stopSoundboard();
  };

  return (
    <div
      className="soundboard-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="soundboard-title"
    >
      <div className="soundboard-modal" ref={modalRef}>
        {/* Header */}
        <div className="soundboard-header">
          <div className="soundboard-title-group">
            <div className="soundboard-icon-badge">
              <Radio size={22} />
            </div>
            <div className="soundboard-title-text">
              <h3 id="soundboard-title">
                Soundboard Meme
                <span className="soundboard-live-pill">Live SFX</span>
              </h3>
              <p>Putar efek suara lucu dan meme langsung ke meja</p>
            </div>
          </div>

          <button
            type="button"
            className="soundboard-close-btn"
            onClick={onClose}
            aria-label="Tutup Soundboard"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div className="soundboard-toolbar">
          <div className="soundboard-categories">
            {SOUNDBOARD_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="soundboard-actions">
            {currentlyPlayingId && (
              <button
                type="button"
                className="btn-stop-sound"
                onClick={handleStopSound}
                title="Hentikan audio yang sedang diputar"
              >
                <Square size={13} fill="currentColor" />
                <span>Stop</span>
              </button>
            )}

            {onToggleSound && (
              <button
                type="button"
                className={`category-pill ${isMuted ? 'active' : ''}`}
                onClick={onToggleSound}
                title={isMuted ? 'Nyalakan Audio Efek' : 'Matikan Audio Efek'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>{isMuted ? 'Bisu' : 'Aktif'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sound Grid List */}
        <div className="soundboard-body">
          {filteredTracks.map((track) => {
            const isPlaying = currentlyPlayingId === track.id;

            return (
              <div
                key={track.id}
                className={`sound-card-item ${isPlaying ? 'is-playing' : ''}`}
                style={{
                  '--accent-color': track.color,
                  '--accent-glow': track.glow,
                }}
                onClick={() => handleCardClick(track)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(track);
                  }
                }}
              >
                <div
                  className="sound-icon-box"
                  style={{
                    boxShadow: isPlaying ? `0 0 16px ${track.glow}` : 'none',
                    borderColor: isPlaying ? track.color : 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {track.icon}
                </div>

                <div className="sound-meta-box">
                  <div className="sound-title">{track.title}</div>
                  <div className="sound-subtitle">{track.subtitle}</div>
                </div>

                {isPlaying && (
                  <div className="sound-playing-wave" title="Sedang memutar...">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="soundboard-footer">
          <div className="soundboard-mode-hint">
            <span className="pulse-dot" />
            <span>
              {isMultiplayer
                ? '🔊 Terdengar oleh seluruh pemain di ruangan meja'
                : '🔊 Mode Lokal: Dimainkan di perangkat Anda'}
            </span>
          </div>
          {cooldownRemaining > 0 && (
            <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.75rem' }}>
              Cooldown: {(cooldownRemaining / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
