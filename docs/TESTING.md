# How this starter was tested

Before release, four AI agents each played "the kids' AI" on a fresh copy of the starter. Each one
followed `AGENTS.md` and the skills, built a game from 7 kid-style requests, verified every step with
`npm run check` / `npm run snap`, and reported every problem. All four games were finished.

| Game | Requests | Worked first time |
|---|---|---|
| Graveyard survival (knight, skeleton waves, sword, torch, juice) | 7 | 7 (torch in hand was slow) |
| Lava tower climb (platforms, rising lava, checkpoints, jump pads, best time) | 7 | 6 (moving platforms didn't carry the player) |
| Desert kart race (track, laps, 2 computer cars, boost pads, logo) | 7 | 6 (the car barely moved: blocker) |
| Top-down blob arena (own creature, drones, mouse aiming, power-ups) | 7 | 6 (asset search crashed) |

Each run used about 190-230k tokens for 7 features, including far more screenshots and engine
investigation than a normal session needs.

## What came up, and what changed

**Engine bugs fixed**
- Cars could sink into the ground on the first frame and then barely move; ramps didn't launch;
  drifting depended on frame rate. (Car collider, spawn lift, ramp launch, per-second drift.)
- Characters started exactly touching the floor and could slowly sink through it. (Spawn lift.)
- Moving (kinematic) platforms didn't carry the player. They do now, including lifts and spinners.
- On 120/144 Hz screens characters and cars would have moved at about half speed. They now move
  inside the fixed 60 Hz physics step.
- `npm run assets -- search` crashed.

**Common traps fixed**
- Slider values used to be saved for every slider on first run, so changing a number in code
  silently did nothing (all four agents hit this). Now only sliders a person moved are saved.
- three.js removes dots from bone names (`handslot.r` → `handslotr`), so hand-attach code failed.
  Added `attach(character, item, { to: 'left hand', upright: true })`; `npm run inspect` prints real names.
- Big glowing surfaces (lava) and the bright sky washed the screen white; colors looked pale; nights
  were nearly black. Lighting, glow and night were retuned (`glowStrength` option for big glowing areas).
- `npm run snap` couldn't test mouse games or setups: added mouse steps, `--set` (slider values for one
  run, never saved), `--before` (run code first), `--zoom`, async `--eval`, and a `--title` fix.
- Missing import of an engine helper only crashed at runtime: `npm run check` now reports it.

**New features from the reports**
- `createPlayer({ model: <your own THREE object> })` for creatures built from shapes.
- `world.setSky('space')` (Poly Haven has no space skies), `seedRandom()` for repeatable layouts,
  `fallGravity` and `shortHop` sliders for less floaty jumps, `topDownAngle` camera slider,
  `ui.title({ image })` for the kids' logo, `car.maxSpeed` / `car.boosting`, a real sand texture.
- Ready-to-copy `race-track.js` and `rivals.js` in the game-recipes skill.
- About 20 recipe fixes (waves skipping rounds, stacking power-ups, melee auto-aim, shared bullet
  meshes, complete flying-enemy module, lava vs checkpoints, best-time scores, and more).

## Known limits

- Jumping off a moving platform doesn't keep the platform's speed.
- On high-refresh screens characters move at 60 steps per second (correct speed, slightly less smooth).
- The sky is barely visible in top-down games; photo skies (HDRI) can look hazy at sunset.
- Kenney zips, Mixamo and AI model generators need a mentor with a browser and accounts.
- A full 3-lap race (~90 s) is too long to check with one screenshot; use `--set` / `--before` to test parts.
