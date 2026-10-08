import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  initGame,
  resetGame,
  playCard as enginePlayCard,
  closeCard as engineCloseCard,
  sortHand,
} from './engine/gameEngine.js';
import { GAME_STATUS } from './engine/constants.js';
import { DEFAULT_CONFIG } from './engine/config.js';
import { audio } from './services/audioService.js';
import {
  multiplayerAdapter,
  getRelativeSeats,
  getActiveSession,
  clearLocalSession,
  getLocalPlayerId,
  getLocalPlayerName,
} from './services/multiplayerAdapter.js';
import { isSupabaseConfigured } from './services/supabaseClient.js';

import Board from './components/Board.jsx';
import PlayerSeat from './components/PlayerSeat.jsx';
import PlayerHand from './components/PlayerHand.jsx';
import FaultAlert from './components/FaultAlert.jsx';
import GameOverModal from './components/GameOverModal.jsx';
import ConfigModal from './components/ConfigModal.jsx';
import RulesGuideModal from './components/RulesGuideModal.jsx';
import MatchHistoryDrawer from './components/MatchHistoryDrawer.jsx';
import AceClosureChoiceModal from './components/AceClosureChoiceModal.jsx';
import MultiplayerLobby from './components/MultiplayerLobby.jsx';
import MobileNavDrawer from './components/MobileNavDrawer.jsx';
import ShuffleDealingAnimation from './components/ShuffleDealingAnimation.jsx';
import ModeSelectionScreen from './components/ModeSelectionScreen.jsx';

import './styles/multiplayer.css';

import {
  Volume2,
  VolumeX,
  BookOpen,
  Settings,
  History,
  RotateCcw,
  Globe,
  Gamepad2,
  Copy,
  Check,
  LogOut,
  Users,
  Share2,
  Menu,
  X,
  Layers,
  Eye,
  EyeOff,
  Columns3,
  Rows3,
} from 'lucide-react';

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDealingAnimationActive, setIsDealingAnimationActive] = useState(false);

  // Table View & Mobile Focus Settings (Persistent)
  const [showOpponents, setShowOpponents] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('sevens_show_opponents');
      if (saved !== null) return saved === 'true';
    }
    // Default to false on mobile (clean table focus), true on desktop
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return false;
    }
    return true;
  });

  const [boardLayout, setBoardLayout] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('sevens_board_layout');
      if (saved === 'vertical' || saved === 'horizontal') return saved;
    }
    return 'horizontal';
  });

  // Extract invite room code from URL query (?room=XYZ)
  const [inviteRoomCode, setInviteRoomCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('room');
      return r ? r.trim().toUpperCase() : null;
    }
    return null;
  });

  // Mode: null (Landing Screen 2 Kartu) | 'local' (Offline) | 'multiplayer' (Online)
  const [gameMode, setGameMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room')) return 'multiplayer';
    }
    const session = getActiveSession();
    return session.roomCode ? 'multiplayer' : null;
  });

  // Multiplayer Room & Identity State (Synchronously restored from cache on refresh)
  const [currentRoom, setCurrentRoom] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const session = getActiveSession();
      if (session.roomCode) {
        try {
          const cached = localStorage.getItem('sevens_cached_room');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.code === session.roomCode) {
              return parsed;
            }
          }
        } catch (e) {}
      }
    }
    return null;
  });

  const [myPlayerId, setMyPlayerId] = useState(() => getLocalPlayerId());
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const session = getActiveSession();
      return Boolean(session.roomCode && !localStorage.getItem('sevens_cached_room'));
    }
    return false;
  });

  // Game Engine State (Single source of truth, restored from cached room on refresh if available)
  const [gameConfig, setGameConfig] = useState(DEFAULT_CONFIG);
  const [gameState, setGameState] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const session = getActiveSession();
      if (session.roomCode) {
        try {
          const cached = localStorage.getItem('sevens_cached_room');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.code === session.roomCode && parsed.game_state) {
              return parsed.game_state;
            }
          }
        } catch (e) {}
      }
    }
    return initGame(DEFAULT_CONFIG);
  });

  // Keep localStorage cached room synchronized
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      if (currentRoom) {
        localStorage.setItem('sevens_cached_room', JSON.stringify(currentRoom));
      } else {
        localStorage.removeItem('sevens_cached_room');
      }
    }
  }, [currentRoom]);

  // Synchronize game_state inside cached room when it changes
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && currentRoom?.code && gameState) {
      try {
        const cached = localStorage.getItem('sevens_cached_room');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.code === currentRoom.code) {
            parsed.game_state = gameState;
            localStorage.setItem('sevens_cached_room', JSON.stringify(parsed));
          }
        }
      } catch (e) {}
    }
  }, [gameState, currentRoom?.code]);

  // Local UI State
  const [handSortBy, setHandSortBy] = useState('suit');
  const [selectedCard, setSelectedCard] = useState(null);
  const [activeFault, setActiveFault] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [pendingAceChoiceCard, setPendingAceChoiceCard] = useState(null);

  const prevTurnNumberRef = useRef(gameState.turnNumber);

  // ---------------------------------------------------------------------------
  // 1. RECONNECT HANDLING (Check server state on mount & silently update cache)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const session = getActiveSession();
    if (session.roomCode && isSupabaseConfigured) {
      multiplayerAdapter.getRoom(session.roomCode).then(({ room, error }) => {
        setIsReconnecting(false);
        if (room && !error) {
          setCurrentRoom(room);
          setGameMode('multiplayer');
          if (session.playerId) {
            setMyPlayerId(session.playerId);
          }
          if (room.game_state) {
            setGameState(room.game_state);
          }
          // Only show toast if user reconnected cleanly
          showToast(`Terhubung ke Room ${room.code}`);
        } else {
          clearLocalSession();
          setCurrentRoom(null);
        }
      }).catch(() => {
        setIsReconnecting(false);
      });
    } else {
      setIsReconnecting(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 2. SUPABASE REALTIME SUBSCRIPTION
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gameMode !== 'multiplayer' || !currentRoom?.code) return;

    const unsubscribe = multiplayerAdapter.subscribeToRoom(currentRoom.code, (updatedRoom) => {
      setCurrentRoom(updatedRoom);

      if (updatedRoom.game_state) {
        const nextState = updatedRoom.game_state;

        // If turn is 1 and game newly started or restarted, trigger dealing animation
        if (nextState.turnNumber === 1 && !nextState.firstMoveMade && prevTurnNumberRef.current !== 1) {
          setIsDealingAnimationActive(true);
        }

        // Play audio feedback if a move was made by other players
        if (nextState.turnNumber !== prevTurnNumberRef.current && nextState.lastAction) {
          const action = nextState.lastAction;
          if (action.type === 'PLAY') {
            if (action.card?.rank === 7) audio.sevenChime();
            else audio.playCardSound();
          } else if (action.type === 'CLOSE') {
            audio.closeCardSound();
          } else if (action.type === 'FAULT') {
            audio.faultSound();
          }
        }
        prevTurnNumberRef.current = nextState.turnNumber;
        setGameState(nextState);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [gameMode, currentRoom?.code]);

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Clear card selection when turn changes
  useEffect(() => {
    setSelectedCard(null);
    setPendingAceChoiceCard(null);
  }, [gameState.currentPlayer]);

  // Play sound on game over
  useEffect(() => {
    if (gameState.gameStatus === GAME_STATUS.GAME_OVER) {
      audio.victorySound();
    }
  }, [gameState.gameStatus]);

  // Sound Mute Toggle
  const handleToggleSound = () => {
    const muted = audio.toggleMute();
    setIsMuted(muted);
  };

  // Copy Room Code from Topbar
  const handleCopyTopBarCode = async () => {
    if (!currentRoom?.code) return;
    try {
      await navigator.clipboard.writeText(currentRoom.code);
      setCopiedRoomCode(true);
      showToast(`Kode room ${currentRoom.code} disalin ke clipboard!`);
      setTimeout(() => setCopiedRoomCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  // Share Invite Link from Topbar
  const handleShareTopBarLink = async () => {
    if (!currentRoom?.code) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoom.code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Room Sevens: ${currentRoom.code}`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Link undangan Room ${currentRoom.code} disalin ke clipboard!`);
    } catch {
      // Ignore
    }
  };

  // ---------------------------------------------------------------------------
  // MULTIPLAYER HANDLERS
  // ---------------------------------------------------------------------------
  const handleCreateRoom = async (username, maxPlayers = 4) => {
    const res = await multiplayerAdapter.createRoom(username, maxPlayers);
    if (res.success) {
      setCurrentRoom(res.room);
      setMyPlayerId(res.player.id);
      if (res.room.game_state) {
        setGameState(res.room.game_state);
      }
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setInviteRoomCode(null);
      showToast(`Room ${res.room.code} (${res.room.game_state?.config?.playerCount || maxPlayers} Pemain) berhasil dibuat!`);
    }
    return res;
  };

  const handleJoinRoom = async (code, username) => {
    const res = await multiplayerAdapter.joinRoom(code, username);
    if (res.success) {
      setCurrentRoom(res.room);
      setMyPlayerId(res.player.id);
      if (res.room.game_state) {
        setGameState(res.room.game_state);
      }
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setInviteRoomCode(null);
      showToast(res.isReconnected ? `Bergabung kembali ke Room ${res.room.code}` : `Berhasil bergabung ke Room ${res.room.code}`);
    }
    return res;
  };

  const handleToggleReady = async (isReady) => {
    if (!currentRoom?.code) return;
    await multiplayerAdapter.toggleReady(currentRoom.code, myPlayerId, isReady);
  };

  const handleStartGame = async () => {
    if (!currentRoom?.code) return;
    const res = await multiplayerAdapter.startGame(currentRoom.code, myPlayerId, gameConfig);
    if (res.success) {
      setCurrentRoom(res.room);
      setGameState(res.gameState);
      setIsDealingAnimationActive(true);
      showToast('Permainan dimulai!');
    } else {
      setActiveFault({ message: res.error || 'Gagal memulai permainan.' });
    }
  };

  const handleLeaveRoom = async () => {
    if (currentRoom?.code) {
      await multiplayerAdapter.leaveRoom(currentRoom.code, myPlayerId);
    }
    setCurrentRoom(null);
    clearLocalSession();
    showToast('Telah keluar dari room.');
  };

  // Restart / Reset Game
  const handleRestart = async (configOverrides) => {
    const nextCfg = configOverrides || gameConfig;

    if (gameMode === 'multiplayer' && currentRoom?.code) {
      const isHost = currentRoom.host_id === myPlayerId;
      if (!isHost) {
        showToast('Hanya Host yang dapat mengocok ulang dan memulai game baru.');
        return;
      }
      const res = await multiplayerAdapter.restartGame(currentRoom.code, myPlayerId, nextCfg);
      if (res.success) {
        setGameState(res.gameState);
        setSelectedCard(null);
        setActiveFault(null);
        setPendingAceChoiceCard(null);
        setIsDealingAnimationActive(true);
        showToast('Permainan baru dimulai!');
      }
    } else {
      // Local Mode: preserve selected player count
      const count = gameState.players?.length || nextCfg.playerCount || 4;
      const nextState = resetGame({ ...nextCfg, playerCount: count });
      setGameState(nextState);
      setSelectedCard(null);
      setActiveFault(null);
      setPendingAceChoiceCard(null);
      setIsDealingAnimationActive(true);
    }
  };

  // Save new configuration (Restricted to Host in Multiplayer)
  const handleSaveConfig = (newConfig) => {
    if (isMultiplayerMode && !isHost) {
      showToast('Hanya Host pembuat room yang dapat mengubah pengaturan.');
      return;
    }
    setGameConfig(newConfig);
    handleRestart(newConfig);
  };

  // ---------------------------------------------------------------------------
  // ACTIVE PLAYER & PERSPECTIVE SEATING
  // ---------------------------------------------------------------------------
  const isMultiplayerMode = gameMode === 'multiplayer';
  const isHost = isMultiplayerMode && currentRoom?.host_id === myPlayerId;

  // Determine which player's cards to show in the bottom tray
  // In multiplayer: Always the user's cards (myPlayerId)
  // In local mode: The player whose turn it currently is (pass-and-play)
  const playersList = gameState?.players || [];

  const trayPlayer = isMultiplayerMode
    ? playersList.find((p) => p.id === myPlayerId) || playersList[0] || {}
    : playersList.find((p) => p.id === gameState?.currentPlayer) || playersList[0] || {};

  const currentHandRaw = gameState?.hands?.[trayPlayer.id] || [];
  const currentHand = useMemo(() => {
    return sortHand(currentHandRaw, handSortBy);
  }, [currentHandRaw, handSortBy]);

  const isMyTurn = isMultiplayerMode
    ? gameState?.currentPlayer === myPlayerId
    : true; // In local mode, active player has turn

  // Seating around the poker table
  // In multiplayer: relative rotation so user is ALWAYS at the bottom!
  // In local mode: relative rotation to whoever's turn it is (pass-and-play perspective)
  const seats = isMultiplayerMode
    ? getRelativeSeats(playersList, myPlayerId)
    : getRelativeSeats(playersList, trayPlayer?.id);

  const opponentPlayers = playersList.filter((p) => p.id !== trayPlayer?.id);

  const handleToggleShowOpponents = () => {
    setShowOpponents((prev) => {
      const next = !prev;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sevens_show_opponents', String(next));
      }
      return next;
    });
  };

  const handleToggleBoardLayout = (newLayout) => {
    setBoardLayout(newLayout);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sevens_board_layout', newLayout);
    }
  };

  // ---------------------------------------------------------------------------
  // GAMEPLAY ACTIONS (PLAY CARD & CLOSE CARD)
  // ---------------------------------------------------------------------------
  const handlePlayCard = async (card, chosenDirection = null) => {
    if (!card) return;

    if (isMultiplayerMode && !isMyTurn) {
      setActiveFault({ message: 'Bukan giliran Anda! Tunggu giliran Anda bermain.' });
      return;
    }

    const actingPlayerId = isMultiplayerMode ? myPlayerId : gameState.currentPlayer;

    // Check Ace closure choice condition (both 2 and K open, direction not locked)
    if (card.rank === 1 && !chosenDirection) {
      const suitBoard = gameState.board[card.suit];
      const canCapTop =
        suitBoard.maxRank === 13 &&
        (!gameState.globalAceDirection || gameState.globalAceDirection === 'top');
      const canCapBottom =
        suitBoard.minRank === 2 &&
        (!gameState.globalAceDirection || gameState.globalAceDirection === 'bottom');

      if (canCapTop && canCapBottom && !gameState.globalAceDirection) {
        setPendingAceChoiceCard(card);
        return;
      }
    }

    const result = enginePlayCard(gameState, actingPlayerId, card, chosenDirection);
    if (result.success) {
      setGameState(result.state);
      setSelectedCard(null);
      setPendingAceChoiceCard(null);
      if (card.rank === 7) {
        audio.sevenChime();
      } else {
        audio.playCardSound();
      }

      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, result.state);
      }
    } else {
      // Rejection: generic feedback with no hints on valid cards
      setActiveFault({
        message: result.error || 'Kartu tidak dapat dimainkan.',
      });
      audio.faultSound();
    }
  };

  const handleCloseCard = async (card) => {
    if (!card) return;

    if (isMultiplayerMode && !isMyTurn) {
      setActiveFault({ message: 'Bukan giliran Anda! Tunggu giliran Anda bermain.' });
      return;
    }

    const actingPlayerId = isMultiplayerMode ? myPlayerId : gameState.currentPlayer;

    const result = engineCloseCard(gameState, actingPlayerId, card);
    if (result.success) {
      setGameState(result.state);
      setSelectedCard(null);
      audio.closeCardSound();

      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, result.state);
      }
    } else if (result.fault) {
      // Game engine detected FAULT (player had valid moves)
      setActiveFault(result.fault);
      audio.faultSound();
      setGameState(result.state);

      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, result.state);
      }
    } else {
      setActiveFault({
        message: result.error || 'Tidak dapat menutup kartu.',
      });
      audio.faultSound();
    }
  };

  // Find active turn player's name
  const currentTurnPlayer = playersList.find((p) => p.id === gameState?.currentPlayer);
  const currentTurnPlayerName = currentTurnPlayer?.name || 'Pemain Lain';

  // Return to Mode Selection Screen (Home)
  const handleBackToModeSelect = () => {
    if (isMultiplayerMode && currentRoom) {
      if (confirm('Keluar dari room online dan kembali ke menu pemilihan mode?')) {
        handleLeaveRoom();
        setGameMode(null);
      }
    } else {
      setGameMode(null);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER: LANDING SCREEN (When gameMode is null / 2 Cards Mode Selection)
  // ---------------------------------------------------------------------------
  if (!gameMode) {
    return (
      <div className="app-container">
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: '70px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              zIndex: 9999,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✨</span>
            <span>{toastMessage}</span>
          </div>
        )}

        <ModeSelectionScreen
          onSelectMode={(mode, playerCount) => {
            if (mode === 'local') {
              const count = playerCount || 4;
              const nextCfg = { ...gameConfig, playerCount: count };
              setGameConfig(nextCfg);
              setGameState(initGame(nextCfg));
              setGameMode('local');
            } else {
              setGameMode(mode);
            }
          }}
          onOpenRules={() => setShowRulesModal(true)}
        />

        {/* Rules Guide Modal */}
        {showRulesModal && <RulesGuideModal onClose={() => setShowRulesModal(false)} />}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: MULTIPLAYER LOBBY (When in multiplayer and no room or in lobby)
  // ---------------------------------------------------------------------------
  const showMultiplayerLobby =
    isMultiplayerMode && (!currentRoom || currentRoom.status === 'lobby');

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Navigation */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="brand-title">
            <span>♠</span>
            <span>SEVENS</span>
          </div>

          <span className="brand-tag desktop-only">Tujuh Sekop • {gameState.players?.length || 4} Pemain</span>

          {/* Mode Indicator / Badge */}
          {isMultiplayerMode ? (
            currentRoom?.code ? (
              <div className="room-badge-group">
                <button
                  className="brand-room-pill"
                  onClick={handleCopyTopBarCode}
                  title="Klik untuk menyalin kode room"
                >
                  <Users size={12} />
                  <span>ROOM: <strong>{currentRoom.code}</strong></span>
                  {copiedRoomCode ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>

                <button
                  className="brand-room-pill desktop-only"
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    borderColor: '#059669',
                    color: '#34d399',
                  }}
                  onClick={handleShareTopBarLink}
                  title="Bagikan tautan / share link room ke teman"
                >
                  <Share2 size={12} />
                  <span>Bagikan Link</span>
                </button>
              </div>
            ) : (
              <span className="brand-tag brand-tag-online">
                🌐 Online
              </span>
            )
          ) : (
            <span
              className="brand-tag desktop-only"
              style={{ background: 'rgba(100, 116, 139, 0.2)', borderColor: '#475569', color: '#94a3b8' }}
            >
              🎮 Mode Lokal
            </span>
          )}

          {/* Global Ace Direction Badge & Turn (Desktop Only) */}
          <div className="desktop-only" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {gameState.globalAceDirection === 'bottom' && (
              <span
                className="brand-tag"
                style={{ background: 'rgba(16, 185, 129, 0.18)', borderColor: '#10b981', color: '#34d399' }}
                title="Arah penutupan rangkaian As terkunci di BAWAH. Kartu As yang ditutup bernilai -1."
              >
                ⬇️ Rangkai As: BAWAH (A=-1)
              </span>
            )}
            {gameState.globalAceDirection === 'top' && (
              <span
                className="brand-tag"
                style={{ background: 'rgba(245, 158, 11, 0.18)', borderColor: '#f59e0b', color: '#fbbf24' }}
                title="Arah penutupan rangkaian As terkunci di ATAS. Kartu As yang ditutup bernilai -11."
              >
                ⬆️ Rangkai As: ATAS (A=-11)
              </span>
            )}
            {!gameState.globalAceDirection && (
              <span
                className="brand-tag"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
                title="Arah penutupan rangkaian As belum terkunci. Ditentukan saat kartu As pertama dirangkai di meja."
              >
                Rangkai As: Terbuka
              </span>
            )}

            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginLeft: '0.25rem',
              }}
            >
              Turn #{gameState.turnNumber}
            </span>
          </div>
        </div>

        {/* DESKTOP NAV ACTIONS (> 768px) */}
        <div className="nav-actions nav-actions-desktop">
          {/* Back to Mode Selection (Home) */}
          <button
            className="btn-header"
            onClick={handleBackToModeSelect}
            title="Kembali ke Pilihan Mode Permainan (Online / Offline)"
          >
            <Layers size={15} />
            <span>Pilihan Mode</span>
          </button>

          {/* Mode Switcher Button */}
          {isMultiplayerMode ? (
            <button
              className="btn-header"
              onClick={() => {
                if (currentRoom) {
                  if (confirm('Beralih ke mode lokal akan keluar dari room online ini. Lanjutkan?')) {
                    handleLeaveRoom();
                    setGameMode('local');
                  }
                } else {
                  setGameMode('local');
                }
              }}
              title="Beralih ke Mode Simulasi Lokal (Pass-and-Play)"
            >
              <Gamepad2 size={15} />
              <span>Mode Lokal</span>
            </button>
          ) : (
            <button
              className="btn-header"
              onClick={() => setGameMode('multiplayer')}
              title="Beralih ke Online Multiplayer bersama teman"
              style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
            >
              <Globe size={15} />
              <span>Main Online</span>
            </button>
          )}

          {isMultiplayerMode && currentRoom && (
            <button
              className="btn-header btn-danger-hover"
              onClick={handleLeaveRoom}
              title="Keluar dari room"
            >
              <LogOut size={15} />
              <span>Keluar Room</span>
            </button>
          )}

          <button
            className="btn-header"
            onClick={() => setShowRulesModal(true)}
            title="Buku Aturan Permainan"
          >
            <BookOpen size={15} />
            <span>Aturan</span>
          </button>

          {(!isMultiplayerMode || isHost) && (
            <button
              className="btn-header"
              onClick={() => setShowConfigModal(true)}
              title="Pengaturan Penalti 6 & 8 dan Aturan (Khusus Host)"
            >
              <Settings size={15} />
              <span>Pengaturan {isMultiplayerMode && '(Host)'}</span>
            </button>
          )}

          <button
            className="btn-header"
            onClick={() => setShowHistoryModal(true)}
            title="Riwayat Aksi Pertandingan"
          >
            <History size={15} />
            <span>Riwayat</span>
          </button>

          <button
            className={`btn-icon ${isMuted ? 'active' : ''}`}
            onClick={handleToggleSound}
            title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {(!isMultiplayerMode || isHost) && (
            <button
              className="btn-header btn-gold"
              onClick={() => handleRestart()}
              title="Kocok ulang dan mulai game baru"
            >
              <RotateCcw size={15} />
              <span>Kocok Ulang</span>
            </button>
          )}
        </div>

        {/* MOBILE NAV ACTIONS (<= 768px) */}
        <div className="nav-actions nav-actions-mobile">
          {isMultiplayerMode && currentRoom?.code && (
            <button
              className="btn-icon btn-icon-share"
              onClick={handleShareTopBarLink}
              title="Bagikan Tautan Undangan Room"
            >
              <Share2 size={16} />
            </button>
          )}

          <button
            className={`btn-icon ${isMuted ? 'active' : ''}`}
            onClick={handleToggleSound}
            title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            className="btn-hamburger"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menu Utama"
            title="Buka Menu"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Main Game Table Container */}
      <main className="game-layout">
        {/* Felt Poker Table */}
        <div className="poker-table-wrapper">
          <div className="poker-felt">
            <div className="felt-watermark">SEVENS</div>

            {/* Dealing & Shuffling Casino Animation Overlay */}
            <ShuffleDealingAnimation
              isActive={isDealingAnimationActive}
              onComplete={() => setIsDealingAnimationActive(false)}
              playerHand={currentHand}
              seats={seats}
            />

            {/* Table View Toolbar: Focus Toggle & Layout Switcher */}
            <div className="table-view-toolbar">
              <button
                type="button"
                className={`btn-table-control ${!showOpponents ? 'btn-active-focus' : ''}`}
                onClick={handleToggleShowOpponents}
                title={
                  showOpponents
                    ? 'Sembunyikan kursi pemain lain agar meja lebih luas dan fokus pada kartu'
                    : 'Tampilkan kembali kursi pemain lain'
                }
              >
                {showOpponents ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showOpponents ? 'Fokus Meja (Sembunyikan Kursi)' : 'Tampilkan Kursi'}</span>
              </button>

              <div className="board-layout-switcher">
                <button
                  type="button"
                  className={`btn-layout-chip ${boardLayout === 'horizontal' ? 'active' : ''}`}
                  onClick={() => handleToggleBoardLayout('horizontal')}
                  title="Susunan kartu horizontal (4 baris suit)"
                >
                  <Rows3 size={12} />
                  <span>Horizontal</span>
                </button>
                <button
                  type="button"
                  className={`btn-layout-chip ${boardLayout === 'vertical' ? 'active' : ''}`}
                  onClick={() => handleToggleBoardLayout('vertical')}
                  title="Susunan kartu vertikal (4 kolom suit, scroll horizontal)"
                >
                  <Columns3 size={12} />
                  <span>Vertikal</span>
                </button>
              </div>
            </div>

            {/* Mini Opponents Strip (Visible when opponent seats are hidden) */}
            {!showOpponents && opponentPlayers.length > 0 && (
              <div className="mini-opponents-strip">
                {opponentPlayers.map((p) => {
                  const isTurn = gameState.currentPlayer === p.id;
                  const cardCount = gameState.hands[p.id]?.length || 0;
                  const closedCount = gameState.closedCards[p.id]?.length || 0;
                  const faultCount = gameState.faults[p.id]?.length || 0;

                  return (
                    <div
                      key={p.id}
                      className={`mini-player-chip ${isTurn ? 'chip-active-turn' : ''}`}
                      title={`${p.name} • ${cardCount} kartu • ${closedCount} tutup • ${faultCount} fault`}
                    >
                      <span className="chip-avatar">{p.avatar}</span>
                      <span className="chip-name">{p.name}</span>
                      <span className="chip-stat" title="Jumlah sisa kartu">
                        {cardCount} 🂠
                      </span>
                      {closedCount > 0 && (
                        <span className="chip-stat chip-closed" title="Kartu ditutup">
                          {closedCount} 🔒
                        </span>
                      )}
                      {faultCount > 0 && (
                        <span className="chip-stat chip-fault" title="Fault">
                          {faultCount} ⚠️
                        </span>
                      )}
                      {isTurn && <span className="chip-turn-dot" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Table Seats & Board Layout (Supports 4, 5, or 6 players) */}
            <div className={`table-seats-container ${!showOpponents ? 'focus-mode' : ''}`}>
              {showOpponents && (
                <>
                  {/* TOP: Opposite player(s) - 1, 2, or 3 players */}
                  {seats.topPlayers && seats.topPlayers.length > 0 ? (
                    <div className="seat-top-wrapper">
                      {seats.topPlayers.map((p) => (
                        <PlayerSeat
                          key={p.id}
                          player={p}
                          isTurn={gameState.currentPlayer === p.id}
                          cardCount={gameState.hands[p.id]?.length || 0}
                          closedCount={gameState.closedCards[p.id]?.length || 0}
                          faultCount={gameState.faults[p.id]?.length || 0}
                        />
                      ))}
                    </div>
                  ) : seats.top ? (
                    <div className="seat-top-wrapper">
                      <PlayerSeat
                        player={seats.top}
                        isTurn={gameState.currentPlayer === seats.top.id}
                        cardCount={gameState.hands[seats.top.id]?.length || 0}
                        closedCount={gameState.closedCards[seats.top.id]?.length || 0}
                        faultCount={gameState.faults[seats.top.id]?.length || 0}
                      />
                    </div>
                  ) : null}

                  {/* LEFT: Next clockwise player */}
                  {seats.left && (
                    <div className="seat-left-wrapper">
                      <PlayerSeat
                        player={seats.left}
                        isTurn={gameState.currentPlayer === seats.left.id}
                        cardCount={gameState.hands[seats.left.id]?.length || 0}
                        closedCount={gameState.closedCards[seats.left.id]?.length || 0}
                        faultCount={gameState.faults[seats.left.id]?.length || 0}
                      />
                    </div>
                  )}
                </>
              )}

              {/* CENTER: 4-Suit Board Tableau */}
              <div className="table-center-board">
                <Board
                  board={gameState.board}
                  globalAceDirection={gameState.globalAceDirection}
                  layout={boardLayout}
                />
              </div>

              {/* RIGHT: Previous player */}
              {showOpponents && seats.right && (
                <div className="seat-right-wrapper">
                  <PlayerSeat
                    player={seats.right}
                    isTurn={gameState.currentPlayer === seats.right.id}
                    cardCount={gameState.hands[seats.right.id]?.length || 0}
                    closedCount={gameState.closedCards[seats.right.id]?.length || 0}
                    faultCount={gameState.faults[seats.right.id]?.length || 0}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM: Player Hand Tray & Controls */}
        <PlayerHand
          player={trayPlayer}
          hand={currentHand}
          selectedCard={selectedCard}
          onSelectCard={(c) => setSelectedCard(c)}
          onPlayCard={handlePlayCard}
          onCloseCard={handleCloseCard}
          sortBy={handSortBy}
          onToggleSort={() => setHandSortBy((prev) => (prev === 'suit' ? 'rank' : 'suit'))}
          isCurrentTurn={isMyTurn}
          closedCards={gameState?.closedCards?.[trayPlayer?.id] || []}
          globalAceDirection={gameState?.globalAceDirection}
          config={gameConfig}
        />
      </main>

      {/* MULTIPLAYER RECONNECTING OVERLAY */}
      {isReconnecting && !currentRoom && (
        <div className="multiplayer-screen-overlay">
          <div className="multiplayer-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', maxWidth: '380px', margin: 'auto' }}>
            <div className="lobby-status-pill" style={{ margin: '0 auto 1rem' }}>
              <span className="pulsing-green-dot" />
              Menghubungkan
            </div>
            <h3 style={{ color: '#fbbf24', marginBottom: '0.5rem', fontSize: '1.15rem' }}>
              Kembali ke Room...
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
              Menyinkronkan status meja dan kartu dari server...
            </p>
          </div>
        </div>
      )}

      {/* MULTIPLAYER LOBBY / ROOM SCREEN OVERLAY */}
      {!isReconnecting && showMultiplayerLobby && (
        <MultiplayerLobby
          room={currentRoom}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onStartGame={handleStartGame}
          onToggleReady={handleToggleReady}
          onLeaveRoom={handleLeaveRoom}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onSwitchToLocal={() => setGameMode('local')}
          onBackToMenu={handleBackToModeSelect}
          isSupabaseConfigured={isSupabaseConfigured}
          inviteRoomCode={inviteRoomCode}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isMultiplayerMode={isMultiplayerMode}
        currentRoom={currentRoom}
        onCopyRoomCode={handleCopyTopBarCode}
        onShareRoomLink={handleShareTopBarLink}
        copiedRoomCode={copiedRoomCode}
        gameState={gameState}
        showOpponents={showOpponents}
        onToggleShowOpponents={handleToggleShowOpponents}
        boardLayout={boardLayout}
        onToggleBoardLayout={handleToggleBoardLayout}
        onOpenRules={() => setShowRulesModal(true)}
        onOpenConfig={() => setShowConfigModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        onRestart={() => handleRestart()}
        isHost={isHost}
        onLeaveRoom={handleLeaveRoom}
        onBackToMenu={handleBackToModeSelect}
        onSwitchMode={() => {
          if (isMultiplayerMode) {
            if (currentRoom) {
              if (confirm('Beralih ke mode lokal akan keluar dari room online ini. Lanjutkan?')) {
                handleLeaveRoom();
                setGameMode('local');
              }
            } else {
              setGameMode('local');
            }
          } else {
            setGameMode('multiplayer');
          }
        }}
      />

      {/* Ace Closure Choice Modal (when both 2 and K are open and direction is unassigned) */}
      {pendingAceChoiceCard && (
        <AceClosureChoiceModal
          card={pendingAceChoiceCard}
          onChoose={(direction) => {
            const cardToPlay = pendingAceChoiceCard;
            setPendingAceChoiceCard(null);
            handlePlayCard(cardToPlay, direction);
          }}
          onCancel={() => setPendingAceChoiceCard(null)}
        />
      )}

      {/* Fault Alert Toast */}
      {activeFault && (
        <FaultAlert fault={activeFault} onDismiss={() => setActiveFault(null)} />
      )}

      {/* Game Over Modal */}
      {gameState.gameStatus === GAME_STATUS.GAME_OVER && (
        <GameOverModal
          gameState={gameState}
          onRestart={() => handleRestart()}
          isMultiplayer={isMultiplayerMode}
          isHost={isHost}
        />
      )}

      {/* Rules Guide Modal */}
      {showRulesModal && <RulesGuideModal onClose={() => setShowRulesModal(false)} />}

      {/* Settings / Config Modal */}
      {showConfigModal && (
        <ConfigModal
          currentConfig={gameConfig}
          onSaveConfig={handleSaveConfig}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {/* Match History Drawer */}
      {showHistoryModal && (
        <MatchHistoryDrawer
          actionLog={gameState.actionLog}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}
