import * as THREE from 'three';
import { buildMap } from './maps.js';
import { createToastActor } from './toast.js';
import { createCoinMesh, updateCoin } from './pickups.js';
import { createEnemy } from './enemies.js';
import { climbStep, findClearPoint } from './collision.js';
import { PARK_STEP } from './openworld.js';
import { readMove } from './input.js';
import { lerpAngle, yawFromDir, forwardFromYaw } from './util.js';

export const FLOORS = [
  { id: 'park', name: 'TOASTY GRASS', desc: 'A sunny park floor.' },
  { id: 'fridge', name: 'FRIDGE ICE', desc: 'A cold kitchen floor.' },
  { id: 'volcano', name: 'VOLCANO ROCK', desc: 'A hot toasted floor.' },
  { id: 'space', name: 'SPACE METAL', desc: 'A futuristic kitchen floor.' },
];

export function createEditor(hooks) {
  let world = null;
  let camera = null;
  let player = null;
  let coins = [];
  let enemies = [];
  let placed = [];
  let floor = 'park';
  let saveId = null;
  let camYaw = 0;
  let elapsed = 0;
  const forward = { x: 0, z: 1 };
  const camTarget = new THREE.Vector3();

  function clearObjects() {
    coins.forEach((coin) => world.scene.remove(coin.mesh));
    enemies.forEach((enemy) => world.scene.remove(enemy.actor.group));
    coins = [];
    enemies = [];
    placed = [];
  }

  function dispose() {
    if (!world) return;
    world.scene.traverse((obj) => {
      if (obj.geometry && !obj.geometry.userData?.shared) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.map && m.map.userData?.owned) m.map.dispose();
          m.dispose?.();
        });
      }
    });
    world = null;
    player = null;
  }

  function addCoin(x, z, record = true) {
    const spot = findClearPoint(x, z, 0.5, world.colliders, world.bounds) || { x, z };
    const mesh = createCoinMesh();
    const gy = world.heightAt ? world.heightAt(spot.x, spot.z) : 0;
    mesh.position.set(spot.x, gy + mesh.userData.baseY, spot.z);
    world.scene.add(mesh);
    const item = { mesh, x: spot.x, z: spot.z };
    coins.push(item);
    if (record) placed.push({ kind: 'coin', item });
    return item;
  }

  function addEnemy(x, z, record = true) {
    const spot = findClearPoint(x, z, 0.6, world.colliders, world.bounds) || { x, z };
    const enemy = createEnemy(world.scene, spot.x, spot.z);
    if (world.heightAt) enemy.actor.group.position.y = world.heightAt(spot.x, spot.z);
    if (record) placed.push({ kind: 'enemy', item: enemy });
    enemies.push(enemy);
    return enemy;
  }

  function boot(nextFloor, keep) {
    dispose();
    floor = nextFloor;
    world = buildMap(floor);
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.12, 1200);
    const save = hooks.getSave();
    player = createToastActor(save.selectedSkin);
    player.group.position.set(world.spawn.x, world.heightAt ? world.heightAt(world.spawn.x, world.spawn.z) : 0, world.spawn.z);
    player.group.rotation.y = world.spawn.yaw || 0;
    world.scene.add(player.group);
    camYaw = world.spawn.yaw || 0;
    coins = [];
    enemies = [];
    placed = [];
    (keep?.coins || []).forEach((c) => addCoin(c.x, c.z));
    (keep?.enemies || []).forEach((c) => addEnemy(c.x, c.z));
  }

  function snapshot() {
    return {
      id: saveId,
      floor,
      coins: coins.map((c) => ({ x: c.x, z: c.z })),
      enemies: enemies.map((e) => ({ x: e.x, z: e.z })),
    };
  }

  function spawn(kind) {
    if (!player) return;
    forwardFromYaw(player.group.rotation.y, forward);
    const x = player.group.position.x + forward.x * 2.5;
    const z = player.group.position.z + forward.z * 2.5;
    if (kind === 'coin') addCoin(x, z);
    else addEnemy(x, z);
  }

  function removeLast() {
    const last = placed.pop();
    if (!last) return;
    if (last.kind === 'coin') {
      world.scene.remove(last.item.mesh);
      coins = coins.filter((c) => c !== last.item);
    } else {
      world.scene.remove(last.item.actor.group);
      enemies = enemies.filter((e) => e !== last.item);
    }
  }

  function update(dt, input) {
    if (!world || !player) return;
    elapsed += dt;
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
    const move = readMove(input);
    forwardFromYaw(camYaw, forward);
    const rx = -forward.z;
    const rz = forward.x;
    let mx = forward.x * move.forward + rx * move.strafe;
    let mz = forward.z * move.forward + rz * move.strafe;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const pos = player.group.position;
    const speed = 7;
    climbStep(pos, pos.x + mx * speed * dt, pos.z + mz * speed * dt, 0.46, world.colliders, world.heightAt, PARK_STEP, dt);
    if (len > 0.1) {
      player.group.rotation.y = lerpAngle(player.group.rotation.y, yawFromDir(mx, mz), 1 - Math.exp(-12 * dt));
    }
    player.setMoving(len > 0.1);
    player.update(dt);
    camYaw = lerpAngle(camYaw, player.group.rotation.y, 1 - Math.exp(-3 * dt));
    forwardFromYaw(camYaw, forward);
    camTarget.set(pos.x - forward.x * 7, pos.y + 4.6, pos.z - forward.z * 7);
    camera.position.lerp(camTarget, 1 - Math.exp(-5 * dt));
    camera.lookAt(pos.x, pos.y + 1.1, pos.z);
    if (world.update) world.update(elapsed, dt, pos);
    coins.forEach((coin) => {
      updateCoin(coin.mesh, elapsed);
      const gy = world.heightAt ? world.heightAt(coin.x, coin.z) : 0;
      coin.mesh.position.y += gy;
    });
    enemies.forEach((enemy) => {
      enemy.actor.setMoving(false);
      enemy.actor.update(dt);
    });
  }

  return {
    get scene() { return world ? world.scene : null; },
    get camera() { return camera; },
    update,
    start(floorId) {
      saveId = null;
      boot(floorId || 'park', null);
    },
    setFloor(floorId) {
      const keep = snapshot();
      boot(floorId, { coins: keep.coins, enemies: keep.enemies });
      saveId = keep.id;
    },
    noteSaved(id) {
      saveId = id;
    },
    spawn,
    removeLast,
    snapshot,
    dispose,
    getHud() {
      return { kind: 'editor', floor, coins: coins.length, enemies: enemies.length };
    },
    onClick() {},
    look() {},
  };
}
