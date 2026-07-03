// ============================================================
// Timer — Neon countdown
// ============================================================

interface Props {
  seconds: number;
  total: number;
  label: string;
  urgent?: boolean;
}

export default function Timer({ seconds, total, label, urgent }: Props) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const isLow = seconds <= 5;

  const barColor = urgent && isLow
    ? 'bg-red-500 shadow-red-500/50'
    : isLow
    ? 'bg-neon-orange shadow-neon-orange/50'
    : 'bg-neon-cyan shadow-neon-cyan/50';

  const textColor = urgent && isLow
    ? 'text-red-400'
    : isLow
    ? 'text-neon-orange'
    : 'text-neon-cyan';

  return (
    <div className="glass-card px-4 py-2 flex items-center gap-3">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-black tabular-nums ${textColor} ${isLow ? 'animate-pulse' : ''}`}>
        {seconds}
      </span>
      <div className="w-20 sm:w-28 bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${barColor}`}
          style={{ width: `${pct}%`, boxShadow: `0 0 8px currentColor` }}
        />
      </div>
    </div>
  );
}
