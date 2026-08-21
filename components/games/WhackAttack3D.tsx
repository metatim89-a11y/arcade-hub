import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type TargetKind = 'mole' | 'gold' | 'tiny' | 'decoy' | 'civilian';
type MotionKind = 'pop' | 'fakeout' | 'swerve' | 'duck';

type Target = {
  id: number;
  kind: TargetKind;
  hole: number;
  size: number;
  motion: MotionKind;
  bornAt: number;
  lifetime: number;
  runnerLane?: number;
  runnerDirection?: 1 | -1;
};

const ROUND_SECONDS = 45;
const HOLES = 9;
const SCORE_BY_KIND: Record<TargetKind, number> = {
  mole: 100,
  gold: 225,
  tiny: 300,
  decoy: -175,
  civilian: -350,
};

const LABEL_BY_KIND: Record<TargetKind, string> = {
  mole: 'mole',
  gold: 'gold target',
  tiny: 'tiny target',
  decoy: 'red decoy',
  civilian: 'civilian',
};

const WhackAttack3D: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [targets, setTargets] = useState<Target[]>([]);
  const [flash, setFlash] = useState<{ id: number; text: string; good: boolean; x: number; y: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState('Hit moles and special targets. Do NOT hit people or red decoys.');

  const nextIdRef = useRef(1);
  const roundStartRef = useRef(0);
  const spawnTimerRef = useRef<number | null>(null);
  const clockTimerRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const runningRef = useRef(false);
  const targetsRef = useRef<Target[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const audio = useCallback((type: 'pop' | 'hit' | 'bonus' | 'bad' | 'miss' | 'start' | 'end') => {
    if (muted) return;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const config = {
        pop: { f1: 280, f2: 520, duration: 0.07, wave: 'sine' as OscillatorType, volume: 0.05 },
        hit: { f1: 115, f2: 72, duration: 0.09, wave: 'triangle' as OscillatorType, volume: 0.14 },
        bonus: { f1: 620, f2: 980, duration: 0.16, wave: 'square' as OscillatorType, volume: 0.09 },
        bad: { f1: 190, f2: 85, duration: 0.22, wave: 'sawtooth' as OscillatorType, volume: 0.08 },
        miss: { f1: 95, f2: 70, duration: 0.06, wave: 'triangle' as OscillatorType, volume: 0.04 },
        start: { f1: 340, f2: 760, duration: 0.28, wave: 'square' as OscillatorType, volume: 0.07 },
        end: { f1: 440, f2: 120, duration: 0.45, wave: 'sawtooth' as OscillatorType, volume: 0.07 },
      }[type];

      osc.type = config.wave;
      osc.frequency.setValueAtTime(config.f1, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, config.f2), now + config.duration);
      gain.gain.setValueAtTime(config.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
      osc.start(now);
      osc.stop(now + config.duration);
    } catch {
      // Audio is progressive enhancement; gameplay remains functional without it.
    }
  }, [muted]);

  const difficulty = useMemo(() => {
    const elapsed = ROUND_SECONDS - timeLeft;
    return Math.min(1, elapsed / ROUND_SECONDS);
  }, [timeLeft]);

  const chooseKind = useCallback((): TargetKind => {
    const r = Math.random();
    if (r < 0.08) return 'civilian';
    if (r < 0.19) return 'decoy';
    if (r < 0.28) return 'tiny';
    if (r < 0.38) return 'gold';
    return 'mole';
  }, []);

  const spawnTarget = useCallback(() => {
    if (!runningRef.current) return;
    const kind = chooseKind();
    const elapsed = Math.min(1, (performance.now() - roundStartRef.current) / (ROUND_SECONDS * 1000));
    const isRunner = kind === 'civilian' ? Math.random() < 0.74 : Math.random() < 0.12 + elapsed * 0.14;
    const motionPool: MotionKind[] = ['pop', 'fakeout', 'swerve', 'duck'];
    const motion = motionPool[Math.floor(Math.random() * motionPool.length)];
    const baseLifetime = isRunner ? 1650 : 1150 - elapsed * 420;
    const lifetime = Math.max(520, baseLifetime + (Math.random() * 360 - 180));
    const target: Target = {
      id: nextIdRef.current++,
      kind,
      hole: Math.floor(Math.random() * HOLES),
      size: kind === 'tiny' ? 0.58 + Math.random() * 0.12 : 0.82 + Math.random() * 0.46,
      motion,
      bornAt: performance.now(),
      lifetime,
      ...(isRunner ? {
        runnerLane: Math.floor(Math.random() * 3),
        runnerDirection: Math.random() < 0.5 ? -1 as const : 1 as const,
      } : {}),
    };

    setTargets((current) => {
      const next = [...current, target];
      return next.slice(-8);
    });
    audio(kind === 'decoy' ? 'pop' : kind === 'civilian' ? 'miss' : 'pop');

    window.setTimeout(() => {
      setTargets((current) => current.filter((item) => item.id !== target.id));
    }, lifetime);

    const nextDelay = Math.max(240, 650 - elapsed * 280 + Math.random() * 230);
    spawnTimerRef.current = window.setTimeout(spawnTarget, nextDelay);
  }, [audio, chooseKind]);

  const finishRound = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setTargets([]);
    if (spawnTimerRef.current) window.clearTimeout(spawnTimerRef.current);
    if (clockTimerRef.current) window.clearInterval(clockTimerRef.current);
    audio('end');
    setMessage('Round over. Start another run and beat your score.');
  }, [audio]);

  const startRound = useCallback(() => {
    if (spawnTimerRef.current) window.clearTimeout(spawnTimerRef.current);
    if (clockTimerRef.current) window.clearInterval(clockTimerRef.current);
    nextIdRef.current = 1;
    roundStartRef.current = performance.now();
    runningRef.current = true;
    setRunning(true);
    setTimeLeft(ROUND_SECONDS);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setHits(0);
    setMistakes(0);
    setTargets([]);
    setMessage('GO! Targets get faster as the clock runs down.');
    audio('start');

    spawnTimerRef.current = window.setTimeout(spawnTarget, 320);
    clockTimerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - roundStartRef.current) / 1000;
      const left = Math.max(0, Math.ceil(ROUND_SECONDS - elapsed));
      setTimeLeft(left);
      if (left <= 0) finishRound();
    }, 150);
  }, [audio, finishRound, spawnTarget]);

  useEffect(() => () => {
    if (spawnTimerRef.current) window.clearTimeout(spawnTimerRef.current);
    if (clockTimerRef.current) window.clearInterval(clockTimerRef.current);
    void audioRef.current?.close();
  }, []);

  const showFlash = useCallback((text: string, good: boolean, clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(8, Math.min(rect.width - 70, clientX - rect.left));
    const y = Math.max(28, Math.min(rect.height - 20, clientY - rect.top));
    const id = Date.now();
    setFlash({ id, text, good, x, y });
    window.setTimeout(() => setFlash((current) => current?.id === id ? null : current), 500);
  }, []);

  const hitTarget = useCallback((target: Target, event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!runningRef.current) return;
    setTargets((current) => current.filter((item) => item.id !== target.id));

    const delta = SCORE_BY_KIND[target.kind];
    const bad = delta < 0;
    if (bad) {
      setScore((value) => Math.max(0, value + delta));
      setCombo(0);
      setMistakes((value) => value + 1);
      setMessage(target.kind === 'civilian' ? 'CIVILIAN HIT! Watch the runners.' : 'DECOY! Red targets are traps.');
      audio('bad');
      showFlash(String(delta), false, event.clientX, event.clientY);
      return;
    }

    setCombo((value) => {
      const next = value + 1;
      setBestCombo((best) => Math.max(best, next));
      const multiplier = 1 + Math.min(2, Math.floor(next / 5) * 0.25);
      const gained = Math.round(delta * multiplier);
      setScore((valueScore) => valueScore + gained);
      showFlash(`+${gained}${next >= 5 ? ` x${multiplier.toFixed(2)}` : ''}`, true, event.clientX, event.clientY);
      return next;
    });
    setHits((value) => value + 1);
    setMessage(target.kind === 'tiny' ? 'TINY HIT! Big points.' : target.kind === 'gold' ? 'GOLD HIT!' : 'Clean hit!');
    audio(target.kind === 'mole' ? 'hit' : 'bonus');
  }, [audio, showFlash]);

  const missStage = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!runningRef.current || event.target !== event.currentTarget) return;
    setCombo(0);
    audio('miss');
    showFlash('MISS', false, event.clientX, event.clientY);
  }, [audio, showFlash]);

  const holeTargets = targets.filter((target) => target.runnerLane === undefined);
  const runners = targets.filter((target) => target.runnerLane !== undefined);

  return (
    <div className="w-full min-h-[520px] flex flex-col items-center justify-center gap-3 select-none">
      <style>{`
        @keyframes wa-pop { 0%{transform:translateY(72%) scale(.7)} 22%{transform:translateY(-4%) scale(1.04)} 70%{transform:translateY(0) scale(1)} 100%{transform:translateY(75%) scale(.78)} }
        @keyframes wa-fake { 0%{transform:translateY(78%) rotate(-8deg)} 20%{transform:translateY(12%) rotate(7deg)} 36%{transform:translateY(45%) rotate(-5deg)} 53%{transform:translateY(-7%) rotate(6deg)} 100%{transform:translateY(80%) rotate(-7deg)} }
        @keyframes wa-swerve { 0%{transform:translate(-18%,75%) rotate(-12deg)} 26%{transform:translate(12%,-5%) rotate(9deg)} 58%{transform:translate(-10%,2%) rotate(-8deg)} 100%{transform:translate(18%,78%) rotate(12deg)} }
        @keyframes wa-duck { 0%{transform:translateY(80%)} 25%{transform:translateY(-3%)} 48%{transform:translateY(25%)} 63%{transform:translateY(-8%)} 100%{transform:translateY(82%)} }
        @keyframes wa-run-right { from{transform:translateX(-140%) rotateY(0deg)} to{transform:translateX(1240%) rotateY(0deg)} }
        @keyframes wa-run-left { from{transform:translateX(1240%) rotateY(180deg)} to{transform:translateX(-140%) rotateY(180deg)} }
        @keyframes wa-flash { 0%{opacity:0; transform:translate(-50%,8px) scale(.7)} 30%{opacity:1; transform:translate(-50%,-4px) scale(1.15)} 100%{opacity:0; transform:translate(-50%,-34px) scale(.9)} }
        @keyframes wa-pulse { 50%{filter:brightness(1.35); transform:scale(1.02)} }
      `}</style>

      <div className="w-full flex flex-wrap items-center justify-between gap-2 px-2 text-xs sm:text-sm font-black tracking-wide">
        <div className="flex gap-2 sm:gap-3">
          <span className="rounded-xl bg-black/45 border border-amber-300/30 px-3 py-2">SCORE <b className="text-amber-300">{score.toLocaleString()}</b></span>
          <span className="rounded-xl bg-black/45 border border-cyan-300/25 px-3 py-2">COMBO <b className="text-cyan-300">x{combo}</b></span>
        </div>
        <span className={`rounded-xl px-4 py-2 border ${timeLeft <= 10 ? 'bg-red-950/80 border-red-400 text-red-200 animate-pulse' : 'bg-black/45 border-white/15 text-white'}`}>{timeLeft}s</span>
        <button type="button" onClick={() => setMuted((value) => !value)} className="rounded-xl bg-black/45 border border-white/15 px-3 py-2 hover:bg-white/10" aria-pressed={muted}>{muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}</button>
      </div>

      <div
        ref={stageRef}
        onPointerDown={missStage}
        className="relative w-full max-w-[820px] aspect-[16/10] min-h-[380px] overflow-hidden rounded-[30px] border-2 border-amber-300/25 bg-[radial-gradient(circle_at_50%_0%,#374151_0%,#111827_43%,#05070b_100%)] shadow-[inset_0_-30px_80px_rgba(0,0,0,.85),0_22px_60px_rgba(0,0,0,.45)] touch-manipulation"
        style={{ perspective: '900px' }}
        aria-label="Whack Attack 3D play field"
      >
        <div className="absolute inset-x-0 top-0 h-[14%] bg-gradient-to-b from-cyan-400/10 to-transparent pointer-events-none" />
        <div className="absolute left-4 top-4 z-20 rounded-full border border-amber-300/30 bg-black/55 px-3 py-1 text-[10px] font-black tracking-[0.22em] text-amber-200">WHACK ATTACK 3D</div>

        <div className="absolute inset-x-[7%] top-[17%] bottom-[7%] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#283444_0%,#111827_56%,#090b10_100%)] shadow-[inset_0_18px_35px_rgba(255,255,255,.05),inset_0_-28px_45px_rgba(0,0,0,.7)]" style={{ transform: 'rotateX(9deg)', transformOrigin: '50% 100%' }}>
          <div className="grid h-full grid-cols-3 grid-rows-3 gap-x-[7%] gap-y-[5%] p-[7%]">
            {Array.from({ length: HOLES }).map((_, index) => {
              const target = holeTargets.find((item) => item.hole === index);
              return (
                <div key={index} className="relative flex items-end justify-center overflow-hidden rounded-[50%]" style={{ filter: 'drop-shadow(0 10px 8px rgba(0,0,0,.65))' }}>
                  <div className="absolute bottom-[2%] h-[34%] w-[92%] rounded-[50%] border border-black bg-[radial-gradient(ellipse_at_center,#020304_0%,#07090c_54%,#273244_72%,#0a0d12_100%)] shadow-[inset_0_10px_17px_rgba(0,0,0,.95),0_4px_0_rgba(255,255,255,.04)]" />
                  {target && (
                    <button
                      type="button"
                      onPointerDown={(event) => hitTarget(target, event)}
                      className="absolute bottom-[11%] z-10 h-[84%] w-[70%] outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/70"
                      style={{
                        transformOrigin: '50% 100%',
                        animation: `wa-${target.motion} ${target.lifetime}ms cubic-bezier(.2,.8,.22,1) both`,
                      }}
                      aria-label={`${LABEL_BY_KIND[target.kind]} target`}
                    >
                      <div className="relative mx-auto h-full w-full" style={{ transform: `scale(${target.size})`, transformOrigin: '50% 100%' }}>
                        <div className={`absolute inset-x-[10%] bottom-0 top-[14%] rounded-[48%_48%_38%_38%] border-2 shadow-[inset_-12px_-12px_24px_rgba(0,0,0,.35),inset_8px_8px_18px_rgba(255,255,255,.15),0_14px_18px_rgba(0,0,0,.55)] ${
                          target.kind === 'mole' ? 'border-amber-950 bg-gradient-to-br from-amber-500 via-amber-700 to-stone-900' :
                          target.kind === 'gold' ? 'border-yellow-200 bg-gradient-to-br from-yellow-100 via-amber-400 to-orange-700' :
                          target.kind === 'tiny' ? 'border-cyan-200 bg-gradient-to-br from-cyan-200 via-sky-500 to-indigo-800' :
                          target.kind === 'decoy' ? 'border-red-300 bg-gradient-to-br from-red-400 via-red-700 to-black' :
                          'border-slate-200 bg-gradient-to-br from-slate-100 via-blue-300 to-blue-900'
                        }`}>
                          <div className="absolute left-[23%] top-[25%] h-[10%] w-[11%] rounded-full bg-black shadow-[0_0_5px_white]" />
                          <div className="absolute right-[23%] top-[25%] h-[10%] w-[11%] rounded-full bg-black shadow-[0_0_5px_white]" />
                          <div className="absolute left-1/2 top-[46%] h-[12%] w-[28%] -translate-x-1/2 rounded-full bg-black/75" />
                          <div className="absolute left-1/2 top-[66%] -translate-x-1/2 whitespace-nowrap text-[clamp(8px,1.3vw,14px)] font-black tracking-widest text-white drop-shadow-lg">
                            {target.kind === 'gold' ? 'BONUS' : target.kind === 'tiny' ? '300' : target.kind === 'decoy' ? 'NO!' : target.kind === 'civilian' ? 'SAFE' : 'WHACK'}
                          </div>
                        </div>
                        {target.kind === 'decoy' && <div className="absolute left-1/2 top-[4%] -translate-x-1/2 text-2xl sm:text-3xl">⚠️</div>}
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {runners.map((target) => (
          <button
            key={target.id}
            type="button"
            onPointerDown={(event) => hitTarget(target, event)}
            className="absolute left-0 z-30 h-[18%] w-[9%] min-w-[42px] outline-none"
            style={{
              top: `${58 + (target.runnerLane ?? 0) * 9}%`,
              animation: `${target.runnerDirection === 1 ? 'wa-run-right' : 'wa-run-left'} ${target.lifetime}ms linear both`,
            }}
            aria-label={`${LABEL_BY_KIND[target.kind]} crossing the screen`}
          >
            <div className={`relative h-full w-full ${target.kind === 'civilian' ? '' : 'animate-pulse'}`} style={{ transform: `scale(${target.size})` }}>
              <div className={`absolute left-1/2 top-0 h-[34%] aspect-square -translate-x-1/2 rounded-full border-2 ${target.kind === 'civilian' ? 'border-orange-100 bg-orange-200' : 'border-red-200 bg-red-500'}`} />
              <div className={`absolute left-1/2 top-[29%] h-[52%] w-[46%] -translate-x-1/2 rounded-t-xl ${target.kind === 'civilian' ? 'bg-blue-500' : 'bg-red-700'}`} />
              <div className="absolute bottom-0 left-[27%] h-[33%] w-[14%] -rotate-[16deg] rounded-full bg-slate-200" />
              <div className="absolute bottom-0 right-[27%] h-[33%] w-[14%] rotate-[16deg] rounded-full bg-slate-200" />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-black text-white">{target.kind === 'civilian' ? 'DON’T HIT' : 'DECOY'}</div>
            </div>
          </button>
        ))}

        {flash && (
          <div className={`pointer-events-none absolute z-50 text-lg sm:text-2xl font-black ${flash.good ? 'text-lime-300' : 'text-red-300'}`} style={{ left: flash.x, top: flash.y, animation: 'wa-flash 500ms ease-out forwards', textShadow: '0 2px 8px #000' }}>
            {flash.text}
          </div>
        )}

        {!running && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/65 p-6 text-center backdrop-blur-[2px]">
            <div className="text-4xl sm:text-6xl drop-shadow-[0_0_20px_rgba(251,191,36,.35)]">🔨</div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-amber-300">WHACK ATTACK 3D</h2>
            <p className="max-w-xl text-xs sm:text-sm font-semibold text-slate-200">Whack moles, gold targets and tiny targets. Avoid red decoys and people running across the cabinet. Targets can fake-pop, duck, swerve and change size.</p>
            <button type="button" onClick={startRound} className="rounded-2xl border border-amber-200/50 bg-gradient-to-b from-amber-300 to-orange-500 px-8 py-3 text-sm sm:text-base font-black text-slate-950 shadow-[0_0_28px_rgba(251,191,36,.35)] active:translate-y-0.5">START 45 SECOND ATTACK</button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[820px] grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs font-bold text-slate-300">
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">HITS <b className="block text-base text-lime-300">{hits}</b></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">BEST COMBO <b className="block text-base text-cyan-300">x{bestCombo}</b></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">BAD HITS <b className="block text-base text-red-300">{mistakes}</b></div>
      </div>
      <p className="min-h-5 px-3 text-center text-[11px] sm:text-xs font-bold text-amber-100/80">{message}</p>
      <div className="flex flex-wrap justify-center gap-2 text-[9px] sm:text-[10px] font-black tracking-wide">
        <span className="rounded-full bg-amber-500/15 border border-amber-400/25 px-3 py-1 text-amber-200">MOLE +100</span>
        <span className="rounded-full bg-yellow-400/15 border border-yellow-300/25 px-3 py-1 text-yellow-200">GOLD +225</span>
        <span className="rounded-full bg-cyan-400/15 border border-cyan-300/25 px-3 py-1 text-cyan-200">TINY +300</span>
        <span className="rounded-full bg-red-500/15 border border-red-400/25 px-3 py-1 text-red-200">DECOY -175</span>
        <span className="rounded-full bg-red-500/15 border border-red-400/25 px-3 py-1 text-red-200">CIVILIAN -350</span>
      </div>
    </div>
  );
};

export default WhackAttack3D;
