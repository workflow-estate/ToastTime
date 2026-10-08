import * as THREE from 'three';
import { glowTexture } from './textures.js';

export const POWER_INFO = {
  orbit: { name: 'ORBIT', color: '#3aa0ff', label: 'ORBIT' },
  speed: { name: 'SPEED', color: '#ffd84a', label: 'SPEED' },
  shield: { name: 'SHIELD', color: '#8dffb0', label: 'SHIELD' },
  heal: { name: 'HEAL', color: '#3dde78', label: 'HEAL' },
  freeze: { name: 'FREEZE', color: '#9aecff', label: 'FREEZE' },
  shockwave: { name: 'SHOCKWAVE', color: '#ff7a3c', label: 'SHOCK' },
  superkick: { name: 'SUPER KICK', color: '#ff8a2a', label: 'KICK' },
};

const glow = glowTexture();

export function createCoinMesh() {
  const group = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.08, 22),
    new THREE.MeshStandardMaterial({
      color: '#ffcf4a',
      emissive: '#e29a12',
      emissiveIntensity: 0.35,
      metalness: 0.82,
      roughness: 0.22,
    }),
  );
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  group.add(coin);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.03, 8, 20),
    new THREE.MeshStandardMaterial({ color: '#fff1b0', metalness: 0.7, roughness: 0.25, emissive: '#ffd56a', emissiveIntensity: 0.2 }),
  );
  rim.castShadow = true;
  group.add(rim);
  const mark = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 16),
    new THREE.MeshStandardMaterial({ color: '#c98416', roughness: 0.45, metalness: 0.4 }),
  );
  mark.position.z = 0.05;
  group.add(mark);
  const back = mark.clone();
  back.position.z = -0.05;
  back.rotation.y = Math.PI;
  group.add(back);
  group.position.y = 0.85;
  group.userData.baseY = 0.85;
  return group;
}

export function createPowerMesh(type) {
  const info = POWER_INFO[type] || POWER_INFO.orbit;
  const group = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    new THREE.MeshStandardMaterial({
      color: info.color,
      emissive: info.color,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.18,
    }),
  );
  gem.castShadow = true;
  group.add(gem);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.045, 8, 22),
    new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: info.color, emissiveIntensity: 0.3, roughness: 0.3 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow,
    color: info.color,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  }));
  sprite.scale.set(1.5, 1.5, 1);
  group.add(sprite);
  group.position.y = 0.9;
  group.userData.type = type;
  group.userData.baseY = 0.9;
  group.userData.label = info.name;
  return group;
}

export function spinPickup(mesh, time, spin = 1.6) {
  mesh.rotation.y += spin * 0.016;
  const bob = Math.sin(time * 3 + mesh.id) * 0.12;
  mesh.position.y = (mesh.userData.baseY || 0.8) + bob;
}

export function updateCoin(mesh, time) {
  mesh.rotation.y = time * 2.4;
  mesh.position.y = mesh.userData.baseY + Math.sin(time * 3 + mesh.position.x) * 0.1;
}
