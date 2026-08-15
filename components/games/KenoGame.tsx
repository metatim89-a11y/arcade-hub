// File: components/games/KenoGame.tsx
// Version: 1.0.1
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';
import { KenoBoard3D } from './CasinoBoards3D';

// Pick-specific gross-return tables keep every selection count close to 90% RTP.
const PAYOUTS: Record<number, Record<number, number>> = {
  3: { 2: 3.2, 3: 32.4 },
  4: { 2: 1.5, 3: 7.7, 4: 77.3 },
  5: { 3: 4.4, 4: 32.6, 5: 217.5 },
  6: { 3: 2.3, 4: 11.5, 5: 69, 6: 460.2 },
  7: { 3: 1.1, 4: 4.6, 5: 34.4, 6: 183.6, 7: 1147.3 },
  8: { 4: 4.1, 5: 16.3, 6: 81.7, 7: 408.6, 8: 2043 },
  9: { 4: 1.9, 5: 9.6, 6: 38.4, 7: 192.1, 8: 960.7, 9: 3842.7 },
  10: { 4: 1.1, 5: 4.4, 6: 21.8, 7: 109.1, 8: 545.6, 9: 2182.3, 10: 10911.7 },
};
const MAX_PICK = 10;
const DRAW_COUNT = 20;

type GamePhase = 'betting' | 'drawing' | 'results';

interface KenoNumberProps {
    num: number;
    isSelected: boolean;
    isDrawn: boolean;
    phase: GamePhase;
    onClick: (num: number) => void;
    disabled: boolean;
}

const KenoNumber = memo(({ num, isSelected, isDrawn, phase, onClick, disabled }: KenoNumberProps) => {
    const isMatch = isSelected && isDrawn;
    
    let style: React.CSSProperties = {};
    let className = 'w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-xs md:text-sm rounded-full font-bold transition-all duration-300 ';

    if (phase === 'results') {
        if (isMatch) {
            style.backgroundColor = 'var(--keno-match-color, #10b981)';
            style.color = 'white';
            className += 'animate-keno-match';
        } else if (isSelected) {
            style.backgroundColor = 'var(--keno-miss-color, #ef4444)';
            style.color = 'white';
        } else if (isDrawn) {
            style.backgroundColor = 'var(--keno-drawn-color, #f59e0b)';
            style.color = '#111827';
        } else {
            className += 'bg-gray-800 hover:bg-gray-700';
        }
    } else if (phase === 'drawing' && isDrawn) {
        style.backgroundColor = 'var(--keno-drawn-color, #f59e0b)';
        style.color = '#111827';
        className += 'animate-keno-pop';
    } else if (isSelected) {
        style.backgroundColor = 'var(--keno-selected-color, #3b82f6)';
        style.color = 'white';
    } else {
        className += 'bg-gray-800 hover:bg-gray-700';
    }

    return (
        <button
            onClick={() => onClick(num)}
            disabled={disabled}
            className={className}
            style={style}
        >
            {num}
        </button>
    );
});

const KenoGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
  const [bet, setBet] = useState(10);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState('Select up to 10 numbers and place your bet!');
  const [phase, setPhase] = useState<GamePhase>('betting');
  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

  const isDrawing = phase === 'drawing';

  const toggleNumber = useCallback((num: number) => {
    setSelectedNumbers(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(num)) {
            newSelection.delete(num);
        } else if (newSelection.size < MAX_PICK) {
            newSelection.add(num);
        }
        return newSelection;
    });
  }, []);

  const handleQuickPick = () => {
    if (phase !== 'betting') return;
    const newSelection = new Set<number>();
    while (newSelection.size < MAX_PICK) {
      newSelection.add(Math.floor(Math.random() * 80) + 1);
    }
    setSelectedNumbers(newSelection);
  };

  const handleClear = () => {
    if (phase !== 'betting') return;
    setSelectedNumbers(new Set());
    setDrawnNumbers(new Set());
    setFeedback('Selection cleared. Pick new numbers!');
  };

  const handleDraw = async () => {
    if (selectedNumbers.size < 3) {
      setFeedback('You must pick at least 3 numbers.');
      return;
    }
    if (!canBet(bet)) {
      setFeedback('Not enough coins to place this bet.');
      return;
    }
    
    const charged = await subtractCoins(bet, 'Keno Bet');
    if (!charged) {
      setFeedback('The bet was not charged, so the draw did not start.');
      return;
    }
    setPhase('drawing');
    setDrawnNumbers(new Set());
    setFeedback('Drawing numbers...');

    const allNumbers = Array.from({ length: 80 }, (_, i) => i + 1);
    const finalDrawSet = new Set<number>();
    while (finalDrawSet.size < DRAW_COUNT) {
      const randIndex = Math.floor(Math.random() * allNumbers.length);
      const randNum = allNumbers[randIndex];
      finalDrawSet.add(randNum);
    }
    
    const finalDrawArray = Array.from(finalDrawSet);
    
    // Animation loop
    for (let i = 0; i < DRAW_COUNT; i++) {
        await new Promise(res => {
            const start = performance.now();
            const delay = 100;
            const step = (now: number) => {
                if (now - start >= delay) {
                    res(true);
                } else {
                    requestAnimationFrame(step);
                }
            };
            requestAnimationFrame(step);
        });
        setDrawnNumbers(prev => new Set(prev).add(finalDrawArray[i]));
    }
    
    const matches = [...selectedNumbers].filter(num => finalDrawSet.has(num)).length;
    const payoutMultiplier = PAYOUTS[selectedNumbers.size]?.[matches] || 0;
    
    if (payoutMultiplier > 0) {
        const winnings = bet * payoutMultiplier;
        const credited = await addCoins(winnings, 'Keno Win');
        setFeedback(credited
          ? `You matched ${matches} numbers and won ${winnings} ${currencySymbol}!`
          : `You matched ${matches}, but the payout was not confirmed.`);
    } else {
        setFeedback(`You matched ${matches} numbers. Better luck next time!`);
    }
    setPhase('results');
  };
  
  const handlePlayAgain = () => {
      setPhase('betting');
      setDrawnNumbers(new Set());
      // selectedNumbers is PERSISTENT now
      setFeedback('Pick more numbers or draw again!');
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center p-2 md:p-4">
      <div><h2 className="text-3xl font-bold" style={{ color: 'var(--primary-text-color)' }}>Keno</h2><small className="text-gray-400">90% RTP · payout changes with picks</small></div>
      <div className={`h-[540px] w-full max-w-[760px] overflow-hidden rounded-3xl shadow-[0_28px_70px_rgba(0,0,0,.48)] ${phase === 'drawing' ? 'keno-drawing-grid' : ''}`}>
        <KenoBoard3D selected={selectedNumbers} drawn={drawnNumbers} phase={phase} onNumberClick={toggleNumber} />
      </div>
      <div className="bg-black/20 p-3 rounded-lg text-center w-full min-h-[40px] flex items-center justify-center text-yellow-300 font-semibold">{feedback}</div>
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
        <div className="flex items-center gap-2 bg-gray-800/30 p-2 rounded-xl text-lg shadow-md">
          <label className="font-bold" style={{ color: 'var(--primary-text-color)' }}>Bet ({currencySymbol}):</label>
          <button onClick={() => setBet(b => Math.max(1, b - 1))} disabled={isDrawing} className="bg-yellow-400 text-gray-800 rounded-md px-2 font-bold">-</button>
          <input type="number" value={bet} onChange={e => setBet(Math.max(1, Number(e.target.value)))} disabled={isDrawing} className="w-20 text-center font-bold border-yellow-400/20 border rounded-md bg-gray-900 p-1" style={{ color: 'var(--primary-text-color)' }} />
          <button onClick={() => setBet(b => Math.min(1000, b + 1))} disabled={isDrawing} className="bg-yellow-400 text-gray-800 rounded-md px-2 font-bold">+</button>
        </div>
        <div className="flex gap-2">
            <GlassButton onClick={handleQuickPick} disabled={isDrawing}>Quick Pick</GlassButton>
            <GlassButton onClick={handleClear} disabled={isDrawing}>Clear</GlassButton>
        </div>
      </div>
      {phase !== 'results' ? (
        <GlassButton onClick={handleDraw} disabled={isDrawing} className="w-full max-sm text-xl py-3">
          {isDrawing ? `Drawing... (${drawnNumbers.size}/${DRAW_COUNT})` : `Draw (${selectedNumbers.size}/${MAX_PICK})`}
        </GlassButton>
      ) : (
        <GlassButton onClick={handlePlayAgain} className="w-full max-w-sm text-xl py-3 !bg-green-600/80 hover:!bg-green-500/80 !text-white">
          Play Again
        </GlassButton>
      )}

      <style>{`
        @keyframes keno-pop {
            0% { transform: scale(1); }
            50% { transform: scale(1.4); }
            100% { transform: scale(1); }
        }
        .animate-keno-pop {
            animation: keno-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            z-index: 10;
        }
        @keyframes keno-match {
            0%, 100% { box-shadow: 0 0 5px #fff, 0 0 10px var(--keno-match-color, #10b981); transform: scale(1); }
            50% { box-shadow: 0 0 15px #fff, 0 0 30px var(--keno-match-color, #10b981); transform: scale(1.1); }
        }
        .animate-keno-match {
            animation: keno-match 1s infinite ease-in-out;
            z-index: 20;
        }
        @keyframes grid-pulse {
            0% { opacity: 0.8; }
            50% { opacity: 1; }
            100% { opacity: 0.8; }
        }
        .keno-drawing-grid {
            animation: grid-pulse 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default KenoGame;
