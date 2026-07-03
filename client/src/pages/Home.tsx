// ============================================================
// Home — Create or join a room (GAME STYLE)
// ============================================================

import { useState, FormEvent } from 'react';
import { GameState } from '../types';

interface Props {
  gs: GameState;
  emit: (event: string, data?: any) => void;
}

export default function Home({ gs, emit }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    emit('create_room', {
      playerName: playerName || undefined,
      maxPlayers,
      maxRounds,
      playerId: gs.playerId,
    });
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setLoading(true);
    emit('join_room', {
      roomCode: roomCode.trim().toUpperCase(),
      playerName: playerName || undefined,
      playerId: gs.playerId,
    });
  };

  return (
    <div className="bg-particles">
      <main className="max-w-md mx-auto mt-8 sm:mt-16 px-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 animate-float">
          <div className="text-7xl mb-4 drop-shadow-[0_0_20px_rgba(255,45,149,0.5)]">🔤</div>
          <h2 className="text-4xl font-black tracking-tight bg-neon-gradient bg-clip-text text-transparent">
            LETTER<span className="text-white">GUESS</span>
          </h2>
          <p className="text-purple-300/60 mt-2 font-medium">The multiplayer word guessing arena</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl bg-game-card/60 backdrop-blur p-1.5 mb-6 border border-white/5">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              tab === 'create'
                ? 'bg-neon-gradient text-white shadow-lg shadow-purple-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏠 Create Room
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              tab === 'join'
                ? 'bg-neon-gradient text-white shadow-lg shadow-purple-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🚪 Join Room
          </button>
        </div>

        {/* Create Room Form */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} className="glass-card p-6 space-y-5 animate-slide-up">
            <div>
              <label className="block text-sm font-semibold text-purple-300 mb-1.5">🎭 Your Alias</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Random name if empty"
                maxLength={20}
                className="game-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-purple-300">👥 Players</label>
                <span className="text-2xl font-black text-neon-pink">{maxPlayers}</span>
              </div>
              <input
                type="range"
                min={2}
                max={20}
                value={maxPlayers}
                onChange={e => setMaxPlayers(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>2</span>
                <span>20</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-purple-300">🔄 Rounds</label>
                <span className="text-2xl font-black text-neon-cyan">{maxRounds === 0 ? '∞' : maxRounds}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={maxRounds}
                onChange={e => setMaxRounds(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>∞ (unlimited)</span>
                <span>20</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-neon btn-neon-pink py-4 text-lg"
            >
              {loading ? '⏳ Creating...' : '✨ Create Room'}
            </button>
          </form>
        )}

        {/* Join Room Form */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="glass-card p-6 space-y-5 animate-slide-up">
            <div>
              <label className="block text-sm font-semibold text-purple-300 mb-1.5">🎭 Your Alias</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Random name if empty"
                maxLength={20}
                className="game-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-purple-300 mb-1.5">🔑 Room Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
                maxLength={8}
                className="game-input text-center text-3xl tracking-[0.2em] font-black"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || roomCode.trim().length === 0}
              className="w-full btn-neon btn-neon-cyan py-4 text-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Joining...' : '🎮 Join Room'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
