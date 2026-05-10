// File: components/games/PlinkoGame.tsx
// Version: 1.0.1
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
    const glowingPegRef = useRef<{r: number, c: number, life: number, scale: number}[]>([]);
    const glowingBucketRef = useRef<{index: number, life: number}[]>([]);

    // Computed Multipliers
    const multipliers = useMemo(() => {
        return MULTIPLIER_DATA[rows]?.[risk] || MULTIPLIER_DATA[16]['Medium'];
    }, [rows, risk]);

    // Physics Constants
    const GRAVITY = 0.3;
    const AIR_RESISTANCE = 0.995; 
    const RESTITUTION = 0.5; // Bounciness

    // --- Game Loop ---
    const updatePhysics = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        
        const maxPegs = rows + 2; 
        const paddingX = width * 0.05;
        const usableWidth = width - (paddingX * 2);
        const spacingX = usableWidth / (maxPegs - 1);
        const spacingY = spacingX * 0.9;
        
        const pegRadius = Math.max(2, spacingX * 0.12);
        const ballRadius = Math.max(3, spacingX * 0.23);

        const boardHeight = rows * spacingY;
        const paddingTop = 50;
        const bucketY = paddingTop + boardHeight + spacingY * 0.5;

        const leftWall = paddingX - spacingX * 0.5;
        const rightWall = width - paddingX + spacingX * 0.5;

        ctx.clearRect(0, 0, width, height);

        // 1. Draw Pegs
        for (let row = 0; row < rows; row++) { 
            const pegsInRow = 3 + row;
            const rowWidth = (pegsInRow - 1) * spacingX;
            const startX = (width - rowWidth) / 2;
            const y = paddingTop + row * spacingY;

            for (let col = 0; col < pegsInRow; col++) {
                const x = startX + col * spacingX;
                
                const glowIndex = glowingPegRef.current.findIndex(p => p.r === row && p.c === col);
                let pegColor = '#4b5563'; 
                let currentPegRadius = pegRadius;

                if (glowIndex !== -1) {
                    const glow = glowingPegRef.current[glowIndex];
                    currentPegRadius = pegRadius * glow.scale;
                    ctx.beginPath();
                    ctx.arc(x, y, currentPegRadius + 5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${glow.life * 0.3})`;
                    ctx.fill();
                    pegColor = '#fff';
                    glowingPegRef.current[glowIndex].life -= 0.05;
                    glowingPegRef.current[glowIndex].scale = 1 + glow.life * 0.5;
                    if (glowingPegRef.current[glowIndex].life <= 0) glowingPegRef.current.splice(glowIndex, 1);
                }

                ctx.beginPath();
                ctx.arc(x, y, currentPegRadius, 0, Math.PI * 2);
                ctx.fillStyle = pegColor;
                ctx.fill();
            }
        }

        // 2. Draw Multipliers (Buckets)
        const lastRowIndex = rows - 1;
        const lastRowPegsCount = 3 + lastRowIndex;
        const lastRowWidth = (lastRowPegsCount - 1) * spacingX;
        const lastRowStartX = (width - lastRowWidth) / 2;
        
        multipliers.forEach((mult, i) => {
            const x = lastRowStartX + i * spacingX + spacingX / 2;
            let color = '#374151'; 
            if (mult >= 10) color = '#ef4444'; 
            else if (mult >= 2) color = '#f59e0b'; 
            else if (mult >= 1) color = '#10b981'; 
            else if (mult < 1) color = '#1f2937'; 
            
            const glow = glowingBucketRef.current.find(b => b.index === i);
            
            ctx.fillStyle = color;
            ctx.beginPath();
            const w = spacingX * 0.92;
            const h = 25;
            
            if (glow) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#fff';
                glow.life -= 0.05;
                if (glow.life <= 0) glowingBucketRef.current = glowingBucketRef.current.filter(b => b.index !== i);
            } else {
                ctx.shadowBlur = 0;
            }

            if (ctx.roundRect) ctx.roundRect(x - w/2, bucketY, w, h, 4);
            else ctx.rect(x - w/2, bucketY, w, h);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(8, spacingX * 0.35)}px sans-serif`;
            ctx.textAlign = 'center';
            if (spacingX > 15) ctx.fillText(`${mult}x`, x, bucketY + h * 0.7);
        });

        // 3. Update & Draw Balls
        for (let i = ballsRef.current.length - 1; i >= 0; i--) {
            const ball = ballsRef.current[i];
            
            ball.vy += GRAVITY;
            ball.vx *= AIR_RESISTANCE;
            ball.vy *= AIR_RESISTANCE;
            
            ball.x += ball.vx;
            ball.y += ball.vy;

            if (ball.x < leftWall + ballRadius) {
                ball.x = leftWall + ballRadius;
                ball.vx *= -0.5;
                ball.x += 1;
            } else if (ball.x > rightWall - ballRadius) {
                ball.x = rightWall - ballRadius;
                ball.vx *= -0.5;
                ball.x -= 1;
            }

            const approxRow = Math.round((ball.y - paddingTop) / spacingY);
            for (let r = Math.max(0, approxRow - 1); r <= Math.min(rows - 1, approxRow + 1); r++) {
                 const pegsInRow = 3 + r;
                 const rowWidth = (pegsInRow - 1) * spacingX;
                 const startX = (width - rowWidth) / 2;
                 const pegY = paddingTop + r * spacingY;
                 const approxCol = Math.round((ball.x - startX) / spacingX);
                 
                 for (let c = Math.max(0, approxCol - 1); c <= Math.min(pegsInRow - 1, approxCol + 1); c++) {
                     const pegX = startX + c * spacingX;
                     const dx = ball.x - pegX;
                     const dy = ball.y - pegY;
                     const distSq = dx*dx + dy*dy;
                     const minDist = ballRadius + pegRadius;

                     if (distSq < minDist * minDist) {
                        const dist = Math.sqrt(distSq);
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const dotProduct = ball.vx * nx + ball.vy * ny;
                        
                        ball.vx = (ball.vx - 2 * dotProduct * nx) * RESTITUTION;
                        ball.vy = (ball.vy - 2 * dotProduct * ny) * RESTITUTION;
                        
                        // Direct unbiased jitter to prevent drift
                        ball.vx += (Math.random() - 0.5) * 0.2;
                        
                        const overlap = minDist - dist;
                        ball.x += nx * (overlap + 0.1);
                        ball.y += ny * (overlap + 0.1);
                        glowingPegRef.current.push({r: r, c: c, life: 1.0, scale: 1.5});
                     }
                 }
            }

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

            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI*2);
            ctx.fillStyle = ball.color;
            ctx.fill();

            if (ball.y > bucketY - ballRadius) {
                const relativeX = ball.x - lastRowStartX;
                let index = Math.floor(relativeX / spacingX);
                if (index < 0) index = 0;
                if (index >= multipliers.length) index = multipliers.length - 1;

                const mult = multipliers[index];
                const win = ball.value * mult;
                
                addCoins(win, `Plinko ${mult}x`);
                setHistory(prev => [mult, ...prev].slice(0, 5));
                glowingBucketRef.current.push({index: index, life: 1.0});
                
                if (mult >= 10) setFeedback(`HUGE WIN! ${mult}x`);
                else if (mult > 1) setFeedback(`Nice! ${mult}x`);
                
                setTimeout(() => setFeedback(prev => prev.includes(`${mult}x`) ? '' : prev), 3000);
                ballsRef.current.splice(i, 1);
            } else if (ball.y > height + 50) {
                ballsRef.current.splice(i, 1);
            }
        }

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
            setTimeout(() => setFeedback(''), 2000);
            return;
        }
        subtractCoins(bet, 'Plinko Drop');
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        const maxPegs = rows + 2; 
        const paddingX = canvas.width * 0.05;
        const usableWidth = canvas.width - (paddingX * 2);
        const spacingX = usableWidth / (maxPegs - 1);
        
        const dropJitter = (Math.random() - 0.5) * (spacingX * 0.2);
        const startX = canvas.width / 2 + dropJitter;

        ballsRef.current.push({
            id: Date.now() + Math.random(),
            x: startX,
            y: 20,
            vx: 0,
            vy: 0,
            radius: 5,
            value: bet,
            color: BALL_COLORS[risk],
            trail: [],
            isFinished: false
        });
    };

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

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;
        
        const resize = () => {
            const width = Math.min(parent.clientWidth, 800);
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
            <div className="w-full lg:w-80 flex flex-col gap-4 bg-gray-900/80 p-6 rounded-2xl border border-gray-700 shadow-xl backdrop-blur-sm h-fit">
                <h2 className="text-2xl font-bold text-yellow-400 flex items-center gap-2 mb-2">
                    <span className="text-3xl">💎</span> Plinko
                </h2>
                
                <div className="bg-black/30 p-4 rounded-xl border border-gray-700">
                    <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Bet Amount</label>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setBet(Math.max(1, Math.floor(bet / 2)))} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-bold text-xs">½</button>
                        <input type="number" value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value)))} className="flex-1 bg-transparent text-white text-center font-bold text-xl focus:outline-none w-20" />
                        <button onClick={() => setBet(bet * 2)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-bold text-xs">2x</button>
                    </div>
                </div>

                <div className="bg-black/30 p-4 rounded-xl border border-gray-700">
                    <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Risk Level</label>
                    <div className="flex bg-gray-800 rounded-lg p-1">
                        {(['Low', 'Medium', 'High'] as RiskLevel[]).map(r => (
                            <button key={r} onClick={() => setRisk(r)} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${risk === r ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-black/30 p-4 rounded-xl border border-gray-700">
                    <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Rows: {rows}</label>
                    <input type="range" min="8" max="16" step="1" value={rows} onChange={(e) => setRows(Number(e.target.value))} className="w-full accent-yellow-400 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
                        <span>8</span><span>12</span><span>16</span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                    <GlassButton onClick={dropBall} className={`w-full py-4 text-xl shadow-[0_0_20px_rgba(234,179,8,0.2)] ${autoMode ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={autoMode}>
                        Drop Ball
                    </GlassButton>
                    <button onClick={() => setAutoMode(!autoMode)} className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${autoMode ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}>
                        {autoMode ? '⏹ Stop Auto' : '▶ Start Auto'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 w-full max-w-[800px]">
                <div className="w-full bg-gray-900/50 rounded-xl p-2 flex items-center gap-2 overflow-hidden h-14 border border-gray-700">
                    <span className="text-xs text-gray-500 font-bold uppercase px-2">History</span>
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar w-full">
                        {history.map((h, i) => (
                            <div key={i} className={`px-3 py-2 rounded-md text-sm font-bold min-w-[50px] text-center animate-pop-in ${h >= 10 ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : h >= 2 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30' : h >= 1 ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-400'}`}>
                                {h}x
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative w-full bg-gray-900 rounded-2xl border-4 border-gray-800 shadow-2xl overflow-hidden flex justify-center">
                    <canvas ref={canvasRef} className="block max-w-full" />
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
