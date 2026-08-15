import React, { useEffect, useRef } from 'react';
import type { Group, Mesh, Object3D } from 'three';

type TicMark = 'X' | 'O' | null;

interface TicTacToeBoard3DProps {
  board: TicMark[];
  winningLine: number[];
  disabled: boolean;
  onCellClick: (index: number) => void;
}

interface ConnectPiece3D {
  col: number;
  row: number;
  player: '1' | '2';
  id: number;
}

interface ConnectFourBoard3DProps {
  pieces: ConnectPiece3D[];
  winningLine: [number, number][];
  currentPlayer: '1' | '2';
  disabled: boolean;
  onColumnClick: (column: number) => void;
}

const disposeObject = (root: Object3D) => {
  root.traverse((child) => {
    const mesh = child as Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach((material) => material.dispose());
  });
};

export const TicTacToeBoard3D: React.FC<TicTacToeBoard3DProps> = ({ board, winningLine, disabled, onCellClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ board, winningLine, disabled, onCellClick });
  stateRef.current = { board, winningLine, disabled, onCellClick };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let teardown = () => undefined;

    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, .1, 40);
      camera.position.set(0, 9.8, 3.25);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xccecff, 0x101523, 2.4));
      const key = new THREE.DirectionalLight(0xffffff, 4.8);
      key.position.set(-4, 8, 5);
      key.castShadow = true;
      scene.add(key);
      const cyan = new THREE.PointLight(0x42dfff, 22, 16);
      cyan.position.set(4, 3, 2);
      scene.add(cyan);

      const boardRoot = new THREE.Group();
      boardRoot.rotation.y = -.08;
      scene.add(boardRoot);
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x121b31, roughness: .28, metalness: .68 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(6.65, .42, 6.65), baseMaterial);
      base.position.y = -.3;
      base.receiveShadow = true;
      boardRoot.add(base);

      const cellMaterial = new THREE.MeshStandardMaterial({ color: 0x17243d, roughness: .34, metalness: .52 });
      const cellMeshes: Mesh[] = [];
      const hitMeshes: Mesh[] = [];
      for (let index = 0; index < 9; index += 1) {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = (col - 1) * 2.08;
        const z = (row - 1) * 2.08;
        const cell = new THREE.Mesh(new THREE.BoxGeometry(1.86, .18, 1.86), cellMaterial.clone());
        cell.position.set(x, 0, z);
        cell.receiveShadow = true;
        boardRoot.add(cell);
        cellMeshes.push(cell);
        const hit = new THREE.Mesh(
          new THREE.BoxGeometry(1.96, 1.1, 1.96),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        hit.position.set(x, .55, z);
        hit.userData.index = index;
        boardRoot.add(hit);
        hitMeshes.push(hit);
      }

      const pieces = new Map<number, Group>();
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let hovered = -1;
      const updatePointer = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(hitMeshes, false)[0];
        hovered = hit ? Number(hit.object.userData.index) : -1;
        canvas.style.cursor = hovered >= 0 && !stateRef.current.disabled && !stateRef.current.board[hovered] ? 'pointer' : 'default';
      };
      const click = (event: PointerEvent) => {
        updatePointer(event);
        if (hovered >= 0 && !stateRef.current.disabled && !stateRef.current.board[hovered]) stateRef.current.onCellClick(hovered);
      };
      canvas.addEventListener('pointermove', updatePointer);
      canvas.addEventListener('pointerleave', () => { hovered = -1; });
      canvas.addEventListener('pointerup', click);

      const addPiece = (index: number, mark: Exclude<TicMark, null>) => {
        const group = new THREE.Group();
        const color = mark === 'X' ? 0x5ce8ff : 0xff5a9d;
        const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .45, metalness: .56, roughness: .22 });
        if (mark === 'X') {
          [-Math.PI / 4, Math.PI / 4].forEach((rotation) => {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(1.42, .3, .34), material);
            bar.rotation.y = rotation;
            bar.castShadow = true;
            group.add(bar);
          });
        } else {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(.64, .18, 14, 42), material);
          ring.rotation.x = Math.PI / 2;
          ring.castShadow = true;
          group.add(ring);
        }
        const col = index % 3;
        const row = Math.floor(index / 3);
        group.position.set((col - 1) * 2.08, 1.2, (row - 1) * 2.08);
        group.scale.setScalar(.05);
        group.userData.birth = performance.now();
        group.userData.targetY = .32;
        group.userData.mark = mark;
        boardRoot.add(group);
        pieces.set(index, group);
      };

      const observer = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
      });
      observer.observe(canvas);
      let frame = 0;
      const animate = (now: number) => {
        const live = stateRef.current;
        live.board.forEach((mark, index) => {
          const existing = pieces.get(index);
          if (mark && !existing) addPiece(index, mark);
          if (!mark && existing) {
            boardRoot.remove(existing);
            disposeObject(existing);
            pieces.delete(index);
          }
          const cellMaterial = cellMeshes[index].material as InstanceType<typeof THREE.MeshStandardMaterial>;
          const activeHover = hovered === index && !mark && !live.disabled;
          cellMaterial.emissive.setHex(activeHover ? 0x2b9fd0 : 0x000000);
          cellMaterial.emissiveIntensity = activeHover ? .45 : 0;
        });
        pieces.forEach((piece, index) => {
          const age = Math.min(1, (now - Number(piece.userData.birth)) / 420);
          const eased = 1 - Math.pow(1 - age, 3);
          piece.scale.setScalar(eased);
          piece.position.y += (Number(piece.userData.targetY) - piece.position.y) * .14;
          const winning = live.winningLine.includes(index);
          const pulse = winning ? 1 + Math.sin(now * .009) * .1 : 1;
          piece.scale.multiplyScalar(pulse);
          piece.rotation.y = Math.sin(now * .0015 + index) * (winning ? .16 : .025);
        });
        boardRoot.rotation.x = Math.sin(now * .00035) * .012;
        renderer.render(scene, camera);
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);

      teardown = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        canvas.removeEventListener('pointermove', updatePointer);
        canvas.removeEventListener('pointerup', click);
        disposeObject(scene);
        renderer.dispose();
      };
    });

    return () => { cancelled = true; teardown(); };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full touch-manipulation" aria-label="Interactive 3D Tic-Tac-Toe board" />;
};

export const ConnectFourBoard3D: React.FC<ConnectFourBoard3DProps> = ({ pieces, winningLine, currentPlayer, disabled, onColumnClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ pieces, winningLine, currentPlayer, disabled, onColumnClick });
  stateRef.current = { pieces, winningLine, currentPlayer, disabled, onColumnClick };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, .1, 40);
      camera.position.set(0, .3, 11.5);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xbde9ff, 0x091021, 2.5));
      const key = new THREE.DirectionalLight(0xffffff, 4.4);
      key.position.set(-4, 7, 7);
      key.castShadow = true;
      scene.add(key);
      const boardRoot = new THREE.Group();
      boardRoot.rotation.y = -.055;
      boardRoot.rotation.x = -.025;
      scene.add(boardRoot);

      const blue = new THREE.MeshStandardMaterial({ color: 0x1763c6, metalness: .62, roughness: .25, emissive: 0x0b2f73, emissiveIntensity: .3 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x07101d, metalness: .25, roughness: .5 });
      const addBeam = (width: number, height: number, x: number, y: number) => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(width, height, .52), blue);
        beam.position.set(x, y, 0);
        beam.castShadow = true;
        beam.receiveShadow = true;
        boardRoot.add(beam);
      };
      addBeam(7.8, .35, 0, 3.35);
      addBeam(8.15, .5, 0, -3.3);
      for (let col = 0; col <= 7; col += 1) addBeam(.22, 6.35, col - 3.5, 0);
      for (let row = 0; row <= 6; row += 1) addBeam(7.3, .18, 0, row - 3);
      for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 7; col += 1) {
          const socket = new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .2, 32), dark);
          socket.rotation.x = Math.PI / 2;
          socket.position.set(col - 3, 2.5 - row, -.04);
          boardRoot.add(socket);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(.47, .065, 9, 30), blue);
          rim.position.set(col - 3, 2.5 - row, .29);
          boardRoot.add(rim);
        }
      }
      const footMaterial = new THREE.MeshStandardMaterial({ color: 0x0b326e, metalness: .72, roughness: .28 });
      [-3.1, 3.1].forEach((x) => {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.35, .3, 1.8), footMaterial);
        foot.position.set(x, -3.6, -.45);
        boardRoot.add(foot);
      });

      const hitMeshes: Mesh[] = [];
      for (let col = 0; col < 7; col += 1) {
        const hit = new THREE.Mesh(new THREE.BoxGeometry(.96, 7.2, 1.2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        hit.position.set(col - 3, .1, .8);
        hit.userData.column = col;
        boardRoot.add(hit);
        hitMeshes.push(hit);
      }
      const pieceMeshes = new Map<number, Mesh>();
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let hovered = -1;
      const updatePointer = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(hitMeshes, false)[0];
        hovered = hit ? Number(hit.object.userData.column) : -1;
        canvas.style.cursor = hovered >= 0 && !stateRef.current.disabled ? 'pointer' : 'default';
      };
      const click = (event: PointerEvent) => {
        updatePointer(event);
        if (hovered >= 0 && !stateRef.current.disabled) stateRef.current.onColumnClick(hovered);
      };
      canvas.addEventListener('pointermove', updatePointer);
      canvas.addEventListener('pointerup', click);

      const addPiece = (piece: ConnectPiece3D) => {
        const color = piece.player === '1' ? 0xff3e4d : 0xffd43b;
        const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .22, metalness: .42, roughness: .25 });
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(.425, .425, .22, 40, 1, false), material);
        disc.rotation.x = Math.PI / 2;
        disc.position.set(piece.col - 3, 4.25, .34);
        disc.userData.targetY = 2.5 - piece.row;
        disc.userData.velocity = 0;
        disc.userData.landed = false;
        disc.castShadow = true;
        boardRoot.add(disc);
        pieceMeshes.set(piece.id, disc);
      };
      const observer = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
      });
      observer.observe(canvas);
      let frame = 0;
      let last = performance.now();
      const animate = (now: number) => {
        const delta = Math.min(.035, (now - last) / 1000);
        last = now;
        const live = stateRef.current;
        const ids = new Set(live.pieces.map((piece) => piece.id));
        live.pieces.forEach((piece) => { if (!pieceMeshes.has(piece.id)) addPiece(piece); });
        pieceMeshes.forEach((mesh, id) => {
          if (!ids.has(id)) {
            boardRoot.remove(mesh);
            disposeObject(mesh);
            pieceMeshes.delete(id);
            return;
          }
          const target = Number(mesh.userData.targetY);
          if (!mesh.userData.landed) {
            mesh.userData.velocity = Number(mesh.userData.velocity) + 22 * delta;
            mesh.position.y -= Number(mesh.userData.velocity) * delta;
            if (mesh.position.y <= target) {
              mesh.position.y = target;
              mesh.userData.velocity = -Number(mesh.userData.velocity) * .2;
              mesh.userData.landed = Math.abs(Number(mesh.userData.velocity)) < 1.05;
            }
          }
          const source = live.pieces.find((piece) => piece.id === id);
          const winning = !!source && live.winningLine.some(([row, col]) => row === source.row && col === source.col);
          const material = mesh.material as InstanceType<typeof THREE.MeshStandardMaterial>;
          material.emissiveIntensity = winning ? .65 + Math.sin(now * .01) * .28 : .22;
          mesh.scale.setScalar(winning ? 1 + Math.sin(now * .009) * .07 : 1);
        });
        hitMeshes.forEach((hit, col) => {
          const material = hit.material as InstanceType<typeof THREE.MeshBasicMaterial>;
          material.opacity = hovered === col && !live.disabled ? .09 : 0;
          material.color.setHex(live.currentPlayer === '1' ? 0xff4054 : 0xffd83d);
        });
        boardRoot.rotation.y = -.055 + Math.sin(now * .0003) * .012;
        renderer.render(scene, camera);
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      teardown = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        canvas.removeEventListener('pointermove', updatePointer);
        canvas.removeEventListener('pointerup', click);
        disposeObject(scene);
        renderer.dispose();
      };
    });
    return () => { cancelled = true; teardown(); };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full touch-manipulation" aria-label="Interactive 3D Connect Four board" />;
};
