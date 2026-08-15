import React, { useEffect, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

interface MancalaBoard3DProps {
  pits: number[];
  currentPlayer: 1 | 2;
  disabled: boolean;
  highlightedPit: number | null;
  lastMovePath: number[];
  theme: 'Classic' | 'Midnight' | 'Jungle';
  onPitClick: (index: number) => void;
}

const positionForPit = (index: number): [number, number] => {
  if (index === 13) return [-4.15, 0];
  if (index === 6) return [4.15, 0];
  if (index <= 5) return [-2.55 + index * 1.02, 1.05];
  return [2.55 - (index - 7) * 1.02, -1.05];
};

const disposeTree = (root: Object3D) => root.traverse((child) => {
  const mesh = child as Mesh;
  mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  materials.forEach((material) => material.dispose());
});

const MancalaBoard3D: React.FC<MancalaBoard3DProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(props);
  stateRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let teardown = () => undefined;
    void import('three').then((THREE) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.28;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, .1, 70);
      camera.up.set(0, 0, -1);
      camera.position.set(0, 14, 0);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xffe5bd, 0x09111c, 2.5));
      const key = new THREE.DirectionalLight(0xfff1d5, 5.4);
      key.position.set(-5, 9, 6);
      key.castShadow = true;
      scene.add(key);
      const edge = new THREE.PointLight(0x62d8ff, 24, 18);
      edge.position.set(5, 4, -3);
      scene.add(edge);

      const boardRoot = new THREE.Group();
      boardRoot.rotation.y = -.035;
      scene.add(boardRoot);
      const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x7b3517, roughness: .36, metalness: .18 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(9.8, .48, 3.55, 5, 1, 2), boardMaterial);
      board.position.y = -.2;
      board.castShadow = true;
      board.receiveShadow = true;
      boardRoot.add(board);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(10.08, .2, 3.83), new THREE.MeshStandardMaterial({ color: 0xd18a42, roughness: .28, metalness: .42 }));
      trim.position.y = -.38;
      boardRoot.add(trim);

      const pitMeshes: Mesh[] = [];
      const hitMeshes: Mesh[] = [];
      for (let index = 0; index < 14; index += 1) {
        const [x, z] = positionForPit(index);
        const store = index === 6 || index === 13;
        const pit = new THREE.Mesh(
          store ? new THREE.CapsuleGeometry(.58, 1.35, 5, 18) : new THREE.CylinderGeometry(.52, .68, .32, 32),
          new THREE.MeshStandardMaterial({ color: 0x2a130d, roughness: .58, metalness: .05, emissive: 0x000000 }),
        );
        if (store) pit.rotation.x = Math.PI / 2;
        pit.position.set(x, .05, z);
        pit.receiveShadow = true;
        boardRoot.add(pit);
        pitMeshes[index] = pit;
        const hit = new THREE.Mesh(
          store ? new THREE.BoxGeometry(1.25, 1.2, 2.65) : new THREE.CylinderGeometry(.67, .67, 1.2, 18),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        hit.position.set(x, .5, z);
        hit.userData.index = index;
        boardRoot.add(hit);
        hitMeshes.push(hit);
      }

      const stonePalette = [0xe04459, 0x4ea8e8, 0x4ecb82, 0x9d67dc, 0xf2a43b, 0xf3e2c2, 0x40c8bd];
      const stoneGroups = new Map<number, { group: InstanceType<typeof THREE.Group>; count: number }>();
      const rebuildStones = (index: number, count: number, now: number) => {
        const previous = stoneGroups.get(index);
        if (previous) {
          boardRoot.remove(previous.group);
          disposeTree(previous.group);
        }
        const group = new THREE.Group();
        const [baseX, baseZ] = positionForPit(index);
        const store = index === 6 || index === 13;
        const visibleCount = Math.min(count, 24);
        for (let stoneIndex = 0; stoneIndex < visibleCount; stoneIndex += 1) {
          const angle = stoneIndex * 2.399 + index * .73;
          const ring = Math.sqrt(stoneIndex + .5) * (store ? .12 : .105);
          const xSpread = store ? .38 : .8;
          const zSpread = store ? 1.7 : .72;
          const stone = new THREE.Mesh(
            new THREE.DodecahedronGeometry(.115 + (stoneIndex % 3) * .012, 1),
            new THREE.MeshStandardMaterial({
              color: stonePalette[(stoneIndex + index) % stonePalette.length],
              roughness: .24,
              metalness: .32,
              emissive: stonePalette[(stoneIndex + index) % stonePalette.length],
              emissiveIntensity: .08,
            }),
          );
          stone.position.set(baseX + Math.cos(angle) * ring * xSpread, .32 + Math.floor(stoneIndex / 10) * .14, baseZ + Math.sin(angle) * ring * zSpread);
          stone.rotation.set(angle, angle * .7, angle * .3);
          stone.scale.set(1.15, .72, 1);
          stone.castShadow = true;
          group.add(stone);
        }
        group.userData.birth = now;
        boardRoot.add(group);
        stoneGroups.set(index, { group, count });
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let hovered = -1;
      const isSelectable = (index: number) => {
        const live = stateRef.current;
        if (live.disabled || live.pits[index] <= 0) return false;
        return live.currentPlayer === 1 ? index >= 0 && index < 6 : index >= 7 && index < 13;
      };
      const pick = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(hitMeshes, false)[0];
        hovered = hit ? Number(hit.object.userData.index) : -1;
        canvas.style.cursor = isSelectable(hovered) ? 'pointer' : 'default';
      };
      const click = (event: PointerEvent) => {
        pick(event);
        if (isSelectable(hovered)) stateRef.current.onPitClick(hovered);
      };
      canvas.style.touchAction = 'none';
      canvas.addEventListener('pointermove', pick);
      canvas.addEventListener('pointerdown', click);
      canvas.addEventListener('pointerleave', () => { hovered = -1; });

      const observer = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        const requiredHeight = Math.max(4.5, 10.8 / camera.aspect);
        camera.position.y = requiredHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        camera.updateProjectionMatrix();
      });
      observer.observe(canvas);
      let frame = 0;
      const animate = (now: number) => {
        const live = stateRef.current;
        const themeColor = live.theme === 'Midnight' ? 0x132b4c : live.theme === 'Jungle' ? 0x28572d : 0x7b3517;
        boardMaterial.color.lerp(new THREE.Color(themeColor), .08);
        live.pits.forEach((count, index) => {
          const stones = stoneGroups.get(index);
          if (!stones || stones.count !== count) rebuildStones(index, count, now);
          const material = pitMeshes[index].material as InstanceType<typeof THREE.MeshStandardMaterial>;
          const active = index === hovered && isSelectable(index);
          const highlighted = live.highlightedPit === index;
          const inPath = live.lastMovePath.includes(index);
          material.emissive.setHex(highlighted ? 0xffd34d : active ? 0x43d89c : inPath ? 0x276bb3 : 0x000000);
          material.emissiveIntensity = highlighted ? .8 : active ? .5 : inPath ? .22 : 0;
          pitMeshes[index].scale.y = highlighted ? 1 + Math.sin(now * .018) * .08 : 1;
        });
        stoneGroups.forEach(({ group }) => {
          const age = Math.min(1, (now - Number(group.userData.birth)) / 380);
          const bounce = 1 - Math.pow(1 - age, 3);
          group.children.forEach((stone, stoneIndex) => {
            stone.position.y += ((.32 + Math.floor(stoneIndex / 10) * .14) - stone.position.y) * .14;
            stone.scale.y = .72 * bounce;
            stone.scale.x = stone.scale.z = 1.15 * bounce;
            stone.rotation.y += .002;
          });
        });
        boardRoot.rotation.y = -.035 + Math.sin(now * .00028) * .012;
        renderer.render(scene, camera);
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      teardown = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        canvas.removeEventListener('pointermove', pick);
        canvas.removeEventListener('pointerdown', click);
        disposeTree(scene);
        renderer.dispose();
      };
    });
    return () => { cancelled = true; teardown(); };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full touch-manipulation" aria-label="Interactive 3D Mancala board" />;
};

export default MancalaBoard3D;
