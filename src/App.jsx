import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  shouldApplyIncomingGameState,
  getRelativeSeats,
  getActiveSession,
  setLocalSession,
  clearLocalSession,
  getLocalPlayerId,
  getLocalPlayerName,
  getLocalPlayerAvatar,
  getGameTypeFromRoomCode,
  extractCleanRoomCode,
  MATCHMAKING_MIN_PLAYERS,
} from './services/multiplayerAdapter.js';
import { isSupabaseConfigured } from './services/supabaseClient.js';
import { recordMultiplayerGameStats } from './services/leaderboardService.js';
import { syncLobbyChatHistory } from './services/lobbyChatService.js';

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
import LiveChatOverlay from './components/LiveChatOverlay.jsx';
import FloatingReactionsOverlay from './components/FloatingReactionsOverlay.jsx';
import UnifiedSocialDock from './components/UnifiedSocialDock.jsx';
import SoundboardModal from './components/SoundboardModal.jsx';
import SoundboardNotification from './components/SoundboardNotification.jsx';
import { voiceChat } from './services/voiceChatService.js';

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
  Smile,
  Mic,
  MicOff,
  Radio,
} from 'lucide-react';

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDealingAnimationActive, setIsDealingAnimationActive] = useState(false);
  const [multiplayerInitOptions, setMultiplayerInitOptions] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeReactions, setActiveReactions] = useState([]);
  const [isReactionOpen, setIsReactionOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
  const [isSoundboardPlaying, setIsSoundboardPlaying] = useState(false);
  const [activeSoundboardToasts, setActiveSoundboardToasts] = useState([]);
  const seenSocialEventIdsRef = useRef(new Set());

  // Sinkronkan riwayat chat global, ajakan mabar, & DM dengan server saat aplikasi dimuat
  useEffect(() => {
    const savedName = getLocalPlayerName() || '';
    syncLobbyChatHistory(savedName).catch(() => {});
  }, []);

  // Live Voice Chat State
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('poker_voice_onmic') !== 'true';
    }
    return true;
  });
  const [speakingPlayers, setSpeakingPlayers] = useState(new Set());
  const [voiceVolume, setVoiceVolume] = useState(() => voiceChat.getVoiceVolume());

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
      return r ? extractCleanRoomCode(r) : null;
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
      const rawRoom = urlParams?.get('room');
      const urlRoom = rawRoom ? extractCleanRoomCode(rawRoom) : null;
      const session = getActiveSession();

      // If user opened an invite link (?room=...) that doesn't match an active room session,
      // clear the stale previous session so they don't get trapped in the old game!
      if (urlRoom && session.roomCode && session.roomCode !== urlRoom) {
        clearLocalSession();
        return null;
      }

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
  const isHost =
    isMultiplayerMode &&
    (currentRoom?.host_id === myPlayerId ||
      Boolean((currentRoom?.players || []).find((p) => p.id === myPlayerId)?.isHost));

  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeChatMessages, setActiveChatMessages] = useState([]);
  const [roomChatHistory, setRoomChatHistory] = useState([]);
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
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const rawRoom = urlParams?.get('room');
      const urlRoom = rawRoom ? extractCleanRoomCode(rawRoom) : null;
      const urlGame = urlParams?.get('game')?.toLowerCase();

      // Priority 1: Game explicitly declared in URL or detected from room code prefix (B2- / R41- / SV-)
      const detectedFromUrl = urlGame || (urlRoom ? getGameTypeFromRoomCode(urlRoom) : null);
      if (detectedFromUrl) {
        localStorage.setItem('sevens_active_game_type', detectedFromUrl);
        return detectedFromUrl;
      }

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
  const completedWheelKeyRef = useRef(null);

  useEffect(() => {
    if (pendingBigTwoWheel && !isDealingAnimationActive) {
      setBigTwoWheelPicker(pendingBigTwoWheel);
      setPendingBigTwoWheel(null);
    }
  }, [pendingBigTwoWheel, isDealingAnimationActive]);

  // AFK & Turn Timer tracking state
  const [turnElapsed, setTurnElapsed] = useState(0);
  const turnStartTimeRef = useRef(Date.now());
  const prevTurnPlayerIdRef = useRef(null);
  const afkTriggeredTurnRef = useRef(new Set());
  const botTimerRef = useRef(null);

  const gameStateRef = useRef(gameState);
  const gameState41Ref = useRef(gameState41);
  const gameStateBigtwoRef = useRef(gameStateBigtwo);
  const currentRoomRef = useRef(currentRoom);
  const isHostRef = useRef(isHost);
  const activeGameTypeRef = useRef(activeGameType);
  const myPlayerIdRef = useRef(myPlayerId);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    gameState41Ref.current = gameState41;
  }, [gameState41]);
  useEffect(() => {
    gameStateBigtwoRef.current = gameStateBigtwo;
  }, [gameStateBigtwo]);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);
  useEffect(() => {
    activeGameTypeRef.current = activeGameType;
  }, [activeGameType]);
  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);


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
  const [globalScoreboardCategory, setGlobalScoreboardCategory] = useState('all');
  const [directChatPartner, setDirectChatPartner] = useState(null);

  // Real-time Action Announcement Pop-up State
  const [recentActionPopup, setRecentActionPopup] = useState(null);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sevens_active_game_type', activeGameType);
    }
  }, [activeGameType]);

  // Synchronize game_state inside cached room when it changes (when game is playing or game_over)
  useEffect(() => {
    if (
      typeof localStorage !== 'undefined' &&
      currentRoom?.code &&
      (currentRoom?.status === 'playing' || currentRoom?.status === 'game_over')
    ) {
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
    const rawInvite = urlParams?.get('room');
    const inviteParam = rawInvite ? extractCleanRoomCode(rawInvite) : null;
    const urlGame = urlParams?.get('game')?.toLowerCase();
    const currentMyId = session.playerId || getLocalPlayerId();

    // If user opened an invite link for a different room, clear old stale session immediately
    if (inviteParam && session.roomCode && extractCleanRoomCode(session.roomCode) !== inviteParam) {
      clearLocalSession();
    }

    // Determine target room code
    const targetRoomCode = inviteParam || session.roomCode;

    // Detect game type from room code prefix or URL query param
    const detectedGame = urlGame || (targetRoomCode ? getGameTypeFromRoomCode(targetRoomCode) : null);
    if (detectedGame) {
      setActiveGameType(detectedGame);
    }

    if (targetRoomCode && isSupabaseConfigured) {
      multiplayerAdapter.getRoom(targetRoomCode).then(({ room, error }) => {
        setIsReconnecting(false);
        if (room && !error) {
          const roomGameType =
            room.game_state?.gameType ||
            getGameTypeFromRoomCode(room.code) ||
            urlGame ||
            room.config?.gameType ||
            'sevens';
          setActiveGameType(roomGameType);

          const localName = (session.playerName || getLocalPlayerName() || '').trim().toLowerCase();
          const roomPlayersList =
            Array.isArray(room.players) && room.players.length > 0
              ? room.players
              : room.game_state?.players || [];

          // Check if viewer is ALREADY a participant in this room (by ID OR by saved player Name)
          const matchedPlayer = roomPlayersList.find(
            (p) =>
              p.id === currentMyId ||
              p.id === session.playerId ||
              p.id === myPlayerId ||
              (localName && !p.isBot && (p.name || '').trim().toLowerCase() === localName)
          );

          if (matchedPlayer) {
            if (!Array.isArray(room.players) || room.players.length === 0) {
              room.players = roomPlayersList;
            }
            // Already registered in room: reconnect seamlessly
            const localAvatar = getLocalPlayerAvatar();
            if (localAvatar && matchedPlayer.avatar !== localAvatar && !matchedPlayer.isBot) {
              matchedPlayer.avatar = localAvatar;
              if (Array.isArray(room.players)) {
                room.players = room.players.map((p) => (p.id === matchedPlayer.id ? { ...p, avatar: localAvatar } : p));
              }
              // Only sync emoji avatars to DB; keep Base64 photos cached locally
              if (!String(localAvatar).startsWith('data:image/')) {
                multiplayerAdapter.syncPlayerAvatarInRoom(room.code, matchedPlayer.id, localAvatar).catch(() => {});
              }
            }
            currentRoomRef.current = room;
            setCurrentRoom((prevRoom) => {
              if (!prevRoom || prevRoom.code !== room.code) return room;
              const bestGameState =
                room.status === 'lobby'
                  ? room.game_state
                  : shouldApplyIncomingGameState(prevRoom.game_state, room.game_state)
                  ? room.game_state
                  : prevRoom.game_state || room.game_state;
              return { ...prevRoom, ...room, game_state: bestGameState };
            });
            setGameMode('multiplayer');
            myPlayerIdRef.current = matchedPlayer.id;
            setMyPlayerId(matchedPlayer.id);
            setLocalSession(matchedPlayer.id, matchedPlayer.name, room.code);
            if (room.status === 'lobby') {
              setGameStateBigtwo({});
              setGameState41({});
            } else if (room.game_state?.players) {
              if (roomGameType === 'bigtwo') {
                setGameStateBigtwo((prev) => {
                  const next = shouldApplyIncomingGameState(prev, room.game_state) ? room.game_state : prev;
                  gameStateBigtwoRef.current = next;
                  return next;
                });
              } else if (roomGameType === 'game41') {
                setGameState41((prev) => {
                  const next = shouldApplyIncomingGameState(prev, room.game_state) ? room.game_state : prev;
                  gameState41Ref.current = next;
                  return next;
                });
              } else {
                setGameState((prev) => {
                  const next = shouldApplyIncomingGameState(prev, room.game_state) ? room.game_state : prev;
                  gameStateRef.current = next;
                  return next;
                });
              }
            }
            showToast(`Terhubung kembali ke Room ${room.code}`);
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
        let changed = false;
        if (url.searchParams.get('room') !== currentRoom.code) {
          url.searchParams.set('room', currentRoom.code);
          changed = true;
        }
        if (activeGameType && url.searchParams.get('game') !== activeGameType) {
          url.searchParams.set('game', activeGameType);
          changed = true;
        }
        if (changed) {
          window.history.replaceState(null, '', url.toString());
        }
      } else if (!inviteRoomCode) {
        let changed = false;
        if (url.searchParams.has('room') && !currentRoom?.code) {
          url.searchParams.delete('room');
          changed = true;
        }
        if (url.searchParams.has('game') && !currentRoom?.code) {
          url.searchParams.delete('game');
          changed = true;
        }
        if (changed) {
          window.history.replaceState(null, '', url.pathname);
        }
      }
    } catch {}
  }, [isMultiplayerMode, currentRoom?.code, activeGameType, inviteRoomCode]);

  // Auto-resync when returning to tab or network comes back online (throttled to avoid spam)
  const lastVisibilitySyncRef = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSyncOnVisible = () => {
      if (document.visibilityState === 'visible' && isMultiplayerMode && currentRoom?.code && isSupabaseConfigured) {
        const now = Date.now();
        if (now - lastVisibilitySyncRef.current < 15000) return;
        lastVisibilitySyncRef.current = now;

        // Recover voice chat connection & mic stream if dropped during background
        try {
          voiceChat.resumeFromBackground();
        } catch (e) {}

        multiplayerAdapter.getRoom(currentRoom.code).then(({ room, error }) => {
          if (room && !error) {
            setCurrentRoom((prevRoom) => {
              if (!prevRoom || prevRoom.code !== room.code) return room;
              const bestGameState =
                room.status === 'lobby'
                  ? room.game_state
                  : shouldApplyIncomingGameState(prevRoom.game_state, room.game_state)
                  ? room.game_state
                  : prevRoom.game_state || room.game_state;
              return { ...prevRoom, ...room, game_state: bestGameState };
            });
            if (room.status === 'lobby') {
              setGameStateBigtwo({});
              setGameState41({});
              return;
            }
            if (room.game_state?.players) {
              const incomingType =
                room.game_state.gameType || getGameTypeFromRoomCode(room.code) || activeGameTypeRef.current;
              if (incomingType === 'bigtwo') {
                setGameStateBigtwo((prev) => {
                  const next = shouldApplyIncomingGameState(prev, room.game_state) ? room.game_state : prev;
                  gameStateBigtwoRef.current = next;
                  return next;
                });
              } else if (incomingType === 'game41') {
                setGameState41((prev) => {
                  const next = shouldApplyIncomingGameState(prev, room.game_state) ? room.game_state : prev;
                  gameState41Ref.current = next;
                  return next;
                });
              } else {
                setGameState((prev) => {
                  const next = shouldApplyIncomingGameState(prev, room.game_state) ? room.game_state : prev;
                  gameStateRef.current = next;
                  return next;
                });
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

  const markSocialEventSeen = (eventId) => {
    if (!eventId) return false;
    const seen = seenSocialEventIdsRef.current;
    if (seen.has(eventId)) return true;
    seen.add(eventId);
    if (seen.size > 250) {
      const oldest = seen.values().next().value;
      if (oldest) seen.delete(oldest);
    }
    return false;
  };

  // ---------------------------------------------------------------------------
  // LIVE CHAT HANDLERS (Ephemeral popups & broadcast)
  // ---------------------------------------------------------------------------
  const handleIncomingChatMessage = (chat) => {
    if (!chat || !chat.message) return;
    const msgId = chat.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (markSocialEventSeen(msgId)) return;

    audio.playChatPopSound();
    const resolvedAvatar = (chat.senderAvatar && !chat.senderAvatar.startsWith('data:image/'))
      ? (getCachedPlayerAvatar(chat.senderName) || getCachedPlayerAvatar(chat.senderId) || chat.senderAvatar)
      : (chat.senderAvatar || '👤');

    const newChat = {
      ...chat,
      senderAvatar: resolvedAvatar,
      id: msgId,
      timestamp: chat.timestamp || Date.now(),
    };

    setRoomChatHistory((prev) => [...prev.slice(-49), newChat]);
    setActiveChatMessages((prev) => [...prev.slice(-3), newChat]);

    // Auto-dismiss after 8.5 seconds (agar nyaman dan leluasa dibaca)
    setTimeout(() => {
      setActiveChatMessages((prev) =>
        prev.map((m) => (m.id === newChat.id ? { ...m, isFading: true } : m))
      );
      setTimeout(() => {
        setActiveChatMessages((prev) => prev.filter((m) => m.id !== newChat.id));
      }, 500);
    }, 8500);
  };

  const handleSendChatMessage = async (text) => {
    if (!text || !text.trim()) return;

    const room = currentRoomRef.current || currentRoom;
    let senderName = getLocalPlayerName() || 'Anda';
    let senderAvatar = '👤';
    let senderId = myPlayerId || 'local_human';

    if (isMultiplayerMode && room?.players) {
      const myPlayer = (room.players || []).find((p) => p.id === myPlayerId);
      if (myPlayer) {
        senderName = myPlayer.name || senderName;
        senderAvatar = myPlayer.avatar || senderAvatar;
      }
    }

    const msgId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const chatPayload = {
      id: msgId,
      senderId,
      senderName,
      senderAvatar: (typeof senderAvatar === 'string' && senderAvatar.startsWith('data:image/')) ? '👤' : senderAvatar,
      message: text.trim(),
      timestamp: Date.now(),
    };

    // Optimistic local display
    handleIncomingChatMessage({ ...chatPayload, senderAvatar });

    // Broadcast to other players in room (if online)
    if (isMultiplayerMode && room?.code) {
      const res = await multiplayerAdapter.sendRoomChat(room.code, chatPayload);
      if (res && res.success === false) {
        showToast('Gagal mengirim chat ke meja. Periksa koneksi.');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // GOOGLE MEET FLOATING REACTIONS HANDLERS
  // ---------------------------------------------------------------------------
  const handleIncomingReaction = (reaction) => {
    if (!reaction || !reaction.emoji) return;
    const reactId = reaction.id || `react_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (markSocialEventSeen(reactId)) return;

    audio.playReactionSound();
    const resolvedAvatar = (reaction.senderAvatar && !reaction.senderAvatar.startsWith('data:image/'))
      ? (getCachedPlayerAvatar(reaction.senderName) || getCachedPlayerAvatar(reaction.senderId) || reaction.senderAvatar)
      : (reaction.senderAvatar || '👤');

    const newReact = {
      ...reaction,
      senderAvatar: resolvedAvatar,
      id: reactId,
      startX: reaction.startX || (40 + (Math.random() - 0.5) * 35),
      driftX: (Math.random() - 0.5) * 70,
      scale: 0.95 + Math.random() * 0.35,
      duration: 2.6 + Math.random() * 0.7,
    };
    setActiveReactions((prev) => [...prev.slice(-30), newReact]);
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== newReact.id));
    }, 3400);
  };

  const handleSendReaction = async (emoji, startX) => {
    if (!emoji) return;
    const room = currentRoomRef.current || currentRoom;
    let senderName = getLocalPlayerName() || 'Anda';
    let senderAvatar = '👤';
    let senderId = myPlayerId || 'local_human';
    if (isMultiplayerMode && room?.players) {
      const myPlayer = (room.players || []).find((p) => p.id === myPlayerId);
      if (myPlayer) {
        senderName = myPlayer.name || senderName;
        senderAvatar = myPlayer.avatar || senderAvatar;
      }
    }
    const reactId = `react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      id: reactId,
      senderId,
      senderName,
      senderAvatar: (typeof senderAvatar === 'string' && senderAvatar.startsWith('data:image/')) ? '👤' : senderAvatar,
      emoji,
      startX: startX || (40 + (Math.random() - 0.5) * 30),
      timestamp: Date.now(),
    };
    handleIncomingReaction({ ...payload, senderAvatar });
    if (isMultiplayerMode && room?.code) {
      const res = await multiplayerAdapter.sendRoomReaction(room.code, payload);
      if (res && res.success === false) {
        showToast('Gagal mengirim emot ke meja. Periksa koneksi.');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // SOUNDBOARD SFX & REALTIME BROADCAST
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = audio.subscribeSoundboard(({ isPlaying }) => {
      setIsSoundboardPlaying(isPlaying);
    });
    return () => unsubscribe();
  }, []);

  const handleIncomingSoundboard = useCallback((soundData) => {
    if (!soundData || !soundData.soundFile) return;

    // Play sound effect through audioService (respects isMuted toggle)
    audio.playSoundboard(soundData.soundFile);

    const resolvedAvatar = (soundData.senderAvatar && !soundData.senderAvatar.startsWith('data:image/'))
      ? (getCachedPlayerAvatar(soundData.senderName) || getCachedPlayerAvatar(soundData.senderId) || soundData.senderAvatar)
      : (soundData.senderAvatar || '👤');

    // Show floating toast badge
    const newToast = {
      ...soundData,
      senderAvatar: resolvedAvatar,
      id: soundData.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setActiveSoundboardToasts((prev) => [...prev.slice(-3), newToast]);
    setTimeout(() => {
      setActiveSoundboardToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 3500);
  }, []);

  const handlePlaySoundboard = useCallback(async (track) => {
    if (!track) return;
    let senderName = getLocalPlayerName() || 'Anda';
    let senderAvatar = '👤';
    let senderId = myPlayerId || 'local_human';
    const activeRoom = currentRoomRef.current;
    if (isMultiplayerMode && activeRoom?.players) {
      const myPlayer = (activeRoom.players || []).find((p) => p.id === myPlayerId);
      if (myPlayer) {
        senderName = myPlayer.name || senderName;
        senderAvatar = myPlayer.avatar || senderAvatar;
      }
    }
    const payload = {
      senderId,
      senderName,
      senderAvatar: (typeof senderAvatar === 'string' && senderAvatar.startsWith('data:image/')) ? '👤' : senderAvatar,
      soundId: track.id,
      soundTitle: track.title,
      soundFile: track.file,
      soundIcon: track.icon,
      timestamp: Date.now(),
    };
    handleIncomingSoundboard({ ...payload, senderAvatar });
    if (isMultiplayerMode && currentRoom?.code) {
      await multiplayerAdapter.sendRoomSoundboard(currentRoom.code, payload);
    }
  }, [isMultiplayerMode, currentRoom?.code, myPlayerId, handleIncomingSoundboard]);

  // ---------------------------------------------------------------------------
  // LIVE VOICE CHAT (WebRTC P2P) HANDLERS & PERSISTENCE
  // ---------------------------------------------------------------------------
  const startVoiceChat = useCallback(async (roomCode = null, playerId = null, isAuto = false) => {
    const targetRoomCode = roomCode || currentRoom?.code;
    const targetPlayerId = playerId || myPlayerId;
    if (!targetRoomCode || !targetPlayerId) return false;

    const myName =
      (currentRoomRef.current?.players || []).find((p) => p.id === targetPlayerId)?.name ||
      getLocalPlayerName() ||
      'Player';

    const success = await voiceChat.joinRoom(targetRoomCode, targetPlayerId, myName, {
      onSpeakingChange: (pId, speaking) => {
        setSpeakingPlayers((prev) => {
          const next = new Set(prev);
          if (speaking) next.add(pId);
          else next.delete(pId);
          return next;
        });
      },
      onStatusChange: (status) => {
        setIsVoiceConnected(status.isConnected);
        setIsVoiceMuted(status.isMuted);
        if (status.isConnected && !status.isMuted) {
          try {
            localStorage.setItem('poker_voice_onmic', 'true');
          } catch (e) {}
        }
        if (status.error && !isAuto) showToast(status.error);
      },
      onPeerConnect: () => {
        showToast('Live Voice terhubung dengan pemain! 🎙️🔊');
      },
    });

    if (success) {
      try {
        localStorage.setItem('poker_voice_onmic', 'true');
      } catch (e) {}
      if (!isAuto) {
        showToast('Mikrofon aktif (Onmic) 🎙️');
      }
    }
    return success;
  }, [currentRoom?.code, myPlayerId]);

  const handleToggleVoice = async () => {
    if (!isVoiceConnected) {
      if (!isMultiplayerMode || !currentRoom?.code) {
        showToast('Voice Chat aktif di Room Multiplayer Online');
        return;
      }
      await startVoiceChat();
    } else {
      const nextMute = voiceChat.toggleMute();
      setIsVoiceMuted(nextMute);
      try {
        localStorage.setItem('poker_voice_onmic', nextMute ? 'false' : 'true');
      } catch (e) {}
      showToast(nextMute ? 'Mikrofon dimatikan (Muted)' : 'Mikrofon aktif (Onmic) 🎙️');
    }
  };

  // Auto-reconnect voice upon refresh / mount if user was previously Onmic
  useEffect(() => {
    if (!isMultiplayerMode || !currentRoom?.code || !myPlayerId) return;
    if (isVoiceConnected) return;

    let wasOnMic = false;
    try {
      wasOnMic = localStorage.getItem('poker_voice_onmic') === 'true';
    } catch (e) {}

    if (wasOnMic) {
      startVoiceChat(currentRoom.code, myPlayerId, true);
    }
  }, [isMultiplayerMode, currentRoom?.code, myPlayerId, isVoiceConnected, startVoiceChat]);

  const handleIncomingVoiceSignal = (signal) => {
    if (!signal) return;
    voiceChat.handleIncomingSignal(signal);
  };

  // ---------------------------------------------------------------------------
  // 2. SUPABASE REALTIME SUBSCRIPTION & DELTA HANDLING
  // ---------------------------------------------------------------------------
  const handleIncomingGameActionDelta = useCallback((delta) => {
    if (!delta || !delta.type) return;

    const myId = myPlayerIdRef.current;
    const roomCode = currentRoomRef.current?.code;

    // Ignore echoes of actions initiated by this client
    if (delta.actorClientId && delta.actorClientId === myId) return;

    const isDeltaOutdatedOrSkipped = (currentState) => {
      if (delta.matchId && currentState.matchId && delta.matchId !== currentState.matchId) {
        return 'ignore';
      }
      if (delta.stateVersion && currentState.stateVersion) {
        const curV = Number(currentState.stateVersion);
        const delV = Number(delta.stateVersion);
        if (delV <= curV) return 'ignore';
        if (delV > curV + 1) return 'resync';
      }
      return 'apply';
    };

    if (delta.gameType === 'bigtwo' || delta.type === 'PLAY_COMBO' || delta.type === 'PASS_TURN') {
      const currentState = gameStateBigtwoRef.current;
      if (!currentState || !currentState.players) return;

      const check = isDeltaOutdatedOrSkipped(currentState);
      if (check === 'ignore') return;
      if (check === 'resync') {
        if (roomCode) multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        return;
      }

      if (delta.type === 'PLAY_COMBO') {
        const res = playComboBigTwo(currentState, delta.playerId, delta.cards);
        if (res.success) {
          gameStateBigtwoRef.current = res.gameState;
          setGameStateBigtwo(res.gameState);
          setPendingBigTwoWheel(null);
          if (res.gameState.lastAction) {
            setRecentActionPopup(res.gameState.lastAction);
          }
          audio.playCardSound();
          if (res.gameState.gameStatus === 'GAME_OVER') {
            audio.victorySound();
          }
        } else if (roomCode) {
          multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        }
      } else if (delta.type === 'PASS_TURN') {
        const res = passTurnBigTwo(currentState, delta.playerId);
        if (res.success) {
          gameStateBigtwoRef.current = res.gameState;
          setGameStateBigtwo(res.gameState);
          setPendingBigTwoWheel(null);
          if (res.gameState.lastAction) {
            setRecentActionPopup(res.gameState.lastAction);
          }
          audio.closeCardSound();
        } else if (roomCode) {
          multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        }
      }
    } else if (delta.gameType === 'game41' || delta.type === 'DRAW_41' || delta.type === 'DISCARD_41' || delta.type === 'CLOSE_HAND_41') {
      const currentState = gameState41Ref.current;
      if (!currentState || !currentState.players) return;

      const check = isDeltaOutdatedOrSkipped(currentState);
      if (check === 'ignore') return;
      if (check === 'resync') {
        if (roomCode) multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        return;
      }

      if (delta.type === 'DRAW_41') {
        const res = drawCard41(currentState, delta.playerId, delta.source);
        if (res.success) {
          gameState41Ref.current = res.state;
          setGameState41(res.state);
          setPendingBigTwoWheel(null);
          audio.playCardSound();
        } else if (roomCode) {
          multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        }
      } else if (delta.type === 'DISCARD_41') {
        const res = discardCard41(currentState, delta.playerId, delta.card);
        if (res.success) {
          gameState41Ref.current = res.state;
          setGameState41(res.state);
          setPendingBigTwoWheel(null);
          const actorName = currentState.players.find((p) => p.id === delta.playerId)?.name || 'Pemain';
          const actorAvatar = currentState.players.find((p) => p.id === delta.playerId)?.avatar || '🃏';
          setRecentActionPopup({
            type: 'DISCARD',
            playerId: delta.playerId,
            playerName: actorName,
            avatar: actorAvatar,
            card: delta.card,
            message: `${actorName} membuang ${delta.card.label}${delta.card.symbol}`,
          });
          if (res.is41) audio.victorySound();
          else audio.closeCardSound();
        } else if (roomCode) {
          multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        }
      } else if (delta.type === 'CLOSE_HAND_41') {
        const res = closeHand41(currentState, delta.playerId, delta.card);
        if (res.success) {
          gameState41Ref.current = res.state;
          setGameState41(res.state);
          setPendingBigTwoWheel(null);
          const actorName = currentState.players.find((p) => p.id === delta.playerId)?.name || 'Pemain';
          const actorAvatar = currentState.players.find((p) => p.id === delta.playerId)?.avatar || '🃏';
          setRecentActionPopup({
            type: 'CLOSE_HAND',
            playerId: delta.playerId,
            playerName: actorName,
            avatar: actorAvatar,
            card: delta.card,
            message: `${actorName} MENUTUP KARTU!`,
          });
          if (res.isBusted) audio.closeCardSound?.();
          else audio.victorySound?.();
        } else if (roomCode) {
          multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        }
      }
    } else {
      // Sevens
      const currentState = gameStateRef.current;
      if (!currentState || !currentState.players) return;

      const check = isDeltaOutdatedOrSkipped(currentState);
      if (check === 'ignore') return;
      if (check === 'resync') {
        if (roomCode) multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        return;
      }

      if (delta.type === 'PLAY_CARD') {
        const res = enginePlayCard(currentState, delta.playerId, delta.card, delta.chosenDirection);
        if (res.success) {
          gameStateRef.current = res.state;
          setGameState(res.state);
          setPendingBigTwoWheel(null);
          const actorName = currentState.players.find((p) => p.id === delta.playerId)?.name || 'Pemain';
          const actorAvatar = currentState.players.find((p) => p.id === delta.playerId)?.avatar || '♠';
          setRecentActionPopup({
            type: 'PLAY',
            playerId: delta.playerId,
            playerName: actorName,
            avatar: actorAvatar,
            card: delta.card,
            message: `${actorName} memainkan ${delta.card.label}${delta.card.symbol}`,
          });
          if (delta.card.rank === 7) audio.sevenChime();
          else audio.playCardSound();
        } else if (roomCode) {
          multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        }
      } else if (delta.type === 'CLOSE_CARD') {
        const res = engineCloseCard(currentState, delta.playerId, delta.card);
        if (res.success) {
          gameStateRef.current = res.state;
          setGameState(res.state);
          setPendingBigTwoWheel(null);
          const actorName = currentState.players.find((p) => p.id === delta.playerId)?.name || 'Pemain';
          const actorAvatar = currentState.players.find((p) => p.id === delta.playerId)?.avatar || '🔒';
          setRecentActionPopup({
            type: 'PASS',
            playerId: delta.playerId,
            playerName: actorName,
            avatar: actorAvatar,
            card: delta.card,
            message: `${actorName} menutup kartu ${delta.card.label}${delta.card.symbol}`,
          });
          audio.closeCardSound();
        } else if (res.fault) {
          gameStateRef.current = res.state;
          setGameState(res.state);
          audio.faultSound();
        } else if (roomCode) {
          multiplayerAdapter.requestRoomStateSync(roomCode, myId);
        }
      }
    }
  }, []);

  const handleRequestStateSync = useCallback((req) => {
    const room = currentRoomRef.current;
    if (!req || !isHostRef.current || !room?.code) return;
    const activeType = activeGameTypeRef.current;
    const activeState =
      activeType === 'bigtwo'
        ? gameStateBigtwoRef.current
        : activeType === 'game41'
        ? gameState41Ref.current
        : gameStateRef.current;

    if (activeState && activeState.players) {
      multiplayerAdapter.broadcastRoomState(room.code, {
        ...room,
        game_state: activeState,
        updated_at: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    if (gameMode !== 'multiplayer' || !currentRoom?.code) return;

    const unsubscribe = multiplayerAdapter.subscribeToRoom(
      currentRoom.code,
      (updatedRoom) => {
        setCurrentRoom((prevRoom) => {
          if (!prevRoom || prevRoom.code !== updatedRoom.code) return updatedRoom;
          const bestGameState =
            updatedRoom.status === 'lobby'
              ? updatedRoom.game_state
              : shouldApplyIncomingGameState(prevRoom.game_state, updatedRoom.game_state)
              ? updatedRoom.game_state
              : prevRoom.game_state || updatedRoom.game_state;
          const merged = {
            ...prevRoom,
            ...updatedRoom,
            players: updatedRoom.players || prevRoom.players,
            game_state: bestGameState,
          };
          currentRoomRef.current = merged;
          return merged;
        });

        if (updatedRoom.status === 'lobby') {
          // Reset local in-game state when returning to lobby
          gameStateBigtwoRef.current = {};
          gameState41Ref.current = {};
          setGameStateBigtwo({});
          setGameState41({});
          completedWheelKeyRef.current = null;
          setBigTwoWheelPicker(null);
          setPendingBigTwoWheel(null);
          return;
        }

        const nextState = updatedRoom.game_state;
        const detectedType =
          nextState?.gameType ||
          getGameTypeFromRoomCode(updatedRoom.code) ||
          activeGameTypeRef.current;

        if (nextState?.firstTurnWheel?.isOpen && (nextState?.stateVersion || 1) <= 1) {
          const wheelKey = `${nextState.firstTurnWheel.targetPlayerId}_${nextState.gameType || detectedType}`;
          if (completedWheelKeyRef.current !== wheelKey) {
            setPendingBigTwoWheel(nextState.firstTurnWheel);
          }
        } else if (nextState && (!nextState.firstTurnWheel || (nextState.stateVersion || 1) > 1)) {
          setPendingBigTwoWheel(null);
        }

        // Do NOT re-fetch from PostgREST here; multiplayerAdapter.subscribeToRoom already handles
        // Broadcast delivery (`room_state_sync`) and hydrated `payload.new` directly.
        if (!nextState || !nextState.players) {
          return;
        }

        if (detectedType === 'bigtwo') {
          setActiveGameType('bigtwo');
          if (nextState.players && nextState.hands) {
            const prev = gameStateBigtwoRef.current;
            if (!shouldApplyIncomingGameState(prev, nextState)) return;
            gameStateBigtwoRef.current = nextState;
            setGameStateBigtwo(nextState);
            if (nextState.lastAction) {
              setRecentActionPopup(nextState.lastAction);
              if (nextState.lastAction.type === 'PLAY_COMBO') audio.playCardSound();
              else if (nextState.lastAction.type === 'PASS') audio.closeCardSound();
            }
            if (nextState.gameStatus === 'GAME_OVER') {
              audio.victorySound();
            }
          }
          return;
        }

        if (detectedType === 'game41') {
          setActiveGameType('game41');
          if (nextState.players && nextState.hands) {
            const prev = gameState41Ref.current;
            if (!shouldApplyIncomingGameState(prev, nextState)) return;
            gameState41Ref.current = nextState;
            setGameState41(nextState);
            if (nextState.lastAction) {
              setRecentActionPopup(nextState.lastAction);
              const action = nextState.lastAction;
              if (action.type === 'DRAW') {
                audio.playCardSound();
              } else if (action.type === 'DISCARD') {
                if (action.is41) audio.victorySound();
                else audio.closeCardSound();
              } else if (action.type === 'CLOSE_HAND') {
                if (action.isBusted) audio.closeCardSound?.();
                else audio.victorySound?.();
              }
            }
            prevTurnNumberRef.current = nextState.turnNumber;
          }
          return;
        }

        // Sevens
        if (nextState.players && nextState.hands) {
          const prev = gameStateRef.current;
          if (!shouldApplyIncomingGameState(prev, nextState)) return;
          const isNewRound =
            nextState.turnNumber === 1 &&
            !nextState.firstMoveMade &&
            (!prev || (nextState.matchId && prev.matchId !== nextState.matchId));
          if (isNewRound) {
            setIsDealingAnimationActive(true);
          }
          gameStateRef.current = nextState;
          setGameState(nextState);
          if (nextState.lastAction) {
            setRecentActionPopup(nextState.lastAction);
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
        }
      },
      null,
      handleIncomingChatMessage,
      handleIncomingReaction,
      handleIncomingVoiceSignal,
      handleIncomingSoundboard,
      handleIncomingGameActionDelta,
      handleRequestStateSync
    );

    return () => {
      unsubscribe();
      voiceChat.leaveRoom();
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
    const gameParam = activeGameType ? `&game=${activeGameType}` : '';
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoom.code}${gameParam}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Room ${activeGameType === 'bigtwo' ? 'Capsa Banting' : activeGameType === 'game41' ? 'Remi 41' : 'Tujuh Sekop'}: ${currentRoom.code}`,
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
      currentRoomRef.current = res.room;
      setCurrentRoom(res.room);
      myPlayerIdRef.current = res.player.id;
      setMyPlayerId(res.player.id);
      // Clean reset game engine states for fresh waiting room (jangan buat kartu lokal palsu saat di lobby)
      if (gameType === 'bigtwo') {
        activeGameTypeRef.current = 'bigtwo';
        setActiveGameType('bigtwo');
        gameStateBigtwoRef.current = {};
        setGameStateBigtwo({});
      } else if (gameType === 'game41') {
        activeGameTypeRef.current = 'game41';
        setActiveGameType('game41');
        gameState41Ref.current = {};
        setGameState41({});
      } else {
        activeGameTypeRef.current = 'sevens';
        setActiveGameType('sevens');
        const nextSev = initGame({ ...gameConfig, playerCount: maxPlayers });
        gameStateRef.current = nextSev;
        setGameState(nextSev);
      }
      setBigTwoWheelPicker(null);
      setPendingBigTwoWheel(null);
      setRecentActionPopup(null);
      setSelectedCard(null);
      setActiveFault(null);
      setPendingAceChoiceCard(null);
      setIsDealingAnimationActive(false);

      if (typeof window !== 'undefined' && window.history && res?.room?.code) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('room', res.room.code);
          if (gameType) url.searchParams.set('game', gameType);
          window.history.replaceState(null, '', url.toString());
        } catch {}
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

  const enterJoinedRoom = (res, toastMessage) => {
    currentRoomRef.current = res.room;
    setCurrentRoom(res.room);
    myPlayerIdRef.current = res.player.id;
    setMyPlayerId(res.player.id);
    const roomGame =
      res.room.game_state?.gameType ||
      getGameTypeFromRoomCode(res.room.code) ||
      activeGameType;
    activeGameTypeRef.current = roomGame;
    setActiveGameType(roomGame);

    if (res.room.game_state?.players) {
      if (roomGame === 'bigtwo') {
        gameStateBigtwoRef.current = res.room.game_state;
        setGameStateBigtwo(res.room.game_state);
      } else if (roomGame === 'game41') {
        gameState41Ref.current = res.room.game_state;
        setGameState41(res.room.game_state);
      } else {
        gameStateRef.current = res.room.game_state;
        setGameState(res.room.game_state);
      }
    } else {
      // Room still in lobby: biarkan state meja kosong sampai Host benar-benar memulai permainan
      const capacity = res.room.game_state?.config?.playerCount || 4;
      if (roomGame === 'bigtwo') {
        gameStateBigtwoRef.current = {};
        setGameStateBigtwo({});
      } else if (roomGame === 'game41') {
        gameState41Ref.current = {};
        setGameState41({});
      } else {
        const nextSev = initGame({ ...gameConfig, playerCount: capacity });
        gameStateRef.current = nextSev;
        setGameState(nextSev);
      }
    }
    setBigTwoWheelPicker(null);
    setPendingBigTwoWheel(null);
    setRecentActionPopup(null);
    setSelectedCard(null);
    setActiveFault(null);
    setPendingAceChoiceCard(null);
    setIsDealingAnimationActive(false);

    if (typeof window !== 'undefined' && window.history && res?.room?.code) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('room', res.room.code);
        if (roomGame) url.searchParams.set('game', roomGame);
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }
    setInviteRoomCode(null);
    showToast(toastMessage);
  };

  const handleJoinRoom = async (code, username) => {
    const cleanCode = extractCleanRoomCode(code);
    const res = await multiplayerAdapter.joinRoom(cleanCode, username);
    if (res.success) {
      enterJoinedRoom(
        res,
        res.isReconnected ? `Bergabung kembali ke Room ${res.room.code}` : `Berhasil bergabung ke Room ${res.room.code}`
      );
    }
    return res;
  };

  // MATCHMAKING: earliest player in the queue becomes the host of a new room
  const handleFindMatch = async (username, gameType = activeGameType) => {
    // Selalu mulai segar: tinggalkan room lama (jika ada) sebelum mencari lawan
    if (currentRoom?.code) {
      try {
        await multiplayerAdapter.leaveRoom(currentRoom.code, myPlayerId, username);
      } catch (e) {}
      setCurrentRoom(null);
      clearLocalSession();
    }
    const res = await multiplayerAdapter.findMatch(username, gameType);
    if (res.success) {
      enterJoinedRoom(
        res,
        res.created
          ? '🔎 Kamu antrean pertama — jadi Host! Menunggu pemain lain...'
          : `🎯 Lawan ditemukan! Masuk Room ${res.room.code}`
      );
    }
    return res;
  };

  // MATCHMAKING: host chooses to fill remaining seats with bots and start immediately
  const handleFillBotsAndStart = async () => {
    if (!currentRoom?.code || !isHost) return;
    const res = await multiplayerAdapter.fillBots(currentRoom.code, myPlayerId, MATCHMAKING_MIN_PLAYERS);
    if (res.success && res.room) {
      setCurrentRoom(res.room);
      await handleStartGame(res.room);
    } else {
      showToast(res.error || 'Gagal menambahkan bot.');
    }
  };

  const handleToggleReady = async (isReady) => {
    if (!currentRoom?.code) return;
    await multiplayerAdapter.toggleReady(currentRoom.code, myPlayerId, isReady);
  };

  const handleStartGame = async (roomOverride = null) => {
    // onClick passes a click event; only accept a real room object (has .code)
    const room = roomOverride && roomOverride.code ? roomOverride : currentRoom;
    if (!room?.code) return;
    const isBigTwo = activeGameType === 'bigtwo' || room.game_state?.gameType === 'bigtwo';
    const isGame41 = activeGameType === 'game41' || room.game_state?.gameType === 'game41';
    const actualPlayerCount = room.players?.length || 4;
    const roomDeckMode = room.game_state?.config?.deckMode;
    const effectiveDeckMode = isBigTwo && actualPlayerCount > 4
      ? (roomDeckMode || 'double')
      : 'single';

    const determinedGame = isBigTwo ? 'bigtwo' : isGame41 ? 'game41' : 'sevens';
    const carriedSessionScores = getMergedSessionScoresMap(determinedGame);
    const mmOverride = room.game_state?.matchmaking ? { roomPlayerCount: actualPlayerCount } : {};
    const configToUse = isBigTwo
      ? {
          gameType: 'bigtwo',
          ...room.game_state?.config,
          deckMode: effectiveDeckMode,
          sessionScores: carriedSessionScores,
          ...mmOverride,
        }
      : isGame41
      ? { gameType: 'game41', sessionScores: carriedSessionScores, ...mmOverride }
      : { ...gameConfig, sessionScores: carriedSessionScores, ...mmOverride };
    if (actualPlayerCount > 4) {
      const wheelPlayers = room.players || [];
      const starter = wheelPlayers[Math.floor(Math.random() * wheelPlayers.length)];
      if (starter) {
        configToUse.startingPlayerId = starter.id;
        configToUse.firstTurnWheel = {
          isOpen: true,
          targetPlayerId: starter.id,
          gameType: determinedGame,
          players: wheelPlayers.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, isBot: Boolean(p.isBot) })),
        };
      }
    }
    const res = await multiplayerAdapter.startGame(room.code, myPlayerId, configToUse, determinedGame);
    if (res.success) {
      completedWheelKeyRef.current = null;
      if (res.gameState.firstTurnWheel?.isOpen) {
        setPendingBigTwoWheel(res.gameState.firstTurnWheel);
      }
      if (isBigTwo) {
        activeGameTypeRef.current = 'bigtwo';
        setActiveGameType('bigtwo');
        gameStateBigtwoRef.current = res.gameState;
        setGameStateBigtwo(res.gameState);
      } else if (isGame41) {
        activeGameTypeRef.current = 'game41';
        setActiveGameType('game41');
        gameState41Ref.current = res.gameState;
        setGameState41(res.gameState);
      } else {
        activeGameTypeRef.current = 'sevens';
        setActiveGameType('sevens');
        gameStateRef.current = res.gameState;
        setGameState(res.gameState);
      }
      setIsDealingAnimationActive(true);
      currentRoomRef.current = res.room;
      setCurrentRoom(res.room);
      showToast('Permainan dimulai!');
    } else {
      setActiveFault({ message: res.error || 'Gagal memulai permainan.' });
    }
  };

  const handleLeaveRoom = async () => {
    try {
      localStorage.setItem('poker_voice_onmic', 'false');
    } catch (e) {}
    voiceChat.leaveRoom();
    setIsVoiceConnected(false);
    setIsVoiceMuted(true);
    setSpeakingPlayers(new Set());
    setInviteRoomCode(null);
    clearRoomUrlParams();

    if (currentRoom?.code) {
      const activeName = (typeof getLocalPlayerName === 'function' ? getLocalPlayerName() : '') || '';
      await multiplayerAdapter.leaveRoom(currentRoom.code, myPlayerId, activeName);
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
    const safeOverrides =
      configOverrides && typeof configOverrides === 'object' && !configOverrides.nativeEvent
        ? configOverrides
        : null;
    const nextCfg = safeOverrides || gameConfig;
    const carriedSessionScores = getMergedSessionScoresMap('sevens');

    if (gameMode === 'multiplayer' && currentRoom?.code) {
      const isHost = currentRoom.host_id === myPlayerId;
      if (!isHost) {
        showToast('Hanya Host yang dapat mengocok ulang dan memulai game baru.');
        return;
      }
      const res = await multiplayerAdapter.restartGame(currentRoom.code, myPlayerId, {
        ...nextCfg,
        sessionScores: carriedSessionScores,
      });
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
      nextState.sessionScores = carriedSessionScores;
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
      nextState.sessionScores = carriedSessionScores;
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
    if (isMultiplayerMode && currentRoomRef.current?.status !== 'playing') return;

    const currentState = gameStateRef.current || gameState;
    const isCurrentBot = isBotPlayer(currentState, currentState.currentPlayer);
    const isActuallyMyTurn = isMultiplayerMode
      ? currentState.currentPlayer === myPlayerIdRef.current
      : isSingleMode
      ? currentState.currentPlayer === SINGLE_HUMAN_ID
      : true;
    if (isMultiplayerMode && !isActuallyMyTurn && !isCurrentBot) {
      setActiveFault({ message: 'Bukan giliran Anda! Tunggu giliran Anda bermain.' });
      return;
    }

    const actingPlayerId = isCurrentBot ? currentState.currentPlayer : (isMultiplayerMode ? myPlayerIdRef.current : currentState.currentPlayer);

    // Check Ace closure choice condition (both 2 and K open, direction not locked)
    if (card.rank === 1 && !chosenDirection) {
      const suitBoard = currentState.board[card.suit];
      const canCapTop =
        suitBoard.maxRank === 13 &&
        (!currentState.globalAceDirection || currentState.globalAceDirection === 'top');
      const canCapBottom =
        suitBoard.minRank === 2 &&
        (!currentState.globalAceDirection || currentState.globalAceDirection === 'bottom');

      if (canCapTop && canCapBottom && !currentState.globalAceDirection) {
        setPendingAceChoiceCard(card);
        return;
      }
    }

    const result = enginePlayCard(currentState, actingPlayerId, card, chosenDirection);
    if (result.success) {
      gameStateRef.current = result.state;
      setGameState(result.state);
      setSelectedCard(null);
      setPendingAceChoiceCard(null);
      const actorName = currentState.players.find((p) => p.id === actingPlayerId)?.name || 'Pemain';
      const actorAvatar = currentState.players.find((p) => p.id === actingPlayerId)?.avatar || '♠';
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

      if (isMultiplayerMode && currentRoomRef.current?.code) {
        const delta = {
          type: 'PLAY_CARD',
          gameType: 'sevens',
          playerId: actingPlayerId,
          card,
          chosenDirection,
          actorClientId: myPlayerIdRef.current,
        };
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, result.state, delta);
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
    if (isMultiplayerMode && currentRoomRef.current?.status !== 'playing') return;

    const currentState = gameStateRef.current || gameState;
    const isCurrentBot = isBotPlayer(currentState, currentState.currentPlayer);
    const isActuallyMyTurn = isMultiplayerMode
      ? currentState.currentPlayer === myPlayerIdRef.current
      : isSingleMode
      ? currentState.currentPlayer === SINGLE_HUMAN_ID
      : true;
    if (isMultiplayerMode && !isActuallyMyTurn && !isCurrentBot) {
      setActiveFault({ message: 'Bukan giliran Anda! Tunggu giliran Anda bermain.' });
      return;
    }

    const actingPlayerId = isCurrentBot ? currentState.currentPlayer : (isMultiplayerMode ? myPlayerIdRef.current : currentState.currentPlayer);

    const result = engineCloseCard(currentState, actingPlayerId, card);
    if (result.success) {
      gameStateRef.current = result.state;
      setGameState(result.state);
      setSelectedCard(null);
      audio.closeCardSound();
      const actorName = currentState.players.find((p) => p.id === actingPlayerId)?.name || 'Pemain';
      const actorAvatar = currentState.players.find((p) => p.id === actingPlayerId)?.avatar || '🔒';
      setRecentActionPopup({
        type: 'PASS',
        playerId: actingPlayerId,
        playerName: actorName,
        avatar: actorAvatar,
        card,
        message: `${actorName} menutup kartu ${card.label}${card.symbol}`,
      });

      if (isMultiplayerMode && currentRoomRef.current?.code) {
        const delta = {
          type: 'CLOSE_CARD',
          gameType: 'sevens',
          playerId: actingPlayerId,
          card,
          actorClientId: myPlayerIdRef.current,
        };
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, result.state, delta);
      }
    } else if (result.fault) {
      // Game engine detected FAULT (player had valid moves)
      setActiveFault(result.fault);
      audio.faultSound();
      gameStateRef.current = result.state;
      setGameState(result.state);

      if (isMultiplayerMode && currentRoomRef.current?.code) {
        const delta = {
          type: 'CLOSE_CARD',
          gameType: 'sevens',
          playerId: actingPlayerId,
          card,
          actorClientId: myPlayerIdRef.current,
        };
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, result.state, delta);
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
    if (isMultiplayerMode && currentRoomRef.current?.status !== 'playing') return;
    const currentState = gameState41Ref.current || gameState41;
    const isCurrentBot = isBotPlayer(currentState, currentState.currentPlayer);
    const isActuallyMyTurn = isMultiplayerMode
      ? currentState.currentPlayer === myPlayerIdRef.current
      : isSingleMode
      ? currentState.currentPlayer === SINGLE_HUMAN_ID
      : true;
    if (!isCurrentBot && !isActuallyMyTurn) {
      showToast('Bukan giliran Anda!');
      return;
    }
    const actingPlayerId = isCurrentBot ? currentState.currentPlayer : (isMultiplayerMode ? myPlayerIdRef.current : currentState.currentPlayer);
    const res = drawCard41(currentState, actingPlayerId, source);
    if (res.success) {
      gameState41Ref.current = res.state;
      setGameState41(res.state);
      audio.playCardSound();
      if (isMultiplayerMode && currentRoomRef.current?.code) {
        const delta = {
          type: 'DRAW_41',
          gameType: 'game41',
          playerId: actingPlayerId,
          source,
          actorClientId: myPlayerIdRef.current,
        };
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, res.state, delta);
      }
    } else {
      showToast(res.error);
    }
  };

  const handleDiscardCard41 = async (card) => {
    if (isMultiplayerMode && currentRoomRef.current?.status !== 'playing') return;
    const currentState = gameState41Ref.current || gameState41;
    const isCurrentBot = isBotPlayer(currentState, currentState.currentPlayer);
    const isActuallyMyTurn = isMultiplayerMode
      ? currentState.currentPlayer === myPlayerIdRef.current
      : isSingleMode
      ? currentState.currentPlayer === SINGLE_HUMAN_ID
      : true;
    if (!isCurrentBot && !isActuallyMyTurn) {
      showToast('Bukan giliran Anda!');
      return;
    }
    const actingPlayerId = isCurrentBot ? currentState.currentPlayer : (isMultiplayerMode ? myPlayerIdRef.current : currentState.currentPlayer);
    const res = discardCard41(currentState, actingPlayerId, card);
    if (res.success) {
      gameState41Ref.current = res.state;
      setGameState41(res.state);
      const actorName = currentState.players.find((p) => p.id === actingPlayerId)?.name || 'Pemain';
      const actorAvatar = currentState.players.find((p) => p.id === actingPlayerId)?.avatar || '🃏';
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
      if (isMultiplayerMode && currentRoomRef.current?.code) {
        const delta = {
          type: 'DISCARD_41',
          gameType: 'game41',
          playerId: actingPlayerId,
          card,
          actorClientId: myPlayerIdRef.current,
        };
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, res.state, delta);
      }
    } else {
      showToast(res.error);
    }
  };

  const handleCloseHand41 = async (card = null) => {
    if (isMultiplayerMode && currentRoomRef.current?.status !== 'playing') return;
    const currentState = gameState41Ref.current || gameState41;
    const isCurrentBot = isBotPlayer(currentState, currentState.currentPlayer);
    const isActuallyMyTurn = isMultiplayerMode
      ? currentState.currentPlayer === myPlayerIdRef.current
      : isSingleMode
      ? currentState.currentPlayer === SINGLE_HUMAN_ID
      : true;
    if (!isCurrentBot && !isActuallyMyTurn) {
      showToast('Bukan giliran Anda!');
      return;
    }
    const actingPlayerId = isCurrentBot ? currentState.currentPlayer : (isMultiplayerMode ? myPlayerIdRef.current : currentState.currentPlayer);
    const res = closeHand41(currentState, actingPlayerId, card);
    if (res.success) {
      gameState41Ref.current = res.state;
      setGameState41(res.state);
      const actorName = currentState.players.find((p) => p.id === actingPlayerId)?.name || 'Pemain';
      const actorAvatar = currentState.players.find((p) => p.id === actingPlayerId)?.avatar || '🃏';
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
      if (isMultiplayerMode && currentRoomRef.current?.code) {
        const delta = {
          type: 'CLOSE_HAND_41',
          gameType: 'game41',
          playerId: actingPlayerId,
          card,
          actorClientId: myPlayerIdRef.current,
        };
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, res.state, delta);
      }
    } else {
      showToast(res.error);
    }
  };

  const handleRestart41 = async (configOverrides) => {
    const safeOverrides =
      configOverrides && typeof configOverrides === 'object' && !configOverrides.nativeEvent
        ? configOverrides
        : {};
    const prevWinnerId = gameState41.winner?.id || (gameState41.rankings?.[0]?.player?.id) || null;
    const carriedSessionScores = getMergedSessionScoresMap('game41');
    if (gameMode === 'multiplayer' && currentRoom?.code) {
      const isHost = currentRoom.host_id === myPlayerId;
      if (!isHost) {
        showToast('Hanya Host yang dapat mengocok ulang dan memulai game baru.');
        return;
      }
      const res = await multiplayerAdapter.restartGame(currentRoom.code, myPlayerId, {
        gameType: 'game41',
        firstPlayerId: prevWinnerId,
        sessionScores: carriedSessionScores,
        ...safeOverrides,
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
      nextState.sessionScores = carriedSessionScores;
      setGameState41(nextState);
      setIsDealingAnimationActive(true);
      const starterName = nextState.players.find((p) => p.id === nextState.currentPlayer)?.name || 'Pemain';
      showToast(`Permainan Kartu 41 baru dimulai! Giliran pertama: ${starterName}`);
    } else {
      const count = gameState41.players?.length || 4;
      const nextState = initGame41({ playerCount: count, firstPlayerId: prevWinnerId });
      nextState.sessionScores = carriedSessionScores;
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
    if (isMultiplayerMode && currentRoomRef.current?.status !== 'playing') return;
    const currentState = gameStateBigtwoRef.current || gameStateBigtwo;
    const isCurrentBot = isBotPlayer(currentState, currentState?.currentPlayer);
    const actingPlayerId = isCurrentBot ? currentState?.currentPlayer : (isMultiplayerMode ? myPlayerIdRef.current : currentState?.currentPlayer);
    const res = playComboBigTwo(currentState, actingPlayerId, selectedCards);
    if (res.success) {
      gameStateBigtwoRef.current = res.gameState;
      setGameStateBigtwo(res.gameState);
      if (res.gameState.lastAction) {
        setRecentActionPopup(res.gameState.lastAction);
      }
      audio.playCardSound();
      if (res.gameState.gameStatus === 'GAME_OVER') {
        audio.victorySound();
      }
      if (isMultiplayerMode && currentRoomRef.current?.code) {
        const delta = {
          type: 'PLAY_COMBO',
          gameType: 'bigtwo',
          playerId: actingPlayerId,
          cards: selectedCards,
          actorClientId: myPlayerIdRef.current,
        };
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, res.gameState, delta);
      }
    } else {
      showToast(res.error);
    }
  };

  const handlePassBigTwo = async () => {
    if (isMultiplayerMode && currentRoomRef.current?.status !== 'playing') return;
    const currentState = gameStateBigtwoRef.current || gameStateBigtwo;
    const isCurrentBot = isBotPlayer(currentState, currentState?.currentPlayer);
    const actingPlayerId = isCurrentBot ? currentState?.currentPlayer : (isMultiplayerMode ? myPlayerIdRef.current : currentState?.currentPlayer);
    const res = passTurnBigTwo(currentState, actingPlayerId);
    if (res.success) {
      gameStateBigtwoRef.current = res.gameState;
      setGameStateBigtwo(res.gameState);
      if (res.gameState.lastAction) {
        setRecentActionPopup(res.gameState.lastAction);
      }
      audio.closeCardSound();
      if (isMultiplayerMode && currentRoomRef.current?.code) {
        const delta = {
          type: 'PASS_TURN',
          gameType: 'bigtwo',
          playerId: actingPlayerId,
          actorClientId: myPlayerIdRef.current,
        };
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, res.gameState, delta);
      }
    } else {
      if (isCurrentBot) {
        // Fallback: If bot attempted to pass illegally (e.g. table is free/empty), play its lowest card so it never freezes
        const botHand = currentState?.hands?.[actingPlayerId] || [];
        if (botHand.length > 0) {
          console.warn('[BigTwo Bot] Pass rejected on free turn, falling back to playing lowest card:', botHand[0]);
          await handlePlayBigTwoCombo([botHand[0]]);
          return;
        }
      }
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

    const activeType = activeGameTypeRef.current;
    let currentPlayers = null;
    if (activeType === 'bigtwo') {
      const base = gameStateBigtwoRef.current || gameStateBigtwo;
      const nextState = setBotTakeoverBigTwo(base, playerId, isTakeover);
      gameStateBigtwoRef.current = nextState;
      setGameStateBigtwo(nextState);
      currentPlayers = nextState?.players;
    } else if (activeType === 'game41') {
      const base = gameState41Ref.current || gameState41;
      const nextState = setBotTakeoverGame41(base, playerId, isTakeover);
      gameState41Ref.current = nextState;
      setGameState41(nextState);
      currentPlayers = nextState?.players;
    } else {
      // Sevens
      const base = gameStateRef.current || gameState;
      const nextState = setBotTakeoverSevens(base, playerId, isTakeover);
      gameStateRef.current = nextState;
      setGameState(nextState);
      currentPlayers = nextState?.players;
    }

    const pObj = currentPlayers?.find((p) => p.id === playerId);

    if (isTakeover) {
      showToast(`🤖 Giliran ${pObj?.name || 'Pemain'} diambil alih oleh Bot AI (AFK > 2 Menit).`);
    } else {
      showToast('✨ Anda telah mengambil alih kendali kartu kembali!');
    }

    if (isMultiplayerMode && currentRoomRef.current?.code) {
      await multiplayerAdapter.toggleBotTakeover(currentRoomRef.current.code, playerId, isTakeover);
    }
  };

  // AFK & Turn Timer tracking (120 seconds = 2 minutes -> auto-switch to Bot AI like Mobile Legends for all games)
  useEffect(() => {
    const isPreGameOverlay =
      isDealingAnimationActive ||
      Boolean(pendingBigTwoWheel) ||
      Boolean(bigTwoWheelPicker?.isOpen) ||
      (isMultiplayerMode && currentRoom?.status !== 'playing');

    const isGameOver =
      activeGameType === 'bigtwo'
        ? gameStateBigtwo?.gameStatus === 'GAME_OVER'
        : activeGameType === 'game41'
        ? gameState41?.gameStatus === 'GAME_OVER' || gameState41?.gameStatus === 'game_over'
        : gameState?.gameStatus === GAME_STATUS.GAME_OVER;

    if (isPreGameOverlay || isGameOver) {
      turnStartTimeRef.current = Date.now();
      setTurnElapsed(0);
      return;
    }

    const currentId =
      activeGameType === 'bigtwo'
        ? gameStateBigtwo?.currentPlayer
        : activeGameType === 'game41'
        ? gameState41?.currentPlayer
        : gameState?.currentPlayer;

    const turnStep =
      activeGameType === 'bigtwo'
        ? gameStateBigtwo?.stateVersion || gameStateBigtwo?.history?.length || 0
        : activeGameType === 'game41'
        ? `${gameState41?.turnNumber || 0}_${gameState41?.turnPhase || ''}`
        : gameState?.turnNumber || 0;

    // Gunakan tanda tangan giliran + jam lokal perangkat ini (mencegah bug selisih jam antar HP/PC yang memicu Bot AFK instan)
    const turnSignature = `${activeGameType}_${currentId}_${turnStep}`;
    if (prevTurnPlayerIdRef.current !== turnSignature) {
      prevTurnPlayerIdRef.current = turnSignature;
      turnStartTimeRef.current = Date.now();
      setTurnElapsed(0);
    }

    const interval = setInterval(() => {
      const startTime = turnStartTimeRef.current;
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

      const isMyActiveTurn = isMultiplayerMode
        ? currentId === myPlayerId
        : isSingleMode
        ? currentId === SINGLE_HUMAN_ID
        : true;

      // Pemain aktif memicu pada 120s; Host memicu pada 125s sebagai jaring pengaman jika tab pemain tertutup
      const threshold = isMyActiveTurn ? 120 : 125;

      if (isHumanTurn && elapsed >= threshold) {
        if (!afkTriggeredTurnRef.current.has(turnSignature)) {
          afkTriggeredTurnRef.current.add(turnSignature);

          if (isMyActiveTurn || (isHost && isMultiplayerMode)) {
            console.log(`[AFK AUTO-TAKEOVER] [${activeGameType}] Pemain ${currentPlayerObj?.name || currentId} (${currentId}) AFK > ${threshold}s. Langsung dialihkan ke Bot AI.`);
            handleSetBotTakeover(currentId, true);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    activeGameType,
    isDealingAnimationActive,
    pendingBigTwoWheel,
    bigTwoWheelPicker?.isOpen,
    currentRoom?.status,
    gameState?.currentPlayer,
    gameState?.turnNumber,
    gameState?.gameStatus,
    gameState41?.currentPlayer,
    gameState41?.turnNumber,
    gameState41?.turnPhase,
    gameState41?.gameStatus,
    gameStateBigtwo?.currentPlayer,
    gameStateBigtwo?.stateVersion,
    gameStateBigtwo?.history?.length,
    gameStateBigtwo?.gameStatus,
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

  /**
   * Merges session scores from localStorage (`scoreboardData`), room `game_state.sessionScores`,
   * and active engine `sessionScores` so rounds played in the same room/session never reset unless explicitly cleared.
   */
  const getMergedSessionScoresMap = (gameKey = activeGameType) => {
    if (isMultiplayerMode && currentRoom?.code) {
      const sessionKey = `${gameKey}_room_${currentRoom.code}`;
      const localMap = scoreboardData[sessionKey] || {};
      const roomMap = currentRoom?.game_state?.sessionScores || {};
      const mergedRaw = multiplayerAdapter.mergeSessionScoreMaps(localMap, roomMap);

      const sessionPlayers = currentRoom?.players || [];
      const allowedNames = new Set(
        sessionPlayers.map((p) => (p.name || '').trim().toLowerCase()).filter(Boolean)
      );
      const allowedIds = new Set(sessionPlayers.map((p) => p.id).filter(Boolean));
      const merged = {};
      Object.entries(mergedRaw).forEach(([k, v]) => {
        const nm = (v?.name || '').trim().toLowerCase();
        if (!sessionPlayers.length || allowedNames.has(nm) || allowedNames.has(k)) {
          merged[k] = v;
        } else if (v?.id && allowedIds.has(v.id) && !nm) {
          merged[k] = v;
        }
      });
      return merged;
    }

    // Singleplayer or local offline mode
    const sessionKey = getScoreSessionKey(gameKey);
    const localMap = scoreboardData[sessionKey] || {};
    const engineMap =
      gameKey === 'bigtwo'
        ? gameStateBigtwo?.sessionScores || {}
        : gameKey === 'game41'
        ? gameState41?.sessionScores || {}
        : gameState?.sessionScores || {};

    const mergedRaw = multiplayerAdapter.mergeSessionScoreMaps(localMap, engineMap);
    return mergedRaw;
  };

  const lastRecordedMatchRef = useRef({});

  const recordGameEndScore = (gameKey, rankings = [], winnerId = null, matchSignature = '') => {
    if (!rankings || rankings.length === 0) return;

    const resolvedWinnerId =
      winnerId && typeof winnerId === 'object' && !Array.isArray(winnerId)
        ? winnerId.id || winnerId.player?.id || winnerId.name
        : winnerId;

    const effectiveSig =
      matchSignature ||
      `${gameKey}_${currentRoomRef.current?.code || currentRoom?.code || gameMode}_${
        resolvedWinnerId || 'nowin'
      }_${rankings.map((r) => r.id || r.player?.id || r.name).sort().join('_')}`;

    // Prevent recording the exact same finished game twice (e.g. on page refresh or realtime resync)
    const sigKey = `poker_last_recorded_match_${gameKey}`;
    if (lastRecordedMatchRef.current[gameKey] === effectiveSig) return;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(sigKey) === effectiveSig) {
        lastRecordedMatchRef.current[gameKey] = effectiveSig;
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(sigKey, effectiveSig);
      }
    } catch (e) {}
    lastRecordedMatchRef.current[gameKey] = effectiveSig;

    const sessionKey = getScoreSessionKey(gameKey);
    const totalPlayers = rankings.length;

    setScoreboardData((prev) => {
      const gameScores = { ...(prev[sessionKey] || {}) };
      const baseRoomScores =
        isMultiplayerMode && currentRoom?.game_state?.sessionScores
          ? currentRoom.game_state.sessionScores
          : {};

      rankings.forEach((r, idx) => {
        const pObj = r.player || r;
        const pId = r.id || pObj?.id;
        const pName = r.name || pObj?.name;
        const pAvatar = r.avatar || pObj?.avatar;
        const normName = pName ? pName.trim().toLowerCase() : '';
        const key = normName || pId;
        if (!key) return;

        const baseEntry =
          gameScores[key] ||
          (normName && gameScores[normName]) ||
          (pId && gameScores[pId]) ||
          baseRoomScores[key] ||
          (normName && baseRoomScores[normName]) ||
          (pId && baseRoomScores[pId]) || {
            id: pId,
            name: pName,
            avatar: pAvatar,
            games: 0,
            wins: 0,
            score: 0,
          };

        const rank = r.rank !== undefined ? Number(r.rank) : idx + 1;
        const isDisqualified = Boolean(r.isDisqualified || r.isBusted);
        const isFirstPlace = Boolean(
          !isDisqualified &&
            (rank === 1 ||
              r.isWinner === true ||
              (r.rank === undefined &&
                r.isWinner === undefined &&
                (idx === 0 ||
                  (resolvedWinnerId && pId === resolvedWinnerId) ||
                  (Array.isArray(resolvedWinnerId) && resolvedWinnerId.includes(pId)))))
        );

        // Rumus seragam: Poin = Jumlah pemain - Peringkat (diskualifikasi = 0)
        let pointsEarned = 0;
        if (isDisqualified) {
          pointsEarned = 0;
        } else if (r.pointsEarned !== undefined) {
          pointsEarned = Math.max(0, Number(r.pointsEarned || 0));
        } else {
          pointsEarned = Math.max(0, totalPlayers - rank);
        }

        const nextGames = (baseEntry.games || 0) + 1;
        const nextWins = (baseEntry.wins || 0) + (isFirstPlace ? 1 : 0);
        const nextScore = (baseEntry.score || 0) + pointsEarned;

        gameScores[key] = {
          ...baseEntry,
          id: pId || baseEntry.id,
          name: pName || baseEntry.name,
          avatar: pAvatar || baseEntry.avatar,
          games: nextGames,
          wins: nextWins,
          score: nextScore,
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

    // Automatically record to Top Global Leaderboard if in multiplayer mode
    if (isMultiplayerMode) {
      recordMultiplayerGameStats({
        gameType: gameKey,
        rankings,
        winnerId: resolvedWinnerId,
        isMultiplayer: isMultiplayerMode,
        myPlayerId,
        isHost,
        matchSignature: effectiveSig,
        roomCode: currentRoomRef.current?.code || currentRoom?.code || null,
      });
    }
  };

  const handleResetScoreboard = async (gameKey = activeGameType) => {
    const sessionKey = getScoreSessionKey(gameKey);
    setScoreboardData((prev) => {
      const nextScores = { ...prev, [sessionKey]: {} };
      try {
        localStorage.setItem('poker_scoreboard_data', JSON.stringify(nextScores));
      } catch (e) {}
      return nextScores;
    });

    if (currentRoomRef.current?.game_state) {
      currentRoomRef.current.game_state.sessionScores = {};
    }
    setCurrentRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        game_state: {
          ...(prev.game_state || {}),
          sessionScores: {},
        },
      };
    });

    if (activeGameType === 'bigtwo') {
      setGameStateBigtwo((prev) => (prev ? { ...prev, sessionScores: {} } : {}));
    } else if (activeGameType === 'game41') {
      setGameState41((prev) => (prev ? { ...prev, sessionScores: {} } : {}));
    } else {
      setGameState((prev) => (prev ? { ...prev, sessionScores: {} } : {}));
    }

    if (isMultiplayerMode && currentRoom?.code) {
      await multiplayerAdapter.resetRoomSessionScores(currentRoom.code);
    }

    showToast('Scoreboard sesi ini berhasil di-reset!');
  };

  const getCurrentScoreboardList = () => {
    const mergedScores = getMergedSessionScoresMap(activeGameType) || {};

    // Skor sesi hanya untuk pemain yang ada di meja/room saat ini
    const players = (isMultiplayerMode && currentRoom?.players?.length)
      ? currentRoom.players
      : activeGameType === 'bigtwo'
      ? (gameStateBigtwo.players || [])
      : activeGameType === 'game41'
      ? (gameState41.players || [])
      : (gameState.players || []);

    if (!players.length) return Object.values(mergedScores);

    const entries = Object.values(mergedScores);
    return players.map((p) => {
      const nameKey = (p.name || '').trim().toLowerCase();
      const found = entries.find(
        (e) =>
          (e.id && e.id === p.id) ||
          (nameKey && (e.name || '').trim().toLowerCase() === nameKey)
      );
      return {
        ...(found || { games: 0, wins: 0, score: 0 }),
        id: p.id,
        name: p.name,
        avatar: p.avatar || found?.avatar,
      };
    });
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
    const wheelData = bigTwoWheelPicker;
    setBigTwoWheelPicker(null);
    setPendingBigTwoWheel(null);
    const targetGame = wheelData?.gameType || activeGameType;
    if (wheelData?.targetPlayerId) {
      completedWheelKeyRef.current = `${wheelData.targetPlayerId}_${targetGame}`;
    }

    // Reset waktu giliran lokal setelah roda selesai berputar
    turnStartTimeRef.current = Date.now();
    setTurnElapsed(0);
    afkTriggeredTurnRef.current.clear();

    if (targetGame === 'bigtwo') {
      const latestBigtwo = gameStateBigtwoRef.current || gameStateBigtwo;
      const chosenPlayer = latestBigtwo.players?.find((p) => p.id === selectedPlayerId);
      showToast(`🎯 Giliran Pertama: ${chosenPlayer?.name || 'Pemain'} (Meja Bebas)!`);
      // Hanya atur giliran awal jika belum ada kartu yang dimainkan
      const hasMovesPlayed = (latestBigtwo.stateVersion || latestBigtwo.history?.length || 0) > 1;
      const updatedState = hasMovesPlayed
        ? {
            ...latestBigtwo,
            firstTurnWheel: null,
          }
        : {
            ...latestBigtwo,
            stateVersion: (latestBigtwo.stateVersion || 1) + 1,
            currentPlayer: selectedPlayerId,
            trickLeaderId: selectedPlayerId,
            currentTrick: { cards: [], combo: null, playedBy: null, playedByName: null },
            passedPlayers: [],
            turnStartedAt: Date.now(),
            firstTurnWheel: null,
          };
      gameStateBigtwoRef.current = updatedState;
      setGameStateBigtwo(updatedState);
      if (isMultiplayerMode && currentRoomRef.current?.code && isHostRef.current && !hasMovesPlayed) {
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, updatedState);
      }
    } else if (targetGame === 'game41') {
      const latest41 = gameState41Ref.current || gameState41;
      const chosenPlayer = latest41.players?.find((p) => p.id === selectedPlayerId);
      showToast(`🎯 Giliran Pertama: ${chosenPlayer?.name || 'Pemain'} (Ambil Kartu Pertama)!`);
      const hasMovesPlayed = (latest41.turnNumber || 1) > 1;
      const updatedState = hasMovesPlayed
        ? {
            ...latest41,
            firstTurnWheel: null,
          }
        : {
            ...latest41,
            stateVersion: (latest41.stateVersion || 1) + 1,
            currentPlayer: selectedPlayerId,
            turnStartedAt: Date.now(),
            firstTurnWheel: null,
          };
      gameState41Ref.current = updatedState;
      setGameState41(updatedState);
      if (isMultiplayerMode && currentRoomRef.current?.code && isHostRef.current && !hasMovesPlayed) {
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, updatedState);
      }
    } else {
      const latestSevens = gameStateRef.current || gameState;
      const chosenPlayer = latestSevens.players?.find((p) => p.id === selectedPlayerId);
      showToast(`🎯 Giliran Pertama: ${chosenPlayer?.name || 'Pemain'}!`);
      const hasMovesPlayed = Boolean(latestSevens.firstMoveMade || (latestSevens.turnNumber || 1) > 1);
      const updatedState = hasMovesPlayed
        ? {
            ...latestSevens,
            firstTurnWheel: null,
          }
        : {
            ...latestSevens,
            stateVersion: (latestSevens.stateVersion || 1) + 1,
            currentPlayer: selectedPlayerId,
            turnStartedAt: Date.now(),
            firstTurnWheel: null,
          };
      gameStateRef.current = updatedState;
      setGameState(updatedState);
      if (isMultiplayerMode && currentRoomRef.current?.code && isHostRef.current && !hasMovesPlayed) {
        await multiplayerAdapter.syncGameState(currentRoomRef.current.code, updatedState);
      }
    }
  };

  const handleBigTwoRespin = () => {
    const currentList =
      bigTwoWheelPicker?.players ||
      (activeGameType === 'bigtwo'
        ? gameStateBigtwo.players
        : activeGameType === 'game41'
        ? gameState41.players
        : gameState.players);
    if (!currentList || currentList.length === 0) return;
    const randomIdx = Math.floor(Math.random() * currentList.length);
    const targetPlayerId = currentList[randomIdx].id;
    completedWheelKeyRef.current = null;
    setBigTwoWheelPicker({
      isOpen: true,
      players: currentList,
      targetPlayerId,
      gameType: bigTwoWheelPicker?.gameType || activeGameType,
    });
  };

  const handleRestartBigTwo = async (configOverrides = {}) => {
    const safeOverrides =
      configOverrides && typeof configOverrides === 'object' && !configOverrides.nativeEvent
        ? configOverrides
        : {};
    // When playing again, no need to spin wheel; previous winner starts the next game
    const previousWinnerId = gameStateBigtwo.winner;
    const previousWinnerObj = gameStateBigtwo.players?.find((p) => p.id === previousWinnerId);
    const carriedSessionScores = getMergedSessionScoresMap('bigtwo');

    if (gameMode === 'multiplayer' && currentRoom?.code) {
      const isHost = currentRoom.host_id === myPlayerId;
      if (!isHost) {
        showToast('Hanya Host yang dapat mengocok ulang dan memulai game baru.');
        return;
      }
      const res = await multiplayerAdapter.restartGame(currentRoom.code, myPlayerId, {
        gameType: 'bigtwo',
        startingPlayerId: previousWinnerId,
        sessionScores: carriedSessionScores,
        ...safeOverrides,
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
      const nextState = initBigTwo(
        {
          playerCount: count,
          deckMode: effectiveDeckMode,
          startingPlayerId: previousWinnerId,
          sessionScores: carriedSessionScores,
          ...safeOverrides,
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
      const nextState = initBigTwo({
        playerCount: count,
        deckMode: gameStateBigtwo.config.deckMode,
        startingPlayerId: previousWinnerId,
        sessionScores: carriedSessionScores,
        ...safeOverrides,
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
      (currentRoom?.host_id === myPlayerId ||
        Boolean((currentRoom?.players || []).find((p) => p.id === myPlayerId)?.isHost)) &&
      currentRoom?.status === 'playing';
    const isFirstActiveHuman =
      isMultiplayerMode &&
      !(currentRoom?.players || []).some((p) => (p.id === currentRoom?.host_id || p.isHost) && !p.isBot) &&
      (currentRoom?.players || []).find((p) => !p.isBot)?.id === myPlayerId;
    const canDriveBots = isSingleMode || isMultiplayerHost || isFirstActiveHuman || gameMode === 'local';
    const isPreGameOverlay =
      isDealingAnimationActive ||
      Boolean(pendingBigTwoWheel) ||
      Boolean(bigTwoWheelPicker?.isOpen);

    if (!canDriveBots || isPreGameOverlay) {
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
    gameStateBigtwo?.stateVersion,
    gameStateBigtwo?.players?.find((p) => p.id === gameStateBigtwo?.currentPlayer)?.isBotTakeover,
    bigTwoWheelPicker?.isOpen,
    isDealingAnimationActive,
    pendingBigTwoWheel,
    isMultiplayerMode,
    isSingleMode,
    currentRoom?.host_id,
    currentRoom?.status,
    myPlayerId,
  ]);

  // Find active turn player's name
  const currentTurnPlayer = playersList.find((p) => p.id === (
    activeGameType === 'bigtwo'
      ? gameStateBigtwo?.currentPlayer
      : activeGameType === 'game41'
      ? gameState41?.currentPlayer
      : gameState?.currentPlayer
  ));
  const currentTurnPlayerName = currentTurnPlayer?.name || 'Pemain Lain';

  // Automatic Score Recording for Cumulative Scoreboard & Top Global (Points model)
  useEffect(() => {
    if (
      activeGameType === 'bigtwo' &&
      (gameStateBigtwo?.gameStatus === 'GAME_OVER' || gameStateBigtwo?.gameStatus === 'game_over') &&
      gameStateBigtwo?.rankings?.length > 0
    ) {
      const matchId =
        gameStateBigtwo.matchId ||
        `bigtwo_${currentRoom?.code || gameMode}_${gameStateBigtwo.winner || ''}`;
      const sig = `bigtwo_${matchId}`;
      recordGameEndScore('bigtwo', gameStateBigtwo.rankings, gameStateBigtwo.winner, sig);
    }
  }, [activeGameType, gameStateBigtwo?.gameStatus, gameStateBigtwo?.matchId]);

  useEffect(() => {
    if (
      activeGameType === 'game41' &&
      (gameState41?.gameStatus === 'game_over' || gameState41?.gameStatus === 'GAME_OVER') &&
      gameState41?.rankings?.length > 0
    ) {
      const winnerId = gameState41.winner?.id || gameState41.winner || '';
      const matchId =
        gameState41.matchId ||
        `game41_${currentRoom?.code || gameMode}_${winnerId}`;
      const sig = `game41_${matchId}`;
      recordGameEndScore('game41', gameState41.rankings, gameState41.winner, sig);
    }
  }, [activeGameType, gameState41?.gameStatus, gameState41?.matchId]);

  useEffect(() => {
    if (
      activeGameType === 'sevens' &&
      gameState?.gameStatus === GAME_STATUS.GAME_OVER &&
      gameState?.scores
    ) {
      const totalPlayers = (gameState.players || []).length || 4;
      const sortedPlayers = [...(gameState.players || [])].sort((a, b) => {
        const sA = gameState.scores[a.id]?.totalScore ?? -999;
        const sB = gameState.scores[b.id]?.totalScore ?? -999;
        return sB - sA;
      });
      const rankings = sortedPlayers.map((p, idx) => {
        const isFirstPlace = (gameState.winners || []).includes(p.id);
        const rank = isFirstPlace ? 1 : idx + 1;
        const pointsEarned = Math.max(0, totalPlayers - rank);
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isBot: Boolean(p.isBot),
          isBotTakeover: Boolean(p.isBotTakeover),
          rank,
          pointsEarned,
          score: gameState.scores[p.id]?.totalScore ?? 0,
          isWinner: isFirstPlace,
        };
      });
      const matchId =
        gameState.matchId ||
        `sevens_${currentRoom?.code || gameMode}_${(gameState.winners || []).join(',')}`;
      const sig = `sevens_${matchId}`;
      recordGameEndScore('sevens', rankings, gameState.winners, sig);
    }
  }, [activeGameType, gameState?.gameStatus, gameState?.matchId]);


  // Return to Mode Selection Screen (Home)
  // Hapus ?room= & ?game= dari URL (dipanggil saat keluar room / kembali ke menu utama)
  const clearRoomUrlParams = () => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('room') || url.searchParams.has('game')) {
        url.searchParams.delete('room');
        url.searchParams.delete('game');
        window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
      }
    } catch {}
  };

  const handleBackToModeSelect = () => {
    const __clearUrlOnExit = () => {
      setInviteRoomCode(null);
      clearRoomUrlParams();
    };
    const isGameOver =
      (activeGameType === 'bigtwo' && gameStateBigtwo.gameStatus === 'GAME_OVER') ||
      (activeGameType === 'game41' && (gameState41.gameStatus === 'game_over' || gameState41.gameStatus === 'GAME_OVER')) ||
      (activeGameType === 'sevens' && gameState.gameStatus === GAME_STATUS.GAME_OVER);

    if (isMultiplayerMode && currentRoom) {
      if (isGameOver || confirm('Keluar dari room online dan kembali ke menu pemilihan mode?')) {
        handleLeaveRoom();
        __clearUrlOnExit();
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
      __clearUrlOnExit();
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
          onSelectGame={(game) => {
            if (currentRoom && activeGameType !== game) {
              handleLeaveRoom();
            }
            setActiveGameType(game);
          }}
          onSelectMode={(mode, playerCount, game, options = {}) => {
            const chosenGame = game || activeGameType;
            if (currentRoom && activeGameType !== chosenGame) {
              handleLeaveRoom();
            }
            setActiveGameType(chosenGame);

            // Permainan baru dari menu utama (vs Bot / Lokal) selalu mulai dengan skor sesi kosong
            if (mode === 'single' || mode === 'local') {
              const freshKey = `${chosenGame}_${mode}`;
              setScoreboardData((prev) => {
                const next = { ...prev, [freshKey]: {} };
                try {
                  localStorage.setItem('poker_scoreboard_data', JSON.stringify(next));
                } catch (e) {}
                return next;
              });
              try {
                localStorage.removeItem(`poker_last_recorded_match_${chosenGame}`);
              } catch (e) {}
              lastRecordedMatchRef.current[chosenGame] = null;
            }

            if (mode === 'single') {
              const totalCount = playerCount || (options?.botCount ? options.botCount + 1 : 2);
              const roster = createSinglePlayerRoster(totalCount);
              const shouldSpinWheel = totalCount > 4;

              if (chosenGame === 'bigtwo') {
                let chosenId = null;
                if (shouldSpinWheel) {
                  const randomIdx = Math.floor(Math.random() * roster.length);
                  chosenId = roster[randomIdx].id;
                }
                const stateBigtwo = initBigTwo({
                  playerCount: totalCount,
                  deckMode: totalCount > 4 ? (options?.deckMode || 'single') : 'single',
                  startingPlayerId: chosenId,
                }, roster);
                setGameStateBigtwo(stateBigtwo);
                if (shouldSpinWheel) {
                  setPendingBigTwoWheel({
                    isOpen: true,
                    players: stateBigtwo.players,
                    targetPlayerId: stateBigtwo.currentPlayer,
                    gameType: 'bigtwo',
                  });
                } else {
                  setPendingBigTwoWheel(null);
                }
              } else if (chosenGame === 'game41') {
                let chosenId = null;
                if (shouldSpinWheel) {
                  const randomIdx = Math.floor(Math.random() * roster.length);
                  chosenId = roster[randomIdx].id;
                }
                const state41 = initGame41({ playerCount: totalCount, startingPlayerId: chosenId }, roster);
                setGameState41(state41);
                if (shouldSpinWheel) {
                  setPendingBigTwoWheel({
                    isOpen: true,
                    players: state41.players,
                    targetPlayerId: state41.currentPlayer,
                    gameType: 'game41',
                  });
                } else {
                  setPendingBigTwoWheel(null);
                  const starterName = state41.players.find((p) => p.id === state41.currentPlayer)?.name || 'Pemain';
                  showToast(`Permainan Kartu 41 dimulai! Giliran pertama: ${starterName}`);
                }
              } else {
                let chosenId = null;
                if (shouldSpinWheel) {
                  const randomIdx = Math.floor(Math.random() * roster.length);
                  chosenId = roster[randomIdx].id;
                }
                const nextCfg = { ...gameConfig, playerCount: totalCount, startingPlayerId: chosenId };
                setGameConfig(nextCfg);
                const sevensState = initGame(nextCfg, roster);
                setGameState(sevensState);
                if (shouldSpinWheel) {
                  setPendingBigTwoWheel({
                    isOpen: true,
                    players: sevensState.players,
                    targetPlayerId: sevensState.currentPlayer,
                    gameType: 'sevens',
                  });
                } else {
                  setPendingBigTwoWheel(null);
                }
              }
              setIsDealingAnimationActive(true);
              setGameMode('single');
            } else if (mode === 'local') {
              const count = playerCount || 4;
              const shouldSpinWheel = count > 4;

              if (chosenGame === 'bigtwo') {
                let chosenId = null;
                if (shouldSpinWheel) {
                  const tempPlayers = Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}` }));
                  chosenId = tempPlayers[Math.floor(Math.random() * count)].id;
                }
                const stateBigtwo = initBigTwo({
                  playerCount: count,
                  deckMode: count > 4 ? (options?.deckMode || 'single') : 'single',
                  startingPlayerId: chosenId,
                });
                setGameStateBigtwo(stateBigtwo);
                if (shouldSpinWheel) {
                  setPendingBigTwoWheel({
                    isOpen: true,
                    players: stateBigtwo.players,
                    targetPlayerId: stateBigtwo.currentPlayer,
                    gameType: 'bigtwo',
                  });
                } else {
                  setPendingBigTwoWheel(null);
                }
              } else if (chosenGame === 'game41') {
                let chosenId = null;
                if (shouldSpinWheel) {
                  const tempPlayers = Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}` }));
                  chosenId = tempPlayers[Math.floor(Math.random() * count)].id;
                }
                const state41 = initGame41({ playerCount: count, startingPlayerId: chosenId });
                setGameState41(state41);
                if (shouldSpinWheel) {
                  setPendingBigTwoWheel({
                    isOpen: true,
                    players: state41.players,
                    targetPlayerId: state41.currentPlayer,
                    gameType: 'game41',
                  });
                } else {
                  setPendingBigTwoWheel(null);
                  const starterName = state41.players.find((p) => p.id === state41.currentPlayer)?.name || 'Pemain';
                  showToast(`Permainan Kartu 41 dimulai! Giliran pertama: ${starterName}`);
                }
              } else {
                let chosenId = null;
                if (shouldSpinWheel) {
                  const tempPlayers = Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}` }));
                  chosenId = tempPlayers[Math.floor(Math.random() * count)].id;
                }
                const nextCfg = { ...gameConfig, playerCount: count, startingPlayerId: chosenId };
                setGameConfig(nextCfg);
                const sevensState = initGame(nextCfg);
                setGameState(sevensState);
                if (shouldSpinWheel) {
                  setPendingBigTwoWheel({
                    isOpen: true,
                    players: sevensState.players,
                    targetPlayerId: sevensState.currentPlayer,
                    gameType: 'sevens',
                  });
                } else {
                  setPendingBigTwoWheel(null);
                }
              }
              setIsDealingAnimationActive(true);
              setGameMode('local');
            } else {
              setMultiplayerInitOptions(options);
              if (options?.inviteCode) {
                setInviteRoomCode(options.inviteCode);
              }
              setGameMode(mode);
            }
          }}
          onOpenRules={(game) => {
            if (game === 'bigtwo') setShowRulesBigtwoModal(true);
            else if (game === 'game41') setShowRules41Modal(true);
            else setShowRulesModal(true);
          }}
          onOpenScoreboard={(category = 'all') => {
            setGlobalScoreboardCategory(typeof category === 'string' ? category : 'all');
            setShowScoreboardModal(true);
          }}
          isMuted={isMuted}
          onToggleSound={handleToggleSound}
          currentMyId={myPlayerId}
          initialDmPartner={directChatPartner}
          onClearDmPartner={() => setDirectChatPartner(null)}
        />

        {/* Top Global Modal (Khusus di Menu Utama seperti Mobile Legends) */}
        <ScoreboardModal
          isOpen={showScoreboardModal}
          onClose={() => setShowScoreboardModal(false)}
          scoreboardData={getCurrentScoreboardList()}
          onResetScoreboard={() => handleResetScoreboard(activeGameType)}
          activeGameTitle={getCurrentScoreboardTitle()}
          activeGameType={globalScoreboardCategory}
          currentMyId={myPlayerId}
          currentMyName={getLocalPlayerName()}
          mode="global"
          onStartDirectChat={(player) => {
            setShowScoreboardModal(false);
            setDirectChatPartner(player);
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

  const isGameOver =
    (activeGameType === 'bigtwo' && (gameStateBigtwo.gameStatus === 'GAME_OVER' || gameStateBigtwo.status === 'finished')) ||
    (activeGameType === 'game41' && (gameState41.gameStatus === 'game_over' || gameState41.gameStatus === 'GAME_OVER')) ||
    (activeGameType === 'sevens' && (gameState.gameStatus === GAME_STATUS.GAME_OVER || gameState.gameStatus === 'GAME_OVER'));

  const isAnyModalOpen =
    isGameOver ||
    showScoreboardModal ||
    showConfigModal ||
    showRulesModal ||
    showRules41Modal ||
    showRulesBigtwoModal ||
    showHistoryModal ||
    Boolean(bigTwoWheelPicker?.isOpen) ||
    showMultiplayerLobby ||
    isMobileMenuOpen;

  return (
    <div className="app-container">
      {/* Real-time Action Announcement Pop-up (Only for games without table trick board) */}
      {activeGameType !== 'bigtwo' && (
        <ActionAnnouncementPopup
          action={recentActionPopup}
          onDismiss={() => setRecentActionPopup(null)}
        />
      )}

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
              ? `Capsa Banting • ${gameStateBigtwo?.players?.length || 4} Pemain${(gameStateBigtwo?.deckMode === 'double' || gameStateBigtwo?.config?.deckMode === 'double') ? ' (Double Deck • 104 Kartu)' : ((gameStateBigtwo?.players?.length || 4) > 4 ? ' (Single Deck • 52 Kartu)' : '')}`
              : activeGameType === 'game41'
              ? `Kartu 41 • ${gameState41?.players?.length || 4} Pemain`
              : `Tujuh Sekop • ${gameState?.players?.length || 4} Pemain`}
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

          {/* Global Ace Direction Badge & Turn (Desktop Only - Sevens Only) */}
          {activeGameType === 'sevens' && (
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
                  fontSize: '0.78rem',
                  color: '#fbbf24',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  marginLeft: '0.2rem',
                }}
              >
                Turn #{gameState.turnNumber}
              </span>
            </div>
          )}
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

          {/* Dedicated Reaction Button in Desktop Header (Google Meet style) */}
          <button
            className="btn-header btn-header-reaction"
            onClick={() => {
              setIsReactionOpen((prev) => {
                const next = !prev;
                if (next) setIsSoundboardOpen(false);
                return next;
              });
            }}
            title="Kirim Reaksi Emote Terbang (Google Meet)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: 'rgba(251, 191, 36, 0.45)',
              color: '#fbbf24',
            }}
          >
            <Smile size={15} />
            <span>Reaksi</span>
          </button>

          {/* Live Voice Chat Button in Desktop Header */}
          <button
            className="btn-header"
            onClick={handleToggleVoice}
            title={
              isVoiceConnected
                ? isVoiceMuted
                  ? 'Nyalakan Mic (Unmute)'
                  : 'Matikan Mic (Mute)'
                : 'Gabung Live Voice Chat'
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: isVoiceConnected && !isVoiceMuted ? 'rgba(16, 185, 129, 0.7)' : 'rgba(16, 185, 129, 0.4)',
              color: isVoiceConnected && !isVoiceMuted ? '#10b981' : '#6ee7b7',
              background: isVoiceConnected && !isVoiceMuted ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            }}
          >
            {isVoiceConnected && !isVoiceMuted ? (
              <Mic size={15} className={speakingPlayers.has(myPlayerId) ? 'pulse-speaking' : ''} />
            ) : (
              <MicOff size={15} />
            )}
            <span>{isVoiceConnected ? (isVoiceMuted ? 'Muted' : 'Voice On') : 'Voice'}</span>
          </button>

          <button
            className={`btn-icon ${isMuted ? 'active' : ''}`}
            onClick={handleToggleSound}
            title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            className={`btn-icon ${isSoundboardOpen ? 'active' : ''} ${isSoundboardPlaying ? 'pulse-speaking' : ''}`}
            onClick={() => setIsSoundboardOpen((prev) => !prev)}
            title="Soundboard Meme & SFX"
            style={{ color: '#c084fc' }}
          >
            <Radio size={18} />
          </button>

          {(!isMultiplayerMode || isHost) && isGameOver && (
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
            onError={showToast}
            onReclaimControl={(playerId) => handleSetBotTakeover(playerId, false)}
            turnDuration={turnElapsed}
            speakingPlayers={speakingPlayers}
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
            speakingPlayers={speakingPlayers}
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
                          isSpeaking={speakingPlayers.has(p.id)}
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
                        isSpeaking={speakingPlayers.has(seats.top.id)}
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
                        isSpeaking={speakingPlayers.has(seats.left.id)}
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
                    isSpeaking={speakingPlayers.has(seats.right.id)}
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
          onFindMatch={handleFindMatch}
          onFillBotsAndStart={handleFillBotsAndStart}
          onTouchRoom={() => currentRoom?.code && multiplayerAdapter.touchRoom(currentRoom.code)}
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
          isVoiceConnected={isVoiceConnected}
          isVoiceMuted={isVoiceMuted}
          speakingPlayers={speakingPlayers}
          onToggleVoice={handleToggleVoice}
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
        onOpenReactions={() => setIsReactionOpen(true)}
        onOpenSoundboard={() => setIsSoundboardOpen(true)}
        isVoiceConnected={isVoiceConnected}
        isVoiceMuted={isVoiceMuted}
        onToggleVoice={handleToggleVoice}
        voiceVolume={voiceVolume}
        onVoiceVolumeChange={(vol) => {
          const clamped = voiceChat.setVoiceVolume(vol);
          setVoiceVolume(clamped);
        }}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        onRestart={() => {
          if (activeGameType === 'bigtwo') handleRestartBigTwo();
          else if (activeGameType === 'game41') handleRestart41();
          else handleRestart();
        }}
        isGameOver={isGameOver}
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
      {activeGameType === 'sevens' &&
        (gameState?.gameStatus === GAME_STATUS.GAME_OVER ||
          gameState?.gameStatus === 'GAME_OVER' ||
          gameState?.gameStatus === 'game_over' ||
          Boolean(gameState?.winners?.length > 0 && gameState?.scores)) && (
        <GameOverModal
          gameState={gameState}
          results={gameState}
          onRestart={() => handleRestart()}
          onPlayAgain={() => handleRestart()}
          onBackToMenu={handleBackToModeSelect}
          onOpenScoreboard={() => setShowScoreboardModal(true)}
          isMultiplayer={isMultiplayerMode}
          isHost={isHost}
          currentRoomCode={isMultiplayerMode ? currentRoom?.code : null}
          myPlayerId={myPlayerId}
          myPlayerName={
            (currentRoom?.players || []).find((p) => p.id === myPlayerId)?.name ||
            getLocalPlayerName()
          }
        />
      )}

      {/* Game 41 Game Over Modal */}
      {activeGameType === 'game41' &&
        (gameState41?.gameStatus === 'game_over' ||
          gameState41?.gameStatus === 'GAME_OVER' ||
          Boolean(gameState41?.winner && gameState41?.rankings?.length > 0)) && (
        <GameOver41Modal
          gameState={gameState41}
          results={gameState41}
          onRestart={handleRestart41}
          onPlayAgain={handleRestart41}
          onBackToMenu={handleBackToModeSelect}
          onOpenScoreboard={() => setShowScoreboardModal(true)}
          isMultiplayer={isMultiplayerMode}
          isHost={isHost}
          currentRoomCode={isMultiplayerMode ? currentRoom?.code : null}
          myPlayerId={myPlayerId}
          myPlayerName={
            (currentRoom?.players || []).find((p) => p.id === myPlayerId)?.name ||
            getLocalPlayerName()
          }
        />
      )}

      {/* Big Two Game Over Modal */}
      {activeGameType === 'bigtwo' &&
        (gameStateBigtwo?.gameStatus === 'GAME_OVER' ||
          gameStateBigtwo?.gameStatus === 'game_over' ||
          Boolean(gameStateBigtwo?.winner && gameStateBigtwo?.rankings?.length > 0)) && (
        <GameOverBigTwoModal
          gameState={gameStateBigtwo}
          results={gameStateBigtwo}
          onRestart={handleRestartBigTwo}
          onPlayAgain={handleRestartBigTwo}
          onBackToMenu={handleBackToModeSelect}
          onOpenScoreboard={() => setShowScoreboardModal(true)}
          isMultiplayer={isMultiplayerMode}
          isHost={isHost}
          currentRoomCode={isMultiplayerMode ? currentRoom?.code : null}
          myPlayerId={myPlayerId}
          myPlayerName={
            (currentRoom?.players || []).find((p) => p.id === myPlayerId)?.name ||
            getLocalPlayerName()
          }
        />
      )}

      {/* Cumulative Scoreboard Modal (Khusus Sesi Meja Saat Bermain) */}
      <ScoreboardModal
        isOpen={showScoreboardModal}
        onClose={() => setShowScoreboardModal(false)}
        scoreboardData={getCurrentScoreboardList()}
        onResetScoreboard={() => handleResetScoreboard(activeGameType)}
        activeGameTitle={getCurrentScoreboardTitle()}
        activeGameType={activeGameType}
        currentMyId={myPlayerId}
        currentMyName={
          (currentRoom?.players || []).find((p) => p.id === myPlayerId)?.name ||
          getLocalPlayerName()
        }
        mode="session"
        onStartDirectChat={(player) => {
          setShowScoreboardModal(false);
          setDirectChatPartner(player);
        }}
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

      {/* First Turn Picker Wheel Modal (Universal for Big Two, Game 41, Sevens > 4 Players) */}
      {bigTwoWheelPicker?.isOpen && (
        <BigTwoFirstTurnWheel
          isOpen={bigTwoWheelPicker.isOpen}
          players={
            bigTwoWheelPicker.players ||
            (activeGameType === 'bigtwo'
              ? gameStateBigtwo.players
              : activeGameType === 'game41'
              ? gameState41.players
              : gameState.players)
          }
          targetPlayerId={bigTwoWheelPicker.targetPlayerId}
          onComplete={handleBigTwoWheelComplete}
          onClose={() => setBigTwoWheelPicker(null)}
          onRespin={handleBigTwoRespin}
          isMultiplayer={isMultiplayerMode}
          isHost={isHost}
          gameType={bigTwoWheelPicker.gameType || activeGameType}
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
          chatHistory={roomChatHistory}
          onSendMessage={handleSendChatMessage}
          isOpen={isChatOpen}
          onToggleOpen={setIsChatOpen}
          showTrigger={false}
        />
      )}

      {/* GOOGLE MEET FLOATING REACTIONS OVERLAY (Flying Upwards Animations) */}
      {gameMode && (
        <FloatingReactionsOverlay
          activeReactions={activeReactions}
          onSendReaction={handleSendReaction}
          isOpen={isReactionOpen}
          onToggleOpen={setIsReactionOpen}
          myPlayerId={myPlayerId}
          showTrigger={false}
        />
      )}

      {/* UNIFIED SOCIAL DOCK PILL (Voice + Reaksi + Soundboard + Chat in 1 sleek compact bar) */}
      {gameMode && (
        <UnifiedSocialDock
          isVisible={!isAnyModalOpen}
          isVoiceConnected={isVoiceConnected}
          isVoiceMuted={isVoiceMuted}
          isSpeaking={speakingPlayers.has(myPlayerId)}
          onToggleVoice={handleToggleVoice}
          isReactionOpen={isReactionOpen}
          onToggleReaction={() => {
            setIsReactionOpen((prev) => {
              const next = !prev;
              if (next) {
                setIsSoundboardOpen(false);
                setIsChatOpen(false);
              }
              return next;
            });
          }}
          isSoundboardOpen={isSoundboardOpen}
          onToggleSoundboard={() => {
            setIsSoundboardOpen((prev) => {
              const next = !prev;
              if (next) {
                setIsReactionOpen(false);
                setIsChatOpen(false);
              }
              return next;
            });
          }}
          isSoundboardPlaying={isSoundboardPlaying}
          isChatOpen={isChatOpen}
          onToggleChat={() => {
            setIsChatOpen((prev) => {
              const next = !prev;
              if (next) {
                setIsReactionOpen(false);
                setIsSoundboardOpen(false);
              }
              return next;
            });
          }}
          hasUnreadChat={activeChatMessages.length > 0}
        />
      )}

      {/* SOUNDBOARD MEME MODAL */}
      <SoundboardModal
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        onPlaySound={handlePlaySoundboard}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        isMultiplayer={isMultiplayerMode && !!currentRoom?.code}
      />

      {/* FLOATING SOUNDBOARD TOAST NOTIFICATIONS */}
      <SoundboardNotification activeSounds={activeSoundboardToasts} />
    </div>
  );
}
