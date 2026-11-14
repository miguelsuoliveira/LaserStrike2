---
name: objaverse
description: Search and download from 6,000 checked free 3D models of almost anything (Objaverse clean set, mostly CC-BY with a credit line) - specific objects, animals, vehicles, food, gadgets, buildings, some animated creatures. Use when Poly Pizza, the kits and the catalog don't have what the kids asked for ("a toaster", "a jellyfish", "a submarine"), or they want a more detailed model.
---

# Objaverse (6,000 models of everything)

A cleaned set of Sketchfab models: checked for licences, brands, fan art and grown-up content. Styles vary a
lot (cartoon, realistic, scans), so always look at the pictures. Try `poly-pizza` first for cartoon things.

## Commands

```bash
npm run assets -- objaverse search jellyfish --thumbs
npm run assets -- objaverse search dog --animated --max-tris 20000
npm run assets -- objaverse search tree --cc0           # only 39 models are CC0
npm run assets -- objaverse get red-dragon-bust-92fefac5 --name dragon_head --folder models/props
npm run assets -- objaverse get skull-downloadable-1a9db900 --lod 2   # smaller copy (fewer triangles)
```
- The first search downloads the model list once (9 MB, kept in `.cache/`).
- `get` saves to `public/assets/models/objaverse/` and prints the `loadModel(...)` line.
- Models are about 1 unit big; use `loadModel(..., { height })` or `{ size }` as usual.
- `--lod 1`, `--lod 2`, `--lod 3` are lighter versions of the same model (1 is about half the triangles, 3 is the lightest).

## Choosing

- Results are sorted best first. Show `.previews/thumbs/objaverse/sheet.jpg` and let the kids pick.
- Prefer under ~20,000 triangles (`--max-tris 20000`) and under 1 MB. Big ones: try `--lod 1` or `2`.
- `animated` shows the number of animations. Many are "Object_0" clips (parts moving, no skeleton), not
  walk cycles: fine for a flapping or spinning thing, not for a player character.
- Skip whole scenes ("Dragon Attack Aftermath", "...Inn with Neon"), anything scary or gory for 12-year-olds,
  and anything that looks like a famous game/film character (most are filtered, double-check).

## Licence and credit

- Almost everything is **CC-BY 4.0**: free, but the author must be named. `get` writes the full line
  (title, author, link, licence, "changed: converted/resized") to `CREDITS.md`. Also put
  "Jellyfish by <author>" on the game's credits screen.

## Common problems

- Search matches whole words in titles ("car" finds "Race Car", not "Carton"). Try singular words and
  synonyms (boat / ship, bunny / rabbit).
- Titles can be odd ("Doggy Meme Dog PS1"): the picture matters more than the title.
- The `mobile/` and `ktx2/` versions in the dataset use KTX2 textures the engine can't load; the tool
  always uses the `web` or `lods` files, which work.
