import * as THREE from 'three';

export type OceanFishView = {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  depth: number;
  age: number;
  phase: number;
  hp: number;
  currentHp: number;
  color: string;
  behavior: string;
  flashUntil: number;
  slowUntil: number;
};

export type OceanBulletView = {
  id: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  color: string;
  weapon: string;
  ownerId: number;
};

export type OceanParticleView = { id: number; x: number; y: number; color: string; size: number; age: number; life: number };
export type OceanHunterView = { id: number; name: string; side: 'bottom' | 'left' | 'top' | 'right'; color: string; isHuman: boolean };

export type OceanFrame = {
  fish: OceanFishView[];
  bullets: OceanBulletView[];
  particles: OceanParticleView[];
  hunters: OceanHunterView[];
  aims: Map<number, { x: number; y: number }>;
  targets: Map<number, number | null>;
  environment: 'Clear' | 'Current' | 'Darkness';
  cannonSkin: 'Arcade' | 'Neon' | 'Gold';
  shake: number;
  time: number;
};

type CreatureRig = {
  root: THREE.Group;
  body: THREE.Group;
  animated: THREE.Object3D[];
  healthBack: THREE.Mesh;
  healthFill: THREE.Mesh;
  targetRing: THREE.Mesh;
  lastX: number;
  lastY: number;
  lastDepth: number;
};

const GAME_WIDTH = 1800;
const GAME_HEIGHT = 1050;
const WORLD_WIDTH = 19;
const WORLD_HEIGHT = WORLD_WIDTH * GAME_HEIGHT / GAME_WIDTH;

const colorOf = (value: string) => new THREE.Color(value);
const material = (color: string | number, roughness = .42, metalness = .08, emissive = 0x000000) => new THREE.MeshPhysicalMaterial({
  color,
  roughness,
  metalness,
  emissive,
  emissiveIntensity: emissive ? .2 : 0,
  clearcoat: .28,
  clearcoatRoughness: .45,
});

const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, scale?: [number, number, number]) => {
  const value = new THREE.Mesh(geometry, mat);
  if (scale) value.scale.set(...scale);
  value.castShadow = true;
  value.receiveShadow = true;
  return value;
};

const finGeometry = () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -1.15, .72, .08, -1.05, -.72, -.08,
    0, 0, 0, -1.05, -.72, -.08, -1.15, .72, .08
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
};

const addEyes = (parent: THREE.Group, x: number, y: number, z: number, spread: number, scale = 1) => {
  const white = material(0xc8d8d4, .2, .02);
  const black = material(0x07111a, .2, .05, 0x07111a);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(.082 * scale, 14, 10), white);
    eye.position.set(x, y, z + side * spread);
    const pupil = mesh(new THREE.SphereGeometry(.045 * scale, 10, 8), black);
    pupil.position.set(x + .065 * scale, y, z + side * spread);
    parent.add(eye, pupil);
  }
};

const makeFishBody = (group: THREE.Group, primary: THREE.Material, accent: THREE.Material, long = 1) => {
  const body = mesh(new THREE.SphereGeometry(.72, 32, 20), primary, [1.45 * long, .78, .64]);
  group.add(body);
  const tailPivot = new THREE.Group();
  tailPivot.position.x = -1.05 * long;
  const tail = mesh(finGeometry(), accent, [.8, .78, .8]);
  tailPivot.add(tail);
  group.add(tailPivot);
  const dorsal = mesh(new THREE.ConeGeometry(.38, .82, 3), accent);
  dorsal.position.set(-.1, .72, 0);
  dorsal.rotation.z = -.05;
  group.add(dorsal);
  const finLeft = mesh(finGeometry(), accent, [.42, .38, .42]);
  finLeft.position.set(.05, -.12, .48);
  finLeft.rotation.x = 1.15;
  const finRight = finLeft.clone();
  finRight.position.z = -.48;
  finRight.rotation.x = -1.15;
  group.add(finLeft, finRight);
  addEyes(group, .87 * long, .18, 0, .42, .9);
  const gillMaterial = new THREE.MeshBasicMaterial({ color: 0x20343a, transparent: true, opacity: .52 });
  for (const side of [-1, 1]) {
    const gill = mesh(new THREE.TorusGeometry(.22, .018, 6, 18, Math.PI * 1.18), gillMaterial);
    gill.position.set(.52 * long, .02, side * .47); gill.rotation.set(Math.PI / 2, 0, side * .25);
    group.add(gill);
  }
  return [tailPivot, finLeft, finRight];
};

const makeShark = (group: THREE.Group, primary: THREE.Material, accent: THREE.Material) => {
  const body = mesh(new THREE.SphereGeometry(.72, 36, 22), primary, [2.25, .68, .64]);
  const belly = mesh(new THREE.SphereGeometry(.69, 30, 18, 0, Math.PI * 2, Math.PI * .45, Math.PI * .55), material(0xd7e0df, .5, .02), [2.15, .68, .65]);
  belly.position.y = -.03; group.add(body, belly);
  const nose = mesh(new THREE.ConeGeometry(.52, .95, 28), primary); nose.rotation.z = -Math.PI / 2; nose.position.x = 1.82; nose.scale.set(1, .76, .78); group.add(nose);
  const tailPivot = new THREE.Group(); tailPivot.position.x = -1.62;
  for (const sign of [-1, 1]) { const lobe = mesh(new THREE.ConeGeometry(.34, 1.12, 3), accent); lobe.rotation.z = sign * .58 + Math.PI / 2; lobe.position.y = sign * .34; tailPivot.add(lobe); }
  const dorsal = mesh(new THREE.ConeGeometry(.43, 1.15, 3), primary); dorsal.position.set(-.25, .82, 0); dorsal.rotation.z = -.12;
  group.add(tailPivot, dorsal);
  for (const side of [-1, 1]) { const fin = mesh(finGeometry(), primary, [.8, .65, .65]); fin.position.set(.1, -.18, side * .52); fin.rotation.x = side * 1.15; group.add(fin); }
  addEyes(group, 1.25, .2, 0, .43, .78);
  for (const side of [-1, 1]) for (let index = 0; index < 3; index += 1) { const gill = mesh(new THREE.BoxGeometry(.025, .34, .012), material(0x243640, .75)); gill.position.set(.73 - index * .12, .02, side * .5); gill.rotation.z = -.12; group.add(gill); }
  return [tailPivot];
};

const makeWhale = (group: THREE.Group, primary: THREE.Material, accent: THREE.Material) => {
  const body = mesh(new THREE.SphereGeometry(.8, 36, 22), primary, [2.35, .82, .82]);
  const belly = mesh(new THREE.SphereGeometry(.73, 30, 18), material(0x9fb6d3, .55, .03), [2.18, .45, .76]); belly.position.y = -.38;
  group.add(body, belly);
  const tailPivot = new THREE.Group(); tailPivot.position.x = -1.78;
  for (const side of [-1, 1]) { const fluke = mesh(finGeometry(), accent, [.86, .62, .8]); fluke.rotation.x = side * 1.05; fluke.position.z = side * .32; tailPivot.add(fluke); }
  group.add(tailPivot);
  for (const side of [-1, 1]) { const fin = mesh(finGeometry(), accent, [.68, .56, .55]); fin.position.set(.1, -.25, side * .62); fin.rotation.x = side * 1.18; group.add(fin); }
  addEyes(group, 1.22, .12, 0, .58, .7);
  return [tailPivot];
};

const makeShrimp = (group: THREE.Group, primary: THREE.Material, accent: THREE.Material) => {
  const animated: THREE.Object3D[] = [];
  for (let index = 0; index < 7; index += 1) {
    const segment = mesh(new THREE.SphereGeometry(.28 - index * .018, 18, 12), index % 2 ? accent : primary, [1.25, .78, .72]);
    segment.position.set(.68 - index * .3, Math.sin(index * .48) * .13, 0); group.add(segment);
  }
  const tailPivot = new THREE.Group(); tailPivot.position.set(-1.35, .1, 0);
  for (const side of [-1, 1]) { const fan = mesh(finGeometry(), accent, [.38, .35, .35]); fan.rotation.x = side * .72; fan.position.z = side * .16; tailPivot.add(fan); }
  group.add(tailPivot); animated.push(tailPivot);
  const antennaMaterial = material(0xffc4ad, .55, .01);
  for (const side of [-1, 1]) { const antenna = mesh(new THREE.CylinderGeometry(.012, .018, 1.25, 7), antennaMaterial); antenna.rotation.z = -1.2; antenna.rotation.x = side * .18; antenna.position.set(1.05, .25, side * .18); group.add(antenna); }
  addEyes(group, .83, .2, 0, .2, .72);
  return animated;
};

const makeTentacle = (color: THREE.Material, x: number, z: number, length = 1) => {
  const pivot = new THREE.Group();
  pivot.position.set(x, -.35, z);
  const strand = mesh(new THREE.CylinderGeometry(.075, .12, length, 8, 4), color);
  strand.position.y = -length / 2;
  pivot.add(strand);
  return pivot;
};

const createCreature = (fish: OceanFishView): CreatureRig => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const primary = material(fish.color, .34, .1, colorOf(fish.color).multiplyScalar(.18).getHex());
  const accentColor = colorOf(fish.color).offsetHSL(.08, .08, .13).getHex();
  const accent = material(accentColor, .38, .08);
  const animated: THREE.Object3D[] = [];

  if (fish.emoji === '🪼') {
    const bell = mesh(new THREE.SphereGeometry(.78, 24, 14, 0, Math.PI * 2, 0, Math.PI * .58), primary, [1, .82, 1]);
    body.add(bell);
    for (let index = 0; index < 7; index += 1) {
      const angle = index / 7 * Math.PI * 2;
      const tentacle = makeTentacle(accent, Math.cos(angle) * .48, Math.sin(angle) * .48, .85 + index % 3 * .22);
      body.add(tentacle); animated.push(tentacle);
    }
    addEyes(body, .43, .08, 0, .28, .8);
  } else if (fish.emoji === '🦀') {
    const shell = mesh(new THREE.SphereGeometry(.7, 20, 12), primary, [1.25, .55, 1]);
    body.add(shell);
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 3; leg += 1) {
        const pivot = new THREE.Group();
        pivot.position.set(-.35 + leg * .35, -.1, side * .62);
        const limb = mesh(new THREE.CylinderGeometry(.055, .08, .75, 7), accent);
        limb.rotation.x = Math.PI / 2.6 * side; limb.position.z = side * .31;
        pivot.add(limb); body.add(pivot); animated.push(pivot);
      }
      const claw = mesh(new THREE.SphereGeometry(.3, 14, 9), accent, [1.15, .72, .9]);
      claw.position.set(.78, .05, side * .72); body.add(claw);
    }
    addEyes(body, .5, .42, 0, .35, .95);
  } else if (fish.emoji === '🐢') {
    const shell = mesh(new THREE.SphereGeometry(.78, 24, 14), primary, [1.25, .48, .9]);
    const head = mesh(new THREE.SphereGeometry(.34, 16, 10), accent, [1.15, .85, .85]);
    head.position.x = 1.08; body.add(shell, head);
    for (const side of [-1, 1]) {
      for (const x of [-.52, .52]) {
        const flipper = mesh(finGeometry(), accent, [.48, .5, .45]);
        flipper.position.set(x, -.05, side * .62); flipper.rotation.x = side * 1.05;
        body.add(flipper); animated.push(flipper);
      }
    }
    addEyes(body, 1.3, .09, 0, .19, .72);
  } else if (fish.emoji === '🦑' || fish.emoji === '🐙') {
    const boss = fish.emoji === '🐙';
    const head = mesh(new THREE.SphereGeometry(.78, 22, 16), primary, [boss ? 1.15 : 1.45, boss ? 1.1 : .8, boss ? 1.05 : .7]);
    head.position.y = .25; body.add(head);
    const count = boss ? 9 : 6;
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2;
      const tentacle = makeTentacle(accent, Math.cos(angle) * .58, Math.sin(angle) * .52, boss ? 1.35 : .9);
      tentacle.rotation.z = (index - count / 2) * .04;
      body.add(tentacle); animated.push(tentacle);
    }
    addEyes(body, .63, .3, 0, .4, boss ? 1.2 : .9);
  } else if (fish.emoji === '🦈') {
    animated.push(...makeShark(body, primary, accent));
  } else if (fish.emoji === '🐋') {
    animated.push(...makeWhale(body, primary, accent));
  } else if (fish.emoji === '🦐') {
    animated.push(...makeShrimp(body, primary, accent));
  } else if (fish.emoji === '🧰') {
    const chest = mesh(new THREE.BoxGeometry(1.45, .78, .9), primary);
    const lid = mesh(new THREE.CylinderGeometry(.46, .46, 1.45, 12, 1, false, 0, Math.PI), accent);
    lid.rotation.z = Math.PI / 2; lid.position.y = .38;
    const band = mesh(new THREE.BoxGeometry(.14, .85, .96), material(0xffdb58, .23, .72));
    band.position.x = .15; body.add(chest, lid, band);
  } else if (fish.emoji === '🌟') {
    const core = mesh(new THREE.DodecahedronGeometry(.62, 1), material(0xffd84d, .2, .55, 0xff9f20));
    body.add(core);
    for (let index = 0; index < 5; index += 1) {
      const spike = mesh(new THREE.ConeGeometry(.25, .85, 5), accent);
      const angle = index / 5 * Math.PI * 2;
      spike.rotation.z = angle - Math.PI / 2; spike.position.set(Math.cos(angle) * .62, Math.sin(angle) * .62, 0);
      body.add(spike);
    }
  } else {
    const long = 1;
    animated.push(...makeFishBody(body, primary, accent, long));
    if (fish.emoji === '🐡') {
      for (let index = 0; index < 18; index += 1) {
        const spike = mesh(new THREE.ConeGeometry(.055, .34, 5), accent);
        const phi = Math.acos(1 - 2 * (index + .5) / 18);
        const theta = Math.PI * (1 + Math.sqrt(5)) * index;
        const direction = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
        spike.position.copy(direction.clone().multiplyScalar(.68));
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        body.add(spike);
      }
    }
  }

  const scale = Math.max(.36, fish.radius / 52);
  root.scale.setScalar(scale);

  const healthBack = mesh(new THREE.PlaneGeometry(1.5, .11), new THREE.MeshBasicMaterial({ color: 0x071018, transparent: true, opacity: .78, depthTest: false }));
  healthBack.position.set(0, 1.18, .7); healthBack.renderOrder = 20; healthBack.visible = false;
  const healthFill = mesh(new THREE.PlaneGeometry(1.42, .065), new THREE.MeshBasicMaterial({ color: 0x65e6a9, depthTest: false }));
  healthFill.position.set(0, 1.18, .71); healthFill.renderOrder = 21; healthFill.visible = false;
  const targetRing = mesh(new THREE.TorusGeometry(1.05, .035, 8, 40), new THREE.MeshBasicMaterial({ color: 0x8eeeff, transparent: true, opacity: .9, depthTest: false }));
  targetRing.position.z = .55; targetRing.renderOrder = 19; targetRing.visible = false;
  root.add(healthBack, healthFill, targetRing);

  return { root, body, animated, healthBack, healthFill, targetRing, lastX: fish.x, lastY: fish.y, lastDepth: fish.depth };
};

const cannonPosition = (side: OceanHunterView['side']) => {
  if (side === 'top') return { x: GAME_WIDTH / 2, y: 25 };
  if (side === 'left') return { x: 25, y: GAME_HEIGHT / 2 };
  if (side === 'right') return { x: GAME_WIDTH - 25, y: GAME_HEIGHT / 2 };
  return { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 25 };
};

export class OceanHunter3DRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, GAME_WIDTH / GAME_HEIGHT, .1, 100);
  private creatures = new Map<number, CreatureRig>();
  private bullets = new Map<number, THREE.Mesh>();
  private particles = new Map<number, THREE.Mesh>();
  private cannons = new Map<number, THREE.Group>();
  private background: THREE.Mesh | null = null;
  private seaPlants: THREE.Group[] = [];
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, backgroundUrl: string) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.setSize(GAME_WIDTH, GAME_HEIGHT, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x031a2a);
    this.scene.fog = new THREE.FogExp2(0x03263b, .038);
    this.camera.position.set(0, 0, 23.5);

    this.scene.add(new THREE.HemisphereLight(0x84eaff, 0x031018, 2.4));
    const key = new THREE.DirectionalLight(0xc8f6ff, 3.3);
    key.position.set(-7, 11, 12); key.castShadow = true;
    const reef = new THREE.PointLight(0x1d9dff, 55, 28, 1.8);
    reef.position.set(7, -3, 7);
    const warm = new THREE.PointLight(0xff5db8, 32, 20, 2);
    warm.position.set(-8, -4, 4);
    this.scene.add(key, reef, warm);

    const floor = mesh(new THREE.PlaneGeometry(34, 18, 18, 10), material(0x123b42, .92, .03));
    floor.rotation.x = -Math.PI / 2.35; floor.position.set(0, -7, -3); floor.receiveShadow = true;
    this.scene.add(floor);

    const rockMaterial = material(0x294b4c, .86, .04);
    for (let index = 0; index < 18; index += 1) {
      const rock = mesh(new THREE.DodecahedronGeometry(.35 + index % 4 * .15, 1), rockMaterial, [1.35, .6 + index % 3 * .12, 1]);
      rock.position.set(-13 + (index * 3.17) % 26, -6.6 + (index % 3) * .16, -2.7 - index % 5 * .48);
      rock.rotation.set(index * .21, index * .37, index * .12); this.scene.add(rock);
    }
    for (let index = 0; index < 24; index += 1) {
      const plant = new THREE.Group();
      const hue = index % 3 === 0 ? 0x2f9d7a : index % 3 === 1 ? 0x307b69 : 0x6a8850;
      const stalk = mesh(new THREE.CylinderGeometry(.035, .09, 1.25 + index % 4 * .28, 7, 4), material(hue, .62, .02));
      stalk.position.y = .65; plant.add(stalk);
      plant.position.set(-12 + (index * 2.43) % 24, -6.35, -2.1 - index % 6 * .62);
      plant.userData.phase = index * .73; plant.userData.speed = .7 + index % 5 * .08; this.scene.add(plant); this.seaPlants.push(plant);
    }

    const loader = new THREE.TextureLoader();
    loader.load(backgroundUrl, texture => {
      if (this.disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      const backdrop = mesh(new THREE.PlaneGeometry(25, 14.6), new THREE.MeshBasicMaterial({ map: texture, color: 0x8bc9dc }));
      backdrop.position.z = -8;
      this.background = backdrop;
      this.scene.add(backdrop);
    });
  }

  private worldPoint(x: number, y: number, depth = 1) {
    return new THREE.Vector3(
      (x / GAME_WIDTH - .5) * WORLD_WIDTH,
      (.5 - y / GAME_HEIGHT) * WORLD_HEIGHT,
      (depth - .95) * 5
    );
  }

  private syncCreatures(frame: OceanFrame) {
    const live = new Set(frame.fish.map(fish => fish.id));
    this.creatures.forEach((rig, id) => {
      if (live.has(id)) return;
      this.scene.remove(rig.root);
      rig.root.traverse(value => {
        const item = value as THREE.Mesh;
        item.geometry?.dispose();
        if (Array.isArray(item.material)) item.material.forEach(entry => entry.dispose());
        else item.material?.dispose();
      });
      this.creatures.delete(id);
    });

    for (const fish of frame.fish) {
      let rig = this.creatures.get(fish.id);
      if (!rig) {
        rig = createCreature(fish);
        this.creatures.set(fish.id, rig);
        this.scene.add(rig.root);
      }
      const point = this.worldPoint(fish.x, fish.y, fish.depth);
      rig.root.position.lerp(point, .38);
      const dx = fish.x - rig.lastX;
      const dy = fish.y - rig.lastY;
      const depthVelocity = fish.depth - rig.lastDepth;
      rig.lastX = fish.x; rig.lastY = fish.y; rig.lastDepth = fish.depth;
      const heading = Math.atan2(-dy, dx || fish.vx);
      rig.body.rotation.z += (heading - rig.body.rotation.z) * .18;
      const targetFacing = fish.vx < 0 ? Math.PI : 0;
      const facingDelta = Math.atan2(Math.sin(targetFacing - rig.body.rotation.y), Math.cos(targetFacing - rig.body.rotation.y));
      rig.body.rotation.y += facingDelta * .12;
      rig.body.rotation.x = Math.sin(fish.age * 1.7 + fish.phase) * .045 + THREE.MathUtils.clamp(depthVelocity * 18, -.32, .32);
      rig.body.position.y = Math.sin(fish.age * 2.4 + fish.phase) * .08;
      rig.animated.forEach((part, index) => {
        part.rotation.y = Math.sin(fish.age * (fish.behavior === 'dart' ? 10 : 6.4) + fish.phase + index * .55) * (.22 + index % 3 * .055);
        if (fish.emoji === '🪼' || fish.emoji === '🦑' || fish.emoji === '🐙') part.rotation.z = Math.sin(fish.age * 3.5 + index) * .16;
      });
      const hurt = fish.currentHp < fish.hp;
      rig.healthBack.visible = hurt;
      rig.healthFill.visible = hurt;
      rig.healthFill.scale.x = Math.max(.01, fish.currentHp / fish.hp);
      rig.healthFill.position.x = -.71 * (1 - rig.healthFill.scale.x);
      rig.targetRing.visible = [...frame.targets.values()].includes(fish.id);
      if (rig.targetRing.visible) rig.targetRing.rotation.z = frame.time * .0016;
      const flashing = frame.time < fish.flashUntil;
      rig.root.traverse(value => {
        const item = value as THREE.Mesh;
        const standard = item.material as THREE.MeshStandardMaterial;
        if (standard?.isMeshStandardMaterial) standard.emissiveIntensity = flashing ? 1.6 : .28;
      });
    }
  }

  private syncBullets(frame: OceanFrame) {
    const live = new Set(frame.bullets.map(value => value.id));
    this.bullets.forEach((value, id) => {
      if (!live.has(id)) { this.scene.remove(value); value.geometry.dispose(); (value.material as THREE.Material).dispose(); this.bullets.delete(id); }
    });
    for (const bullet of frame.bullets) {
      let value = this.bullets.get(bullet.id);
      if (!value) {
        const color = bullet.weapon === 'Freeze' ? 0xa9f3ff : bullet.weapon === 'Piercing' ? 0xff79ec : colorOf(bullet.color).getHex();
        value = mesh(new THREE.SphereGeometry(bullet.weapon === 'Torpedo' ? .13 : .09, 12, 8), material(color, .18, .35, color));
        this.bullets.set(bullet.id, value); this.scene.add(value);
      }
      value.position.copy(this.worldPoint(bullet.x, bullet.y, 1.18));
    }
  }

  private syncParticles(frame: OceanFrame) {
    const live = new Set(frame.particles.map(value => value.id));
    this.particles.forEach((value, id) => {
      if (!live.has(id)) { this.scene.remove(value); value.geometry.dispose(); (value.material as THREE.Material).dispose(); this.particles.delete(id); }
    });
    for (const particle of frame.particles) {
      let value = this.particles.get(particle.id);
      if (!value) {
        value = mesh(new THREE.IcosahedronGeometry(Math.max(.025, particle.size / 90), 0), new THREE.MeshBasicMaterial({ color: particle.color, transparent: true }));
        this.particles.set(particle.id, value); this.scene.add(value);
      }
      value.position.copy(this.worldPoint(particle.x, particle.y, 1.25));
      (value.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - particle.age / particle.life);
    }
  }

  private syncCannons(frame: OceanFrame) {
    const live = new Set(frame.hunters.map(value => value.id));
    this.cannons.forEach((value, id) => {
      if (!live.has(id)) { this.scene.remove(value); this.cannons.delete(id); }
    });
    for (const hunter of frame.hunters) {
      let cannon = this.cannons.get(hunter.id);
      if (!cannon) {
        cannon = new THREE.Group();
        const base = mesh(new THREE.CylinderGeometry(.32, .42, .3, 16), material(0x182f40, .32, .5));
        base.rotation.x = Math.PI / 2;
        const barrel = mesh(new THREE.CylinderGeometry(.12, .18, .9, 12), material(hunter.color, .25, .58, colorOf(hunter.color).multiplyScalar(.2).getHex()));
        barrel.rotation.z = -Math.PI / 2; barrel.position.x = .42;
        cannon.add(base, barrel); this.cannons.set(hunter.id, cannon); this.scene.add(cannon);
      }
      const origin = cannonPosition(hunter.side);
      cannon.position.copy(this.worldPoint(origin.x, origin.y, 1.28));
      const targetId = frame.targets.get(hunter.id);
      const target = targetId ? frame.fish.find(value => value.id === targetId) : undefined;
      const aim = target || frame.aims.get(hunter.id) || { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
      cannon.rotation.z = Math.atan2(origin.y - aim.y, aim.x - origin.x);
    }
  }

  render(frame: OceanFrame) {
    if (this.disposed) return;
    this.syncCreatures(frame);
    this.syncBullets(frame);
    this.syncParticles(frame);
    this.syncCannons(frame);
    const darkness = frame.environment === 'Darkness';
    this.renderer.toneMappingExposure = darkness ? .58 : frame.environment === 'Current' ? 1.24 : 1.05;
    this.seaPlants.forEach((plant) => { plant.rotation.z = Math.sin(frame.time * .001 * Number(plant.userData.speed) + Number(plant.userData.phase)) * .13; });
    this.camera.position.x = Math.sin(frame.time * .00012) * .16 + (Math.random() - .5) * frame.shake * .003;
    this.camera.position.y = Math.cos(frame.time * .00015) * .1 + (Math.random() - .5) * frame.shake * .003;
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse(value => {
      const item = value as THREE.Mesh;
      item.geometry?.dispose();
      if (Array.isArray(item.material)) item.material.forEach(entry => entry.dispose());
      else item.material?.dispose();
    });
    this.renderer.dispose();
  }
}
