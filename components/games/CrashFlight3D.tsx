import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

type CrashPhase = 'IDLE' | 'COUNTDOWN' | 'FLYING' | 'CRASHED';

const dispose = (root: Object3D) => root.traverse((child) => {
  const mesh = child as Mesh;
  mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
});

const CrashFlight3D: React.FC<{ multiplier: number; phase: CrashPhase; cashedOut: boolean }> = ({ multiplier, phase, cashedOut }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ multiplier, phase, cashedOut });
  stateRef.current = { multiplier, phase, cashedOut };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let teardown = () => undefined;

    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      renderer.shadowMap.enabled = true;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x06111e);
      scene.fog = new THREE.FogExp2(0x071725, 0.032);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      camera.position.set(0, 4.5, 14.5);
      camera.lookAt(0, 1.1, 0);
      scene.add(new THREE.HemisphereLight(0xa9e5ff, 0x07101a, 2.25));
      const key = new THREE.DirectionalLight(0xfff1cb, 4.8);
      key.position.set(-4, 9, 8);
      key.castShadow = true;
      scene.add(key);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(42, 36, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0x0a2334, metalness: 0.3, roughness: 0.68, wireframe: true, transparent: true, opacity: 0.24 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -2.8, -6);
      scene.add(floor);
      const horizon = new THREE.GridHelper(42, 28, 0x2d7996, 0x173b50);
      horizon.position.set(0, -2.74, -6);
      const horizonMaterial = horizon.material as InstanceType<typeof THREE.Material>;
      horizonMaterial.transparent = true;
      horizonMaterial.opacity = 0.32;
      scene.add(horizon);

      const stars = new THREE.Group();
      const starGeometry = new THREE.IcosahedronGeometry(0.035, 0);
      for (let index = 0; index < 115; index += 1) {
        const star = new THREE.Mesh(starGeometry, new THREE.MeshBasicMaterial({ color: index % 8 === 0 ? 0x73dbff : 0xe8f8ff }));
        star.position.set((Math.random() - 0.5) * 31, Math.random() * 13 - 1.2, -4 - Math.random() * 24);
        star.scale.setScalar(0.45 + Math.random() * 2.1);
        stars.add(star);
      }
      scene.add(stars);

      const trailPositions = new Float32Array(54 * 3);
      const trailGeometry = new THREE.BufferGeometry();
      trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffb83d, transparent: true, opacity: 0.92 });
      const trail = new THREE.Line(trailGeometry, trailMaterial);
      scene.add(trail);

      const rocket = new THREE.Group();
      const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe8f3f8, metalness: 0.72, roughness: 0.19, clearcoat: 0.85 });
      const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xef4151, emissive: 0x7e0d1b, emissiveIntensity: 0.38, metalness: 0.48, roughness: 0.24 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 2.15, 24), bodyMaterial);
      body.rotation.z = -Math.PI / 2;
      body.castShadow = true;
      rocket.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 24), bodyMaterial);
      nose.rotation.z = -Math.PI / 2;
      nose.position.x = 1.5;
      nose.castShadow = true;
      rocket.add(nose);
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.42, 0.42, 20), new THREE.MeshStandardMaterial({ color: 0x566c78, metalness: 0.9, roughness: 0.2 }));
      engine.rotation.z = -Math.PI / 2;
      engine.position.x = -1.25;
      rocket.add(engine);
      const windowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 12), new THREE.MeshPhysicalMaterial({ color: 0x4bd7ff, emissive: 0x0d7191, emissiveIntensity: 0.75, metalness: 0.15, roughness: 0.08, transmission: 0.25 }));
      windowMesh.position.set(0.48, 0.26, 0.29);
      windowMesh.scale.z = 0.35;
      rocket.add(windowMesh);
      [-1, 1].forEach((side) => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.12, 0.72), accentMaterial);
        fin.position.set(-0.72, side * 0.43, 0);
        fin.rotation.x = side * 0.3;
        fin.castShadow = true;
        rocket.add(fin);
      });
      scene.add(rocket);

      const exhaust = new THREE.Group();
      const exhaustParticles: Mesh[] = [];
      for (let index = 0; index < 22; index += 1) {
        const particle = new THREE.Mesh(
          new THREE.SphereGeometry(0.08 + Math.random() * 0.11, 8, 6),
          new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0x5ddcff : index % 2 ? 0xffe878 : 0xff7b32, transparent: true, opacity: 0.9 })
        );
        particle.userData.seed = Math.random();
        exhaust.add(particle);
        exhaustParticles.push(particle);
      }
      scene.add(exhaust);

      const explosion = new THREE.Group();
      const explosionPieces: Mesh[] = [];
      for (let index = 0; index < 28; index += 1) {
        const piece = new THREE.Mesh(
          index % 4 === 0 ? new THREE.TetrahedronGeometry(0.16 + Math.random() * 0.16) : new THREE.SphereGeometry(0.1 + Math.random() * 0.17, 8, 6),
          new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0xfff0a8 : index % 2 ? 0xffa52f : 0xff4055, transparent: true, opacity: 1 })
        );
        piece.userData.direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5).normalize();
        piece.userData.speed = 1.3 + Math.random() * 3.5;
        explosion.add(piece);
        explosionPieces.push(piece);
      }
      const shockwave = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 10, 42), new THREE.MeshBasicMaterial({ color: 0xffcf62, transparent: true, opacity: 0.9 }));
      shockwave.rotation.x = Math.PI / 2;
      explosion.add(shockwave);
      explosion.visible = false;
      scene.add(explosion);

      let crashStartedAt = 0;
      let priorPhase: CrashPhase = 'IDLE';
      const targetPosition = new THREE.Vector3();
      const observer = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.position.z = rect.width < 520 ? 17.5 : 14.5;
        camera.updateProjectionMatrix();
      });
      observer.observe(canvas);

      let frameId = 0;
      let last = performance.now();
      const animate = (now: number) => {
        const delta = Math.min(0.04, (now - last) / 1000);
        last = now;
        const live = stateRef.current;
        const progress = Math.min(1, Math.log(Math.max(1, live.multiplier)) / Math.log(12));
        targetPosition.set(-5.2 + progress * 10.1, -1.35 + progress * 5.7 + Math.sin(progress * Math.PI) * 0.55, 0.3 - progress * 2.3);
        const smooth = 1 - Math.exp(-10 * delta);
        rocket.position.lerp(targetPosition, smooth);
        rocket.rotation.z += ((0.37 + progress * 0.2) - rocket.rotation.z) * smooth;
        rocket.rotation.y = Math.sin(now * 0.0014) * 0.055;

        for (let index = 0; index < 54; index += 1) {
          const t = index / 53;
          trailPositions[index * 3] = -6.2 + (rocket.position.x + 6.2) * t;
          trailPositions[index * 3 + 1] = -1.7 + (rocket.position.y + 1.7) * t * t;
          trailPositions[index * 3 + 2] = 0.5 + (rocket.position.z - 0.5) * t;
        }
        trailGeometry.attributes.position.needsUpdate = true;
        trailMaterial.color.set(live.cashedOut ? 0x45e0a5 : live.phase === 'CRASHED' ? 0xff4055 : 0xffbd45);
        trailMaterial.opacity = live.phase === 'IDLE' ? 0.35 : 0.92;

        exhaust.position.copy(rocket.position);
        exhaust.rotation.copy(rocket.rotation);
        exhaustParticles.forEach((particle, index) => {
          const cycle = (now * 0.0015 + particle.userData.seed + index / exhaustParticles.length) % 1;
          particle.position.set(-1.55 - cycle * 2.25, Math.sin(index * 5.2) * cycle * 0.22, Math.cos(index * 3.7) * cycle * 0.22);
          particle.scale.setScalar(1 - cycle * 0.75);
          (particle.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = (1 - cycle) * 0.85;
        });

        if (live.phase !== priorPhase) {
          if (live.phase === 'CRASHED') {
            crashStartedAt = now;
            explosion.position.copy(rocket.position);
            explosionPieces.forEach((piece) => piece.position.set(0, 0, 0));
          }
          priorPhase = live.phase;
        }
        const crashed = live.phase === 'CRASHED';
        rocket.visible = !crashed;
        exhaust.visible = !crashed && live.phase === 'FLYING';
        explosion.visible = crashed;
        if (crashed) {
          const age = Math.min(2.2, (now - crashStartedAt) / 1000);
          explosionPieces.forEach((piece) => {
            const direction = piece.userData.direction as InstanceType<typeof THREE.Vector3>;
            piece.position.copy(direction).multiplyScalar(piece.userData.speed * age);
            piece.position.y -= age * age * 0.7;
            piece.rotation.x += delta * 4;
            piece.rotation.y += delta * 5;
            (piece.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = Math.max(0, 1 - age / 2.2);
          });
          shockwave.scale.setScalar(1 + age * 4.2);
          (shockwave.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = Math.max(0, 0.9 - age * 0.55);
        }

        stars.position.x -= (live.phase === 'FLYING' ? 5.4 : 0.55) * delta;
        if (stars.position.x < -10) stars.position.x = 0;
        floor.position.z += (live.phase === 'FLYING' ? 5 : 0.4) * delta;
        if (floor.position.z > -1) floor.position.z = -6;
        horizon.position.z = floor.position.z;
        camera.position.x = Math.sin(now * 0.00035) * 0.22;
        camera.lookAt(0, 1, -0.7);
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      };
      frameId = requestAnimationFrame(animate);

      teardown = () => {
        cancelAnimationFrame(frameId);
        observer.disconnect();
        dispose(scene);
        renderer.dispose();
      };
    });

    return () => { cancelled = true; teardown(); };
  }, []);

  return <canvas ref={canvasRef} className="crash-flight-canvas" aria-label="Live 3D crash flight" />;
};

export default CrashFlight3D;
