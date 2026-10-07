import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../services/audioService.js';
import { FastForward, Sparkles } from 'lucide-react';
import '../styles/dealingAnimation.css';

const SUIT_COLORS = {
  spades: '#0f172a',
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#0f172a',
};

export default function ShuffleDealingAnimation({
  isActive,
  onComplete,
  playerHand = [],
  seats = {},
}) {
  // Animation Phases: 'shuffle' | 'dealing' | 'revealing' | 'done'
  const [phase, setPhase] = useState('shuffle');
  const [totalDealt, setTotalDealt] = useState(0);
  const [bottomDealtCount, setBottomDealtCount] = useState(0);
  const [leftDealtCount, setLeftDealtCount] = useState(0);
  const [topDealtCount, setTopDealtCount] = useState(0);
  const [rightDealtCount, setRightDealtCount] = useState(0);
  const [flyingCard, setFlyingCard] = useState(null); // { id, target: 'bottom'|'left'|'top'|'right' }
  const [flippedCards, setFlippedCards] = useState(new Set()); // Set of indices flipped to face-up
  const [isFadingOut, setIsFadingOut] = useState(false);

  const timerRef = useRef(null);
  const dealIntervalRef = useRef(null);
  const revealIntervalRef = useRef(null);

  // 13 Hand cards to display for user
  const displayHand = playerHand && playerHand.length > 0
    ? playerHand.slice(0, 13)
    : Array.from({ length: 13 }, (_, i) => ({
        id: `mock-${i}`,
        rank: ((i % 13) + 1),
        suit: ['spades', 'hearts', 'diamonds', 'clubs'][i % 4],
        label: `${((i % 13) + 1)}`,
        symbol: ['♠', '♥', '♦', '♣'][i % 4],
      }));

  // Clean all timers
  const clearAllTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (dealIntervalRef.current) clearInterval(dealIntervalRef.current);
    if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
  };

  useEffect(() => {
    if (!isActive) {
      clearAllTimers();
      setPhase('shuffle');
      setTotalDealt(0);
      setBottomDealtCount(0);
      setLeftDealtCount(0);
      setTopDealtCount(0);
      setRightDealtCount(0);
      setFlyingCard(null);
      setFlippedCards(new Set());
      setIsFadingOut(false);
      return;
    }

    // Reset state for new animation run
    setPhase('shuffle');
    setTotalDealt(0);
    setBottomDealtCount(0);
    setLeftDealtCount(0);
    setTopDealtCount(0);
    setRightDealtCount(0);
    setFlyingCard(null);
    setFlippedCards(new Set());
    setIsFadingOut(false);

    // =========================================================================
    // STEP 1: SHUFFLE PHASE (0ms - 1100ms)
    // =========================================================================
    audio.shuffleSound();

    timerRef.current = setTimeout(() => {
      // =======================================================================
      // STEP 2: DEALING ONE-BY-ONE FACE-DOWN (1100ms - ~3600ms)
      // 52 cards dealt sequentially: Bottom -> Left -> Top -> Right (13 rounds)
      // =======================================================================
      setPhase('dealing');
      let currentCardIndex = 0;
      const targets = ['bottom', 'left', 'top', 'right'];

      dealIntervalRef.current = setInterval(() => {
        if (currentCardIndex >= 52) {
          if (dealIntervalRef.current) clearInterval(dealIntervalRef.current);
          setFlyingCard(null);

          // All 52 cards are dealt! Transition to REVEAL PHASE
          timerRef.current = setTimeout(() => {
            startRevealPhase();
          }, 350);
          return;
        }

        const target = targets[currentCardIndex % 4];
        currentCardIndex++;
        const currentNum = currentCardIndex;

        setTotalDealt(currentNum);
        setFlyingCard({ id: currentNum, target });
        audio.dealCardSound();

        // Increment seat counters as card arrives
        if (target === 'bottom') {
          setBottomDealtCount((prev) => Math.min(prev + 1, 13));
        } else if (target === 'left') {
          setLeftDealtCount((prev) => Math.min(prev + 1, 13));
        } else if (target === 'top') {
          setTopDealtCount((prev) => Math.min(prev + 1, 13));
        } else if (target === 'right') {
          setRightDealtCount((prev) => Math.min(prev + 1, 13));
        }
      }, 48); // 48ms per card = 52 cards in ~2.5s
    }, 1100);

    return () => {
      clearAllTimers();
    };
  }, [isActive]);

  // ===========================================================================
  // STEP 3: REVEAL PHASE - FLIPPING FACE-DOWN CARDS TO FACE-UP 3D
  // ===========================================================================
  const startRevealPhase = () => {
    setPhase('revealing');
    let cardIdx = 0;

    revealIntervalRef.current = setInterval(() => {
      if (cardIdx >= 13) {
        if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);

        // All cards revealed! Play celebration fanfare and finish
        audio.revealFanfareSound();

        timerRef.current = setTimeout(() => {
          setIsFadingOut(true);
          timerRef.current = setTimeout(() => {
            setPhase('done');
            if (onComplete) onComplete();
          }, 400);
        }, 900);
        return;
      }

      const flippedIdx = cardIdx;
      audio.cardFlipSound(flippedIdx);
      setFlippedCards((prev) => new Set([...prev, flippedIdx]));
      cardIdx++;
    }, 65); // 65ms per card flip cascade wave
  };

  const handleSkip = () => {
    clearAllTimers();
    setIsFadingOut(true);
    setTimeout(() => {
      setPhase('done');
      if (onComplete) onComplete();
    }, 150);
  };

  if (!isActive || phase === 'done') return null;

  const currentRound = Math.min(Math.floor(totalDealt / 4) + 1, 13);

  return (
    <div className={`dealing-fullscreen-overlay ${isFadingOut ? 'fade-out' : ''}`}>
      {/* Skip Button */}
      <button className="btn-skip-dealing" onClick={handleSkip} title="Lewati Animasi">
        <FastForward size={14} />
        <span>Lewati</span>
      </button>

      {/* TOP: Seat Pod */}
      <div className="dealing-seat-pod seat-pod-top">
        <div className="seat-pod-avatar">{seats.top?.avatar || '👤'}</div>
        <div className="seat-pod-meta">
          <span className="seat-pod-name">{seats.top?.name || 'Pemain Atas'}</span>
          <span className="seat-pod-count">
            🂠 {topDealtCount}/13 kartu tertutup
          </span>
        </div>
      </div>

      {/* MIDDLE ROW: Left Seat, Center Deck / Riffle, Right Seat */}
      <div className="dealing-middle-arena">
        {/* LEFT: Seat Pod */}
        <div className="dealing-seat-pod seat-pod-left">
          <div className="seat-pod-avatar">{seats.left?.avatar || '👤'}</div>
          <div className="seat-pod-meta">
            <span className="seat-pod-name">{seats.left?.name || 'Pemain Kiri'}</span>
            <span className="seat-pod-count">
              🂠 {leftDealtCount}/13
            </span>
          </div>
        </div>

        {/* CENTER TABLE: Shuffling Deck / Dealing Hub */}
        <div className="dealing-center-stage">
          {phase === 'shuffle' && (
            <div className="shuffle-stage">
              {/* Left Packet riffle */}
              <div className="riffle-packet riffle-left">
                <div className="packet-card" />
                <div className="packet-card" />
                <div className="packet-card" />
              </div>

              {/* Center Deck Core */}
              <div className="center-deck-core">
                <Sparkles size={28} className="shuffle-sparkle-icon" />
                <span className="deck-thickness-badge">52 KARTU</span>
              </div>

              {/* Right Packet riffle */}
              <div className="riffle-packet riffle-right">
                <div className="packet-card" />
                <div className="packet-card" />
                <div className="packet-card" />
              </div>
            </div>
          )}

          {phase !== 'shuffle' && (
            <div className="dealing-hub">
              {/* Central Stack with visual card count remaining */}
              <div className="hub-deck-stack">
                <div className="stack-layer layer-3" />
                <div className="stack-layer layer-2" />
                <div className="stack-layer layer-1">
                  <span className="hub-card-icon">♠</span>
                  <small className="hub-card-count">
                    {Math.max(52 - totalDealt, 0)}
                  </small>
                </div>
              </div>

              {/* Active Flying Card Sliding to Player */}
              {flyingCard && (
                <div
                  key={flyingCard.id}
                  className={`flying-card-shot flight-to-${flyingCard.target}`}
                >
                  <div className="flying-card-inner">♠</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Seat Pod */}
        <div className="dealing-seat-pod seat-pod-right">
          <div className="seat-pod-avatar">{seats.right?.avatar || '👤'}</div>
          <div className="seat-pod-meta">
            <span className="seat-pod-name">{seats.right?.name || 'Pemain Kanan'}</span>
            <span className="seat-pod-count">
              🂠 {rightDealtCount}/13
            </span>
          </div>
        </div>
      </div>

      {/* STATUS BANNER */}
      <div className="dealing-status-banner">
        <span className="status-pulse-dot" />
        <span className="status-text">
          {phase === 'shuffle' && 'Dealer mengocok 52 kartu remi secara acak...'}
          {phase === 'dealing' &&
            `Membagikan kartu tertutup satu per satu... Putaran ${currentRound}/13 (${totalDealt}/52)`}
          {phase === 'revealing' &&
            'Semua kartu tertutup terbagi! Membuka kartu tangan Anda...'}
        </span>
      </div>

      {/* BOTTOM: Player Hand Tray with 13 Flip Cards */}
      <div className="dealing-bottom-tray-area">
        <div className="bottom-tray-label">
          <span className="tray-player-name">{seats.bottom?.name || 'Kartu Tangan Anda'}</span>
          <span className="tray-card-counter">
            {phase === 'revealing'
              ? '✨ Terbuka & Tersusun'
              : `(${bottomDealtCount}/13 kartu tertutup)`}
          </span>
        </div>

        {/* Hand Cards Fan (13 Cards) */}
        <div className="dealing-hand-row">
          {displayHand.map((card, index) => {
            const isDelivered = index < bottomDealtCount;
            const isFlipped = flippedCards.has(index);

            return (
              <div
                key={card.id || index}
                className={`card-flip-pod ${isDelivered ? 'is-delivered' : 'is-hidden'} ${
                  isFlipped ? 'is-revealed' : ''
                }`}
                style={{
                  '--card-index': index,
                  zIndex: 20 + index,
                }}
              >
                <div className={`card-flip-inner ${isFlipped ? 'flipped' : ''}`}>
                  {/* FACE 1: FRONT (Tertutup / Face-Down Casino Back) */}
                  <div className="card-face card-face-down">
                    <div className="face-down-pattern">
                      <div className="face-down-border">
                        <span className="face-down-emblem">♠</span>
                      </div>
                    </div>
                  </div>

                  {/* FACE 2: BACK (Terbuka / Face-Up Authentic Playing Card) */}
                  <div
                    className={`card-face card-face-up suit-${card.suit}`}
                    style={{ color: SUIT_COLORS[card.suit] || '#0f172a' }}
                  >
                    {/* Top Left Corner */}
                    <div className="card-corner-index top-left">
                      <span className="idx-rank">{card.label}</span>
                      <span className="idx-suit">{card.symbol}</span>
                    </div>

                    {/* Center Giant Suit */}
                    <div className="card-center-symbol">{card.symbol}</div>

                    {/* Bottom Right Corner */}
                    <div className="card-corner-index bottom-right">
                      <span className="idx-rank">{card.label}</span>
                      <span className="idx-suit">{card.symbol}</span>
                    </div>

                    {/* Shimmer light bar on reveal */}
                    {isFlipped && <div className="card-reveal-shimmer" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
