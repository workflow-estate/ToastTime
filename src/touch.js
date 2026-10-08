import { getSave, ownsSkin } from './save.js';
import { getSkin } from './skins.js';

const ACTIVE = new Set(['play', 'soccer', 'party', 'editor']);

export function wantsTouch() {
  return true;
}

export function createTouch(input, { onLook, onUnlock }) {
  const root = document.createElement('div');
  root.id = 'touch-root';
  root.className = 'touch-root hidden';
  root.innerHTML = `
    <div class="touch-look" data-zone="look"></div>
    <div class="stick-zone" data-zone="stick">
      <div class="stick resting">
        <div class="knob"></div>
      </div>
    </div>
    <div class="touch-actions">
      <button class="touch-btn act-block" type="button" data-hold="ShiftLeft">BLOCK</button>
      <button class="touch-btn act-cam" type="button" data-tap="Space">CAM</button>
      <button class="touch-btn act-kick" type="button" data-tap="Digit1">KICK</button>
      <button class="touch-btn act-bonk" type="button" data-tap="KeyF">BONK</button>
    </div>`;
  document.body.appendChild(root);

  const look = root.querySelector('.touch-look');
  const zone = root.querySelector('.stick-zone');
  const stick = root.querySelector('.stick');
  const knob = root.querySelector('.knob');
  const maxR = 52;
  let stickId = null;
  let lookId = null;
  let origin = { x: 0, y: 0 };
  let lookStart = { x: 0, y: 0, moved: 0 };
  let lookLast = { x: 0, y: 0 };
  let mode = 'menu';
  let powerKey = '';

  function syncPower() {
    const button = root.querySelector('.act-block');
    if (button.classList.contains('pressed')) return;
    const skin = getSkin(getSave().selectedSkin);
    const power = skin.power && ownsSkin(skin.id) ? skin.power : null;
    const next = power ? `${power.id}:${power.hold ? 'hold' : 'tap'}` : 'none';
    button.classList.toggle('off', !power);
    if (next === powerKey) return;
    powerKey = next;
    if (button.dataset.hold) input.hold(button.dataset.hold, false);
    delete button.dataset.hold;
    delete button.dataset.tap;
    if (!power) return;
    button.textContent = power.button;
    if (power.hold) button.dataset.hold = 'ShiftLeft';
    else button.dataset.tap = 'ShiftLeft';
  }

  function showFor(screen) {
    mode = screen;
    syncPower();
    const visible = wantsTouch() && ACTIVE.has(screen);
    root.classList.toggle('hidden', !visible);
    root.classList.remove('mode-play', 'mode-soccer', 'mode-party', 'mode-editor');
    if (visible) root.classList.add(`mode-${screen}`);
    document.body.classList.toggle('touch-on', wantsTouch());
    if (!visible) {
      releaseStick();
      input.releaseVirtual();
    }
  }

  function placeStick(clientX, clientY) {
    const rect = zone.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 58), rect.width - 58);
    const y = Math.min(Math.max(clientY - rect.top, 58), rect.height - 58);
    stick.classList.remove('resting');
    stick.style.left = `${x}px`;
    stick.style.top = `${y}px`;
    stick.style.bottom = 'auto';
    origin = { x: rect.left + x, y: rect.top + y };
  }

  function moveStick(clientX, clientY) {
    let dx = clientX - origin.x;
    let dy = clientY - origin.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / maxR;
    const ny = -dy / maxR;
    const mag = Math.hypot(nx, ny);
    if (mag < 0.18) input.setStick(0, 0);
    else {
      const scaled = Math.min(1, (mag - 0.18) / 0.82);
      input.setStick((nx / mag) * scaled, (ny / mag) * scaled);
    }
  }

  function releaseStick() {
    stickId = null;
    stick.classList.add('resting');
    stick.style.left = '';
    stick.style.top = '';
    stick.style.bottom = '';
    knob.style.transform = '';
    input.setStick(0, 0);
  }

  zone.addEventListener('pointerdown', (event) => {
    if (stickId != null) return;
    stickId = event.pointerId;
    zone.setPointerCapture(event.pointerId);
    onUnlock();
    event.preventDefault();
    placeStick(event.clientX, event.clientY);
    moveStick(event.clientX, event.clientY);
  });
  zone.addEventListener('pointermove', (event) => {
    if (event.pointerId !== stickId) return;
    moveStick(event.clientX, event.clientY);
  });
  function endStick(event) {
    if (event.pointerId !== stickId) return;
    releaseStick();
  }
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);

  look.addEventListener('pointerdown', (event) => {
    if (lookId != null || mode !== 'play') return;
    lookId = event.pointerId;
    look.setPointerCapture(event.pointerId);
    lookStart = { x: event.clientX, y: event.clientY, moved: 0 };
    lookLast = { x: event.clientX, y: event.clientY };
    onUnlock();
    event.preventDefault();
  });
  look.addEventListener('pointermove', (event) => {
    if (event.pointerId !== lookId) return;
    const dx = event.clientX - lookLast.x;
    const dy = event.clientY - lookLast.y;
    lookLast = { x: event.clientX, y: event.clientY };
    lookStart.moved += Math.abs(dx) + Math.abs(dy);
    if (dx || dy) onLook(dx * 1.35, dy * 1.35);
  });
  function endLook(event) {
    if (event.pointerId !== lookId) return;
    const dist = Math.hypot(event.clientX - lookStart.x, event.clientY - lookStart.y);
    if (lookStart.moved < 18 && dist < 22 && (mode === 'play' || mode === 'party')) input.tap('KeyF');
    lookId = null;
  }
  look.addEventListener('pointerup', endLook);
  look.addEventListener('pointercancel', endLook);

  root.querySelectorAll('.touch-btn').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      onUnlock();
      button.classList.add('pressed');
      if (button.dataset.hold) input.hold(button.dataset.hold, true);
      else if (button.dataset.tap) input.tap(button.dataset.tap);
    });
    const release = (event) => {
      if (!button.hasPointerCapture?.(event.pointerId) && !button.classList.contains('pressed')) return;
      button.classList.remove('pressed');
      if (button.dataset.hold) input.hold(button.dataset.hold, false);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  });

  root.addEventListener('contextmenu', (event) => event.preventDefault());

  return { setScreen: showFor };
}
