import * as THREE from 'three';
import { dressScene, stdMat } from './lights.js';
import { fieldTexture, labelTexture } from './textures.js';
import { createToastActor } from './toast.js';
import { createEffects } from './effects.js';
import { createPowerMesh, spinPickup, POWER_INFO } from './pickups.js';
import { readMove } from './input.js';
import { clamp, lerpAngle, yawFromDir } from './util.js';
import { getRunStats } from './save.js';
import { sfx } from './audio.js';

export function createSoccer(hooks) {
  let scene = null;
  let camera = null;
  let effects = null;
  let player = null;
  let mates = [];
  let ball = null;
  let powers = [];
  let phase = 'playing';
  let you = 0;
  let them = 0;
  let elapsed = 0;
  let kickCd = 0;
  let goalPause = 0;
  let banner = '';
  let bannerT = 0;
  let pendingReset = false;
  let winner = '';
  const buffs = { superkick: 0, speed: 0, freeze: 0 };
  let powerTimer = 3;
  let stats = null;
  const camPos = new THREE.Vector3();
  const tmpFwd = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const tmpUp = new THREE.Vector3(0, 1, 0);

  function dispose() {
    if (!scene) return;
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose?.());
      }
    });
    scene = null;
  }

  function makeGoal(xSign) {
    const group = new THREE.Group();
    const color = xSign > 0 ? '#ff5d4a' : '#7dffb2';
    const postMat = stdMat('#f4f7fb', { metalness: 0.45, roughness: 0.28 });
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.3, 8);
    [-2.35, 2.35].forEach((z) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(0, 1.15, z);
      post.castShadow = true;
      group.add(post);
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.9), postMat);
    bar.position.set(0, 2.3, 0);
    bar.castShadow = true;
    group.add(bar);
    const netMat = new THREE.MeshStandardMaterial({
      color: '#f7fbff', transparent: true, opacity: 0.35, roughness: 0.9, side: THREE.DoubleSide,
    });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.1), netMat);
    net.position.set(xSign * 0.7, 1.15, 0);
    net.rotation.y = Math.PI / 2;
    group.add(net);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.55),
      new THREE.MeshBasicMaterial({ map: labelTexture(xSign > 0 ? 'ENEMY GOAL' : 'YOUR GOAL', color, '#2a160c') }),
    );
    flag.position.set(xSign * -0.2, 3.1, 0);
    group.add(flag);
    group.position.set(xSign * 16.2, 0, 0);
    scene.add(group);
  }

  function buildScene() {
    dispose();
    scene = new THREE.Scene();
    dressScene(scene, {
      background: '#8fd0ff', fog: '#d7f5c4', fogNear: 28, fogFar: 78,
      sky: '#e7f7ff', ground: '#3f9a48', sun: '#fff4d2', sunIntensity: 1.45,
      skyTop: '#7ec8ff', skyBottom: '#e6ffc9', hemi: 0.8, shadowSpan: 36,
    });
    const map = fieldTexture().clone();
    map.needsUpdate = true;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1, 1);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), stdMat('#ffffff', { map, roughness: 0.9 }));
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);
    const dirt = new THREE.Mesh(new THREE.CircleGeometry(26, 24), stdMat('#d8b27a', { roughness: 1 }));
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = -0.04;
    dirt.receiveShadow = true;
    scene.add(dirt);
    makeGoal(1);
    makeGoal(-1);
    [-8, 8].forEach((z) => {
      [-20, 20].forEach((x) => {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 3), stdMat('#c9843d'));
        stand.position.set(x, 0.6, z > 0 ? 12 : -12);
        stand.castShadow = true;
        stand.receiveShadow = true;
        scene.add(stand);
      });
    });
  }

  function spawnBall(x = 0, z = 0) {
    if (ball?.mesh) scene.remove(ball.mesh);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 14),
      new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.45 }),
    );
    const patch = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.5 }),
    );
    patch.position.set(0.22, 0.12, 0.16);
    mesh.add(patch);
    mesh.castShadow = true;
    mesh.position.set(x, 0.34, z);
    scene.add(mesh);
    ball = { mesh, x, z, vx: 0, vz: 0, y: 0.34, lock: 0 };
  }

  function resetActors() {
    const save = hooks.getSave();
    player = createToastActor(save.selectedSkin);
    player.group.position.set(-6, 0, 0);
    player.group.rotation.y = Math.PI / 2;
    scene.add(player.group);
    mates = ['strawberry', 'blueberry', 'avocado'].map((skin, i) => {
      const actor = createToastActor(skin, { angry: true, keepColors: true });
      const spots = [[8, -3], [10, 3.5], [5, 0]];
      actor.group.position.set(spots[i][0], 0, spots[i][1]);
      scene.add(actor.group);
      return {
        actor,
        x: spots[i][0],
        z: spots[i][1],
        yaw: -Math.PI / 2,
        role: i,
        kickCd: 0.4 + i * 0.2,
      };
    });
  }

  function start() {
    buildScene();
    effects = createEffects(scene);
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 220);
    stats = getRunStats(hooks.getSave());
    you = 0;
    them = 0;
    elapsed = 0;
    kickCd = 0;
    goalPause = 0;
    phase = 'playing';
    winner = '';
    banner = 'FIRST TO 3';
    bannerT = 1.8;
    buffs.superkick = 0;
    buffs.speed = 0;
    buffs.freeze = 0;
    powerTimer = 2.5;
    powers = [];
    resetActors();
    spawnBall(0, 0);
    spawnPower();
  }

  function spawnPower() {
    if (!scene || powers.filter((p) => !p.got).length >= 2) return;
    const types = ['superkick', 'speed', 'freeze'];
    const type = types[Math.floor(Math.random() * types.length)];
    const mesh = createPowerMesh(type);
    const x = -6 + Math.random() * 12;
    const z = -5 + Math.random() * 10;
    mesh.position.set(x, mesh.userData.baseY, z);
    scene.add(mesh);
    powers.push({ mesh, x, z, type, got: false });
  }

  function scoreGoal(side) {
    if (phase !== 'playing') return;
    if (side === 'you') you += 1;
    else them += 1;
    sfx.goal();
    effects.burst({ x: ball.x, y: 1, z: ball.z }, side === 'you' ? '#ffe08a' : '#ff8d8d', 20, 4);
    banner = side === 'you' ? 'GOAL!' : 'ENEMY GOAL';
    bannerT = 1.3;
    goalPause = 1.25;
    phase = 'pause';
    ball.vx = 0;
    ball.vz = 0;
    if (you >= 3 || them >= 3) {
      phase = 'result';
      winner = you > them ? 'you' : 'them';
      banner = winner === 'you' ? 'YOU WIN!' : 'YOU LOSE';
      if (winner === 'you') sfx.win();
      else sfx.lose();
    }
  }

  function kickBall(x, z, yaw, power) {
    if (ball.lock > 0) return false;
    ball.vx = Math.sin(yaw) * power;
    ball.vz = Math.cos(yaw) * power;
    ball.x += Math.sin(yaw) * 0.25;
    ball.z += Math.cos(yaw) * 0.25;
    ball.lock = 0.34;
    sfx.kick();
    effects.glowPuff({ x, y: 0.4, z }, '#ffffff', 0.6);
    return true;
  }

  function separate(ax, az, bx, bz, minDist) {
    const dx = bx - ax;
    const dz = bz - az;
    const d = Math.hypot(dx, dz);
    if (d > 0.001 && d < minDist) {
      const push = (minDist - d) / d;
      return { x: dx * push * 0.5, z: dz * push * 0.5 };
    }
    return { x: 0, z: 0 };
  }

  function updateBall(dt) {
    const steps = 3;
    const h = dt / steps;
    for (let s = 0; s < steps; s += 1) {
      ball.vx *= Math.max(0, 1 - h * 0.48);
      ball.vz *= Math.max(0, 1 - h * 0.48);
      ball.x += ball.vx * h;
      ball.z += ball.vz * h;
      if (ball.z > 9.2) { ball.z = 9.2; ball.vz *= -0.65; }
      if (ball.z < -9.2) { ball.z = -9.2; ball.vz *= -0.65; }
      const inMouth = Math.abs(ball.z) < 2.25;
      if (ball.x > 16.15) {
        if (inMouth && ball.vx > 0) scoreGoal('you');
        else { ball.x = 16.15; ball.vx *= -0.55; }
      }
      if (ball.x < -16.15) {
        if (inMouth && ball.vx < 0) scoreGoal('them');
        else { ball.x = -16.15; ball.vx *= -0.55; }
      }
      const bodies = [{ x: player.group.position.x, z: player.group.position.z }, ...mates];
      bodies.forEach((body) => {
        const dx = ball.x - body.x;
        const dz = ball.z - body.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.78 && d > 0.001) {
          const push = (0.78 - d) / d;
          ball.x += dx * push;
          ball.z += dz * push;
          ball.vx += dx * 1.6;
          ball.vz += dz * 1.6;
        }
      });
    }
    const speed = Math.hypot(ball.vx, ball.vz);
    ball.y = 0.34 + Math.min(0.8, speed * 0.03);
    ball.mesh.position.set(ball.x, ball.y, ball.z);
    ball.mesh.rotation.x += ball.vz * dt * 0.8;
    ball.mesh.rotation.z -= ball.vx * dt * 0.8;
  }

  function moveBody(body, mx, mz, speed, dt) {
    const len = Math.hypot(mx, mz) || 1;
    body.x += (mx / len) * speed * dt;
    body.z += (mz / len) * speed * dt;
    body.x = clamp(body.x, -15.2, 15.2);
    body.z = clamp(body.z, -8.3, 8.3);
  }

  function update(dt, input) {
    if (!scene) return;
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
    elapsed += dt;
    bannerT -= dt;
    if (bannerT <= 0 && phase === 'playing') banner = '';
    buffs.superkick = Math.max(0, buffs.superkick - dt);
    buffs.speed = Math.max(0, buffs.speed - dt);
    buffs.freeze = Math.max(0, buffs.freeze - dt);
    kickCd = Math.max(0, kickCd - dt);
    if (ball) ball.lock = Math.max(0, ball.lock - dt);

    if (phase === 'pause') {
      goalPause -= dt;
      if (goalPause <= 0 && you < 3 && them < 3) {
        phase = 'playing';
        spawnBall(0, 0);
        player.group.position.set(-6, 0, 0);
        mates.forEach((mate, i) => {
          const spots = [[8, -3], [10, 3.5], [5, 0]];
          mate.x = spots[i][0];
          mate.z = spots[i][1];
          mate.actor.group.position.set(mate.x, 0, mate.z);
        });
      }
    }

    if (phase === 'playing') {
      camera.getWorldDirection(tmpFwd);
      tmpFwd.y = 0;
      if (tmpFwd.lengthSq() < 1e-5) tmpFwd.set(1, 0, 0);
      tmpFwd.normalize();
      tmpRight.crossVectors(tmpFwd, tmpUp).normalize();
      const move = readMove(input);
      let mx = tmpFwd.x * move.forward + tmpRight.x * move.strafe;
      let mz = tmpFwd.z * move.forward + tmpRight.z * move.strafe;
      const moving = Math.hypot(mx, mz) > 0.1;
      const speed = (stats?.speed || 6.4) * 0.92 * (buffs.speed > 0 ? 1.4 : 1);
      if (moving) {
        moveBody(player.group.position, mx, mz, speed, dt);
        const desired = yawFromDir(mx, mz);
        player.group.rotation.y = lerpAngle(player.group.rotation.y, desired, 1 - Math.exp(-14 * dt));
      }
      player.setMoving(moving);
      const px = player.group.position.x;
      const pz = player.group.position.z;
      if ((input.once('Digit1') || input.once('Numpad1')) && kickCd <= 0) {
        if (Math.hypot(ball.x - px, ball.z - pz) < 1.75) {
          kickCd = 0.38;
          player.triggerAttack();
          kickBall(px, pz, player.group.rotation.y, buffs.superkick > 0 ? 20 : 12.5);
          if (buffs.superkick > 0) effects.floater(player.group.position, 'SUPER KICK', '#ffb15a');
        }
      }
      mates.forEach((mate) => {
        mate.kickCd = Math.max(0, mate.kickCd - dt);
        const frozen = buffs.freeze > 0;
        let tx = ball.x;
        let tz = ball.z;
        if (mate.role === 1) tz += 2.2;
        if (mate.role === 2) { tx = clamp(ball.x + 3, 2, 13); tz = ball.z * 0.4; }
        const dx = tx - mate.x;
        const dz = tz - mate.z;
        const distBall = Math.hypot(ball.x - mate.x, ball.z - mate.z);
        const spd = frozen ? 0.4 : 4.5 + mate.role * 0.15;
        if (Math.hypot(dx, dz) > 0.4) moveBody(mate, dx, dz, spd, dt);
        mate.actor.group.position.set(mate.x, 0, mate.z);
        if (!frozen) mate.actor.group.rotation.y = lerpAngle(mate.actor.group.rotation.y, yawFromDir(dx, dz), 1 - Math.exp(-8 * dt));
        mate.actor.setMoving(!frozen);
        mate.actor.update(dt);
        if (!frozen && distBall < 1.45 && mate.kickCd <= 0) {
          mate.kickCd = 0.7;
          const aimX = -16 - ball.x;
          const aimZ = -ball.z;
          const aim = Math.atan2(aimX, aimZ);
          kickBall(mate.x, mate.z, aim, 11.5);
          mate.actor.triggerAttack();
        }
      });
      const push = separate(player.group.position.x, player.group.position.z, mates[0].x, mates[0].z, 0.9);
      mates.forEach((mate, i) => {
        mates.forEach((other, j) => {
          if (j <= i) return;
          const sep = separate(mate.x, mate.z, other.x, other.z, 1);
          mate.x -= sep.x;
          mate.z -= sep.z;
          other.x += sep.x;
          other.z += sep.z;
        });
        const sepPlayer = separate(mate.x, mate.z, player.group.position.x, player.group.position.z, 0.95);
        mate.x -= sepPlayer.x;
        mate.z -= sepPlayer.z;
      });
      void push;
      updateBall(dt);
      powers.forEach((power) => {
        if (power.got) return;
        spinPickup(power.mesh, elapsed, 2);
        if (Math.hypot(power.x - px, power.z - pz) < 1) {
          power.got = true;
          scene.remove(power.mesh);
          sfx.power();
          effects.floater(player.group.position, POWER_INFO[power.type].name, POWER_INFO[power.type].color);
          if (power.type === 'superkick') buffs.superkick = 8;
          if (power.type === 'speed') buffs.speed = 6;
          if (power.type === 'freeze') buffs.freeze = 3.6;
        }
      });
      powerTimer -= dt;
      if (powerTimer <= 0) {
        powerTimer = Math.max(4.5, (stats?.powerInterval || 8) * 0.8);
        spawnPower();
      }
    } else {
      player.setMoving(false);
      mates.forEach((mate) => {
        mate.actor.setMoving(false);
        mate.actor.update(dt);
      });
    }
    player.update(dt);
    effects.update(dt);
    const focusX = player.group.position.x * 0.35 + ball.x * 0.45;
    const focusZ = player.group.position.z * 0.4 + ball.z * 0.25;
    camPos.set(focusX - 14.5, 10.5, focusZ + 9.5);
    camera.position.lerp(camPos, 1 - Math.exp(-3.2 * dt));
    camera.lookAt(focusX + 1.5, 0.4, focusZ);
  }

  function activePower() {
    if (buffs.superkick > 0) return `SUPER KICK ${buffs.superkick.toFixed(0)}s`;
    if (buffs.speed > 0) return `SPEED ${buffs.speed.toFixed(0)}s`;
    if (buffs.freeze > 0) return `FREEZE ${buffs.freeze.toFixed(0)}s`;
    return '';
  }

  function getHud() {
    return {
      kind: 'soccer',
      phase: phase === 'result' ? 'result' : 'playing',
      you,
      them,
      banner,
      powers: activePower(),
      winner,
    };
  }

  function getDebug() {
    return {
      you,
      them,
      phase,
      px: player ? Number(player.group.position.x.toFixed(2)) : 0,
      pz: player ? Number(player.group.position.z.toFixed(2)) : 0,
      yaw: player ? Number(player.group.rotation.y.toFixed(2)) : 0,
      bx: ball ? Number(ball.x.toFixed(2)) : 0,
      bz: ball ? Number(ball.z.toFixed(2)) : 0,
      bvx: ball ? Number(ball.vx.toFixed(2)) : 0,
      bvz: ball ? Number(ball.vz.toFixed(2)) : 0,
    };
  }

  return {
    get scene() { return scene; },
    get camera() { return camera; },
    update,
    start,
    dispose,
    getHud,
    getDebug,
    onClick() {},
    look() {},
  };
}
