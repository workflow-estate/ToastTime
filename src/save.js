import { getSkin } from './skins.js';

const STORAGE_KEY = 'toast-time-save-v1';

export const UPGRADE_DEFS = [
  {
    id: 'maxHealth',
    name: 'MAX HEALTH',
    desc: 'Permanently adds +20 HP per upgrade level.',
    max: 5,
    prices: [20, 35, 55, 80, 120],
  },
  {
    id: 'runSpeed',
    name: 'RUN SPEED',
    desc: 'Permanently increases movement speed.',
    max: 5,
    prices: [15, 28, 45, 70, 100],
  },
  {
    id: 'coinMagnet',
    name: 'COIN MAGNET',
    desc: 'Pulls nearby coins toward you.',
    max: 4,
    prices: [12, 24, 40, 65],
  },
  {
    id: 'orbitDamage',
    name: 'ORBIT DAMAGE',
    desc: 'Makes orbiting attack balls hit harder.',
    max: 5,
    prices: [18, 32, 50, 75, 110],
  },
  {
    id: 'armour',
    name: 'ARMOUR',
    desc: 'Reduces incoming damage.',
    max: 5,
    prices: [18, 30, 48, 72, 105],
  },
  {
    id: 'powerLuck',
    name: 'POWER LUCK',
    desc: 'Makes power-ups appear faster.',
    max: 4,
    prices: [14, 26, 42, 68],
  },
];

export const LEGENDARY_COST = 50;

const DEFAULT_UNLOCKED = ['classic', 'strawberry', 'blueberry', 'galaxy', 'avocado', 'butter'];

export function defaultSave() {
  return {
    username: 'Toasty',
    coins: 0,
    bestScore: 0,
    playerLevel: 1,
    selectedSkin: 'classic',
    unlockedSkins: [...DEFAULT_UNLOCKED],
    legendaryUnlocked: false,
    selectedMap: 'park',
    upgrades: {
      maxHealth: 0,
      runSpeed: 0,
      coinMagnet: 0,
      orbitDamage: 0,
      armour: 0,
      powerLuck: 0,
    },
    tutorialSeen: false,
    customWorld: null,
  };
}

function sanitize(raw) {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const next = {
    ...base,
    ...raw,
    upgrades: { ...base.upgrades, ...(raw.upgrades || {}) },
    unlockedSkins: Array.isArray(raw.unlockedSkins) ? [...raw.unlockedSkins] : [...base.unlockedSkins],
  };
  next.username = sanitizeUsername(next.username);
  next.coins = Math.max(0, Math.floor(Number(next.coins) || 0));
  next.bestScore = Math.max(0, Math.floor(Number(next.bestScore) || 0));
  next.playerLevel = Math.max(1, Math.floor(Number(next.playerLevel) || 1));
  next.legendaryUnlocked = Boolean(next.legendaryUnlocked);
  next.tutorialSeen = Boolean(next.tutorialSeen);
  if (next.legendaryUnlocked && !next.unlockedSkins.includes('legendary')) {
    next.unlockedSkins.push('legendary');
  }
  if (!next.unlockedSkins.includes(next.selectedSkin)) next.selectedSkin = 'classic';
  if (!['park', 'fridge', 'volcano', 'space'].includes(next.selectedMap)) next.selectedMap = 'park';
  for (const def of UPGRADE_DEFS) {
    next.upgrades[def.id] = clampLevel(next.upgrades[def.id], def.max);
  }
  if (!next.customWorld || typeof next.customWorld !== 'object') next.customWorld = null;
  return next;
}

function clampLevel(value, max) {
  const n = Math.floor(Number(value) || 0);
  return Math.max(0, Math.min(max, n));
}

export function sanitizeUsername(name) {
  const trimmed = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return trimmed.length ? trimmed : 'Toasty';
}

let state = defaultSave();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Toast Time could not save progress', err);
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = sanitize(raw ? JSON.parse(raw) : null);
  } catch (err) {
    console.warn('Toast Time could not read save', err);
    state = defaultSave();
  }
  persist();
  return state;
}

export function getSave() {
  return state;
}

export function writeSave() {
  persist();
  return state;
}

export function addCoins(amount) {
  state.coins = Math.max(0, state.coins + Math.floor(amount));
  persist();
  return state.coins;
}

export function noteScore(score) {
  const next = Math.max(0, Math.floor(score));
  if (next > state.bestScore) {
    state.bestScore = next;
    persist();
  }
  return state.bestScore;
}

export function markBossDefeated() {
  state.playerLevel += 1;
  persist();
  return state.playerLevel;
}

export function setUsername(name) {
  state.username = sanitizeUsername(name);
  persist();
  return state.username;
}

export function setSelectedMap(id) {
  state.selectedMap = id;
  persist();
}

export function setSelectedSkin(id) {
  if (!state.unlockedSkins.includes(id)) return false;
  state.selectedSkin = id;
  persist();
  return true;
}

export function ownsSkin(id, save = state) {
  if (save.unlockedSkins.includes(id)) return true;
  if (id === 'legendary' && save.legendaryUnlocked) return true;
  return !getSkin(id).cost;
}

export function tryUnlockSkin(id) {
  const skin = getSkin(id);
  if (!skin.cost) return { ok: false, reason: 'free' };
  if (ownsSkin(id)) {
    state.selectedSkin = id;
    persist();
    return { ok: true, reason: 'owned' };
  }
  if (state.coins < skin.cost) return { ok: false, reason: 'coins' };
  state.coins -= skin.cost;
  if (!state.unlockedSkins.includes(id)) state.unlockedSkins.push(id);
  if (id === 'legendary') state.legendaryUnlocked = true;
  state.selectedSkin = id;
  persist();
  return { ok: true };
}

export function tryUnlockLegendary() {
  return tryUnlockSkin('legendary');
}

export function getActivePower(save = state) {
  const skin = getSkin(save.selectedSkin);
  if (!skin.power || !ownsSkin(skin.id, save)) return null;
  return skin.power.id;
}

export function buyUpgrade(id) {
  const def = UPGRADE_DEFS.find((item) => item.id === id);
  if (!def) return { ok: false, reason: 'missing' };
  const level = state.upgrades[id] || 0;
  if (level >= def.max) return { ok: false, reason: 'max' };
  const price = def.prices[level];
  if (state.coins < price) return { ok: false, reason: 'coins' };
  state.coins -= price;
  state.upgrades[id] = level + 1;
  persist();
  return { ok: true, level: state.upgrades[id] };
}

export function setCustomWorld(world) {
  state.customWorld = world;
  persist();
}

export function markTutorialSeen() {
  state.tutorialSeen = true;
  persist();
}

export function resetProgress() {
  const username = state.username;
  state = defaultSave();
  state.username = username || 'Toasty';
  persist();
  return state;
}

export function getRunStats(save = state) {
  const armourLevel = save.upgrades.armour || 0;
  return {
    maxHp: 100 + (save.upgrades.maxHealth || 0) * 20,
    speed: 6.7 + (save.upgrades.runSpeed || 0) * 0.82,
    magnet: (save.upgrades.coinMagnet || 0) * 2.35,
    orbitDamage: 10 + (save.upgrades.orbitDamage || 0) * 7,
    armourMultiplier: 1 - Math.min(0.6, armourLevel * 0.12),
    powerInterval: Math.max(3.1, 9.5 - (save.upgrades.powerLuck || 0) * 1.55),
    armourLevel,
  };
}

export function isLegendaryActive(save = state) {
  return getActivePower(save) === 'block';
}
