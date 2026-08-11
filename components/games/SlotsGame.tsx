import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyMode } from '../../types';
import { useCoinSystem } from '../../context/CoinContext';

const REEL_COUNT = 5;
const VISIBLE_SYMBOLS = 3;
const SYMBOL_HEIGHT = 84;
const REEL_STRIP_LENGTH = 30;
const SYMBOLS = ['🚀', '🧠', '💎', '🍒', '7️⃣', '🔔', '🎰', '🍇', '🍋'];
const WILD_SYMBOL = '🚀';

const PAYLINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0]
];

const PAYOUTS: Record<string, Record<number, number>> = {
  '🚀': { 5: 1000, 4: 200, 3: 50 },
  '7️⃣': { 5: 500, 4: 100, 3: 25 },
  '💎': { 5: 300, 4: 75, 3: 20 },
  '🎰': { 5: 200, 4: 50, 3: 15 },
  '🔔': { 5: 150, 4: 40, 3: 12 },
  '🍒': { 5: 100, 4: 30, 3: 10 },
  '🍇': { 5: 80, 4: 20, 3: 8 },
  '🍋': { 5: 50, 4: 15, 3: 5 },
  '🧠': { 5: 50, 4: 15, 3: 5 }
};

type ReelState = {
  symbols: string[];
  offset: number;
  duration: number;
  spinning: boolean;
};

type WinningLine = { positions: [number, number][]; amount: number };
type WinningInfo = { winningPaylines: WinningLine[]; totalWin: number };

const randomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
const initialReels = (): ReelState[] => Array.from({ length: REEL_COUNT }, () => ({
  symbols: Array.from({ length: VISIBLE_SYMBOLS }, randomSymbol),
  offset: 0,
  duration: 0,
  spinning: false
}));

const SlotsGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode, funCoins, realCoins, isProcessing } = useCoinSystem();
  const [betPerLine, setBetPerLine] = useState(2);
  const [isAutoSpin, setIsAutoSpin] = useState(false);
  const [reels, setReels] = useState<ReelState[]>(initialReels);
  const [gameState, setGameState] = useState<'IDLE' | 'SPINNING' | 'WIN'>('IDLE');
  const [winInfo, setWinInfo] = useState<WinningInfo | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [status, setStatus] = useState('Choose a line bet and spin.');
  const timersRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
  const balance = currencyMode === 'fun' ? funCoins : realCoins;
  const totalBet = betPerLine * PAYLINES.length;

  const clearSpinTimers = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
  }, []);

  const calculateWin = useCallback(async (layout: string[][], roundCurrency: CurrencyMode, lineBet: number) => {
    let totalWinnings = 0;
    const winningLines: WinningLine[] = [];

    for (const line of PAYLINES) {
      const symbols = line.map((row, column) => layout[column][row]);
      const firstNonWild = symbols.find((symbol) => symbol !== WILD_SYMBOL) || WILD_SYMBOL;
      let matchCount = 0;
      for (const symbol of symbols) {
        if (symbol === firstNonWild || symbol === WILD_SYMBOL) matchCount += 1;
        else break;
      }
      const multiplier = PAYOUTS[firstNonWild]?.[matchCount];
      if (matchCount >= 3 && multiplier) {
        const amount = multiplier * lineBet;
        totalWinnings += amount;
        winningLines.push({ positions: line.slice(0, matchCount).map((row, column) => [column, row]), amount });
      }
    }

    if (!mountedRef.current) return;
    if (!totalWinnings) {
      setLastWin(0);
      setGameState('IDLE');
      setStatus('No win. The reels are ready.');
      return;
    }

    const credited = await addCoins(totalWinnings, 'Slots Win', roundCurrency);
    if (!mountedRef.current) return;
    if (!credited) {
      setGameState('IDLE');
      setStatus('Winning symbols landed, but the payout was not confirmed.');
      setIsAutoSpin(false);
      return;
    }
    setLastWin(totalWinnings);
    setWinInfo({ winningPaylines: winningLines, totalWin: totalWinnings });
    setGameState('WIN');
    setStatus(`Won ${totalWinnings} ${roundCurrency === 'fun' ? 'FC' : 'RC'}!`);
  }, [addCoins]);

  const spin = useCallback(async () => {
    if (gameState === 'SPINNING' || isProcessing) return;
    if (!canBet(totalBet)) {
      setStatus(`You need ${totalBet} ${currencySymbol} to spin.`);
      setIsAutoSpin(false);
      return;
    }

    clearSpinTimers();
    const roundCurrency = currencyMode;
    const lineBet = betPerLine;
    setStatus('Confirming bet…');
    const charged = await subtractCoins(totalBet, 'Slots Spin', roundCurrency);
    if (!charged || !mountedRef.current) {
      setStatus(roundCurrency === 'real' ? 'Real Coin service is unavailable.' : 'The spin was not charged.');
      setIsAutoSpin(false);
      return;
    }

    const finalLayout = Array.from({ length: REEL_COUNT }, () => Array.from({ length: VISIBLE_SYMBOLS }, randomSymbol));
    const rollingReels = finalLayout.map((finalSymbols, index) => ({
      symbols: [...Array.from({ length: REEL_STRIP_LENGTH }, randomSymbol), ...finalSymbols],
      offset: 0,
      duration: 2.15 + index * 0.22,
      spinning: true
    }));
    setWinInfo(null);
    setLastWin(0);
    setGameState('SPINNING');
    setStatus('Reels rolling…');
    setReels(rollingReels);

    const rollTimer = window.setTimeout(() => {
      setReels((current) => current.map((reel) => ({ ...reel, offset: REEL_STRIP_LENGTH * SYMBOL_HEIGHT })));
    }, 70);
    timersRef.current.push(rollTimer);

    rollingReels.forEach((reel, index) => {
      const landingTimer = window.setTimeout(() => {
        setReels((current) => current.map((item, reelIndex) => reelIndex === index ? { ...item, spinning: false } : item));
        if (index === REEL_COUNT - 1) {
          setReels(finalLayout.map((symbols) => ({ symbols, offset: 0, duration: 0, spinning: false })));
          void calculateWin(finalLayout, roundCurrency, lineBet);
        }
      }, reel.duration * 1000 + 90);
      timersRef.current.push(landingTimer);
    });
  }, [betPerLine, calculateWin, canBet, clearSpinTimers, currencyMode, currencySymbol, gameState, isProcessing, subtractCoins, totalBet]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSpinTimers();
    };
  }, [clearSpinTimers]);

  useEffect(() => {
    if (!isAutoSpin || gameState === 'SPINNING') return;
    const timer = window.setTimeout(() => void spin(), gameState === 'WIN' ? 1800 : 700);
    return () => window.clearTimeout(timer);
  }, [gameState, isAutoSpin, spin]);

  const isWinningCell = (reelIndex: number, rowIndex: number) => winInfo?.winningPaylines.some((line) =>
    line.positions.some(([column, row]) => column === reelIndex && row === rowIndex)) || false;

  return (
    <section className="slots-game">
      <header className="slots-header">
        <div>
          <div className="slots-kicker">Five-reel arcade</div>
          <h2>Neon Sevens</h2>
        </div>
        <div className="slots-metrics">
          <span><small>Balance</small>{Math.floor(balance)} {currencySymbol}</span>
          <span><small>Total bet</small>{totalBet} {currencySymbol}</span>
          <span><small>Last win</small>{lastWin} {currencySymbol}</span>
        </div>
      </header>

      <div className="slots-machine">
        <div className="slots-marquee" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} className={gameState === 'SPINNING' ? 'rolling' : ''} />)}</div>
        <div className="slots-reels">
          <div className="slots-payline" />
          {reels.map((reel, reelIndex) => (
            <div key={reelIndex} className={`slot-reel${reel.spinning ? ' spinning' : ''}`}>
              <div
                className="slot-track"
                style={{
                  transform: `translate3d(0, -${reel.offset}px, 0)`,
                  transition: reel.spinning ? `transform ${reel.duration}s cubic-bezier(.08,.68,.12,1)` : 'none'
                }}
              >
                {reel.symbols.map((symbol, symbolIndex) => {
                  const visibleRow = reel.symbols.length === VISIBLE_SYMBOLS
                    ? symbolIndex
                    : symbolIndex - (reel.symbols.length - VISIBLE_SYMBOLS);
                  const winner = visibleRow >= 0 && isWinningCell(reelIndex, visibleRow);
                  return (
                    <div key={`${symbolIndex}-${symbol}`} className={`slot-symbol${winner ? ' winner' : ''}`}>
                      <span>{symbol}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="slots-status" role="status" aria-live="polite">{status}</div>
      </div>

      <div className="slots-controls">
        <div className="slots-bet-control">
          <span>LINE BET</span>
          <button type="button" disabled={gameState === 'SPINNING'} onClick={() => setBetPerLine(Math.max(1, betPerLine - 1))}>−</button>
          <strong>{betPerLine}</strong>
          <button type="button" disabled={gameState === 'SPINNING'} onClick={() => setBetPerLine(Math.min(100, betPerLine + 1))}>+</button>
        </div>
        <div className="slots-actions">
          <button type="button" className={isAutoSpin ? 'auto active' : 'auto'} onClick={() => setIsAutoSpin((current) => !current)}>{isAutoSpin ? 'Stop Auto' : 'Auto Spin'}</button>
          <button type="button" className="spin" disabled={gameState === 'SPINNING' || isProcessing} onClick={() => void spin()}>{gameState === 'SPINNING' ? 'ROLLING…' : 'SPIN'}</button>
        </div>
      </div>

      <div className="slots-paytable">
        {['🚀', '7️⃣', '💎', '🎰', '🔔'].map((symbol) => (
          <div key={symbol}><span>{symbol}</span><small>3× {PAYOUTS[symbol][3]} · 4× {PAYOUTS[symbol][4]} · 5× {PAYOUTS[symbol][5]}</small></div>
        ))}
      </div>

      <style>{`
        .slots-game{width:100%;padding:18px;border:1px solid #4c356d;border-radius:18px;background:radial-gradient(circle at 50% -20%,#442067,#150d24 48%,#08070c);color:#f7f2ff;box-shadow:0 24px 60px rgba(0,0,0,.42)}.slots-header{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:14px}.slots-kicker{color:#d99cff;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.slots-header h2{margin:2px 0 0;font-size:28px;line-height:1}.slots-metrics{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.slots-metrics span{min-width:94px;padding:7px 9px;border:1px solid #573d72;border-radius:8px;background:#100b18;text-align:right;font-size:13px;font-weight:900}.slots-metrics small{display:block;color:#9d88ac;font-size:8px;letter-spacing:.09em;text-transform:uppercase}
        .slots-machine{overflow:hidden;padding:10px;border:1px solid #6b4a84;border-radius:14px;background:linear-gradient(#2b1938,#0b0810);box-shadow:inset 0 0 35px #000,0 16px 30px rgba(0,0,0,.35)}.slots-marquee{display:flex;justify-content:space-between;padding:1px 4px 9px}.slots-marquee i{width:8px;height:8px;border-radius:50%;background:#e94877;box-shadow:0 0 8px #e94877}.slots-marquee i.rolling{background:#ffd35f;box-shadow:0 0 10px #ffd35f;animation:slot-light .45s steps(2) infinite}.slots-reels{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:7px;border:1px solid #342440;border-radius:10px;background:#08070a}.slot-reel{position:relative;height:${SYMBOL_HEIGHT * VISIBLE_SYMBOLS}px;overflow:hidden;border:1px solid #8e8195;border-radius:8px;background:linear-gradient(90deg,#d9d6dc,#fff 46%,#d8d5db);box-shadow:inset 8px 0 14px rgba(0,0,0,.18),inset -8px 0 14px rgba(0,0,0,.18)}.slot-track{will-change:transform}.slot-symbol{display:grid;place-items:center;height:${SYMBOL_HEIGHT}px;border-bottom:1px solid rgba(48,31,52,.14);font-size:clamp(30px,6vw,58px);line-height:1}.slot-symbol span{filter:drop-shadow(0 3px 2px rgba(0,0,0,.22))}.slot-symbol.winner{position:relative;background:radial-gradient(circle,#fff5aa 0,#ffd858 45%,transparent 76%);animation:slot-win .65s ease-in-out infinite alternate}.slots-payline{position:absolute;left:5px;right:5px;top:50%;z-index:5;height:2px;background:#f04e79;box-shadow:0 0 8px #f04e79;pointer-events:none}.slots-payline::before,.slots-payline::after{content:'';position:absolute;top:-4px;width:9px;height:9px;border-radius:50%;background:#ff668c}.slots-payline::before{left:-3px}.slots-payline::after{right:-3px}.slots-status{min-height:38px;padding:10px 5px 1px;text-align:center;color:#d6c7df;font-size:13px}
        .slots-controls{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:14px}.slots-bet-control,.slots-actions{display:flex;align-items:center;gap:8px}.slots-bet-control>span{color:#a994b5;font-size:9px;font-weight:900;letter-spacing:.12em}.slots-controls button{padding:10px 13px;border:1px solid #5b426e;border-radius:8px;background:#251832;color:#eee5f3;font-weight:850;cursor:pointer}.slots-controls button:disabled{opacity:.5;cursor:not-allowed}.slots-bet-control strong{min-width:38px;text-align:center;color:#ffd768}.slots-actions .auto.active{border-color:#3bc78f;background:#154839;color:#a8f4d3}.slots-actions .spin{min-width:130px;padding:13px 24px;border-color:#e5a832;background:linear-gradient(#ffd45d,#dc861d);box-shadow:0 4px 0 #895111;color:#301d08;font-size:17px;font-weight:950}.slots-actions .spin:active:not(:disabled){transform:translateY(3px);box-shadow:0 1px 0 #895111}.slots-paytable{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:12px}.slots-paytable div{display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 5px;border:1px solid #382b45;border-radius:7px;background:#100c17}.slots-paytable span{font-size:23px}.slots-paytable small{color:#aa98b5;font-size:8px;line-height:1.35}
        @keyframes slot-light{50%{opacity:.28}}@keyframes slot-win{to{filter:brightness(1.2);transform:scale(1.05)}}
        @media(max-width:680px){.slots-game{padding:10px}.slots-header{align-items:flex-start;flex-direction:column}.slots-header h2{font-size:23px}.slots-metrics{justify-content:flex-start}.slots-metrics span{min-width:80px}.slots-machine{padding:6px}.slots-reels{gap:3px;padding:3px}.slot-reel{border-radius:5px}.slots-controls{align-items:stretch;flex-direction:column}.slots-bet-control,.slots-actions{justify-content:center}.slots-paytable{grid-template-columns:repeat(2,minmax(0,1fr))}.slots-paytable div:last-child{grid-column:1/-1}.slots-paytable small{font-size:9px}}
      `}</style>
    </section>
  );
};

export default SlotsGame;
