// ============================================================
// LetterGuess — Shared Types
// ============================================================

export type RoomPhase = 'LOBBY' | 'PLAYING' | 'ENDED';
export type RoundPhase = 'CREATION' | 'PLAYING' | 'GUESSING_ANSWER' | 'ENDED';

export interface PlayerInfo {
  id: string;
  name: string;
  totalPoints: number;
  roundsPlayed: number;       // rounds where this player was a guesser (excludes their creator rounds)
  joinOrder: number;
  connected: boolean;
  spectating: boolean;        // true if joined mid-round, becomes active next round
}

export interface PlayerRoundState {
  letterGuesses: number;      // 0-10
  wrongAnswerGuesses: number; // 0-2 (eliminated at 2)
  eliminated: boolean;
}

export interface RoundData {
  creatorId: string;
  puzzle: string;             // uppercase, spaces only — e.g. "HARRY POTTER"
  hint: string;
  revealed: string[];         // each char: '_' | ' ' | letter
  phase: RoundPhase;
  turnOrder: string[];        // player IDs excluding creator, shuffled at round start
  turnIndex: number;
  scores: Record<string, number>;        // playerId → round score
  perPlayer: Record<string, PlayerRoundState>;
  usedLetters: Set<string>;
  guessingPlayerId: string | null;       // set when someone presses "Guess Answer"
  winnerId: string | null;               // set when round ends with a winner
}

export interface Room {
  code: string;
  gameType: 'letterguess' | 'wordchain';  // which game this room is for
  maxPlayers: number;
  maxRounds: number;                // 0 = unlimited (letterguess-specific)
  state: RoomPhase;
  roomCreatorId: string;              // who created the room (can start game)
  players: Map<string, PlayerInfo>;
  rounds: RoundData[];               // letterguess-specific
  currentRoundIndex: number;         // letterguess-specific
  createdAt: Date;
  lastActivityAt: Date;
  creatorRotationOrder: string[];   // letterguess-specific
  creatorRotationIndex: number;     // letterguess-specific
}

// ----- Socket event payloads (server → client) -----

export interface ServerEvents {
  room_created: (data: { roomCode: string; playerId: string }) => void;
  room_joined: (data: { roomCode: string; playerId: string; players: PlayerInfo[]; maxPlayers: number; state: RoomPhase }) => void;
  player_joined: (data: { player: PlayerInfo }) => void;
  player_left: (data: { playerId: string; playerName: string }) => void;
  player_reconnected: (data: { playerId: string }) => void;
  game_started: (data: { firstCreatorId: string; turnOrder: string[]; maxPlayers: number }) => void;
  your_turn_create: (data: { timeLimit: number }) => void;
  puzzle_set: (data: { creatorId: string; hint: string; revealed: string[]; turnOrder: string[] }) => void;
  your_turn_guess: (data: { timeLimit: number }) => void;
  turn_changed: (data: { currentPlayerId: string }) => void;
  letter_result: (data: { playerId: string; playerName: string; letter: string; positions: number[]; revealed: string[]; scoreDelta: number; correct: boolean }) => void;
  answer_guess_started: (data: { playerId: string; playerName: string; timeLimit: number }) => void;
  answer_submitted: (data: { playerId: string; correct: boolean; answer: string; roundEnded: boolean }) => void;
  answer_result: (data: { playerId: string; playerName: string; correct: boolean; answer?: string; scoreDeltas: Record<string, number>; roundEnded: boolean }) => void;
  player_eliminated: (data: { playerId: string; playerName: string }) => void;
  round_ended: (data: { winnerId: string | null; winnerName: string | null; puzzle: string; scores: Record<string, number>; totalScores: Record<string, number> }) => void;
  next_round_starting: (data: { newCreatorId: string; inSeconds: number }) => void;
  session_ended: (data: { leaderboard: LeaderboardEntry[]; winnerId: string; winnerName: string }) => void;
  timer_tick: (data: { secondsLeft: number }) => void;
  error: (data: { message: string }) => void;
  room_state: (data: RoomSnapshot) => void;
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
  state: RoomPhase;
  maxPlayers: number;
  roomCreatorId: string;
  players: PlayerInfo[];
  currentRound: RoundSnapshot | null;
  rounds: RoundSummary[];
  scores: Record<string, number>;       // total scores
  creatorRotationOrder: string[];
  creatorRotationIndex: number;
}

export interface RoundSnapshot {
  creatorId: string;
  hint: string;
  revealed: string[];
  phase: RoundPhase;
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

// ----- Socket event payloads (client → server) -----

export interface ClientEvents {
  create_room: (data: { playerName: string; maxPlayers: number }) => void;
  join_room: (data: { roomCode: string; playerName: string; playerId?: string }) => void;
  start_game: () => void;
  submit_puzzle: (data: { puzzle: string; hint: string }) => void;
  guess_letter: (data: { letter: string }) => void;
  press_guess_answer: () => void;
  submit_answer: (data: { answer: string }) => void;
  leave_room: () => void;
}
