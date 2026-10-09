import * as THREE from 'three';
import { resolveCircle } from './collision.js';
import { yawFromDir } from './util.js';

const ICE = new THREE.Color('#8ecfff');
const CHAR = new THREE.Color('#3a140c');

function metal(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.38,
    metalness: 0.62,
    ...extras,
  });
}

export function createBoss(scene, x, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.85, 1.55), metal('#d5dbe3'));
  body.position.y = 1.35;
  const side = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.55, 1.25), metal('#c3cbd6'));
  side.position.y = 1.28;
  group.add(body, side);

  const slotMat = new THREE.MeshStandardMaterial({
    color: '#1a120e',
    emissive: '#ff5a18',
    emissiveIntensity: 0.85,
    roughness: 0.5,
  });
  [-0.45, 0.45].forEach((ox) => {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.9), slotMat);
    slot.position.set(ox, 2.22, 0);
    group.add(slot);
    const glow = new THREE.PointLight('#ff6a2a', 0.45, 3.5, 2);
    glow.position.set(ox, 2.3, 0.2);
    group.add(glow);
  });

  const leverPivot = new THREE.Group();
  leverPivot.position.set(1.25, 1.7, 0);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), metal('#8d959e'));
  lever.position.y = 0.25;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), metal('#ff5a4a', { emissive: '#ff5a4a', emissiveIntensity: 0.4, metalness: 0.2 }));
  knob.position.y = 0.62;
  leverPivot.add(lever, knob);
  group.add(leverPivot);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: '#ff2a2a',
    emissive: '#ff1a1a',
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  [-0.42, 0.42].forEach((ox) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.06), eyeMat);
    eye.position.set(ox, 1.58, 0.84);
    eye.rotation.z = ox > 0 ? -0.42 : 0.42;
    group.add(eye);
    const glow = new THREE.PointLight('#ff3030', 0.35, 2.2, 2);
    glow.position.set(ox, 1.58, 1.05);
    group.add(glow);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.06), metal('#1a1e24', { metalness: 0.2, roughness: 0.45 }));
    brow.position.set(ox, 1.78, 0.84);
    brow.rotation.z = ox > 0 ? -0.7 : 0.7;
    group.add(brow);
  });
  const grinMat = new THREE.MeshStandardMaterial({ color: '#1a100c', roughness: 0.4, metalness: 0.05 });
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 20, Math.PI), grinMat);
  grin.position.set(0, 1.22, 0.86);
  grin.rotation.z = Math.PI;
  group.add(grin);
  const toothMat = new THREE.MeshStandardMaterial({ color: '#fff8ee', roughness: 0.28 });
  for (let i = -3; i <= 3; i += 1) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.07, i % 2 === 0 ? 0.12 : 0.09, 0.05), toothMat);
    const along = i * 0.1;
    tooth.position.set(along, 1.08 - Math.abs(i) * 0.012, 0.9);
    tooth.rotation.z = along * 0.15;
    group.add(tooth);
  }

  [-0.55, 0.55].forEach((ox) => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.8), metal('#9aa3af'));
    foot.position.set(ox, 0.16, 0);
    group.add(foot);
  });

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  group.position.set(x, 6, z);
  scene.add(group);

  return {
    group,
    lever: leverPivot,
    slotMat,
    x,
    z,
    yaw: 0,
    y: 6,
    hp: 460,
    maxHp: 460,
    radius: 1.25,
    enter: 0.9,
    attackCd: 1.4,
    mode: 'enter',
    modeT: 0,
    hurtCd: 0,
    dead: false,
    dying: 0,
    knockX: 0,
    knockZ: 0,
    chargeX: 0,
    chargeZ: 0,
    meteors: [],
    meteorSpawned: false,
    mats: collectMats(group),
    scorch: 0,
    chill: 0,
    chilled: false,
  };
}

function collectMats(group) {
  const mats = [];
  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material || !obj.material.color) return;
    const m = obj.material;
    if (!m.userData.baseColor) {
      m.userData.baseColor = m.color.clone();
      m.userData.baseEmissive = m.emissive ? m.emissive.clone() : new THREE.Color(0x000000);
      m.userData.baseIntensity = m.emissiveIntensity || 0;
    }
    if (!mats.includes(m)) mats.push(m);
  });
  return mats;
}

function restoreMats(boss) {
  boss.mats.forEach((m) => {
    m.color.copy(m.userData.baseColor);
    if (m.emissive) {
      m.emissive.copy(m.userData.baseEmissive);
      m.emissiveIntensity = m.userData.baseIntensity;
    }
  });
}

function paintBoss(boss, dt, time) {
  if (boss.scorch > 0) {
    boss.scorch -= dt;
    const t = Math.max(0, boss.scorch / 0.55);
    const hit = Math.sin((1 - t) * Math.PI);
    boss.group.rotation.x = -0.32 * hit;
    boss.group.rotation.z = Math.sin(boss.scorch * 58) * 0.1 * t;
    boss.group.position.y += 0.22 * hit;
    boss.group.scale.set(1 + 0.06 * hit, 1 - 0.12 * hit, 1 + 0.06 * hit);
    boss.mats.forEach((m) => {
      if (t > 0.55) {
        m.color.set('#ff6a1a');
        if (m.emissive) {
          m.emissive.set('#ff3a00');
          m.emissiveIntensity = 1.1;
        }
      } else {
        m.color.copy(m.userData.baseColor).lerp(CHAR, 0.72);
        if (m.emissive) {
          m.emissive.set('#5a1a08');
          m.emissiveIntensity = 0.5;
        }
      }
    });
    if (boss.scorch <= 0) {
      boss.group.rotation.x = 0;
      boss.group.rotation.z = 0;
      boss.group.scale.setScalar(1);
      restoreMats(boss);
    }
    return;
  }
  boss.group.rotation.x = 0;
  const step = (boss.freezeOn ? 0.42 : 0.55) * dt;
  boss.chill = boss.freezeOn ? Math.min(1, boss.chill + step) : Math.max(0, boss.chill - step);
  if (boss.chill > 0) {
    boss.chilled = true;
    boss.group.rotation.z = Math.sin(time * 14) * 0.045 * boss.chill;
    boss.mats.forEach((m) => {
      m.color.copy(m.userData.baseColor).lerp(ICE, boss.chill * 0.88);
      if (m.emissive) {
        m.emissive.set('#c6f4ff');
        m.emissiveIntensity = m.userData.baseIntensity + boss.chill * 0.45;
      }
    });
  } else if (boss.chilled) {
    boss.chilled = false;
    boss.group.rotation.z = 0;
    restoreMats(boss);
  }
}

const meteorGeo = new THREE.DodecahedronGeometry(0.42, 0);
const meteorMat = new THREE.MeshStandardMaterial({
  color: '#6a4034',
  emissive: '#ff6a22',
  emissiveIntensity: 0.7,
  roughness: 0.55,
});
const meteorMarkMat = new THREE.MeshBasicMaterial({
  color: '#ffb15a',
  transparent: true,
  opacity: 0.75,
  side: THREE.DoubleSide,
  depthWrite: false,
});

function clearMeteors(boss) {
  boss.meteors.forEach((meteor) => {
    meteor.mesh.removeFromParent();
    meteor.mark.removeFromParent();
  });
  boss.meteors = [];
  boss.meteorSpawned = false;
}

function spawnMeteorWave(boss, ctx) {
  clearMeteors(boss);
  boss.meteorSpawned = true;
  for (let i = 0; i < 8; i += 1) {
    const ang = Math.random() * Math.PI * 2;
    const dist = i < 2 ? 0.6 + Math.random() * 1.4 : 1.8 + Math.random() * 7;
    const x = ctx.playerX + Math.cos(ang) * dist;
    const z = ctx.playerZ + Math.sin(ang) * dist;
    const mesh = new THREE.Mesh(meteorGeo, meteorMat);
    mesh.castShadow = true;
    mesh.position.set(x + (Math.random() - 0.5) * 1.4, 16 + Math.random() * 6, z);
    ctx.scene.add(mesh);
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.78, 20), meteorMarkMat);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(x, 0.07, z);
    ctx.scene.add(mark);
    boss.meteors.push({ mesh, mark, x, z, y: mesh.position.y, vy: 0, hit: false });
  }
  ctx.onMeteorStart();
}

export function updateBoss(boss, dt, ctx) {
  if (boss.dead) return;
  boss.hurtCd = Math.max(0, boss.hurtCd - dt);
  if (boss.dying > 0) {
    if (boss.meteors.length) clearMeteors(boss);
    boss.dying -= dt;
    boss.group.rotation.z += dt * 4;
    boss.group.position.y += dt * 0.4;
    const s = Math.max(0.01, boss.dying / 0.8);
    boss.group.scale.setScalar(s);
    if (boss.dying <= 0) {
      boss.dead = true;
      boss.group.visible = false;
      ctx.onDefeat();
    }
    return;
  }

  if (boss.mode === 'enter') {
    boss.enter -= dt;
    const t = 1 - Math.max(0, boss.enter) / 0.9;
    boss.y = (1 - t) * 6;
    boss.group.position.set(boss.x, boss.y, boss.z);
    boss.group.scale.setScalar(0.4 + 0.6 * t);
    if (boss.enter <= 0) {
      boss.mode = 'chase';
      boss.y = 0;
      boss.group.scale.setScalar(1);
    }
    return;
  }

  boss.modeT -= dt;
  boss.attackCd -= dt;
  boss.knockX *= Math.max(0, 1 - dt * 5);
  boss.knockZ *= Math.max(0, 1 - dt * 5);
  const dx = ctx.playerX - boss.x;
  const dz = ctx.playerZ - boss.z;
  const dist = Math.hypot(dx, dz) || 1;

  if (boss.mode === 'chase') {
    const speed = 3.15 * (ctx.frozen ? 0.15 : 1);
    boss.x += (dx / dist) * speed * dt + boss.knockX * dt;
    boss.z += (dz / dist) * speed * dt + boss.knockZ * dt;
    boss.yaw = yawFromDir(dx, dz);
    if (boss.attackCd <= 0) {
      const roll = Math.random();
      if (roll < 0.22) boss.mode = 'shot';
      else if (roll < 0.44) boss.mode = 'charge';
      else if (roll < 0.66) boss.mode = 'slam';
      else boss.mode = 'meteor';
      boss.modeT = boss.mode === 'charge' ? 0.55 : boss.mode === 'meteor' ? 2.4 : 0.42;
      boss.chargeX = dx / dist;
      boss.chargeZ = dz / dist;
      boss.meteorSpawned = false;
      ctx.onTelegraph(boss.mode);
    }
  } else if (boss.mode === 'shot') {
    boss.lever.rotation.z = Math.sin(boss.modeT * 20) * 0.4;
    if (boss.modeT <= 0) {
      ctx.onShoot(boss);
      boss.mode = 'chase';
      boss.attackCd = 1.55;
      boss.lever.rotation.z = 0;
    }
  } else if (boss.mode === 'charge') {
    if (boss.modeT > 0) {
      boss.group.position.x = boss.x + Math.sin(boss.modeT * 40) * 0.06;
    } else if (boss.modeT > -0.42) {
      boss.x += boss.chargeX * 13 * dt;
      boss.z += boss.chargeZ * 13 * dt;
      if (Math.hypot(ctx.playerX - boss.x, ctx.playerZ - boss.z) < boss.radius + 0.55) {
        ctx.onAttack(22, boss);
        boss.modeT = -1;
      }
    } else {
      boss.mode = 'chase';
      boss.attackCd = 1.7;
    }
  } else if (boss.mode === 'slam') {
    const hop = boss.modeT > 0 ? (0.42 - boss.modeT) * 2.2 : 0;
    boss.y = Math.max(0, hop);
    if (boss.modeT <= 0 && boss.modeT > -0.05) {
      ctx.onSlam(boss);
    }
    if (boss.modeT <= -0.35) {
      boss.mode = 'chase';
      boss.attackCd = 1.8;
      boss.y = 0;
    }
  } else if (boss.mode === 'meteor') {
    if (!boss.meteorSpawned) spawnMeteorWave(boss, ctx);
    let falling = false;
    boss.meteors.forEach((meteor) => {
      if (meteor.hit) return;
      falling = true;
      meteor.vy += 32 * dt;
      meteor.y -= meteor.vy * dt;
      meteor.mesh.position.y = meteor.y;
      meteor.mesh.rotation.x += dt * 5;
      meteor.mesh.rotation.y += dt * 3;
      const pulse = 0.9 + Math.sin(ctx.time * 14) * 0.15;
      meteor.mark.scale.setScalar(pulse);
      if (meteor.y <= 0.45) {
        meteor.hit = true;
        meteor.mesh.visible = false;
        meteor.mark.visible = false;
        ctx.onMeteor(meteor.x, meteor.z);
      }
    });
    if (!falling) {
      clearMeteors(boss);
      boss.mode = 'chase';
      boss.attackCd = 2.05;
      boss.y = 0;
    }
  }

  const pos = { x: boss.x, z: boss.z };
  resolveCircle(pos, boss.radius, ctx.colliders);
  boss.x = pos.x;
  boss.z = pos.z;
  boss.group.position.set(boss.x, boss.y, boss.z);
  boss.group.rotation.y = boss.yaw;
  boss.freezeOn = Boolean(ctx.frozen);
  if (boss.scorch <= 0 && boss.chill <= 0) {
    boss.slotMat.emissiveIntensity = 0.7 + Math.sin(ctx.time * 6) * 0.25;
  }
  paintBoss(boss, dt, ctx.time);

  if (boss.mode === 'chase' && dist < boss.radius + 0.5) {
    ctx.onTouch(16, boss);
  }
}

export function hurtBoss(boss, amount, fromX, fromZ, burn = false) {
  if (boss.dead || boss.dying > 0 || boss.mode === 'enter' || boss.hurtCd > 0) return false;
  boss.hp -= amount;
  boss.hurtCd = 0.12;
  if (burn) boss.scorch = 0.55;
  const dx = boss.x - fromX;
  const dz = boss.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  boss.knockX = (dx / d) * 4.5;
  boss.knockZ = (dz / d) * 4.5;
  boss.group.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.material.emissive) {
      obj.userData.flash = 1;
    }
  });
  if (boss.hp <= 0) boss.dying = 0.8;
  return true;
}

export function createCrumbShot() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#e7b56a', roughness: 0.6 }),
  );
  mesh.castShadow = true;
  const crust = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#c4843d', roughness: 0.55 }),
  );
  crust.scale.y = 0.7;
  mesh.add(crust);
  return mesh;
}
