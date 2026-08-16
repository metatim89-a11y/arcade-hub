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

const memoryCardCanvas = (symbol: string, flipped: boolean, matched: boolean) => {
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 388;
  const context = canvas.getContext('2d')!;
  if (!flipped) {
    const gradient = context.createRadialGradient(160, 170, 12, 160, 194, 230); gradient.addColorStop(0, '#263e73'); gradient.addColorStop(.58, '#15264e'); gradient.addColorStop(1, '#080f24'); context.fillStyle = gradient; context.fillRect(0, 0, 320, 388);
    context.strokeStyle = '#75c8ff'; context.lineWidth = 12; context.strokeRect(10, 10, 300, 368); context.strokeStyle = 'rgba(125,205,255,.28)'; context.lineWidth = 3;
    for (let x = -380; x < 340; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 388, 388); context.stroke(); }
    context.fillStyle = '#d9f4ff'; context.font = '900 64px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('RPS', 160, 184); context.font = '700 22px sans-serif'; context.fillStyle = '#72cfff'; context.fillText('MEMORY ARENA', 160, 235);
    return canvas;
  }
  const palettes: Record<string, [string, string, string]> = {
    '✊': ['#ff7b58', '#8f2433', '#3c0d1c'], '✋': ['#66d6ff', '#236cb8', '#102552'], '✌️': ['#c58cff', '#673ca4', '#291445'], '💣': ['#ff5d7d', '#55243a', '#160d19'],
    '💎': ['#6ff5ec', '#167f98', '#073549'], '👑': ['#ffe476', '#c28420', '#51300c'], '🔥': ['#ffb548', '#df4b1c', '#5b140c'], '💧': ['#72c9ff', '#286cd2', '#10275c']
  };
  const [bright, mid, dark] = palettes[symbol] ?? ['#b9e7ff', '#486c92', '#14233c']; const gradient = context.createRadialGradient(112, 88, 12, 160, 194, 245); gradient.addColorStop(0, bright); gradient.addColorStop(.48, mid); gradient.addColorStop(1, dark); context.fillStyle = gradient; context.fillRect(0, 0, 320, 388);
  context.strokeStyle = matched ? '#a7ffd4' : bright; context.lineWidth = matched ? 18 : 12; context.strokeRect(10, 10, 300, 368); context.strokeStyle = 'rgba(255,255,255,.28)'; context.lineWidth = 3; context.strokeRect(27, 27, 266, 334);
  context.shadowColor = bright; context.shadowBlur = 32; context.font = '150px serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#ffffff'; context.fillText(symbol, 160, 185); context.shadowBlur = 0; context.font = '900 22px sans-serif'; context.fillStyle = '#f4fbff'; context.fillText(matched ? 'MATCHED' : 'POWER CARD', 160, 318);
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
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(43, 1, .1, 55); camera.up.set(0, 0, -1); camera.position.set(0, 12, 0); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xdbeeff, 0x11101d, 2.5)); const light = new THREE.DirectionalLight(0xffffff, 4.5); light.position.set(-4, 8, 5); light.castShadow = true; scene.add(light);
      const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, .32, 7.5), new THREE.MeshStandardMaterial({ color: 0x171c34, metalness: .42, roughness: .32 })); base.position.y = -.28; base.receiveShadow = true; scene.add(base);
      const meshes = new Map<number, Mesh>(); const previousStates = new Map<number, string>(); const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let hovered = -1; let signature = '';
      const rebuild = () => {
        meshes.forEach((mesh) => { scene.remove(mesh); dispose(mesh); }); meshes.clear();
        stateRef.current.cards.forEach((card, index) => {
          const state = `${card.isFlipped}:${card.isMatched}`; const changed = previousStates.has(card.id) && previousStates.get(card.id) !== state; previousStates.set(card.id, state);
          const texture = new THREE.CanvasTexture(memoryCardCanvas(card.symbol, card.isFlipped, card.isMatched)); texture.colorSpace = THREE.SRGBColorSpace;
          const edge = new THREE.MeshStandardMaterial({ color: card.isMatched ? 0x4af0a0 : card.isFlipped ? 0x8abbd4 : 0x4a73a7, roughness: .27, metalness: .48 });
          const face = new THREE.MeshStandardMaterial({ map: texture, roughness: .26, metalness: .08, emissive: card.isMatched ? 0x28c968 : 0x0b1c38, emissiveIntensity: card.isMatched ? .72 : .16 });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, .1, 1.72), [edge, edge, face, edge, edge, edge]);
          mesh.position.set((index % 4 - 1.5) * 1.72, card.isMatched ? -.08 : .06, (Math.floor(index / 4) - 1.5) * 1.72); mesh.userData.id = card.id; mesh.userData.matched = card.isMatched; mesh.userData.flipBirth = changed ? performance.now() : 0; mesh.rotation.z = changed ? Math.PI : 0; mesh.castShadow = true;
          if (card.isMatched) { const halo = new THREE.Mesh(new THREE.RingGeometry(.58, .9, 32), new THREE.MeshBasicMaterial({ color: 0x51f1a5, transparent: true, opacity: .36, side: THREE.DoubleSide, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = -.09; mesh.add(halo); }
          scene.add(mesh); meshes.set(card.id, mesh);
        });
      };
      const pick = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects([...meshes.values()], false)[0]; hovered = hit ? Number(hit.object.userData.id) : -1; canvas.style.cursor = hovered >= 0 && !stateRef.current.disabled && !hit?.object.userData.matched ? 'pointer' : 'default'; };
      const click = (event: PointerEvent) => { pick(event); const card = stateRef.current.cards.find((item) => item.id === hovered); if (card && !stateRef.current.disabled && !card.isFlipped && !card.isMatched) stateRef.current.onCardClick(hovered); };
      canvas.style.touchAction = 'none'; canvas.addEventListener('pointermove', pick); canvas.addEventListener('pointerdown', click);
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; const requiredHeight = Math.max(8.2, 8.2 / camera.aspect); camera.position.y = requiredHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frame = 0; let last = performance.now();
      const animate = (now: number) => { const delta = Math.min(.04, (now - last) / 1000); last = now; const smooth = 1 - Math.exp(-8.5 * delta); const next = JSON.stringify(stateRef.current.cards); if (next !== signature) { signature = next; rebuild(); } meshes.forEach((mesh, id) => { const active = id === hovered && !stateRef.current.disabled; mesh.position.y += ((mesh.userData.matched ? -.08 : active ? .22 : .06) - mesh.position.y) * smooth; const flipAge = Number(mesh.userData.flipBirth) ? Math.min(1, (now - Number(mesh.userData.flipBirth)) / 430) : 1; mesh.rotation.z = Math.PI * Math.pow(1 - flipAge, 3); if (mesh.userData.matched) { mesh.rotation.y = Math.sin(now * .003 + id) * .05; const halo = mesh.children[0] as Mesh | undefined; if (halo) { halo.rotation.z = now * .0015 + id; (halo.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = .25 + Math.sin(now * .008 + id) * .12; } } }); renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointermove', pick); canvas.removeEventListener('pointerdown', click); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);
  return <canvas ref={canvasRef} className="h-full w-full touch-manipulation" aria-label="Interactive 3D memory cards" />;
};

type PokerCard = { id: string; suit: string; rank: string };
type PokerPlayer = { id: number; hand: PokerCard[]; isHuman: boolean; folded: boolean; bet: number };

export const PokerTable3D: React.FC<{ players: PokerPlayer[]; community: PokerCard[]; showdown: boolean }> = ({ players, community, showdown }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ players, community, showdown }); stateRef.current = { players, community, showdown };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(38, 1, .1, 50); camera.position.set(0, 10.7, 4.2); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xe2f8e8, 0x090d0b, 2.4)); const key = new THREE.DirectionalLight(0xffecc4, 4.8); key.position.set(-5, 9, 5); key.castShadow = true; scene.add(key);
      const felt = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.65, .5, 64), new THREE.MeshStandardMaterial({ color: 0x075c37, roughness: .58, metalness: .06 })); felt.scale.z = .72; felt.position.y = -.32; felt.receiveShadow = true; scene.add(felt);
      const rail = new THREE.Mesh(new THREE.TorusGeometry(5.25, .34, 14, 64), new THREE.MeshStandardMaterial({ color: 0x5a341c, roughness: .31, metalness: .28 })); rail.rotation.x = Math.PI / 2; rail.scale.y = .72; rail.position.y = -.02; scene.add(rail);
      const pieces = new THREE.Group(); scene.add(pieces); let signature = '';
      const makeCard = (card: PokerCard, hidden: boolean, x: number, z: number, rotation: number, delay: number) => {
        const texture = new THREE.CanvasTexture(cardCanvas(card.rank, card.suit, hidden)); texture.colorSpace = THREE.SRGBColorSpace;
        const edge = new THREE.MeshStandardMaterial({ color: 0xd8d4ca, roughness: .42 }); const face = new THREE.MeshStandardMaterial({ map: texture, roughness: .38 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(.78, .07, 1.1), [edge, edge, face, edge, edge, edge]); mesh.position.set(x, 2.7 + delay * .001, z); mesh.rotation.y = rotation; mesh.userData.targetY = .09; mesh.userData.birth = performance.now() + delay; mesh.castShadow = true; pieces.add(mesh);
      };
      const rebuild = () => {
        dispose(pieces); pieces.clear();
        stateRef.current.community.forEach((card, index) => makeCard(card, false, (index - 2) * .9, 0, 0, index * 70));
        const seats: Array<[number, number, number]> = [[0, 3.15, 0], [-4.25, 0, Math.PI / 2], [0, -3.15, Math.PI], [4.25, 0, -Math.PI / 2]];
        stateRef.current.players.forEach((player, playerIndex) => {
          const [baseX, baseZ, rotation] = seats[playerIndex] ?? seats[0];
          player.hand.forEach((card, cardIndex) => {
            const horizontal = playerIndex === 1 || playerIndex === 3;
            const x = baseX + (horizontal ? 0 : (cardIndex - .5) * .56);
            const z = baseZ + (horizontal ? (cardIndex - .5) * .56 : 0);
            makeCard(card, !(stateRef.current.showdown || player.isHuman) || player.folded, x, z, rotation, playerIndex * 110 + cardIndex * 70);
          });
          for (let chip = 0; chip < Math.min(8, Math.ceil(player.bet / 20)); chip += 1) {
            const token = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .055, 24), new THREE.MeshStandardMaterial({ color: chip % 2 ? 0xe44b5f : 0xf4d45c, metalness: .45, roughness: .28 }));
            token.position.set(baseX * .62 + (chip % 3) * .12, .05 + Math.floor(chip / 3) * .06, baseZ * .62); pieces.add(token);
          }
        });
      };
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frame = 0;
      const animate = (now: number) => { const next = JSON.stringify(stateRef.current); if (next !== signature) { signature = next; rebuild(); } pieces.children.forEach((piece) => { if (piece.userData.targetY === undefined) return; const progress = Math.min(1, Math.max(0, (now - Number(piece.userData.birth)) / 420)); const eased = 1 - Math.pow(1 - progress, 3); piece.position.y = 2.7 * (1 - eased) + Number(piece.userData.targetY); piece.rotation.z = (1 - eased) * .22; }); renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);
  return <canvas ref={canvasRef} className="h-full w-full" aria-label="3D Texas Hold'em table" />;
};
