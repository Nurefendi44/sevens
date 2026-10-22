import React, { useState, useMemo, useEffect } from 'react';
import CardView from '../../../components/CardView.jsx';
import { evaluateCombo, canBeatCombo } from '../engine/handEvaluator.js';
import { Play, SkipForward, RotateCcw, HelpCircle, Flame, LayoutGrid, Layers, AlertTriangle, X } from 'lucide-react';
import '../../../styles/bigtwo.css';

export default function TableBigTwo({
  gameState,
  myPlayerId,
  isMyTurn,
  onPlayCombo,
  onPass,
  isMultiplayer = false,
  onOpenRules,
  onError,
}) {
  const [selectedCards, setSelectedCards] = useState([]);
  const [isGridView, setIsGridView] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);

  // Auto-dismiss in-game alert after 3.5s
  useEffect(() => {
    if (actionAlert) {
      const timer = setTimeout(() => setActionAlert(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [actionAlert]);

  if (!gameState || !gameState.players || !Array.isArray(gameState.players) || gameState.players.length === 0 || !gameState.hands) {
    return null;
  }

  // Bottom perspective: In multiplayer viewer is myPlayerId, in local it's currentPlayer
  const myPlayer = isMultiplayer
    ? (gameState.players.find((p) => p.id === myPlayerId) || gameState.players[0] || { id: myPlayerId, name: 'Pemain' })
    : (gameState.players.find((p) => p.id === gameState.currentPlayer) || gameState.players[0] || { id: 'player_1', name: 'Pemain' });

  const myHand = (myPlayer?.id && gameState.hands && gameState.hands[myPlayer.id]) || [];
  const opponentPlayers = (gameState.players || []).filter((p) => p.id !== myPlayer?.id);

  const currentTrick = gameState.currentTrick || {};
  const tableCombo = currentTrick.combo || null;
  const isFreeTurn = !tableCombo || !currentTrick.cards || currentTrick.cards.length === 0;

  // Evaluate currently selected cards in real-time
  const selectedEval = useMemo(() => {
    if (selectedCards.length === 0) return null;
    return evaluateCombo(selectedCards);
  }, [selectedCards]);

  // Check if selected combination can beat table
  const beatCheck = useMemo(() => {
    if (!selectedEval || !selectedEval.isValid) return { canBeat: false };
    return canBeatCombo(selectedEval, tableCombo);
  }, [selectedEval, tableCombo]);

  const toggleSelectCard = (card) => {
    setSelectedCards((prev) => {
      const exists = prev.some((c) => c.id === card.id || (c.rank === card.rank && c.suit === card.suit));
      if (exists) {
        return prev.filter((c) => !(c.id === card.id || (c.rank === card.rank && c.suit === card.suit)));
      }
      return [...prev, card];
    });
  };

  const handleClearSelection = () => {
    setSelectedCards([]);
  };

  const triggerAlert = (msg) => {
    setActionAlert(msg);
    if (onError) onError(msg);
  };

  const handlePlay = () => {
    if (!isMyTurn) {
      triggerAlert('Bukan giliran Anda sekarang!');
      return;
    }
    if (selectedCards.length === 0) {
      triggerAlert('Pilih kartu di tangan Anda terlebih dahulu untuk dimainkan!');
      return;
    }
    if (!selectedEval?.isValid) {
      triggerAlert(selectedEval?.error || 'Kombinasi kartu yang Anda pilih tidak sah!');
      return;
    }
    if (!beatCheck.canBeat) {
      triggerAlert(beatCheck.reason || 'Kombinasi kartu Anda tidak dapat mengalahkan kartu di meja!');
      return;
    }

    onPlayCombo(selectedCards);
    setSelectedCards([]);
    setActionAlert(null);
  };

  const handlePassClick = () => {
    if (!isMyTurn || isFreeTurn) return;
    onPass();
    setSelectedCards([]);
    setActionAlert(null);
  };

  // Dynamic overlap calculation ensuring at least 24px (mobile) or 30px (desktop)
  // exposed corner on every card, keeping rank number and suit symbol 100% visible
  const getFanOverlapMargin = (count, isMobile = false) => {
    if (isMobile) {
      if (count <= 3) return 6;
      if (count <= 6) return -8;
      if (count <= 10) return -16;
      if (count <= 16) return -22;
      return -26; // Leaves >=24px exposed on 50px card
    } else {
      if (count <= 3) return 10;
      if (count <= 6) return -12;
      if (count <= 10) return -20;
      if (count <= 16) return -30;
      return -42; // Leaves >=30px exposed on 72px card
    }
  };

  const desktopOverlap = getFanOverlapMargin(myHand.length, false);
  const mobileOverlap = getFanOverlapMargin(myHand.length, true);

  return (
    <div className="bigtwo-table-felt">
      <div className="bigtwo-felt-overlay" />
      <div className="bigtwo-watermark">BIG TWO</div>

      {/* FLOATING ACTION ALERT POPUP (Triggered when invalid cards are played) */}
      {actionAlert && (
        <div className="bigtwo-alert-toast" role="alert">
          <div className="alert-toast-body">
            <AlertTriangle size={17} className="alert-icon" />
            <span className="alert-text">{actionAlert}</span>
          </div>
          <button
            type="button"
            className="btn-alert-dismiss"
            onClick={() => setActionAlert(null)}
            aria-label="Tutup Peringatan"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* TOP: Opponents Row */}
      <div className="bigtwo-opponents-row">
        {opponentPlayers.map((p) => {
          const isOpponentTurn = gameState.currentPlayer === p.id;
          const oppCardCount = gameState.hands[p.id]?.length || 0;

          return (
            <div
              key={p.id}
              className={`bigtwo-opponent-card ${isOpponentTurn ? 'active-turn' : ''}`}
            >
              <div className="bigtwo-opp-header">
                <span className="opp-avatar">{p.avatar || '🤖'}</span>
                <span className="opp-name">{p.name} : <strong>{oppCardCount} cards</strong></span>
                {isOpponentTurn && <span className="turn-indicator-badge">Berpikir...</span>}
              </div>

              {/* Fan of Face-Down Cards for Opponent */}
              <div className="bigtwo-opp-cards-fan">
                {Array.from({ length: Math.min(oppCardCount, 16) }).map((_, idx) => (
                  <div
                    key={idx}
                    className="bigtwo-mini-card-back"
                    style={{ marginLeft: idx === 0 ? 0 : '-11px' }}
                  />
                ))}
                {oppCardCount > 16 && (
                  <span className="opp-more-cards">+{oppCardCount - 16}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CENTER ARENA: Current Table Trick */}
      <div className="bigtwo-center-arena">
        {isFreeTurn ? (
          <div className="trick-empty-slate">
            <span className="free-turn-badge">✦ GILIRAN BEBAS ✦</span>
            <span className="free-turn-text">Meja bersih! Anda bebas mengeluarkan kombinasi apa saja (Single, Pair, Triple, atau 5 Kartu).</span>
          </div>
        ) : (
          <div className="trick-active-box">
            <div className="trick-meta-banner">
              <span>Current combo dari <strong>{currentTrick.playedByName}</strong>:</span>
              <span className="trick-combo-badge">{tableCombo?.type?.replace(/_/g, ' ')}</span>
              <strong style={{ color: '#fbbf24' }}>{tableCombo?.label}</strong>
            </div>

            <div className="trick-cards-display">
              {currentTrick.cards.map((card, idx) => (
                <div key={card.id || idx} className="table-card-item">
                  <CardView
                    card={card}
                    isPlayable={false}
                    size="medium"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PROMINENT TURN ANNOUNCEMENT (When it's My Turn) */}
      {isMyTurn && (
        <div className="bigtwo-your-turn-banner animate-pulse-glow">
          <span className="turn-fire">🔥</span>
          <span>GILIRAN ANDA!</span>
          <span className="turn-tip desktop-only">— Pilih kartu di bawah lalu klik Keluarkan</span>
        </div>
      )}

      {/* FLOATING ACTION BOX (Take your action! - Clean minimal design, no warning clutter) */}
      <div className={`bigtwo-action-box ${isMyTurn ? 'is-my-turn' : ''}`}>
        <div className="action-box-header">
          <strong>Take your action!</strong>
          <span>Select cards in your hand to play or pass!</span>
        </div>

        {/* Minimal valid combo indicator only - no warning box cluttering UI */}
        {selectedCards.length > 0 && selectedEval?.isValid && (
          <div className="action-combo-analyzer valid">
            <Flame size={14} color="#38bdf8" />
            <span>{selectedEval.label}</span>
          </div>
        )}

        <div className="action-box-buttons">
          <button
            type="button"
            className="btn-action-play"
            disabled={!isMyTurn || selectedCards.length === 0}
            onClick={handlePlay}
          >
            <Play size={16} fill="currentColor" />
            <span>Play a combo {selectedCards.length > 0 ? `(${selectedCards.length})` : ''}</span>
          </button>

          <button
            type="button"
            className="btn-action-pass"
            disabled={!isMyTurn || isFreeTurn}
            onClick={handlePassClick}
            title={isFreeTurn ? 'Meja kosong, wajib mengeluarkan kartu' : 'Lewat giliran'}
          >
            <SkipForward size={16} />
            <span>Pass</span>
          </button>

          {selectedCards.length > 0 && (
            <button
              type="button"
              className="btn-action-deselect"
              onClick={handleClearSelection}
            >
              <RotateCcw size={14} />
              <span>Deselect all</span>
            </button>
          )}

          {onOpenRules && (
            <button
              type="button"
              className="btn-action-rules"
              onClick={onOpenRules}
              title="Lihat Panduan Aturan"
            >
              <HelpCircle size={15} />
            </button>
          )}
        </div>
      </div>

      {/* BOTTOM: Player Tray & Hand Controls */}
      <div className="bigtwo-tray">
        <div className="bigtwo-tray-header">
          <div className="tray-hand-info">
            <span className="tray-avatar">{myPlayer.avatar || '👑'}</span>
            <span className="tray-label">
              Your hand (<strong>{myHand.length} cards</strong>):
            </span>

            {/* Quick Deselect All Button */}
            {selectedCards.length > 0 && (
              <button
                type="button"
                className="btn-deselect-pill"
                onClick={handleClearSelection}
              >
                Deselect all
              </button>
            )}
          </div>

          {/* Toggle Hand Grid View Button */}
          <button
            type="button"
            className={`btn-toggle-grid ${isGridView ? 'active-grid' : ''}`}
            onClick={() => setIsGridView(!isGridView)}
            title="Beralih antara tampilan kisi (grid) dan baris kipas (fan)"
          >
            {isGridView ? <Layers size={16} /> : <LayoutGrid size={16} />}
            <span>Toggle hand grid view</span>
          </button>
        </div>

        {/* PLAYER CARDS CONTAINER: Mode Fan OR Mode Grid */}
        <div
          className={`bigtwo-cards-container ${isGridView ? 'mode-grid' : 'mode-fan'}`}
          style={{
            '--fan-overlap': `${desktopOverlap}px`,
            '--fan-overlap-mobile': `${mobileOverlap}px`,
          }}
        >
          {myHand.map((card, idx) => {
            const isSelected = selectedCards.some(
              (c) => c.id === card.id || (c.rank === card.rank && c.suit === card.suit)
            );

            return (
              <div
                key={card.id || idx}
                className={`bigtwo-card-slot ${isSelected ? 'selected' : ''}`}
                style={!isGridView ? { zIndex: idx + 1 } : {}}
                onClick={() => toggleSelectCard(card)}
              >
                <CardView
                  card={card}
                  isPlayable={isMyTurn}
                  isSelected={isSelected}
                  size={isGridView ? 'medium' : 'large'}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
