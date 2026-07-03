// ============================================================
// LetterButtons — Funky A-Z grid
// ============================================================

interface Props {
  usedLetters: string[];
  disabled: boolean;
  onGuess: (letter: string) => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function LetterButtons({ usedLetters, disabled, onGuess }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
      {ALPHABET.map(letter => {
        const used = usedLetters.includes(letter);
        return (
          <button
            key={letter}
            onClick={() => !used && !disabled && onGuess(letter)}
            disabled={used || disabled}
            className={`letter-btn ${used || disabled ? 'letter-btn-used' : 'letter-btn-active'}`}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
