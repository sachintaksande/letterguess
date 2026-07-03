// ============================================================
// LetterGuess Server — Express + Socket.io
// ============================================================

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { RoomManager, randomName } from './game/RoomManager';
import { ServerEvents, ClientEvents } from './game/types';

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.use(cors());

// Serve built client in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  // Don't catch API/WS routes
  if (_req.path.startsWith('/socket.io') || _req.path.startsWith('/api') || _req.path === '/health') return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const roomManager = new RoomManager(io);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: (roomManager as any).rooms?.size || 0 });
});

// Available games
app.get('/api/games', (_req, res) => {
  res.json({
    games: [
      { id: 'letterguess', name: 'LetterGuess', icon: '🔤', description: 'Multiplayer word guessing — Hangman with a twist', players: '2-20' },
      { id: 'wordchain', name: 'Word Chain', icon: '🔗', description: 'Chain words by their last letter before time runs out', players: '2-8', comingSoon: true },
    ],
  });
});

// ---- Socket.io connection handling ----

io.on('connection', (socket: Socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  let currentPlayerId: string | null = null;
  let currentRoomCode: string | null = null;

  // ---- Room creation & joining ----

  socket.on('create_room', (data: { playerName: string; maxPlayers: number; maxRounds?: number; playerId?: string; gameType?: 'letterguess' | 'wordchain' }) => {
    const playerId = data.playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const playerName = data.playerName || randomName();
    const maxPlayers = Math.max(2, Math.min(data.maxPlayers || 8, 20));
    const maxRounds = data.maxRounds || 0;
    const gameType: 'letterguess' | 'wordchain' = data.gameType || 'letterguess';

    const { room, player } = roomManager.createRoom(playerId, playerName, maxPlayers, gameType, maxRounds);
    currentPlayerId = playerId;
    currentRoomCode = room.code;

    roomManager.mapSocket(playerId, socket.id);
    socket.join(room.code);

    socket.emit('room_created', { roomCode: room.code, playerId, gameType: room.gameType });
    socket.emit('room_joined', {
      roomCode: room.code,
      playerId,
      gameType: room.gameType,
      roomCreatorId: room.roomCreatorId,
      players: [...room.players.values()],
      maxPlayers: room.maxPlayers,
      state: room.state,
    });

    console.log(`🏠 Room ${room.code} created by ${playerName} (max ${maxPlayers})`);
  });

  socket.on('join_room', (data: { roomCode: string; playerName: string; playerId?: string }) => {
    const playerId = data.playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const playerName = data.playerName || randomName();

    const result = roomManager.joinRoom(data.roomCode, playerId, playerName);

    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }

    const { room, player, isReconnect } = result;
    currentPlayerId = playerId;
    currentRoomCode = room.code;

    roomManager.mapSocket(playerId, socket.id);
    socket.join(room.code);

    if (isReconnect) {
      // Send full room state snapshot for reconnection
      const snapshot = roomManager.getRoomSnapshot(room);
      socket.emit('room_state', snapshot);
      socket.emit('room_joined', {
        roomCode: room.code,
        playerId,
        gameType: room.gameType,
        roomCreatorId: room.roomCreatorId,
        players: [...room.players.values()],
        maxPlayers: room.maxPlayers,
        state: room.state,
      });
      roomManager.mapSocket(playerId, socket.id);
      socket.to(room.code).emit('player_reconnected', { playerId });
    } else {
      socket.emit('room_joined', {
        roomCode: room.code,
        playerId,
        gameType: room.gameType,
        roomCreatorId: room.roomCreatorId,
        players: [...room.players.values()],
        maxPlayers: room.maxPlayers,
        state: room.state,
      });
      socket.to(room.code).emit('player_joined', { player });
    }

    console.log(`👤 ${playerName} ${isReconnect ? 'reconnected to' : 'joined'} room ${room.code}`);
  });

  // ---- Game actions ----

  socket.on('start_game', () => {
    if (!currentRoomCode || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room.' });
      return;
    }

    const error = roomManager.startGame(currentRoomCode, currentPlayerId);
    if (error) {
      socket.emit('error', { message: error });
      return;
    }

    const room = roomManager.getRoom(currentRoomCode);
    if (!room) return;

    io.to(currentRoomCode).emit('game_started', {
      firstCreatorId: room.creatorRotationOrder[0],
      turnOrder: room.rounds[0]?.turnOrder || [],
      maxPlayers: room.maxPlayers,
    });
  });

  socket.on('submit_puzzle', (data: { puzzle: string; hint: string }) => {
    if (!currentRoomCode || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room.' });
      return;
    }

    const error = roomManager.submitPuzzle(currentRoomCode, currentPlayerId, data.puzzle, data.hint);
    if (error) {
      socket.emit('error', { message: error });
    }
  });

  socket.on('guess_letter', (data: { letter: string }) => {
    if (!currentRoomCode || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room.' });
      return;
    }

    const error = roomManager.guessLetter(currentRoomCode, currentPlayerId, data.letter);
    if (error) {
      socket.emit('error', { message: error });
    }
  });

  socket.on('press_guess_answer', () => {
    if (!currentRoomCode || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room.' });
      return;
    }

    const error = roomManager.startAnswerGuess(currentRoomCode, currentPlayerId);
    if (error) {
      socket.emit('error', { message: error });
    }
  });

  socket.on('submit_answer', (data: { answer: string }) => {
    if (!currentRoomCode || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room.' });
      return;
    }

    const error = roomManager.submitAnswer(currentRoomCode, currentPlayerId, data.answer);
    if (error) {
      socket.emit('error', { message: error });
    }
  });

  socket.on('end_session', () => {
    if (!currentRoomCode || !currentPlayerId) {
      return;
    }
    roomManager.endSession(currentRoomCode);
    currentRoomCode = null;
    currentPlayerId = null;
  });

  // ---- Disconnection ----

  socket.on('leave_room', () => {
    if (!currentPlayerId) return;

    const { room, playerName } = roomManager.removePlayer(currentPlayerId);
    if (room) {
      io.to(room.code).emit('player_left', { playerId: currentPlayerId, playerName });
    }

    if (currentRoomCode) {
      socket.leave(currentRoomCode);
    }
    currentPlayerId = null;
    currentRoomCode = null;
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id} (player: ${currentPlayerId})`);

    if (currentPlayerId) {
      const { room } = roomManager.removePlayer(currentPlayerId);
      if (room) {
        // Don't emit player_left immediately — give them a chance to reconnect
        // The player_left is only emitted if they explicitly leave
      }
    }

    currentPlayerId = null;
    currentRoomCode = null;
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 LetterGuess server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
