// File: components/games/RubiksCubeGame.tsx
// Version: 1.0.1
import React, { useState, useRef } from 'react';
import GlassButton from '../ui/GlassButton';

// --- TYPES ---
type Color = 'W' | 'Y' | 'B' | 'G' | 'R' | 'O';
type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

const COLOR_MAP: { [key in Color]: string } = {
  'W': '#ffffff', 
  'Y': '#ffd500', 
  'B': '#0046ad', 
  'G': '#009b48', 
  'R': '#b71234', 
  'O': '#ff5800', 
};

const SOLVED_STATE = {
  U: Array(9).fill('W') as Color[],
  D: Array(9).fill('Y') as Color[],
  F: Array(9).fill('G') as Color[],
  B: Array(9).fill('B') as Color[],
  L: Array(9).fill('O') as Color[],
  R: Array(9).fill('R') as Color[],
};

const getStickerColor = (cubeState: typeof SOLVED_STATE, x: number, y: number, z: number, face: Face): string => {
  let idx = -1;
  if (face === 'U' && y === -1) {
    idx = (z + 1) * 3 + (x + 1);
  } else if (face === 'D' && y === 1) {
    idx = (1 - z) * 3 + (x + 1);
  } else if (face === 'F' && z === 1) {
    idx = (y + 1) * 3 + (x + 1);
  } else if (face === 'B' && z === -1) {
    idx = (y + 1) * 3 + (1 - x);
  } else if (face === 'L' && x === -1) {
    idx = (y + 1) * 3 + (z + 1);
  } else if (face === 'R' && x === 1) {
    idx = (y + 1) * 3 + (1 - z);
  }

  if (idx >= 0 && idx < 9) {
    return COLOR_MAP[cubeState[face][idx]];
  }
  return '#111';
};

const RubiksCubeGame: React.FC = () => {
  const [cube, setCube] = useState<typeof SOLVED_STATE>(JSON.parse(JSON.stringify(SOLVED_STATE)));
  const [rotation, setRotation] = useState({ x: -30, y: 45 });
  const [isDragging, setIsDragging] = useState(false);
  const lastMouseRef = useRef<{ x: number, y: number } | null>(null);

  const rotateCycle = (faces: Color[][], indices: {f: Face, i: number}[]) => {
    const temp = [faces[0][indices[0].i], faces[1][indices[1].i], faces[2][indices[2].i]];
    // This is more complex than a simple cycle for Rubik's
  };

  const moveFace = (face: Face, direction: 'CW' | 'CCW') => {
    setCube((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const rotate = (f: Face) => {
        const old = [...next[f]];
        if (direction === 'CW') {
          next[f] = [old[6], old[3], old[0], old[7], old[4], old[1], old[8], old[5], old[2]];
        } else {
          next[f] = [old[2], old[5], old[8], old[1], old[4], old[7], old[0], old[3], old[6]];
        }
      };

      rotate(face);

      if (direction === 'CW') {
        if (face === 'U') {
          const temp = [next.F[0], next.F[1], next.F[2]];
          [0, 1, 2].forEach(i => next.F[i] = next.R[i]);
          [0, 1, 2].forEach(i => next.R[i] = next.B[i]);
          [0, 1, 2].forEach(i => next.B[i] = next.L[i]);
          [0, 1, 2].forEach(i => next.L[i] = temp[i]);
        } else if (face === 'D') {
          const temp = [next.F[6], next.F[7], next.F[8]];
          [6, 7, 8].forEach(i => next.F[i] = next.L[i]);
          [6, 7, 8].forEach(i => next.L[i] = next.B[i]);
          [6, 7, 8].forEach(i => next.B[i] = next.R[i]);
          [6, 7, 8].forEach(i => next.R[i] = temp[i-6]);
        } else if (face === 'L') {
          const temp = [next.F[0], next.F[3], next.F[6]];
          next.F[0] = next.U[0]; next.F[3] = next.U[3]; next.F[6] = next.U[6];
          next.U[0] = next.B[8]; next.U[3] = next.B[5]; next.U[6] = next.B[2];
          next.B[8] = next.D[0]; next.B[5] = next.D[3]; next.B[2] = next.D[6];
          next.D[0] = temp[0];   next.D[3] = temp[1];   next.D[6] = temp[2];
        } else if (face === 'R') {
          const temp = [next.F[2], next.F[5], next.F[8]];
          next.F[2] = next.D[2]; next.F[5] = next.D[5]; next.F[8] = next.D[8];
          next.D[2] = next.B[6]; next.D[5] = next.B[3]; next.D[8] = next.B[0];
          next.B[6] = next.U[2]; next.B[3] = next.U[5]; next.B[0] = next.U[8];
          next.U[2] = temp[0];   next.U[5] = temp[1];   next.U[8] = temp[2];
        } else if (face === 'F') {
          const temp = [next.U[6], next.U[7], next.U[8]];
          next.U[6] = next.L[8]; next.U[7] = next.L[5]; next.U[8] = next.L[2];
          next.L[8] = next.D[2]; next.L[5] = next.D[1]; next.L[2] = next.D[0];
          next.D[2] = next.R[0]; next.D[1] = next.R[3]; next.D[0] = next.R[6];
          next.R[0] = temp[0];   next.R[3] = temp[1];   next.R[6] = temp[2];
        } else if (face === 'B') {
          const temp = [next.U[0], next.U[1], next.U[2]];
          next.U[0] = next.R[2]; next.U[1] = next.R[5]; next.U[2] = next.R[8];
          next.R[2] = next.D[8]; next.R[5] = next.D[7]; next.R[8] = next.D[6];
          next.D[8] = next.L[6]; next.D[7] = next.L[3]; next.D[6] = next.L[0];
          next.L[6] = temp[0];   next.L[3] = temp[1];   next.L[0] = temp[2];
        }
      } else {
        // Simple 3-times rotation for CCW
        for(let i=0; i<2; i++) {
            // This is handled by the rotate(face) above calling it once, 
            // but we need to undo the side changes too.
            // Easier to just re-implement CCW side changes.
        }
        // Let's just use 3 CW moves for CCW for simplicity
        const times = 2; // We already did 1 in the outer scope? No, we need 3 total.
        // Re-call moveFace with CW twice? No, that's recursive.
      }

      return next;
    });
  };

  const handleMove = (face: Face, dir: 'CW' | 'CCW') => {
      if (dir === 'CW') moveFace(face, 'CW');
      else { moveFace(face, 'CW'); moveFace(face, 'CW'); moveFace(face, 'CW'); }
  }

  const handleScramble = () => {
    let count = 0;
    const interval = setInterval(() => {
      const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
      handleMove(faces[Math.floor(Math.random() * 6)], 'CW');
      count++;
      if (count > 20) clearInterval(interval);
    }, 100);
  };

  const handleReset = () => {
    setCube(JSON.parse(JSON.stringify(SOLVED_STATE)));
    setRotation({ x: -30, y: 45 });
  };

  const handleMouseDown = (e: any) => {
    setIsDragging(true);
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    lastMouseRef.current = { x, y };
  };

  const handleMouseMove = (e: any) => {
    if (!isDragging || !lastMouseRef.current) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = x - lastMouseRef.current.x;
    const dy = y - lastMouseRef.current.y;
    setRotation(prev => ({ x: prev.x - dy * 0.5, y: prev.y + dx * 0.5 }));
    lastMouseRef.current = { x, y };
  };

  const cubies = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const faces = [];
        if (y === -1) faces.push(<div key="U" className="sticker face-U" style={{ backgroundColor: getStickerColor(cube, x, y, z, 'U') }} />);
        if (y === 1)  faces.push(<div key="D" className="sticker face-D" style={{ backgroundColor: getStickerColor(cube, x, y, z, 'D') }} />);
        if (x === -1) faces.push(<div key="L" className="sticker face-L" style={{ backgroundColor: getStickerColor(cube, x, y, z, 'L') }} />);
        if (x === 1)  faces.push(<div key="R" className="sticker face-R" style={{ backgroundColor: getStickerColor(cube, x, y, z, 'R') }} />);
        if (z === 1)  faces.push(<div key="F" className="sticker face-F" style={{ backgroundColor: getStickerColor(cube, x, y, z, 'F') }} />);
        if (z === -1) faces.push(<div key="B" className="sticker face-B" style={{ backgroundColor: getStickerColor(cube, x, y, z, 'B') }} />);

        cubies.push(
          <div key={`${x}${y}${z}`} className="cubie" style={{ transform: `translate3d(${x * 60}px, ${y * 60}px, ${z * 60}px)` }}>
            {faces}
            <div className="cubie-inner" />
          </div>
        );
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[600px] text-white gap-8 select-none">
      <div className="text-center">
          <h2 className="text-3xl font-bold text-yellow-400">RUBIK'S CUBE</h2>
          <p className="text-xs text-gray-500 mt-1">DRAG TO ROTATE VIEW</p>
      </div>

      <div 
        className="cube-scene" 
        onMouseDown={handleMouseDown} onTouchStart={handleMouseDown}
        onMouseMove={handleMouseMove} onTouchMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)} onTouchEnd={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <div className="cube-container" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
          {cubies}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-4 bg-gray-900/50 rounded-2xl border border-gray-800">
         {(['U', 'D', 'L', 'R', 'F', 'B'] as Face[]).map(face => (
             <div key={face} className="flex flex-col items-center gap-2">
                 <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center font-bold text-yellow-500 border border-yellow-500/20">{face}</div>
                 <div className="flex gap-1">
                    <button onClick={() => handleMove(face, 'CW')} className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center text-xl">↻</button>
                    <button onClick={() => handleMove(face, 'CCW')} className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center text-xl">↺</button>
                 </div>
             </div>
         ))}
      </div>

      <div className="flex gap-4">
         <GlassButton onClick={handleScramble} className="!bg-yellow-500 !text-black">SCRAMBLE</GlassButton>
         <GlassButton onClick={handleReset}>RESET</GlassButton>
      </div>

      <style>{`
        .cube-scene {
            width: 300px;
            height: 300px;
            perspective: 1000px;
            cursor: grab;
        }
        .cube-scene:active { cursor: grabbing; }
        .cube-container {
            width: 100%;
            height: 100%;
            position: relative;
            transform-style: preserve-3d;
            transition: transform 0.05s linear;
        }
        .cubie {
            position: absolute;
            width: 60px;
            height: 60px;
            transform-style: preserve-3d;
            left: 120px;
            top: 120px;
        }
        .cubie-inner {
            position: absolute;
            width: 58px;
            height: 58px;
            background: #000;
            transform: translateZ(0);
        }
        .sticker {
            position: absolute;
            width: 56px;
            height: 56px;
            margin: 2px;
            box-sizing: border-box;
            border: 3px solid #000;
            border-radius: 8px;
            backface-visibility: hidden;
        }
        .face-U { transform: translateY(-30px) rotateX(90deg); }
        .face-D { transform: translateY(30px) rotateX(-90deg); }
        .face-L { transform: translateX(-30px) rotateY(-90deg); }
        .face-R { transform: translateX(30px) rotateY(90deg); }
        .face-F { transform: translateZ(30px); }
        .face-B { transform: translateZ(-30px) rotateY(180deg); }
      `}</style>
    </div>
  );
};

export default RubiksCubeGame;
