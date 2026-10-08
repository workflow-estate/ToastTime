import * as THREE from 'three';
import { dressScene, stdMat } from './lights.js';
import { rockTexture, lavaTexture, metalTexture } from './textures.js';
import { createToastActor, createOrbitRig } from './toast.js';
import { createEffects } from './effects.js';
import { createPowerMesh, spinPickup, POWER_INFO } from './pickups.js';
import { resolveCircle, keepInside } from './collision.js';
import { readMove, shiftDown } from './input.js';
import { clamp, lerpAngle, yawFromDir, forwardFromYaw } from './util.js';
import { getRunStats, getActivePower } from './save.js';
import { sfx } from './audio.js';

export const PARTY_ARENAS = [
  { id: 'colosseum', name: 'TOAST COLOSSEUM', desc: 'Stone pillars and a huge Toast battle ring.' },
  { id: 'castle', name: 'CRUMB CASTLE', desc: 'Towers, breadcrumb walls, and a castle courtyard.' },
  { id: 'rooftop', name: 'BREAKFAST ROOFTOP', desc: 'A rooftop arena high above Breakfast City.' },
  { id: 'lava', name: 'LAVA PLATE', desc: 'A volcanic plate surrounded by lava.' },
];

const PARTY_POWERS = ['speed', 'freeze', 'orbit', 'heal', 'shield', 'shockwave'];
const AI_SKINS = ['strawberry', 'blueberry', 'galaxy', 'avocado'];

function arenaLook(id) {
  if (id === 'lava') {
    return {
      background: '#2a100c', fog: '#5a2818', fogNear: 14, fogFar: 42,
      sky: '#ffb07a', ground: '#3a241c', sun: '#ffb060', sunIntensity: 1.3,
      skyTop: '#ff7a3a', skyBottom: '#2a120e', hemi: 0.55, shadowSpan: 24,
    };
  }
  if (id === 'rooftop') {
    return {
      background: '#8ec8ff', fog: '#d5e7f5', fogNear: 18, fogFar: 55,
      sky: '#e7f4ff', ground: '#6a7380', sun: '#fff2d2', sunIntensity: 1.4,
      skyTop: '#79c2ff', skyBottom: '#ffe7c4', hemi: 0.75, shadowSpan: 26,
    };
  }
  if (id === 'castle') {
    return {
      background: '#f0d7a8', fog: '#f3e0bf', fogNear: 16, fogFar: 46,
      sky: '#fff0d2', ground: '#c9843d', sun: '#fff1cc', sunIntensity: 1.35,
      skyTop: '#f2c98a', skyBottom: '#ffe7c0', hemi: 0.72, shadowSpan: 24,
    };
  }
  return {
    background: '#f6e2b8', fog: '#f8e6c4', fogNear: 16, fogFar: 46,
    sky: '#fff4dc', ground: '#d8b27a', sun: '#fff3d0', sunIntensity: 1.4,
    skyTop: '#f0d09a', skyBottom: '#fff6e2', hemi: 0.75, shadowSpan: 24,
  };
}

function buildArena(id) {
  const scene = new THREE.Scene();
  dressScene(scene, arenaLook(id));
  const colliders = [];
  const spec = { shape: 'rect', bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, radius: 12 };
  if (id === 'colosseum') {
    spec.shape = 'circle';
    spec.radius = 12.2;
    const sand = new THREE.Mesh(new THREE.CircleGeometry(12.4, 40), stdMat('#e6c48a', { roughness: 0.95 }));
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    scene.add(sand);
    const wall = new THREE.Mesh(new THREE.TorusGeometry(12.5, 0.55, 8, 40), stdMat('#c8b49a', { roughness: 0.8 }));
    wall.rotation.x = Math.PI / 2;
    wall.position.y = 0.7;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 10.2;
      const z = Math.sin(a) * 10.2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 3.4, 10), stdMat('#d9cbb8', { roughness: 0.75 }));
      pillar.position.set(x, 1.7, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 1.3), stdMat('#eee4d4'));
      cap.position.set(x, 3.45, z);
      cap.castShadow = true;
      scene.add(cap);
      colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7 });
    }
  } else if (id === 'castle') {
    spec.bounds = { minX: -13, maxX: 13, minZ: -13, maxZ: 13 };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), stdMat('#e7c48a', { roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const wallMat = stdMat('#f3d7a2', { roughness: 0.86 });
    const thick = 1;
    const segs = [
      [0, 13.4, 28, thick],
      [0, -13.4, 28, thick],
      [13.4, 0, thick, 26],
      [-13.4, 0, thick, 26],
    ];
    segs.forEach(([x, z, w, d]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d), wallMat);
      wall.position.set(x, 1.2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    });
    [[-11, -11], [11, -11], [-11, 11], [11, 11]].forEach(([x, z]) => {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 4.2, 10), stdMat('#c9843d'));
      tower.position.set(x, 2.1, z);
      tower.castShadow = true;
      tower.receiveShadow = true;
      scene.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.5, 10), stdMat('#a33b32'));
      roof.position.set(x, 4.6, z);
      roof.castShadow = true;
      scene.add(roof);
      colliders.push({ minX: x - 1.4, maxX: x + 1.4, minZ: z - 1.4, maxZ: z + 1.4 });
    });
  } else if (id === 'rooftop') {
    spec.bounds = { minX: -12, maxX: 12, minZ: -12, maxZ: 12 };
    const map = metalTexture().clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(4, 4);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), stdMat('#8b93a0', { map, roughness: 0.55, metalness: 0.25 }));
    roof.rotation.x = -Math.PI / 2;
    roof.receiveShadow = true;
    scene.add(roof);
    const railMat = stdMat('#d7dde6', { metalness: 0.5, roughness: 0.35 });
    for (let i = -11; i <= 11; i += 2) {
      [[i, 12], [i, -12], [12, i], [-12, i]].forEach(([x, z]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), railMat);
        post.position.set(x, 0.55, z);
        post.castShadow = true;
        scene.add(post);
      });
    }
    [[6, 4], [-5, -3]].forEach(([x, z]) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.1), stdMat('#c5ced8', { metalness: 0.4, roughness: 0.4 }));
      box.position.set(x, 0.5, z);
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
      colliders.push({ minX: x - 0.75, maxX: x + 0.75, minZ: z - 0.6, maxZ: z + 0.6 });
    });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 12), stdMat('#d0d7e0', { metalness: 0.45, roughness: 0.35 }));
    tank.position.set(-7, 0.8, 6);
    tank.castShadow = true;
    scene.add(tank);
    colliders.push({ minX: -8, maxX: -6, minZ: 5, maxZ: 7 });
    for (let i = 0; i < 10; i += 1) {
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(2 + (i % 3), 3 + (i % 4) * 1.4, 2),
        stdMat(i % 2 ? '#f0c9a0' : '#d7b08a'),
      );
      const side = i < 5 ? -1 : 1;
      building.position.set(-16 + (i % 5) * 4, 1.2, side * 20);
      scene.add(building);
    }
  } else {
    spec.shape = 'circle';
    spec.radius = 11.2;
    const lavaMat = new THREE.MeshStandardMaterial({
      color: '#ff4a12', emissive: '#ff6a18', emissiveIntensity: 0.85, roughness: 0.5, map: lavaTexture(),
    });
    const lava = new THREE.Mesh(new THREE.CircleGeometry(22, 32), lavaMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = -0.35;
    scene.add(lava);
    const map = rockTexture().clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 3);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(11.2, 11.6, 0.8, 32), stdMat('#5a382e', { map, roughness: 0.92 }));
    plate.position.y = 0.05;
    plate.receiveShadow = true;
    plate.castShadow = true;
    scene.add(plate);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), stdMat('#3a241c'));
      rock.position.set(Math.cos(a) * 8.5, 0.7, Math.sin(a) * 8.5);
      rock.castShadow = true;
      scene.add(rock);
      colliders.push({
        minX: rock.position.x - 0.55,
        maxX: rock.position.x + 0.55,
        minZ: rock.position.z - 0.55,
        maxZ: rock.position.z + 0.55,
      });
    }
    scene.userData.tick = (t) => { lavaMat.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.2; };
  }
  return { scene, colliders, spec };
}

function contain(pos, radius, arena) {
  if (arena.spec.shape === 'circle') {
    const d = Math.hypot(pos.x, pos.z) || 1;
    const max = arena.spec.radius - radius;
    if (d > max) {
      pos.x = (pos.x / d) * max;
      pos.z = (pos.z / d) * max;
    }
  } else {
    keepInside(pos, radius, arena.spec.bounds);
  }
  resolveCircle(pos, radius, arena.colliders);
}

export function createParty(hooks) {
  let arena = null;
  let camera = null;
  let effects = null;
  let player = null;
  let orbit = null;
  let bubble = null;
  let ais = [];
  let powers = [];
  let phase = 'playing';
  let hp = 3;
  let invuln = 0;
  let attackCd = 0;
  let elapsed = 0;
  let banner = 'FIGHT!';
  let bannerT = 1.4;
  let winner = '';
  let powerTimer = 2;
  let camYaw = 0;
  let shake = 0;
  let stats = null;
  let powerId = null;
  let dashCd = 0;
  let powerWasHeld = false;
  let shiftHeld = false;
  let blockFx = 0;
  let pendingAttack = false;
  let knockX = 0;
  let knockZ = 0;
  const buffs = { speed: 0, freeze: 0, orbit: 0, shield: 0 };
  const forward = { x: 0, z: 1 };
  const orbitSpots = [];
  const camTarget = new THREE.Vector3();

  function dispose() {
    if (!arena) return;
    arena.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose?.());
      }
    });
    arena = null;
  }

  function start(arenaId) {
    dispose();
    arena = buildArena(arenaId);
    effects = createEffects(arena.scene);
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
    const save = hooks.getSave();
    stats = getRunStats(save);
    powerId = getActivePower(save);
    dashCd = 0;
    powerWasHeld = false;
    player = createToastActor(save.selectedSkin);
    player.group.position.set(0, 0, 6);
    arena.scene.add(player.group);
    orbit = createOrbitRig();
    arena.scene.add(orbit.group);
    bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 12),
      new THREE.MeshStandardMaterial({
        color: '#9ae7ff', emissive: '#7ad2ff', emissiveIntensity: 0.4,
        transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    bubble.position.y = 0.9;
    bubble.visible = false;
    player.group.add(bubble);
    ais = AI_SKINS.map((skin, i) => {
      const actor = createToastActor(skin, { angry: true, keepColors: true });
      const ang = (i / AI_SKINS.length) * Math.PI * 2;
      const x = Math.cos(ang) * 5;
      const z = Math.sin(ang) * 5 - 1;
      actor.group.position.set(x, 0, z);
      arena.scene.add(actor.group);
      return {
        actor, x, z, yaw: 0, hp: 3, attackCd: 0.5 + i * 0.15, dead: false, dying: 0, knockX: 0, knockZ: 0, orbitHit: 0,
      };
    });
    powers = [];
    hp = 3;
    invuln = 0;
    attackCd = 0;
    elapsed = 0;
    phase = 'playing';
    winner = '';
    banner = 'FIGHT!';
    bannerT = 1.4;
    powerTimer = 1.5;
    camYaw = Math.PI;
    shake = 0;
    pendingAttack = false;
    knockX = 0;
    knockZ = 0;
    blockFx = 0;
    buffs.speed = 0;
    buffs.freeze = 0;
    buffs.orbit = 0;
    buffs.shield = 0;
    spawnPower();
  }

  function spawnPower() {
    if (!arena || powers.filter((p) => !p.got).length >= 3) return;
    const type = PARTY_POWERS[Math.floor(Math.random() * PARTY_POWERS.length)];
    const mesh = createPowerMesh(type);
    const ang = Math.random() * Math.PI * 2;
    const rad = 3 + Math.random() * 5;
    const spot = { x: Math.cos(ang) * rad, z: Math.sin(ang) * rad };
    contain(spot, 0.4, arena);
    mesh.position.set(spot.x, mesh.userData.baseY, spot.z);
    arena.scene.add(mesh);
    powers.push({ mesh, x: spot.x, z: spot.z, type, got: false });
  }

  function damagePlayer(amount, fromX, fromZ) {
    if (phase !== 'playing' || hp <= 0) return;
    if (powerId === 'block' && shiftHeld) {
      if (blockFx <= 0) {
        blockFx = 0.45;
        sfx.block();
        effects.floater(player.group.position, 'BLOCK', '#ffe7a0');
      }
      return;
    }
    if (invuln > 0) return;
    if (buffs.shield > 0) {
      buffs.shield = 0;
      sfx.block();
      effects.ring(player.group.position, '#9ae7ff');
      effects.floater(player.group.position, 'SHIELD', '#c8f4ff');
      invuln = 0.35;
      return;
    }
    const soaked = stats.armourLevel > 0 && Math.random() < stats.armourLevel * 0.12;
    if (soaked) {
      effects.floater(player.group.position, 'ARMOUR', '#ffe1a8');
      invuln = 0.35;
      return;
    }
    hp -= 1;
    invuln = 1.05;
    shake = 0.25;
    player.flash();
    player.triggerHop(0.25);
    sfx.hurt();
    effects.burst({ x: player.group.position.x, y: 1, z: player.group.position.z }, '#ff6d6d', 10, 2);
    if (fromX != null) {
      const dx = player.group.position.x - fromX;
      const dz = player.group.position.z - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      knockX = (dx / d) * 7;
      knockZ = (dz / d) * 7;
    }
    if (hp <= 0) {
      hp = 0;
      phase = 'lost';
      winner = 'them';
      banner = 'YOU LOST';
      sfx.lose();
    }
    void amount;
  }

  function hurtAi(ai, fromX, fromZ) {
    if (ai.dead || ai.dying > 0) return;
    ai.hp -= 1;
    ai.actor.flash();
    ai.actor.triggerHop(0.3);
    const dx = ai.x - fromX;
    const dz = ai.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    ai.knockX = (dx / d) * 8;
    ai.knockZ = (dz / d) * 8;
    effects.burst({ x: ai.x, y: 1, z: ai.z }, '#ffe1b0', 8, 2);
    sfx.hit();
    if (ai.hp <= 0) ai.dying = 0.4;
  }

  function shockwave() {
    effects.ring(player.group.position, '#ff7a3c');
    effects.burst(player.group.position, '#ffb15a', 16, 4);
    sfx.boss();
    const px = player.group.position.x;
    const pz = player.group.position.z;
    ais.forEach((ai) => {
      if (ai.dead || ai.dying > 0) return;
      if (Math.hypot(ai.x - px, ai.z - pz) < 4.6) hurtAi(ai, px, pz);
    });
  }

  function grant(type) {
    sfx.power();
    effects.floater(player.group.position, POWER_INFO[type].name, POWER_INFO[type].color);
    effects.ring(player.group.position, POWER_INFO[type].color);
    if (type === 'speed') buffs.speed = 5.5;
    if (type === 'freeze') buffs.freeze = 4;
    if (type === 'orbit') buffs.orbit = 8;
    if (type === 'heal') hp = Math.min(3, hp + 1);
    if (type === 'shield') buffs.shield = 6;
    if (type === 'shockwave') shockwave();
  }

  function tryAttack() {
    if (phase !== 'playing' || attackCd > 0) return;
    attackCd = 0.42;
    player.triggerAttack();
    sfx.kick();
    const px = player.group.position.x;
    const pz = player.group.position.z;
    forwardFromYaw(player.group.rotation.y, forward);
    const hx = px + forward.x * 0.95;
    const hz = pz + forward.z * 0.95;
    ais.forEach((ai) => {
      if (ai.dead || ai.dying > 0) return;
      if (Math.hypot(ai.x - hx, ai.z - hz) < 1.15) hurtAi(ai, px, pz);
    });
  }

  function partyInFront(x, z) {
    const px = player.group.position.x;
    const pz = player.group.position.z;
    forwardFromYaw(player.group.rotation.y, forward);
    const dx = x - px;
    const dz = z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2 || dist > 3.4) return false;
    return (dx / dist) * forward.x + (dz / dist) * forward.z > 0.4;
  }

  function usePartyPower(dt, input) {
    dashCd = Math.max(0, dashCd - dt);
    ais.forEach((ai) => { ai.burnHit = Math.max(0, (ai.burnHit || 0) - dt); });
    if (phase !== 'playing') return;
    if (powerId === 'burn' && shiftHeld) {
      if (!powerWasHeld) {
        effects.floater(player.group.position, 'BURN', '#ffb15a');
        sfx.power();
      }
      ais.forEach((ai) => {
        if (ai.dead || ai.dying > 0 || (ai.burnHit || 0) > 0) return;
        if (!partyInFront(ai.x, ai.z)) return;
        ai.burnHit = 0.75;
        hurtAi(ai, player.group.position.x, player.group.position.z);
        ai.knockX *= 0.25;
        ai.knockZ *= 0.25;
      });
    }
    if (powerId === 'freeze' && shiftHeld && !powerWasHeld) {
      effects.floater(player.group.position, 'FREEZE', '#c8f4ff');
      effects.ring(player.group.position, '#9ad8ff');
      sfx.power();
    }
    if (powerId === 'dash' && input.once('ShiftLeft') && dashCd <= 0) {
      dashCd = 1.55;
      forwardFromYaw(player.group.rotation.y, forward);
      const pos = player.group.position;
      const step = 3.4 / 6;
      for (let i = 0; i < 6; i += 1) {
        pos.x += forward.x * step;
        pos.z += forward.z * step;
        const body = { x: pos.x, z: pos.z };
        contain(body, 0.46, arena);
        pos.x = body.x;
        pos.z = body.z;
        ais.forEach((ai) => {
          if (ai.dead || ai.dying > 0 || ai.dashHit) return;
          if (Math.hypot(ai.x - pos.x, ai.z - pos.z) < 1.1) {
            ai.dashHit = true;
            hurtAi(ai, pos.x, pos.z);
          }
        });
      }
      ais.forEach((ai) => { ai.dashHit = false; });
      player.triggerHop(0.45);
      invuln = Math.max(invuln, 0.4);
      effects.floater(player.group.position, 'DASH', '#efe6ff');
      sfx.power();
    }
    powerWasHeld = shiftHeld && (powerId === 'burn' || powerId === 'freeze' || powerId === 'block');
  }

  function checkWin() {
    if (phase !== 'playing') return;
    if (ais.every((ai) => ai.dead || ai.hp <= 0)) {
      phase = 'won';
      winner = 'you';
      banner = 'YOU WIN!';
      sfx.win();
      effects.burst(player.group.position, '#ffd56a', 24, 4);
    }
  }

  function update(dt, input) {
    if (!arena) return;
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
    elapsed += dt;
    bannerT -= dt;
    if (bannerT <= 0 && phase === 'playing') banner = '';
    shiftHeld = shiftDown(input);
    blockFx = Math.max(0, blockFx - dt);
    shake = Math.max(0, shake - dt);
    if (arena.scene.userData.tick) arena.scene.userData.tick(elapsed, dt);

    if (phase === 'playing') {
      if (input.once('KeyF')) pendingAttack = true;
      if (pendingAttack) {
        pendingAttack = false;
        tryAttack();
      }
      usePartyPower(dt, input);
      const move = readMove(input);
      forwardFromYaw(camYaw, forward);
      const rx = -forward.z;
      const rz = forward.x;
      let mx = forward.x * move.forward + rx * move.strafe;
      let mz = forward.z * move.forward + rz * move.strafe;
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      knockX *= Math.max(0, 1 - dt * 6);
      knockZ *= Math.max(0, 1 - dt * 6);
      const speed = stats.speed * (buffs.speed > 0 ? 1.62 : 1);
      const pos = player.group.position;
      pos.x += mx * speed * dt + knockX * dt;
      pos.z += mz * speed * dt + knockZ * dt;
      const body = { x: pos.x, z: pos.z };
      contain(body, 0.46, arena);
      pos.x = body.x;
      pos.z = body.z;
      if (len > 0.1) {
        player.group.rotation.y = lerpAngle(player.group.rotation.y, yawFromDir(mx, mz), 1 - Math.exp(-12 * dt));
      }
      player.setMoving(len > 0.1);
      invuln = Math.max(0, invuln - dt);
      attackCd = Math.max(0, attackCd - dt);
      buffs.speed = Math.max(0, buffs.speed - dt);
      buffs.freeze = Math.max(0, buffs.freeze - dt);
      buffs.orbit = Math.max(0, buffs.orbit - dt);
      buffs.shield = Math.max(0, buffs.shield - dt);

      ais.forEach((ai) => {
        ai.orbitHit = Math.max(0, ai.orbitHit - dt);
        if (ai.dead) return;
        if (ai.dying > 0) {
          ai.dying -= dt;
          ai.actor.group.rotation.z += dt * 9;
          ai.actor.group.scale.setScalar(Math.max(0.01, ai.dying / 0.4));
          if (ai.dying <= 0) {
            ai.dead = true;
            ai.actor.group.visible = false;
            checkWin();
          }
          return;
        }
        const nearChill = powerId === 'freeze' && shiftHeld && Math.hypot(ai.x - pos.x, ai.z - pos.z) < 4.4;
        const frozen = buffs.freeze > 0 || nearChill;
        const dx = pos.x - ai.x;
        const dz = pos.z - ai.z;
        const dist = Math.hypot(dx, dz) || 1;
        ai.knockX *= Math.max(0, 1 - dt * 6);
        ai.knockZ *= Math.max(0, 1 - dt * 6);
        const spd = frozen ? 0.35 : 4.15;
        ai.x += (dx / dist) * spd * dt + ai.knockX * dt;
        ai.z += (dz / dist) * spd * dt + ai.knockZ * dt;
        const slot = { x: ai.x, z: ai.z };
        contain(slot, 0.46, arena);
        ai.x = slot.x;
        ai.z = slot.z;
        ai.actor.group.position.set(ai.x, 0, ai.z);
        ai.actor.group.rotation.y = yawFromDir(dx, dz);
        ai.actor.setMoving(!frozen);
        ai.actor.update(dt);
        if (powerId === 'block' && shiftHeld) {
          const away = Math.hypot(ai.x - pos.x, ai.z - pos.z) || 0.001;
          if (away < 1.55) {
            const nx = (ai.x - pos.x) / away;
            const nz = (ai.z - pos.z) / away;
            ai.x = pos.x + nx * 1.55;
            ai.z = pos.z + nz * 1.55;
            ai.knockX = nx * 8;
            ai.knockZ = nz * 8;
            ai.actor.group.position.set(ai.x, 0, ai.z);
          }
        }
        const hitDist = Math.hypot(ai.x - pos.x, ai.z - pos.z);
        ai.attackCd = Math.max(0, ai.attackCd - dt);
        if (!frozen && hitDist < 1.2 && ai.attackCd <= 0) {
          ai.attackCd = 1.15;
          ai.actor.triggerAttack();
          damagePlayer(1, ai.x, ai.z);
        }
      });

      if (buffs.orbit > 0) {
        orbit.ballPositions(orbitSpots);
        orbitSpots.forEach((spot) => {
          ais.forEach((ai) => {
            if (ai.dead || ai.dying > 0 || ai.orbitHit > 0) return;
            if (Math.hypot(ai.x - spot.x, ai.z - spot.z) < 0.95) {
              ai.orbitHit = 0.7;
              hurtAi(ai, spot.x, spot.z);
            }
          });
        });
      }

      powers.forEach((power) => {
        if (power.got) return;
        spinPickup(power.mesh, elapsed, 2);
        if (Math.hypot(power.x - pos.x, power.z - pos.z) < 1) {
          power.got = true;
          arena.scene.remove(power.mesh);
          grant(power.type);
        }
      });
      powerTimer -= dt;
      if (powerTimer <= 0) {
        powerTimer = Math.max(3.2, (stats.powerInterval || 8) * 0.62);
        spawnPower();
      }
      checkWin();
    } else {
      player.setMoving(false);
      ais.forEach((ai) => ai.actor.update(dt * 0.5));
    }

    player.setBlock(powerId === 'block' && shiftHeld && phase === 'playing');
    bubble.visible = buffs.shield > 0;
    if (buffs.shield > 0) bubble.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.04);
    player.group.visible = true;
    player.setBodyVisible(!(invuln > 0 && Math.sin(invuln * 28) <= 0));
    player.update(dt);
    orbit.setCount(buffs.orbit > 0 ? 3 : 0, '#4aa3ff');
    orbit.update(dt, player.group.position);
    effects.update(dt);

    camYaw = lerpAngle(camYaw, player.group.rotation.y, 1 - Math.exp(-3 * dt));
    forwardFromYaw(camYaw, forward);
    camTarget.set(
      player.group.position.x - forward.x * 7.2 + (Math.random() - 0.5) * shake,
      4.8,
      player.group.position.z - forward.z * 7.2,
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-4.5 * dt));
    camera.lookAt(player.group.position.x, 1, player.group.position.z);
  }

  function activePowers() {
    const list = [];
    if (buffs.speed > 0) list.push(`SPEED ${buffs.speed.toFixed(0)}s`);
    if (buffs.freeze > 0) list.push(`FREEZE ${buffs.freeze.toFixed(0)}s`);
    if (buffs.orbit > 0) list.push(`ORBIT ${buffs.orbit.toFixed(0)}s`);
    if (buffs.shield > 0) list.push(`SHIELD ${buffs.shield.toFixed(0)}s`);
    if (powerId === 'block' && shiftHeld) list.push('BLOCKING');
    if (powerId === 'burn' && shiftHeld) list.push('BURNING');
    if (powerId === 'freeze' && shiftHeld) list.push('FREEZING');
    if (powerId === 'dash' && dashCd > 0) list.push(`DASH ${dashCd.toFixed(0)}s`);
    return list.join('   ');
  }

  function getHud() {
    const alive = ais.filter((ai) => !ai.dead && ai.hp > 0).length;
    return {
      kind: 'party',
      phase: phase === 'won' || phase === 'lost' ? 'result' : 'playing',
      hp,
      maxHp: 3,
      alive,
      banner,
      powers: activePowers(),
      winner,
      arenaName: PARTY_ARENAS.find((a) => a.id === arenaId)?.name || 'PARTY',
    };
  }

  function getDebug() {
    return {
      hp,
      phase,
      alive: ais.filter((ai) => !ai.dead && ai.hp > 0).length,
      x: player ? Number(player.group.position.x.toFixed(2)) : 0,
      z: player ? Number(player.group.position.z.toFixed(2)) : 0,
      yaw: player ? Number(player.group.rotation.y.toFixed(2)) : 0,
      camYaw: Number(camYaw.toFixed(2)),
      powers: powers.filter((power) => !power.got).map((power) => power.type),
      powerSpots: powers.filter((power) => !power.got).map((power) => ({
        type: power.type, x: Number(power.x.toFixed(1)), z: Number(power.z.toFixed(1)),
      })),
      ais: ais.filter((ai) => !ai.dead && ai.hp > 0).map((ai) => ({
        x: Number(ai.x.toFixed(2)), z: Number(ai.z.toFixed(2)), hp: ai.hp,
      })),
    };
  }

  let arenaId = 'colosseum';
  return {
    get scene() { return arena ? arena.scene : null; },
    get camera() { return camera; },
    update,
    start(id) {
      arenaId = id;
      start(id);
    },
    dispose,
    getHud,
    getDebug,
    onClick() { if (phase === 'playing') pendingAttack = true; },
    look() {},
  };
}
