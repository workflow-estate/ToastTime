import * as THREE from 'three';
import { buildMap } from './maps.js';
import { createToastActor } from './toast.js';
import { createCoinMesh, updateCoin } from './pickups.js';
import { lerpAngle, yawFromDir } from './util.js';

const LOOP = [
  { x: 4, z: 8 },
  { x: 8, z: 5 },
  { x: 5, z: 2 },
  { x: 1, z: 6 },
];

export function createPreview() {
  const world = buildMap('park');
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1500);
  const feet = (x, z) => (world.heightAt ? world.heightAt(x, z) : 0);
  const hero = createToastActor('classic');
  hero.group.position.set(LOOP[0].x, feet(LOOP[0].x, LOOP[0].z), LOOP[0].z);
  world.scene.add(hero.group);
  const chaser = createToastActor('classic', { angry: true });
  chaser.group.position.set(-8, feet(-8, -2), -2);
  world.scene.add(chaser.group);
  const coins = world.coins.slice(0, 6).map((spot) => {
    const mesh = createCoinMesh();
    mesh.position.set(spot.x, feet(spot.x, spot.z) + mesh.userData.baseY, spot.z);
    world.scene.add(mesh);
    return mesh;
  });
  let elapsed = 0;
  let cursor = 0;
  let split = true;
  const camTarget = new THREE.Vector3();

  function update(dt) {
    elapsed += dt;
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
    const target = LOOP[cursor];
    const pos = hero.group.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const step = Math.min(dist, dt * 4.2);
    pos.x += (dx / dist) * step;
    pos.z += (dz / dist) * step;
    pos.y = feet(pos.x, pos.z);
    hero.group.rotation.y = lerpAngle(hero.group.rotation.y, yawFromDir(dx, dz), 1 - Math.exp(-6 * dt));
    hero.setMoving(true);
    hero.update(dt);
    if (dist < 0.4) cursor = (cursor + 1) % LOOP.length;

    const cpos = chaser.group.position;
    const hx = pos.x - cpos.x;
    const hz = pos.z - cpos.z;
    const hd = Math.hypot(hx, hz) || 1;
    if (hd > 2.2) {
      cpos.x += (hx / hd) * dt * 2.4;
      cpos.z += (hz / hd) * dt * 2.4;
    }
    cpos.y = feet(cpos.x, cpos.z);
    chaser.group.rotation.y = lerpAngle(chaser.group.rotation.y, yawFromDir(hx, hz), 1 - Math.exp(-6 * dt));
    chaser.setMoving(true);
    chaser.update(dt);
    coins.forEach((mesh) => updateCoin(mesh, elapsed));
    if (world.update) world.update(elapsed, dt, hero.group.position);

    const faceX = Math.sin(hero.group.rotation.y);
    const faceZ = Math.cos(hero.group.rotation.y);
    const sideX = faceZ;
    const sideZ = -faceX;
    camTarget.set(
      pos.x + faceX * 6.2 + sideX * 2.4,
      pos.y + (split ? 2.35 : 3.8),
      pos.z + faceZ * 6.2 + sideZ * 2.4,
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-3.2 * dt));
    camera.lookAt(pos.x - (split ? 1.8 : 0), pos.y + 1.05, pos.z);
    if (split && window.innerWidth > 860) {
      const shift = Math.min(460, window.innerWidth * 0.32);
      camera.setViewOffset(window.innerWidth, window.innerHeight, -shift, 0, window.innerWidth, window.innerHeight);
    } else {
      camera.clearViewOffset();
    }
  }

  return {
    scene: world.scene,
    camera,
    update,
    setSplit(value) { split = value; },
    getHud() { return null; },
    onClick() {},
    look() {},
  };
}
