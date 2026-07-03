// ============================================================
// Game — Main game board (FUNKY STYLE)
// ============================================================

import { useState, useEffect } from 'react';
import { GameState } from '../types';
import PuzzleBoard from '../components/PuzzleBoard';
import LetterButtons from '../components/LetterButtons';
import Scoreboard from '../components/Scoreboard';
import Timer from '../components/Timer';
import CreatorOverlay from '../components/CreatorOverlay';
import AnswerGuessInput from '../components/AnswerGuessInput';
import RoundEndModal from '../components/RoundEndModal';
import SessionEndModal from '../components/SessionEndModal';

interface Props {
  gs: GameState;
  emit: (event: string, data?: any) => void;
}

export default function Game({ gs, emit }: Props) {
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  
  // Show round-end modal when data arrives, hide when next round starts
  useEffect(() => {
    if (gs.roundEndData) setShowRoundEnd(true);
    else setShowRoundEnd(false);
  }, [gs.roundEndData]);
  
  const myPlayer = gs.players.find(p => p.id === gs.playerId);
  const isCreator = gs.currentRound?.creatorId === gs.playerId;
  const isEliminated = gs.currentRound?.perPlayer[gs.playerId || '']?.eliminated;
  const myLetterGuesses = gs.currentRound?.perPlayer[gs.playerId || '']?.letterGuesses || 0;
  const myWrongAnswers = gs.currentRound?.perPlayer[gs.playerId || '']?.wrongAnswerGuesses || 0;
  const myRoundScore = gs.currentRound?.scores[gs.playerId || ''] || 0;

  // Count remaining hidden letters
  const hiddenCount = gs.currentRound?.revealed?.filter(ch => ch === '_').length || 0;

  // Round count
  const completedRounds = gs.rounds.filter(r => r.winnerId !== undefined || r.puzzle).length;
  const roundLabel = completedRounds + 1;

  // If session ended
  if (gs.sessionEndData) {
    return <SessionEndModal gs={gs} emit={emit} />;
  }

  const roundPhase = gs.currentRound?.phase;

  return (
    <div className="bg-particles min-h-screen">
      <main className="max-w-2xl mx-auto pt-3 pb-8 px-3 sm:px-4 relative z-10">
        {/* === TOP BAR === */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-purple-400/70 bg-purple-500/10 px-2 py-1 rounded-lg">
              Round {roundLabel}
            </span>
            {gs.currentRound?.hint && (
              <div className="flex items-center gap-2 glass-card px-4 py-2 animate-slide-up">
                <span className="text-lg">💡</span>
                <span className="text-neon-yellow font-bold">{gs.currentRound.hint}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {roundPhase === 'PLAYING' && gs.isMyTurn && gs.turnSecondsLeft !== null && (
              <Timer seconds={gs.turnSecondsLeft} total={gs.turnTimeLimit || 10} label="YOUR TURN" />
            )}
            {roundPhase === 'GUESSING_ANSWER' && gs.isMeGuessing && gs.turnSecondsLeft !== null && (
              <Timer seconds={gs.turnSecondsLeft} total={gs.turnTimeLimit || 20} label="ANSWER!" urgent />
            )}
          </div>
        </div>

        {/* === PUZZLE BOARD === */}
        <div className="glass-card-game p-4 sm:p-6 mb-5 animate-slide-up">
          <PuzzleBoard
            revealed={gs.currentRound?.revealed || []}
            phase={roundPhase || 'CREATION'}
          />
        </div>

        {/* === CREATOR MODE === */}
        {roundPhase === 'CREATION' && isCreator && (
          <CreatorOverlay emit={emit} timeLimit={gs.turnTimeLimit || 120} secondsLeft={gs.turnSecondsLeft} />
        )}
        {roundPhase === 'CREATION' && !isCreator && (
          <div className="text-center py-10 animate-pulse">
            <div className="text-6xl mb-4">🎨</div>
            <p className="text-xl text-purple-300 font-bold">
              {gs.players.find(p => p.id === gs.currentRound?.creatorId)?.name}
            </p>
            <p className="text-gray-400 mt-1">is creating a puzzle...</p>
          </div>
        )}

        {/* === ANSWER GUESSING === */}
        {roundPhase === 'GUESSING_ANSWER' && (
          <>
            {gs.isMeGuessing ? (
              <AnswerGuessInput emit={emit} secondsLeft={gs.turnSecondsLeft} />
            ) : (
              <div className="text-center py-10 animate-pulse">
                <div className="text-6xl mb-4">🤔</div>
                <p className="text-xl text-amber-300 font-bold">{gs.guessingPlayerName}</p>
                <p className="text-gray-400 mt-1">is guessing the answer...</p>
                {gs.waitingTimerSecondsLeft !== null && (
                  <p className={`text-lg font-mono font-bold mt-2 ${
                    (gs.waitingTimerSecondsLeft || 0) <= 5 ? 'text-red-400 animate-pulse' : 'text-neon-cyan'
                  }`}>
                    {gs.waitingTimerSecondsLeft}s
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* === PLAYING PHASE === */}
        {roundPhase === 'PLAYING' && (
          <>
            {/* Turn indicator */}
            <div className="text-center mb-3">
              {gs.isMyTurn ? (
                <div className="inline-flex items-center gap-2 glass-card px-5 py-2 animate-pulse-glow border-neon-cyan/30">
                  <span className="text-xl">🎯</span>
                  <span className="text-neon-cyan font-bold text-lg">Your turn!</span>
                </div>
              ) : isEliminated ? (
                <div className="inline-flex items-center gap-2 glass-card px-5 py-2 border-red-500/20">
                  <span className="text-xl">💀</span>
                  <span className="text-red-400 font-semibold">Eliminated — watch only</span>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">
                  ⏳ Waiting for{' '}
                  <span className="text-white font-bold">
                    {gs.waitingPlayerName || gs.players.find(p => p.id === gs.currentRound?.turnOrder[gs.currentRound?.turnIndex || 0])?.name}
                  </span>
                  {gs.waitingTimerSecondsLeft !== null && (
                    <span className={`ml-2 font-mono font-bold ${
                      (gs.waitingTimerSecondsLeft || 0) <= 5 ? 'text-red-400 animate-pulse' : 'text-neon-cyan'
                    }`}>
                      {gs.waitingTimerSecondsLeft}s
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Letter buttons */}
            <div className="mb-5">
              <LetterButtons
                usedLetters={gs.currentRound?.usedLetters || []}
                disabled={!gs.isMyTurn || isEliminated || false}
                onGuess={(letter) => emit('guess_letter', { letter })}
              />
            </div>

            {/* My stats bar */}
            {myPlayer && !isCreator && (
              <div className="glass-card px-4 py-3 mb-4 flex items-center justify-between text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">🔤</span>
                  <span className="text-white">{myLetterGuesses}</span>
                  <span className="text-gray-500">/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">❌</span>
                  <span className={myWrongAnswers > 0 ? 'text-red-400' : 'text-white'}>{myWrongAnswers}</span>
                  <span className="text-gray-500">/2</span>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full font-black text-lg ${
                  myRoundScore > 0 ? 'bg-neon-lime/10 text-neon-lime' :
                  myRoundScore < 0 ? 'bg-red-500/10 text-red-400' :
                  'bg-white/5 text-gray-400'
                }`}>
                  {myRoundScore > 0 ? '+' : ''}{myRoundScore}
                </div>
              </div>
            )}

            {/* Guess Answer button */}
            {!isCreator && !isEliminated && (
              <>
                {hiddenCount > 0 && hiddenCount <= 3 && (
                  <div className="text-center mb-3 animate-pulse">
                    <p className="text-neon-orange font-bold text-sm">
                      ⚡ Only <span className="text-xl">{hiddenCount}</span> letter{hiddenCount > 1 ? 's' : ''} left — Guess the answer now!
                    </p>
                  </div>
                )}
                <button
                  onClick={() => emit('press_guess_answer')}
                  disabled={gs.guessingPlayerId !== null}
                  className={`w-full btn-neon btn-neon-amber py-4 text-lg disabled:opacity-30 disabled:cursor-not-allowed mb-2 ${
                    hiddenCount <= 2 ? 'animate-pulse-glow !py-5 !text-xl scale-105' : ''
                  }`}
                >
                  {gs.guessingPlayerId ? `⏳ ${gs.guessingPlayerName || 'Someone'} is guessing...` : '🎯 GUESS THE ANSWER!'}
                </button>
              </>
            )}

            {isCreator && (
              <div className="text-center py-2 glass-card border-purple-500/20">
                <span className="text-purple-300 font-semibold">🎨 You are the puzzle creator — enjoy the show!</span>
              </div>
            )}

            {isEliminated && (
              <p className="text-center text-xs text-red-400/60 mt-2">
                You can no longer guess. Stick around for the next round! 🔄
              </p>
            )}
          </>
        )}

        {/* === SCOREBOARD === */}
        <div className="mt-6 animate-slide-up">
          <Scoreboard
            players={gs.players}
            scores={gs.scores}
            roundScores={gs.currentRound?.scores}
            currentRound={gs.currentRound}
            myPlayerId={gs.playerId}
          />
        </div>

        {/* === ROUND END MODAL === */}
        {showRoundEnd && gs.roundEndData && (
          <RoundEndModal
            winnerId={gs.roundEndData.winnerId}
            winnerName={gs.roundEndData.winnerName}
            puzzle={gs.roundEndData.puzzle}
            players={gs.players}
            scores={gs.scores}
            myPlayerId={gs.playerId}
            onDismiss={() => setShowRoundEnd(false)}
          />
        )}
      </main>
    </div>
  );
}
