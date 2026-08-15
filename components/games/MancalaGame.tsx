import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';
import MancalaBoard3D from './MancalaBoard3D';

const PLAYER_1_STORE = 6;
const PLAYER_2_STORE = 13;
const INITIAL_PITS = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
const STONE_STACK_THRESHOLD = 12;
const STONE_COLORS = ['stone-ruby', 'stone-sapphire', 'stone-emerald', 'stone-amethyst', 'stone-amber', 'stone-pearl', 'stone-turquoise'];
type CpuDifficulty = 'Easy' | 'Normal' | 'Hard';
type BoardTheme = 'Classic' | 'Midnight' | 'Jungle';
const PUZZLES = [
    { name: 'Capture Lesson', description: 'Find the move that captures the opposite pile.', pits: [0, 0, 1, 0, 3, 0, 18, 0, 5, 0, 0, 0, 0, 21] },
    { name: 'Extra Turn', description: 'Land your final stone in your store.', pits: [2, 0, 0, 0, 0, 1, 20, 3, 2, 1, 0, 0, 0, 19] },
] as const;

interface MancalaProps {
    playMode: PlayMode;
    playerNames: { player1: string; player2: string };
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const MancalaGame: React.FC<MancalaProps> = ({ playMode, playerNames }) => {
    const [pits, setPits] = useState<number[]>(INITIAL_PITS);
    const [lastHopedPit, setLastHopedPit] = useState<number | null>(null);
    const pitsRef = useRef(pits);
    useEffect(() => { pitsRef.current = pits }, [pits]);

    const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
    const [status, setStatus] = useState("Player 1's Turn");
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<1 | 2 | 'draw' | null>(null);
    const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>('Normal');
    const [theme, setTheme] = useState<BoardTheme>('Classic');
    const [previewPit, setPreviewPit] = useState<number | null>(null);
    const [lastMovePath, setLastMovePath] = useState<number[]>([]);
    const [captureStreak, setCaptureStreak] = useState({ 1: 0, 2: 0 });
    const [bestCaptureStreak, setBestCaptureStreak] = useState({ 1: 0, 2: 0 });
    const [matchWins, setMatchWins] = useState({ 1: 0, 2: 0 });
    const [timerEnabled, setTimerEnabled] = useState(false);
    const [turnSeconds, setTurnSeconds] = useState(30);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [puzzleName, setPuzzleName] = useState<string | null>(null);
    const [stats, setStats] = useState({ moves: 0, captures: 0, extraTurns: 0 });
    const [highlightedPit, setHighlightedPit] = useState<number | null>(null);
    const [flyingStone, setFlyingStone] = useState<{ key: number; fromX: number; fromY: number; toX: number; toY: number; colorClass: string } | null>(null);
    const isAnimating = useRef(false);
    const boardRef = useRef<HTMLDivElement>(null);
    const pitRefs = useRef(new Map<number, HTMLDivElement>());
    const flightKeyRef = useRef(0);

    const p1Name = playerNames.player1;
    const p2Name = playMode === 'vsPlayer' ? playerNames.player2 : 'Computer';

    const movePath = (index: number, player: 1 | 2, board = pitsRef.current) => {
        const path: number[] = [];
        let cursor = index;
        for (let stone = 0; stone < board[index]; stone++) {
            cursor = (cursor + 1) % 14;
            if ((player === 1 && cursor === PLAYER_2_STORE) || (player === 2 && cursor === PLAYER_1_STORE)) cursor = (cursor + 1) % 14;
            path.push(cursor);
        }
        return path;
    };

    const previewEnd = previewPit === null ? null : movePath(previewPit, currentPlayer).at(-1) ?? null;

    useEffect(() => {
      if (gameOver) return;
      const currentName = currentPlayer === 1 ? p1Name : p2Name;
      setStatus(`${currentName}'s Turn`);
    }, [currentPlayer, gameOver, p1Name, p2Name]);

    useEffect(() => {
        if (!timerEnabled || gameOver || isAnimating.current) return;
        setTurnSeconds(30);
        const interval = window.setInterval(() => setTurnSeconds(value => {
            if (value <= 1) {
                const valid = currentPlayer === 1
                    ? Array.from({ length: 6 }, (_, index) => index).filter(index => pitsRef.current[index] > 0)
                    : Array.from({ length: 6 }, (_, index) => index + 7).filter(index => pitsRef.current[index] > 0);
                window.clearInterval(interval);
                if (valid.length) void performMove(valid[0]);
                return 30;
            }
            return value - 1;
        }), 1000);
        return () => window.clearInterval(interval);
    }, [currentPlayer, gameOver, timerEnabled]);


    // Memoize random styles for stones to prevent them from jumping on every render
    const stoneStyles = useMemo(() => Array.from({ length: 50 }, () => ({
        top: `${Math.random() * 75 + 5}%`,
        left: `${Math.random() * 75 + 5}%`,
        transform: `rotate(${Math.random() * 360}deg)`,
        colorClass: STONE_COLORS[Math.floor(Math.random() * STONE_COLORS.length)],
    })), []);

    const flyStone = async (fromIndex: number, toIndex: number, colorClass: string) => {
        const board = boardRef.current;
        const from = pitRefs.current.get(fromIndex);
        const to = pitRefs.current.get(toIndex);
        if (!board || !from || !to) {
            await sleep(260);
            return;
        }
        const boardBounds = board.getBoundingClientRect();
        const fromBounds = from.getBoundingClientRect();
        const toBounds = to.getBoundingClientRect();
        setFlyingStone({
            key: ++flightKeyRef.current,
            fromX: fromBounds.left + fromBounds.width / 2 - boardBounds.left,
            fromY: fromBounds.top + fromBounds.height / 2 - boardBounds.top,
            toX: toBounds.left + toBounds.width / 2 - boardBounds.left,
            toY: toBounds.top + toBounds.height / 2 - boardBounds.top,
            colorClass
        });
        await sleep(430);
        setFlyingStone(null);
    };

    const performMove = async (index: number) => {
        isAnimating.current = true;
        const path = movePath(index, currentPlayer);
        setLastMovePath([index, ...path]);
        setPreviewPit(null);
        setStats(current => ({ ...current, moves: current.moves + 1 }));
        let tempPits = [...pitsRef.current];
        let stonesToDistribute = tempPits[index];
        tempPits[index] = 0;
        pitsRef.current = [...tempPits];
        setPits([...tempPits]);
        await sleep(200);

        let currentIndex = index;
        for (let i = 0; i < stonesToDistribute; i++) {
            currentIndex = (currentIndex + 1) % 14;
            if ((currentPlayer === 1 && currentIndex === PLAYER_2_STORE) || (currentPlayer === 2 && currentIndex === PLAYER_1_STORE)) {
                currentIndex = (currentIndex + 1) % 14;
            }
            setHighlightedPit(currentIndex);
            await flyStone(index, currentIndex, STONE_COLORS[i % STONE_COLORS.length]);
            setLastHopedPit(currentIndex);
            
            tempPits = [...pitsRef.current];
            tempPits[currentIndex]++;
            pitsRef.current = [...tempPits];
            setPits([...tempPits]);
            setHighlightedPit(null);
            setTimeout(() => setLastHopedPit(null), 260);
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
                pitsRef.current = [...tempPits];
                setPits([...tempPits]);
                setCaptureStreak(current => {
                    const next = { ...current, [currentPlayer]: current[currentPlayer] + 1 };
                    setBestCaptureStreak(best => ({ ...best, [currentPlayer]: Math.max(best[currentPlayer], next[currentPlayer]) }));
                    return next;
                });
                setStats(current => ({ ...current, captures: current.captures + 1 }));
            }
        } else {
            setCaptureStreak(current => ({ ...current, [currentPlayer]: 0 }));
        }

        if ((currentPlayer === 1 && lastPit === PLAYER_1_STORE) || (currentPlayer === 2 && lastPit === PLAYER_2_STORE)) {
            const currentName = currentPlayer === 1 ? p1Name : p2Name;
            setStatus(`${currentName} gets another turn!`);
            setStats(current => ({ ...current, extraTurns: current.extraTurns + 1 }));
        } else {
            setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
        }
        isAnimating.current = false;
        // Re-emit the final board after animation so the end-of-game sweep can run.
        pitsRef.current = [...tempPits];
        setPits([...tempPits]);
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

                if (cpuDifficulty === 'Easy') {
                    void performMove(validMoves[Math.floor(Math.random() * validMoves.length)]);
                    return;
                }
                let bestMove = -1;
                for(const move of validMoves) { if ((pits[move] + move) % 14 === PLAYER_2_STORE) { bestMove = move; break; } }
                if (bestMove === -1) { for(const move of validMoves) { const landIndex = (move + pits[move]) % 14; if(pits[landIndex] === 0 && landIndex > PLAYER_1_STORE && landIndex < PLAYER_2_STORE) { bestMove = move; break; } } }
                if (bestMove === -1 && cpuDifficulty === 'Hard') {
                    bestMove = [...validMoves].sort((left, right) => pits[right] - pits[left])[0];
                }
                if (bestMove === -1) bestMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                
                performMove(bestMove);
            };
            const timer = setTimeout(computerMove, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentPlayer, cpuDifficulty, gameOver, playMode, pits]);


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
            if (p1Score > p2Score) { setStatus(`Game Over! ${p1Name} Wins!`); setWinner(1); setMatchWins(value => ({ ...value, 1: value[1] + 1 })); }
            else if (p2Score > p1Score) { setStatus(`Game Over! ${p2Name} Wins!`); setWinner(2); setMatchWins(value => ({ ...value, 2: value[2] + 1 })); }
            else { setStatus("Game Over! It's a Draw!"); setWinner('draw'); }
        }
    }, [pits, playMode, gameOver, p1Name, p2Name]);

    const handleReset = (startingPlayer: 1 | 2 = 1) => {
        isAnimating.current = false; setFlyingStone(null); setHighlightedPit(null);
        setPits(INITIAL_PITS); setCurrentPlayer(startingPlayer); setStatus(`Player ${startingPlayer}'s Turn`); setGameOver(false); setWinner(null);
        setLastMovePath([]); setCaptureStreak({ 1: 0, 2: 0 }); setPuzzleName(null); setStats({ moves: 0, captures: 0, extraTurns: 0 });
    }

    const loadPuzzle = (puzzle: typeof PUZZLES[number]) => {
        isAnimating.current = false;
        setPits([...puzzle.pits]); setCurrentPlayer(1); setGameOver(false); setWinner(null);
        setPuzzleName(puzzle.name); setStatus(puzzle.description); setLastMovePath([]); setStats({ moves: 0, captures: 0, extraTurns: 0 });
    };
    
    const renderStones = (count: number, index: number) => {
        const isHoping = lastHopedPit === index;
        if (count > STONE_STACK_THRESHOLD) {
            return (
                <div className={`stone-stack ${isHoping ? 'animate-stone-hop' : ''}`}>
                    <div className="stone-stack-icon">🪨</div>
                    <div className="stone-stack-count">{count}</div>
                </div>
            )
        }
        return (
            <div className={`stones-container ${isHoping ? 'animate-stone-hop' : ''}`}>
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
            <div className="mancala-final-stats">
                <span>Moves <strong>{stats.moves}</strong></span><span>Captures <strong>{stats.captures}</strong></span><span>Extra turns <strong>{stats.extraTurns}</strong></span><span>Best streak <strong>{Math.max(bestCaptureStreak[1], bestCaptureStreak[2])}</strong></span>
            </div>
            <p>Match score: {p1Name} {matchWins[1]}–{matchWins[2]} {p2Name}</p>
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
                <div className="mancala-toolbar">
                    {playMode === 'vsComputer' && <label>CPU <select value={cpuDifficulty} onChange={event => setCpuDifficulty(event.target.value as CpuDifficulty)}>{(['Easy','Normal','Hard'] as CpuDifficulty[]).map(value => <option key={value}>{value}</option>)}</select></label>}
                    <label>Theme <select value={theme} onChange={event => setTheme(event.target.value as BoardTheme)}>{(['Classic','Midnight','Jungle'] as BoardTheme[]).map(value => <option key={value}>{value}</option>)}</select></label>
                    <button type="button" onClick={() => setTutorialOpen(value => !value)}>How to play</button>
                    <button type="button" className={timerEnabled ? 'active' : ''} onClick={() => setTimerEnabled(value => !value)}>Timer {timerEnabled ? `${turnSeconds}s` : 'Off'}</button>
                </div>
                {tutorialOpen && <div className="mancala-tutorial">Choose a pit on your side. Stones move counter-clockwise one pit at a time. Land in your store for another turn. Land alone on your side opposite occupied stones to capture them.</div>}
                <div className="mancala-puzzles">Puzzles: {PUZZLES.map(puzzle => <button key={puzzle.name} onClick={() => loadPuzzle(puzzle)}>{puzzle.name}</button>)}</div>
                <div className="mancala-round-meta"><span>{puzzleName ?? 'Classic match'}</span><span>Capture streak {captureStreak[currentPlayer]}</span><span>Match {matchWins[1]}–{matchWins[2]}</span></div>
            </div>
            
            {/* Middle: Board (centered) */}
            <div className="flex items-center justify-center">
                <div className="mancala-layout w-full max-w-4xl">
                    {/* Player 2 Score */}
                    <div className="mancala-score mancala-score-p2 text-center">
                        <div className="font-bold text-lg -mb-1">{p2Name}</div>
                        <div className="text-4xl font-bold text-yellow-200 [text-shadow:0_2px_4px_rgba(0,0,0,0.6)]">{pits[PLAYER_2_STORE]}</div>
                    </div>

                    {/* Board and Pit Counts */}
                    <div className="mancala-board-area min-w-0">
                        {/* Player 2 Pit Counts */}
                        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr] mb-1" style={{ gap: 'var(--mancala-pit-gap)'}}>
                            <div></div> {/* Spacer for P2 store */}
                            {pits.slice(7, 13).reverse().map((count, i) => {
                                const pitIndex = 12 - i;
                                return <div key={`count-${pitIndex}`} className="text-center font-bold text-lg text-yellow-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{count}</div>
                            })}
                            <div></div> {/* Spacer for P1 store */}
                        </div>
                        <div ref={boardRef} className={`mancala-board theme-${theme.toLowerCase()} p-3 md:p-5 rounded-2xl border-4`}>
                            <div className="absolute inset-0 z-10 overflow-hidden rounded-xl">
                                <MancalaBoard3D
                                    pits={pits}
                                    currentPlayer={currentPlayer}
                                    disabled={gameOver || (playMode === 'vsComputer' && currentPlayer === 2)}
                                    highlightedPit={highlightedPit}
                                    lastMovePath={lastMovePath}
                                    theme={theme}
                                    onPitClick={handlePitClick}
                                />
                            </div>
                            <div className="pointer-events-none invisible grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr] h-full" style={{ gap: 'var(--mancala-pit-gap)'}}>
                                {/* Player 2 Store */}
                                    <div ref={(element) => { if (element) pitRefs.current.set(PLAYER_2_STORE, element); }} className={`row-span-2 mancala-store ${highlightedPit === PLAYER_2_STORE ? 'highlight' : ''} ${previewEnd === PLAYER_2_STORE ? 'preview-end' : ''} ${lastMovePath.includes(PLAYER_2_STORE) ? 'last-path' : ''}`}>
                                    {renderStones(pits[PLAYER_2_STORE], PLAYER_2_STORE)}
                                </div>
                                
                                {/* Player 2 Pits */}
                                {pits.slice(7, 13).reverse().map((count, i) => {
                                  const pitIndex = 12 - i;
                                  return (
                                    <div ref={(element) => { if (element) pitRefs.current.set(pitIndex, element); }} key={pitIndex} onPointerEnter={() => currentPlayer === 2 && setPreviewPit(pitIndex)} onPointerLeave={() => setPreviewPit(null)} onClick={() => handlePitClick(pitIndex)} className={`mancala-pit ${highlightedPit === pitIndex ? 'highlight' : ''} ${previewEnd === pitIndex ? 'preview-end' : ''} ${lastMovePath.includes(pitIndex) ? 'last-path' : ''} ${currentPlayer === 2 && !gameOver && pits[pitIndex] > 0 ? 'cursor-pointer hover:bg-[#D2691E]' : 'cursor-not-allowed'}`}>
                                      {renderStones(count, pitIndex)}
                                    </div>
                                  );
                                })}
                                
                                {/* Player 1 Store */}
                                <div ref={(element) => { if (element) pitRefs.current.set(PLAYER_1_STORE, element); }} className={`row-span-2 mancala-store ${highlightedPit === PLAYER_1_STORE ? 'highlight' : ''} ${previewEnd === PLAYER_1_STORE ? 'preview-end' : ''} ${lastMovePath.includes(PLAYER_1_STORE) ? 'last-path' : ''}`}>
                                    {renderStones(pits[PLAYER_1_STORE], PLAYER_1_STORE)}
                                </div>
                                
                                {/* Player 1 Pits */}
                                {pits.slice(0, 6).map((count, i) => (
                                  <div ref={(element) => { if (element) pitRefs.current.set(i, element); }} key={i} onPointerEnter={() => currentPlayer === 1 && setPreviewPit(i)} onPointerLeave={() => setPreviewPit(null)} onClick={() => handlePitClick(i)} className={`mancala-pit ${highlightedPit === i ? 'highlight' : ''} ${previewEnd === i ? 'preview-end' : ''} ${lastMovePath.includes(i) ? 'last-path' : ''} ${currentPlayer === 1 && !gameOver && pits[i] > 0 ? 'cursor-pointer hover:bg-[#D2691E]' : 'cursor-not-allowed'}`}>
                                      {renderStones(count, i)}
                                  </div>
                                ))}
                            </div>
                            {flyingStone && <div key={flyingStone.key} className={`flying-mancala-stone ${flyingStone.colorClass}`} style={{
                                left: flyingStone.fromX,
                                top: flyingStone.fromY,
                                offsetPath: `path("M 0 0 Q ${(flyingStone.toX - flyingStone.fromX) / 2} ${(flyingStone.toY - flyingStone.fromY) / 2 - 85} ${flyingStone.toX - flyingStone.fromX} ${flyingStone.toY - flyingStone.fromY}")`
                            }} />}
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
                    <div className="mancala-score mancala-score-p1 text-center">
                        <div className="font-bold text-lg -mb-1">{p1Name}</div>
                        <div className="text-4xl font-bold text-yellow-200 [text-shadow:0_2px_4px_rgba(0,0,0,0.6)]">{pits[PLAYER_1_STORE]}</div>
                    </div>
                </div>
            </div>

            {/* Bottom: Reset Button */}
            <button onClick={() => handleReset()} className="justify-self-center bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-yellow-400 transition-colors"> Reset Game </button>

            <style>{`
                .mancala-board { position: relative; min-height: 240px; box-shadow: inset 0 0 32px rgba(54,20,4,.72), 0 16px 30px rgba(0,0,0,.32); }
                .mancala-board.theme-classic{background:#8b4513;border-color:#d2691e}.mancala-board.theme-midnight{background:linear-gradient(145deg,#101d32,#192a49);border-color:#4f75a8;box-shadow:inset 0 0 32px #050b16,0 16px 30px rgba(0,0,0,.4)}.mancala-board.theme-jungle{background:linear-gradient(145deg,#285026,#163819);border-color:#77a849;box-shadow:inset 0 0 32px #0b220c,0 16px 30px rgba(0,0,0,.4)}
                .mancala-toolbar,.mancala-puzzles,.mancala-round-meta{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:7px;font-size:11px}.mancala-toolbar label{display:flex;align-items:center;gap:5px;color:#aeb9c4}.mancala-toolbar select,.mancala-toolbar button,.mancala-puzzles button{padding:6px 8px;border:1px solid #526477;border-radius:7px;background:#172331;color:#e7edf3;font-weight:800}.mancala-toolbar button.active{border-color:#f4c649;color:#f4c649}.mancala-tutorial{max-width:680px;padding:9px 12px;border:1px solid #4b5d6e;border-radius:8px;background:#101923;color:#bdc9d3;font-size:11px}.mancala-puzzles{color:#8fa0ae}.mancala-puzzles button{padding:4px 7px}.mancala-round-meta span{padding:4px 7px;border-radius:20px;background:rgba(0,0,0,.24);color:#dbbd65}.mancala-final-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.mancala-final-stats span{display:grid;padding:8px;border:1px solid #425366;border-radius:8px;background:#111b26;color:#8fa0ae;font-size:10px}.mancala-final-stats strong{color:#f2cc64;font-size:18px}
                .mancala-layout { display: grid; grid-template-columns: 92px minmax(0,1fr) 92px; grid-template-areas: 'p2 board p1'; align-items: center; gap: 12px; }
                .mancala-score-p2 { grid-area: p2; }
                .mancala-score-p1 { grid-area: p1; }
                .mancala-board-area { grid-area: board; }
                .mancala-board .mancala-pit { min-height: 92px; border-radius: 44%; }
                .mancala-board .mancala-store { min-height: 198px; border-radius: 42%; }
                .mancala-board .stone { width: 23%; height: 23%; border: 1px solid rgba(255,255,255,.35); box-shadow: inset -3px -4px 5px rgba(0,0,0,.34), inset 2px 2px 4px rgba(255,255,255,.5), 0 3px 4px rgba(0,0,0,.38); }
                .stone-ruby { background: radial-gradient(circle at 30% 25%,#ffb5ba,#d92f45 48%,#6d0d1a); }
                .stone-sapphire { background: radial-gradient(circle at 30% 25%,#b8e0ff,#347bd1 48%,#153869); }
                .stone-emerald { background: radial-gradient(circle at 30% 25%,#baf4cb,#36a964 48%,#14502d); }
                .stone-amethyst { background: radial-gradient(circle at 30% 25%,#ebc8ff,#9a50c7 48%,#48205f); }
                .stone-amber { background: radial-gradient(circle at 30% 25%,#fff0a4,#e7a52a 48%,#81500c); }
                .stone-pearl { background: radial-gradient(circle at 30% 25%,#fff,#d9d9e5 52%,#858595); }
                .stone-turquoise { background: radial-gradient(circle at 30% 25%,#bffff5,#31bba7 48%,#116457); }
                .flying-mancala-stone { position: absolute; z-index: 40; width: 25px; height: 25px; border: 2px solid rgba(255,255,255,.5); border-radius: 50%; pointer-events: none; offset-anchor: center; animation: mancala-flight .43s cubic-bezier(.25,.72,.32,1) forwards; box-shadow: inset -3px -4px 5px rgba(0,0,0,.32), inset 2px 2px 3px rgba(255,255,255,.55), 0 8px 10px rgba(0,0,0,.4); }
                @keyframes mancala-flight { 0% { offset-distance: 0%; transform: scale(.88) rotate(0); } 45% { transform: scale(1.28) rotate(190deg); } 100% { offset-distance: 100%; transform: scale(1) rotate(390deg); } }
                @keyframes stone-hop {
                    0% { transform: scale(1) translateY(0); }
                    50% { transform: scale(1.1) translateY(-15px); }
                    100% { transform: scale(1) translateY(0); }
                }
                .animate-stone-hop {
                    animation: stone-hop 0.3s ease-out forwards;
                }
                .mancala-pit.highlight, .mancala-store.highlight {
                    border-color: #fbbf24 !important;
                    background-color: rgba(210, 105, 30, 0.4);
                    box-shadow: inset 0 0 15px #fbbf24;
                }
                .mancala-pit.last-path,.mancala-store.last-path{outline:2px solid rgba(98,190,240,.25);outline-offset:-4px}.mancala-pit.preview-end,.mancala-store.preview-end{outline:3px solid #5ee0a0;outline-offset:-4px;box-shadow:inset 0 0 18px rgba(94,224,160,.55)}
                @media(max-width: 900px) { .mancala-layout { grid-template-columns: 1fr 1fr; grid-template-areas: 'p2 p1' 'board board'; gap: 8px 12px; } .mancala-score { display: flex; align-items: center; justify-content: center; gap: 8px; } .mancala-score .text-4xl { font-size: 1.55rem; } }
                @media(max-width: 760px) { .mancala-board { min-height: 150px; padding: 6px !important; border-width: 3px; } .mancala-board .mancala-pit { min-height: 54px; } .mancala-board .mancala-store { min-height: 116px; } .mancala-board .stone { width: 27%; height: 27%; } .flying-mancala-stone { width: 17px; height: 17px; } }
                @media(max-width: 430px) { .mancala-board { min-height: 126px; } .mancala-board .mancala-pit { min-height: 43px; } .mancala-board .mancala-store { min-height: 94px; } .mancala-layout { gap: 5px; } .mancala-final-stats{grid-template-columns:1fr 1fr}.mancala-tutorial{font-size:10px} }
            `}</style>
        </div>
    );
};

export default MancalaGame;
