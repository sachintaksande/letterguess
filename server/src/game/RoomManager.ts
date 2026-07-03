// ============================================================
// RoomManager — Room lifecycle and player management
// ============================================================

import { Server, Socket } from 'socket.io';
import {
  Room, RoomPhase, RoundPhase, PlayerInfo, PlayerRoundState,
  RoundData, RoomSnapshot, RoundSnapshot, LeaderboardEntry,
} from './types';
import { generateRoomCode } from '../utils/roomCode';
import { RoundManager } from './RoundManager';

// ---- Constants ----
const LETTER_GUESS_LIMIT = 10;
const ANSWER_GUESS_LIMIT = 2;
const LETTER_TIMER_SEC = 30;
const ANSWER_TIMER_SEC = 20;
const CREATION_TIMER_SEC = 120;
const ROUND_TRANSITION_SEC = 5;
const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;  // every hour

const ANIMALS = [
  'Swift Fox', 'Clever Owl', 'Bold Tiger', 'Wise Panda', 'Lucky Cat',
  'Brave Hawk', 'Calm Whale', 'Sharp Eagle', 'Cool Wolf', 'Happy Dog',
  'Sly Raccoon', 'Neon Shark', 'Vivid Lynx', 'Jolly Otter', 'Zippy Hare',
  'Mellow Elk', 'Bright Frog', 'Crisp Badger', 'Sunny Bear', 'Wild Swan',
];

export function randomName(): string {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map();  // playerId → roomCode
  private playerToSocket: Map<string, string> = new Map(); // playerId → socketId
  private roundManagers: Map<string, RoundManager> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    // Cleanup expired rooms every hour
    setInterval(() => this.cleanupExpiredRooms(), CLEANUP_INTERVAL_MS);
  }

  // ---- Room CRUD ----

  createRoom(playerId: string, playerName: string, maxPlayers: number, gameType: 'letterguess' | 'wordchain' = 'letterguess', maxRounds: number = 0): { room: Room; player: PlayerInfo } {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const player: PlayerInfo = {
      id: playerId,
      name: playerName,
      totalPoints: 0,
      roundsPlayed: 0,
      joinOrder: 0,
      connected: true,
      spectating: false,
    };

    const room: Room = {
      code,
      gameType,
      maxPlayers: Math.max(2, Math.min(maxPlayers, 20)),
      maxRounds: Math.max(0, maxRounds),  // 0 = unlimited
      state: 'LOBBY',
      roomCreatorId: playerId,
      players: new Map([[playerId, player]]),
      rounds: [],
      currentRoundIndex: -1,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      creatorRotationOrder: [playerId],
      creatorRotationIndex: 0,
    };

    this.rooms.set(code, room);
    this.playerToRoom.set(playerId, code);
    this.playerToSocket.set(playerId, ''); // socket mapped later
    return { room, player };
  }

  joinRoom(code: string, playerId: string, playerName: string): {
    room: Room;
    player: PlayerInfo;
    isReconnect: boolean;
  } | { error: string } {
    code = code.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found. Check the code.' };
    if (room.state === 'ENDED') return { error: 'This game session has ended.' };

    room.lastActivityAt = new Date();

    // Check reconnection
    const existingPlayer = room.players.get(playerId);
    if (existingPlayer) {
      existingPlayer.connected = true;
      this.playerToRoom.set(playerId, code);
      return { room, player: existingPlayer, isReconnect: true };
    }

    // New player
    if (room.players.size >= room.maxPlayers) {
      return { error: 'Room is full.' };
    }

    const player: PlayerInfo = {
      id: playerId,
      name: playerName,
      totalPoints: 0,
      roundsPlayed: 0,
      joinOrder: room.players.size,
      connected: true,
      spectating: room.state === 'PLAYING',
    };

    room.players.set(playerId, player);
    room.creatorRotationOrder.push(playerId);
    this.playerToRoom.set(playerId, code);
    return { room, player, isReconnect: false };
  }

  removePlayer(playerId: string): { room: Room | null; playerName: string } {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return { room: null, playerName: '' };

    const room = this.rooms.get(roomCode);
    if (!room) return { room: null, playerName: '' };

    const player = room.players.get(playerId);
    const playerName = player?.name || '';

    // Mark disconnected rather than removing (keeps score data)
    if (player) {
      player.connected = false;
    }

    // Cancel any active timers for this player
    const rm = this.roundManagers.get(roomCode);
    if (rm && room.state === 'PLAYING') {
      const round = rm.getCurrentRound();
      if (round) {
        // If this player is the current letter guesser → advance turn
        if (round.phase === 'PLAYING' && rm.getCurrentGuesser() === playerId) {
          this.clearTimer(`letter_${roomCode}`);
          // Treat as timeout: -1 point, advance turn
          const state = round.perPlayer[playerId];
          if (state) {
            state.letterGuesses++;
            round.scores[playerId] = (round.scores[playerId] || 0) - 1;
          }
          this.io.to(roomCode).emit('letter_result', {
            playerId, playerName,
            letter: '', positions: [],
            revealed: round.revealed, scoreDelta: -1, correct: false,
          });
          rm.advanceTurnIndex();
          this.advanceTurn(room, rm);
        }
        // If this player is guessing an answer → cancel and treat as wrong
        else if (round.phase === 'GUESSING_ANSWER' && round.guessingPlayerId === playerId) {
          this.clearTimer(`answer_${roomCode}`);
          const state = round.perPlayer[playerId];
          if (state) state.wrongAnswerGuesses++;
          round.scores[playerId] = (round.scores[playerId] || 0) - 10;
          const scoreDeltas: Record<string, number> = { [playerId]: -10 };
          for (const [pid] of room.players) {
            if (pid !== playerId) {
              round.scores[pid] = (round.scores[pid] || 0) + 5;
              scoreDeltas[pid] = 5;
            }
          }
          this.io.to(roomCode).emit('answer_result', {
            playerId, playerName,
            correct: false, scoreDeltas, roundEnded: false,
          });
          round.phase = 'PLAYING';
          round.guessingPlayerId = null;
          this.advanceTurn(room, rm);
        }
        // If this player is the puzzle creator → pass to next
        else if (round.phase === 'CREATION' && round.creatorId === playerId) {
          this.clearTimer(`creation_${roomCode}`);
          this.io.to(roomCode).emit('error', { message: `${playerName} left — passing puzzle creation!` });
          this.endRound(room, rm, null);
          setTimeout(() => {
            if (room.state === 'PLAYING') this.startNewRound(room);
          }, ROUND_TRANSITION_SEC * 1000);
        }
      }
    }

    // Remove from rotation if never played
    // (keep in rotation order if they have scores)
    this.playerToRoom.delete(playerId);
    this.playerToSocket.delete(playerId);

    // Check if room is empty — if all disconnected, mark for expiry
    const allDisconnected = [...room.players.values()].every(p => !p.connected);
    if (allDisconnected) {
      // Don't immediately delete — let cleanup handle it
      room.lastActivityAt = new Date(Date.now() - ROOM_EXPIRY_MS + 60_000); // expire in 1 min
    }

    return { room, playerName };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getPlayerRoom(playerId: string): Room | undefined {
    const code = this.playerToRoom.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  // ---- Socket mapping ----

  mapSocket(playerId: string, socketId: string): void {
    this.playerToSocket.set(playerId, socketId);
  }

  getSocketId(playerId: string): string | undefined {
    return this.playerToSocket.get(playerId);
  }

  // ---- Game flow ----

  startGame(roomCode: string, playerId: string): string | null {
    const room = this.rooms.get(roomCode);
    if (!room) return 'Room not found.';
    if (room.state !== 'LOBBY') return 'Game already started.';
    if (room.roomCreatorId !== playerId) return 'Only the room creator can start the game.';
    if (room.players.size < 2) return 'Need at least 2 players.';

    room.state = 'PLAYING';

    // Mark all players as active (in case some joined as spectators)
    for (const p of room.players.values()) {
      p.spectating = false;
    }

    // Start first round
    const firstCreatorId = room.creatorRotationOrder[0];
    room.creatorRotationIndex = 1 % room.creatorRotationOrder.length;

    this.startNewRound(room);

    return null; // success
  }

  startNewRound(room: Room): void {
    try {
    const rm = new RoundManager(room, this);

    // Resolve next creator
    const creatorId = room.creatorRotationOrder[room.creatorRotationIndex % room.creatorRotationOrder.length];
    room.creatorRotationIndex = (room.creatorRotationIndex + 1) % room.creatorRotationOrder.length;

    // Get active guessers (non-creator, connected, not spectating)
    const guessers = [...room.players.keys()].filter(
      id => id !== creatorId && room.players.get(id)?.connected
    );

    const round = rm.initRound(creatorId, guessers);
    room.rounds.push(round);
    room.currentRoundIndex = room.rounds.length - 1;
    this.roundManagers.set(room.code, rm);

    // Broadcast: new round, creator should create puzzle
    this.io.to(room.code).emit('puzzle_set', {
      creatorId,
      hint: '',
      revealed: [],
      turnOrder: round.turnOrder,
    });

    const creatorSocket = this.getSocketId(creatorId);
    if (creatorSocket) {
      this.io.to(creatorSocket).emit('your_turn_create', { timeLimit: CREATION_TIMER_SEC });
      // Start creation timer
      this.clearTimer(`creation_${room.code}`);
      this.timers.set(
        `creation_${room.code}`,
        setTimeout(() => this.handleCreationTimeout(room.code, creatorId), CREATION_TIMER_SEC * 1000)
      );
    }
    } catch (err) {
      console.error('[startNewRound] ERROR:', err);
    }
  }

  submitPuzzle(roomCode: string, playerId: string, puzzle: string, hint: string): string | null {
    const room = this.rooms.get(roomCode);
    if (!room) return 'Room not found.';

    const rm = this.roundManagers.get(roomCode);
    if (!rm) return 'No active round.';

    const round = rm.getCurrentRound();
    if (!round) return 'No active round.';
    if (round.creatorId !== playerId) return 'You are not the puzzle creator.';
    if (round.phase !== 'CREATION') return 'Puzzle already submitted.';

    // Validate puzzle
    const clean = puzzle.toUpperCase().trim();
    if (clean.length < 2) return 'Puzzle must be at least 2 characters.';
    if (clean.length > 60) return 'Puzzle too long (max 60 chars).';
    if (!/^[A-Z ]+$/.test(clean)) return 'Only letters and spaces allowed.';

    rm.setPuzzle(clean, hint);
    this.clearTimer(`creation_${roomCode}`);

    // Start the guessing phase
    this.startGuessingPhase(room, rm);
    return null;
  }

  private handleCreationTimeout(roomCode: string, creatorId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const rm = this.roundManagers.get(roomCode);
    if (!rm) return;

    const round = rm.getCurrentRound();
    if (!round || round.phase !== 'CREATION') return;

    // Buck passes to next creator
    this.io.to(roomCode).emit('error', { message: `${room.players.get(creatorId)?.name || 'Creator'} ran out of time! Passing to next player.` });

    // End current round with no score changes, start next round
    this.endRound(room, rm, null);

    setTimeout(() => {
      if (room.state === 'PLAYING') {
        this.startNewRound(room);
      }
    }, ROUND_TRANSITION_SEC * 1000);
  }

  private startGuessingPhase(room: Room, rm: RoundManager): void {
    const round = rm.getCurrentRound();
    if (!round) return;

    round.phase = 'PLAYING';

    this.io.to(room.code).emit('puzzle_set', {
      creatorId: round.creatorId,
      hint: round.hint,
      revealed: round.revealed,
      turnOrder: round.turnOrder,
    });

    // Start first turn
    this.advanceTurn(room, rm);
  }

  advanceTurn(room: Room, rm: RoundManager): void {
    const round = rm.getCurrentRound();
    if (!round) return;

    // Check end conditions
    if (rm.isAllRevealed()) {
      this.endRound(room, rm, null);
      return;
    }

    // Get next active guesser (skips eliminated and exhausted players)
    const nextPlayer = rm.getNextActiveGuesser();
    if (!nextPlayer) {
      // All guessers eliminated or exhausted — round ends with no winner
      this.endRound(room, rm, null);
      return;
    }

    // Broadcast turn to all clients (so everyone sees the countdown)
    const nextPlayerName = room.players.get(nextPlayer)?.name || '';
    this.io.to(room.code).emit('turn_changed', { 
      currentPlayerId: nextPlayer,
      currentPlayerName: nextPlayerName,
      timeLimit: LETTER_TIMER_SEC,
    });
    const socketId = this.getSocketId(nextPlayer);
    if (socketId) {
      this.io.to(socketId).emit('your_turn_guess', { timeLimit: LETTER_TIMER_SEC });
    }

    // Start letter timer
    this.clearTimer(`letter_${room.code}`);
    this.timers.set(
      `letter_${room.code}`,
      setTimeout(() => this.handleLetterTimeout(room.code, rm, nextPlayer), LETTER_TIMER_SEC * 1000)
    );
  }

  guessLetter(roomCode: string, playerId: string, letter: string): string | null {
    const room = this.rooms.get(roomCode);
    if (!room) return 'Room not found.';

    const rm = this.roundManagers.get(roomCode);
    if (!rm) return 'No active round.';

    const round = rm.getCurrentRound();
    if (!round) return 'No active round.';
    if (round.phase !== 'PLAYING') return 'Not in guessing phase.';

    const currentGuesser = rm.getCurrentGuesser();
    if (currentGuesser !== playerId) return 'Not your turn.';

    const state = round.perPlayer[playerId];
    if (!state || state.eliminated) return 'You are eliminated.';

    const cleanLetter = letter.toUpperCase().replace(/[^A-Z]/g, '');
    if (cleanLetter.length !== 1) return 'Enter a single letter.';
    if (round.usedLetters.has(cleanLetter)) return 'Letter already used.';

    this.clearTimer(`letter_${roomCode}`);

    round.usedLetters.add(cleanLetter);
    state.letterGuesses++;

    const positions: number[] = [];
    for (let i = 0; i < round.puzzle.length; i++) {
      if (round.puzzle[i] === cleanLetter) {
        round.revealed[i] = cleanLetter;
        positions.push(i);
      }
    }

    const correct = positions.length > 0;
    const scoreDelta = correct ? 1 : -1;
    round.scores[playerId] = (round.scores[playerId] || 0) + scoreDelta;

    this.io.to(room.code).emit('letter_result', {
      playerId,
      playerName: room.players.get(playerId)?.name || '',
      letter: cleanLetter,
      positions,
      revealed: round.revealed,
      scoreDelta,
      correct,
    });

    // Turn always passes after a letter guess
    rm.advanceTurnIndex();
    this.advanceTurn(room, rm);
    return null;
  }

  private handleLetterTimeout(roomCode: string, rm: RoundManager, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const round = rm.getCurrentRound();
    if (!round || round.phase !== 'PLAYING') return;

    const currentGuesser = rm.getCurrentGuesser();
    if (currentGuesser !== playerId) return;

    const state = round.perPlayer[playerId];
    if (state) {
      state.letterGuesses++;
      round.scores[playerId] = (round.scores[playerId] || 0) - 1;
    }

    this.io.to(room.code).emit('letter_result', {
      playerId,
      playerName: room.players.get(playerId)?.name || '',
      letter: '',
      positions: [],
      revealed: round.revealed,
      scoreDelta: -1,
      correct: false,
    });

    rm.advanceTurnIndex();
    this.advanceTurn(room, rm);
  }

  // ---- Answer guessing ----

  startAnswerGuess(roomCode: string, playerId: string): string | null {
    const room = this.rooms.get(roomCode);
    if (!room) return 'Room not found.';

    const rm = this.roundManagers.get(roomCode);
    if (!rm) return 'No active round.';

    const round = rm.getCurrentRound();
    if (!round) return 'No active round.';
    if (round.phase === 'GUESSING_ANSWER') return 'Another player is already guessing.';
    if (round.phase !== 'PLAYING') return 'Cannot guess now.';

    const state = round.perPlayer[playerId];
    if (!state || state.eliminated) return 'You are eliminated.';
    if (state.wrongAnswerGuesses >= ANSWER_GUESS_LIMIT) return 'You have no answer guesses left.';

    // Pause letter timer
    this.clearTimer(`letter_${roomCode}`);

    round.phase = 'GUESSING_ANSWER';
    round.guessingPlayerId = playerId;

    this.io.to(room.code).emit('answer_guess_started', {
      playerId,
      playerName: room.players.get(playerId)?.name || '',
      timeLimit: ANSWER_TIMER_SEC,
    });

    // Start answer timer
    this.clearTimer(`answer_${room.code}`);
    this.timers.set(
      `answer_${room.code}`,
      setTimeout(() => this.handleAnswerTimeout(room.code, rm, playerId), ANSWER_TIMER_SEC * 1000)
    );

    return null;
  }

  submitAnswer(roomCode: string, playerId: string, answer: string): string | null {
    const room = this.rooms.get(roomCode);
    if (!room) return 'Room not found.';

    const rm = this.roundManagers.get(roomCode);
    if (!rm) return 'No active round.';

    const round = rm.getCurrentRound();
    if (!round) return 'No active round.';
    if (round.phase !== 'GUESSING_ANSWER') return 'Not waiting for an answer.';
    if (round.guessingPlayerId !== playerId) return 'Not your guess.';

    this.clearTimer(`answer_${roomCode}`);

    // Normalize answer: uppercase, trim, collapse multiple spaces
    const cleanAnswer = answer.toUpperCase().replace(/\s+/g, ' ').trim();
    const correct = cleanAnswer === round.puzzle;

    console.log(`[submitAnswer] Comparing: answer="${cleanAnswer}" vs puzzle="${round.puzzle}" → ${correct ? 'CORRECT' : 'WRONG'}`);

    this.io.to(room.code).emit('answer_submitted', {
      playerId,
      correct,
      answer: correct ? cleanAnswer : '',
      roundEnded: correct,
    });

    if (correct) {
      // Correct answer: +10 points, round ends
      round.scores[playerId] = (round.scores[playerId] || 0) + 10;
      this.endRound(room, rm, playerId);
    } else {
      // Wrong answer: -10 to guesser, +5 to all others (including creator)
      const state = round.perPlayer[playerId];
      round.scores[playerId] = (round.scores[playerId] || 0) - 10;
      state.wrongAnswerGuesses++;

      const scoreDeltas: Record<string, number> = {};
      scoreDeltas[playerId] = -10;

      for (const [pid] of room.players) {
        if (pid !== playerId) {
          round.scores[pid] = (round.scores[pid] || 0) + 5;
          scoreDeltas[pid] = 5;
        }
      }

      const eliminated = state.wrongAnswerGuesses >= ANSWER_GUESS_LIMIT;
      if (eliminated) {
        state.eliminated = true;
        this.io.to(room.code).emit('player_eliminated', {
          playerId,
          playerName: room.players.get(playerId)?.name || '',
        });
      }

      this.io.to(room.code).emit('answer_result', {
        playerId,
        playerName: room.players.get(playerId)?.name || '',
        correct: false,
        scoreDeltas,
        roundEnded: false,
      });

      // Resume guessing phase
      round.phase = 'PLAYING';
      round.guessingPlayerId = null;
      this.advanceTurn(room, rm);
    }

    return null;
  }

  private handleAnswerTimeout(roomCode: string, rm: RoundManager, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const round = rm.getCurrentRound();
    if (!round || round.phase !== 'GUESSING_ANSWER') return;
    if (round.guessingPlayerId !== playerId) return;

    // Timer expired = same as wrong answer
    const state = round.perPlayer[playerId];
    round.scores[playerId] = (round.scores[playerId] || 0) - 10;
    if (state) state.wrongAnswerGuesses++;

    const scoreDeltas: Record<string, number> = {};
    scoreDeltas[playerId] = -10;

    for (const [pid] of room.players) {
      if (pid !== playerId) {
        round.scores[pid] = (round.scores[pid] || 0) + 5;
        scoreDeltas[pid] = 5;
      }
    }

    const eliminated = state && state.wrongAnswerGuesses >= ANSWER_GUESS_LIMIT;
    if (eliminated) {
      state.eliminated = true;
      this.io.to(room.code).emit('player_eliminated', {
        playerId,
        playerName: room.players.get(playerId)?.name || '',
      });
    }

    this.io.to(room.code).emit('answer_result', {
      playerId,
      playerName: room.players.get(playerId)?.name || '',
      correct: false,
      scoreDeltas,
      roundEnded: false,
    });

    // Resume
    round.phase = 'PLAYING';
    round.guessingPlayerId = null;
    this.advanceTurn(room, rm);
  }

  // ---- Round end ----

  private endRound(room: Room, rm: RoundManager, winnerId: string | null): void {
    const round = rm.getCurrentRound();
    if (!round) return;
    if (round.phase === 'ENDED') return;

    round.phase = 'ENDED';
    round.winnerId = winnerId;

    this.clearTimer(`letter_${room.code}`);
    this.clearTimer(`answer_${room.code}`);
    this.clearTimer(`creation_${room.code}`);

    // Accumulate total scores and rounds played
    // All players earn their round score, but creator's round doesn't count as "played"
    for (const [pid, player] of room.players) {
      player.totalPoints += round.scores[pid] || 0;
      if (pid !== round.creatorId) {
        player.roundsPlayed++;
      }
    }

    // Build total scores snapshot
    const totalScores: Record<string, number> = {};
    for (const [pid, player] of room.players) {
      totalScores[pid] = player.totalPoints;
    }

    this.io.to(room.code).emit('round_ended', {
      winnerId,
      winnerName: winnerId ? room.players.get(winnerId)?.name || '' : null,
      puzzle: round.puzzle,
      scores: { ...round.scores },
      totalScores: { ...totalScores },
    });

    // After a pause, start next round or end session if max rounds reached
    setTimeout(() => {
      if (room.state === 'PLAYING') {
        const roundsPlayed = room.rounds.filter(r => r.phase === 'ENDED').length;
        if (room.maxRounds > 0 && roundsPlayed >= room.maxRounds) {
          this.endSession(room.code);
        } else {
          this.io.to(room.code).emit('next_round_starting', {
            newCreatorId: room.creatorRotationOrder[room.creatorRotationIndex % room.creatorRotationOrder.length],
            inSeconds: ROUND_TRANSITION_SEC,
          });
          this.startNewRound(room);
        }
      }
    }, ROUND_TRANSITION_SEC * 1000);
  }

  endSession(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.state = 'ENDED';

    // Clear all timers
    this.clearTimer(`letter_${roomCode}`);
    this.clearTimer(`answer_${roomCode}`);
    this.clearTimer(`creation_${roomCode}`);

    // Build leaderboard sorted by average
    const leaderboard: LeaderboardEntry[] = [...room.players.values()]
      .map(p => ({
        playerId: p.id,
        name: p.name,
        totalPoints: p.totalPoints,
        roundsPlayed: p.roundsPlayed,
        average: p.roundsPlayed > 0 ? p.totalPoints / p.roundsPlayed : 0,
      }))
      .sort((a, b) => b.average - a.average);

    const winner = leaderboard[0];

    this.io.to(roomCode).emit('session_ended', {
      leaderboard,
      winnerId: winner?.playerId || '',
      winnerName: winner?.name || '',
    });

    // Disconnect all sockets from room
    this.io.in(roomCode).socketsLeave(roomCode);

    // Clean up player mappings
    for (const [pid] of room.players) {
      this.playerToRoom.delete(pid);
      this.playerToSocket.delete(pid);
    }
  }

  // ---- Snapshot for reconnecting clients ----

  getRoomSnapshot(room: Room): RoomSnapshot {
    const round = room.currentRoundIndex >= 0 ? room.rounds[room.currentRoundIndex] : null;

    const roundSnapshot: RoundSnapshot | null = round ? {
      creatorId: round.creatorId,
      hint: round.hint,
      revealed: round.revealed,
      phase: round.phase,
      turnOrder: round.turnOrder,
      turnIndex: round.turnIndex,
      scores: { ...round.scores },
      usedLetters: [...round.usedLetters],
      guessingPlayerId: round.guessingPlayerId,
      perPlayer: { ...round.perPlayer },
    } : null;

    const roundSummaries = room.rounds.map(r => ({
      puzzle: r.puzzle,
      hint: r.hint,
      winnerId: r.winnerId,
      scores: { ...r.scores },
    }));

    const scores: Record<string, number> = {};
    for (const [pid, player] of room.players) {
      scores[pid] = player.totalPoints;
    }

    return {
      code: room.code,
      state: room.state,
      maxPlayers: room.maxPlayers,
      roomCreatorId: room.roomCreatorId,
      players: [...room.players.values()],
      currentRound: roundSnapshot,
      rounds: roundSummaries,
      scores,
      creatorRotationOrder: room.creatorRotationOrder,
      creatorRotationIndex: room.creatorRotationIndex,
    };
  }

  // ---- Timer helpers ----

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  clearAllRoomTimers(roomCode: string): void {
    this.clearTimer(`letter_${roomCode}`);
    this.clearTimer(`answer_${roomCode}`);
    this.clearTimer(`creation_${roomCode}`);
  }

  // ---- Cleanup ----

  private cleanupExpiredRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivityAt.getTime() > ROOM_EXPIRY_MS) {
        this.clearAllRoomTimers(code);
        // Disconnect sockets
        this.io.in(code).socketsLeave(code);
        // Remove player mappings
        for (const [pid] of room.players) {
          this.playerToRoom.delete(pid);
          this.playerToSocket.delete(pid);
        }
        this.rooms.delete(code);
        this.roundManagers.delete(code);
        console.log(`🧹 Cleaned up expired room: ${code}`);
      }
    }
  }
}
