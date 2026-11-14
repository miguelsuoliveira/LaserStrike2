---
name: smithsonian-3d
description: Download real museum objects scanned in 3D from the Smithsonian (dinosaur skeletons and fossils, skulls, shells, insects, masks, statues, airplanes, space capsules), free CC0 when the museum marks them so. Use when the kids want "a real T-rex skeleton", "a real fossil", a museum or history level, or something that must look exactly like the real object.
---

# Smithsonian 3D (real museum scans)

Photo-scanned real objects: realistic, detailed, no animations. Great for a museum level, a dig site, a
treasure, or a boss made of bones. They look odd next to cartoon models, so ask the kids about style first.

## Commands

```bash
npm run assets -- smithsonian search triceratops --thumbs
npm run assets -- smithsonian get d8c623be-4ebc-11ea-b77f-2e728ce88125 --name triceratops --folder models/museum
npm run assets -- smithsonian get d8c623be-4ebc-11ea-b77f-2e728ce88125 --small     # 20k-triangle version
```
- The id is the long code from the search (copy it exactly).
- `get` checks the licence, converts the file for the engine, turns it upright (like the museum's viewer)
  and saves it to `public/assets/models/museum/`. It prints the `loadModel(...)` line.
- Scans are real size in meters; `loadModel(..., { height: 2 })` rescales them anyway.

## Choosing

- Use `--thumbs` and show `.previews/thumbs/smithsonian/sheet.jpg`: many results are fragments ("Tail Spike",
  "excavation site", flat fossil slabs). Pick whole, recognizable objects.
- The normal version is ~150,000 triangles (1-3 MB): fine for **one** display piece. Use `--small` (~20,000)
  for anything placed more than once or on a busy level.
- Titles are scientific names ("Triceratops horridus Marsh, 1889"): use `--name` for a short file name.

## Licence (checked for every get)

- The 3D site itself doesn't say the licence. Smithsonian Open Access marks most 3D scans **CC0**, but not all:
  some portraits and loaned objects are "usage conditions apply". So `get` asks Open Access about each model
  and **refuses** anything not marked CC0 ("not free to use ... pick another one").
- The check uses a shared demo key: about 10 checks per hour per school network. If it says the check is
  used up, try later or pick a model from another source. A mentor can get a free key at
  https://api.data.gov/signup and put `SI_API_KEY=...` in `.env`. Answers are remembered in `.cache/`.
- Credit ("Smithsonian Institution", title, link) is added to `CREDITS.md` automatically.

## Common problems

- Search words are matched in English titles: try the animal or object name (skull, mammoth, airplane, mask).
- No animations: move them with code (see the `character-animation` skill) or keep them as scenery.
- Some objects have no web version and are skipped in the search results.
