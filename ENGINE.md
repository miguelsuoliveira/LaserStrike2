# Engine reference (read this before writing game code)

Import what you need in game files:
`import { THREE, world, physics, createPlayer, loadModel, ui, sfx, fx, tune, ... } from '../engine/index.js';`

`src/game/game.js` exports `async setup()` (runs once; `await` loading there) and `update(dt)`
(every frame; `dt` = seconds since last frame). `src/main.js` starts it. Units are meters and seconds.
Y is up. The ground top is y = 0. It starts as an empty floor with a grid: replace the floor when you build the World.

**Sliders**
- `const S = tune('Enemy', { speed: 3, damage: { value: 10, min: 0, max: 50 }, color: '#ff0000', boss: false, mode: { value: 'easy', options: ['easy', 'hard'] } })`
  Call once at the top of a file, read `S.speed` every frame. Press `` ` `` in the game to show sliders.
- `src/tuning.json` looks like `{ "Sky": { "timeOfDay": 21 }, "Player": { "jumpHeight": 3 } }` (only moved sliders).
- Built-in sliders (defaults): **Player** walkSpeed 4, runSpeed 8, jumpHeight 1.6, gravity 25,
  fallGravity 1.5 (higher = less floaty), shortHop 0.5 (tap = small jump), acceleration 14, airControl 0.5,
  turnSpeed 12, stepHeight 0.4, fallLimit -40 · **Physics** gravity 20 (falling objects only, not the player) ·
  **Camera** distance 6, height 1.5, fieldOfView 60, mouseSensitivity 1, topDownHeight 18, topDownAngle 65 ·
  **Sky** timeOfDay 14 (5-21; 18 sunset, 21 night), sunDirection, clouds 0.4, fogDistance 250, sunBrightness 3, skyLight 0.6 ·
  **Graphics** quality high, glow 0.3, brightness 1, showFPS · **Sound** master, music, effects ·
  **Car** maxSpeed 22, acceleration 14, turnSpeed 2.2, grip 6 (lower = drifty).

**World** (`world`)
- `world.scene`, `world.camera`, `world.renderer`, `world.sun` (DirectionalLight)
- `world.add(obj)`, `world.remove(obj)` (also removes its physics body)
- `await world.setSky('assets/hdri/sunset.hdr')` photo sky, `world.setSky('space')` stars, or the default
  animated sky with "Sky" sliders (timeOfDay 5-21, clouds, fogDistance). Night: `"Sky": { "timeOfDay": 21 }` in tuning.json.
- Sliders "Graphics": quality low/medium/high, glow (bloom), brightness, showFPS.

**Shapes** (already added to the world; solid by default)
- `box({ size: [w, h, d], position: [x, y, z], color, texture, rotation: [x°, y°, z°], physics, mass, glow, glowStrength, opacity })`
- `ball({ radius, position, color, physics: 'dynamic', bounciness })`
- `cylinder({ radius, height, position, ... })`
- `await ground({ texture: 'assets/textures/grass', size: 200, color })` (top at y = 0)
- `physics`: `'fixed'` (default for box/cylinder) | `'dynamic'` (falls, default for ball) | `'kinematic'` (you move it) | `false`
- `texture`: a folder from the catalog's Textures list; `glow: '#00ffff'` makes it shine (big glowing areas like
  lava: dark `color` + `glowStrength: 0.3`, or the screen washes out).

**Models**
- `const m = await loadModel('assets/models/...glb', { height | size, scale, position, rotation (degrees Y), turn, hide: ['Part'], physics, shape, add, center })`
  Returns a THREE.Group with feet at its position (`center: false` keeps the file's origin). Copies are cheap.
  `m.userData.model` is the loaded scene inside. Parts, bones and sizes: `npm run inspect -- public/assets/...glb`
  (it prints names the way three.js sees them: dots are removed, `handslot.r` → `handslotr`).
- `const anim = animate(m)`: `anim.play('Run', { speed })` (loose name match), `await anim.once('Attack', { speed })`, `anim.names`, `anim.busy`
- `attach(character, item, { to: 'right hand' | 'left hand' | 'head' | 'back' | boneName, position, rotation, upright })`
  puts a model in a hand (keeps its size; `upright: true` for torches and flags). `detach(item)`.
- `loadMaterial('assets/textures/rock', { repeat })`, `loadTexture('assets/images/x.png')`, `preload([...paths])`

**Player** (walk, run with Shift, jump with Space, mouse look; camera follows)
- `const player = await createPlayer({ model, height: 1.8, position: [0, 1, 0], rotation: 0, camera: 'third' | 'first' | 'top' | 'side' | 'none', hide: [], animations: { idle, walk, run, jump, fall } })`
  `model` can also be your own THREE object (a blob made of spheres): feet at y = 0, front +Z.
- `player.position` (feet), `player.object` (moves/turns), `player.model` (the visible model inside: hide/recolor/scale it),
  `player.grounded`, `player.velocity` (you may change it: knockback, dash), `player.frozen = true`,
  `player.teleport([x, y, z])`, `player.jump(2)` (always jumps, 2 × jumpHeight: jump pads), `await player.action('Attack', { speed })`,
  `player.animator`, `player.settings` (the Player slider values; changing them changes the sliders), `player.onFall = () => {}`,
  `player.faceCamera = true` (for aiming), `player.lookAt = vec3 | null`, `player.spawn` (respawn point, a Vector3).
  Standing on `physics: 'kinematic'` platforms carries the player.
- Enemies/NPCs with the same physics: `const e = await createCharacter({ model, position, speed })`, then every frame
  `e.walkTo(target)` or `e.move(x, z)`; `e.tryJump()`, `e.remove()`, plus everything the player has
  (`e.settings` is shared by all NPCs: gravity, jumpHeight, acceleration...).
- Cars: `const car = await createVehicle({ model, size: 3, position, rotation, camera, controls })` (W/S/A/D, Space drift,
  chase camera; drives up ramps and jumps off them). `car.speed`, `car.boost(2)`, `car.maxSpeed`, `car.frozen`,
  `controls: false` + `car.steer`/`car.throttle` for computer cars. Ready-made race track and rival cars:
  `game-recipes` skill, `vehicles.md`. Boats, planes, spaceships and rolling balls: `vehicles.md` too.

**Camera** (`cameraRig`)
- `cameraRig.follow(obj, { mode: 'third' | 'chase' | 'first' | 'top' | 'side' | 'fixed' })` ('chase' = behind a car/plane)
- `cameraRig.forward()` flat look direction, `cameraRig.right()`, `cameraRig.yaw`, `cameraRig.pitch` (negative = up),
  `cameraRig.aimAt(objectOrPosition)` turns the view toward something
- Top view uses topDownHeight and topDownAngle (not distance); the sky is barely visible from above, so make the floor look good.

**Physics** (`physics`, Rapier)
- `physics.add(obj, { type: 'dynamic' | 'fixed' | 'kinematic', shape: 'box' | 'ball' | 'capsule' | 'cylinder' | 'mesh' | 'hull', mass, friction, bounciness, sensor, lockRotation, gravity: 0..1, ccd })`
- `physics.onHit(obj, (other) => {})` touching starts (`other === player.object` for the player; sensors notice the player too)
- `physics.push(obj, { x, y, z })`, `physics.setVelocity(obj, v)`, `physics.getVelocity(obj)`, `physics.teleport(obj, [x, y, z])`
- `physics.raycast(from, dir, maxDist, { ignore: obj })` → `{ object, point, normal, distance } | null`
- For pickups and enemy hits, distance checks are simplest: `near(a, b, radius)`.

**Input** (`input`)
- `input.held('w')`, `input.pressed('space')`, `input.released('e')`; names: letters, digits, `space`, `shift`,
  `enter`, `escape`, `up/down/left/right`, `mouse`, `rightmouse`; actions: `jump`, `fire`, `run`, `interact`
- `input.move` `{ x, y }` (WASD/arrows/stick/phone joystick, y = forward), `input.mouse` `{ x, y, dx, dy, wheel }`, `input.locked`
- Phones (touch controls appear by themselves; `?touch` in the URL shows them on a computer): `isTouch` (true on
  phones/tablets), `input.touchButton('fire', '🔫')` a hold button for any key or action (`null` label removes it;
  Jump is there by default), `input.press('e')` / `input.release('e')` press keys from code.

**UI** (`ui`)
- `ui.text(id, text, { at: 'top-left' | 'top' | 'top-right' | 'bottom-left' | 'bottom' | 'bottom-right' | 'center', size, color })`
- `ui.bar(id, value, max, { color, label, at })`, `ui.remove(id)`, `ui.message('Level 2!', { seconds })`, `ui.crosshair(true)`
- `ui.hint('E', 'open')` one key hint at the bottom (only while it matters), `ui.hint()` hides it
- `ui.images([...urls])` shows pictures over the game (what `npm run preview` uses)
- `await ui.title({ title, button, image })` (skipped on restart), `await ui.screen({ title, text, button, image, pause })` (pauses the game while open)
- `ui.text` and screens keep line breaks (`\n`).

**Sound**
- `sfx('coin')` made-up sounds: coin, jump, hit, hurt, explode, laser, powerup, click, win, lose, step, whoosh, bounce, magic
- `sound.play('assets/sounds/kenney/blaster.mp3', { volume, pitch, loop, at: position })` → handle with `.stop()`
- `sound.music(path, { volume })`, `sound.stopMusic()`

**Effects**
- `fx.burst(pos, { color, count, speed, size, life, gravity (negative = rises), glow })`, `fx.shake(strength, seconds)`, `fx.flash(color, seconds)`,
  `fx.popup(pos, '+10', { color })`, `fx.slowmo(scale, seconds)`
- `await tween(obj.position, { y: 3 }, 0.5, { ease: 'out' | 'in' | 'inOut' | 'bounce' | 'elastic' | 'linear', delay })`

**Helpers**
- `after(sec, fn)`, `every(sec, fn)` (game time; `.cancel()`), `random(a, b)`, `randomInt(a, b)`, `pick(list)`, `chance(p)`
- `clamp`, `lerp`, `damp(cur, target, speed, dt)`, `vec(x, y, z)`, `wave(speed, amount, offset)`
- `distance(a, b)`, `distance2D(a, b)`, `near(a, b, r)` (objects or positions), `turnTowards(obj, target, dt, speed)`
- `restartGame()`, `setPaused(bool)`, `time.now` (game seconds; use it for timers, not `performance.now()`),
  `seedRandom(n)`, `log(...)` (also goes to logs/browser.log; the same line within 3 s is written once)
- `THREE` is three.js r186 for anything else (materials, lights, geometry).
