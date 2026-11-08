// Effects that make a game feel juicy.
//   fx.burst(position, { color: '#ffd700', count: 25, speed: 5, size: 0.2, life: 0.8 })  sparks/confetti
//   fx.shake(0.4, 0.3)               shake the camera (strength, seconds)
//   fx.flash('#ff0000', 0.2)         color the whole screen for a moment (got hurt)
//   fx.popup(position, '+10', { color: '#ffdd00' })   text that floats up and fades
//   fx.slowmo(0.2, 0.15)             slow motion (speed, seconds); 0 = freeze (hit-stop)
//   await tween(mesh.position, { y: 3 }, 0.5)        move any number smoothly over time
//   tween(mesh.scale, { x: 2, y: 2, z: 2 }, 0.3, { ease: 'bounce' })   ease: 'linear' | 'in' | 'out' | 'inOut' | 'bounce' | 'elastic'
import * as THREE from 'three';
import { world } from './world.js';
import { cameraRig } from './camera.js';
import { time } from './utils.js';

const bursts = [];
const popups = [];
const tweens = [];
let shakeTime = 0;
let shakeStrength = 0;
let slowUntil = 0;
let dotTexture = null;

function dot() {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dotTexture = new THREE.CanvasTexture(c);
  return dotTexture;
}

const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  bounce: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

export function tween(target, to, seconds = 0.5, { ease = 'out', delay = 0 } = {}) {
  return new Promise((resolve) => {
    tweens.push({ target, to, from: null, seconds, ease: EASE[ease] || EASE.out, t: -delay, resolve });
  });
}

export const fx = {
  burst(position, { color = '#ffd700', count = 25, speed = 5, size = 0.2, life = 0.8, gravity = 9, glow = true } = {}) {
    const p = position.isVector3 ? position : position.position || new THREE.Vector3(...position);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos.set([p.x, p.y, p.z], i * 3);
      const v = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      v.y = Math.abs(v.y) * 0.8 + speed * 0.3;
      vel.push(v);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(color).multiplyScalar(glow ? 6 : 1), // bright colors glow (bloom)
      size,
      map: dot(),
      transparent: true,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    world.add(points);
    bursts.push({ points, vel, age: 0, life, gravity });
  },

  shake(strength = 0.3, seconds = 0.3) {
    shakeStrength = Math.max(shakeStrength, strength);
    shakeTime = Math.max(shakeTime, seconds);
  },

  flash(color = '#ffffff', seconds = 0.15) {
    const el = document.createElement('div');
    el.className = 'flash';
    el.style.background = color;
    el.style.transitionDuration = `${seconds}s`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => (el.style.opacity = '0')));
    setTimeout(() => el.remove(), seconds * 1000 + 100);
  },

  popup(position, text, { color = '#ffffff', size = 28, seconds = 1 } = {}) {
    const p = (position.isVector3 ? position : position.position).clone();
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.color = color;
    el.style.fontSize = `${size}px`;
    document.body.appendChild(el);
    popups.push({ el, p, age: 0, life: seconds });
  },

  slowmo(scale = 0.2, seconds = 0.15) {
    time.scale = scale;
    slowUntil = performance.now() + seconds * 1000;
  },
};

// Called by the engine every frame (real seconds, not slowed down).
export function updateFx(dt) {
  if (slowUntil && performance.now() > slowUntil) {
    time.scale = 1;
    slowUntil = 0;
  }
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    const pos = b.points.geometry.attributes.position;
    for (let k = 0; k < b.vel.length; k++) {
      b.vel[k].y -= b.gravity * dt;
      pos.array[k * 3] += b.vel[k].x * dt;
      pos.array[k * 3 + 1] += b.vel[k].y * dt;
      pos.array[k * 3 + 2] += b.vel[k].z * dt;
    }
    pos.needsUpdate = true;
    b.points.material.opacity = Math.max(0, 1 - b.age / b.life);
    if (b.age >= b.life) {
      b.points.removeFromParent();
      b.points.geometry.dispose();
      b.points.material.dispose();
      bursts.splice(i, 1);
    }
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dt;
    p.p.y += dt * 1.2;
    const s = p.p.clone().project(world.camera);
    p.el.style.left = `${(s.x * 0.5 + 0.5) * window.innerWidth}px`;
    p.el.style.top = `${(-s.y * 0.5 + 0.5) * window.innerHeight}px`;
    p.el.style.opacity = String(Math.max(0, 1 - p.age / p.life));
    p.el.style.display = s.z > 1 ? 'none' : 'block';
    if (p.age >= p.life) {
      p.el.remove();
      popups.splice(i, 1);
    }
  }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    if (!tw.from) tw.from = Object.fromEntries(Object.keys(tw.to).map((k) => [k, tw.target[k]]));
    const k = Math.min(1, tw.t / tw.seconds);
    const e = tw.ease(k);
    for (const key of Object.keys(tw.to)) tw.target[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e;
    if (k >= 1) {
      tweens.splice(i, 1);
      tw.resolve();
    }
  }
  if (shakeTime > 0) {
    shakeTime -= dt;
    cameraRig.applyShake(shakeStrength * Math.max(0, shakeTime) * 3);
    if (shakeTime <= 0) shakeStrength = 0;
  }
}
