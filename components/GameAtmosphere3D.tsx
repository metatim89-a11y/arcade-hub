import React, { useEffect, useRef } from 'react';
import type { Material, Mesh } from 'three';

const paletteFor = (gameId: string) => {
  const palettes: Record<string, [number, number, number]> = {
    wheel: [0xffc83d, 0xff4f81, 0x54d8ff], crash: [0xff5b64, 0x64efff, 0xffc84a], blackjack: [0x58d68d, 0xffdf68, 0xf4f7ff],
    poker: [0xe94e68, 0x4dd8a5, 0xffd766], keno: [0x6de6ff, 0x9d72ff, 0xffd85c], plinko: [0x62d9ff, 0xff5ca8, 0xffdd55],
    slots: [0xffd54f, 0xff5277, 0x7c64ff], coinpusher: [0xffd45c, 0xff9f37, 0x6ee7ff], nim: [0x22d3ee, 0x14b8a6, 0xfacc15], chutes: [0x22c55e, 0xf97316, 0xfacc15], blockdrop: [0xa855f7, 0xec4899, 0x22d3ee],
    connect4: [0xff5252, 0xffd84d, 0x55b8ff], rubikscube: [0xff584d, 0x5ee58b, 0x53a8ff], mancala: [0xe6a45f, 0x73d5a4, 0xffd27b],
    rps: [0xff6e91, 0x72d8ff, 0xffdd62], tictactoe: [0x65e6ff, 0xff5d9e, 0xffdf5e]
  };
  return palettes[gameId] ?? [0x60dfff, 0xffd65c, 0xb673ff];
};

const GameAtmosphere3D: React.FC<{ gameId: string }> = ({ gameId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (gameId === 'fishing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let dispose = () => undefined;

    void import('three').then(THREE => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(52, 1, .1, 60);
      camera.position.z = 11;
      scene.add(new THREE.HemisphereLight(0xbdefff, 0x080912, 2.2));
      const light = new THREE.PointLight(0xffffff, 38, 25);
      light.position.set(-4, 5, 8); scene.add(light);
      const palette = paletteFor(gameId);
      const objects: Array<{ mesh: Mesh; speed: number; phase: number; radius: number }> = [];

      const geometryFor = (index: number) => {
        if (gameId === 'coinpusher' || gameId === 'wheel') return new THREE.CylinderGeometry(.28 + index % 3 * .07, .28 + index % 3 * .07, .08, 20);
        if (gameId === 'connect4' || gameId === 'tictactoe') return new THREE.TorusGeometry(.28 + index % 2 * .08, .09, 8, 20);
        if (gameId === 'blackjack' || gameId === 'poker' || gameId === 'rps' || gameId === 'slots') return new THREE.BoxGeometry(.6, .82, .1);
        if (gameId === 'plinko') return new THREE.SphereGeometry(.13 + index % 3 * .045, 12, 8);
        if (gameId === 'crash') return index % 3 === 0 ? new THREE.ConeGeometry(.22, .65, 5) : new THREE.TetrahedronGeometry(.16);
        if (gameId === 'rubikscube') return new THREE.BoxGeometry(.42, .42, .42);
        if (gameId === 'mancala' || gameId === 'keno' || gameId === 'nim' || gameId === 'chutes' || gameId === 'blockdrop') return new THREE.DodecahedronGeometry(.2 + index % 3 * .045, 0);
        return new THREE.IcosahedronGeometry(.2, 0);
      };

      for (let index = 0; index < 24; index += 1) {
        const color = palette[index % palette.length];
        const material = new THREE.MeshStandardMaterial({ color, roughness: .3, metalness: .28, emissive: color, emissiveIntensity: .12, transparent: true, opacity: .5 });
        const value = new THREE.Mesh(geometryFor(index), material);
        const angle = index / 24 * Math.PI * 2;
        const radius = 3.5 + index % 5 * .7;
        value.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * .58, -1.5 - index % 4 * .8);
        value.rotation.set(index * .23, index * .39, angle);
        scene.add(value);
        objects.push({ mesh: value, speed: .22 + index % 5 * .055, phase: angle, radius });
      }

      let width = 0;
      let height = 0;
      const resize = () => {
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height || (width === bounds.width && height === bounds.height)) return;
        width = bounds.width; height = bounds.height;
        renderer.setSize(width, height, false);
        camera.aspect = width / height; camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let pointerX = 0;
      let pointerY = 0;
      const onPointer = (event: PointerEvent) => {
        const bounds = canvas.getBoundingClientRect();
        pointerX = (event.clientX - bounds.left) / Math.max(1, bounds.width) - .5;
        pointerY = (event.clientY - bounds.top) / Math.max(1, bounds.height) - .5;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });
      let frame = 0;
      const started = performance.now();
      const animate = (now: number) => {
        const elapsed = (now - started) / 1000;
        resize();
        objects.forEach((item, index) => {
          const angle = item.phase + elapsed * item.speed * (index % 2 ? 1 : -1);
          item.mesh.position.x = Math.cos(angle) * item.radius + pointerX * (1 + index % 3);
          item.mesh.position.y = Math.sin(angle * 1.37) * item.radius * .48 - pointerY * (1 + index % 2);
          item.mesh.rotation.x += .002 + index % 4 * .001;
          item.mesh.rotation.y += .003 + index % 3 * .0015;
        });
        camera.position.x += (pointerX * .8 - camera.position.x) * .035;
        camera.position.y += (-pointerY * .55 - camera.position.y) * .035;
        camera.lookAt(0, 0, -1);
        renderer.render(scene, camera);
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      dispose = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener('pointermove', onPointer);
        objects.forEach(item => { item.mesh.geometry.dispose(); (item.mesh.material as Material).dispose(); });
        renderer.dispose();
      };
    });

    return () => { cancelled = true; dispose(); };
  }, [gameId]);

  if (gameId === 'fishing') return null;
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />;
};

export default GameAtmosphere3D;
