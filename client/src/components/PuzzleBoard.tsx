// ============================================================
// PuzzleBoard — Word groups with colored outlines
// ============================================================

interface Props {
  revealed: string[];
  phase: string;
}

export default function PuzzleBoard({ revealed, phase }: Props) {
  if (!revealed || revealed.length === 0) {
    return (
      <div className="flex justify-center items-center h-20 text-purple-300/40">
        <span className="text-2xl animate-pulse">
          {phase === 'CREATION' ? '🎨 Creating puzzle...' : ''}
        </span>
      </div>
    );
  }

  // Group tiles into words (split by spaces)
  const words: string[][] = [];
  let currentWord: string[] = [];
  for (const ch of revealed) {
    if (ch === ' ') {
      if (currentWord.length > 0) words.push(currentWord);
      currentWord = [];
    } else {
      currentWord.push(ch);
    }
  }
  if (currentWord.length > 0) words.push(currentWord);

  // Responsive sizing: shrink tiles when the longest word won't fit
  const longestWord = Math.max(...words.map(w => w.length), 0);
  const tileSizeClass = longestWord > 18 ? 'puzzle-letter-xs'
    : longestWord > 12 ? 'puzzle-letter-sm'
    : longestWord > 8 ? 'puzzle-letter-md'
    : '';

  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-3 py-2">
      {words.map((word, wi) => (
        <span
          key={wi}
          className="inline-flex flex-wrap gap-0.5 px-1.5 py-1 rounded-xl border-2 border-white/15"
        >
          {word.map((char, ci) => (
            <span
              key={ci}
              className={`puzzle-letter ${tileSizeClass} ${
                char !== '_'
                  ? 'puzzle-revealed'
                  : 'puzzle-hidden'
              }`}
            >
              {char !== '_' ? char : ''}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}
