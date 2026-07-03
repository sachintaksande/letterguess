// ============================================================
// Client-side types (mirrors server types)
// ============================================================

export interface PlayerInfo {
  id: string;
  name: string;
  totalPoints: number;
  roundsPlayed: number;
  joinOrder: number;
  connected: boolean;
  spectating: boolean;
}

export interface PlayerRoundState {
  letterGuesses: number;
  wrongAnswerGuesses: number;
  eliminated: boolean;
}

export interface RoundSnapshot {
  creatorId: string;
  hint: string;
  revealed: string[];
  phase: 'CREATION' | 'PLAYING' | 'GUESSING_ANSWER' | 'ENDED';
  turnOrder: string[];
  turnIndex: number;
  scores: Record<string, number>;
  usedLetters: string[];
  guessingPlayerId: string | null;
  perPlayer: Record<string, PlayerRoundState>;
}

export interface RoundSummary {
  puzzle: string;
  hint: string;
  winnerId: string | null;
  scores: Record<string, number>;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  totalPoints: number;
  roundsPlayed: number;
  average: number;
}

export interface RoomSnapshot {
  code: string;
  state: 'LOBBY' | 'PLAYING' | 'ENDED';
  maxPlayers: number;
  roomCreatorId: string;
  players: PlayerInfo[];
  currentRound: RoundSnapshot | null;
  rounds: RoundSummary[];
  scores: Record<string, number>;
  creatorRotationOrder: string[];
  creatorRotationIndex: number;
}

export type GameView = 'hub' | 'home' | 'lobby' | 'game';

export interface GameState {
  view: GameView;
  gameType: string | null;       // 'letterguess' | 'wordchain'
  roomCode: string | null;
  playerId: string | null;
  playerName: string | null;
  roomCreatorId: string | null;
  players: PlayerInfo[];
  maxPlayers: number;
  state: 'LOBBY' | 'PLAYING' | 'ENDED' | null;

  // Current round
  currentRound: RoundSnapshot | null;
  rounds: RoundSummary[];
  scores: Record<string, number>;

  // Turn
  isMyTurn: boolean;
  myTurnType: 'letter' | 'create' | null;
  turnTimeLimit: number | null;
  turnSecondsLeft: number | null;

  // Waiting for others
  waitingPlayerId: string | null;
  waitingPlayerName: string | null;
  waitingTimerSecondsLeft: number | null;

  // Answer guessing
  guessingPlayerId: string | null;
  guessingPlayerName: string | null;
  isMeGuessing: boolean;

  // Round end
  roundEndData: {
    winnerId: string | null;
    winnerName: string | null;
    puzzle: string;
  } | null;

  // Session end
  sessionEndData: {
    leaderboard: LeaderboardEntry[];
    winnerId: string;
    winnerName: string;
  } | null;

  // Error
  error: string | null;
}
