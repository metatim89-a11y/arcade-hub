import React, { useEffect, useMemo, useState } from 'react';
import type { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';

type NimGameProps = { playMode: PlayMode; playerNames: { player1: string; player2: string } };

const NimGame: React.FC<NimGameProps> = ({ playMode, playerNames }) => {
  const [piles, setPiles] = useState([3, 5, 7]);
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [selected, setSelected] = useState<{ row: number; count: number } | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const p1 = playerNames.player1;
  const p2 = playMode === 'vsComputer' ? 'Computer' : playerNames.player2;
  const currentName = turn === 'X' ? p1 : p2;
  const canAct = !winner && (playMode === 'vsPlayer' || turn === 'X');

  const status = useMemo(() => winner ? `${winner} wins!` : `${currentName}'s turn`, [currentName, winner]);

  const take = (row: number, count: number) => {
    if (!canAct || count < 1 || count > piles[row]) return;
    const next = piles.map((pile, index) => index === row ? pile - count : pile);
    setPiles(next); setSelected(null);
    if (next.every((pile) => pile === 0)) setWinner(currentName);
    else setTurn(turn === 'X' ? 'O' : 'X');
  };

  useEffect(() => {
    if (playMode !== 'vsComputer' || turn !== 'O' || winner) return;
    const timer = window.setTimeout(() => {
      const nimSum = piles.reduce((xor, value) => xor ^ value, 0);
      const nonEmpty = piles.map((pile, row) => ({ pile, row })).filter(({ pile }) => pile > 0);
      const move = nonEmpty.find(({ pile }) => (pile ^ nimSum) < pile) ?? nonEmpty[0];
      take(move.row, Math.max(1, move.pile - (move.pile ^ nimSum)));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [playMode, turn, winner, piles]);

  const reset = () => { setPiles([3, 5, 7]); setTurn('X'); setSelected(null); setWinner(null); };

  return <div className="flex w-full max-w-xl flex-col items-center gap-5 px-3 text-white">
    <h2 className="text-3xl font-black text-cyan-200">Nim</h2>
    <p className="text-center text-lg font-bold" aria-live="polite">{status}</p>
    <p className="max-w-md text-center text-sm text-cyan-100/70">Take one or more tokens from a single pile. The player who takes the last token wins.</p>
    <div className="grid w-full gap-3 rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-4 shadow-[0_0_50px_rgba(34,211,238,0.1)]">
      {piles.map((pile, row) => <div key={row} className="flex min-h-16 items-center gap-3 rounded-xl bg-cyan-950/40 p-3 shadow-inner">
        <span className="w-16 text-xs font-black uppercase text-cyan-200">Pile {row + 1}</span>
        <div className="flex flex-1 flex-wrap gap-2 text-[0]">
          {Array.from({ length: row === 0 ? 3 : row === 1 ? 5 : 7 }, (_, index) => {
            const isTaken = index >= pile;
            const isSelected = selected?.row === row && index >= pile - selected.count && !isTaken;
            return <button 
              key={index} 
              type="button" 
              disabled={!canAct || isTaken} 
              onClick={() => setSelected({ row, count: pile - index })} 
              className={`h-9 w-9 rounded-full border-2 transition-all duration-300 ease-out flex items-center justify-center text-sm
                ${isTaken ? 'scale-0 opacity-0 border-transparent bg-transparent cursor-default' : 
                 isSelected ? 'border-yellow-200 bg-yellow-300 text-slate-950 scale-110 shadow-[0_0_15px_rgba(253,224,71,0.6)]' : 
                 'border-cyan-200/50 bg-cyan-600 text-white hover:-translate-y-1 hover:shadow-[0_4px_10px_rgba(34,211,238,0.4)]'} 
                disabled:opacity-60 disabled:hover:translate-y-0`} 
              aria-label={isTaken ? `Taken token` : `Take ${pile - index} from pile ${row + 1}`}
            >●</button>;
          })}
        </div>
        <button type="button" disabled={!canAct || selected?.row !== row} onClick={() => selected && take(row, selected.count)} className="rounded-xl border border-yellow-400/50 bg-yellow-400/90 px-4 py-2 font-black text-slate-950 transition-all hover:bg-yellow-300 disabled:opacity-40 disabled:hover:scale-100 uppercase tracking-widest shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_25px_rgba(250,204,21,0.6)] active:scale-95">TAKE</button>
      </div>)}
    </div>
    <GlassButton onClick={reset}>{winner ? 'Play Again' : 'Reset Game'}</GlassButton>
  </div>;
};

export default NimGame;
