// Sounds and music.
//   sfx('coin')                               instant made-up sound, no file needed. Names:
//       coin, jump, hit, hurt, explode, laser, powerup, click, win, lose, step, whoosh, bounce, magic
//   sound.play('assets/sounds/kenney/coin.mp3', { volume: 0.8, pitch: 1.2 })   play a sound file
//   sound.play(path, { at: enemy.position })  quieter when far from the camera
//   const s = sound.play(path, { loop: true }); s.stop()
//   sound.music('assets/music/adventure.mp3', { volume: 0.4 })   background music (loops)
//   sound.stopMusic()
// Sounds only start after the first click or key press (browser rule).
// Sliders: "Sound" (master, music and effects volume).
import { tune } from './tuning.js';
import { world } from './world.js';
import { sendLog } from './debug.js';

let ctx = null;
let master = null;
let musicGain = null;
let fxGain = null;
let V = null;
const buffers = new Map();
let musicSource = null;
let musicPath = '';

function audio() {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.connect(master);
  fxGain = ctx.createGain();
  fxGain.connect(master);
  return ctx;
}

export function initAudio() {
  V = tune('Sound', {
    master: { value: 0.8, min: 0, max: 1 },
    music: { value: 0.5, min: 0, max: 1 },
    effects: { value: 1, min: 0, max: 1 },
  });
  const unlock = () => audio().resume();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export function updateAudio() {
  if (!ctx) return;
  master.gain.value = V.master;
  musicGain.gain.value = V.music;
  fxGain.gain.value = V.effects;
}

function loadBuffer(path) {
  if (!buffers.has(path)) {
    buffers.set(
      path,
      fetch(path)
        .then((r) => {
          if (!r.ok) throw new Error(`Sound file not found: public/${path}`);
          return r.arrayBuffer();
        })
        .then((data) => audio().decodeAudioData(data))
        .catch((e) => {
          sendLog('error', e.message);
          console.warn(e.message);
          return null;
        }),
    );
  }
  return buffers.get(path);
}

export const sound = {
  preload(paths) {
    return Promise.all([].concat(paths).map(loadBuffer));
  },

  play(path, { volume = 1, pitch = 1, randomPitch = 0.08, loop = false, at = null } = {}) {
    const handle = { source: null, stopped: false, stop() { this.stopped = true; this.source?.stop(); } };
    const c = audio();
    loadBuffer(path).then((buffer) => {
      if (!buffer || handle.stopped) return;
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.playbackRate.value = pitch * (1 + (Math.random() * 2 - 1) * randomPitch);
      const gain = c.createGain();
      let v = volume;
      if (at) {
        const d = world.camera.position.distanceTo(at.isVector3 ? at : at.position);
        v *= 1 / (1 + d * 0.08);
      }
      gain.gain.value = v;
      source.connect(gain).connect(fxGain);
      source.start();
      handle.source = source;
    });
    return handle;
  },

  async music(path, { volume = 1 } = {}) {
    if (musicPath === path) return;
    this.stopMusic();
    musicPath = path;
    const buffer = await loadBuffer(path);
    if (!buffer || musicPath !== path) return;
    const c = audio();
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + 1.5);
    source.connect(gain).connect(musicGain);
    source.start();
    musicSource = { source, gain };
  },

  stopMusic() {
    musicPath = '';
    if (!musicSource) return;
    const { source, gain } = musicSource;
    const c = audio();
    gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
    source.stop(c.currentTime + 0.6);
    musicSource = null;
  },
};

// ---- Made-up sounds (synthesized), so games make noise without any files ----

const RECIPES = {
  coin: [{ type: 'square', from: 988, to: 988, time: 0.06, vol: 0.25 }, { type: 'square', from: 1319, to: 1319, time: 0.25, delay: 0.06, vol: 0.25 }],
  jump: [{ type: 'square', from: 260, to: 620, time: 0.18, vol: 0.2 }],
  hit: [{ noise: true, time: 0.12, vol: 0.5, filter: 1200 }, { type: 'triangle', from: 220, to: 60, time: 0.12, vol: 0.4 }],
  hurt: [{ type: 'sawtooth', from: 440, to: 110, time: 0.3, vol: 0.25 }],
  explode: [{ noise: true, time: 0.9, vol: 0.8, filter: 700 }, { type: 'sine', from: 120, to: 30, time: 0.7, vol: 0.6 }],
  laser: [{ type: 'square', from: 1500, to: 200, time: 0.18, vol: 0.18 }],
  powerup: [{ type: 'square', from: 300, to: 1200, time: 0.45, vol: 0.18, vibrato: 18 }],
  click: [{ type: 'sine', from: 800, to: 600, time: 0.05, vol: 0.3 }],
  win: [523, 659, 784, 1047].map((f, i) => ({ type: 'triangle', from: f, to: f, time: 0.25, delay: i * 0.13, vol: 0.3 })),
  lose: [392, 330, 262, 196].map((f, i) => ({ type: 'triangle', from: f, to: f * 0.97, time: 0.35, delay: i * 0.2, vol: 0.3 })),
  step: [{ noise: true, time: 0.05, vol: 0.15, filter: 500 }],
  whoosh: [{ noise: true, time: 0.35, vol: 0.3, filter: 2500, sweep: true }],
  bounce: [{ type: 'sine', from: 180, to: 520, time: 0.15, vol: 0.4 }],
  magic: [0, 1, 2, 3, 4].map((i) => ({ type: 'sine', from: 900 + i * 220, to: 1100 + i * 220, time: 0.2, delay: i * 0.05, vol: 0.15 })),
};

let noiseBuffer = null;

export function sfx(name, { volume = 1, pitch = 1 } = {}) {
  const recipe = RECIPES[name];
  if (!recipe) {
    sendLog('warn', `sfx("${name}") doesn't exist. Try: ${Object.keys(RECIPES).join(', ')}`);
    return;
  }
  const c = audio();
  if (c.state !== 'running') return;
  const p = pitch * (1 + (Math.random() - 0.5) * 0.1);
  for (const part of recipe) {
    const t0 = c.currentTime + (part.delay || 0);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(part.vol * volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + part.time);
    gain.connect(fxGain);
    let src;
    if (part.noise) {
      if (!noiseBuffer) {
        noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = noiseBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      src = c.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(part.filter * p, t0);
      if (part.sweep) filter.frequency.exponentialRampToValueAtTime(part.filter * 4 * p, t0 + part.time);
      src.connect(filter).connect(gain);
    } else {
      src = c.createOscillator();
      src.type = part.type;
      src.frequency.setValueAtTime(part.from * p, t0);
      src.frequency.exponentialRampToValueAtTime(Math.max(1, part.to * p), t0 + part.time);
      if (part.vibrato) {
        const lfo = c.createOscillator();
        const depth = c.createGain();
        lfo.frequency.value = part.vibrato;
        depth.gain.value = 30;
        lfo.connect(depth).connect(src.frequency);
        lfo.start(t0);
        lfo.stop(t0 + part.time);
      }
      src.connect(gain);
    }
    src.start(t0);
    src.stop(t0 + part.time + 0.05);
  }
}
