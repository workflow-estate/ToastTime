import { Capacitor } from '@capacitor/core';
import * as THREE from 'three';
import { buildMap, buildThemedArena, getMapMeta } from './maps.js';
import { createToastActor, createOrbitRig } from './toast.js';
import { createEnemy, updateEnemy, hurtEnemy } from './enemies.js';
import { createBoss, updateBoss, hurtBoss, createCrumbShot } from './boss.js';
import { createEffects } from './effects.js';
import { createCoinMesh, createPowerMesh, updateCoin, spinPickup, POWER_INFO } from './pickups.js';
import { resolveCircle, findClearPoint, segmentHits } from './collision.js';
import { getRunStats, getActivePower } from './save.js';
import { readMove, shiftDown } from './input.js';
import { clamp, formatTime, lerpAngle, yawFromDir, forwardFromYaw } from './util.js';
import { sfx } from './audio.js';

const MAIN_POWERS = ['orbit', 'speed', 'shield', 'heal'];

export function createGame(hooks) {
  let world = null;
  let player = null;
  let orbit = null;
  let effects = null;
  let camera = null;
  let coins = [];
  let enemies = [];
  let powers = [];
  let shots = [];
  let boss = null;
  let stats = null;
  let saveSnap = null;
  let fps = false;
  let fpsYaw = 0;
  let fpsPitch = 0;
  let camYaw = 0;
  let shake = 0;
  let elapsed = 0;
  let score = 0;
  let hp = 100;
  let invuln = 0;
  let attackCd = 0;
  let phase = 'playing';
  let bossTimer = -1;
  let powerTimer = 1.2;
  let collected = 0;
  let kills = 0;
  let banner = '';
  let bannerT = 0;
  let custom = false;
  let mapName = '';
  let howTo = false;
  let pendingAttack = false;
  let victorySent = false;
  let powerId = null;
  let dashCd = 0;
  let powerWasHeld = false;
  const buffs = { orbit: 0, speed: 0, shield: 0 };
  const forward = { x: 0, z: 1 };
  const camTarget = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const head = new THREE.Vector3();
  const orbitSpots = [];

  function setBanner(text, time = 2.4) {
    banner = text;
    bannerT = time;
  }

  function disposeWorld() {
    if (effects) effects.clear();
    if (world) {
      world.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map && m.map.userData?.owned) m.map.dispose();
            m.dispose?.();
          });
        }
      });
    }
    world = null;
    player = null;
    boss = null;
    coins = [];
    enemies = [];
    powers = [];
    shots = [];
  }

  function boot(nextWorld, options) {
    disposeWorld();
    world = nextWorld;
    saveSnap = hooks.getSave();
    stats = getRunStats(saveSnap);
    powerId = getActivePower(saveSnap);
    dashCd = 0;
    powerWasHeld = false;
    custom = Boolean(options.custom);
    mapName = options.mapName || 'CUSTOM WORLD';
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.12, 1200);
    effects = createEffects(world.scene);
    player = createToastActor(saveSnap.selectedSkin, { angry: false });
    player.group.position.set(world.spawn.x, 0, world.spawn.z);
    player.group.rotation.y = world.spawn.yaw || 0;
    world.scene.add(player.group);
    orbit = createOrbitRig();
    world.scene.add(orbit.group);
    camYaw = world.spawn.yaw || 0;
    fpsYaw = camYaw;
    fpsPitch = 0;
    fps = false;
    hp = stats.maxHp;
    invuln = 0;
    attackCd = 0;
    elapsed = 0;
    score = 0;
    collected = 0;
    kills = 0;
    phase = 'playing';
    bossTimer = -1;
    powerTimer = 1.4;
    banner = '';
    bannerT = 0;
    shake = 0;
    pendingAttack = false;
    blockFx = 0;
    victorySent = false;
    buffs.orbit = 0;
    buffs.speed = 0;
    buffs.shield = 0;
    coins = world.coins.map((spot) => {
      const mesh = createCoinMesh();
      mesh.position.set(spot.x, mesh.userData.baseY, spot.z);
      world.scene.add(mesh);
      return { mesh, x: spot.x, z: spot.z, got: false };
    });
    enemies = world.enemies.map((spot) => createEnemy(world.scene, spot.x, spot.z));
    powers = [];
    shots = [];
    boss = null;
    ['orbit', 'shield', 'speed', 'heal'].forEach((type, i) => spawnPower(type, true, i));
    howTo = !custom;
    if (!howTo) setBanner(custom ? 'CUSTOM WORLD' : mapName, 2.2);
  }

  function dismissHowTo() {
    if (!howTo) return;
    howTo = false;
    setBanner(mapName, 2.2);
  }

  function spawnPower(type, preferFar = false, salt = 0) {
    if (!world) return;
    const avoid = { x: player.group.position.x, z: player.group.position.z, r: preferFar ? 5 : 3 };
    let spot = null;
    const hints = world.coins.length ? world.coins : [{ x: 4, z: 4 }, { x: -6, z: 2 }, { x: 3, z: -6 }, { x: -4, z: -5 }];
    const hint = hints[(Math.floor(elapsed * 10) + salt + powers.length) % hints.length];
    spot = findClearPoint(hint.x + salt, hint.z - salt, 0.6, world.colliders, world.bounds);
    if (!spot || (spot.x - avoid.x) ** 2 + (spot.z - avoid.z) ** 2 < avoid.r * avoid.r) {
      const span = world.bounds.maxX - world.bounds.minX;
      for (let i = 0; i < 20; i += 1) {
        const x = span > 400 ? avoid.x + (Math.random() - 0.5) * 28 : world.bounds.minX + 3 + Math.random() * (span - 6);
        const z = span > 400 ? avoid.z + (Math.random() - 0.5) * 28 : world.bounds.minZ + 3 + Math.random() * (world.bounds.maxZ - world.bounds.minZ - 6);
        const found = findClearPoint(x, z, 0.6, world.colliders, world.bounds);
        if (found && (found.x - avoid.x) ** 2 + (found.z - avoid.z) ** 2 > 9) {
          spot = found;
          break;
        }
      }
    }
    if (!spot) return;
    const mesh = createPowerMesh(type);
    mesh.position.set(spot.x, mesh.userData.baseY, spot.z);
    world.scene.add(mesh);
    powers.push({ mesh, x: spot.x, z: spot.z, type, got: false });
  }

  function damagePlayer(amount, fromX, fromZ) {
    if (phase !== 'playing' || hp <= 0) return;
    if (powerId === 'block' && shiftHeld) {
      if (blockFx <= 0) {
        blockFx = 0.45;
        sfx.block();
        effects.burst({ x: player.group.position.x, y: 1, z: player.group.position.z }, '#ffe08a', 8, 2);
        effects.floater(player.group.position, 'BLOCK', '#ffe7a0');
      }
      return;
    }
    if (invuln > 0) return;
    if (buffs.shield > 0) {
      buffs.shield = 0;
      sfx.block();
      effects.ring(player.group.position, '#9dffc4');
      effects.floater(player.group.position, 'SHIELD', '#b8ffd2');
      invuln = 0.4;
      return;
    }
    const dmg = Math.max(1, amount * stats.armourMultiplier);
    hp -= dmg;
    invuln = 1.15;
    shake = Math.min(0.45, shake + 0.18);
    player.flash();
    player.triggerHop(0.2);
    sfx.hurt();
    effects.burst({ x: player.group.position.x, y: 1, z: player.group.position.z }, '#ff6d6d', 10, 2.4);
    if (fromX != null) {
      const dx = player.group.position.x - fromX;
      const dz = player.group.position.z - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      knockX = (dx / d) * 6;
      knockZ = (dz / d) * 6;
    }
    if (hp <= 0) {
      hp = 0;
      phase = 'dead';
      sfx.lose();
      hooks.onScore(score);
      setBanner('YOU GOT TOASTED!', 6);
    }
  }

  let shiftHeld = false;
  let blockFx = 0;
  let knockX = 0;
  let knockZ = 0;

  function tryAttack() {
    if (phase !== 'playing' || attackCd > 0) return;
    attackCd = 0.46;
    player.triggerAttack();
    sfx.kick();
    const px = player.group.position.x;
    const pz = player.group.position.z;
    forwardFromYaw(player.group.rotation.y, forward);
    const hx = px + forward.x * 0.95;
    const hz = pz + forward.z * 0.95;
    enemies.forEach((enemy) => {
      if (enemy.dead || enemy.dying > 0) return;
      if (Math.hypot(enemy.x - hx, enemy.z - hz) < 1.05) {
        hurtEnemy(enemy, 8, px, pz);
        effects.burst({ x: enemy.x, y: 1, z: enemy.z }, '#ffe1b0', 8, 2);
        sfx.hit();
        awardEnemy(enemy);
      }
    });
    if (boss && !boss.dead && boss.mode !== 'enter') {
      if (Math.hypot(boss.x - hx, boss.z - hz) < boss.radius + 0.7) {
        if (hurtBoss(boss, 8, px, pz)) {
          sfx.hit();
          effects.burst({ x: boss.x, y: 1.4, z: boss.z }, '#ffd0a8', 10, 2);
          shake = Math.min(0.4, shake + 0.08);
        }
      }
    }
  }

  function grantPower(type) {
    sfx.power();
    effects.floater(player.group.position, POWER_INFO[type].name, POWER_INFO[type].color);
    effects.ring(player.group.position, POWER_INFO[type].color);
    if (type === 'orbit') buffs.orbit = 12;
    if (type === 'speed') buffs.speed = 8;
    if (type === 'shield') buffs.shield = 7;
    if (type === 'heal') {
      hp = Math.min(stats.maxHp, hp + 34);
      effects.burst(player.group.position, '#7dffb0', 14, 2);
    }
  }

  function collectCoin(coin) {
    coin.got = true;
    collected += 1;
    score += 25;
    hooks.onCoins(1);
    hooks.onScore(score);
    sfx.coin();
    effects.burst({ x: coin.x, y: 0.8, z: coin.z }, '#ffd56a', 14, 3);
    effects.floater({ x: coin.x, y: 1, z: coin.z }, '+1', '#ffe08a');
    world.scene.remove(coin.mesh);
    if (collected >= coins.length && coins.length > 0 && !boss && bossTimer < 0) {
      bossTimer = 1.6;
      setBanner('BOSS TOASTER INCOMING!', 2.2);
      sfx.boss();
    }
  }

  function summonBoss() {
    const span = world.bounds.maxX - world.bounds.minX;
    const px = player.group.position.x;
    const pz = player.group.position.z;
    const sx = span > 400 ? px + 8 : world.spawn.x;
    const sz = span > 400 ? pz - 10 : world.spawn.z - 8;
    const spot = findClearPoint(sx, sz, 1.3, world.colliders, world.bounds) || { x: 0, z: 0 };
    boss = createBoss(world.scene, spot.x, spot.z);
    setBanner('THE BOSS TOASTER!', 2.4);
    shake = 0.35;
  }

  function awardEnemy(enemy) {
    if (enemy.hp > 0 || enemy.awarded) return;
    enemy.awarded = true;
    kills += 1;
    effects.burst({ x: enemy.x, y: 1, z: enemy.z }, '#ffb089', 16, 3);
    effects.floater({ x: enemy.x, y: 1.2, z: enemy.z }, '+40', '#fff1c4');
  }

  function syncScore() {
    score = collected * 25 + kills * 40 + Math.floor(elapsed) * 2 + (boss && boss.dead ? 500 : 0);
  }

  function inFront(x, z, range, dotNeed) {
    const px = player.group.position.x;
    const pz = player.group.position.z;
    const yaw = fps ? fpsYaw : player.group.rotation.y;
    forwardFromYaw(yaw, forward);
    const dx = x - px;
    const dz = z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2 || dist > range) return false;
    return (dx / dist) * forward.x + (dz / dist) * forward.z > dotNeed;
  }

  function scorch() {
    const px = player.group.position.x;
    const pz = player.group.position.z;
    enemies.forEach((enemy) => {
      if (enemy.dead || enemy.dying > 0) return;
      if ((enemy.burnHit || 0) > 0 || !inFront(enemy.x, enemy.z, 3.5, 0.45)) return;
      enemy.burnHit = 0.55;
      if (hurtEnemy(enemy, 8, px, pz)) {
        enemy.knockX *= 0.2;
        enemy.knockZ *= 0.2;
        effects.burst({ x: enemy.x, y: 1, z: enemy.z }, '#ff7a2a', 8, 2.2);
      }
    });
    if (boss && !boss.dead && (boss.burnHit || 0) <= 0 && inFront(boss.x, boss.z, 4.2, 0.35)) {
      boss.burnHit = 0.55;
      if (hurtBoss(boss, 14, px, pz)) effects.burst({ x: boss.x, y: 1.4, z: boss.z }, '#ff7a2a', 10, 2.4);
    }
  }

  function dashForward() {
    const yaw = fps ? fpsYaw : player.group.rotation.y;
    forwardFromYaw(yaw, forward);
    const pos = player.group.position;
    const step = 3.5 / 6;
    for (let i = 0; i < 6; i += 1) {
      pos.x += forward.x * step;
      pos.z += forward.z * step;
      const body = { x: pos.x, z: pos.z };
      resolveCircle(body, 0.46, world.colliders);
      pos.x = body.x;
      pos.z = body.z;
      enemies.forEach((enemy) => {
        if (enemy.dead || enemy.dying > 0 || enemy.dashHit) return;
        if (Math.hypot(enemy.x - pos.x, enemy.z - pos.z) < 1.15) {
          enemy.dashHit = true;
          hurtEnemy(enemy, 16, pos.x, pos.z);
          effects.burst({ x: enemy.x, y: 1, z: enemy.z }, '#d7c6ff', 8, 2);
        }
      });
      if (boss && !boss.dead && !boss.dashHit && Math.hypot(boss.x - pos.x, boss.z - pos.z) < (boss.radius || 1.2) + 0.4) {
        boss.dashHit = true;
        hurtBoss(boss, 22, pos.x, pos.z);
      }
    }
    enemies.forEach((enemy) => { enemy.dashHit = false; });
    if (boss) boss.dashHit = false;
    player.triggerHop(0.45);
    invuln = Math.max(invuln, 0.4);
    effects.floater(player.group.position, 'DASH', '#efe6ff');
    sfx.power();
  }

  function useSkinPower(dt, input) {
    dashCd = Math.max(0, dashCd - dt);
    enemies.forEach((enemy) => { enemy.burnHit = Math.max(0, (enemy.burnHit || 0) - dt); });
    if (boss) boss.burnHit = Math.max(0, (boss.burnHit || 0) - dt);
    if (powerId === 'burn' && shiftHeld) {
      if (!powerWasHeld) {
        effects.floater(player.group.position, 'BURN', '#ffb15a');
        sfx.power();
      }
      scorch();
    }
    if (powerId === 'freeze' && shiftHeld && !powerWasHeld) {
      effects.floater(player.group.position, 'FREEZE', '#c8f4ff');
      effects.ring(player.group.position, '#9ad8ff');
      sfx.power();
    }
    if (powerId === 'dash' && input.once('ShiftLeft') && dashCd <= 0) {
      dashCd = 1.55;
      dashForward();
    }
    powerWasHeld = shiftHeld && (powerId === 'burn' || powerId === 'freeze' || powerId === 'block');
  }

  function update(dt, input) {
    if (!world || !player || phase === 'idle') return;
    resizeCamera();
    elapsed += phase === 'playing' && !howTo ? dt : 0;
    bannerT -= dt;
    if (bannerT <= 0) banner = '';
    shiftHeld = shiftDown(input);
    blockFx = Math.max(0, blockFx - dt);
    if (phase === 'playing' && !howTo) {
      if (input.once('Space')) toggleCamera();
      if (input.once('KeyF')) pendingAttack = true;
      if (pendingAttack) {
        pendingAttack = false;
        tryAttack();
      }
      useSkinPower(dt, input);
      movePlayer(dt, input);
      updatePickups(dt);
      updateCombat(dt);
      updateShots(dt);
      if (bossTimer > 0) {
        bossTimer -= dt;
        if (bossTimer <= 0) summonBoss();
      }
      if (boss) {
        updateBoss(boss, dt, {
          playerX: player.group.position.x,
          playerZ: player.group.position.z,
          frozen: powerId === 'freeze' && shiftHeld && Math.hypot(player.group.position.x - boss.x, player.group.position.z - boss.z) < 6.5,
          colliders: world.colliders,
          time: elapsed,
          onAttack: (amount, source) => damagePlayer(amount, source.x, source.z),
          onTouch: (amount, source) => damagePlayer(amount, source.x, source.z),
          onShoot: (source) => {
            const mesh = createCrumbShot();
            const dirx = player.group.position.x - source.x;
            const dirz = player.group.position.z - source.z;
            const d = Math.hypot(dirx, dirz) || 1;
            mesh.position.set(source.x, 1.4, source.z);
            world.scene.add(mesh);
            shots.push({ mesh, x: source.x, z: source.z, y: 1.4, vx: (dirx / d) * 11, vz: (dirz / d) * 11, life: 4, damage: 18 });
          },
          onSlam: (source) => {
            effects.ring({ x: source.x, z: source.z }, '#ff7a3a');
            shake = 0.3;
            sfx.boss();
            if (Math.hypot(player.group.position.x - source.x, player.group.position.z - source.z) < 4.3) {
              damagePlayer(20, source.x, source.z);
            }
          },
          onMeteorStart: () => {
            sfx.boss();
            setBanner('METEOR RAIN!', 1.6);
          },
          onMeteor: (x, z) => {
            effects.burst({ x, y: 0.5, z }, '#ff7a3a', 16, 3.4);
            effects.ring({ x, z }, '#ffb15a');
            shake = Math.min(0.4, shake + 0.16);
            if (Math.hypot(player.group.position.x - x, player.group.position.z - z) < 1.85) {
              damagePlayer(16, x, z);
            }
          },
          scene: world.scene,
          onTelegraph: () => {},
          onDefeat: () => {
            if (victorySent) return;
            victorySent = true;
            phase = 'won';
            score += 500;
            hooks.onScore(score);
            hooks.onVictory();
            sfx.win();
            effects.burst({ x: boss.x, y: 1.5, z: boss.z }, '#ffd56a', 28, 4);
            setBanner('TOASTER POPPED!', 4);
          },
        });
        if (powerId === 'block' && shiftHeld && boss && !boss.dead) pushFromShield(boss, boss.radius || 1.25);
      }
      syncScore();
      hooks.onScore(score);
    }
    player.setBlock(powerId === 'block' && shiftHeld && phase === 'playing');
    player.update(phase === 'playing' ? dt : dt * 0.2);
    orbit.setCount(buffs.orbit > 0 ? 3 : 0, '#4aa3ff');
    orbit.update(dt, player.group.position);
    effects.update(dt);
    if (world.update) world.update(elapsed, dt, player.group.position);
    updateCamera(dt, input);
    shake = Math.max(0, shake - dt * 0.8);
  }

  function movePlayer(dt, input) {
    const move = readMove(input);
    const speed = stats.speed * (buffs.speed > 0 ? 1.45 : 1);
    let basisYaw = fps ? fpsYaw : camYaw;
    forwardFromYaw(basisYaw, forward);
    const rx = -forward.z;
    const rz = forward.x;
    let mx = forward.x * move.forward + rx * move.strafe;
    let mz = forward.z * move.forward + rz * move.strafe;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    knockX *= Math.max(0, 1 - dt * 7);
    knockZ *= Math.max(0, 1 - dt * 7);
    const pos = player.group.position;
    pos.x += mx * speed * dt + knockX * dt;
    pos.z += mz * speed * dt + knockZ * dt;
    const body = { x: pos.x, z: pos.z };
    resolveCircle(body, 0.46, world.colliders);
    pos.x = body.x;
    pos.z = body.z;
    const moving = len > 0.1;
    if (moving) {
      const desired = yawFromDir(mx, mz);
      const next = lerpAngle(player.group.rotation.y, desired, 1 - Math.exp(-12 * dt));
      player.group.rotation.y = Math.atan2(Math.sin(next), Math.cos(next));
      if (Math.random() < dt * 8) effects.glowPuff({ x: pos.x, y: 0.15, z: pos.z }, '#f3e2c4', 0.35);
    }
    player.setMoving(moving);
    invuln = Math.max(0, invuln - dt);
    attackCd = Math.max(0, attackCd - dt);
    const showBody = !fps && !(invuln > 0 && Math.sin(invuln * 28) <= 0);
    player.setBodyVisible(showBody);
    buffs.orbit = Math.max(0, buffs.orbit - dt);
    buffs.speed = Math.max(0, buffs.speed - dt);
    buffs.shield = Math.max(0, buffs.shield - dt);
    player.group.visible = true;
  }

  function updatePickups(dt) {
    const px = player.group.position.x;
    const pz = player.group.position.z;
    coins.forEach((coin) => {
      if (coin.got) return;
      updateCoin(coin.mesh, elapsed);
      const dist = Math.hypot(coin.x - px, coin.z - pz);
      if (stats.magnet > 0 && dist < stats.magnet && dist > 0.2) {
        const pull = (stats.magnet - dist) * dt * 2.2;
        coin.x += ((px - coin.x) / dist) * pull;
        coin.z += ((pz - coin.z) / dist) * pull;
        coin.mesh.position.x = coin.x;
        coin.mesh.position.z = coin.z;
      }
      if (dist < 0.9) collectCoin(coin);
    });
    powers.forEach((power) => {
      if (power.got) return;
      spinPickup(power.mesh, elapsed, 2.2);
      if (Math.hypot(power.x - px, power.z - pz) < 1) {
        power.got = true;
        world.scene.remove(power.mesh);
        grantPower(power.type);
      }
    });
    powerTimer -= dt;
    const alivePowers = powers.filter((p) => !p.got).length;
    if (powerTimer <= 0 && alivePowers < 4 && phase === 'playing') {
      powerTimer = stats.powerInterval;
      spawnPower(MAIN_POWERS[Math.floor(Math.random() * MAIN_POWERS.length)]);
    }
  }

  function pushFromShield(entity, radius) {
    const px = player.group.position.x;
    const pz = player.group.position.z;
    const dx = entity.x - px;
    const dz = entity.z - pz;
    const dist = Math.hypot(dx, dz) || 0.001;
    const limit = 1.4 + radius;
    if (dist >= limit) return;
    const nx = dx / dist;
    const nz = dz / dist;
    entity.x = px + nx * limit;
    entity.z = pz + nz * limit;
    entity.knockX = nx * 8;
    entity.knockZ = nz * 8;
    if (entity.actor) entity.actor.group.position.set(entity.x, entity.actor.group.position.y, entity.z);
    else if (entity.group) entity.group.position.set(entity.x, entity.group.position.y, entity.z);
  }

  function updateCombat(dt) {
    const px = player.group.position.x;
    const pz = player.group.position.z;
    enemies.forEach((enemy) => {
      updateEnemy(enemy, dt, {
        playerX: px,
        playerZ: pz,
        colliders: world.colliders,
        bounds: world.bounds,
        frozen: powerId === 'freeze' && shiftHeld && Math.hypot(enemy.x - px, enemy.z - pz) < 4.6,
        onAttack: (source, amount) => damagePlayer(amount, source.x, source.z),
      });
      awardEnemy(enemy);
      enemy.orbitHit = Math.max(0, (enemy.orbitHit || 0) - dt);
      if (enemy.dead && !boss && bossTimer < 0) {
        enemy.respawn = (enemy.respawn ?? 7) - dt;
        if (enemy.respawn <= 0) {
          const span = world.bounds.maxX - world.bounds.minX;
          const ang = Math.random() * Math.PI * 2;
          const away = 16 + Math.random() * 12;
          const spot = findClearPoint(
            span > 400 ? px + Math.cos(ang) * away : world.bounds.minX + Math.random() * span,
            span > 400 ? pz + Math.sin(ang) * away : world.bounds.minZ + Math.random() * (world.bounds.maxZ - world.bounds.minZ),
            0.7,
            world.colliders,
            world.bounds,
          );
          if (spot && Math.hypot(spot.x - px, spot.z - pz) > 8) {
            enemy.x = spot.x;
            enemy.z = spot.z;
            enemy.hp = enemy.maxHp;
            enemy.dead = false;
            enemy.dying = 0;
            enemy.awarded = false;
            enemy.respawn = 0;
            enemy.actor.group.visible = true;
            enemy.actor.group.scale.setScalar(1);
            enemy.actor.group.rotation.z = 0;
            enemy.actor.group.position.set(spot.x, 0, spot.z);
          } else {
            enemy.respawn = 1;
          }
        }
      }
    });
    for (let i = 0; i < enemies.length; i += 1) {
      const a = enemies[i];
      if (a.dead) continue;
      const pdx = a.x - px;
      const pdz = a.z - pz;
      const pd = Math.hypot(pdx, pdz);
      if (pd > 0.001 && pd < 1.05) {
        a.x += (pdx / pd) * (1.05 - pd);
        a.z += (pdz / pd) * (1.05 - pd);
      }
      for (let j = i + 1; j < enemies.length; j += 1) {
        const b = enemies[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 1.2) {
          const push = (1.2 - d) / d * 0.5;
          a.x -= dx * push;
          a.z -= dz * push;
          b.x += dx * push;
          b.z += dz * push;
        }
      }
      const slot = { x: a.x, z: a.z };
      resolveCircle(slot, a.radius, world.colliders);
      a.x = slot.x;
      a.z = slot.z;
      a.actor.group.position.x = a.x;
      a.actor.group.position.z = a.z;
    }
    if (powerId === 'block' && shiftHeld) {
      enemies.forEach((enemy) => {
        if (!enemy.dead) pushFromShield(enemy, enemy.radius || 0.46);
      });
    }
    if (buffs.orbit > 0) {
      orbit.ballPositions(orbitSpots);
      orbitSpots.forEach((spot) => {
        enemies.forEach((enemy) => {
          if (enemy.dead || enemy.dying > 0 || enemy.orbitHit > 0) return;
          if (Math.hypot(enemy.x - spot.x, enemy.z - spot.z) < 0.9) {
            enemy.orbitHit = 0.32;
            hurtEnemy(enemy, stats.orbitDamage, spot.x, spot.z);
            effects.burst({ x: enemy.x, y: 1, z: enemy.z }, '#8ec5ff', 8, 2);
            sfx.hit();
            awardEnemy(enemy);
          }
        });
        if (boss && !boss.dead && boss.mode !== 'enter' && (boss.orbitHit || 0) <= 0) {
          if (Math.hypot(boss.x - spot.x, boss.z - spot.z) < boss.radius + 0.35) {
            boss.orbitHit = 0.28;
            if (hurtBoss(boss, stats.orbitDamage, spot.x, spot.z)) {
              effects.burst({ x: boss.x, y: 1.5, z: boss.z }, '#8ec5ff', 8, 2);
              sfx.hit();
            }
          }
        }
      });
      if (boss) boss.orbitHit = Math.max(0, (boss.orbitHit || 0) - dt);
    }
  }

  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i -= 1) {
      const shot = shots[i];
      shot.life -= dt;
      const nx = shot.x + shot.vx * dt;
      const nz = shot.z + shot.vz * dt;
      if (segmentHits(shot.x, shot.z, nx, nz, world.colliders) || shot.life <= 0) {
        world.scene.remove(shot.mesh);
        shots.splice(i, 1);
        continue;
      }
      shot.x = nx;
      shot.z = nz;
      shot.mesh.position.set(shot.x, shot.y, shot.z);
      shot.mesh.rotation.y += dt * 6;
      if (Math.hypot(shot.x - player.group.position.x, shot.z - player.group.position.z) < 0.7) {
        damagePlayer(shot.damage, shot.x, shot.z);
        effects.burst({ x: shot.x, y: 1, z: shot.z }, '#ffb15a', 8, 2);
        world.scene.remove(shot.mesh);
        shots.splice(i, 1);
      }
    }
  }

  function updateCamera(dt) {
    const pos = player.group.position;
    if (fps) {
      player.setBodyVisible(false);
      player.setBlockShown(false);
      const bob = player.anim.moving ? Math.abs(Math.sin(elapsed * 8.2)) * 0.028 : 0;
      head.set(pos.x, 1.38 + bob, pos.z);
      camera.position.copy(head);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = fpsYaw + Math.PI;
      camera.rotation.x = fpsPitch;
      camera.rotation.z = 0;
      if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake * 0.6;
      }
      return;
    }
    if (phase === 'playing') {
      player.group.visible = true;
      player.setBlockShown(true);
      player.setBodyVisible(!(invuln > 0 && Math.sin(invuln * 28) <= 0));
    }
    const follow = lerpAngle(camYaw, player.group.rotation.y, 1 - Math.exp(-3.1 * dt));
    camYaw = follow;
    let dist = 8.3;
    const height = 5.1;
    forwardFromYaw(camYaw, forward);
    const rx = forward.z;
    const rz = -forward.x;
    let cx = pos.x - forward.x * dist + rx * 2.5;
    let cz = pos.z - forward.z * dist + rz * 2.5;
    if (segmentHits(pos.x, pos.z, cx, cz, world.colliders)) dist = 5.6;
    cx = pos.x - forward.x * dist + rx * 2.5;
    cz = pos.z - forward.z * dist + rz * 2.5;
    camTarget.set(cx + (Math.random() - 0.5) * shake, height + (Math.random() - 0.5) * shake, cz + (Math.random() - 0.5) * shake);
    camera.position.lerp(camTarget, 1 - Math.exp(-5.5 * dt));
    lookAt.set(pos.x + forward.x * 1.2, 1.05, pos.z + forward.z * 1.2);
    camera.lookAt(lookAt);
  }

  function resizeCamera() {
    if (!camera) return;
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  }

  function toggleCamera() {
    if (!player || phase !== 'playing') return;
    fps = !fps;
    if (fps) {
      fpsYaw = player.group.rotation.y;
      fpsPitch = -0.08;
      player.group.visible = false;
    } else {
      camYaw = fpsYaw;
      player.group.visible = true;
    }
    setBanner(fps ? 'FIRST PERSON' : 'THIRD PERSON', 1.1);
  }

  function onClick() {
    if (!world || phase !== 'playing') return;
    const touch = window.matchMedia?.('(pointer: coarse)')?.matches || Capacitor.isNativePlatform();
    if (fps && !touch && document.pointerLockElement !== hooks.canvas) {
      hooks.canvas.requestPointerLock();
      return;
    }
    pendingAttack = true;
  }

  function look(dx, dy) {
    if (!fps || phase !== 'playing') return;
    fpsYaw -= dx * 0.0022;
    fpsPitch = clamp(fpsPitch - dy * 0.002, -1.15, 1.05);
  }

  function activePowers() {
    const list = [];
    if (buffs.orbit > 0) list.push(`ORBIT ${buffs.orbit.toFixed(0)}s`);
    if (buffs.speed > 0) list.push(`SPEED ${buffs.speed.toFixed(0)}s`);
    if (buffs.shield > 0) list.push(`SHIELD ${buffs.shield.toFixed(0)}s`);
    if (powerId === 'block' && shiftHeld) list.push('BLOCKING');
    if (powerId === 'burn' && shiftHeld) list.push('BURNING');
    if (powerId === 'freeze' && shiftHeld) list.push('FREEZING');
    if (powerId === 'dash' && dashCd > 0) list.push(`DASH ${dashCd.toFixed(0)}s`);
    return list.join('   ');
  }

  function getHud() {
    const save = hooks.getSave();
    const left = coins.filter((c) => !c.got).length;
    return {
      kind: 'main',
      phase,
      username: save.username,
      level: save.playerLevel,
      time: formatTime(elapsed),
      score,
      coins: save.coins,
      left,
      total: coins.length,
      hp: Math.max(0, Math.ceil(hp)),
      maxHp: stats ? stats.maxHp : 100,
      powers: activePowers(),
      banner,
      fps,
      boss: Boolean(boss && !boss.dead),
      bossHp: boss ? Math.max(0, boss.hp) : 0,
      bossMax: boss ? boss.maxHp : 1,
      custom,
      mapName,
      howTo,
      power: powerId,
    };
  }

  return {
    get scene() { return world ? world.scene : null; },
    get camera() { return camera; },
    update,
    look,
    onClick,
    toggleCamera,
    getHud,
    dismissHowTo,
    getDebug() {
      if (!player) return null;
      return {
        x: Number(player.group.position.x.toFixed(2)),
        z: Number(player.group.position.z.toFixed(2)),
        yaw: Number(player.group.rotation.y.toFixed(2)),
        camYaw: Number(camYaw.toFixed(2)),
        hp: Math.ceil(hp),
        maxHp: stats?.maxHp,
        fps,
        phase,
        coinsLeft: coins.filter((coin) => !coin.got).length,
        coinsGot: collected,
        coinSpots: coins.filter((coin) => !coin.got).map((coin) => ({ x: Number(coin.x.toFixed(1)), z: Number(coin.z.toFixed(1)) })),
        powerSpots: powers.filter((power) => !power.got).map((power) => ({ type: power.type, x: Number(power.x.toFixed(1)), z: Number(power.z.toFixed(1)) })),
        enemies: enemies.filter((enemy) => !enemy.dead && enemy.dying <= 0).length,
        boss: boss ? Math.ceil(boss.hp) : 0,
        bossOn: Boolean(boss) && !boss.dead,
        bossX: boss ? Number(boss.x.toFixed(1)) : null,
        bossZ: boss ? Number(boss.z.toFixed(1)) : null,
        orbit: buffs.orbit,
        shield: buffs.shield,
        invuln: Number(invuln.toFixed(2)),
      };
    },
    usesPointerLock: true,
    startCampaign(mapId) {
      const built = buildMap(mapId);
      boot(built, { mapName: getMapMeta(mapId).name, custom: false });
    },
    startCustom(customWorld) {
      const built = buildThemedArena(customWorld.floor || 'park', 18);
      built.coins = (customWorld.coins || []).map((c) => ({ x: c.x, z: c.z }));
      built.enemies = (customWorld.enemies || []).map((c) => ({ x: c.x, z: c.z }));
      built.spawn = { x: 0, z: 0, yaw: 0 };
      boot(built, { mapName: 'CUSTOM WORLD', custom: true });
    },
    dispose: disposeWorld,
  };
}
