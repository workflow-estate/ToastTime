import { clamp } from './util.js';

export function circleHitsAabb(x, z, radius, rect) {
  const cx = clamp(x, rect.minX, rect.maxX);
  const cz = clamp(z, rect.minZ, rect.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < radius * radius;
}

export function circleHitsAny(x, z, radius, rects) {
  for (let i = 0; i < rects.length; i += 1) {
    if (circleHitsAabb(x, z, radius, rects[i])) return true;
  }
  return false;
}

function easeFeet(pos, target, dt) {
  if (target == null) return;
  if (!Number.isFinite(pos.y)) {
    pos.y = target;
    return;
  }
  const k = 1 - Math.exp(-14 * dt);
  pos.y += (target - pos.y) * k;
  if (Math.abs(target - pos.y) < 0.02) pos.y = target;
}

export function climbStep(pos, nextX, nextZ, radius, rects, heightAt, maxStep = 1.15, dt = 0.016) {
  const attempt = (x, z) => {
    const body = { x, z };
    resolveCircle(body, radius, rects);
    if (!heightAt) return body;
    const h0 = heightAt(pos.x, pos.z);
    const h1 = heightAt(body.x, body.z);
    if (h1 - h0 > maxStep + 0.02) return null;
    body.y = h1;
    return body;
  };
  const full = attempt(nextX, nextZ);
  const picked = full || attempt(nextX, pos.z) || attempt(pos.x, nextZ);
  if (!picked) {
    if (heightAt) easeFeet(pos, heightAt(pos.x, pos.z), dt);
    return pos;
  }
  pos.x = picked.x;
  pos.z = picked.z;
  if (picked.y != null) easeFeet(pos, picked.y, dt);
  return pos;
}

export function resolveCircle(pos, radius, rects) {
  for (let iter = 0; iter < 3; iter += 1) {
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      const closestX = clamp(pos.x, r.minX, r.maxX);
      const closestZ = clamp(pos.z, r.minZ, r.maxZ);
      let dx = pos.x - closestX;
      let dz = pos.z - closestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 < 1e-8) {
        const left = pos.x - r.minX;
        const right = r.maxX - pos.x;
        const down = pos.z - r.minZ;
        const up = r.maxZ - pos.z;
        const m = Math.min(left, right, down, up);
        if (m === left) pos.x = r.minX - radius;
        else if (m === right) pos.x = r.maxX + radius;
        else if (m === down) pos.z = r.minZ - radius;
        else pos.z = r.maxZ + radius;
      } else {
        const d = Math.sqrt(d2) || 1;
        const push = (radius - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
  }
  return pos;
}

export function keepInside(pos, radius, bounds) {
  pos.x = clamp(pos.x, bounds.minX + radius, bounds.maxX - radius);
  pos.z = clamp(pos.z, bounds.minZ + radius, bounds.maxZ - radius);
  return pos;
}

export function findClearPoint(x, z, radius, rects, bounds) {
  const inside = (px, pz) => (
    px >= bounds.minX + radius
    && px <= bounds.maxX - radius
    && pz >= bounds.minZ + radius
    && pz <= bounds.maxZ - radius
    && !circleHitsAny(px, pz, radius, rects)
  );
  if (inside(x, z)) return { x, z };
  for (let ring = 0.6; ring <= 10; ring += 0.7) {
    for (let a = 0; a < 10; a += 1) {
      const ang = (a / 10) * Math.PI * 2;
      const nx = x + Math.cos(ang) * ring;
      const nz = z + Math.sin(ang) * ring;
      if (inside(nx, nz)) return { x: nx, z: nz };
    }
  }
  return null;
}

export function segmentHits(ax, az, bx, bz, rects) {
  const steps = 6;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (circleHitsAny(x, z, 0.25, rects)) return true;
  }
  return false;
}
