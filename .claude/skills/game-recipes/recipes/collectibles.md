# Collectibles and power-ups

```js
// src/game/pickups.js
import { loadModel, tune, near, wave, random, sfx, fx, world, ui } from '../engine/index.js';

const C = tune('Pickups', {
  count: { value: 15, min: 1, max: 100, step: 1 },
  spinSpeed: { value: 3, min: 0, max: 20 },
  pickupDistance: { value: 1.5, min: 0.3, max: 5 },
  magnetDistance: { value: 0, min: 0, max: 10 }, // > 0: coins fly to the player
});

export const pickups = [];
export let collected = 0;

export async function spawnPickups(area = 30) {
  for (let i = 0; i < C.count; i++) {
    const p = await loadModel('assets/models/platformer/coin.glb', {
      size: 0.8,
      position: [random(-area, area), 1, random(-area, area)],
    });
    p.userData.baseY = 1;
    pickups.push(p);
  }
}

export function updatePickups(dt, player) {
  const target = player.position.clone();
  target.y += 1; // aim at the player's middle, not the feet
  for (const p of [...pickups]) {
    p.rotation.y += C.spinSpeed * dt;
    p.position.y = p.userData.baseY + wave(3, 0.15, p.id);
    if (C.magnetDistance > 0 && near(p, target, C.magnetDistance)) p.position.lerp(target, 8 * dt);
    if (near(p, target, C.pickupDistance)) {
      collected++;
      sfx('coin');
      fx.burst(p.position, { color: '#ffd23f' });
      fx.popup(p.position, '+1', { color: '#ffd23f' });
      world.remove(p);
      pickups.splice(pickups.indexOf(p), 1);
      ui.text('coins', `Coins: ${collected}`);
    }
  }
}
```

In `game.js`: `await spawnPickups()` in `setup()`, `updatePickups(dt, player)` in `update(dt)`.
`collected` is a live export, so `game.js` can read it after importing it.

## Things to collect without a model

`ball({ radius: 0.3, color: '#00e5ff', glow: '#00e5ff', physics: false, position: [x, 1, z] })`
makes a glowing gem. `box({ size: 0.5, rotation: [45, 0, 45], glow: '#ff3df5', physics: false })` makes a crystal.

## Power-ups (temporary boost)

Keep one "boost ends at" time per power-up, so picking up a second one adds time instead of
stacking (stacking would leave the player fast forever).

```js
import { time, sfx, ui } from '../engine/index.js';

let speedUntil = 0;
let normal = null;
export function speedBoost(player, seconds = 5) {
  const P = player.settings; // the "Player" sliders
  if (!normal) normal = { walk: P.walkSpeed, run: P.runSpeed };
  P.walkSpeed = normal.walk * 2;
  P.runSpeed = normal.run * 2;
  speedUntil = time.now + seconds;
  sfx('powerup');
  ui.message('SPEED!', { seconds: 1 });
}
// in update:
export function updatePowerups(player) {
  if (normal && time.now > speedUntil) {
    player.settings.walkSpeed = normal.walk;
    player.settings.runSpeed = normal.run;
    normal = null;
  }
  if (normal) ui.text('boost', `Speed ${Math.ceil(speedUntil - time.now)}`, { at: 'top-right' });
  else ui.remove('boost');
}
```

Other quick power-ups: bigger jump (`P.jumpHeight`), low gravity (`P.gravity`), shield (a boolean
`player.shield = true` checked before taking damage), giant mode (`tween(player.object.scale, { x: 2, y: 2, z: 2 }, 0.3)`).
Changing `player.settings` values moves the sliders too, but it isn't saved (only people moving sliders is).

## Inventory (keys, items)

Keep a simple object: `export const inventory = { keys: 0, potions: 0 }` and show it with
`ui.text('inventory', \`Keys: ${inventory.keys}\`, { at: 'top-right' })`.
