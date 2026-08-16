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

const SlotsMachine3D: React.FC<{
  reels: Reel[];
  winningPositions: string[];
  anticipation: boolean;
  theme: 'base' | 'power' | 'free';
  disabled: boolean;
  onSpin: () => void;
}> = ({ reels, winningPositions, anticipation, theme, disabled, onSpin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ reels, winningPositions, anticipation, theme, disabled, onSpin }); stateRef.current = { reels, winningPositions, anticipation, theme, disabled, onSpin };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(37, 1, .1, 40); camera.position.set(0, .45, 12); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xf4dfff, 0x07040d, 2.2)); const key = new THREE.DirectionalLight(0xffffff, 4.8); key.position.set(-4, 7, 8); key.castShadow = true; scene.add(key);
      const pink = new THREE.PointLight(0xec50ff, 35, 18); pink.position.set(4, 1, 5); scene.add(pink);
      const machine = new THREE.Group(); scene.add(machine);
      const shell = new THREE.MeshStandardMaterial({ color: 0x321542, metalness: .78, roughness: .2, emissive: 0x260b36, emissiveIntensity: .35 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xffc84c, metalness: .8, roughness: .18, emissive: 0x8d4a05, emissiveIntensity: .18 });
      const back = new THREE.Mesh(new THREE.BoxGeometry(9.8, 6.8, .75), shell); back.position.z = -.55; back.castShadow = true; machine.add(back);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(8.9, 5.65, .38), new THREE.MeshStandardMaterial({ color: 0x08060c, metalness: .34, roughness: .25 })); screen.position.z = .05; machine.add(screen);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.1, 4.1), shell); floor.position.set(0, -4.05, -.15); floor.rotation.x = -.08; floor.castShadow = true; floor.receiveShadow = true; machine.add(floor);
      [-4.92, 4.92].forEach((x) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(.55, 7.2, 1.15), shell); pillar.position.set(x, -.15, -.12); pillar.castShadow = true; machine.add(pillar);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(.43, 24, 14), gold); cap.position.set(x, 3.43, .12); machine.add(cap);
      });
      [[0, 3.15, 9.65, .32], [0, -3.15, 9.65, .32], [-4.65, 0, .32, 6.15], [4.65, 0, .32, 6.15]].forEach(([x, y, width, height]) => { const trim = new THREE.Mesh(new THREE.BoxGeometry(width, height, .42), gold); trim.position.set(x, y, .42); machine.add(trim); });
      const reelGroups: InstanceType<typeof THREE.Group>[] = []; const drums: Mesh[] = [];
      for (let reelIndex = 0; reelIndex < 5; reelIndex += 1) {
        const group = new THREE.Group(); group.position.x = (reelIndex - 2) * 1.72; machine.add(group); reelGroups.push(group);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 1.42, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8d4dc, metalness: .22, roughness: .43 })); drum.rotation.z = Math.PI / 2; drum.position.z = -.08; group.add(drum); drums.push(drum);
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 1.65, 18), gold); axle.rotation.z = Math.PI / 2; group.add(axle);
      }
      const glass = new THREE.Mesh(new THREE.BoxGeometry(8.78, 5.45, .035), new THREE.MeshPhysicalMaterial({ color: 0xb98cff, transparent: true, opacity: .1, transmission: .45, roughness: .08, metalness: .08 })); glass.position.z = 1.58; machine.add(glass);
      const paylines: Mesh[] = [];
      [1.68, 0, -1.68].forEach((y) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(8.45, .035, .035), new THREE.MeshBasicMaterial({ color: 0xffdf62, transparent: true, opacity: 0, depthTest: false }));
        line.position.set(0, y, 1.64); line.renderOrder = 20; machine.add(line); paylines.push(line);
      });
      const tray = new THREE.Mesh(new THREE.BoxGeometry(5.2, .46, 1.25), new THREE.MeshStandardMaterial({ color: 0x0a0710, metalness: .65, roughness: .22 }));
      tray.position.set(-.55, -3.7, .72); tray.rotation.x = -.16; machine.add(tray);
      const marqueeTexture = new THREE.CanvasTexture(symbolCanvas('⚡')); marqueeTexture.colorSpace = THREE.SRGBColorSpace;
      const marquee = new THREE.Mesh(new THREE.BoxGeometry(3.1, .72, .2), new THREE.MeshStandardMaterial({ map: marqueeTexture, emissive: 0x9d2bd1, emissiveIntensity: .32 })); marquee.position.set(0, 3.65, .2); machine.add(marquee);
      const lever = new THREE.Group(); lever.position.set(5.05, .65, .05); machine.add(lever);
      const leverStem = new THREE.Mesh(new THREE.CylinderGeometry(.1, .13, 2.05, 14), gold); leverStem.position.y = .85; lever.add(leverStem);
      const leverBall = new THREE.Mesh(new THREE.SphereGeometry(.34, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff3f6f, metalness: .42, roughness: .2, emissive: 0x8c0b31, emissiveIntensity: .25 })); leverBall.position.y = 1.92; leverBall.userData.action = 'spin'; lever.add(leverBall);
      const spinPad = new THREE.Mesh(new THREE.CylinderGeometry(.62, .7, .2, 30), new THREE.MeshStandardMaterial({ color: 0xffd34f, metalness: .55, roughness: .22, emissive: 0xa45a05, emissiveIntensity: .3 })); spinPad.rotation.x = Math.PI / 2; spinPad.position.set(3.55, -3.72, .65); spinPad.userData.action = 'spin'; machine.add(spinPad);
      const lights: Mesh[] = [];
      for (let index = 0; index < 22; index += 1) {
        const x = -4.35 + (index % 11) * .87; const y = index < 11 ? 2.86 : -2.86;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(.105, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff5ba7, emissive: 0xff2f8b, emissiveIntensity: 1.2 })); bulb.position.set(x, y, .72); machine.add(bulb); lights.push(bulb);
      }
      const winCoins: Mesh[] = [];
      for (let index = 0; index < 18; index += 1) {
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .035, 16), gold); coin.rotation.x = Math.PI / 2; coin.visible = false; machine.add(coin); winCoins.push(coin);
      }
      const symbolMeshes = new Map<string, Mesh>(); let signature = ''; let pullUntil = 0; let winBurstAt = 0; let previousWinSignature = ''; const pointerTarget = new THREE.Vector2();
      const reelVelocity = Array(5).fill(0) as number[]; const reelPhase = Array(5).fill(0) as number[]; const wasSpinning = Array(5).fill(false) as boolean[]; const landingAt = Array(5).fill(0) as number[];
      const rebuildSymbols = () => {
        symbolMeshes.forEach((mesh) => { mesh.parent?.remove(mesh); dispose(mesh); }); symbolMeshes.clear();
        stateRef.current.reels.forEach((reel, reelIndex) => {
          const final = reel.symbols.slice(-3);
          final.forEach((symbol, row) => {
            const texture = new THREE.CanvasTexture(symbolCanvas(symbol)); texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .38, emissive: 0x000000 });
            const card = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.62, .12), material);
            card.position.set(0, 1.68 - row * 1.68, 1.42); card.userData.row = row; card.castShadow = true;
            reelGroups[reelIndex].add(card); symbolMeshes.set(`${reelIndex}-${row}`, card);
          });
        });
      };
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }); observer.observe(canvas);
      const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
      const pick = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); pointerTarget.copy(pointer); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects([leverBall, spinPad], false)[0]; canvas.style.cursor = hit && !stateRef.current.disabled ? 'pointer' : 'default'; return hit; };
      const activate = (event: PointerEvent) => { const hit = pick(event); if (!hit || stateRef.current.disabled) return; pullUntil = performance.now() + 520; stateRef.current.onSpin(); };
      canvas.style.touchAction = 'none'; canvas.addEventListener('pointermove', pick); canvas.addEventListener('pointerdown', activate);
      let frame = 0; let last = performance.now();
      const animate = (now: number) => {
        const delta = Math.min(.04, (now - last) / 1000); last = now; const smooth = 1 - Math.exp(-8 * delta); const settle = 1 - Math.exp(-16 * delta);
        const live = stateRef.current; const next = live.reels.map((reel) => reel.symbols.slice(-3).join('')).join('|'); if (next !== signature) { signature = next; rebuildSymbols(); }
        const winSignature = live.winningPositions.join('|');
        if (winSignature && winSignature !== previousWinSignature) winBurstAt = now;
        previousWinSignature = winSignature;
        const spinningCount = live.reels.filter((reel) => reel.spinning).length;
        live.reels.forEach((reel, reelIndex) => {
          if (wasSpinning[reelIndex] && !reel.spinning) landingAt[reelIndex] = now;
          wasSpinning[reelIndex] = reel.spinning;
          const speedTarget = reel.spinning ? 22 + reelIndex * 1.25 : 0;
          reelVelocity[reelIndex] += (speedTarget - reelVelocity[reelIndex]) * (1 - Math.exp(-(reel.spinning ? 5.5 : 11) * delta));
          reelPhase[reelIndex] += reelVelocity[reelIndex] * delta * .34;
          drums[reelIndex].rotation.x += delta * (reelVelocity[reelIndex] + .18);
          const landingAge = (now - landingAt[reelIndex]) / 1000;
          reelGroups[reelIndex].position.y = landingAge >= 0 && landingAge < .65 ? Math.sin(landingAge * Math.PI * 8) * Math.exp(-landingAge * 7) * .2 : 0;
          symbolMeshes.forEach((mesh, key) => {
            if (!key.startsWith(`${reelIndex}-`)) return;
            const row = Number(mesh.userData.row); const winning = live.winningPositions.includes(`${reelIndex}-${row}`);
            const material = mesh.material as InstanceType<typeof THREE.MeshStandardMaterial>; material.emissive.setHex(winning ? 0xffc928 : 0x000000); material.emissiveIntensity = winning ? .75 + Math.sin(now * .012) * .25 : 0;
            if (reel.spinning) {
              const cycle = ((row + reelPhase[reelIndex]) % 3 + 3) % 3;
              const angle = (cycle - 1) * .79;
              mesh.position.y = -Math.sin(angle) * 2.32; mesh.position.z = Math.cos(angle) * 1.45;
              mesh.rotation.x = angle; mesh.scale.set(1, .88 + Math.min(.08, reelVelocity[reelIndex] * .003), 1); material.opacity = .76 + Math.min(.16, reelVelocity[reelIndex] * .006); material.transparent = true;
            } else {
              mesh.position.y += ((1.68 - row * 1.68) - mesh.position.y) * settle; mesh.position.z += (1.42 - mesh.position.z) * settle;
              mesh.rotation.x *= 1 - settle; mesh.scale.setScalar(winning ? 1 + Math.sin(now * .01) * .045 : 1); material.opacity = 1; material.transparent = false;
            }
          });
        });
        const themeColor = live.theme === 'power' ? 0xffb31f : live.theme === 'free' ? 0x38e6c4 : 0xec50ff;
        pink.color.setHex(themeColor); (marquee.material as InstanceType<typeof THREE.MeshStandardMaterial>).emissive.setHex(themeColor);
        lights.forEach((bulb, index) => { const material = bulb.material as InstanceType<typeof THREE.MeshStandardMaterial>; material.color.setHex(themeColor); material.emissive.setHex(themeColor); material.emissiveIntensity = (live.anticipation ? 2.2 : 1.05) + Math.sin(now * (live.anticipation ? .02 : .006) + index) * .65; });
        paylines.forEach((line, row) => { const material = line.material as InstanceType<typeof THREE.MeshBasicMaterial>; const active = live.winningPositions.some((position) => position.endsWith(`-${row}`)); material.color.setHex(themeColor); material.opacity = active ? .42 + Math.sin(now * .018 + row) * .3 : live.anticipation ? .08 + Math.sin(now * .012 + row) * .05 : 0; line.scale.x = active ? .98 + Math.sin(now * .01) * .02 : 1; });
        const pullProgress = Math.max(0, Math.min(1, (pullUntil - now) / 520)); lever.rotation.z = -Math.sin(pullProgress * Math.PI) * .72;
        spinPad.scale.setScalar(live.disabled ? .88 : 1 + Math.sin(now * .004) * .035);
        (spinPad.material as InstanceType<typeof THREE.MeshStandardMaterial>).emissiveIntensity = live.disabled ? .08 : .42 + Math.sin(now * .006) * .16;
        winCoins.forEach((coin, index) => {
          const age = (now - winBurstAt) / 1000 - index * .025; coin.visible = Boolean(winSignature) && age > 0 && age < 1.45;
          if (!coin.visible) return;
          const lane = (index % 9) - 4; coin.position.set(lane * .72, -2.5 + age * 6.1 - age * age * 3.4, 2 + Math.sin(index * 2.3) * .45); coin.rotation.x += .15; coin.rotation.y += .2;
        });
        machine.rotation.y += (pointerTarget.x * .045 + Math.sin(now * .00025) * .012 - machine.rotation.y) * smooth;
        machine.rotation.x += (-pointerTarget.y * .018 - machine.rotation.x) * smooth;
        machine.position.x = spinningCount ? Math.sin(now * .055) * .018 * spinningCount : 0;
        camera.position.z += ((live.anticipation ? 11.25 : 12) - camera.position.z) * smooth; camera.lookAt(0, 0, 0);
        renderer.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointermove', pick); canvas.removeEventListener('pointerdown', activate); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);
  return <canvas ref={canvasRef} className="h-full w-full" aria-label="3D Volt Vault slot machine" />;
};

export default SlotsMachine3D;
