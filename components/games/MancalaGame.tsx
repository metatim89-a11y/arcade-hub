import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';

const PLAYER_1_STORE = 6;
const PLAYER_2_STORE = 13;
const INITIAL_PITS = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
const STONE_STACK_THRESHOLD = 12;
const STONE_COLORS = ['stone-gold', 'stone-silver', 'stone-bronze', 'stone-slate', 'stone-oak', 'stone-mahogany'];

interface MancalaProps {
    playMode: PlayMode;
    playerNames: { player1: string; player2: string };
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const MancalaGame: React.FC<MancalaProps> = ({ playMode, playerNames }) => {
    const [pits, setPits] = useState<number[]>(INITIAL_PITS);
    const pitsRef = useRef(pits);
    useEffect(() => { pitsRef.current = pits }, [pits]);

    const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
    const [status, setStatus] = useState("Player 1's Turn");
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<1 | 2 | 'draw' | null>(null);
    const [highlightedPit, setHighlightedPit] = useState<number | null>(null);
    const isAnimating = useRef(false);

    const p1Name = playerNames.player1;
    const p2Name = playMode === 'vsPlayer' ? playerNames.player2 : 'Computer';

    useEffect(() => {
      if (gameOver) return;
      const currentName = currentPlayer === 1 ? p1Name : p2Name;
      setStatus(`${currentName}'s Turn`);
    }, [currentPlayer, gameOver, p1Name, p2Name]);


    // Memoize random styles for stones to prevent them from jumping on every render
    const stoneStyles = useMemo(() => Array.from({ length: 50 }, () => ({
        top: `${Math.random() * 75 + 5}%`,
        left: `${Math.random() * 75 + 5}%`,
        transform: `rotate(${Math.random() * 360}deg)`,
        colorClass: STONE_COLORS[Math.floor(Math.random() * STONE_COLORS.length)],
    })), []);

    const performMove = async (index: number) => {
        isAnimating.current = true;
        let tempPits = [...pitsRef.current];
        let stonesToDistribute = tempPits[index];
        tempPits[index] = 0;
        setPits([...tempPits]);
        await sleep(200);

        let currentIndex = index;
        for (let i = 0; i < stonesToDistribute; i++) {
            currentIndex = (currentIndex + 1) % 14;
            if ((currentPlayer === 1 && currentIndex === PLAYER_2_STORE) || (currentPlayer === 2 && currentIndex === PLAYER_1_STORE)) {
                currentIndex = (currentIndex + 1) % 14;
            }
            setHighlightedPit(currentIndex);
            await sleep(300); // Slowed down animation
            
            tempPits = [...pitsRef.current];
            tempPits[currentIndex]++;
            setPits([...tempPits]);
            setHighlightedPit(null);
        }

        // End of move logic
        const lastPit = currentIndex;
        const lastPitIsOnCurrentPlayerSide = (currentPlayer === 1 && lastPit < PLAYER_1_STORE) || (currentPlayer === 2 && lastPit > PLAYER_1_STORE && lastPit < PLAYER_2_STORE);
        
        if (tempPits[lastPit] === 1 && lastPitIsOnCurrentPlayerSide) {
            const oppositePit = 12 - lastPit;
            if (tempPits[oppositePit] > 0) {
                await sleep(400); // Slightly longer pause for capture
                const storeIndex = currentPlayer === 1 ? PLAYER_1_STORE : PLAYER_2_STORE;
                tempPits[storeIndex] += tempPits[oppositePit] + 1;
                tempPits[oppositePit] = 0;
                tempPits[lastPit] = 0;
                setPits([...tempPits]);
            }
        }

        if ((currentPlayer === 1 && lastPit === PLAYER_1_STORE) || (currentPlayer === 2 && lastPit === PLAYER_2_STORE)) {
            const currentName = currentPlayer === 1 ? p1Name : p2Name;
            setStatus(`${currentName} gets another turn!`);
        } else {
            setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
        }
        isAnimating.current = false;
    };

    const handlePitClick = (index: number) => {
        if (gameOver || pits[index] === 0 || isAnimating.current) return;
        if (playMode === 'vsComputer' && currentPlayer === 2) return;
        
        if (currentPlayer === 1 && index >= PLAYER_1_STORE) return;
        if (currentPlayer === 2 && (index <= PLAYER_1_STORE || index >= PLAYER_2_STORE)) return;

        performMove(index);
    };
    
     useEffect(() => {
        if (!gameOver && playMode === 'vsComputer' && currentPlayer === 2 && !isAnimating.current) {
            const computerMove = () => {
                const validMoves = Array.from({length: 6}, (_, i) => i + 7).filter(i => pits[i] > 0);
                if (validMoves.length === 0) return;

                let bestMove = -1;
                for(const move of validMoves) { if ((pits[move] + move) % 14 === PLAYER_2_STORE) { bestMove = move; break; } }
                if (bestMove === -1) { for(const move of validMoves) { const landIndex = (move + pits[move]) % 14; if(pits[landIndex] === 0 && landIndex > PLAYER_1_STORE && landIndex < PLAYER_2_STORE) { bestMove = move; break; } } }
                if (bestMove === -1) { bestMove = validMoves[Math.floor(Math.random() * validMoves.length)]; }
                
                performMove(bestMove);
            };
            const timer = setTimeout(computerMove, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentPlayer, gameOver, playMode, pits]);


    useEffect(() => {
        if(gameOver || isAnimating.current) return;

        const p1PitsEmpty = pits.slice(0, 6).every(p => p === 0);
        const p2PitsEmpty = pits.slice(7, 13).every(p => p === 0);

        if (p1PitsEmpty || p2PitsEmpty) {
            const finalPits = [...pits];
            const p1Remaining = finalPits.slice(0, 6).reduce((a, b) => a + b, 0);
            const p2Remaining = finalPits.slice(7, 13).reduce((a, b) => a + b, 0);
            finalPits[PLAYER_1_STORE] += p1Remaining;
            finalPits[PLAYER_2_STORE] += p2Remaining;
            for(let i=0; i<14; i++) if (i !== PLAYER_1_STORE && i !== PLAYER_2_STORE) finalPits[i] = 0;
            
            setPits(finalPits); setGameOver(true);
            const p1Score = finalPits[PLAYER_1_STORE]; const p2Score = finalPits[PLAYER_2_STORE];
            if (p1Score > p2Score) { setStatus(`Game Over! ${p1Name} Wins!`); setWinner(1); }
            else if (p2Score > p1Score) { setStatus(`Game Over! ${p2Name} Wins!`); setWinner(2); }
            else { setStatus("Game Over! It's a Draw!"); setWinner('draw'); }
        }
    }, [pits, playMode, gameOver, p1Name, p2Name]);

    const handleReset = (startingPlayer: 1 | 2 = 1) => {
        setPits(INITIAL_PITS); setCurrentPlayer(startingPlayer); setStatus(`Player ${startingPlayer}'s Turn`); setGameOver(false); setWinner(null);
    }
    
    const renderStones = (count: number) => {
        if (count > STONE_STACK_THRESHOLD) {
            return (
                <div className="stone-stack">
                    <div className="stone-stack-icon">🪨</div>
                    <div className="stone-stack-count">{count}</div>
                </div>
            )
        }
        return (
            <div className="stones-container">
                {Array.from({ length: count }).map((_, stoneIdx) => (
                    <div 
                        key={stoneIdx} 
                        className={`stone ${stoneStyles[stoneIdx].colorClass}`} 
                        style={{
                            top: stoneStyles[stoneIdx].top,
                            left: stoneStyles[stoneIdx].left,
                            transform: stoneStyles[stoneIdx].transform,
                        }} 
                    />
                ))}
            </div>
        );
    };

    if (gameOver) {
      const winnerName = winner === 1 ? p1Name : p2Name;
      return (
        <div className="flex flex-col items-center justify-center gap-4 h-full text-white text-center animate-pop-in">
            <h2 className="text-4xl font-bold text-yellow-400">Game Over</h2>
            <p className="text-2xl">{status}</p>
             <div className="text-xl my-2">Final Score: {pits[PLAYER_1_STORE]} - {pits[PLAYER_2_STORE]}</div>
            {winner && winner !== 'draw' && (
              <div className="mt-4">
                <p className="text-lg mb-2">{winnerName} chooses who starts next:</p>
                <div className="flex gap-4">
                    <GlassButton onClick={() => handleReset(1)}>{p1Name} Starts</GlassButton>
                    <GlassButton onClick={() => handleReset(2)}>{p2Name} Starts</GlassButton>
                </div>
              </div>
            )}
            {winner === 'draw' && (<GlassButton onClick={() => handleReset()} className="mt-6">Play Again</GlassButton>)}
        </div>
      );
    }

    return (
        <div className="grid grid-rows-[auto_1fr_auto] items-center gap-4 text-white w-full h-full overflow-visible py-4">
            {/* Top: Header */}
            <div className="flex flex-col items-center gap-2">
                <h2 className="text-3xl font-bold text-yellow-400">Mancala</h2>
                <div className="text-xl font-semibold h-7">{status}</div>
            </div>
            
            {/* Middle: Board (centered) */}
            <div className="flex items-center justify-center">
                <div className="w-full max-w-4xl flex items-center justify-center gap-2 md:gap-4">
                    {/* Player 2 Score */}
                    <div className="w-16 text-center">
                        <div className="font-bold text-lg -mb-1">{p2Name}</div>
                        <div className="text-4xl font-bold text-yellow-200 [text-shadow:0_2px_4px_rgba(0,0,0,0.6)]">{pits[PLAYER_2_STORE]}</div>
                    </div>

                    {/* Board and Pit Counts */}
                    <div className="flex-grow">
                        {/* Player 2 Pit Counts */}
                        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr] mb-1" style={{ gap: 'var(--mancala-pit-gap)'}}>
                            <div></div> {/* Spacer for P2 store */}
                            {pits.slice(7, 13).reverse().map((count, i) => {
                                const pitIndex = 12 - i;
                                return <div key={`count-${pitIndex}`} className="text-center font-bold text-lg text-yellow-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{count}</div>
                            })}
                            <div></div> {/* Spacer for P1 store */}
                        </div>
                        <div className="bg-[#8B4513] p-2 md:p-3 rounded-lg border-2 md:border-4 border-[#D2691E]">
                            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr] h-full" style={{ gap: 'var(--mancala-pit-gap)'}}>
                                {/* Player 2 Store */}
                                <div className={`row-span-2 mancala-store ${highlightedPit === PLAYER_2_STORE ? 'highlight' : ''}`}>
                                    {renderStones(pits[PLAYER_2_STORE])}
                                </div>
                                
                                {/* Player 2 Pits */}
                                {pits.slice(7, 13).reverse().map((count, i) => {
                                  const pitIndex = 12 - i;
                                  return (
                                    <div key={pitIndex} onClick={() => handlePitClick(pitIndex)} className={`mancala-pit ${highlightedPit === pitIndex ? 'highlight' : ''} ${currentPlayer === 2 && !gameOver && pits[pitIndex] > 0 ? 'cursor-pointer hover:bg-[#D2691E]' : 'cursor-not-allowed'}`}>
                                      {renderStones(count)}
                                    </div>
                                  );
                                })}
                                
                                {/* Player 1 Store */}
                                <div className={`row-span-2 mancala-store ${highlightedPit === PLAYER_1_STORE ? 'highlight' : ''}`}>
                                    {renderStones(pits[PLAYER_1_STORE])}
                                </div>
                                
                                {/* Player 1 Pits */}
                                {pits.slice(0, 6).map((count, i) => (
                                  <div key={i} onClick={() => handlePitClick(i)} className={`mancala-pit ${highlightedPit === i ? 'highlight' : ''} ${currentPlayer === 1 && !gameOver && pits[i] > 0 ? 'cursor-pointer hover:bg-[#D2691E]' : 'cursor-not-allowed'}`}>
                                      {renderStones(count)}
                                  </div>
                                ))}
                            </div>
                        </div>

                        {/* Player 1 Pit Counts */}
                        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr] mt-1" style={{ gap: 'var(--mancala-pit-gap)'}}>
                            <div></div> {/* Spacer for P2 store */}
                            {pits.slice(0, 6).map((count, i) => (
                                <div key={`count-${i}`} className="text-center font-bold text-lg text-yellow-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{count}</div>
                            ))}
                            <div></div> {/* Spacer for P1 store */}
                        </div>
                    </div>

                    {/* Player 1 Score */}
                    <div className="w-16 text-center">
                        <div className="font-bold text-lg -mb-1">{p1Name}</div>
                        <div className="text-4xl font-bold text-yellow-200 [text-shadow:0_2px_4px_rgba(0,0,0,0.6)]">{pits[PLAYER_1_STORE]}</div>
                    </div>
                </div>
            </div>

            {/* Bottom: Reset Button */}
            <button onClick={() => handleReset()} className="justify-self-center bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-yellow-400 transition-colors"> Reset Game </button>
        </div>
    );
};

export default MancalaGame;