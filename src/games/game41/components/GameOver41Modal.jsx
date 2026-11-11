import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Home, Award, Sparkles, X } from 'lucide-react';
import { SUIT_SYMBOLS, SUIT_NAMES as SUIT_NAMES_ID } from '../../../engine/constants.js';
import Card from '../../../components/CardView.jsx';
import AvatarDisplay from '../../../components/AvatarDisplay.jsx';
import { resolvePlayerAvatar, getLocalPlayerProfile } from '../../../services/leaderboardService.js';
import { removeFriend } from '../../../services/friendService.js';
import FriendActionButton, { FriendUnfriendModal } from '../../../components/FriendActionButton.jsx';
import '../../../styles/animations.css';
import '../../../styles/friendsModal.css';

export default function GameOver41Modal({
  gameState,
  results,
  onRestart,
  onPlayAgain,
  onClose,
  onBackToMenu,
  onOpenScoreboard,
  isHost = true,
  isMultiplayer = false,
  myPlayerId = null,
  myPlayerName = null,
}) {
  const localProfile = useMemo(() => getLocalPlayerProfile(), []);
  const effectiveMyName = myPlayerName || localProfile?.name || '';
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [friendToast, setFriendToast] = useState(null);

  const showToast = (msg) => {
    setFriendToast(msg);
    setTimeout(() => setFriendToast(null), 3000);
  };

  const activeState = gameState || results;

  const isPlayerMe = (p) => {
    if (!p) return false;
    if (myPlayerId && p.id && p.id === myPlayerId) return true;
    if (!isMultiplayer && (p.isHuman || p.isLocalPlayer)) return true;
    const pName = String(p.name || '').trim().toLowerCase();
    const myName = String(effectiveMyName || '').trim().toLowerCase();
    return Boolean(pName && myName && pName === myName);
  };

  const isPlayerBot = (p) => {
    if (!p) return false;
    if (p.isBot) return true;
    const pInState = (activeState?.players || []).find((pl) => pl.id === p.id);
    if (pInState?.isBot) return true;
    const name = String(p.name || '').trim().toLowerCase();
    return name.startsWith('bot') || name.startsWith('ai_') || name.startsWith('ai ');
  };

  useEffect(() => {
    try {
      confetti({
        particleCount: 95,
        spread: 75,
        origin: { y: 0.55 },
        colors: ['#fbbf24', '#f59e0b', '#38bdf8', '#10b981'],
      });
    } catch {
      // Ignore confetti error in test environment
    }
  }, []);

  // Compute and normalize rankings with robust player resolution
  const rankings = useMemo(() => {
    if (!activeState) return [];
    const rawRankings = activeState.rankings || [];
    const players = activeState.players || [];
    const totalPlayers = players.length || rawRankings.length || 4;

    return rawRankings.map((r, idx) => {
      const pObj = (players || []).find((p) => p.id === r.id || p.id === r.player?.id) || r.player || r;
      const id = r.id || pObj?.id || `p_${idx + 1}`;
      const name = r.name || pObj?.name || `Pemain ${idx + 1}`;
      const avatar = r.avatar || pObj?.avatar || '🃏';
      const rankPos = r.rank !== undefined ? Number(r.rank) : idx + 1;
      const isWinner = idx === 0 || rankPos === 1;
      const isBusted = Boolean(r.isBusted || r.isDisqualified);
      const pointsEarned = isBusted ? 0 : r.pointsEarned !== undefined ? r.pointsEarned : Math.max(0, totalPlayers - rankPos);

      const hand = Array.isArray(r.hand) ? r.hand : (activeState.hands?.[id] || []);
      const score = typeof r.score === 'number' ? r.score : (pObj?.score ?? 0);
      const bestSuit = r.bestSuit || r.evaluation?.bestSuit || 'spades';
      const bestSuitScore = r.bestSuitScore || r.evaluation?.dominantScore || score;
      const otherCardsPenalty = r.otherCardsPenalty !== undefined
        ? r.otherCardsPenalty
        : r.evaluation?.penaltyCardsTotal !== undefined
        ? r.evaluation.penaltyCardsTotal
        : 0;

      return {
        ...r,
        id,
        name,
        avatar,
        isBot: Boolean(pObj?.isBot),
        isBotTakeover: Boolean(pObj?.isBotTakeover),
        rank: rankPos,
        isWinner,
        isBusted,
        pointsEarned,
        score,
        hand,
        bestSuit,
        bestSuitScore,
        otherCardsPenalty,
      };
    });
  }, [activeState]);

  if (!activeState) return null;

  const is41Hit = activeState.reason === '41_hit' || activeState.endReason === '41_hit' || rankings.some((r) => r.is41);
  const isClosedHand = activeState.reason === 'closed_hand' || activeState.endReason === 'closed_hand';
  const winner = rankings[0] || (activeState.players || [])[0];

  const winnerName = winner?.name || activeState.winnerName || 'Pemain';
  const closedByName = activeState.closedByName || winnerName;

  const handleRestartClick = () => {
    if (onPlayAgain) onPlayAgain();
    else if (onRestart) onRestart();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-xl mlbb-gameover-card" style={{ maxWidth: '720px' }}>
        {/* MLBB VICTORY CREST HEADER */}
        <div className="mlbb-victory-header">
          {(onClose || onBackToMenu) && (
            <button
              type="button"
              className="mlbb-victory-close-btn"
              onClick={onClose || onBackToMenu}
              title="Tutup"
            >
              <X size={16} />
            </button>
          )}
          <span className="mlbb-victory-kicker">
            <Sparkles size={11} style={{ display: 'inline', marginRight: '4px' }} />
            REMI 41 ROYAL • BATTLE RESULT
          </span>
          <div className="mlbb-victory-banner-title">
            {is41Hit ? 'PERFECT 41 VICTORY!' : 'MATCH RESULT'}
          </div>
          <div className="mlbb-victory-subtitle">
            {is41Hit
              ? `🎉 ${winnerName} mencapai Nilai Sempurna 41 satu kembang!`
              : isClosedHand
              ? `🔒 ${closedByName} menutup kartu! Pemenang: ${winnerName}`
              : `📦 Stok Dek Habis! Pemenang Nilai Tertinggi: ${winnerName}`}
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* MVP / CHAMPION SPOTLIGHT CARD */}
          {winner && (
            <div className="mlbb-mvp-spotlight">
              <div className="mlbb-mvp-left">
                <div className="mlbb-mvp-avatar-wrap">
                  <span className="mlbb-mvp-crown">👑</span>
                  <AvatarDisplay
                    avatar={resolvePlayerAvatar(winner, '🃏')}
                    fallback="🃏"
                    size={44}
                    playerName={winner.name}
                  />
                  <span className="mlbb-mvp-ribbon">MVP • JUARA 1</span>
                </div>
                <div className="mlbb-mvp-info">
                  <span className="mlbb-mvp-tag">ROYAL KING • REMI 41</span>
                  <div className="mlbb-mvp-name" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <span>{winner.name}</span>
                    {!isPlayerMe(winner) && !isPlayerBot(winner) && (
                      <FriendActionButton
                        targetPlayer={winner}
                        myUsername={effectiveMyName}
                        myProfile={localProfile}
                        onStatusChange={showToast}
                        onRequestUnfriend={setFriendToDelete}
                        size="sm"
                      />
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Kembang Terbaik: {SUIT_SYMBOLS[winner.bestSuit]} {SUIT_NAMES_ID[winner.bestSuit] || winner.bestSuit} ({winner.bestSuitScore} pts)
                  </span>
                </div>
              </div>

              <div className="mlbb-mvp-stats">
                <div className="mlbb-mvp-score-pill">
                  SKOR AKHIR: {winner.score > 0 ? `+${winner.score}` : winner.score} PTS
                </div>
              </div>
            </div>
          )}

          {/* PLAYER RANKING BATTLE ROWS (SAMAKAN DENGAN BIG TWO) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {rankings.map((player, index) => {
              const rankPos = player.rank || index + 1;
              const isBusted = Boolean(player.isBusted);
              const isFirst = rankPos === 1 && !isBusted;
              const isSecond = rankPos === 2 && !isBusted;
              const isThird = rankPos === 3 && !isBusted;
              const rankBadge = isBusted
                ? '🚫 BUSTED (KALAH TUTUP KARTU)'
                : isFirst
                ? '🥇 JUARA 1'
                : isSecond
                ? '🥈 JUARA 2'
                : isThird
                ? '🥉 JUARA 3'
                : `PERINGKAT ${rankPos}`;

              const totalP = activeState.players?.length || rankings.length || 4;
              const pointsEarned = isBusted
                ? 0
                : player.pointsEarned !== undefined
                ? player.pointsEarned
                : Math.max(0, totalP - rankPos);

              const handCards = Array.isArray(player.hand) ? player.hand : [];

              return (
                <div
                  key={player.id || index}
                  className={`mlbb-battle-row rank-${rankPos}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span
                        style={{
                          fontSize: '1.3rem',
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: isFirst
                            ? '1.5px solid #fbbf24'
                            : '1px solid rgba(148, 163, 184, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <AvatarDisplay
                          avatar={resolvePlayerAvatar(player, '🤖')}
                          fallback="🤖"
                          playerName={player.name}
                        />
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem' }}>
                            {player.name}
                          </span>
                          {isPlayerMe(player) && (
                            <span className="mlbb-you-chip" style={{ fontSize: '0.58rem', padding: '0.06rem 0.35rem' }}>
                              KAMU
                            </span>
                          )}
                          {!isPlayerMe(player) && !isPlayerBot(player) && (
                            <FriendActionButton
                              targetPlayer={player}
                              myUsername={effectiveMyName}
                              myProfile={localProfile}
                              onStatusChange={showToast}
                              onRequestUnfriend={setFriendToDelete}
                              size="sm"
                            />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            color: isBusted
                              ? '#f87171'
                              : isFirst
                              ? '#fbbf24'
                              : isSecond
                              ? '#38bdf8'
                              : isThird
                              ? '#f59e0b'
                              : '#94a3b8',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {rankBadge}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 900,
                          padding: '0.24rem 0.65rem',
                          borderRadius: '999px',
                          background:
                            pointsEarned > 0
                              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(180, 83, 9, 0.2))'
                              : 'rgba(100, 116, 139, 0.2)',
                          color: pointsEarned > 0 ? '#fde047' : '#94a3b8',
                          border:
                            pointsEarned > 0
                              ? '1px solid rgba(250, 204, 21, 0.5)'
                              : '1px solid rgba(148, 163, 184, 0.2)',
                        }}
                      >
                        +{pointsEarned} Poin
                      </span>

                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          padding: '0.24rem 0.65rem',
                          borderRadius: '999px',
                          background:
                            player.score >= 0 && !isBusted
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(239, 68, 68, 0.16)',
                          color: player.score >= 0 && !isBusted ? '#34d399' : '#fca5a5',
                          border:
                            player.score >= 0 && !isBusted
                              ? '1px solid rgba(52, 211, 153, 0.4)'
                              : '1px solid rgba(248, 113, 113, 0.35)',
                        }}
                      >
                        {isBusted
                          ? '⚠️ Penalti Tutup'
                          : `Nilai: ${player.score > 0 ? `+${player.score}` : player.score}`}
                      </span>
                    </div>
                  </div>

                  {/* Show Player Hand Cards & Suit Details */}
                  {handCards.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        marginTop: '0.6rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginRight: '0.2rem' }}>
                          Kartu Tangan:
                        </span>
                        {handCards.map((c, idx) => (
                          <Card key={c.id || idx} card={c} mini />
                        ))}
                      </div>
                      <span style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                        Kembang Utama: <strong>{SUIT_SYMBOLS[player.bestSuit]} {SUIT_NAMES_ID[player.bestSuit] || player.bestSuit}</strong> (+{player.bestSuitScore})
                        {player.otherCardsPenalty > 0 ? ` • Penalti Beda Kembang: -${player.otherCardsPenalty}` : ' • Tanpa Penalti!'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MLBB POST-MATCH ACTION FOOTER */}
        <div className="modal-footer mlbb-gameover-footer">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onBackToMenu && (
              <button
                type="button"
                className="mlbb-btn-action mlbb-btn-slate"
                onClick={onBackToMenu}
              >
                <Home size={16} />
                <span>Menu Utama</span>
              </button>
            )}

            {onOpenScoreboard && (
              <button
                type="button"
                className="mlbb-btn-action mlbb-btn-cyan"
                onClick={onOpenScoreboard}
              >
                <Award size={16} />
                <span>Skor Sesi</span>
              </button>
            )}
          </div>

          {!isMultiplayer || isHost ? (
            <button
              type="button"
              className="mlbb-btn-action mlbb-btn-gold"
              onClick={handleRestartClick}
            >
              <RotateCcw size={16} />
              <span>Main Lagi (Ronde Baru)</span>
            </button>
          ) : (
            <span style={{ color: '#fde68a', fontSize: '0.82rem', fontWeight: 700 }}>
              ⏳ Menunggu Host memulai ronde baru...
            </span>
          )}
        </div>

        {/* Friend Action Toast */}
        {friendToast && (
          <div className="victory-friend-toast">
            <Sparkles size={13} color="#fde047" />
            <span>{friendToast}</span>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Pertemanan */}
        {friendToDelete && (
          <FriendUnfriendModal
            friendToDelete={friendToDelete}
            onClose={() => setFriendToDelete(null)}
            onConfirm={async () => {
              await removeFriend(effectiveMyName, friendToDelete.name);
              setFriendToDelete(null);
              showToast(`Pertemanan dengan ${friendToDelete.name} telah dihapus.`);
            }}
          />
        )}
      </div>
    </div>
  );
}
