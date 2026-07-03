// ============================================================
// WordChainGame — Main game board
// ============================================================

import { useState, useEffect } from 'react';
import Timer from '../../components/Timer';
import { getSocket } from '../../socket';

interface WCPlayer {
  id: string;
  name: string;
  strikes: number;
  score: number;
  eliminated: boolean;
  connected: boolean;
}

interface Props {
  gs: any;
  emit: (event: string, data?: any) => void;
}

const STRIKE_EMOJI = ['', '⚠️', '⚠️⚠️', '💀'];

export default function WordChainGame({ gs, emit }: Props) {
  const [myWord, setMyWord] = useState('');
  const [lastResult, setLastResult] = useState<{ word: string; playerName: string; valid: boolean; reason?: string } | null>(null);
  const [currentWord, setCurrentWord] = useState('');
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [phase, setPhase] = useState<'LOBBY' | 'PLAYING' | 'ENDED'>(gs.state || 'LOBBY');
  const [players, setPlayers] = useState<WCPlayer[]>(gs.players || []);
  const [gameEnded, setGameEnded] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const myId = gs.playerId;
  const isMyTurn = currentPlayerId === myId;
  const lastLetter = currentWord ? currentWord[currentWord.length - 1].toUpperCase() : '';

  // ---- Timer ----
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  // ---- Socket events ----
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onGameStarted = (data: any) => {
      setCurrentWord(data.currentWord);
      setPhase('PLAYING');
      setCurrentPlayerId(data.currentPlayerId);
      setCurrentPlayerName(data.currentPlayerName);
      setSecondsLeft(data.timeLimit);
      setTimeLimit(data.timeLimit);
      setLastResult({ word: data.currentWord, playerName: 'Game', valid: true });
    };
    const onTurnUpdate = (data: any) => {
      setCurrentPlayerId(data.currentPlayerId);
      setCurrentPlayerName(data.currentPlayerName);
      setCurrentWord(data.currentWord);
      setSecondsLeft(data.timeLimit);
      setTimeLimit(data.timeLimit);
    };
    const onWordResult = (data: any) => {
      setLastResult({ word: data.word, playerName: data.playerName, valid: data.valid, reason: data.reason });
      if (data.valid) {
        setCurrentWord(data.word);
        setSecondsLeft(null);
      }
      if (data.eliminated) {
        setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, strikes: data.strikes, score: data.score, eliminated: true } : p));
      } else {
        setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, strikes: data.strikes, score: data.score } : p));
      }
    };
    const onPlayerEliminated = (data: any) => {
      setLastResult({ word: '', playerName: data.playerName, valid: false, reason: `${data.strikes} strikes — eliminated!` });
    };
    const onGameEnded = (data: any) => {
      setPhase('ENDED');
      setGameEnded(data);
      setSecondsLeft(null);
    };

    socket.on('wc:game_started', onGameStarted);
    socket.on('wc:turn_update', onTurnUpdate);
    socket.on('wc:word_result', onWordResult);
    socket.on('wc:player_eliminated', onPlayerEliminated);
    socket.on('wc:game_ended', onGameEnded);

    return () => {
      socket.off('wc:game_started', onGameStarted);
      socket.off('wc:turn_update', onTurnUpdate);
      socket.off('wc:word_result', onWordResult);
      socket.off('wc:player_eliminated', onPlayerEliminated);
      socket.off('wc:game_ended', onGameEnded);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myWord.trim()) return;
    emit('wc:guess_word', { word: myWord.trim() });
    setMyWord('');
  };

  // ---- Game ended ----
  if (gameEnded) {
    return (
      <div className="bg-particles min-h-screen">
        <main className="max-w-md mx-auto pt-10 px-4 relative z-10 text-center">
          <div className="text-6xl mb-6">🏆</div>
          <h2 className="text-3xl font-black mb-2">
            <span className="bg-neon-gradient bg-clip-text text-transparent">{gameEnded.winnerName}</span>
            <span className="text-white"> wins!</span>
          </h2>
          <p className="text-gray-400 mb-8">Last word: <span className="text-neon-cyan font-bold">{gameEnded.currentWord}</span></p>

          <div className="glass-card-game p-4 space-y-2 mb-6">
            {gameEnded.players.map((p: any) => (
              <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${p.id === gameEnded.winnerId ? 'bg-neon-lime/10 border border-neon-lime/20' : ''}`}>
                <span className="font-bold text-white">{p.name}</span>
                <span className="text-sm">{STRIKE_EMOJI[p.strikes] || '✅'}</span>
                <span className={`text-xs font-bold w-8 text-right ${(p.score || 0) >= 0 ? 'text-neon-lime' : 'text-red-400'}`}>
                  {(p.score || 0) > 0 ? '+' : ''}{p.score || 0}
                </span>
              </div>
            ))}
          </div>

          <button onClick={() => emit('wc:leave_room')} className="btn-neon btn-neon-pink px-8 py-3">
            🚪 Leave
          </button>
        </main>
      </div>
    );
  }

  // ---- Playing ----
  return (
    <div className="bg-particles min-h-screen">
      <main className="max-w-md mx-auto pt-4 px-4 relative z-10">

        {/* Current word display */}
        <div className="glass-card-game p-6 mb-6 text-center animate-slide-up">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Current Word</p>
          <h2 className="text-5xl font-black text-neon-cyan tracking-wider mb-2">{currentWord}</h2>
          {lastLetter && (
            <p className="text-sm text-purple-300">
              Next word must start with <span className="text-neon-pink font-black text-2xl">{lastLetter}</span>
            </p>
          )}
        </div>

        {/* Turn indicator */}
        <div className="text-center mb-4">
          {isMyTurn ? (
            <div className="inline-flex items-center gap-2 glass-card px-5 py-2 animate-pulse-glow border-neon-cyan/30">
              <span className="text-xl">🎯</span>
              <span className="text-neon-cyan font-bold text-lg">Your turn!</span>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              ⏳ <span className="text-white font-bold">{currentPlayerName || '...'}</span> is thinking...
              {secondsLeft !== null && !isMyTurn && (
                <span className={`ml-2 font-mono font-bold ${secondsLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-neon-cyan'}`}>
                  {secondsLeft}s
                </span>
              )}
            </p>
          )}
        </div>

        {/* Input */}
        {phase === 'PLAYING' && (
          <form onSubmit={handleSubmit} className="mb-6 animate-slide-up">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-black text-xl">
                  {lastLetter}
                </span>
                <input
                  type="text"
                  value={myWord}
                  onChange={e => setMyWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  placeholder={isMyTurn ? `Word starting with ${lastLetter}...` : 'Wait for your turn...'}
                  disabled={!isMyTurn}
                  maxLength={30}
                  className="game-input pl-10 text-lg font-bold"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!isMyTurn || !myWord.trim()}
                className="btn-neon btn-neon-cyan px-6 py-3 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                GO
              </button>
            </div>
            {isMyTurn && secondsLeft !== null && (
              <div className="mt-3">
                <Timer seconds={secondsLeft} total={timeLimit} label="TIME" urgent={secondsLeft <= 3} />
              </div>
            )}
          </form>
        )}

        {/* Last result */}
        {lastResult && phase === 'PLAYING' && (
          <div className={`glass-card px-4 py-3 mb-4 text-center animate-slide-up ${
            lastResult.valid ? 'border-neon-lime/20' : 'border-red-500/20'
          }`}>
            {lastResult.valid ? (
              <p><span className="text-neon-lime font-bold">{lastResult.playerName}</span> → <span className="text-white font-black">{lastResult.word}</span> <span className="text-neon-lime text-xs ml-1">+1</span></p>
            ) : lastResult.word ? (
              <p>
                <span className="text-red-400 font-bold">{lastResult.playerName}</span>
                <span className="text-gray-400"> tried </span>
                <span className="text-red-300 line-through">{lastResult.word}</span>
                <span className="text-red-400"> — {lastResult.reason}</span>
              </p>
            ) : (
              <p className="text-red-400">{lastResult.playerName}: {lastResult.reason}</p>
            )}
            {!lastResult.valid && (
              <p className="text-amber-400 text-xs mt-1 font-bold">⏭️ Turn skipped · −1 point</p>
            )}
          </div>
        )}

        {/* Player list */}
        <div className="glass-card-game p-4 animate-slide-up">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider mb-3">👥 Players</h3>
          <div className="space-y-1.5">
            {players.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  p.id === currentPlayerId ? 'bg-purple-500/10 border border-purple-500/30' :
                  p.eliminated ? 'opacity-30' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    p.eliminated ? 'bg-red-500' : p.connected ? 'bg-neon-lime' : 'bg-gray-600'
                  }`} />
                  <span className="font-bold text-white">{p.name}</span>
                  {p.id === myId && <span className="text-xs text-purple-400">(You)</span>}
                </div>
                <span className="text-sm">{STRIKE_EMOJI[p.strikes] || '✅'}</span>
                <span className={`text-xs font-bold w-8 text-right ${(p.score || 0) >= 0 ? 'text-neon-lime' : 'text-red-400'}`}>
                  {(p.score || 0) > 0 ? '+' : ''}{p.score || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold animate-slide-up">
            ⚠️ {error}
          </div>
        )}
      </main>
    </div>
  );
}
