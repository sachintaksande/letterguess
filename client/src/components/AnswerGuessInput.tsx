// ============================================================
// AnswerGuessInput — Full answer guessing phase
// ============================================================

import { useState, FormEvent } from 'react';
import Timer from './Timer';

interface Props {
  emit: (event: string, data?: any) => void;
  secondsLeft: number | null;
}

export default function AnswerGuessInput({ emit, secondsLeft }: Props) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    emit('submit_answer', { answer: answer.trim() });
    setAnswer('');
  };

  return (
    <div className="glass-card-game p-6 border-2 border-amber-500/40 animate-bounce-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-black flex items-center gap-2">
          <span className="text-3xl">🎯</span>
          <span className="text-neon-orange">GUESS IT!</span>
        </h3>
        {secondsLeft !== null && (
          <Timer seconds={secondsLeft} total={20} label="TIME" urgent />
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="TYPE THE FULL ANSWER..."
          maxLength={60}
          className="game-input text-2xl font-black uppercase text-center tracking-wider py-5 border-amber-500/50 focus:border-amber-400"
          autoFocus
        />

        <button
          type="submit"
          disabled={!answer.trim()}
          className="w-full btn-neon btn-neon-amber py-4 text-lg disabled:opacity-30 disabled:cursor-not-allowed"
        >
          🔥 SUBMIT ANSWER
        </button>

        <div className="text-center text-xs text-amber-400/60 space-y-0.5">
          <p>⚠️ Wrong answer = <span className="text-red-400 font-bold">-10 pts</span> (+5 to everyone else)</p>
          <p>2 wrong answers = <span className="text-red-400 font-bold">ELIMINATED</span></p>
        </div>
      </form>
    </div>
  );
}
