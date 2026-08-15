import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

type Segment = { color: string; label: string };

const dispose = (root: Object3D) => root.traverse((child) => {
  const mesh = child as Mesh; mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
});

const labelTexture = (label: string) => {
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
  const context = canvas.getContext('2d')!; context.fillStyle = 'rgba(255,255,255,.9)'; context.font = 'bold 44px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(label, 80, 47);
  return canvas;
};

const SpinWheel3D: React.FC<{
  rotationRef: React.MutableRefObject<number>;
  segments: Segment[];
  winningIndex: number | null;
  spinning: boolean;
  onSpin: () => void;
}> = ({ rotationRef, segments, winningIndex, spinning, onSpin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); const stateRef = useRef({ winningIndex, spinning, onSpin }); stateRef.current = { winningIndex, spinning, onSpin };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let cancelled = false; let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(36, 1, .1, 40); camera.position.set(0, .15, 12); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xffefc9, 0x0b0b13, 2.5)); const key = new THREE.DirectionalLight(0xffffff, 5); key.position.set(-5, 7, 8); key.castShadow = true; scene.add(key);
      const wheel = new THREE.Group(); scene.add(wheel); const sliceAngle = Math.PI * 2 / segments.length;
      const wedges: Mesh[] = [];
      segments.forEach((segment, index) => {
        const start = index * sliceAngle; const end = start + sliceAngle;
        const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(Math.cos(start) * 4.25, Math.sin(start) * 4.25); shape.absarc(0, 0, 4.25, start, end, false); shape.lineTo(0, 0);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: .3, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 2 });
        const color = new THREE.Color(segment.color); const material = new THREE.MeshPhysicalMaterial({ color, roughness: .28, metalness: .42, clearcoat: .5, emissive: color, emissiveIntensity: .07 });
        const wedge = new THREE.Mesh(geometry, material); wedge.position.z = -.15; wedge.castShadow = true; wheel.add(wedge); wedges.push(wedge);
        const texture = new THREE.CanvasTexture(labelTexture(segment.label)); texture.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false })); const mid = start + sliceAngle / 2; sprite.position.set(Math.cos(mid) * 3.32, Math.sin(mid) * 3.32, .38); sprite.scale.set(.82, .46, 1); sprite.material.rotation = mid; wheel.add(sprite);
        const pin = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffe38a, emissive: 0xff9d22, emissiveIntensity: .45, metalness: .72, roughness: .2 })); pin.position.set(Math.cos(mid) * 4.08, Math.sin(mid) * 4.08, .43); wheel.add(pin);
      });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(4.42, .24, 16, 72), new THREE.MeshStandardMaterial({ color: 0xb78326, metalness: .88, roughness: .17 })); rim.position.z = .08; scene.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.72, .82, .5, 36), new THREE.MeshStandardMaterial({ color: 0xe3ba54, metalness: .9, roughness: .16 })); hub.rotation.x = Math.PI / 2; hub.position.z = .35; scene.add(hub);
      const pointerShape = new THREE.Shape(); pointerShape.moveTo(-.58, -.28); pointerShape.lineTo(.42, 0); pointerShape.lineTo(-.58, .28); pointerShape.closePath();
      const pointer = new THREE.Mesh(new THREE.ExtrudeGeometry(pointerShape, { depth: .24, bevelEnabled: true, bevelSize: .035, bevelThickness: .035 }), new THREE.MeshStandardMaterial({ color: 0xf0444d, emissive: 0x80131d, emissiveIntensity: .35, metalness: .38, roughness: .2 })); pointer.position.set(4.65, 0, .42); scene.add(pointer);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(4.28, 72), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .08, transmission: .6, roughness: .08, depthWrite: false })); glass.position.z = .52; scene.add(glass);
      const raycaster = new THREE.Raycaster(); const cursor = new THREE.Vector2();
      const pick = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); cursor.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(cursor, camera); const hit = raycaster.intersectObjects(wedges, false)[0]; canvas.style.cursor = hit && !stateRef.current.spinning ? 'pointer' : 'default'; return hit; };
      const click = (event: PointerEvent) => { if (pick(event) && !stateRef.current.spinning) stateRef.current.onSpin(); };
      canvas.addEventListener('pointermove', pick); canvas.addEventListener('pointerup', click);
      const observer = new ResizeObserver(() => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }); observer.observe(canvas);
      let frame = 0;
      const animate = (now: number) => { wheel.rotation.z = rotationRef.current; wedges.forEach((wedge, index) => { const material = wedge.material as InstanceType<typeof THREE.MeshPhysicalMaterial>; const winning = stateRef.current.winningIndex === index; material.emissiveIntensity = winning ? .72 + Math.sin(now * .012) * .28 : .07; wedge.position.z = winning ? Math.sin(now * .01) * .07 : -.15; }); pointer.rotation.z = stateRef.current.spinning ? Math.sin(rotationRef.current * segments.length) * .11 : 0; hub.rotation.y += .003; renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
      frame = requestAnimationFrame(animate);
      teardown = () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointermove', pick); canvas.removeEventListener('pointerup', click); dispose(scene); renderer.dispose(); };
    });
    return () => { cancelled = true; teardown(); };
  }, [rotationRef, segments]);
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-manipulation" aria-label="Interactive 3D prize wheel" />;
};

export default SpinWheel3D;
