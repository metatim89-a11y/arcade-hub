import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

type PlayingCard = { suit: string; rank: string; isHidden?: boolean };
type MemoryCard = { id: number; symbol: string; isFlipped: boolean; isMatched: boolean };

const cardCanvas = (rank: string, suit: string, hidden = false) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 356;
  const context = canvas.getContext('2d')!;
  context.fillStyle = hidden ? '#183f89' : '#f7f4ea';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 12;
  context.strokeStyle = hidden ? '#76b5ff' : '#d2c8ae';
  context.strokeRect(8, 8, 240, 340);
  if (hidden) {
    context.strokeStyle = '#9dcbff'; context.lineWidth = 3;
    for (let x = -340; x < 300; x += 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 356, 356); context.stroke(); }
    context.fillStyle = '#eef7ff'; context.font = 'bold 54px sans-serif'; context.textAlign = 'center'; context.fillText('AH', 128, 198);
  } else {
    const red = suit === '♥' || suit === '♦';
    context.fillStyle = red ? '#d6283d' : '#171922';
    context.textAlign = 'left'; context.font = 'bold 54px sans-serif'; context.fillText(rank, 22, 62);
    context.font = '72px serif'; context.fillText(suit, 18, 134);
    context.textAlign = 'center'; context.font = '132px serif'; context.fillText(suit, 128, 235);
    context.save(); context.translate(234, 330); context.rotate(Math.PI); context.textAlign = 'left'; context.font = 'bold 54px sans-serif'; context.fillText(rank, 0, 0); context.restore();
  }
  return canvas;
};

const dispose = (root: Object3D) => root.traverse((child) => {
  const mesh = child as Mesh;
  mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
});

export const BlackjackTable3D: React.FC<{ dealerHand: PlayingCard[]; playerHand: PlayingCard[] }> = ({ dealerHand, playerHand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ dealerHand, playerHand });
  stateRef.current = { dealerHand, playerHand };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, .1, 40); camera.position.set(0, 9.7, 4.9); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xd8f5e4, 0x090e0c, 2.3));
      const key = new THREE.DirectionalLight(0xfff1cf, 5); key.position.set(-4, 8, 5); key.castShadow = true; scene.add(key);
      const table = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.3, .5, 64), new THREE.MeshStandardMaterial({ color: 0x075735, roughness: .62, metalness: .08 }));
      table.scale.z = .68; table.position.y = -.35; table.receiveShadow = true; scene.add(table);
      const rail = new THREE.Mesh(new THREE.TorusGeometry(4.9, .28, 14, 64), new THREE.MeshStandardMaterial({ color: 0x512d18, roughness: .3, metalness: .25 }));
      rail.rotation.x = Math.PI / 2; rail.scale.y = .68; rail.position.y = -.04; scene.add(rail);
      const cardRoot = new THREE.Group(); scene.add(cardRoot);
      let signature = '';
      const rebuild = (now: number) => {
        dispose(cardRoot); cardRoot.clear();
        const addHand = (hand: PlayingCard[], z: number) => hand.forEach((card, index) => {
          const face = new THREE.CanvasTexture(cardCanvas(card.rank, card.suit, !!card.isHidden)); face.colorSpace = THREE.SRGBColorSpace;
          const back = new THREE.CanvasTexture(cardCanvas('', '', true)); back.colorSpace = THREE.SRGBColorSpace;
          const edge = new THREE.MeshStandardMaterial({ color: 0xd7d1bf, roughness: .5 });
          const top = new THREE.MeshStandardMaterial({ map: face, roughness: .42 });
          const bottom = new THREE.MeshStandardMaterial({ map: back, roughness: .45 });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, .075, 1.68), [edge, edge, top, bottom, edge, edge]);
          mesh.position.set((index - (hand.length - 1) / 2) * .88, 2.8 + index * .08, z + index * .08);
          mesh.rotation.y = (index - (hand.length - 1) / 2) * -.055;
          mesh.userData.targetY = .12 + index * .018; mesh.userData.birth = now + index * 90; mesh.castShadow = true;
          cardRoot.add(mesh);
        });
        addHand(stateRef.current.dealerHand, -1.65); addHand(stateRef.current.playerHand, 1.45);
      };
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); });
      observer.observe(canvas);
      let frame = 0;
      const animate = (now: number) => {
        const next = JSON.stringify(stateRef.current); if (next !== signature) { signature = next; rebuild(now); }
        cardRoot.children.forEach((card) => { const age = Math.max(0, now - Number(card.userData.birth)); const progress = Math.min(1, age / 520); const eased = 1 - Math.pow(1 - progress, 3); card.position.y = 2.8 * (1 - eased) + Number(card.userData.targetY); card.rotation.z = (1 - eased) * .22; });
        renderer.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);
  return <canvas ref={canvasRef} className="h-full w-full" aria-label="3D Blackjack table" />;
};

export const MemoryCards3D: React.FC<{ cards: MemoryCard[]; disabled: boolean; onCardClick: (id: number) => void }> = ({ cards, disabled, onCardClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ cards, disabled, onCardClick }); stateRef.current = { cards, disabled, onCardClick };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(39, 1, .1, 40); camera.position.set(0, 10.8, 3.4); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xdbeeff, 0x11101d, 2.5)); const light = new THREE.DirectionalLight(0xffffff, 4.5); light.position.set(-4, 8, 5); light.castShadow = true; scene.add(light);
      const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, .32, 7.5), new THREE.MeshStandardMaterial({ color: 0x171c34, metalness: .42, roughness: .32 })); base.position.y = -.28; base.receiveShadow = true; scene.add(base);
      const meshes = new Map<number, Mesh>(); const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let hovered = -1; let signature = '';
      const rebuild = () => {
        meshes.forEach((mesh) => { scene.remove(mesh); dispose(mesh); }); meshes.clear();
        stateRef.current.cards.forEach((card, index) => {
          const texture = new THREE.CanvasTexture(cardCanvas(card.isFlipped ? card.symbol : '', card.isFlipped ? '' : '', !card.isFlipped)); texture.colorSpace = THREE.SRGBColorSpace;
          if (card.isFlipped) { const ctx = texture.image.getContext('2d') as CanvasRenderingContext2D; ctx.fillStyle = '#191d2b'; ctx.font = '126px serif'; ctx.textAlign = 'center'; ctx.fillText(card.symbol, 128, 220); texture.needsUpdate = true; }
          const edge = new THREE.MeshStandardMaterial({ color: card.isMatched ? 0x39dc7e : 0xdad7ce, roughness: .38 });
          const face = new THREE.MeshStandardMaterial({ map: texture, emissive: card.isMatched ? 0x28c968 : 0x000000, emissiveIntensity: .5 });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, .1, 1.72), [edge, edge, face, edge, edge, edge]);
          mesh.position.set((index % 4 - 1.5) * 1.72, card.isMatched ? -.08 : .06, (Math.floor(index / 4) - 1.5) * 1.72); mesh.userData.id = card.id; mesh.userData.matched = card.isMatched; mesh.castShadow = true; scene.add(mesh); meshes.set(card.id, mesh);
        });
      };
      const pick = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects([...meshes.values()], false)[0]; hovered = hit ? Number(hit.object.userData.id) : -1; canvas.style.cursor = hovered >= 0 && !stateRef.current.disabled && !hit?.object.userData.matched ? 'pointer' : 'default'; };
      const click = (event: PointerEvent) => { pick(event); const card = stateRef.current.cards.find((item) => item.id === hovered); if (card && !stateRef.current.disabled && !card.isFlipped && !card.isMatched) stateRef.current.onCardClick(hovered); };
      canvas.addEventListener('pointermove', pick); canvas.addEventListener('pointerup', click);
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frame = 0;
      const animate = (now: number) => { const next = JSON.stringify(stateRef.current.cards); if (next !== signature) { signature = next; rebuild(); } meshes.forEach((mesh, id) => { const active = id === hovered && !stateRef.current.disabled; mesh.position.y += ((mesh.userData.matched ? -.08 : active ? .22 : .06) - mesh.position.y) * .13; if (mesh.userData.matched) mesh.rotation.y = Math.sin(now * .003 + id) * .05; }); renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointermove', pick); canvas.removeEventListener('pointerup', click); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);
  return <canvas ref={canvasRef} className="h-full w-full touch-manipulation" aria-label="Interactive 3D memory cards" />;
};
