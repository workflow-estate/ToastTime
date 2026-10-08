import * as THREE from 'three';

const cache = new Map();

function canvasTexture(key, size, draw) {
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function noiseDot(g, x, y, r, color, alpha = 1) {
  g.fillStyle = color;
  g.globalAlpha = alpha;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

export function grassTexture() {
  return canvasTexture('grass', 256, (g, s) => {
    g.fillStyle = '#63c453';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i += 1) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      noiseDot(g, x, y, 1.2 + Math.random() * 2.2, Math.random() > 0.5 ? '#4eaa3d' : '#8be06a', 0.8);
    }
    g.strokeStyle = 'rgba(40, 110, 40, 0.18)';
    for (let i = 0; i < 40; i += 1) {
      g.beginPath();
      const x = Math.random() * s;
      const y = Math.random() * s;
      g.moveTo(x, y);
      g.lineTo(x + 2, y - 7);
      g.stroke();
    }
  });
}

export function pathTexture() {
  return canvasTexture('path', 128, (g, s) => {
    g.fillStyle = '#d8b07a';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 180; i += 1) noiseDot(g, Math.random() * s, Math.random() * s, 2, '#c49662', 0.7);
  });
}

export function iceTexture() {
  return canvasTexture('ice', 256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, s, s);
    grd.addColorStop(0, '#e7fbff');
    grd.addColorStop(1, '#b7e4ff');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(90, 150, 190, 0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 14; i += 1) {
      g.beginPath();
      let x = Math.random() * s;
      let y = Math.random() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k += 1) {
        x += (Math.random() - 0.5) * 50;
        y += (Math.random() - 0.4) * 40;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 80; i += 1) noiseDot(g, Math.random() * s, Math.random() * s, 1.5, '#ffffff', 0.7);
  });
}

export function rockTexture() {
  return canvasTexture('rock', 256, (g, s) => {
    g.fillStyle = '#4a342c';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i += 1) {
      noiseDot(g, Math.random() * s, Math.random() * s, 2 + Math.random() * 5, Math.random() > 0.5 ? '#3a2822' : '#6a4a3c', 0.85);
    }
  });
}

export function metalTexture() {
  return canvasTexture('metal', 256, (g, s) => {
    g.fillStyle = '#8ea0b5';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#6e8298';
    g.lineWidth = 3;
    const step = 64;
    for (let y = 0; y <= s; y += step) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(s, y);
      g.stroke();
    }
    for (let x = 0; x <= s; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, s);
      g.stroke();
    }
    g.fillStyle = '#d5e2ee';
    for (let y = 18; y < s; y += step) {
      for (let x = 18; x < s; x += step) noiseDot(g, x, y, 3, '#d5e2ee', 0.9);
    }
  });
}

export function lavaTexture() {
  return canvasTexture('lava', 128, (g, s) => {
    g.fillStyle = '#ff4a12';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i += 1) {
      noiseDot(g, Math.random() * s, Math.random() * s, 8 + Math.random() * 16, Math.random() > 0.4 ? '#ffd24a' : '#c41400', 0.85);
    }
  });
}

export function fieldTexture() {
  return canvasTexture('field', 512, (g, s) => {
    for (let x = 0; x < s; x += 32) {
      g.fillStyle = x % 64 === 0 ? '#3caf4a' : '#46c256';
      g.fillRect(x, 0, 32, s);
    }
    g.strokeStyle = 'rgba(255,255,255,0.92)';
    g.lineWidth = 6;
    g.strokeRect(18, 18, s - 36, s - 36);
    g.beginPath();
    g.moveTo(s / 2, 18);
    g.lineTo(s / 2, s - 18);
    g.stroke();
    g.beginPath();
    g.arc(s / 2, s / 2, 54, 0, Math.PI * 2);
    g.stroke();
    g.strokeRect(18, s * 0.28, 70, s * 0.44);
    g.strokeRect(s - 88, s * 0.28, 70, s * 0.44);
  });
}

export function glowTexture() {
  return canvasTexture('glow', 64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

export function skyTexture(top, bottom) {
  const key = `sky-${top}-${bottom}`;
  return canvasTexture(key, 32, (g, s) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, top);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

export function labelTexture(text, bg, fg) {
  const key = `label-${text}-${bg}-${fg}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = fg;
  g.font = 'bold 54px Trebuchet MS, Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

export function disposeTextureCache() {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}
