import * as THREE from 'three';
import { dressScene, stdMat, addMesh } from './lights.js';
import { grassTexture, pathTexture, iceTexture, rockTexture, metalTexture, lavaTexture, labelTexture } from './textures.js';
import { makeRng } from './util.js';
import { circleHitsAny, findClearPoint } from './collision.js';
import { createOpenWorld } from './openworld.js';

function boundsOf(half) {
  return { minX: -half, maxX: half, minZ: -half, maxZ: half };
}

function addBoundary(scene, colliders, half, height, color, thickness = 1.15) {
  const mat = stdMat(color, { roughness: 0.7 });
  const long = new THREE.BoxGeometry(half * 2 + thickness * 2, height, thickness);
  const short = new THREE.BoxGeometry(thickness, height, half * 2);
  const y = height / 2;
  const specs = [
    [0, y, half + thickness / 2, long, -half - thickness, half + thickness, half, half + thickness],
    [0, y, -half - thickness / 2, long, -half - thickness, half + thickness, -half - thickness, -half],
    [half + thickness / 2, y, 0, short, half, half + thickness, -half, half],
    [-half - thickness / 2, y, 0, short, -half - thickness, -half, -half, half],
  ];
  specs.forEach(([x, yy, z, geo, minX, maxX, minZ, maxZ]) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, yy, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ minX, maxX, minZ, maxZ });
  });
}

function tree(scene, colliders, x, z, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.28 * scale, 1.3 * scale, 8), stdMat('#8a5a32'));
  trunk.position.set(x, 0.65 * scale, z);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  scene.add(trunk);
  const leafMat = stdMat(scale > 1.1 ? '#2f9a45' : '#3cba58');
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.05 * scale, 14, 12), leafMat);
  crown.position.set(x, 1.7 * scale, z);
  crown.castShadow = true;
  scene.add(crown);
  const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.72 * scale, 12, 10), stdMat('#67d36a'));
  crown2.position.set(x + 0.35 * scale, 2.15 * scale, z + 0.1);
  crown2.castShadow = true;
  scene.add(crown2);
  colliders.push({
    minX: x - 0.7 * scale,
    maxX: x + 0.7 * scale,
    minZ: z - 0.7 * scale,
    maxZ: z + 0.7 * scale,
  });
}

function rock(scene, colliders, x, z, scale = 1, color = '#8d7568') {
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 * scale, 0), stdMat(color, { roughness: 0.9 }));
  mesh.position.set(x, 0.38 * scale, z);
  mesh.rotation.y = x;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({
    minX: x - 0.65 * scale,
    maxX: x + 0.65 * scale,
    minZ: z - 0.65 * scale,
    maxZ: z + 0.65 * scale,
  });
}

function crate(scene, colliders, x, z, color, label) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), stdMat(color));
  mesh.position.set(x, 0.55, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (label) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: labelTexture(label, '#fff6e4', '#5a3014') }),
    );
    face.position.set(0, 0.05, 0.57);
    mesh.add(face);
  }
  colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });
}

function flower(scene, x, z, color) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 5), stdMat('#2f8a3a'));
  stem.position.set(x, 0.14, z);
  stem.castShadow = true;
  scene.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), stdMat(color));
  head.position.set(x, 0.32, z);
  head.castShadow = true;
  scene.add(head);
}

function lamp(scene, x, z, color = '#fff1c2') {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), stdMat('#5c5348', { metalness: 0.4, roughness: 0.4 }));
  pole.position.set(x, 1.1, z);
  pole.castShadow = true;
  scene.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3,
  }));
  bulb.position.set(x, 2.25, z);
  scene.add(bulb);
  const light = new THREE.PointLight(color, 0.55, 7, 2);
  light.position.set(x, 2.2, z);
  scene.add(light);
}

function bench(scene, colliders, x, z, rotY = 0) {
  const group = new THREE.Group();
  const wood = stdMat('#c48848');
  const metal = stdMat('#6a6258', { metalness: 0.5, roughness: 0.4 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), wood);
  seat.position.y = 0.48;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.1), wood);
  back.position.set(0, 0.78, -0.2);
  group.add(seat, back);
  [-0.6, 0.6].forEach((ox) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, 0.4), metal);
    leg.position.set(ox, 0.24, 0);
    group.add(leg);
  });
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(group);
  colliders.push({ minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.45, maxZ: z + 0.45 });
}

function ground(scene, half, texture, repeat, y = 0) {
  const map = texture.clone();
  map.needsUpdate = true;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.userData.owned = true;
  const geo = new THREE.PlaneGeometry(half * 2, half * 2, 1, 1);
  const mat = stdMat('#ffffff', { map, roughness: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  scene.add(mesh);
  return mesh;
}

function fillSpots(preferred, count, colliders, bounds, avoid, minDist) {
  const spots = [];
  const ok = (x, z) => {
    if (x < bounds.minX + 1.6 || x > bounds.maxX - 1.6 || z < bounds.minZ + 1.6 || z > bounds.maxZ - 1.6) return false;
    if (circleHitsAny(x, z, 0.8, colliders)) return false;
    if (avoid && (x - avoid.x) ** 2 + (z - avoid.z) ** 2 < (avoid.r ** 2)) return false;
    return spots.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 >= minDist * minDist);
  };
  preferred.forEach((p) => {
    const found = findClearPoint(p.x, p.z, 0.8, colliders, bounds);
    if (found && ok(found.x, found.z)) spots.push(found);
  });
  const rng = makeRng((preferred.length + 1) * 97 + count * 13 + Math.round((bounds.maxX || 1) * 10));
  let guard = 0;
  while (spots.length < count && guard < 2500) {
    guard += 1;
    const x = bounds.minX + 2 + rng() * (bounds.maxX - bounds.minX - 4);
    const z = bounds.minZ + 2 + rng() * (bounds.maxZ - bounds.minZ - 4);
    if (ok(x, z)) spots.push({ x, z });
  }
  return spots.slice(0, count);
}

export const MAP_LIST = [
  {
    id: 'park',
    name: 'TOASTY PARK',
    desc: 'A sunny park of hedges, fountains, and cranky toasts.',
    swatch: ['#67c85a', '#8fd4ff', '#e7b56a'],
  },
  {
    id: 'fridge',
    name: 'FROZEN FRIDGE',
    desc: 'A chilly fridge where the jam gets frostbite.',
    swatch: ['#d7f4ff', '#7ec8ef', '#ffffff'],
  },
  {
    id: 'volcano',
    name: 'VOLCANO TOAST',
    desc: 'Hot rock, lava glow, and a very toasted attitude.',
    swatch: ['#3a241c', '#ff5a1f', '#ffb03a'],
  },
  {
    id: 'space',
    name: 'SPACE KITCHEN',
    desc: 'A neon kitchen floating past the stars.',
    swatch: ['#24143f', '#7cf0ff', '#8ea0b5'],
  },
];

const LOOKS = {
  park: {
    background: '#3aa0f0', fog: '#9fd4ff', fogNear: 24, fogFar: 62,
    sky: '#cfe9ff', ground: '#5aaa45', sun: '#fff6df', sunIntensity: 1.35,
    skyTop: '#1d78e0', skyBottom: '#7ec8ff', hemi: 0.72, shadowSpan: 34,
  },
  fridge: {
    background: '#c5e9ff', fog: '#e7f7ff', fogNear: 18, fogFar: 50,
    sky: '#f4fbff', ground: '#9fd0ea', sun: '#e7f4ff', sunIntensity: 1.25,
    skyTop: '#b9e4ff', skyBottom: '#f7fdff', hemi: 0.9, fill: '#d7ecff', shadowSpan: 32,
  },
  volcano: {
    background: '#2a120e', fog: '#4a2418', fogNear: 16, fogFar: 48,
    sky: '#ffb07a', ground: '#3a241c', sun: '#ffb060', sunIntensity: 1.35,
    skyTop: '#ff7a3a', skyBottom: '#2a120e', hemi: 0.55, fill: '#ff8a4a', shadowSpan: 32,
  },
  space: {
    background: '#090714', fog: '#1a1030', fogNear: 20, fogFar: 70,
    sky: '#9ecbff', ground: '#2a2148', sun: '#d7e4ff', sunIntensity: 1.15,
    skyTop: '#120a24', skyBottom: '#3a2468', hemi: 0.62, fill: '#7aa7ff', shadowSpan: 32,
  },
};

function buildPark(scene, colliders) {
  const half = 22;
  ground(scene, half, grassTexture(), 8);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 30), stdMat('#ffffff', { map: pathTexture(), roughness: 0.95 }));
  pathTexture().repeat.set(1, 6);
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.02;
  path.receiveShadow = true;
  scene.add(path);
  const path2 = path.clone();
  path2.scale.set(1, 0.7, 1);
  path2.rotation.z = Math.PI / 2;
  path2.position.y = 0.025;
  scene.add(path2);

  const fountain = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.7, 16), stdMat('#d9d3cb', { roughness: 0.45 }));
  basin.position.y = 0.35;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.2, 16), new THREE.MeshStandardMaterial({
    color: '#49b7e8', emissive: '#1a6f9a', emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.1,
  }));
  water.position.y = 0.62;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), stdMat('#cfc8be', { metalness: 0.3 }));
  spout.position.y = 1.05;
  fountain.add(basin, water, spout);
  fountain.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(fountain);
  colliders.push({ minX: -1.9, maxX: 1.9, minZ: -1.9, maxZ: 1.9 });

  [[-15, -11, 1], [14, 11, 1.15], [-9, 15, 0.9], [16, -7, 1.05], [7, -16, 0.85], [-18, 7, 1.1], [5, 8, 0.75]].forEach(([x, z, s]) => tree(scene, colliders, x, z, s));
  for (let z = -6; z <= 7.2; z += 1.35) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), stdMat(z % 2 ? '#2f8f45' : '#46b85a'));
    bush.position.set(-11.2, 0.48, z);
    bush.scale.y = 0.85;
    bush.castShadow = true;
    bush.receiveShadow = true;
    scene.add(bush);
  }
  colliders.push({ minX: -12.1, maxX: -10.2, minZ: -6.4, maxZ: 8.2 });
  bench(scene, colliders, 10, -5, 0.4);
  bench(scene, colliders, -4, 10, 1.2);
  rock(scene, colliders, 12, 4, 0.8);
  rock(scene, colliders, -16, -16, 1.1, '#9a8474');
  lamp(scene, -6, -6);
  lamp(scene, 8, 14, '#fff6d0');
  [[-3, 12, '#ff5d8f'], [2, 11, '#ffd15c'], [4, 13, '#ffa3c7'], [-13, 12, '#8d7bff'], [15, 2, '#ff7a5c'], [-2, -8, '#ffe27a'], [6, 2, '#ff8ad8']].forEach(([x, z, c]) => flower(scene, x, z, c));
  for (let i = 0; i < 5; i += 1) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }));
    cloud.position.set(-12 + i * 6, 9 + (i % 2), -8 + i);
    cloud.scale.set(1.8, 0.6, 1);
    scene.add(cloud);
  }
  addBoundary(scene, colliders, half, 1.3, '#6b4428');
  return half;
}

function buildFridge(scene, colliders) {
  const half = 21;
  const ice = iceTexture();
  ground(scene, half, ice, 6, 0);
  addBoundary(scene, colliders, half, 3.2, '#f4fbff', 0.8);
  [[-8, -6], [6, 8], [-12, 10], [12, -10], [0, -14]].forEach(([x, z], i) => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.4 + (i % 2) * 0.5, 1.3, 1.4), new THREE.MeshStandardMaterial({
      color: '#e9f8ff', roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.88,
    }));
    cube.position.set(x, 0.7, z);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
  });
  crate(scene, colliders, 8, -4, '#d7ecff', 'MILK');
  crate(scene, colliders, -6, 4, '#ffe1ef', 'JAM');
  crate(scene, colliders, 14, 6, '#e7ffe9', 'PEAS');
  const shelfMat = stdMat('#d5dde6', { metalness: 0.35, roughness: 0.35 });
  [-14, 14].forEach((x) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 8), shelfMat);
    shelf.position.set(x, 1.3, 0);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    scene.add(shelf);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.3, 0.15), shelfMat);
    post.position.set(x, 0.65, 0);
    post.castShadow = true;
    scene.add(post);
    colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: -4.2, maxZ: 4.2 });
  });
  const snow = new THREE.Group();
  const ballMat = stdMat('#f7fbff');
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), ballMat);
  b1.position.y = 0.7;
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), ballMat);
  b2.position.y = 1.55;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 8), stdMat('#ff8a3a'));
  nose.position.set(0, 1.55, 0.42);
  nose.rotation.x = Math.PI / 2;
  snow.add(b1, b2, nose);
  snow.position.set(-14, 0, -12);
  snow.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(snow);
  colliders.push({ minX: -15, maxX: -13, minZ: -13.1, maxZ: -10.8 });
  for (let i = 0; i < 8; i += 1) {
    const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 6), new THREE.MeshStandardMaterial({
      color: '#e7f7ff', roughness: 0.1, transparent: true, opacity: 0.85,
    }));
    icicle.position.set(-18 + i * 1.3, 2.5, -20.4);
    scene.add(icicle);
  }
  const cold = new THREE.PointLight('#c8ecff', 0.7, 12, 2);
  cold.position.set(0, 3.5, 0);
  scene.add(cold);
  return half;
}

function buildVolcano(scene, colliders) {
  const half = 22;
  ground(scene, half, rockTexture(), 6);
  const lavaMat = new THREE.MeshStandardMaterial({
    color: '#ff4a12', emissive: '#ff6a18', emissiveIntensity: 0.9, roughness: 0.45, map: lavaTexture(),
  });
  lavaTexture().repeat.set(2, 2);
  [[-8, 6, 3.2, 2.2], [9, -7, 3.6, 2.4], [2, 12, 2.4, 1.6]].forEach(([x, z, w, d]) => {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 18), lavaMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.05, z);
    pool.scale.set(w, d, 1);
    scene.add(pool);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.18, 8, 18), stdMat('#2a1a16', { roughness: 0.9 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.15, z);
    rim.scale.set(w, d, 1);
    rim.castShadow = true;
    rim.receiveShadow = true;
    scene.add(rim);
    colliders.push({ minX: x - w * 0.85, maxX: x + w * 0.85, minZ: z - d * 0.85, maxZ: z + d * 0.85 });
  });
  [[-14, -8, 1.3], [15, 8, 1.5], [-6, -14, 1], [12, 14, 1.2], [-16, 12, 0.9], [6, -2, 0.7]].forEach(([x, z, s]) => rock(scene, colliders, x, z, s, '#5a382e'));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 8, 12), stdMat('#3a221c', { roughness: 0.95 }));
  cone.position.set(-28, 2, -24);
  cone.castShadow = true;
  scene.add(cone);
  const caldera = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), lavaMat);
  caldera.position.set(-28, 6.1, -24);
  scene.add(caldera);
  addBoundary(scene, colliders, half, 1.5, '#2a1612');
  scene.userData.tick = (t) => {
    lavaMat.emissiveIntensity = 0.75 + Math.sin(t * 3) * 0.2;
    lavaTexture().offset.y = t * 0.05;
  };
  return half;
}

function buildSpace(scene, colliders) {
  const half = 21;
  ground(scene, half, metalTexture(), 5);
  addBoundary(scene, colliders, half, 1.1, '#66788f', 0.45);
  const positions = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 160;
    positions[i * 3 + 1] = 8 + Math.random() * 40;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.18, sizeAttenuation: true })));
  const planet = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 16), stdMat('#ff8f6a', { roughness: 0.7 }));
  planet.position.set(26, 16, -30);
  scene.add(planet);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.35, 8, 30), stdMat('#ffe1a8', { roughness: 0.4 }));
  ring.position.copy(planet.position);
  ring.rotation.x = 1.2;
  scene.add(ring);
  crate(scene, colliders, -8, 6, '#9eb4cc', 'OATS');
  crate(scene, colliders, 8, -6, '#c9b6ff', 'ZAP');
  [[-12, -8], [12, 10], [0, -12]].forEach(([x, z]) => {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 1.1), stdMat('#d5deea', { metalness: 0.45, roughness: 0.28 }));
    counter.position.set(x, 0.5, z);
    counter.castShadow = true;
    counter.receiveShadow = true;
    scene.add(counter);
    const neon = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.08), new THREE.MeshStandardMaterial({
      color: '#7cf0ff', emissive: '#39e1ff', emissiveIntensity: 0.9,
    }));
    neon.position.set(x, 1.05, z + 0.5);
    scene.add(neon);
    colliders.push({ minX: x - 1.7, maxX: x + 1.7, minZ: z - 0.7, maxZ: z + 0.7 });
  });
  const fork = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), stdMat('#d9e2ee', { metalness: 0.7, roughness: 0.25 }));
  handle.position.y = 1.6;
  fork.add(handle);
  [-0.22, 0, 0.22].forEach((x) => {
    const tine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), stdMat('#eef3f8', { metalness: 0.6, roughness: 0.25 }));
    tine.position.set(x, 3.4, 0);
    fork.add(tine);
  });
  fork.position.set(15, 0, 4);
  fork.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(fork);
  colliders.push({ minX: 14.2, maxX: 15.8, minZ: 3.2, maxZ: 4.8 });
  const beacon = new THREE.PointLight('#7cf0ff', 1.1, 14, 2);
  beacon.position.set(0, 3.2, 0);
  scene.add(beacon);
  return half;
}

const BUILDERS = { park: buildPark, fridge: buildFridge, volcano: buildVolcano, space: buildSpace };

const COIN_HINTS = {
  park: [[0, -12], [10, 8], [-14, 8], [8, -8], [-16, -6], [15, 2], [-6, -15], [18, 15], [-18, 16], [4, 16], [-2, 5], [6, -18]],
  fridge: [[0, 8], [10, 10], [-10, -10], [4, -8], [-16, 4], [16, -4], [0, 16], [-8, 14], [12, 0], [-4, -16], [16, 14], [-14, -4]],
  volcano: [[-4, -6], [14, 2], [-14, 2], [6, 8], [-10, -16], [16, -14], [0, 16], [-18, -4], [8, 16], [-2, -16], [18, 10], [4, -10]],
  space: [[0, 6], [-10, -4], [10, 8], [-16, 12], [16, -12], [4, 14], [-6, -14], [12, 2], [-14, -10], [0, -6], [8, -16], [-4, 16]],
};

const ENEMY_HINTS = {
  park: [[-12, -12], [13, -12], [14, 8], [-16, 10]],
  fridge: [[-10, -8], [11, 9], [15, -8], [-15, 12]],
  volcano: [[-12, 10], [14, -4], [4, -12], [-16, -8]],
  space: [[-12, 12], [12, -10], [-6, -8], [14, 8]],
};

export function buildMap(id) {
  const scene = new THREE.Scene();
  const look = { ...(LOOKS[id] || LOOKS.park), fogNear: 40, fogFar: 150, shadowSpan: 36 };
  dressScene(scene, look);
  const colliders = [];
  const open = createOpenWorld(scene, id, colliders);
  const bounds = { minX: -50000, maxX: 50000, minZ: -50000, maxZ: 50000 };
  const spawn = { x: 4, z: 6, yaw: Math.PI };
  open.update(0, 0, spawn);
  const coins = fillSpots(COIN_HINTS[id].map(([x, z]) => ({ x, z })), 12, colliders, bounds, { x: spawn.x, z: spawn.z, r: 4 }, 4.2);
  const enemies = fillSpots(ENEMY_HINTS[id].map(([x, z]) => ({ x, z })), 4, colliders, bounds, { x: spawn.x, z: spawn.z, r: 6 }, 5);
  return {
    id,
    scene,
    colliders,
    bounds,
    spawn,
    coins,
    enemies,
    update: (t, dt, pos) => {
      open.update(t, dt, pos || spawn);
      if (scene.userData.tick) scene.userData.tick(t, dt);
    },
  };
}

const THEME_BUILD = { park: 'park', fridge: 'fridge', volcano: 'volcano', space: 'space' };

export function buildThemedArena(theme, half = 18) {
  const id = THEME_BUILD[theme] ? theme : 'park';
  const scene = new THREE.Scene();
  dressScene(scene, LOOKS[id]);
  const colliders = [];
  if (id === 'park') ground(scene, half, grassTexture(), 6);
  if (id === 'fridge') ground(scene, half, iceTexture(), 5);
  if (id === 'volcano') ground(scene, half, rockTexture(), 5);
  if (id === 'space') ground(scene, half, metalTexture(), 4);
  const wallColor = { park: '#6b4428', fridge: '#e7f4ff', volcano: '#2a1612', space: '#66788f' }[id];
  addBoundary(scene, colliders, half, id === 'fridge' ? 2.4 : 1.25, wallColor, 0.8);
  [[-half + 3, -half + 3], [half - 3, half - 3], [-half + 3, half - 3], [half - 3, -half + 3]].forEach(([x, z], i) => {
    if (id === 'park') flower(scene, x, z, ['#ff7aa2', '#ffe27a', '#8d7bff', '#7CFFB2'][i]);
    if (id === 'fridge') {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), stdMat('#e7f7ff', { roughness: 0.12, transparent: true, opacity: 0.9 }));
      cube.position.set(x, 0.5, z);
      cube.castShadow = true;
      scene.add(cube);
      colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 });
    }
    if (id === 'volcano') rock(scene, colliders, x, z, 0.8, '#5a382e');
    if (id === 'space') lamp(scene, x, z, '#7cf0ff');
  });
  return {
    id,
    scene,
    colliders,
    bounds: boundsOf(half),
    spawn: { x: 0, z: 0, yaw: 0 },
    coins: [],
    enemies: [],
    update: () => {},
  };
}

export function getMapMeta(id) {
  return MAP_LIST.find((map) => map.id === id) || MAP_LIST[0];
}
