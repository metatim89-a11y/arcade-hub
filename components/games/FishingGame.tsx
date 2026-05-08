
import React, { useRef, useEffect, useState } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

// --- Game Types ---
type PathType = 'linear' | 'sine' | 'wave' | 'zigzag';

interface PathParams {
  amp: number;
  freq: number;
  phase: number;
  speed: number;
}

interface Fish {
  id: number;
  x: number;
  y: number;
  initialX: number;
  initialY: number;
  type: string;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  value: number; // Multiplier
  scale: number;
  emoji: string;
  hitFlash: number;
  rotation: number;
  tick: number; 
  path: PathType;
  params: PathParams;
  axis: 'horizontal' | 'vertical' | 'diagonal'; 
  collisionCooldown: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  cost: number;
  trail: {x: number, y: number}[];
  targetId?: number; // For locking
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  type: 'spark' | 'bubble' | 'text' | 'ring';
  text?: string;
}

// --- Constants ---
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 800;
const BULLET_SPEED = 18;
const CANNON_LENGTH = 90;
const PIVOT_X = CANVAS_WIDTH / 2;
const PIVOT_Y = CANVAS_HEIGHT - 40;
const AUTO_FIRE_RATE = 8; 

const FISH_DEFINITIONS: Record<string, { emoji: string, hp: number, value: number, speed: number, scale: number, color: string }> = {
  // Trash / Tiny
  jelly:   { emoji: '🪼', hp: 2, value: 0.5, speed: 1.5, scale: 22, color: '#cc88ff' },
  shrimp:  { emoji: '🦐', hp: 2, value: 0.8, speed: 3.5, scale: 18, color: '#ff8888' },
  crab:    { emoji: '🦀', hp: 5, value: 1.5, speed: 1.0, scale: 28, color: '#ff4444' },
  
  // Small
  guppy:   { emoji: '🐠', hp: 4, value: 2.0, speed: 2.5, scale: 38, color: '#44ccff' },
  sardine: { emoji: '🐟', hp: 6, value: 3.0, speed: 2.8, scale: 42, color: '#6688aa' },
  
  // Medium
  clown:   { emoji: '🐡', hp: 12, value: 5.0, speed: 2.0, scale: 55, color: '#ffaa00' },
  squid:   { emoji: '🦑', hp: 20, value: 8.0, speed: 3.0, scale: 65, color: '#ffccdd' },
  
  // Large / Boss
  turtle:  { emoji: '🐢', hp: 40, value: 15.0, speed: 1.2, scale: 85, color: '#88ff88' },
  shark:   { emoji: '🦈', hp: 100, value: 30.0, speed: 2.2, scale: 140, color: '#999999' },
  whale:   { emoji: '🐋', hp: 250, value: 60.0, speed: 0.8, scale: 200, color: '#5555aa' },
  dragon:  { emoji: '🐉', hp: 500, value: 150.0, speed: 1.8, scale: 220, color: '#44ff44' },
  gold:    { emoji: '🌟', hp: 120, value: 100.0, speed: 4.0, scale: 70, color: '#ffd700' },
};

const BOSS_TYPES = ['shark', 'whale', 'dragon', 'turtle', 'gold', 'squid'];

const FishingGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
  
  // Controls
  const [betAmount, setBetAmount] = useState(10);
  const [isAuto, setIsAuto] = useState(false);
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [lockedTargetId, setLockedTargetId] = useState<number | null>(null);
  
  // Use Ref for angle to avoid re-rendering the component loop on every mouse move
  const cannonAngleRef = useRef(-Math.PI / 2);
  
  // Game State
  const gameState = useRef({
    fishes: [] as Fish[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    spawnTimer: 0,
    fireTimer: 0,
    frenzyTimer: 0,
  });

  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getMousePos(e);
      
      // Check if clicking a fish to lock
      if (isLockEnabled) {
          let clickedFish = null;
          // Check click collision with fish
          for (let i = gameState.current.fishes.length - 1; i >= 0; i--) {
              const fish = gameState.current.fishes[i];
              const dx = x - fish.x;
              const dy = y - fish.y;
              if (dx*dx + dy*dy < (fish.scale) ** 2) {
                  clickedFish = fish;
                  break;
              }
          }

          if (clickedFish) {
              setLockedTargetId(clickedFish.id);
              return; // Don't fire if just locking
          } else {
              setLockedTargetId(null); // Unlock if clicking empty space
          }
      }
      
      // Manual Fire if not locking
      if (!isAuto) {
         fireBullet(lockedTargetId || undefined);
      }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!lockedTargetId) {
        const { x, y } = getMousePos(e);
        // Standard angle: 0 is Right, -PI/2 is Up
        cannonAngleRef.current = Math.atan2(y - PIVOT_Y, x - PIVOT_X);
      }
  };

  const fireBullet = (targetId?: number) => {
      if (!canBet(betAmount)) return;
      
      const isFrenzy = gameState.current.frenzyTimer > 0;
      const shotCount = isFrenzy ? 3 : 1;
      const spread = 0.15;
      
      let baseAngle = cannonAngleRef.current;
      if (targetId) {
          const target = gameState.current.fishes.find(f => f.id === targetId);
          if (target) {
              baseAngle = Math.atan2(target.y - PIVOT_Y, target.x - PIVOT_X);
          }
      }
      
      if (subtractCoins(betAmount, 'Ocean Hunter Shot')) {
          for (let i = 0; i < shotCount; i++) {
              const angleOffset = (i - (shotCount - 1) / 2) * spread;
              const angle = baseAngle + angleOffset;
              
              // Correct spawn point at end of barrel
              const spawnX = PIVOT_X + Math.cos(angle) * CANNON_LENGTH;
              const spawnY = PIVOT_Y + Math.sin(angle) * CANNON_LENGTH;
              
              const bulletVx = Math.cos(angle) * BULLET_SPEED;
              const bulletVy = Math.sin(angle) * BULLET_SPEED;

              gameState.current.bullets.push({
                  id: Date.now() + Math.random() * 1000,
                  x: spawnX,
                  y: spawnY,
                  vx: bulletVx,
                  vy: bulletVy,
                  damage: 1,
                  cost: betAmount,
                  trail: [],
                  targetId: targetId
              });
          }
      }
  };

  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const spawnGroup = () => {
        const rand = Math.random();
        let keys: string[] = [];
        
        // Weighted Spawn Table
        if (rand > 0.96) keys = ['gold', 'dragon', 'whale'];
        else if (rand > 0.85) keys = ['shark', 'turtle', 'squid'];
        else if (rand > 0.55) keys = ['clown', 'sardine', 'guppy'];
        else keys = ['jelly', 'shrimp', 'crab']; 

        const typeKey = keys[Math.floor(Math.random() * keys.length)];
        const def = FISH_DEFINITIONS[typeKey];
        
        // Determine grouping
        const isGroup = Math.random() > 0.4 && ['guppy', 'sardine', 'jelly', 'shrimp', 'clown'].includes(typeKey);
        const count = isGroup ? Math.floor(Math.random() * 5) + 3 : 1;
        const groupSpacing = 60 + Math.random() * 40;

        // Spawn Edge Logic (More uniform distribution for top/bottom)
        const edgeRoll = Math.random();
        let edge: 'left' | 'right' | 'top' | 'bottom' | 'corner';
        
        if (edgeRoll < 0.25) edge = 'left';
        else if (edgeRoll < 0.50) edge = 'right';
        else if (edgeRoll < 0.70) edge = 'top';
        else if (edgeRoll < 0.90) edge = 'bottom';
        else edge = 'corner';

        let startX = 0, startY = 0, vx = 0, vy = 0;
        let axis: 'horizontal' | 'vertical' | 'diagonal' = 'horizontal';

        // Path Params - Highly Randomized Speed Multiplier
        const speed = def.speed * (0.5 + Math.random() * 1.5); 
        
        if (edge === 'left') {
            startX = -100;
            startY = 50 + Math.random() * (CANVAS_HEIGHT - 150);
            vx = speed;
            axis = 'horizontal';
        } else if (edge === 'right') {
            startX = CANVAS_WIDTH + 100;
            startY = 50 + Math.random() * (CANVAS_HEIGHT - 150);
            vx = -speed;
            axis = 'horizontal';
        } else if (edge === 'top') {
            startX = 100 + Math.random() * (CANVAS_WIDTH - 200);
            startY = -100;
            vy = speed;
            axis = 'vertical';
        } else if (edge === 'bottom') {
            startX = 100 + Math.random() * (CANVAS_WIDTH - 200);
            startY = CANVAS_HEIGHT + 100;
            vy = -speed;
            axis = 'vertical';
        } else {
            // Corner / Diagonal
            axis = 'diagonal';
            const corner = Math.floor(Math.random() * 4); // 0:TL, 1:TR, 2:BL, 3:BR
            const margin = 100;
            if (corner === 0) { startX = -margin; startY = -margin; vx = speed; vy = speed * 0.6; }
            else if (corner === 1) { startX = CANVAS_WIDTH + margin; startY = -margin; vx = -speed; vy = speed * 0.6; }
            else if (corner === 2) { startX = -margin; startY = CANVAS_HEIGHT + margin; vx = speed; vy = -speed * 0.6; }
            else { startX = CANVAS_WIDTH + margin; startY = CANVAS_HEIGHT + margin; vx = -speed; vy = -speed * 0.6; }
        }

        const pathType: PathType = axis === 'diagonal' ? 'linear' : ['linear', 'sine', 'wave', 'zigzag'][Math.floor(Math.random() * 4)] as PathType;
        
        const params: PathParams = {
            amp: axis === 'horizontal' ? 30 + Math.random() * 100 : 30 + Math.random() * 100,
            freq: 0.002 + Math.random() * 0.01,
            phase: Math.random() * Math.PI * 2,
            speed: 0 // unused in new logic directly
        };

        for(let i = 0; i < count; i++) {
            // Group offsets
            let offsetX = startX;
            let offsetY = startY;
            
            if (axis === 'horizontal') offsetX -= (i * groupSpacing * Math.sign(vx));
            else if (axis === 'vertical') offsetY -= (i * groupSpacing * Math.sign(vy));
            else {
                offsetX -= (i * groupSpacing * Math.sign(vx));
                offsetY -= (i * groupSpacing * Math.sign(vy));
            }
            
            // Randomize scale significantly (0.6x to 1.6x)
            const individualScale = def.scale * (0.6 + Math.random() * 1.0);

            gameState.current.fishes.push({
                id: Date.now() + Math.random() * 10000,
                x: offsetX,
                y: offsetY,
                initialX: offsetX,
                initialY: offsetY,
                type: typeKey,
                vx, vy,
                hp: def.hp,
                maxHp: def.hp,
                value: def.value,
                scale: individualScale,
                emoji: def.emoji,
                hitFlash: 0,
                rotation: 0,
                tick: Math.random() * 100,
                path: pathType,
                params: params,
                axis,
                collisionCooldown: 0
            });
        }
    };

    const createParticles = (x: number, y: number, count: number, color: string) => {
        for (let i = 0; i < count; i++) {
            gameState.current.particles.push({
                id: Math.random(),
                x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1.0,
                color,
                size: Math.random() * 4 + 2,
                type: 'spark'
            });
        }
    };

    const update = () => {
        // 1. Spawn
        gameState.current.spawnTimer++;
        const isFrenzy = gameState.current.frenzyTimer > 0;
        if (isFrenzy) gameState.current.frenzyTimer--;
        
        const spawnRate = isFrenzy ? 20 : 45;
        if (gameState.current.spawnTimer > spawnRate) {
            spawnGroup();
            gameState.current.spawnTimer = 0;
        }

        // 2. Lock Maintenance (Update cannon to track target)
        if (lockedTargetId) {
            const target = gameState.current.fishes.find(f => f.id === lockedTargetId);
            if (!target) {
                setLockedTargetId(null);
            } else {
                cannonAngleRef.current = Math.atan2(target.y - PIVOT_Y, target.x - PIVOT_X);
            }
        }

        // 3. Auto Fire
        if (isAuto) {
            gameState.current.fireTimer++;
            if (gameState.current.fireTimer > AUTO_FIRE_RATE) {
                fireBullet(lockedTargetId || undefined);
                gameState.current.fireTimer = 0;
            }
        }

        // 4. Update Fishes
        for (let i = 0; i < gameState.current.fishes.length; i++) {
            const fish = gameState.current.fishes[i];
            fish.tick++;

            // Base Movement
            fish.initialX += fish.vx;
            fish.initialY += fish.vy;
            fish.x = fish.initialX;
            fish.y = fish.initialY;
            
            // Wave Modifiers
            if (fish.path !== 'linear') {
                const p = fish.params;
                if (fish.axis === 'horizontal') {
                    let offset = 0;
                    if (fish.path === 'sine') offset = Math.sin(fish.x * p.freq + p.phase) * p.amp;
                    else if (fish.path === 'wave') offset = Math.sin(fish.x * p.freq) * p.amp + Math.cos(fish.x * p.freq * 2.5) * (p.amp/2);
                    else if (fish.path === 'zigzag') offset = (Math.abs(((fish.x * 0.5) % 200) - 100) - 50) * (p.amp/50);
                    
                    fish.y += offset;
                    fish.rotation = (Math.cos(fish.x * p.freq) * 0.5) * (fish.vx > 0 ? -1 : 1);
                    
                } else if (fish.axis === 'vertical') {
                    let offset = 0;
                    if (fish.path === 'sine') offset = Math.sin(fish.y * p.freq + p.phase) * p.amp;
                    else if (fish.path === 'wave') offset = Math.sin(fish.y * p.freq) * p.amp * 0.5;
                    else if (fish.path === 'zigzag') offset = (Math.abs(((fish.y * 0.5) % 200) - 100) - 50) * (p.amp/50);
                    
                    fish.x += offset;
                    fish.rotation = (Math.cos(fish.y * p.freq) * 0.5);
                }
            }

            // Orientation
            let baseRotation = 0;
            if (fish.axis === 'horizontal') {
                baseRotation = 0; 
            } else if (fish.axis === 'vertical') {
                baseRotation = fish.vy > 0 ? Math.PI/2 : -Math.PI/2;
            } else {
                baseRotation = Math.atan2(fish.vy, fish.vx);
            }
            
            // Add swimming wobble and breath animation
            const swimWobble = Math.sin(fish.tick * 0.15) * 0.1;
            
            if (fish.axis !== 'horizontal') {
                fish.rotation += baseRotation + swimWobble;
            } else {
                fish.rotation += swimWobble; 
            }

            // Cooldown decrement
            if (fish.collisionCooldown > 0) fish.collisionCooldown--;
            if (fish.hitFlash > 0) fish.hitFlash--;
        }
        
        // 4.5 Fish Collision (Swap Paths)
        for (let i = 0; i < gameState.current.fishes.length; i++) {
            for (let j = i + 1; j < gameState.current.fishes.length; j++) {
                const f1 = gameState.current.fishes[i];
                const f2 = gameState.current.fishes[j];
                
                if (BOSS_TYPES.includes(f1.type) || BOSS_TYPES.includes(f2.type)) continue;
                if (f1.collisionCooldown > 0 || f2.collisionCooldown > 0) continue;

                const dx = f1.x - f2.x;
                const dy = f1.y - f2.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const minDist = (f1.scale * 0.5) + (f2.scale * 0.5); // Tighter bounds

                if (dist < minDist) {
                     // Swap movement properties
                     const tempVx = f1.vx; f1.vx = f2.vx; f2.vx = tempVx;
                     const tempVy = f1.vy; f1.vy = f2.vy; f2.vy = tempVy;
                     
                     const tempPath = f1.path; f1.path = f2.path; f2.path = tempPath;
                     const tempParams = {...f1.params}; f1.params = {...f2.params}; f2.params = tempParams;
                     
                     // Reset path basis
                     f1.initialX = f1.x; f1.initialY = f1.y;
                     f2.initialX = f2.x; f2.initialY = f2.y;

                     // Cooldown
                     f1.collisionCooldown = 20;
                     f2.collisionCooldown = 20;
                     
                     // Visual effect
                     gameState.current.particles.push({
                        id: Math.random(), x: (f1.x+f2.x)/2, y: (f1.y+f2.y)/2, 
                        vx: 0, vy: -1, life: 0.5, color: 'rgba(255,255,255,0.5)', size: 10, type: 'bubble'
                     });
                }
            }
        }
        
        // Cleanup offscreen
        gameState.current.fishes = gameState.current.fishes.filter(f => 
            f.x > -400 && f.x < CANVAS_WIDTH + 400 && f.y > -400 && f.y < CANVAS_HEIGHT + 400
        );

        // 5. Bullets & Collision
        gameState.current.bullets.forEach(b => {
            if (b.targetId) {
                const t = gameState.current.fishes.find(f => f.id === b.targetId);
                if (t) {
                    const dx = t.x - b.x;
                    const dy = t.y - b.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) {
                        const steerFactor = 0.15; // Homing strength
                        b.vx += (dx/dist * BULLET_SPEED - b.vx) * steerFactor;
                        b.vy += (dy/dist * BULLET_SPEED - b.vy) * steerFactor;
                        
                        // Normalize speed
                        const currentSpeed = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
                        b.vx = (b.vx / currentSpeed) * BULLET_SPEED;
                        b.vy = (b.vy / currentSpeed) * BULLET_SPEED;
                    }
                }
            }
            b.x += b.vx;
            b.y += b.vy;
            b.trail.push({x: b.x, y: b.y});
            if (b.trail.length > 6) b.trail.shift();
        });

        gameState.current.bullets = gameState.current.bullets.filter(b => {
            if (b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) return false;
            let hit = false;
            
            // Collision Check
            for (const fish of gameState.current.fishes) {
                if (b.targetId && b.targetId !== fish.id) continue;
                
                const dx = b.x - fish.x;
                const dy = b.y - fish.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const hitRadius = fish.scale * 0.6; 

                if (dist < hitRadius) {
                    hit = true;
                    fish.hitFlash = 4;
                    createParticles(b.x, b.y, 4, '#fff');
                    fish.hp -= 1;
                    
                    // Catch Logic
                    const baseChance = 0.5; 
                    const chance = (baseChance / fish.value) * 1.2; 
                    const roll = Math.random();
                    
                    if (fish.hp <= 0 || roll < chance * 0.2) {
                        let win = fish.value * b.cost;
                        if (fish.value < 1.0) win = 0; // Trash fish

                        if (win > 0) addCoins(win, 'Fish Catch');
                        
                        createParticles(fish.x, fish.y, 15, FISH_DEFINITIONS[fish.type].color);
                        
                        gameState.current.particles.push({
                            id: Math.random(),
                            x: fish.x, y: fish.y, vx: 0, vy: -1.5, life: 2, color: '#fff', size: 24,
                            type: 'text', text: win > 0 ? `+${Math.floor(win)}` : '💩'
                        });

                        if (['dragon', 'gold', 'whale'].includes(fish.type)) {
                             gameState.current.frenzyTimer += 200;
                             gameState.current.particles.push({
                                id: Math.random(), x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/3, vx:0, vy:0, life: 3, color:'#ffcc00', size: 60, type:'text', text: 'JACKPOT!'
                             });
                        }

                        gameState.current.fishes = gameState.current.fishes.filter(f => f.id !== fish.id);
                        if (lockedTargetId === fish.id) setLockedTargetId(null);
                    }
                    break;
                }
            }
            return !hit;
        });

        // 6. Particles
        gameState.current.particles.forEach(p => {
            if (p.type === 'text') {
                p.y += p.vy;
                p.life -= 0.02;
            } else {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.04;
            }
        });
        gameState.current.particles = gameState.current.particles.filter(p => p.life > 0);

        draw(ctx);
        animationId = requestAnimationFrame(update);
    };

    const drawReefBackground = (ctx: CanvasRenderingContext2D) => {
         // Deep Sea Gradient
         const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
         grad.addColorStop(0, '#0077be'); 
         grad.addColorStop(0.4, '#004466'); 
         grad.addColorStop(1, '#001a33'); 
         ctx.fillStyle = grad;
         ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

         // Caustics / Sun Shafts
         ctx.save();
         ctx.globalAlpha = 0.1;
         ctx.fillStyle = '#fff';
         for(let i=0; i<5; i++) {
             ctx.beginPath();
             ctx.moveTo(i*300, 0);
             ctx.lineTo(i*300 + 100, 0);
             ctx.lineTo(i*300 + 50 + Math.sin(Date.now()/1000 + i)*50, CANVAS_HEIGHT);
             ctx.lineTo(i*300 - 50 + Math.sin(Date.now()/1000 + i)*50, CANVAS_HEIGHT);
             ctx.fill();
         }
         ctx.restore();

         // Seabed
         ctx.beginPath();
         ctx.moveTo(0, CANVAS_HEIGHT);
         ctx.lineTo(0, CANVAS_HEIGHT - 120);
         ctx.bezierCurveTo(300, CANVAS_HEIGHT - 180, 600, CANVAS_HEIGHT - 50, 900, CANVAS_HEIGHT - 140);
         ctx.bezierCurveTo(1100, CANVAS_HEIGHT - 190, 1200, CANVAS_HEIGHT - 90, CANVAS_WIDTH, CANVAS_HEIGHT - 120);
         ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
         ctx.fillStyle = '#3d342b'; 
         ctx.fill();

         // Coral & Plants
         const drawCoral = (x: number, y: number, color: string, size: number) => {
             ctx.fillStyle = color;
             ctx.beginPath();
             ctx.arc(x, y, size, Math.PI, 0);
             for(let i=0; i<5; i++) {
                 ctx.arc(x - size + (i*size*0.4), y - size*0.5, size*0.3, 0, Math.PI*2);
             }
             ctx.fill();
         };

         drawCoral(100, CANVAS_HEIGHT-100, '#ff6b6b', 40);
         drawCoral(250, CANVAS_HEIGHT-150, '#6bffb8', 30);
         drawCoral(850, CANVAS_HEIGHT-120, '#ffcc5c', 50);
         drawCoral(1150, CANVAS_HEIGHT-100, '#c56bff', 45);
    }

    const draw = (ctx: CanvasRenderingContext2D) => {
        drawReefBackground(ctx);

        // Draw Fish
        gameState.current.fishes.forEach(f => {
            ctx.save();
            ctx.translate(f.x, f.y);
            
            // Flip horizontally if moving left
            if (f.axis === 'horizontal') {
                if (f.vx > 0) ctx.scale(-1, 1); 
            } 
            
            ctx.rotate(f.rotation);
            
            // Breathing Scale Effect
            const breath = 1 + Math.sin(f.tick * 0.1) * 0.05;
            ctx.scale(breath, breath);

            // Hit Flash
            if (f.hitFlash > 0) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.filter = 'brightness(200%)'; 
            }

            const size = f.scale;
            ctx.font = `${size}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Shadow for depth
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetY = 15;

            ctx.fillText(f.emoji, 0, 0);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.filter = 'none';

            // Lock Reticle
            if (lockedTargetId === f.id) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, size/1.3, 0, Math.PI*2);
                ctx.stroke();
                
                ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(0, size); ctx.stroke();
            }

            ctx.restore();
        });

        // Bullets
        gameState.current.bullets.forEach(b => {
            // Trail
            if (b.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(b.trail[0].x, b.trail[0].y);
                for(let i=1; i<b.trail.length; i++) ctx.lineTo(b.trail[i].x, b.trail[i].y);
                ctx.strokeStyle = `rgba(100, 255, 255, 0.4)`;
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            
            // Bullet Head
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 8, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowColor = '#0ff';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // Cannon
        ctx.save();
        ctx.translate(PIVOT_X, PIVOT_Y);
        ctx.rotate(cannonAngleRef.current);
        
        // Base Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        
        // Barrel
        const gradCannon = ctx.createLinearGradient(0, -20, 0, 20);
        gradCannon.addColorStop(0, '#b8860b');
        gradCannon.addColorStop(0.3, '#ffd700');
        gradCannon.addColorStop(0.7, '#ffd700');
        gradCannon.addColorStop(1, '#b8860b');
        ctx.fillStyle = gradCannon;
        
        // Draw barrel rectangle (0 to Length along X axis)
        ctx.beginPath();
        ctx.roundRect(0, -18, CANNON_LENGTH, 36, 5);
        ctx.fill();
        
        // Muzzle Ring
        ctx.fillStyle = '#8a6d3b';
        ctx.fillRect(CANNON_LENGTH - 8, -20, 8, 40);
        
        // Base Sphere
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(0, 0, 45, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#666';
        ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill();

        ctx.restore();

        // Particles
        gameState.current.particles.forEach(p => {
            ctx.save();
            if (p.type === 'text') {
                ctx.font = `bold ${p.size}px Arial`;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.textAlign = 'center';
                ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
                ctx.fillText(p.text || '', p.x, p.y);
            } else {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                ctx.fill();
            }
            ctx.restore();
        });
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [betAmount, isAuto, isLockEnabled, lockedTargetId]); // cannonAngle removed from dependencies

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <h2 className="text-3xl font-bold text-yellow-400" style={{textShadow: '0 0 10px #000'}}>Ocean Hunter</h2>
      
      <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border-4 border-[#005599] bg-black">
          <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            className="w-full h-auto cursor-crosshair block"
          />
          {/* Locked Target Indicator Overlay */}
          {lockedTargetId && (
              <div className="absolute top-4 right-4 bg-red-600/80 text-white px-4 py-2 rounded-full font-bold animate-pulse border border-white/50">
                  LOCKED
              </div>
          )}
      </div>

      {/* Control Panel - Integrated Betting Box */}
      <div className="w-full bg-gray-900/90 p-4 md:p-6 rounded-2xl border border-gray-700 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Left: Bet Controls */}
          <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-gray-700">
              <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Bullet Cost</div>
              <div className="flex items-center gap-2">
                  <button onClick={() => setBetAmount(Math.max(10, betAmount - 10))} className="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white transition-colors">-</button>
                  <span className="w-20 text-center font-mono text-2xl text-yellow-400 font-bold">{betAmount}</span>
                  <button onClick={() => setBetAmount(betAmount + 10)} className="w-10 h-10 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white transition-colors">+</button>
              </div>
          </div>

          {/* Center: Game Toggles */}
          <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsAuto(!isAuto)}
                className={`flex flex-col items-center justify-center w-24 h-20 rounded-xl border-2 transition-all ${isAuto ? 'bg-yellow-500 border-yellow-300 text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
              >
                  <span className="text-2xl mb-1">🔄</span>
                  <span className="text-xs font-bold uppercase">Auto Shoot</span>
                  <span className="text-[10px] font-mono">{isAuto ? 'ON' : 'OFF'}</span>
              </button>

              <button 
                onClick={() => {
                    setIsLockEnabled(!isLockEnabled);
                    if (isLockEnabled) setLockedTargetId(null);
                }}
                className={`flex flex-col items-center justify-center w-24 h-20 rounded-xl border-2 transition-all ${isLockEnabled ? 'bg-red-500 border-red-300 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
              >
                  <span className="text-2xl mb-1">🎯</span>
                  <span className="text-xs font-bold uppercase">Lock Target</span>
                  <span className="text-[10px] font-mono">{isLockEnabled ? 'ON' : 'OFF'}</span>
              </button>
          </div>

          {/* Right: Status / Balance */}
          <div className="text-right">
              <div className="text-gray-400 text-xs uppercase">Current Balance</div>
              <div className="text-2xl font-bold text-green-400">
                  {currencyMode === 'fun' ? Math.floor(useCoinSystem().funCoins) : Math.floor(useCoinSystem().realCoins)} {currencySymbol}
              </div>
          </div>
      </div>
      
      {/* Payout Table */}
      <div className="w-full bg-blue-900/30 border border-blue-500/30 p-4 rounded-2xl backdrop-blur-sm">
          <h3 className="text-blue-200 text-sm font-bold uppercase mb-3 tracking-widest text-center">Fish Payout Table (Multiplier x Bet)</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Object.entries(FISH_DEFINITIONS).sort(([,a], [,b]) => a.value - b.value).map(([key, def]) => (
                  <div key={key} className="flex flex-col items-center bg-black/20 p-2 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="text-2xl mb-1 filter drop-shadow-md transform hover:scale-125 transition-transform">{def.emoji}</div>
                      <div className="text-xs text-gray-300 capitalize mb-0.5">{key}</div>
                      <div className={`text-sm font-bold font-mono ${def.value < 1 ? 'text-red-400' : def.value >= 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                          x{def.value}
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default FishingGame;
