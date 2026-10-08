import { createToastActor } from './toast.js';
import { resolveCircle } from './collision.js';
import { yawFromDir } from './util.js';

export function createEnemy(scene, x, z) {
  const actor = createToastActor('classic', { angry: true });
  actor.group.position.set(x, 0, z);
  scene.add(actor.group);
  return {
    actor,
    x,
    z,
    yaw: Math.random() * Math.PI * 2,
    hp: 48,
    maxHp: 48,
    radius: 0.46,
    attackCd: 0.6 + Math.random(),
    hurtCd: 0,
    dying: 0,
    dead: false,
    knockX: 0,
    knockZ: 0,
    speed: 4.35 + Math.random() * 0.4,
  };
}

export function updateEnemy(enemy, dt, ctx) {
  if (enemy.dead) return;
  enemy.hurtCd = Math.max(0, enemy.hurtCd - dt);
  enemy.attackCd = Math.max(0, enemy.attackCd - dt);
  if (enemy.dying > 0) {
    enemy.dying -= dt;
    enemy.actor.group.rotation.z += dt * 8;
    const s = Math.max(0.01, enemy.dying / 0.45);
    enemy.actor.group.scale.setScalar(s);
    if (enemy.dying <= 0) {
      enemy.dead = true;
      enemy.actor.group.visible = false;
    }
    return;
  }
  const dx = ctx.playerX - enemy.x;
  const dz = ctx.playerZ - enemy.z;
  const dist = Math.hypot(dx, dz) || 1;
  let mx = dx / dist;
  let mz = dz / dist;
  if (ctx.frozen) {
    mx *= 0.08;
    mz *= 0.08;
  }
  enemy.knockX *= Math.max(0, 1 - dt * 6);
  enemy.knockZ *= Math.max(0, 1 - dt * 6);
  const speed = ctx.frozen ? enemy.speed * 0.08 : enemy.speed;
  enemy.x += mx * speed * dt + enemy.knockX * dt;
  enemy.z += mz * speed * dt + enemy.knockZ * dt;
  const pos = { x: enemy.x, z: enemy.z };
  resolveCircle(pos, enemy.radius, ctx.colliders);
  enemy.x = pos.x;
  enemy.z = pos.z;
  enemy.yaw = yawFromDir(mx, mz);
  enemy.actor.group.position.x = enemy.x;
  enemy.actor.group.position.z = enemy.z;
  enemy.actor.group.rotation.y = enemy.yaw;
  enemy.actor.setMoving(speed > 0.4 && !ctx.frozen);
  enemy.actor.update(dt);
  if (dist < 1.18 && enemy.attackCd <= 0 && !ctx.frozen) {
    enemy.attackCd = 1.25;
    enemy.actor.triggerAttack();
    ctx.onAttack(enemy, 14);
  }
}

export function hurtEnemy(enemy, amount, fromX, fromZ) {
  if (enemy.dead || enemy.dying > 0) return false;
  enemy.hp -= amount;
  enemy.hurtCd = 0.12;
  enemy.actor.flash();
  enemy.actor.triggerHop(0.28);
  const dx = enemy.x - fromX;
  const dz = enemy.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  enemy.knockX = (dx / d) * 7;
  enemy.knockZ = (dz / d) * 7;
  if (enemy.hp <= 0) enemy.dying = 0.45;
  return true;
}
