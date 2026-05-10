// File: components/games/CoinPusherGame.tsx
// Version: 1.0.1
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Matter from 'matter-js';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

// --- Constants ---
const SHELF_WIDTH = 320; 
const SHELF_HEIGHT = 400; 
const COIN_RADIUS = 13;
const PUSH_AMPLITUDE = 60;
const PUSHER_SPEED = 0.002;
const WIN_ZONE_Y = 380;
const SIDE_MARGIN = 5;
const BET_AMOUNT = 10;

const CoinPusherGame: React.FC = () => {
    const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
    const [feedback, setFeedback] = useState('Insert Coin to Start!');
    const [coinPositions, setCoinPositions] = useState<{id: number, x: number, y: number, angle: number, isNew: boolean}[]>([]);
    const [pusherY, setPusherY] = useState(40);
    
    // Matter.js Refs
    const engineRef = useRef(Matter.Engine.create({ 
        gravity: { x: 0, y: 0.1 } // Optimized gravity for smooth drift
    }));
    const pusherBodyRef = useRef<Matter.Body | null>(null);
    const coinsMapRef = useRef<Map<number, Matter.Body>>(new Map());
    const nextCoinId = useRef(Date.now());
    const [isShaking, setIsShaking] = useState(false);
    const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

    // --- Initialization ---
    useEffect(() => {
        const engine = engineRef.current;
        const world = engine.world;

        // 1. Create Boundaries (Smoother edges to prevent sticking)
        const ground = Matter.Bodies.rectangle(SHELF_WIDTH / 2, SHELF_HEIGHT + 50, SHELF_WIDTH * 2, 100, { isStatic: true });
        const leftWall = Matter.Bodies.rectangle(-15, SHELF_HEIGHT / 2, 30, SHELF_HEIGHT * 2, { 
            isStatic: true,
            friction: 0.01,
            restitution: 0.5
        });
        const rightWall = Matter.Bodies.rectangle(SHELF_WIDTH + 15, SHELF_HEIGHT / 2, 30, SHELF_HEIGHT * 2, { 
            isStatic: true,
            friction: 0.01,
            restitution: 0.5
        });
        
        // 2. Create Pusher (Better edge coverage)
        const pusher = Matter.Bodies.rectangle(SHELF_WIDTH / 2, 40, SHELF_WIDTH - 4, 80, { 
            isStatic: true,
            friction: 0.05,
            restitution: 0.1,
            render: { fillStyle: '#4a5568' }
        });
        pusherBodyRef.current = pusher;

        Matter.World.add(world, [ground, leftWall, rightWall, pusher]);

        // 3. Add Initial Coins
        const initialCoins: Matter.Body[] = [];
        for (let i = 0; i < 60; i++) {
            const x = SIDE_MARGIN + 20 + Math.random() * (SHELF_WIDTH - 2 * SIDE_MARGIN - 40);
            const y = 100 + Math.random() * 250;
            const coin = Matter.Bodies.circle(x, y, COIN_RADIUS, {
                restitution: 0.15,
                friction: 0.02,
                frictionAir: 0.03,
                density: 0.01,
                label: 'coin',
                plugin: { id: nextCoinId.current++ }
            });
            initialCoins.push(coin);
            coinsMapRef.current.set(coin.plugin.id, coin);
        }
        Matter.World.add(world, initialCoins);

        // 4. Physics Loop
        let animationFrame: number;
        let lastExtension = 0;

        const update = () => {
            const time = Date.now();
            
            // Move Pusher
            const extension = (Math.sin(time * PUSHER_SPEED) + 1) / 2;
            const newY = 40 + extension * PUSH_AMPLITUDE;
            Matter.Body.setPosition(pusher, { x: SHELF_WIDTH / 2, y: newY });
            setPusherY(newY);

            // Shake trigger
            if (extension > 0.98 && lastExtension <= 0.98) {
                setIsShaking(true);
                setTimeout(() => setIsShaking(false), 100);
            }
            lastExtension = extension;

            Matter.Engine.update(engine, 1000 / 60);

            // Sync State & Check for Wins
            const currentCoins: any[] = [];
            const coinsToRemoval: Matter.Body[] = [];
            
            world.bodies.forEach(body => {
                if (body.label === 'coin') {
                    if (body.position.y > WIN_ZONE_Y) {
                        coinsToRemoval.push(body);
                    } else {
                        // Anti-stuck: Add tiny random force
                        if (Math.random() > 0.99) {
                            Matter.Body.applyForce(body, body.position, { 
                                x: (Math.random() - 0.5) * 0.0001, 
                                y: 0 
                            });
                        }

                        currentCoins.push({
                            id: body.plugin.id,
                            x: (body.position.x / SHELF_WIDTH) * 100,
                            y: body.position.y,
                            angle: body.angle * (180 / Math.PI),
                            isNew: false
                        });
                    }
                }
            });

            // Cleanup win coins
            if (coinsToRemoval.length > 0) {
                Matter.World.remove(world, coinsToRemoval);
                coinsToRemoval.forEach(b => coinsMapRef.current.delete(b.plugin.id));
                
                // Adjusted Payout Balance (1.5x for falling coins)
                const prize = coinsToRemoval.length * BET_AMOUNT * 1.5;
                addCoins(Math.floor(prize), 'Pusher Win');
                setFeedback(`WON ${Math.floor(prize)} ${currencySymbol}!`);
                setTimeout(() => setFeedback(''), 3000);
            }

            setCoinPositions(currentCoins);
            animationFrame = requestAnimationFrame(update);
        };

        animationFrame = requestAnimationFrame(update);

        return () => {
            cancelAnimationFrame(animationFrame);
            Matter.World.clear(world, false);
            Matter.Engine.clear(engine);
        };
    }, [addCoins, currencySymbol]);

    const handleDropCoin = () => {
        if (!canBet(BET_AMOUNT)) {
            setFeedback('Insufficient Funds!');
            setTimeout(() => setFeedback(''), 2000);
            return;
        }
        
        subtractCoins(BET_AMOUNT, 'Pusher Drop');
        
        const dropX = SIDE_MARGIN + 25 + Math.random() * (SHELF_WIDTH - 2 * SIDE_MARGIN - 50);
        const dropY = pusherY - 15; 
        
        const newCoin = Matter.Bodies.circle(dropX, dropY, COIN_RADIUS, {
            restitution: 0.15,
            friction: 0.02,
            frictionAir: 0.03,
            density: 0.01,
            label: 'coin',
            plugin: { id: nextCoinId.current++, isNew: true }
        });

        Matter.World.add(engineRef.current.world, newCoin);
        coinsMapRef.current.set(newCoin.plugin.id, newCoin);
    };

    return (
        <div className="cp-game-wrapper">
            <div className={`cp-main-content ${isShaking ? 'animate-shake' : ''}`}>
                <div className="cp-header">
                    <div className="font-bold text-yellow-400 text-xl tracking-widest">ARCADE PUSHER</div>
                    <div className="bg-black/40 px-6 py-1 rounded-full border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                        {feedback || 'ACTIVE'}
                    </div>
                </div>

                <div className="coin-pusher-scene scale-90 sm:scale-100">
                    <div className="coin-pusher-world shadow-2xl overflow-hidden rounded-t-lg">
                        <div className="pusher-bed"></div>
                        <div className="absolute left-0 top-0 w-2 h-full bg-gradient-to-r from-gray-800 to-gray-600 z-50"></div>
                        <div className="absolute right-0 top-0 w-2 h-full bg-gradient-to-l from-gray-800 to-gray-600 z-50"></div>

                        <div 
                            className="pusher-wall flex items-center justify-center"
                            style={{ 
                                transform: `translateY(${pusherY - 40}px)`,
                                height: '80px',
                                background: 'linear-gradient(to bottom, #4a5568, #2d3748)',
                                borderBottom: '4px solid #1a202c'
                            }}
                        >
                            <div className="w-full h-1 bg-yellow-500/20 animate-pulse"></div>
                        </div>

                        {coinPositions.map(coin => (
                            <div
                                key={coin.id}
                                className={`cp-coin ${coin.isNew ? 'animate-pop-in' : ''}`}
                                style={{
                                    left: `${coin.x}%`,
                                    top: `${coin.y}px`, 
                                    zIndex: Math.floor(coin.y),
                                    transform: `translate(-50%, -50%) rotate(${coin.angle}deg)`,
                                    width: `${COIN_RADIUS * 2}px`,
                                    height: `${COIN_RADIUS * 2}px`
                                }}
                            >
                                <div className="inner-coin overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shine"></div>
                                </div>
                            </div>
                        ))}
                        
                        <div className="absolute w-full h-4 bg-gradient-to-b from-transparent to-green-500/20" style={{ top: `${WIN_ZONE_Y}px`}}></div>
                        <div className="absolute w-full h-1 bg-green-500/40 shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{ top: `${WIN_ZONE_Y}px`}}></div>
                    </div>
                </div>

                <div className="cp-controls-wrapper w-full max-w-md mt-6">
                    <GlassButton 
                        onClick={handleDropCoin} 
                        className="w-full py-6 text-3xl font-black bg-gradient-to-b from-yellow-400 to-orange-600 border-none shadow-[0_8px_0_rgb(154,52,18)] active:translate-y-1 active:shadow-none transition-all"
                    >
                        DROP COIN
                        <span className="block text-sm font-normal opacity-80 mt-1">COST: {BET_AMOUNT} {currencySymbol}</span>
                    </GlassButton>
                </div>
            </div>
            
            <style>{`
                .cp-game-wrapper {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100%;
                    padding: 20px;
                    background: #111;
                    user-select: none;
                }
                .cp-main-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 100%;
                    transition: transform 0.1s ease-out;
                }
                .coin-pusher-scene {
                    perspective: 1000px;
                    margin-top: 20px;
                }
                .coin-pusher-world {
                    width: ${SHELF_WIDTH}px;
                    height: ${SHELF_HEIGHT}px;
                    background: #222;
                    position: relative;
                    transform: rotateX(20deg);
                    border: 10px solid #333;
                    border-bottom: none;
                    box-shadow: 0 50px 100px rgba(0,0,0,0.5);
                }
                .pusher-bed {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    background-image: 
                        linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
                    background-size: 40px 40px;
                }
                .pusher-wall {
                    position: absolute;
                    width: 100%;
                    z-index: 10;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.4);
                }
                .cp-coin {
                    position: absolute;
                    border-radius: 50%;
                    background: radial-gradient(circle at 30% 30%, #fbbf24, #b45309);
                    border: 2px solid #78350f;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .inner-coin {
                    width: 70%;
                    height: 70%;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                @keyframes pop-in {
                    0% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
                .animate-pop-in {
                    animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes shine {
                    0% { transform: translateX(-100%) skewX(-20deg); }
                    20%, 100% { transform: translateX(200%) skewX(-20deg); }
                }
                .animate-shine {
                    animation: shine 3s infinite linear;
                }
                @keyframes shake {
                    0% { transform: translate(0, 0); }
                    25% { transform: translate(2px, 2px); }
                    50% { transform: translate(-2px, -2px); }
                    75% { transform: translate(2px, -2px); }
                    100% { transform: translate(0, 0); }
                }
                .animate-shake {
                    animation: shake 0.1s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default CoinPusherGame;
