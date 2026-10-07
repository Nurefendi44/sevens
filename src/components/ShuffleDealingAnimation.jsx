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

  // Dynamic hand size based on active game (8 for 6p, 10 for 5p, 13 for 4p)
  const cardsPerHand = playerHand && playerHand.length > 0
    ? playerHand.length
    : (seats.topPlayers?.length === 3 ? 8 : seats.topPlayers?.length === 2 ? 10 : 13);
  const playerCount = seats.topPlayers && seats.topPlayers.length > 0
    ? seats.topPlayers.length + 3
    : 4;
  const totalCards = cardsPerHand * playerCount;

  // Hand cards to display for user
  const displayHand = playerHand && playerHand.length > 0
    ? playerHand
    : Array.from({ length: cardsPerHand }, (_, i) => ({
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
      // Cards dealt sequentially around the table
      // =======================================================================
      setPhase('dealing');
      let currentCardIndex = 0;
      const targets = seats.topPlayers && seats.topPlayers.length > 1
        ? ['bottom', 'left', ...seats.topPlayers.map((_, i) => `top_${i}`), 'right']
        : ['bottom', 'left', 'top', 'right'];

      dealIntervalRef.current = setInterval(() => {
        if (currentCardIndex >= totalCards) {
          if (dealIntervalRef.current) clearInterval(dealIntervalRef.current);
          setFlyingCard(null);

          // All cards are dealt! Transition to REVEAL PHASE
          timerRef.current = setTimeout(() => {
            startRevealPhase();
          }, 350);
          return;
        }

        const target = targets[currentCardIndex % targets.length];
        currentCardIndex++;
        const currentNum = currentCardIndex;

        setTotalDealt(currentNum);
        setFlyingCard({ id: currentNum, target: target.startsWith('top') ? 'top' : target });
        audio.dealCardSound();

        // Increment seat counters as card arrives
        if (target === 'bottom') {
          setBottomDealtCount((prev) => Math.min(prev + 1, cardsPerHand));
        } else if (target === 'left') {
          setLeftDealtCount((prev) => Math.min(prev + 1, cardsPerHand));
        } else if (target.startsWith('top')) {
          setTopDealtCount((prev) => Math.min(prev + 1, cardsPerHand));
        } else if (target === 'right') {
          setRightDealtCount((prev) => Math.min(prev + 1, cardsPerHand));
        }
      }, 48);
    }, 1100);

    return () => {
      clearAllTimers();
    };
  }, [isActive, totalCards, cardsPerHand]);

  // ===========================================================================
  // STEP 3: REVEAL PHASE - FLIPPING FACE-DOWN CARDS TO FACE-UP 3D
  // ===========================================================================
  const startRevealPhase = () => {
    setPhase('revealing');
    let cardIdx = 0;

    revealIntervalRef.current = setInterval(() => {
      if (cardIdx >= cardsPerHand) {
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

  const currentRound = Math.min(Math.floor(totalDealt / playerCount) + 1, cardsPerHand);

  return (
    <div className={`dealing-fullscreen-overlay ${isFadingOut ? 'fade-out' : ''}`}>
      {/* Skip Button */}
      <button className="btn-skip-dealing" onClick={handleSkip} title="Lewati Animasi">
        <FastForward size={14} />
        <span>Lewati</span>
      </button>

      {/* TOP: Seat Pod */}
      <div className="dealing-seat-pod seat-pod-top">
        <div className="seat-pod-avatar">
          {seats.topPlayers && seats.topPlayers.length > 1
            ? seats.topPlayers.map((p) => p.avatar).join(' ')
            : seats.top?.avatar || '👤'}
        </div>
        <div className="seat-pod-meta">
          <span className="seat-pod-name">
            {seats.topPlayers && seats.topPlayers.length > 1
              ? seats.topPlayers.map((p) => p.name).join(' & ')
              : seats.top?.name || 'Pemain Atas'}
          </span>
          <span className="seat-pod-count">
            🂠 {topDealtCount}/{cardsPerHand} kartu tertutup
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
              🂠 {leftDealtCount}/{cardsPerHand}
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
                <span className="deck-thickness-badge">{totalCards} KARTU</span>
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
                    {Math.max(totalCards - totalDealt, 0)}
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
              🂠 {rightDealtCount}/{cardsPerHand}
            </span>
          </div>
        </div>
      </div>

      {/* STATUS BANNER */}
      <div className="dealing-status-banner">
        <span className="status-pulse-dot" />
        <span className="status-text">
          {phase === 'shuffle' && `Dealer mengocok ${totalCards} kartu remi secara acak...`}
          {phase === 'dealing' &&
            `Membagikan kartu tertutup satu per satu... Putaran ${currentRound}/${cardsPerHand} (${totalDealt}/${totalCards})`}
          {phase === 'revealing' &&
            'Semua kartu tertutup terbagi! Membuka kartu tangan Anda...'}
        </span>
      </div>

      {/* BOTTOM: Player Hand Tray with Flip Cards */}
      <div className="dealing-bottom-tray-area">
        <div className="bottom-tray-label">
          <span className="tray-player-name">{seats.bottom?.name || 'Kartu Tangan Anda'}</span>
          <span className="tray-card-counter">
            {phase === 'revealing'
              ? '✨ Terbuka & Tersusun'
              : `(${bottomDealtCount}/${cardsPerHand} kartu tertutup)`}
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
