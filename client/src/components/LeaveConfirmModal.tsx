// ============================================================
// LeaveConfirmModal — "Are you sure?" dialog
// ============================================================

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LeaveConfirmModal({ onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-bounce-in">
      <div className="glass-card-game p-6 max-w-xs w-full border-red-500/30 text-center">
        <div className="text-5xl mb-4">🚪</div>
        <h2 className="text-xl font-black text-white mb-2">Leave Game?</h2>
        <p className="text-gray-400 text-sm mb-6">
          You'll lose your spot and can't rejoin this game.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            Stay
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-all"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
