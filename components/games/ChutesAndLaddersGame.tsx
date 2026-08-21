import React, { useMemo, useState } from 'react';
import type { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';

type Props = { playMode: PlayMode; playerNames: { player1: string; player2: string } };
const jumps: Record<number, number> = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100, 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };

const ChutesAndLaddersGame: React.FC<Props> = ({ playMode, playerNames }) => {
  const [positions, setPositions] = useState([1, 1]);
  const [turn, setTurn] = useState(0);
  const [roll, setRoll] = useState<number | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const names = [playerNames.player1, playMode === 'vsComputer' ? 'Computer' : playerNames.player2];
  const board = useMemo(() => Array.from({ length: 100 }, (_, index) => 100 - index), []);

  const move = (player: number) => {
    if (winner !== null || player !== turn) return;
    const die = Math.floor(Math.random() * 6) + 1;
    let next = positions[player] + die;
    if (next > 100) next = positions[player];
    next = jumps[next] ?? next;
    const updated = positions.map((position, index) => index === player ? next : position);
    setRoll(die); setPositions(updated);
    if (next === 100) setWinner(player);
    else setTurn(player === 0 ? 1 : 0);
  };

  React.useEffect(() => {
    if (playMode === 'vsComputer' && turn === 1 && winner === null) {
      const timer = window.setTimeout(() => move(1), 650);
      return () => window.clearTimeout(timer);
    }
  }, [playMode, turn, winner, positions]);

  const reset = () => { setPositions([1, 1]); setTurn(0); setRoll(null); setWinner(null); };

  const getPositionStyles = (position: number, playerIndex: number) => {
    const index = 100 - position;
    const x = (index % 10) * 10;
    const y = Math.floor(index / 10) * 10;
    // Add offset for players so they don't exactly overlap
    const offset = playerIndex === 0 ? '20%' : '50%';
    return {
      left: `calc(${x}% + ${offset})`,
      top: `calc(${y}% + 30%)`,
      transform: `translate(${x}%, ${y}%)`,
    };
  };

  return <div className="flex w-full max-w-3xl flex-col items-center gap-4 px-2 text-white">
    <h2 className="text-3xl font-black text-orange-200">Chutes &amp; Ladders</h2>
    <p className="font-bold text-lg" aria-live="polite">{winner === null ? `${names[turn]}'s turn` : <span className="animate-pulse text-yellow-300">{`${names[winner]} wins!`}</span>}</p>
    
    <div className="relative grid w-full max-w-[560px] grid-cols-10 overflow-hidden rounded-xl border-4 border-orange-200/40 bg-slate-950 shadow-[0_0_40px_rgba(255,150,0,0.15)]">
      {board.map((space) => (
        <div key={space} className={`aspect-square border border-white/10 p-1 font-mono text-[9px] sm:text-xs ${space % 2 ? 'bg-emerald-900/70' : 'bg-orange-900/60'} ${jumps[space] > space ? 'bg-emerald-800/80 ring-2 ring-emerald-400/50 ring-inset shadow-[inset_0_0_15px_rgba(16,185,129,0.3)]' : jumps[space] < space ? 'bg-orange-950/80 ring-2 ring-red-500/50 ring-inset shadow-[inset_0_0_15px_rgba(239,68,68,0.3)]' : ''}`}><span>{space}</span></div>
      ))}
      
      {/* Floating animated markers */}
      {positions.map((position, player) => (
        <span 
          key={player} 
          className={`absolute h-5 w-5 sm:h-6 sm:w-6 transition-all duration-[600ms] cubic-bezier(0.34, 1.56, 0.64, 1) rounded-full shadow-xl border-2 border-slate-950 z-10 ${player === 0 ? 'bg-cyan-400 outline outline-2 outline-cyan-200/50' : 'bg-pink-500 outline outline-2 outline-pink-200/50'}`} 
          style={getPositionStyles(position, player)} 
          aria-label={`${names[player]} token`} 
        />
      ))}
    </div>
    
    <div className="flex items-center gap-4 mt-2">
      <span className="rounded-xl flex items-center justify-center w-14 h-14 bg-white/10 font-black text-2xl shadow-inner border border-white/5">{roll ?? '?'}</span>
      <GlassButton onClick={() => move(turn)} disabled={winner !== null || (playMode === 'vsComputer' && turn === 1)}>ROLL</GlassButton>
      <GlassButton onClick={reset}>RESET</GlassButton>
    </div>
    <p className="text-center text-xs text-orange-100/70 max-w-sm mt-2">Green glowing squares are ladders; red square are chutes. Reach exactly 100 to win.</p>
  </div>;
};

export default ChutesAndLaddersGame;
