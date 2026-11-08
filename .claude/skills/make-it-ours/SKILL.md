---
name: make-it-ours
description: Put the kids' own creations into the game - drawings or photos as textures, posters, sprites, logos, title art and skins; their recorded voices and sounds as effects; their level maps drawn on paper. Use when kids want "our drawing", "my voice", "our logo", "a picture of our pet as an enemy" or anything hand-made.
---

# Make it ours

Hand-made things are what make a jam game theirs (and they score points for it). Keep it simple and fast.

## Getting files onto the laptop

- **Drawings**: photograph them flat, in good light, filling the frame. AirDrop / email / USB to the laptop.
- **Sounds**: record on a phone's voice memo app (close to the mouth, quiet room). Short clips (under 2 s) for effects.
- Put images in `public/assets/images/`, sounds in `public/assets/sounds/ours/`. Lowercase names without
  spaces: `dragon_drawing.jpg`, `roar.m4a`. Run `npm run assets -- catalog` afterwards.
- **Never** use photos of faces or anything with real names or school logos (privacy rule).

## Drawing → texture on things

```js
const tex = await loadTexture('assets/images/our_pattern.jpg');
box({ size: [2, 2, 2], position: [0, 1, 5], physics: 'dynamic' }).material.map = tex;
// or for any mesh: mesh.material = new THREE.MeshStandardMaterial({ map: tex });
```
Tiling patterns (bricks they drew, grass, lava): `loadTexture(path, { repeat: [8, 8] })`.

## Drawing → flat character or poster (a "paper cut-out", looks great in 3D)

Cut the drawing out on paper and photograph it on white, or remove the background in an image editor
and save as PNG with transparency.

```js
export async function cutout(path, height = 2) {
  const tex = await loadTexture(path);
  const aspect = tex.image.width / tex.image.height;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), mat);
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  const holder = new THREE.Group();
  holder.add(mesh);
  world.add(holder);
  return holder;
}
// face the camera every frame (billboard): holder.rotation.y = cameraRig.yaw;
```
A cut-out can be the player (hide the 3D model: `player.model.visible = false; player.object.add(await cutout(...))`)
or an enemy (move it like the flying enemy in `game-recipes/recipes/enemies.md`). Add a bob:
`mesh.position.y = h / 2 + Math.abs(wave(10, 0.15))` while walking.

JPG photos have no transparency: for a white background use a `.png` the kids cleaned up, or accept a
rectangle "card" look (remove `alphaTest`).

## Title art and logo

```js
await ui.title({ image: 'assets/images/logo.png', title: 'Desert Dash', text: 'Press Play!' });
```
The picture shows above the title (it works on `ui.screen` too: a win screen with their drawing).
Use `title: ''` if the logo already has the name in it.

## Their sounds

```js
sound.play('assets/sounds/ours/roar.m4a', { volume: 1 });   // Chrome/Edge play m4a, mp3, ogg, wav
sound.play('assets/sounds/ours/boing.mp3', { pitch: 1.5 });  // pitch makes voices funny (0.5 = deep, 2 = chipmunk)
```
Converting to mp3 (for Safari): `npm run assets -- sounds` handles .ogg/.wav; for .m4a ask a mentor
or keep m4a (works in Chrome). Voices make great enemy sounds, announcers ("Level two!") and music.

## Paper level maps

Kids draw a grid on squared paper (# = wall, C = coin, E = enemy, S = start). Type it into the text map
in `game-recipes/recipes/levels.md` ("Grid levels from text"). Fast, and the level is 100% theirs.

## Texture from a photo of a real surface

A photo of a carpet, tree bark or a brick wall (no people!) works as a texture with `repeat`. Take it
straight on, evenly lit.
