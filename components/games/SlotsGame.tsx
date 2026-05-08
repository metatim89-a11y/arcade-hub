
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useCoinSystem } from '../../context/CoinContext';

// --- Core Game Configuration ---
const REEL_COUNT = 5;
const VISIBLE_SYMBOLS = 3; 
const SYMBOLS = ['🚀', '🧠', '💎', '🍒', '7️⃣', '🔔', '🎰', '🍇', '🍋'];
const WILD_SYMBOL = '🚀';

// --- Paylines ---
const PAYLINES = [
    [1, 1, 1, 1, 1], // Middle
    [0, 0, 0, 0, 0], // Top
    [2, 2, 2, 2, 2], // Bottom
    [0, 1, 2, 1, 0], // V
    [2, 1, 0, 1, 2], // Inverted V
    [0, 0, 1, 2, 2], // Step down
    [2, 2, 1, 0, 0], // Step up
];

const PAYOUTS: { [key: string]: { [key: number]: number } } = {
    '🚀': { 5: 1000, 4: 200, 3: 50 },
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
const SYMBOL_HEIGHT = 80; 

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
    const [isAutoSpin, setIsAutoSpin] = useState(false);
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

    const spin = useCallback(() => {
        if (gameState === 'SPINNING') return;
        if (!canBet(totalBet)) {
             setIsAutoSpin(false);
             return;
        }
        
        subtractCoins(totalBet, 'Slots Spin');
        setGameState('SPINNING');
        setWinInfo(null);

        const finalSymbols = Array(REEL_COUNT).fill(null).map(() => 
            Array(VISIBLE_SYMBOLS).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
        );

        const newReels = reels.map((reel, i) => {
             const strip = Array(REEL_STRIP_LENGTH).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
             return {
                 symbols: [...strip, ...finalSymbols[i]],
                 offset: 0,
                 isSpinning: true
             };
        });
        
        setReels(newReels);

        newReels.forEach((_, i) => {
            setTimeout(() => {
                setReels(prev => prev.map((r, idx) => idx === i ? { ...r, offset: REEL_STRIP_LENGTH * SYMBOL_HEIGHT, isSpinning: false } : r));
                
                if (i === REEL_COUNT - 1) {
                     setTimeout(() => calculateWin(finalSymbols), 500);
                }
            }, 800 + i * 200); // Faster spins for auto-mode feel
        });
    }, [gameState, totalBet, canBet, subtractCoins, reels]);

    const calculateWin = (finalLayout: string[][]) => {
        let totalWinnings = 0;
        const winningLines: { positions: [number, number][], amount: number }[] = [];

        PAYLINES.forEach((line) => {
            const lineSymbols = line.map((row, col) => finalLayout[col][row]);
            const firstSymbol = lineSymbols[0];
            let matchCount = 1;
            
            for (let i = 1; i < lineSymbols.length; i++) {
                if (lineSymbols[i] === firstSymbol || lineSymbols[i] === WILD_SYMBOL || firstSymbol === WILD_SYMBOL) {
                     matchCount++;
                } else {
                    break;
                }
            }

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

    // Auto Spin Controller
    useEffect(() => {
        if (isAutoSpin && gameState === 'IDLE') {
            const delay = winInfo ? 2000 : 800; // Longer pause if we won
            const timer = setTimeout(spin, delay);
            return () => clearTimeout(timer);
        }
    }, [isAutoSpin, gameState, spin, winInfo]);

    const isWinningCell = (reelIdx: number, rowIdx: number) => {
        if (!winInfo) return false;
        return winInfo.winningPaylines.some(line => 
            line.positions.some(([c, r]) => c === reelIdx && r === rowIdx)
        );
    };

    return (
        <div className="flex flex-col items-center w-full max-w-4xl p-4">
            <div className="relative bg-gradient-to-b from-gray-900 via-purple-950 to-black p-6 md:p-10 rounded-t-[50px] rounded-b-[30px] shadow-[0_0_80px_rgba(147,51,234,0.4)] border-8 border-gray-800 w-full max-w-4xl">
                
                {/* Marquee */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[92%] flex justify-between overflow-hidden">
                    {Array.from({length: 30}).map((_, i) => (
                        <div key={i} className={`w-2.5 h-2.5 rounded-full ${isAutoSpin ? 'bg-green-400' : (gameState === 'SPINNING' ? 'bg-yellow-400' : 'bg-red-500')} shadow-[0_0_8px_currentColor] animate-pulse`} style={{animationDelay: `${i*0.05}s`}}></div>
                    ))}
                </div>

                <div className="flex justify-center mb-8 mt-6">
                     <div className="bg-black/60 border-4 border-yellow-500/30 px-12 py-3 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                         <h1 className="text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-500 tracking-tighter">
                            AUTO SLOTS
                         </h1>
                     </div>
                </div>

                <div className="relative bg-[#050505] border-[12px] border-gray-800 rounded-3xl overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,1)]">
                    <div className="absolute inset-0 z-20 bg-gradient-to-tr from-white/5 via-transparent to-white/5 pointer-events-none"></div>
                    
                    <div className="flex bg-[#111] gap-1.5 p-1.5">
                        {reels.map((reel, i) => (
                            <div key={i} className="relative flex-1 overflow-hidden h-[260px] bg-[#f8f8f8] rounded-lg shadow-[inset_0_0_30px_rgba(0,0,0,0.6)] border-x border-gray-300/20">
                                <div 
                                    className="flex flex-col items-center transition-transform will-change-transform"
                                    style={{ 
                                        transform: `translateY(-${reel.symbols.length * SYMBOL_HEIGHT - 260 - reel.offset}px)`,
                                        transition: reel.isSpinning ? 'none' : 'transform 0.6s cubic-bezier(0.1, 0.9, 0.2, 1)' 
                                    }}
                                >
                                    {reel.symbols.map((symbol, idx) => {
                                        const visibleIndex = idx - (reel.symbols.length - VISIBLE_SYMBOLS);
                                        const isWinner = visibleIndex >= 0 && isWinningCell(i, visibleIndex);
                                        
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`w-full flex items-center justify-center text-6xl relative ${isWinner ? 'z-10' : ''}`} 
                                                style={{ height: `${SYMBOL_HEIGHT}px` }}
                                            >
                                                <span className={`${isWinner ? 'scale-125 drop-shadow-[0_0_15px_rgba(255,215,0,1)]' : ''} transition-transform duration-300`}>
                                                    {symbol}
                                                </span>
                                                <div className="absolute bottom-0 w-[90%] h-px bg-gray-400/20"></div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="absolute inset-0 pointer-events-none shadow-[inset_15px_0_20px_rgba(0,0,0,0.3),inset_-15px_0_20px_rgba(0,0,0,0.3)]"></div>
                            </div>
                        ))}
                    </div>
                    
                    {gameState === 'WIN' && winInfo && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-pop-in">
                            <div className="text-7xl font-black text-yellow-400 drop-shadow-[0_0_30px_rgba(255,215,0,0.9)] animate-bounce italic">
                                WINNER!
                            </div>
                            <div className="text-5xl font-mono font-black text-white mt-4 tracking-widest">
                                +{winInfo.totalWin}
                            </div>
                        </div>
                    )}
                </div>

                {/* Dashboard */}
                <div className="mt-10 bg-[#1a1a1a] rounded-2xl p-6 border-t-2 border-gray-700/50 flex flex-wrap justify-between items-center gap-6">
                    
                    <div className="flex gap-6 items-center bg-black/40 px-6 py-3 rounded-2xl border border-white/5">
                         <div className="text-center">
                             <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">CASH</div>
                             <div className="text-green-400 font-mono text-2xl font-bold">{currencyMode === 'fun' ? Math.floor(useCoinSystem().funCoins) : Math.floor(useCoinSystem().realCoins)}</div>
                         </div>
                         <div className="w-px h-12 bg-gray-800"></div>
                         <div className="text-center">
                             <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">TOTAL BET</div>
                             <div className="text-white font-mono text-2xl font-bold">{totalBet}</div>
                         </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setBetPerLine(Math.max(1, betPerLine - 1))} disabled={gameState === 'SPINNING'} className="w-12 h-12 rounded-xl bg-gray-800 text-white font-black hover:bg-gray-700 active:scale-95 transition-all border-b-4 border-gray-900">-</button>
                        <div className="flex flex-col items-center bg-black/40 px-4 py-1 rounded-lg border border-white/5">
                            <span className="text-[10px] text-gray-500 font-black uppercase">LINE BET</span>
                            <span className="text-2xl font-black text-yellow-400">{betPerLine}</span>
                        </div>
                        <button onClick={() => setBetPerLine(Math.min(500, betPerLine + 5))} disabled={gameState === 'SPINNING'} className="w-12 h-12 rounded-xl bg-gray-800 text-white font-black hover:bg-gray-700 active:scale-95 transition-all border-b-4 border-gray-900">+</button>
                    </div>

                    <div className="flex gap-3">
                        {/* AUTO SPIN BUTTON */}
                        <button 
                            onClick={() => setIsAutoSpin(!isAutoSpin)}
                            className={`
                                w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-black transition-all border-b-4
                                ${isAutoSpin 
                                    ? 'bg-green-600 border-green-800 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] animate-pulse' 
                                    : 'bg-gray-800 border-gray-950 text-gray-500 opacity-60 hover:opacity-100'}
                            `}
                        >
                            <span className="text-2xl">🔄</span>
                            <span className="text-[10px]">AUTO</span>
                        </button>

                        <button 
                            onClick={spin}
                            disabled={gameState === 'SPINNING'}
                            className={`
                                px-12 h-20 rounded-2xl font-black text-2xl uppercase tracking-tighter shadow-xl active:translate-y-1 transition-all border-b-4
                                ${gameState === 'SPINNING' 
                                    ? 'bg-gray-700 text-gray-500 border-gray-900' 
                                    : 'bg-gradient-to-t from-orange-600 to-yellow-400 text-red-950 border-orange-800 hover:brightness-110'}
                            `}
                        >
                            {gameState === 'SPINNING' ? '...' : 'SPIN'}
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 flex flex-wrap justify-center gap-4 w-full max-w-4xl">
                 {Object.entries(PAYOUTS).slice(0, 8).map(([symbol, pay]) => (
                     <div key={symbol} className="bg-gray-900/50 p-3 rounded-xl border border-white/5 flex gap-3 items-center min-w-[120px]">
                         <span className="text-3xl">{symbol}</span>
                         <div className="text-[10px] text-gray-400 font-bold">
                             <div className="text-yellow-500">5x: {pay[5]}</div>
                             <div>4x: {pay[4]}</div>
                         </div>
                     </div>
                 ))}
            </div>
        </div>
    );
};

export default SlotsGame;
