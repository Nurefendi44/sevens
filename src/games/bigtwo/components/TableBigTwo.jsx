import React, { useState, useMemo } from 'react';
import CardView from '../../../components/CardView.jsx';
import { evaluateCombo, canBeatCombo, sortBigTwoCards } from '../engine/handEvaluator.js';
import { Play, SkipForward, RotateCcw, HelpCircle, Flame, Layers } from 'lucide-react';
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

  return (
    <div className="bigtwo-table-felt">
      <div className="bigtwo-watermark">BIG TWO • CAPSA BANTING</div>

      {/* TOP: Opponents Row */}
      <div className="bigtwo-opponents-row">
        {opponentPlayers.map((p) => {
          const isOpponentTurn = gameState.currentPlayer === p.id;
          const oppCardCount = gameState.hands[p.id]?.length || 0;

          return (
            <div
              key={p.id}
              className={`bigtwo-seat-pod ${isOpponentTurn ? 'active-turn' : ''}`}
            >
              <span style={{ fontSize: '1.25rem' }}>{p.avatar}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '0.8rem', color: isOpponentTurn ? '#38bdf8' : '#f8fafc' }}>
                  {p.name}
                </strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {oppCardCount} kartu tersisa
                </span>
              </div>

              {/* Mini Face-down Cards Fan */}
              <div className="seat-cards-mini-fan">
                {Array.from({ length: Math.min(oppCardCount, 6) }).map((_, idx) => (
                  <div key={idx} className="mini-card-back" />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* CENTER ARENA: Current Trick on Table */}
      <div className="bigtwo-center-arena">
        {isFreeTurn ? (
          <div className="trick-empty-slate">
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>
              ✦ GILIRAN BEBAS ✦
            </span>
            <span>Semua pemain telah pass atau ronde baru dimulai.</span>
            <small style={{ color: '#94a3b8' }}>Keluarkan kombinasi apa saja (Single, Pair, Triple, atau 5 Kartu)!</small>
          </div>
        ) : (
          <>
            <div className="trick-meta-banner">
              <span>Kartu dari <strong>{currentTrick.playedByName}</strong>:</span>
              <span className="trick-combo-badge">{tableCombo?.type?.replace(/_/g, ' ')}</span>
              <span>{tableCombo?.label}</span>
            </div>

            <div className="trick-cards-display">
              {currentTrick.cards.map((card, idx) => (
                <CardView
                  key={card.id || idx}
                  card={card}
                  isPlayable={false}
                  size="medium"
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* BOTTOM: Player Tray & Controls */}
      <div className="bigtwo-tray">
        <div className="bigtwo-tray-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>{myPlayer.avatar}</span>
            <div>
              <strong style={{ color: isMyTurn ? '#38bdf8' : '#e2e8f0', fontSize: '0.95rem' }}>
                {myPlayer.name} {isMultiplayer && '(Anda)'}
              </strong>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {myHand.length} kartu di tangan
                {gameState.config.deckMode === 'double' && (
                  <span style={{ marginLeft: '6px', color: '#a855f7' }}>• Double Deck (104 kartu)</span>
                )}
              </div>
            </div>
          </div>

          {/* Live Hand Evaluation Badge */}
          <div className={`bigtwo-hand-analyzer ${selectedEval?.isValid ? 'is-valid' : ''}`}>
            {selectedCards.length === 0 ? (
              <span>Pilih kartu di bawah untuk dimainkan</span>
            ) : selectedEval?.isValid ? (
              <>
                <Flame size={14} color="#38bdf8" />
                <strong>{selectedEval.label}</strong>
                {beatCheck.canBeat ? (
                  <span style={{ color: '#34d399', fontWeight: 700 }}>(Siap Dimainkan ✅)</span>
                ) : (
                  <span style={{ color: '#f87171' }}>({beatCheck.reason || 'Kalah dari meja ❌'})</span>
                )}
              </>
            ) : (
              <span style={{ color: '#f87171' }}>{selectedEval?.error || 'Kombinasi tidak valid'}</span>
            )}
          </div>

          {onOpenRules && (
            <button
              type="button"
              className="btn-bigtwo btn-bigtwo-reset"
              onClick={onOpenRules}
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}
            >
              <HelpCircle size={14} />
              <span>Panduan Aturan</span>
            </button>
          )}
        </div>

        {/* Player's Cards Fan */}
        <div className="bigtwo-cards-row">
          {myHand.map((card, idx) => {
            const isSelected = selectedCards.some(
              (c) => c.id === card.id || (c.rank === card.rank && c.suit === card.suit)
            );

            return (
              <div
                key={card.id || idx}
                className={`bigtwo-card-slot ${isSelected ? 'selected' : ''}`}
                style={{ zIndex: idx + 1 }}
                onClick={() => toggleSelectCard(card)}
              >
                <CardView
                  card={card}
                  isPlayable={isMyTurn}
                  isSelected={isSelected}
                  size="large"
                />
              </div>
            );
          })}
        </div>

        {/* Interactive Controls */}
        <div className="bigtwo-controls-bar">
          <button
            type="button"
            className="btn-bigtwo btn-bigtwo-play"
            disabled={!isMyTurn || !selectedEval?.isValid || !beatCheck.canBeat}
            onClick={handlePlay}
          >
            <Play size={16} />
            <span>Keluarkan Kartu ({selectedCards.length})</span>
          </button>

          <button
            type="button"
            className="btn-bigtwo btn-bigtwo-pass"
            disabled={!isMyTurn || isFreeTurn}
            onClick={handlePassClick}
            title={isFreeTurn ? 'Meja kosong, Anda tidak boleh pass' : 'Lewat (Pass) giliran ini'}
          >
            <SkipForward size={16} />
            <span>Lewat (Pass)</span>
          </button>

          {selectedCards.length > 0 && (
            <button
              type="button"
              className="btn-bigtwo btn-bigtwo-reset"
              onClick={handleClearSelection}
            >
              <RotateCcw size={14} />
              <span>Batal Pilihan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
