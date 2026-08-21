import React, { useEffect, useRef, useState } from 'react';
import GlassButton from '../ui/GlassButton';
import { PlayMode } from '../../types';

interface KongClimberProps {
  playMode: PlayMode;
  playerNames: { player1: string; player2: string };
}

export default function KongClimberGame({ playMode, playerNames }: KongClimberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('kong_climber_highscore') || 0));
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSfx = (type: 'jump' | 'score' | 'climb' | 'win' | 'splat') => {
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

      if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'score') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'climb') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(783, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'splat') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {}
  };

  const gameState = useRef({
    px: 60,
    py: 526,
    vx: 0,
    vy: 0,
    isGrounded: true,
    isClimbing: false,
    barrels: [] as any[],
    particles: [] as any[],
    spawnTimer: 0,
    lastTime: performance.now(),
    keys: { left: false, right: false, up: false, down: false },
    touchLeft: false,
    touchRight: false,
    touchUp: false,
    touchDown: false,
  });

  const GIRDERS = [
    { y: 540, x1: 20, x2: 780 },
    { y: 430, x1: 40, x2: 740 },
    { y: 320, x1: 60, x2: 720 },
    { y: 210, x1: 80, x2: 700 },
    { y: 100, x1: 200, x2: 500 },
  ];

  const LADDERS = [
    { x: 680, y1: 430, y2: 540 },
    { x: 120, y1: 320, y2: 430 },
    { x: 620, y1: 210, y2: 320 },
    { x: 260, y1: 100, y2: 210 },
  ];

  const initGame = () => {
    setScore(0);
    setGameOver(false);
    setHasWon(false);

    gameState.current = {
      px: 60,
      py: 526,
      vx: 0,
      vy: 0,
      isGrounded: true,
      isClimbing: false,
      barrels: [],
      particles: [],
      spawnTimer: 0,
      lastTime: performance.now(),
      keys: { left: false, right: false, up: false, down: false },
      touchLeft: false,
      touchRight: false,
      touchUp: false,
      touchDown: false,
    };
  };

  const doJump = () => {
    const s = gameState.current;
    if (s.isGrounded || s.isClimbing) {
      s.isClimbing = false;
      s.vy = -10.5;
      s.isGrounded = false;
      playSfx('jump');
    }
  };

  useEffect(() => {
    initGame();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === ' ' || k === 'k' || k === 'j') {
        e.preventDefault();
        doJump();
      } else if (e.key === 'ArrowLeft' || k === 'a') {
        gameState.current.keys.left = true;
      } else if (e.key === 'ArrowRight' || k === 'd') {
        gameState.current.keys.right = true;
      } else if (e.key === 'ArrowUp' || k === 'w') {
        gameState.current.keys.up = true;
      } else if (e.key === 'ArrowDown' || k === 's') {
        gameState.current.keys.down = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowLeft' || k === 'a') {
        gameState.current.keys.left = false;
      } else if (e.key === 'ArrowRight' || k === 'd') {
        gameState.current.keys.right = false;
      } else if (e.key === 'ArrowUp' || k === 'w') {
        gameState.current.keys.up = false;
      } else if (e.key === 'ArrowDown' || k === 's') {
        gameState.current.keys.down = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;

    let req: number;
    const draw = (time: number) => {
      const s = gameState.current;
      const dt = Math.min(0.05, (time - s.lastTime) / 1000);
      s.lastTime = time;

      ctx.clearRect(0, 0, cvs.width, cvs.height);

      if (!gameOver && !hasWon) {
        const wantsLeft = s.keys.left || s.touchLeft;
        const wantsRight = s.keys.right || s.touchRight;
        const wantsUp = s.keys.up || s.touchUp;
        const wantsDown = s.keys.down || s.touchDown;

        // Ladder Check
        const nearLadder = LADDERS.find(
          (l) => Math.abs(s.px - l.x) < 28 && s.py >= l.y1 - 20 && s.py <= l.y2 + 20
        );

        if (!s.isClimbing) {
          if (wantsUp && nearLadder) {
            s.isClimbing = true;
            s.px = nearLadder.x;
            s.vy = 0;
            s.py -= 3.5;
            playSfx('climb');
          } else if (wantsDown && nearLadder) {
            s.isClimbing = true;
            s.px = nearLadder.x;
            s.vy = 0;
            s.py += 3.5;
            playSfx('climb');
          } else {
            // Horizontal movement
            if (wantsLeft) s.vx = -4.5;
            else if (wantsRight) s.vx = 4.5;
            else s.vx *= 0.75;

            // Apply physics
            s.px += s.vx;
            s.px = Math.max(20, Math.min(780, s.px));
            s.vy += 0.55; // Gravity
            s.py += s.vy;

            // Check Girder Collisions
            s.isGrounded = false;
            GIRDERS.forEach((g) => {
              if (
                s.px >= g.x1 - 10 &&
                s.px <= g.x2 + 10 &&
                s.py + 14 >= g.y - 8 &&
                s.py + 14 <= g.y + 16 &&
                s.vy >= 0
              ) {
                s.py = g.y - 14;
                s.vy = 0;
                s.isGrounded = true;
              }
            });
          }
        } else {
          // Player is climbing
          s.vx = 0;
          s.vy = 0;

          if (wantsUp) {
            s.py -= 3.5;
          } else if (wantsDown) {
            s.py += 3.5;
          }

          if (nearLadder) {
            if (s.py <= nearLadder.y1 - 14) {
              s.py = nearLadder.y1 - 14;
              s.isClimbing = false;
              s.isGrounded = true;
            } else if (s.py >= nearLadder.y2 - 14) {
              s.py = nearLadder.y2 - 14;
              s.isClimbing = false;
              s.isGrounded = true;
            }
          } else {
            s.isClimbing = false;
          }

          if (wantsLeft || wantsRight) {
            s.isClimbing = false;
          }
        }

        s.spawnTimer += dt;
        if (s.spawnTimer > 2.2) {
          s.spawnTimer = 0;
          s.barrels.push({ x: 220, y: 85, vx: 2.8, vy: 0, scored: false });
        }

        // Update Barrels
        s.barrels.forEach((b) => {
          b.x += b.vx;
          b.vy += 0.4;
          b.y += b.vy;

          // Girder floor for barrels
          GIRDERS.forEach((g) => {
            if (
              b.x >= g.x1 &&
              b.x <= g.x2 &&
              b.y + 12 >= g.y - 8 &&
              b.y + 12 <= g.y + 12 &&
              b.vy >= 0
            ) {
              b.y = g.y - 12;
              b.vy = 0;
            }
          });

          // Bounce off screen edges
          if (b.x > 760 && b.vx > 0) b.vx = -b.vx;
          if (b.x < 40 && b.vx < 0) b.vx = -b.vx;

          // Check Player Collision & Jumping over barrel
          const dist = Math.hypot(s.px - b.x, s.py - b.y);
          if (dist < 22) {
            playSfx('splat');
            setGameOver(true);
          } else if (Math.abs(s.px - b.x) < 18 && s.py < b.y - 15 && !b.scored) {
            b.scored = true;
            playSfx('score');
            setScore((scr) => {
              const newScore = scr + 100;
              if (newScore > highScore) {
                setHighScore(newScore);
                localStorage.setItem('kong_climber_highscore', String(newScore));
              }
              return newScore;
            });
          }
        });

        if (s.py <= 100 && s.px >= 300 && s.px <= 400) {
          playSfx('win');
          setHasWon(true);
          setScore((scr) => {
            const newScore = scr + 1000;
            if (newScore > highScore) {
              setHighScore(newScore);
              localStorage.setItem('kong_climber_highscore', String(newScore));
            }
            return newScore;
          });
        }
      }

      // Draw Girders (Steel Blue Platforms)
      GIRDERS.forEach((g) => {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 8;
        ctx.fillRect(g.x1, g.y, g.x2 - g.x1, 12);
        ctx.shadowBlur = 0;
      });

      // Draw Ladders (Yellow Rungs)
      LADDERS.forEach((l) => {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(l.x - 10, l.y1);
        ctx.lineTo(l.x - 10, l.y2);
        ctx.moveTo(l.x + 10, l.y1);
        ctx.lineTo(l.x + 10, l.y2);
        ctx.stroke();
        for (let y = l.y1 + 10; y < l.y2; y += 15) {
          ctx.beginPath();
          ctx.moveTo(l.x - 10, y);
          ctx.lineTo(l.x + 10, y);
          ctx.stroke();
        }
      });

      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#fb7185';
      ctx.shadowBlur = 15;
      ctx.font = '28px sans-serif';
      ctx.fillText('👸🏼', 340, 95);
      ctx.shadowBlur = 0;

      // Draw Barrels
      s.barrels.forEach((b) => {
        ctx.fillStyle = '#f97316';
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(b.x - 6, b.y - 3, 12, 6);
        ctx.shadowBlur = 0;
      });

      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(s.px, s.py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      req = requestAnimationFrame(draw);
    };

    req = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(req);
  }, [hasWon, gameOver]);

  const holdProps = (action: 'left' | 'right' | 'up' | 'down') => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      triggerAction(action);
    },
    onPointerUp: () => releaseAction(action),
    onPointerCancel: () => releaseAction(action),
    onPointerLeave: () => releaseAction(action),
  });

  return (
    <div className="flex w-full flex-col items-center gap-4 text-white select-none">
      <div className="flex w-full max-w-xl justify-between items-center px-2">
        <h2 className="text-2xl sm:text-3xl font-black text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.5)]">
          Kong Climber
        </h2>
        <div className="flex gap-2">
          <div className="text-xs sm:text-sm font-bold bg-slate-800/80 px-3 py-1.5 rounded-xl text-yellow-300">
            Score: {score}
          </div>
          <div className="text-xs sm:text-sm font-bold bg-slate-800/80 px-3 py-1.5 rounded-xl text-amber-400">
            High: {highScore}
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-xl aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)] bg-slate-950 border border-slate-700 touch-none">
        <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-cover" />

        {gameOver && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col animate-in fade-in duration-300 z-20">
            <h3 className="text-3xl sm:text-4xl font-black text-red-500 mb-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse">
              BARREL SMASH!
            </h3>
            <p className="text-slate-300 font-bold mb-6">Final Score: {score}</p>
            <GlassButton onClick={initGame} className="px-8 py-4 text-xl">
              TRY AGAIN
            </GlassButton>
          </div>
        )}

        {hasWon && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col animate-in fade-in duration-300 z-20">
            <h3 className="text-3xl sm:text-4xl font-black text-amber-300 mb-2 drop-shadow-[0_0_15px_rgba(252,211,77,0.6)] animate-pulse">
              RESCUED! 🎉
            </h3>
            <p className="text-slate-300 font-bold mb-6">Bonus +1000! Final Score: {score}</p>
            <GlassButton onClick={initGame} className="px-8 py-4 text-xl">
              PLAY AGAIN
            </GlassButton>
          </div>
        )}
      </div>

      {/* Modern Mobile Arcade Controller Layout */}
      <div className="flex w-full max-w-xl justify-between items-center px-2 mt-1 gap-3 touch-none">
        {/* Directional Pad */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-700/80 shadow-xl">
          <div />
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              const s = gameState.current;
              s.touchUp = true;
              const nearLadder = LADDERS.find(
                (l) => Math.abs(s.px - l.x) < 28 && s.py >= l.y1 - 20 && s.py <= l.y2 + 20
              );
              if (!nearLadder && s.isGrounded && !s.isClimbing) {
                doJump();
              }
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              gameState.current.touchUp = false;
            }}
            onPointerCancel={() => {
              gameState.current.touchUp = false;
            }}
            onPointerLeave={() => {
              gameState.current.touchUp = false;
            }}
            className="w-13 h-12 sm:w-14 sm:h-13 bg-slate-800 active:bg-amber-500 rounded-xl border border-slate-600 flex items-center justify-center text-xl font-black text-yellow-300 shadow-md active:scale-95 transition-all"
            aria-label="Climb Up"
          >
            ▲
          </button>
          <div />

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              gameState.current.touchLeft = true;
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              gameState.current.touchLeft = false;
            }}
            onPointerCancel={() => {
              gameState.current.touchLeft = false;
            }}
            onPointerLeave={() => {
              gameState.current.touchLeft = false;
            }}
            className="w-13 h-12 sm:w-14 sm:h-13 bg-slate-800 active:bg-amber-500 rounded-xl border border-slate-600 flex items-center justify-center text-xl font-black text-yellow-300 shadow-md active:scale-95 transition-all"
            aria-label="Move Left"
          >
            ◀
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              gameState.current.touchDown = true;
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              gameState.current.touchDown = false;
            }}
            onPointerCancel={() => {
              gameState.current.touchDown = false;
            }}
            onPointerLeave={() => {
              gameState.current.touchDown = false;
            }}
            className="w-13 h-12 sm:w-14 sm:h-13 bg-slate-800 active:bg-amber-500 rounded-xl border border-slate-600 flex items-center justify-center text-xl font-black text-yellow-300 shadow-md active:scale-95 transition-all"
            aria-label="Climb Down"
          >
            ▼
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              gameState.current.touchRight = true;
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              gameState.current.touchRight = false;
            }}
            onPointerCancel={() => {
              gameState.current.touchRight = false;
            }}
            onPointerLeave={() => {
              gameState.current.touchRight = false;
            }}
            className="w-13 h-12 sm:w-14 sm:h-13 bg-slate-800 active:bg-amber-500 rounded-xl border border-slate-600 flex items-center justify-center text-xl font-black text-yellow-300 shadow-md active:scale-95 transition-all"
            aria-label="Move Right"
          >
            ▶
          </button>
        </div>

        {/* Action Jump Button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            doJump();
          }}
          className="h-28 w-28 sm:w-32 bg-gradient-to-br from-amber-500 via-purple-600 to-indigo-600 active:scale-95 rounded-2xl border-2 border-amber-300 flex flex-col items-center justify-center text-lg font-black text-white shadow-xl active:brightness-125 transition-all"
          aria-label="Jump"
        >
          <span className="text-2xl mb-1">🦘</span>
          <span>JUMP</span>
        </button>
      </div>

      <p className="text-slate-400 text-xs max-w-lg text-center mt-1 px-2">
        A/D or ◀/▶ to run • W/S or ▲/▼ to climb ladders • SPACE or 🦘 JUMP to leap over barrels!
      </p>
    </div>
  );
}