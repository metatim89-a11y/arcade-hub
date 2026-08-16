import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

type PadIndex = 0 | 1 | 2 | 3;

const dispose = (root: Object3D) => root.traverse((child) => {
  const mesh = child as Mesh; mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  materials.forEach((material) => material.dispose());
});

const ColorRecall3D: React.FC<{
  activePad: PadIndex | null;
  phase: 'IDLE' | 'SHOWING' | 'INPUT' | 'GAME_OVER';
  onPad: (pad: PadIndex) => void;
}> = ({ activePad, phase, onPad }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ activePad, phase, onPad }); stateRef.current = { activePad, phase, onPad };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(40, 1, .1, 40); camera.position.set(0, 7.8, 5.2); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xdff5ff, 0x080c15, 2.5)); const key = new THREE.DirectionalLight(0xffffff, 5); key.position.set(-4, 8, 5); key.castShadow = true; scene.add(key);
      const glow = new THREE.PointLight(0x63c9ff, 20, 16); glow.position.set(0, 4, 2); scene.add(glow);
      const root = new THREE.Group(); scene.add(root);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.65, 3.82, .52, 64), new THREE.MeshStandardMaterial({ color: 0x111d2b, metalness: .68, roughness: .24 })); base.position.y = -.3; base.receiveShadow = true; root.add(base);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.34, .22, 18, 72), new THREE.MeshStandardMaterial({ color: 0x6b8193, metalness: .86, roughness: .18 })); rim.rotation.x = Math.PI / 2; rim.position.y = .08; root.add(rim);
      const colors = [0xe83d50, 0x278fe8, 0x22b968, 0xe4bd24]; const emissives = [0xff1837, 0x20a6ff, 0x19eb77, 0xffdb28];
      const positions: Array<[number, number]> = [[-1.55, -1.55], [1.55, -1.55], [-1.55, 1.55], [1.55, 1.55]];
      const pads: Mesh[] = positions.map(([x, z], index) => {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(2.75, .38, 2.75, 5, 1, 5), new THREE.MeshPhysicalMaterial({ color: colors[index], emissive: emissives[index], emissiveIntensity: .14, metalness: .32, roughness: .2, clearcoat: .82, clearcoatRoughness: .14 }));
        pad.position.set(x, .13, z); pad.userData.index = index; pad.userData.homeY = .13; pad.castShadow = true; root.add(pad); return pad;
      });
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.03, 1.13, .62, 48), new THREE.MeshStandardMaterial({ color: 0x152637, metalness: .75, roughness: .2, emissive: 0x1d5e80, emissiveIntensity: .22 })); hub.position.y = .5; hub.castShadow = true; root.add(hub);
      const hubRing = new THREE.Mesh(new THREE.TorusGeometry(.78, .09, 14, 42), new THREE.MeshStandardMaterial({ color: 0xb7d4e5, metalness: .9, roughness: .15, emissive: 0x4ca7d6, emissiveIntensity: .25 })); hubRing.rotation.x = Math.PI / 2; hubRing.position.y = .83; root.add(hubRing);
      const pulseRings = [0, 1, 2].map((index) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1 + index * .18, .025, 8, 64), new THREE.MeshBasicMaterial({ color: 0x9bddff, transparent: true, opacity: .1 })); ring.rotation.x = Math.PI / 2; ring.position.y = .02; root.add(ring); return ring; });
      const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let hovered = -1; const pointerTarget = new THREE.Vector2();
      const pick = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); pointerTarget.copy(pointer); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(pads, false)[0]; hovered = hit ? Number(hit.object.userData.index) : -1; canvas.style.cursor = hovered >= 0 && stateRef.current.phase === 'INPUT' ? 'pointer' : 'default'; };
      const press = (event: PointerEvent) => { pick(event); if (hovered >= 0 && stateRef.current.phase === 'INPUT') stateRef.current.onPad(hovered as PadIndex); };
      canvas.style.touchAction = 'none'; canvas.addEventListener('pointermove', pick); canvas.addEventListener('pointerdown', press); canvas.addEventListener('pointerleave', () => { hovered = -1; });
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.position.z = camera.aspect < .85 ? 6.7 : 5.2; camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frame = 0; let last = performance.now();
      const animate = (now: number) => {
        const delta = Math.min(.04, (now - last) / 1000); last = now; const smooth = 1 - Math.exp(-13 * delta); const cameraSmooth = 1 - Math.exp(-4 * delta); const live = stateRef.current;
        pads.forEach((pad, index) => { const active = live.activePad === index; const hover = hovered === index && live.phase === 'INPUT'; const material = pad.material as InstanceType<typeof THREE.MeshPhysicalMaterial>; const targetY = active ? .58 : hover ? .34 : Number(pad.userData.homeY); pad.position.y += (targetY - pad.position.y) * smooth; pad.rotation.x += ((active ? -.045 : hover ? -.018 : 0) - pad.rotation.x) * smooth; const targetScale = active ? 1.045 : hover ? 1.018 : 1; const scale = pad.scale.x + (targetScale - pad.scale.x) * smooth; pad.scale.setScalar(scale); material.emissiveIntensity = active ? 1.5 + Math.sin(now * .035) * .25 : hover ? .38 : .14; });
        const phaseColor = live.phase === 'GAME_OVER' ? 0xff4055 : live.phase === 'INPUT' ? 0x42e59b : live.phase === 'SHOWING' ? 0xffd557 : 0x63c9ff; glow.color.setHex(phaseColor); (hub.material as InstanceType<typeof THREE.MeshStandardMaterial>).emissive.setHex(phaseColor);
        pulseRings.forEach((ring, index) => { const cycle = (now * .00045 + index / 3) % 1; ring.scale.setScalar(.9 + cycle * .2); (ring.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = live.phase === 'SHOWING' ? (1 - cycle) * .3 : .07; });
        root.rotation.y += (pointerTarget.x * .035 - root.rotation.y) * cameraSmooth; root.rotation.x += (-pointerTarget.y * .018 - root.rotation.x) * cameraSmooth; renderer.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointermove', pick); canvas.removeEventListener('pointerdown', press); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" aria-label="Interactive 3D Color Recall controls" />;
};

export default ColorRecall3D;
