
import React, { useState, useEffect } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

const PAYOUTS = new Map<number, number>([
    [3, 2], [4, 5], [5, 15], [6, 50], [7, 150], [8, 300], [9, 500], [10, 1000]
]);
const MAX_PICK = 10;
const DRAW_COUNT = 20;
const DRAW_INTERVAL_MS = 100;

type GamePhase = 'betting' | 'drawing' | 'results';

const KenoGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
  const [bet, setBet] = useState(10);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState('Select up to 10 numbers and place your bet!');
  const [phase, setPhase] = useState<GamePhase>('betting');
  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

  const isDrawing = phase === 'drawing';

  const toggleNumber = (num: number) => {
    if (phase !== 'betting') return;
    const newSelection = new Set(selectedNumbers);
    if (newSelection.has(num)) {
      newSelection.delete(num);
    } else if (newSelection.size < MAX_PICK) {
      newSelection.add(num);
    }
    setSelectedNumbers(newSelection);
  };

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
    
    subtractCoins(bet, 'Keno Bet');
    setPhase('drawing');
    setDrawnNumbers(new Set());
    setFeedback('Drawing numbers...');

    const allNumbers = Array.from({ length: 80 }, (_, i) => i + 1);
    const finalDrawSet = new Set<number>();
    while (finalDrawSet.size < DRAW_COUNT) {
      const randIndex = Math.floor(Math.random() * allNumbers.length);
      const randNum = allNumbers[randIndex];
      if (!finalDrawSet.has(randNum)) {
        finalDrawSet.add(randNum);
      }
    }
    
    const finalDrawArray = Array.from(finalDrawSet);

    for (let i = 0; i < DRAW_COUNT; i++) {
        await new Promise(res => setTimeout(res, DRAW_INTERVAL_MS));
        setDrawnNumbers(prev => new Set(prev).add(finalDrawArray[i]));
    }
    
    const matches = [...selectedNumbers].filter(num => finalDrawSet.has(num)).length;
    const payoutMultiplier = PAYOUTS.get(matches) || 0;
    
    if (payoutMultiplier > 0) {
        const winnings = bet * payoutMultiplier;
        addCoins(winnings, 'Keno Win');
        setFeedback(`You matched ${matches} numbers and won ${winnings} ${currencySymbol}!`);
    } else {
        setFeedback(`You matched ${matches} numbers. Better luck next time!`);
    }
    setPhase('results');
  };
  
  const handlePlayAgain = () => {
      setPhase('betting');
      setDrawnNumbers(new Set());
      setSelectedNumbers(new Set());
      setFeedback('Select up to 10 numbers and place your bet!');
  }

  const getNumberStyleAndClass = (num: number) => {
    const isSelected = selectedNumbers.has(num);
    const isDrawn = drawnNumbers.has(num);
    const isMatch = isSelected && isDrawn;
    
    let style: React.CSSProperties = {};
    let className = '';

    if (phase === 'results') {
        if (isMatch) {
            style.backgroundColor = 'var(--keno-match-color)';
            style.color = 'white';
            className = 'keno-win';
        } else if (isSelected) {
            style.backgroundColor = 'var(--keno-miss-color)';
            style.color = 'white';
            className = 'keno-miss';
        } else if (isDrawn) {
            style.backgroundColor = 'var(--keno-drawn-color)';
            style.color = '#111827'; // gray-900
        }
    } else if (phase === 'drawing' && isDrawn) {
        style.backgroundColor = 'var(--keno-drawn-color)';
        style.color = '#111827'; // gray-900
        className = 'keno-draw-pop';
    } else if (isSelected) {
        style.backgroundColor = 'var(--keno-selected-color)';
        style.color = 'white';
    }
    
    if (Object.keys(style).length === 0) {
        className += ' bg-gray-800 hover:bg-gray-700';
    }

    return { style, className };
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center p-2 md:p-4">
      <h2 className="text-3xl font-bold" style={{ color: 'var(--primary-text-color)' }}>Keno</h2>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
          const { style, className } = getNumberStyleAndClass(num);
          return (
            <button
              key={num}
              onClick={() => toggleNumber(num)}
              disabled={phase !== 'betting'}
              className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-xs md:text-sm rounded-full font-bold transition-all duration-300 ${className}`}
              style={style}
            >
              {num}
            </button>
          );
        })}
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
        <GlassButton onClick={handleDraw} disabled={isDrawing} className="w-full max-w-sm text-xl py-3">
          {isDrawing ? `Drawing... (${drawnNumbers.size}/${DRAW_COUNT})` : `Draw (${selectedNumbers.size}/${MAX_PICK})`}
        </GlassButton>
      ) : (
        <GlassButton onClick={handlePlayAgain} className="w-full max-w-sm text-xl py-3 !bg-green-600/80 hover:!bg-green-500/80 !text-white">
          Play Again
        </GlassButton>
      )}
    </div>
  );
};

export default KenoGame;
