---
name: remix-models
description: Change a 3D model the kids already have (bundled or downloaded) - recolor it ("make the barbarian blue", "a red cape"), keep or remove parts ("only the sword", "no shield"), make variants (gold enemy, giant head, squashed car), combine models (sword from one character in another's hand, a rider on a car), glow, new textures, add or rename animations ("give my robot a dance"), and fix models that are too big, slow, sideways, floating or won't load (Draco). Use for any "change this model" request before looking for a new one.
---

# Remix models

Two ways to change a model:
1. **In code, while loading** (instant, no new file, easy to undo). Try this first.
2. **A new .glb file** with `npm run remix -- <command>` when code can't do it or it should be permanent.

First look inside: `npm run remix -- parts <file>` prints the **part** names (with triangles and which
bone holds them), **materials** with their colors, textures and animations. `npm run inspect -- <file>`
adds the size in meters and the bone names. Use the names exactly as printed (three.js removes dots and
turns spaces into `_`: `handslot.r` becomes `handslotr`).

## 1. In code (runtime remix)

Every `loadModel()` call is its own copy with its own materials, so changes affect only that copy.

```js
// Recolor by part name (or o.material.name for a material)
model.traverse((o) => {
  if (o.isMesh && o.name.includes('Cape')) o.material.color.set('#8a2be2');
});
// The color multiplies the texture. For a clean flat color drop the texture:
//   o.material.map = null; o.material.needsUpdate = true;

// Glow (bloom picks up strong emissive)
o.material.emissive.set('#00ffcc'); o.material.emissiveIntensity = 4;

// Hide parts (names contain these words)
await loadModel('assets/models/characters/barbarian.glb', { height: 1.8, hide: ['Shield', '2H_Axe', 'Offhand', 'Mug'] });

// Variants: same model, different colors
for (const [i, c] of ['#e63946', '#2a9d8f', '#ffb703'].entries()) {
  const m = await loadModel('assets/models/characters/skeleton_minion.glb', { height: 1.6, position: [i * 2, 0, 0] });
  m.traverse((o) => o.isMesh && o.material.color.set(c));
}

// Silly shapes: stretch the inner model (the outer object keeps its physics/position)
model.userData.model.scale.y *= 0.6;          // squashed
// Giant head: scale the bone, and drop that bone's scale tracks so animations don't undo it
const head = findBone(model, 'head');
model.animations = model.animations.map((clip) => {
  const c = clip.clone();
  c.tracks = c.tracks.filter((t) => t.name !== `${head.name}.scale`);
  return c;
});
head.scale.setScalar(1.8);                    // before animate(model)

// New texture (glTF models need flipY = false, or the picture is upside down)
const tex = (await loadTexture('assets/images/our-drawing.png')).clone();
tex.flipY = false;
o.material.map = tex; o.material.needsUpdate = true;
```
- **Combine models**: borrow a part from another model and put it in a hand. No new file needed:
  ```js
  const donor = await loadModel('assets/models/characters/barbarian.glb', { height: 1.8, add: false });
  attach(rogue, donor.getObjectByName('1H_Sword'), { to: 'right hand' });
  ```
  Props, hats, torches and hand/head/back positions: see the `character-animation` skill (section 3).
- **On a vehicle**: `car.object.add(rider); rider.position.set(0, 0.6, -0.3); animate(rider).play('Sit_Chair_Idle')`
  (rider loaded with `add: false`). A plain model works the same: `truck.add(rider)`.
- Swapping or recoloring the **player** character and animating models with code: `character-animation` skill.
- Kenney and KayKit models use one small "palette" texture for everything: recolor them with colors,
  not pictures (a picture comes out as stripes).

## 2. New files: `npm run remix`

Use a file command when: the model is **too big or slow** (over ~50k triangles or ~10 MB), it is a
**Draco** download (Smithsonian scans: the game can't load those as they are), you want **only one part**
as its own model, parts or colors should be **permanent**, or you need **animations from another file**.

The original is never changed. The new file goes next to it as `<name>_remix.glb`, or name it with
`--out` (a bare name stays in the same folder; `--out public/assets/models/<folder>/x.glb` moves a download
into the game). Files in `public/assets` are added to CATALOG.md and get a CREDITS.md line automatically.

```bash
npm run remix -- parts public/assets/models/characters/barbarian.glb
npm run remix -- shrink ~/Downloads/triceratops.glb --tris 20000 --texture 1024 --out public/assets/models/dinos/triceratops.glb
npm run remix -- color public/assets/models/characters/barbarian.glb all "#3366ff" --out barbarian_blue.glb
npm run remix -- color public/assets/models/characters/barbarian.glb cape gold --out barbarian_goldcape.glb
npm run remix -- color public/assets/models/racing/vehicle_truck_red.glb body gold --keep-texture --out truck_gold.glb
npm run remix -- keep public/assets/models/characters/barbarian.glb 1H_Axe --out axe.glb
npm run remix -- remove public/assets/models/characters/barbarian.glb shield --out barbarian_noshield.glb
npm run remix -- turn public/assets/models/dinos/fossil.glb --x 90 --out fossil_standing.glb
npm run remix -- anims public/assets/models/characters/skeleton_minion.glb
npm run remix -- add-anims public/assets/models/characters/barbarian.glb public/assets/models/characters/skeleton_minion.glb --only Taunt Spawn_Ground --out barbarian_taunt.glb
npm run remix -- rename-anim public/assets/models/characters/rogue.glb Cheer Celebrate --out rogue_party.glb
```
- **shrink**: simplifies to about `--tris` triangles (default 20000), textures at most `--texture` pixels
  (default 1024, WebP when smaller), and saves compressed. Rigged parts (they bend with bones) are left
  alone unless you add `--skinned`. A 1.7 MB Draco scan (100k triangles) became 0.8 MB with 20k and
  looked the same.
- **color**: `all`, a material name or a part name. Parts that share a material get their own copy, so
  only they change. Default is a flat color (texture removed); `--keep-texture` tints the texture.
  **Quote hex colors**: the terminal drops words starting with `#`. Names work too (red, gold, hotpink).
- **keep / remove**: several names at once; a word matches every part containing it (`shield` = all 4
  shields). `keep` on a hand-held item takes it out of the skeleton as it sits in the hand, ready for
  `attach()`.
- **turn**: `--x 90` / `--x -90` stands up a model lying on its back (scans are often Z-up), `--z 90` rolls
  it, `--y 180` turns it around. `loadModel` then puts its feet on the ground again.
- **add-anims**: copies clips onto the character by matching bone names. Works when the skeletons match:
  all KayKit characters share one rig (skeletons have extra moves like Taunt, Spawn_Ground,
  Skeletons_Awaken_Floor); the Quaternius Universal Animation Library fits the Quaternius Universal Base
  Characters. It reports how many tracks matched and which clips were skipped.

After a file command: load the new file and check it with `npm run snap`. If the input was **CC-BY**,
the tool says so: the credits screen must name the author and say the model was changed.

## Common problems

- **T-pose after add-anims**: read the report. `0 tracks matched` = different skeletons (copying won't
  work: find animations made for that rig). Most tracks matched but still frozen = the name in
  `anim.play()` is wrong (`npm run remix -- anims <file>`). "made at a different size" warning (Mixamo cm
  vs m) = the character jumps away; use moves exported for that character.
- **A rigged character is too slow**: shrink skips rigged parts on purpose (simplifying can tear them at
  the joints). Try `--skinned --tris <n>` and check the animations with snap, or remove unused parts
  (`remove`), shrink textures (`--texture 512`), or pick a lighter character.
- **Shrink didn't reach the number**: it stops before the shape breaks; the report says why.
- **Textures black or weird**: a dark texture stays dark when tinted (use a flat color, no
  `--keep-texture`); metal looks black without reflections (`o.material.metalness = 0`); a new texture is
  upside down without `tex.flipY = false`; a `.gltf` lost its texture files (use `.glb`, or `shrink` it).
- **"no part named X"**: the error lists the real parts. Groups (a node holding several parts) work too.
  In code, `getObjectByName()` needs the exact printed name; `hide` and the remix commands match loosely.
- **Code that moved a part stops working on a remixed file**: compressed files store parts with
  different offsets. Move parts relative to where they start (`part.position.y += 0.2`), not to fixed values.
- **Floats or sinks**: `loadModel` puts the lowest point on the ground in the rest pose. A model lying
  on its side: `turn` it. Big hidden extras (weapons): `hide` them so they don't count.
