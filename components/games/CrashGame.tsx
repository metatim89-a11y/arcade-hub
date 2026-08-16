import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyMode } from '../../types';
import { useCoinSystem } from '../../context/CoinContext';
import CrashFlight3D from './CrashFlight3D';

type GameState = 'IDLE' | 'COUNTDOWN' | 'FLYING' | 'CRASHED';

type Round = {
  bet: number;
  currency: CurrencyMode;
  crashPoint: number;
};

const MIN_BET = 10;
const MAX_BET = 100000;
const COUNTDOWN_SECONDS = 3;
const GROWTH_RATE = 0.115;
const CRASH_RTP = 0.95;

const secureRandom = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] + 1) / 4294967297;
};

const generateCrashPoint = () => {
  const point = CRASH_RTP / (1 - secureRandom());
  return Math.min(1000, Math.max(1, Math.floor(point * 100) / 100));
};

const CrashGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode, isProcessing } = useCoinSystem();
  const frameRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const shakeRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const stateRef = useRef<GameState>('IDLE');
  const multiplierRef = useRef(1);
  const startedAtRef = useRef(0);
  const startingRef = useRef(false);
  const cashoutLockedRef = useRef(false);
  const payoutPendingRef = useRef(false);
  const roundRef = useRef<Round | null>(null);
  const autoEnabledRef = useRef(false);
  const autoTargetRef = useRef(2);

  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [multiplier, setMultiplier] = useState(1);
  const [bet, setBet] = useState(10);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [history, setHistory] = useState<number[]>([]);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTarget, setAutoTarget] = useState(2);
  const [isStarting, setIsStarting] = useState(false);
  const [isPayoutPending, setIsPayoutPending] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [message, setMessage] = useState('Set your bet and launch when ready. Long-run RTP: 95%.');

  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
  const controlsOpen = gameState === 'IDLE' || gameState === 'CRASHED';

  const updateState = useCallback((next: GameState) => {
    stateRef.current = next;
    setGameState(next);
  }, []);

  const finishCrash = useCallback((crashPoint: number) => {
    if (stateRef.current !== 'FLYING') return;
    multiplierRef.current = crashPoint;
    setMultiplier(crashPoint);
    updateState('CRASHED');
    setHistory((current) => [crashPoint, ...current].slice(0, 8));
    setMessage(cashoutLockedRef.current
      ? `Round ended at ${crashPoint.toFixed(2)}×. Your cash-out was locked.`
      : `Crashed at ${crashPoint.toFixed(2)}×. Better luck next flight.`);
    setIsShaking(true);
    if (shakeRef.current) window.clearTimeout(shakeRef.current);
    shakeRef.current = window.setTimeout(() => mountedRef.current && setIsShaking(false), 420);
  }, [updateState]);

  const cashOut = useCallback(async (requestedMultiplier?: number) => {
    const round = roundRef.current;
    if (!round || stateRef.current !== 'FLYING' || cashoutLockedRef.current) return;

    const liveMultiplier = Math.exp(GROWTH_RATE * ((performance.now() - startedAtRef.current) / 1000));
    const cashoutMultiplier = Math.min(requestedMultiplier ?? liveMultiplier, liveMultiplier);
    if (cashoutMultiplier >= round.crashPoint) {
      finishCrash(round.crashPoint);
      return;
    }

    cashoutLockedRef.current = true;
    payoutPendingRef.current = true;
    setHasCashedOut(true);
    setCashedOutAt(cashoutMultiplier);
    setIsPayoutPending(true);
    const winnings = Math.floor(round.bet * cashoutMultiplier * 100) / 100;
    setMessage(`Cash-out locked at ${cashoutMultiplier.toFixed(2)}×. Confirming ${winnings.toFixed(2)} ${round.currency === 'fun' ? 'FC' : 'RC'}…`);

    const credited = await addCoins(winnings, 'Crash Cashout', round.currency);
    payoutPendingRef.current = false;
    if (!mountedRef.current) return;
    setIsPayoutPending(false);
    if (credited) {
      setPaidAmount(winnings);
      setMessage(`Paid ${winnings.toFixed(2)} ${round.currency === 'fun' ? 'FC' : 'RC'} at ${cashoutMultiplier.toFixed(2)}×.`);
    } else {
      setMessage('Cash-out was locked, but the payout service did not confirm payment.');
    }
  }, [addCoins, finishCrash]);

  const runFlight = useCallback(() => {
    const round = roundRef.current;
    if (!round || stateRef.current !== 'FLYING') return;
    const current = Math.exp(GROWTH_RATE * ((performance.now() - startedAtRef.current) / 1000));
    multiplierRef.current = current;

    if (current >= round.crashPoint) {
      finishCrash(round.crashPoint);
      return;
    }

    if (autoEnabledRef.current && !cashoutLockedRef.current && current >= autoTargetRef.current) {
      void cashOut(autoTargetRef.current);
    }

    setMultiplier(current);
    frameRef.current = requestAnimationFrame(runFlight);
  }, [cashOut, finishCrash]);

  const startGame = useCallback(async () => {
    if (startingRef.current || !controlsOpen || isProcessing) return;
    const cleanBet = Math.min(MAX_BET, Math.max(MIN_BET, Math.floor(bet)));
    setBet(cleanBet);

    if (!canBet(cleanBet)) {
      setMessage(`You need at least ${cleanBet} ${currencySymbol} to launch.`);
      return;
    }

    startingRef.current = true;
    setIsStarting(true);
    setMessage('Confirming your bet…');
    const charged = await subtractCoins(cleanBet, 'Crash Bet', currencyMode);
    startingRef.current = false;
    if (!mountedRef.current) return;
    setIsStarting(false);
    if (!charged) {
      setMessage('The bet was not charged, so the round did not start.');
      return;
    }

    const round: Round = { bet: cleanBet, currency: currencyMode, crashPoint: generateCrashPoint() };
    roundRef.current = round;
    cashoutLockedRef.current = false;
    payoutPendingRef.current = false;
    multiplierRef.current = 1;
    setMultiplier(1);
    setHasCashedOut(false);
    setCashedOutAt(null);
    setPaidAmount(0);
    setCountdown(COUNTDOWN_SECONDS);
    updateState('COUNTDOWN');
    setMessage(`${cleanBet} ${currencySymbol} accepted. Stand by for launch.`);
    let remaining = COUNTDOWN_SECONDS;
    countdownRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownRef.current) window.clearInterval(countdownRef.current);
        countdownRef.current = null;
        if (!mountedRef.current) return;
        updateState('FLYING');
        startedAtRef.current = performance.now();
        setMessage(autoEnabledRef.current
          ? `Flying — auto cash-out armed at ${autoTargetRef.current.toFixed(2)}×.`
          : 'Flying — cash out before the crash.');
        frameRef.current = requestAnimationFrame(runFlight);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [bet, canBet, controlsOpen, currencyMode, currencySymbol, isProcessing, runFlight, subtractCoins, updateState]);

  useEffect(() => {
    autoEnabledRef.current = autoEnabled;
  }, [autoEnabled]);

  useEffect(() => {
    autoTargetRef.current = autoTarget;
  }, [autoTarget]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      if (shakeRef.current) window.clearTimeout(shakeRef.current);
    };
  }, []);

  const changeBet = (value: number) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, Math.floor(value || MIN_BET))));
  const roundBet = roundRef.current?.bet ?? bet;
  const projectedPayout = Math.floor(roundBet * multiplier * 100) / 100;

  return (
    <section className="crash-game" aria-label="Crash game">
      <header className="crash-header">
        <div>
          <div className="crash-kicker">ARCADE FLIGHT</div>
          <h2>CRASH</h2>
        </div>
        <div className="crash-history" aria-label="Recent crash points">
          {history.length === 0 && <span className="history-empty">NO FLIGHTS YET</span>}
          {history.map((point, index) => (
            <span key={`${point}-${index}`} className={point >= 2 ? 'high' : 'low'}>{point.toFixed(2)}×</span>
          ))}
        </div>
      </header>

      <div className={`crash-stage${isShaking ? ' shaking' : ''}`}>
        <CrashFlight3D multiplier={multiplier} phase={gameState} cashedOut={hasCashedOut} />
        <div className="crash-readout" aria-live="polite">
          {gameState === 'IDLE' && <small>READY FOR LAUNCH</small>}
          {gameState === 'COUNTDOWN' && <small>LAUNCHING IN</small>}
          <strong className={gameState === 'CRASHED' ? 'crashed' : hasCashedOut ? 'safe' : ''}>
            {gameState === 'COUNTDOWN' ? countdown : `${multiplier.toFixed(2)}×`}
          </strong>
          {gameState === 'CRASHED' && <small className="crashed">FLIGHT ENDED</small>}
          {hasCashedOut && (
            <small className={isPayoutPending || paidAmount > 0 ? 'safe' : 'unconfirmed'}>
              {isPayoutPending
                ? 'PAYOUT PENDING'
                : paidAmount > 0
                  ? `SECURED ${paidAmount.toFixed(2)} ${roundRef.current?.currency === 'real' ? 'RC' : 'FC'}`
                  : 'PAYOUT UNCONFIRMED'}
            </small>
          )}
        </div>
      </div>

      <div className={`crash-message ${currencyMode === 'real' ? 'warning' : ''}`} role="status">
        <span />{message}
      </div>

      <div className="crash-panel">
        <div className="crash-bet-column">
          <label htmlFor="crash-bet">BET AMOUNT <span>{currencySymbol}</span></label>
          <div className="crash-bet-input">
            <button type="button" disabled={!controlsOpen || isStarting} onClick={() => changeBet(bet - 10)}>−</button>
            <input
              id="crash-bet"
              type="number"
              min={MIN_BET}
              max={MAX_BET}
              value={bet}
              disabled={!controlsOpen || isStarting}
              onChange={(event) => changeBet(Number(event.target.value))}
            />
            <button type="button" disabled={!controlsOpen || isStarting} onClick={() => changeBet(bet + 10)}>+</button>
          </div>
          <div className="crash-presets">
            {[10, 50, 100, 500].map((amount) => (
              <button key={amount} type="button" disabled={!controlsOpen || isStarting} onClick={() => changeBet(amount)}>{amount}</button>
            ))}
          </div>
        </div>

        <div className="crash-auto-column">
          <label className="crash-switch">
            <input
              type="checkbox"
              checked={autoEnabled}
              disabled={!controlsOpen || isStarting}
              onChange={(event) => setAutoEnabled(event.target.checked)}
            />
            <span /> AUTO CASH-OUT
          </label>
          <div className="crash-auto-input">
            <input
              type="number"
              min="1.01"
              max="1000"
              step="0.05"
              value={autoTarget}
              disabled={!controlsOpen || !autoEnabled || isStarting}
              onChange={(event) => setAutoTarget(Math.min(1000, Math.max(1.01, Number(event.target.value) || 1.01)))}
            />
            <span>×</span>
          </div>
        </div>

        <div className="crash-action-column">
          {gameState === 'FLYING' ? (
            <button
              type="button"
              className="crash-action cashout"
              disabled={hasCashedOut || isPayoutPending}
              onClick={() => void cashOut()}
            >
              <small>{hasCashedOut ? 'CASHED OUT' : 'CASH OUT NOW'}</small>
              <strong>{hasCashedOut && cashedOutAt ? `${cashedOutAt.toFixed(2)}×` : `${projectedPayout.toFixed(2)} ${roundRef.current?.currency === 'real' ? 'RC' : 'FC'}`}</strong>
            </button>
          ) : (
            <button
              type="button"
              className="crash-action launch"
              disabled={!controlsOpen || isStarting || isProcessing || !canBet(bet)}
              onClick={() => void startGame()}
            >
              <small>{isStarting ? 'CONFIRMING BET' : gameState === 'CRASHED' ? 'NEXT FLIGHT' : 'PLACE BET'}</small>
              <strong>{isStarting ? '…' : `${bet} ${currencySymbol}`}</strong>
            </button>
          )}
        </div>
      </div>

      <footer className="crash-footer">
        <span>1.00× minimum</span>
        <span>1% mathematical edge</span>
        <span>{currencyMode === 'fun' ? 'Fun Coin mode' : 'Virtual RC mode · no cash value'}</span>
      </footer>

      <style>{`
        .crash-game{width:min(100%,900px);margin:0 auto;padding:18px;color:#e8f2f7;background:linear-gradient(155deg,#091521,#102334);border:1px solid #274158;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.38);user-select:none}.crash-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:13px}.crash-kicker{color:#65c9ed;font-size:9px;font-weight:900;letter-spacing:.22em}.crash-header h2{margin:2px 0 0;font-size:29px;line-height:1;letter-spacing:.04em}.crash-history{display:flex;justify-content:flex-end;gap:6px;max-width:70%;overflow:hidden}.crash-history span{flex:0 0 auto;padding:5px 7px;border:1px solid;border-radius:6px;font-size:10px;font-weight:850}.crash-history .low{color:#ff7c87;border-color:rgba(255,82,99,.3);background:rgba(255,82,99,.1)}.crash-history .high{color:#58e0ac;border-color:rgba(72,221,166,.3);background:rgba(72,221,166,.1)}.crash-history .history-empty{color:#7890a2;border-color:#2a4052;background:#0b1823}.crash-stage{position:relative;width:100%;overflow:hidden;border:1px solid #29485f;border-radius:15px;background:#06121f;box-shadow:inset 0 0 45px rgba(0,0,0,.55)}.crash-stage canvas{display:block;max-width:100%}.crash-readout{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-shadow:0 3px 20px rgba(0,0,0,.8)}.crash-readout strong{color:#f7fbfd;font-size:clamp(48px,11vw,88px);font-weight:950;line-height:1;letter-spacing:-.06em;font-variant-numeric:tabular-nums}.crash-readout small{margin:5px 0;color:#91a9b9;font-size:10px;font-weight:900;letter-spacing:.2em}.crash-readout .crashed{color:#ff5969}.crash-readout .safe{color:#51dfa9}.crash-readout .unconfirmed{color:#ffbd62}.crash-message{display:flex;align-items:center;gap:9px;min-height:42px;margin:11px 0;padding:9px 12px;border:1px solid #29455a;border-radius:9px;background:#091722;color:#c1d3de;font-size:12px}.crash-message>span{width:7px;height:7px;flex:none;border-radius:50%;background:#58d9aa;box-shadow:0 0 0 4px rgba(88,217,170,.12)}.crash-message.warning{border-color:#725329;color:#ffd58a}.crash-message.warning>span{background:#ffb948;box-shadow:0 0 0 4px rgba(255,185,72,.12)}.crash-panel{display:grid;grid-template-columns:1.25fr .8fr 1fr;gap:12px;padding:13px;border:1px solid #284052;border-radius:13px;background:rgba(5,14,22,.55)}.crash-panel label{color:#8fa5b4;font-size:9px;font-weight:900;letter-spacing:.12em}.crash-panel label span{color:#e7bd55}.crash-bet-column,.crash-auto-column{display:flex;flex-direction:column;gap:7px}.crash-bet-input{display:grid;grid-template-columns:38px 1fr 38px;overflow:hidden;border:1px solid #304b60;border-radius:8px;background:#08141e}.crash-bet-input button,.crash-presets button{border:0;background:#172b3a;color:#c6d5df;font-weight:900;cursor:pointer}.crash-bet-input button:hover,.crash-presets button:hover{background:#22445a}.crash-bet-input input,.crash-auto-input input{min-width:0;border:0;outline:0;background:transparent;color:#f3f8fa;text-align:center;font-size:17px;font-weight:900}.crash-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.crash-presets button{padding:4px;border-radius:5px;font-size:9px}.crash-switch{display:flex;align-items:center;gap:7px;cursor:pointer}.crash-switch input{position:absolute;opacity:0}.crash-switch>span{position:relative;width:28px;height:15px;border-radius:20px;background:#344a59;transition:.2s}.crash-switch>span:after{content:'';position:absolute;top:3px;left:3px;width:9px;height:9px;border-radius:50%;background:#91a3ae;transition:.2s}.crash-switch input:checked+span{background:#2b9c76}.crash-switch input:checked+span:after{left:16px;background:white}.crash-auto-input{display:grid;grid-template-columns:1fr 28px;flex:1;min-height:39px;border:1px solid #304b60;border-radius:8px;background:#08141e}.crash-auto-input span{display:grid;place-items:center;color:#7f96a5;font-weight:900}.crash-action-column{display:flex}.crash-action{width:100%;min-height:76px;border:0;border-radius:10px;box-shadow:0 5px 0;cursor:pointer;transition:transform .12s,filter .12s}.crash-action:hover:not(:disabled){filter:brightness(1.08)}.crash-action:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0}.crash-action small,.crash-action strong{display:block}.crash-action small{font-size:9px;font-weight:950;letter-spacing:.13em}.crash-action strong{margin-top:3px;font-size:19px}.crash-action.launch{background:linear-gradient(#58dfa9,#24a978);box-shadow-color:#126242;color:#062519}.crash-action.cashout{background:linear-gradient(#ffd05f,#e79d24);box-shadow-color:#8b5313;color:#352307}.crash-action:disabled,.crash-panel button:disabled,.crash-panel input:disabled{opacity:.45;cursor:not-allowed}.crash-footer{display:flex;justify-content:center;gap:18px;padding-top:12px;color:#6f8798;font-size:9px;font-weight:800;letter-spacing:.06em}.shaking{animation:crash-shake .09s linear infinite}@keyframes crash-shake{0%,100%{transform:translate(0)}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-1px)}75%{transform:translate(-1px,-2px)}}@media(max-width:680px){.crash-game{padding:12px;border-radius:14px}.crash-header{align-items:flex-start}.crash-history{max-width:58%}.crash-panel{grid-template-columns:1fr 1fr}.crash-action-column{grid-column:1/-1}.crash-action{min-height:64px}.crash-footer{gap:8px;justify-content:space-between}.crash-footer span:nth-child(2){display:none}}@media(max-width:430px){.crash-history span:nth-last-child(n+5){display:none}.crash-panel{grid-template-columns:1fr}.crash-action-column{grid-column:auto}.crash-footer span:first-child{display:none}}
        .crash-stage{height:clamp(300px,48vw,430px)}.crash-flight-canvas{display:block;width:100%;height:100%;max-width:none!important;touch-action:none}
      `}</style>
    </section>
  );
};

export default CrashGame;
