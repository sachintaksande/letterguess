// ============================================================
// WordChainManager — Word chain game logic
// ============================================================

import { Server, Socket } from 'socket.io';
import { generateRoomCode } from '../utils/roomCode';
import { isValidWord } from './wordValidator';

// ---- Types ----

interface WCPlayer {
  id: string;
  name: string;
  strikes: number;       // 0-3, eliminated at 3
  eliminated: boolean;
  connected: boolean;
}

interface WCRoom {
  code: string;
  maxPlayers: number;
  players: Map<string, WCPlayer>;
  currentWord: string;
  usedWords: Set<string>;
  turnOrder: string[];
  turnIndex: number;
  consecutiveStrikes: number;   // resets on valid word, game ends when all active players strike
  phase: 'LOBBY' | 'PLAYING' | 'ENDED';
  roomCreatorId: string;
  createdAt: Date;
  lastActivityAt: Date;
}

// ---- Constants ----

const TURN_TIMER_SEC = 30;
const MAX_STRIKES = 3;
const MIN_WORD_LENGTH = 2;
const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const ANIMALS = [
  'Swift Fox', 'Clever Owl', 'Bold Tiger', 'Wise Panda', 'Lucky Cat',
  'Brave Hawk', 'Calm Whale', 'Sharp Eagle', 'Cool Wolf', 'Happy Dog',
  'Sly Raccoon', 'Neon Shark', 'Vivid Lynx', 'Jolly Otter', 'Zippy Hare',
  'Mellow Elk', 'Bright Frog', 'Crisp Badger', 'Sunny Bear', 'Wild Swan',
];

export function randomName(): string {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

// Starter words for the game — common, easy to chain
const STARTER_WORDS = [
  'APPLE', 'HOUSE', 'TIGER', 'MOUSE', 'PLANE', 'DREAM', 'CLOUD',
  'STONE', 'LIGHT', 'WATER', 'MUSIC', 'PARTY', 'SMILE', 'TRAIN',
  'BEACH', 'NIGHT', 'RIVER', 'OCEAN', 'GREEN', 'WORLD',
];

function randomStarter(): string {
  return STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)];
}

// ---- Manager ----

export class WordChainManager {
  private rooms: Map<string, WCRoom> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private playerToSocket: Map<string, string> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    setInterval(() => this.cleanupExpiredRooms(), CLEANUP_INTERVAL_MS);
  }

  // ---- Room CRUD ----

  createRoom(playerId: string, playerName: string, maxPlayers: number): { room: WCRoom; player: WCPlayer } {
    const code = generateRoomCode(new Set([...this.rooms.keys()]));
    const player: WCPlayer = {
      id: playerId,
      name: playerName,
      strikes: 0,
      eliminated: false,
      connected: true,
    };

    const room: WCRoom = {
      code,
      maxPlayers: Math.max(2, Math.min(maxPlayers, 20)),
      players: new Map([[playerId, player]]),
      currentWord: '',
      usedWords: new Set(),
      turnOrder: [playerId],
      turnIndex: 0,
      consecutiveStrikes: 0,
      phase: 'LOBBY',
      roomCreatorId: playerId,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.rooms.set(code, room);
    this.playerToRoom.set(playerId, code);
    return { room, player };
  }

  joinRoom(code: string, playerId: string, playerName: string): { room: WCRoom; player: WCPlayer; isReconnect: boolean } | { error: string } {
    code = code.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found. Check the code.' };
    if (room.phase === 'ENDED') return { error: 'This game session has ended.' };
    room.lastActivityAt = new Date();

    const existingPlayer = room.players.get(playerId);
    if (existingPlayer) {
      existingPlayer.connected = true;
      this.playerToRoom.set(playerId, code);
      return { room, player: existingPlayer, isReconnect: true };
    }

    if (room.players.size >= room.maxPlayers) return { error: 'Room is full.' };

    const player: WCPlayer = {
      id: playerId,
      name: playerName,
      strikes: 0,
      eliminated: false,
      connected: true,
    };

    room.players.set(playerId, player);
    room.turnOrder.push(playerId);
    this.playerToRoom.set(playerId, code);
    return { room, player, isReconnect: false };
  }

  removePlayer(playerId: string): { room: WCRoom | null; playerName: string } {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return { room: null, playerName: '' };
    const room = this.rooms.get(roomCode);
    if (!room) return { room: null, playerName: '' };
    const player = room.players.get(playerId);
    const playerName = player?.name || '';
    if (player) player.connected = false;
    this.playerToRoom.delete(playerId);
    this.playerToSocket.delete(playerId);
    return { room, playerName };
  }

  getRoom(code: string): WCRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getPlayerRoom(playerId: string): WCRoom | undefined {
    const code = this.playerToRoom.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

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
    if (room.phase !== 'LOBBY') return 'Game already started.';
    if (room.players.size < 2) return 'Need at least 2 players.';

    room.phase = 'PLAYING';
    room.currentWord = randomStarter();
    room.usedWords.add(room.currentWord);
    room.turnOrder = [...room.players.keys()]; // join order
    room.turnIndex = 0;

    // Broadcast game start
    this.io.to(roomCode).emit('wc:game_started', {
      currentWord: room.currentWord,
      turnOrder: room.turnOrder,
      turnIndex: 0,
      currentPlayerId: room.turnOrder[0],
      currentPlayerName: room.players.get(room.turnOrder[0])?.name || '',
      timeLimit: TURN_TIMER_SEC,
    });

    // Delay first turn to let game component mount and register listeners
    setTimeout(() => this.startTurn(room), 200);
    return null;
  }

  private startTurn(room: WCRoom): void {
    this.clearTimer(room.code);

    const currentPlayerId = room.turnOrder[room.turnIndex];
    const player = room.players.get(currentPlayerId);
    if (!player || player.eliminated) {
      this.advanceTurn(room);
      return;
    }

    this.io.to(room.code).emit('wc:turn_update', {
      currentPlayerId,
      currentPlayerName: player.name,
      currentWord: room.currentWord,
      timeLimit: TURN_TIMER_SEC,
    });

    // Start timer
    this.timers.set(
      room.code,
      setTimeout(() => this.handleTimeout(room), TURN_TIMER_SEC * 1000)
    );
  }

  guessWord(roomCode: string, playerId: string, word: string): string | null {
    const room = this.rooms.get(roomCode);
    if (!room) return 'Room not found.';
    if (room.phase !== 'PLAYING') return 'Game not in progress.';

    const currentPlayerId = room.turnOrder[room.turnIndex];
    if (currentPlayerId !== playerId) return 'Not your turn.';

    const player = room.players.get(playerId);
    if (!player || player.eliminated) return 'You are eliminated.';

    this.clearTimer(room.code);

    const cleanWord = word.toUpperCase().trim().replace(/[^A-Z]/g, '');
    const lastLetter = room.currentWord[room.currentWord.length - 1];

    // Validate
    if (cleanWord.length < MIN_WORD_LENGTH) {
      return this.strikePlayer(room, playerId, 'Word must be at least 2 letters.');
    }
    if (cleanWord[0] !== lastLetter) {
      return this.strikePlayer(room, playerId, `Word must start with "${lastLetter}".`);
    }
    if (room.usedWords.has(cleanWord)) {
      return this.strikePlayer(room, playerId, `"${cleanWord}" was already used.`);
    }

    // Dictionary check
    if (!isValidWord(cleanWord)) {
      return this.strikePlayer(room, playerId, `"${cleanWord}" is not a valid English word.`);
    }

    // Valid guess
    room.currentWord = cleanWord;
    room.usedWords.add(cleanWord);

    this.io.to(roomCode).emit('wc:word_result', {
      playerId,
      playerName: player.name,
      word: cleanWord,
      valid: true,
      strikes: player.strikes,
      score: (player as any).score || 0,
    });

    // Track score
    (player as any).score = ((player as any).score || 0) + 1;
    room.consecutiveStrikes = 0;  // reset the streak

    this.advanceTurn(room);
    return null;
  }

  private strikePlayer(room: WCRoom, playerId: string, reason: string): null {
    const player = room.players.get(playerId);
    if (!player) return null;

    player.strikes++;
    (player as any).score = ((player as any).score || 0) - 1;
    const eliminated = player.strikes >= MAX_STRIKES;
    if (eliminated) player.eliminated = true;

    this.io.to(room.code).emit('wc:word_result', {
      playerId,
      playerName: player.name,
      word: '',
      valid: false,
      strikes: player.strikes,
      score: (player as any).score || 0,
      eliminated,
      reason,
    });

    if (eliminated) {
      this.io.to(room.code).emit('wc:player_eliminated', {
        playerId,
        playerName: player.name,
        strikes: player.strikes,
      });
    }

    // Check if game is over — all active players struck in a row (chain broken)
    room.consecutiveStrikes++;
    const activePlayers = [...room.players.values()].filter(p => !p.eliminated && p.connected);
    if (room.consecutiveStrikes >= activePlayers.length) {
      // Find player with highest score
      let bestPlayer: WCPlayer | null = null;
      let bestScore = -Infinity;
      for (const p of activePlayers) {
        const score = (p as any).score || 0;
        if (score > bestScore) { bestScore = score; bestPlayer = p; }
      }
      this.endGame(room, bestPlayer?.id || null);
      return null;
    }

    this.advanceTurn(room);
    return null;
  }

  private advanceTurn(room: WCRoom): void {
    // Skip eliminated/disconnected players
    let attempts = 0;
    do {
      room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;
      attempts++;
      const nextPlayer = room.players.get(room.turnOrder[room.turnIndex]);
      if (nextPlayer && !nextPlayer.eliminated && nextPlayer.connected) {
        break;
      }
    } while (attempts < room.turnOrder.length);

    this.startTurn(room);
  }

  private handleTimeout(room: WCRoom): void {
    const currentPlayerId = room.turnOrder[room.turnIndex];
    this.strikePlayer(room, currentPlayerId, 'Time ran out.');
  }

  private endGame(room: WCRoom, winnerId: string | null): void {
    room.phase = 'ENDED';
    this.clearTimer(room.code);

    const winner = winnerId ? room.players.get(winnerId) : null;
    this.io.to(room.code).emit('wc:game_ended', {
      winnerId,
      winnerName: winner?.name || 'Nobody',
      currentWord: room.currentWord,
      players: [...room.players.values()].map(p => ({
        id: p.id,
        name: p.name,
        strikes: p.strikes,
        eliminated: p.eliminated,
      })),
    });
  }

  endSession(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.phase = 'ENDED';
    this.clearTimer(roomCode);
    this.io.in(roomCode).socketsLeave(roomCode);
    for (const [pid] of room.players) {
      this.playerToRoom.delete(pid);
      this.playerToSocket.delete(pid);
    }
  }

  // ---- Snapshot for reconnection ----

  getRoomSnapshot(room: WCRoom) {
    return {
      code: room.code,
      gameType: 'wordchain' as const,
      state: room.phase,
      maxPlayers: room.maxPlayers,
      roomCreatorId: room.roomCreatorId,
      players: [...room.players.values()],
      currentWord: room.currentWord,
      usedWords: [...room.usedWords],
      turnOrder: room.turnOrder,
      turnIndex: room.turnIndex,
    };
  }

  // ---- Timer helpers ----

  private clearTimer(code: string): void {
    const timer = this.timers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(code);
    }
  }

  clearAllRoomTimers(code: string): void {
    this.clearTimer(code);
  }

  // ---- Cleanup ----

  private cleanupExpiredRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivityAt.getTime() > ROOM_EXPIRY_MS) {
        this.clearTimer(code);
        this.io.in(code).socketsLeave(code);
        for (const [pid] of room.players) {
          this.playerToRoom.delete(pid);
          this.playerToSocket.delete(pid);
        }
        this.rooms.delete(code);
        console.log(`🧹 Cleaned up Word Chain room: ${code}`);
      }
    }
  }
}
