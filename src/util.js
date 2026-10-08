export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

export function angDist(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.hypot(dx, dz);
}

export function yawFromDir(x, z) {
  return Math.atan2(x, z);
}

export function forwardFromYaw(yaw, target = { x: 0, z: 0 }) {
  target.x = Math.sin(yaw);
  target.z = Math.cos(yaw);
  return target;
}

export function randRange(rng, a, b) {
  return a + rng() * (b - a);
}

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}
