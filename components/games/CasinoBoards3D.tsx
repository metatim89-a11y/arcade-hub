import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

type PlinkoBall = { id: number; x: number; y: number; color: string };
type PegGlow = { r: number; c: number; life: number };

const dispose = (root: Object3D) => root.traverse((child) => {
  const mesh = child as Mesh; mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
});

const labelCanvas = (label: string, background: string, foreground = '#ffffff') => {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const context = canvas.getContext('2d')!; context.fillStyle = background; context.fillRect(0, 0, 256, 128);
  context.strokeStyle = 'rgba(255,255,255,.38)'; context.lineWidth = 7; context.strokeRect(4, 4, 248, 120);
  context.fillStyle = foreground; context.font = 'bold 48px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(label, 128, 67);
  return canvas;
};

export const PlinkoBoard3D: React.FC<{
  physicsCanvasRef: React.RefObject<HTMLCanvasElement>;
  ballsRef: React.MutableRefObject<PlinkoBall[]>;
  glowingPegRef: React.MutableRefObject<PegGlow[]>;
  rows: number;
  multipliers: number[];
  theme: 'Midnight' | 'Neon' | 'Candy';
}> = ({ physicsCanvasRef, ballsRef, glowingPegRef, rows, multipliers, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ rows, multipliers, theme }); stateRef.current = { rows, multipliers, theme };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(36, 1, .1, 40); camera.position.set(0, .25, 13.5); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xdff4ff, 0x080912, 2.5)); const key = new THREE.DirectionalLight(0xffffff, 4.5); key.position.set(-4, 7, 8); key.castShadow = true; scene.add(key);
      const boardRoot = new THREE.Group(); scene.add(boardRoot);
      const backMaterial = new THREE.MeshStandardMaterial({ color: 0x10182b, metalness: .5, roughness: .32 });
      const back = new THREE.Mesh(new THREE.BoxGeometry(10.8, 9.2, .38), backMaterial); back.position.z = -.42; back.receiveShadow = true; boardRoot.add(back);
      const railMaterial = new THREE.MeshStandardMaterial({ color: 0x263752, metalness: .72, roughness: .22 });
      [[-5.25, 0, .25, 8.8], [5.25, 0, .25, 8.8], [0, 4.35, 10.5, .24], [0, -4.35, 10.5, .24]].forEach(([x, y, width, height]) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(width, height, .42), railMaterial); rail.position.set(x, y, .05); boardRoot.add(rail); });
      const pegs = new Map<string, Mesh>(); const buckets = new THREE.Group(); boardRoot.add(buckets); let signature = '';
      const rebuild = () => {
        pegs.forEach((peg) => { boardRoot.remove(peg); dispose(peg); }); pegs.clear(); dispose(buckets); buckets.clear();
        const liveRows = stateRef.current.rows;
        for (let row = 0; row < liveRows; row += 1) {
          const count = row + 3; const span = 8.9 * ((row + 2) / (liveRows + 1));
          for (let col = 0; col < count; col += 1) {
            const x = count === 1 ? 0 : -span / 2 + col * span / (count - 1); const y = 3.72 - row * (7.05 / Math.max(1, liveRows - 1));
            const peg = new THREE.Mesh(new THREE.CylinderGeometry(.085, .105, .32, 18), new THREE.MeshStandardMaterial({ color: 0x9aacbd, metalness: .82, roughness: .18, emissive: 0x000000 })); peg.rotation.x = Math.PI / 2; peg.position.set(x, y, .08); peg.castShadow = true; boardRoot.add(peg); pegs.set(`${row}-${col}`, peg);
          }
        }
        stateRef.current.multipliers.forEach((multiplier, index) => {
          const color = multiplier >= 10 ? '#d92d48' : multiplier >= 2 ? '#d78b18' : multiplier >= 1 ? '#168b60' : '#283246';
          const texture = new THREE.CanvasTexture(labelCanvas(`${multiplier}×`, color)); texture.colorSpace = THREE.SRGBColorSpace;
          const width = 9.7 / stateRef.current.multipliers.length;
          const bucket = new THREE.Mesh(new THREE.BoxGeometry(width * .91, .55, .32), new THREE.MeshStandardMaterial({ map: texture, emissive: 0x000000 })); bucket.position.set(-4.85 + width * (index + .5), -3.92, .05); bucket.userData.index = index; buckets.add(bucket);
        });
      };
      const balls = new Map<number, Mesh>();
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frame = 0;
      const animate = () => {
        const live = stateRef.current; const next = `${live.rows}:${live.theme}:${live.multipliers.join(',')}`; if (next !== signature) { signature = next; rebuild(); }
        backMaterial.color.setHex(live.theme === 'Candy' ? 0x3a153f : live.theme === 'Neon' ? 0x062d38 : 0x10182b);
        const physicsCanvas = physicsCanvasRef.current; const width = physicsCanvas?.width || 800; const height = physicsCanvas?.height || 600;
        const liveIds = new Set(ballsRef.current.map((ball) => ball.id));
        balls.forEach((ball, id) => { if (!liveIds.has(id)) { boardRoot.remove(ball); dispose(ball); balls.delete(id); } });
        ballsRef.current.forEach((ball) => {
          let mesh = balls.get(ball.id);
          if (!mesh) { const color = new THREE.Color(ball.color); mesh = new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 14), new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: .35, metalness: .42, roughness: .16, clearcoat: .8 })); mesh.castShadow = true; boardRoot.add(mesh); balls.set(ball.id, mesh); }
          mesh.position.set((ball.x / width - .5) * 10, (.5 - ball.y / height) * 8.5, .38);
        });
        pegs.forEach((peg, key) => { const [row, col] = key.split('-').map(Number); const glow = glowingPegRef.current.some((item) => item.r === row && item.c === col && item.life > 0); const material = peg.material as InstanceType<typeof THREE.MeshStandardMaterial>; material.emissive.setHex(glow ? 0xffffff : 0x000000); material.emissiveIntensity = glow ? 1.2 : 0; peg.scale.setScalar(glow ? 1.25 : 1); });
        renderer.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, [ballsRef, glowingPegRef, physicsCanvasRef]);
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="3D Plinko board" />;
};

export const KenoBoard3D: React.FC<{
  selected: Set<number>;
  drawn: Set<number>;
  phase: 'betting' | 'drawing' | 'results';
  onNumberClick: (number: number) => void;
}> = ({ selected, drawn, phase, onNumberClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); const stateRef = useRef({ selected, drawn, phase, onNumberClick }); stateRef.current = { selected, drawn, phase, onNumberClick };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(46, 1, .1, 60); camera.up.set(0, 0, -1); camera.position.set(0, 13.5, 0); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xddf4ff, 0x080b18, 2.5)); const light = new THREE.DirectionalLight(0xffffff, 4.5); light.position.set(-5, 8, 5); light.castShadow = true; scene.add(light);
      const base = new THREE.Mesh(new THREE.BoxGeometry(10.7, .38, 8.7), new THREE.MeshStandardMaterial({ color: 0x131b32, metalness: .52, roughness: .3 })); base.position.y = -.3; base.receiveShadow = true; scene.add(base);
      const meshes: Mesh[] = []; const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let hovered = -1;
      for (let index = 0; index < 80; index += 1) {
        const number = index + 1; const texture = new THREE.CanvasTexture(labelCanvas(String(number), '#172238')); texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshStandardMaterial({ color: 0x34445f, metalness: .32, roughness: .25, emissive: 0x000000 });
        const chip = new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .15, 32), material); chip.position.set((index % 10 - 4.5) * 1.02, .02, (Math.floor(index / 10) - 3.5) * 1.02); chip.userData.number = number; chip.castShadow = true;
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false })); label.position.set(0, .22, 0); label.scale.set(.7, .35, 1); label.renderOrder = 10; chip.add(label);
        scene.add(chip); meshes.push(chip);
      }
      const pick = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(meshes, false)[0]; hovered = hit ? Number(hit.object.userData.number) : -1; canvas.style.cursor = hovered > 0 && stateRef.current.phase === 'betting' ? 'pointer' : 'default'; };
      const click = (event: PointerEvent) => { pick(event); if (hovered > 0 && stateRef.current.phase === 'betting') stateRef.current.onNumberClick(hovered); };
      canvas.style.touchAction = 'none'; canvas.addEventListener('pointermove', pick); canvas.addEventListener('pointerdown', click);
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; const requiredHeight = Math.max(9.3, 11.3 / camera.aspect); camera.position.y = requiredHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frame = 0; let last = performance.now();
      const animate = (now: number) => { const delta = Math.min(.04, (now - last) / 1000); last = now; const smooth = 1 - Math.exp(-10.5 * delta); const live = stateRef.current; meshes.forEach((chip) => { const number = Number(chip.userData.number); const selected = live.selected.has(number); const drawn = live.drawn.has(number); const match = selected && drawn; const material = chip.material as InstanceType<typeof THREE.MeshStandardMaterial>; const color = match ? 0x22d785 : drawn ? 0xf1ad27 : selected ? 0x3488ef : hovered === number ? 0x536984 : 0x000000; material.emissive.setHex(color); material.emissiveIntensity = match ? .85 + Math.sin(now * .01) * .25 : color ? .42 : 0; const targetY = match ? .28 + Math.sin(now * .012 + number) * .06 : selected || drawn || hovered === number ? .18 : .02; chip.position.y += (targetY - chip.position.y) * smooth; chip.scale.setScalar(match ? 1.06 : 1); }); renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointermove', pick); canvas.removeEventListener('pointerdown', click); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);
  return <canvas ref={canvasRef} className="h-full w-full touch-manipulation" aria-label="Interactive 3D Keno number board" />;
};
