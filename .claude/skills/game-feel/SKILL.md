---
name: game-feel
description: Make the game feel juicy, satisfying and alive - screen shake, particles, flashes, hit-stop, sounds, squash and stretch, camera tricks, glowing things, weather, time of day, music. Use when the kids say the game feels boring, flat, floaty or "not fun yet", when polishing, or when they ask for effects (explosions, fire, rain, night, glow).
---

# Game feel ("juice")

Juice = small reactions that make every action feel good. Add 2-3 at a time, then let the kids play
and pick what they like. Every effect is a one-liner from the engine:

| When | Add |
|---|---|
| collect something | `sfx('coin'); fx.burst(pos, { color: '#ffd23f' }); fx.popup(pos, '+10')` |
| hit an enemy | `sfx('hit'); fx.burst(pos, { color: '#fff', count: 10 }); fx.slowmo(0.05, 0.06)` (hit-stop) |
| player gets hurt | `sfx('hurt'); fx.flash('#ff0000', 0.25); fx.shake(0.3, 0.25)` |
| explosion | `sfx('explode'); fx.burst(pos, { color: '#ff8800', count: 60, speed: 10, size: 0.35 }); fx.shake(0.8, 0.5)` |
| jump / land | `sfx('jump')`; on landing squash the model (below) and a small dust `fx.burst(feet, { color: '#c8b48c', count: 8, speed: 2, glow: false })` |
| level up / power-up | `sfx('powerup'); ui.message('LEVEL UP!'); fx.burst(pos, { color: '#7cf', count: 40 })` |
| win | `sfx('win'); player.action('Cheer')`, confetti: several `fx.burst` with different colors |

## Movement feel (sliders, no code!)

Open the sliders (`` ` ``) and tune "Player": higher `gravity` + higher `jumpHeight` = snappy jumps;
higher `acceleration` = responsive; lower `airControl` = committed jumps. "Camera" `fieldOfView` 75-90
feels faster. These changes are game design: have the kids try values and pick.

## Squash and stretch on landing

```js
let wasGrounded = true;
// in update:
if (player.grounded && !wasGrounded) {
  player.model.scale.multiply(vec(1.25, 0.75, 1.25));
  const base = player.model.scale.clone().divide(vec(1.25, 0.75, 1.25));
  tween(player.model.scale, { x: base.x, y: base.y, z: base.z }, 0.25, { ease: 'elastic' });
}
wasGrounded = player.grounded;
```

## Glow

Anything bright glows thanks to bloom: `box({ glow: '#00ffff' })`, or on a model's material:
`o.material.emissive.set('#ff00ff'); o.material.emissiveIntensity = 6`. Slider "Graphics > glow" sets strength.
Point lights for torches/lamps (max ~8 in a scene):
`const l = new THREE.PointLight('#ffaa55', 20, 12); l.position.set(x, 2, z); world.add(l);`
Flicker: `l.intensity = 18 + wave(20, 3) + random(-2, 2)`.

## Atmosphere

- Time of day: edit `src/tuning.json` → `"Sky": { "timeOfDay": 17.5 }` (sunset; 18 is already dusk) or `21` (night). Live.
  `sunDirection` turns the sun around (try values until the sunset is in front of the camera).
- Photo sky: `await world.setSky('assets/hdri/sunset.hdr')` (day, sunset, night, cloudy). The default sky
  with timeOfDay usually looks better for sunsets; photo skies can look hazy.
- Fog: `"Sky": { "fogDistance": 60 }` for spooky, `600` for clear.
- Night + torches + fog = instant spooky level.

## Weather (rain / snow) with one Points cloud

```js
const N = 3000;
const geo = new THREE.BufferGeometry();
const pos = new Float32Array(N * 3);
for (let i = 0; i < N * 3; i++) pos[i] = random(-40, 40);
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#aaccff', size: 0.08, transparent: true, opacity: 0.7 }));
world.add(rain);
// in update:
const a = geo.attributes.position.array;
for (let i = 1; i < a.length; i += 3) { a[i] -= 25 * dt; if (a[i] < 0) a[i] += 40; }
geo.attributes.position.needsUpdate = true;
rain.position.set(player.position.x, 0, player.position.z);
```
Snow: speed 3, size 0.15, white, and add `a[i - 1] += wave(1, 0.01)` for drift.

## Fire and smoke

Fire: `every(0.05, () => fx.burst(firePos, { color: '#ff7a1a', count: 3, speed: 1.5, size: 0.4, life: 0.6, gravity: -3 }))`
(negative gravity = rises). Smoke: same with `color: '#555555', glow: false, gravity: -1, life: 2`.

## Water

A flat, shiny box: `box({ size: [200, 1, 200], position: [0, -0.4, 0], color: '#1d6fa5', roughness: 0.05, metalness: 0.2, opacity: 0.85, physics: false })`
plus `water.position.y = -0.4 + wave(0.8, 0.05)` for gentle movement.

## Music

`sound.music('assets/music/<file>.mp3', { volume: 0.4 })` after the title screen. Different music for
the boss fight: call `sound.music` with another file (it fades). `public/assets/music/` starts empty: get
CC0 loops (see `free-assets`), or the kids record or make their own (phone voice memo, a free music app),
or use `assets/sounds/kenney/engine.mp3` style loops with `sound.play(path, { loop: true })`.

## Camera

- Shake on big moments only (overuse makes people dizzy).
- Zoom on a moment: `tween(world.camera, { fov: 45 }, 0.3)` then back to 60; call
  `world.camera.updateProjectionMatrix()` each frame while it changes, or change the "Camera >
  fieldOfView" value instead.
