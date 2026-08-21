import React, { useCallback, useEffect, useRef, useState } from 'react';
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
const randomPiece = (): Piece => { 
  const color = Math.floor(Math.random() * SHAPES.length) + 1; 
  const shape = SHAPES[color - 1].map((row) => [...row]); 
  return { shape, x: Math.floor((WIDTH - shape[0].length) / 2), y: 0, color }; 
};
const collides = (board: number[][], piece: Piece) => 
  piece.shape.some((row, dy) => row.some((cell, dx) => cell && (piece.y + dy >= HEIGHT || piece.x + dx < 0 || piece.x + dx >= WIDTH || board[piece.y + dy]?.[piece.x + dx])));
const rotate = (shape: number[][]) => shape[0].map((_, x) => shape.map((row) => row[x]).reverse());

const BlockDropGame: React.FC = () => {
  const [board, setBoard] = useState(emptyBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('blockdrop_highscore') || 0));
  const [gameOver, setGameOver] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

  const playSfx = (type: 'move' | 'rotate' | 'drop' | 'clear' | 'gameover') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'rotate') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'drop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'clear') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(70, now + 0.35);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {}
  };

  // Calculate Ghost Piece position
  const getGhostY = useCallback(() => {
    let ghostY = piece.y;
    while (!collides(board, { ...piece, y: ghostY + 1 })) {
      ghostY += 1;
    }
    return ghostY;
  }, [board, piece]);

  const lock = useCallback((current: Piece) => {
    const merged = board.map((row) => [...row]);
    current.shape.forEach((row, dy) => row.forEach((cell, dx) => { 
      if (cell && merged[current.y + dy]?.[current.x + dx] !== undefined) {
        merged[current.y + dy][current.x + dx] = current.color; 
      }
    }));

    const cleared = merged.filter((row) => row.some((cell) => cell === 0));
    const linesCleared = HEIGHT - cleared.length;
    const nextBoard = [...Array.from({ length: linesCleared }, () => Array<number>(WIDTH).fill(0)), ...cleared];
    
    if (linesCleared > 0) {
      playSfx('clear');
      setLines(l => l + linesCleared);
      setScore(value => {
        const added = linesCleared === 4 ? 800 : linesCleared * 150;
        const newScore = value + added;
        if (newScore > highScore) {
          setHighScore(newScore);
          localStorage.setItem('blockdrop_highscore', String(newScore));
        }
        return newScore;
      });
    } else {
      playSfx('drop');
    }

    setBoard(nextBoard);
    const next = randomPiece();
    if (collides(nextBoard, next)) {
      playSfx('gameover');
      setGameOver(true);
    } else {
      setPiece(next);
    }
  }, [board, highScore]);

  const step = useCallback(() => {
    if (gameOver) return;
    const down = { ...piece, y: piece.y + 1 };
    if (collides(board, down)) {
      lock(piece);
    } else {
      setPiece(down);
    }
  }, [board, gameOver, lock, piece]);

  const moveLeft = useCallback(() => {
    if (gameOver) return;
    setPiece((p) => {
      if (!collides(board, { ...p, x: p.x - 1 })) {
        playSfx('move');
        return { ...p, x: p.x - 1 };
      }
      return p;
    });
  }, [board, gameOver]);

  const moveRight = useCallback(() => {
    if (gameOver) return;
    setPiece((p) => {
      if (!collides(board, { ...p, x: p.x + 1 })) {
        playSfx('move');
        return { ...p, x: p.x + 1 };
      }
      return p;
    });
  }, [board, gameOver]);

  const rotatePiece = useCallback(() => {
    if (gameOver) return;
    setPiece((p) => {
      const turned = { ...p, shape: rotate(p.shape) };
      if (!collides(board, turned)) {
        playSfx('rotate');
        return turned;
      }
      return p;
    });
  }, [board, gameOver]);

  const hardDrop = useCallback(() => {
    if (gameOver) return;
    const targetY = getGhostY();
    const droppedPiece = { ...piece, y: targetY };
    lock(droppedPiece);
  }, [gameOver, getGhostY, lock, piece]);

  const stopHold = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  const startHold = useCallback((action: () => void) => {
    stopHold();
    action();
    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        action();
      }, 85);
    }, 180);
  }, [stopHold]);

  useEffect(() => {
    return () => stopHold();
  }, [stopHold]);

  // Dynamic speed based on score/lines
  const speedMs = Math.max(250, 650 - lines * 25);

  useEffect(() => { 
    const timer = window.setInterval(step, speedMs); 
    return () => window.clearInterval(timer); 
  }, [step, speedMs]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { 
      if (gameOver) return; 
      if (event.key === 'ArrowLeft' || event.key === 'a') {
        moveLeft();
      } else if (event.key === 'ArrowRight' || event.key === 'd') {
        moveRight();
      } else if (event.key === 'ArrowDown' || event.key === 's') {
        playSfx('move');
        step(); 
      } else if (event.key === 'ArrowUp' || event.key === 'w') { 
        rotatePiece();
      } else if (event.key === ' ') {
        event.preventDefault();
        hardDrop();
      }
    };
    window.addEventListener('keydown', onKey); 
    return () => window.removeEventListener('keydown', onKey);
  }, [gameOver, hardDrop, moveLeft, moveRight, rotatePiece, step]);

  const reset = () => { 
    stopHold();
    setBoard(emptyBoard()); 
    setPiece(randomPiece()); 
    setScore(0); 
    setLines(0);
    setGameOver(false); 
  };

  const ghostY = getGhostY();
  
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4 px-2 text-white select-none">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-3xl font-black text-fuchsia-200 drop-shadow-[0_0_12px_rgba(232,121,249,0.4)]">Block Drop</h2>
        <div className="flex gap-2">
          <span className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-black text-yellow-300">Score {score}</span>
          <span className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-black text-amber-400">Best {highScore}</span>
        </div>
      </div>

      <div 
        className="relative grid w-full max-w-[300px] grid-cols-10 gap-px rounded-2xl border-4 border-fuchsia-400/30 bg-slate-950 p-1.5 shadow-[0_0_40px_rgba(217,70,239,0.15)] touch-none" 
        role="grid" 
        aria-label="Block Drop board"
      >
        {/* Background Grid & Settled Blocks */}
        {board.map((row, y) => row.map((_, x) => { 
          const value = board[y][x]; 
          return (
            <span 
              key={`bg-${x}-${y}`} 
              className="aspect-square rounded-[3px] transition-colors duration-150" 
              style={{ 
                background: value ? colors[value - 1] : 'rgba(255,255,255,.045)', 
                boxShadow: value ? `inset 0 0 4px rgba(255,255,255,0.4), 0 0 10px ${colors[value - 1]}` : 'none' 
              }} 
            />
          ); 
        }))}

        {/* Ghost Piece Outline Preview */}
        {!gameOver && ghostY !== piece.y && piece.shape.map((row, dy) => row.map((cell, dx) => {
           if (!cell) return null;
           const gridX = piece.x + dx;
           const gridY = ghostY + dy;
           return (
             <span 
               key={`ghost-${dx}-${dy}`} 
               className="absolute z-5 rounded-[3px] border border-white/40 bg-white/10 aspect-square pointer-events-none"
               style={{ 
                 width: 'calc(10% - 1.5px)',
                 left: `calc(6px + ${gridX} * 10%)`,
                 top: `calc(6px + ${gridY} * ((100% - 12px) / 18))`,
               }} 
             />
           ); 
        }))}

        {/* Active Animated Falling Piece */}
        {!gameOver && piece.shape.map((row, dy) => row.map((cell, dx) => {
           if (!cell) return null;
           const gridX = piece.x + dx;
           const gridY = piece.y + dy;
           return (
             <span 
               key={`active-${dx}-${dy}`} 
               className="absolute z-10 rounded-[3px] shadow-lg shadow-black/50 aspect-square"
               style={{ 
                 width: 'calc(10% - 1.5px)',
                 left: `calc(6px + ${gridX} * 10%)`,
                 top: `calc(6px + ${gridY} * ((100% - 12px) / 18))`,
                 backgroundColor: colors[piece.color - 1], 
                 boxShadow: `inset 0 0 8px rgba(255,255,255,0.6), 0 0 15px ${colors[piece.color - 1]}`
               }} 
             />
           ); 
        }))}
      </div>
      
      {/* Spacious Mobile Arcade Controller Pad */}
      <div className="mt-2 flex w-full max-w-[380px] justify-between items-center gap-4 px-1 touch-none">
        {/* Directional Movement Cluster */}
        <div className="flex gap-2.5 rounded-2xl bg-slate-900/90 p-2.5 border border-white/10 shadow-xl">
          <button 
            type="button"
            className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-slate-800 text-xl font-bold text-fuchsia-300 active:bg-fuchsia-600 active:text-white transition-all shadow-md active:scale-95" 
            onPointerDown={(e) => { e.preventDefault(); startHold(moveLeft); }}
            onPointerUp={(e) => { e.preventDefault(); stopHold(); }}
            onPointerCancel={stopHold}
            onPointerLeave={stopHold}
            aria-label="Move Left"
          >
            ◀
          </button>
          <button 
            type="button"
            className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-slate-800 text-xl font-bold text-fuchsia-300 active:bg-fuchsia-600 active:text-white transition-all shadow-md active:scale-95" 
            onPointerDown={(e) => { e.preventDefault(); startHold(step); }}
            onPointerUp={(e) => { e.preventDefault(); stopHold(); }}
            onPointerCancel={stopHold}
            onPointerLeave={stopHold}
            aria-label="Soft Drop"
          >
            ▼
          </button>
          <button 
            type="button"
            className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-slate-800 text-xl font-bold text-fuchsia-300 active:bg-fuchsia-600 active:text-white transition-all shadow-md active:scale-95" 
            onPointerDown={(e) => { e.preventDefault(); startHold(moveRight); }}
            onPointerUp={(e) => { e.preventDefault(); stopHold(); }}
            onPointerCancel={stopHold}
            onPointerLeave={stopHold}
            aria-label="Move Right"
          >
            ▶
          </button>
        </div>
        
        {/* Action Cluster (Rotate & Instant Drop) */}
        <div className="flex gap-3 items-center">
          <button 
            type="button"
            className="flex h-13 w-13 sm:h-14 sm:w-14 rounded-2xl items-center justify-center bg-fuchsia-600 text-2xl font-bold text-white shadow-[0_0_15px_rgba(217,70,239,0.5)] active:scale-95 transition-all hover:bg-fuchsia-500 border border-fuchsia-300/40"
            onPointerDown={(e) => { e.preventDefault(); rotatePiece(); }}
            aria-label="Rotate Piece"
          >
            ↻
          </button>
          <button 
            type="button"
            className="flex h-13 w-13 sm:h-14 sm:w-14 rounded-2xl items-center justify-center bg-cyan-600 text-xl font-black text-white shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 transition-all hover:bg-cyan-500 border border-cyan-300/40"
            onPointerDown={(e) => { e.preventDefault(); hardDrop(); }}
            aria-label="Instant Drop"
            title="Instant Drop"
          >
            ⚡
          </button>
        </div>
      </div>
      
      <div className="mt-1 text-center w-full max-w-[300px]">
        <GlassButton onClick={reset} className="w-full justify-center text-sm py-2">{gameOver ? 'PLAY AGAIN' : 'RESET BOARD'}</GlassButton>
      </div>
    </div>
  );
};

export default BlockDropGame;
