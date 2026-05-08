
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

// --- Component Types ---
interface Coin {
  id: number;
  x: number; // % relative to width
  z: number; // px relative to depth
  isNew: boolean;
  angle: number; // visual rotation
}

// --- Constants ---
const SHELF_WIDTH = 320; // px
const SHELF_DEPTH = 400; // px
const COIN_DIAMETER = 26; // px
const PUSH_AMPLITUDE = 70; // Increased pusher range
const PUSHER_SPEED = 0.0015; 
const WIN_ZONE_Z = 380; 
const SIDE_MARGIN = 5; 
const BET_AMOUNT = 10; 

// --- Helper Functions ---
const createInitialCoins = (): Coin[] => {
    const coins: Coin[] = [];
    // Preload a full machine ~120 coins
    for (let i = 0; i < 120; i++) {
        coins.push({
            id: i,
            x: 10 + Math.random() * 80,
            z: 50 + Math.random() * 300,
            isNew: false,
            angle: Math.random() * 360
        });
    }
    return coins;
};

const CoinPusherGame: React.FC = () => {
    const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
    const [coins, setCoins] = useState<Coin[]>(createInitialCoins);
    const [feedback, setFeedback] = useState('Insert Coin to Start!');
    const pusherPosRef = useRef(0); 
    const lastTimeRef = useRef(0);
    const animationRef = useRef<number | null>(null);
    
    const nextCoinId = useRef(coins.length + 500);
    const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

    // --- Physics Loop ---
    const updatePhysics = useCallback((timestamp: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        // const dt = timestamp - lastTimeRef.current; // Unused currently but good for variable step
        lastTimeRef.current = timestamp;

        // Move Pusher
        pusherPosRef.current = (timestamp * PUSHER_SPEED) % (2 * Math.PI);
        const pusherExtension = (Math.sin(pusherPosRef.current) + 1) / 2; 
        const pusherZ = 40 + pusherExtension * PUSH_AMPLITUDE; 

        setCoins(currentCoins => {
            // Deep clone for mutation in physics step
            const nextCoins = currentCoins.map(c => ({ ...c }));
            
            // Spatial Partitioning for Performance (Simple Grid)
            const gridSize = 40;
            const grid: { [key: string]: Coin[] } = {};
            
            nextCoins.forEach(c => {
                const key = `${Math.floor(c.x / 20)}-${Math.floor(c.z / gridSize)}`;
                if (!grid[key]) grid[key] = [];
                grid[key].push(c);
            });

            // 1. Pusher Interaction
            nextCoins.forEach(coin => {
                // Check if coin is in pusher zone
                if (coin.z < pusherZ + COIN_DIAMETER/2 && coin.z > 0) {
                    coin.z = pusherZ + COIN_DIAMETER/2;
                    // Jitter
                    coin.x += (Math.random() - 0.5) * 0.8;
                }
            });

            // 2. Collision Resolution
            // Only check neighbors in grid
            const checkCollision = (c1: Coin, c2: Coin) => {
                const x1Px = (c1.x / 100) * SHELF_WIDTH;
                const x2Px = (c2.x / 100) * SHELF_WIDTH;
                const dx = x1Px - x2Px;
                const dz = c1.z - c2.z;
                const distSq = dx*dx + dz*dz;
                const minDist = COIN_DIAMETER * 0.95; // Tighter packing

                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq);
                    const overlap = minDist - dist;
                    const angle = Math.atan2(dz, dx);
                    const force = overlap * 0.5;
                    
                    const moveX = Math.cos(angle) * force;
                    const moveZ = Math.sin(angle) * force;
                    
                    // Apply separation
                    c1.x += (moveX / SHELF_WIDTH) * 100;
                    c1.z += moveZ;
                    c2.x -= (moveX / SHELF_WIDTH) * 100;
                    c2.z -= moveZ;
                }
            };

            nextCoins.forEach(c => {
               const gx = Math.floor(c.x / 20);
               const gz = Math.floor(c.z / gridSize);
               
               // Check surrounding grid cells
               for (let i = -1; i <= 1; i++) {
                   for (let j = -1; j <= 1; j++) {
                       const key = `${gx+i}-${gz+j}`;
                       if (grid[key]) {
                           grid[key].forEach(neighbor => {
                               if (c.id !== neighbor.id) checkCollision(c, neighbor);
                           });
                       }
                   }
               }

               // Wall Constraints
               if (c.x < SIDE_MARGIN) c.x = SIDE_MARGIN;
               if (c.x > 100 - SIDE_MARGIN) c.x = 100 - SIDE_MARGIN;
            });

            // 3. Win Check
            const survivingCoins: Coin[] = [];
            let winnings = 0;
            
            nextCoins.forEach(c => {
                if (c.z > WIN_ZONE_Z) {
                    winnings++;
                } else {
                    survivingCoins.push(c);
                }
            });

            if (winnings > 0) {
                const prize = winnings * BET_AMOUNT * 1.8; 
                addCoins(prize, 'Pusher Win');
                setFeedback(`WON ${Math.floor(prize)} ${currencySymbol}!`);
                // Clear feedback after delay if no more wins
                setTimeout(() => setFeedback(prev => prev.includes('WON') ? '' : prev), 2000);
            }

            return survivingCoins;
        });

        animationRef.current = requestAnimationFrame(updatePhysics);
    }, [addCoins, currencySymbol]);

    useEffect(() => {
        animationRef.current = requestAnimationFrame(updatePhysics);
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [updatePhysics]);

    const handleDropCoin = () => {
        if (!canBet(BET_AMOUNT)) {
            setFeedback('Insufficient Funds!');
            return;
        }
        subtractCoins(BET_AMOUNT, 'Pusher Drop');
        
        const newId = nextCoinId.current++;
        const dropX = 20 + Math.random() * 60; 
        
        setCoins(prev => [...prev, {
            id: newId,
            x: dropX,
            z: 30, 
            isNew: true,
            angle: Math.random() * 360
        }]);
        // Visual flash or sound could go here
    };

    return (
        <div className="cp-game-wrapper">
            <div className="cp-main-content">
                <div className="cp-header">
                    <div className="font-bold text-yellow-400 text-xl">MEGA PUSHER</div>
                    <div className="bg-black/30 px-4 py-1 rounded-full border border-yellow-500/30">
                        {feedback || 'Ready'}
                    </div>
                </div>

                <div className="coin-pusher-scene">
                    <div className="coin-pusher-world">
                        <div className="pusher-bed"></div>
                        
                        {/* Moving Wall */}
                        <div 
                            className="pusher-wall"
                            style={{ 
                                // Sync visual with physics logic
                                transform: `translateZ(${40 + ((Math.sin(Date.now() * PUSHER_SPEED) + 1) / 2) * PUSH_AMPLITUDE}px)`
                            }}
                        ></div>

                        {/* Coins */}
                        {coins.map(coin => (
                            <div
                                key={coin.id}
                                className={`cp-coin ${coin.isNew ? 'animate-pop-in' : ''} animate-coin`}
                                style={{
                                    left: `${coin.x}%`,
                                    top: `${coin.z}px`, 
                                    zIndex: Math.floor(coin.z),
                                    transform: `rotate(${coin.angle}deg)`
                                }}
                            ></div>
                        ))}
                        
                        <div className="absolute bottom-0 w-full h-1 bg-red-500/50 animate-pulse" style={{ top: `${WIN_ZONE_Z}px`}}></div>
                    </div>
                </div>

                <div className="cp-controls-wrapper flex flex-col items-center gap-4">
                    <GlassButton onClick={handleDropCoin} className="w-full max-w-md py-4 text-2xl bg-gradient-to-r from-yellow-500 to-orange-600 border-none shadow-lg hover:shadow-orange-500/40">
                        DROP COIN ({BET_AMOUNT})
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};

export default CoinPusherGame;
