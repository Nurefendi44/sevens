import React, { useState, useMemo } from 'react';
import CardView from '../../../components/CardView.jsx';
import { evaluateCombo, canBeatCombo } from '../engine/handEvaluator.js';
import { Play, SkipForward, RotateCcw, HelpCircle, Flame, LayoutGrid, Layers } from 'lucide-react';
import '../../../styles/bigtwo.css';

export default function TableBigTwo({
  gameState,
  myPlayerId,
  isMyTurn,
  onPlayCombo,
  onPass,
  isMultiplayer = false,
  onOpenRules,
}) {
  const [selectedCards, setSelectedCards] = useState([]);
  const [isGridView, setIsGridView] = useState(false);

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

  const handlePlay = () => {
    if (!isMyTurn || !selectedEval?.isValid || !beatCheck.canBeat) return;
    onPlayCombo(selectedCards);
    setSelectedCards([]);
  };

  const handlePassClick = () => {
    if (!isMyTurn || isFreeTurn) return;
    onPass();
    setSelectedCards([]);
  };

  // Dynamic overlap calculation for fan view so cards never overflow even with 26 cards
  const getFanOverlapMargin = (count) => {
    if (count > 22) return -38;
    if (count > 16) return -32;
    if (count > 12) return -26;
    if (count > 8) return -20;
    return -14;
  };

  const fanMargin = getFanOverlapMargin(myHand.length);

  return (
    <div className="bigtwo-table-felt">
      <div className="bigtwo-felt-overlay" />
      <div className="bigtwo-watermark">BIG TWO</div>

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

      {/* FLOATING ACTION BOX (Take your action!) */}
      <div className={`bigtwo-action-box ${isMyTurn ? 'is-my-turn' : ''}`}>
        <div className="action-box-header">
          <strong>Take your action!</strong>
          <span>Select cards in your hand to play or pass!</span>
        </div>

        {/* Live combo analyzer feedback */}
        {selectedCards.length > 0 && (
          <div className={`action-combo-analyzer ${selectedEval?.isValid ? 'valid' : 'invalid'}`}>
            {selectedEval?.isValid ? (
              <>
                <Flame size={14} color="#38bdf8" />
                <span>{selectedEval.label}</span>
                {beatCheck.canBeat ? (
                  <span className="beat-status beat-ok">✅ Siap dikeluarkan</span>
                ) : (
                  <span className="beat-status beat-fail">❌ {beatCheck.reason || 'Kalah dari meja'}</span>
                )}
              </>
            ) : (
              <span className="beat-status beat-fail">⚠️ {selectedEval?.error || 'Kombinasi tidak sah'}</span>
            )}
          </div>
        )}

        <div className="action-box-buttons">
          <button
            type="button"
            className="btn-action-play"
            disabled={!isMyTurn || !selectedEval?.isValid || !beatCheck.canBeat}
            onClick={handlePlay}
          >
            <Play size={16} fill="currentColor" />
            <span>Play a combo ({selectedCards.length})</span>
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

          {/* Toggle Hand Grid View Button (Matching reference design) */}
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
        <div className={`bigtwo-cards-container ${isGridView ? 'mode-grid' : 'mode-fan'}`}>
          {myHand.map((card, idx) => {
            const isSelected = selectedCards.some(
              (c) => c.id === card.id || (c.rank === card.rank && c.suit === card.suit)
            );

            return (
              <div
                key={card.id || idx}
                className={`bigtwo-card-slot ${isSelected ? 'selected' : ''}`}
                style={!isGridView ? { marginLeft: idx === 0 ? 0 : `${fanMargin}px`, zIndex: idx + 1 } : {}}
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
