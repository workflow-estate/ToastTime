import * as THREE from 'three';
import { skyTexture } from './textures.js';

export function dressScene(scene, look) {
  scene.background = new THREE.Color(look.background);
  scene.fog = new THREE.Fog(look.fog, look.fogNear, look.fogFar);

  const hemi = new THREE.HemisphereLight(look.sky, look.ground, look.hemi ?? 0.72);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(look.sun, look.sunIntensity ?? 1.45);
  sun.position.set(look.sunX ?? 16, look.sunY ?? 28, look.sunZ ?? 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  const span = look.shadowSpan ?? 30;
  const cam = sun.shadow.camera;
  cam.left = -span;
  cam.right = span;
  cam.top = span;
  cam.bottom = -span;
  cam.near = 1;
  cam.far = look.shadowFar ?? 80;
  sun.shadow.radius = 2;
  scene.add(sun);
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);

  const skyGeo = new THREE.SphereGeometry(170, 20, 14);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTexture(look.skyTop, look.skyBottom),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.userData.isSky = true;
  scene.add(sky);

  const fill = new THREE.DirectionalLight(look.fill ?? '#fff2d8', 0.7);
  fill.position.set(-12, 10, -8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight('#fff7e4', 0.38);
  rim.position.set(-8, 6, 18);
  scene.add(rim);

  return { sun, hemi };
}

export function stdMat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.78,
    metalness: extras.metalness ?? 0.02,
    ...extras,
  });
}

export function addMesh(scene, geometry, material, x, y, z, opts = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (opts.scale) mesh.scale.set(opts.scale, opts.scaleY ?? opts.scale, opts.scaleZ ?? opts.scale);
  if (opts.rotY) mesh.rotation.y = opts.rotY;
  if (opts.rotX) mesh.rotation.x = opts.rotX;
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  scene.add(mesh);
  return mesh;
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry && !obj.geometry.userData.shared) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m.map && m.map.userData?.owned) m.map.dispose();
        if (!m.userData?.shared) m.dispose();
      });
    }
  });
}
