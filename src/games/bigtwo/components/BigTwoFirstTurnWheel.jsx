import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, RotateCcw, Play, X, Crown, Volume2 } from 'lucide-react';
import { audio } from '../../../services/audioService.js';
import '../../../styles/wheelPicker.css';

const SLICE_COLORS = [
  '#0284c7', // Sky blue
  '#10b981', // Emerald green
  '#8b5cf6', // Purple violet
  '#f59e0b', // Amber gold
  '#ec4899', // Pink rose
  '#06b6d4', // Cyan teal
];

export default function BigTwoFirstTurnWheel({
  isOpen,
  players = [],
  targetPlayerId,
  onComplete,
  onRespin,
  isHost = true,
  isMultiplayer = false,
}) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [winnerPlayer, setWinnerPlayer] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const wheelRef = useRef(null);
  const audioCtxRef = useRef(null);
  const lastTickDegRef = useRef(0);
  const animFrameRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const playerCount = Math.max(1, players.length);
  const sliceAngle = 360 / playerCount;

  // Initialize Web Audio API for ticking sound
  useEffect(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtxRef.current = new AudioContext();
      }
    } catch {
      // AudioContext not available
    }

    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const playClickTick = () => {
    try {
      if (!audioCtxRef.current) return;
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.035);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Ignore
    }
  };

  // Trigger Spin animation when opened or targetPlayerId changes
  const startSpin = (targetId) => {
    if (!targetId || players.length === 0) return;

    let targetIdx = players.findIndex((p) => p.id === targetId);
    if (targetIdx === -1) targetIdx = 0;

    setIsSpinning(true);
    setHasFinished(false);
    setWinnerPlayer(null);
    setCountdown(null);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Mathematical precision:
    // Slice center is at (targetIdx + 0.5) * sliceAngle
    // Pointer is at the TOP (0°).
    // Target rotation: R % 360 = 360 - (targetIdx + 0.5) * sliceAngle
    const fullSpins = 6 + Math.floor(Math.random() * 2); // 6 to 7 full revolutions
    const sliceCenter = (targetIdx + 0.5) * sliceAngle;
    const endAngle = 360 - sliceCenter;

    // Previous full rotations offset
    const currentBase = Math.floor(rotation / 360) * 360;
    const finalRotation = currentBase + fullSpins * 360 + endAngle;

    const startTime = performance.now();
    const duration = 4000; // 4 seconds duration for dramatic suspense
    const initialRotation = rotation;
    lastTickDegRef.current = initialRotation;

    const cubicBezier = (t) => {
      // Ease out cubic/quart
      return 1 - Math.pow(1 - t, 3.5);
    };

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = cubicBezier(progress);

      const currentDeg = initialRotation + (finalRotation - initialRotation) * easedProgress;
      setRotation(currentDeg);

      // Play tick sound when passing each segment boundary
      const degreesPassed = Math.abs(currentDeg - lastTickDegRef.current);
      if (degreesPassed >= sliceAngle * 0.75) {
        playClickTick();
        lastTickDegRef.current = currentDeg;
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Spin finished!
        setIsSpinning(false);
        setHasFinished(true);
        const winningP = players[targetIdx];
        setWinnerPlayer(winningP);

        // Celebratory sound and confetti
        audio.sevenChime();
        try {
          confetti({
            particleCount: 75,
            spread: 70,
            origin: { y: 0.55 },
          });
        } catch {
          // Ignore
        }

        // Auto-countdown 3s to start
        let count = 3;
        setCountdown(count);
        countdownIntervalRef.current = setInterval(() => {
          count -= 1;
          if (count <= 0) {
            clearInterval(countdownIntervalRef.current);
            if (onComplete) onComplete(winningP.id);
          } else {
            setCountdown(count);
          }
        }, 1000);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isOpen && targetPlayerId) {
      // Short delay before wheel starts spinning
      const t = setTimeout(() => {
        startSpin(targetPlayerId);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isOpen, targetPlayerId]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="wheel-picker-backdrop">
      <div className="wheel-picker-modal">
        {/* Header */}
        <div className="wheel-picker-header">
          <div className="wheel-title-pill">
            <Sparkles size={16} color="#fbbf24" />
            <span>RANDOM PICKER WHEEL</span>
          </div>
          <h2 className="wheel-main-title">MENENTUKAN GILIRAN PERTAMA</h2>
          <p className="wheel-subtitle">
            Roda keberuntungan berputar menentukan siapa yang berhak jalan pertama (Meja Bebas)!
          </p>
        </div>

        {/* Wheel Arena */}
        <div className="wheel-arena">
          {/* Top Golden Needle / Ticker Pointer */}
          <div className={`wheel-pointer ${isSpinning ? 'is-ticking' : ''}`}>
            <div className="needle-triangle" />
            <div className="needle-pin" />
          </div>

          {/* Glowing LED outer rim */}
          <div className="wheel-led-ring">
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className={`led-bulb ${isSpinning ? 'blinking' : 'steady'}`}
                style={{
                  transform: `rotate(${i * (360 / 16)}deg) translate(0, -158px)`,
                }}
              />
            ))}
          </div>

          {/* SVG Rotating Wheel */}
          <div
            className="wheel-disc"
            ref={wheelRef}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? 'none' : 'transform 0.3s ease-out',
            }}
          >
            <svg viewBox="-150 -150 300 300" className="wheel-svg">
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
                </filter>
              </defs>

              {players.map((player, idx) => {
                const startA = idx * sliceAngle;
                const endA = (idx + 1) * sliceAngle;
                const midA = (startA + endA) / 2;

                const startRad = ((startA - 90) * Math.PI) / 180;
                const endRad = ((endA - 90) * Math.PI) / 180;

                const x1 = 145 * Math.cos(startRad);
                const y1 = 145 * Math.sin(startRad);
                const x2 = 145 * Math.cos(endRad);
                const y2 = 145 * Math.sin(endRad);

                const largeArc = sliceAngle > 180 ? 1 : 0;
                const pathD = `M 0 0 L ${x1} ${y1} A 145 145 0 ${largeArc} 1 ${x2} ${y2} Z`;

                const color = SLICE_COLORS[idx % SLICE_COLORS.length];

                // Text position: ~95px from center
                const textRad = ((midA - 90) * Math.PI) / 180;
                const tx = 92 * Math.cos(textRad);
                const ty = 92 * Math.sin(textRad);

                return (
                  <g key={player.id} className="wheel-segment-group">
                    <path
                      d={pathD}
                      fill={color}
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="2"
                    />
                    {/* Player Info text and avatar */}
                    <g transform={`translate(${tx}, ${ty}) rotate(${midA})`}>
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize="15"
                        fontWeight="800"
                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                      >
                        {player.avatar}
                      </text>
                      <text
                        y="15"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#f8fafc"
                        fontSize="10"
                        fontWeight="700"
                        letterSpacing="0.02em"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                      >
                        {player.name.length > 9 ? `${player.name.slice(0, 8)}…` : player.name}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Center Metallic Hub */}
              <circle cx="0" cy="0" r="32" fill="#0f172a" stroke="#fbbf24" strokeWidth="4" />
              <circle cx="0" cy="0" r="22" fill="url(#hubGradient)" />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fbbf24"
                fontSize="16"
              >
                🎡
              </text>

              <linearGradient id="hubGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </svg>
          </div>
        </div>

        {/* Winner Announcement or Status Bar */}
        <div className="wheel-bottom-bar">
          {hasFinished && winnerPlayer ? (
            <div className="wheel-winner-card animate-pop">
              <div className="winner-badge-crown">👑 TERPILIH JALAN PERTAMA</div>
              <div className="winner-player-info">
                <span className="winner-avatar">{winnerPlayer.avatar}</span>
                <span className="winner-name">{winnerPlayer.name}</span>
              </div>
              <p className="winner-instruction">
                Bebas membuka meja dengan Single, Pair, Triple, atau 5 Kartu Poker!
              </p>

              <div className="wheel-actions">
                <button
                  type="button"
                  className="btn-start-game"
                  onClick={() => {
                    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                    if (onComplete) onComplete(winnerPlayer.id);
                  }}
                >
                  <Play size={15} fill="currentColor" />
                  <span>Mulai Main {countdown ? `(${countdown}s)` : ''}</span>
                </button>

                {(!isMultiplayer || isHost) && onRespin && (
                  <button
                    type="button"
                    className="btn-respin"
                    onClick={() => onRespin()}
                    title="Putar Ulang Roda"
                  >
                    <RotateCcw size={14} />
                    <span>Putar Ulang</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="wheel-spinning-status">
              <span className="spinning-dot" />
              <span>Memutar roda acak...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
