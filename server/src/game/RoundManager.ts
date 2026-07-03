// ============================================================
// RoundManager — Individual round logic
// ============================================================

import { Room, PlayerInfo, PlayerRoundState, RoundData } from './types';

const LETTER_GUESS_LIMIT = 10;

export class RoundManager {
  private room: Room;
  private parent: any; // RoomManager reference for socket access

  constructor(room: Room, parent: any) {
    this.room = room;
    this.parent = parent;
  }

  initRound(creatorId: string, guesserIds: string[]): RoundData {
    // Shuffle guessers for turn order
    const shuffled = [...guesserIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const perPlayer: Record<string, PlayerRoundState> = {};
    const scores: Record<string, number> = {};

    for (const pid of guesserIds) {
      perPlayer[pid] = {
        letterGuesses: 0,
        wrongAnswerGuesses: 0,
        eliminated: false,
      };
      scores[pid] = 0;
    }

    // Creator also gets a score slot (for +5 bonuses from wrong answers)
    scores[creatorId] = 0;

    return {
      creatorId,
      puzzle: '',
      hint: '',
      revealed: [],
      phase: 'CREATION',
      turnOrder: shuffled,
      turnIndex: 0,
      scores,
      perPlayer,
      usedLetters: new Set(),
      guessingPlayerId: null,
      winnerId: null,
    };
  }

  getCurrentRound(): RoundData | undefined {
    if (this.room.currentRoundIndex < 0) return undefined;
    return this.room.rounds[this.room.currentRoundIndex];
  }

  setPuzzle(puzzle: string, hint: string): void {
    const round = this.getCurrentRound();
    if (!round) {
      console.error('[setPuzzle] ERROR: getCurrentRound() returned undefined! roundIndex:', this.room.currentRoundIndex, 'rounds length:', this.room.rounds.length);
      return;
    }

    // Normalize: collapse multiple spaces, trim
    const normalized = puzzle.replace(/\s+/g, ' ').trim();
    round.puzzle = normalized;
    round.hint = hint;

    // Build revealed: letters → '_', spaces → ' '
    round.revealed = normalized.split('').map(ch => ch === ' ' ? ' ' : '_');
    
    console.log(`[setPuzzle] Puzzle stored: "${round.puzzle}" (length ${round.puzzle.length})`);
  }

  getCurrentGuesser(): string | null {
    const round = this.getCurrentRound();
    if (!round || round.turnOrder.length === 0) return null;
    return round.turnOrder[round.turnIndex % round.turnOrder.length];
  }

  advanceTurnIndex(): void {
    const round = this.getCurrentRound();
    if (!round) return;
    round.turnIndex = (round.turnIndex + 1) % round.turnOrder.length;
  }

  getNextActiveGuesser(): string | null {
    const round = this.getCurrentRound();
    if (!round || round.turnOrder.length === 0) return null;

    const start = round.turnIndex;
    let attempts = 0;

    while (attempts < round.turnOrder.length) {
      const idx = (start + attempts) % round.turnOrder.length;
      const pid = round.turnOrder[idx];
      const state = round.perPlayer[pid];

      if (state && !state.eliminated && state.letterGuesses < LETTER_GUESS_LIMIT) {
        round.turnIndex = idx;
        return pid;
      }
      attempts++;
    }

    return null; // all exhausted
  }

  isAllRevealed(): boolean {
    const round = this.getCurrentRound();
    if (!round) return false;
    return round.revealed.every(ch => ch !== '_');
  }
}
