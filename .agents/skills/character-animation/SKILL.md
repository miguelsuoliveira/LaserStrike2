---
name: character-animation
description: Make characters and creatures move like they're alive. Use for playing or changing a model's animations (walk, run, attack, dance), choosing or swapping the player character, putting a sword/hat/gun in a character's hand, animating models that have no skeleton with code (bobbing, squash and stretch, wings, wheels, tails, blinking), building creatures out of simple shapes, and getting new rigged/animated characters (KayKit, Quaternius, Mixamo, Meshy/Tripo auto-rigging).
---

# Character animation

First find out what the model has: `npm run inspect -- public/assets/models/characters/<file>.glb`
prints its **Parts** (meshes you can hide/show), **Bones** (skeleton) and **Animations** (names + seconds).
The catalog also lists animations for every character.

## 1. The model has animations (most characters in the catalog)

```js
const anim = animate(model);          // model from loadModel(); players/characters: player.animator
anim.play('Idle');                    // loops; fades from the last one (fade: 0.2 s)
anim.play('Running_A', { speed: 1.3 });
await anim.once('1H_Melee_Attack_Chop');  // once, then back to the loop
anim.names                            // every name
```
- Names are matched loosely: `'run'` finds `Running_A`. Missing names print a warning in
  `logs/browser.log` that lists the real names.
- `createPlayer` / `createCharacter` switch idle/walk/run/jump/fall automatically. Change which clips
  they use: `createPlayer({ animations: { walk: 'Walking_C', run: 'Running_B', idle: 'Idle_Combat' } })`.
- One-shot actions on players/characters: `await player.action('Cheer')` (movement animation resumes after).
- `anim.busy` is true while a one-shot plays. `anim.current.timeScale = 0.5` slows the current clip.
- Death that stays down: `player.frozen = true; player.animator.play('Death_A', { loop: false })`.

## 2. Swap the character / outfit

- Another catalog character: change `model:` in `createPlayer`. KayKit characters share the same
  animation names, so code keeps working. Remember their `hide` lists (catalog notes).
- Recolor: after loading, change a material:
  ```js
  player.model.traverse((o) => { if (o.isMesh && o.name.includes('Cape')) o.material.color.set('#8a2be2'); });
  ```
  (Materials are copies per model, so only this character changes.)
- Bigger/smaller: `createPlayer({ height: 2.5 })`. Glowing eyes: `o.material.emissive.set('#00ffff'); o.material.emissiveIntensity = 4`.

## 3. Hold something in the hand (or wear a hat)

```js
const torch = await loadModel('assets/models/dungeon/torch_lit.glb', { size: 0.7, add: false });
attach(player, torch, { to: 'left hand', upright: true, position: [0, -0.15, 0] });
const hat = await loadModel('assets/models/medieval/flag_red.glb', { size: 0.5, add: false });
attach(player, hat, { to: 'head', position: [0, 0.3, 0] });
```
- `to`: `'right hand'`, `'left hand'`, `'head'`, `'back'`, or a bone name from `npm run inspect`
  (works for KayKit, robot and Mixamo skeletons).
- The item keeps its `size` in meters. `upright: true` keeps torches, lanterns and flags pointing up
  whatever the arm does; leave it off for swords so they swing with the hand.
- Nudge with `position` (meters) and `rotation` (degrees), then check with `npm run snap -- --zoom 2.5`.
- KayKit characters already hold weapons: choose with `hide` (catalog notes list the part names).
- A light that follows the torch: `const l = new THREE.PointLight('#ffaa55', 15, 10); torch.add(l); l.position.y = 0.6;`
- three.js removes dots from bone names (`handslot.r` becomes `handslotr`); `npm run inspect` shows the real names.

## 4. No skeleton? Animate it with code (great for blobs, robots, cars, ghosts, coins)

Put these in `update(dt)`. `wave(speed, amount, offset)` gives a smooth back-and-forth number.

```js
// Bob up and down, spin
obj.position.y = baseY + wave(3, 0.2);
obj.rotation.y += 2 * dt;

// Squash and stretch while hopping (keep volume: x*y*z ~ 1)
const s = 1 + wave(8, 0.15);
obj.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));

// Waddle / walk wobble only while moving
const moving = speed > 0.1;
obj.rotation.z = moving ? wave(10, 0.12) : damp(obj.rotation.z, 0, 10, dt);

// Lean into the direction of travel
obj.rotation.x = damp(obj.rotation.x, forwardSpeed * 0.03, 8, dt);

// Wings flap, tail swings (child parts found by name)
model.getObjectByName('WingLeft').rotation.z = wave(12, 0.6);
model.getObjectByName('Tail').rotation.y = wave(4, 0.4);

// Wheels roll
for (const w of wheels) w.rotation.x += car.speed * dt / 0.4; // 0.4 = wheel radius

// Blink: squash the eyes for 0.1 s every few seconds
every(3, () => { eyes.scale.y = 0.1; after(0.1, () => (eyes.scale.y = 1)); });

// Pop in when spawned, shrink when collected
obj.scale.setScalar(0.01); tween(obj.scale, { x: 1, y: 1, z: 1 }, 0.4, { ease: 'elastic' });
await tween(obj.scale, { x: 0, y: 0, z: 0 }, 0.2); world.remove(obj);
```
Kenney platformer `character.glb` has simple animations (idle, walk, jump) without bones and works
with `createPlayer` directly.

## 5. Build a creature from shapes (fast, original, kids love it)

```js
import { THREE, world } from '../engine/index.js';
export function makeBlob(color = '#7cf27c') {
  const blob = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), mat);
  body.position.y = 0.6; body.castShadow = true;
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8), eyeMat);
    eye.position.set(x, 0.85, 0.5);   // +Z is the front
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 6), new THREE.MeshStandardMaterial({ color: '#111' }));
    pupil.position.z = 0.09;
    eye.add(pupil);
    blob.add(eye);
  }
  blob.add(body);
  blob.userData.body = body;         // animate body.scale for squish
  world.add(blob);
  return blob;
}
```
Use it as the player: `const player = await createPlayer({ model: makeBlob(), camera: 'top' })`
(remove the `world.add(blob)` line when you do: the player adds it). `player.model` is then your blob, so
`player.model.userData.body.scale` squishes it. Add squash/stretch in `update` based on `player.velocity`.
It has no animations, so skip `player.action(...)` and animate with code (section 4).

## 6. Need a new character or animation?

In order of speed (details and links in the `free-assets` skill):
1. **Catalog first**: 7 rigged characters with 14-95 animations each.
2. **More KayKit/Quaternius characters (CC0)**: same skeleton style as ours, many animations.
   KayKit characters all share animation names, so swapping is easy.
3. **Mixamo** (free Adobe account, mentor does it): upload a humanoid model, auto-rig, pick
   animations (download "FBX Binary", "With Skin" for the character, "Without Skin" for extra moves).
   Convert FBX to GLB in Blender (File > Import FBX, Export glTF Binary) or ask the mentor.
   Mixamo files are free to use in games but can't be shared as raw files (don't commit them to a
   public repo; keep them local for the jam).
4. **AI model generators with auto-rigging** (mentor-operated, paid credits): Meshy or Tripo can turn
   a kid's drawing or text into a 3D model and rig + animate humanoids. Download as GLB, then
   `npm run assets -- url` won't work for logins, so save the file into `public/assets/models/characters/`
   and run `npm run assets -- catalog`. Check the triangle count with `npm run inspect` (aim < 50k).
5. Animations from one character on another work only when the skeletons match (same bone names).
   Different skeletons need retargeting, which is slow and fiddly: avoid at a jam.

## Common problems

- **Model faces backwards**: `createPlayer({ turn: 180 })` / `loadModel(path, { turn: 180 })`.
- **Floats or sinks**: models are auto-placed with feet at y = 0; a big hidden part (weapon) can confuse
  it: hide parts with `hide` before measuring (it already does), or adjust `player.model.position.y`.
- **T-pose / not moving**: the animation name didn't match (check the warning in `logs/browser.log`),
  or you created a second `animate()` on a clone; use the same `model`.
- **Animation slides (moonwalking)**: lower `walkSpeed` or raise the clip speed (the engine scales walk
  speed automatically between 0.5x and 1.6x).
- **All copies change color**: you edited a shared material created by yourself; clone it first.
