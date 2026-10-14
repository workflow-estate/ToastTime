import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectFile = path.join(root, 'data', 'online.json');
const sharedFile = path.join(os.homedir(), 'Library', 'Application Support', 'Toast Time', 'online.json');
const file = process.env.TOAST_ONLINE_FILE || sharedFile;

const FLOORS = new Set(['park', 'fridge', 'volcano', 'space']);

let chain = Promise.resolve();

function update(fn) {
  const run = chain.then(fn);
  chain = run.then(() => {}, () => {});
  return run;
}

function cleanAuthor(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return name || 'Toasty';
}

function cleanPoints(list, max) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const point of list) {
    if (out.length >= max) break;
    const x = Number(point?.x);
    const z = Number(point?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    out.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
  }
  return out;
}

function cleanWorld(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const floor = FLOORS.has(raw.floor) ? raw.floor : 'park';
  const name = String(raw.name || 'MY WORLD').replace(/\s+/g, ' ').trim().slice(0, 24) || 'MY WORLD';
  let id = String(raw.id || '').slice(0, 40);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) id = `level-${Date.now()}`;
  return {
    id,
    name,
    floor,
    coins: cleanPoints(raw.coins, 80),
    enemies: cleanPoints(raw.enemies, 40),
  };
}

function publicLevel(level) {
  return {
    id: level.id,
    name: level.name,
    floor: level.floor,
    coins: level.coins,
    enemies: level.enemies,
    author: level.author,
    createdAt: level.createdAt,
  };
}

function ensureStore() {
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (file !== projectFile && fs.existsSync(projectFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
      const levels = Array.isArray(raw.levels)
        ? raw.levels.filter((level) => level && !String(level.id || '').startsWith('seed-'))
        : [];
      fs.writeFileSync(file, JSON.stringify({ users: [], levels }));
      return;
    } catch {
      // The project copy could not be read, so start with an empty list.
    }
  }
  fs.writeFileSync(file, '{"users":[],"levels":[]}');
}

function read() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('bad');
    raw.users = Array.isArray(raw.users) ? raw.users : [];
    raw.levels = Array.isArray(raw.levels)
      ? raw.levels.filter((level) => level && !String(level.id || '').startsWith('seed-'))
      : [];
    return raw;
  } catch {
    const fresh = { users: [], levels: [] };
    write(fresh);
    return fresh;
  }
}

function write(db) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, file);
}

function fail(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

export function listLevels() {
  return update(() => {
    const db = read();
    return db.levels
      .map(publicLevel)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  });
}

export function publishLevel(world) {
  return update(() => {
    const db = read();
    const clean = cleanWorld(world);
    if (!clean) fail('bad-world');
    const next = {
      ...clean,
      author: cleanAuthor(world?.author),
      createdAt: Date.now(),
    };
    const existing = db.levels.find((level) => level.id === next.id);
    if (existing) {
      existing.name = next.name;
      existing.floor = next.floor;
      existing.coins = next.coins;
      existing.enemies = next.enemies;
      existing.author = next.author;
      existing.createdAt = next.createdAt;
      write(db);
      return publicLevel(existing);
    }
    db.levels.push(next);
    if (db.levels.length > 200) db.levels = db.levels.slice(-200);
    write(db);
    return publicLevel(next);
  });
}
