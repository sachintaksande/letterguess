// ============================================================
// App — Root component with socket event handlers and state
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { connectSocket, getSocket, disconnectSocket } from './socket';
import { GameState, RoomSnapshot } from './types';
import Hub from './pages/Hub';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import WordChainGame from './games/wordchain/WordChainGame';
import LeaveConfirmModal from './components/LeaveConfirmModal';
import { loadMuteStates, isSfxMuted, isMusicMuted, toggleSfxMute, toggleMusicMute, startMusic, stopMusic, playCorrectLetter, playWrongLetter, playYourTurn, playCorrectAnswer, playWrongAnswer, playEliminated, playRoundWin, playNobodyWon } from './sounds';

const PLAYER_ID_KEY = 'letterguess_playerId';
const ROOM_CODE_KEY = 'letterguess_roomCode';
const GAME_TYPE_KEY = 'letterguess_gameType';

// Read which game to load from URL
function getUrlGame(): string | null {
  return new URLSearchParams(window.location.search).get('game');
}

function getOrCreatePlayerId(): string {
  // sessionStorage = per-tab (so opening a 2nd tab creates a NEW player for testing multiplayer)
  const stored = sessionStorage.getItem(PLAYER_ID_KEY);
  if (stored) return stored;
  const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

function getSavedRoomCode(): string | null {
  return sessionStorage.getItem(ROOM_CODE_KEY);
}

function getSavedGameType(): string {
  return sessionStorage.getItem(GAME_TYPE_KEY) || 'letterguess';
}

const urlGame = getUrlGame();
const urlCode = new URLSearchParams(window.location.search).get('code');
const savedRoom = getSavedRoomCode();
// Use URL game, or saved game if there's a room to rejoin, otherwise hub
const effectiveGame = urlGame || (savedRoom ? getSavedGameType() : null);

const initialState: GameState = {
  view: effectiveGame ? 'home' : 'hub',
  gameType: effectiveGame,
  roomCode: savedRoom,
  playerId: getOrCreatePlayerId(),
  playerName: null,
  roomCreatorId: null,
  players: [],
  maxPlayers: 8,
  state: null,
  currentRound: null,
  rounds: [],
  scores: {},
  isMyTurn: false,
  myTurnType: null,
  turnTimeLimit: null,
  turnSecondsLeft: null,
  waitingPlayerId: null,
  waitingPlayerName: null,
  waitingTimerSecondsLeft: null,
  guessingPlayerId: null,
  guessingPlayerName: null,
  isMeGuessing: false,
  roundEndData: null,
  sessionEndData: null,
  error: null,
};

export default function App() {
  const [gs, setGs] = useState<GameState>(initialState);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(true);
  const [musicMuted, setMusicMuted] = useState(true);
  const gsRef = useRef(gs);
  gsRef.current = gs;

  // Load mute states on mount
  useEffect(() => {
    const states = loadMuteStates();
    setSfxMuted(states.sfx);
    setMusicMuted(states.music);
    if (!states.music) startMusic();
  }, []);

  // ---- Socket connection ----

  useEffect(() => {
    const socket = connectSocket();

    // ---- Auto-rejoin on page refresh ----
    const savedRoomCode = getSavedRoomCode();
    const savedPlayerId = getOrCreatePlayerId();
    if (savedRoomCode && savedPlayerId) {
      const tryRejoin = (event: string) => {
        if (socket.connected) {
          socket.emit(event, { roomCode: savedRoomCode, playerId: savedPlayerId });
        } else {
          socket.once('connect', () => {
            socket.emit(event, { roomCode: savedRoomCode, playerId: savedPlayerId });
          });
        }
      };

      // Try with saved game type first, fall back to letterguess
      const savedGame = getSavedGameType();
      const prefix = savedGame === 'wordchain' ? 'wc:' : '';
      tryRejoin(`${prefix}join_room`);
    }

    // ---- Room events ----

    socket.on('room_created', (data: { roomCode: string; playerId: string }) => {
      sessionStorage.setItem(ROOM_CODE_KEY, data.roomCode);
      setGs(prev => ({ ...prev, roomCode: data.roomCode, playerId: data.playerId }));
    });

    socket.on('room_joined', (data: any) => {
      sessionStorage.setItem(ROOM_CODE_KEY, data.roomCode);
      sessionStorage.setItem(GAME_TYPE_KEY, data.gameType || 'letterguess');
      setGs(prev => ({
        ...prev,
        view: data.state === 'LOBBY' ? 'lobby' : 'game',
        gameType: data.gameType || 'letterguess',
        roomCode: data.roomCode,
        playerId: data.playerId,
        roomCreatorId: data.roomCreatorId || data.players?.[0]?.id || null,
        players: data.players,
        maxPlayers: data.maxPlayers,
        state: data.state,
      }));
    });

    socket.on('player_joined', (data: any) => {
      setGs(prev => ({
        ...prev,
        players: [...prev.players.filter(p => p.id !== data.player.id), data.player],
      }));
    });

    socket.on('player_left', (data: { playerId: string; playerName: string }) => {
      setGs(prev => ({
        ...prev,
        players: prev.players.map(p =>
          p.id === data.playerId ? { ...p, connected: false } : p
        ),
      }));
    });

    socket.on('player_reconnected', (data: { playerId: string }) => {
      setGs(prev => ({
        ...prev,
        players: prev.players.map(p =>
          p.id === data.playerId ? { ...p, connected: true } : p
        ),
      }));
    });

    // ---- Game flow ----

    socket.on('game_started', (data: any) => {
      setGs(prev => ({
        ...prev,
        view: 'game',
        state: 'PLAYING',
        scores: {},
        roundEndData: null,
        sessionEndData: null,
        error: null,
      }));
    });

    // Word Chain: switch to game view when game starts
    socket.on('wc:game_started', () => {
      setGs(prev => ({ ...prev, view: 'game', state: 'PLAYING', error: null }));
    });

    socket.on('your_turn_create', (data: { timeLimit: number }) => {
      setGs(prev => ({
        ...prev,
        isMyTurn: true,
        myTurnType: 'create',
        turnTimeLimit: data.timeLimit,
        turnSecondsLeft: data.timeLimit,
      }));
    });

    socket.on('puzzle_set', (data: any) => {
      setGs(prev => ({
        ...prev,
        isMyTurn: false,
        myTurnType: null,
        turnTimeLimit: null,
        turnSecondsLeft: null,
        currentRound: {
          creatorId: data.creatorId,
          hint: data.hint || prev.currentRound?.hint || '',
          revealed: data.revealed,
          phase: (data.revealed && data.revealed.length > 0) ? 'PLAYING' : 'CREATION',
          turnOrder: data.turnOrder,
          turnIndex: 0,
          scores: prev.currentRound?.scores || {},
          usedLetters: prev.currentRound?.usedLetters || [],
          guessingPlayerId: null,
          perPlayer: prev.currentRound?.perPlayer || {},
        },
      }));
    });

    socket.on('your_turn_guess', (data: { timeLimit: number }) => {
      playYourTurn();
      setGs(prev => ({
        ...prev,
        isMyTurn: true,
        myTurnType: 'letter',
        turnTimeLimit: data.timeLimit,
        turnSecondsLeft: data.timeLimit,
      }));
    });

    socket.on('turn_changed', (data: { currentPlayerId: string; currentPlayerName?: string; timeLimit?: number }) => {
      const myId = gsRef.current.playerId;
      if (data.currentPlayerId === myId) {
        setGs(prev => ({
          ...prev,
          isMyTurn: true,
          myTurnType: 'letter',
          turnTimeLimit: data.timeLimit || 30,
          turnSecondsLeft: data.timeLimit || 30,
          waitingPlayerId: null,
          waitingPlayerName: null,
          waitingTimerSecondsLeft: null,
        }));
      } else {
        setGs(prev => ({
          ...prev,
          isMyTurn: false,
          myTurnType: null,
          waitingPlayerId: data.currentPlayerId,
          waitingPlayerName: data.currentPlayerName || '',
          waitingTimerSecondsLeft: data.timeLimit || 30,
        }));
      }
    });

    socket.on('letter_result', (data: any) => {
      if (data.correct) {
        playCorrectLetter();
      } else {
        playWrongLetter();
      }
      setGs(prev => ({
        ...prev,
        isMyTurn: false,
        myTurnType: null,
        turnTimeLimit: null,
        turnSecondsLeft: null,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          revealed: data.revealed,
          usedLetters: [...prev.currentRound.usedLetters, data.letter].filter(Boolean),
          scores: {
            ...prev.currentRound.scores,
            [data.playerId]: (prev.currentRound.scores[data.playerId] || 0) + data.scoreDelta,
          },
        } : null,
      }));
    });

    socket.on('answer_guess_started', (data: any) => {
      const myId = gsRef.current.playerId;
      setGs(prev => ({
        ...prev,
        guessingPlayerId: data.playerId,
        guessingPlayerName: data.playerName,
        isMeGuessing: data.playerId === myId,
        isMyTurn: false,
        myTurnType: null,
        turnTimeLimit: data.playerId === myId ? data.timeLimit : null,
        turnSecondsLeft: data.playerId === myId ? data.timeLimit : null,
        waitingTimerSecondsLeft: data.playerId !== myId ? data.timeLimit : null,
        waitingPlayerId: data.playerId !== myId ? data.playerId : null,
        waitingPlayerName: data.playerId !== myId ? data.playerName : null,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: 'GUESSING_ANSWER',
          guessingPlayerId: data.playerId,
        } : null,
      }));
    });

    socket.on('answer_submitted', (data: any) => {
      setGs(prev => ({
        ...prev,
        guessingPlayerId: null,
        guessingPlayerName: null,
        isMeGuessing: false,
        turnTimeLimit: null,
        turnSecondsLeft: null,
      }));
    });

    socket.on('answer_result', (data: any) => {
      if (data.correct) {
        playCorrectAnswer();
      } else {
        playWrongAnswer();
      }
      setGs(prev => {
        const updatedScores = { ...prev.currentRound?.scores };
        if (data.scoreDeltas) {
          for (const [pid, delta] of Object.entries(data.scoreDeltas)) {
            updatedScores[pid] = (updatedScores[pid] || 0) + (delta as number);
          }
        }
        return {
          ...prev,
          guessingPlayerId: null,
          guessingPlayerName: null,
          isMeGuessing: false,
          currentRound: prev.currentRound ? {
            ...prev.currentRound,
            phase: 'PLAYING',
            guessingPlayerId: null,
            scores: updatedScores,
          } : null,
        };
      });
    });

    socket.on('player_eliminated', (data: any) => {
      playEliminated();
      setGs(prev => ({
        ...prev,
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          perPlayer: {
            ...prev.currentRound.perPlayer,
            [data.playerId]: {
              ...prev.currentRound.perPlayer[data.playerId],
              eliminated: true,
            },
          },
        } : null,
      }));
    });

    socket.on('round_ended', (data: any) => {
      if (data.winnerId) {
        playRoundWin();
      } else {
        playNobodyWon();
      }
      setGs(prev => ({
        ...prev,
        isMyTurn: false,
        myTurnType: null,
        turnTimeLimit: null,
        turnSecondsLeft: null,
        guessingPlayerId: null,
        guessingPlayerName: null,
        isMeGuessing: false,
        scores: data.totalScores,
        roundEndData: {
          winnerId: data.winnerId,
          winnerName: data.winnerName,
          puzzle: data.puzzle,
        },
        currentRound: prev.currentRound ? {
          ...prev.currentRound,
          phase: 'ENDED',
          scores: data.scores,
        } : null,
      }));
    });

    socket.on('next_round_starting', (data: any) => {
      setGs(prev => ({
        ...prev,
        roundEndData: null,
        currentRound: null,
      }));
    });

    socket.on('session_ended', (data: any) => {
      setGs(prev => ({
        ...prev,
        state: 'ENDED',
        sessionEndData: {
          leaderboard: data.leaderboard,
          winnerId: data.winnerId,
          winnerName: data.winnerName,
        },
        isMyTurn: false,
        myTurnType: null,
      }));
    });

    // ---- Other ----

    socket.on('error', (data: { message: string }) => {
      setGs(prev => ({ ...prev, error: data.message }));
      // If room is gone, clear saved code so we don't keep trying to rejoin
      if (data.message.toLowerCase().includes('not found')) {
        sessionStorage.removeItem(ROOM_CODE_KEY);
      }
      setTimeout(() => setGs(prev => ({ ...prev, error: prev.error === data.message ? null : prev.error })), 10000);
    });

    socket.on('room_state', (data: RoomSnapshot) => {
      const myId = gsRef.current.playerId;
      const isMyTurnNow = data.currentRound
        ? (data.currentRound.creatorId === myId && data.currentRound.phase === 'CREATION')
          || (data.currentRound.turnOrder[data.currentRound.turnIndex] === myId && data.currentRound.phase === 'PLAYING')
        : false;
      setGs(prev => ({
        ...prev,
        view: data.state === 'LOBBY' ? 'lobby' : 'game',
        state: data.state,
        roomCreatorId: data.roomCreatorId || prev.roomCreatorId,
        players: data.players,
        maxPlayers: data.maxPlayers,
        currentRound: data.currentRound,
        rounds: data.rounds,
        scores: data.scores,
        roundEndData: null,
        sessionEndData: data.state === 'ENDED' ? prev.sessionEndData : null,
        isMyTurn: isMyTurnNow,
        myTurnType: isMyTurnNow
          ? (data.currentRound?.creatorId === myId ? 'create' : 'letter')
          : null,
        guessingPlayerId: data.currentRound?.guessingPlayerId || null,
        isMeGuessing: data.currentRound?.guessingPlayerId === myId,
      }));
    });

    socket.on('disconnect', () => {
      setGs(prev => ({ ...prev, error: 'Connection lost. Reconnecting...' }));
    });

    socket.on('connect', () => {
      setGs(prev => ({ ...prev, error: prev.error === 'Connection lost. Reconnecting...' ? null : prev.error }));
    });

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('player_reconnected');
      socket.off('game_started');
      socket.off('your_turn_create');
      socket.off('puzzle_set');
      socket.off('your_turn_guess');
      socket.off('turn_changed');
      socket.off('letter_result');
      socket.off('answer_guess_started');
      socket.off('answer_submitted');
      socket.off('answer_result');
      socket.off('player_eliminated');
      socket.off('round_ended');
      socket.off('next_round_starting');
      socket.off('session_ended');
      socket.off('error');
      socket.off('room_state');
    };
  }, []);

  // ---- Timer tick (client-side) ----

  useEffect(() => {
    const activeTimer = gs.turnSecondsLeft !== null ? gs.turnSecondsLeft :
                        gs.waitingTimerSecondsLeft !== null ? gs.waitingTimerSecondsLeft : null;
    if (activeTimer === null || activeTimer <= 0) return;

    const interval = setInterval(() => {
      setGs(prev => {
        // My turn countdown
        if (prev.turnSecondsLeft !== null && prev.turnSecondsLeft > 0) {
          return { ...prev, turnSecondsLeft: prev.turnSecondsLeft - 1 };
        }
        // Waiting countdown
        if (prev.waitingTimerSecondsLeft !== null && prev.waitingTimerSecondsLeft > 0) {
          return { ...prev, waitingTimerSecondsLeft: prev.waitingTimerSecondsLeft - 1 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gs.turnSecondsLeft, gs.waitingTimerSecondsLeft]);

  // ---- Actions ----

  const emit = useCallback((event: string, data?: any) => {
    getSocket().emit(event, data);
  }, []);

  // ---- Render ----

  return (
    <div className="min-h-screen bg-game-gradient text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-4 py-3 flex items-center justify-between backdrop-blur bg-black/20">
        <h1 className="text-xl font-black tracking-tight">
          {(gs.view === 'hub' || !gs.gameType) ? (
            <><span className="bg-neon-gradient bg-clip-text text-transparent">GAME</span><span className="text-white">HUB</span></>
          ) : (
            <><span className="bg-neon-gradient bg-clip-text text-transparent cursor-pointer" onClick={() => { setGs({ ...initialState, roomCode: null, playerId: getOrCreatePlayerId() }); }}>← </span><span className="text-white">{gs.gameType === 'letterguess' ? 'LETTERGUESS' : 'WORD CHAIN'}</span></>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const m = toggleMusicMute(); setMusicMuted(m); }}
            className={`text-sm font-semibold px-3 py-1.5 rounded-xl transition-all ${
              musicMuted ? 'bg-white/5 hover:bg-white/10 opacity-40' : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300'
            }`}
            title={musicMuted ? 'Play music' : 'Stop music'}
          >
            {musicMuted ? '🎵' : '🎶'}
          </button>
          <button
            onClick={() => { const m = toggleSfxMute(); setSfxMuted(m); }}
            className={`text-sm font-semibold px-3 py-1.5 rounded-xl transition-all ${
              sfxMuted ? 'bg-white/5 hover:bg-white/10 opacity-40' : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300'
            }`}
            title={sfxMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {sfxMuted ? '🔇' : '🔊'}
          </button>
          {(gs.view === 'lobby' || gs.view === 'game') && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="text-sm font-semibold text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 px-4 py-1.5 rounded-xl transition-all"
            >
              🚪 Leave
            </button>
          )}
        </div>
      </header>

      {/* Error toast */}
      {gs.error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/30 backdrop-blur animate-slide-up">
          ⚠️ {gs.error}
        </div>
      )}

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <LeaveConfirmModal
          onCancel={() => setShowLeaveConfirm(false)}
          onConfirm={() => {
            sessionStorage.removeItem(ROOM_CODE_KEY);
            emit(gs.gameType === 'wordchain' ? 'wc:leave_room' : 'leave_room');
            disconnectSocket();
            setShowLeaveConfirm(false);
            setGs({ ...initialState, view: 'hub', gameType: null, roomCode: null, playerId: getOrCreatePlayerId() });
            setTimeout(() => connectSocket(), 100);
          }}
        />
      )}

      {/* Views */}
      {gs.view === 'hub' && (
        <Hub onSelectGame={(gameId) => setGs(prev => ({ ...prev, view: 'home', gameType: gameId }))} />
      )}
      {gs.view === 'home' && <Home gs={gs} emit={emit} />}
      {gs.view === 'lobby' && <Lobby gs={gs} emit={emit} />}
      {gs.view === 'game' && gs.gameType === 'wordchain' && <WordChainGame gs={gs} emit={emit} />}
      {gs.view === 'game' && gs.gameType !== 'wordchain' && <Game gs={gs} emit={emit} />}
    </div>
  );
}
