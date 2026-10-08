import * as THREE from 'three';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function createInput() {
  const down = new Set();
  const pressed = new Set();
  const virtual = new Set();
  const look = { x: 0, y: 0 };
  const stick = { x: 0, y: 0 };
  let attackClick = false;

  function typing() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  function onKeyDown(e) {
    if (typing()) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  }

  function onKeyUp(e) {
    if (virtual.has(e.code)) return;
    down.delete(e.code);
  }

  function releaseVirtual() {
    virtual.forEach((code) => down.delete(code));
    virtual.clear();
    stick.x = 0;
    stick.y = 0;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseVirtual();
  });

  return {
    look,
    stick,
    has(code) { return down.has(code); },
    once(code) { return pressed.has(code); },
    consumeClick() {
      const value = attackClick;
      attackClick = false;
      return value;
    },
    requestAttack() { attackClick = true; },
    tap(code) { pressed.add(code); },
    hold(code, isDown) {
      if (isDown) {
        if (!down.has(code)) pressed.add(code);
        down.add(code);
        virtual.add(code);
      } else if (virtual.has(code)) {
        virtual.delete(code);
        down.delete(code);
      }
    },
    setStick(x, y) {
      stick.x = x;
      stick.y = y;
    },
    releaseVirtual,
    endFrame() {
      pressed.clear();
      look.x = 0;
      look.y = 0;
      attackClick = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}

export function readMove(input) {
  const stick = input.stick;
  if (stick && (Math.abs(stick.x) > 0.08 || Math.abs(stick.y) > 0.08)) {
    return { forward: stick.y, strafe: stick.x };
  }
  let forward = 0;
  let strafe = 0;
  if (input.has('KeyW') || input.has('ArrowUp')) forward += 1;
  if (input.has('KeyS') || input.has('ArrowDown')) forward -= 1;
  if (input.has('KeyD') || input.has('ArrowRight')) strafe += 1;
  if (input.has('KeyA') || input.has('ArrowLeft')) strafe -= 1;
  return { forward, strafe };
}

export function cameraBasis(camera, forward, right) {
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
  forward.normalize();
  right.crossVectors(forward, _up).normalize();
  return { forward, right };
}

export function basisVectors() {
  return { forward: _fwd, right: _right };
}

export function shiftDown(input) {
  return input.has('ShiftLeft') || input.has('ShiftRight');
}
