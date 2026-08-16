import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

type Coin = { id: number; x: number; y: number; angle: number; playerCoin: boolean; kind: 'dime' | 'penny' | 'nickel' | 'quarter'; radius: number };
type Frame = { coins: Coin[]; pusherY: number; isAdvancing: boolean };

const marks = { dime: '10¢', penny: '1¢', nickel: '5¢', quarter: '25¢' };
const dispose = (root: Object3D) => root.traverse((child) => { const mesh = child as Mesh; mesh.geometry?.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []; materials.forEach((material) => { material.map?.dispose(); material.dispose(); }); });
const coinTexture = (kind: Coin['kind']) => { const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const context = canvas.getContext('2d')!; const copper = kind === 'penny'; const gradient = context.createRadialGradient(42, 34, 2, 64, 64, 62); gradient.addColorStop(0, copper ? '#ffd09d' : '#ffffff'); gradient.addColorStop(.35, copper ? '#b96c3b' : '#cdd3d6'); gradient.addColorStop(1, copper ? '#67351e' : '#697278'); context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); context.strokeStyle = copper ? '#552714' : '#555d62'; context.lineWidth = 8; context.strokeRect(4, 4, 120, 120); context.fillStyle = copper ? '#542713' : '#42494d'; context.font = 'bold 34px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(marks[kind], 64, 66); return canvas; };

const CoinPusher3D: React.FC<{ frame: Frame; bumpersActive: boolean; aimPercent: number }> = ({ frame, bumpersActive, aimPercent }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); const stateRef = useRef({ frame, bumpersActive, aimPercent }); stateRef.current = { frame, bumpersActive, aimPercent };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(39, 1, .1, 40); camera.position.set(0, 8.6, 8.2); camera.lookAt(0, 0, .6);
      scene.add(new THREE.HemisphereLight(0xe2f4ff, 0x070b10, 2.4)); const key = new THREE.DirectionalLight(0xffffff, 5); key.position.set(-4, 9, 6); key.castShadow = true; scene.add(key);
      const cabinet = new THREE.Group(); scene.add(cabinet);
      const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x233a4a, metalness: .62, roughness: .27 });
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(7.2, .32, 9.1), shelfMaterial); shelf.position.y = -.2; shelf.receiveShadow = true; cabinet.add(shelf);
      const railMaterial = new THREE.MeshStandardMaterial({ color: 0x61798a, metalness: .82, roughness: .18 });
      [-3.65, 3.65].forEach((x) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(.24, .75, 9.3), railMaterial); rail.position.set(x, .22, 0); cabinet.add(rail); });
      const back = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.3, .35), railMaterial); back.position.set(0, .78, -4.55); cabinet.add(back);
      const tray = new THREE.Mesh(new THREE.BoxGeometry(5.4, .55, 1.15), new THREE.MeshStandardMaterial({ color: 0x0b1720, metalness: .45, roughness: .32 })); tray.position.set(0, -.12, 5.05); cabinet.add(tray);
      const pusher = new THREE.Mesh(new THREE.BoxGeometry(6.75, .68, 1.05), new THREE.MeshStandardMaterial({ color: 0x8496a5, metalness: .88, roughness: .16 })); pusher.position.y = .35; pusher.castShadow = true; cabinet.add(pusher);
      const aim = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1.2, 10), new THREE.MeshBasicMaterial({ color: 0x67d6ff, transparent: true, opacity: .78 })); aim.position.y = 1.2; cabinet.add(aim);
      const coinMeshes = new Map<number, Mesh>(); const bumperMeshes: Mesh[] = [];
      [[82, 318], [160, 346], [238, 318], [112, 376], [208, 376]].forEach(([x, y]) => { const bumper = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .32, 24), new THREE.MeshStandardMaterial({ color: 0x66dfff, emissive: 0x1d9fc9, emissiveIntensity: .75, metalness: .55, roughness: .18 })); bumper.position.set((x / 320 - .5) * 7, .13, (y / 420 - .5) * 8.8); bumper.visible = false; cabinet.add(bumper); bumperMeshes.push(bumper); });
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; if (rect.width < 520) { camera.position.set(0, 11.8, 4.2); camera.lookAt(0, 0, .55); } else { camera.position.set(0, 8.6, 8.2); camera.lookAt(0, 0, .6); } camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frameId = 0; let last = performance.now();
      const animate = (now: number) => {
        const delta = Math.min(.04, (now - last) / 1000); last = now; const smooth = 1 - Math.exp(-18 * delta);
        const live = stateRef.current; const ids = new Set(live.frame.coins.map((coin) => coin.id));
        coinMeshes.forEach((coin, id) => { if (!ids.has(id)) { cabinet.remove(coin); dispose(coin); coinMeshes.delete(id); } });
        live.frame.coins.forEach((coin) => {
          let mesh = coinMeshes.get(coin.id);
          if (!mesh) { const texture = new THREE.CanvasTexture(coinTexture(coin.kind)); texture.colorSpace = THREE.SRGBColorSpace; const copper = coin.kind === 'penny'; const side = new THREE.MeshStandardMaterial({ color: copper ? 0x8a4b27 : 0x8f999e, metalness: .88, roughness: .2 }); const face = new THREE.MeshStandardMaterial({ map: texture, metalness: .55, roughness: .24, emissive: coin.playerCoin ? 0x168aca : 0x000000, emissiveIntensity: coin.playerCoin ? .5 : 0 }); mesh = new THREE.Mesh(new THREE.CylinderGeometry(coin.radius / 11 * .25, coin.radius / 11 * .25, .1, 28), [side, face, face]); mesh.castShadow = true; cabinet.add(mesh); coinMeshes.set(coin.id, mesh); }
          const targetX = (coin.x / 320 - .5) * 7; const targetY = .08 + (coin.playerCoin ? .05 : 0); const targetZ = (coin.y / 420 - .5) * 8.8;
          mesh.position.x += (targetX - mesh.position.x) * smooth; mesh.position.y += (targetY - mesh.position.y) * smooth; mesh.position.z += (targetZ - mesh.position.z) * smooth; mesh.rotation.y += (coin.angle * Math.PI / 180 - mesh.rotation.y) * smooth;
        });
        pusher.position.z += (((live.frame.pusherY / 420 - .5) * 8.8) - pusher.position.z) * smooth;
        aim.position.x += (((live.aimPercent / 100 - .5) * 6.2) - aim.position.x) * smooth; aim.position.z = -3.75; aim.material instanceof THREE.MeshBasicMaterial && (aim.material.opacity = .55 + Math.sin(now * .008) * .25);
        bumperMeshes.forEach((bumper, index) => { bumper.visible = live.bumpersActive; bumper.scale.setScalar(1 + Math.sin(now * .012 + index) * .08); });
        camera.position.x = Math.sin(now * .00022) * .08; camera.lookAt(0, 0, .6); renderer.render(scene, camera); frameId = requestAnimationFrame(animate);
      };
      frameId = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frameId); observer.disconnect(); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);
  return <canvas ref={canvasRef} className="h-full w-full" aria-label="Interactive 3D coin pusher shelf" />;
};

export default CoinPusher3D;
