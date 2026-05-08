
import React, { useState, useRef } from 'react';
import GlassButton from '../ui/GlassButton';

// --- TYPES ---
type Color = 'W' | 'Y' | 'B' | 'G' | 'R' | 'O';
type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

// Standard Color Mapping
const COLOR_MAP: { [key in Color]: string } = {
  'W': '#ffffff', // Up
  'Y': '#ffd500', // Down
  'B': '#0046ad', // Back
  'G': '#009b48', // Front
  'R': '#b71234', // Right
  'O': '#ff5800', // Left
};

// Initial State: 6 faces, 9 stickers each
// Index layout: 0 1 2 / 3 4 5 / 6 7 8
const SOLVED_STATE = {
  U: Array(9).fill('W') as Color[],
  D: Array(9).fill('Y') as Color[],
  F: Array(9).fill('G') as Color[],
  B: Array(9).fill('B') as Color[],
  L: Array(9).fill('O') as Color[],
  R: Array(9).fill('R') as Color[],
};

// Mapping 3D grid positions (x, y, z) to Face Indices for rendering
// x, y, z range from -1 to 1.
// U: y = -1 (Top), D: y = 1 (Bottom)
// L: x = -1 (Left), R: x = 1 (Right)
// F: z = 1 (Front), B: z = -1 (Back)
const getStickerColor = (cubeState: typeof SOLVED_STATE, x: number, y: number, z: number, face: Face): string => {
  // Determine which sticker index on the face corresponds to this 3D position
  
  let idx = -1;

  // U Face (y=-1)
  if (face === 'U' && y === -1) {
    if (z === -1) { idx = (x === -1) ? 0 : (x === 0) ? 1 : 2; }
    else if (z === 0) { idx = (x === -1) ? 3 : (x === 0) ? 4 : 5; }
    else if (z === 1) { idx = (x === -1) ? 6 : (x === 0) ? 7 : 8; }
  }
  
  // D Face (y=1)
  else if (face === 'D' && y === 1) {
    if (z === 1) { idx = (x === -1) ? 0 : (x === 0) ? 1 : 2; }
    else if (z === 0) { idx = (x === -1) ? 3 : (x === 0) ? 4 : 5; }
    else if (z === -1) { idx = (x === -1) ? 6 : (x === 0) ? 7 : 8; }
  }

  // F Face (z=1)
  else if (face === 'F' && z === 1) {
     if (y === -1) { idx = (x === -1) ? 0 : (x === 0) ? 1 : 2; }
     else if (y === 0) { idx = (x === -1) ? 3 : (x === 0) ? 4 : 5; }
     else if (y === 1) { idx = (x === -1) ? 6 : (x === 0) ? 7 : 8; }
  }

  // B Face (z=-1)
  else if (face === 'B' && z === -1) {
     if (y === -1) { idx = (x === 1) ? 0 : (x === 0) ? 1 : 2; }
     else if (y === 0) { idx = (x === 1) ? 3 : (x === 0) ? 4 : 5; }
     else if (y === 1) { idx = (x === 1) ? 6 : (x === 0) ? 7 : 8; }
  }

  // L Face (x=-1)
  else if (face === 'L' && x === -1) {
      if (y === -1) { idx = (z === -1) ? 0 : (z === 0) ? 1 : 2; }
      else if (y === 0) { idx = (z === -1) ? 3 : (z === 0) ? 4 : 5; }
      else if (y === 1) { idx = (z === -1) ? 6 : (z === 0) ? 7 : 8; }
  }

  // R Face (x=1)
  else if (face === 'R' && x === 1) {
      if (y === -1) { idx = (z === 1) ? 0 : (z === 0) ? 1 : 2; }
      else if (y === 0) { idx = (z === 1) ? 3 : (z === 0) ? 4 : 5; }
      else if (y === 1) { idx = (z === 1) ? 6 : (z === 0) ? 7 : 8; }
  }

  if (idx !== -1) {
    return COLOR_MAP[cubeState[face][idx]];
  }
  return '#111'; // Internal color
};

const RubiksCubeGame: React.FC = () => {
  const [cube, setCube] = useState(JSON.parse(JSON.stringify(SOLVED_STATE)));
  const [rotation, setRotation] = useState({ x: -30, y: 45 });
  const [isDragging, setIsDragging] = useState(false);
  const lastMouseRef = useRef<{ x: number, y: number } | null>(null);

  // --- GAME LOGIC: MOVEMENTS ---
  // Helper to rotate 4 elements in an array
  const rotateCycle = (arr: any[], indices: number[]) => {
    const temp = arr[indices[3]];
    arr[indices[3]] = arr[indices[2]];
    arr[indices[2]] = arr[indices[1]];
    arr[indices[1]] = arr[indices[0]];
    arr[indices[0]] = temp;
  };

  const moveFace = (face: Face, direction: 'CW' | 'CCW') => {
    setCube((prev: typeof SOLVED_STATE) => {
      const next = JSON.parse(JSON.stringify(prev));
      const times = direction === 'CW' ? 1 : 3;

      for (let t = 0; t < times; t++) {
        // Rotate the face itself
        // Corners: 0->2->8->6
        rotateCycle(next[face], [0, 2, 8, 6]);
        // Edges: 1->5->7->3
        rotateCycle(next[face], [1, 5, 7, 3]);

        // Rotate adjacent sides
        if (face === 'U') {
            // F0,F1,F2 <- R0,R1,R2 <- B0,B1,B2 <- L0,L1,L2
            const temp = [next.F[0], next.F[1], next.F[2]];
            [0,1,2].forEach(i => next.F[i] = next.R[i]);
            [0,1,2].forEach(i => next.R[i] = next.B[i]);
            [0,1,2].forEach(i => next.B[i] = next.L[i]);
            [0,1,2].forEach(i => next.L[i] = temp[i]);
        } else if (face === 'D') {
            // F6,F7,F8 <- L6,L7,L8 <- B6,B7,B8 <- R6,R7,R8
            const temp = [next.F[6], next.F[7], next.F[8]];
            [6,7,8].forEach(i => next.F[i] = next.L[i]);
            [6,7,8].forEach(i => next.L[i] = next.B[i]);
            [6,7,8].forEach(i => next.B[i] = next.R[i]);
            [6,7,8].forEach(i => next.R[i] = temp[i-6]);
        } else if (face === 'F') {
            // U6,U7,U8 <- L8,L5,L2 <- D2,D1,D0 <- R0,R3,R6
            const temp = [next.U[6], next.U[7], next.U[8]];
            next.U[6] = next.L[8]; next.U[7] = next.L[5]; next.U[8] = next.L[2];
            next.L[8] = next.D[2]; next.L[5] = next.D[1]; next.L[2] = next.D[0];
            next.D[2] = next.R[0]; next.D[1] = next.R[3]; next.D[0] = next.R[6];
            next.R[0] = temp[0];   next.R[3] = temp[1];   next.R[6] = temp[2];
        } else if (face === 'B') {
            // U2,U1,U0 <- R6,R3,R0 <- D6,D7,D8 <- L0,L3,L6
            const temp = [next.U[2], next.U[1], next.U[0]];
            next.U[2] = next.R[6]; next.U[1] = next.R[3]; next.U[0] = next.R[0];
            next.R[6] = next.D[6]; next.R[3] = next.D[7]; next.R[0] = next.D[8];
            next.D[6] = next.L[0]; next.D[7] = next.L[3]; next.D[8] = next.L[6];
            next.L[0] = temp[0];   next.L[3] = temp[1];   next.L[6] = temp[2];
        } else if (face === 'L') {
            // U0,U3,U6 <- B8,B5,B2 <- D0,D3,D6 <- F0,F3,F6
            const temp = [next.U[0], next.U[3], next.U[6]];
            next.U[0] = next.B[8]; next.U[3] = next.B[5]; next.U[6] = next.B[2];
            next.B[8] = next.D[0]; next.B[5] = next.D[3]; next.B[2] = next.D[6];
            next.D[0] = next.F[0]; next.D[3] = next.F[3]; next.D[6] = next.F[6];
            next.F[0] = temp[0];   next.F[3] = temp[1];   next.F[6] = temp[2];
        } else if (face === 'R') {
            // U8,U5,U2 <- F8,F5,F2 <- D8,D5,D2 <- B0,B3,B6
            const temp = [next.U[8], next.U[5], next.U[2]];
            next.U[8] = next.F[8]; next.U[5] = next.F[5]; next.U[2] = next.F[2];
            next.F[8] = next.D[8]; next.F[5] = next.D[5]; next.F[2] = next.D[2];
            next.D[8] = next.B[0]; next.D[5] = next.B[3]; next.D[2] = next.B[6];
            next.B[0] = temp[0];   next.B[3] = temp[1];   next.B[6] = temp[2];
        }
      }
      return next;
    });
  };

  const handleScramble = () => {
    setCube(JSON.parse(JSON.stringify(SOLVED_STATE))); // Reset first
    const moves: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
    const dirs: ('CW' | 'CCW')[] = ['CW', 'CCW'];
    
    let count = 0;
    const interval = setInterval(() => {
      const move = moves[Math.floor(Math.random() * moves.length)];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      moveFace(move, dir);
      count++;
      if (count > 20) clearInterval(interval);
    }, 100);
  };

  const handleReset = () => {
    setCube(JSON.parse(JSON.stringify(SOLVED_STATE)));
    setRotation({ x: -30, y: 45 });
  };

  // --- MOUSE CONTROLS FOR ROTATION ---
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    lastMouseRef.current = { x: clientX, y: clientY };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !lastMouseRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - lastMouseRef.current.x;
    const dy = clientY - lastMouseRef.current.y;
    
    setRotation(prev => ({
      x: prev.x - dy * 0.5,
      y: prev.y + dx * 0.5
    }));
    
    lastMouseRef.current = { x: clientX, y: clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    lastMouseRef.current = null;
  };

  // --- RENDER HELPERS ---
  const cubies = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // Determine transform
        const transform = `translate3d(${x * 60}px, ${y * 60}px, ${z * 60}px)`;
        
        // Render faces for this cubie
        // Only render faces that are on the outside
        const faces = [];
        if (y === -1) faces.push({ dir: 'face-U', color: getStickerColor(cube, x, y, z, 'U') });
        if (y === 1)  faces.push({ dir: 'face-D', color: getStickerColor(cube, x, y, z, 'D') });
        if (x === -1) faces.push({ dir: 'face-L', color: getStickerColor(cube, x, y, z, 'L') });
        if (x === 1)  faces.push({ dir: 'face-R', color: getStickerColor(cube, x, y, z, 'R') });
        if (z === 1)  faces.push({ dir: 'face-F', color: getStickerColor(cube, x, y, z, 'F') });
        if (z === -1) faces.push({ dir: 'face-B', color: getStickerColor(cube, x, y, z, 'B') });

        cubies.push(
          <div key={`${x}-${y}-${z}`} className="cubie" style={{ transform }}>
            {faces.map(f => (
              <div 
                key={f.dir} 
                className={`sticker ${f.dir}`} 
                style={{ backgroundColor: f.color }} 
              />
            ))}
            {/* Inner black cube to prevent seeing through */}
            <div className="sticker" style={{ transform: 'translateZ(0)', background: '#111', width: '56px', height: '56px', margin: '2px' }}></div>
          </div>
        );
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[500px] text-white gap-8">
      <div className="flex flex-col items-center gap-2 z-10 relative">
          <h2 className="text-3xl font-bold text-yellow-400">Rubik's Cube</h2>
          <p className="text-sm text-gray-400">Drag to rotate view</p>
      </div>

      {/* 3D Scene */}
      <div 
        className="cube-scene my-8" 
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className="cube-container"
          style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}
        >
          {cubies}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 p-4 bg-black/20 rounded-xl">
         {(['L', 'F', 'R', 'B', 'U', 'D'] as Face[]).map(face => (
             <div key={face} className="flex flex-col items-center gap-1">
                 <span className="font-bold text-yellow-400">{face}</span>
                 <div className="flex gap-1">
                    <button 
                        onClick={() => moveFace(face, 'CW')}
                        className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xs"
                    >
                        ↻
                    </button>
                    <button 
                        onClick={() => moveFace(face, 'CCW')}
                        className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xs"
                    >
                        ↺
                    </button>
                 </div>
             </div>
         ))}
      </div>

      <div className="flex gap-4">
         <GlassButton onClick={handleScramble}>Scramble</GlassButton>
         <GlassButton onClick={handleReset}>Reset</GlassButton>
      </div>
    </div>
  );
};

export default RubiksCubeGame;
