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
  return <div className="flex w-full max-w-3xl flex-col items-center gap-4 px-2 text-white">
    <h2 className="text-3xl font-black text-orange-200">Chutes &amp; Ladders</h2>
    <p className="font-bold" aria-live="polite">{winner === null ? `${names[turn]}'s turn` : `${names[winner]} wins!`}</p>
    <div className="grid w-full max-w-[560px] grid-cols-10 overflow-hidden rounded-xl border-4 border-orange-200/40 bg-slate-950 shadow-2xl">{board.map((space) => <div key={space} className={`relative aspect-square border border-white/10 p-1 text-[9px] sm:text-xs ${space % 2 ? 'bg-emerald-900/70' : 'bg-orange-900/60'} ${jumps[space] ? 'ring-2 ring-yellow-300/60 ring-inset' : ''}`}><span>{space}</span>{positions.map((position, player) => position === space && <span key={player} className={`absolute bottom-1 ${player === 0 ? 'left-1 bg-cyan-300' : 'right-1 bg-pink-400'} h-4 w-4 rounded-full border border-slate-950`} aria-label={`${names[player]} token`} />)}</div>)}</div>
    <div className="flex items-center gap-4"><span className="rounded-lg bg-white/10 px-4 py-2 font-black">🎲 {roll ?? '?'}</span><GlassButton onClick={() => move(turn)} disabled={winner !== null || (playMode === 'vsComputer' && turn === 1)}>ROLL</GlassButton><GlassButton onClick={reset}>RESET</GlassButton></div>
    <p className="text-center text-xs text-orange-100/70">Green squares are ladders; orange squares are chutes. Reach 100 to win.</p>
  </div>;
};

export default ChutesAndLaddersGame;
