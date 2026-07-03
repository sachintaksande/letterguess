// ============================================================
// Lobby — Game room waiting screen
// ============================================================

import { useState } from 'react';
import { GameState } from '../types';

interface Props {
  gs: GameState;
  emit: (event: string, data?: any) => void;
}

const AVATAR_EMOJIS = ['🦊', '🦉', '🐯', '🐼', '🐱', '🦅', '🐋', '🦅', '🐺', '🐶',
  '🦝', '🦈', '🐆', '🦦', '🐰', '🦌', '🐸', '🦡', '🐻', '🦢'];

export default function Lobby({ gs, emit }: Props) {
  const [shared, setShared] = useState(false);

  const shareUrl = gs.roomCode ? `${window.location.origin}?game=letterguess&code=${gs.roomCode}` : '';

  const shareCode = async () => {
    if (!gs.roomCode) return;
    const shareText = `Join my LetterGuess room!\n${shareUrl}`;

    // 1. Try native share (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'LetterGuess Room', text: shareText });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch {} // user cancelled or HTTPS required — continue to fallback
    }

    // 2. Try clipboard API (HTTPS only)
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
      return;
    } catch {}

    // 3. Old-school copy (works on HTTP / iOS)
    try {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Nothing more we can do — URL is visible for manual copy
    }
  };

  const connectedCount = gs.players.filter(p => p.connected).length;

  return (
    <div className="bg-particles">
      <main className="max-w-lg mx-auto mt-6 px-4 relative z-10">
        {/* Room Code */}
        <div className="text-center mb-8 animate-slide-up">
          <p className="text-sm text-purple-300/60 mb-3 font-semibold">📋 Share this code</p>
          <button
            onClick={shareCode}
            className="room-code-display inline-flex items-center gap-3 px-8 py-5 group transition-all duration-300"
          >
            <span className="text-5xl font-black text-neon-cyan">
              {gs.roomCode}
            </span>
            <span className="text-2xl group-hover:scale-125 transition-transform">
              {shared ? '✅' : '📋'}
            </span>
          </button>
          {shared && (
            <p className="text-neon-lime text-sm mt-2 animate-bounce-in">Link copied!</p>
          )}
          <p className="text-gray-500 text-xs mt-2 break-all select-all">{shareUrl}</p>
        </div>

        {/* Players */}
        <div className="glass-card-game p-6 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">
              👥 Players <span className="text-neon-pink">({connectedCount}/{gs.maxPlayers})</span>
            </h3>
            {connectedCount >= 2 && (
              <span className="text-xs text-neon-lime animate-pulse-glow px-2 py-1 rounded-full bg-neon-lime/10">
                Ready!
              </span>
            )}
          </div>

          <div className="space-y-2">
            {gs.players.map((player, i) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  player.id === gs.playerId
                    ? 'bg-purple-500/10 border border-purple-500/30'
                    : 'hover:bg-white/5'
                } ${!player.connected ? 'opacity-40' : ''}`}
              >
                <div className={`player-avatar ${!player.connected ? 'grayscale' : ''}`}>
                  {AVATAR_EMOJIS[i % AVATAR_EMOJIS.length]}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`font-bold truncate block ${player.id === gs.playerId ? 'text-neon-pink' : 'text-white'}`}>
                    {player.name}
                    {player.id === gs.playerId && (
                      <span className="text-xs ml-1 text-purple-400">(You)</span>
                    )}
                  </span>
                  {player.spectating && (
                    <span className="text-xs text-amber-400">👀 Spectator</span>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  player.connected
                    ? 'bg-neon-lime/10 text-neon-lime'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {player.connected ? 'ONLINE' : 'OFF'}
                </span>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: gs.maxPlayers - gs.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-700/30 opacity-40"
              >
                <div className="w-10 h-10 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-600">
                  ?
                </div>
                <span className="text-gray-600 text-sm">Waiting for player...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Start Game */}
        {gs.roomCreatorId === gs.playerId ? (
          <button
            onClick={() => emit('start_game')}
            disabled={connectedCount < 2}
            className="w-full btn-neon btn-neon-pink py-5 text-xl disabled:opacity-20 disabled:cursor-not-allowed animate-slide-up"
          >
            {connectedCount < 2
              ? '⏳ Waiting for more players...'
              : '🚀 LAUNCH GAME!'}
          </button>
        ) : (
          <div className="text-center py-4 glass-card animate-slide-up">
            <p className="text-gray-400 text-sm">
              ⏳ Waiting for room creator to start the game...
            </p>
            <p className="text-purple-300/60 text-xs mt-1">
              {gs.players.find(p => p.id === gs.roomCreatorId)?.name || 'Creator'} is in charge
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 mt-4">
          Only the room creator can start the game ✨
        </p>
      </main>
    </div>
  );
}
