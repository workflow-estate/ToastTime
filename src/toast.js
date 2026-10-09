import * as THREE from 'three';
import { getSkin, ENEMY_SKIN } from './skins.js';

const ICE = new THREE.Color('#8ecfff');

function toastShape(w, h, topR, botR) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  s.moveTo(-hw + botR, -hh);
  s.lineTo(hw - botR, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + botR);
  s.lineTo(hw, hh - topR);
  s.quadraticCurveTo(hw, hh, hw - topR * 0.92, hh);
  s.lineTo(-hw + topR * 0.92, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - topR);
  s.lineTo(-hw, -hh + botR);
  s.quadraticCurveTo(-hw, -hh, -hw + botR, -hh);
  return s;
}

function mat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.52,
    metalness: 0.02,
    ...extras,
  });
}

function extrude(shape, depth, bevel) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function enableShadows(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

export function createToastActor(skinId, options = {}) {
  const angry = Boolean(options.angry);
  const skin = angry && !options.keepColors ? { ...ENEMY_SKIN } : { ...getSkin(skinId) };
  const group = new THREE.Group();
  const model = new THREE.Group();
  group.add(model);

  const crustMat = mat(skin.crust, angry ? { roughness: 0.55 } : {});
  const crumbMat = mat(skin.crumb, {
    emissive: ['legendary', 'inferno', 'frost', 'phantom', 'stars'].includes(skin.extra) ? skin.accent : '#000000',
    emissiveIntensity: skin.extra === 'legendary' || skin.extra === 'inferno' ? 0.28 : ['frost', 'phantom', 'stars'].includes(skin.extra) ? 0.22 : 0,
  });
  const ink = mat('#2a1a12', { roughness: 0.4 });

  const bodyH = 1.05;
  const bodyW = 0.84;
  const crust = new THREE.Mesh(extrude(toastShape(bodyW, bodyH, 0.34, 0.12), 0.26, 0.035), crustMat);
  crust.position.y = 0.86;
  model.add(crust);

  const crumb = new THREE.Mesh(extrude(toastShape(bodyW * 0.72, bodyH * 0.7, 0.2, 0.08), 0.08, 0.015), crumbMat);
  crumb.position.set(0, 0.84, 0.15);
  model.add(crumb);

  const eyeZ = 0.24;
  [-0.15, 0.15].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.15, 2, 6), ink);
    eye.position.set(x, 1.02, eyeZ);
    model.add(eye);
  });

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 6, 14, Math.PI), ink);
  mouth.position.set(0, 0.76, eyeZ);
  mouth.rotation.z = Math.PI;
  model.add(mouth);

  const legMat = mat(angry ? '#6e2a16' : '#8a5a2b');
  const legs = [];
  [-0.16, 0.16].forEach((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.28, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 8), legMat);
    leg.position.y = -0.12;
    pivot.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), legMat);
    foot.scale.set(1.15, 0.55, 1.35);
    foot.position.set(0, -0.24, 0.03);
    pivot.add(foot);
    model.add(pivot);
    legs.push(pivot);
  });

  const armMat = mat(skin.crust);
  const arms = [];
  [-0.48, 0.48].forEach((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.92, 0.02);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.22, 3, 8), armMat);
    arm.position.y = -0.16;
    pivot.add(arm);
    model.add(pivot);
    arms.push(pivot);
  });

  addExtra(model, skin, angry);

  const blockMat = new THREE.MeshStandardMaterial({
    color: '#ffe7a2',
    emissive: '#ffc24a',
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.34,
    roughness: 0.15,
    metalness: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const block = new THREE.Mesh(new THREE.SphereGeometry(0.92, 28, 20), blockMat);
  block.position.y = 0.85;
  block.visible = false;
  block.renderOrder = 2;
  block.castShadow = false;
  block.receiveShadow = false;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.035, 8, 28),
    new THREE.MeshStandardMaterial({
      color: '#fff4c4',
      emissive: '#ffe08a',
      emissiveIntensity: 0.8,
      roughness: 0.25,
      depthWrite: false,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;
  block.add(ring);
  group.add(block);

  enableShadows(group);
  block.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  const anim = { time: 0, moving: false, attack: 0, flash: 0, hop: 0, scorch: 0, chill: 0, chilled: false, blocking: false, blend: 0 };
  const baseMats = [];
  group.traverse((obj) => {
    if (obj.isMesh && obj.material && obj !== block) baseMats.push(obj.material);
  });

  return {
    group,
    model,
    radius: 0.46 * (options.scale || 1),
    anim,
    setMoving(moving) { anim.moving = moving; },
    triggerAttack() { anim.attack = 0.26; },
    triggerHop(amount = 0.35) { anim.hop = Math.max(anim.hop, amount); },
    flash() { anim.flash = 0.16; },
    scorch() {
      anim.scorch = 0.5;
      anim.flash = 0;
      anim.hop = Math.max(anim.hop, 0.2);
    },
    setChill(on, dt) {
      const step = (on ? 0.42 : 0.55) * dt;
      anim.chill = on ? Math.min(1, anim.chill + step) : Math.max(0, anim.chill - step);
    },
    setBlock(on) {
      anim.blocking = on;
      block.visible = on;
    },
    setBlockShown(shown) {
      block.visible = anim.blocking && shown;
    },
    setBodyVisible(on) { model.visible = on; },
    update(dt) {
      anim.time += dt;
      anim.blend += ((anim.moving ? 1 : 0) - anim.blend) * Math.min(1, dt * 9);
      const w = anim.blend;
      const phase = anim.time * 8.2;
      const step = Math.sin(phase);
      anim.hop = Math.max(0, anim.hop - dt * 1.6);
      const idleBob = Math.sin(anim.time * 2.1) * 0.012;
      const walkBob = Math.abs(Math.sin(phase)) * 0.04;
      model.position.y = idleBob * (1 - w) + walkBob * w + anim.hop;
      model.rotation.x = 0.05 * w;
      model.rotation.z = step * 0.028 * w + Math.sin(anim.time * 1.5) * 0.008 * (1 - w);
      legs.forEach((leg, i) => {
        const stride = Math.sin(phase + i * Math.PI);
        leg.rotation.x = stride * 0.42 * w;
        leg.position.y = 0.28 + Math.max(0, -stride) * 0.05 * w;
      });
      arms.forEach((arm, i) => {
        const stride = Math.sin(phase + i * Math.PI);
        const rest = Math.sin(anim.time * 1.5 + i) * 0.04;
        arm.rotation.x = (-stride * 0.36) * w + rest * (1 - w);
        arm.rotation.z = (i === 0 ? 0.18 : -0.18) + stride * 0.06 * w;
      });
      if (anim.attack > 0) {
        anim.attack -= dt;
        const t = anim.attack / 0.26;
        arms[0].rotation.x = -1.4 * (1 - t);
        arms[1].rotation.x = -1.1 * (1 - t);
        model.position.z = 0.12 * (1 - t);
      } else {
        model.position.z = 0;
      }
      if (anim.blocking) {
        const pulse = 1 + Math.sin(anim.time * 3.2) * 0.025;
        block.scale.setScalar(pulse);
      }
      baseMats.forEach((m) => {
        if (!m.userData.baseEmissive) {
          m.userData.baseEmissive = m.emissive.clone();
          m.userData.baseIntensity = m.emissiveIntensity || 0;
          m.userData.baseColor = m.color.clone();
        }
      });
      const restoreMats = () => {
        baseMats.forEach((m) => {
          m.emissive.copy(m.userData.baseEmissive);
          m.emissiveIntensity = m.userData.baseIntensity;
          m.color.copy(m.userData.baseColor);
        });
      };
      if (anim.scorch > 0) {
        anim.scorch -= dt;
        const t = Math.max(0, anim.scorch / 0.5);
        const hit = Math.sin((1 - t) * Math.PI);
        model.rotation.x = -0.7 * hit;
        model.rotation.z += Math.sin(anim.scorch * 62) * 0.16 * t;
        model.position.y += 0.1 * hit;
        model.scale.y = 1 - 0.16 * hit;
        model.scale.x = 1 + 0.08 * hit;
        model.scale.z = 1 + 0.08 * hit;
        baseMats.forEach((m) => {
          if (t > 0.55) {
            m.color.set('#ff6a1a');
            m.emissive.set('#ff3a00');
            m.emissiveIntensity = 1;
          } else {
            m.color.copy(m.userData.baseColor).lerp(new THREE.Color('#3a140c'), 0.65);
            m.emissive.set('#5a1a08');
            m.emissiveIntensity = 0.4;
          }
        });
        if (anim.scorch <= 0) {
          model.scale.set(1, 1, 1);
          model.rotation.x = 0.05 * w;
          restoreMats();
        }
      } else if (anim.flash > 0) {
        anim.flash -= dt;
        const on = Math.sin(anim.flash * 80) > 0;
        baseMats.forEach((m) => {
          if (on) {
            m.emissive.set('#ffffff');
            m.emissiveIntensity = 0.75;
          } else {
            m.emissive.copy(m.userData.baseEmissive);
            m.emissiveIntensity = m.userData.baseIntensity;
          }
        });
        if (anim.flash <= 0) restoreMats();
      } else if (anim.chill > 0) {
        anim.chilled = true;
        const iced = anim.chill;
        model.rotation.z += Math.sin(anim.time * 14) * 0.04 * iced;
        baseMats.forEach((m) => {
          m.color.copy(m.userData.baseColor).lerp(ICE, iced * 0.88);
          m.emissive.set('#c6f4ff');
          m.emissiveIntensity = m.userData.baseIntensity + iced * 0.4;
        });
      } else if (anim.chilled) {
        anim.chilled = false;
        restoreMats();
      }
    },
  };
}

export function attachHealthBar(actor) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 10;
  const paint = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.owned = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  }));
  sprite.position.y = 1.9;
  sprite.scale.set(1.25, 0.2, 1);
  sprite.renderOrder = 4;
  actor.group.add(sprite);
  actor.setHealth = (hp, maxHp) => {
    const ratio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
    paint.clearRect(0, 0, 64, 10);
    paint.fillStyle = '#2a140c';
    paint.fillRect(0, 0, 64, 10);
    paint.fillStyle = ratio > 0.55 ? '#6dff63' : ratio > 0.28 ? '#ffd15a' : '#ff4d3a';
    paint.fillRect(2, 2, Math.max(0, 60 * ratio), 6);
    tex.needsUpdate = true;
    sprite.visible = hp > 0;
  };
  actor.setHealth(1, 1);
}

function addExtra(model, skin, angry) {
  if (angry) return;
  if (skin.extra === 'seeds') {
    const seedMat = mat('#ffe28a');
    const leafMat = mat('#2f9a45');
    for (let i = 0; i < 7; i += 1) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), seedMat);
      seed.scale.set(1, 1.6, 0.6);
      seed.position.set(-0.18 + (i % 4) * 0.12, 0.72 + Math.floor(i / 4) * 0.16, 0.2);
      model.add(seed);
    }
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 6), leafMat);
    leaf.position.set(0, 1.46, 0);
    model.add(leaf);
  } else if (skin.extra === 'berries') {
    const berry = mat('#4d39b0');
    for (let i = 0; i < 3; i += 1) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), berry);
      b.position.set(-0.16 + i * 0.16, 1.46, 0.04);
      model.add(b);
    }
  } else if (skin.extra === 'stars') {
    const starMat = mat('#e8fbff', { emissive: '#b9fff6', emissiveIntensity: 0.8, roughness: 0.3 });
    [[-0.18, 1.15], [0.2, 0.95], [0.02, 1.32], [-0.22, 0.78]].forEach(([x, y]) => {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), starMat);
      star.position.set(x, y, 0.2);
      model.add(star);
    });
  } else if (skin.extra === 'pit') {
    const pit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat('#6b3e22'));
    pit.position.set(0.08, 0.86, 0.2);
    model.add(pit);
  } else if (skin.extra === 'butter') {
    const pat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.2), mat('#fff4c4', { roughness: 0.25, metalness: 0.05 }));
    pat.position.set(0, 1.42, 0.02);
    pat.rotation.y = 0.3;
    model.add(pat);
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat('#ffe38a', { roughness: 0.3 }));
    drip.scale.y = 1.6;
    drip.position.set(0.18, 1.28, 0.12);
    model.add(drip);
  } else if (skin.extra === 'legendary') {
    const gold = mat('#ffe27a', { emissive: '#ffbf3a', emissiveIntensity: 0.45, roughness: 0.28, metalness: 0.35 });
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.12), gold);
    crown.add(band);
    [-0.16, 0, 0.16].forEach((x, i) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, i === 1 ? 0.28 : 0.2, 6), gold);
      spike.position.set(x, 0.14, 0);
      crown.add(spike);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), mat('#7ef0ff', { emissive: '#7ef0ff', emissiveIntensity: 0.7 }));
      gem.position.set(x, 0.02, 0.07);
      crown.add(gem);
    });
    crown.position.set(0, 1.5, 0);
    model.add(crown);
    const light = new THREE.PointLight('#ffd56a', 0.7, 4.5, 2);
    light.position.set(0, 1.5, 0.4);
    model.add(light);
  } else if (skin.extra === 'inferno') {
    const flame = mat('#ff6a1a', { emissive: '#ff3a00', emissiveIntensity: 0.9, roughness: 0.35 });
    [-0.12, 0.12].forEach((x, i) => {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, i === 0 ? 0.32 : 0.24, 6), flame);
      tip.position.set(x, 1.58, 0.02);
      model.add(tip);
    });
  } else if (skin.extra === 'frost') {
    const ice = mat('#dff8ff', { emissive: '#9aecff', emissiveIntensity: 0.7, roughness: 0.18, metalness: 0.2 });
    [[-0.14, 1.48], [0.12, 1.56], [0, 1.38]].forEach(([x, y], i) => {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(i === 1 ? 0.09 : 0.06, 0), ice);
      shard.position.set(x, y, 0.04);
      model.add(shard);
    });
  } else if (skin.extra === 'phantom') {
    const wisp = mat('#efe6ff', { emissive: '#c9b0ff', emissiveIntensity: 0.85, roughness: 0.3 });
    [[-0.2, 1.2], [0.18, 1.05], [0.02, 1.42]].forEach(([x, y]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), wisp);
      puff.position.set(x, y, 0.16);
      model.add(puff);
    });
  } else {
    const seedMat = mat('#f0e2c0', { roughness: 0.8 });
    for (let i = 0; i < 5; i += 1) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), seedMat);
      seed.scale.set(1, 1.4, 0.5);
      seed.position.set(-0.16 + i * 0.08, 1.2 - (i % 2) * 0.08, 0.2);
      model.add(seed);
    }
  }
}

export function createOrbitRig() {
  const group = new THREE.Group();
  const balls = [];
  const geo = new THREE.SphereGeometry(0.16, 14, 12);
  function ensure(count, color) {
    while (balls.length < count) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.2,
      }));
      mesh.castShadow = true;
      group.add(mesh);
      balls.push(mesh);
    }
    balls.forEach((ball, i) => { ball.visible = i < count; });
  }
  ensure(0, '#4aa3ff');
  return {
    group,
    count: 0,
    angle: 0,
    setCount(count, color = '#4aa3ff') {
      this.count = count;
      ensure(count, color);
      balls.forEach((ball) => {
        if (ball.material) {
          ball.material.color.set(color);
          ball.material.emissive.set(color);
        }
      });
    },
    update(dt, origin) {
      this.angle += dt * 3.4;
      group.position.set(origin.x, 0.9, origin.z);
      for (let i = 0; i < balls.length; i += 1) {
        if (!balls[i].visible) continue;
        const a = this.angle + (i / Math.max(1, this.count)) * Math.PI * 2;
        balls[i].position.set(Math.cos(a) * 1.25, Math.sin(this.angle * 2 + i) * 0.12, Math.sin(a) * 1.25);
      }
    },
    ballPositions(out = []) {
      out.length = 0;
      balls.forEach((ball) => {
        if (!ball.visible) return;
        const p = new THREE.Vector3();
        ball.getWorldPosition(p);
        out.push(p);
      });
      return out;
    },
  };
}
