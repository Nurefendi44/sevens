import React, { useState } from 'react';
import CardView from '../../../components/CardView.jsx';
import { cardEquals } from '../../../engine/deck.js';
import { calculateHandScore41, getBest4CardEvaluation } from '../engine/scoring41.js';
import { TURN_PHASE_41, DRAW_SOURCE_41 } from '../engine/constants41.js';
import {
  Layers,
  ArrowDownToLine,
  Trash2,
  HelpCircle,
  Flame,
  ArrowRight,
  ShieldAlert,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  AlertTriangle,
} from 'lucide-react';
import '../../../styles/game41.css';

export default function Table41({
  gameState,
  onDrawCard,
  onDiscardCard,
  onCloseHand,
  isMyTurn,
  myPlayerId,
  isMultiplayer = false,
  onOpenRules,
}) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState('outgoing'); // 'outgoing' | 'incoming'

  if (!gameState || !gameState.players || !Array.isArray(gameState.players) || gameState.players.length === 0 || !gameState.hands) {
    return null;
  }

  const currentTurnPlayer = gameState.players.find((p) => p.id === gameState.currentPlayer) || gameState.players[0];

  // In multiplayer/single-player viewer stays fixed to user, in local pass-and-play it follows whose turn it is
  const isDedicatedViewer = isMultiplayer || (myPlayerId && gameState.players.some((p) => p.id === myPlayerId && p.isHuman));
  const myPlayer = isDedicatedViewer
    ? (gameState.players.find((p) => p.id === myPlayerId) || gameState.players[0] || { id: myPlayerId, name: 'Pemain' })
    : (gameState.players.find((p) => p.id === gameState.currentPlayer) || gameState.players[0] || { id: 'player_1', name: 'Pemain' });

  const myHand = (myPlayer?.id && gameState.hands && gameState.hands[myPlayer.id]) || [];
  const opponentPlayers = (gameState.players || []).filter((p) => p.id !== myPlayer?.id);

  const drawPileCount = gameState.drawPile?.length || 0;
  const passedDiscard = gameState.passedDiscard;
  const isDiscardForMe = Boolean(passedDiscard && passedDiscard.card && (passedDiscard.toPlayerId === myPlayer.id));

  // Private Discards PASSED TO viewing player only ("riwayat kartu yang dibuang ke saya")
  const myIncomingDiscards = (myPlayer?.id && gameState.discardsToPlayer?.[myPlayer.id]) || [];

  // Private Discards MADE BY viewing player only ("riwayat kartu yang dibuang oleh player itu")
  const myOutgoingDiscards = (myPlayer?.id && gameState.playerDiscardHistory?.[myPlayer.id]) || [];

  // Determine next player (who will receive my discarded card)
  const myIndex = gameState.players.findIndex((p) => p.id === myPlayer.id);
  const nextPlayer = gameState.players[(myIndex + 1) % gameState.players.length];

  const currentRound = gameState.currentRound || Math.floor(((gameState.turnNumber || 1) - 1) / (gameState.players?.length || 4)) + 1;
  const canCloseRound = currentRound >= 4;

  const canDraw = isMyTurn && gameState.turnPhase === TURN_PHASE_41.DRAW;
  const canDiscard = isMyTurn && gameState.turnPhase === TURN_PHASE_41.DISCARD && selectedCard;

  // Realtime Live Hand Evaluation for viewer player
  let activeEval;
  let evaluationMode = 'normal'; // 'normal' | 'selected' | 'best4'

  if (myHand.length === 5) {
    if (selectedCard) {
      activeEval = calculateHandScore41(myHand.filter((c) => !cardEquals(c, selectedCard)));
      evaluationMode = 'selected';
    } else {
      activeEval = getBest4CardEvaluation(myHand);
      evaluationMode = 'best4';
    }
  } else {
    activeEval = calculateHandScore41(myHand);
    evaluationMode = 'normal';
  }

  // Preview evaluation if player chooses to close hand with current discard selection
  let previewHandAfterDiscard = myHand;
  if (gameState.turnPhase === TURN_PHASE_41.DISCARD && selectedCard) {
    previewHandAfterDiscard = myHand.filter((c) => !cardEquals(c, selectedCard));
  }
  const previewEval = previewHandAfterDiscard.length === 4
    ? calculateHandScore41(previewHandAfterDiscard)
    : activeEval;

  const handleCardClick = (card) => {
    if (gameState.turnPhase === TURN_PHASE_41.DISCARD) {
      setSelectedCard(card);
    } else {
      setSelectedCard((prev) => (cardEquals(prev, card) ? null : card));
    }
  };

  const handleExecuteCloseHand = () => {
    setShowConfirmClose(false);
    const cardToThrow = gameState.turnPhase === TURN_PHASE_41.DISCARD ? selectedCard : null;
    if (onCloseHand) {
      onCloseHand(cardToThrow);
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
          <span
            style={{
              background: canCloseRound ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.1)',
              border: canCloseRound ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: canCloseRound ? '#fbbf24' : '#cbd5e1',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            Putaran {currentRound}
          </span>
          <span className="status-pulse-dot" />
          <span>
            {isMyTurn ? (
              gameState.turnPhase === TURN_PHASE_41.DRAW ? (
                isDiscardForMe && passedDiscard?.card ? (
                  `Giliran Anda: Ambil kartu dari Dek ATAU ambil Buangan (${passedDiscard.card.label}${passedDiscard.card.symbol}) dari ${passedDiscard.fromPlayerName}`
                ) : (
                  canCloseRound
                    ? 'Giliran Anda: Ambil 1 kartu dari Dek Tertutup, atau Tutup Kartu jika siap!'
                    : `Giliran Anda: Ambil 1 kartu dari Dek Tertutup (Tutup Kartu terbuka di Putaran 4)`
                )
              ) : (
                `Giliran Anda: Pilih 1 kartu di tangan untuk Dibuang ke ${nextPlayer?.name || 'pemain berikutnya'}`
              )
            ) : (
              `Menunggu Giliran: Saat ini giliran ${currentTurnPlayer?.name || 'Pemain Lain'} sedang ${
                gameState.turnPhase === TURN_PHASE_41.DRAW ? 'mengambil kartu' : 'membuang kartu'
              }...`
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Private Discard History Toggle Button */}
            <button
              className="toggle-chip history-toggle-chip"
              onClick={() => setIsHistoryExpanded((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: isHistoryExpanded ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#fbbf24',
                cursor: 'pointer',
              }}
              title="Lihat riwayat kartu buangan (Hanya Anda yang dapat melihat)"
            >
              <Lock size={12} />
              <span>Riwayat Buangan ({myOutgoingDiscards.length + myIncomingDiscards.length})</span>
              {isHistoryExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Live Hand Analyzer Badge with Transparent Formula Breakdown */}
            <div
              className={`game41-hand-analyzer ${activeEval.is41 ? 'is-41' : ''}`}
              title={`Detail poin kartu: ${activeEval.formula}`}
            >
              {activeEval.is41 ? (
                <>
                  <Flame size={15} color="#fbbf24" />
                  <span>🔥 41 MURNI! (41 pts)</span>
                </>
              ) : (
                <>
                  <span style={{ opacity: 0.85, fontSize: '0.78rem' }}>Suit:</span>
                  <span style={{ color: '#fbbf24', textTransform: 'capitalize', fontWeight: 800 }}>
                    {activeEval.bestSuit || '-'}
                  </span>
                  <span className="analyzer-formula-badge" style={{ color: '#cbd5e1', fontSize: '0.78rem', fontFamily: 'var(--font-mono, monospace)' }}>
                    {activeEval.formula}
                  </span>
                  {evaluationMode === 'selected' && (
                    <span style={{ fontSize: '0.66rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                      setelah buang
                    </span>
                  )}
                  {evaluationMode === 'best4' && (
                    <span style={{ fontSize: '0.66rem', color: '#a78bfa', background: 'rgba(167, 139, 250, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                      potensi terbaik
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Private Discard History Panel: Outgoing & Incoming Discards */}
        {isHistoryExpanded && (
          <div className="game41-my-history-bar">
            <div className="my-history-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Lock size={13} color="#fbbf24" />
                <div className="game41-history-tabs">
                  <button
                    className={`history-tab-btn ${activeHistoryTab === 'outgoing' ? 'active' : ''}`}
                    onClick={() => setActiveHistoryTab('outgoing')}
                  >
                    Kartu yang Saya Buang ({myOutgoingDiscards.length})
                  </button>
                  <button
                    className={`history-tab-btn ${activeHistoryTab === 'incoming' ? 'active' : ''}`}
                    onClick={() => setActiveHistoryTab('incoming')}
                  >
                    Dibuang ke Saya ({myIncomingDiscards.length})
                  </button>
                </div>
              </div>
              <span className="my-history-hint">
                🔒 Rahasia: Hanya Anda yang dapat melihat riwayat kartu ini
              </span>
            </div>

            {/* TAB 1: Kartu yang Saya Buang (Outgoing) */}
            {activeHistoryTab === 'outgoing' && (
              myOutgoingDiscards.length > 0 ? (
                <div className="my-history-cards-scroll">
                  {myOutgoingDiscards.map((item, idx) => {
                    const card = item.card || item;
                    const isTaken = item.takenByNextPlayer === true;
                    const isSkipped = item.takenByNextPlayer === false;
                    const isPending = item.takenByNextPlayer === null;
                    const targetName = item.toPlayerName || nextPlayer?.name || 'Pemain berikutnya';

                    return (
                      <div
                        key={card.id ? `${card.id}-${idx}` : idx}
                        className="my-history-card-item"
                        title={`Buangan #${idx + 1} ke ${targetName}: ${card.label}${card.symbol} (${isTaken ? `Diambil oleh ${item.takenByPlayerName || targetName}` : isSkipped ? 'Dilewati' : 'Menunggu respon lawan'})`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '2px', padding: '0 2px' }}>
                          <span className="history-step-num">#{idx + 1}</span>
                          {isTaken ? (
                            <span style={{ fontSize: '0.62rem', color: '#34d399', fontWeight: 800 }}>Diambil</span>
                          ) : isSkipped ? (
                            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Dilewati</span>
                          ) : (
                            <span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 900 }}>Menunggu</span>
                          )}
                        </div>
                        <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                          <CardView card={card} mini />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: '#cbd5e1', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isTaken ? `oleh ${item.takenByPlayerName || targetName}` : `ke ${targetName}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="my-history-empty">
                  Anda belum membuang kartu pada permainan ini.
                </div>
              )
            )}

            {/* TAB 2: Kartu Dibuang ke Saya (Incoming) */}
            {activeHistoryTab === 'incoming' && (
              myIncomingDiscards.length > 0 ? (
                <div className="my-history-cards-scroll">
                  {myIncomingDiscards.map((item, idx) => {
                    const card = item.card;
                    const isTaken = item.taken === true;
                    const isSkipped = item.taken === false;

                    return (
                      <div
                        key={card.id ? `${card.id}-${idx}` : idx}
                        className="my-history-card-item"
                        title={`Kartu #${idx + 1} dari ${item.fromPlayerName || 'pemain sebelumnya'}: ${card.label}${card.symbol} (${isTaken ? 'Diambil ke tangan' : isSkipped ? 'Dilewati' : 'Tersedia saat ini'})`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '2px', padding: '0 2px' }}>
                          <span className="history-step-num">#{idx + 1}</span>
                          {isTaken ? (
                            <span style={{ fontSize: '0.62rem', color: '#34d399', fontWeight: 800 }}>Diambil</span>
                          ) : isSkipped ? (
                            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Dilewati</span>
                          ) : (
                            <span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 900 }}>Tersedia</span>
                          )}
                        </div>
                        <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                          <CardView card={card} mini />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: '#cbd5e1', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.fromPlayerName || 'Lawan'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="my-history-empty">
                  Belum ada kartu buangan yang dioper ke Anda pada permainan ini.
                </div>
              )
            )}
          </div>
        )}

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

            {/* TUTUP KARTU (KNOCK) BUTTON - Player can declare to close at any time during their turn if round >= 4 */}
            {isMyTurn && (
              <button
                className="btn-game41 btn-game41-close-hand"
                disabled={!canCloseRound || (gameState.turnPhase === TURN_PHASE_41.DISCARD && !selectedCard)}
                onClick={() => setShowConfirmClose(true)}
                title={
                  !canCloseRound
                    ? `Tutup Kartu baru dapat dilakukan mulai Putaran ke-4 (Saat ini Putaran ke-${currentRound})`
                    : gameState.turnPhase === TURN_PHASE_41.DRAW
                    ? `Tutup kartu sekarang dengan 4 kartu Anda (${activeEval.bestScore} pts)`
                    : selectedCard
                    ? `Buang ${selectedCard.label}${selectedCard.symbol} dan tutup kartu dengan sisa (${previewEval.bestScore} pts)`
                    : 'Pilih 1 kartu buangan terlebih dahulu untuk menutup kartu'
                }
                style={{
                  opacity: !canCloseRound ? 0.6 : 1,
                  cursor: !canCloseRound ? 'not-allowed' : 'pointer',
                  filter: !canCloseRound ? 'grayscale(0.5)' : 'none',
                }}
              >
                <ShieldAlert size={15} />
                <span>
                  {!canCloseRound
                    ? `Tutup Kartu (Putaran ${currentRound}/4)`
                    : gameState.turnPhase === TURN_PHASE_41.DRAW
                    ? `Tutup Kartu (${activeEval.bestScore} pts)`
                    : selectedCard
                    ? `Tutup Kartu (${previewEval.bestScore} pts)`
                    : 'Pilih 1 Kartu untuk Tutup'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL FOR TUTUP KARTU */}
      {showConfirmClose && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: '480px', width: '92vw', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '2px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                color: '#ef4444',
              }}>
                <ShieldAlert size={30} />
              </div>
            </div>

            <h3 style={{ margin: '0 0 0.5rem 0', color: '#fbbf24', fontSize: '1.3rem' }}>
              Yakin Ingin Menutup Kartu?
            </h3>

            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              margin: '0.75rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Poin Akhir Anda:</span>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: '#fbbf24', fontSize: '1.15rem' }}>
                    {previewEval.bestScore} Poin
                  </strong>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {previewEval.bestSuit} ({previewEval.formula})
                  </div>
                </div>
              </div>
              {gameState.turnPhase === TURN_PHASE_41.DISCARD && selectedCard && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Kartu yang Dibuang:</span>
                  <strong style={{ color: '#f87171', fontSize: '0.9rem' }}>
                    {selectedCard.label}{selectedCard.symbol}
                  </strong>
                </div>
              )}
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.82rem',
              color: '#fca5a5',
              lineHeight: '1.5',
              textAlign: 'left',
              marginBottom: '1.25rem',
            }}>
              <strong>⚠️ ATURAN RESMI TUTUP KARTU:</strong>
              <br />
              Jika kartu Anda ditutup dengan <strong>{previewEval.bestScore} poin</strong>, dan ada pemain lain yang berhasil mendapatkan poin di atasnya, maka <strong>Anda otomatis KALAH di urutan paling bawah</strong>, dan pemain tersebut menjadi juara 1!
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn-header"
                onClick={() => setShowConfirmClose(false)}
                style={{ flex: 1, padding: '0.65rem', cursor: 'pointer' }}
              >
                Batal (Lanjut Main)
              </button>
              <button
                className="btn-header btn-gold"
                onClick={handleExecuteCloseHand}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  borderColor: '#ef4444',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Ya, Tutup Kartu!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
