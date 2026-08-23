import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CurrencyMode } from '../../types';
import { useCoinSystem } from '../../context/CoinContext';
import SlotsMachine3D from './SlotsMachine3D';

const REEL_COUNT = 5;
const VISIBLE_SYMBOLS = 3;
const SYMBOL_HEIGHT = 96;
const STRIP_LENGTH = 32;
const BONUS = '🪙';
const SCATTER = '⭐';
const WILD = '🚀';
const SYMBOL_WEIGHTS: Array<[string, number]> = [
  ['🍋', 20], ['🍇', 18], ['🍒', 16], ['🧠', 13], ['🔔', 10], ['🎰', 8],
  ['💎', 6], ['7️⃣', 4], [WILD, 4], [BONUS, 4], [SCATTER, 4]
];
const SYMBOL_POOL = SYMBOL_WEIGHTS.flatMap(([symbol, weight]) => Array.from({ length: weight }, () => symbol));

type SlotThemeId = 'volt' | 'pig' | 'chicken' | 'angels' | 'devil' | 'crypt';
type SlotTheme = { name: string; kicker: string; symbols: string[]; accent: string; bonus: string; lines: number; payoutScale: number };
const SLOT_THEMES: Record<SlotThemeId, SlotTheme> = {
  volt: { name: 'Volt Vault', kicker: 'PREMIUM 5×3 SLOTS', symbols: ['🍋','🍇','🍒','🧠','🔔','🎰','💎','7️⃣'], accent: '#ec50ff', bonus: 'HOLD & SPIN VAULT', lines: 7, payoutScale: 1, spinStyle: 'standard', bonusMode: 'vault' },
  pig: { name: 'Piggy Bank Bonanza', kicker: 'LUCKY 5×3 SLOTS', symbols: ['🐷','💰','🍀','🥓','🍎','🎩','💎','7️⃣'], accent: '#ff6d9e', bonus: 'PIGGY BANK BREAKER', lines: 5, payoutScale: 1.1, spinStyle: 'bounce', bonusMode: 'breaker' },
  chicken: { name: 'Cluck & Cash', kicker: 'FARMYARD 5×3 SLOTS', symbols: ['🐔','🥚','🌽','🌾','🐣','🪶','💎','7️⃣'], accent: '#ffd34f', bonus: 'GOLDEN EGG PICK', lines: 6, payoutScale: 1.15, spinStyle: 'cascade', bonusMode: 'egg' },
  angels: { name: 'Angels & Aces', kicker: 'CELESTIAL 5×3 SLOTS', symbols: ['😇','👼','✨','☁️','💍','🪽','💎','7️⃣'], accent: '#8fdcff', bonus: 'HEAVENLY LADDER', lines: 7, payoutScale: 1.25, spinStyle: 'pulse', bonusMode: 'ladder' },
  devil: { name: 'Devil’s Inferno', kicker: 'INFERNO 5×3 SLOTS', symbols: ['😈','🔥','🌋','🩸','🦂','⛓️','💎','7️⃣'], accent: '#ff4e5e', bonus: 'HELLFIRE RESPINS', lines: 5, payoutScale: 1.35, spinStyle: 'rush', bonusMode: 'respin' },
  crypt: { name: 'Vampires vs Werewolves', kicker: 'BLOOD MOON 5×3 SLOTS', symbols: ['🧛','🐺','🌕','🩸','🦇','🐾','💎','7️⃣'], accent: '#b46cff', bonus: 'BLOOD MOON DUEL', lines: 6, payoutScale: 1.45, spinStyle: 'duel', bonusMode: 'duel' },
};

const PAYLINE_SETS: Record<SlotThemeId, number[][]> = {
  volt: [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0],
  ],
  pig: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2]],
  chicken: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2]],
  angels: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0]],
  devil: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2]],
  crypt: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 0, 1, 2, 1]],
};

const PAYOUTS: Record<string, Record<number, number>> = {
  [WILD]: { 3: 81, 4: 337.5, 5: 1687.5 }, '7️⃣': { 3: 54, 4: 202.5, 5: 810 },
  '💎': { 3: 40.5, 4: 135, 5: 540 }, '🎰': { 3: 27, 4: 81, 5: 337.5 },
  '🔔': { 3: 20.25, 4: 54, 5: 202.5 }, '🧠': { 3: 13.5, 4: 40.5, 5: 135 },
  '🍒': { 3: 10.13, 4: 27, 5: 81 }, '🍇': { 3: 8.1, 4: 20.25, 5: 60.75 },
  '🍋': { 3: 6.75, 4: 16.88, 5: 47.25 }
};

type Phase = 'IDLE' | 'SPINNING' | 'BONUS' | 'WIN';
type ReelState = { symbols: string[]; offset: number; duration: number; spinning: boolean };
type WinningLine = { positions: [number, number][]; amount: number };
type WinInfo = { winningPaylines: WinningLine[]; totalWin: number };
type Round = { currency: CurrencyMode; lineBet: number; baseWin: number; winningLines: WinningLine[] };
type Celebration = { title: string; amount: number };

const randomSymbol = () => SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];
const bonusValue = (lineBet: number) => [1, 1, 1, 2, 2, 3, 3, 5, 8, 15][Math.floor(Math.random() * 10)] * lineBet * .5;
const freshReels = (pool = SYMBOL_POOL): ReelState[] => Array.from({ length: REEL_COUNT }, () => ({
  symbols: Array.from({ length: VISIBLE_SYMBOLS }, () => pool[Math.floor(Math.random() * pool.length)]), offset: 0, duration: 0, spinning: false
}));

const SlotsGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode, funCoins, realCoins, isProcessing } = useCoinSystem();
  const [betPerLine, setBetPerLine] = useState(2);
  const [themeId, setThemeId] = useState<SlotThemeId>('volt');
  const [reels, setReels] = useState<ReelState[]>(freshReels);
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [status, setStatus] = useState('Charge the Power Meter and chase two different bonus games.');
  const [winInfo, setWinInfo] = useState<WinInfo | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [power, setPower] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [anticipation, setAnticipation] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [bonusCells, setBonusCells] = useState<(number | null)[]>(Array(15).fill(null));
  const [respins, setRespins] = useState(3);
  const [bonusRolling, setBonusRolling] = useState(false);
  const [bonusStep, setBonusStep] = useState(0);
  const timersRef = useRef<number[]>([]);
  const mountedRef = useRef(true);
  const bonusCellsRef = useRef<(number | null)[]>(Array(15).fill(null));
  const bonusRoundRef = useRef<Round | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const reduceMotionRef = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const symbol = currencyMode === 'fun' ? 'FC' : 'RC';
  const balance = currencyMode === 'fun' ? funCoins : realCoins;
  const slotTheme = SLOT_THEMES[themeId];
  const themePool = useMemo(() => slotTheme.symbols.flatMap((item, index) => Array.from({ length: Math.max(4, 20 - index * 2) }, () => item)).concat([WILD, BONUS, SCATTER]), [slotTheme]);
  const activePaylines = PAYLINE_SETS[themeId].slice(0, slotTheme.lines);
  const bonusTitle = slotTheme.bonusMode === 'breaker' ? 'PIGGY BANK BREAKER' : slotTheme.bonusMode === 'egg' ? 'GOLDEN EGG PICK' : slotTheme.bonusMode === 'ladder' ? 'HEAVENLY LADDER' : slotTheme.bonusMode === 'respin' ? 'HELLFIRE RESPINS' : slotTheme.bonusMode === 'duel' ? 'BLOOD MOON DUEL' : 'HOLD & SPIN VAULT';
  const bonusInstruction = slotTheme.bonusMode === 'breaker' ? 'Break through the bank for faster coin drops.' : slotTheme.bonusMode === 'egg' ? 'Golden eggs are rarer, but every hit can hatch a bigger prize.' : slotTheme.bonusMode === 'ladder' ? 'Each quiet respin climbs the value ladder.' : slotTheme.bonusMode === 'respin' ? 'Four respins give the inferno more chances to fill.' : slotTheme.bonusMode === 'duel' ? 'The blood moon duel adds a 1.35× feature multiplier.' : 'Fill all 15 spaces to double the entire vault.';
  const activePayouts = useMemo(() => {
    const baseKeys = Object.keys(PAYOUTS);
    const payouts: Record<string, Record<number, number>> = {};
    slotTheme.symbols.forEach((item, index) => { const source = PAYOUTS[baseKeys[Math.min(index, baseKeys.length - 1)]]; payouts[item] = Object.fromEntries(Object.entries(source).map(([count, value]) => [count, Number((value * slotTheme.payoutScale).toFixed(2))])); });
    payouts[WILD] = Object.fromEntries(Object.entries(PAYOUTS[WILD]).map(([count, value]) => [count, Number((value * slotTheme.payoutScale).toFixed(2))]));
    return payouts;
  }, [slotTheme]);
  const totalBet = betPerLine * activePaylines.length;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => { clearTimers(); setReels(freshReels(themePool)); setPhase('IDLE'); setWinInfo(null); setCelebration(null); setStatus(`${slotTheme.bonus} is ready. Pick a line and spin.`); }, [clearTimers, slotTheme.bonus, themeId, themePool]);
  const schedule = useCallback((fn: () => void, delay: number) => {
    const timer = window.setTimeout(fn, delay);
    timersRef.current.push(timer);
  }, []);
  const playSlotSfx = useCallback((type: 'spin' | 'stop' | 'line' | 'jackpot' | 'bonus' | 'respin') => {
    try {
      const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioClass) return;
      const ctx = audioRef.current ?? new AudioClass();
      audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;

      if (type === 'spin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.05);
      } else if (type === 'stop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.08);
      } else if (type === 'line') {
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.08, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.08 + 0.12);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.12);
        });
      } else if (type === 'jackpot') {
        [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.12, now + idx * 0.1);
          gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.25);
        });
      } else if (type === 'bonus' || type === 'respin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.25);
      }
    } catch { /* visual play remains available */ }
  }, []);

  const tone = useCallback((frequency: number, duration = 0.1, volume = 0.035) => {
    playSlotSfx('line');
  }, [playSlotSfx]);

  const celebrate = useCallback((title: string, amount: number) => {
    setCelebration({ title, amount });
    tone(659, .18, .06); schedule(() => tone(784, .22, .06), 130);
    schedule(() => setCelebration(null), 2600);
  }, [schedule, tone]);

  const finishWin = useCallback(async (amount: number, lines: WinningLine[], roundCurrency: CurrencyMode, label: string) => {
    if (!amount) {
      setLastWin(0); setWinInfo(null); setPhase('IDLE'); setStatus(label); return;
    }
    const credited = await addCoins(amount, 'Slots Win', roundCurrency);
    if (!mountedRef.current) return;
    if (!credited) { setPhase('IDLE'); setAutoSpin(false); setStatus('The virtual-credit update could not be applied.'); return; }
    setLastWin(amount); setWinInfo({ winningPaylines: lines, totalWin: amount }); setPhase('WIN');
    setStatus(label);
    if (amount >= totalBet * 10) celebrate(amount >= totalBet * 30 ? 'MEGA WIN' : 'BIG WIN', amount);
    else tone(587, .18, .05);
  }, [addCoins, celebrate, tone, totalBet]);

  const evaluate = useCallback(async (layout: string[][], round: Round, multiplier: number, wasFree: boolean) => {
    let total = 0;
    const lines: WinningLine[] = [];
    for (const line of activePaylines) {
      const symbols = line.map((row, column) => layout[column][row]);
      const target = symbols.find((item) => item !== WILD) || WILD;
      let matches = 0;
      for (const item of symbols) { if (item === target || item === WILD) matches += 1; else break; }
      const payout = activePayouts[target]?.[matches];
      if (matches >= 3 && payout) {
        const amount = payout * round.lineBet * multiplier;
        total += amount;
        lines.push({ positions: line.slice(0, matches).map((row, column) => [column, row]), amount });
      }
    }

    const scatterCount = layout.flat().filter((item) => item === SCATTER).length;
    let awardedSpins = 0;
    if (scatterCount >= 3) {
      awardedSpins = wasFree ? 2 : 6;
      setFreeSpins((current) => current + awardedSpins);
      total += totalBet * (scatterCount - 2) * multiplier;
    }

    const bonusCount = layout.flat().filter((item) => item === BONUS).length;
    if (bonusCount >= 3) {
      const held = Array.from({ length: 15 }, (_, index) => {
        const row = Math.floor(index / 5); const reel = index % 5;
        return layout[reel][row] === BONUS ? bonusValue(round.lineBet) : null;
      });
      bonusCellsRef.current = held;
      bonusRoundRef.current = { ...round, baseWin: total, winningLines: lines };
      setBonusCells(held); setRespins(slotTheme.bonusMode === 'respin' ? 4 : 3); setBonusRolling(false); setBonusStep(0); setWinInfo(null); setPhase('BONUS');
      setStatus(`${bonusCount} ${slotTheme.bonusMode === 'egg' ? 'eggs' : 'bonus symbols'} locked — ${slotTheme.bonus} begins!`); tone(523, .25, .06); return;
    }

    const featureText = awardedSpins ? ` ${awardedSpins} FREE SPINS AWARDED!` : '';
    await finishWin(total, lines, round.currency, total ? `Won ${total} ${round.currency === 'fun' ? 'FC' : 'RC'}!${featureText}` : `No line win.${featureText || ' Power meter advanced.'}`);
  }, [activePaylines, activePayouts, finishWin, tone, totalBet]);

  const spin = useCallback(async () => {
    if (phase === 'SPINNING' || phase === 'BONUS' || isProcessing) return;
    const freeRound = freeSpins > 0;
    const powerSpin = !freeRound && power >= 5;
    const multiplier = freeRound || powerSpin ? 1.5 : 1;
    if (!freeRound && !canBet(totalBet)) { setStatus(`You need ${totalBet} ${symbol} to spin.`); setAutoSpin(false); return; }

    clearTimers(); setCelebration(null); setAnticipation(false); setWinInfo(null); setLastWin(0);
    const roundCurrency = currencyMode;
    if (!freeRound) {
      setStatus(powerSpin ? 'POWER SPIN charged — 1.5× wins and a guaranteed wild!' : 'Confirming spin…');
      const charged = await subtractCoins(totalBet, 'Slots Spin', roundCurrency);
      if (!charged || !mountedRef.current) { setStatus('The spin was not charged.'); setAutoSpin(false); return; }
      setPower(powerSpin ? 0 : Math.min(5, power + 1));
    } else {
      setFreeSpins((current) => Math.max(0, current - 1));
      setStatus(`FREE SPIN — 1.5× all line wins · ${Math.max(0, freeSpins - 1)} remaining`);
    }

    const layout = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => themePool[Math.floor(Math.random() * themePool.length)]));
    if (powerSpin) layout[Math.floor(Math.random() * 5)][1] = WILD;
    const bonusChance = layout.flat().filter((item) => item === BONUS).length >= 2 || layout.flat().filter((item) => item === SCATTER).length >= 2;
    setAnticipation(bonusChance);
    const rolling = layout.map((finalSymbols, index) => ({
      symbols: [...Array.from({ length: STRIP_LENGTH }, () => themePool[Math.floor(Math.random() * themePool.length)]), ...finalSymbols], offset: 0,
      duration: reduceMotionRef.current ? .12 + index * .03 : 1.75 + index * .2 + (bonusChance && index === 4 ? .7 : 0), spinning: true
    }));
    setPhase('SPINNING'); setReels(rolling); tone(145, .11, .045);
    schedule(() => setReels((current) => current.map((reel) => ({ ...reel, offset: STRIP_LENGTH * SYMBOL_HEIGHT }))), 60);
    rolling.forEach((reel, index) => schedule(() => {
      tone(210 + index * 48, .07, .025);
      setReels((current) => current.map((item, reelIndex) => reelIndex === index ? { ...item, spinning: false } : item));
      if (bonusChance && index === 3) setStatus('BONUS CHANCE — final reel!');
      if (index === 4) {
        setAnticipation(false); setReels(layout.map((symbols) => ({ symbols, offset: 0, duration: 0, spinning: false })));
        void evaluate(layout, { currency: roundCurrency, lineBet: betPerLine, baseWin: 0, winningLines: [] }, multiplier, freeRound);
      }
    }, reel.duration * 1000 + 80));
  }, [betPerLine, canBet, clearTimers, currencyMode, evaluate, freeSpins, isProcessing, phase, power, schedule, subtractCoins, symbol, themePool, tone, totalBet]);

  useEffect(() => {
    if (phase !== 'BONUS' || bonusRolling) return;
    const round = bonusRoundRef.current;
    if (!round) return;
    setBonusRolling(true); setStatus(`Hold & Spin — ${respins} respin${respins === 1 ? '' : 's'} left.`);
    const timer = window.setTimeout(async () => {
      const current = bonusCellsRef.current; let landed = 0;
      const chance = slotTheme.bonusMode === 'breaker' ? .18 : slotTheme.bonusMode === 'egg' ? .1 : .12;
      const next = current.map((value) => { if (value !== null || Math.random() >= chance) return value; landed += 1; return bonusValue(round.lineBet) * (slotTheme.bonusMode === 'ladder' ? 1 + bonusStep * .2 : 1); });
      bonusCellsRef.current = next; setBonusCells(next);
      const remaining = landed ? 3 : respins - 1;
      setRespins(remaining); setBonusRolling(false);
      if (landed) tone(620, .14, .05);
      if (remaining > 0) { setStatus(landed ? `${landed} new coin${landed === 1 ? '' : 's'} — respins reset!` : `${remaining} respins remain.`); setBonusStep((step) => step + 1); return; }
      const rawBonus = next.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      const fullBoard = next.every((value) => value !== null);
      const bonusMultiplier = fullBoard ? 2 : slotTheme.bonusMode === 'duel' ? 1.35 : slotTheme.bonusMode === 'ladder' ? 1 + bonusStep * .1 : 1;
      const bonusWin = rawBonus * bonusMultiplier;
      const grandTotal = round.baseWin + bonusWin;
      const credited = await addCoins(grandTotal, 'Slots Hold & Spin Win', round.currency);
      if (!mountedRef.current) return;
      if (!credited) { setPhase('IDLE'); setAutoSpin(false); setStatus('The bonus credit could not be applied.'); return; }
      setLastWin(grandTotal); setWinInfo({ winningPaylines: round.winningLines, totalWin: grandTotal }); setPhase('WIN');
      setStatus(`${fullBoard ? 'FULL BOARD 2×! ' : ''}${slotTheme.bonus} won ${grandTotal} ${round.currency === 'fun' ? 'FC' : 'RC'}!`);
      celebrate(fullBoard ? 'FULL BOARD' : grandTotal >= totalBet * 10 ? 'BONUS WIN' : 'FEATURE WIN', grandTotal);
    }, reduceMotionRef.current ? 40 : 820);
    timersRef.current.push(timer);
    return () => window.clearTimeout(timer);
  }, [addCoins, bonusStep, celebrate, phase, respins, tone, totalBet]);

  useEffect(() => {
    if (phase === 'SPINNING' || phase === 'BONUS') return;
    if (!autoSpin && freeSpins <= 0) return;
    const timer = window.setTimeout(() => void spin(), freeSpins > 0 ? 1150 : phase === 'WIN' ? 1700 : 700);
    return () => window.clearTimeout(timer);
  }, [autoSpin, freeSpins, phase, spin]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; clearTimers(); void audioRef.current?.close(); }; }, [clearTimers]);

  const winningCell = (reel: number, row: number) => Boolean(winInfo?.winningPaylines.some((line) => line.positions.some(([column, lineRow]) => column === reel && lineRow === row)));
  const winningPositions = winInfo?.winningPaylines.flatMap((line) => line.positions.map(([column, row]) => `${column}-${row}`)) ?? [];

  return (
    <section className={`volt-slots slot-theme-${themeId}${anticipation ? ' anticipating' : ''}`} style={{ '--slot-accent': slotTheme.accent } as React.CSSProperties}>
      <header className="volt-header"><div><span>{slotTheme.kicker} · {slotTheme.lines} ACTIVE LINES</span><h2>{slotTheme.name}</h2></div><div className="volt-metrics"><span><small>BALANCE</small>{Math.floor(balance)} {symbol}</span><span><small>BET</small>{totalBet} {symbol}</span><span><small>LAST WIN</small>{lastWin} {symbol}</span></div></header>
      <div className="slot-theme-picker" aria-label="Choose a slot theme">{(Object.keys(SLOT_THEMES) as SlotThemeId[]).map((id) => <button type="button" className={themeId === id ? 'active' : ''} key={id} onClick={() => setThemeId(id)}>{SLOT_THEMES[id].name}</button>)}</div>
      <div className="feature-ribbon"><div><b>🪙 {slotTheme.bonus}</b><small>3+ COINS · FEATURE RESPINS</small></div><div><b>⭐ FREE SPINS</b><small>3+ STARS · 6 SPINS AT 1.5×</small></div><div className={power >= 5 ? 'ready' : ''}><b>⚡ POWER SPIN</b><small>{power >= 5 ? 'READY · 1.5× + WILD' : `${power}/5 CHARGED`}</small></div></div>
      <div className="volt-machine">
        <div className="volt-lights" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} />)}</div>
        {freeSpins > 0 && <div className="free-spin-banner"><strong>FREE SPINS ACTIVE</strong><span>{freeSpins} REMAINING · ALL LINE WINS 1.5×</span></div>}
        {phase === 'BONUS' ? <div className={`vault-board${bonusRolling ? ' rolling' : ''}`}><div className="vault-title"><span>{bonusTitle}</span><strong>{respins} RESPINS</strong></div><div className="vault-grid">{bonusCells.map((value, index) => <div key={index} className={value !== null ? 'held' : ''}>{value !== null ? <><span>🪙</span><strong>{value}</strong><small>{symbol}</small></> : <i>+</i>}</div>)}</div><p>{bonusInstruction}</p></div> : (
          <div className="slots-stage h-[470px] w-full overflow-hidden rounded-xl"><SlotsMachine3D reels={reels} winningPositions={winningPositions} anticipation={anticipation} theme={themeId} spinStyle={slotTheme.spinStyle} disabled={phase === 'SPINNING' || isProcessing} onSpin={() => void spin()} /></div>
        )}
        {celebration && <div className="win-celebration"><small>{celebration.title}</small><strong>{celebration.amount}</strong><span>{symbol}</span></div>}
        <div className="volt-status" role="status" aria-live="polite">{status}</div>
      </div>
      <div className="power-meter"><span>POWER METER</span><div>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < power ? 'filled' : ''} />)}</div><b>{power >= 5 ? 'READY' : `${power}/5`}</b></div>
      <div className="volt-controls"><div className="bet-stepper"><span>LINE BET</span><button disabled={phase === 'SPINNING' || phase === 'BONUS' || freeSpins > 0} onClick={() => setBetPerLine(Math.max(1, betPerLine - 1))}>−</button><strong>{betPerLine}</strong><button disabled={phase === 'SPINNING' || phase === 'BONUS' || freeSpins > 0} onClick={() => setBetPerLine(Math.min(100, betPerLine + 1))}>+</button></div><div className="spin-actions"><button className={autoSpin ? 'auto active' : 'auto'} onClick={() => setAutoSpin((value) => !value)}>{autoSpin ? 'STOP AUTO' : 'AUTO SPIN'}</button><button className="main-spin" disabled={phase === 'SPINNING' || phase === 'BONUS' || isProcessing || freeSpins > 0} onClick={() => void spin()}>{phase === 'SPINNING' ? 'ROLLING…' : phase === 'BONUS' ? 'BONUS…' : freeSpins > 0 ? 'FREE SPINS' : power >= 5 ? 'POWER SPIN' : 'SPIN'}</button></div></div>
      <div className="volt-paytable">{[WILD, ...slotTheme.symbols.slice(-4)].map((item) => <div key={item}><span>{item}</span><small>3× {activePayouts[item]?.[3] ?? 0} · 4× {activePayouts[item]?.[4] ?? 0} · 5× {activePayouts[item]?.[5] ?? 0}</small></div>)}</div>
      <style>{`
        .volt-slots{width:100%;padding:18px;border:1px solid #5c3a77;border-radius:20px;background:radial-gradient(circle at 50% -10%,#59277a,#160d26 48%,#08070c);color:#fff5ff;box-shadow:0 28px 70px rgba(0,0,0,.48);user-select:none}.volt-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:12px}.volt-header>div:first-child>span{color:#df9cff;font-size:9px;font-weight:950;letter-spacing:.19em}.volt-header h2{margin:2px 0 0;font-size:31px;font-style:italic;letter-spacing:.04em;text-shadow:0 0 20px #d357ff}.volt-metrics{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.volt-metrics span{min-width:90px;padding:7px 9px;border:1px solid #694782;border-radius:8px;background:#110a1a;text-align:right;font-size:13px;font-weight:950}.volt-metrics small{display:block;color:#a58aaf;font-size:7px;letter-spacing:.1em}.feature-ribbon{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:9px}.feature-ribbon div{padding:8px;border:1px solid #574064;border-radius:8px;background:linear-gradient(#261532,#140c1d);text-align:center}.feature-ribbon b,.feature-ribbon small{display:block}.feature-ribbon b{color:#f2d4ff;font-size:9px}.feature-ribbon small{margin-top:2px;color:#8e7898;font-size:7px}.feature-ribbon .ready{border-color:#ffcc52;background:linear-gradient(#5d3a0c,#241506);box-shadow:0 0 15px rgba(255,200,65,.28)}.feature-ribbon .ready b{color:#ffe37f}.volt-machine{position:relative;overflow:hidden;padding:11px;border:1px solid #815c96;border-radius:15px;background:linear-gradient(#321b40,#0b0810);box-shadow:inset 0 0 40px #000,0 16px 34px rgba(0,0,0,.38)}.volt-lights{display:flex;justify-content:space-between;padding:0 2px 9px}.volt-lights i{width:7px;height:7px;border-radius:50%;background:#e84582;box-shadow:0 0 8px #e84582;animation:volt-light .8s steps(2) infinite}.volt-lights i:nth-child(even){animation-delay:.4s}.anticipating .volt-lights i{background:#ffd653;box-shadow:0 0 14px #ffd653;animation-duration:.22s}.free-spin-banner{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px;padding:8px 11px;border:1px solid #f2d361;border-radius:7px;background:linear-gradient(90deg,#62470b,#b67d11,#62470b);box-shadow:0 0 18px rgba(255,214,79,.3);font-size:9px;letter-spacing:.08em}.free-spin-banner span{color:#fff0aa}.reel-deck{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:8px;border:1px solid #3b2948;border-radius:11px;background:#070609;perspective:800px}.reel-deck:after{content:'';position:absolute;z-index:8;inset:8px;pointer-events:none;border-radius:8px;background:linear-gradient(rgba(255,255,255,.24),transparent 19%,transparent 77%,rgba(20,8,25,.42)),radial-gradient(ellipse,transparent 42%,rgba(7,3,10,.28));box-shadow:inset 0 22px 28px rgba(255,255,255,.1),inset 0 -28px 32px rgba(14,3,20,.42)}.volt-reel{position:relative;height:${SYMBOL_HEIGHT * 3}px;overflow:hidden;border:1px solid #96889d;border-radius:8px;background:#f4f0f5;box-shadow:inset 9px 0 14px rgba(0,0,0,.2),inset -9px 0 14px rgba(0,0,0,.2);perspective:330px}.volt-reel:before,.volt-reel:after{content:'';position:absolute;z-index:5;left:0;right:0;height:27%;pointer-events:none}.volt-reel:before{top:0;background:linear-gradient(rgba(30,20,33,.62),transparent)}.volt-reel:after{bottom:0;background:linear-gradient(transparent,rgba(30,20,33,.68))}.volt-track{will-change:transform;transform-style:preserve-3d}.volt-symbol{display:grid;place-items:center;height:${SYMBOL_HEIGHT}px;border-bottom:1px solid rgba(55,35,61,.16);background:linear-gradient(90deg,#c8c2cb,#fff 25%,#fff 50%,#eeeaf0 76%,#bbb4bf);font-size:clamp(34px,7vw,63px);line-height:1;backface-visibility:hidden;transform-style:preserve-3d}.volt-symbol span{filter:drop-shadow(0 5px 4px rgba(0,0,0,.3));transform:translateZ(14px)}.volt-symbol.top{transform-origin:50% 100%;transform:rotateX(-20deg) translateZ(-9px) scaleY(.93);filter:brightness(.82)}.volt-symbol.center{transform:translateZ(8px) scale(1.025);filter:brightness(1.08)}.volt-symbol.bottom{transform-origin:50% 0;transform:rotateX(20deg) translateZ(-9px) scaleY(.93);filter:brightness(.78)}.volt-symbol.winner{background:radial-gradient(circle,#fff8ad,#ffd653 48%,#f1b51e);animation:symbol-win .55s infinite alternate}.anticipating .volt-reel:last-child{border-color:#ffd653;box-shadow:0 0 22px #eeb833,inset 0 0 15px rgba(255,213,83,.4)}.volt-status{min-height:40px;padding:11px 5px 1px;text-align:center;color:#decce5;font-size:13px}.win-celebration{position:absolute;z-index:20;inset:42px 8% auto;display:grid;place-items:center;padding:22px;border:2px solid #ffe774;border-radius:15px;background:radial-gradient(circle,rgba(117,54,145,.96),rgba(18,7,29,.97));box-shadow:0 0 50px #e05dff;animation:celebration-in .35s cubic-bezier(.2,1.4,.4,1)}.win-celebration small{color:#ffe67a;font-size:16px;font-weight:950;letter-spacing:.18em}.win-celebration strong{font-size:58px;line-height:1;text-shadow:0 0 25px #fff}.win-celebration span{color:#dcaff0;font-weight:900}.vault-board{padding:11px;border:1px solid #c6952f;border-radius:10px;background:radial-gradient(circle,#54340a,#160d05);box-shadow:inset 0 0 42px #000}.vault-title{display:flex;justify-content:space-between;padding:2px 4px 10px;color:#ffdb65;font-size:10px;font-weight:950;letter-spacing:.13em}.vault-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.vault-grid>div{position:relative;display:grid;place-items:center;min-height:82px;border:1px dashed #675230;border-radius:9px;background:rgba(8,5,3,.65);color:#604d31}.vault-grid>div.held{border:2px solid #ffd45a;background:radial-gradient(circle,#fff2aa,#dfa323 43%,#74420b 78%);box-shadow:0 0 16px rgba(255,205,73,.55);color:#3e2304}.vault-grid span{font-size:35px}.vault-grid strong{position:absolute;font-size:14px}.vault-grid small{position:absolute;margin-top:31px;font-size:7px;font-weight:950}.vault-grid i{font-style:normal;font-size:20px}.vault-board.rolling .vault-grid>div:not(.held){animation:vault-roll .2s infinite alternate}.vault-board p{margin:9px 0 0;color:#9e7f42;text-align:center;font-size:8px}.power-meter{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin:12px 0;padding:9px 12px;border:1px solid #4e3960;border-radius:9px;background:#100a17}.power-meter>span,.power-meter>b{font-size:9px;font-weight:950;letter-spacing:.1em}.power-meter>span{color:#b18fc1}.power-meter>b{color:#ffd85d}.power-meter>div{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.power-meter i{height:8px;border-radius:4px;background:#2e2236}.power-meter i.filled{background:linear-gradient(90deg,#ffb62e,#ffe565);box-shadow:0 0 9px #ffc849}.volt-controls{display:flex;justify-content:space-between;align-items:center;gap:14px}.bet-stepper,.spin-actions{display:flex;align-items:center;gap:8px}.bet-stepper>span{color:#a88eb4;font-size:9px;font-weight:900}.volt-controls button{padding:10px 13px;border:1px solid #5c426d;border-radius:8px;background:#25162f;color:#f4e7f9;font-weight:900;cursor:pointer}.volt-controls button:disabled{opacity:.5;cursor:not-allowed}.bet-stepper strong{min-width:36px;text-align:center;color:#ffdb61}.spin-actions .auto.active{border-color:#4cd69c;background:#154b39}.spin-actions .main-spin{min-width:150px;padding:14px 24px;border-color:#f0b438;background:linear-gradient(#ffe166,#e38b1c);box-shadow:0 5px 0 #87500d;color:#321e07;font-size:16px;font-weight:950}.spin-actions .main-spin:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0 #87500d}.volt-paytable{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:11px}.volt-paytable div{display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 4px;border:1px solid #3b2b46;border-radius:7px;background:#100b16}.volt-paytable span{font-size:23px}.volt-paytable small{color:#a58fae;font-size:8px}@keyframes volt-light{50%{opacity:.28}}@keyframes symbol-win{to{filter:brightness(1.25);box-shadow:inset 0 0 28px rgba(255,225,81,.8)}}@keyframes vault-roll{to{background:rgba(255,205,73,.12);border-color:#a8843d}}@keyframes celebration-in{from{opacity:0;transform:scale(.45) rotate(-4deg)}}@media(max-width:680px){.volt-slots{padding:10px}.volt-header{align-items:flex-start;flex-direction:column}.volt-header h2{font-size:25px}.volt-metrics{justify-content:flex-start}.volt-metrics span{min-width:82px}.feature-ribbon{grid-template-columns:1fr}.feature-ribbon div{display:flex;justify-content:space-between;align-items:center}.volt-machine{padding:6px}.reel-deck{gap:3px;padding:4px}.volt-reel{border-radius:5px}.volt-controls{align-items:stretch;flex-direction:column}.bet-stepper,.spin-actions{justify-content:center}.volt-paytable{grid-template-columns:repeat(2,1fr)}.volt-paytable div:last-child{grid-column:1/-1}.vault-grid{gap:4px}.vault-grid>div{min-height:65px}.free-spin-banner{font-size:8px}.win-celebration strong{font-size:44px}}
        @media(max-width:680px){.slots-stage{height:300px!important}.volt-header{gap:7px;margin-bottom:7px}.volt-metrics{display:grid;grid-template-columns:repeat(3,1fr);width:100%}.volt-metrics span{min-width:0;padding:6px;text-align:center}.feature-ribbon{grid-template-columns:repeat(3,1fr);gap:4px}.feature-ribbon div{display:grid;align-content:center;min-height:48px;padding:5px 3px}.feature-ribbon b{font-size:7px}.feature-ribbon small{font-size:6px;line-height:1.2}.volt-status{min-height:34px;padding-top:7px}.power-meter{margin:8px 0}.volt-controls{gap:8px}.spin-actions .main-spin{min-width:0;flex:1}}
        .slot-theme-picker{display:flex;gap:5px;margin:0 0 9px;overflow-x:auto;padding-bottom:2px}.slot-theme-picker button{flex:0 0 auto;padding:6px 9px;border:1px solid color-mix(in srgb,var(--slot-accent) 45%,#4b5563);border-radius:999px;background:#120d1b;color:#c8b8d2;font-size:8px;font-weight:900;cursor:pointer}.slot-theme-picker button.active{background:var(--slot-accent);border-color:var(--slot-accent);color:#130d1a;box-shadow:0 0 14px color-mix(in srgb,var(--slot-accent) 38%,transparent)}.slot-theme-pig{background:radial-gradient(circle at 50% -10%,#8d3158,#1b0b18 48%,#08070c)}.slot-theme-chicken{background:radial-gradient(circle at 50% -10%,#78570f,#1b1408 48%,#08070c)}.slot-theme-angels{background:radial-gradient(circle at 50% -10%,#24577e,#0b1420 48%,#08070c)}.slot-theme-devil{background:radial-gradient(circle at 50% -10%,#8f1728,#1b080c 48%,#08070c)}.slot-theme-crypt{background:radial-gradient(circle at 50% -10%,#472072,#10081d 48%,#08070c)}.slot-theme-pig .volt-machine{background:linear-gradient(#4c1b35,#10070e)}.slot-theme-chicken .volt-machine{background:linear-gradient(#49340a,#100c06)}.slot-theme-angels .volt-machine{background:linear-gradient(#173e5e,#080e18)}.slot-theme-devil .volt-machine{background:linear-gradient(#53111d,#100509)}.slot-theme-crypt .volt-machine{background:linear-gradient(#351551,#0d0716)}
        @media(prefers-reduced-motion:reduce){.volt-lights i,.volt-symbol.winner,.vault-board.rolling .vault-grid>div,.win-celebration{animation:none!important}}
      `}</style>
    </section>
  );
};

export default SlotsGame;
