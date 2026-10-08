import * as THREE from 'three';
import { stdMat } from './lights.js';
import { makeRng } from './util.js';

const CHUNK = 40;
const FAR = 3;

const THEMES = {
  park: {
    kind: 'town',
    ground: '#d7f5c4', soil: '#1d4a28', road: '#101218', line: '#f2d15a', walk: '#b7ab9c',
    trunk: '#8a5a32', leaf: '#3aaa4a', house: '#f4e2c4', roof: '#d4533a',
    lamp: '#fff1c2', bush: '#2f8f45', car: ['#e24b4b', '#3d7edb', '#f0c14a', '#f7f7f7', '#59b36a'],
  },
  fridge: {
    kind: 'fridge',
    ground: '#e7fbff', soil: '#e7f6ff', road: '#d4eef8', line: '#ffffff', walk: '#f7fdff',
    trunk: '#d5e7ee', leaf: '#b7eadc', house: '#f7fbff', roof: '#9fd0ea',
    lamp: '#e7f7ff', bush: '#d5fff2', car: ['#f4fbff', '#d7ecff', '#ffffff', '#c9e7ff'],
    food: ['#ff7aa2', '#ffe27a', '#7CFFB2', '#8ecbff'],
  },
  volcano: {
    kind: 'volcano',
    ground: '#6a4030', soil: '#241410', road: '#1a100e', line: '#ffb03a', walk: '#4a2c24',
    trunk: '#4a2a22', leaf: '#c45a28', house: '#5a382e', roof: '#2a1612',
    lamp: '#ffb060', bush: '#8a4028', car: ['#5a3028', '#2a2a2a', '#8a4030', '#c46a32'],
  },
  space: {
    kind: 'kitchen',
    ground: '#e6d4b8', soil: '#e4d2b4', road: '#f3e6d0', line: '#fff6e8', walk: '#cbb892',
    trunk: '#8a96b0', leaf: '#3a8cff', house: '#f4efe6', roof: '#8a9098',
    lamp: '#b8ffe8', bush: '#3a6a9a', car: ['#f7f7f5', '#c8ccd2', '#5a616b'],
    food: ['#ff7aa2', '#ffe27a', '#7CFFB2', '#ffb089'],
  },
};

const bladeGeo = makeBlade();
const leafGeo = makeLeaf();
const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.35, 6);
const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 8);
const dummy = new THREE.Object3D();

function pushBlade(positions, uvs, colors, yaw, w, h, lift) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  [[-w, lift, 0], [w, lift, 0], [0, lift + h, 0.015]].forEach(([x, y, z]) => {
    positions.push(x * c - z * s, y, x * s + z * c);
  });
  uvs.push(0, 0, 1, 0, 0.5, 1);
  colors.push(0.16, 0.42, 0.12, 0.16, 0.42, 0.12, 0.72, 1, 0.4);
}

function makeBlade() {
  const positions = [];
  const uvs = [];
  const colors = [];
  for (let i = 0; i < 4; i += 1) pushBlade(positions, uvs, colors, i * 0.78, 0.52, 0.18, 0);
  for (let i = 0; i < 5; i += 1) pushBlade(positions, uvs, colors, i * 0.62 + 0.3, 0.08, 0.42, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeLeaf() {
  const w = 0.34;
  const h = 0.52;
  const positions = [-w, 0, 0, w, 0, 0, 0, h, 0, 0, 0, -w, 0, 0, w, 0, h, 0];
  const uvs = [0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function windMaterial(color, amp, push, key) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.02,
    side: THREE.DoubleSide,
    vertexColors: key === 'grass',
  });
  mat.customProgramCacheKey = () => `wind-${key}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uPlayer = { value: new THREE.Vector2(9999, 9999) };
    shader.uniforms.uAmp = { value: amp };
    shader.uniforms.uPush = { value: push };
    shader.vertexShader = `
      uniform float uTime;
      uniform vec2 uPlayer;
      uniform float uAmp;
      uniform float uPush;
      varying float vSway;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 wbase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float hgt = transformed.y;
      float wind = sin(uTime * 1.7 + wbase.x * 0.55 + wbase.z * 0.42) * uAmp;
      wind += sin(uTime * 2.7 + wbase.z * 1.1) * uAmp * 0.35;
      vec2 away = wbase.xz - uPlayer;
      float pd = length(away);
      float push = smoothstep(1.55, 0.12, pd) * uPush;
      vec2 dir = pd > 0.001 ? away / pd : vec2(0.0);
      float ax = wind + dir.y * push;
      float az = dir.x * push;
      float cy = cos(ax);
      float sy = sin(ax);
      float y1 = hgt * cy;
      float z1 = hgt * sy;
      float cx = cos(az);
      float sx = sin(az);
      transformed.y = y1 * cx;
      transformed.x += y1 * sx;
      transformed.z += z1;
      vSway = uv.y;`,
    );
    shader.fragmentShader = `
      varying float vSway;
    ${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= mix(vec3(0.72, 0.86, 0.55), vec3(1.15, 1.25, 0.72), vSway);`,
    );
    mat.userData.shader = shader;
  };
  return mat;
}

function modRoad(n) {
  return ((n % 5) + 5) % 5 === 0;
}

function floorTexture(c1, c2, grout) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = grout;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = c1;
  g.fillRect(3, 3, 26, 26);
  g.fillRect(35, 35, 26, 26);
  g.fillStyle = c2;
  g.fillRect(35, 3, 26, 26);
  g.fillRect(3, 35, 26, 26);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function paintInstances(mesh, matrices) {
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.count = matrices.length;
  mesh.instanceMatrix.needsUpdate = true;
}

function chunkSphere(cx, cz) {
  return new THREE.Sphere(
    new THREE.Vector3(cx * CHUNK + CHUNK / 2, 1, cz * CHUNK + CHUNK / 2),
    CHUNK * 0.9,
  );
}

export function createOpenWorld(scene, themeId, colliders) {
  const theme = THEMES[themeId] || THEMES.park;
  const chunks = new Map();
  const lamps = [];
  const grassMat = windMaterial('#63c454', 0.38, 0.72, 'grass');
  const leafMat = windMaterial(theme.leaf, 0.22, 0.28, `leaf-${themeId}`);
  const bushMat = windMaterial(theme.bush, 0.26, 0.4, `bush-${themeId}`);
  const trunkMat = stdMat(theme.trunk, { roughness: 0.86 });
  const roadMat = stdMat(theme.road, { roughness: 0.92 });
  const walkMat = stdMat(theme.walk, { roughness: 0.88 });
  const lineMat = stdMat(theme.line, { roughness: 0.5, emissive: theme.line, emissiveIntensity: 0.15 });
  const lavaMat = new THREE.MeshStandardMaterial({
    color: '#ff5a1f', emissive: '#ff4a12', emissiveIntensity: 0.95, roughness: 0.32,
  });
  const steelMat = stdMat('#d5dae2', { roughness: 0.28, metalness: 0.62 });
  const iceMat = stdMat('#f7fdff', { roughness: 0.08, metalness: 0.12, emissive: '#d7f4ff', emissiveIntensity: 0.22 });

  const tile = 25;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: theme.soil, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);
  const tileSize = 1;
  const floorTex = theme.kind === 'kitchen'
    ? floorTexture('#fff0d2', '#e2b98a', '#8d6844')
    : theme.kind === 'fridge'
      ? floorTexture('#f7fdff', '#d7f1fb', '#b7d4e4')
      : theme.kind === 'volcano'
        ? floorTexture('#3a241c', '#241410', '#ff6a22')
        : null;
  if (floorTex) {
    floorTex.repeat.set(900 / tileSize, 900 / tileSize);
    ground.material.map = floorTex;
    ground.material.color.set('#ffffff');
  }

  let sky = null;
  let sun = null;
  scene.traverse((obj) => {
    if (obj.userData?.isSky) sky = obj;
    if (obj.isDirectionalLight && obj.castShadow) sun = obj;
  });
  if (sky) sky.scale.setScalar(5.6);

  function addBox(chunk, box) {
    colliders.push(box);
    chunk.boxes.push(box);
  }

  function addCar(chunk, x, z, yaw, color) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.52, 3.35), stdMat(color, { roughness: 0.32, metalness: 0.28 }));
    body.position.y = 0.58;
    body.castShadow = true;
    body.receiveShadow = true;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.46, 1.45),
      stdMat('#d7ecff', { roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.72 }),
    );
    cabin.position.set(0, 1.02, -0.12);
    cabin.castShadow = true;
    root.add(body, cabin);
    const wheelMat = stdMat('#1c1c1c', { roughness: 0.7 });
    [[-0.72, 0.28, 1.05], [0.72, 0.28, 1.05], [-0.72, 0.28, -1.05], [0.72, 0.28, -1.05]].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      root.add(wheel);
    });
    chunk.group.add(root);
    const c = Math.abs(Math.cos(yaw));
    const s = Math.abs(Math.sin(yaw));
    const hx = 0.9 * c + 1.75 * s;
    const hz = 0.9 * s + 1.75 * c;
    addBox(chunk, { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
  }

  function addLamp(chunk, x, z, withLight) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.3, 6), stdMat('#3a4048', { metalness: 0.35, roughness: 0.4 }));
    pole.position.set(x, 1.65, z);
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), stdMat('#3a4048', { metalness: 0.35, roughness: 0.4 }));
    arm.position.set(x + 0.4, 3.25, z);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({
        color: theme.lamp,
        emissive: theme.lamp,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      }),
    );
    bulb.position.set(x + 0.78, 3.15, z);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshBasicMaterial({ color: theme.lamp, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    glow.position.copy(bulb.position);
    chunk.group.add(pole, arm, bulb, glow);
    addBox(chunk, { minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    if (withLight) {
      const light = new THREE.PointLight(theme.lamp, 1.35, 16, 2);
      light.position.set(x + 0.78, 3.15, z);
      lamps.push({ light, x, z, chunk });
    }
  }

  function addHouse(chunk, x, z, yaw) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.5, 3.5), stdMat(theme.house, { roughness: 0.8 }));
    wall.position.y = 1.25;
    wall.castShadow = true;
    wall.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.35, 4), stdMat(theme.roof, { roughness: 0.7 }));
    roof.position.y = 3.15;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.35, 0.08), stdMat('#6b3a22'));
    door.position.set(0, 0.68, 1.78);
    root.add(wall, roof, door);
    chunk.group.add(root);
    const c = Math.abs(Math.cos(yaw));
    const s = Math.abs(Math.sin(yaw));
    const hx = 2.2 * c + 1.75 * s;
    const hz = 2.2 * s + 1.75 * c;
    addBox(chunk, { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
  }

  function yawBox(chunk, x, z, yaw, hx, hz) {
    const c = Math.abs(Math.cos(yaw));
    const s = Math.abs(Math.sin(yaw));
    addBox(chunk, {
      minX: x - (hx * c + hz * s),
      maxX: x + (hx * c + hz * s),
      minZ: z - (hx * s + hz * c),
      maxZ: z + (hx * s + hz * c),
    });
  }

  function addShelf(chunk, x, z, yaw) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 3.2), iceMat);
    back.position.set(-0.45, 1.25, 0);
    root.add(back);
    (theme.food || ['#ff7aa2', '#ffe27a', '#7CFFB2']).forEach((color, row) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 3.1), iceMat);
      board.position.set(0, 0.42 + row * 0.72, 0);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.52), stdMat(color, { roughness: 0.5 }));
      box.position.set(0.08, 0.66 + row * 0.72, 0);
      root.add(board, box);
    });
    chunk.group.add(root);
    yawBox(chunk, x, z, yaw, 0.7, 1.9);
  }

  function addIce(chunk, x, z, rng) {
    const crystal = new THREE.Mesh(
      new THREE.ConeGeometry(0.16 + rng() * 0.14, 0.7 + rng() * 0.7, 5),
      iceMat,
    );
    crystal.position.set(x, 0.35 + rng() * 0.1, z);
    crystal.rotation.z = (rng() - 0.5) * 0.35;
    crystal.castShadow = true;
    chunk.group.add(crystal);
  }

  function addFluorescent(chunk, x, z) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 2.6),
      new THREE.MeshStandardMaterial({ color: '#f7fdff', emissive: '#e8fbff', emissiveIntensity: 1.5, roughness: 0.2 }),
    );
    bar.position.set(x, 3.15, z);
    chunk.group.add(bar);
    const light = new THREE.PointLight('#e7f7ff', 0.9, 14, 2);
    light.position.set(x, 3.05, z);
    lamps.push({ light, x, z, chunk });
  }

  function addSpire(chunk, x, z, rng) {
    const h = 1.6 + rng() * 1.8;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(0.45 + rng() * 0.35, h, 5), stdMat('#4a3028', { roughness: 0.95 }));
    rock.position.set(x, h * 0.45, z);
    rock.rotation.y = rng() * Math.PI;
    rock.castShadow = true;
    rock.receiveShadow = true;
    chunk.group.add(rock);
    addBox(chunk, { minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 });
  }

  function addLavaPool(chunk, x, z, radius) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(radius, 16), lavaMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.07, z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 6, 16), stdMat('#3a241c', { roughness: 0.92 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.14, z);
    chunk.group.add(pool, rim);
    addBox(chunk, { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius });
  }

  function addCounter(chunk, x, z, yaw) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.92, 3.4), stdMat(theme.house, { roughness: 0.72 }));
    cab.position.y = 0.46;
    cab.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.1, 3.55), steelMat);
    top.position.y = 0.97;
    const splash = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 3.4), stdMat('#f7f4ee', { roughness: 0.4 }));
    splash.position.set(-0.52, 1.28, 0);
    const sink = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.55), stdMat('#9fd7ea', { roughness: 0.15, metalness: 0.2 }));
    sink.position.set(0.1, 1.06, 0.4);
    root.add(cab, top, splash, sink);
    chunk.group.add(root);
    yawBox(chunk, x, z, yaw, 0.7, 1.85);
  }

  function addAppliance(chunk, x, z, yaw, rng) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
    const tall = rng() > 0.5;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, tall ? 2.15 : 1.15, 1.15),
      stdMat(tall ? '#f7f7f5' : '#5a616b', { roughness: 0.35, metalness: 0.4 }),
    );
    body.position.y = tall ? 1.08 : 0.58;
    body.castShadow = true;
    body.receiveShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, tall ? 1.5 : 0.7, 0.06), stdMat('#c8ccd2', { metalness: 0.45, roughness: 0.3 }));
    door.position.set(0, tall ? 1.05 : 0.55, 0.58);
    root.add(body, door);
    if (!tall) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.035, 6, 12),
        new THREE.MeshStandardMaterial({ color: '#ffb089', emissive: '#ff7a3a', emissiveIntensity: 0.8 }),
      );
      coil.rotation.x = Math.PI / 2;
      coil.position.set(0, 1.2, 0);
      root.add(coil);
    }
    chunk.group.add(root);
    yawBox(chunk, x, z, yaw, 0.7, 0.7);
  }

  function addJar(chunk, x, z, rng) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.55, 8),
      stdMat((theme.food || ['#ffe27a'])[Math.floor(rng() * (theme.food || ['#ffe27a']).length)], { roughness: 0.35, metalness: 0.05 }),
    );
    jar.position.set(x, 0.28, z);
    jar.castShadow = true;
    chunk.group.add(jar);
  }

  function addPendant(chunk, x, z) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5), steelMat);
    cord.position.set(x, 3.3, z);
    const shade = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: theme.lamp, emissive: theme.lamp, emissiveIntensity: 1.4, roughness: 0.25 }),
    );
    shade.position.set(x, 2.85, z);
    chunk.group.add(cord, shade);
    const light = new THREE.PointLight(theme.lamp, 0.85, 12, 2);
    light.position.set(x, 2.8, z);
    lamps.push({ light, x, z, chunk });
  }

  function scatterFoliage(chunk, rng, originX, originZ, cx, cz) {
    const leaves = [];
    const bushes = [];
    const trees = 2;
    for (let i = 0; i < trees; i += 1) {
      const x = originX + 4 + rng() * (CHUNK - 8);
      const z = originZ + 4 + rng() * (CHUNK - 8);
      if (chunk.blocked(x, z, 2.2)) continue;
      const s = 0.9 + rng() * 0.65;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 0.68 * s, z);
      trunk.scale.setScalar(s);
      trunk.castShadow = false;
      chunk.group.add(trunk);
      addBox(chunk, { minX: x - 0.28 * s, maxX: x + 0.28 * s, minZ: z - 0.28 * s, maxZ: z + 0.28 * s });
      const cards = 8;
      for (let c = 0; c < cards; c += 1) {
        dummy.position.set(
          x + (rng() - 0.5) * 0.9 * s,
          0.95 * s + rng() * 0.7 * s,
          z + (rng() - 0.5) * 0.9 * s,
        );
        dummy.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.5);
        dummy.scale.setScalar(0.7 * s + rng() * 0.55);
        dummy.updateMatrix();
        leaves.push(dummy.matrix.clone());
      }
    }
    const bushCount = 2;
    for (let i = 0; i < bushCount; i += 1) {
      const x = originX + 3 + rng() * (CHUNK - 6);
      const z = originZ + 3 + rng() * (CHUNK - 6);
      if (chunk.blocked(x, z, 1.4)) continue;
      for (let c = 0; c < 4; c += 1) {
        dummy.position.set(x + (rng() - 0.5) * 0.7, 0.15 + rng() * 0.25, z + (rng() - 0.5) * 0.7);
        dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.5);
        dummy.scale.setScalar(0.55 + rng() * 0.4);
        dummy.updateMatrix();
        bushes.push(dummy.matrix.clone());
      }
    }
    if (leaves.length) {
      const mesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
      paintInstances(mesh, leaves);
      mesh.boundingSphere = chunkSphere(cx, cz);
      chunk.group.add(mesh);
    }
    if (bushes.length) {
      const mesh = new THREE.InstancedMesh(leafGeo, bushMat, bushes.length);
      paintInstances(mesh, bushes);
      mesh.boundingSphere = chunkSphere(cx, cz);
      chunk.group.add(mesh);
    }
  }

  function fillGrid(chunk, originX, originZ, place) {
    const step = 10;
    for (let ix = 0; ix < 4; ix += 1) {
      for (let iz = 0; iz < 4; iz += 1) {
        const x = originX + step * 0.5 + ix * step;
        const z = originZ + step * 0.5 + iz * step;
        if (Math.hypot(x - 4, z - 6) < 5.5) continue;
        if (chunk.blocked(x, z, 1.2)) continue;
        place(x, z, ix, iz);
      }
    }
  }

  function dressFridge(chunk, rng, originX, originZ, rcx, rcz, vertical, horizontal) {
    const lay = (wide, tall) => {
      const path = new THREE.Mesh(new THREE.PlaneGeometry(wide, tall), walkMat);
      path.rotation.x = -Math.PI / 2;
      path.position.set(rcx, 0.035, rcz);
      path.receiveShadow = true;
      chunk.group.add(path);
    };
    if (vertical) {
      lay(6.2, CHUNK);
      [-12, 12].forEach((offset) => addFluorescent(chunk, rcx, rcz + offset));
      if (!horizontal) {
        addShelf(chunk, rcx - 5.5, rcz - 6, Math.PI / 2);
        addShelf(chunk, rcx + 5.5, rcz + 6, -Math.PI / 2);
      }
    }
    if (horizontal) {
      lay(CHUNK, 6.2);
      if (!vertical) {
        addShelf(chunk, rcx - 6, rcz - 5.5, 0);
        addShelf(chunk, rcx + 6, rcz + 5.5, Math.PI);
      }
    }
    fillGrid(chunk, originX, originZ, (x, z, ix, iz) => {
      if ((ix + iz) % 2 === 0) addShelf(chunk, x, z, ix % 2 === 0 ? 0 : Math.PI / 2);
      else addIce(chunk, x, z, rng);
    });
  }

  function dressVolcano(chunk, rng, originX, originZ, rcx, rcz, vertical, horizontal) {
    const lay = (wide, tall) => {
      const bank = new THREE.Mesh(new THREE.PlaneGeometry(wide, tall), roadMat);
      bank.rotation.x = -Math.PI / 2;
      bank.position.set(rcx, 0.03, rcz);
      bank.receiveShadow = true;
      const lavaWide = wide > tall ? wide * 0.55 : 1.7;
      const lavaTall = tall > wide ? tall * 0.55 : 1.7;
      const lava = new THREE.Mesh(new THREE.PlaneGeometry(lavaWide, lavaTall), lavaMat);
      lava.rotation.x = -Math.PI / 2;
      lava.position.set(rcx, 0.06, rcz);
      chunk.group.add(bank, lava);
    };
    if (vertical) lay(7.4, CHUNK);
    if (horizontal) lay(CHUNK, 7.4);
    if (vertical && horizontal) addLavaPool(chunk, rcx, rcz, 2.1);
    fillGrid(chunk, originX, originZ, (x, z, ix, iz) => {
      if ((ix + iz) % 3 === 0) addLavaPool(chunk, x, z, 1.15);
      else addSpire(chunk, x, z, rng);
    });
  }

  function dressKitchen(chunk, rng, originX, originZ, rcx, rcz, vertical, horizontal) {
    const lay = (wide, tall) => {
      const path = new THREE.Mesh(new THREE.PlaneGeometry(wide, tall), roadMat);
      path.rotation.x = -Math.PI / 2;
      path.position.set(rcx, 0.03, rcz);
      path.receiveShadow = true;
      chunk.group.add(path);
    };
    if (vertical) {
      lay(5.6, CHUNK);
      [-10, 10].forEach((offset) => addPendant(chunk, rcx, rcz + offset));
      if (!horizontal) {
        addCounter(chunk, rcx - 5.1, rcz - 5, Math.PI / 2);
        addCounter(chunk, rcx + 5.1, rcz + 6, -Math.PI / 2);
      }
    }
    if (horizontal) {
      lay(CHUNK, 5.6);
      if (!vertical) {
        addCounter(chunk, rcx - 5, rcz - 5.1, 0);
        addCounter(chunk, rcx + 6, rcz + 5.1, Math.PI);
        addPendant(chunk, rcx, rcz);
      }
    }
    fillGrid(chunk, originX, originZ, (x, z, ix, iz) => {
      const n = ix + iz;
      if (n % 3 === 0) addAppliance(chunk, x, z, ix % 2 === 0 ? 0 : Math.PI / 2, rng);
      else addCounter(chunk, x, z, iz % 2 === 0 ? 0 : Math.PI / 2);
      if (n % 2 === 0) addJar(chunk, x + 1.6, z, rng);
    });
  }

  function buildChunk(cx, cz) {
    const rng = makeRng((Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263) ^ (themeId.length * 97)) >>> 0);
    const originX = cx * CHUNK;
    const originZ = cz * CHUNK;
    const vertical = modRoad(cx);
    const horizontal = modRoad(cz);
    const rcx = originX + CHUNK / 2;
    const rcz = originZ + CHUNK / 2;
    const chunk = {
      group: new THREE.Group(),
      boxes: [],
      blocked(x, z, pad) {
        if (vertical && Math.abs(x - rcx) < 6.4 + pad) return true;
        if (horizontal && Math.abs(z - rcz) < 6.4 + pad) return true;
        return this.boxes.some((box) => x > box.minX - pad && x < box.maxX + pad && z > box.minZ - pad && z < box.maxZ + pad);
      },
    };
    scene.add(chunk.group);

    if (theme.kind === 'fridge') {
      dressFridge(chunk, rng, originX, originZ, rcx, rcz, vertical, horizontal);
      return chunk;
    }
    if (theme.kind === 'volcano') {
      dressVolcano(chunk, rng, originX, originZ, rcx, rcz, vertical, horizontal);
      return chunk;
    }
    if (theme.kind === 'kitchen') {
      dressKitchen(chunk, rng, originX, originZ, rcx, rcz, vertical, horizontal);
      return chunk;
    }

    if (vertical) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(7.4, CHUNK), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(rcx, 0.04, rcz);
      road.receiveShadow = true;
      const walkL = new THREE.Mesh(new THREE.PlaneGeometry(2.1, CHUNK), walkMat);
      walkL.rotation.x = -Math.PI / 2;
      walkL.position.set(rcx - 4.6, 0.025, rcz);
      const walkR = walkL.clone();
      walkR.position.x = rcx + 4.6;
      chunk.group.add(road, walkL, walkR);
      for (let i = 0; i < 4; i += 1) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 2.2), lineMat);
        dash.position.set(rcx, 0.07, originZ + 4 + i * 10);
        chunk.group.add(dash);
      }
      [-12, 12].forEach((offset) => addLamp(chunk, rcx + 5.5, rcz + offset, true));
      if (!horizontal && rng() > 0.42) {
        const side = rng() > 0.5 ? 1 : -1;
        addCar(chunk, rcx + side * 5.6, rcz + (rng() - 0.5) * 16, rng() > 0.5 ? 0 : Math.PI, theme.car[Math.floor(rng() * theme.car.length)]);
      }
    }
    if (horizontal) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK, 7.4), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(rcx, vertical ? 0.05 : 0.04, rcz);
      road.receiveShadow = true;
      const walkA = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK, 2.1), walkMat);
      walkA.rotation.x = -Math.PI / 2;
      walkA.position.set(rcx, 0.03, rcz - 4.6);
      const walkB = walkA.clone();
      walkB.position.z = rcz + 4.6;
      chunk.group.add(road, walkA, walkB);
      for (let i = 0; i < 4; i += 1) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.14), lineMat);
        dash.position.set(originX + 4 + i * 10, 0.08, rcz);
        chunk.group.add(dash);
      }
      if (!vertical) [-12, 12].forEach((offset) => addLamp(chunk, rcx + offset, rcz + 5.5, true));
      if (!vertical && rng() > 0.42) {
        const side = rng() > 0.5 ? 1 : -1;
        addCar(chunk, rcx + (rng() - 0.5) * 16, rcz + side * 5.6, rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2, theme.car[Math.floor(rng() * theme.car.length)]);
      }
    }
    if (vertical && horizontal) {
      for (let i = -2; i <= 2; i += 1) {
        const stripeV = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 1.3), lineMat);
        stripeV.position.set(rcx + i * 1.15, 0.09, rcz);
        const stripeH = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.02, 0.28), lineMat);
        stripeH.position.set(rcx, 0.09, rcz + i * 1.15);
        chunk.group.add(stripeV, stripeH);
      }
    }

    if (!vertical && !horizontal && rng() > 0.62) {
      addHouse(chunk, originX + 10 + rng() * 18, originZ + 10 + rng() * 18, rng() > 0.5 ? 0 : Math.PI / 2);
    }
    if (rng() > 0.45) {
      const x = originX + 6 + rng() * (CHUNK - 12);
      const z = originZ + 6 + rng() * (CHUNK - 12);
      if (!chunk.blocked(x, z, 1)) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + rng() * 0.35, 0), stdMat('#8d7568', { roughness: 0.95 }));
        rock.position.set(x, 0.32, z);
        rock.castShadow = true;
        rock.receiveShadow = true;
        chunk.group.add(rock);
        addBox(chunk, { minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
      }
    }
    if (rng() > 0.4) {
      const x = originX + rng() * CHUNK;
      const z = originZ + rng() * CHUNK;
      if (!chunk.blocked(x, z, 0.4)) {
        const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 8), stdMat('#3f6b45', { roughness: 0.6 }));
        bin.position.set(x, 0.35, z);
        bin.castShadow = true;
        chunk.group.add(bin);
        addBox(chunk, { minX: x - 0.34, maxX: x + 0.34, minZ: z - 0.34, maxZ: z + 0.34 });
      }
    }

    scatterFoliage(chunk, rng, originX, originZ, cx, cz);

    const step = 1.55;
    const cells = Math.ceil(CHUNK / step);
    const grass = new THREE.InstancedMesh(bladeGeo, grassMat, cells * cells);
    let count = 0;
    for (let ix = 0; ix < cells; ix += 1) {
      for (let iz = 0; iz < cells; iz += 1) {
        const x = originX + (ix + 0.5) * step + (rng() - 0.5) * step * 0.28;
        const z = originZ + (iz + 0.5) * step + (rng() - 0.5) * step * 0.28;
        if (chunk.blocked(x, z, 0.02)) continue;
        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1.85 + rng() * 0.35);
        dummy.updateMatrix();
        grass.setMatrixAt(count, dummy.matrix);
        count += 1;
      }
    }
    if (count > 0) {
      grass.count = count;
      grass.instanceMatrix.needsUpdate = true;
      grass.boundingSphere = chunkSphere(cx, cz);
      grass.castShadow = false;
      grass.receiveShadow = false;
      chunk.group.add(grass);
    } else {
      grass.dispose();
    }

    return chunk;
  }

  function dropChunk(key) {
    const chunk = chunks.get(key);
    if (!chunk) return;
    scene.remove(chunk.group);
    chunk.boxes.forEach((box) => {
      const index = colliders.indexOf(box);
      if (index >= 0) colliders.splice(index, 1);
    });
    for (let i = lamps.length - 1; i >= 0; i -= 1) {
      if (lamps[i].chunk === chunk) {
        scene.remove(lamps[i].light);
        lamps.splice(i, 1);
      }
    }
    chunk.group.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      if (obj.geometry === bladeGeo || obj.geometry === leafGeo || obj.geometry === trunkGeo || obj.geometry === wheelGeo) {
        if (obj.isInstancedMesh) obj.dispose();
        return;
      }
      obj.geometry.dispose();
    });
    chunks.delete(key);
  }

  function syncLights(px, pz) {
    const ranked = lamps
      .map((lamp) => ({ lamp, d: (lamp.x - px) ** 2 + (lamp.z - pz) ** 2 }))
      .sort((a, b) => a.d - b.d);
    const keep = new Set();
    ranked.forEach((item, index) => {
      if (index < 6 && item.d < 26 * 26) keep.add(item.lamp);
    });
    lamps.forEach((lamp) => {
      const on = keep.has(lamp);
      if (on && !lamp.light.parent) scene.add(lamp.light);
      if (!on && lamp.light.parent) scene.remove(lamp.light);
    });
  }

  function touchWind(mat, time, px, pz) {
    const shader = mat.userData.shader;
    if (!shader) return;
    shader.uniforms.uTime.value = time;
    shader.uniforms.uPlayer.value.set(px, pz);
  }

  return {
    update(time, _dt, pos) {
      const px = pos?.x || 0;
      const pz = pos?.z || 0;
      const cx = Math.floor(px / CHUNK);
      const cz = Math.floor(pz / CHUNK);
      const need = new Set();
      const missing = [];
      for (let x = cx - FAR; x <= cx + FAR; x += 1) {
        for (let z = cz - FAR; z <= cz + FAR; z += 1) {
          const key = `${x},${z}`;
          need.add(key);
          if (!chunks.has(key)) missing.push({ x, z, d: Math.max(Math.abs(x - cx), Math.abs(z - cz)) });
        }
      }
      missing.sort((a, b) => a.d - b.d);
      const budget = chunks.size === 0 ? missing.length : 2;
      for (let i = 0; i < budget && i < missing.length; i += 1) {
        const spot = missing[i];
        chunks.set(`${spot.x},${spot.z}`, buildChunk(spot.x, spot.z));
      }
      [...chunks.keys()].forEach((key) => {
        if (!need.has(key)) dropChunk(key);
      });

      const gx = Math.round(px / tile) * tile;
      const gz = Math.round(pz / tile) * tile;
      ground.position.set(gx, -0.04, gz);
      if (floorTex) {
        const repeat = 900 / tileSize;
        floorTex.offset.set(gx / tileSize - repeat * 0.5, -gz / tileSize + repeat * 0.5);
      }
      if (sky) sky.position.set(px, 0, pz);
      if (sun) {
        sun.position.set(px + 16, 28, pz + 10);
        sun.target.position.set(px, 0, pz);
      }
      syncLights(px, pz);
      touchWind(grassMat, time, px, pz);
      touchWind(leafMat, time, px, pz);
      touchWind(bushMat, time, px, pz);
    },
  };
}
