import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyMode } from '../../types';
import { useCoinSystem } from '../../context/CoinContext';

const CANVAS_WIDTH = 1800;
const CANVAS_HEIGHT = 1050;
const BULLET_SPEED = 1050;
const MAX_FISH = 34;
const DEFAULT_BET = 10;
const NORMAL_WAVE_SECONDS = 38;
const BOSS_WAVE_SECONDS = 60;

type ArenaSide = 'bottom' | 'left' | 'top' | 'right';
type FishBehavior = 'drift' | 'dart' | 'armored' | 'school' | 'swell' | 'ink' | 'glide' | 'surge' | 'boss';
type FishDefinition = { emoji: string; hp: number; multiplier: number; speed: number; radius: number; weight: number; color: string; behavior: FishBehavior };
type Fish = FishDefinition & { id: number; x: number; y: number; baseY: number; vx: number; phase: number; age: number; currentHp: number; slowUntil: number; flashUntil: number };
type Hunter = { id: number; name: string; isHuman: boolean; side: ArenaSide; color: string; score: number; catches: number; shots: number; hits: number };
type Bullet = {
  id: number;
  ownerId: number;
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
  color: string;
  weapon: WeaponMode;
  remainingHits: number;
  hitFishIds: Set<number>;
  shotId: number;
};
type WinEffect = { id: number; x: number; y: number; text: string; color: string; age: number };
type Particle = { id: number; x: number; y: number; vx: number; vy: number; color: string; size: number; age: number; life: number };
type Payout = { amount: number; currency: CurrencyMode; hunterId: number; label: string; countCatch: boolean };
type WeaponMode = 'Torpedo' | 'Spread' | 'Piercing' | 'Freeze';
type Mission = { emoji: string; goal: number; progress: number; seconds: number };

const FISH_DEFINITIONS: FishDefinition[] = [
  { emoji: '🪼', hp: 1, multiplier: 0.8, speed: 82, radius: 24, weight: 15, color: '#c98cff', behavior: 'drift' },
  { emoji: '🦐', hp: 1, multiplier: 1, speed: 142, radius: 20, weight: 14, color: '#ff8f86', behavior: 'dart' },
  { emoji: '🦀', hp: 2, multiplier: 1.4, speed: 64, radius: 28, weight: 13, color: '#ff5c56', behavior: 'armored' },
  { emoji: '🐠', hp: 2, multiplier: 1.8, speed: 126, radius: 32, weight: 14, color: '#4ed4ff', behavior: 'school' },
  { emoji: '🐟', hp: 3, multiplier: 2.4, speed: 112, radius: 34, weight: 13, color: '#78a8d2', behavior: 'school' },
  { emoji: '🐡', hp: 4, multiplier: 3.2, speed: 86, radius: 39, weight: 10, color: '#ffc247', behavior: 'swell' },
  { emoji: '🦑', hp: 6, multiplier: 5, speed: 118, radius: 45, weight: 8, color: '#ffb3d0', behavior: 'ink' },
  { emoji: '🐢', hp: 10, multiplier: 8, speed: 58, radius: 56, weight: 6, color: '#75e59b', behavior: 'glide' },
  { emoji: '🦈', hp: 18, multiplier: 15, speed: 104, radius: 82, weight: 4, color: '#b7c4d0', behavior: 'surge' },
  { emoji: '🐋', hp: 28, multiplier: 28, speed: 42, radius: 108, weight: 2, color: '#7588df', behavior: 'glide' },
  { emoji: '🌟', hp: 12, multiplier: 22, speed: 168, radius: 45, weight: 2, color: '#ffd84d', behavior: 'dart' }
];
const BOSS_DEFINITION: FishDefinition = { emoji: '🐙', hp: 60, multiplier: 55, speed: 38, radius: 125, weight: 0, color: '#ff78d0', behavior: 'boss' };
const TREASURE_DEFINITION: FishDefinition = { emoji: '🧰', hp: 6, multiplier: 12, speed: 55, radius: 42, weight: 0, color: '#ffd455', behavior: 'drift' };
const HUNTER_COLORS = ['#ffd34f', '#55d6ff', '#ff6e82', '#8ee66b'];
const MISSION_TARGETS = ['🐠', '🦀', '🐡'];
const createMission = (): Mission => ({ emoji: MISSION_TARGETS[Math.floor(Math.random() * MISSION_TARGETS.length)], goal: 5, progress: 0, seconds: 60 });
const SPRITE_CELLS: Record<string, { column: number; row: number }> = {
  '🪼': { column: 0, row: 0 }, '🦐': { column: 1, row: 0 }, '🦀': { column: 2, row: 0 }, '🐠': { column: 3, row: 0 },
  '🐟': { column: 0, row: 1 }, '🐡': { column: 1, row: 1 }, '🦑': { column: 2, row: 1 }, '🐢': { column: 3, row: 1 },
  '🦈': { column: 0, row: 2 }, '🐋': { column: 1, row: 2 }, '🌟': { column: 2, row: 2 }, '🐙': { column: 3, row: 2 },
  '🧰': { column: 0, row: 3 }
};
const FISH_NAMES: Record<string, string> = {
  '🪼': 'Jellyfish', '🦐': 'Shrimp', '🦀': 'Crab', '🐠': 'Reef Fish', '🐟': 'Bluefin', '🐡': 'Pufferfish',
  '🦑': 'Squid', '🐢': 'Sea Turtle', '🦈': 'Shark', '🐋': 'Whale', '🌟': 'Golden Star', '🐙': 'Kraken', '🧰': 'Treasure Chest'
};
const SPRITE_ATLAS_URL = `${import.meta.env.BASE_URL}assets/ocean-hunter/creature-atlas.png`;
const waveName = (wave: number) => wave % 4 === 0 ? 'KRAKEN BOSS ROUND' : wave % 4 === 1 ? 'REEF PATROL' : wave % 4 === 2 ? 'FEEDING FRENZY' : 'TREASURE TIDE';
const waveDuration = (wave: number) => wave % 4 === 0 ? BOSS_WAVE_SECONDS : NORMAL_WAVE_SECONDS;

const chooseFishDefinition = () => {
  const total = FISH_DEFINITIONS.reduce((sum, fish) => sum + fish.weight, 0);
  let roll = Math.random() * total;
  for (const fish of FISH_DEFINITIONS) {
    roll -= fish.weight;
    if (roll <= 0) return fish;
  }
  return FISH_DEFINITIONS[0];
};

const sidesForCount = (count: number): ArenaSide[] => {
  if (count === 1) return ['bottom'];
  if (count === 2) return ['bottom', 'top'];
  if (count === 3) return ['bottom', 'left', 'right'];
  return ['bottom', 'left', 'top', 'right'];
};

const cannonPosition = (side: ArenaSide) => {
  if (side === 'top') return { x: CANVAS_WIDTH / 2, y: 25 };
  if (side === 'left') return { x: 25, y: CANVAS_HEIGHT / 2 };
  if (side === 'right') return { x: CANVAS_WIDTH - 25, y: CANVAS_HEIGHT / 2 };
  return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 25 };
};

const distanceToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(px - x1, py - y1);
  const progress = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + progress * dx), py - (y1 + progress * dy));
};

const drawCreatureSprite = (context: CanvasRenderingContext2D, atlas: HTMLImageElement | null, fish: Fish) => {
  const cell = SPRITE_CELLS[fish.emoji];
  if (!atlas?.complete || !atlas.naturalWidth || !cell) {
    context.font = `${fish.radius * 1.7}px serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(fish.emoji, 0, 0);
    return;
  }

  const cellWidth = atlas.naturalWidth / 4;
  const cellHeight = atlas.naturalHeight / 4;
  const drawSize = fish.radius * (fish.behavior === 'boss' ? 2.75 : 2.65);
  const slices = 12;
  const pulse = fish.behavior === 'drift' ? 1 + Math.sin(fish.age * 3.2 + fish.phase) * .075
    : fish.behavior === 'swell' ? 1 + Math.max(0, Math.sin(fish.age * 2.4)) * .16
      : 1;
  const tilt = fish.behavior === 'dart' ? Math.sin(fish.age * 4.5 + fish.phase) * .055
    : fish.behavior === 'boss' || fish.behavior === 'ink' ? Math.sin(fish.age * 1.7 + fish.phase) * .075
      : Math.sin(fish.age * 1.2 + fish.phase) * .025;
  const waveStrength = fish.emoji === '🧰' ? 0
    : fish.behavior === 'boss' ? fish.radius * .18
      : fish.behavior === 'ink' || fish.behavior === 'drift' ? fish.radius * .14
        : fish.behavior === 'glide' || fish.behavior === 'armored' ? fish.radius * .045
          : fish.radius * .09;

  context.save();
  context.rotate(tilt);
  context.scale(1 / pulse, pulse);
  for (let slice = 0; slice < slices; slice += 1) {
    const progress = slice / (slices - 1);
    const tailInfluence = Math.pow(1 - progress, 1.55);
    const offsetY = Math.sin(fish.age * 7 + fish.phase + progress * 4.4) * waveStrength * tailInfluence;
    const sourceX = cell.column * cellWidth + slice * (cellWidth / slices);
    const destinationX = -drawSize / 2 + slice * (drawSize / slices);
    context.drawImage(
      atlas,
      sourceX, cell.row * cellHeight, cellWidth / slices + .5, cellHeight,
      destinationX, -drawSize / 2 + offsetY, drawSize / slices + 1.25, drawSize
    );
  }
  context.restore();
};

const OceanHunterGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode, funCoins, realCoins, isProcessing } = useCoinSystem();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteAtlasRef = useRef<HTMLImageElement | null>(null);
  const fishRef = useRef<Fish[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const effectsRef = useRef<WinEffect[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const huntersRef = useRef<Hunter[]>([]);
  const bubblesRef = useRef<{ x: number; y: number; radius: number; speed: number }[]>([]);
  const aimsRef = useRef(new Map<number, { x: number; y: number }>());
  const targetsRef = useRef(new Map<number, number | null>());
  const lockSpeciesRef = useRef(new Map<number, string | null>());
  const autoIdsRef = useRef(new Set<number>());
  const lastShotRef = useRef(new Map<number, number>());
  const botNextShotRef = useRef(new Map<number, number>());
  const pendingHumanShotsRef = useRef(new Set<number>());
  const humanShotQueueRef = useRef<Promise<void>>(Promise.resolve());
  const payoutQueueRef = useRef<Payout[]>([]);
  const payoutBusyRef = useRef(false);
  const mountedRef = useRef(true);
  const nextIdRef = useRef(1);
  const betRef = useRef(DEFAULT_BET);
  const currencyRef = useRef(currencyMode);
  const canBetRef = useRef(canBet);
  const subtractCoinsRef = useRef(subtractCoins);
  const addCoinsRef = useRef(addCoins);
  const activeHunterIdRef = useRef(0);
  const launchShotRef = useRef<(ownerId: number, targetId?: number | null) => void>(() => undefined);
  const weaponRef = useRef<WeaponMode>('Torpedo');
  const comboRef = useRef(new Map<number, number>());
  const comboLastCatchRef = useRef(new Map<number, number>());
  const registeredHitShotsRef = useRef(new Set<number>());
  const environmentRef = useRef<'Clear' | 'Current' | 'Darkness'>('Clear');
  const cannonSkinRef = useRef<'Arcade' | 'Neon' | 'Gold'>('Arcade');
  const missionRef = useRef<Mission>({ emoji: '🐠', goal: 5, progress: 0, seconds: 60 });
  const shakeRef = useRef(0);
  const waveRef = useRef(1);
  const waveStartedRef = useRef(0);
  const bossSpawnedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [humanCount, setHumanCount] = useState(1);
  const [botCount, setBotCount] = useState(0);
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const [hunters, setHunters] = useState<Hunter[]>([]);
  const [activeHunterId, setActiveHunterId] = useState(0);
  const [betAmount, setBetAmount] = useState(DEFAULT_BET);
  const [autoIds, setAutoIds] = useState<number[]>([]);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockedTargetId, setLockedTargetId] = useState<number | null>(null);
  const [lockedSpecies, setLockedSpecies] = useState<string | null>(null);
  const [fishCount, setFishCount] = useState(0);
  const [status, setStatus] = useState('Configure the arena to begin.');
  const [lastWin, setLastWin] = useState(0);
  const [weapon, setWeapon] = useState<WeaponMode>('Torpedo');
  const [environment, setEnvironment] = useState<'Clear' | 'Current' | 'Darkness'>('Clear');
  const [combo, setCombo] = useState(0);
  const [bossWarning, setBossWarning] = useState(false);
  const [mission, setMission] = useState<Mission>(missionRef.current);
  const [cannonSkin, setCannonSkin] = useState<'Arcade' | 'Neon' | 'Gold'>('Arcade');
  const [showSummary, setShowSummary] = useState(false);
  const [wave, setWave] = useState(1);
  const [waveSeconds, setWaveSeconds] = useState(NORMAL_WAVE_SECONDS);

  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
  const balance = currencyMode === 'fun' ? funCoins : realCoins;
  const activeHunter = hunters.find((hunter) => hunter.id === activeHunterId);
  const totalPlayers = humanCount + botCount;

  useEffect(() => { betRef.current = betAmount; }, [betAmount]);
  useEffect(() => { currencyRef.current = currencyMode; }, [currencyMode]);
  useEffect(() => { canBetRef.current = canBet; }, [canBet]);
  useEffect(() => { subtractCoinsRef.current = subtractCoins; }, [subtractCoins]);
  useEffect(() => { addCoinsRef.current = addCoins; }, [addCoins]);
  useEffect(() => { autoIdsRef.current = new Set(autoIds); }, [autoIds]);
  useEffect(() => { activeHunterIdRef.current = activeHunterId; }, [activeHunterId]);
  useEffect(() => { weaponRef.current = weapon; }, [weapon]);
  useEffect(() => { environmentRef.current = environment; }, [environment]);
  useEffect(() => { cannonSkinRef.current = cannonSkin; }, [cannonSkin]);
  useEffect(() => { missionRef.current = mission; }, [mission]);
  useEffect(() => {
    const atlas = new Image();
    atlas.decoding = 'async';
    atlas.src = SPRITE_ATLAS_URL;
    atlas.onload = () => { spriteAtlasRef.current = atlas; };
    return () => { atlas.onload = null; spriteAtlasRef.current = null; };
  }, []);

  const commitHunters = useCallback((update: (current: Hunter[]) => Hunter[]) => {
    const next = update(huntersRef.current);
    huntersRef.current = next;
    setHunters(next);
  }, []);

  const spawnFish = useCallback((initial = false) => {
    const definition = chooseFishDefinition();
    const fromLeft = Math.random() > 0.5;
    const y = 90 + Math.random() * (CANVAS_HEIGHT - 180);
    fishRef.current.push({
      ...definition,
      id: nextIdRef.current++,
      x: initial ? 100 + Math.random() * (CANVAS_WIDTH - 200) : fromLeft ? -definition.radius - 10 : CANVAS_WIDTH + definition.radius + 10,
      y,
      baseY: y,
      vx: (fromLeft ? 1 : -1) * definition.speed,
      phase: Math.random() * Math.PI * 2,
      age: Math.random() * 10,
      currentHp: definition.hp,
      slowUntil: 0,
      flashUntil: 0
    });
  }, []);

  const spawnSpecial = useCallback((definition: FishDefinition) => {
    const fromLeft = Math.random() > .5;
    const y = 150 + Math.random() * (CANVAS_HEIGHT - 300);
    fishRef.current.push({ ...definition, id: nextIdRef.current++, x: fromLeft ? -definition.radius : CANVAS_WIDTH + definition.radius, y, baseY: y, vx: (fromLeft ? 1 : -1) * definition.speed, phase: 0, age: 0, currentHp: definition.hp, slowUntil: 0, flashUntil: 0 });
  }, []);

  const flushPayouts = useCallback(async () => {
    if (payoutBusyRef.current) return;
    payoutBusyRef.current = true;
    while (mountedRef.current && payoutQueueRef.current.length) {
      const payout = payoutQueueRef.current.shift()!;
      const credited = await addCoinsRef.current(payout.amount, `Ocean Hunter · ${payout.label}`, payout.currency);
      if (!mountedRef.current) break;
      if (credited) {
        commitHunters((current) => current.map((hunter) => hunter.id === payout.hunterId
          ? { ...hunter, score: hunter.score + payout.amount, catches: hunter.catches + (payout.countCatch ? 1 : 0) }
          : hunter));
        setLastWin(payout.amount);
        setStatus(`${huntersRef.current.find((hunter) => hunter.id === payout.hunterId)?.name ?? 'Player'} earned ${payout.amount} ${payout.currency === 'fun' ? 'FC' : 'RC'} · ${payout.label}`);
      } else {
        setStatus('A catch was made, but its payout was not confirmed.');
        setAutoIds((current) => current.filter((id) => id !== payout.hunterId));
      }
    }
    payoutBusyRef.current = false;
  }, [commitHunters]);

  const awardFish = useCallback((fish: Fish, bullet: Bullet) => {
    const owner = huntersRef.current.find((hunter) => hunter.id === bullet.ownerId);
    if (!owner) return;
    const nextCombo = (comboRef.current.get(owner.id) ?? 0) + 1;
    const comboMultiplier = 1 + Math.min(10, Math.max(0, nextCombo - 1)) * .02;
    const reward = Math.max(1, Math.round(fish.multiplier * bullet.cost * comboMultiplier));
    comboRef.current.set(owner.id, nextCombo);
    comboLastCatchRef.current.set(owner.id, performance.now());
    if (owner.id === activeHunterIdRef.current) setCombo(nextCombo);
    effectsRef.current.push({ id: nextIdRef.current++, x: fish.x, y: fish.y, text: `${nextCombo > 1 ? `×${nextCombo} ` : ''}+${reward}`, color: owner.color, age: 0 });
    for (let index = 0; index < 14; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 190;
      particlesRef.current.push({ id: nextIdRef.current++, x: fish.x, y: fish.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color: fish.color, size: 3 + Math.random() * 7, age: 0, life: .45 + Math.random() * .55 });
    }
    shakeRef.current = Math.max(shakeRef.current, fish.behavior === 'boss' ? 18 : 7);
    if (owner.isHuman) {
      payoutQueueRef.current.push({ amount: reward, currency: bullet.currency, hunterId: owner.id, label: `${FISH_NAMES[fish.emoji] ?? 'creature'} catch`, countCatch: true });
    } else {
      commitHunters((current) => current.map((hunter) => hunter.id === owner.id
        ? { ...hunter, score: hunter.score + reward, catches: hunter.catches + 1 }
        : hunter));
      setStatus(`${owner.name} caught ${FISH_NAMES[fish.emoji] ?? 'a creature'} for ${reward} points.`);
    }

    const currentMission = missionRef.current;
    if (fish.emoji === currentMission.emoji) {
      const progress = currentMission.progress + 1;
      if (progress >= currentMission.goal) {
        const missionBonus = betRef.current * 2;
        const nextMission = createMission();
        missionRef.current = nextMission;
        setMission(nextMission);
        effectsRef.current.push({ id: nextIdRef.current++, x: CANVAS_WIDTH / 2, y: 150, text: `MISSION COMPLETE +${missionBonus}`, color: '#ffe36d', age: 0 });
        if (owner.isHuman) payoutQueueRef.current.push({ amount: missionBonus, currency: bullet.currency, hunterId: owner.id, label: 'mission bonus', countCatch: false });
        else commitHunters((current) => current.map((hunter) => hunter.id === owner.id ? { ...hunter, score: hunter.score + missionBonus } : hunter));
      } else {
        const nextMission = { ...currentMission, progress };
        missionRef.current = nextMission;
        setMission(nextMission);
      }
    }
    if (owner.isHuman) void flushPayouts();
  }, [commitHunters, flushPayouts]);

  const createBullet = useCallback((owner: Hunter, targetId?: number | null) => {
    const origin = cannonPosition(owner.side);
    const target = targetId ? fishRef.current.find((fish) => fish.id === targetId) : null;
    const destination = target || aimsRef.current.get(owner.id) || { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const angle = Math.atan2(destination.y - origin.y, destination.x - origin.x);
    const cost = owner.isHuman ? betRef.current : DEFAULT_BET;
    const muzzleX = origin.x + Math.cos(angle) * 58;
    const muzzleY = origin.y + Math.sin(angle) * 58;
    const mode: WeaponMode = owner.isHuman ? weaponRef.current : 'Torpedo';
    const shotId = nextIdRef.current++;
    const baseDamage = Math.max(1, cost / DEFAULT_BET);
    const offsets = mode === 'Spread' ? [-.17, 0, .17] : [0];
    offsets.forEach((offset) => {
      const shotAngle = angle + offset;
      const payoutCost = mode === 'Spread' || mode === 'Piercing' ? cost / 3 : cost;
      const damageScale = mode === 'Torpedo' ? 1.25 : mode === 'Spread' ? .62 : mode === 'Piercing' ? .85 : .72;
      bulletsRef.current.push({
        id: nextIdRef.current++, ownerId: owner.id, x: muzzleX, y: muzzleY, previousX: muzzleX, previousY: muzzleY,
        vx: Math.cos(shotAngle) * BULLET_SPEED, vy: Math.sin(shotAngle) * BULLET_SPEED,
        damage: baseDamage * damageScale, cost: payoutCost, currency: currencyRef.current,
        targetId: mode === 'Spread' ? null : target?.id ?? null, color: owner.color, weapon: mode,
        remainingHits: mode === 'Piercing' ? 3 : 1, hitFishIds: new Set<number>(), shotId
      });
    });
    lastShotRef.current.set(owner.id, performance.now());
    commitHunters((current) => current.map((hunter) => hunter.id === owner.id ? { ...hunter, shots: hunter.shots + 1 } : hunter));
  }, [commitHunters]);

  const launchShot = useCallback((ownerId: number, targetId?: number | null) => {
    const owner = huntersRef.current.find((hunter) => hunter.id === ownerId);
    if (!owner) return;
    const now = performance.now();
    if (now - (lastShotRef.current.get(ownerId) ?? 0) < (owner.isHuman ? 190 : 480)) return;

    if (!owner.isHuman) {
      createBullet(owner, targetId);
      return;
    }
    if (pendingHumanShotsRef.current.has(ownerId)) return;
    pendingHumanShotsRef.current.add(ownerId);
    humanShotQueueRef.current = humanShotQueueRef.current.then(async () => {
      const cost = betRef.current;
      if (!canBetRef.current(cost)) {
        setStatus(`${owner.name} needs ${cost} ${currencyRef.current === 'fun' ? 'FC' : 'RC'} to fire.`);
        setAutoIds((current) => current.filter((id) => id !== ownerId));
        pendingHumanShotsRef.current.delete(ownerId);
        return;
      }
      const shotCurrency = currencyRef.current;
      const charged = await subtractCoinsRef.current(cost, `Ocean Hunter Shot · ${owner.name}`, shotCurrency);
      if (mountedRef.current && charged) createBullet(owner, targetId);
      else if (mountedRef.current) setStatus('The shot was not charged, so no torpedo was fired.');
      pendingHumanShotsRef.current.delete(ownerId);
    });
  }, [createBullet]);
  launchShotRef.current = launchShot;

  const resetOcean = useCallback(() => {
    fishRef.current = [];
    bulletsRef.current = [];
    effectsRef.current = [];
    particlesRef.current = [];
    targetsRef.current.clear();
    registeredHitShotsRef.current.clear();
    comboRef.current.clear();
    comboLastCatchRef.current.clear();
    for (let index = 0; index < 16; index += 1) spawnFish(true);
    setLockedTargetId(null);
    setFishCount(fishRef.current.length);
    setLastWin(0);
    setCombo(0);
    setStatus('Fresh targets entered the arena.');
  }, [spawnFish]);

  const startArena = () => {
    const sides = sidesForCount(totalPlayers);
    let humanIndex = 0;
    const nextHunters: Hunter[] = Array.from({ length: totalPlayers }, (_, index) => {
      const isHuman = index < humanCount;
      const hunter: Hunter = {
        id: index,
        name: isHuman ? names[humanIndex].trim() || `Player ${humanIndex + 1}` : `BOT ${index - humanCount + 1}`,
        isHuman,
        side: sides[index],
        color: HUNTER_COLORS[index],
        score: 0,
        catches: 0,
        shots: 0,
        hits: 0
      };
      if (isHuman) humanIndex += 1;
      return hunter;
    });
    huntersRef.current = nextHunters;
    setHunters(nextHunters);
    const firstHuman = nextHunters.find((hunter) => hunter.isHuman)!;
    setActiveHunterId(firstHuman.id);
    aimsRef.current.clear();
    targetsRef.current.clear();
    lockSpeciesRef.current.clear();
    nextHunters.forEach((hunter) => aimsRef.current.set(hunter.id, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }));
    setAutoIds([]);
    setLockEnabled(false);
    setLockedTargetId(null);
    setLockedSpecies(null);
    waveRef.current = 1;
    bossSpawnedRef.current = false;
    setWave(1);
    setWaveSeconds(NORMAL_WAVE_SECONDS);
    const nextMission = createMission();
    missionRef.current = nextMission;
    setMission(nextMission);
    setStatus(`${firstHuman.name} has control. Tap the ocean to fire.`);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!isPlaying) return;
    mountedRef.current = true;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    bubblesRef.current = Array.from({ length: 48 }, () => ({
      x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT,
      radius: 2 + Math.random() * 5, speed: 14 + Math.random() * 30
    }));
    resetOcean();
    huntersRef.current.filter((hunter) => !hunter.isHuman).forEach((hunter) => botNextShotRef.current.set(hunter.id, performance.now() + 500 + Math.random() * 900));

    let animationFrame = 0;
    let previousTime = performance.now();
    waveStartedRef.current = previousTime;
    let lastSpawn = previousTime;
    let lastCountUpdate = previousTime;
    let lastTreasure = previousTime;

    const draw = (time: number) => {
      const environmentMode = environmentRef.current;
      const shake = shakeRef.current;
      context.save();
      if (shake > .2) context.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
      const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, environmentMode === 'Darkness' ? '#063049' : '#087da4'); gradient.addColorStop(.48, environmentMode === 'Current' ? '#086889' : '#035273'); gradient.addColorStop(1, '#06192e');
      context.fillStyle = gradient; context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      context.fillStyle = 'rgba(117,231,255,.07)';
      for (let ray = 0; ray < 8; ray += 1) {
        context.beginPath(); context.moveTo(60 + ray * 210, 0); context.lineTo(180 + ray * 210, CANVAS_HEIGHT);
        context.lineTo(350 + ray * 210, CANVAS_HEIGHT); context.lineTo(160 + ray * 210, 0); context.fill();
      }
      context.fillStyle = '#082c34'; context.beginPath(); context.moveTo(0, CANVAS_HEIGHT - 30);
      for (let x = 0; x <= CANVAS_WIDTH; x += 55) context.lineTo(x, CANVAS_HEIGHT - 38 - Math.sin(x * .023) * 17);
      context.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT); context.lineTo(0, CANVAS_HEIGHT); context.fill();
      context.strokeStyle = 'rgba(220,250,255,.22)'; context.lineWidth = 1.5;
      bubblesRef.current.forEach((bubble) => { context.beginPath(); context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2); context.stroke(); });

      for (const fish of fishRef.current) {
        context.save(); context.translate(fish.x, fish.y); if (fish.vx < 0) context.scale(-1, 1);
        if (fish.behavior === 'boss') {
          const pulse = 8 + Math.sin(time * .008) * 5;
          context.strokeStyle = '#ff3b9d'; context.lineWidth = 7; context.shadowColor = '#ff3b9d'; context.shadowBlur = 28;
          context.beginPath(); context.ellipse(0, 0, fish.radius + 28 + pulse, fish.radius + 18 + pulse, 0, 0, Math.PI * 2); context.stroke();
          context.strokeStyle = '#ffd45f'; context.lineWidth = 2; context.setLineDash([14, 10]);
          context.beginPath(); context.ellipse(0, 0, fish.radius + 40 + pulse, fish.radius + 30 + pulse, 0, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
        }
        context.shadowColor = time < fish.flashUntil ? '#ffffff' : fish.color; context.shadowBlur = time < fish.flashUntil ? 34 : [...targetsRef.current.values()].includes(fish.id) ? 22 : 7;
        drawCreatureSprite(context, spriteAtlasRef.current, fish); context.shadowBlur = 0;
        if (time < fish.slowUntil) {
          context.strokeStyle = '#8be9ff'; context.lineWidth = 4; context.setLineDash([5, 8]);
          context.beginPath(); context.arc(0, 0, fish.radius + 8, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
        }
        if (fish.currentHp < fish.hp) {
          const width = fish.radius * 1.5; context.fillStyle = 'rgba(0,0,0,.65)'; context.fillRect(-width / 2, -fish.radius - 14, width, 6);
          context.fillStyle = '#65e6a9'; context.fillRect(-width / 2, -fish.radius - 14, width * (fish.currentHp / fish.hp), 6);
        }
        huntersRef.current.forEach((hunter) => {
          if (targetsRef.current.get(hunter.id) !== fish.id) return;
          context.strokeStyle = hunter.color; context.lineWidth = 3; context.setLineDash([9, 7]);
          context.beginPath(); context.arc(0, 0, fish.radius + 12, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
        });
        context.restore();
      }

      bulletsRef.current.forEach((bullet) => {
        context.strokeStyle = bullet.weapon === 'Freeze' ? '#8be9ff' : bullet.weapon === 'Piercing' ? '#ff79ec' : `${bullet.color}88`; context.lineWidth = bullet.weapon === 'Torpedo' ? 7 : 5; context.beginPath();
        context.moveTo(bullet.previousX, bullet.previousY); context.lineTo(bullet.x, bullet.y); context.stroke();
        context.fillStyle = bullet.weapon === 'Freeze' ? '#bdf6ff' : '#f7feff'; context.shadowColor = bullet.color; context.shadowBlur = 18;
        context.beginPath(); context.arc(bullet.x, bullet.y, bullet.weapon === 'Torpedo' ? 9 : 6, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
      });
      particlesRef.current.forEach((particle) => {
        context.globalAlpha = Math.max(0, 1 - particle.age / particle.life);
        context.fillStyle = particle.color;
        context.beginPath(); context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); context.fill();
      });
      effectsRef.current.forEach((effect) => {
        context.globalAlpha = Math.max(0, 1 - effect.age / 1.2); context.fillStyle = effect.color;
        context.font = '900 28px ui-sans-serif,system-ui'; context.textAlign = 'center';
        context.fillText(effect.text, effect.x, effect.y - effect.age * 42);
      });
      context.globalAlpha = 1;

      huntersRef.current.forEach((hunter) => {
        const origin = cannonPosition(hunter.side);
        const targetId = targetsRef.current.get(hunter.id);
        const target = targetId ? fishRef.current.find((fish) => fish.id === targetId) : null;
        const aim = target || aimsRef.current.get(hunter.id) || { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
        const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
        context.save(); context.translate(origin.x, origin.y); context.rotate(angle);
        const cannonSkinMode = cannonSkinRef.current;
        context.fillStyle = cannonSkinMode === 'Gold' ? '#ffd34f' : cannonSkinMode === 'Neon' ? '#e75cff' : hunter.color; context.fillRect(0, -10, 66, 20);
        context.fillStyle = '#203544'; context.beginPath(); context.arc(0, 0, 29, 0, Math.PI * 2); context.fill();
        context.strokeStyle = hunter.color; context.lineWidth = 4; context.stroke(); context.restore();
        context.fillStyle = hunter.color; context.font = '900 13px ui-sans-serif,system-ui'; context.textAlign = 'center';
        context.fillText(hunter.name, origin.x, origin.y + (hunter.side === 'top' ? 52 : -40));
      });
      context.restore();
    };

    const update = (time: number) => {
      const delta = Math.min(.033, Math.max(.008, (time - previousTime) / 1000)); previousTime = time;
      let activeWave = waveRef.current;
      let elapsedSeconds = (time - waveStartedRef.current) / 1000;
      if (elapsedSeconds >= waveDuration(activeWave)) {
        activeWave += 1;
        waveRef.current = activeWave;
        waveStartedRef.current = time;
        elapsedSeconds = 0;
        bossSpawnedRef.current = false;
        fishRef.current = [];
        bulletsRef.current = [];
        targetsRef.current.forEach((_, hunterId) => targetsRef.current.set(hunterId, null));
        for (let index = 0; index < (activeWave % 4 === 0 ? 8 : 14); index += 1) spawnFish(true);
        setWave(activeWave);
        setBossWarning(activeWave % 4 === 0);
        setStatus(activeWave % 4 === 0 ? 'Boss round! The Kraken is entering the arena.' : `Wave ${activeWave}: ${waveName(activeWave)}.`);
        effectsRef.current.push({ id: nextIdRef.current++, x: CANVAS_WIDTH / 2, y: 145, text: `WAVE ${activeWave} · ${waveName(activeWave)}`, color: activeWave % 4 === 0 ? '#ff65ae' : '#76e9ff', age: 0 });
        lastSpawn = time;
        lastTreasure = time;
      }
      const bossRound = activeWave % 4 === 0;
      if (bossRound && !bossSpawnedRef.current && elapsedSeconds >= 1.8) {
        spawnSpecial(BOSS_DEFINITION);
        bossSpawnedRef.current = true;
        setBossWarning(false);
      }
      const spawnDelay = bossRound ? 980 : activeWave % 4 === 2 ? 390 : Math.max(440, 650 - activeWave * 18);
      const waveFishLimit = bossRound ? 16 : MAX_FISH + Math.min(8, activeWave);
      if (time - lastSpawn > spawnDelay && fishRef.current.length < waveFishLimit) { spawnFish(false); lastSpawn = time; }
      const treasureDelay = activeWave % 4 === 3 ? 7500 : 18000;
      if (!bossRound && time - lastTreasure > treasureDelay) { spawnSpecial(TREASURE_DEFINITION); lastTreasure = time; }
      bubblesRef.current.forEach((bubble) => { bubble.y -= bubble.speed * delta; if (bubble.y < -12) { bubble.y = CANVAS_HEIGHT + 12; bubble.x = Math.random() * CANVAS_WIDTH; } });
      fishRef.current.forEach((fish) => {
        fish.age += delta;
        const environmentSpeed = environmentRef.current === 'Current' ? 1.22 : 1;
        const frozenSpeed = time < fish.slowUntil ? .46 : 1;
        const dartSpeed = fish.behavior === 'dart' ? .72 + Math.max(0, Math.sin(fish.age * 4.5)) * 1.05 : 1;
        const bossPhase = fish.behavior === 'boss' ? 1 + (1 - fish.currentHp / fish.hp) * 1.35 : 1;
        fish.x += fish.vx * delta * environmentSpeed * frozenSpeed * dartSpeed * bossPhase;
        const amplitude = fish.behavior === 'drift' ? 48 : fish.behavior === 'ink' ? 38 : fish.behavior === 'boss' ? 58 : fish.behavior === 'surge' ? 22 : fish.behavior === 'glide' ? 16 : 28;
        const frequency = fish.behavior === 'drift' ? .8 : fish.behavior === 'ink' ? 2.1 : fish.behavior === 'boss' ? 1.25 : fish.behavior === 'dart' ? 3.2 : 1.55;
        fish.y = Math.max(fish.radius + 30, Math.min(CANVAS_HEIGHT - fish.radius - 30, fish.baseY + Math.sin(fish.age * frequency + fish.phase) * amplitude));
      });
      fishRef.current = fishRef.current.filter((fish) => fish.x > -fish.radius - 80 && fish.x < CANVAS_WIDTH + fish.radius + 80);
      targetsRef.current.forEach((targetId, hunterId) => {
        if (!targetId || !fishRef.current.some((fish) => fish.id === targetId)) {
          const species = lockSpeciesRef.current.get(hunterId);
          const replacement = species ? fishRef.current.find((fish) => fish.emoji === species) : null;
          targetsRef.current.set(hunterId, replacement?.id ?? null);
        }
      });

      bulletsRef.current.forEach((bullet) => {
        bullet.previousX = bullet.x; bullet.previousY = bullet.y;
        const target = bullet.targetId ? fishRef.current.find((fish) => fish.id === bullet.targetId) : null;
        if (target) { const angle = Math.atan2(target.y - bullet.y, target.x - bullet.x); bullet.vx = Math.cos(angle) * BULLET_SPEED; bullet.vy = Math.sin(angle) * BULLET_SPEED; }
        bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta;
      });
      const hitBullets = new Set<number>(); const caughtFish = new Set<number>();
      for (const bullet of bulletsRef.current) {
        for (const fish of fishRef.current) {
          if (caughtFish.has(fish.id) || bullet.hitFishIds.has(fish.id)) continue;
          if (distanceToSegment(fish.x, fish.y, bullet.previousX, bullet.previousY, bullet.x, bullet.y) <= fish.radius + 7) {
            bullet.hitFishIds.add(fish.id);
            bullet.remainingHits -= 1;
            if (bullet.remainingHits <= 0) hitBullets.add(bullet.id);
            if (bullet.weapon === 'Piercing') bullet.targetId = null;
            let damage = bullet.damage;
            if (fish.behavior === 'armored' && bullet.weapon !== 'Piercing') damage *= .65;
            fish.currentHp -= damage;
            fish.flashUntil = time + 95;
            if (bullet.weapon === 'Freeze') fish.slowUntil = Math.max(fish.slowUntil, time + 3000);
            if (!registeredHitShotsRef.current.has(bullet.shotId)) {
              registeredHitShotsRef.current.add(bullet.shotId);
              commitHunters((current) => current.map((hunter) => hunter.id === bullet.ownerId ? { ...hunter, hits: hunter.hits + 1 } : hunter));
            }
            for (let index = 0; index < 5; index += 1) particlesRef.current.push({ id: nextIdRef.current++, x: fish.x, y: fish.y, vx: (Math.random() - .5) * 180, vy: (Math.random() - .5) * 180, color: bullet.weapon === 'Freeze' ? '#a9f3ff' : bullet.color, size: 2 + Math.random() * 4, age: 0, life: .28 + Math.random() * .25 });
            shakeRef.current = Math.max(shakeRef.current, bullet.weapon === 'Torpedo' ? 4 : 2);
            if (fish.currentHp <= 0) { caughtFish.add(fish.id); awardFish(fish, bullet); }
            if (bullet.remainingHits <= 0) break;
          }
        }
      }
      bulletsRef.current = bulletsRef.current.filter((bullet) => !hitBullets.has(bullet.id) && bullet.x > -70 && bullet.x < CANVAS_WIDTH + 70 && bullet.y > -70 && bullet.y < CANVAS_HEIGHT + 70);
      fishRef.current = fishRef.current.filter((fish) => !caughtFish.has(fish.id));
      effectsRef.current.forEach((effect) => { effect.age += delta; }); effectsRef.current = effectsRef.current.filter((effect) => effect.age < 1.2);
      particlesRef.current.forEach((particle) => { particle.age += delta; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vx *= .96; particle.vy *= .96; });
      particlesRef.current = particlesRef.current.filter((particle) => particle.age < particle.life);
      shakeRef.current *= .82;

      comboRef.current.forEach((value, hunterId) => {
        if (value > 0 && time - (comboLastCatchRef.current.get(hunterId) ?? 0) > 5000) {
          comboRef.current.set(hunterId, 0);
          if (hunterId === activeHunterIdRef.current) setCombo(0);
        }
      });

      huntersRef.current.forEach((hunter) => {
        const shouldAutoFire = !hunter.isHuman || autoIdsRef.current.has(hunter.id);
        const due = hunter.isHuman ? (lastShotRef.current.get(hunter.id) ?? 0) + 430 : (botNextShotRef.current.get(hunter.id) ?? 0);
        if (!shouldAutoFire || time < due) return;
        let target = targetsRef.current.get(hunter.id) ? fishRef.current.find((fish) => fish.id === targetsRef.current.get(hunter.id)) : null;
        const lockedType = lockSpeciesRef.current.get(hunter.id);
        if (!target && lockedType) {
          target = fishRef.current.find((fish) => fish.emoji === lockedType);
          targetsRef.current.set(hunter.id, target?.id ?? null);
        }
        if (!target && lockedType && hunter.isHuman) return;
        if (!target) {
          const candidates = [...fishRef.current].sort((left, right) => (right.multiplier / right.hp) - (left.multiplier / left.hp));
          target = candidates[Math.min(candidates.length - 1, Math.floor(Math.random() * Math.min(5, candidates.length)))];
        }
        if (target) { aimsRef.current.set(hunter.id, { x: target.x, y: target.y }); launchShotRef.current(hunter.id, target.id); }
        if (!hunter.isHuman) botNextShotRef.current.set(hunter.id, time + 650 + Math.random() * 900);
      });
      if (time - lastCountUpdate > 450) {
        setFishCount(fishRef.current.length);
        setLockedTargetId(targetsRef.current.get(activeHunterIdRef.current) ?? null);
        setLockedSpecies(lockSpeciesRef.current.get(activeHunterIdRef.current) ?? null);
        setWaveSeconds(Math.max(0, Math.ceil(waveDuration(activeWave) - elapsedSeconds)));
        lastCountUpdate = time;
      }
      draw(time); animationFrame = requestAnimationFrame(update);
    };
    animationFrame = requestAnimationFrame(update);
    return () => {
      mountedRef.current = false; cancelAnimationFrame(animationFrame);
      fishRef.current = []; bulletsRef.current = []; effectsRef.current = []; particlesRef.current = []; payoutQueueRef.current = [];
    };
  }, [awardFish, commitHunters, isPlaying, resetOcean, spawnFish, spawnSpecial]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => setMission(current => {
      const next = current.seconds <= 1 ? createMission() : { ...current, seconds: current.seconds - 1 };
      missionRef.current = next;
      return next;
    }), 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return { x: (event.clientX - bounds.left) * (CANVAS_WIDTH / bounds.width), y: (event.clientY - bounds.top) * (CANVAS_HEIGHT / bounds.height) };
  };

  const handlePointer = (event: React.PointerEvent<HTMLCanvasElement>, fire: boolean) => {
    if (!activeHunter?.isHuman) return;
    const point = canvasPoint(event); if (!point) return;
    aimsRef.current.set(activeHunter.id, point);
    if (!fire) return;
    let targetId: number | null = null;
    if (lockEnabled) {
      const target = [...fishRef.current]
        .sort((left, right) => Math.hypot(point.x - left.x, point.y - left.y) - Math.hypot(point.x - right.x, point.y - right.y))
        .find((fish) => Math.hypot(point.x - fish.x, point.y - fish.y) <= fish.radius * 1.45);
      if (!target) {
        setStatus('Tap directly on a creature to start species auto-lock.');
        return;
      }
      targetId = target.id;
      targetsRef.current.set(activeHunter.id, targetId);
      lockSpeciesRef.current.set(activeHunter.id, target.emoji);
      setLockedTargetId(targetId);
      setLockedSpecies(target.emoji);
      setAutoIds((current) => current.includes(activeHunter.id) ? current : [...current, activeHunter.id]);
      setStatus(`${activeHunter.name} auto-locked ${FISH_NAMES[target.emoji]}. It will acquire the next one automatically.`);
    }
    launchShot(activeHunter.id, targetId);
  };

  const setCounts = (nextHumans: number, nextBots: number) => {
    const humans = Math.max(1, Math.min(4, nextHumans));
    const bots = Math.max(0, Math.min(4 - humans, nextBots));
    setHumanCount(humans); setBotCount(bots);
  };

  return (
    <section className="ocean-hunter">
      {!isPlaying ? (
        <div className="ocean-setup">
          <div className="ocean-kicker">MULTIPLAYER ARENA</div><h2>Ocean Hunter</h2>
          <p>Play alone or open up to four cannon stations. Computer hunters fill only the seats you choose.</p>
          <div className="ocean-counts">
            <label>LOCAL PLAYERS<strong>{humanCount}</strong><input type="range" min="1" max="4" value={humanCount} onChange={(event) => setCounts(Number(event.target.value), botCount)} /></label>
            <label>COMPUTER BOTS<strong>{botCount}</strong><input type="range" min="0" max={4 - humanCount} value={botCount} onChange={(event) => setCounts(humanCount, Number(event.target.value))} /></label>
          </div>
          <div className="ocean-names">{Array.from({ length: humanCount }, (_, index) => <input key={index} value={names[index]} aria-label={`Player ${index + 1} name`} onChange={(event) => setNames((current) => current.map((name, nameIndex) => nameIndex === index ? event.target.value : name))} />)}</div>
          <div className="ocean-loadout">
            <label>OCEAN<select value={environment} onChange={event => setEnvironment(event.target.value as typeof environment)}><option>Clear</option><option>Current</option><option>Darkness</option></select></label>
            <label>CANNON<select value={cannonSkin} onChange={event => setCannonSkin(event.target.value as typeof cannonSkin)}><option>Arcade</option><option>Neon</option><option>Gold</option></select></label>
          </div>
          <div className="arena-preview">{sidesForCount(totalPlayers).map((side, index) => <span key={side} style={{ color: HUNTER_COLORS[index] }}>{index < humanCount ? names[index] || `Player ${index + 1}` : `BOT ${index - humanCount + 1}`} · {side}</span>)}</div>
          <button type="button" onClick={startArena}>OPEN {totalPlayers}-PLAYER ARENA</button>
          <small>Local players share the selected Arcade Hub balance. Bot shots use bot points and never charge your balance.</small>
        </div>
      ) : (
        <>
          <header className="ocean-header"><div><div className="ocean-kicker">FOUR-STATION DEEP SEA ARENA</div><h2>Ocean Hunter</h2></div><div className="ocean-metrics"><span><small>Balance</small>{Math.floor(balance)} {currencySymbol}</span><span><small>Last win</small>{lastWin} {currencySymbol}</span><span><small>Targets</small>{fishCount}</span></div></header>
          <div className="hunter-scoreboard">{hunters.map((hunter) => <button key={hunter.id} type="button" disabled={!hunter.isHuman} className={hunter.id === activeHunterId ? 'active' : ''} style={{ '--hunter': hunter.color } as React.CSSProperties} onClick={() => { setActiveHunterId(hunter.id); setLockedTargetId(targetsRef.current.get(hunter.id) ?? null); setLockedSpecies(lockSpeciesRef.current.get(hunter.id) ?? null); setStatus(`${hunter.name} has control.`); }}><span>{hunter.name}<small>{hunter.isHuman ? 'PLAYER' : 'BOT'}</small></span><strong>{hunter.score}</strong><em>{hunter.catches} catches</em></button>)}</div>
          <div className={`ocean-wavebar ${wave % 4 === 0 ? 'boss-round' : ''}`}><span>WAVE {wave}</span><strong>{waveName(wave)}</strong><span>{waveSeconds}s</span></div>
          <div className="ocean-mission"><span>MISSION: {FISH_NAMES[mission.emoji]} {mission.progress}/{mission.goal} · BONUS {betAmount * 2} {currencySymbol}</span><strong>{mission.seconds}s</strong><span className={combo > 1 ? 'hot' : ''}>COMBO ×{combo}</span></div>
          {bossWarning && <div className="boss-warning">BOSS CREATURE APPROACHING</div>}
          <div className={`ocean-screen env-${environment.toLowerCase()}`}><canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onPointerMove={(event) => handlePointer(event, false)} onPointerDown={(event) => handlePointer(event, true)} aria-label="Ocean Hunter multiplayer arena" /><div className="ocean-hud"><span style={{ color: activeHunter?.color }}>{activeHunter?.name} CONTROL</span><span>{weapon.toUpperCase()} · {environment.toUpperCase()}</span><span>{lockedSpecies ? `AUTO: ${FISH_NAMES[lockedSpecies]}` : lockedTargetId ? 'TARGET LOCKED' : 'FREE AIM'}</span></div></div>
          <div className="ocean-status" role="status">{status}</div>
          <div className="ocean-controls">
            <div className="shot-power"><span>SHOT POWER</span><button type="button" disabled={isProcessing} onClick={() => setBetAmount(Math.max(10, betAmount - 10))}>−</button><strong>{betAmount} {currencySymbol}</strong><button type="button" disabled={isProcessing} onClick={() => setBetAmount(Math.min(100, betAmount + 10))}>+</button></div>
            <div className="ocean-actions"><select aria-label="Weapon" value={weapon} onChange={event => setWeapon(event.target.value as WeaponMode)}><option>Torpedo</option><option>Spread</option><option>Piercing</option><option>Freeze</option></select><button type="button" className={autoIds.includes(activeHunterId) ? 'selected' : ''} onClick={() => setAutoIds((current) => current.includes(activeHunterId) ? current.filter((id) => id !== activeHunterId) : [...current, activeHunterId])}>{autoIds.includes(activeHunterId) ? 'STOP AUTO' : 'AUTO FIRE'}</button><button type="button" className={lockEnabled ? 'selected lock' : ''} onClick={() => { const turningOff = lockEnabled; setLockEnabled(!turningOff); if (turningOff) { targetsRef.current.set(activeHunterId, null); lockSpeciesRef.current.set(activeHunterId, null); setLockedTargetId(null); setLockedSpecies(null); setStatus('Species auto-lock released.'); } else setStatus('Auto-lock ready. Tap a creature to track its species.'); }}>{lockEnabled ? lockedSpecies ? `LOCKED: ${FISH_NAMES[lockedSpecies]}` : 'SELECT TARGET' : 'AUTO LOCK'}</button><button type="button" onClick={resetOcean}>RESET OCEAN</button><button type="button" onClick={() => setShowSummary(value => !value)}>SCORECARD</button><button type="button" onClick={() => setIsPlaying(false)}>CHANGE PLAYERS</button></div>
          </div>
          {showSummary && <div className="ocean-summary">{hunters.map(hunter => <div key={hunter.id}><strong>{hunter.name}</strong><span>{hunter.score} pts</span><span>{hunter.catches} catches</span><span>{hunter.shots ? Math.round(hunter.hits / hunter.shots * 100) : 0}% accuracy</span></div>)}</div>}
          <p className="ocean-help"><strong>{weapon}:</strong> {weapon === 'Torpedo' ? 'heavy single-target damage and strong impact.' : weapon === 'Spread' ? 'three lower-powered shots covering a wide lane.' : weapon === 'Piercing' ? 'passes through as many as three different targets.' : 'slows a target for three seconds.'} Combos expire after five seconds without a catch.</p>
        </>
      )}

      <style>{`
        .ocean-hunter{width:100%;padding:18px;border:1px solid #25516a;border-radius:18px;background:linear-gradient(155deg,#071927,#0b2434);color:#eefaff;box-shadow:0 24px 65px rgba(0,0,0,.38)}.ocean-setup{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:680px;margin:28px auto;padding:28px;border:1px solid #28566d;border-radius:17px;background:#071a27;text-align:center}.ocean-kicker{color:#63d4ee;font-size:9px;font-weight:900;letter-spacing:.17em}.ocean-setup h2,.ocean-header h2{margin:2px 0 0;font-size:29px}.ocean-setup p{margin:0;color:#91aab7;font-size:13px}.ocean-counts{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%}.ocean-counts label{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px;border:1px solid #2b5267;border-radius:9px;color:#91aab7;text-align:left;font-size:9px;font-weight:900;letter-spacing:.1em}.ocean-counts label strong{color:#ffe16f;font-size:16px}.ocean-counts input{grid-column:1/-1;width:100%;accent-color:#56cbea}.ocean-names{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}.ocean-names input{min-width:0;padding:10px;border:1px solid #2b5267;border-radius:7px;outline:0;background:#0c2635;color:white}.ocean-loadout{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}.ocean-loadout label{display:grid;gap:5px;color:#74b9ce;font-size:8px;font-weight:900;letter-spacing:.12em;text-align:left}.ocean-loadout select{width:100%;padding:10px;border:1px solid #2b5267;border-radius:7px;background:#0c2635;color:white}.arena-preview{display:flex;flex-wrap:wrap;justify-content:center;gap:7px}.arena-preview span{padding:5px 8px;border:1px solid currentColor;border-radius:5px;background:#081722;font-size:9px;font-weight:900}.ocean-setup>button{width:100%;padding:14px;border:0;border-radius:9px;background:linear-gradient(#65dafa,#2a9dc2);box-shadow:0 5px 0 #15566c;color:#05232e;font-weight:950;cursor:pointer}.ocean-setup small{color:#708b99}.ocean-header{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:11px}.ocean-metrics{display:flex;gap:7px}.ocean-metrics span{min-width:88px;padding:6px 9px;border:1px solid #28536a;border-radius:7px;background:#081723;text-align:right;font-size:12px;font-weight:900}.ocean-metrics small{display:block;color:#7896a5;font-size:7px;letter-spacing:.1em}.hunter-scoreboard{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:8px}.hunter-scoreboard button{display:grid;grid-template-columns:1fr auto;gap:2px;padding:8px 10px;border:1px solid #294c5e;border-left:4px solid var(--hunter);border-radius:8px;background:#081924;color:#dcecf3;text-align:left;cursor:pointer}.hunter-scoreboard button:disabled{cursor:default}.hunter-scoreboard button.active{box-shadow:0 0 0 2px var(--hunter);background:#102b39}.hunter-scoreboard span,.hunter-scoreboard strong{font-size:11px;font-weight:900}.hunter-scoreboard span small{display:block;color:#6f8a98;font-size:7px}.hunter-scoreboard strong{color:var(--hunter);font-size:17px}.hunter-scoreboard em{grid-column:1/-1;color:#7593a1;font-size:8px;font-style:normal}.ocean-wavebar{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding:8px 12px;border:1px solid #3a7490;border-radius:8px;background:linear-gradient(90deg,#0b2d3d,#123f50,#0b2d3d);color:#9beeff;font-size:10px;font-weight:950;letter-spacing:.12em}.ocean-wavebar strong{color:#fff;font-size:12px}.ocean-wavebar.boss-round{border-color:#ff4f9c;background:linear-gradient(90deg,#3d0c28,#701342,#3d0c28);color:#ff9fc8;box-shadow:0 0 18px rgba(255,48,142,.25)}.ocean-mission{display:flex;justify-content:space-between;margin-bottom:7px;padding:6px 9px;border:1px solid #2d5d72;border-radius:7px;background:#081c28;color:#70d9ee;font-size:9px;font-weight:900}.ocean-mission strong{color:#ffe06b}.ocean-mission .hot{color:#ffdc58;text-shadow:0 0 10px #ff9d2e;animation:combo-pulse .5s infinite alternate}.boss-warning{padding:9px;border:1px solid #ff6696;background:#58162c;color:#ffd5e3;text-align:center;font-weight:950;animation:boss-flash .45s infinite alternate}.ocean-screen{position:relative;overflow:hidden;width:100%;aspect-ratio:12/7;border:8px solid #102d42;border-radius:14px;background:#032e47;box-shadow:inset 0 0 40px rgba(0,0,0,.8),0 15px 30px rgba(0,0,0,.3)}.ocean-screen.env-darkness:after{content:'';position:absolute;inset:0;pointer-events:none;background:rgba(0,8,18,.32)}.ocean-screen canvas{display:block;width:100%;height:100%;touch-action:none;cursor:crosshair}.ocean-hud{position:absolute;z-index:2;inset:9px 9px auto;display:flex;justify-content:space-between;pointer-events:none}.ocean-hud span{padding:4px 7px;border:1px solid rgba(118,206,235,.3);border-radius:5px;background:rgba(3,20,31,.72);color:#9eb6c2;font-size:8px;font-weight:900;letter-spacing:.08em}.ocean-status{min-height:39px;margin:10px 0;padding:9px 12px;border:1px solid #23485c;border-radius:8px;background:#071620;color:#c9e5ef;font-size:12px;text-align:center}.ocean-controls{display:flex;justify-content:space-between;align-items:center;gap:10px}.shot-power,.ocean-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.shot-power>span{color:#7f9dac;font-size:8px;font-weight:900;letter-spacing:.12em}.shot-power strong{min-width:90px;text-align:center;color:#ffe06a}.ocean-controls button,.ocean-controls select{padding:8px 10px;border:1px solid #2c5870;border-radius:7px;background:#102b3b;color:#d9edf5;font-size:10px;font-weight:850;cursor:pointer}.ocean-controls button:disabled{opacity:.45}.ocean-controls button.selected{background:#154c42;border-color:#42bd8d;color:#9bf2cf}.ocean-controls button.selected.lock{background:#5a4215;border-color:#d9a72d;color:#ffe28a}.ocean-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px}.ocean-summary div{display:grid;padding:8px;border:1px solid #28536a;border-radius:8px;background:#071823;color:#83a1b0;font-size:9px}.ocean-summary strong{color:#ffe06a;font-size:11px}.ocean-help{margin:11px 0 0;color:#7895a4;font-size:10px;text-align:center}.ocean-help strong{color:#9fe8fa}@keyframes boss-flash{to{filter:brightness(1.5)}}@keyframes combo-pulse{to{transform:scale(1.08)}}@media(max-width:780px){.ocean-hunter{padding:10px}.ocean-header{align-items:flex-start;flex-direction:column}.hunter-scoreboard,.ocean-summary{grid-template-columns:1fr 1fr}.ocean-controls{align-items:stretch;flex-direction:column}.shot-power,.ocean-actions{justify-content:center}}@media(max-width:470px){.ocean-counts,.ocean-names,.ocean-loadout{grid-template-columns:1fr}.ocean-metrics span{min-width:70px;font-size:10px}.ocean-screen{border-width:4px}.ocean-wavebar{font-size:8px;padding:6px}.ocean-wavebar strong{font-size:9px}.hunter-scoreboard button{padding:6px}.ocean-hud span:nth-child(2){display:none}}
      `}</style>
    </section>
  );
};

export default OceanHunterGame;
