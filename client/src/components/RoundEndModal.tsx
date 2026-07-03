// ============================================================
// RoundEndModal — Round results with manual dismiss + avg explanation
// ============================================================

import { PlayerInfo } from '../types';

interface Props {
  winnerId: string | null;
  winnerName: string | null;
  puzzle: string;
  players: PlayerInfo[];
  scores: Record<string, number>;
  myPlayerId: string | null;
  onDismiss: () => void;
}

export default function RoundEndModal({ winnerId, winnerName, puzzle, players, scores, myPlayerId, onDismiss }: Props) {
  const sorted = [...players]
    .filter(p => p.connected || scores[p.id] !== undefined)
    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  const winner = winnerId ? players.find(p => p.id === winnerId) : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-bounce-in">
      <div className="glass-card-game p-8 max-w-sm w-full border-purple-500/30 max-h-[90vh] overflow-y-auto">
        {/* Result */}
        <div className="text-center mb-5">
          {winnerId ? (
            <>
              <div className="text-7xl mb-3 animate-float">🎉</div>
              <h2 className="text-2xl font-black bg-gold-gradient bg-clip-text text-transparent">
                {winnerId === myPlayerId ? 'YOU WON!' : `${winnerName} WON!`}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                +10 points for guessing <span className="text-white font-bold">{puzzle}</span>
              </p>
            </>
          ) : (
            <>
              <div className="text-7xl mb-3">😐</div>
              <h2 className="text-2xl font-black text-gray-400">Nobody won!</h2>
              <p className="text-sm text-gray-400 mt-1">
                Puzzle was: <span className="text-white font-bold text-lg">{puzzle}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">All letters revealed before anyone guessed the answer</p>
            </>
          )}
        </div>

        {/* Leaderboard */}
        <div className="space-y-1.5 mb-4">
          {sorted.map((player, i) => {
            const isMe = player.id === myPlayerId;
            const avg = player.roundsPlayed > 0
              ? ((scores[player.id] || 0) / player.roundsPlayed).toFixed(1)
              : '0.0';

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold ${
                  isMe ? 'bg-purple-500/10 border border-purple-500/30' : ''
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-base flex-shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-gray-500 text-xs">#{i+1}</span>}
                  </span>
                  <span className={`truncate ${isMe ? 'text-neon-pink' : 'text-white'}`}>{player.name}</span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className={`font-mono text-xs ${(scores[player.id] || 0) >= 0 ? 'text-neon-lime' : 'text-red-400'}`}>
                    {scores[player.id] || 0} pts
                  </span>
                  <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
                    {avg}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Average scoring explanation */}
        <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3 mb-4 text-xs text-gray-400 text-center">
          <p className="font-semibold text-purple-300 mb-1">🏆 Winner = highest <span className="text-white">average</span> (points ÷ rounds)</p>
          <p>Not total points — so missing a round as creator doesn't hurt you!</p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="w-full btn-neon btn-neon-pink py-3 text-base"
        >
          Got it — next round! 🔄
        </button>
      </div>
    </div>
  );
}
