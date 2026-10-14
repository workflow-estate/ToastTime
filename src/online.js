import { Capacitor } from '@capacitor/core';

function onlineBase() {
  if (import.meta.env.DEV) return '';
  if (Capacitor.getPlatform() === 'android') return 'http://10.0.2.2:8787';
  return 'http://127.0.0.1:8787';
}

function messageFor(code, fallback) {
  if (code === 'offline') return 'Could not reach online levels.';
  return fallback || 'Could not publish that level.';
}

async function request(path, body) {
  let response;
  try {
    response = await fetch(`${onlineBase()}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error(messageFor('offline'));
    err.code = 'offline';
    throw err;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.message || messageFor(data.error));
    err.code = data.error || 'bad-world';
    throw err;
  }
  return data;
}

export function fetchLevels() {
  return request('/api/online/levels').then((data) => (Array.isArray(data.levels) ? data.levels : []));
}

export function publishLevel(world) {
  return request('/api/online/levels', {
    world: {
      id: world.id,
      name: world.name,
      floor: world.floor,
      coins: world.coins,
      enemies: world.enemies,
      author: world.author,
    },
  }).then((data) => data.level);
}
