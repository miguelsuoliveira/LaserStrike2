# Camera views

Set the view when making the player: `createPlayer({ camera: 'third' | 'first' | 'top' | 'side' })`,
or switch any time: `cameraRig.follow(player.object, { mode: 'top' })`.
Distances and heights are on the "Camera" sliders.

## Top-down (twin-stick, dungeon crawler, tower defense)

`camera: 'top'`. WASD moves in screen directions. Sliders "Camera > topDownHeight" (zoom) and
"topDownAngle" (90 = straight down, 45 = tilted). The sky is barely visible from above, so the floor
and walls are what make it look good. Aim with the mouse on the ground:

```js
import { THREE, world, input } from '../engine/index.js';
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export function mouseOnGround() {
  ray.setFromCamera(new THREE.Vector2(input.mouse.x, input.mouse.y), world.camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(groundPlane, p) ? p : null;
}
// in update: face the mouse
player.lookAt = mouseOnGround(); // null = face the walking direction again
```
For shooting toward the mouse use `dir = mouseOnGround().sub(player.position).setY(0).normalize()`.

## Side view (2.5D platformer)

`camera: 'side'`: A/D move left/right, the player stays on the z = 0 line. Build the level along the
x axis with `box()` platforms at z = 0. Good with low `jumpHeight` + high `gravity` for snappy jumps.

## First person (shooters, horror, exploration)

`camera: 'first'` hides the player model and looks from the eyes. Add `ui.crosshair(true)`.
Click the game to lock the mouse (Esc unlocks). Shooting direction: `world.camera.getWorldDirection(dir)`.
A weapon in view: attach a model to the camera:
```js
const gun = await loadModel('assets/models/shooter/blaster.glb', { size: 0.6, add: false });
gun.position.set(0.35, -0.3, -0.7); gun.rotation.y = Math.PI;
world.camera.add(gun);
```

## Fixed camera (puzzle rooms, arenas, board games)

`camera: 'none'` on the player, then `cameraRig.follow(null)`... simplest: `cameraRig.mode = 'fixed'`
and place it: `world.camera.position.set(0, 25, 25); world.camera.lookAt(0, 0, 0);`

## Cinematic intro (fly-in)

```js
cameraRig.mode = 'fixed';
world.camera.position.set(0, 40, 60);
await tween(world.camera.position, { x: 0, y: 6, z: 12 }, 3, { ease: 'inOut' });
cameraRig.follow(player.object, { mode: 'third' });
```
(Call `world.camera.lookAt(player.position)` each frame during the tween if needed.)

## Minimap

A second small camera drawn in a corner:
```js
const mapCam = new THREE.OrthographicCamera(-40, 40, 40, -40, 1, 500);
mapCam.position.set(0, 100, 0); mapCam.lookAt(0, 0, 0);
// after the engine renders each frame (in update is fine for a minimap):
const r = world.renderer, s = 180;
mapCam.position.set(player.position.x, 100, player.position.z);
r.setScissorTest(true);
r.setScissor(r.domElement.clientWidth - s - 10, 10, s, s);
r.setViewport(r.domElement.clientWidth - s - 10, 10, s, s);
r.render(world.scene, mapCam);
r.setScissorTest(false);
r.setViewport(0, 0, r.domElement.clientWidth, r.domElement.clientHeight);
```
This draws before the main frame, so call it from `update` and accept one frame of delay, or
ask a mentor before changing the engine render order.
