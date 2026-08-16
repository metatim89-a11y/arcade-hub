import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';
import type { Food, FloatingText, Particle, Worm } from './WormGame';

type WormRenderState = {
  worms: Worm[];
  foods: Food[];
  particles: Particle[];
  texts: FloatingText[];
  camera: { x: number; y: number };
};

type WormRig = {
  root: InstanceType<typeof import('three').Group>;
  head: Mesh;
  body: Mesh[];
  eyeLeft: Mesh;
  eyeRight: Mesh;
  material: InstanceType<typeof import('three').MeshPhysicalMaterial>;
  aura: Mesh;
};

const dispose = (root: Object3D) => root.traverse((child) => {
  const mesh = child as Mesh;
  mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
});

const WormArena3D: React.FC<{
  stateRef: React.MutableRefObject<WormRenderState>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewportWidth: number;
  viewportHeight: number;
  worldSize: number;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerDown: () => void;
  onPointerUp: () => void;
}> = ({ stateRef, canvasRef, viewportWidth, viewportHeight, worldSize, onPointerMove, onPointerDown, onPointerUp }) => {
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const assignCanvas = (canvas: HTMLCanvasElement | null) => {
    localCanvasRef.current = canvas;
    if (canvasRef && 'current' in canvasRef) (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
  };

  useEffect(() => {
    const canvas = localCanvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let teardown = () => undefined;

    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050911);
      scene.fog = new THREE.FogExp2(0x06101b, 0.045);
      const camera = new THREE.OrthographicCamera(-7.5, 7.5, 5.6, -5.6, 0.1, 35);
      camera.position.set(0, 14, 0.01);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xa6eaff, 0x03050b, 2.25));
      const key = new THREE.DirectionalLight(0xffffff, 4.2);
      key.position.set(-5, 10, 6);
      key.castShadow = true;
      scene.add(key);

      const floorMaterial = new THREE.MeshPhysicalMaterial({ color: 0x081522, metalness: 0.48, roughness: 0.55, clearcoat: 0.35 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.18;
      floor.receiveShadow = true;
      scene.add(floor);
      const grid = new THREE.GridHelper(32, 32, 0x126b80, 0x143345);
      grid.position.y = -0.15;
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.32; });
      scene.add(grid);

      const borderMaterial = new THREE.MeshStandardMaterial({ color: 0xff255e, emissive: 0xff0646, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.2 });
      const walls = [
        new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 70), borderMaterial),
        new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 70), borderMaterial),
        new THREE.Mesh(new THREE.BoxGeometry(70, 0.28, 0.12), borderMaterial),
        new THREE.Mesh(new THREE.BoxGeometry(70, 0.28, 0.12), borderMaterial),
      ];
      walls.forEach((wall) => { wall.position.y = 0.05; scene.add(wall); });

      const wormRigs = new Map<number, WormRig>();
      const foodMeshes = new Map<number, Mesh>();
      const particleMeshes = new Map<number, Mesh>();
      const sharedSegmentGeometry = new THREE.SphereGeometry(0.18, 16, 11);
      const sharedEyeGeometry = new THREE.SphereGeometry(0.055, 12, 8);
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.16 });
      const black = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.2 });
      let viewWidth = 15;
      let viewHeight = 11.2;

      const localPoint = (x: number, y: number, state: WormRenderState) => new THREE.Vector3(
        ((x - state.camera.x) / viewportWidth - 0.5) * viewWidth,
        0,
        ((y - state.camera.y) / viewportHeight - 0.5) * viewHeight
      );

      const makeRig = (worm: Worm): WormRig => {
        const root = new THREE.Group();
        const color = new THREE.Color(worm.color);
        const material = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.28, metalness: 0.28, roughness: 0.2, clearcoat: 0.92 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 14), material);
        head.scale.set(1.18, 1, 1);
        head.castShadow = true;
        const eyeLeft = new THREE.Mesh(sharedEyeGeometry, white);
        const eyeRight = new THREE.Mesh(sharedEyeGeometry, white);
        eyeLeft.position.set(0.17, 0.12, -0.105);
        eyeRight.position.set(0.17, 0.12, 0.105);
        const pupilLeft = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), black);
        const pupilRight = pupilLeft.clone();
        pupilLeft.position.set(0.039, 0.018, 0);
        pupilRight.position.set(0.039, 0.018, 0);
        eyeLeft.add(pupilLeft); eyeRight.add(pupilRight); head.add(eyeLeft, eyeRight); root.add(head);
        const aura = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.025, 8, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }));
        aura.rotation.x = Math.PI / 2; aura.position.y = -0.02; root.add(aura);
        scene.add(root);
        return { root, head, body: [], eyeLeft, eyeRight, material, aura };
      };

      const syncWorms = (state: WormRenderState, delta: number, now: number) => {
        const live = new Set(state.worms.filter((worm) => !worm.isDead).map((worm) => worm.id));
        wormRigs.forEach((rig, id) => { if (!live.has(id)) { rig.body.forEach((segment) => scene.remove(segment)); scene.remove(rig.root); dispose(rig.root); wormRigs.delete(id); } });
        const smooth = 1 - Math.exp(-22 * delta);
        state.worms.forEach((worm) => {
          if (worm.isDead || !worm.body.length) return;
          let rig = wormRigs.get(worm.id);
          if (!rig) { rig = makeRig(worm); wormRigs.set(worm.id, rig); }
          const headTarget = localPoint(worm.body[0].x, worm.body[0].y, state);
          rig.root.position.lerp(headTarget, smooth);
          rig.root.rotation.y += Math.atan2(Math.sin(-worm.angle - rig.root.rotation.y), Math.cos(-worm.angle - rig.root.rotation.y)) * smooth;
          rig.head.scale.y = 1 + Math.sin(now * 0.012 + worm.id) * 0.045;
          rig.material.emissiveIntensity = worm.isBoosting ? 0.95 + Math.sin(now * .025) * .25 : 0.3;
          rig.aura.visible = worm.isBoosting || worm.invulnerable > 0;
          (rig.aura.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = worm.isBoosting ? .72 : .22 + Math.sin(now * .018) * .12;
          const stride = Math.max(1, Math.floor(worm.body.length / 42));
          const visibleSegments = worm.body.filter((_, index) => index > 0 && index % stride === 0);
          while (rig.body.length < visibleSegments.length) {
            const segment = new THREE.Mesh(sharedSegmentGeometry, rig.material);
            segment.castShadow = true; scene.add(segment); rig.body.push(segment);
          }
          while (rig.body.length > visibleSegments.length) { const segment = rig.body.pop()!; scene.remove(segment); }
          visibleSegments.forEach((point, index) => {
            const segment = rig!.body[index]; const target = localPoint(point.x, point.y, state); segment.position.lerp(target, smooth);
            const taper = 1 - (index / Math.max(1, visibleSegments.length)) * .42;
            segment.scale.setScalar(taper * (1 + Math.sin(now * .009 - index * .42) * .035));
          });
          const flicker = worm.invulnerable > 0 && Math.floor(worm.invulnerable / 4) % 2 === 0;
          rig.root.visible = !flicker; rig.body.forEach((segment) => { segment.visible = !flicker; });
        });
      };

      const syncFood = (state: WormRenderState, now: number) => {
        const live = new Set(state.foods.map((food) => food.id));
        foodMeshes.forEach((food, id) => { if (!live.has(id)) { scene.remove(food); dispose(food); foodMeshes.delete(id); } });
        state.foods.forEach((food) => {
          let value = foodMeshes.get(food.id);
          if (!value) {
            const color = new THREE.Color(food.color);
            value = new THREE.Mesh(food.value > 1 ? new THREE.DodecahedronGeometry(.12, 1) : new THREE.SphereGeometry(.075, 10, 7), new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: food.value > 1 ? .9 : .48, metalness: .34, roughness: .16, clearcoat: .8 }));
            scene.add(value); foodMeshes.set(food.id, value);
          }
          value.position.copy(localPoint(food.x, food.y, state)); value.position.y = .06 + Math.sin(now * .003 + food.pulse) * .045;
          value.scale.setScalar((food.value > 1 ? 1.35 : 1) * (1 + Math.sin(food.pulse) * .12));
          value.rotation.y = now * .0015 + food.pulse;
        });
      };

      const syncParticles = (state: WormRenderState) => {
        const live = new Set(state.particles.map((particle) => particle.id));
        particleMeshes.forEach((particle, id) => { if (!live.has(id)) { scene.remove(particle); dispose(particle); particleMeshes.delete(id); } });
        state.particles.forEach((particle) => {
          let value = particleMeshes.get(particle.id);
          const shockwave = particle.vx === 0 && particle.vy === 0;
          if (!value) {
            value = new THREE.Mesh(shockwave ? new THREE.TorusGeometry(.2, .028, 8, 30) : new THREE.TetrahedronGeometry(.05), new THREE.MeshBasicMaterial({ color: particle.color, transparent: true, opacity: 1, depthWrite: false }));
            if (shockwave) value.rotation.x = Math.PI / 2;
            scene.add(value); particleMeshes.set(particle.id, value);
          }
          value.position.copy(localPoint(particle.x, particle.y, state)); value.position.y = .16;
          value.scale.setScalar(shockwave ? Math.max(.2, (1 - particle.life) * 6) : Math.max(.1, particle.life * particle.size / 4));
          (value.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = Math.min(1, particle.life);
        });
      };

      const observer = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height, false);
        const aspect = rect.width / rect.height; viewHeight = 11.2; viewWidth = viewHeight * aspect;
        camera.left = -viewWidth / 2; camera.right = viewWidth / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.updateProjectionMatrix();
      });
      observer.observe(canvas);
      let frame = 0; let last = performance.now();
      const animate = (now: number) => {
        const delta = Math.min(.04, (now - last) / 1000); last = now; const state = stateRef.current;
        const worldPerX = viewWidth / viewportWidth; const worldPerY = viewHeight / viewportHeight;
        grid.position.x = -((state.camera.x * worldPerX) % 1.12); grid.position.z = -((state.camera.y * worldPerY) % 1.12);
        walls[0].position.x = (0 - state.camera.x - viewportWidth / 2) * worldPerX; walls[1].position.x = (worldSize - state.camera.x - viewportWidth / 2) * worldPerX;
        walls[2].position.z = (0 - state.camera.y - viewportHeight / 2) * worldPerY; walls[3].position.z = (worldSize - state.camera.y - viewportHeight / 2) * worldPerY;
        syncWorms(state, delta, now); syncFood(state, now); syncParticles(state);
        camera.position.x = Math.sin(now * .00018) * .04; camera.lookAt(0, 0, 0); renderer.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, [stateRef, viewportHeight, viewportWidth, worldSize]);

  return <canvas ref={assignCanvas} width={viewportWidth} height={viewportHeight} className="h-full w-full cursor-crosshair touch-none bg-gray-950" aria-label="Interactive 3D neon worm arena" onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp} />;
};

export default WormArena3D;
