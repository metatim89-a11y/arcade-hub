import React, { useEffect, useRef, useState } from 'react';
import GlassButton from '../ui/GlassButton';
import { PlayMode } from '../../types';

export default function NeonHopperGame({ playMode, playerNames }: { playMode: PlayMode; playerNames: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem('neon_hopper_highscore') || 0);
  });
  const [gameOver, setGameOver] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = (type: 'hop' | 'score' | 'splat') => {
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
      if (type === 'hop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'score') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.08);
        osc.frequency.setValueAtTime(783, now + 0.16);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'splat') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      // Audio playback fallback
    }
  };

  const gameState = useRef({
    x: 5, y: 11,
    lanes: [] as any[],
    particles: [] as any[],
    lastTime: 0,
    dead: false,
    furthest: 11,
  });

  const COLS = 11;
  const ROWS = 12;

  const initGame = () => {
    setScore(0);
    setGameOver(false);
    
    const lanes = [];
    for (let i = 0; i < ROWS; i++) {
      if (i === 0 || i === ROWS - 1 || i === Math.floor(ROWS/2)) {
        lanes.push({ type: 'safe', entities: [] });
      } else {
        const speed = (Math.random() * 2 + 1.5) * (Math.random() < 0.5 ? 1 : -1);
        const isWater = i < ROWS / 2;
        const entities = [];
        const numEntities = Math.floor(Math.random() * 2) + 2;
        for (let j = 0; j < numEntities; j++) {
            entities.push({ x: (12 / numEntities) * j, w: isWater ? 2.5 : 1 });
        }
        lanes.push({ type: isWater ? 'water' : 'road', speed, entities });
      }
    }
    
    gameState.current = {
      x: 5, y: ROWS - 1,
      lanes,
      particles: [],
      lastTime: performance.now(),
      dead: false,
      furthest: ROWS - 1,
    };
  };

  const act = (dx: number, dy: number) => {
    const s = gameState.current;
    if (s.dead) return;
    let nx = s.x + dx;
    let ny = s.y + dy;
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
        s.x = nx;
        s.y = ny;
        playSound('hop');

        // Add hop particles
        for (let i = 0; i < 6; i++) {
          s.particles.push({
            x: s.x + 0.5, y: s.y + 0.5,
            vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
            life: 0.3, maxLife: 0.3, color: '#fde68a'
          });
        }

        if (ny < s.furthest) {
            s.furthest = ny;
            setScore(scr => {
              const newScore = scr + 10;
              if (newScore > highScore) {
                setHighScore(newScore);
                localStorage.setItem('neon_hopper_highscore', String(newScore));
              }
              return newScore;
            });
        }
        if (ny === 0) {
            playSound('score');
            setScore(scr => {
              const newScore = scr + 100;
              if (newScore > highScore) {
                setHighScore(newScore);
                localStorage.setItem('neon_hopper_highscore', String(newScore));
              }
              return newScore;
            });
            s.y = ROWS - 1;
            s.x = 5;
            s.furthest = ROWS - 1;
            s.lanes.forEach(l => { if (l.speed) l.speed *= 1.2; });
        }
    }
  };

  useEffect(() => { initGame(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') act(0, -1);
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') act(0, 1);
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') act(-1, 0);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') act(1, 0);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [highScore]);

  useEffect(() => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;
    
    let req: number;
    const draw = (time: number) => {
      const s = gameState.current;
      const dt = (time - s.lastTime) / 1000;
      s.lastTime = time;
      
      const width = cvs.width;
      const height = cvs.height;
      const cw = width / COLS;
      const ch = height / ROWS;

      ctx.clearRect(0, 0, width, height);

      if (!s.dead) {
          s.lanes.forEach((lane) => {
            if (!lane.speed) return;
            lane.entities.forEach((ent: any) => {
                ent.x += lane.speed * dt;
                if (lane.speed > 0 && ent.x > COLS) ent.x = -ent.w;
                if (lane.speed < 0 && ent.x < -ent.w) ent.x = COLS;
            });
          });

          const currentLane = s.lanes[s.y];
          if (currentLane.type === 'road') {
              for (const ent of currentLane.entities) {
                  if (s.x < ent.x + ent.w - 0.2 && s.x + 1 > ent.x + 0.2) {
                      s.dead = true;
                      playSound('splat');
                      setGameOver(true);
                  }
              }
          } else if (currentLane.type === 'water') {
              let onLog = false;
              for (const ent of currentLane.entities) {
                  if (s.x < ent.x + ent.w - 0.2 && s.x + 1 > ent.x + 0.2) {
                      onLog = true;
                      s.x += currentLane.speed * dt;
                  }
              }
              if (!onLog || s.x < 0 || s.x > COLS - 1) {
                  s.dead = true;
                  playSound('splat');
                  setGameOver(true);
              }
          }
      }

      // Draw Lanes
      s.lanes.forEach((lane, i) => {
          ctx.fillStyle = lane.type === 'safe' ? '#0f172a' : lane.type === 'water' ? '#082f49' : '#020617';
          ctx.fillRect(0, i * ch, width, ch);
          if (lane.type === 'road') {
              ctx.strokeStyle = '#334155'; ctx.setLineDash([15, 15]);
              ctx.beginPath(); ctx.moveTo(0, i * ch); ctx.lineTo(width, i * ch); ctx.stroke();
          }
      });
      ctx.setLineDash([]);

      // Draw Entities
      s.lanes.forEach((lane, i) => {
          lane.entities.forEach((ent: any) => {
              if (lane.type === 'road') {
                  ctx.fillStyle = lane.speed > 0 ? '#ef4444' : '#0ea5e9';
                  ctx.shadowColor = lane.speed > 0 ? '#f87171' : '#38bdf8';
                  ctx.shadowBlur = 10;
                  ctx.fillRect(ent.x * cw + 4, i * ch + 4, ent.w * cw - 8, ch - 8);
                  ctx.shadowBlur = 0;
              } else {
                  ctx.fillStyle = '#22c55e';
                  ctx.shadowColor = '#4ade80';
                  ctx.shadowBlur = 10;
                  ctx.fillRect(ent.x * cw, i * ch + 2, ent.w * cw, ch - 4);
                  ctx.shadowBlur = 0;
              }
          });
      });

      // Draw Particles
      s.particles = s.particles.filter(p => p.life > 0);
      s.particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(p.x * cw, p.y * ch, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Draw Player
      ctx.fillStyle = s.dead ? '#ef4444' : '#fcd34d';
      ctx.shadowColor = s.dead ? '#f87171' : '#fde68a';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(s.x * cw + cw/2, s.y * ch + ch/2, Math.min(cw, ch) / 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      req = requestAnimationFrame(draw);
    };
    req = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(req);
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-4 text-white">
      <div className="flex w-full max-w-xl justify-between items-center px-4">
        <h2 className="text-3xl font-black text-green-300 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">Neon Hopper</h2>
        <div className="flex gap-3">
          <div className="text-sm font-bold bg-slate-800/80 px-3 py-1.5 rounded-xl text-yellow-300">Score: {score}</div>
          <div className="text-sm font-bold bg-slate-800/80 px-3 py-1.5 rounded-xl text-amber-400">High: {highScore}</div>
        </div>
      </div>

      <div className="relative w-full max-w-xl aspect-square sm:aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(34,197,94,0.15)] bg-slate-950 border border-slate-700">
        <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-cover" />
        {gameOver && (
            <div className="absolute inset-0 bg-black/75 flex items-center justify-center flex-col animate-in fade-in duration-300 z-20">
                <h3 className="text-4xl font-black text-red-500 mb-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse">SPLAT!</h3>
                <p className="text-slate-300 font-bold mb-6">Final Score: {score}</p>
                <GlassButton onClick={initGame} className="px-8 py-4 text-xl">PLAY AGAIN</GlassButton>
            </div>
        )}
      </div>

      {/* On-Screen Touch D-Pad for Mobile */}
      <div className="flex flex-col items-center gap-2 mt-2 sm:hidden">
        <button
          type="button"
          onClick={() => act(0, -1)}
          className="w-16 h-12 bg-slate-800 active:bg-amber-500 rounded-xl border border-slate-600 flex items-center justify-center text-xl font-bold text-yellow-300 shadow-lg"
        >
          ▲
        </button>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => act(-1, 0)}
            className="w-16 h-12 bg-slate-800 active:bg-amber-500 rounded-xl border border-slate-600 flex items-center justify-center text-xl font-bold text-yellow-300 shadow-lg"
          >
            ◄
          </button>
          <button
            type="button"
            onClick={() => act(0, 1)}
            className="w-16 h-12 bg-slate-800 active:bg-amber-500 rounded-xl border border-slate-600 flex items-center justify-center text-xl font-bold text-yellow-300 shadow-lg"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => act(1, 0)}
            className="w-16 h-12 bg-slate-800 active:bg-amber-500 rounded-xl border border-slate-600 flex items-center justify-center text-xl font-bold text-yellow-300 shadow-lg"
          >
            ►
          </button>
        </div>
      </div>

      <p className="text-slate-400 text-xs max-w-lg text-center mt-1 hidden sm:block">Use W/A/S/D or Arrow Keys to hop across the road and the river. Look both ways!</p>
    </div>
  );
}
