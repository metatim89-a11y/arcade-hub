
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

// --- Types ---
interface FishData {
    id: number;
    type: string;
    hp: number;
    maxHp: number;
    value: number;
    emoji: string;
    scale: number;
    color: string;
}

// --- Constants ---
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const BULLET_SPEED = 22;
const FISH_SPAWN_MARGIN = 200;
const BET_AMOUNT_DEFAULT = 10;

const FISH_DEFINITIONS: Record<string, { emoji: string, hp: number, value: number, speed: number, scale: number, color: string }> = {
  jelly:   { emoji: '🪼', hp: 2, value: 0.5, speed: 1.2, scale: 25, color: '#cc88ff' },
  shrimp:  { emoji: '🦐', hp: 2, value: 0.8, speed: 3.0, scale: 22, color: '#ff8888' },
  crab:    { emoji: '🦀', hp: 5, value: 1.5, speed: 0.8, scale: 32, color: '#ff4444' },
  guppy:   { emoji: '🐠', hp: 4, value: 2.0, speed: 2.5, scale: 45, color: '#44ccff' },
  sardine: { emoji: '🐟', hp: 6, value: 3.0, speed: 2.8, scale: 48, color: '#6688aa' },
  clown:   { emoji: '🐡', hp: 12, value: 5.0, speed: 2.0, scale: 60, color: '#ffaa00' },
  squid:   { emoji: '🦑', hp: 20, value: 8.0, speed: 3.0, scale: 70, color: '#ffccdd' },
  turtle:  { emoji: '🐢', hp: 40, value: 15.0, speed: 1.0, scale: 90, color: '#88ff88' },
  shark:   { emoji: '🦈', hp: 100, value: 30.0, speed: 2.5, scale: 150, color: '#999999' },
  whale:   { emoji: '🐋', hp: 250, value: 60.0, speed: 0.6, scale: 220, color: '#5555aa' },
  dragon:  { emoji: '🐉', hp: 500, value: 150.0, speed: 1.8, scale: 240, color: '#44ff44' },
  gold:    { emoji: '🌟', hp: 120, value: 100.0, speed: 4.5, scale: 80, color: '#ffd700' },
};

const FishingGame: React.FC = () => {
    const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [betAmount, setBetAmount] = useState(BET_AMOUNT_DEFAULT);
    const [isAuto, setIsAuto] = useState(false);
    const [isLockEnabled, setIsLockEnabled] = useState(false);
    const [lockedTargetId, setLockedTargetId] = useState<number | null>(null);
    const [coinsWon, setCoinsWon] = useState<{ x: number, y: number, text: string, id: number }[]>([]);
    const bubblesRef = useRef<{x: number, y: number, r: number, s: number}[]>([]);
    const [recoil, setRecoil] = useState(0);

    // Initialize bubbles
    useEffect(() => {
        const bubbles = [];
        for(let i=0; i<30; i++) {
            bubbles.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT,
                r: Math.random() * 5 + 2,
                s: Math.random() * 1 + 0.5
            });
        }
        bubblesRef.current = bubbles;
    }, []);

    // Matter.js Refs
    const engineRef = useRef(Matter.Engine.create({ gravity: { x: 0, y: 0 } }));
    const cannonAngleRef = useRef(-Math.PI / 2);
    const lastFireTime = useRef(0);
    const nextFishId = useRef(Date.now());
    const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

    const fireBullet = useCallback((targetId?: number) => {
        if (!canBet(betAmount)) return;

        const time = Date.now();
        if (time - lastFireTime.current < 150) return; // Rate limit
        lastFireTime.current = time;

        if (subtractCoins(betAmount, 'Fishing Shot')) {
            setRecoil(15);
            setTimeout(() => setRecoil(0), 100);
            const angle = cannonAngleRef.current;
            const spawnX = CANVAS_WIDTH / 2 + Math.cos(angle) * 80;
            const spawnY = CANVAS_HEIGHT - 60 + Math.sin(angle) * 80;

            const bullet = Matter.Bodies.circle(spawnX, spawnY, 8, {
                frictionAir: 0,
                restitution: 1,
                label: 'bullet',
                plugin: { 
                    damage: 1, 
                    cost: betAmount, 
                    targetId: targetId,
                    creationTime: time
                }
            });

            Matter.Body.setVelocity(bullet, {
                x: Math.cos(angle) * BULLET_SPEED,
                y: Math.sin(angle) * BULLET_SPEED
            });

            Matter.World.add(engineRef.current.world, bullet);
        }
    }, [betAmount, subtractCoins, canBet]);

    useEffect(() => {
        const engine = engineRef.current;
        const world = engine.world;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // --- Physics Setup ---
        const runner = Matter.Runner.create();
        Matter.Runner.run(runner, engine);

        // --- Collision Events ---
        Matter.Events.on(engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                const { bodyA, bodyB } = pair;
                const bullet = bodyA.label === 'bullet' ? bodyA : (bodyB.label === 'bullet' ? bodyB : null);
                const fish = bodyA.label === 'fish' ? bodyA : (bodyB.label === 'fish' ? bodyB : null);

                if (bullet && fish) {
                    // 1. Damage Logic
                    const fishData = fish.plugin as FishData;
                    fishData.hp -= bullet.plugin.damage;

                    // 2. Catch Chance
                    const catchChance = (0.4 / fishData.value) * 1.5;
                    const isCaught = fishData.hp <= 0 || Math.random() < catchChance * 0.15;

                    if (isCaught) {
                        const win = Math.floor(fishData.value * bullet.plugin.cost);
                        if (win > 0) {
                            addCoins(win, 'Fishing Win');
                            setCoinsWon(prev => [...prev.slice(-10), { 
                                x: fish.position.x, 
                                y: fish.position.y, 
                                text: `+${win}`, 
                                id: Date.now() + Math.random() 
                            }]);
                        }
                        Matter.World.remove(world, fish);
                        if (lockedTargetId === fishData.id) setLockedTargetId(null);
                    }

                    // 3. Remove Bullet
                    Matter.World.remove(world, bullet);
                }
            });
        });

        // --- Game Loop ---
        let animationFrame: number;
        let lastSpawn = 0;

        const update = () => {
            const time = Date.now();

            // 1. Spawn Fish
            if (time - lastSpawn > 800) {
                const typeKeys = Object.keys(FISH_DEFINITIONS);
                const type = typeKeys[Math.floor(Math.random() * typeKeys.length)];
                const def = FISH_DEFINITIONS[type];
                
                const side = Math.floor(Math.random() * 4);
                let x = 0, y = 0, vx = 0, vy = 0;
                
                if (side === 0) { x = -50; y = Math.random() * CANVAS_HEIGHT; vx = def.speed; }
                else if (side === 1) { x = CANVAS_WIDTH + 50; y = Math.random() * CANVAS_HEIGHT; vx = -def.speed; }
                else if (side === 2) { x = Math.random() * CANVAS_WIDTH; y = -50; vy = def.speed; }
                else { x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + 50; vy = -def.speed; }

                const fish = Matter.Bodies.circle(x, y, def.scale / 2, {
                    frictionAir: 0.02,
                    label: 'fish',
                    plugin: {
                        id: nextFishId.current++,
                        type,
                        hp: def.hp,
                        maxHp: def.hp,
                        value: def.value,
                        emoji: def.emoji,
                        scale: def.scale,
                        color: def.color,
                        vx, vy
                    }
                });
                Matter.Body.setVelocity(fish, { x: vx, y: vy });
                Matter.World.add(world, fish);
                lastSpawn = time;
            }

            // 2. Auto-Fire Logic
            if (isAuto) {
                fireBullet(lockedTargetId || undefined);
            }

            // 3. Update Homing Bullets & Cleanup
            world.bodies.forEach(body => {
                if (body.label === 'bullet') {
                    // Homing
                    if (body.plugin.targetId) {
                        const target = world.bodies.find(b => b.label === 'fish' && b.plugin.id === body.plugin.targetId);
                        if (target) {
                            const dx = target.position.x - body.position.x;
                            const dy = target.position.y - body.position.y;
                            const angle = Math.atan2(dy, dx);
                            Matter.Body.setVelocity(body, {
                                x: Math.cos(angle) * BULLET_SPEED,
                                y: Math.sin(angle) * BULLET_SPEED
                            });
                        }
                    }
                    // Offscreen cleanup
                    if (body.position.x < -100 || body.position.x > CANVAS_WIDTH + 100 || 
                        body.position.y < -100 || body.position.y > CANVAS_HEIGHT + 100) {
                        Matter.World.remove(world, body);
                    }
                }
                
                if (body.label === 'fish') {
                    // Apply swimming force to keep them moving
                    const data = body.plugin;
                    Matter.Body.applyForce(body, body.position, { x: data.vx * 0.0001, y: data.vy * 0.0001 });
                    
                    // Offscreen cleanup
                    if (body.position.x < -400 || body.position.x > CANVAS_WIDTH + 400 || 
                        body.position.y < -400 || body.position.y > CANVAS_HEIGHT + 400) {
                        Matter.World.remove(world, body);
                    }
                }
            });

            // 4. Draw
            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            // Background
            const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
            bgGradient.addColorStop(0, '#005588');
            bgGradient.addColorStop(1, '#001122');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Draw Bubbles
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            bubblesRef.current.forEach(b => {
                b.y -= b.s;
                if (b.y < -20) b.y = CANVAS_HEIGHT + 20;
                b.x += Math.sin(b.y / 50) * 0.5;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.stroke();
            });

            // Draw Fish
            world.bodies.forEach(body => {
                if (body.label === 'fish') {
                    const data = body.plugin as FishData;
                    ctx.save();
                    ctx.translate(body.position.x, body.position.y);
                    ctx.rotate(Math.atan2(body.velocity.y, body.velocity.x));
                    
                    // Emoji Flip
                    if (body.velocity.x < 0) ctx.scale(1, -1);

                    ctx.font = `${data.scale}px serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(data.emoji, 0, 0);
                    
                    // HP Bar
                    if (data.hp < data.maxHp) {
                        const barWidth = data.scale;
                        ctx.fillStyle = 'rgba(0,0,0,0.5)';
                        ctx.fillRect(-barWidth/2, -data.scale/2 - 10, barWidth, 4);
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(-barWidth/2, -data.scale/2 - 10, barWidth * (data.hp / data.maxHp), 4);
                    }
                    
                    if (lockedTargetId === data.id) {
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.arc(0, 0, data.scale/1.5, 0, Math.PI*2); ctx.stroke();
                    }
                    
                    ctx.restore();
                }

                if (body.label === 'bullet') {
                    ctx.fillStyle = '#fff';
                    ctx.shadowColor = '#0ff';
                    ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.arc(body.position.x, body.position.y, 8, 0, Math.PI*2); ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });

            // Cannon
            ctx.save();
            ctx.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT-40);
            ctx.rotate(cannonAngleRef.current);
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-recoil, -20, 90, 40);
            ctx.fillStyle = '#444';
            ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI*2); ctx.fill();
            ctx.restore();

            animationFrame = requestAnimationFrame(update);
        };

        animationFrame = requestAnimationFrame(update);

        return () => {
            cancelAnimationFrame(animationFrame);
            Matter.Runner.stop(runner);
            Matter.World.clear(world, false);
            Matter.Engine.clear(engine);
        };
    }, [isAuto, lockedTargetId, fireBullet, addCoins]);

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
        const y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
        
        if (!lockedTargetId) {
            cannonAngleRef.current = Math.atan2(y - (CANVAS_HEIGHT - 40), x - CANVAS_WIDTH / 2);
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isLockEnabled) {
            fireBullet();
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
        const y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);

        // Find clicked fish
        const bodies = engineRef.current.world.bodies;
        let clickedFish = null;
        for (const body of bodies) {
            if (body.label === 'fish') {
                const dist = Math.sqrt((x - body.position.x)**2 + (y - body.position.y)**2);
                if (dist < body.plugin.scale) {
                    clickedFish = body.plugin.id;
                    break;
                }
            }
        }
        setLockedTargetId(clickedFish);
    };

    return (
        <div className="flex flex-col items-center gap-4 w-full">
            <h2 className="text-3xl font-black text-blue-400 italic">OCEAN HUNTER 3D</h2>
            
            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border-8 border-blue-900 bg-black aspect-video">
                <canvas 
                    ref={canvasRef} 
                    width={CANVAS_WIDTH} 
                    height={CANVAS_HEIGHT}
                    onMouseMove={handleMouseMove}
                    onClick={handleCanvasClick}
                    className="w-full h-full cursor-crosshair"
                />
            </div>

            <div className="w-full bg-gray-900/90 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 border border-blue-500/30">
                <div className="flex items-center gap-2 bg-black/50 p-2 rounded-lg">
                    <button onClick={() => setBetAmount(Math.max(10, betAmount - 10))} className="btn-square">-</button>
                    <span className="w-20 text-center text-xl font-bold text-yellow-400">{betAmount}</span>
                    <button onClick={() => setBetAmount(betAmount + 10)} className="btn-square">+</button>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsAuto(!isAuto)}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${isAuto ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-white'}`}
                    >
                        {isAuto ? 'AUTO ON' : 'AUTO OFF'}
                    </button>
                    <button 
                        onClick={() => {
                            setIsLockEnabled(!isLockEnabled);
                            if (isLockEnabled) setLockedTargetId(null);
                        }}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${isLockEnabled ? 'bg-red-500 text-white' : 'bg-gray-700 text-white'}`}
                    >
                        {isLockEnabled ? 'LOCK ON' : 'LOCK OFF'}
                    </button>
                </div>

                <div className="text-xl font-bold text-green-400">
                    {currencySymbol}
                </div>
            </div>

            <style>{`
                .btn-square {
                    width: 40px; height: 40px; background: #333; color: white; border-radius: 8px; font-bold; font-size: 20px;
                }
                .btn-square:hover { background: #444; }
            `}</style>
        </div>
    );
};

export default FishingGame;
