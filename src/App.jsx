import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  initGame,
  resetGame,
  playCard as enginePlayCard,
  closeCard as engineCloseCard,
  sortHand,
  setBotTakeoverSevens,
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

import ErrorBoundary from './components/ErrorBoundary.jsx';
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

import Table41 from './games/game41/components/Table41.jsx';
import GameOver41Modal from './games/game41/components/GameOver41Modal.jsx';
import RulesGuide41Modal from './games/game41/components/RulesGuide41Modal.jsx';
import { initGame41, drawCard41, discardCard41, closeHand41, setBotTakeoverGame41 } from './games/game41/engine/engine41.js';


import TableBigTwo from './games/bigtwo/components/TableBigTwo.jsx';
import GameOverBigTwoModal from './games/bigtwo/components/GameOverBigTwoModal.jsx';
import RulesGuideBigTwoModal from './games/bigtwo/components/RulesGuideBigTwoModal.jsx';
import BigTwoFirstTurnWheel from './games/bigtwo/components/BigTwoFirstTurnWheel.jsx';
import { initBigTwo, playComboBigTwo, passTurnBigTwo, setBotTakeoverBigTwo } from './games/bigtwo/engine/bigtwoEngine.js';

import ActionAnnouncementPopup from './components/ActionAnnouncementPopup.jsx';
import LiveChatOverlay, { getBotChatReply } from './components/LiveChatOverlay.jsx';

import {
  createSinglePlayerRoster,
  isBotPlayer,
  chooseSevensBotMove,
  chooseGame41BotMove,
  chooseBigTwoBotMove,
  SINGLE_HUMAN_ID,
} from './engine/botAI.js';

import ScoreboardModal from './components/ScoreboardModal.jsx';

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
  Trophy,
  Crown,
  MessageSquare,
} from 'lucide-react';

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDealingAnimationActive, setIsDealingAnimationActive] = useState(false);
  const [multiplayerInitOptions, setMultiplayerInitOptions] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlRoom = urlParams?.get('room')?.trim().toUpperCase();
      const session = getActiveSession();

      // If user opened an invite link (?room=...) that doesn't match an active room session,
      // start with null so the user is prompted to enter their name!
      if (urlRoom && (!session.roomCode || session.roomCode !== urlRoom)) {
        return null;
      }

      if (session.roomCode) {
        try {
          const cached = localStorage.getItem('sevens_cached_room');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.code === session.roomCode) {
              const myId = getLocalPlayerId();
              const isParticipant = (parsed.players || []).some((p) => p.id === session.playerId || p.id === myId);
              if (isParticipant) {
                return parsed;
              }
            }
          }
        } catch (e) {}
      }
    }
    return null;
  });


  const [myPlayerId, setMyPlayerId] = useState(() => getLocalPlayerId());
  const isSingleMode = gameMode === 'single';
  const isMultiplayerMode = gameMode === 'multiplayer';
  const isHost = isMultiplayerMode && currentRoom?.host_id === myPlayerId;

  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeChatMessages, setActiveChatMessages] = useState([]);
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

  // Local UI State
  const [handSortBy, setHandSortBy] = useState('suit');
  const [selectedCard, setSelectedCard] = useState(null);
  const [pendingAceChoiceCard, setPendingAceChoiceCard] = useState(null);
  const [activeFault, setActiveFault] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // Active Card Game: 'sevens' | 'game41' | 'bigtwo'
  const [activeGameType, setActiveGameType] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const session = getActiveSession();
      if (session.roomCode) {
        try {
          const cached = localStorage.getItem('sevens_cached_room');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.game_state?.gameType) {
              return parsed.game_state.gameType;
            }
          }
        } catch (e) {}
      }
      return localStorage.getItem('sevens_active_game_type') || 'sevens';
    }
    return 'sevens';
  });

  // Game 41 State (2-6 players)
  const [gameState41, setGameState41] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const session = getActiveSession();
      if (session.roomCode) {
        try {
          const cached = localStorage.getItem('sevens_cached_room');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (
              parsed &&
              parsed.code === session.roomCode &&
              parsed.game_state?.gameType === 'game41' &&
              parsed.game_state?.players &&
              parsed.game_state?.hands
            ) {
              return parsed.game_state;
            }
          }
        } catch (e) {}
      }
    }
    return initGame41({ playerCount: 4 });
  });
  const [showRules41Modal, setShowRules41Modal] = useState(false);

  // Big Two State (2-6 players, synchronously restored from cached room on refresh if available)
  const [gameStateBigtwo, setGameStateBigtwo] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const session = getActiveSession();
      if (session.roomCode) {
        try {
          const cached = localStorage.getItem('sevens_cached_room');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (
              parsed &&
              parsed.code === session.roomCode &&
              parsed.game_state?.gameType === 'bigtwo' &&
              parsed.game_state?.players &&
              parsed.game_state?.hands
            ) {
              return parsed.game_state;
            }
          }
        } catch (e) {}
      }
    }
    return initBigTwo({ playerCount: 4 });
  });
  const [showRulesBigtwoModal, setShowRulesBigtwoModal] = useState(false);
  const [bigTwoWheelPicker, setBigTwoWheelPicker] = useState(null);
  const [pendingBigTwoWheel, setPendingBigTwoWheel] = useState(null);

  // AFK & Turn Timer tracking state
  const [turnElapsed, setTurnElapsed] = useState(0);
  const turnStartTimeRef = useRef(Date.now());
  const prevTurnPlayerIdRef = useRef(null);
  const afkTriggeredTurnRef = useRef(new Set());
  const botTimerRef = useRef(null);

  const gameStateRef = useRef(gameState);
  const gameState41Ref = useRef(gameState41);
  const gameStateBigtwoRef = useRef(gameStateBigtwo);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    gameState41Ref.current = gameState41;
  }, [gameState41]);
  useEffect(() => {
    gameStateBigtwoRef.current = gameStateBigtwo;
  }, [gameStateBigtwo]);


  // Cumulative Scoreboard Data (Games Played & Point Score, persisted in localStorage)
  const [scoreboardData, setScoreboardData] = useState(() => {
    try {
      const saved = localStorage.getItem('poker_scoreboard_data');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showScoreboardModal, setShowScoreboardModal] = useState(false);

  // Real-time Action Announcement Pop-up State
  const [recentActionPopup, setRecentActionPopup] = useState(null);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sevens_active_game_type', activeGameType);
    }
  }, [activeGameType]);

  // Synchronize game_state inside cached room when it changes (only when game is playing)
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && currentRoom?.code && currentRoom?.status === 'playing') {
      try {
        const cached = localStorage.getItem('sevens_cached_room');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.code === currentRoom.code) {
            const activeState =
              activeGameType === 'bigtwo'
                ? gameStateBigtwo
                : activeGameType === 'game41'
                ? gameState41
                : gameState;
            if (activeState && activeState.players) {
              parsed.game_state = activeState;
              localStorage.setItem('sevens_cached_room', JSON.stringify(parsed));
            }
          }
        }
      } catch (e) {}
    }
  }, [gameState, gameStateBigtwo, gameState41, currentRoom?.code, currentRoom?.status, activeGameType]);

  const prevTurnNumberRef = useRef(gameState.turnNumber);

  // ---------------------------------------------------------------------------
  // 1. RECONNECT & INVITE HANDLING (Check server state on mount & silently update cache)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const session = getActiveSession();
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const inviteParam = urlParams?.get('room')?.trim().toUpperCase() || null;
    const currentMyId = session.playerId || getLocalPlayerId();

    // If an invite room link is opened, prioritize checking that room
    const targetRoomCode = (inviteParam && (!session.roomCode || session.roomCode !== inviteParam))
      ? inviteParam
      : (session.roomCode || inviteParam);

    if (targetRoomCode && isSupabaseConfigured) {
      multiplayerAdapter.getRoom(targetRoomCode).then(({ room, error }) => {
        setIsReconnecting(false);
        if (room && !error) {
          const roomGameType = room.game_state?.gameType || room.config?.gameType || 'bigtwo';
          setActiveGameType(roomGameType);

          // Check if viewer is ALREADY a participant in this room
          const isPlayerInRoom = (room.players || []).some(
            (p) => p.id === currentMyId || p.id === session.playerId || p.id === myPlayerId
          );

          if (isPlayerInRoom) {
            // Already registered in room: reconnect seamlessly
            setCurrentRoom(room);
            setGameMode('multiplayer');
            if (session.playerId) {
              setMyPlayerId(session.playerId);
            }
            if (room.game_state) {
              if (room.game_state.gameType === 'bigtwo') {
                if (room.game_state.players) setGameStateBigtwo(room.game_state);
              } else if (room.game_state.gameType === 'game41') {
                if (room.game_state.players) setGameState41(room.game_state);
              } else {
                if (room.game_state.players) setGameState(room.game_state);
              }
            }
            showToast(`Terhubung ke Room ${room.code}`);
          } else {
            // Visiting via invite link: user has not joined yet!
            // Keep currentRoom as null so MultiplayerLobby renders the Join/Name input screen!
            setCurrentRoom(null);
            setInviteRoomCode(room.code);
            setGameMode('multiplayer');
            showToast(`Undangan Room ${room.code} ditemukan. Silakan masukkan nama Anda!`);
          }
        } else if (!error && room === null) {
          // Room was explicitly deleted / not found in DB
          clearLocalSession();
          setCurrentRoom(null);
          setInviteRoomCode(null);
        } else {
          // Temporary network error / offline: retain session and do not kick player!
          console.warn('Gagal memuat room server, mempertahankan sesi lokal:', error);
        }
      }).catch((err) => {
        setIsReconnecting(false);
        console.warn('Reconnect error:', err);
      });
    } else {
      setIsReconnecting(false);
    }
  }, []);

  // Keep URL query parameter synchronized with active room code (?room=CODE)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (isMultiplayerMode && currentRoom?.code) {
        if (url.searchParams.get('room') !== currentRoom.code) {
          url.searchParams.set('room', currentRoom.code);
          window.history.replaceState(null, '', url.toString());
        }
      } else if (!inviteRoomCode) {
        if (url.searchParams.has('room') && !currentRoom?.code) {
          url.searchParams.delete('room');
          window.history.replaceState(null, '', url.pathname);
        }
      }
    } catch {}
  }, [isMultiplayerMode, currentRoom?.code, inviteRoomCode]);

  // Auto-resync when returning to tab or network comes back online
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSyncOnVisible = () => {
      if (document.visibilityState === 'visible' && isMultiplayerMode && currentRoom?.code && isSupabaseConfigured) {
        multiplayerAdapter.getRoom(currentRoom.code).then(({ room, error }) => {
          if (room && !error) {
            setCurrentRoom(room);
            if (room.game_state) {
              if (room.game_state.gameType === 'bigtwo' && room.game_state.players) {
                setGameStateBigtwo(room.game_state);
              } else if (room.game_state.gameType === 'game41' && room.game_state.players) {
                setGameState41(room.game_state);
              } else if (room.game_state.players) {
                setGameState(room.game_state);
              }
            }
          }
        }).catch(() => {});
      }
    };

    window.addEventListener('online', handleSyncOnVisible);
    document.addEventListener('visibilitychange', handleSyncOnVisible);

    return () => {
      window.removeEventListener('online', handleSyncOnVisible);
      document.removeEventListener('visibilitychange', handleSyncOnVisible);
    };
  }, [isMultiplayerMode, currentRoom?.code]);

  // BeforeUnload warning when actively playing online to prevent accidental exit
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = (e) => {
      if (isMultiplayerMode && currentRoom?.status === 'playing') {
        e.preventDefault();
        e.returnValue = 'Permainan online sedang berlangsung. Anda yakin ingin me-refresh atau keluar?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isMultiplayerMode, currentRoom?.status]);

  // ---------------------------------------------------------------------------
  // LIVE CHAT HANDLERS (Ephemeral popups & broadcast)
  // ---------------------------------------------------------------------------
  const handleIncomingChatMessage = (chat) => {
    if (!chat || !chat.message) return;
    audio.playChatPopSound();
    const newChat = {
      ...chat,
      id: chat.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };

    setActiveChatMessages((prev) => [...prev.slice(-2), newChat]);

    // Auto-dismiss after 4.5 seconds
    setTimeout(() => {
      setActiveChatMessages((prev) =>
        prev.map((m) => (m.id === newChat.id ? { ...m, isFading: true } : m))
      );
      setTimeout(() => {
        setActiveChatMessages((prev) => prev.filter((m) => m.id !== newChat.id));
      }, 400);
    }, 4200);
  };

  const handleSendChatMessage = async (text) => {
    if (!text || !text.trim()) return;

    let senderName = getLocalPlayerName() || 'Anda';
    let senderAvatar = '👤';
    let senderId = myPlayerId || 'local_human';

    if (isMultiplayerMode && currentRoom?.players) {
      const myPlayer = (currentRoom.players || []).find((p) => p.id === myPlayerId);
      if (myPlayer) {
        senderName = myPlayer.name || senderName;
        senderAvatar = myPlayer.avatar || senderAvatar;
      }
    }

    const chatPayload = {
      senderId,
      senderName,
      senderAvatar,
      message: text.trim(),
      timestamp: Date.now(),
    };

    // Optimistic local display
    handleIncomingChatMessage(chatPayload);

    // Broadcast to other players in room (if online)
    if (isMultiplayerMode && currentRoom?.code) {
      await multiplayerAdapter.sendRoomChat(currentRoom.code, chatPayload);
    }

    // Interactive Bot reply when playing with Bot AI
    const activePlayersList = isMultiplayerMode
      ? (currentRoom?.players || [])
      : (activeGameType === 'bigtwo'
          ? (gameStateBigtwo?.players || [])
          : activeGameType === 'game41'
          ? (gameState41?.players || [])
          : (gameState?.players || []));

    const botPlayers = activePlayersList.filter(
      (p) => p.isBot || p.isBotTakeover || isBotPlayer(null, p.id)
    );

    if (botPlayers.length > 0) {
      const chosenBot = botPlayers[Math.floor(Math.random() * botPlayers.length)];
      const botDelay = 1200 + Math.random() * 1100;

      setTimeout(() => {
        const replyText = getBotChatReply(text);
        const botPayload = {
          senderId: chosenBot.id,
          senderName: chosenBot.name || 'Bot AI',
          senderAvatar: chosenBot.avatar || '🤖',
          message: replyText,
          timestamp: Date.now(),
        };

        handleIncomingChatMessage(botPayload);

        // If in multiplayer room and I am host, broadcast the bot reply so all players see it
        if (isMultiplayerMode && currentRoom?.code && isHost) {
          multiplayerAdapter.sendRoomChat(currentRoom.code, botPayload);
        }
      }, botDelay);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. SUPABASE REALTIME SUBSCRIPTION
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gameMode !== 'multiplayer' || !currentRoom?.code) return;

    const unsubscribe = multiplayerAdapter.subscribeToRoom(
      currentRoom.code,
      (updatedRoom) => {
        setCurrentRoom(updatedRoom);

        if (updatedRoom.status === 'lobby') {
          // Reset local in-game state when returning to lobby
          setGameStateBigtwo({});
          setGameState41({});
          return;
        }

        if (updatedRoom.game_state) {
          const nextState = updatedRoom.game_state;

          if (nextState.gameType === 'bigtwo') {
            setActiveGameType('bigtwo');
            if (nextState.players && nextState.hands) {
              setGameStateBigtwo(nextState);
              if (nextState.lastAction) {
                setRecentActionPopup(nextState.lastAction);
                if (nextState.lastAction.type === 'PLAY_COMBO') audio.playCardSound();
                else if (nextState.lastAction.type === 'PASS') audio.closeCardSound();
              }
              setCurrentRoom(updatedRoom);
            } else if (updatedRoom.status === 'playing') {
              // Realtime payload might be compact/truncated; fetch full record immediately
              multiplayerAdapter.getRoom(currentRoom.code).then(({ room }) => {
                if (room?.game_state?.players && room?.game_state?.hands) {
                  setGameStateBigtwo(room.game_state);
                }
                setCurrentRoom(room || updatedRoom);
              }).catch(() => {
                setCurrentRoom(updatedRoom);
              });
            } else {
              setCurrentRoom(updatedRoom);
            }
            return;
          }

          if (nextState.gameType === 'game41') {
            setActiveGameType('game41');
            if (nextState.players) {
              if (nextState.lastAction) {
                setRecentActionPopup(nextState.lastAction);
              }
              if (nextState.turnNumber !== prevTurnNumberRef.current && nextState.lastAction) {
                const action = nextState.lastAction;
                if (action.type === 'DRAW') {
                  audio.playCardSound();
                } else if (action.type === 'DISCARD') {
                  if (action.is41) audio.victorySound();
                  else audio.closeCardSound();
                }
              }
              prevTurnNumberRef.current = nextState.turnNumber;
              setGameState41(nextState);
            }
            return;
          }

          // If turn is 1 and game newly started or restarted, trigger dealing animation
          if (nextState.turnNumber === 1 && !nextState.firstMoveMade && prevTurnNumberRef.current !== 1) {
            setIsDealingAnimationActive(true);
          }

          // Play audio feedback if a move was made by other players
          if (nextState.lastAction) {
            setRecentActionPopup(nextState.lastAction);
          }
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
      },
      null,
      handleIncomingChatMessage
    );

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
  const handleCreateRoom = async (username, maxPlayers = 4, gameType = activeGameType, options = {}) => {
    const res = await multiplayerAdapter.createRoom(username, maxPlayers, gameType, options);
    if (res.success) {
      setCurrentRoom(res.room);
      setMyPlayerId(res.player.id);
      // Clean reset game engine states for fresh waiting room
      if (gameType === 'bigtwo') {
        setActiveGameType('bigtwo');
        setGameStateBigtwo(initBigTwo({ playerCount: maxPlayers, deckMode: options?.deckMode || 'single' }));
      } else if (gameType === 'game41') {
        setActiveGameType('game41');
        setGameState41(initGame41({ playerCount: maxPlayers }));
      } else {
        setActiveGameType('sevens');
        setGameState(initGame({ ...gameConfig, playerCount: maxPlayers }));
      }
      setBigTwoWheelPicker(null);
      setPendingBigTwoWheel(null);
      setRecentActionPopup(null);
      setSelectedCard(null);
      setActiveFault(null);
      setPendingAceChoiceCard(null);
      setIsDealingAnimationActive(false);

      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setInviteRoomCode(null);
      showToast(`Room ${res.room.code} (${res.room.game_state?.config?.playerCount || maxPlayers} Pemain) berhasil dibuat!`);
    }
    return res;
  };

  const handleUpdateRoomConfig = async (configUpdates) => {
    if (!currentRoom?.code || !isHost) return;
    const res = await multiplayerAdapter.updateRoomConfig(currentRoom.code, myPlayerId, configUpdates);
    if (res.success && res.room) {
      setCurrentRoom(res.room);
      if (configUpdates.deckMode) {
        showToast(
          configUpdates.deckMode === 'double'
            ? 'Meja diatur ke Mode Double Deck (104 kartu) 🎴'
            : 'Meja diatur ke Mode Single Deck (52 kartu) 🃏'
        );
      }
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleJoinRoom = async (code, username) => {
    const res = await multiplayerAdapter.joinRoom(code, username);
    if (res.success) {
      setCurrentRoom(res.room);
      setMyPlayerId(res.player.id);
      const roomGame = res.room.game_state?.gameType || activeGameType;
      setActiveGameType(roomGame);

      if (res.room.game_state?.players) {
        if (roomGame === 'bigtwo') {
          setGameStateBigtwo(res.room.game_state);
        } else if (roomGame === 'game41') {
          setGameState41(res.room.game_state);
        } else {
          setGameState(res.room.game_state);
        }
      } else {
        // Room still in lobby: initialize fresh engine state with clean roster
        const capacity = res.room.game_state?.config?.playerCount || 4;
        if (roomGame === 'bigtwo') {
          setGameStateBigtwo(initBigTwo({ playerCount: capacity, deckMode: res.room.game_state?.config?.deckMode || 'single' }));
        } else if (roomGame === 'game41') {
          setGameState41(initGame41({ playerCount: capacity }));
        } else {
          setGameState(initGame({ ...gameConfig, playerCount: capacity }));
        }
      }
      setBigTwoWheelPicker(null);
      setPendingBigTwoWheel(null);
      setRecentActionPopup(null);
      setSelectedCard(null);
      setActiveFault(null);
      setPendingAceChoiceCard(null);
      setIsDealingAnimationActive(false);

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
    const isBigTwo = activeGameType === 'bigtwo' || currentRoom.game_state?.gameType === 'bigtwo';
    const isGame41 = activeGameType === 'game41' || currentRoom.game_state?.gameType === 'game41';
    const actualPlayerCount = currentRoom.players?.length || 4;
    const roomDeckMode = currentRoom.game_state?.config?.deckMode;
    const effectiveDeckMode = isBigTwo && actualPlayerCount > 4
      ? (roomDeckMode || 'double')
      : 'single';

    const configToUse = isBigTwo
      ? { gameType: 'bigtwo', ...currentRoom.game_state?.config, deckMode: effectiveDeckMode }
      : isGame41
      ? { gameType: 'game41' }
      : gameConfig;
    const determinedGame = isBigTwo ? 'bigtwo' : isGame41 ? 'game41' : 'sevens';
    const res = await multiplayerAdapter.startGame(currentRoom.code, myPlayerId, configToUse, determinedGame);
    if (res.success) {
      if (isBigTwo) {
        setActiveGameType('bigtwo');
        setGameStateBigtwo(res.gameState);
      } else if (isGame41) {
        setActiveGameType('game41');
        setGameState41(res.gameState);
      } else {
        setActiveGameType('sevens');
        setGameState(res.gameState);
        setIsDealingAnimationActive(true);
      }
      setCurrentRoom(res.room);
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
    // Clean reset local game engine states
    if (activeGameType === 'bigtwo') {
      setGameStateBigtwo(initBigTwo({ playerCount: 4 }));
    } else if (activeGameType === 'game41') {
      setGameState41(initGame41({ playerCount: 4 }));
    } else {
      setGameState(initGame(DEFAULT_CONFIG));
    }
    setBigTwoWheelPicker(null);
    setPendingBigTwoWheel(null);
    setRecentActionPopup(null);
    setSelectedCard(null);
    setActiveFault(null);
    setPendingAceChoiceCard(null);
    setIsDealingAnimationActive(false);
    showToast('Telah keluar dari room.');
  };

  const handleAddBotMultiplayer = async () => {
    if (!currentRoom?.code || !isHost) return;
    const res = await multiplayerAdapter.addBot(currentRoom.code, myPlayerId);
    if (res.success && res.room) {
      setCurrentRoom(res.room);
    } else {
      showToast(res.error || 'Gagal menambahkan bot.');
    }
  };

  const handleRemoveBotMultiplayer = async (botId) => {
    if (!currentRoom?.code || !isHost) return;
    const res = await multiplayerAdapter.removeBot(currentRoom.code, myPlayerId, botId);
    if (res.success && res.room) {
      setCurrentRoom(res.room);
    } else {
      showToast(res.error || 'Gagal mengeluarkan bot.');
    }
  };

  const handleClaimHost = async () => {
    if (!currentRoom?.code || !myPlayerId) return;
    try {
      const res = await multiplayerAdapter.claimHost(currentRoom.code, myPlayerId);
      if (res.success && res.room) {
        setCurrentRoom(res.room);
        showToast('👑 Anda sekarang adalah Host Meja!');
      } else {
        showToast(res.error || 'Gagal mengambil alih host.');
      }
    } catch (err) {
      console.error('Error claiming host:', err);
      showToast('Terjadi kesalahan saat mengambil alih host.');
    }
  };

  const handleResetRoom = async () => {
    if (!currentRoom?.code) return;
    if (!window.confirm('Reset permainan dan skor meja ini kembali ke Ruang Tunggu (Lobby)?')) return;
    try {
      const res = await multiplayerAdapter.resetRoomState(currentRoom.code, myPlayerId);
      if (res.success && res.room) {
        setCurrentRoom(res.room);
        setGameStateBigtwo({});
        setGameState41({});
        showToast('🔄 Meja dan skor telah berhasil di-reset!');
      } else {
        showToast(res.error || 'Gagal mereset room.');
      }
    } catch (err) {
      console.error('Error resetting room:', err);
      showToast('Terjadi kesalahan saat mereset room.');
    }
  };

  const handleForceResetAndJoin = async (roomCode, playerName) => {
    try {
      const res = await multiplayerAdapter.forceResetAndJoinRoom(roomCode, playerName);
      if (res.success && res.room) {
        setCurrentRoom(res.room);
        setMyPlayerId(res.player.id);
        setGameMode('multiplayer');
        setGameStateBigtwo({});
        setGameState41({});
        showToast(`👑 Berhasil mereset Room ${res.room.code}! Anda sekarang adalah Host.`);
      } else {
        showToast(res.error || 'Gagal mereset room.');
      }
    } catch (err) {
      console.error('Error force resetting room:', err);
      showToast('Terjadi kesalahan saat mereset room.');
    }
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
    } else if (gameMode === 'single') {
      const count = nextCfg.playerCount || gameState.players?.length || 2;
      const roster = createSinglePlayerRoster(count);
      const nextState = initGame({ ...nextCfg, playerCount: count }, roster);
      setGameState(nextState);
      setSelectedCard(null);
      setActiveFault(null);
      setPendingAceChoiceCard(null);
      setIsDealingAnimationActive(true);
      showToast('Permainan Single Player baru dimulai!');
    } else {
      // Local Mode: apply configured player count
      const count = nextCfg.playerCount || gameState.players?.length || 4;
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
  // Determine which player's cards to show in the bottom tray
  // In multiplayer: Always the user's cards (myPlayerId)
  // In single player: Always human player (SINGLE_HUMAN_ID)
  // In local mode: The player whose turn it currently is (pass-and-play)
  const isBigTwoActive = activeGameType === 'bigtwo';
  const isGame41Active = activeGameType === 'game41';
  const playersList = isBigTwoActive
    ? (gameStateBigtwo?.players || [])
    : isGame41Active
    ? (gameState41?.players || [])
    : (gameState?.players || []);

  const trayPlayer = isMultiplayerMode
    ? playersList.find((p) => p.id === myPlayerId) || playersList[0] || {}
    : isSingleMode
    ? playersList.find((p) => p.id === SINGLE_HUMAN_ID) || playersList[0] || {}
    : playersList.find((p) => p.id === (
        isBigTwoActive
          ? gameStateBigtwo?.currentPlayer
          : isGame41Active
          ? gameState41?.currentPlayer
          : gameState?.currentPlayer
      )) || playersList[0] || {};

  const currentHandRaw = isBigTwoActive
    ? (gameStateBigtwo?.hands?.[trayPlayer.id] || [])
    : isGame41Active
    ? (gameState41?.hands?.[trayPlayer.id] || [])
    : (gameState?.hands?.[trayPlayer.id] || []);

  const currentHand = useMemo(() => {
    return (isGame41Active || isBigTwoActive) ? currentHandRaw : sortHand(currentHandRaw, handSortBy);
  }, [currentHandRaw, handSortBy, isGame41Active, isBigTwoActive]);

  const isMyTurn = isMultiplayerMode
    ? (isBigTwoActive ? gameStateBigtwo?.currentPlayer === myPlayerId : isGame41Active ? gameState41?.currentPlayer === myPlayerId : gameState?.currentPlayer === myPlayerId)
    : isSingleMode
    ? (isBigTwoActive ? gameStateBigtwo?.currentPlayer === SINGLE_HUMAN_ID : isGame41Active ? gameState41?.currentPlayer === SINGLE_HUMAN_ID : gameState?.currentPlayer === SINGLE_HUMAN_ID)
    : true; // In local mode, active player has turn

  // Seating around the poker table
  // In multiplayer: relative rotation so user is ALWAYS at the bottom!
  // In single player: relative rotation so human is ALWAYS at the bottom!
  // In local mode: relative rotation to whoever's turn it is (pass-and-play perspective)
  const seats = isMultiplayerMode
    ? getRelativeSeats(playersList, myPlayerId)
    : isSingleMode
    ? getRelativeSeats(playersList, SINGLE_HUMAN_ID)
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
    if (isMultiplayerMode && currentRoom?.status !== 'playing') return;

    const isCurrentBot = isBotPlayer(gameState, gameState.currentPlayer);
    if (isMultiplayerMode && !isMyTurn && !isCurrentBot) {
      setActiveFault({ message: 'Bukan giliran Anda! Tunggu giliran Anda bermain.' });
      return;
    }

    const actingPlayerId = isCurrentBot ? gameState.currentPlayer : (isMultiplayerMode ? myPlayerId : gameState.currentPlayer);

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
      const actorName = gameState.players.find((p) => p.id === actingPlayerId)?.name || 'Pemain';
      const actorAvatar = gameState.players.find((p) => p.id === actingPlayerId)?.avatar || '♠';
      setRecentActionPopup({
        type: 'PLAY',
        playerId: actingPlayerId,
        playerName: actorName,
        avatar: actorAvatar,
        card,
        message: `${actorName} memainkan ${card.label}${card.symbol}`,
      });
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
    if (isMultiplayerMode && currentRoom?.status !== 'playing') return;

    const isCurrentBot = isBotPlayer(gameState, gameState.currentPlayer);
    if (isMultiplayerMode && !isMyTurn && !isCurrentBot) {
      setActiveFault({ message: 'Bukan giliran Anda! Tunggu giliran Anda bermain.' });
      return;
    }

    const actingPlayerId = isCurrentBot ? gameState.currentPlayer : (isMultiplayerMode ? myPlayerId : gameState.currentPlayer);

    const result = engineCloseCard(gameState, actingPlayerId, card);
    if (result.success) {
      setGameState(result.state);
      setSelectedCard(null);
      audio.closeCardSound();
      const actorName = gameState.players.find((p) => p.id === actingPlayerId)?.name || 'Pemain';
      const actorAvatar = gameState.players.find((p) => p.id === actingPlayerId)?.avatar || '🔒';
      setRecentActionPopup({
        type: 'PASS',
        playerId: actingPlayerId,
        playerName: actorName,
        avatar: actorAvatar,
        card,
        message: `${actorName} menutup kartu ${card.label}${card.symbol}`,
      });

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

  // ---------------------------------------------------------------------------
  // GAME 41 ACTIONS (DRAW, DISCARD, RESTART)
  // ---------------------------------------------------------------------------
  const isMyTurn41 = isMultiplayerMode
    ? gameState41.currentPlayer === myPlayerId
    : isSingleMode
    ? gameState41.currentPlayer === SINGLE_HUMAN_ID
    : true;

  const handleDrawCard41 = async (source) => {
    if (isMultiplayerMode && currentRoom?.status !== 'playing') return;
    const isCurrentBot = isBotPlayer(gameState41, gameState41.currentPlayer);
    if (!isCurrentBot && !isMyTurn41) {
      showToast('Bukan giliran Anda!');
      return;
    }
    const actingPlayerId = isCurrentBot ? gameState41.currentPlayer : (isMultiplayerMode ? myPlayerId : gameState41.currentPlayer);
    const res = drawCard41(gameState41, actingPlayerId, source);
    if (res.success) {
      setGameState41(res.state);
      audio.playCardSound();
      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, res.state);
      }
    } else {
      showToast(res.error);
    }
  };

  const handleDiscardCard41 = async (card) => {
    if (isMultiplayerMode && currentRoom?.status !== 'playing') return;
    const isCurrentBot = isBotPlayer(gameState41, gameState41.currentPlayer);
    if (!isCurrentBot && !isMyTurn41) {
      showToast('Bukan giliran Anda!');
      return;
    }
    const actingPlayerId = isCurrentBot ? gameState41.currentPlayer : (isMultiplayerMode ? myPlayerId : gameState41.currentPlayer);
    const res = discardCard41(gameState41, actingPlayerId, card);
    if (res.success) {
      setGameState41(res.state);
      const actorName = gameState41.players.find((p) => p.id === actingPlayerId)?.name || 'Pemain';
      const actorAvatar = gameState41.players.find((p) => p.id === actingPlayerId)?.avatar || '🃏';
      setRecentActionPopup({
        type: 'DISCARD',
        playerId: actingPlayerId,
        playerName: actorName,
        avatar: actorAvatar,
        card,
        message: `${actorName} membuang ${card.label}${card.symbol}`,
      });
      if (res.is41) {
        audio.victorySound();
      } else {
        audio.closeCardSound();
      }
      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, res.state);
      }
    } else {
      showToast(res.error);
    }
  };

  const handleCloseHand41 = async (card = null) => {
    if (isMultiplayerMode && currentRoom?.status !== 'playing') return;
    const isCurrentBot = isBotPlayer(gameState41, gameState41.currentPlayer);
    if (!isCurrentBot && !isMyTurn41) {
      showToast('Bukan giliran Anda!');
      return;
    }
    const actingPlayerId = isCurrentBot ? gameState41.currentPlayer : (isMultiplayerMode ? myPlayerId : gameState41.currentPlayer);
    const res = closeHand41(gameState41, actingPlayerId, card);
    if (res.success) {
      setGameState41(res.state);
      const actorName = gameState41.players.find((p) => p.id === actingPlayerId)?.name || 'Pemain';
      const actorAvatar = gameState41.players.find((p) => p.id === actingPlayerId)?.avatar || '🃏';
      setRecentActionPopup({
        type: 'CLOSE_HAND',
        playerId: actingPlayerId,
        playerName: actorName,
        avatar: actorAvatar,
        card,
        message: `${actorName} MENUTUP KARTU!`,
      });
      if (res.isBusted) {
        audio.closeCardSound?.();
      } else {
        audio.victorySound?.();
      }
      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, res.state);
      }
    } else {
      showToast(res.error);
    }
  };

  const handleRestart41 = async (configOverrides) => {
    const prevWinnerId = gameState41.winner?.id || (gameState41.rankings?.[0]?.player?.id) || null;
    if (gameMode === 'multiplayer' && currentRoom?.code) {
      const isHost = currentRoom.host_id === myPlayerId;
      if (!isHost) {
        showToast('Hanya Host yang dapat mengocok ulang dan memulai game baru.');
        return;
      }
      const res = await multiplayerAdapter.restartGame(currentRoom.code, myPlayerId, {
        gameType: 'game41',
        firstPlayerId: prevWinnerId,
        ...configOverrides,
      });
      if (res.success) {
        setGameState41(res.gameState);
        setIsDealingAnimationActive(true);
        const starterName = res.gameState.players.find((p) => p.id === res.gameState.currentPlayer)?.name || 'Pemain';
        showToast(`Permainan Kartu 41 baru dimulai! Giliran pertama: ${starterName}`);
      } else {
        showToast(res.error || 'Gagal memulai ulang permainan.');
      }
    } else if (gameMode === 'single') {
      const count = gameState41.players?.length || 2;
      const roster = createSinglePlayerRoster(count);
      const nextState = initGame41({ playerCount: count, firstPlayerId: prevWinnerId }, roster);
      setGameState41(nextState);
      setIsDealingAnimationActive(true);
      const starterName = nextState.players.find((p) => p.id === nextState.currentPlayer)?.name || 'Pemain';
      showToast(`Permainan Kartu 41 baru dimulai! Giliran pertama: ${starterName}`);
    } else {
      const count = gameState41.players?.length || 4;
      const nextState = initGame41({ playerCount: count, firstPlayerId: prevWinnerId });
      setGameState41(nextState);
      setIsDealingAnimationActive(true);
      const starterName = nextState.players.find((p) => p.id === nextState.currentPlayer)?.name || 'Pemain';
      showToast(`Permainan Kartu 41 baru dimulai! Giliran pertama: ${starterName}`);
    }
  };

  // ---------------------------------------------------------------------------
  // BIG TWO (CAPSA BANTING) ACTIONS
  const isMyTurnBigtwo = isMultiplayerMode
    ? gameStateBigtwo?.currentPlayer === myPlayerId
    : isSingleMode
    ? gameStateBigtwo?.currentPlayer === SINGLE_HUMAN_ID
    : true;

  // Sound chime whenever user's turn arrives in multiplayer / single player mode
  const activeIsMyTurn = (isMultiplayerMode || isSingleMode)
    ? (activeGameType === 'bigtwo'
        ? gameStateBigtwo?.currentPlayer === (isMultiplayerMode ? myPlayerId : SINGLE_HUMAN_ID)
        : activeGameType === 'game41'
        ? gameState41?.currentPlayer === (isMultiplayerMode ? myPlayerId : SINGLE_HUMAN_ID)
        : gameState?.currentPlayer === (isMultiplayerMode ? myPlayerId : SINGLE_HUMAN_ID))
    : false;

  const prevIsMyTurnRef = useRef(false);
  useEffect(() => {
    if ((isMultiplayerMode || isSingleMode) && activeIsMyTurn && !prevIsMyTurnRef.current) {
      audio.sevenChime();
    }
    prevIsMyTurnRef.current = activeIsMyTurn;
  }, [activeIsMyTurn, isMultiplayerMode, isSingleMode]);

  const handlePlayBigTwoCombo = async (selectedCards) => {
    if (isMultiplayerMode && currentRoom?.status !== 'playing') return;
    const isCurrentBot = isBotPlayer(gameStateBigtwo, gameStateBigtwo?.currentPlayer);
    const actingPlayerId = isCurrentBot ? gameStateBigtwo?.currentPlayer : (isMultiplayerMode ? myPlayerId : gameStateBigtwo?.currentPlayer);
    const res = playComboBigTwo(gameStateBigtwo, actingPlayerId, selectedCards);
    if (res.success) {
      setGameStateBigtwo(res.gameState);
      if (res.gameState.lastAction) {
        setRecentActionPopup(res.gameState.lastAction);
      }
      audio.playCardSound();
      if (res.gameState.gameStatus === 'GAME_OVER') {
        audio.victorySound();
      }
      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, res.gameState);
      }
    } else {
      showToast(res.error);
    }
  };

  const handlePassBigTwo = async () => {
    if (isMultiplayerMode && currentRoom?.status !== 'playing') return;
    const isCurrentBot = isBotPlayer(gameStateBigtwo, gameStateBigtwo?.currentPlayer);
    const actingPlayerId = isCurrentBot ? gameStateBigtwo?.currentPlayer : (isMultiplayerMode ? myPlayerId : gameStateBigtwo?.currentPlayer);
    const res = passTurnBigTwo(gameStateBigtwo, actingPlayerId);
    if (res.success) {
      setGameStateBigtwo(res.gameState);
      if (res.gameState.lastAction) {
        setRecentActionPopup(res.gameState.lastAction);
      }
      audio.closeCardSound();
      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, res.gameState);
      }
    } else {
      showToast(res.error);
    }
  };

  const handleSetBotTakeover = async (playerId, isTakeover = true) => {
    // 1. If player is reclaiming control (isTakeover === false):
    // IMMEDIATELY CANCEL any pending bot execution so bot doesn't make a move on player's behalf
    if (!isTakeover) {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
      setBotThinking(null);
      turnStartTimeRef.current = Date.now();
      setTurnElapsed(0);
      afkTriggeredTurnRef.current.clear();
    }

    if (activeGameType === 'bigtwo') {
      const nextState = setBotTakeoverBigTwo(gameStateBigtwo, playerId, isTakeover);
      setGameStateBigtwo(nextState);
    } else if (activeGameType === 'game41') {
      const nextState = setBotTakeoverGame41(gameState41, playerId, isTakeover);
      setGameState41(nextState);
    } else {
      // Sevens
      const nextState = setBotTakeoverSevens(gameState, playerId, isTakeover);
      setGameState(nextState);
    }

    const currentPlayers =
      activeGameType === 'bigtwo'
        ? gameStateBigtwo?.players
        : activeGameType === 'game41'
        ? gameState41?.players
        : gameState?.players;
    const pObj = currentPlayers?.find((p) => p.id === playerId);

    if (isTakeover) {
      showToast(`🤖 Giliran ${pObj?.name || 'Pemain'} diambil alih oleh Bot AI (AFK > 2 Menit).`);
    } else {
      showToast('✨ Anda telah mengambil alih kendali kartu kembali!');
    }

    if (isMultiplayerMode && currentRoom?.code) {
      await multiplayerAdapter.toggleBotTakeover(currentRoom.code, playerId, isTakeover);
    }
  };

  // AFK & Turn Timer tracking (120 seconds = 2 minutes -> auto-switch to Bot AI like Mobile Legends for all games)
  useEffect(() => {
    const isGameOver =
      activeGameType === 'bigtwo'
        ? gameStateBigtwo?.gameStatus === 'GAME_OVER' || bigTwoWheelPicker?.isOpen
        : activeGameType === 'game41'
        ? gameState41?.gameStatus === 'GAME_OVER' || gameState41?.gameStatus === 'game_over'
        : gameState?.gameStatus === GAME_STATUS.GAME_OVER;

    if (isGameOver) {
      setTurnElapsed(0);
      return;
    }

    const currentId =
      activeGameType === 'bigtwo'
        ? gameStateBigtwo?.currentPlayer
        : activeGameType === 'game41'
        ? gameState41?.currentPlayer
        : gameState?.currentPlayer;

    const currentTurnStartedAt =
      activeGameType === 'bigtwo'
        ? gameStateBigtwo?.turnStartedAt
        : activeGameType === 'game41'
        ? gameState41?.turnStartedAt
        : gameState?.turnStartedAt;

    if (prevTurnPlayerIdRef.current !== currentId) {
      prevTurnPlayerIdRef.current = currentId;
      turnStartTimeRef.current = currentTurnStartedAt || Date.now();
      setTurnElapsed(0);
    }

    const interval = setInterval(() => {
      const startTime = currentTurnStartedAt || turnStartTimeRef.current;
      const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      setTurnElapsed(elapsed);

      const currentPlayers =
        activeGameType === 'bigtwo'
          ? gameStateBigtwo?.players
          : activeGameType === 'game41'
          ? gameState41?.players
          : gameState?.players;

      const currentPlayerObj = currentPlayers?.find((p) => p.id === currentId);
      const isHumanTurn = currentPlayerObj && !currentPlayerObj.isBot && !currentPlayerObj.isBotTakeover;

      if (isHumanTurn && elapsed >= 120) {
        const turnKey = `${activeGameType}_${currentId}_${startTime}`;
        if (!afkTriggeredTurnRef.current.has(turnKey)) {
          afkTriggeredTurnRef.current.add(turnKey);

          // Determine who should trigger takeover:
          // 1. Viewer is the active player (myPlayerId in MP, or SINGLE_HUMAN_ID in single, or local mode)
          // 2. OR Host in multiplayer (safety net if guest closed tab or is unresponsive)
          const isMyActiveTurn = isMultiplayerMode
            ? currentId === myPlayerId
            : isSingleMode
            ? currentId === SINGLE_HUMAN_ID
            : true;

          if (isMyActiveTurn || (isHost && isMultiplayerMode)) {
            console.log(`[AFK AUTO-TAKEOVER] [${activeGameType}] Pemain ${currentPlayerObj?.name || currentId} (${currentId}) AFK > 120s. Langsung dialihkan ke Bot AI.`);
            handleSetBotTakeover(currentId, true);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    activeGameType,
    gameState?.currentPlayer,
    gameState?.turnStartedAt,
    gameState?.gameStatus,
    gameState41?.currentPlayer,
    gameState41?.turnStartedAt,
    gameState41?.gameStatus,
    gameStateBigtwo?.currentPlayer,
    gameStateBigtwo?.turnStartedAt,
    gameStateBigtwo?.gameStatus,
    bigTwoWheelPicker?.isOpen,
    myPlayerId,
    isHost,
    isMultiplayerMode,
    isSingleMode,
  ]);


  const getScoreSessionKey = (gameKey) => {
    if (isMultiplayerMode && currentRoom?.code) {
      return `${gameKey}_room_${currentRoom.code}`;
    }
    if (gameMode === 'single') {
      return `${gameKey}_single`;
    }
    if (gameMode === 'local') {
      return `${gameKey}_local`;
    }
    return gameKey;
  };

  const recordGameEndScore = (gameKey, rankings = [], winnerId = null) => {
    if (!rankings || rankings.length === 0) return;
    const sessionKey = getScoreSessionKey(gameKey);

    setScoreboardData((prev) => {
      const gameScores = { ...(prev[sessionKey] || {}) };
      rankings.forEach((r, idx) => {
        const key = r.id || r.name;
        const current = gameScores[key] || {
          id: r.id,
          name: r.name,
          avatar: r.avatar,
          games: 0,
          score: 0,
        };
        const isWinner = r.isWinner || idx === 0 || (winnerId && r.id === winnerId);
        gameScores[key] = {
          ...current,
          name: r.name || current.name,
          avatar: r.avatar || current.avatar,
          games: (current.games || 0) + 1,
          score: (current.score || 0) + (isWinner ? 1 : 0),
        };
      });
      const nextScores = { ...prev, [sessionKey]: gameScores };
      try {
        localStorage.setItem('poker_scoreboard_data', JSON.stringify(nextScores));
      } catch (e) {
        console.error('Failed to save scoreboard data', e);
      }
      return nextScores;
    });
  };

  const handleResetScoreboard = (gameKey = activeGameType) => {
    const sessionKey = getScoreSessionKey(gameKey);
    setScoreboardData((prev) => {
      const nextScores = { ...prev, [sessionKey]: {} };
      try {
        localStorage.setItem('poker_scoreboard_data', JSON.stringify(nextScores));
      } catch (e) {}
      return nextScores;
    });

    if (activeGameType === 'bigtwo') {
      setGameStateBigtwo((prev) => {
        const resetState = { ...prev, sessionScores: {} };
        if (isMultiplayerMode && currentRoom?.code) {
          multiplayerAdapter.syncGameState(currentRoom.code, resetState);
        }
        return resetState;
      });
    }

    showToast('Scoreboard sesi ini berhasil di-reset!');
  };

  const getCurrentScoreboardList = () => {
    const sessionKey = getScoreSessionKey(activeGameType);

    if (activeGameType === 'bigtwo') {
      const engineSessionScores = gameStateBigtwo.sessionScores || currentRoom?.game_state?.sessionScores;
      if (engineSessionScores && Object.keys(engineSessionScores).length > 0) {
        return Object.values(engineSessionScores);
      }
      if (scoreboardData[sessionKey] && Object.keys(scoreboardData[sessionKey]).length > 0) {
        return Object.values(scoreboardData[sessionKey]);
      }
      const players = (isMultiplayerMode && currentRoom?.players)
        ? currentRoom.players
        : (gameStateBigtwo.players || []);
      return players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        games: 0,
        score: 0,
      }));
    }

    const scores = scoreboardData[sessionKey] || scoreboardData[activeGameType] || {};
    return Object.values(scores);
  };

  const getCurrentScoreboardTitle = () => {
    if (activeGameType === 'bigtwo') {
      if (isMultiplayerMode && currentRoom?.code) {
        return `Scoreboard • Capsa Banting (Sesi Room: ${currentRoom.code})`;
      }
      if (gameMode === 'single') {
        return 'Scoreboard • Capsa Banting (Sesi vs Bot)';
      }
      return 'Scoreboard • Capsa Banting (Sesi Offline)';
    }
    if (activeGameType === 'game41') {
      return isMultiplayerMode && currentRoom?.code
        ? `Scoreboard • Remi 41 (Sesi Room: ${currentRoom.code})`
        : 'Scoreboard • Remi 41';
    }
    return isMultiplayerMode && currentRoom?.code
      ? `Scoreboard • Sevens (Sesi Room: ${currentRoom.code})`
      : 'Scoreboard • Tujuh Sekop';
  };

  const handleBigTwoWheelComplete = async (selectedPlayerId) => {
    setBigTwoWheelPicker(null);
    const chosenPlayer = gameStateBigtwo.players?.find((p) => p.id === selectedPlayerId);
    showToast(`🎯 Giliran Pertama: ${chosenPlayer?.name || 'Pemain'} (Meja Bebas)!`);
    if (gameStateBigtwo.currentPlayer !== selectedPlayerId) {
      const updatedState = {
        ...gameStateBigtwo,
        currentPlayer: selectedPlayerId,
        trickLeaderId: selectedPlayerId,
        currentTrick: { cards: [], combo: null, playedBy: null, playedByName: null },
        passedPlayers: [],
      };
      setGameStateBigtwo(updatedState);
      if (isMultiplayerMode && currentRoom?.code) {
        await multiplayerAdapter.syncGameState(currentRoom.code, updatedState);
      }
    }
  };

  const handleBigTwoRespin = () => {
    if (!gameStateBigtwo.players || gameStateBigtwo.players.length === 0) return;
    const players = gameStateBigtwo.players;
    const randomIdx = Math.floor(Math.random() * players.length);
    setBigTwoWheelPicker({
      isOpen: true,
      players,
      targetPlayerId: players[randomIdx].id,
    });
  };

  const handleRestartBigTwo = async (configOverrides = {}) => {
    // When playing again, no need to spin wheel; previous winner starts the next game
    const previousWinnerId = gameStateBigtwo.winner;
    const previousWinnerObj = gameStateBigtwo.players?.find((p) => p.id === previousWinnerId);

    if (gameMode === 'multiplayer' && currentRoom?.code) {
      const isHost = currentRoom.host_id === myPlayerId;
      if (!isHost) {
        showToast('Hanya Host yang dapat mengocok ulang dan memulai game baru.');
        return;
      }
      const res = await multiplayerAdapter.restartGame(currentRoom.code, myPlayerId, {
        gameType: 'bigtwo',
        startingPlayerId: previousWinnerId,
        ...configOverrides,
      });
      if (res.success) {
        setGameStateBigtwo(res.gameState);
        setPendingBigTwoWheel(null); // Tidak perlu spin lagi saat main lagi
        setIsDealingAnimationActive(true);
        if (previousWinnerObj) {
          showToast(`Game baru dimulai! Giliran awal: ${previousWinnerObj.name} (Pemenang sebelumnya) 👑`);
        } else {
          showToast('Permainan Big Two baru dimulai!');
        }
      } else {
        showToast(res.error || 'Gagal memulai ulang permainan.');
      }
    } else if (gameMode === 'single') {
      const count = gameStateBigtwo.players?.length || 2;
      const roster = createSinglePlayerRoster(count);
      const effectiveDeckMode = count > 4 ? gameStateBigtwo.config.deckMode : 'single';
      const carriedSessionScores = gameStateBigtwo.sessionScores || {};
      const nextState = initBigTwo(
        {
          playerCount: count,
          deckMode: effectiveDeckMode,
          startingPlayerId: previousWinnerId,
          sessionScores: carriedSessionScores,
          ...configOverrides,
        },
        roster
      );
      setGameStateBigtwo(nextState);
      setPendingBigTwoWheel(null); // Tidak perlu spin lagi saat main lagi
      setIsDealingAnimationActive(true);
      const startPlayer = nextState.players.find((p) => p.id === nextState.currentPlayer);
      if (previousWinnerObj) {
        showToast(`Game baru dimulai! Giliran awal: ${previousWinnerObj.name} (Pemenang sebelumnya) 👑`);
      } else {
        showToast(`Game baru dimulai! Giliran awal: ${startPlayer?.name || 'Pemain'}`);
      }
    } else {
      const count = gameStateBigtwo.players?.length || 4;
      const carriedSessionScores = gameStateBigtwo.sessionScores || {};
      const nextState = initBigTwo({
        playerCount: count,
        deckMode: gameStateBigtwo.config.deckMode,
        startingPlayerId: previousWinnerId,
        sessionScores: carriedSessionScores,
        ...configOverrides,
      });
      setGameStateBigtwo(nextState);
      setPendingBigTwoWheel(null); // Tidak perlu spin lagi saat main lagi
      setIsDealingAnimationActive(true);
      const startPlayer = nextState.players.find((p) => p.id === nextState.currentPlayer);
      if (previousWinnerObj) {
        showToast(`Game baru dimulai! Giliran awal: ${previousWinnerObj.name} (Pemenang sebelumnya) 👑`);
      } else {
        showToast(`Game baru dimulai! Giliran awal: ${startPlayer?.name || 'Pemain'}`);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // BOT AI AUTOMATION (SINGLE PLAYER / HOST DRIVE)
  // ---------------------------------------------------------------------------
  const [botThinking, setBotThinking] = useState(null);

  useEffect(() => {
    const isMultiplayerHost =
      isMultiplayerMode &&
      currentRoom?.host_id === myPlayerId &&
      currentRoom?.status === 'playing';
    const canDriveBots = isSingleMode || isMultiplayerHost || gameMode === 'local';

    if (!canDriveBots) {
      setBotThinking(null);
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
      return;
    }

    if (activeGameType === 'bigtwo') {
      if (gameStateBigtwo?.gameStatus === 'GAME_OVER' || bigTwoWheelPicker?.isOpen) return;
      const currentId = gameStateBigtwo?.currentPlayer;
      if (isBotPlayer(gameStateBigtwo, currentId)) {
        const botObj = gameStateBigtwo?.players?.find((p) => p.id === currentId);
        setBotThinking(
          botObj
            ? {
                ...botObj,
                name: botObj.isBotTakeover ? `${botObj.name} (Bot Takeover)` : botObj.name,
              }
            : null
        );
        botTimerRef.current = setTimeout(() => {
          botTimerRef.current = null;
          const freshState = gameStateBigtwoRef.current;
          if (!isBotPlayer(freshState, freshState?.currentPlayer)) {
            console.log('[Bot AI] Big Two move aborted: player reclaimed control.');
            setBotThinking(null);
            return;
          }
          const move = chooseBigTwoBotMove(freshState, freshState?.currentPlayer);
          setBotThinking(null);
          if (!move || move.action === 'pass') {
            handlePassBigTwo();
          } else if (move.action === 'play' && move.cards?.length > 0) {
            handlePlayBigTwoCombo(move.cards);
          }
        }, 900 + Math.random() * 400);
      } else {
        setBotThinking(null);
      }
    } else if (activeGameType === 'game41') {
      if (gameState41?.gameStatus === 'GAME_OVER' || gameState41?.gameStatus === 'game_over') return;
      const currentId = gameState41?.currentPlayer;
      if (isBotPlayer(gameState41, currentId)) {
        const botObj = gameState41?.players?.find((p) => p.id === currentId);
        setBotThinking(
          botObj
            ? {
                ...botObj,
                name: botObj.isBotTakeover ? `${botObj.name} (Bot Takeover)` : botObj.name,
              }
            : null
        );

        if (gameState41?.turnPhase === 'DRAW') {
          botTimerRef.current = setTimeout(() => {
            botTimerRef.current = null;
            const freshState = gameState41Ref.current;
            if (!isBotPlayer(freshState, freshState?.currentPlayer)) {
              console.log('[Bot AI] Game 41 draw aborted: player reclaimed control.');
              setBotThinking(null);
              return;
            }
            const move = chooseGame41BotMove(freshState, freshState?.currentPlayer);
            handleDrawCard41(move.source);
          }, 850 + Math.random() * 350);
        } else if (gameState41?.turnPhase === 'DISCARD') {
          botTimerRef.current = setTimeout(() => {
            botTimerRef.current = null;
            const freshState = gameState41Ref.current;
            if (!isBotPlayer(freshState, freshState?.currentPlayer)) {
              console.log('[Bot AI] Game 41 discard aborted: player reclaimed control.');
              setBotThinking(null);
              return;
            }
            const move = chooseGame41BotMove(freshState, freshState?.currentPlayer);
            setBotThinking(null);
            if (move?.action === 'closeHand') {
              handleCloseHand41(move.card);
            } else {
              handleDiscardCard41(move.card);
            }
          }, 650 + Math.random() * 300);
        }
      } else {
        setBotThinking(null);
      }
    } else {
      // Sevens
      if (gameState?.gameStatus === GAME_STATUS.GAME_OVER) return;
      const currentId = gameState?.currentPlayer;
      if (isBotPlayer(gameState, currentId)) {
        const botObj = gameState?.players?.find((p) => p.id === currentId);
        setBotThinking(
          botObj
            ? {
                ...botObj,
                name: botObj.isBotTakeover ? `${botObj.name} (Bot Takeover)` : botObj.name,
              }
            : null
        );
        botTimerRef.current = setTimeout(() => {
          botTimerRef.current = null;
          const freshState = gameStateRef.current;
          if (!isBotPlayer(freshState, freshState?.currentPlayer)) {
            console.log('[Bot AI] Sevens move aborted: player reclaimed control.');
            setBotThinking(null);
            return;
          }
          const move = chooseSevensBotMove(freshState, freshState?.currentPlayer);
          setBotThinking(null);
          if (move?.action === 'play') {
            handlePlayCard(move.card, move.direction);
          } else if (move?.action === 'close') {
            handleCloseCard(move.card);
          }
        }, 900 + Math.random() * 400);
      } else {
        setBotThinking(null);
      }
    }

    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
    };
  }, [
    gameMode,
    activeGameType,
    gameState?.currentPlayer,
    gameState?.gameStatus,
    gameState?.turnNumber,
    gameState?.players?.find((p) => p.id === gameState?.currentPlayer)?.isBotTakeover,
    gameState41?.currentPlayer,
    gameState41?.turnPhase,
    gameState41?.gameStatus,
    gameState41?.turnNumber,
    gameState41?.players?.find((p) => p.id === gameState41?.currentPlayer)?.isBotTakeover,
    gameStateBigtwo?.currentPlayer,
    gameStateBigtwo?.gameStatus,
    gameStateBigtwo?.currentTrick,
    gameStateBigtwo?.players?.find((p) => p.id === gameStateBigtwo?.currentPlayer)?.isBotTakeover,
    bigTwoWheelPicker?.isOpen,
    isMultiplayerMode,
    isSingleMode,
    currentRoom?.host_id,
    myPlayerId,
  ]);

  // Find active turn player's name
  const currentTurnPlayer = playersList.find((p) => p.id === (
    activeGameType === 'bigtwo'
      ? gameStateBigtwo.currentPlayer
      : activeGameType === 'game41'
      ? gameState41?.currentPlayer
      : gameState?.currentPlayer
  ));
  const currentTurnPlayerName = currentTurnPlayer?.name || 'Pemain Lain';

  // Automatic Score Recording for Cumulative Scoreboard (Points model)
  useEffect(() => {
    if (activeGameType === 'bigtwo' && gameStateBigtwo.gameStatus === 'GAME_OVER' && gameStateBigtwo.rankings) {
      recordGameEndScore('bigtwo', gameStateBigtwo.rankings, gameStateBigtwo.winner);
    }
  }, [gameStateBigtwo.gameStatus]);

  useEffect(() => {
    if (activeGameType === 'game41' && (gameState41.gameStatus === 'game_over' || gameState41.gameStatus === 'GAME_OVER') && gameState41.rankings) {
      recordGameEndScore('game41', gameState41.rankings, gameState41.winner);
    }
  }, [gameState41.gameStatus]);

  useEffect(() => {
    if (activeGameType === 'sevens' && gameState?.gameStatus === GAME_STATUS.GAME_OVER && gameState?.scores) {
      const rankings = (gameState.players || []).map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: gameState.scores[p.id]?.totalScore ?? 0,
        isWinner: (gameState.winners || []).includes(p.id),
      })).sort((a, b) => b.score - a.score);
      recordGameEndScore('sevens', rankings, gameState.winners?.[0]);
    }
  }, [gameState.gameStatus]);


  // Return to Mode Selection Screen (Home)
  const handleBackToModeSelect = () => {
    const isGameOver =
      (activeGameType === 'bigtwo' && gameStateBigtwo.gameStatus === 'GAME_OVER') ||
      (activeGameType === 'game41' && (gameState41.gameStatus === 'game_over' || gameState41.gameStatus === 'GAME_OVER')) ||
      (activeGameType === 'sevens' && gameState.gameStatus === GAME_STATUS.GAME_OVER);

    if (isMultiplayerMode && currentRoom) {
      if (isGameOver || confirm('Keluar dari room online dan kembali ke menu pemilihan mode?')) {
        handleLeaveRoom();
        if (activeGameType === 'bigtwo') {
          setGameStateBigtwo(initBigTwo({ playerCount: gameStateBigtwo.players?.length || 4 }));
        } else if (activeGameType === 'game41') {
          setGameState41(initGame41({ playerCount: gameState41.players?.length || 4 }));
        } else {
          setGameState(initGame({ playerCount: gameState.players?.length || 4 }));
        }
        setGameMode(null);
      }
    } else {
      if (activeGameType === 'bigtwo') {
        const count = gameStateBigtwo.players?.length || 2;
        setGameStateBigtwo(initBigTwo({ playerCount: count }));
      } else if (activeGameType === 'game41') {
        const count = gameState41.players?.length || 2;
        setGameState41(initGame41({ playerCount: count }));
      } else {
        const count = gameState.players?.length || 4;
        setGameState(initGame({ playerCount: count }));
      }
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
          selectedGame={activeGameType}
          onSelectGame={(game) => setActiveGameType(game)}
          onSelectMode={(mode, playerCount, game, options = {}) => {
            const chosenGame = game || activeGameType;
            setActiveGameType(chosenGame);

            if (mode === 'single') {
              const totalCount = playerCount || (options?.botCount ? options.botCount + 1 : 2);
              const roster = createSinglePlayerRoster(totalCount);

              if (chosenGame === 'bigtwo') {
                const stateBigtwo = initBigTwo({
                  playerCount: totalCount,
                  deckMode: totalCount > 4 ? (options?.deckMode || 'single') : 'single',
                }, roster);
                setGameStateBigtwo(stateBigtwo);
                setPendingBigTwoWheel({
                  isOpen: true,
                  players: stateBigtwo.players,
                  targetPlayerId: stateBigtwo.currentPlayer,
                });
              } else if (chosenGame === 'game41') {
                const state41 = initGame41({ playerCount: totalCount }, roster);
                setGameState41(state41);
                const starterName = state41.players.find((p) => p.id === state41.currentPlayer)?.name || 'Pemain';
                showToast(`Permainan Kartu 41 dimulai! Giliran pertama: ${starterName}`);
              } else {
                const nextCfg = { ...gameConfig, playerCount: totalCount };
                setGameConfig(nextCfg);
                setGameState(initGame(nextCfg, roster));
              }
              setIsDealingAnimationActive(true);
              setGameMode('single');
            } else if (mode === 'local') {
              const count = playerCount || 4;
              if (chosenGame === 'bigtwo') {
                const stateBigtwo = initBigTwo({
                  playerCount: count,
                  deckMode: count > 4 ? (options?.deckMode || 'single') : 'single',
                });
                setGameStateBigtwo(stateBigtwo);
                setPendingBigTwoWheel({
                  isOpen: true,
                  players: stateBigtwo.players,
                  targetPlayerId: stateBigtwo.currentPlayer,
                });
              } else if (chosenGame === 'game41') {
                const state41 = initGame41({ playerCount: count });
                setGameState41(state41);
                const starterName = state41.players.find((p) => p.id === state41.currentPlayer)?.name || 'Pemain';
                showToast(`Permainan Kartu 41 dimulai! Giliran pertama: ${starterName}`);
              } else {
                const nextCfg = { ...gameConfig, playerCount: count };
                setGameConfig(nextCfg);
                setGameState(initGame(nextCfg));
              }
              setIsDealingAnimationActive(true);
              setGameMode('local');
            } else {
              setMultiplayerInitOptions(options);
              setGameMode(mode);
            }
          }}
          onOpenRules={(game) => {
            if (game === 'bigtwo') setShowRulesBigtwoModal(true);
            else if (game === 'game41') setShowRules41Modal(true);
            else setShowRulesModal(true);
          }}
        />

        {/* Rules Guide Modals */}
        {showRulesModal && <RulesGuideModal onClose={() => setShowRulesModal(false)} />}
        {showRules41Modal && <RulesGuide41Modal onClose={() => setShowRules41Modal(false)} />}
        {showRulesBigtwoModal && <RulesGuideBigTwoModal isOpen={showRulesBigtwoModal} onClose={() => setShowRulesBigtwoModal(false)} />}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: MULTIPLAYER LOBBY (When in multiplayer and no room or in lobby)
  // ---------------------------------------------------------------------------
  const isParticipant = Boolean(
    currentRoom && (currentRoom.players || []).some((p) => p.id === myPlayerId)
  );

  const showMultiplayerLobby =
    isMultiplayerMode && (!currentRoom || !isParticipant || currentRoom.status === 'lobby');


  return (
    <div className="app-container">
      {/* Real-time Action Announcement Pop-up (Who played / discarded / passed what) */}
      <ActionAnnouncementPopup
        action={recentActionPopup}
        onDismiss={() => setRecentActionPopup(null)}
      />

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
          <button
            className="brand-title brand-home-btn"
            onClick={handleBackToModeSelect}
            title="Kembali ke Menu Utama / Ganti Game"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit' }}
          >
            <span>{activeGameType === 'bigtwo' ? '💎' : activeGameType === 'game41' ? '🃏' : '♠'}</span>
            <span>{activeGameType === 'bigtwo' ? 'BIG TWO' : activeGameType === 'game41' ? 'REMI 41' : 'SEVENS'}</span>
          </button>

          <span className="brand-tag desktop-only">
            {activeGameType === 'bigtwo'
              ? `Capsa Banting • ${gameStateBigtwo.players?.length || 4} Pemain${(gameStateBigtwo.deckMode === 'double' || gameStateBigtwo.config?.deckMode === 'double') ? ' (Double Deck • 104 Kartu)' : ((gameStateBigtwo.players?.length || 4) > 4 ? ' (Single Deck • 52 Kartu)' : '')}`
              : activeGameType === 'game41'
              ? `Kartu 41 • ${gameState41.players?.length || 4} Pemain`
              : `Tujuh Sekop • ${gameState.players?.length || 4} Pemain`}
          </span>

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
            <>
              {!isHost && !(currentRoom.players || []).some((p) => (p.id === currentRoom.host_id || p.isHost) && !p.isBot) && (
                <button
                  className="btn-header"
                  style={{ borderColor: 'rgba(245, 158, 11, 0.45)', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)' }}
                  onClick={handleClaimHost}
                  title="Ambil alih peran Host karena Host sebelumnya keluar atau tidak aktif"
                >
                  <Crown size={15} />
                  <span>Ambil Alih Host</span>
                </button>
              )}

              {isHost && (
                <button
                  className="btn-header"
                  style={{ borderColor: 'rgba(56, 189, 248, 0.45)', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)' }}
                  onClick={handleResetRoom}
                  title="Reset permainan & skor meja kembali ke lobby"
                >
                  <RotateCcw size={15} />
                  <span>Reset Meja & Skor</span>
                </button>
              )}

              <button
                className="btn-header btn-danger-hover"
                onClick={handleLeaveRoom}
                title="Keluar dari room"
              >
                <LogOut size={15} />
                <span>Keluar Room</span>
              </button>
            </>
          )}

          <button
            className="btn-header"
            onClick={() => {
              if (activeGameType === 'bigtwo') setShowRulesBigtwoModal(true);
              else if (activeGameType === 'game41') setShowRules41Modal(true);
              else setShowRulesModal(true);
            }}
            title="Buku Aturan Permainan"
          >
            <BookOpen size={15} />
            <span>Aturan</span>
          </button>

          {activeGameType === 'sevens' && (!isMultiplayerMode || isHost) && (
            <button
              className="btn-header"
              onClick={() => setShowConfigModal(true)}
              title="Pengaturan Penalti 6 & 8 dan Aturan (Khusus Host)"
            >
              <Settings size={15} />
              <span>Pengaturan {isMultiplayerMode && '(Host)'}</span>
            </button>
          )}

          {activeGameType === 'sevens' && (
            <button
              className="btn-header"
              onClick={() => setShowHistoryModal(true)}
              title="Riwayat Aksi Pertandingan"
            >
              <History size={15} />
              <span>Riwayat</span>
            </button>
          )}

          {/* Cumulative Scoreboard Button */}
          <button
            className="btn-header"
            onClick={() => setShowScoreboardModal(true)}
            title="Lihat Papan Skor (Scoreboard)"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Trophy size={15} color="#eab308" />
            <span>Scoreboard</span>
          </button>

          {/* Dedicated Chat Button in Desktop Header */}
          <button
            className="btn-header"
            onClick={() => setIsChatOpen(true)}
            title="Buka Chat Meja & Quick Emote"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: 'rgba(56, 189, 248, 0.45)',
              color: '#38bdf8',
            }}
          >
            <MessageSquare size={15} />
            <span>Chat</span>
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
              onClick={() => {
                if (activeGameType === 'bigtwo') handleRestartBigTwo();
                else if (activeGameType === 'game41') handleRestart41();
                else handleRestart();
              }}
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

          {/* Mobile Chat Button */}
          <button
            className="btn-icon"
            onClick={() => setIsChatOpen(true)}
            title="Chat & Emote Meja"
            style={{ color: '#38bdf8' }}
          >
            <MessageSquare size={16} />
          </button>

          <button
            className="btn-icon"
            onClick={() => setShowScoreboardModal(true)}
            title="Papan Skor (Scoreboard)"
          >
            <Trophy size={16} color="#eab308" />
          </button>

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
        <ErrorBoundary>
        {/* Dealing & Shuffling Casino Animation Overlay */}
        <ShuffleDealingAnimation
          isActive={isDealingAnimationActive}
          onComplete={() => {
            setIsDealingAnimationActive(false);
            if (pendingBigTwoWheel) {
              setBigTwoWheelPicker(pendingBigTwoWheel);
              setPendingBigTwoWheel(null);
            }
          }}
          playerHand={currentHand}
          seats={seats}
        />

        {/* Floating AI Bot Thinking Pill */}
        {botThinking && (
          <div className="bot-thinking-banner" role="status">
            <span className="bot-thinking-spinner">{botThinking.avatar || '🤖'}</span>
            <span><strong>{botThinking.name}</strong> sedang memilih langkah...</span>
          </div>
        )}

        {activeGameType === 'bigtwo' ? (
          <TableBigTwo
            gameState={gameStateBigtwo}
            myPlayerId={isMultiplayerMode ? myPlayerId : isSingleMode ? SINGLE_HUMAN_ID : gameStateBigtwo?.currentPlayer}
            isMyTurn={isMyTurnBigtwo}
            onPlayCombo={handlePlayBigTwoCombo}
            onPass={handlePassBigTwo}
            isMultiplayer={isMultiplayerMode}
            onOpenRules={() => setShowRulesBigtwoModal(true)}
            onOpenWheel={handleBigTwoRespin}
            onError={showToast}
            onReclaimControl={(playerId) => handleSetBotTakeover(playerId, false)}
            turnDuration={turnElapsed}
          />
        ) : activeGameType === 'game41' ? (
          <Table41
            gameState={gameState41}
            onDrawCard={handleDrawCard41}
            onDiscardCard={handleDiscardCard41}
            onCloseHand={handleCloseHand41}
            isMyTurn={isMyTurn41}
            myPlayerId={isMultiplayerMode ? myPlayerId : isSingleMode ? SINGLE_HUMAN_ID : gameState41.currentPlayer}
            isMultiplayer={isMultiplayerMode}
            onOpenRules={() => setShowRules41Modal(true)}
            onReclaimControl={(playerId) => handleSetBotTakeover(playerId, false)}
            turnDuration={turnElapsed}
          />
        ) : (
          <>
            {/* Felt Poker Table */}
            <div className="poker-table-wrapper">
          <div className="poker-felt">
            <div className="felt-watermark">SEVENS</div>

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
          onReclaimControl={(playerId) => handleSetBotTakeover(playerId, false)}
          turnDuration={turnElapsed}
        />
          </>
        )}
        </ErrorBoundary>
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
          onAddBot={handleAddBotMultiplayer}
          onRemoveBot={handleRemoveBotMultiplayer}
          onUpdateRoomConfig={handleUpdateRoomConfig}
          onSwitchToLocal={() => setGameMode('local')}
          onBackToMenu={handleBackToModeSelect}
          isSupabaseConfigured={isSupabaseConfigured}
          inviteRoomCode={inviteRoomCode}
          activeGameType={activeGameType}
          initialDeckMode={multiplayerInitOptions?.deckMode || 'double'}
          initialPlayerCount={multiplayerInitOptions?.playerCount || 4}
          onClaimHost={handleClaimHost}
          onResetRoom={handleResetRoom}
          onForceResetAndJoin={handleForceResetAndJoin}
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
        gameState={activeGameType === 'bigtwo' ? gameStateBigtwo : activeGameType === 'game41' ? gameState41 : gameState}
        showOpponents={showOpponents}
        onToggleShowOpponents={handleToggleShowOpponents}
        boardLayout={boardLayout}
        onToggleBoardLayout={handleToggleBoardLayout}
        onOpenRules={() => {
          if (activeGameType === 'bigtwo') setShowRulesBigtwoModal(true);
          else if (activeGameType === 'game41') setShowRules41Modal(true);
          else setShowRulesModal(true);
        }}
        onOpenConfig={() => setShowConfigModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenScoreboard={() => setShowScoreboardModal(true)}
        onOpenChat={() => setIsChatOpen(true)}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        onRestart={() => {
          if (activeGameType === 'bigtwo') handleRestartBigTwo();
          else if (activeGameType === 'game41') handleRestart41();
          else handleRestart();
        }}
        isHost={isHost}
        onClaimHost={handleClaimHost}
        onResetRoom={handleResetRoom}
        onLeaveRoom={handleLeaveRoom}
        onBackToMenu={handleBackToModeSelect}
        activeGameType={activeGameType}
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

      {/* Sevens Game Over Modal */}
      {activeGameType === 'sevens' && gameState?.gameStatus === GAME_STATUS.GAME_OVER && (
        <GameOverModal
          gameState={gameState}
          onRestart={() => handleRestart()}
          onBackToMenu={handleBackToModeSelect}
          onOpenScoreboard={() => setShowScoreboardModal(true)}
          isMultiplayer={isMultiplayerMode}
          isHost={isHost}
        />
      )}

      {/* Game 41 Game Over Modal */}
      {activeGameType === 'game41' && (gameState41?.gameStatus === 'game_over' || gameState41?.gameStatus === 'GAME_OVER') && (
        <GameOver41Modal
          gameState={gameState41}
          onRestart={handleRestart41}
          onPlayAgain={handleRestart41}
          onBackToMenu={handleBackToModeSelect}
          onOpenScoreboard={() => setShowScoreboardModal(true)}
          isMultiplayer={isMultiplayerMode}
          isHost={isHost}
        />
      )}

      {/* Big Two Game Over Modal */}
      {activeGameType === 'bigtwo' && gameStateBigtwo?.gameStatus === 'GAME_OVER' && (
        <GameOverBigTwoModal
          gameState={gameStateBigtwo}
          onRestart={handleRestartBigTwo}
          onPlayAgain={handleRestartBigTwo}
          onBackToMenu={handleBackToModeSelect}
          onOpenScoreboard={() => setShowScoreboardModal(true)}
          isMultiplayer={isMultiplayerMode}
          isHost={isHost}
          currentRoomCode={isMultiplayerMode ? currentRoom?.code : null}
        />
      )}

      {/* Cumulative Scoreboard Modal (Points Model) */}
      <ScoreboardModal
        isOpen={showScoreboardModal}
        onClose={() => setShowScoreboardModal(false)}
        scoreboardData={getCurrentScoreboardList()}
        onResetScoreboard={() => handleResetScoreboard(activeGameType)}
        activeGameTitle={getCurrentScoreboardTitle()}
      />

      {/* Rules Guide Modals */}
      {showRulesModal && <RulesGuideModal onClose={() => setShowRulesModal(false)} />}
      {showRules41Modal && <RulesGuide41Modal onClose={() => setShowRules41Modal(false)} />}
      {showRulesBigtwoModal && (
        <RulesGuideBigTwoModal
          isOpen={showRulesBigtwoModal}
          onClose={() => setShowRulesBigtwoModal(false)}
        />
      )}

      {/* Big Two First Turn Picker Wheel Modal */}
      {bigTwoWheelPicker?.isOpen && (
        <BigTwoFirstTurnWheel
          isOpen={bigTwoWheelPicker.isOpen}
          players={bigTwoWheelPicker.players || gameStateBigtwo.players}
          targetPlayerId={bigTwoWheelPicker.targetPlayerId}
          onComplete={handleBigTwoWheelComplete}
          onClose={() => setBigTwoWheelPicker(null)}
          onRespin={handleBigTwoRespin}
        />
      )}

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

      {/* LIVE CHAT & EPHEMERAL POPUPS OVERLAY (Online & Offline Tables) */}
      {gameMode && (
        <LiveChatOverlay
          roomCode={currentRoom?.code || 'OFFLINE'}
          myPlayerId={myPlayerId || 'local_human'}
          myPlayerName={
            (currentRoom?.players || []).find((p) => p.id === myPlayerId)?.name ||
            getLocalPlayerName() ||
            'Anda'
          }
          myAvatar={
            (currentRoom?.players || []).find((p) => p.id === myPlayerId)?.avatar ||
            '👤'
          }
          activeMessages={activeChatMessages}
          onSendMessage={handleSendChatMessage}
          isOpen={isChatOpen}
          onToggleOpen={setIsChatOpen}
        />
      )}
    </div>
  );
}
