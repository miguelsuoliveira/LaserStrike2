---
name: free-assets
description: Find, download and use free 3D models, characters, skies (HDRI), realistic textures, sound effects and music. Start here when the kids want something that isn't in public/assets/CATALOG.md ("I want a dragon", "a desert sky", "laser sounds", "make it look realistic", "a whole pirate world"), or ask where to get models. Picks the right source skill, and covers licences, credits, file sizes and checking a new model.
---

# Free assets

## 1. Check the catalog first

`public/assets/CATALOG.md` lists everything already downloaded (160+ models, skies, textures, sounds).
It's free and instant. Use what's there before downloading anything. Sounds without files:
`sfx('coin' | 'jump' | 'hit' | 'hurt' | 'explode' | 'laser' | 'powerup' | 'click' | 'win' | 'lose' | 'step' | 'whoosh' | 'bounce' | 'magic')`.

Want to **change** a model they already have (color, parts, size, add animations, Draco won't load)?
Use the `remix-models` skill instead of downloading a new one.

## 2. Pick the source

| The kids want | Use | Skill |
|---|---|---|
| One cartoon / low-poly thing (dragon, shark, sword, car, house) | Poly Pizza | `poly-pizza` |
| A whole themed set that matches (city, dungeon, race track, pirate, space base, forest) | Kenney, KayKit, Quaternius kits | `kenney-kaykit-quaternius` |
| A character or creature that walks, runs and attacks | KayKit adventurers/skeletons, Quaternius monsters, `pizza search <animal> --animated` | `kenney-kaykit-quaternius`, `poly-pizza` |
| Realistic sky, ground/wall texture, photo-real prop | Poly Haven | `poly-haven` |
| A real museum object (dinosaur skeleton, fossil, statue, plane) | Smithsonian 3D | `smithsonian-3d` |
| Something specific nobody else has (toaster, jellyfish, submarine) | Objaverse (800,000 models, CC-BY/CC0) | `objaverse` |

Quick order for "I want an X": catalog → `pizza search X` → kit with X → `objaverse search X`.

```bash
npm run assets            # every command with its options
```

## 3. Let the kids choose

- Add `--thumbs` to a search: numbered pictures go to `.previews/thumbs/<source>/`, and `sheet.jpg` shows
  them all in one image. Look at it, show it (open the file for them) and let them answer "1, 2 or 3".
- Keep one style per game: cartoon (Poly Pizza, Kenney, KayKit, Quaternius) **or** realistic (Poly Haven,
  Smithsonian). Objaverse has both: check the picture.
- For characters prefer models with animations (search output says `animated` / the get prints them).
- Get only the pieces the game needs (`--only` for kits), then build. More later if they want.

## 4. Licence and credits (important)

- Only **CC0** (public domain) or **CC-BY** (free, but the author is named). The commands refuse anything else
  and write a line to `public/assets/CREDITS.md` for every download.
- **CC-BY**: put the author on the game's credits screen too ("Dragon by na3ee1"). The `get` output says when.
- Never use: ripped game models (Mario, Minecraft, Fortnite, Pokémon...), fan art, Sketchfab files without a
  clear free licence, "free for personal use" files, anything from a random website. Search results already
  skip most fan art: still say no if something looks like a famous character.
- `itch get` for an unknown creator needs `--license CC0` after reading their page; `url` and `zip` need
  `--author` and `--license`.
- **No logins with the kids' info.** If a site needs an account, a mentor downloads the file.

## 5. Size limits

- Every `get` prints the size, triangles and animations. Over **5 MB** it warns; over **30 MB** it refuses
  unless `--force` (a mentor's call).
- Aim for under ~20,000 triangles for things placed many times (coins, trees, enemies) and under ~100,000 for
  one hero model. Many big models make school laptops slow.
- Downloads are cached in `.cache/` (zips, lists), so asking again is instant.

## 6. Files from elsewhere

```bash
npm run assets -- url <https://...file.glb> --author "Name" --license CC0 [--folder models/x]   # .glb .gltf .mp3 .ogg .wav .hdr
npm run assets -- zip ~/Downloads/pack.zip --author "Name" --license CC0 [--folder models/x]      # models + sounds from a zip
```
`.fbx` / `.obj` / `.blend` must be converted to `.glb` first (Blender: File > Import, then
File > Export > glTF Binary), which is a mentor job. Files saved by hand go into
`public/assets/models/<folder>/`; then run `npm run assets -- catalog` and add a line to `CREDITS.md`.

## 7. Sounds and music

- **Kenney audio packs** (CC0): impact, interface, RPG, sci-fi, digital, music jingles. Download the zip
  (mentor), then `npm run assets -- zip ~/Downloads/kenney_<pack>.zip --author Kenney --license CC0`.
- **Freesound.org**: filter by license "Creative Commons 0". Needs a free account (mentor).
- **OpenGameArt.org**: filter by CC0; good for music loops.
- **Make your own**: record on a phone (see the `make-it-ours` skill) or use `sfx()`.
- Files go in `public/assets/sounds/` (effects) or `public/assets/music/` (loops). `.mp3` works everywhere.
  Convert `.ogg`/`.wav` with `npm run assets -- sounds` (needs ffmpeg; Chrome plays .ogg anyway).

## 8. Checking a new model

```bash
npm run inspect -- public/assets/models/<folder>/<file>.glb
```

Shows size in meters, parts, bones and animations. Load it with `height` or `size` so it's the right size in
the game. Then, once, for anything that moves, collides or shoots:

```bash
npm run snap -- --colliders --before "game.cameraRig.aimAt(game.player.object)"
```

- **Front:** the yellow arrow on a character or vehicle must come out of its face, nose or gun barrel. Downloaded
  models often face sideways or backwards: `loadModel(..., { turn: 90 })` (or -90, 180) and look again.
  Things that aren't characters or vehicles: look at them from the front with `--before` and check they face the
  way your code moves them.
- **Collider:** green (scenery) and blue (moving) lines must hug the model. A big box around empty space, lines
  floating above or sunk into the floor, or no lines at all (it isn't solid) are bugs: see `ENGINE.md`, Physics.
- **Size:** next to the player it should look right (a mug is not as tall as the hero, unless that's the joke).
- **Warnings:** fix every `Physics check:` line the snap prints.

Too big, too slow, wrong colors or wrong parts: `remix-models` skill.
