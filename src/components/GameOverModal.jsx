import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Home, Award, X, Sparkles } from 'lucide-react';
import { SUIT_SYMBOLS } from '../engine/constants.js';
import Card from './CardView.jsx';
import AvatarDisplay from './AvatarDisplay.jsx';
import { resolvePlayerAvatar, getLocalPlayerProfile } from '../services/leaderboardService.js';
import { removeFriend } from '../services/friendService.js';
import FriendActionButton, { FriendUnfriendModal } from './FriendActionButton.jsx';
import '../styles/animations.css';
import '../styles/friendsModal.css';

export default function GameOverModal({
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

  // Compute rankings dynamically if not present directly on state
  const rankings = useMemo(() => {
    if (!activeState) return [];
    if (Array.isArray(activeState.rankings) && activeState.rankings.length > 0) {
      return activeState.rankings.map((r, idx) => {
        const pObj = (activeState.players || []).find((p) => p.id === r.id || p.id === r.player?.id) || r.player || r;
        return {
          ...r,
          id: r.id || pObj?.id,
          name: r.name || pObj?.name || `Pemain ${idx + 1}`,
          avatar: r.avatar || pObj?.avatar || '🧙‍♂️',
          isBot: Boolean(pObj?.isBot),
          isBotTakeover: Boolean(pObj?.isBotTakeover),
          rank: r.rank !== undefined ? Number(r.rank) : idx + 1,
          isWinner: idx === 0 || r.rank === 1 || r.isWinner,
          closedCards: r.closedCards || r.closedCardDetails || [],
        };
      });
    }

    const players = activeState.players || [];
    const scores = activeState.scores || {};
    const winners = activeState.winners || [];
    const totalPlayers = players.length || 4;

    const sorted = [...players].sort((a, b) => {
      const sA = scores[a.id]?.totalScore ?? scores[a.id] ?? -999;
      const sB = scores[b.id]?.totalScore ?? scores[b.id] ?? -999;
      return sB - sA;
    });

    return sorted.map((p, idx) => {
      const isWinner = winners.includes(p.id) || idx === 0;
      const rank = isWinner ? 1 : idx + 1;
      const pointsEarned = Math.max(0, totalPlayers - rank);
      const scoreObj = scores[p.id] || {};
      const finalScore = typeof scoreObj === 'object' ? (scoreObj.totalScore ?? 0) : Number(scoreObj || 0);
      const closedCards = scoreObj.closedCards || [];

      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isBot: Boolean(p.isBot),
        isBotTakeover: Boolean(p.isBotTakeover),
        rank,
        isWinner,
        pointsEarned,
        finalScore,
        closedCardsPoints: scoreObj.closedCardsTotal ?? 0,
        faultBonusTotal: scoreObj.faultBonusTotal ?? 0,
        faultCount: scoreObj.faultCount ?? 0,
        closedCards,
        closedCardDetails: closedCards,
      };
    });
  }, [activeState]);

  if (!activeState) return null;

  const winner = rankings[0] || (activeState.players || [])[0];
  const aceDirectionUsed = activeState.aceDirectionUsed || activeState.aceDirection || 'bottom';

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
            SEVENS ROYAL • BATTLE RESULT
          </span>
          <div className="mlbb-victory-banner-title">VICTORY</div>
          <div className="mlbb-victory-subtitle">
            Klasemen Akhir & Rekapitulasi Poin Tujuh Sekop
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
                    avatar={resolvePlayerAvatar(winner, '🧙‍♂️')}
                    fallback="🧙‍♂️"
                    size={44}
                    playerName={winner.name}
                  />
                  <span className="mlbb-mvp-ribbon">MVP • JUARA 1</span>
                </div>
                <div className="mlbb-mvp-info">
                  <span className="mlbb-mvp-tag">ROYAL KING • TUJUH SEKOP</span>
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
                    Poin Kartu: {winner.closedCardsPoints ?? 0} • Bonus 6&8: +{winner.faultBonusTotal ?? 0}
                  </span>
                </div>
              </div>

              <div className="mlbb-mvp-stats">
                <div className="mlbb-mvp-score-pill">
                  SKOR: {winner.finalScore > 0 ? `+${winner.finalScore}` : (winner.finalScore ?? 0)} PTS
                </div>
              </div>
            </div>
          )}

          {/* PLAYER RANKING BATTLE ROWS (SAMAKAN DENGAN BIG TWO) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {rankings.map((player, index) => {
              const rankPos = player.rank || index + 1;
              const isFirst = rankPos === 1;
              const isSecond = rankPos === 2;
              const isThird = rankPos === 3;
              const rankBadge = isFirst
                ? '🥇 JUARA 1'
                : isSecond
                ? '🥈 JUARA 2'
                : isThird
                ? '🥉 JUARA 3'
                : `PERINGKAT ${rankPos}`;

              const totalP = activeState.players?.length || rankings.length || 4;
              const pointsEarned =
                player.pointsEarned !== undefined
                  ? player.pointsEarned
                  : Math.max(0, totalP - rankPos);

              const closedList = Array.isArray(player.closedCards)
                ? player.closedCards
                : Array.isArray(player.closedCardDetails)
                ? player.closedCardDetails
                : [];

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
                          avatar={resolvePlayerAvatar(player, '👤')}
                          fallback="👤"
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
                            color: isFirst
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
                            (player.finalScore ?? 0) >= 0
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(239, 68, 68, 0.16)',
                          color: (player.finalScore ?? 0) >= 0 ? '#34d399' : '#fca5a5',
                          border:
                            (player.finalScore ?? 0) >= 0
                              ? '1px solid rgba(52, 211, 153, 0.4)'
                              : '1px solid rgba(248, 113, 113, 0.35)',
                        }}
                      >
                        Skor: {(player.finalScore ?? 0) > 0 ? `+${player.finalScore}` : (player.finalScore ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Show closed cards details */}
                  {closedList.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.35rem',
                        marginTop: '0.6rem',
                        flexWrap: 'wrap',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginRight: '0.2rem' }}>
                        Kartu Tertutup:
                      </span>
                      {closedList.map((c, idx) => (
                        <Card key={c.id || idx} card={c} mini />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Global Ace Direction Indicator */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.78)',
              padding: '0.55rem 0.9rem',
              borderRadius: '10px',
              border: '1px solid rgba(251, 191, 36, 0.28)',
              fontSize: '0.76rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.4rem',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              Aturan Kartu As (Tertutup):
            </span>
            <strong style={{ color: '#fbbf24' }}>
              {aceDirectionUsed === 'top'
                ? '⬆️ Rangkai Atas (As = -11 Poin)'
                : '⬇️ Rangkai Bawah (As = -1 Poin)'}
            </strong>
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
