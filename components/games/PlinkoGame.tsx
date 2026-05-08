
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

type RiskLevel = 'Low' | 'Medium' | 'High';

interface Ball {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    value: number;
    color: string;
    trail: {x: number, y: number}[];
    isFinished: boolean;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

// Standard Plinko Multipliers
const MULTIPLIER_DATA: Record<number, Record<RiskLevel, number[]>> = {
    8: {
        Low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
        Medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
        High: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29]
    },
    9: {
        Low: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
        Medium: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
        High: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43]
    },
    10: {
        Low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
        Medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
        High: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76]
    },
    11: {
        Low: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
        Medium: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
        High: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120]
    },
    12: {
        Low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
        Medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
        High: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170]
    },
    13: {
        Low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
        Medium: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 6, 13, 43],
        High: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260]
    },
    14: {
        Low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
        Medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
        High: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420]
    },
    15: {
        Low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
        Medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
        High: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620]
    },
    16: {
        Low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
        Medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
        High: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]
    }
};

// Ball Colors based on Risk
const BALL_COLORS: Record<RiskLevel, string> = {
    Low: '#4ade80',   // Green
    Medium: '#fbbf24', // Amber
    High: '#ef4444'    // Red
};

const PlinkoGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
    
    // Game Settings
    const [bet, setBet] = useState(10);
    const [rows, setRows] = useState(16);
    const [risk, setRisk] = useState<RiskLevel>('Medium');
    const [autoMode, setAutoMode] = useState(false);
    
    // Game State
    const [history, setHistory] = useState<number[]>([]);
    const [feedback, setFeedback] = useState('');
    const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
    
    // Refs for loop
    const ballsRef = useRef<Ball[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const lastAutoDropRef = useRef(0);
    const animationRef = useRef<number>();
    const glowingPegRef = useRef<{r: number, c: number, life: number}[]>([]);

    // Computed Multipliers
    const multipliers = useMemo(() => {
        return MULTIPLIER_DATA[rows]?.[risk] || MULTIPLIER_DATA[16]['Medium'];
    }, [rows, risk]);

    // Physics Constants
    // NOTE: These are relative to the grid spacing now, determined in loop
    const GRAVITY = 0.3;
    const AIR_RESISTANCE = 0.995; 
    const RESTITUTION = 0.6; // Bounciness

    // --- Game Loop ---
    const updatePhysics = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        
        // --- Dynamic Dimensions ---
        // Max pegs in the last row = rows + 2 (since row 0 has 3 pegs)
        const maxPegs = rows + 2; 
        
        // Define margins and spacing
        const paddingX = width * 0.05; // 5% padding on sides
        const usableWidth = width - (paddingX * 2);
        
        // Calculate grid spacing
        const spacingX = usableWidth / (maxPegs - 1);
        const spacingY = spacingX * 0.9; // Slightly tighter vertical spacing for triangular packed feel
        
        // Radius scaling
        const pegRadius = Math.max(2, spacingX * 0.12);
        const ballRadius = Math.max(3, spacingX * 0.23); // Ensure ball passes through gap (gap approx 0.76 * spacing)

        // Calculate Start Y so the board is centered or reasonable
        const boardHeight = rows * spacingY;
        const paddingTop = 50;
        const bucketY = paddingTop + boardHeight + spacingY * 0.5;

        // Wall Boundaries
        const leftWall = paddingX - spacingX * 0.5;
        const rightWall = width - paddingX + spacingX * 0.5;

        ctx.clearRect(0, 0, width, height);

        // 1. Draw Pegs
        ctx.shadowBlur = 0;
        // Render `rows` number of rows (e.g. 0 to 15 for rows=16)
        for (let row = 0; row < rows; row++) { 
            const pegsInRow = 3 + row;
            // Center the row
            const rowWidth = (pegsInRow - 1) * spacingX;
            const startX = (width - rowWidth) / 2;
            const y = paddingTop + row * spacingY;

            for (let col = 0; col < pegsInRow; col++) {
                const x = startX + col * spacingX;
                
                // Check glow
                const glowIndex = glowingPegRef.current.findIndex(p => p.r === row && p.c === col);
                let pegColor = '#4b5563'; // gray-600

                if (glowIndex !== -1) {
                    const glow = glowingPegRef.current[glowIndex];
                    ctx.beginPath();
                    ctx.arc(x, y, pegRadius + 3, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${glow.life * 0.5})`;
                    ctx.fill();
                    
                    pegColor = '#fff';
                    glowingPegRef.current[glowIndex].life -= 0.1;
                    if (glowingPegRef.current[glowIndex].life <= 0) {
                        glowingPegRef.current.splice(glowIndex, 1);
                    }
                }

                ctx.beginPath();
                ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
                ctx.fillStyle = pegColor;
                ctx.fill();
            }
        }

        // 2. Draw Multipliers (Buckets)
        // The last row has `3 + (rows-1)` pegs.
        // Buckets sit between these pegs.
        const lastRowIndex = rows - 1;
        const lastRowPegsCount = 3 + lastRowIndex;
        const lastRowWidth = (lastRowPegsCount - 1) * spacingX;
        const lastRowStartX = (width - lastRowWidth) / 2;
        
        multipliers.forEach((mult, i) => {
            // Buckets are in the gaps between pegs of the last row.
            // i starts at 0. Bucket 0 is between peg 0 and 1 of the last row.
            const x = lastRowStartX + i * spacingX + spacingX / 2;

            // Color based on value
            let color = '#374151'; // default gray
            if (mult >= 10) color = '#ef4444'; // Red
            else if (mult >= 2) color = '#f59e0b'; // Orange
            else if (mult >= 1) color = '#10b981'; // Green
            else if (mult < 1) color = '#1f2937'; // Dark
            
            // Bucket Box
            ctx.fillStyle = color;
            ctx.beginPath();
            const w = spacingX * 0.92;
            const h = 25;
            
            if (ctx.roundRect) {
                ctx.roundRect(x - w/2, bucketY, w, h, 4);
            } else {
                ctx.rect(x - w/2, bucketY, w, h);
            }
            ctx.fill();
            
            // Text
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(8, spacingX * 0.35)}px sans-serif`;
            ctx.textAlign = 'center';
            
            if (spacingX > 15) {
                ctx.fillText(`${mult}x`, x, bucketY + h * 0.7);
            }
        });

        // 3. Update & Draw Balls
        for (let i = ballsRef.current.length - 1; i >= 0; i--) {
            const ball = ballsRef.current[i];
            
            // --- Physics Update ---
            ball.vy += GRAVITY;
            ball.vx *= AIR_RESISTANCE;
            ball.vy *= AIR_RESISTANCE;
            
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Wall Collisions
            if (ball.x < leftWall + ballRadius) {
                ball.x = leftWall + ballRadius;
                ball.vx *= -0.5; // Wall damping
                ball.x += 1; // Push out
            } else if (ball.x > rightWall - ballRadius) {
                ball.x = rightWall - ballRadius;
                ball.vx *= -0.5;
                ball.x -= 1;
            }

            // --- Peg Collisions ---
            // Spatial hashing optimization: calculate which row we are near
            const approxRow = Math.round((ball.y - paddingTop) / spacingY);
            
            // Check row and adjacent rows
            for (let r = Math.max(0, approxRow - 1); r <= Math.min(rows - 1, approxRow + 1); r++) {
                 const pegsInRow = 3 + r;
                 const rowWidth = (pegsInRow - 1) * spacingX;
                 const startX = (width - rowWidth) / 2;
                 const pegY = paddingTop + r * spacingY;
                 
                 // Calc approximate column
                 const approxCol = Math.round((ball.x - startX) / spacingX);
                 
                 for (let c = Math.max(0, approxCol - 1); c <= Math.min(pegsInRow - 1, approxCol + 1); c++) {
                     const pegX = startX + c * spacingX;
                     
                     const dx = ball.x - pegX;
                     const dy = ball.y - pegY;
                     const distSq = dx*dx + dy*dy;
                     const minDist = ballRadius + pegRadius;

                     if (distSq < minDist * minDist) {
                        const dist = Math.sqrt(distSq);
                        
                        // Normal Vector (Peg to Ball)
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // Reflect Velocity
                        // V_new = V_old - 2 * (V_old . N) * N
                        const dotProduct = ball.vx * nx + ball.vy * ny;
                        
                        // Apply reflection with energy loss (restitution)
                        ball.vx = (ball.vx - 2 * dotProduct * nx) * RESTITUTION;
                        ball.vy = (ball.vy - 2 * dotProduct * ny) * RESTITUTION;

                        // Add slight randomness to prevent vertical stacking/perfect balance
                        ball.vx += (Math.random() - 0.5) * 0.5;
                        
                        // Resolve Overlap (Push ball out)
                        const overlap = minDist - dist;
                        ball.x += nx * overlap;
                        ball.y += ny * overlap;

                        // Visual Feedback
                        glowingPegRef.current.push({r: r, c: c, life: 1.0});
                     }
                 }
            }

            // --- Trail Drawing ---
            ball.trail.push({x: ball.x, y: ball.y});
            if (ball.trail.length > 10) ball.trail.shift();

            ctx.beginPath();
            for(let j=0; j<ball.trail.length; j++) {
                const t = ball.trail[j];
                if (j===0) ctx.moveTo(t.x, t.y);
                else ctx.lineTo(t.x, t.y);
            }
            ctx.strokeStyle = ball.color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = ballRadius;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            // --- Ball Drawing ---
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI*2);
            ctx.fillStyle = ball.color;
            ctx.fill();
            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(ball.x - ballRadius*0.3, ball.y - ballRadius*0.3, ballRadius*0.3, 0, Math.PI*2);
            ctx.fill();

            // --- Check Floor (Bucket Entry) ---
            if (ball.y > bucketY - ballRadius) {
                // Determine bucket index based on X
                // The buckets start at lastRowStartX + spacingX/2 (center of first gap)
                // The gap width is spacingX.
                // We shift X by (lastRowStartX) to get relative pos
                const relativeX = ball.x - lastRowStartX;
                let index = Math.floor(relativeX / spacingX);
                
                // Clamp index just in case of slight boundary errors
                if (index < 0) index = 0;
                if (index >= multipliers.length) index = multipliers.length - 1;

                const mult = multipliers[index];
                const win = ball.value * mult;
                
                // Payout
                addCoins(win, `Plinko ${mult}x`);
                setHistory(prev => [mult, ...prev].slice(0, 5));
                
                // Visual Feedback
                if (mult >= 10) setFeedback(`HUGE WIN! ${mult}x`);
                else if (mult > 1) setFeedback(`Nice! ${mult}x`);
                
                // Remove ball
                ballsRef.current.splice(i, 1);
            } else if (ball.y > height + 50) {
                // Failsafe cleanup
                ballsRef.current.splice(i, 1);
            }
        }

        // 4. Update & Draw Particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if (p.life <= 0) {
                particlesRef.current.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        animationRef.current = requestAnimationFrame(updatePhysics);
    }, [rows, multipliers, addCoins]);

    useEffect(() => {
        animationRef.current = requestAnimationFrame(updatePhysics);
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [updatePhysics]);

    const dropBall = () => {
        if (!canBet(bet)) {
            if (autoMode) setAutoMode(false);
            setFeedback('Insufficient Funds');
            return;
        }
        subtractCoins(bet, 'Plinko Drop');
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Dynamic Sizing calculation match the render loop
        const maxPegs = rows + 2; 
        const paddingX = canvas.width * 0.05;
        const usableWidth = canvas.width - (paddingX * 2);
        const spacingX = usableWidth / (maxPegs - 1);
        
        // Target the top gap (between the top 3 pegs, specifically the center gap)
        // Top row (row 0) has 3 pegs. Center peg is at width/2.
        // We want to drop roughly at width/2, with a slight offset to hit the first peg unpredictably
        // or fall into the left/right channel of the first peg.
        // Actually, Plinko usually drops exactly center or slightly off center.
        
        const dropJitter = (Math.random() - 0.5) * (spacingX * 0.4);
        const startX = canvas.width / 2 + dropJitter;

        ballsRef.current.push({
            id: Date.now() + Math.random(),
            x: startX,
            y: 20, // Start above the first peg row
            vx: 0,
            vy: 0,
            radius: 5, // Will be ignored by render loop which calculates dynamic radius, but good for type init
            value: bet,
            color: BALL_COLORS[risk],
            trail: [],
            isFinished: false
        });
    };

    // Auto Drop Logic
    useEffect(() => {
        let interval: any;
        if (autoMode) {
            interval = setInterval(() => {
                if (Date.now() - lastAutoDropRef.current > 200) { 
                    dropBall();
                    lastAutoDropRef.current = Date.now();
                }
            }, 300); 
        }
        return () => clearInterval(interval);
    }, [autoMode, bet, risk, rows]);

    // Resize Observer
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;
        
        const resize = () => {
            const width = Math.min(parent.clientWidth, 800);
            // Maintain aspect ratio: Taller for more rows
            // Approx ratio: width * 0.8 is good for ~16 rows
            const height = width * 0.8 + (rows * 10); 
            canvas.width = width;
            canvas.height = Math.min(height, 650);
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [rows]);

    return (
        <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl items-start justify-center p-4">
            
            {/* Left Panel: Controls */}
            <div className="w-full lg:w-80 flex flex-col gap-4 bg-gray-900/80 p-6 rounded-2xl border border-gray-700 shadow-xl backdrop-blur-sm h-fit">
                <h2 className="text-2xl font-bold text-yellow-400 flex items-center gap-2 mb-2">
                    <span className="text-3xl">💎</span> Plinko
                </h2>
                
                {/* Bet Amount */}
                <div className="bg-black/30 p-4 rounded-xl border border-gray-700">
                    <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Bet Amount</label>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setBet(Math.max(1, Math.floor(bet / 2)))}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-bold text-xs"
                        >½</button>
                        <input 
                            type="number" 
                            value={bet} 
                            onChange={(e) => setBet(Math.max(1, Number(e.target.value)))} 
                            className="flex-1 bg-transparent text-white text-center font-bold text-xl focus:outline-none w-20"
                        />
                        <button 
                            onClick={() => setBet(bet * 2)}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-bold text-xs"
                        >2x</button>
                    </div>
                </div>

                {/* Risk Level */}
                <div className="bg-black/30 p-4 rounded-xl border border-gray-700">
                    <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Risk Level</label>
                    <div className="flex bg-gray-800 rounded-lg p-1">
                        {(['Low', 'Medium', 'High'] as RiskLevel[]).map(r => (
                            <button
                                key={r}
                                onClick={() => setRisk(r)}
                                className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${risk === r ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Rows */}
                <div className="bg-black/30 p-4 rounded-xl border border-gray-700">
                    <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Rows: {rows}</label>
                    <input 
                        type="range" 
                        min="8" 
                        max="16" 
                        step="1" 
                        value={rows} 
                        onChange={(e) => setRows(Number(e.target.value))}
                        className="w-full accent-yellow-400 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
                        <span>8</span><span>12</span><span>16</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 mt-2">
                    <GlassButton 
                        onClick={dropBall}
                        className={`w-full py-4 text-xl shadow-[0_0_20px_rgba(234,179,8,0.2)] ${autoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={autoMode}
                    >
                        Drop Ball
                    </GlassButton>
                    
                    <button 
                        onClick={() => setAutoMode(!autoMode)}
                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${
                            autoMode 
                            ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' 
                            : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {autoMode ? '⏹ Stop Auto' : '▶ Start Auto'}
                    </button>
                </div>
            </div>

            {/* Right Panel: Game Board */}
            <div className="flex-1 flex flex-col gap-4 w-full max-w-[800px]">
                {/* History Bar */}
                <div className="w-full bg-gray-900/50 rounded-xl p-2 flex items-center gap-2 overflow-hidden h-14 border border-gray-700">
                    <span className="text-xs text-gray-500 font-bold uppercase px-2">History</span>
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar w-full">
                        {history.map((h, i) => (
                            <div 
                                key={i} 
                                className={`px-3 py-2 rounded-md text-sm font-bold min-w-[50px] text-center animate-pop-in ${
                                    h >= 10 ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 
                                    h >= 2 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30' : 
                                    h >= 1 ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-400'
                                }`}
                            >
                                {h}x
                            </div>
                        ))}
                    </div>
                </div>

                {/* Canvas Container */}
                <div className="relative w-full bg-gray-900 rounded-2xl border-4 border-gray-800 shadow-2xl overflow-hidden flex justify-center">
                    <canvas ref={canvasRef} className="block max-w-full" />
                    
                    {/* Feedback Overlay */}
                    <div className="absolute top-4 left-0 w-full text-center pointer-events-none">
                        {feedback && (
                            <div key={feedback} className="inline-block px-6 py-2 bg-black/60 rounded-full text-yellow-400 font-bold text-lg backdrop-blur-md animate-bounce border border-yellow-400/30">
                                {feedback}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlinkoGame;
