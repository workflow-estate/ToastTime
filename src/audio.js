import themeUrl from './assets/toast-time-theme.mp3';

let ctx = null;
let master = null;
let unlocked = false;
let theme = null;

function context() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  return ctx;
}

function startTheme() {
  if (!theme) {
    theme = new Audio(themeUrl);
    theme.loop = true;
    theme.volume = 0.55;
    theme.preload = 'auto';
  }
  if (theme.paused) theme.play().catch(() => {});
}

export function unlockAudio() {
  const audio = context();
  if (audio && audio.state === 'suspended') audio.resume();
  unlocked = true;
  startTheme();
}

window.addEventListener('pointerdown', () => unlockAudio());

function tone({ freq = 440, dur = 0.12, type = 'square', gain = 0.3, slide = 0, delay = 0 }) {
  const audio = context();
  if (!audio || !unlocked) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  click() { tone({ freq: 520, dur: 0.06, type: 'square', gain: 0.18, slide: 180 }); },
  coin() {
    tone({ freq: 880, dur: 0.08, type: 'square', gain: 0.2, slide: 220 });
    tone({ freq: 1320, dur: 0.1, type: 'square', gain: 0.14, delay: 0.06 });
  },
  hit() { tone({ freq: 180, dur: 0.12, type: 'sawtooth', gain: 0.22, slide: -80 }); },
  hurt() { tone({ freq: 320, dur: 0.16, type: 'triangle', gain: 0.24, slide: -180 }); },
  power() { tone({ freq: 440, dur: 0.14, type: 'square', gain: 0.18, slide: 440 }); },
  boss() {
    tone({ freq: 140, dur: 0.3, type: 'sawtooth', gain: 0.24, slide: 40 });
    tone({ freq: 90, dur: 0.4, type: 'square', gain: 0.16, delay: 0.08 });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'square', gain: 0.16, delay: i * 0.09 }));
  },
  lose() {
    [392, 349, 294, 220].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'triangle', gain: 0.18, delay: i * 0.1 }));
  },
  kick() { tone({ freq: 210, dur: 0.09, type: 'square', gain: 0.2, slide: 80 }); },
  goal() {
    tone({ freq: 660, dur: 0.12, type: 'square', gain: 0.2 });
    tone({ freq: 880, dur: 0.16, type: 'square', gain: 0.16, delay: 0.1 });
  },
  block() { tone({ freq: 700, dur: 0.08, type: 'square', gain: 0.16, slide: -200 }); },
};
