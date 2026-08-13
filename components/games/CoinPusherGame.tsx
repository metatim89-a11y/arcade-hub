import React, { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { CurrencyMode } from '../../types';
import { useCoinSystem } from '../../context/CoinContext';

const SHELF_WIDTH = 360;
const SHELF_HEIGHT = 560;
const UPPER_PUSHER_HOME_Y = 72;
const UPPER_PUSHER_EXTENDED_Y = 192;
const LOWER_PUSHER_HOME_Y = 292;
const LOWER_PUSHER_EXTENDED_Y = 370;
const TRANSFER_EDGE_Y = 264;
const MIN_PUSH_MS = 1600;
const MAX_PUSH_MS = 2600;
const SLOW_ZONE_Y = 430;
const PRIZE_EDGE_Y = SHELF_HEIGHT + 8;
const GUTTER_WIDTH = 50;
const BET_AMOUNT = 10;
const PAYOUT_PER_COIN = 5;
const POWER_COSTS = { bump: 25, rain: 80, bumpers: 60 } as const;
const DROP_LANES = [8, 22, 36, 50, 64, 78, 92] as const;

type CoinKind = 'dime' | 'penny' | 'nickel' | 'quarter';

const COIN_SPECS: Record<CoinKind, { label: string; diameterMm: number; mark: string }> = {
  dime: { label: 'Dime', diameterMm: 17.91, mark: '10¢' },
  penny: { label: 'Penny', diameterMm: 19.05, mark: '1¢' },
  nickel: { label: 'Nickel', diameterMm: 21.21, mark: '5¢' },
  quarter: { label: 'Quarter', diameterMm: 24.26, mark: '25¢' }
};
const QUARTER_RADIUS = 12;
const coinRadius = (kind: CoinKind) =>
  (COIN_SPECS[kind].diameterMm / COIN_SPECS.quarter.diameterMm) * QUARTER_RADIUS;
const randomCoinKind = (): CoinKind => {
  const kinds: CoinKind[] = ['dime', 'penny', 'nickel', 'quarter'];
  return kinds[Math.floor(Math.random() * kinds.length)];
};
const randomPushDuration = () => MIN_PUSH_MS + Math.random() * (MAX_PUSH_MS - MIN_PUSH_MS);

type DisplayCoin = {
  id: number;
  x: number;
  y: number;
  angle: number;
  playerCoin: boolean;
  kind: CoinKind;
  radius: number;
};

type DisplayFrame = {
  coins: DisplayCoin[];
  upperPusherY: number;
  lowerPusherY: number;
  cycleProgress: number;
  strokeDuration: number;
  isAdvancing: boolean;
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
    upperPusherY: UPPER_PUSHER_HOME_Y,
    lowerPusherY: LOWER_PUSHER_HOME_Y,
    cycleProgress: 0,
    strokeDuration: MIN_PUSH_MS,
    isAdvancing: true
  });
  const [isDropping, setIsDropping] = useState(false);
  const [feedback, setFeedback] = useState('Choose a lane and drop a coin onto the moving upper shelf.');
  const [lastWin, setLastWin] = useState(0);
  const [bumpersActive, setBumpersActive] = useState(false);

  const engineRef = useRef<Matter.Engine | null>(null);
  const nextCoinIdRef = useRef(1);
  const mountedRef = useRef(true);
  const dropPendingRef = useRef(false);
  const powerPendingRef = useRef(false);
  const bumperBodiesRef = useRef<Matter.Body[]>([]);
  const bumperTimerRef = useRef<number | null>(null);
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
    // Rails stop above the prize run so crowded coins can spill into side gutters near the front.
    const leftWall = Matter.Bodies.rectangle(-8, SLOW_ZONE_Y / 2, 16, SLOW_ZONE_Y, wallOptions);
    const rightWall = Matter.Bodies.rectangle(SHELF_WIDTH + 8, SLOW_ZONE_Y / 2, 16, SLOW_ZONE_Y, wallOptions);
    const backWall = Matter.Bodies.rectangle(SHELF_WIDTH / 2, -8, SHELF_WIDTH, 16, wallOptions);
    const upperPusher = Matter.Bodies.rectangle(SHELF_WIDTH / 2, UPPER_PUSHER_HOME_Y, SHELF_WIDTH - 24, 38, {
      isStatic: true,
      friction: 0.08,
      restitution: 0.02,
      label: 'upper-pusher'
    });
    const lowerPusher = Matter.Bodies.rectangle(SHELF_WIDTH / 2, LOWER_PUSHER_HOME_Y, SHELF_WIDTH - 24, 34, {
      isStatic: true,
      friction: 0.1,
      restitution: 0.02,
      label: 'lower-pusher'
    });
    Matter.World.add(world, [leftWall, rightWall, backWall, upperPusher, lowerPusher]);

    const startingCoins: Matter.Body[] = [];
    const addStartingRow = (row: number, y: number, columns = 8) => {
      for (let column = 0; column < columns; column += 1) {
        const x = 25 + column * 43 + (row % 2 ? 10 : 0);
        if (x > SHELF_WIDTH - 22) continue;
        const kind = randomCoinKind();
        startingCoins.push(Matter.Bodies.circle(x, y, coinRadius(kind), {
          restitution: 0.05,
          friction: 0.12,
          frictionAir: 0.1,
          density: 0.012,
          label: 'coin',
          plugin: {
            coinId: nextCoinIdRef.current++,
            playerCoin: false,
            kind
          }
        }));
      }
    };

    // A loaded upper shelf feeds a deliberately crowded lower shelf.
    [126, 158, 198, 232].forEach((y, row) => addStartingRow(row, y));
    [406, 438, 470, 502, 534].forEach((y, row) => addStartingRow(row + 4, y));
    Matter.World.add(world, startingCoins);

    let animationFrame = 0;
    let previousTime = performance.now();
    let previousRender = 0;
    let strokeStartedAt = performance.now();
    let strokeDuration = randomPushDuration();
    let upperIsAdvancing = true;

    const update = (time: number) => {
      const delta = Math.min(32, Math.max(8, time - previousTime));
      previousTime = time;

      if (time - strokeStartedAt >= strokeDuration) {
        upperIsAdvancing = !upperIsAdvancing;
        strokeStartedAt = time;
        strokeDuration = randomPushDuration();
      }
      const cycleProgress = Math.min(1, (time - strokeStartedAt) / strokeDuration);
      const easedProgress = easeInOut(cycleProgress);
      const upperTravel = upperIsAdvancing ? easedProgress : 1 - easedProgress;
      // The shelves alternate: the upper plate feeds the lower deck, then the lower plate clears the prize edge.
      const lowerTravel = 1 - upperTravel;
      const upperPusherY = UPPER_PUSHER_HOME_Y + upperTravel * (UPPER_PUSHER_EXTENDED_Y - UPPER_PUSHER_HOME_Y);
      const lowerPusherY = LOWER_PUSHER_HOME_Y + lowerTravel * (LOWER_PUSHER_EXTENDED_Y - LOWER_PUSHER_HOME_Y);
      Matter.Body.setPosition(upperPusher, { x: SHELF_WIDTH / 2, y: upperPusherY }, true);
      Matter.Body.setPosition(lowerPusher, { x: SHELF_WIDTH / 2, y: lowerPusherY }, true);

      Matter.Engine.update(engine, delta);

      const prizeCoins: Matter.Body[] = [];
      const gutterCoins: Matter.Body[] = [];
      for (const body of world.bodies) {
        if (body.label !== 'coin') continue;

        // The last 30% is a slower open run: its sides are unrailed, but collection is only at the bottom.
        body.frictionAir = body.position.y >= SLOW_ZONE_Y ? 0.14 : 0.09;
        const radius = body.circleRadius ?? QUARTER_RADIUS;
        const slippedOffSide = body.position.y >= SLOW_ZONE_Y
          && (body.position.x < -radius || body.position.x > SHELF_WIDTH + radius);
        if (slippedOffSide) gutterCoins.push(body);
        if (body.position.y > PRIZE_EDGE_Y) {
          if (body.position.x < GUTTER_WIDTH || body.position.x > SHELF_WIDTH - GUTTER_WIDTH) {
            if (!gutterCoins.includes(body)) gutterCoins.push(body);
          } else prizeCoins.push(body);
        }
      }

      if (prizeCoins.length > 0 || gutterCoins.length > 0) {
        Matter.World.remove(world, [...prizeCoins, ...gutterCoins]);
        queuePayout(prizeCoins.length);
        if (!prizeCoins.length && gutterCoins.length) setFeedback(`${gutterCoins.length} coin${gutterCoins.length === 1 ? '' : 's'} slipped into the gutter.`);
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
            kind: (body.plugin.kind as CoinKind) || 'quarter',
            radius: body.circleRadius ?? QUARTER_RADIUS
          }));
        setFrame({
          coins,
          upperPusherY,
          lowerPusherY,
          cycleProgress,
          strokeDuration,
          isAdvancing: upperIsAdvancing
        });
      }

      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(animationFrame);
      payoutQueueRef.current = [];
      if (bumperTimerRef.current) window.clearTimeout(bumperTimerRef.current);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
    };
  }, [queuePayout]);

  const dropCoinAt = useCallback(async (requestedPercent: number) => {
    if (dropPendingRef.current || isProcessing) return;
    const requested = clampPercent(requestedPercent);
    const dropPercent = DROP_LANES.reduce((nearest, lane) =>
      Math.abs(lane - requested) < Math.abs(nearest - requested) ? lane : nearest
    , DROP_LANES[0]);
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
    const kind = randomCoinKind();
    // Drop in front of the upper plate so a coin can never disappear behind it.
    const safeDropY = Math.min(TRANSFER_EDGE_Y - 26, Math.max(112, frame.upperPusherY + 28));
    const coin = Matter.Bodies.circle(x, safeDropY, coinRadius(kind), {
      restitution: 0.05,
      friction: 0.12,
      frictionAir: 0.1,
      density: 0.012,
      label: 'coin',
      plugin: {
        coinId: nextCoinIdRef.current++,
        playerCoin: true,
        kind
      }
    });
    Matter.World.add(engine.world, coin);
    hasPlayedRef.current = true;
    setFeedback(`${COIN_SPECS[kind].label} dropped in lane ${DROP_LANES.indexOf(dropPercent as typeof DROP_LANES[number]) + 1}. Watch the upper shelf feed it forward.`);
    setIsDropping(false);
    dropPendingRef.current = false;
  }, [canBet, currencyMode, frame.upperPusherY, isProcessing, subtractCoins]);

  const activatePower = useCallback(async (power: keyof typeof POWER_COSTS) => {
    if (powerPendingRef.current || isProcessing) return;
    const cost = POWER_COSTS[power];
    if (!canBet(cost)) {
      setFeedback(`You need ${cost} ${currencyMode === 'fun' ? 'FC' : 'RC'} for that power.`);
      return;
    }
    powerPendingRef.current = true;
    setFeedback('Charging super power…');
    const powerCurrency = currencyMode;
    const charged = await subtractCoins(cost, `Coin Pusher · ${power}`, powerCurrency);
    const engine = engineRef.current;
    if (!charged || !engine || !mountedRef.current) {
      if (charged && !engine) await addCoinsRef.current(cost, 'Coin Pusher Power Refund', powerCurrency);
      if (mountedRef.current) setFeedback(charged ? 'The table was unavailable, so the power was refunded.' : 'The power was not charged.');
      powerPendingRef.current = false;
      return;
    }
    hasPlayedRef.current = true;
    const coins = engine.world.bodies.filter((body) => body.label === 'coin');

    if (power === 'bump') {
      coins.forEach((body) => Matter.Body.setVelocity(body, {
        x: body.velocity.x + (SHELF_WIDTH / 2 - body.position.x) * 0.012,
        y: Math.max(body.velocity.y, 5.4)
      }));
      setFeedback('BUMP! Every coin surged toward the prize tray.');
    } else if (power === 'rain') {
      const rainCoins = Array.from({ length: 14 }, (_, index) => {
        const kind = randomCoinKind();
        return Matter.Bodies.circle(28 + Math.random() * (SHELF_WIDTH - 56), Math.min(TRANSFER_EDGE_Y - 28, Math.max(110, frame.upperPusherY + 28)) - (index % 3) * 3, coinRadius(kind), {
          restitution: 0.06, friction: 0.12, frictionAir: 0.09, density: 0.012, label: 'coin',
          plugin: { coinId: nextCoinIdRef.current++, playerCoin: true, kind }
        });
      });
      Matter.World.add(engine.world, rainCoins);
      setFeedback('COIN RAIN! Fourteen mixed U.S. coins hit the table.');
    } else {
      if (bumperBodiesRef.current.length) Matter.World.remove(engine.world, bumperBodiesRef.current);
      const positions = [{ x: 92, y: 438 }, { x: 180, y: 462 }, { x: 268, y: 438 }, { x: 130, y: 506 }, { x: 230, y: 506 }];
      bumperBodiesRef.current = positions.map(({ x, y }) => Matter.Bodies.circle(x, y, 13, {
        isStatic: true, restitution: 1.15, friction: 0, label: 'power-bumper'
      }));
      Matter.World.add(engine.world, bumperBodiesRef.current);
      setBumpersActive(true);
      if (bumperTimerRef.current) window.clearTimeout(bumperTimerRef.current);
      bumperTimerRef.current = window.setTimeout(() => {
        const liveEngine = engineRef.current;
        if (liveEngine && bumperBodiesRef.current.length) Matter.World.remove(liveEngine.world, bumperBodiesRef.current);
        bumperBodiesRef.current = [];
        if (mountedRef.current) setBumpersActive(false);
      }, 12000);
      setFeedback('BOUNCE FIELD active for 12 seconds.');
    }
    powerPendingRef.current = false;
  }, [canBet, currencyMode, frame.upperPusherY, isProcessing, subtractCoins]);

  const handleShelfPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;
    const lane = DROP_LANES.reduce((nearest, candidate) =>
      Math.abs(candidate - percent) < Math.abs(nearest - percent) ? candidate : nearest
    , DROP_LANES[0]);
    setAimPercent(lane);
    void dropCoinAt(lane);
  }, [dropCoinAt]);

  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
  const aimX = 26 + (aimPercent / 100) * (SHELF_WIDTH - 52);
  const secondsToSwitch = Math.max(0, ((1 - frame.cycleProgress) * frame.strokeDuration) / 1000);

  return (
    <section className="coin-pusher-game" aria-label="Coin Pusher game">
      <header className="coin-pusher-header">
        <div>
          <div className="coin-pusher-kicker">Continuous skill table</div>
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
          <span>DUAL-SHELF DOZER · 7 DROP LANES</span>
          <span>{frame.isAdvancing ? 'UPPER PUSH' : 'LOWER PUSH'} · {secondsToSwitch.toFixed(1)}S</span>
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
          <div className="coin-pusher-upper-zone"><span>UPPER LOADING SHELF</span></div>
          <div className="coin-pusher-deck-edge"><span>TRANSFER EDGE</span></div>
          <div className="coin-pusher-slow-zone"><span>LOWER PRIZE SHELF</span></div>
          <div className="coin-pusher-gutter left">GUTTER</div>
          <div className="coin-pusher-gutter right">GUTTER</div>
          <div className="coin-pusher-aim" style={{ left: `${(aimX / SHELF_WIDTH) * 100}%` }}>
            <span />
          </div>
          <div className="coin-pusher-plate" style={{ top: `${((frame.upperPusherY - 19) / SHELF_HEIGHT) * 100}%` }}>
            <div className="coin-pusher-plate-face">UPPER PUSHER</div>
          </div>
          <div className="coin-pusher-lower-plate" style={{ top: `${((frame.lowerPusherY - 17) / SHELF_HEIGHT) * 100}%` }}>
            <span>LOWER PUSHER</span>
          </div>
          {bumpersActive && [
            { x: 92, y: 438 }, { x: 180, y: 462 }, { x: 268, y: 438 }, { x: 130, y: 506 }, { x: 230, y: 506 }
          ].map((bumper, index) => <div key={index} className="coin-power-bumper" style={{ left: `${bumper.x / SHELF_WIDTH * 100}%`, top: `${bumper.y / SHELF_HEIGHT * 100}%` }} />)}

          {frame.coins.map((coin) => (
            <div
              key={coin.id}
              className={`coin-pusher-coin ${coin.kind}${coin.playerCoin ? ' player' : ''}`}
              style={{
                left: `${(coin.x / SHELF_WIDTH) * 100}%`,
                top: `${(coin.y / SHELF_HEIGHT) * 100}%`,
                width: `${(coin.radius * 2 / SHELF_WIDTH) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${coin.angle}deg)`
              }}
              title={COIN_SPECS[coin.kind].label}
            >
              <span>{COIN_SPECS[coin.kind].mark}</span>
            </div>
          ))}
        </div>
        <div className="coin-pusher-tray">
          <span>LAST WIN</span>
          <strong>{lastWin} {currencySymbol}</strong>
        </div>
      </div>

      <div className="coin-pusher-controls">
        <div className="coin-pusher-powers">
          <button type="button" disabled={isProcessing} onClick={() => void activatePower('bump')}><span>💥</span><strong>BUMP</strong><small>{POWER_COSTS.bump} {currencySymbol}</small></button>
          <button type="button" disabled={isProcessing} onClick={() => void activatePower('rain')}><span>🪙</span><strong>COIN RAIN</strong><small>{POWER_COSTS.rain} {currencySymbol}</small></button>
          <button type="button" disabled={isProcessing || bumpersActive} onClick={() => void activatePower('bumpers')}><span>🔵</span><strong>{bumpersActive ? 'ACTIVE' : 'BUMPERS'}</strong><small>{bumpersActive ? '12 SEC' : `${POWER_COSTS.bumpers} ${currencySymbol}`}</small></button>
        </div>
        <label>Choose drop lane</label>
        <div className="coin-pusher-lanes" role="group" aria-label="Coin drop lane">
          {DROP_LANES.map((lane, index) => (
            <button
              key={lane}
              type="button"
              className={aimPercent === lane ? 'active' : ''}
              aria-pressed={aimPercent === lane}
              disabled={isDropping || isProcessing}
              onClick={() => setAimPercent(lane)}
            >
              <span>▼</span>{index + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={isDropping || isProcessing}
          onClick={() => void dropCoinAt(aimPercent)}
        >
          {isDropping ? 'DROPPING…' : `DROP IN LANE ${DROP_LANES.indexOf(aimPercent as typeof DROP_LANES[number]) + 1} · ${BET_AMOUNT} ${currencySymbol}`}
        </button>
        <p>The upper shelf feeds the lower shelf. The lower pusher drives the crowd toward the center prize tray; side-gutter coins do not pay.</p>
      </div>

      <style>{`
        .coin-pusher-game{width:min(100%,760px);margin:0 auto;padding:18px;color:#eef5fa;background:linear-gradient(160deg,#0a1420,#101d2b);border:1px solid #294058;border-radius:18px;box-shadow:0 22px 60px rgba(0,0,0,.38);user-select:none}
        .coin-pusher-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:4px 4px 16px}.coin-pusher-kicker{color:#6dc7ee;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.coin-pusher-header h2{margin:3px 0 0;font-size:26px;line-height:1}.coin-pusher-rules{display:grid;gap:3px;text-align:right;color:#9fb0c1;font-size:12px}
        .coin-pusher-status{display:flex;align-items:center;gap:9px;min-height:42px;padding:10px 13px;margin-bottom:12px;border:1px solid #263d53;border-radius:9px;background:#0a111a;color:#d6e1e9;font-size:13px}.status-light{width:8px;height:8px;border-radius:50%;background:#5b6c7d;box-shadow:0 0 0 4px rgba(91,108,125,.12)}.status-light.active{background:#52d6a3;box-shadow:0 0 0 4px rgba(82,214,163,.14);animation:pusher-pulse 2.5s infinite}
        .coin-pusher-machine{width:min(100%,430px);margin:0 auto;padding:12px 12px 0;border:1px solid #40556b;border-radius:14px;background:linear-gradient(145deg,#26384a,#111b26 58%);box-shadow:inset 0 1px rgba(255,255,255,.08),0 18px 30px rgba(0,0,0,.3)}.coin-pusher-topbar{display:flex;justify-content:space-between;gap:8px;padding:0 5px 9px;color:#95aabc;font-size:9px;font-weight:800;letter-spacing:.1em}.coin-pusher-shelf{position:relative;width:360px;max-width:100%;height:auto;aspect-ratio:360/560;margin:auto;overflow:hidden;touch-action:manipulation;cursor:crosshair;border:8px solid #172330;border-bottom:0;border-radius:7px 7px 0 0;background:linear-gradient(#1b2e40 0 47%,#0f202c 47% 100%);box-shadow:inset 0 0 35px rgba(0,0,0,.65);outline:none}.coin-pusher-shelf:focus-visible{box-shadow:inset 0 0 35px rgba(0,0,0,.65),0 0 0 3px #65ccef}.coin-pusher-shelf.dropping{cursor:wait}.coin-pusher-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(120,167,196,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(120,167,196,.08) 1px,transparent 1px);background-size:10% 5.71%}.coin-pusher-upper-zone{position:absolute;inset:0 0 auto;height:${TRANSFER_EDGE_Y / SHELF_HEIGHT * 100}%;border-bottom:4px solid #758896;background:linear-gradient(rgba(77,128,158,.09),rgba(22,51,68,.24));box-shadow:0 10px 15px rgba(0,0,0,.48);pointer-events:none}.coin-pusher-upper-zone span,.coin-pusher-slow-zone span{position:absolute;top:5px;left:50%;transform:translateX(-50%);color:rgba(165,221,238,.56);font-size:7px;font-weight:900;letter-spacing:.16em;white-space:nowrap}.coin-pusher-deck-edge{position:absolute;z-index:7;left:4%;right:4%;top:${TRANSFER_EDGE_Y / SHELF_HEIGHT * 100}%;height:13px;transform:translateY(-50%);border:1px solid #a9bac3;border-radius:2px;background:linear-gradient(#d1d9dc,#536773 55%,#243541);box-shadow:0 8px 12px rgba(0,0,0,.55);pointer-events:none}.coin-pusher-deck-edge span{position:absolute;right:5px;top:2px;color:#1a2831;font-size:6px;font-weight:950;letter-spacing:.1em}.coin-pusher-slow-zone{position:absolute;left:0;right:0;top:${SLOW_ZONE_Y / SHELF_HEIGHT * 100}%;bottom:0;border-top:1px dashed rgba(106,213,238,.4);background:linear-gradient(rgba(32,115,139,.06),rgba(25,95,116,.24));pointer-events:none}.coin-pusher-gutter{position:absolute;z-index:6;bottom:0;width:${GUTTER_WIDTH / SHELF_WIDTH * 100}%;height:${(SHELF_HEIGHT - SLOW_ZONE_Y) / SHELF_HEIGHT * 100}%;display:grid;place-items:center;background:repeating-linear-gradient(45deg,#121b22 0 5px,#26313a 5px 10px);border-top:2px solid #61717b;color:#778791;font-size:6px;font-weight:900;letter-spacing:.08em;writing-mode:vertical-rl;pointer-events:none}.coin-pusher-gutter.left{left:0;border-right:2px solid #0a1116}.coin-pusher-gutter.right{right:0;border-left:2px solid #0a1116}.coin-pusher-aim{position:absolute;top:1%;z-index:9;width:2px;height:21%;pointer-events:none;background:linear-gradient(#70d4ff,transparent);transform:translateX(-1px);filter:drop-shadow(0 0 5px #67cfff)}.coin-pusher-aim span{position:absolute;top:0;left:50%;width:9px;height:9px;border-top:2px solid #83dcff;border-left:2px solid #83dcff;transform:translate(-50%,-1px) rotate(45deg)}
        .coin-pusher-plate{position:absolute;left:1.56%;z-index:5;width:96.88%;height:10%;pointer-events:none;border:1px solid #6a7c8d;border-radius:5px;background:linear-gradient(#718395,#3b4a58);box-shadow:0 9px 14px rgba(0,0,0,.45);will-change:top}.coin-pusher-plate-face{position:absolute;inset:auto 0 0;padding:3px;text-align:center;border-top:1px solid rgba(255,255,255,.17);color:#d8e1e8;font-size:9px;font-weight:900;letter-spacing:.22em}
        .coin-pusher-lower-plate{position:absolute;left:1.56%;z-index:5;width:96.88%;height:6.07%;pointer-events:none;border:1px solid #426d80;border-radius:4px;background:linear-gradient(#47788c,#203c4a);box-shadow:0 8px 13px rgba(0,0,0,.5);text-align:center;will-change:top}.coin-pusher-lower-plate span{position:relative;top:4px;color:#bcebf7;font-size:7px;font-weight:900;letter-spacing:.17em}
        .coin-power-bumper{position:absolute;z-index:5;width:8.125%;aspect-ratio:1;transform:translate(-50%,-50%);border:3px solid #8be7ff;border-radius:50%;background:radial-gradient(circle,#f4fdff 0,#58cce9 28%,#16718d 68%,#0a3443);box-shadow:0 0 16px #58dfff,inset 0 0 0 3px rgba(255,255,255,.22);pointer-events:none}
        .coin-pusher-coin{position:absolute;z-index:3;display:grid;place-items:center;height:auto;aspect-ratio:1;pointer-events:none;border:2px solid #777;border-radius:50%;background:radial-gradient(circle at 32% 27%,#fff 0,#cdd2d5 25%,#8c9499 72%,#555d62 100%);box-shadow:0 3px 5px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.2);color:#42494d;font:bold clamp(5px,2.2vw,9px)/1 sans-serif;will-change:left,top,transform}.coin-pusher-coin.penny{border-color:#814626;background:radial-gradient(circle at 32% 27%,#ffd09d 0,#bd713f 30%,#854525 72%,#542916 100%);color:#5f2d17}.coin-pusher-coin.dime{border-style:double}.coin-pusher-coin.quarter{box-shadow:0 3px 5px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.25),inset 0 0 0 4px rgba(60,66,70,.18)}.coin-pusher-coin.lower{filter:saturate(.92) brightness(.92)}.coin-pusher-coin.player{z-index:4;box-shadow:0 0 0 2px #55c8f3,0 0 13px rgba(87,199,240,.72),inset 0 0 0 2px rgba(255,255,255,.25)}
        .coin-pusher-tray{display:flex;justify-content:space-between;align-items:center;padding:13px 8px;color:#91a3b5;font-size:10px;font-weight:800;letter-spacing:.12em}.coin-pusher-tray strong{color:#f4cd58;font-size:15px;letter-spacing:.02em}
        .coin-pusher-controls{display:grid;gap:10px;width:min(100%,560px);margin:18px auto 2px}.coin-pusher-controls label{color:#aab9c6;font-size:12px;font-weight:750}.coin-pusher-controls input{width:100%;accent-color:#62c8ef}.coin-pusher-controls>button{width:100%;padding:15px;border:1px solid #d99d24;border-radius:10px;background:linear-gradient(#f5c94e,#d88718);box-shadow:0 5px 0 #84500e;color:#2e2108;font-size:16px;font-weight:950;letter-spacing:.04em;cursor:pointer}.coin-pusher-controls>button:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0 #84500e}.coin-pusher-controls button:disabled{filter:saturate(.25);opacity:.62;cursor:not-allowed}.coin-pusher-lanes{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.coin-pusher-lanes button{display:grid;place-items:center;gap:1px;min-width:0;padding:7px 2px;border:1px solid #365b70;border-radius:7px;background:#102536;color:#9bb9ca;font-size:10px;font-weight:900;cursor:pointer}.coin-pusher-lanes button span{font-size:11px;color:#69cbed}.coin-pusher-lanes button.active{border-color:#f0bd3f;background:#e9ad29;color:#261a05;box-shadow:0 0 13px rgba(240,189,63,.38)}.coin-pusher-lanes button.active span{color:#261a05}.coin-pusher-powers{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.coin-pusher-powers button{display:grid;place-items:center;gap:2px;min-width:0;padding:9px 4px;border:1px solid #365b70;border-radius:8px;background:linear-gradient(#17384b,#0b2331);color:#dff6ff;cursor:pointer}.coin-pusher-powers span{font-size:20px}.coin-pusher-powers strong{font-size:9px;letter-spacing:.08em}.coin-pusher-powers small{color:#78a4b7;font-size:7px}.coin-pusher-controls p{margin:3px 0 0;text-align:center;color:#8496a8;font-size:11px}
        .coin-pusher-gutter{z-index:2;top:${SLOW_ZONE_Y / SHELF_HEIGHT * 100}%;bottom:0;height:auto;background:linear-gradient(90deg,rgba(5,10,14,.72),rgba(18,29,37,.08));border-top:1px solid rgba(97,113,123,.35)}.coin-pusher-gutter.left{border-right:2px dashed rgba(113,137,150,.28)}.coin-pusher-gutter.right{border-left:2px dashed rgba(113,137,150,.28);background:linear-gradient(270deg,rgba(5,10,14,.72),rgba(18,29,37,.08))}
        @keyframes pusher-pulse{0%,68%,100%{transform:scale(1);filter:brightness(1)}34%{transform:scale(1.2);filter:brightness(1.35)}}
        @media(max-width:520px){.coin-pusher-game{padding:12px;border-radius:12px}.coin-pusher-header{align-items:flex-end}.coin-pusher-header h2{font-size:22px}.coin-pusher-rules{font-size:10px}.coin-pusher-machine{padding:8px 8px 0}.coin-pusher-controls{margin-top:13px}}
      `}</style>
    </section>
  );
};

export default CoinPusherGame;
