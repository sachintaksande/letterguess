// ============================================================
// SessionEndModal — Final leaderboard with trophies
// ============================================================

import { GameState, LeaderboardEntry } from '../types';

interface Props {
  gs: GameState;
  emit: (event: string, data?: any) => void;
}

export default function SessionEndModal({ gs, emit }: Props) {
  const leaderboard: LeaderboardEntry[] = gs.sessionEndData?.leaderboard || [];

  const handlePlayAgain = () => {
    emit('leave_room');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4 bg-particles">
      <div className="glass-card-game p-8 max-w-md w-full border-purple-500/30 max-h-[90vh] overflow-y-auto animate-bounce-in">
        {/* Trophy */}
        <div className="text-center mb-6">
          <div className="text-8xl mb-4 animate-float drop-shadow-[0_0_40px_rgba(255,215,0,0.5)]">🏆</div>
          <h2 className="text-3xl font-black bg-gold-gradient bg-clip-text text-transparent">
            GAME OVER!
          </h2>
          <p className="text-purple-300 mt-1 font-semibold">Final Leaderboard</p>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3 mb-6">
          {leaderboard.map((entry, i) => {
            const isMe = entry.playerId === gs.playerId;
            const isWinner = i === 0;
            const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';

            return (
              <div
                key={entry.playerId}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                  isWinner
                    ? 'bg-gold-gradient/10 border-2 border-amber-500/40 shadow-lg shadow-amber-500/20'
                    : isMe
                    ? 'bg-purple-500/10 border border-purple-500/30'
                    : 'bg-white/5'
                }`}
              >
                {/* Rank */}
                <span className="text-4xl w-10 text-center">
                  {rankEmoji || <span className="text-gray-600 text-lg font-black">#{i + 1}</span>}
                </span>

                {/* Name + Stats */}
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-lg truncate ${
                    isWinner ? 'text-neon-yellow' : isMe ? 'text-neon-pink' : 'text-white'
                  }`}>
                    {entry.name}
                    {isMe && ' ⭐'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.roundsPlayed} rounds · {entry.totalPoints} total pts
                  </p>
                </div>

                {/* Average */}
                <div className={`text-right ${isWinner ? 'scale-110' : ''}`}>
                  <p className={`font-black text-2xl ${
                    entry.average >= 0 ? 'text-neon-lime' : 'text-red-400'
                  }`}>
                    {entry.average.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">avg</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Champion callout */}
        {leaderboard.length > 0 && (
          <div className="text-center mb-6 bg-amber-500/5 rounded-xl py-4 border border-amber-500/20">
            <p className="text-2xl mb-1">👑</p>
            <p className="text-neon-yellow font-black text-xl">
              {leaderboard[0].name}
            </p>
            <p className="text-amber-400/70 text-sm mt-0.5">is the CHAMPION!</p>
            <p className="text-xs text-gray-500 mt-1">Highest average score wins 🧠</p>
          </div>
        )}

        {/* Play again */}
        <button
          onClick={handlePlayAgain}
          className="w-full btn-neon btn-neon-pink py-4 text-lg"
        >
          🔄 Play Again
        </button>
      </div>
    </div>
  );
}
