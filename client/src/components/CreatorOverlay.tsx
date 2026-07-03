// ============================================================
// CreatorOverlay — Puzzle creation with review step
// ============================================================

import { useState, FormEvent } from 'react';
import Timer from './Timer';
import PuzzleBoard from './PuzzleBoard';

interface Props {
  emit: (event: string, data?: any) => void;
  timeLimit: number;
  secondsLeft: number | null;
}

export default function CreatorOverlay({ emit, timeLimit, secondsLeft }: Props) {
  const [puzzle, setPuzzle] = useState('');
  const [hint, setHint] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const cleanPuzzle = puzzle.toUpperCase().trim();
  const isValid = cleanPuzzle.length >= 2 && /^[A-Z ]+$/.test(cleanPuzzle);
  const revealedPreview = cleanPuzzle.split('').map(ch => ch === ' ' ? ' ' : '_');

  const handleReview = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setReviewing(true);
  };

  const handleConfirm = () => {
    emit('submit_puzzle', {
      puzzle: cleanPuzzle,
      hint: hint.trim(),
    });
  };

  const handleEdit = () => {
    setReviewing(false);
  };

  // ---- REVIEW STEP ----
  if (reviewing) {
    return (
      <div className="glass-card-game p-6 animate-slide-up border-purple-500/40">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-black flex items-center gap-2">
            <span className="text-2xl">👀</span>
            <span className="bg-neon-gradient bg-clip-text text-transparent">Review Puzzle</span>
          </h3>
          {secondsLeft !== null && (
            <Timer seconds={secondsLeft} total={timeLimit} label="TIME" urgent />
          )}
        </div>

        {/* Puzzle preview */}
        <div className="text-center mb-6 py-4">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Your puzzle</p>
          <p className="text-white font-black text-xl mb-3">{cleanPuzzle}</p>
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Players will see</p>
          <PuzzleBoard revealed={revealedPreview} phase="CREATION" />
          {cleanPuzzle.length > 12 && (
            <p className="text-xs text-amber-400/60 mt-2">⚠️ Long puzzle — tiles will be smaller</p>
          )}
          <p className="text-xs text-gray-500 mt-2">{cleanPuzzle.length} characters</p>
        </div>

        {/* Hint preview */}
        {hint.trim() && (
          <div className="text-center mb-6 glass-card py-3 px-4">
            <p className="text-xs text-gray-500 mb-1">Hint</p>
            <p className="text-neon-yellow font-bold text-lg">💡 {hint.trim()}</p>
          </div>
        )}

        {!hint.trim() && (
          <div className="text-center mb-6">
            <p className="text-xs text-gray-500">No hint provided</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleEdit}
            className="flex-1 py-4 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            ✏️ Edit
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 btn-neon btn-neon-pink py-4 text-base"
          >
            ✅ Confirm & Launch!
          </button>
        </div>
      </div>
    );
  }

  // ---- EDIT STEP ----
  return (
    <div className="glass-card-game p-6 animate-slide-up border-purple-500/40">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-black flex items-center gap-2">
          <span className="text-2xl">🎨</span>
          <span className="bg-neon-gradient bg-clip-text text-transparent">Create Puzzle</span>
        </h3>
        {secondsLeft !== null && (
          <Timer seconds={secondsLeft} total={timeLimit} label="TIME" urgent />
        )}
      </div>

      <form onSubmit={handleReview} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-purple-300 mb-1.5">
            📝 Puzzle Phrase
            <span className="text-gray-500 text-xs ml-2 font-normal">letters & spaces only</span>
          </label>
          <input
            type="text"
            value={puzzle}
            onChange={e => setPuzzle(e.target.value)}
            placeholder='e.g. HARRY POTTER'
            maxLength={60}
            className="game-input text-lg font-bold uppercase tracking-wide"
            autoFocus
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">
              {puzzle.length}/60 chars
            </span>
            {puzzle.trim() && !/^[A-Z ]+$/i.test(puzzle.trim()) && (
              <span className="text-xs text-red-400">Letters & spaces only!</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-purple-300 mb-1.5">
            💡 Hint
            <span className="text-gray-500 text-xs ml-2 font-normal">optional but fun</span>
          </label>
          <input
            type="text"
            value={hint}
            onChange={e => setHint(e.target.value)}
            placeholder='e.g. A movie about wizards'
            maxLength={100}
            className="game-input"
          />
        </div>

        <button
          type="submit"
          disabled={!isValid}
          className="w-full btn-neon btn-neon-pink py-4 text-lg disabled:opacity-30 disabled:cursor-not-allowed"
        >
          🚀 Review Puzzle
        </button>
      </form>
    </div>
  );
}
