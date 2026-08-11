import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyMode } from '../../types';
import { useCoinSystem } from '../../context/CoinContext';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 675;
const CANNON_X = CANVAS_WIDTH / 2;
const CANNON_Y = CANVAS_HEIGHT - 38;
const BULLET_SPEED = 920;
const MAX_FISH = 18;
const DEFAULT_BET = 10;

type FishDefinition = {
  emoji: string;
  hp: number;
  multiplier: number;
  speed: number;
  radius: number;
  weight: number;
  color: string;
};

type Fish = FishDefinition & {
  id: number;
  x: number;
  y: number;
  vx: number;
  phase: number;
  currentHp: number;
};

type Bullet = {
  id: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  damage: number;
  cost: number;
  currency: CurrencyMode;
  targetId: number | null;
};

type WinEffect = { id: number; x: number; y: number; text: string; age: number };

const FISH_DEFINITIONS: Record<string, FishDefinition> = {
  jelly:  { emoji: '🪼', hp: 1,  multiplier: 0.8, speed: 82,  radius: 24,  weight: 15, color: '#c98cff' },
  shrimp: { emoji: '🦐', hp: 1,  multiplier: 1.0, speed: 142, radius: 20,  weight: 14, color: '#ff8f86' },
  crab:   { emoji: '🦀', hp: 2,  multiplier: 1.4, speed: 64,  radius: 28,  weight: 13, color: '#ff5c56' },
  guppy:  { emoji: '🐠', hp: 2,  multiplier: 1.8, speed: 126, radius: 32,  weight: 14, color: '#4ed4ff' },
  fish:   { emoji: '🐟', hp: 3,  multiplier: 2.4, speed: 112, radius: 34,  weight: 13, color: '#78a8d2' },
  puffer: { emoji: '🐡', hp: 4,  multiplier: 3.2, speed: 86,  radius: 39,  weight: 10, color: '#ffc247' },
  squid:  { emoji: '🦑', hp: 6,  multiplier: 5.0, speed: 118, radius: 45,  weight: 8,  color: '#ffb3d0' },
  turtle: { emoji: '🐢', hp: 10, multiplier: 8.0, speed: 58,  radius: 56,  weight: 6,  color: '#75e59b' },
  shark:  { emoji: '🦈', hp: 18, multiplier: 15,  speed: 104, radius: 82,  weight: 4,  color: '#b7c4d0' },
  whale:  { emoji: '🐋', hp: 28, multiplier: 28,  speed: 42,  radius: 108, weight: 2,  color: '#7588df' },
  gold:   { emoji: '🌟', hp: 12, multiplier: 22,  speed: 168, radius: 45,  weight: 2,  color: '#ffd84d' }
};

const chooseFishDefinition = () => {
  const entries = Object.values(FISH_DEFINITIONS);
  const totalWeight = entries.reduce((total, fish) => total + fish.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const fish of entries) {
    roll -= fish.weight;
    if (roll <= 0) return fish;
  }
  return entries[0];
};

const distanceToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(px - x1, py - y1);
  const progress = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + progress * dx), py - (y1 + progress * dy));
};

const OceanHunterGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode, funCoins, realCoins, isProcessing } = useCoinSystem();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<Fish[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const effectsRef = useRef<WinEffect[]>([]);
  const bubblesRef = useRef<{ x: number; y: number; radius: number; speed: number }[]>([]);
  const aimRef = useRef({ x: CANNON_X, y: 120 });
  const autoRef = useRef(false);
  const lockRef = useRef(false);
  const targetRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const shotPendingRef = useRef(false);
  const lastShotRef = useRef(0);
  const nextIdRef = useRef(1);
  const betRef = useRef(DEFAULT_BET);
  const currencyRef = useRef(currencyMode);
  const canBetRef = useRef(canBet);
  const subtractCoinsRef = useRef(subtractCoins);
  const addCoinsRef = useRef(addCoins);
  const requestShotRef = useRef<(targetId?: number | null) => Promise<void>>(async () => {});

  const [betAmount, setBetAmount] = useState(DEFAULT_BET);
  const [isAuto, setIsAuto] = useState(false);
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [lockedTargetId, setLockedTargetId] = useState<number | null>(null);
  const [fishCount, setFishCount] = useState(0);
  const [status, setStatus] = useState('Aim at the ocean and tap to fire.');
  const [lastWin, setLastWin] = useState(0);

  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
  const balance = currencyMode === 'fun' ? funCoins : realCoins;

  useEffect(() => { betRef.current = betAmount; }, [betAmount]);
  useEffect(() => { currencyRef.current = currencyMode; }, [currencyMode]);
  useEffect(() => { canBetRef.current = canBet; }, [canBet]);
  useEffect(() => { subtractCoinsRef.current = subtractCoins; }, [subtractCoins]);
  useEffect(() => { addCoinsRef.current = addCoins; }, [addCoins]);
  useEffect(() => { autoRef.current = isAuto; }, [isAuto]);
  useEffect(() => { lockRef.current = isLockEnabled; }, [isLockEnabled]);
  useEffect(() => { targetRef.current = lockedTargetId; }, [lockedTargetId]);

  const spawnFish = useCallback((initial = false) => {
    const definition = chooseFishDefinition();
    const fromLeft = Math.random() > 0.5;
    const radius = definition.radius;
    const fish: Fish = {
      ...definition,
      id: nextIdRef.current++,
      x: initial ? 80 + Math.random() * (CANVAS_WIDTH - 160) : fromLeft ? -radius - 10 : CANVAS_WIDTH + radius + 10,
      y: 75 + Math.random() * (CANVAS_HEIGHT - 235),
      vx: (fromLeft ? 1 : -1) * definition.speed,
      phase: Math.random() * Math.PI * 2,
      currentHp: definition.hp
    };
    fishRef.current.push(fish);
  }, []);

  const resetOcean = useCallback(() => {
    fishRef.current = [];
    bulletsRef.current = [];
    effectsRef.current = [];
    for (let index = 0; index < 10; index += 1) spawnFish(true);
    targetRef.current = null;
    setLockedTargetId(null);
    setFishCount(fishRef.current.length);
    setLastWin(0);
    setStatus('Ocean reset. Aim and tap to fire.');
  }, [spawnFish]);

  const requestShot = useCallback(async (targetId?: number | null) => {
    const now = performance.now();
    if (shotPendingRef.current || now - lastShotRef.current < 190) return;
    const cost = betRef.current;
    if (!canBetRef.current(cost)) {
      setStatus(`You need ${cost} ${currencyRef.current === 'fun' ? 'FC' : 'RC'} to fire.`);
      autoRef.current = false;
      setIsAuto(false);
      return;
    }

    shotPendingRef.current = true;
    const shotCurrency = currencyRef.current;
    const charged = await subtractCoinsRef.current(cost, 'Ocean Hunter Shot', shotCurrency);
    shotPendingRef.current = false;
    if (!mountedRef.current) return;
    if (!charged) {
      setStatus(shotCurrency === 'real' ? 'Real Coin service is unavailable.' : 'Shot was not charged.');
      setIsAuto(false);
      return;
    }

    const selectedTarget = targetId ?? targetRef.current;
    const target = selectedTarget ? fishRef.current.find((fish) => fish.id === selectedTarget) : null;
    const destination = target || aimRef.current;
    const angle = Math.atan2(destination.y - CANNON_Y, destination.x - CANNON_X);
    const muzzleX = CANNON_X + Math.cos(angle) * 62;
    const muzzleY = CANNON_Y + Math.sin(angle) * 62;
    bulletsRef.current.push({
      id: nextIdRef.current++,
      x: muzzleX,
      y: muzzleY,
      previousX: muzzleX,
      previousY: muzzleY,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      damage: Math.max(1, Math.round(cost / DEFAULT_BET)),
      cost,
      currency: shotCurrency,
      targetId: target?.id || null
    });
    lastShotRef.current = performance.now();
    setStatus(target ? `Tracking ${target.emoji}` : 'Torpedo fired.');
  }, []);

  useEffect(() => { requestShotRef.current = requestShot; }, [requestShot]);

  useEffect(() => {
    mountedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    bubblesRef.current = Array.from({ length: 36 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      radius: 2 + Math.random() * 5,
      speed: 14 + Math.random() * 30
    }));
    for (let index = 0; index < 10; index += 1) spawnFish(true);
    setFishCount(fishRef.current.length);

    let animationFrame = 0;
    let previousTime = performance.now();
    let lastSpawn = previousTime;
    let lastAutoShot = previousTime;
    let lastCountUpdate = previousTime;

    const awardFish = async (fish: Fish, bullet: Bullet) => {
      const reward = Math.max(1, Math.round(fish.multiplier * bullet.cost));
      const credited = await addCoinsRef.current(reward, 'Ocean Hunter Catch', bullet.currency);
      if (!mountedRef.current) return;
      if (credited) {
        setLastWin(reward);
        setStatus(`Caught ${fish.emoji} — won ${reward} ${bullet.currency === 'fun' ? 'FC' : 'RC'}!`);
        effectsRef.current.push({ id: nextIdRef.current++, x: fish.x, y: fish.y, text: `+${reward}`, age: 0 });
      } else {
        setStatus('Target caught, but the payout was not confirmed.');
        setIsAuto(false);
      }
    };

    const drawOcean = (time: number) => {
      const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#087aa0');
      gradient.addColorStop(0.48, '#035071');
      gradient.addColorStop(1, '#061b35');
      context.fillStyle = gradient;
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      context.fillStyle = 'rgba(117, 231, 255, .08)';
      for (let ray = 0; ray < 6; ray += 1) {
        context.beginPath();
        context.moveTo(90 + ray * 210, 0);
        context.lineTo(210 + ray * 210, CANVAS_HEIGHT);
        context.lineTo(360 + ray * 210, CANVAS_HEIGHT);
        context.lineTo(180 + ray * 210, 0);
        context.fill();
      }

      context.fillStyle = '#092d35';
      context.beginPath();
      context.moveTo(0, CANVAS_HEIGHT - 34);
      for (let x = 0; x <= CANVAS_WIDTH; x += 60) context.lineTo(x, CANVAS_HEIGHT - 40 - Math.sin(x * 0.025) * 16);
      context.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      context.lineTo(0, CANVAS_HEIGHT);
      context.fill();

      context.strokeStyle = 'rgba(220, 250, 255, .25)';
      context.lineWidth = 1.5;
      for (const bubble of bubblesRef.current) {
        context.beginPath();
        context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        context.stroke();
      }

      for (const fish of fishRef.current) {
        const bob = Math.sin(time * 0.003 + fish.phase) * 4;
        context.save();
        context.translate(fish.x, fish.y + bob);
        if (fish.vx < 0) context.scale(-1, 1);
        context.font = `${fish.radius * 1.7}px serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = fish.color;
        context.shadowBlur = fish === fishRef.current.find((entry) => entry.id === targetRef.current) ? 22 : 7;
        context.fillText(fish.emoji, 0, 0);
        context.shadowBlur = 0;
        if (fish.currentHp < fish.hp) {
          const width = fish.radius * 1.5;
          context.fillStyle = 'rgba(0,0,0,.65)';
          context.fillRect(-width / 2, -fish.radius - 14, width, 6);
          context.fillStyle = '#65e6a9';
          context.fillRect(-width / 2, -fish.radius - 14, width * (fish.currentHp / fish.hp), 6);
        }
        if (fish.id === targetRef.current) {
          context.strokeStyle = '#ffcf4d';
          context.lineWidth = 3;
          context.setLineDash([9, 7]);
          context.beginPath();
          context.arc(0, 0, fish.radius + 12, 0, Math.PI * 2);
          context.stroke();
          context.setLineDash([]);
        }
        context.restore();
      }

      for (const bullet of bulletsRef.current) {
        context.strokeStyle = 'rgba(106, 227, 255, .45)';
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(bullet.previousX, bullet.previousY);
        context.lineTo(bullet.x, bullet.y);
        context.stroke();
        context.fillStyle = '#f4fdff';
        context.shadowColor = '#53dcff';
        context.shadowBlur = 18;
        context.beginPath();
        context.arc(bullet.x, bullet.y, 7, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }

      for (const effect of effectsRef.current) {
        context.globalAlpha = Math.max(0, 1 - effect.age / 1.2);
        context.fillStyle = '#ffe36b';
        context.font = '900 28px ui-sans-serif, system-ui';
        context.textAlign = 'center';
        context.fillText(effect.text, effect.x, effect.y - effect.age * 42);
      }
      context.globalAlpha = 1;

      const target = targetRef.current ? fishRef.current.find((fish) => fish.id === targetRef.current) : null;
      const aim = target || aimRef.current;
      const angle = Math.atan2(aim.y - CANNON_Y, aim.x - CANNON_X);
      context.save();
      context.translate(CANNON_X, CANNON_Y);
      context.rotate(angle);
      context.fillStyle = '#f2bd37';
      context.fillRect(0, -12, 74, 24);
      context.fillStyle = '#273746';
      context.beginPath();
      context.arc(0, 0, 34, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const update = (time: number) => {
      const delta = Math.min(0.033, Math.max(0.008, (time - previousTime) / 1000));
      previousTime = time;

      if (time - lastSpawn > 850 && fishRef.current.length < MAX_FISH) {
        spawnFish(false);
        lastSpawn = time;
      }

      for (const bubble of bubblesRef.current) {
        bubble.y -= bubble.speed * delta;
        bubble.x += Math.sin(time * 0.001 + bubble.radius) * 8 * delta;
        if (bubble.y < -12) {
          bubble.y = CANVAS_HEIGHT + 12;
          bubble.x = Math.random() * CANVAS_WIDTH;
        }
      }

      for (const fish of fishRef.current) fish.x += fish.vx * delta;
      fishRef.current = fishRef.current.filter((fish) => fish.x > -fish.radius - 80 && fish.x < CANVAS_WIDTH + fish.radius + 80);
      if (targetRef.current && !fishRef.current.some((fish) => fish.id === targetRef.current)) {
        targetRef.current = null;
        setLockedTargetId(null);
      }

      for (const bullet of bulletsRef.current) {
        bullet.previousX = bullet.x;
        bullet.previousY = bullet.y;
        if (bullet.targetId) {
          const target = fishRef.current.find((fish) => fish.id === bullet.targetId);
          if (target) {
            const angle = Math.atan2(target.y - bullet.y, target.x - bullet.x);
            bullet.vx = Math.cos(angle) * BULLET_SPEED;
            bullet.vy = Math.sin(angle) * BULLET_SPEED;
          }
        }
        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;
      }

      const hitBullets = new Set<number>();
      const caughtFish = new Set<number>();
      for (const bullet of bulletsRef.current) {
        for (const fish of fishRef.current) {
          if (caughtFish.has(fish.id)) continue;
          if (distanceToSegment(fish.x, fish.y, bullet.previousX, bullet.previousY, bullet.x, bullet.y) <= fish.radius + 7) {
            hitBullets.add(bullet.id);
            fish.currentHp -= bullet.damage;
            if (fish.currentHp <= 0) {
              caughtFish.add(fish.id);
              void awardFish(fish, bullet);
              if (targetRef.current === fish.id) {
                targetRef.current = null;
                setLockedTargetId(null);
              }
            }
            break;
          }
        }
      }
      bulletsRef.current = bulletsRef.current.filter((bullet) => !hitBullets.has(bullet.id)
        && bullet.x > -60 && bullet.x < CANVAS_WIDTH + 60 && bullet.y > -60 && bullet.y < CANVAS_HEIGHT + 60);
      fishRef.current = fishRef.current.filter((fish) => !caughtFish.has(fish.id));

      for (const effect of effectsRef.current) effect.age += delta;
      effectsRef.current = effectsRef.current.filter((effect) => effect.age < 1.2);

      if (autoRef.current && time - lastAutoShot > 360) {
        let target = targetRef.current ? fishRef.current.find((fish) => fish.id === targetRef.current) : null;
        if (!target) target = [...fishRef.current].sort((left, right) => right.multiplier - left.multiplier)[0];
        if (target) {
          aimRef.current = { x: target.x, y: target.y };
          void requestShotRef.current(target.id);
        }
        lastAutoShot = time;
      }

      if (time - lastCountUpdate > 500) {
        setFishCount(fishRef.current.length);
        lastCountUpdate = time;
      }
      drawOcean(time);
      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(animationFrame);
      fishRef.current = [];
      bulletsRef.current = [];
      effectsRef.current = [];
    };
  }, [spawnFish]);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (CANVAS_WIDTH / bounds.width),
      y: (event.clientY - bounds.top) * (CANVAS_HEIGHT / bounds.height)
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (targetRef.current) return;
    const point = canvasPoint(event);
    if (point) aimRef.current = point;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    if (!point) return;
    aimRef.current = point;
    let targetId: number | null = null;
    if (lockRef.current) {
      const target = [...fishRef.current]
        .sort((left, right) => Math.hypot(point.x - left.x, point.y - left.y) - Math.hypot(point.x - right.x, point.y - right.y))
        .find((fish) => Math.hypot(point.x - fish.x, point.y - fish.y) <= fish.radius * 1.4);
      targetId = target?.id || null;
      targetRef.current = targetId;
      setLockedTargetId(targetId);
      if (!target) setStatus('No fish selected. Tap directly on a target.');
    }
    void requestShot(targetId);
  };

  return (
    <section className="ocean-hunter">
      <header className="ocean-hunter-header">
        <div>
          <div className="ocean-hunter-kicker">Deep-sea skill arcade</div>
          <h2>Ocean Hunter</h2>
        </div>
        <div className="ocean-hunter-metrics">
          <span><small>Balance</small>{Math.floor(balance)} {currencySymbol}</span>
          <span><small>Last catch</small>{lastWin} {currencySymbol}</span>
          <span><small>Targets</small>{fishCount}</span>
        </div>
      </header>

      <div className="ocean-hunter-screen">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          aria-label="Ocean Hunter play field. Aim and tap to fire."
        />
        <div className="ocean-hunter-hud">
          <span className={isAuto ? 'active' : ''}>{isAuto ? 'AUTO FIRE' : 'MANUAL'}</span>
          <span className={lockedTargetId ? 'locked' : ''}>{lockedTargetId ? 'TARGET LOCKED' : 'FREE AIM'}</span>
        </div>
      </div>

      <div className="ocean-hunter-status" role="status" aria-live="polite">{status}</div>

      <div className="ocean-hunter-controls">
        <div className="ocean-hunter-bet">
          <span>SHOT POWER</span>
          <button type="button" disabled={isProcessing} onClick={() => setBetAmount(Math.max(10, betAmount - 10))}>−</button>
          <strong>{betAmount} {currencySymbol}</strong>
          <button type="button" disabled={isProcessing} onClick={() => setBetAmount(Math.min(100, betAmount + 10))}>+</button>
        </div>
        <div className="ocean-hunter-actions">
          <button type="button" className={isAuto ? 'selected' : ''} onClick={() => setIsAuto(current => !current)}>{isAuto ? 'Stop Auto' : 'Auto Fire'}</button>
          <button type="button" className={isLockEnabled ? 'selected lock' : ''} onClick={() => {
            setIsLockEnabled(current => !current);
            if (isLockEnabled) {
              targetRef.current = null;
              setLockedTargetId(null);
            }
          }}>{isLockEnabled ? 'Lock On' : 'Free Aim'}</button>
          <button type="button" onClick={resetOcean}>Reset Ocean</button>
        </div>
      </div>

      <p className="ocean-hunter-help">Move or tap to aim. Every shot is charged once. Higher shot power deals more damage and scales the catch reward.</p>

      <style>{`
        .ocean-hunter{width:100%;padding:18px;border:1px solid #25516a;border-radius:18px;background:linear-gradient(155deg,#071927,#0b2434);color:#eefaff;box-shadow:0 24px 65px rgba(0,0,0,.38)}.ocean-hunter-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:13px}.ocean-hunter-kicker{color:#63d4ee;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.ocean-hunter h2{margin:2px 0 0;font-size:28px;line-height:1}.ocean-hunter-metrics{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.ocean-hunter-metrics span{min-width:88px;padding:7px 10px;border:1px solid #28536a;border-radius:8px;background:#081723;color:#d8f5ff;font-size:13px;font-weight:850;text-align:right}.ocean-hunter-metrics small{display:block;color:#7f9cab;font-size:8px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
        .ocean-hunter-screen{position:relative;overflow:hidden;width:100%;aspect-ratio:16/9;border:8px solid #102d42;border-radius:14px;background:#032e47;box-shadow:inset 0 0 40px rgba(0,0,0,.8),0 15px 30px rgba(0,0,0,.3)}.ocean-hunter-screen canvas{display:block;width:100%;height:100%;touch-action:none;cursor:crosshair}.ocean-hunter-hud{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;pointer-events:none}.ocean-hunter-hud span{padding:5px 8px;border:1px solid rgba(118,206,235,.3);border-radius:6px;background:rgba(3,20,31,.68);color:#9db5c0;font-size:9px;font-weight:900;letter-spacing:.1em}.ocean-hunter-hud span.active{color:#7ff2bd;border-color:#4ab988}.ocean-hunter-hud span.locked{color:#ffd86b;border-color:#d3a52d}.ocean-hunter-status{min-height:40px;margin:12px 0;padding:10px 12px;border:1px solid #23485c;border-radius:8px;background:#071620;color:#c9e5ef;font-size:13px;text-align:center}
        .ocean-hunter-controls{display:flex;justify-content:space-between;gap:12px;align-items:center}.ocean-hunter-bet,.ocean-hunter-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ocean-hunter-bet>span{color:#7f9dac;font-size:9px;font-weight:900;letter-spacing:.12em}.ocean-hunter-bet strong{min-width:92px;text-align:center;color:#ffe06a}.ocean-hunter-controls button{padding:9px 12px;border:1px solid #2c5870;border-radius:8px;background:#102b3b;color:#d9edf5;font-weight:800;cursor:pointer}.ocean-hunter-controls button:hover{border-color:#5bb9df}.ocean-hunter-controls button:disabled{opacity:.45;cursor:not-allowed}.ocean-hunter-controls button.selected{background:#154c42;border-color:#42bd8d;color:#9bf2cf}.ocean-hunter-controls button.selected.lock{background:#5a4215;border-color:#d9a72d;color:#ffe28a}.ocean-hunter-help{margin:13px 0 0;color:#7895a4;font-size:11px;text-align:center}
        @media(max-width:760px){.ocean-hunter{padding:11px}.ocean-hunter-header{align-items:flex-start;flex-direction:column}.ocean-hunter-metrics{justify-content:flex-start}.ocean-hunter-metrics span{min-width:78px}.ocean-hunter-controls{align-items:stretch;flex-direction:column}.ocean-hunter-bet,.ocean-hunter-actions{justify-content:center}.ocean-hunter h2{font-size:23px}}
      `}</style>
    </section>
  );
};

export default OceanHunterGame;
