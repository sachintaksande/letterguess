// ============================================================
// Hub — Game selection page
// ============================================================

import { useState, useEffect } from 'react';

interface GameInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  players: string;
  comingSoon?: boolean;
}

interface Props {
  onSelectGame: (gameId: string) => void;
}

export default function Hub({ onSelectGame }: Props) {
  const [games, setGames] = useState<GameInfo[]>([]);

  useEffect(() => {
    fetch('/api/games')
      .then(r => r.json())
      .then(data => setGames(data.games))
      .catch(() => {
        // Fallback if server not reachable
        setGames([
          { id: 'letterguess', name: 'LetterGuess', icon: '🔤', description: 'Multiplayer word guessing — Hangman with a twist', players: '2-20' },
          { id: 'wordchain', name: 'Word Chain', icon: '🔗', description: 'Chain words by their last letter before time runs out', players: '2-8', comingSoon: true },
        ]);
      });
  }, []);

  return (
    <div className="bg-particles">
      <main className="max-w-lg mx-auto mt-8 sm:mt-16 px-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 animate-float">
          <div className="text-7xl mb-4 drop-shadow-[0_0_20px_rgba(255,45,149,0.5)]">🎮</div>
          <h2 className="text-4xl font-black tracking-tight bg-neon-gradient bg-clip-text text-transparent">
            GAME<span className="text-white">HUB</span>
          </h2>
          <p className="text-purple-300/60 mt-2 font-medium">Pick a game and play with friends</p>
        </div>

        {/* Game cards */}
        <div className="space-y-4 animate-slide-up">
          {games.map(game => (
            <button
              key={game.id}
              onClick={() => !game.comingSoon && onSelectGame(game.id)}
              disabled={game.comingSoon}
              className={`w-full glass-card-game p-5 text-left transition-all duration-300 ${
                game.comingSoon
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:scale-[1.02] hover:border-purple-500/40 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-5xl">{game.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white">{game.name}</h3>
                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                      {game.players} players
                    </span>
                    {game.comingSoon && (
                      <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-semibold">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{game.description}</p>
                </div>
                {!game.comingSoon && (
                  <span className="text-2xl text-purple-400">→</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          More games coming soon ✨
        </p>
      </main>
    </div>
  );
}
