import * as THREE from 'three';
import { glowTexture } from './textures.js';

export function createEffects(scene) {
  const particles = [];
  const floaters = [];
  const rings = [];
  const glow = glowTexture();

  function burst(position, color = '#ffd56a', count = 12, speed = 3.2) {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.set(position.x, position.y ?? 0.8, position.z);
      const theta = Math.random() * Math.PI * 2;
      const up = 1.5 + Math.random() * 3;
      mesh.userData.v = new THREE.Vector3(Math.cos(theta) * speed, up, Math.sin(theta) * speed);
      mesh.userData.life = 0.45 + Math.random() * 0.25;
      scene.add(mesh);
      particles.push(mesh);
    }
  }

  function floater(position, text, color = '#fff4c8') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const g = canvas.getContext('2d');
    g.font = 'bold 54px Trebuchet MS, Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.strokeStyle = '#4a2410';
    g.lineWidth = 8;
    g.strokeText(text, 128, 48);
    g.fillText(text, 128, 48);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.position.set(position.x, (position.y ?? 1.2) + 0.4, position.z);
    sprite.scale.set(1.6, 0.6, 1);
    sprite.userData.life = 0.8;
    sprite.userData.tex = tex;
    scene.add(sprite);
    floaters.push(sprite);
  }

  function ring(position, color = '#ffe08a') {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.48, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.08, position.z);
    scene.add(mesh);
    rings.push(mesh);
  }

  function glowPuff(position, color = '#ffffff', scale = 0.8) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow,
      color,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    }));
    sprite.position.set(position.x, position.y ?? 0.4, position.z);
    sprite.scale.setScalar(scale);
    sprite.userData.life = 0.35;
    sprite.userData.puff = true;
    scene.add(sprite);
    floaters.push(sprite);
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.userData.life -= dt;
      p.userData.v.y -= dt * 9;
      p.position.addScaledVector(p.userData.v, dt);
      const k = Math.max(p.userData.life, 0);
      p.scale.setScalar(k * 2);
      if (p.userData.life <= 0) {
        scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        particles.splice(i, 1);
      }
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      f.userData.life -= dt;
      f.position.y += dt * (f.userData.puff ? 0.4 : 1.1);
      if (f.material) f.material.opacity = Math.max(0, f.userData.life / 0.8);
      if (f.userData.puff) f.scale.multiplyScalar(1 + dt * 2.5);
      if (f.userData.life <= 0) {
        scene.remove(f);
        if (f.material.map && f.userData.tex) f.userData.tex.dispose();
        f.material.dispose();
        floaters.splice(i, 1);
      }
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.scale.multiplyScalar(1 + dt * 4.5);
      r.material.opacity -= dt * 1.6;
      if (r.material.opacity <= 0) {
        scene.remove(r);
        r.geometry.dispose();
        r.material.dispose();
        rings.splice(i, 1);
      }
    }
  }

  function clear() {
    [...particles, ...floaters, ...rings].forEach((obj) => {
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.userData.tex) obj.userData.tex.dispose();
        obj.material.dispose();
      }
    });
    particles.length = 0;
    floaters.length = 0;
    rings.length = 0;
  }

  return { burst, floater, ring, glowPuff, update, clear };
}
