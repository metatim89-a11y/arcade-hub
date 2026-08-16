import React, { useState, useEffect } from 'react';
import { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';
import { TicTacToeBoard3D } from './BoardGames3D';

type Player = 'X' | 'O' | null;
type GameState = 'playing' | 'gameOver';

interface TicTacToeGameProps {
  playMode: PlayMode;
  playerNames: { player1: string; player2: string };
}

const TicTacToeGame: React.FC<TicTacToeGameProps> = ({ playMode, playerNames }) => {
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [winningLine, setWinningLine] = useState<number[]>([]);

  const winnerInfo = calculateWinner(board);
  const winner = winnerInfo?.winner ?? null;
  const isDraw = board.every(Boolean) && !winner;
  
  useEffect(() => {
    if (winnerInfo) {
      setGameState('gameOver');
      setWinningLine(winnerInfo.line);
    } else if (isDraw) {
      setGameState('gameOver');
    }
  }, [winnerInfo, isDraw]);

  const handleClick = (i: number) => {
    if (gameState === 'gameOver' || board[i] || (playMode === 'vsComputer' && !xIsNext)) {
      return;
    }
    const newBoard = board.slice();
    newBoard[i] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    setXIsNext(!xIsNext);
  };
  
  useEffect(() => {
    if (playMode === 'vsComputer' && !xIsNext && gameState === 'playing') {
      const computerMove = () => {
        const bestMove = findBestMove(board);
        if (bestMove !== -1) {
            const newBoard = board.slice();
            newBoard[bestMove] = 'O';
            setBoard(newBoard);
            setXIsNext(true);
        }
      };
      
      const timer = setTimeout(computerMove, 500);
      return () => clearTimeout(timer);
    }
  }, [xIsNext, gameState, playMode, board]);


  const handleReset = (startingPlayer: 'X' | 'O' = 'X') => {
    setBoard(Array(9).fill(null));
    setXIsNext(startingPlayer === 'X');
    setGameState('playing');
    setWinningLine([]);
  };

  const p1Name = playerNames.player1;
  const p2Name = playMode === 'vsPlayer' ? playerNames.player2 : 'Computer';

  let status;
  if (winner) {
    status = `Winner: ${winner === 'X' ? p1Name : p2Name}!`;
  } else if (isDraw) {
    status = 'Draw!';
  } else {
    status = `Next player: ${xIsNext ? p1Name : p2Name}`;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full w-full max-w-lg mx-auto">
      <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--primary-text-color)' }}>Tic-Tac-Toe</h2>
      <div className="text-2xl mb-4 text-white h-8 font-semibold">{status}</div>
      
      <div className="relative w-full aspect-square max-w-[460px] rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,.48)]">
        <TicTacToeBoard3D
          board={board}
          winningLine={winningLine}
          disabled={gameState === 'gameOver' || (playMode === 'vsComputer' && !xIsNext)}
          onCellClick={handleClick}
        />
      </div>
      
      <div className="mt-6 min-h-[80px] flex flex-col items-center justify-center">
        {gameState === 'gameOver' ? (
          <div className="flex flex-col items-center justify-center gap-4 text-white text-center animate-pop-in">
              {winner ? (
                <>
                  <p className="text-lg opacity-80">
                    {(winner === 'X' ? p1Name : p2Name)} chooses who starts next:
                  </p>
                  <div className="flex gap-4">
                      <GlassButton onClick={() => handleReset('X')}>{p1Name} (X)</GlassButton>
                      <GlassButton onClick={() => handleReset('O')}>{p2Name} (O)</GlassButton>
                  </div>
                </>
              ) : (
                <GlassButton onClick={() => handleReset()}>Play Again</GlassButton>
              )}
          </div>
        ) : (
          <GlassButton onClick={() => handleReset()}>Reset Game</GlassButton>
        )}
      </div>

    </div>
  );
};

function calculateWinner(board: Player[]): { winner: Player; line: number[] } | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a]!, line: lines[i] };
    }
  }
  return null;
}

function findBestMove(board: Player[]): number {
  // 1. Win
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      const tempBoard = [...board];
      tempBoard[i] = 'O';
      if (calculateWinner(tempBoard)?.winner === 'O') return i;
    }
  }
  // 2. Block
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      const tempBoard = [...board];
      tempBoard[i] = 'X';
      if (calculateWinner(tempBoard)?.winner === 'X') return i;
    }
  }
  // 3. Center
  if (!board[4]) return 4;
  // 4. Random available
  const available = board.map((s, i) => s === null ? i : -1).filter(i => i !== -1);
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
  return -1;
}

export default TicTacToeGame;
