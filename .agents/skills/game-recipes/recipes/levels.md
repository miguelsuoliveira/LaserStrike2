# Levels: platforms, traps, moving things, checkpoints, doors

Build levels from `box()` shapes (fast, exact) and decorate with catalog models. Ground top is y = 0.
A box at height `h` sits on the ground when `position[1] = h / 2`.

```js
// src/game/level.js
import { box, cylinder, loadModel, ground, tune, near, time, after, physics, vec, random, tween, sfx, ui, world } from '../engine/index.js';

export async function buildLevel() {
  await ground({ texture: 'assets/textures/grass', size: 200 });
  // Floating platforms in a line, each a bit higher.
  for (let i = 0; i < 8; i++) {
    box({ size: [3, 0.5, 3], position: [0, 1 + i * 1.2, -5 - i * 4], texture: 'assets/textures/wood_planks' });
  }
  // A ramp: tilt a box with rotation [x°, y°, z°].
  box({ size: [4, 0.4, 10], position: [8, 1.6, 0], rotation: [-18, 0, 0], texture: 'assets/textures/concrete' });
  // Wall with a texture.
  box({ size: [20, 4, 1], position: [0, 2, 15], texture: 'assets/textures/brick' });
}
```

Grid levels from text (great for mazes and dungeon rooms; kids can draw the map):

```js
const MAP = [
  '##########',
  '#....#...#',
  '#.##.#.#.#',
  '#.#..C.#E#',
  '##########',
];
const SIZE = 4; // meters per cell
MAP.forEach((row, z) => [...row].forEach((ch, x) => {
  const pos = [x * SIZE, 0, z * SIZE];
  if (ch === '#') box({ size: [SIZE, 4, SIZE], position: [pos[0], 2, pos[2]], texture: 'assets/textures/rock' });
  if (ch === 'C') loadModel('assets/models/platformer/coin.glb', { size: 0.8, position: [pos[0], 1, pos[2]] });
  if (ch === 'E') { /* spawnEnemy(pos) */ }
}));
```

## Kill zones (lava, water, spikes)

Big glowing areas wash out the screen: use a dark color plus a weak glow.

```js
const lava = box({ size: [30, 0.2, 30], position: [0, 0.1, -40], color: '#3a0800', glow: '#ff4400', glowStrength: 0.35, physics: false });
// in update:
const p = player.position;
if (Math.abs(p.x - lava.position.x) < 15 && Math.abs(p.z - lava.position.z) < 15 && p.y < 0.5) {
  hurtPlayer(100); // or: player.teleport(checkpoint)
}
```
Rising lava: `lava.position.y += 0.3 * dt` and compare `p.y < lava.position.y`. When the player
respawns at a checkpoint, move the lava back below it (`lava.position.y = checkpoint.y - 3`), or they
respawn into lava forever.

## Moving platforms (they carry the player)

Use `physics: 'kinematic'` and move the box in `update`; the engine moves its physics body to match,
and players/characters standing on it ride along (sideways, up/down and turning).

```js
const M = tune('Platforms', { moveSpeed: 1, moveDistance: 6 });
const mover = box({ size: [3, 0.5, 3], position: [0, 3, -20], color: '#7c5cff', physics: 'kinematic' });
// in update:
mover.position.x = Math.sin(time.now * M.moveSpeed) * M.moveDistance;
```
Spinning: `spinner.rotation.y += 1.5 * dt` (with `physics: 'kinematic'`). Elevators: change `position.y`.
Jumping off a moving platform doesn't keep the platform's speed.

## Falling platforms

```js
// touching it starts a timer, then it falls
if (near(player.position, plat.position, 2) && !plat.userData.falling) {
  plat.userData.falling = true;
  after(0.6, () => physics.add(plat, { type: 'dynamic', mass: 5 }));
}
```

## Jump pads and speed pads

`player.jump(3)` jumps 3 × the normal jump height (so it changes when kids tune jumpHeight).

```js
const pad = box({ size: [2, 0.2, 2], position: [5, 0.1, 5], color: '#00ff99', glow: '#00ff99', physics: false });
let padReady = 0;
// in update:
if (near(player.position, pad.position, 1.3) && player.grounded && time.now > padReady) {
  player.jump(3);
  sfx('bounce');
  padReady = time.now + 0.5; // otherwise it bounces again on every landing, like a trampoline
}
```

## Checkpoints

```js
const flags = [vec(0, 0, -30), vec(0, 8, -60)];
// in update:
for (const f of flags) if (near(player.position, f, 2) && !player.spawn.equals(f)) {
  player.spawn.copy(f);  // respawn here after falling
  ui.message('Checkpoint!');
  sfx('powerup');
}
```
Show them with `loadModel('assets/models/platformer/flag.glb', { height: 2, position: f })`.

## Doors, keys and buttons

```js
let hasKey = false;
const key = await loadModel('assets/models/dungeon/key.glb', { size: 0.8, position: [10, 1, 0] });
const door = box({ size: [3, 4, 0.5], position: [0, 2, 20], texture: 'assets/textures/wood_planks' });
// in update:
if (key.visible && near(player.position, key, 1.5)) { key.visible = false; hasKey = true; sfx('magic'); ui.message('Got the key!'); }
if (hasKey && door.parent && near(player.position, door, 3)) {
  world.remove(door); // removes its physics too
  sfx('powerup');
}
```
A door that slides open instead: give it `physics: 'kinematic'` and `tween(door.position, { y: -2 }, 1)`.

## Finish line / goal

```js
const goal = cylinder({ radius: 1.5, height: 0.2, position: [0, 0.1, -80], color: '#ffd23f', glow: '#ffd23f', physics: false });
if (near(player.position, goal.position, 1.6)) endGame(true);
```

## Same layout every time

Random placement changes on every reload. Put `seedRandom(7)` at the start of `setup()` and
`random()` gives the same layout every time (change the number for a different one).

## Decorating fast

Scatter trees/rocks around the edge (not on the play area):
```js
for (let i = 0; i < 30; i++) {
  const a = random(0, Math.PI * 2), d = random(40, 90);
  loadModel('assets/models/nature/tree_single_a.glb', { height: random(5, 9), position: [Math.cos(a) * d, 0, Math.sin(a) * d], rotation: random(0, 360), physics: 'fixed' });
}
```
Walls/arches with openings need `shape: 'mesh'` so you can walk through the gap.
