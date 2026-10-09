import { Capacitor } from '@capacitor/core';
import * as THREE from 'three';
import { createInput } from './input.js';
import { createTouch } from './touch.js';
import { createUI } from './ui.js';
import { createPreview } from './preview.js';
import { createGame } from './game.js';
import { createSoccer } from './soccer.js';
import { createParty } from './party.js';
import { createEditor } from './editor.js';
import { unlockAudio, sfx, stopBossMusic } from './audio.js';
import {
  loadSave,
  getSave,
  addCoins,
  noteScore,
  markBossDefeated,
  setUsername,
  setSelectedMap,
  setSelectedSkin,
  tryUnlockSkin,
  buyUpgrade,
  saveEditedWorld,
  getSavedWorlds,
  markTutorialSeen,
  resetProgress,
  sanitizeUsername,
} from './save.js';

loadSave();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const ratioCap = window.matchMedia?.('(pointer: coarse)')?.matches ? 1.5 : 1.75;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.touchAction = 'none';
document.getElementById('game-root').appendChild(renderer.domElement);

const input = createInput();
const touch = createTouch(input, {
  onLook: (dx, dy) => {
    if (screen === 'play') game.look(dx, dy);
  },
  onUnlock: () => unlockAudio(),
});
const uiRoot = document.getElementById('ui-root');
let screen = 'menu';
let pickedFloor = 'park';
let editorLive = false;
let draftName = 'MY WORLD';
let queuedWorld = null;
let exitReturn = 'editor';
let partyArena = 'colosseum';
let runKind = 'campaign';
let shopNote = '';
let raf = 0;

const preview = createPreview();
const game = createGame({
  canvas: renderer.domElement,
  getSave,
  onCoins: (amount) => addCoins(amount),
  onScore: (score) => noteScore(score),
  onVictory: () => markBossDefeated(),
});
const soccer = createSoccer({ getSave });
const party = createParty({ getSave });
const editor = createEditor({ getSave });

let active = preview;

function leavePointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}

function showPreview(next) {
  leavePointer();
  active = preview;
  preview.setSplit(next === 'menu');
  screen = next;
  ui.show(next, next === 'shop' ? { message: shopNote } : next === 'settings' ? { confirm: false } : next === 'editorFloors' ? { floor: pickedFloor } : {});
}

const ui = createUI(uiRoot, {
  perform(act, id) {
    if (act === 'dismiss-howto') {
      game.dismissHowTo();
      return;
    }
    if (act === 'menu' || act === 'exit-editor') {
      if (editorLive) {
        exitReturn = screen === 'editorFloors' ? 'floors' : 'editor';
        screen = 'editor';
        ui.show('editor', { confirm: true, name: worldName() });
        return;
      }
      goMenu();
      return;
    }
    if (act === 'exit-editor-yes') {
      editorLive = false;
      draftName = 'MY WORLD';
      goMenu();
      return;
    }
    if (act === 'exit-editor-no') {
      if (exitReturn === 'floors') {
        screen = 'editorFloors';
        ui.show('editorFloors', { floor: pickedFloor });
      } else {
        screen = 'editor';
        ui.show('editor', { name: draftName });
      }
      return;
    }
    if (act === 'play') {
      if (!getSave().tutorialSeen) {
        showPreview('tutorial');
        return;
      }
      beginRun('campaign');
      return;
    }
    if (act === 'got-it') {
      markTutorialSeen();
      beginRun('campaign');
      return;
    }
    if (act === 'maps') return showPreview('maps');
    if (act === 'changeroom') return showPreview('changeroom');
    if (act === 'shop') return showPreview('shop');
    if (act === 'minigames') return showPreview('minigames');
    if (act === 'settings') return showPreview('settings');
    if (act === 'party') return showPreview('partyIntro');
    if (act === 'party-arenas') return showPreview('partyArenas');
    if (act === 'editor') {
      editorLive = false;
      draftName = 'MY WORLD';
      pickedFloor = 'park';
      return showPreview('editorFloors');
    }
    if (act === 'saved-worlds') return showPreview('savedWorlds');
    if (act === 'select-map') {
      setSelectedMap(id);
      ui.show('maps');
      return;
    }
    if (act === 'select-skin') {
      setSelectedSkin(id);
      ui.show('changeroom');
      return;
    }
    if (act === 'buy-legendary') {
      const result = tryUnlockSkin(id || 'legendary');
      shopNote = result.ok ? '' : 'NEED MORE COINS';
      ui.show('changeroom', { message: shopNote });
      if (!result.ok) sfx.lose();
      return;
    }
    if (act === 'buy-upgrade') {
      const result = buyUpgrade(id);
      shopNote = result.ok ? 'UPGRADE BAKED IN' : result.reason === 'coins' ? 'NEED MORE COINS' : '';
      ui.show('shop', { message: shopNote });
      return;
    }
    if (act === 'soccer-card') return showPreview('soccerTutorial');
    if (act === 'soccer-start' || act === 'soccer-again') {
      leavePointer();
      soccer.start();
      active = soccer;
      screen = 'soccer';
      ui.show('soccerHud');
      return;
    }
    if (act === 'party-start' || act === 'party-again') {
      if (act === 'party-start') partyArena = id || partyArena;
      leavePointer();
      party.start(partyArena);
      active = party;
      screen = 'party';
      ui.show('partyHud');
      return;
    }
    if (act === 'pick-floor') {
      pickedFloor = id;
      ui.show('editorFloors', { floor: pickedFloor });
      return;
    }
    if (act === 'editor-continue') {
      leavePointer();
      if (editorLive) {
        editor.setFloor(pickedFloor);
      } else {
        editor.start(pickedFloor);
        active = editor;
      }
      editorLive = true;
      screen = 'editor';
      ui.show('editor', { name: draftName });
      return;
    }
    if (act === 'choose-floor') {
      editorLive = true;
      worldName();
      pickedFloor = editor.snapshot().floor;
      screen = 'editorFloors';
      ui.show('editorFloors', { floor: pickedFloor });
      return;
    }
    if (act === 'spawn-coin') return editor.spawn('coin');
    if (act === 'spawn-enemy') return editor.spawn('enemy');
    if (act === 'remove-last') return editor.removeLast();
    if (act === 'save-world' || act === 'save-play') {
      const saved = storeDraft();
      if (!saved) {
        ui.show('editor', { message: 'COULD NOT SAVE', name: draftName });
        return;
      }
      if (act === 'save-world') {
        ui.show('editor', { message: 'SAVED', name: saved.name });
        return;
      }
      queuedWorld = saved;
      editor.dispose();
      editorLive = false;
      beginRun('custom');
      return;
    }
    if (act === 'play-saved') {
      const found = getSavedWorlds().find((world) => world.id === id);
      if (!found) return showPreview('savedWorlds');
      queuedWorld = found;
      beginRun('custom');
      return;
    }
    if (act === 'play-again') {
      beginRun(runKind);
      return;
    }
    if (act === 'restart-ask') {
      ui.show('settings', { confirm: true });
      return;
    }
    if (act === 'restart-no') {
      ui.show('settings', { confirm: false });
      return;
    }
    if (act === 'restart-yes') {
      resetProgress();
      shopNote = '';
      ui.show('settings', { confirm: false });
      return;
    }
  },
  onUsernameInput(value) {
    const trimmed = String(value).slice(0, 16);
    if (trimmed.trim()) setUsername(trimmed);
  },
  onUsernameBlur(value) {
    setUsername(sanitizeUsername(value));
    const field = uiRoot.querySelector('#username');
    if (field) field.value = getSave().username;
  },
});

function worldName() {
  const field = uiRoot.querySelector('#world-name');
  if (field) draftName = field.value;
  return draftName;
}

function storeDraft() {
  const saved = saveEditedWorld({ ...editor.snapshot(), name: worldName() });
  if (!saved) return null;
  editor.noteSaved(saved.id);
  draftName = saved.name;
  return saved;
}

function goMenu() {
  stopBossMusic();
  game.dispose();
  soccer.dispose();
  party.dispose();
  editor.dispose();
  shopNote = '';
  showPreview('menu');
}

function beginRun(kind) {
  stopBossMusic();
  leavePointer();
  runKind = kind;
  if (kind === 'custom' && queuedWorld) game.startCustom(queuedWorld);
  else {
    runKind = 'campaign';
    game.startCampaign(getSave().selectedMap);
  }
  active = game;
  screen = 'play';
  ui.show('hud');
}

renderer.domElement.addEventListener('click', () => {
  unlockAudio();
  if (screen === 'play' || screen === 'party' || screen === 'soccer') active.onClick?.();
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === renderer.domElement && screen === 'play') {
    game.look(event.movementX, event.movementY);
  }
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

function watchHud() {
  const hud = active.getHud?.();
  if (!hud) return;
  if (hud.kind === 'main' && screen === 'play') {
    if (hud.phase === 'dead') {
      screen = 'gameover';
      ui.show('gameover', hud);
    } else if (hud.phase === 'won') {
      screen = 'victory';
      ui.show('victory', hud);
    } else ui.updateHUD(hud);
  } else if (hud.kind === 'soccer' && screen === 'soccer') {
    if (hud.phase === 'result') {
      screen = 'soccerResult';
      ui.show('soccerResult', hud);
    } else ui.updateHUD(hud);
  } else if (hud.kind === 'party' && screen === 'party') {
    if (hud.phase === 'result') {
      screen = 'partyResult';
      ui.show('partyResult', hud);
    } else ui.updateHUD(hud);
  } else if (hud.kind === 'editor' && screen === 'editor') {
    ui.updateHUD(hud);
  }
}

let last = performance.now();
function frame(now) {
  touch.setScreen(screen);
  const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (active?.scene && active.camera && screen !== 'editorFloors') {
    active.update(dt, input);
  }
  if (active?.scene && active.camera) renderer.render(active.scene, active.camera);
  watchHud();
  input.endFrame();
  raf = requestAnimationFrame(frame);
}

showPreview('menu');
raf = requestAnimationFrame(frame);
bootNative();

function bootNative() {
  if (!Capacitor.isNativePlatform()) return;
  import('@capacitor/status-bar').then(({ StatusBar }) => {
    StatusBar.hide().catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  }).catch(() => {});
  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', () => {
      if (screen === 'menu') App.exitApp();
      else goMenu();
    });
  }).catch(() => {});
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(raf);
    input.destroy();
  });
}
