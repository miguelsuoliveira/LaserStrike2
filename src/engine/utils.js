// Small helpers for game code.
//   after(2, () => ...)              run once in 2 seconds (game time)
//   const t = every(1, () => ...)    run every second; t.cancel() stops it
//   random(1, 5)  randomInt(1, 6)  pick(['a', 'b'])  chance(0.3)
//   clamp(x, 0, 1)  lerp(a, b, t)  damp(current, target, 8, dt)
//   distance(a, b)  near(a, b, 2)    a and b are objects or positions
//   vec(1, 2, 3)                     new THREE.Vector3
//   wave(speed, amount, offset)      smooth up/down number for bobbing
//   turnTowards(object, targetPos, dt, speed)   smooth turn to face a point
//   time.now                         seconds since the game started
//   seedRandom(42)                   same "random" layout every time (call before building the level)
import * as THREE from 'three';

export const time = { now: 0, scale: 1 };

const timers = [];

export function after(seconds, fn) {
  const t = { at: time.now + seconds, fn, repeat: 0, cancel: () => (t.done = true) };
  timers.push(t);
  return t;
}

export function every(seconds, fn) {
  const t = { at: time.now + seconds, fn, repeat: seconds, cancel: () => (t.done = true) };
  timers.push(t);
  return t;
}

export function updateTimers() {
  for (let i = 0; i < timers.length; i++) {
    const t = timers[i];
    if (t.done || time.now < t.at) continue;
    if (t.repeat > 0) t.at += t.repeat;
    else t.done = true;
    t.fn();
  }
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].done) timers.splice(i, 1);
}

let rng = Math.random;
// After seedRandom(n), random()/randomInt()/pick()/chance() give the same sequence every load.
export function seedRandom(seed = 1) {
  let a = seed >>> 0;
  rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const random = (min = 0, max = 1) => min + rng() * (max - min);
export const randomInt = (min, max) => Math.floor(random(min, max + 1));
export const pick = (list) => list[Math.floor(rng() * list.length)];
export const chance = (probability) => rng() < probability;
export const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
export const lerp = (a, b, t) => a + (b - a) * t;
// Frame-rate independent smoothing: higher speed = snappier.
export const damp = (current, target, speed, dt) => THREE.MathUtils.damp(current, target, speed, dt);
export const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const wave = (speed = 1, amount = 1, offset = 0) => Math.sin(time.now * speed + offset) * amount;

export function toVector(p) {
  if (!p) return new THREE.Vector3();
  if (p.isVector3) return p;
  if (p.isObject3D) return p.position;
  if (Array.isArray(p)) return new THREE.Vector3(p[0], p[1], p[2]);
  return new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0);
}

export const distance = (a, b) => toVector(a).distanceTo(toVector(b));
export const near = (a, b, radius) => distance(a, b) < radius;

// Flat (x/z only) distance, handy for ground games.
export function distance2D(a, b) {
  const p = toVector(a);
  const q = toVector(b);
  return Math.hypot(p.x - q.x, p.z - q.z);
}

// Smoothly turn `object` around Y so its front (+Z) faces `target`.
export function turnTowards(object, target, dt, speed = 10) {
  const p = toVector(target);
  const dx = p.x - object.position.x;
  const dz = p.z - object.position.z;
  if (dx * dx + dz * dz < 1e-6) return;
  const want = Math.atan2(dx, dz);
  let diff = want - object.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  object.rotation.y += diff * Math.min(1, speed * dt);
}

// Restart the whole game cleanly (reloads the page and skips the title screen).
export function restartGame() {
  const url = new URL(location.href);
  url.searchParams.set('play', '1');
  location.href = url.toString();
}
