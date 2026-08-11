import React, { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { CurrencyMode } from '../../types';
import { useCoinSystem } from '../../context/CoinContext';

const SHELF_WIDTH = 320;
const SHELF_HEIGHT = 420;
const COIN_RADIUS = 12;
const PUSHER_HOME_Y = 64;
const PUSHER_EXTENDED_Y = 215;
const LOWER_PUSHER_HOME_Y = 266;
const LOWER_PUSHER_EXTENDED_Y = 350;
const PUSH_INTERVAL_MS = 2500;
const PUSH_MOTION_MS = 1700;
const FIRST_EDGE_Y = 252;
const LOWER_SHELF_Y = 290;
const PRIZE_EDGE_Y = 394;
const BET_AMOUNT = 10;
const PAYOUT_PER_COIN = 5;

type CoinTier = 'upper' | 'lower';

type DisplayCoin = {
  id: number;
  x: number;
  y: number;
  angle: number;
  playerCoin: boolean;
  tier: CoinTier;
};

type DisplayFrame = {
  coins: DisplayCoin[];
  pusherY: number;
  lowerPusherY: number;
  cycleProgress: number;
};

type PayoutBatch = {
  count: number;
  currency: CurrencyMode;
};

const easeInOut = (progress: number) => -(Math.cos(Math.PI * progress) - 1) / 2;
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const CoinPusherGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode, isProcessing } = useCoinSystem();
  const [aimPercent, setAimPercent] = useState(50);
  const [frame, setFrame] = useState<DisplayFrame>({
    coins: [],
    pusherY: PUSHER_HOME_Y,
    lowerPusherY: LOWER_PUSHER_HOME_Y,
    cycleProgress: 0
  });
  const [isDropping, setIsDropping] = useState(false);
  const [feedback, setFeedback] = useState('Tap the shelf to drop a coin. The pusher runs automatically.');
  const [lastWin, setLastWin] = useState(0);

  const engineRef = useRef<Matter.Engine | null>(null);
  const nextCoinIdRef = useRef(1);
  const mountedRef = useRef(true);
  const dropPendingRef = useRef(false);
  const hasPlayedRef = useRef(false);
  const payoutQueueRef = useRef<PayoutBatch[]>([]);
  const payoutBusyRef = useRef(false);
  const addCoinsRef = useRef(addCoins);
  const currencyRef = useRef(currencyMode);

  useEffect(() => {
    addCoinsRef.current = addCoins;
  }, [addCoins]);

  useEffect(() => {
    currencyRef.current = currencyMode;
  }, [currencyMode]);

  const flushPayouts = useCallback(async () => {
    if (payoutBusyRef.current) return;
    payoutBusyRef.current = true;

    while (mountedRef.current && payoutQueueRef.current.length > 0) {
      const batch = payoutQueueRef.current.shift();
      if (!batch) break;
      const payout = batch.count * PAYOUT_PER_COIN;
      const credited = await addCoinsRef.current(payout, 'Coin Pusher Win', batch.currency);
      if (!mountedRef.current) break;

      if (credited) {
        setLastWin(payout);
        setFeedback(
          `${batch.count} coin${batch.count === 1 ? '' : 's'} reached the prize tray — won ${payout} ${batch.currency === 'fun' ? 'FC' : 'RC'}!`
        );
      } else {
        setFeedback('Coins reached the tray, but the payout service did not confirm the credit.');
      }
    }

    payoutBusyRef.current = false;
  }, []);

  const queuePayout = useCallback((count: number) => {
    if (count <= 0 || !hasPlayedRef.current) return;
    const currency = currencyRef.current;
    const existing = payoutQueueRef.current.find((batch) => batch.currency === currency);
    if (existing) existing.count += count;
    else payoutQueueRef.current.push({ count, currency });
    void flushPayouts();
  }, [flushPayouts]);

  useEffect(() => {
    mountedRef.current = true;
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
    engineRef.current = engine;
    const world = engine.world;

    const wallOptions: Matter.IBodyDefinition = {
      isStatic: true,
      friction: 0.05,
      restitution: 0.04
    };
    const leftWall = Matter.Bodies.rectangle(-8, SHELF_HEIGHT / 2, 16, SHELF_HEIGHT, wallOptions);
    const rightWall = Matter.Bodies.rectangle(SHELF_WIDTH + 8, SHELF_HEIGHT / 2, 16, SHELF_HEIGHT, wallOptions);
    const backWall = Matter.Bodies.rectangle(SHELF_WIDTH / 2, -8, SHELF_WIDTH, 16, wallOptions);
    const pusher = Matter.Bodies.rectangle(SHELF_WIDTH / 2, PUSHER_HOME_Y, SHELF_WIDTH - 22, 42, {
      isStatic: true,
      friction: 0.08,
      restitution: 0.02,
      label: 'pusher'
    });
    const lowerPusher = Matter.Bodies.rectangle(
      SHELF_WIDTH / 2,
      LOWER_PUSHER_HOME_Y,
      SHELF_WIDTH - 22,
      20,
      {
        isStatic: true,
        friction: 0.08,
        restitution: 0.02,
        label: 'lower-pusher'
      }
    );
    Matter.World.add(world, [leftWall, rightWall, backWall, pusher, lowerPusher]);

    const startingCoins: Matter.Body[] = [];
    const addStartingRow = (row: number, y: number, tier: CoinTier) => {
      for (let column = 0; column < 7; column += 1) {
        const x = 28 + column * 43 + (row % 2 ? 8 : 0);
        if (x > SHELF_WIDTH - 22) continue;
        startingCoins.push(Matter.Bodies.circle(x, y, COIN_RADIUS, {
          restitution: 0.05,
          friction: 0.12,
          frictionAir: 0.1,
          density: 0.012,
          label: 'coin',
          plugin: {
            coinId: nextCoinIdRef.current++,
            playerCoin: false,
            tier
          }
        }));
      }
    };

    [158, 188, 218].forEach((y, row) => addStartingRow(row, y, 'upper'));
    [306, 338, 370].forEach((y, row) => addStartingRow(row + 3, y, 'lower'));
    Matter.World.add(world, startingCoins);

    let animationFrame = 0;
    let previousTime = performance.now();
    let previousRender = 0;
    const motorStartedAt = performance.now();

    const update = (time: number) => {
      const delta = Math.min(32, Math.max(8, time - previousTime));
      previousTime = time;

      const cycleElapsed = (time - motorStartedAt) % PUSH_INTERVAL_MS;
      const cycleProgress = cycleElapsed / PUSH_INTERVAL_MS;
      let travel = 0;
      if (cycleElapsed < PUSH_MOTION_MS) {
        const motionProgress = cycleElapsed / PUSH_MOTION_MS;
        travel = motionProgress <= 0.5
          ? easeInOut(motionProgress * 2)
          : easeInOut((1 - motionProgress) * 2);
      }
      const pusherY = PUSHER_HOME_Y + travel * (PUSHER_EXTENDED_Y - PUSHER_HOME_Y);
      const lowerPusherY = LOWER_PUSHER_HOME_Y
        + travel * (LOWER_PUSHER_EXTENDED_Y - LOWER_PUSHER_HOME_Y);
      Matter.Body.setPosition(pusher, { x: SHELF_WIDTH / 2, y: pusherY }, true);
      Matter.Body.setPosition(lowerPusher, { x: SHELF_WIDTH / 2, y: lowerPusherY }, true);

      Matter.Engine.update(engine, delta);

      const prizeCoins: Matter.Body[] = [];
      for (const body of world.bodies) {
        if (body.label !== 'coin') continue;

        if (body.plugin.tier === 'upper' && body.position.y > FIRST_EDGE_Y) {
          body.plugin.tier = 'lower';
          Matter.Body.setPosition(body, {
            x: Math.max(COIN_RADIUS + 3, Math.min(SHELF_WIDTH - COIN_RADIUS - 3, body.position.x)),
            y: LOWER_SHELF_Y
          });
          Matter.Body.setVelocity(body, { x: body.velocity.x * 0.65, y: 1.8 });
          Matter.Body.setAngularVelocity(body, body.angularVelocity + 0.035);
        } else if (body.plugin.tier === 'lower' && body.position.y > PRIZE_EDGE_Y) {
          prizeCoins.push(body);
        }
      }

      if (prizeCoins.length > 0) {
        Matter.World.remove(world, prizeCoins);
        queuePayout(prizeCoins.length);
      }

      if (time - previousRender >= 33) {
        previousRender = time;
        const coins = world.bodies
          .filter((body) => body.label === 'coin')
          .map((body) => ({
            id: body.plugin.coinId as number,
            x: body.position.x,
            y: body.position.y,
            angle: body.angle * (180 / Math.PI),
            playerCoin: Boolean(body.plugin.playerCoin),
            tier: body.plugin.tier as CoinTier
          }));
        setFrame({ coins, pusherY, lowerPusherY, cycleProgress });
      }

      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(animationFrame);
      payoutQueueRef.current = [];
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
    };
  }, [queuePayout]);

  const dropCoinAt = useCallback(async (requestedPercent: number) => {
    if (dropPendingRef.current || isProcessing) return;
    const dropPercent = clampPercent(requestedPercent);
    setAimPercent(dropPercent);

    if (!canBet(BET_AMOUNT)) {
      setFeedback(`You need ${BET_AMOUNT} ${currencyMode === 'fun' ? 'FC' : 'RC'} to drop a coin.`);
      return;
    }

    dropPendingRef.current = true;
    setIsDropping(true);
    setLastWin(0);
    setFeedback('Confirming your coin…');
    const dropCurrency = currencyMode;
    const charged = await subtractCoins(BET_AMOUNT, 'Coin Pusher Drop', dropCurrency);

    if (!charged) {
      if (mountedRef.current) {
        setFeedback('The coin was not charged. Nothing was dropped.');
        setIsDropping(false);
      }
      dropPendingRef.current = false;
      return;
    }

    const engine = engineRef.current;
    if (!engine) {
      await addCoinsRef.current(BET_AMOUNT, 'Coin Pusher Refund', dropCurrency);
      if (mountedRef.current) {
        setFeedback('The shelf was unavailable, so your coin was refunded.');
        setIsDropping(false);
      }
      dropPendingRef.current = false;
      return;
    }

    const x = 26 + (dropPercent / 100) * (SHELF_WIDTH - 52);
    const coin = Matter.Bodies.circle(x, 108, COIN_RADIUS, {
      restitution: 0.05,
      friction: 0.12,
      frictionAir: 0.1,
      density: 0.012,
      label: 'coin',
      plugin: {
        coinId: nextCoinIdRef.current++,
        playerCoin: true,
        tier: 'upper' as CoinTier
      }
    });
    Matter.World.add(engine.world, coin);
    hasPlayedRef.current = true;
    setFeedback(`Coin dropped at ${Math.round(dropPercent)}%. The next automatic push is coming.`);
    setIsDropping(false);
    dropPendingRef.current = false;
  }, [canBet, currencyMode, isProcessing, subtractCoins]);

  const handleShelfPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;
    void dropCoinAt(percent);
  }, [dropCoinAt]);

  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
  const aimX = 26 + (aimPercent / 100) * (SHELF_WIDTH - 52);
  const secondsToPush = Math.max(0, ((1 - frame.cycleProgress) * PUSH_INTERVAL_MS) / 1000);

  return (
    <section className="coin-pusher-game" aria-label="Coin Pusher game">
      <header className="coin-pusher-header">
        <div>
          <div className="coin-pusher-kicker">Two-level skill game</div>
          <h2>Coin Pusher</h2>
        </div>
        <div className="coin-pusher-rules">
          <span>Drop: {BET_AMOUNT} {currencySymbol}</span>
          <span>Tray coin: {PAYOUT_PER_COIN} {currencySymbol}</span>
        </div>
      </header>

      <div className="coin-pusher-status" role="status" aria-live="polite">
        <span className="status-light active" />
        {feedback}
      </div>

      <div className="coin-pusher-machine">
        <div className="coin-pusher-topbar">
          <span>AUTO PUSH · 2.5 SEC</span>
          <span>NEXT {secondsToPush.toFixed(1)}S</span>
        </div>
        <div
          className={`coin-pusher-shelf${isDropping ? ' dropping' : ''}`}
          onPointerDown={handleShelfPointer}
          role="button"
          tabIndex={0}
          aria-label={`Tap a position to drop a coin for ${BET_AMOUNT} ${currencySymbol}`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              void dropCoinAt(aimPercent);
            }
          }}
        >
          <div className="coin-pusher-grid" />
          <div className="coin-pusher-aim" style={{ left: `${(aimX / SHELF_WIDTH) * 100}%` }}>
            <span />
          </div>
          <div className="coin-pusher-plate" style={{ top: `${((frame.pusherY - 21) / SHELF_HEIGHT) * 100}%` }}>
            <div className="coin-pusher-plate-face">AUTO PUSH</div>
          </div>
          <div
            className="coin-pusher-lower-plate"
            style={{ top: `${((frame.lowerPusherY - 10) / SHELF_HEIGHT) * 100}%` }}
          >
            <span>STAGE 2</span>
          </div>

          <div className="coin-pusher-step first">
            <span>STEP 1</span>
            <strong>LOWER SHELF</strong>
          </div>
          <div className="coin-pusher-step second">
            <span>STEP 2</span>
            <strong>PRIZE TRAY</strong>
          </div>

          {frame.coins.map((coin) => (
            <div
              key={coin.id}
              className={`coin-pusher-coin ${coin.tier}${coin.playerCoin ? ' player' : ''}`}
              style={{
                left: `${(coin.x / SHELF_WIDTH) * 100}%`,
                top: `${(coin.y / SHELF_HEIGHT) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${coin.angle}deg)`
              }}
            >
              <span>{coin.playerCoin ? '★' : '$'}</span>
            </div>
          ))}
        </div>
        <div className="coin-pusher-tray">
          <span>LAST WIN</span>
          <strong>{lastWin} {currencySymbol}</strong>
        </div>
      </div>

      <div className="coin-pusher-controls">
        <label htmlFor="coin-pusher-aim">Drop position: {Math.round(aimPercent)}%</label>
        <input
          id="coin-pusher-aim"
          type="range"
          min="0"
          max="100"
          value={aimPercent}
          disabled={isDropping || isProcessing}
          onChange={(event) => setAimPercent(Number(event.target.value))}
        />
        <button
          type="button"
          disabled={isDropping || isProcessing}
          onClick={() => void dropCoinAt(aimPercent)}
        >
          {isDropping ? 'DROPPING…' : `DROP AT ${Math.round(aimPercent)}% · ${BET_AMOUNT} ${currencySymbol}`}
        </button>
        <p>Tap directly on the shelf for instant placement. Coins fall to the lower shelf, then into the prize tray.</p>
      </div>

      <style>{`
        .coin-pusher-game{width:min(100%,760px);margin:0 auto;padding:18px;color:#eef5fa;background:linear-gradient(160deg,#0a1420,#101d2b);border:1px solid #294058;border-radius:18px;box-shadow:0 22px 60px rgba(0,0,0,.38);user-select:none}
        .coin-pusher-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:4px 4px 16px}.coin-pusher-kicker{color:#6dc7ee;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.coin-pusher-header h2{margin:3px 0 0;font-size:26px;line-height:1}.coin-pusher-rules{display:grid;gap:3px;text-align:right;color:#9fb0c1;font-size:12px}
        .coin-pusher-status{display:flex;align-items:center;gap:9px;min-height:42px;padding:10px 13px;margin-bottom:12px;border:1px solid #263d53;border-radius:9px;background:#0a111a;color:#d6e1e9;font-size:13px}.status-light{width:8px;height:8px;border-radius:50%;background:#5b6c7d;box-shadow:0 0 0 4px rgba(91,108,125,.12)}.status-light.active{background:#52d6a3;box-shadow:0 0 0 4px rgba(82,214,163,.14);animation:pusher-pulse 2.5s infinite}
        .coin-pusher-machine{width:min(100%,380px);margin:0 auto;padding:12px 12px 0;border:1px solid #40556b;border-radius:14px;background:linear-gradient(145deg,#26384a,#111b26 58%);box-shadow:inset 0 1px rgba(255,255,255,.08),0 18px 30px rgba(0,0,0,.3)}.coin-pusher-topbar{display:flex;justify-content:space-between;padding:0 5px 9px;color:#95aabc;font-size:10px;font-weight:800;letter-spacing:.12em}.coin-pusher-shelf{position:relative;width:320px;max-width:100%;height:auto;aspect-ratio:320/420;margin:auto;overflow:hidden;touch-action:manipulation;cursor:crosshair;border:8px solid #172330;border-bottom:0;border-radius:7px 7px 0 0;background:linear-gradient(#1a2a3a 0 59%,#132331 59% 93%,#0b171f 93%);box-shadow:inset 0 0 35px rgba(0,0,0,.65);outline:none}.coin-pusher-shelf:focus-visible{box-shadow:inset 0 0 35px rgba(0,0,0,.65),0 0 0 3px #65ccef}.coin-pusher-shelf.dropping{cursor:wait}.coin-pusher-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(120,167,196,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(120,167,196,.08) 1px,transparent 1px);background-size:10% 7.62%}.coin-pusher-aim{position:absolute;top:2.14%;z-index:9;width:2px;height:17.62%;pointer-events:none;background:linear-gradient(#70d4ff,transparent);transform:translateX(-1px);filter:drop-shadow(0 0 5px #67cfff)}.coin-pusher-aim span{position:absolute;top:0;left:50%;width:9px;height:9px;border-top:2px solid #83dcff;border-left:2px solid #83dcff;transform:translate(-50%,-1px) rotate(45deg)}
        .coin-pusher-plate{position:absolute;left:1.56%;z-index:5;width:96.88%;height:10%;pointer-events:none;border:1px solid #6a7c8d;border-radius:5px;background:linear-gradient(#718395,#3b4a58);box-shadow:0 9px 14px rgba(0,0,0,.45);will-change:top}.coin-pusher-plate-face{position:absolute;inset:auto 0 0;padding:3px;text-align:center;border-top:1px solid rgba(255,255,255,.17);color:#d8e1e8;font-size:9px;font-weight:900;letter-spacing:.22em}
        .coin-pusher-lower-plate{position:absolute;left:1.56%;z-index:2;width:96.88%;height:4.76%;pointer-events:none;border:1px solid #426d80;border-radius:4px;background:linear-gradient(#416f82,#203c4a);box-shadow:0 7px 12px rgba(0,0,0,.48);text-align:center;will-change:top}.coin-pusher-lower-plate span{position:relative;top:2px;color:#a8dded;font-size:7px;font-weight:900;letter-spacing:.17em}
        .coin-pusher-step{position:absolute;left:0;right:0;z-index:6;height:7%;pointer-events:none;border-top:2px solid;box-shadow:0 -6px 16px rgba(0,0,0,.26);text-align:center}.coin-pusher-step span,.coin-pusher-step strong{position:relative;top:4px;display:inline-block;font-size:8px;font-weight:900;letter-spacing:.13em}.coin-pusher-step span{margin-right:5px;opacity:.75}.coin-pusher-step.first{top:${(FIRST_EDGE_Y / SHELF_HEIGHT) * 100}%;border-color:#55b9de;background:linear-gradient(rgba(54,156,198,.22),rgba(23,69,89,.44));color:#9adef6}.coin-pusher-step.second{top:${((PRIZE_EDGE_Y - 7) / SHELF_HEIGHT) * 100}%;border-color:#54d7a2;background:linear-gradient(rgba(62,211,153,.14),rgba(62,211,153,.34));color:#83e9c0}
        .coin-pusher-coin{position:absolute;z-index:3;display:grid;place-items:center;width:7.5%;height:auto;aspect-ratio:1;pointer-events:none;border:2px solid #8a570d;border-radius:50%;background:radial-gradient(circle at 32% 27%,#fff7b2 0,#f2c84b 22%,#c98712 68%,#794307 100%);box-shadow:0 3px 5px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.18);color:#6f4208;font:bold clamp(8px,3vw,12px)/1 sans-serif;will-change:left,top,transform}.coin-pusher-coin.lower{filter:saturate(.92) brightness(.92)}.coin-pusher-coin.player{z-index:4;border-color:#4dbce9;background:radial-gradient(circle at 32% 27%,#e8fbff 0,#74d5f4 25%,#2584b0 70%,#15506c 100%);color:#e9fbff;box-shadow:0 0 12px rgba(87,199,240,.58)}
        .coin-pusher-tray{display:flex;justify-content:space-between;align-items:center;padding:13px 8px;color:#91a3b5;font-size:10px;font-weight:800;letter-spacing:.12em}.coin-pusher-tray strong{color:#f4cd58;font-size:15px;letter-spacing:.02em}
        .coin-pusher-controls{display:grid;gap:10px;width:min(100%,460px);margin:18px auto 2px}.coin-pusher-controls label{color:#aab9c6;font-size:12px;font-weight:750}.coin-pusher-controls input{width:100%;accent-color:#62c8ef}.coin-pusher-controls button{width:100%;padding:15px;border:1px solid #d99d24;border-radius:10px;background:linear-gradient(#f5c94e,#d88718);box-shadow:0 5px 0 #84500e;color:#2e2108;font-size:16px;font-weight:950;letter-spacing:.04em;cursor:pointer}.coin-pusher-controls button:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0 #84500e}.coin-pusher-controls button:disabled{filter:saturate(.25);opacity:.62;cursor:not-allowed}.coin-pusher-controls p{margin:3px 0 0;text-align:center;color:#8496a8;font-size:11px}
        @keyframes pusher-pulse{0%,68%,100%{transform:scale(1);filter:brightness(1)}34%{transform:scale(1.2);filter:brightness(1.35)}}
        @media(max-width:520px){.coin-pusher-game{padding:12px;border-radius:12px}.coin-pusher-header{align-items:flex-end}.coin-pusher-header h2{font-size:22px}.coin-pusher-rules{font-size:10px}.coin-pusher-machine{padding:8px 8px 0}.coin-pusher-controls{margin-top:13px}}
      `}</style>
    </section>
  );
};

export default CoinPusherGame;
