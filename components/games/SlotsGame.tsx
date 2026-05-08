
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useCoinSystem } from '../../context/CoinContext';

// --- Core Game Configuration ---
const REEL_COUNT = 5;
const VISIBLE_SYMBOLS = 3; // Reduced to 3 for classic look
const SYMBOLS = ['🚀', '🧠', '💎', '🍒', '7️⃣', '🔔', '🎰', '🍇', '🍋'];
const SCATTER_SYMBOL = '💎';
const WILD_SYMBOL = '🚀';

// --- Paylines (0-indexed rows) ---
// 3x5 Grid
const PAYLINES = [
    [1, 1, 1, 1, 1], // Middle
    [0, 0, 0, 0, 0], // Top
    [2, 2, 2, 2, 2], // Bottom
    [0, 1, 2, 1, 0], // V
    [2, 1, 0, 1, 2], // Inverted V
    [0, 0, 1, 2, 2], // Step down
    [2, 2, 1, 0, 0], // Step up
];

// --- Payouts ---
const PAYOUTS: { [key: string]: { [key: number]: number } } = {
    '🚀': { 5: 1000, 4: 200, 3: 50 }, // Wild
    '7️⃣': { 5: 500, 4: 100, 3: 25 },
    '💎': { 5: 300, 4: 75, 3: 20 },
    '🎰': { 5: 200, 4: 50, 3: 15 },
    '🔔': { 5: 150, 4: 40, 3: 12 },
    '🍒': { 5: 100, 4: 30, 3: 10 },
    '🍇': { 5: 80, 4: 20, 3: 8 },
    '🍋': { 5: 50, 4: 15, 3: 5 },
    '🧠': { 5: 50, 4: 15, 3: 5 },
};

const REEL_STRIP_LENGTH = 20;
const SYMBOL_HEIGHT = 80; // px

interface ReelState {
  symbols: string[];
  offset: number;
  isSpinning: boolean;
}

interface WinningInfo {
    winningPaylines: { positions: [number, number][], amount: number }[];
    totalWin: number;
}

const SlotsGame: React.FC = () => {
    const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
    const [betPerLine, setBetPerLine] = useState(5);
    const [reels, setReels] = useState<ReelState[]>(
        Array(REEL_COUNT).fill(null).map(() => ({ 
            symbols: Array(REEL_STRIP_LENGTH + VISIBLE_SYMBOLS).fill('7️⃣').map(() => SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]),
            offset: 0, 
            isSpinning: false 
        }))
    );
    const [gameState, setGameState] = useState<'IDLE' | 'SPINNING' | 'WIN'>('IDLE');
    const [winInfo, setWinInfo] = useState<WinningInfo | null>(null);
    const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
    const totalBet = betPerLine * PAYLINES.length;

    const spin = () => {
        if (gameState === 'SPINNING') return;
        if (!canBet(totalBet)) {
             alert("Not enough coins!");
             return;
        }
        
        subtractCoins(totalBet, 'Slots Spin');
        setGameState('SPINNING');
        setWinInfo(null);

        // Generate results
        const finalSymbols = Array(REEL_COUNT).fill(null).map(() => 
            Array(VISIBLE_SYMBOLS).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
        );

        // Start spinning reels with delay
        const newReels = reels.map((reel, i) => {
             const strip = Array(REEL_STRIP_LENGTH).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
             return {
                 symbols: [...strip, ...finalSymbols[i]],
                 offset: 0,
                 isSpinning: true
             };
        });
        
        setReels(newReels);

        // Animate stopping
        newReels.forEach((_, i) => {
            setTimeout(() => {
                setReels(prev => prev.map((r, idx) => idx === i ? { ...r, offset: REEL_STRIP_LENGTH * SYMBOL_HEIGHT, isSpinning: false } : r));
                
                if (i === REEL_COUNT - 1) {
                     setTimeout(() => calculateWin(finalSymbols), 500);
                }
            }, 1000 + i * 300);
        });
    };

    const calculateWin = (finalLayout: string[][]) => {
        let totalWinnings = 0;
        const winningLines: { positions: [number, number][], amount: number }[] = [];

        PAYLINES.forEach((line, lineIdx) => {
            const lineSymbols = line.map((row, col) => finalLayout[col][row]);
            const firstSymbol = lineSymbols[0];
            let matchCount = 1;
            
            // Logic for Wilds could be added here, simplified for now
            for (let i = 1; i < lineSymbols.length; i++) {
                if (lineSymbols[i] === firstSymbol || lineSymbols[i] === WILD_SYMBOL || firstSymbol === WILD_SYMBOL) {
                     matchCount++;
                } else {
                    break;
                }
            }

            // Determine payout based on the primary symbol (handle wild start)
            const paySymbol = firstSymbol === WILD_SYMBOL ? (lineSymbols.find(s => s !== WILD_SYMBOL) || WILD_SYMBOL) : firstSymbol;
            
            if (matchCount >= 3 && PAYOUTS[paySymbol] && PAYOUTS[paySymbol][matchCount]) {
                const amount = PAYOUTS[paySymbol][matchCount] * betPerLine;
                totalWinnings += amount;
                winningLines.push({
                    positions: line.slice(0, matchCount).map((row, col) => [col, row]),
                    amount
                });
            }
        });

        if (totalWinnings > 0) {
            addCoins(totalWinnings, 'Slots Win');
            setWinInfo({ winningPaylines: winningLines, totalWin: totalWinnings });
            setGameState('WIN');
        } else {
            setGameState('IDLE');
        }
    };

    // --- Render Helpers ---
    const isWinningCell = (reelIdx: number, rowIdx: number) => {
        if (!winInfo) return false;
        return winInfo.winningPaylines.some(line => 
            line.positions.some(([c, r]) => c === reelIdx && r === rowIdx)
        );
    };

    return (
        <div className="flex flex-col items-center w-full max-w-4xl p-4">
            {/* Machine Cabinet */}
            <div className="relative bg-gradient-to-b from-purple-900 via-gray-900 to-black p-8 rounded-t-[40px] rounded-b-[20px] shadow-[0_0_50px_rgba(147,51,234,0.3)] border-4 border-gray-800 w-full max-w-3xl">
                
                {/* Marquee Lights */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[95%] flex justify-between px-2">
                    {Array.from({length: 20}).map((_, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full ${gameState === 'SPINNING' ? 'animate-pulse bg-yellow-400' : 'bg-red-500'} shadow-[0_0_10px_currentColor] transition-colors duration-300`} style={{animationDelay: `${i*0.1}s`}}></div>
                    ))}
                </div>

                {/* Logo Plate */}
                <div className="flex justify-center mb-6 mt-4">
                     <div className="bg-black/50 border-2 border-yellow-500/50 px-10 py-2 rounded-full backdrop-blur-sm">
                         <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                            NEON JACKPOT
                         </h1>
                     </div>
                </div>

                {/* Reels Container (Screen) */}
                <div className="relative bg-black border-8 border-gray-700 rounded-xl overflow-hidden shadow-inner">
                    {/* Glass Reflection Overlay */}
                    <div className="absolute inset-0 z-20 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none rounded-lg"></div>
                    <div className="absolute inset-0 z-20 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none"></div>
                    
                    {/* The Reels */}
                    <div className="flex bg-[#1a1a1a] gap-1 p-1">
                        {reels.map((reel, i) => (
                            <div key={i} className="relative flex-1 overflow-hidden h-[240px] bg-[#eee] rounded-sm shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                                <div 
                                    className="flex flex-col items-center transition-transform duration-100 ease-linear will-change-transform"
                                    style={{ 
                                        transform: `translateY(-${reel.symbols.length * SYMBOL_HEIGHT - 240 - reel.offset}px)`,
                                        transition: reel.isSpinning ? 'none' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                                    }}
                                >
                                    {reel.symbols.map((symbol, idx) => {
                                        // Determine if this is part of the visible final result for highlighting
                                        const visibleIndex = idx - (reel.symbols.length - VISIBLE_SYMBOLS);
                                        const isWinner = visibleIndex >= 0 && isWinningCell(i, visibleIndex);
                                        
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`w-full flex items-center justify-center text-5xl relative ${isWinner ? 'z-10' : ''}`} 
                                                style={{ height: `${SYMBOL_HEIGHT}px` }}
                                            >
                                                <span className={`${isWinner ? 'scale-125 drop-shadow-[0_0_10px_rgba(255,215,0,1)]' : ''} transition-transform`}>
                                                    {symbol}
                                                </span>
                                                {/* Horizontal divider to simulate physical tiles */}
                                                <div className="absolute bottom-0 w-[80%] h-px bg-gray-300/50"></div>
                                            </div>
                                        )
                                    })}
                                </div>
                                {/* Curvature Shadow Overlay per reel */}
                                <div className="absolute inset-0 pointer-events-none shadow-[inset_10px_0_15px_rgba(0,0,0,0.2),inset_-10px_0_15px_rgba(0,0,0,0.2)]"></div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Win Overlay */}
                    {gameState === 'WIN' && winInfo && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-pop-in">
                            <div className="text-6xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(255,215,0,0.8)] animate-bounce">
                                BIG WIN!
                            </div>
                            <div className="text-4xl font-bold text-white mt-2">
                                {winInfo.totalWin} {currencySymbol}
                            </div>
                        </div>
                    )}
                </div>

                {/* Control Panel */}
                <div className="mt-8 bg-gray-800 rounded-xl p-4 border-t-4 border-gray-700 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                    
                    <div className="flex gap-4 items-center bg-black/30 px-4 py-2 rounded-lg border border-white/5">
                         <div className="text-center">
                             <div className="text-xs text-gray-400 uppercase font-bold">Balance</div>
                             <div className="text-yellow-400 font-mono text-xl">{currencyMode === 'fun' ? Math.floor(useCoinSystem().funCoins) : Math.floor(useCoinSystem().realCoins)}</div>
                         </div>
                         <div className="w-px h-10 bg-gray-600"></div>
                         <div className="text-center">
                             <div className="text-xs text-gray-400 uppercase font-bold">Total Bet</div>
                             <div className="text-white font-mono text-xl">{totalBet}</div>
                         </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setBetPerLine(Math.max(1, betPerLine - 1))}
                            disabled={gameState === 'SPINNING'}
                            className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold shadow-lg active:translate-y-1 transition-all"
                        >-</button>
                        <div className="flex flex-col items-center w-20">
                            <span className="text-xs text-gray-400 font-bold uppercase">Bet/Line</span>
                            <span className="text-xl font-bold text-white">{betPerLine}</span>
                        </div>
                        <button 
                            onClick={() => setBetPerLine(Math.min(100, betPerLine + 1))}
                            disabled={gameState === 'SPINNING'}
                            className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold shadow-lg active:translate-y-1 transition-all"
                        >+</button>
                    </div>

                    <button 
                        onClick={spin}
                        disabled={gameState === 'SPINNING'}
                        className={`
                            px-10 py-4 rounded-full font-black text-xl uppercase tracking-wider shadow-[0_5px_0_rgb(180,83,9)] active:shadow-none active:translate-y-[5px] transition-all
                            ${gameState === 'SPINNING' ? 'bg-gray-600 text-gray-400 cursor-not-allowed shadow-none translate-y-[5px]' : 'bg-gradient-to-b from-yellow-400 to-orange-500 text-red-900 hover:brightness-110'}
                        `}
                    >
                        {gameState === 'SPINNING' ? 'Spinning...' : 'SPIN'}
                    </button>

                </div>
            </div>
            
            {/* Payout Info */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-400 w-full max-w-3xl">
                 {Object.entries(PAYOUTS).slice(0, 4).map(([symbol, pay]) => (
                     <div key={symbol} className="bg-gray-900 p-2 rounded border border-gray-800 flex justify-between items-center">
                         <span className="text-2xl">{symbol}</span>
                         <div className="text-right">
                             <div>5x: {pay[5]}</div>
                             <div>4x: {pay[4]}</div>
                         </div>
                     </div>
                 ))}
            </div>
        </div>
    );
};

export default SlotsGame;
