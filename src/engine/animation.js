// Playing a model's built-in animations (Idle, Walk, Run, Attack...).
//   const anim = animate(model)        model from loadModel()
//   anim.play('Idle')                  loops, fades from the last one
//   anim.play('run', { speed: 1.5 })   names are matched loosely ('run' finds 'Running_A')
//   await anim.once('Attack')          plays once, then goes back to what was looping
//   anim.names                         list of animation names in the file
//   anim.stop()
// For models without animations, animate them in code: see the
// character-animation skill (bobbing, squash and stretch, spinning, leaning).
import * as THREE from 'three';
import { sendLog } from './debug.js';

const animators = new Set();
const warned = new Set();

export function animate(model) {
  if (model.userData.animator) return model.userData.animator;
  const a = new Animator(model);
  model.userData.animator = a;
  animators.add(a);
  return a;
}

export function updateAnimations(dt) {
  for (const a of animators) {
    if (!a.root.parent && !a.root.isScene) continue; // removed from the world
    a.mixer.update(dt);
  }
}

export function forgetAnimator(model) {
  const a = model.userData.animator;
  if (a) animators.delete(a);
}

class Animator {
  constructor(model) {
    this.root = model;
    this.mixer = new THREE.AnimationMixer(model.userData.model || model);
    this.clips = model.animations || [];
    this.current = null;
    this.currentName = '';
    this.looping = null;
    this.speed = 1;
  }

  get names() {
    return this.clips.map((c) => c.name);
  }

  find(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    const clip =
      this.clips.find((c) => c.name === name) ||
      this.clips.find((c) => c.name.toLowerCase() === lower) ||
      this.clips.find((c) => c.name.toLowerCase().startsWith(lower)) ||
      this.clips.find((c) => c.name.toLowerCase().includes(lower));
    if (!clip && !warned.has(name)) {
      warned.add(name);
      const msg = `Animation "${name}" not found on ${this.root.name}. Available: ${this.names.join(', ') || 'none'}`;
      console.warn(msg);
      sendLog('warn', msg);
    }
    return clip || null;
  }

  has(name) {
    const lower = name.toLowerCase();
    return this.clips.some((c) => c.name.toLowerCase().includes(lower));
  }

  play(name, { fade = 0.2, speed = 1, loop = true, restart = false } = {}) {
    const clip = this.find(name);
    if (!clip) return null;
    const action = this.mixer.clipAction(clip);
    action.timeScale = speed;
    if (this.current === action && !restart) return action;
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.enabled = true;
    action.setEffectiveWeight(1);
    if (this.current && this.current !== action) action.crossFadeFrom(this.current, fade, false);
    action.play();
    this.current = action;
    this.currentName = clip.name;
    if (loop) this.looping = { name: clip.name, speed };
    return action;
  }

  // Plays once, then returns to the looping animation. Resolves when finished.
  once(name, { fade = 0.15, speed = 1, then } = {}) {
    const back = then ?? this.looping?.name;
    const action = this.play(name, { fade, speed, loop: false, restart: true });
    if (!action) return Promise.resolve();
    this.busy = true;
    return new Promise((resolve) => {
      const done = (e) => {
        if (e.action !== action) return;
        this.mixer.removeEventListener('finished', done);
        this.busy = false;
        if (back && this.current === action) this.play(back, { fade });
        resolve();
      };
      this.mixer.addEventListener('finished', done);
    });
  }

  stop() {
    this.mixer.stopAllAction();
    this.current = null;
    this.currentName = '';
  }
}
