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
  const [shuffleSubStage, setShuffleSubStage] = useState('wash'); // 'wash' | 'riffle1' | 'cut' | 'riffle2'
  const [shuffleSecondsLeft, setShuffleSecondsLeft] = useState(15);
  const [totalDealt, setTotalDealt] = useState(0);
  const [bottomDealtCount, setBottomDealtCount] = useState(0);
  const [leftDealtCount, setLeftDealtCount] = useState(0);
  const [topDealtCount, setTopDealtCount] = useState(0);
  const [rightDealtCount, setRightDealtCount] = useState(0);
  const [flyingCard, setFlyingCard] = useState(null); // { id, target: 'bottom'|'left'|'top'|'right' }
  const [flippedCards, setFlippedCards] = useState(new Set()); // Set of indices flipped to face-up
  const [isFadingOut, setIsFadingOut] = useState(false);

  const timerRef = useRef(null);
  const shuffleTimersRef = useRef([]);
  const countdownIntervalRef = useRef(null);
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
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (dealIntervalRef.current) clearInterval(dealIntervalRef.current);
    if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
    shuffleTimersRef.current.forEach((t) => clearTimeout(t));
    shuffleTimersRef.current = [];
  };

  useEffect(() => {
    if (!isActive) {
      clearAllTimers();
      setPhase('shuffle');
      setShuffleSubStage('wash');
      setShuffleSecondsLeft(15);
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
    setShuffleSubStage('wash');
    setShuffleSecondsLeft(15);
    setTotalDealt(0);
    setBottomDealtCount(0);
    setLeftDealtCount(0);
    setTopDealtCount(0);
    setRightDealtCount(0);
    setFlyingCard(null);
    setFlippedCards(new Set());
    setIsFadingOut(false);

    // =========================================================================
    // STEP 1: AUTHENTIC CASINO SHUFFLE SEQUENCE (15 SECONDS MINIMUM)
    // =========================================================================
    audio.shuffleSound();

    // 1-second interval countdown for 15s display
    countdownIntervalRef.current = setInterval(() => {
      setShuffleSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    const addShuffleTimer = (fn, delay) => {
      const id = setTimeout(fn, delay);
      shuffleTimersRef.current.push(id);
    };

    // Stage 1.1: 0s - 4s (Wash & Scramble on felt)
    addShuffleTimer(() => {
      audio.shuffleSound();
    }, 2000);

    // Stage 1.2: 4s - 8s (First Riffle Shuffle & Arch Bridge)
    addShuffleTimer(() => {
      setShuffleSubStage('riffle1');
      audio.riffleFlutterSound();
    }, 4000);

    addShuffleTimer(() => {
      audio.riffleFlutterSound();
    }, 6200);

    // Stage 1.3: 8s - 11.5s (Triple Strip Cut & Interlace)
    addShuffleTimer(() => {
      setShuffleSubStage('cut');
      audio.deckCutTapSound();
    }, 8000);

    addShuffleTimer(() => {
      audio.deckCutTapSound();
    }, 9800);

    // Stage 1.4: 11.5s - 15.2s (Final Fast Riffle & Casino Box Tap)
    addShuffleTimer(() => {
      setShuffleSubStage('riffle2');
      audio.riffleFlutterSound();
    }, 11500);

    addShuffleTimer(() => {
      audio.riffleFlutterSound();
    }, 13300);

    addShuffleTimer(() => {
      audio.deckCutTapSound();
    }, 14700);

    // End of 15-second Shuffling: Transition to Dealing Phase at 15200ms
    timerRef.current = setTimeout(() => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      // =======================================================================
      // STEP 2: DEALING ONE-BY-ONE FACE-DOWN
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
    }, 15200);

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
              {/* STAGE A: TABLE WASH / SCRAMBLE (0s - 4s) */}
              {shuffleSubStage === 'wash' && (
                <div className="shuffle-wash-cluster">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="wash-card-particle"
                      style={{
                        '--wash-angle': `${i * 30}deg`,
                        '--wash-radius': `${38 + (i % 3) * 16}px`,
                        '--wash-delay': `${(i % 4) * 0.15}s`,
                      }}
                    />
                  ))}
                  <div className="center-deck-core wash-core">
                    <Sparkles size={26} className="shuffle-sparkle-icon" />
                    <span className="deck-thickness-badge">TABLE WASH</span>
                    <span className="deck-sub-badge">{totalCards} KARTU</span>
                  </div>
                </div>
              )}

              {/* STAGE B: RIFFLE 1 & ARCH BRIDGE (4s - 8s) */}
              {shuffleSubStage === 'riffle1' && (
                <div className="shuffle-riffle-cluster">
                  <div className="riffle-packet riffle-left">
                    <div className="packet-card" />
                    <div className="packet-card" />
                    <div className="packet-card" />
                  </div>
                  <div className="center-deck-core">
                    <Sparkles size={24} className="shuffle-sparkle-icon" />
                    <span className="deck-thickness-badge">RIFFLE & ARCH</span>
                    <span className="deck-sub-badge">Tahap 2/4</span>
                  </div>
                  <div className="riffle-packet riffle-right">
                    <div className="packet-card" />
                    <div className="packet-card" />
                    <div className="packet-card" />
                  </div>
                </div>
              )}

              {/* STAGE C: TRIPLE STRIP CUT & INTERLACE (8s - 11.5s) */}
              {shuffleSubStage === 'cut' && (
                <div className="shuffle-cut-cluster">
                  <div className="cut-deck-packet cut-packet-1">
                    <span className="cut-packet-tag">I</span>
                  </div>
                  <div className="cut-deck-packet cut-packet-2">
                    <span className="cut-packet-tag">II</span>
                  </div>
                  <div className="cut-deck-packet cut-packet-3">
                    <span className="cut-packet-tag">III</span>
                  </div>
                  <div className="cut-center-badge">
                    <span>✂️ STRIP CUT</span>
                  </div>
                </div>
              )}

              {/* STAGE D: FINAL FAST RIFFLE & BOX TAP (11.5s - 15.2s) */}
              {shuffleSubStage === 'riffle2' && (
                <div className="shuffle-riffle-cluster cluster-fast">
                  <div className="riffle-packet riffle-left fast">
                    <div className="packet-card" />
                    <div className="packet-card" />
                  </div>
                  <div className="center-deck-core core-glow-gold">
                    <Sparkles size={28} className="shuffle-sparkle-icon" />
                    <span className="deck-thickness-badge">FINAL SQUARE</span>
                    <span className="deck-sub-badge">SIAP MAIN</span>
                  </div>
                  <div className="riffle-packet riffle-right fast">
                    <div className="packet-card" />
                    <div className="packet-card" />
                  </div>
                </div>
              )}
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

      {/* STATUS BANNER WITH REALTIME 15S PROGRESS */}
      <div className="dealing-status-banner">
        <span className="status-pulse-dot" />
        <div className="status-banner-content">
          <div className="status-text-row">
            <span className="status-text">
              {phase === 'shuffle' && (
                shuffleSubStage === 'wash'
                  ? `Tahap 1/4: Dealer mengacak seluruh ${totalCards} kartu di meja (Casino Scramble Wash)...`
                  : shuffleSubStage === 'riffle1'
                  ? `Tahap 2/4: Riffle Shuffle & Arch Bridge — Menyisipkan kartu secara bersilang...`
                  : shuffleSubStage === 'cut'
                  ? `Tahap 3/4: Triple Strip Cut — Memotong dan membalik segmen tumpukan kartu...`
                  : `Tahap 4/4: Final Riffle & Box Tap — Dek teracak sempurna, siap dibagikan!`
              )}
              {phase === 'dealing' &&
                `Membagikan kartu tertutup satu per satu... Putaran ${currentRound}/${cardsPerHand} (${totalDealt}/${totalCards})`}
              {phase === 'revealing' &&
                'Semua kartu tertutup terbagi! Membuka kartu tangan Anda...'}
            </span>
            {phase === 'shuffle' && (
              <span className="status-countdown-tag">
                ⏳ <strong>{shuffleSecondsLeft}s</strong>
              </span>
            )}
          </div>

          {phase === 'shuffle' && (
            <div className="shuffle-progress-track">
              <div
                className="shuffle-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, Math.round(((15.2 - shuffleSecondsLeft) / 15.2) * 100)))}%`,
                }}
              />
            </div>
          )}
        </div>
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
