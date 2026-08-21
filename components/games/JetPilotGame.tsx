import React, { useEffect, useRef, useState } from 'react';
import GlassButton from '../ui/GlassButton';
import { CurrencyMode } from '../../types';
import { useCoinSystem } from '../../context/CoinContext';

interface LandingPad {
  id: number;
  x: number;
  width: number;
  multiplier: number;
  label: string;
  color: string;
}

export default function JetPilotGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { canBet, subtractCoins, addCoins, currencyMode, isProcessing } = useCoinSystem();

  const [betAmount, setBetAmount] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [feedback, setFeedback] = useState('Skill Pilot: Control your Jet Thrusters to land on high multiplier pads!');
  const [highScoreMult, setHighScoreMult] = useState(1.0);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSfx = (type: 'thrust' | 'land' | 'jackpot' | 'crash') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'thrust') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(320, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'land') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'jackpot') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(783, now + 0.2);
        osc.frequency.setValueAtTime(1046, now + 0.3);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.35);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {}
  };

  const jetState = useRef({
    x: 400,
    y: 120,
    vx: 3.5,
    vy: 0.5,
    thrust: false,
    altitude: 120,
    pads: [] as LandingPad[],
  });

  const launchJet = async () => {
    if (isPlaying || isProcessing) return;
    if (!canBet(betAmount)) {
      setFeedback('Insufficient coin balance for this flight!');
      return;
    }

    const deducted = await subtractCoins(betAmount, 'Jet Pilot Flight Entry');
    if (!deducted) return;

    // Generate pads
    const padsList: LandingPad[] = [
      { id: 1, x: 120, width: 140, multiplier: 1.5, label: '1.5x SAFE ZONE', color: '#38bdf8' },
      { id: 2, x: 300, width: 110, multiplier: 3.0, label: '3.0x GOLD PAD', color: '#facc15' },
      { id: 3, x: 460, width: 80, multiplier: 8.0, label: '8.0x ACE PAD', color: '#f97316' },
      { id: 4, x: 580, width: 55, multiplier: 25.0, label: '25x HYPER PAD', color: '#e879f9' },
      { id: 5, x: 675, width: 40, multiplier: 100.0, label: '100x BULLSEYE 🎯', color: '#ef4444' },
    ];

    jetState.current = {
      x: 60,
      y: 100,
      vx: 3.8 + Math.random() * 1.2,
      vy: 1.2,
      thrust: false,
      altitude: 100,
      pads: padsList,
    };

    setIsPlaying(true);
    setFeedback('🚀 IN FLIGHT! Hold Space / Tap THRUST to lift, align with high multiplier pads!');
  };

  const applyThrust = () => {
    if (!isPlaying) return;
    const s = jetState.current;
    s.vy -= 1.8;
    s.thrust = true;
    playSfx('thrust');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        applyThrust();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let req: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Sky & Runway Surface
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(0.7, '#1e1b4b');
      skyGrad.addColorStop(1, '#020617');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Landing Pads at y = 520
      const groundY = 520;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, groundY + 20, canvas.width, 80);

      const s = jetState.current;

      s.pads.forEach((pad) => {
        ctx.fillStyle = pad.color;
        ctx.shadowColor = pad.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(pad.x, groundY, pad.width, 20);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pad.label, pad.x + pad.width / 2, groundY - 8);
      });

      if (isPlaying) {
        // Apply Gravity
        s.vy += 0.12; // Gravity
        s.x += s.vx;
        s.y += s.vy;

        // Wrap or Bounce X
        if (s.x > canvas.width - 20) {
          s.x = canvas.width - 20;
          s.vx = -Math.abs(s.vx);
        } else if (s.x < 20) {
          s.x = 20;
          s.vx = Math.abs(s.vx);
        }

        // Draw Jet Fighter
        ctx.save();
        ctx.translate(s.x, s.y);
        const angle = Math.atan2(s.vy, s.vx);
        ctx.rotate(angle);

        // Jet Body
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-15, -10);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-15, 10);
        ctx.closePath();
        ctx.fill();

        // Cockpit Glass
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(5, -2, 5, 0, Math.PI * 2);
        ctx.fill();

        // Thruster Flames
        if (s.thrust) {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.lineTo(-28, -6);
          ctx.lineTo(-20, 0);
          ctx.lineTo(-28, 6);
          ctx.closePath();
          ctx.fill();
          s.thrust = false;
        }

        ctx.restore();

        // Touchdown Check
        if (s.y >= groundY - 5) {
          setIsPlaying(false);
          s.y = groundY - 5;

          // Check which pad jet landed on
          const landedPad = s.pads.find((p) => s.x >= p.x && s.x <= p.x + p.width);

          if (landedPad) {
            const win = Math.floor(betAmount * landedPad.multiplier);
            addCoins(win, `Jet Touchdown ${landedPad.multiplier}x`);
            setLastWin(win);
            if (landedPad.multiplier > highScoreMult) setHighScoreMult(landedPad.multiplier);

            if (landedPad.multiplier >= 25) {
              playSfx('jackpot');
              setFeedback(`🎯 PERFECT TOUCHDOWN! ${landedPad.multiplier}x MULTIPLIER! +${win} COINS!`);
            } else {
              playSfx('land');
              setFeedback(`🛬 SUCCESSFUL LANDING! ${landedPad.multiplier}x MULTIPLIER! +${win} COINS!`);
            }
          } else {
            playSfx('crash');
            setLastWin(0);
            setFeedback('💥 CRASHED ON HARD GROUND! Missed the landing pads!');
          }
        }
      }

      req = requestAnimationFrame(render);
    };

    req = requestAnimationFrame(render);
    return () => cancelAnimationFrame(req);
  }, [isPlaying, betAmount, addCoins, highScoreMult]);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl px-4 py-4 text-white mx-auto gap-4">
      {/* Header */}
      <div className="flex w-full justify-between items-center bg-slate-900/90 border border-amber-500/30 p-4 rounded-2xl shadow-xl">
        <div>
          <span className="text-xs font-black text-amber-400 uppercase tracking-widest bg-amber-500/20 px-2.5 py-1 rounded-lg">
            SKILL CASINO GAME
          </span>
          <h2 className="text-2xl font-black text-amber-300 mt-1">Jet Pilot: Precision Lander</h2>
        </div>

        <div className="flex gap-4 text-right">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Best Multiplier</div>
            <div className="text-lg font-black text-emerald-400">{highScoreMult.toFixed(1)}x</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Last Win</div>
            <div className="text-lg font-black text-amber-300">+{lastWin}</div>
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative w-full aspect-[16/9] max-h-[500px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
        <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-cover" />

        {!isPlaying && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10 animate-in fade-in duration-300">
            <h3 className="text-3xl font-black text-amber-300">FLIGHT DECK READY</h3>
            <p className="text-slate-300 text-sm max-w-md text-center">
              Use your timing and skill! Control thrusters to align your supersonic jet onto high-value multiplier landing pads!
            </p>
            <GlassButton onClick={launchJet} className="px-8 py-4 text-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black">
              🛫 LAUNCH JET ({betAmount} COINS)
            </GlassButton>
          </div>
        )}
      </div>

      {/* Controls & Feedback */}
      <div className="flex flex-wrap w-full justify-between items-center gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="text-sm font-bold text-amber-200">{feedback}</div>

        <div className="flex items-center gap-3">
          <GlassButton
            onClick={applyThrust}
            disabled={!isPlaying}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 font-black text-white active:scale-95 text-base"
          >
            🔥 THRUST (SPACEBAR)
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
