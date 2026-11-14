---
name: poly-pizza
description: Download single free low-poly (cartoon) 3D models from Poly Pizza - one dragon, car, sword, tree, house, animal or monster - including animated characters and single Kenney/Quaternius/KayKit models. Use when the kids ask for one specific thing in a cartoon/low-poly style that isn't in public/assets/CATALOG.md ("I want a dragon", "add a shark", "a pizza slice"). For a whole themed set use kenney-kaykit-quaternius instead.
---

# Poly Pizza (single low-poly models)

10,000+ cartoon models, each CC0 or CC-BY. No account or key needed. Best first stop for "one thing".

## Commands

```bash
npm run assets -- pizza search dragon --thumbs              # 12 best matches + pictures
npm run assets -- pizza search robot --by quaternius --animated   # only that creator, only animated
npm run assets -- pizza search car --cc0                    # only CC0 (no credit needed)
npm run assets -- pizza get VBvzjFIYws --folder models/characters --name dragon
```
- `--by Kenney | Quaternius | KayKit` searches that creator's whole list (Quaternius has 1,400 models).
- `get` saves to `public/assets/models/polypizza/` unless you pass `--folder`. It prints the size,
  triangles, animation names and the exact `loadModel('assets/models/...')` line to use.
- The catalog and `CREDITS.md` update by themselves.

## Choosing (do this with the kids)

1. Search with **one simple word** (dragon, not "big red fire dragon").
2. Add `--thumbs`, look at `.previews/thumbs/pizza/sheet.jpg` (numbered pictures), show or describe it,
   and let the kids pick "1, 2 or 3".
3. Prefer: **CC0**, **animated = yes** for anything that walks, flies or fights, **under ~20,000 triangles**,
   and the same style as the rest of the game (flat colors, low-poly).
4. Skip: whole scenes or "kits" (one file with 50 things), anything that looks like a character from a
   famous game or film (fan art is filtered out, but double-check).

## Licence and credit

- `get` only accepts CC0 and CC-BY; anything else is refused.
- **CC-BY**: the author must appear in the game's credits screen. The line is already in `CREDITS.md`;
  add "Dragon by na3ee1 (Poly Pizza)" to the credits screen text.

## Common problems

- Search shows at most ~27 results from Poly Pizza (the 12 best are printed). Nothing good? Try a
  synonym, `--by quaternius`, or the `objaverse` skill.
- `--animated` checks each model page, so it's a few seconds slower.
- Animation names look like `CharacterArmature|Run` or `DragonArmature|Dragon_Flying`;
  `anim.play('run')` finds them (names match loosely). See the `character-animation` skill.
- Many results share a title ("Dragon" three times): always copy the **id**, not the title.
- Poly Pizza has KayKit's Halloween/Restaurant/Space/City bits but not KayKit's characters: use
  `kaykit get adventurers` for those.
