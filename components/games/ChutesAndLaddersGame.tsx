import React, { useMemo, useRef, useState } from 'react';
import type { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';

type Props = { playMode: PlayMode; playerNames: { player1: string; player2: string } };
const jumps: Record<number, number> = { 
  1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100, 
  16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 
};

const ChutesAndLaddersGame: React.FC<Props> = ({ playMode, playerNames }) => {
  const [positions, setPositions] = useState([1, 1]);
  const [turn, setTurn] = useState(0);
  const [roll, setRoll] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  
  const names = [playerNames.player1, playMode === 'vsComputer' ? 'Computer' : playerNames.player2];
  
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSfx = (type: 'roll' | 'step' | 'ladder' | 'chute' | 'win') => {
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

      if (type === 'roll') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300 + Math.random() * 200, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'step') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440 + Math.random() * 100, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'ladder') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'chute') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.12);
        osc.frequency.setValueAtTime(783, now + 0.24);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {}
  };

  // Generate 10x10 grid numbers in boustrophedon (snake) order from top to bottom
  const boardGrid = useMemo(() => {
    const grid: number[][] = [];
    for (let r = 9; r >= 0; r--) {
      const row: number[] = [];
      const isEvenFromBottom = r % 2 === 0;
      for (let c = 0; c < 10; c++) {
        const num = isEvenFromBottom ? r * 10 + c + 1 : r * 10 + (9 - c) + 1;
        row.push(num);
      }
      grid.push(row);
    }
    return grid;
  }, []);

  const move = (player: number) => {
    if (winner !== null || player !== turn || isRolling) return;
    setIsRolling(true);

    let rollCount = 0;
    const rollInterval = setInterval(() => {
      rollCount++;
      playSfx('roll');
      setRoll(Math.floor(Math.random() * 6) + 1);
      if (rollCount > 6) {
        clearInterval(rollInterval);
        const die = Math.floor(Math.random() * 6) + 1;
        setRoll(die);

        const currentPos = positions[player];
        let targetPos = currentPos + die;
        if (targetPos > 100) targetPos = currentPos;

        // Step-by-step hopping animation
        let stepCount = 0;
        const totalSteps = targetPos - currentPos;

        if (totalSteps <= 0) {
          setIsRolling(false);
          setTurn(player === 0 ? 1 : 0);
          return;
        }

        const stepInterval = setInterval(() => {
          stepCount++;
          playSfx('step');
          const nextStepPos = currentPos + stepCount;
          setPositions(prev => prev.map((p, idx) => idx === player ? nextStepPos : p));

          if (stepCount >= totalSteps) {
            clearInterval(stepInterval);

            // Check if landed on a chute or ladder
            const jumpTarget = jumps[nextStepPos];
            if (jumpTarget) {
              setTimeout(() => {
                if (jumpTarget > nextStepPos) playSfx('ladder');
                else playSfx('chute');

                setPositions(prev => prev.map((p, idx) => idx === player ? jumpTarget : p));
                setIsRolling(false);

                if (jumpTarget === 100) {
                  playSfx('win');
                  setWinner(player);
                } else {
                  setTurn(player === 0 ? 1 : 0);
                }
              }, 400);
            } else {
              setIsRolling(false);
              if (nextStepPos === 100) {
                playSfx('win');
                setWinner(player);
              } else {
                setTurn(player === 0 ? 1 : 0);
              }
            }
          }
        }, 220); // 220ms per tile step hop
      }
    }, 80);
  };

  React.useEffect(() => {
    if (playMode === 'vsComputer' && turn === 1 && winner === null && !isRolling) {
      const timer = window.setTimeout(() => move(1), 700);
      return () => window.clearTimeout(timer);
    }
  }, [playMode, turn, winner, isRolling]);

  const reset = () => { 
    setPositions([1, 1]); 
    setTurn(0); 
    setRoll(null); 
    setWinner(null); 
    setIsRolling(false);
  };

  // Calculate precise % coordinates on the grid for square number
  const getPositionStyles = (position: number, playerIndex: number) => {
    const zeroIndex = position - 1;
    const row = Math.floor(zeroIndex / 10); // 0-9 from bottom
    const colInRow = zeroIndex % 10;
    const isEvenRow = row % 2 === 0;
    const col = isEvenRow ? colInRow : 9 - colInRow;

    const left = col * 10 + (playerIndex === 0 ? 2 : 5);
    const top = (9 - row) * 10 + 2.5;

    return {
      left: `${left}%`,
      top: `${top}%`,
    };
  };

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4 px-2 text-white">
      <div className="flex w-full max-w-[560px] justify-between items-center px-2">
        <h2 className="text-3xl font-black text-orange-300 drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]">Chutes &amp; Ladders</h2>
        <div className="text-sm font-bold bg-slate-800/80 px-3 py-1.5 rounded-xl text-amber-300">
          {winner === null ? `${names[turn]}'s turn` : `${names[winner]} WINS!`}
        </div>
      </div>

      <div className="relative w-full max-w-[560px] aspect-square overflow-hidden rounded-2xl border-4 border-orange-400/40 bg-slate-950 shadow-[0_0_50px_rgba(251,146,60,0.2)] p-1">
        <div className="grid grid-cols-10 grid-rows-10 w-full h-full">
          {boardGrid.flat().map((space) => {
            const isLadder = jumps[space] && jumps[space] > space;
            const isChute = jumps[space] && jumps[space] < space;
            return (
              <div 
                key={space} 
                className={`relative border border-slate-800/60 p-1 font-mono text-[10px] sm:text-xs font-bold transition-all flex flex-col justify-between ${
                  space % 2 ? 'bg-slate-900/80' : 'bg-slate-950/80'
                } ${
                  isLadder 
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-[inset_0_0_10px_rgba(16,185,129,0.3)]' 
                    : isChute 
                    ? 'bg-red-950/90 text-red-300 border-red-500/50 shadow-[inset_0_0_10px_rgba(239,68,68,0.3)]' 
                    : 'text-slate-400'
                }`}
              >
                <span>{space}</span>
                {isLadder && <span className="self-end text-[10px] text-emerald-400 font-extrabold">🪜 {jumps[space]}</span>}
                {isChute && <span className="self-end text-[10px] text-red-400 font-extrabold">🐍 {jumps[space]}</span>}
              </div>
            );
          })}
        </div>

        {/* Floating Player Tokens */}
        {positions.map((position, player) => (
          <span 
            key={player} 
            className={`absolute h-6 w-6 sm:h-7 sm:w-7 transition-all duration-[500ms] cubic-bezier(0.34, 1.56, 0.64, 1) rounded-full shadow-2xl border-2 border-slate-950 z-20 flex items-center justify-center font-black text-[10px] ${
              player === 0 
                ? 'bg-cyan-400 text-slate-950 ring-2 ring-cyan-200' 
                : 'bg-fuchsia-500 text-white ring-2 ring-fuchsia-300'
            }`} 
            style={getPositionStyles(position, player)} 
          >
            P{player + 1}
          </span>
        ))}

        {winner !== null && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30 animate-in fade-in duration-300">
            <h3 className="text-4xl font-black text-amber-300 mb-2 drop-shadow-[0_0_15px_rgba(252,211,77,0.6)] animate-pulse">🎉 VICTORY! 🎉</h3>
            <p className="text-xl font-bold text-white mb-6">{names[winner]} reached Tile 100!</p>
            <GlassButton onClick={reset} className="px-8 py-4 text-lg">PLAY AGAIN</GlassButton>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className={`w-14 h-14 rounded-2xl bg-slate-800 border border-slate-600 flex items-center justify-center text-3xl font-black text-amber-300 shadow-inner ${isRolling ? 'animate-spin' : ''}`}>
          {roll ?? '🎲'}
        </div>
        <GlassButton 
          onClick={() => move(turn)} 
          disabled={winner !== null || isRolling || (playMode === 'vsComputer' && turn === 1)}
          className="px-6 py-3 text-lg font-black"
        >
          {isRolling ? 'ROLLING...' : 'ROLL DICE'}
        </GlassButton>
        <GlassButton onClick={reset} className="px-4 py-3 text-sm opacity-80 hover:opacity-100">
          RESET
        </GlassButton>
      </div>

      <p className="text-center text-xs text-orange-200/80 max-w-sm mt-1">
        🪜 Green tiles slide you UP ladders. 🐍 Red tiles slide you DOWN chutes. Land on tile 100 to win!
      </p>
    </div>
  );
};

export default ChutesAndLaddersGame;
