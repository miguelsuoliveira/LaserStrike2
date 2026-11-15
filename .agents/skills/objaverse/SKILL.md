---
name: objaverse
description: Search and download from Objaverse (objaverse.allenai.org) - 800,000 free 3D models of almost anything (Sketchfab models with CC-BY or CC0 licences), plus a 6,000-model hand-checked set - specific objects, animals, vehicles, food, gadgets, furniture, buildings, tools, some animated creatures. Use when Poly Pizza, the kits and the catalog don't have what the kids asked for ("a toaster", "a jellyfish", "a submarine", "a step ladder"), or they want a more detailed or realistic model.
---

# Objaverse (800,000 models of almost everything)

Objaverse is a huge free collection made by the Allen Institute for AI from Sketchfab models. Styles vary a lot
(cartoon, realistic, scans), so **always look at the pictures**. Try `poly-pizza` first for cartoon things.

## Commands

```bash
npm run assets -- objaverse search jellyfish --thumbs                 # all 800,000: best matches first
npm run assets -- objaverse search dog --animated --max-tris 20000
npm run assets -- objaverse search tree --cc0                         # no credit needed (few models)
npm run assets -- objaverse get 8ed46194830044bc96709bb984e337c4 --name step_ladder --folder models/props
npm run assets -- objaverse search dragon --checked --thumbs          # only the 6,000 hand-checked models
npm run assets -- objaverse get red-dragon-bust-92fefac5 --lod 2      # (checked set: smaller copy)
```
- The first search downloads the Objaverse list once (20 MB, kept in `.cache/`). Search needs the internet
  (it asks Sketchfab's public search for the best matches and keeps the ones that are in Objaverse).
- Only **CC0** and **CC-BY** models are shown, no age-restricted ones, no known brands or fan art.
- `get` saves to `public/assets/models/objaverse/` and prints the `loadModel(...)` line. Models over 5 MB or
  60,000 triangles are shrunk automatically (`<name>_small.glb`, 20,000 triangles, 1024 px textures);
  `--big` keeps the original.
- Models come in any size: always load with `height` or `size`.

## Choosing

- Results show triangles, file size and animations. Show `.previews/thumbs/objaverse/sheet.jpg` and let the kids
  pick. Prefer under ~20,000 triangles (`--max-tris 20000`) and one style for the whole game.
- **Check every new model** (`free-assets` skill, section 8): Sketchfab models face any direction, so the front
  arrow in `npm run snap -- --colliders` matters; fix with `turn`.
- `animated` shows the number of animations. Many are parts moving (no skeleton), not walk cycles: fine for a
  flapping or spinning thing, not for a player character (use KayKit/Quaternius characters for those).
- Skip whole scenes ("... room", "... pack", "low poly city"), anything scary or gory for 12-year-olds, anything
  that looks like a famous game/film character or a real brand, and real people. The filter misses some:
  the picture decides. The `--checked` set is safer when unsure.

## Licence and credit

- **CC-BY 4.0** (most): free, but the author must be named. `get` writes the full line (title, author, link,
  licence, "via Objaverse", "changed: converted/resized") to `CREDITS.md`. Also put "Jellyfish by <author>" on the
  game's credits screen.
- CC0: no credit needed (still nice to add).

## Common problems

- Few or odd results: try one simpler English word, singular, or a synonym (boat / ship, bunny / rabbit).
- Titles can be odd ("Doggy Meme Dog PS1"): the picture matters more than the title.
- "Sketchfab search did not answer": try again in a minute, or use `--checked` (works from the saved list).
- A model looks dark, see-through or untextured: pick another one (some Sketchfab uploads need special
  shaders).
