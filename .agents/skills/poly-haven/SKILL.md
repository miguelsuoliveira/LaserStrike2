---
name: poly-haven
description: Download realistic CC0 skies (HDRI photos), ground and wall textures (grass, sand, brick, wood, snow, rock) and photo-real props (barrel, crate, rock, apple, lantern) from Poly Haven. Use when the kids want the game to look realistic, want a different sky or time of day ("a sunset", "a stormy sky", "a desert"), or a realistic surface on the floor or walls.
---

# Poly Haven (realistic skies, textures and props)

Everything is CC0 and made from real photos. Check `public/assets/CATALOG.md` first: 4 skies and
12 textures (grass, sand, snow, brick, wood_planks...) are already there.

## Commands

```bash
npm run assets -- polyhaven search sunset          # skies, textures and models (old form: search sunset)
npm run assets -- polyhaven belfast_sunset_puresky --res 2k --name sunset   # a sky
npm run assets -- polyhaven red_brick --name brick  # a texture (color, normal, arm maps)
npm run assets -- polyhaven Barrel_01              # a model, 1k textures
```
- Skies go to `assets/hdri/`, textures to `assets/textures/<name>/`, models to `assets/models/realistic/`
  (`--folder` changes it). The download prints the size and the line to use it.
- Use them:
  ```js
  await world.setSky('assets/hdri/sunset.hdr');
  ground({ texture: 'assets/textures/brick' });   // or box({ texture: ... }), loadMaterial(...)
  await loadModel('assets/models/realistic/barrel_01.glb', { height: 1 });
  ```

## Choosing

- Skies: `--res 1k` is 1-2 MB, `2k` is 5-7 MB and sharper (fine for the one sky). Names ending in
  `_puresky` have no ground in the photo: best for games.
- Realistic props look odd next to cartoon models. Ask the kids which style they want, then stick to it.
- Models at 1k are enough.

## Licence and credit

All CC0; the credit line is added automatically.

## Common problems

- Trees and big plants are 60-900 MB. `polyhaven <id>` now refuses anything over 30 MB (the message
  says the size). Use the stylized trees in `models/nature`, or a Kenney/KayKit nature kit.
- Search doesn't show sizes; the download checks them.
- No space or nebula skies ("stars" finds night photos of Earth): use `world.setSky('space')`.
- Search words match tags, so "sand" also finds sandstone and sandbags. Look at the type column.
