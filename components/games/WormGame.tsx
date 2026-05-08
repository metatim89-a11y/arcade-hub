
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';

interface WormGameProps {
  playMode: PlayMode;
  playerNames: { player1: string; player2: string };
}

interface Point {
  x: number;
  y: number;
}

interface Worm {
  id: number;
  name: string;
  color: string;
  body: Point[]; // Head is at index 0
  angle: number;
  targetAngle: number;
  speed: number;
  width: number;
  length: number;
  growing: number; // Amount of growth pending
  isBot: boolean;
  isBoosting: boolean;
  isDead: boolean;
  score: number;
  invulnerable: number; // Frames of invulnerability
  controls?: {
    left: string[];
    right: string[];
    boost: string[];
  };
}

interface Food {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  value: number;
  pulse: number; // For animation
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
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

const WORLD_SIZE = 3000;
const VIEWPORT_WIDTH = window.innerWidth < 800 ? window.innerWidth - 32 : 800;
const VIEWPORT_HEIGHT = 600;
const BASE_SPEED = 3.5;
const BOOST_SPEED = 7.0;
const TURN_SPEED = 0.12;
const BOT_COUNT = 15;
const INITIAL_LENGTH = 25;
const FOOD_COUNT = 300;

// Neon Colors
const COLORS = [
  '#ff0055', // Neon Red
  '#ff9900', // Neon Orange
  '#ffff00', // Neon Yellow
  '#00ff66', // Neon Green
  '#00ffff', // Neon Cyan
  '#0099ff', // Neon Blue
  '#cc00ff', // Neon Purple
  '#ff00cc', // Neon Pink
];

const WormGame: React.FC<WormGameProps> = ({ playMode, playerNames }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState<{name: string, score: number, color: string}[]>([]);
  
  // Use a ref to track game over status inside the requestAnimationFrame loop
  // without needing to add it to dependencies which causes re-renders/resets.
  const isGameOverRef = useRef(false);

  // Game State Refs
  const gameState = useRef({
    worms: [] as Worm[],
    foods: [] as Food[],
    particles: [] as Particle[],
    texts: [] as FloatingText[],
    camera: { x: 0, y: 0 },
    mouse: { x: 0, y: 0 },
    keys: {} as { [key: string]: boolean },
    lastTime: 0,
    frameCount: 0,
  });

  // --- Helpers ---

  const createWorm = (id: number, name: string, color: string, x: number, y: number, isBot: boolean, controls?: Worm['controls']): Worm => {
    const body = [];
    // Initialize body extending backwards to prevent instant self-collision on spawn
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      body.push({ x: x - i * 5, y });
    }
    return {
      id,
      name,
      color,
      body,
      angle: Math.random() * Math.PI * 2,
      targetAngle: 0,
      speed: BASE_SPEED,
      width: 18,
      length: INITIAL_LENGTH,
      growing: 0,
      isBot,
      isBoosting: false,
      isDead: false,
      score: 0,
      invulnerable: 120, // 2 seconds of protection
      controls,
    };
  };

  const spawnFood = (count: number) => {
    for (let i = 0; i < count; i++) {
      const isBig = Math.random() < 0.05;
      gameState.current.foods.push({
        id: Math.random(),
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: isBig ? Math.random() * 5 + 8 : Math.random() * 3 + 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        value: isBig ? 5 : 1,
        pulse: Math.random() * Math.PI * 2
      });
    }
  };

  const createExplosion = (x: number, y: number, color: string, size: number) => {
    for (let i = 0; i < size; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      gameState.current.particles.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const createFloatingText = (x: number, y: number, text: string, color: string) => {
      gameState.current.texts.push({
          id: Math.random(),
          x, y, text, life: 1.0, color
      });
  };

  const resetGame = useCallback(() => {
    const worms: Worm[] = [];
    
    // Player 1 (Mouse)
    worms.push(createWorm(1, playerNames.player1, '#00ffff', WORLD_SIZE / 2, WORLD_SIZE / 2, false));

    // Player 2 (Keyboard) only if vsPlayer is active
    if (playMode === 'vsPlayer') {
      worms.push(createWorm(2, playerNames.player2, '#ff0055', WORLD_SIZE / 2 + 200, WORLD_SIZE / 2, false, {
        left: ['ArrowLeft', 'a'],
        right: ['ArrowRight', 'd'],
        boost: ['Space', 'Enter', 'Shift']
      }));
    }

    // Bots
    const botsNeeded = BOT_COUNT - (playMode === 'vsPlayer' ? 2 : 1);
    const botNames = ['Slippy', 'Coily', 'Noodle', 'Fang', 'Venom', 'Python', 'Viper', 'Glitch', 'Byte', 'Bug', 'Wiggle', 'Slither', 'Hydra', 'Kaa', 'Basilisk'];
    for (let i = 0; i < botsNeeded; i++) {
      // Ensure bots don't spawn exactly on top of player
      let bx, by;
      do {
         bx = Math.random() * WORLD_SIZE;
         by = Math.random() * WORLD_SIZE;
      } while (Math.abs(bx - WORLD_SIZE/2) < 300 && Math.abs(by - WORLD_SIZE/2) < 300);

      worms.push(createWorm(
        100 + i, 
        botNames[i % botNames.length], 
        COLORS[i % COLORS.length], 
        bx, by, 
        true
      ));
    }

    gameState.current.worms = worms;
    gameState.current.foods = [];
    spawnFood(FOOD_COUNT);
    gameState.current.particles = [];
    gameState.current.texts = [];
    
    // Reset flags
    setGameOver(false);
    isGameOverRef.current = false;
    setWinner(null);
  }, [playMode, playerNames]);

  // --- Input Handling ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { gameState.current.keys[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { gameState.current.keys[e.key] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    gameState.current.mouse.x = e.clientX - rect.left;
    gameState.current.mouse.y = e.clientY - rect.top;
  };

  const handleMouseDown = () => {
    const p1 = gameState.current.worms.find(w => w.id === 1);
    if (p1) p1.isBoosting = true;
  };
  
  const handleMouseUp = () => {
    const p1 = gameState.current.worms.find(w => w.id === 1);
    if (p1) p1.isBoosting = false;
  };


  // --- Game Loop ---

  useEffect(() => {
    resetGame();
    let animationFrameId: number;

    const update = (timestamp: number) => {
      if (isGameOverRef.current) {
          // Even if game over, we might want to keep rendering particles? 
          // For now, just stop updating logic but maybe render a static frame
          // draw(gameState.current); 
          // actually, let's just stop the loop to save resources
          return;
      }

      gameState.current.frameCount++;
      if (!gameState.current.lastTime) gameState.current.lastTime = timestamp;
      gameState.current.lastTime = timestamp;

      const state = gameState.current;
      
      // Update Worms
      state.worms.forEach(worm => {
        if (worm.isDead) return;
        if (worm.invulnerable > 0) worm.invulnerable--;

        const head = worm.body[0];

        // --- 1. Steering Logic ---
        if (!worm.isBot && worm.id === 1) {
           // Mouse Control
           const worldMouseX = state.mouse.x + state.camera.x;
           const worldMouseY = state.mouse.y + state.camera.y;
           
           worm.targetAngle = Math.atan2(worldMouseY - head.y, worldMouseX - head.x);
        } else if (!worm.isBot && worm.id === 2 && worm.controls) {
           // Keyboard Control
           if (worm.controls.left.some(k => state.keys[k])) worm.angle -= TURN_SPEED;
           if (worm.controls.right.some(k => state.keys[k])) worm.angle += TURN_SPEED;
           worm.isBoosting = worm.controls.boost.some(k => state.keys[k]);
           worm.targetAngle = worm.angle; 
        } else if (worm.isBot) {
           // --- BOT AI ---
           // A. Avoid Walls
           let avoidanceAngle = 0;
           let avoidWeight = 0;
           const margin = 100;
           if (head.x < margin) { avoidanceAngle = 0; avoidWeight = 3.0; }
           else if (head.x > WORLD_SIZE - margin) { avoidanceAngle = Math.PI; avoidWeight = 3.0; }
           else if (head.y < margin) { avoidanceAngle = Math.PI/2; avoidWeight = 3.0; }
           else if (head.y > WORLD_SIZE - margin) { avoidanceAngle = -Math.PI/2; avoidWeight = 3.0; }

           // B. Avoid Other Worms
           if (avoidWeight === 0) {
               const lookAheadDist = 180;
               const feelerX = head.x + Math.cos(worm.angle) * lookAheadDist;
               const feelerY = head.y + Math.sin(worm.angle) * lookAheadDist;
               let impendingCollision = false;
               
               for (const other of state.worms) {
                   if (other.isDead || other.id === worm.id) continue;
                   if (Math.abs(other.body[0].x - head.x) > 400 || Math.abs(other.body[0].y - head.y) > 400) continue;

                   for (let i = 0; i < other.body.length; i += 4) {
                       const seg = other.body[i];
                       const dx = feelerX - seg.x;
                       const dy = feelerY - seg.y;
                       if (dx*dx + dy*dy < 2500) {
                           impendingCollision = true;
                           break;
                       }
                   }
                   if (impendingCollision) break;
               }

               if (impendingCollision) {
                   avoidanceAngle = worm.angle + Math.PI / 1.5;
                   avoidWeight = 4.0;
                   worm.isBoosting = true;
               } else {
                   worm.isBoosting = false;
               }
           }

           // C. Seek Food
           if (avoidWeight === 0) {
               let nearestFood = null;
               let minDist = Infinity;
               state.foods.forEach(f => {
                   if (Math.abs(f.x - head.x) > 400 || Math.abs(f.y - head.y) > 400) return;
                   const d = (head.x - f.x)**2 + (head.y - f.y)**2;
                   if (d < minDist) {
                       minDist = d;
                       nearestFood = f;
                   }
               });
               
               if (nearestFood) {
                   // @ts-ignore
                   worm.targetAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
               } else {
                   if (Math.random() < 0.05) worm.targetAngle += (Math.random() - 0.5);
               }
           } else {
               worm.targetAngle = avoidanceAngle;
           }
        }

        // --- 2. Smooth Turning ---
        if (worm.id === 1 || worm.isBot) {
          let diff = worm.targetAngle - worm.angle;
          while (diff <= -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          const turnRate = worm.isBoosting ? TURN_SPEED * 0.6 : TURN_SPEED;
          worm.angle += Math.sign(diff) * Math.min(Math.abs(diff), turnRate);
        }

        // --- 3. Move ---
        if (worm.isBoosting && worm.body.length > 10) {
            worm.speed = BOOST_SPEED;
            if (state.frameCount % 3 === 0) {
                const tail = worm.body[worm.body.length - 1];
                state.particles.push({
                    id: Math.random(),
                    x: tail.x, y: tail.y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    life: 0.5, color: worm.color, size: Math.random() * 5 + 2
                });
            }
            // Cost mass to boost
            if (Math.random() < 0.15) {
                 worm.body.pop();
                 worm.length = Math.max(10, worm.length - 1);
                 state.foods.push({
                     id: Math.random(),
                     x: worm.body[worm.body.length-1].x,
                     y: worm.body[worm.body.length-1].y,
                     size: 4, color: worm.color, value: 1, pulse: 0
                 });
            }
        } else {
            worm.speed = BASE_SPEED;
            worm.isBoosting = false;
        }

        const nx = head.x + Math.cos(worm.angle) * worm.speed;
        const ny = head.y + Math.sin(worm.angle) * worm.speed;

        // Wall Death
        if (nx < 0 || nx > WORLD_SIZE || ny < 0 || ny > WORLD_SIZE) {
            worm.isDead = true;
            createExplosion(head.x, head.y, worm.color, 40);
            return;
        }

        // Update Body
        worm.body.unshift({ x: nx, y: ny });
        if (worm.growing > 0) {
            worm.length++;
            worm.growing--;
        } 
        while (worm.body.length > worm.length) worm.body.pop();
        
        // Eat Food
        for (let i = state.foods.length - 1; i >= 0; i--) {
            const f = state.foods[i];
            const dx = nx - f.x;
            const dy = ny - f.y;
            if (dx*dx + dy*dy < (worm.width + f.size + 5)**2) {
                worm.growing += f.value;
                worm.score += f.value * 10;
                state.foods.splice(i, 1);
                if (!worm.isBot && f.value > 1) createFloatingText(nx, ny - 20, `+${f.value * 10}`, '#fff');
            }
        }
      });

      // --- 6. Collision ---
      state.worms.forEach(w1 => {
          if (w1.isDead) return;
          const head = w1.body[0];
          
          state.worms.forEach(w2 => {
              if (w2.isDead) return;
              if (w1.invulnerable > 0 || w2.invulnerable > 0) return; // Spawn protection

              const startIndex = w1.id === w2.id ? 15 : 0;
              // Optimization: rough check
              if (Math.abs(w2.body[0].x - head.x) > 500 && Math.abs(w2.body[0].y - head.y) > 500) return;

              for (let i = startIndex; i < w2.body.length; i += 2) { 
                  const seg = w2.body[i];
                  const dx = head.x - seg.x;
                  const dy = head.y - seg.y;
                  const distSq = dx*dx + dy*dy;
                  const hitDist = (w1.width + w2.width) * 0.45; // slightly generous hitbox

                  if (distSq < hitDist * hitDist) {
                      w1.isDead = true;
                      createExplosion(head.x, head.y, w1.color, 50);
                      createFloatingText(head.x, head.y, "CRASH!", '#ff0000');

                      // Body to food
                      const foodDensity = 3; 
                      for (let j = 0; j < w1.body.length; j += foodDensity) {
                          state.foods.push({
                              id: Math.random(),
                              x: w1.body[j].x + (Math.random()-0.5)*15,
                              y: w1.body[j].y + (Math.random()-0.5)*15,
                              size: 6 + Math.random() * 4,
                              color: w1.color,
                              value: 5,
                              pulse: Math.random()
                          });
                      }
                      return;
                  }
              }
          });
      });

      // --- Respawn Bots ---
      const alivePlayers = state.worms.filter(w => !w.isBot && !w.isDead);
      const aliveBots = state.worms.filter(w => w.isBot && !w.isDead);
      
      if (aliveBots.length < BOT_COUNT) {
         if (Math.random() < 0.05) {
             // Safe Bot Spawn
             let bx, by;
             let attempts = 0;
             do {
                 bx = Math.random() * WORLD_SIZE;
                 by = Math.random() * WORLD_SIZE;
                 attempts++;
             } while (attempts < 10 && alivePlayers.some(p => Math.abs(p.body[0].x - bx) < 500 && Math.abs(p.body[0].y - by) < 500));

             state.worms.push(createWorm(
                Date.now() + Math.random(), 
                "Bot", 
                COLORS[Math.floor(Math.random()*COLORS.length)], 
                bx, by, true
             ));
          }
      }
      if (state.foods.length < FOOD_COUNT) spawnFood(5);

      // --- Game Over Check ---
      if (playMode === 'vsPlayer') {
          if (alivePlayers.length <= 1 && state.worms.filter(w => !w.isBot).length > 1) {
               // One human died
               isGameOverRef.current = true;
               setGameOver(true);
               setWinner(alivePlayers.length === 1 ? alivePlayers[0].name : "Draw");
          }
      } else {
          const p1 = state.worms.find(w => w.id === 1);
          if (p1 && p1.isDead) {
              isGameOverRef.current = true;
              setGameOver(true);
              setWinner("Game Over");
          }
      }

      // --- Camera ---
      let targetX = 0, targetY = 0;
      const p1 = state.worms.find(w => w.id === 1);
      if (p1 && !p1.isDead) {
          targetX = p1.body[0].x;
          targetY = p1.body[0].y;
      } else if (playMode === 'vsPlayer') {
         const p2 = state.worms.find(w => w.id === 2);
         if(p2 && !p2.isDead) {
            targetX = p2.body[0].x;
            targetY = p2.body[0].y;
         } else {
             targetX = state.camera.x + VIEWPORT_WIDTH/2;
             targetY = state.camera.y + VIEWPORT_HEIGHT/2;
         }
      } else {
          const randomBot = aliveBots[0];
          if (randomBot) {
              targetX = randomBot.body[0].x;
              targetY = randomBot.body[0].y;
          }
      }
      
      state.camera.x += (targetX - VIEWPORT_WIDTH/2 - state.camera.x) * 0.1;
      state.camera.y += (targetY - VIEWPORT_HEIGHT/2 - state.camera.y) * 0.1;
      state.camera.x = Math.max(-50, Math.min(state.camera.x, WORLD_SIZE + 50 - VIEWPORT_WIDTH));
      state.camera.y = Math.max(-50, Math.min(state.camera.y, WORLD_SIZE + 50 - VIEWPORT_HEIGHT));

      draw(state);
      
      const sortedScores = [...state.worms].sort((a, b) => b.score - a.score).slice(0, 5);
      setScores(sortedScores.map(w => ({ name: w.name, score: w.score, color: w.color })));

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [resetGame, playMode]);


  const draw = (state: typeof gameState.current) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#0a0a0a'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(-state.camera.x, -state.camera.y);

      // Grid
      ctx.strokeStyle = '#1f1f1f';
      ctx.lineWidth = 2;
      const gridSize = 100;
      const startX = Math.floor(state.camera.x / gridSize) * gridSize;
      const startY = Math.floor(state.camera.y / gridSize) * gridSize;
      
      ctx.beginPath();
      for (let x = startX; x < startX + VIEWPORT_WIDTH + gridSize; x += gridSize) {
          ctx.moveTo(x, state.camera.y); 
          ctx.lineTo(x, state.camera.y + VIEWPORT_HEIGHT + gridSize); 
      }
      for (let y = startY; y < startY + VIEWPORT_HEIGHT + gridSize; y += gridSize) {
          ctx.moveTo(state.camera.x, y); 
          ctx.lineTo(state.camera.x + VIEWPORT_WIDTH + gridSize, y); 
      }
      ctx.stroke();

      // Borders
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

      // Food
      state.foods.forEach(f => {
          f.pulse += 0.1;
          const scale = 1 + Math.sin(f.pulse) * 0.1;
          ctx.fillStyle = f.color;
          ctx.shadowColor = f.color; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.size * scale, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
      });

      // Particles
      state.particles.forEach(p => {
         p.x += p.vx; p.y += p.vy; p.life -= 0.03;
         if (p.life > 0) {
             ctx.globalAlpha = p.life;
             ctx.fillStyle = p.color;
             ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
             ctx.globalAlpha = 1.0;
         }
      });

      // Worms
      state.worms.forEach(w => {
          if (w.isDead) return;
          if (w.invulnerable > 0 && Math.floor(w.invulnerable / 4) % 2 === 0) return; // Flicker effect

          // Name
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(w.name, w.body[0].x, w.body[0].y - w.width - 10);

          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          // Glow
          ctx.lineWidth = w.width + 6;
          ctx.strokeStyle = w.color; 
          ctx.shadowColor = w.color; ctx.shadowBlur = 15;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          if (w.body.length > 1) {
              ctx.moveTo(w.body[0].x, w.body[0].y);
              for (let i = 1; i < w.body.length - 1; i++) {
                  const xc = (w.body[i].x + w.body[i+1].x) / 2;
                  const yc = (w.body[i].y + w.body[i+1].y) / 2;
                  ctx.quadraticCurveTo(w.body[i].x, w.body[i].y, xc, yc);
              }
              ctx.lineTo(w.body[w.body.length-1].x, w.body[w.body.length-1].y);
              ctx.stroke();
          }
          
          // Solid Body
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;
          ctx.lineWidth = w.width;
          ctx.strokeStyle = w.color;
          ctx.stroke();

          // Eyes
          const headAngle = w.angle;
          const eyeOffset = w.width / 2.2;
          const eyeX1 = w.body[0].x + Math.cos(headAngle - 0.6) * eyeOffset;
          const eyeY1 = w.body[0].y + Math.sin(headAngle - 0.6) * eyeOffset;
          const eyeX2 = w.body[0].x + Math.cos(headAngle + 0.6) * eyeOffset;
          const eyeY2 = w.body[0].y + Math.sin(headAngle + 0.6) * eyeOffset;
          
          ctx.fillStyle = 'white';
          ctx.beginPath(); ctx.arc(eyeX1, eyeY1, w.width/3.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(eyeX2, eyeY2, w.width/3.5, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'black';
          ctx.beginPath(); ctx.arc(eyeX1, eyeY1, w.width/7, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(eyeX2, eyeY2, w.width/7, 0, Math.PI*2); ctx.fill();
      });

      // Text
      state.texts.forEach(t => {
          t.y -= 1; t.life -= 0.02;
          if (t.life > 0) {
              ctx.globalAlpha = t.life;
              ctx.fillStyle = t.color;
              ctx.font = 'bold 16px Arial';
              ctx.fillText(t.text, t.x, t.y);
              ctx.globalAlpha = 1.0;
          }
      });
      
      ctx.restore();

      // Minimap
      const mapSize = 120;
      const mapMargin = 10;
      const mapX = canvas.width - mapSize - mapMargin;
      const mapY = canvas.height - mapSize - mapMargin;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.fillRect(mapX, mapY, mapSize, mapSize);
      ctx.strokeRect(mapX, mapY, mapSize, mapSize);

      state.worms.forEach(w => {
          if (w.isDead) return;
          const mx = mapX + (w.body[0].x / WORLD_SIZE) * mapSize;
          const my = mapY + (w.body[0].y / WORLD_SIZE) * mapSize;
          ctx.fillStyle = w.id === 1 ? '#fff' : w.color;
          ctx.beginPath(); ctx.arc(mx, my, w.id === 1 ? 3 : 2, 0, Math.PI*2); ctx.fill();
      });
      
      // Viewport Rect
      const vx = mapX + (state.camera.x / WORLD_SIZE) * mapSize;
      const vy = mapY + (state.camera.y / WORLD_SIZE) * mapSize;
      const vw = (VIEWPORT_WIDTH / WORLD_SIZE) * mapSize;
      const vh = (VIEWPORT_HEIGHT / WORLD_SIZE) * mapSize;
      ctx.strokeStyle = 'white'; ctx.lineWidth=1;
      ctx.strokeRect(vx, vy, vw, vh);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
      <canvas 
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        className="w-full h-full object-contain bg-gray-900 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      />
      
      <div className="absolute top-4 right-4 bg-black/60 p-3 rounded-lg backdrop-blur-md pointer-events-none min-w-[180px] border border-white/10 z-10">
         <h3 className="text-yellow-400 font-bold border-b border-white/20 pb-1 mb-2 text-sm uppercase tracking-wider">Leaderboard</h3>
         {scores.map((s, i) => (
             <div key={i} className="flex justify-between text-sm text-white mb-1">
                 <span style={{color: s.color}} className="font-bold drop-shadow-sm">{i+1}. {s.name}</span>
                 <span className="font-mono">{Math.floor(s.score)}</span>
             </div>
         ))}
      </div>

      {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-pop-in z-20">
              <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-6 drop-shadow-lg">GAME OVER</h2>
              <p className="text-3xl text-white mb-8 font-bold">{winner === "Game Over" ? "YOU DIED" : `${winner} WINS!`}</p>
              <button 
                onClick={resetGame}
                className="px-10 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-full text-xl transition-all hover:scale-105 shadow-[0_0_30px_rgba(234,179,8,0.5)]"
              >
                  PLAY AGAIN
              </button>
          </div>
      )}
    </div>
  );
};

export default WormGame;
