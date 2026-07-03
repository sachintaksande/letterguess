# 🔤 LetterGuess

**Multiplayer word guessing arena** — Hangman-style game with rotating puzzle master, real-time turns, and a funky neon UI.

## How to Play

1. **Create a room** — set max players and rounds, share the 8-digit code
2. **Players join** — everyone gets a random animal alias
3. **One player creates a puzzle** each round — rotation is automatic
4. **Guess letters** one by one — +1 for correct, −1 for wrong, turn passes
5. **Guess the answer** anytime — +10 if correct (round ends), −10 to guesser + +5 to everyone else if wrong
6. **Two wrong answers** = eliminated for that round
7. **Winner** = highest average points per round played

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + Socket.io |
| Real-time | WebSockets (Socket.io) |

## Quick Start

```bash
# Install dependencies
npm run install:all

# Start both server (port 3000) and client (port 5173)
npm run dev

# Or individually
cd server && npm run dev
cd client && npm run dev
```

Open `http://localhost:5173` — create a room, share the code, and play!

## Project Structure

```
letterguess/
├── server/                  # Express + Socket.io backend
│   └── src/
│       ├── index.ts         # Server entry, socket event handlers
│       ├── game/
│       │   ├── types.ts     # Shared type definitions
│       │   ├── RoomManager.ts  # Room lifecycle, turns, scoring, timers
│       │   └── RoundManager.ts # Per-round logic, letter reveals
│       └── utils/
│           └── roomCode.ts  # 8-digit numeric room code generator
├── client/                  # React + Vite frontend
│   └── src/
│       ├── App.tsx          # Root component, socket events, state
│       ├── pages/
│       │   ├── Home.tsx     # Create/join room
│       │   ├── Lobby.tsx    # Player list, room code, start button
│       │   └── Game.tsx     # Game board: puzzle, letters, answer
│       └── components/
│           ├── PuzzleBoard.tsx     # Word tiles with responsive sizing
│           ├── LetterButtons.tsx   # A-Z letter grid
│           ├── CreatorOverlay.tsx  # Puzzle creation + review
│           ├── Scoreboard.tsx      # Player scores
│           ├── Timer.tsx           # Countdown bar
│           └── AnswerGuessInput.tsx # Type-your-answer input
└── package.json             # Root scripts (concurrently)
```
