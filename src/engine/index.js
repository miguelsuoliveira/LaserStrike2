// Everything the game can use. In game files:
//   import { THREE, world, physics, createPlayer, loadModel, ui, sfx, fx, tune, ... } from '../engine/index.js';
// The engine calls your game's setup() once, then update(dt) every frame
// (dt = seconds since the last frame, about 0.016).
import * as THREE from 'three';
import { world } from './world.js';
import { physics } from './physics.js';
import { input } from './input.js';
import { cameraRig } from './camera.js';
import { updateCharacters, endCharactersFrame } from './player.js';
import { updateAttachments } from './attach.js';
import { updateAnimations } from './animation.js';
import { updateFx } from './fx.js';
import { initAudio, updateAudio } from './audio.js';
import { installDebug, reportError, sendLog } from './debug.js';
import { time, updateTimers } from './utils.js';
import { state, setPaused } from './state.js';
import { tune } from './tuning.js';

export { THREE, world, physics, input, cameraRig, time, setPaused, tune };
export { createPlayer, createCharacter } from './player.js';
export { createVehicle } from './vehicle.js';
export { loadModel, loadTexture, loadMaterial, preload } from './assets.js';
export { animate } from './animation.js';
export { attach, detach, findBone } from './attach.js';
export { sound, sfx } from './audio.js';
export { ui } from './ui.js';
export { fx, tween } from './fx.js';
export { box, ball, cylinder, ground } from './shapes.js';
export { log } from './debug.js';
export {
  after, every, random, randomInt, pick, chance, clamp, lerp, damp, vec, wave,
  distance, distance2D, near, turnTowards, restartGame, seedRandom,
} from './utils.js';

let fpsEl = null;

export async function start(game) {
  installDebug();
  try {
    await physics.init();
    world.init();
    cameraRig.init();
    initAudio();
    input.init(world.renderer.domElement);
  } catch (e) {
    reportError(e, 'engine start');
    return;
  }

  let last = performance.now();
  let crashed = false;
  let frames = 0;
  let fpsTime = 0;
  const G = tune('Graphics', {});

  // Draw while setup() loads things.
  const loop = () => {
    requestAnimationFrame(loop);
    const now = performance.now();
    const realDt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const dt = realDt * time.scale;
    input.poll();

    if (!state.paused && !crashed && ready) {
      time.now += dt;
      try {
        updateTimers();
        game.update?.(dt);
      } catch (e) {
        crashed = true;
        reportError(e, 'update() in your game');
      }
      updateCharacters(dt);
      physics.step(dt); // characters and cars move inside the fixed physics steps
      endCharactersFrame();
      updateAnimations(dt);
      updateAttachments();
    }
    cameraRig.update(realDt);
    updateFx(realDt);
    updateAudio();
    world.render();
    input.endFrame();

    frames++;
    fpsTime += realDt;
    if (fpsTime > 0.5) {
      if (G.showFPS) {
        fpsEl ||= Object.assign(document.body.appendChild(document.createElement('div')), { className: 'fps' });
        fpsEl.textContent = `${Math.round(frames / fpsTime)} FPS`;
        fpsEl.style.display = 'block';
      } else if (fpsEl) fpsEl.style.display = 'none';
      window.__fps = Math.round(frames / fpsTime);
      frames = 0;
      fpsTime = 0;
    }
  };
  let ready = false;
  loop();

  try {
    await game.setup?.();
    ready = true;
    window.__gameReady = true;
    document.getElementById('loading')?.remove();
    sendLog('info', 'setup() finished, game running');
  } catch (e) {
    document.getElementById('loading')?.remove();
    reportError(e, 'setup() in your game');
  }
}

// Exposed for the browser console and the screenshot tool.
window.game = { world, physics, input, cameraRig, time, setPaused, THREE, module: gameModule };

// The running game's own copy of a file in src/game/: `await game.module('birds')`.
// (After an edit the dev server loads it as birds.js?t=..., so a plain import() would load a second, empty copy.)
function gameModule(name) {
  const file = `/src/game/${name.replace(/\.js$/, '')}.js`;
  const loaded = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).pathname === file);
  return import(/* @vite-ignore */ loaded.at(-1) || file);
}
