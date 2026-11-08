---
name: free-assets
description: Find, download and use free (CC0, public domain) 3D models, characters, skies (HDRI), realistic textures, sound effects and music. Use when the kids want something that isn't in public/assets/CATALOG.md ("I want a dragon", "a desert sky", "laser sounds", "make it look realistic"), or ask where to get models. Also covers licenses, file formats and keeping files small.
---

# Free assets

## 1. Check the catalog first

`public/assets/CATALOG.md` lists everything already downloaded (160+ models, 4 skies, 12 textures,
19 sounds). It's free and instant. Use what's there before downloading anything. Sounds without files:
`sfx('coin' | 'jump' | 'hit' | 'hurt' | 'explode' | 'laser' | 'powerup' | 'click' | 'win' | 'lose' | 'step' | 'whoosh' | 'bounce' | 'magic')`.

## 2. Realistic models, skies and textures: Poly Haven (works from the terminal)

```bash
npm run assets -- search barrel          # also: rock, tree, sky, sunset, wood, brick, sand, snow...
npm run assets -- polyhaven Barrel_02    # downloads (1k quality) into the right folder
npm run assets -- polyhaven kloppenheim_06_puresky --res 2k --name stormy   # a sky, 2k is sharper
```
- Models land in `assets/models/realistic/`, skies in `assets/hdri/`, textures in `assets/textures/<name>/`.
- The catalog and `CREDITS.md` update automatically.
- Poly Haven trees and big plants are huge (60-900 MB). Search results don't show size: avoid
  "tree", "pine", "island_tree" models; use the stylized trees in `models/nature` instead.
- Use a sky: `await world.setSky('assets/hdri/stormy.hdr')`. A texture: `box({ texture: 'assets/textures/<name>' })`.
- Poly Haven has real-world photos only: no space or nebula skies ("stars" finds night photos of Earth).
  For space use the built-in `world.setSky('space')`.
- The download prints the file size. Skies at 2k are 5-7 MB, at 1k 1-2 MB.

## 3. Cartoon / low-poly models (CC0)

Best sources, all CC0 (free for anything, no credit required, but we credit anyway):

| Source | What | How to get it |
|---|---|---|
| **KayKit** (kaylousberg.com, GitHub "KayKit-Game-Assets") | characters with 70-95 animations, dungeon, halloween, space base, city, furniture, restaurant, medieval hex | Files on GitHub: `npm run assets -- url <github file link> --author "Kay Lousberg (KayKit)" --license CC0 --folder models/<name>` (`url` works with .glb, .gltf, .mp3/.ogg/.wav (into sounds/) and .hdr (into hdri/)) |
| **Kenney** (kenney.nl) | 100+ packs: vehicles, nature, castles, space, food, furniture, weapons, sounds | Download the zip in a browser (mentor), then `npm run assets -- zip ~/Downloads/kenney_<pack>.zip --author Kenney --license CC0` |
| **Quaternius** (quaternius.com, poly.pizza) | animals, monsters, robots, nature, sci-fi, animated characters | Download in a browser (glTF/GLB), put the .glb files in `public/assets/models/<folder>/`, run `npm run assets -- catalog` and add a line to `CREDITS.md` |
| **Poly Pizza** (poly.pizza) | search engine for thousands of free low-poly models (many CC0, some CC-BY) | Check the license on each model page. CC-BY means you must credit the author in the game's credits screen. |

Files the kids save by hand go into `public/assets/models/<folder>/` (a new folder name is fine),
then run `npm run assets -- catalog` so the AI can see them.

## 4. Sounds and music

- **Kenney audio packs** (CC0): impact, interface, RPG, sci-fi, digital, music jingles. Zip import as above.
- **Freesound.org**: filter by license "Creative Commons 0". Needs a free account (mentor).
- **OpenGameArt.org**: filter by CC0; good for music loops.
- **Make your own**: record on a phone (see the `make-it-ours` skill) or use `sfx()`.
- Files go in `public/assets/sounds/` (effects) or `public/assets/music/` (loops). `.mp3` works everywhere.
  Convert `.ogg`/`.wav` with `npm run assets -- sounds` (needs ffmpeg; Chrome plays .ogg anyway).

## 5. Rules (important)

- **License**: only CC0 / public domain, or CC-BY with the author named in the game credits.
  Never use: ripped game models (from Mario, Minecraft, Fortnite, Pokémon...), Sketchfab models
  without a clear free license, "free for personal use" files, anything from a random website.
- **Format**: `.glb` is best (one file). `.gltf` needs its `.bin` and textures (the `url` command packs them).
  `.fbx` / `.obj` / `.blend` must be converted to `.glb` first (Blender: File > Import, then
  File > Export > glTF Binary), which is a mentor job.
- **Size**: keep a single model under ~10 MB and ~50k triangles (`npm run inspect -- <file>` shows both).
  Many big models make school laptops slow.
- **No logins with the kids' info.** If a site needs an account, a mentor downloads the file.

## 6. Checking a new model

```bash
npm run inspect -- public/assets/models/<folder>/<file>.glb
```
Shows size in meters, parts, bones and animations. Then load it with `height` or `size` so it's the
right size in the game, and check with `npm run snap`.
