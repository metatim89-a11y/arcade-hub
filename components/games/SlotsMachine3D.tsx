import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

type Reel = { symbols: string[]; spinning: boolean };

const symbolCanvas = (symbol: string) => {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 220;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 256, 0); gradient.addColorStop(0, '#c5c0ca'); gradient.addColorStop(.28, '#fff'); gradient.addColorStop(.7, '#f8f4fa'); gradient.addColorStop(1, '#aaa3b0');
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 220);
  context.strokeStyle = '#8b7b92'; context.lineWidth = 6; context.strokeRect(3, 3, 250, 214);
  context.font = '132px serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(symbol, 128, 116);
  return canvas;
};

const dispose = (root: Object3D) => root.traverse((child) => {
  const mesh = child as Mesh; mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
});

const SlotsMachine3D: React.FC<{ reels: Reel[]; winningPositions: string[]; anticipation: boolean }> = ({ reels, winningPositions, anticipation }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ reels, winningPositions, anticipation }); stateRef.current = { reels, winningPositions, anticipation };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(37, 1, .1, 40); camera.position.set(0, .3, 12); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xf4dfff, 0x07040d, 2.2)); const key = new THREE.DirectionalLight(0xffffff, 4.8); key.position.set(-4, 7, 8); key.castShadow = true; scene.add(key);
      const pink = new THREE.PointLight(0xec50ff, 35, 18); pink.position.set(4, 1, 5); scene.add(pink);
      const machine = new THREE.Group(); scene.add(machine);
      const shell = new THREE.MeshStandardMaterial({ color: 0x321542, metalness: .78, roughness: .2, emissive: 0x260b36, emissiveIntensity: .35 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xffc84c, metalness: .8, roughness: .18, emissive: 0x8d4a05, emissiveIntensity: .18 });
      const back = new THREE.Mesh(new THREE.BoxGeometry(9.8, 6.8, .75), shell); back.position.z = -.55; back.castShadow = true; machine.add(back);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(8.9, 5.65, .38), new THREE.MeshStandardMaterial({ color: 0x08060c, metalness: .34, roughness: .25 })); screen.position.z = .05; machine.add(screen);
      [[0, 3.15, 9.65, .32], [0, -3.15, 9.65, .32], [-4.65, 0, .32, 6.15], [4.65, 0, .32, 6.15]].forEach(([x, y, width, height]) => { const trim = new THREE.Mesh(new THREE.BoxGeometry(width, height, .42), gold); trim.position.set(x, y, .42); machine.add(trim); });
      const reelGroups: InstanceType<typeof THREE.Group>[] = [];
      for (let reelIndex = 0; reelIndex < 5; reelIndex += 1) {
        const group = new THREE.Group(); group.position.x = (reelIndex - 2) * 1.72; machine.add(group); reelGroups.push(group);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 1.42, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8d4dc, metalness: .22, roughness: .43 })); drum.rotation.z = Math.PI / 2; drum.position.z = -.08; group.add(drum);
      }
      const lights: Mesh[] = [];
      for (let index = 0; index < 22; index += 1) {
        const x = -4.35 + (index % 11) * .87; const y = index < 11 ? 2.86 : -2.86;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(.105, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff5ba7, emissive: 0xff2f8b, emissiveIntensity: 1.2 })); bulb.position.set(x, y, .72); machine.add(bulb); lights.push(bulb);
      }
      const symbolMeshes = new Map<string, Mesh>(); let signature = '';
      const rebuildSymbols = () => {
        symbolMeshes.forEach((mesh) => { mesh.parent?.remove(mesh); dispose(mesh); }); symbolMeshes.clear();
        stateRef.current.reels.forEach((reel, reelIndex) => {
          const final = reel.symbols.slice(-3);
          final.forEach((symbol, row) => {
            const texture = new THREE.CanvasTexture(symbolCanvas(symbol)); texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .38, emissive: 0x000000 });
            const card = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.62, .12), material);
            card.position.set(0, 1.68 - row * 1.68, 1.42); card.userData.row = row; card.userData.baseY = card.position.y; card.castShadow = true;
            reelGroups[reelIndex].add(card); symbolMeshes.set(`${reelIndex}-${row}`, card);
          });
        });
      };
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frame = 0;
      const animate = (now: number) => {
        const live = stateRef.current; const next = live.reels.map((reel) => `${reel.symbols.slice(-3).join('')}:${reel.spinning}`).join('|'); if (next !== signature) { signature = next; rebuildSymbols(); }
        live.reels.forEach((reel, reelIndex) => {
          reelGroups[reelIndex].rotation.x += reel.spinning ? .22 + reelIndex * .012 : reelGroups[reelIndex].rotation.x * -.16;
          symbolMeshes.forEach((mesh, key) => {
            if (!key.startsWith(`${reelIndex}-`)) return;
            const row = Number(mesh.userData.row); const winning = live.winningPositions.includes(`${reelIndex}-${row}`);
            const material = mesh.material as InstanceType<typeof THREE.MeshStandardMaterial>; material.emissive.setHex(winning ? 0xffc928 : 0x000000); material.emissiveIntensity = winning ? .75 + Math.sin(now * .012) * .25 : 0;
            mesh.scale.setScalar(winning ? 1 + Math.sin(now * .01) * .045 : 1);
          });
        });
        lights.forEach((bulb, index) => { const material = bulb.material as InstanceType<typeof THREE.MeshStandardMaterial>; material.emissiveIntensity = (live.anticipation ? 2.2 : 1.05) + Math.sin(now * (live.anticipation ? .02 : .006) + index) * .65; });
        machine.rotation.y = Math.sin(now * .00025) * .012; renderer.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);
  return <canvas ref={canvasRef} className="h-full w-full" aria-label="3D Volt Vault slot machine" />;
};

export default SlotsMachine3D;
