import React, { useState } from 'react';
import CardView from '../../../components/CardView.jsx';
import { cardEquals } from '../../../engine/deck.js';
import { calculateHandScore41 } from '../engine/scoring41.js';
import { TURN_PHASE_41, DRAW_SOURCE_41 } from '../engine/constants41.js';
import { Layers, ArrowDownToLine, Trash2, HelpCircle, Flame, ArrowRight, CornerDownRight } from 'lucide-react';
import '../../../styles/game41.css';

export default function Table41({
  gameState,
  onDrawCard,
  onDiscardCard,
  isMyTurn,
  myPlayerId,
  isMultiplayer = false,
  onOpenRules,
}) {
  const [selectedCard, setSelectedCard] = useState(null);

  if (!gameState) return null;

  const currentTurnPlayer = gameState.players.find((p) => p.id === gameState.currentPlayer);

  // In local pass-and-play, bottom player perspective follows whose turn it is
  const myPlayer = isMultiplayer
    ? (gameState.players.find((p) => p.id === myPlayerId) || gameState.players[0])
    : (gameState.players.find((p) => p.id === gameState.currentPlayer) || gameState.players[0]);

  const myHand = gameState.hands[myPlayer.id] || [];
  const opponentPlayers = gameState.players.filter((p) => p.id !== myPlayer.id);

  const drawPileCount = gameState.drawPile?.length || 0;
  const passedDiscard = gameState.passedDiscard;
  const isDiscardForMe = Boolean(passedDiscard && passedDiscard.card && (passedDiscard.toPlayerId === myPlayer.id));

  // Determine next player (who will receive my discarded card)
  const myIndex = gameState.players.findIndex((p) => p.id === myPlayer.id);
  const nextPlayer = gameState.players[(myIndex + 1) % gameState.players.length];

  // Realtime Live Hand Evaluation for viewer player
  const handEval = calculateHandScore41(myHand);
  const canDraw = isMyTurn && gameState.turnPhase === TURN_PHASE_41.DRAW;
  const canDiscard = isMyTurn && gameState.turnPhase === TURN_PHASE_41.DISCARD && selectedCard;

  const handleCardClick = (card) => {
    if (gameState.turnPhase === TURN_PHASE_41.DISCARD) {
      setSelectedCard(card);
    } else {
      setSelectedCard((prev) => (cardEquals(prev, card) ? null : card));
    }
  };

  return (
    <div className="game41-table-felt">
      <div className="game41-watermark">REMI 41</div>

      {/* TOP: Opponent Players Row (Supports 4, 5, or 6 players) */}
      <div className="game41-opponents-row">
        {opponentPlayers.map((p) => {
          const isOpponentTurn = gameState.currentPlayer === p.id;
          const oppCardCount = gameState.hands[p.id]?.length || 4;

          return (
            <div
              key={p.id}
              className={`game41-seat-pod ${isOpponentTurn ? 'active-turn' : ''}`}
            >
              <span style={{ fontSize: '1.25rem' }}>{p.avatar}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '0.8rem', color: isOpponentTurn ? '#fbbf24' : '#f8fafc' }}>
                  {p.name}
                </strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {oppCardCount} kartu
                </span>
              </div>

              {/* Mini Face-down Cards Fan */}
              <div className="seat-cards-mini-fan">
                {Array.from({ length: Math.min(oppCardCount, 5) }).map((_, idx) => (
                  <div key={idx} className="mini-card-back" />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* CENTER ARENA: Draw Pile (Stock) & Passed Discard to Next Player */}
      <div className="game41-center-arena">
        {/* Status Indicator Banner */}
        <div className="game41-action-status-banner">
          <span className="status-pulse-dot" />
          <span>
            {isMyTurn ? (
              gameState.turnPhase === TURN_PHASE_41.DRAW ? (
                isDiscardForMe && passedDiscard?.card ? (
                  `Giliran Anda: Ambil kartu dari Dek ATAU ambil Buangan (${passedDiscard.card.label}${passedDiscard.card.symbol}) dari ${passedDiscard.fromPlayerName}`
                ) : (
                  'Giliran Anda: Ambil 1 kartu dari Tumpukan Dek Tertutup'
                )
              ) : (
                `Giliran Anda: Pilih 1 kartu di tangan untuk Dibuang ke ${nextPlayer?.name || 'pemain berikutnya'}`
              )
            ) : (
              `Giliran ${currentTurnPlayer?.name || 'Pemain Lain'} (${
                gameState.turnPhase === TURN_PHASE_41.DRAW ? 'Mengambil kartu' : 'Membuang kartu'
              })`
            )}
          </span>
        </div>

        {/* Piles & Passed Discard Container */}
        <div className="piles-container">
          {/* 1. DRAW PILE (STOCK) */}
          <div
            className={`card-pile-wrapper ${canDraw ? 'clickable pulse-glow' : ''}`}
            onClick={() => canDraw && onDrawCard(DRAW_SOURCE_41.STOCK)}
            title={canDraw ? 'Klik untuk mengambil 1 kartu dari Dek Tertutup' : 'Tumpukan Kartu Dek'}
          >
            <div className="pile-card-box draw-pile-box">
              <div className="pile-thickness-layer" />
              <Layers size={22} />
              <span className="pile-remaining-badge">{drawPileCount}</span>
            </div>
            <span className="pile-label-tag">Dek Tertutup ({drawPileCount})</span>
          </div>

          {/* 2. PASSED DISCARD (BUANGAN TERARAH KE PEMAIN BERIKUTNYA) */}
          <div
            className={`card-pile-wrapper ${canDraw && isDiscardForMe ? 'clickable pulse-glow' : ''}`}
            onClick={() => canDraw && isDiscardForMe && onDrawCard(DRAW_SOURCE_41.DISCARD)}
            title={
              canDraw && isDiscardForMe
                ? `Klik untuk mengambil kartu buangan ${passedDiscard.card.label}${passedDiscard.card.symbol} dari ${passedDiscard.fromPlayerName}`
                : passedDiscard?.card
                ? `Buangan dari ${passedDiscard.fromPlayerName} untuk ${passedDiscard.toPlayerName}`
                : 'Belum ada operan buangan'
            }
          >
            {passedDiscard?.card ? (
              <div className="pile-card-box" style={{ position: 'relative' }}>
                <CardView card={passedDiscard.card} mini />
                {isDiscardForMe && (
                  <span className="passed-badge-targeted">UNTUK ANDA!</span>
                )}
              </div>
            ) : (
              <div className="pile-card-box discard-pile-box">
                <span className="discard-empty-placeholder">Kosong</span>
              </div>
            )}
            <span className="pile-label-tag">
              {passedDiscard?.card ? (
                <>Buangan: {passedDiscard.fromPlayerName}</>
              ) : (
                'Buangan'
              )}
            </span>
          </div>
        </div>

        {/* Direction Notice */}
        {passedDiscard?.card && (
          <div className="passed-direction-pill">
            <span>{passedDiscard.fromPlayerName}</span>
            <ArrowRight size={13} color="#fbbf24" />
            <span style={{ color: isDiscardForMe ? '#34d399' : '#94a3b8', fontWeight: 700 }}>
              {isDiscardForMe ? 'Anda' : passedDiscard.toPlayerName}
            </span>
          </div>
        )}
      </div>

      {/* BOTTOM: Player Hand Tray & Interactive Controls */}
      <div className="game41-tray">
        <div className="game41-tray-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.3rem' }}>{myPlayer.avatar}</span>
            <strong>{myPlayer.name}</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              ({myHand.length} kartu)
            </span>
          </div>

          {/* Live Hand Analyzer Badge */}
          <div className={`game41-hand-analyzer ${handEval.is41 ? 'is-41' : ''}`}>
            {handEval.is41 ? (
              <>
                <Flame size={15} color="#fbbf24" />
                <span>🔥 41 MURNI!</span>
              </>
            ) : (
              <>
                <span>Suit Dominan:</span>
                <span style={{ color: '#fbbf24', textTransform: 'capitalize' }}>
                  {handEval.bestSuit || '-'}
                </span>
                <span className="analyzer-score-badge">
                  ({handEval.bestScore} pts)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Hand Cards Row */}
        <div className="game41-cards-row">
          {myHand.map((card) => {
            const isSelected = cardEquals(selectedCard, card);

            return (
              <CardView
                key={card.id}
                card={card}
                isSelected={isSelected}
                onClick={() => handleCardClick(card)}
              />
            );
          })}
        </div>

        {/* Action Controls Bar */}
        <div className="game41-controls-bar">
          <button
            className="toggle-chip"
            onClick={onOpenRules}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <HelpCircle size={13} />
            <span>Aturan 41</span>
          </button>

          <div className="game41-actions-group">
            {/* Draw from Stock or Passed Discard */}
            {gameState.turnPhase === TURN_PHASE_41.DRAW && (
              <>
                <button
                  className="btn-game41 btn-game41-draw"
                  disabled={!canDraw || drawPileCount === 0}
                  onClick={() => onDrawCard(DRAW_SOURCE_41.STOCK)}
                >
                  <ArrowDownToLine size={15} />
                  <span>Ambil Dek ({drawPileCount})</span>
                </button>

                <button
                  className="btn-game41 btn-game41-draw"
                  disabled={!canDraw || !isDiscardForMe || !passedDiscard?.card}
                  onClick={() => onDrawCard(DRAW_SOURCE_41.DISCARD)}
                  style={{
                    background: isDiscardForMe
                      ? 'linear-gradient(135deg, #059669, #10b981)'
                      : 'rgba(255, 255, 255, 0.05)',
                  }}
                  title={
                    isDiscardForMe
                      ? `Ambil buangan ${passedDiscard.card.label}${passedDiscard.card.symbol} dari ${passedDiscard.fromPlayerName}`
                      : 'Belum ada kartu buangan yang dioper ke Anda'
                  }
                >
                  <ArrowDownToLine size={15} />
                  <span>
                    {isDiscardForMe && passedDiscard?.card
                      ? `Ambil Buangan ${passedDiscard.fromPlayerName} (${passedDiscard.card.label}${passedDiscard.card.symbol})`
                      : 'Buangan Belum Untuk Anda'}
                  </span>
                </button>
              </>
            )}

            {/* Discard Card to Next Player */}
            {gameState.turnPhase === TURN_PHASE_41.DISCARD && (
              <button
                className="btn-game41 btn-game41-discard"
                disabled={!canDiscard}
                onClick={() => selectedCard && onDiscardCard(selectedCard)}
              >
                <Trash2 size={15} />
                <span>
                  {selectedCard
                    ? `Buang (${selectedCard.label}${selectedCard.symbol}) ke ${nextPlayer?.name || 'Pemain Berikutnya'}`
                    : `Pilih 1 Kartu untuk Dibuang ke ${nextPlayer?.name || 'Pemain Berikutnya'}`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
