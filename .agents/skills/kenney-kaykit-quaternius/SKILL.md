---
name: kenney-kaykit-quaternius
description: Download whole free CC0 kits of matching low-poly models from Kenney, KayKit and Quaternius (cars, city, castle, dungeon, pirate, space, food, furniture, nature, platformer, monsters) and animated characters with 40-80 animations (knights, mages, skeletons, monsters, mannequin). Use when the kids want a themed world or several pieces that match ("a dungeon", "a race track", "a pirate island", "space base", "enemies that attack"), or a rigged character to play as. Also covers any free itch.io pack.
---

# Kenney, KayKit and Quaternius kits (CC0)

Big sets of models in one style, all CC0. Pieces from the same kit always fit together, so a world built
from one kit looks good fast. Check `public/assets/CATALOG.md` first: some kits are already there.

## Find a kit

```bash
npm run assets -- kenney list                  # 50 Kenney 3D kits; kenney list castle (search), --thumbs for pictures
npm run assets -- kaykit list                  # 22 KayKit packs (GitHub + itch.io)
npm run assets -- quaternius list monster      # 84 Quaternius packs, search by word (needs a word to show details)
```
Good starting kits: Kenney `car-kit`, `castle-kit`, `pirate-kit`, `space-kit`, `nature-kit`,
`platformer-kit`, `food-kit`, `train-kit`, `watercraft-kit`, `blocky-characters`;
KayKit `dungeon-remastered`, `halloween-bits`, `space-base-bits`, `forest`, `platformer`;
Quaternius `ultimatemonsters`, `ultimatespacekit`, `piratekit`, `stylizednaturemegakit`.

## Get only what you need

```bash
npm run assets -- kenney get car-kit                       # big kit: prints the model names, saves nothing
npm run assets -- kenney get car-kit --only "police,taxi"  # saves those two
npm run assets -- kaykit get dungeon-remastered --only "chest_gold,torch_lit,wall"
npm run assets -- quaternius get ultimatemonsters --only "dragon,yeti"
```
- Kits with more than 40 models list their names first (grouped like `wheel_*: dark, racing...`). Pick
  5-15 the game needs with `--only` (an exact name, or a word that is part of names: `--only wall`).
  `--all` takes everything (only when the kids really need it).
- Small kits (40 or fewer) are saved whole.
- Saved to `public/assets/models/<kit>/` (or `--folder models/x`). Only .glb/.gltf are used (FBX, OBJ and
  source files are skipped); textures are packed in. The zip is kept in `.cache/downloads/`, so a second
  `get` from the same kit is instant.

## Characters with animations

- KayKit `adventurers` (knight, mage, rogue, barbarian) and `skeletons`: ~76 animations inside each model,
  same names, so they swap easily. They hold every weapon: hide extras (see `character-animation`).
- Quaternius `ultimatemonsters` and `animatedmonster`, or `pizza search <animal> --by quaternius --animated`:
  cute creatures with walk/run/attack/death.
- `itch get quaternius/universal-animation-library --only ual1_standard`: a mannequin with 43 animations (7 MB).
- Quaternius `universalbasecharacters` have **no** animations; KayKit `character-animations` are separate
  animation rigs, not finished characters. Prefer the ones above.

## Any free itch.io pack

```bash
npm run assets -- itch get kaylousberg/kaykit-forest --only tree
npm run assets -- itch get someone/some-pack --license CC0      # other creators: read their page first
```
Quaternius, KayKit and Kenney are known CC0. For anyone else, open the page, check it says CC0 (or CC-BY)
and pass `--license`. Packs with several files print them: choose with `--file <word>`.

## Licence and credit

All CC0. `get` adds one line per kit folder to `CREDITS.md`. Nothing else to do.

## Common problems

- Older Quaternius packs are only on Google Drive. The tool uses the matching Poly Pizza bundle
  instead; if there's none it says so: use `pizza search <word> --by quaternius`.
- Quaternius itch zips are 15-150 MB: the first download takes a while, then it's cached.
- Paid packs (KayKit "Complete", "Bits Bundle", "Mystery Monthly") are refused: they cost money.
- A pack missing a texture prints "(texture ... is missing in the pack, left out)": the model still works.
- Quaternius animation names look like `CharacterArmature|Run`; `anim.play('run')` still finds them.
- KayKit names end in `_color1` / `_a`: they're color/variant numbers, not different things.
