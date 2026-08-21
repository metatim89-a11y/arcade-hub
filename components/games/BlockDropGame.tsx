import React, { useCallback, useEffect, useState } from 'react';
import GlassButton from '../ui/GlassButton';

const WIDTH = 10;
const HEIGHT = 18;
const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
];
type Piece = { shape: number[][]; x: number; y: number; color: number };
const colors = ['#22d3ee', '#facc15', '#c084fc', '#fb923c', '#60a5fa', '#34d399', '#f472b6'];
const emptyBoard = () => Array.from({ length: HEIGHT }, () => Array<number>(WIDTH).fill(0));
const randomPiece = (): Piece => { const color = Math.floor(Math.random() * SHAPES.length) + 1; const shape = SHAPES[color - 1].map((row) => [...row]); return { shape, x: Math.floor((WIDTH - shape[0].length) / 2), y: 0, color }; };
const collides = (board: number[][], piece: Piece) => piece.shape.some((row, dy) => row.some((cell, dx) => cell && (piece.y + dy >= HEIGHT || piece.x + dx < 0 || piece.x + dx >= WIDTH || board[piece.y + dy]?.[piece.x + dx])));
const rotate = (shape: number[][]) => shape[0].map((_, x) => shape.map((row) => row[x]).reverse());

const BlockDropGame: React.FC = () => {
  const [board, setBoard] = useState(emptyBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const lock = useCallback((current: Piece) => {
    const merged = board.map((row) => [...row]);
    current.shape.forEach((row, dy) => row.forEach((cell, dx) => { if (cell && merged[current.y + dy]?.[current.x + dx] !== undefined) merged[current.y + dy][current.x + dx] = current.color; }));
    const cleared = merged.filter((row) => row.some((cell) => cell === 0));
    const nextBoard = [...Array.from({ length: HEIGHT - cleared.length }, () => Array<number>(WIDTH).fill(0)), ...cleared];
    setBoard(nextBoard); setScore((value) => value + (HEIGHT - cleared.length) ** 2 * 10);
    const next = randomPiece();
    if (collides(nextBoard, next)) setGameOver(true); else setPiece(next);
  }, [board]);

  const step = useCallback(() => {
    if (gameOver) return;
    const down = { ...piece, y: piece.y + 1 };
    if (collides(board, down)) lock(piece); else setPiece(down);
  }, [board, gameOver, lock, piece]);

  useEffect(() => { const timer = window.setInterval(step, 650); return () => window.clearInterval(timer); }, [step]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (gameOver) return; if (event.key === 'ArrowLeft' && !collides(board, { ...piece, x: piece.x - 1 })) setPiece({ ...piece, x: piece.x - 1 }); if (event.key === 'ArrowRight' && !collides(board, { ...piece, x: piece.x + 1 })) setPiece({ ...piece, x: piece.x + 1 }); if (event.key === 'ArrowDown') step(); if (event.key === 'ArrowUp') { const turned = { ...piece, shape: rotate(piece.shape) }; if (!collides(board, turned)) setPiece(turned); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [board, gameOver, piece, step]);

  const reset = () => { setBoard(emptyBoard()); setPiece(randomPiece()); setScore(0); setGameOver(false); };
  
  return <div className="flex w-full max-w-md flex-col items-center gap-4 px-2 text-white">
    <div className="flex w-full items-center justify-between"><h2 className="text-3xl font-black text-fuchsia-200">Block Drop</h2><span className="rounded-lg bg-white/10 px-3 py-2 text-sm font-black">Score {score}</span></div>
    <p className="text-center text-xs text-fuchsia-100/70">Arrow keys move and rotate the falling blocks. Clear complete rows.</p>
    
    <div className="relative grid w-full max-w-[300px] grid-cols-10 gap-px rounded-xl border-4 border-fuchsia-300/30 bg-slate-950 p-1" role="grid" aria-label="Block Drop board">
      {/* Background and Settled Blocks */}
      {board.map((row, y) => row.map((_, x) => { 
        const value = board[y][x]; 
        return <span key={`bg-${x}-${y}`} className="aspect-square rounded-[3px] transition-colors duration-300" style={{ background: value ? colors[value - 1] : 'rgba(255,255,255,.045)', boxShadow: value ? `0 0 10px ${colors[value - 1]}` : 'none' }} />; 
      }))}

      {/* Active Animated Piece */}
      {!gameOver && piece.shape.map((row, dy) => row.map((cell, dx) => {
         if (!cell) return null;
         const gridX = piece.x + dx;
         const gridY = piece.y + dy;
         return <span 
           key={`active-${dx}-${dy}`} 
           className="absolute z-10 rounded-[3px] transition-all duration-[120ms] ease-out shadow-lg shadow-black/50 aspect-square"
           style={{ 
             width: 'calc(10% - 1px)',
             left: `calc(4px + ${gridX} * 10%)`,
             top: `calc(4px + ${gridY} * ((100% - 8px) / 18))`,
             backgroundColor: colors[piece.color - 1], 
             boxShadow: `inset 0 0 8px rgba(255,255,255,0.4), 0 0 15px ${colors[piece.color - 1]}`
           }} 
         />; 
      }))}
    </div>
    
    <div className="mt-4 flex w-full max-w-[300px] justify-between gap-4">
      {/* Directional pad */}
      <div className="flex gap-2 rounded-xl bg-slate-900/50 p-2 shadow-inner border border-white/5">
        <button 
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 text-xl text-fuchsia-300 shadow-[0_4px_0_theme(colors.slate.950),_0_2px_10px_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_0px_0_theme(colors.slate.950)]" 
          onClick={() => { if (!collides(board, { ...piece, x: piece.x - 1 })) setPiece({ ...piece, x: piece.x - 1 }); }}
          aria-label="Move Left"
        >
          ◀
        </button>
        <button 
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 text-xl text-fuchsia-300 shadow-[0_4px_0_theme(colors.slate.950),_0_2px_10px_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_0px_0_theme(colors.slate.950)]" 
          onClick={step}
          aria-label="Drop Down"
        >
          ▼
        </button>
        <button 
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 text-xl text-fuchsia-300 shadow-[0_4px_0_theme(colors.slate.950),_0_2px_10px_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_0px_0_theme(colors.slate.950)]" 
          onClick={() => { if (!collides(board, { ...piece, x: piece.x + 1 })) setPiece({ ...piece, x: piece.x + 1 }); }}
          aria-label="Move Right"
        >
          ▶
        </button>
      </div>
      
      {/* Action / Rotate Button */}
      <div className="flex items-center">
        <button 
          className="flex h-14 w-14 rounded-full items-center justify-center bg-fuchsia-500 text-2xl text-white shadow-[0_6px_0_theme(colors.fuchsia.700),_0_4px_15px_rgba(217,70,239,0.4)] transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-[0_0px_0_theme(colors.fuchsia.700)] outline-none focus:ring-4 ring-fuchsia-400/50"
          onClick={() => { const turned = { ...piece, shape: rotate(piece.shape) }; if (!collides(board, turned)) setPiece(turned); }}
          aria-label="Rotate Piece"
        >
          ↻
        </button>
      </div>
    </div>
    
    <div className="mt-2 text-center w-full max-w-[300px]">
      <GlassButton onClick={reset} className="w-full justify-center opacity-80 hover:opacity-100">{gameOver ? 'PLAY AGAIN' : 'RESET'}</GlassButton>
    </div>
    {gameOver && <p className="animate-pop-in text-xl font-black text-yellow-200">Game over — final score {score}</p>}
  </div>;
};

export default BlockDropGame;
