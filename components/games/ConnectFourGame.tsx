import React, { useState, useEffect } from 'react';
import { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';

const ROWS = 6;
const COLS = 7;
type Player = '1' | '2';
type Cell = Player | null;
type GameState = 'playing' | 'gameOver';

interface Piece {
  col: number;
  row: number;
  player: Player;
  id: number;
}

interface ConnectFourProps {
  playMode: PlayMode;
  playerNames: { player1: string; player2: string };
}

const PieceComponent: React.FC<{ piece: Piece; isWinning: boolean; isLanding: boolean; }> = ({ piece, isWinning, isLanding }) => {
    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'absolute',
        top: 0,
        // Corrected positioning logic for perfect alignment
        left: `calc(${(100 / COLS) * piece.col}%)`,
        width: `calc(${100 / COLS}%)`,
        height: `calc(${100 / ROWS}%)`,
        transform: 'translateY(-150%)', // Start above the board
        padding: 'calc(var(--board-gap, 1.5%) / 2)', // Use padding to create visual gap
    });

    useEffect(() => {
        // On mount, trigger the animation to the final position
        requestAnimationFrame(() => {
            setStyle(s => ({
                ...s,
                transform: `translateY(calc(${piece.row} * 100%))`,
                transition: 'transform 0.6s ease-in',
            }));
        });
    }, [piece.row]);

    return (
        <div style={style}>
            <div
              className={`
                w-full h-full rounded-full
                ${isWinning ? 'animate-glow' : ''}
                ${isLanding ? 'animate-thud' : ''}
              `}
              style={{ backgroundColor: piece.player === '1' ? 'var(--connect4-p1-color)' : 'var(--connect4-p2-color)' }}
            ></div>
        </div>
    );
};


const ConnectFourGame: React.FC<ConnectFourProps> = ({ playMode, playerNames }) => {
  const [board, setBoard] = useState<Cell[][]>(() => Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>('1');
  const [winner, setWinner] = useState<Player | null>(null);
  const [winningLine, setWinningLine] = useState<[number, number][]>([]);
  const [isDraw, setIsDraw] = useState(false);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [landingPieceId, setLandingPieceId] = useState<number | null>(null);


  const checkWinner = (b: Cell[][]): [Player, [number, number][]] | null => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (!p) continue;

        if (c + 3 < COLS && p === b[r][c+1] && p === b[r][c+2] && p === b[r][c+3]) {
          return [p, [[r,c], [r,c+1], [r,c+2], [r,c+3]]];
        }
        if (r + 3 < ROWS) {
          if (p === b[r+1][c] && p === b[r+2][c] && p === b[r+3][c]) {
            return [p, [[r,c], [r+1,c], [r+2,c], [r+3,c]]];
          }
          if (c + 3 < COLS && p === b[r+1][c+1] && p === b[r+2][c+2] && p === b[r+3][c+3]) {
            return [p, [[r,c], [r+1,c+1], [r+2,c+2], [r+3,c+3]]];
          }
          if (c - 3 >= 0 && p === b[r+1][c-1] && p === b[r+2][c-2] && p === b[r+3][c-3]) {
            return [p, [[r,c], [r+1,c-1], [r+2,c-2], [r+3,c-3]]];
          }
        }
      }
    }
    return null;
  };
  
  const makeMove = (col: number, player: Player) => {
    if (board[0][col]) return;

    let targetRow = -1;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (!board[row][col]) {
        targetRow = row;
        break;
      }
    }
    
    if (targetRow !== -1) {
      setIsAnimating(true);
      setHoverCol(null);
      setLandingPieceId(null);

      const newPiece = { col, row: targetRow, player, id: pieces.length };
      setPieces(prev => [...prev, newPiece]);

      // State update is now split: animation starts, then logic finalizes.
      setTimeout(() => {
        setLandingPieceId(newPiece.id);
        const newBoard = board.map(r => [...r]);
        newBoard[targetRow][col] = player;
        setBoard(newBoard);

        const winResult = checkWinner(newBoard);
        if (winResult) {
          setWinner(winResult[0]);
          setWinningLine(winResult[1]);
          setGameState('gameOver');
        } else if (newBoard.flat().every(cell => cell !== null)) {
          setIsDraw(true);
          setGameState('gameOver');
        } else {
          setCurrentPlayer(player === '1' ? '2' : '1');
        }
        setIsAnimating(false);
      }, 650); // Animation duration + buffer
    }
  };


  const handlePlayerClick = (col: number) => {
    if (isAnimating || gameState === 'gameOver' || (playMode === 'vsComputer' && currentPlayer === '2')) return;
    makeMove(col, currentPlayer);
  };

  useEffect(() => {
    if (playMode === 'vsComputer' && currentPlayer === '2' && gameState === 'playing' && !isAnimating) {
      const computerMove = () => {
        let move = -1;
        const getTestBoard = (c: number, p: Player): Cell[][] | null => {
            if(board[0][c]) return null;
            const testBoard = board.map(r => [...r]);
            for (let row = ROWS - 1; row >= 0; row--) {
                if (!testBoard[row][c]) {
                    testBoard[row][c] = p;
                    return testBoard;
                }
            }
            return null;
        }

        for(let c=0; c<COLS; c++){ const testBoard = getTestBoard(c, '2'); if(testBoard && checkWinner(testBoard)) { move = c; break; } }
        if(move === -1){ for(let c=0; c<COLS; c++){ const testBoard = getTestBoard(c, '1'); if(testBoard && checkWinner(testBoard)) { move = c; break; } } }
        
        if(move === -1){ 
            let validMoves = Array.from({length: COLS}, (_, c) => c).filter(c => !board[0][c]);
            if (validMoves.length > 0) {
              move = validMoves[Math.floor(Math.random() * validMoves.length)]; 
            }
        }
        
        if (move !== -1) {
          makeMove(move, '2');
        }
      };
      
      const timer = setTimeout(computerMove, 700);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameState, playMode, board, isAnimating]);

  const handleReset = (startingPlayer: Player = '1') => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
    setPieces([]);
    setCurrentPlayer(startingPlayer);
    setWinner(null);
    setWinningLine([]);
    setIsDraw(false);
    setGameState('playing');
  };

  const p1Name = playerNames.player1;
  const p2Name = playMode === 'vsPlayer' ? playerNames.player2 : 'Computer';

  let status;
  if (winner) status = `${winner === '1' ? p1Name : p2Name} Wins!`;
  else if (isDraw) status = "It's a Draw!";
  else status = `${currentPlayer === '1' ? p1Name : p2Name}'s Turn`;


  if (gameState === 'gameOver') {
    const winnerName = winner === '1' ? p1Name : p2Name;
     return (
        <div className="flex flex-col items-center justify-center gap-4 h-full text-white text-center animate-pop-in">
            <h2 className="text-4xl font-bold" style={{ color: 'var(--primary-text-color)' }}>Game Over</h2>
            <p className="text-2xl">{status}</p>
            {winner && (
              <div className="mt-4">
                <p className="text-lg mb-2">{winnerName} chooses who starts next:</p>
                <div className="flex gap-4">
                    <GlassButton onClick={() => handleReset('1')}>{p1Name} Starts</GlassButton>
                    <GlassButton onClick={() => handleReset('2')}>
                        {p2Name} Starts
                    </GlassButton>
                </div>
              </div>
            )}
            {isDraw && (<GlassButton onClick={() => handleReset()} className="mt-6">Play Again</GlassButton>)}
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full w-full">
      <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--primary-text-color)' }}>Connect Four</h2>
      <div className="text-xl mb-4 text-white flex items-center gap-3">
        {status}
        {gameState === 'playing' && (<div className="w-6 h-6 rounded-full" style={{ backgroundColor: currentPlayer === '1' ? 'var(--connect4-p1-color)' : 'var(--connect4-p2-color)'}}></div>)}
      </div>
      <div className="relative w-full max-w-lg aspect-[7/6]" style={{ '--board-gap': 'var(--board-gap)' } as React.CSSProperties}>
        {/* Pieces Container - uses a grid that perfectly overlays the board visuals */}
        <div className="absolute inset-0 grid grid-rows-6 grid-cols-7 z-20 pointer-events-none">
            {pieces.map(p => {
                const isWinningPiece = winningLine.some(([r, c]) => r === p.row && c === p.col);
                return <PieceComponent key={p.id} piece={p} isWinning={isWinningPiece} isLanding={p.id === landingPieceId} />
            })}
        </div>

        {/* Board Visuals */}
        <div 
          className="relative grid grid-cols-7 p-[calc(var(--board-gap)/2)] gap-[var(--board-gap)] rounded-lg shadow-lg z-10 w-full h-full pointer-events-none"
          style={{ backgroundColor: 'var(--connect4-board-color)' }}
        >
          {Array.from({ length: ROWS * COLS }).map((_, i) => (
            <div key={i} className="w-full aspect-square bg-gray-900 rounded-full"></div>
          ))}
        </div>
        
        {/* Interaction Layer */}
        <div className="absolute inset-0 grid grid-cols-7 z-30">
          {Array.from({ length: COLS }).map((_, col) => (
            <div 
              key={col}
              onClick={() => handlePlayerClick(col)} 
              onMouseEnter={() => !isAnimating && setHoverCol(col)}
              onMouseLeave={() => setHoverCol(null)}
              className={`w-full h-full ${isAnimating || gameState !== 'playing' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Hover Guide */}
              {hoverCol === col && !isAnimating && gameState === 'playing' && (
                  <div className="w-full h-full" style={{padding: 'calc(var(--board-gap)/2)'}}>
                      <div className="w-full aspect-square rounded-full opacity-50" style={{ backgroundColor: currentPlayer === '1' ? 'var(--connect4-p1-color)' : 'var(--connect4-p2-color)'}}></div>
                  </div>
              )}
            </div>
          ))}
        </div>

      </div>
      <button onClick={() => handleReset()} className="mt-4 bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-yellow-400 transition-colors">Reset Game</button>
    </div>
  );
};

export default ConnectFourGame;