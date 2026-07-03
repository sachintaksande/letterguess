// ============================================================
// Scoreboard — Funky leaderboard
// ============================================================

import { useState } from 'react';
import { PlayerInfo, RoundSnapshot } from '../types';

interface Props {
  players: PlayerInfo[];
  scores: Record<string, number>;
  roundScores?: Record<string, number>;
  currentRound: RoundSnapshot | null;
  myPlayerId: string | null;
}

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

export default function Scoreboard({ players, scores, roundScores, currentRound, myPlayerId }: Props) {
  const [open, setOpen] = useState(typeof window !== 'undefined' && window.innerWidth >= 640);

  const sorted = [...players]
    .filter(p => p.connected || scores[p.id] !== undefined)
    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  return (
    <div className="glass-card-game overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
      >
        <span className="text-sm font-bold text-purple-300 uppercase tracking-wider">
          🏆 Leaderboard
        </span>
        <span className={`text-xs text-gray-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      <div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-96' : 'max-h-0'}`}>
        <div className="px-4 pb-3 space-y-1.5">
          {sorted.map((player, i) => {
            const totalScore = scores[player.id] || 0;
            const roundScore = roundScores?.[player.id] || 0;
            const isCreator = currentRound?.creatorId === player.id;
            const isEliminated = currentRound?.perPlayer[player.id]?.eliminated;
            const avg = player.roundsPlayed > 0
              ? (totalScore / player.roundsPlayed).toFixed(1)
              : '-';

            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  player.id === myPlayerId
                    ? 'bg-purple-500/10 border border-purple-500/30'
                    : 'hover:bg-white/5'
                } ${!player.connected ? 'opacity-40' : ''}`}
              >
                <span className="w-6 text-center text-base">
                  {i < 3 ? MEDAL_EMOJIS[i] : <span className="text-gray-500 text-xs">#{i + 1}</span>}
                </span>
                <span className={`flex-1 truncate font-semibold ${
                  isEliminated ? 'text-red-400 line-through' : 'text-white'
                }`}>
                  {player.name}
                  {isCreator && ' 🎨'}
                </span>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                  roundScore > 0 ? 'bg-neon-lime/10 text-neon-lime' :
                  roundScore < 0 ? 'bg-red-500/10 text-red-400' :
                  'bg-white/5 text-gray-500'
                }`}>
                  {roundScore > 0 ? '▲' : roundScore < 0 ? '▼' : '•'} {roundScore > 0 ? '+' : ''}{roundScore}
                </span>
                <span className="font-black text-white w-12 text-right">
                  {totalScore}
                </span>
                <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
                  {avg}
                </span>
              </div>
            );
          })}

          <div className="flex justify-between text-[10px] text-gray-600 pt-1.5 px-3 border-t border-white/5 mt-1">
            <span>PLAYER</span>
            <span className="flex gap-10">
              <span>ROUND</span>
              <span>TOTAL</span>
              <span>AVG</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
