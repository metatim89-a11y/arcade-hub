
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

const CrashGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State
  const [gameState, setGameState] = useState<'IDLE' | 'COUNTDOWN' | 'FLYING' | 'CRASHED'>('IDLE');
  const [multiplier, setMultiplier] = useState(1.00);
  const [bet, setBet] = useState(10);
  const [countdown, setCountdown] = useState(3);
  const [history, setHistory] = useState<number[]>([]);
  
  // Player State
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  
  // Refs for animation loop
  const requestRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(0);
  
  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

  // --- Game Logic ---

  const generateCrashPoint = () => {
    // 1% chance of instant crash (1.00x)
    // E = 0.99 / (1 - U)
    const r = Math.random();
    const crash = 0.99 / (1 - r);
    return Math.max(1.00, Math.floor(crash * 100) / 100);
  };

  const startGame = () => {
    if (!canBet(bet)) return;
    
    subtractCoins(bet, 'Crash Bet');
    setGameState('COUNTDOWN');
    setCountdown(3);
    setMultiplier(1.00);
    setHasCashedOut(false);
    setCashedOutAt(null);
    crashPointRef.current = generateCrashPoint();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          startFlying();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startFlying = () => {
    setGameState('FLYING');
    startTimeRef.current = Date.now();
    loop();
  };

  const loop = () => {
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000; // seconds
    
    // Growth function: M = e^(0.06 * t) 
    // This creates a nice accelerating curve
    const currentM = Math.pow(Math.E, 0.1 * elapsed); // Slower start
    
    if (currentM >= crashPointRef.current) {
      handleCrash(crashPointRef.current);
    } else {
      setMultiplier(currentM);
      drawGraph(currentM);
      requestRef.current = requestAnimationFrame(loop);
    }
  };

  const handleCrash = (finalValue: number) => {
    setGameState('CRASHED');
    setMultiplier(finalValue);
    setHistory(prev => [finalValue, ...prev].slice(0, 5)); // Keep last 5
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    drawGraph(finalValue, true);
  };

  const handleCashOut = () => {
    if (gameState === 'FLYING' && !hasCashedOut) {
      setHasCashedOut(true);
      setCashedOutAt(multiplier);
      const winnings = Math.floor(bet * multiplier);
      addCoins(winnings, 'Crash Cashout');
    }
  };

  // --- Rendering ---

  const drawGraph = useCallback((currentMultiplier: number, isCrashed = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Clear
    ctx.clearRect(0, 0, width, height);

    // Gradient Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a202c');
    bgGradient.addColorStop(1, '#2d3748');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines (Static for now, could move)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=1; i<5; i++) {
        const y = height - (height/5)*i;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Draw Curve
    // Map multiplier to Y. As multiplier grows, we scale the graph down so the rocket stays roughly in view
    // Viewport range: 1.00 to max(2.00, currentMultiplier * 1.2)
    const maxY = Math.max(2.00, currentMultiplier * 1.1);
    const minY = 1.00;
    const scaleY = (val: number) => height - ((val - minY) / (maxY - minY)) * height * 0.8 - 20; // 20px padding bottom
    
    // Time mapping: X axis stretches as time goes on
    // Just draw a bezier curve representing growth
    ctx.beginPath();
    ctx.strokeStyle = isCrashed ? '#ef4444' : (hasCashedOut ? '#10b981' : '#f59e0b');
    ctx.lineWidth = 4;
    ctx.moveTo(0, height - 20);
    
    // Simple quadratic curve visual
    const rocketX = width * 0.8;
    const rocketY = scaleY(currentMultiplier);
    
    ctx.quadraticCurveTo(width * 0.4, height - 20, rocketX, rocketY);
    ctx.stroke();

    // Draw Area under curve
    ctx.lineTo(rocketX, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = isCrashed ? 'rgba(239, 68, 68, 0.2)' : (hasCashedOut ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)');
    ctx.fill();

    // Draw Rocket / Dot
    ctx.beginPath();
    ctx.fillStyle = isCrashed ? '#ef4444' : '#ffffff';
    ctx.arc(rocketX, rocketY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Rocket Emoji
    if (!isCrashed) {
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🚀", rocketX, rocketY - 20);
    } else {
        ctx.font = "24px Arial";
        ctx.fillText("💥", rocketX, rocketY - 20);
    }

  }, [hasCashedOut]);

  useEffect(() => {
      // Initial Draw
      drawGraph(1.00);
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
  }, [drawGraph]);

  // Auto-resize canvas
  useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
          const parent = canvas.parentElement;
          if (parent) {
              canvas.width = parent.clientWidth;
              canvas.height = 300; // Fixed height
              drawGraph(multiplier, gameState === 'CRASHED');
          }
      }
  }, [multiplier, gameState, drawGraph]);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl gap-6 p-4">
      
      {/* Header & History */}
      <div className="w-full flex justify-between items-center bg-gray-800/50 p-3 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">🚀 CRASH</h2>
          </div>
          <div className="flex gap-2 overflow-hidden">
              {history.map((h, i) => (
                  <div key={i} className={`px-2 py-1 rounded text-xs font-bold ${h >= 2.0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {h.toFixed(2)}x
                  </div>
              ))}
          </div>
      </div>

      {/* Game Display */}
      <div className="relative w-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
          <canvas ref={canvasRef} className="w-full block" />
          
          {/* Overlay Info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              
              {gameState === 'COUNTDOWN' && (
                  <div className="text-6xl font-black text-white animate-pulse">
                      Start in {countdown}
                  </div>
              )}

              {gameState === 'IDLE' && (
                  <div className="text-xl text-gray-400 font-mono">
                      Ready to launch
                  </div>
              )}

              {(gameState === 'FLYING' || gameState === 'CRASHED') && (
                   <div className={`text-6xl md:text-8xl font-black tabular-nums tracking-tighter drop-shadow-lg ${
                       gameState === 'CRASHED' ? 'text-red-500' : (hasCashedOut ? 'text-green-400' : 'text-white')
                   }`}>
                       {multiplier.toFixed(2)}x
                   </div>
              )}
              
              {gameState === 'CRASHED' && (
                  <div className="text-2xl text-red-500 font-bold mt-2">CRASHED</div>
              )}

              {hasCashedOut && (
                  <div className="text-2xl text-green-400 font-bold mt-2 bg-black/50 px-4 py-1 rounded-full border border-green-500/30 backdrop-blur-md">
                      Cashed out at {cashedOutAt?.toFixed(2)}x (+{Math.floor(bet * (cashedOutAt || 1))} {currencySymbol})
                  </div>
              )}
          </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 w-full items-stretch justify-center bg-gray-800/40 p-4 rounded-2xl">
          
          {/* Bet Controls */}
          <div className="flex-1 flex flex-col gap-2">
              <label className="text-gray-400 text-sm font-bold ml-1">BET AMOUNT ({currencySymbol})</label>
              <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-xl border border-gray-700">
                  <button 
                    onClick={() => setBet(Math.max(10, bet - 10))}
                    disabled={gameState !== 'IDLE'}
                    className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-xl disabled:opacity-50"
                  >-</button>
                  <input 
                    type="number" 
                    value={bet}
                    onChange={(e) => setBet(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={gameState !== 'IDLE'}
                    className="flex-1 bg-transparent text-center text-xl font-bold focus:outline-none text-white"
                  />
                  <button 
                    onClick={() => setBet(bet + 10)}
                    disabled={gameState !== 'IDLE'}
                    className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-xl disabled:opacity-50"
                  >+</button>
              </div>
              <div className="flex gap-2">
                  {[100, 500, 1000].map(amt => (
                      <button 
                        key={amt}
                        onClick={() => setBet(amt)}
                        disabled={gameState !== 'IDLE'}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-xs py-1 rounded border border-gray-700 disabled:opacity-50"
                      >
                          {amt}
                      </button>
                  ))}
              </div>
          </div>

          {/* Action Button */}
          <div className="flex-1 flex items-center">
              {gameState === 'IDLE' || gameState === 'CRASHED' ? (
                   <GlassButton 
                     onClick={startGame}
                     disabled={!canBet(bet)}
                     className="w-full h-full min-h-[60px] text-2xl !bg-green-500 hover:!bg-green-400 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                   >
                       PLACE BET
                   </GlassButton>
              ) : gameState === 'COUNTDOWN' ? (
                   <GlassButton disabled className="w-full h-full min-h-[60px] text-xl opacity-80 cursor-wait">
                       PREPARING...
                   </GlassButton>
              ) : (
                   <GlassButton 
                        onClick={handleCashOut}
                        disabled={hasCashedOut}
                        className={`w-full h-full min-h-[60px] text-2xl text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all ${
                            hasCashedOut 
                            ? '!bg-gray-600 text-gray-400 cursor-not-allowed shadow-none' 
                            : '!bg-yellow-400 hover:!bg-yellow-300'
                        }`}
                   >
                        {hasCashedOut ? 'CASHED OUT' : `CASH OUT (${(bet * multiplier).toFixed(0)})`}
                   </GlassButton>
              )}
          </div>
      </div>
    </div>
  );
};

export default CrashGame;
