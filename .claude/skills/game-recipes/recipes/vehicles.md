# Vehicles: cars, karts, racing, boats, planes, spaceships

## Cars (built into the engine)

```js
import { createVehicle, loadModel, cylinder, tune, input, cameraRig, near, vec, damp, sfx, ui } from '../engine/index.js';
const car = await createVehicle({ model: 'assets/models/racing/vehicle_truck_red.glb', size: 3, position: [0, 0, 0], rotation: 0 });
```
W/S gas and brake/reverse, A/D steer, Space handbrake (drift). Camera follows ('chase').
Sliders "Car": maxSpeed, acceleration, brakes, turnSpeed, grip (low = drifty, 10-20 = sticks), gravity.
`car.speed`, `car.position`, `car.heading` (radians), `car.grounded`, `car.boost(2, seconds)`, `car.boosting`,
`car.frozen = true` (countdowns), `car.teleport([x, y, z], degrees)`, `car.maxSpeed = 18` (this car only),
`controls: false` + `car.steer` / `car.throttle` (-1..1) for computer cars.
Cars drive up ramps and fly off the top (a tilted `box()`, about 15°).
Use a car instead of `createPlayer` (no walking player), or both: hide the player and freeze it while driving.

## Ready-made race track and computer cars (copy, don't rewrite)

```bash
cp .claude/skills/game-recipes/code/race-track.js src/game/track.js
cp .claude/skills/game-recipes/code/rivals.js src/game/rivals.js
```
```js
import { buildTrack, startPosition, gates, trackPath, TRACK } from './track.js';
import { setupRivals, updateRivals, rivals } from './rivals.js';
// setup():
await ground({ texture: 'assets/textures/sand', size: 600 });
await buildTrack();                  // oval road, red/white walls, a jump ramp (sliders "Track", need a restart)
await setupRivals();                 // two computer trucks in their own lanes (sliders "Rivals")
const car = await createVehicle({ model: 'assets/models/racing/vehicle_truck_red.glb', size: 3, position: startPosition(0) });
// update(dt):
updateRivals(dt);
```
`gates(4)` gives 4 checkpoint points around the loop for the lap code below.

## Race track from Kenney pieces (10 m tiles)

```js
const T = 10; // tile size
const track = [
  // [piece, column, row, rotation°]
  ['track_straight', 0, 0, 0], ['track_straight', 0, 1, 0], ['track_corner', 0, 2, 0],
];
for (const [name, c, r, rot] of track) {
  loadModel(`assets/models/racing/${name}.glb`, { position: [c * T, 0, r * T], rotation: rot, physics: 'fixed', shape: 'mesh' });
}
```
Rotate pieces in steps of 90 and check with `npm run snap` (corner direction depends on rotation).
Easier: a big flat ground (`assets/textures/asphalt`) with walls made of `box()` and ramps.

## Laps and checkpoints

```js
const gateList = gates(4); // from track.js, or your own points; the last one is the finish line
let next = 0, lap = 1, raceTime = 0, finished = false;
const LAPS = 3;
// in update:
if (!finished) raceTime += dt;
// the gate radius must be at least half the road width, or a car on the edge misses it
if (!finished && near(car.position, gateList[next], TRACK.width / 2 + 2)) {
  next++;
  if (next === gateList.length) {
    next = 0; lap++; sfx('powerup');
    if (lap > LAPS) { finished = true; car.frozen = true; endRace(raceTime); }
    else ui.message(`Lap ${lap}!`);
  }
}
ui.text('lap', `Lap ${Math.min(lap, LAPS)}/${LAPS}`);
ui.text('time', raceTime.toFixed(1), { at: 'top-right' });
```
Countdown: freeze every car, then `ui.message('3')` ... with `after(1, ...)`, and unfreeze on GO.
A full 3-lap race takes ~90 s, too long to test with snap: test one lap with
`--set "Track.straightLength=40"` or `--before "game.car.teleport(...)"` near the finish.
Show gates with glowing posts: `cylinder({ radius: 0.3, height: 4, position: [x, 2, z], glow: '#00e5ff', physics: false })`.

## AI opponents

Use `code/rivals.js` above. How it works (for your own tracks): each computer car aims at a point
a few steps ahead on a list of road points (not far-apart gates, or it cuts corners into walls),
shifted sideways into its own lane, sets `car.maxSpeed` to be slower or faster than you (throttle only
changes how fast it speeds up), and teleports back onto the road if stuck for 2 seconds.

## Boost pads

```js
const pads = [vec(0, 0, 30)].map((p) => box({ size: [5, 0.1, 3], position: [p.x, 0.05, p.z], color: '#33001f', glow: '#ff2d95', glowStrength: 0.6, physics: false }));
// in update (for your car and each rival car):
for (const pad of pads) if (near(car.position, pad.position, 2.5) && !car.boosting) { car.boost(1.8, 2); sfx('whoosh'); }
```

## Getting in and out (walk + drive)

```js
let driving = false;
// in update:
if (input.pressed('e')) {
  if (!driving && near(player.position, car.position, 3)) {
    driving = true; player.frozen = true; player.object.visible = false; car.frozen = false; cameraRig.follow(car.object, { mode: 'chase' });
  } else if (driving) {
    driving = false; car.frozen = true; player.teleport(car.position.clone().add(vec(2, 0.5, 0)));
    player.object.visible = true; player.frozen = false; cameraRig.follow(player.object, { mode: 'third' });
  }
}
```
Start the car with `car.frozen = true` and `camera: 'none'`.

## Planes, spaceships, dragons, birds (flying)

No collisions needed in the sky. Move the model yourself:

```js
const F = tune('Flying', { speed: 20, turnSpeed: 1.5, climbSpeed: 1.2 });
const ship = await loadModel('assets/models/space/spacetruck.glb', { size: 4, position: [0, 20, 0] });
cameraRig.follow(ship, { mode: 'chase' });
let yaw = 0, pitch = 0;
// in update:
yaw -= input.move.x * F.turnSpeed * dt;
pitch = damp(pitch, input.move.y * 0.6, 3, dt);           // W = nose down, S = nose up (flip if kids prefer)
const dir = vec(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
ship.position.addScaledVector(dir, F.speed * dt);
ship.position.y = Math.max(1, ship.position.y);           // don't go underground
ship.rotation.set(pitch, yaw, -input.move.x * 0.5, 'YXZ'); // bank into turns
```
Rings to fly through: glowing `cylinder({ radius: 4, radiusTop: 4, height: 0.3, rotation: [90, 0, 0], glow: '#ffd23f', physics: false })`
and `near(ship, ring, 4)`.

## Boats

A car on water: a big flat blue floor `box({ size: [400, 1, 400], position: [0, -0.5, 0], color: '#1e6fb8', roughness: 0.1, metalness: 0.3 })`,
`createVehicle` with a boat-like model, low `grip` (2-3) so it slides, and rock the model gently in
update: `car.object.userData.model.rotation.z = wave(1.5, 0.05)`.
