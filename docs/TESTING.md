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

## guided-start branch (Nov 14, 2026)

Tested on macOS with Node 26 before the first kid test:
- Empty start: `npm run check`, `npm run snap` (no errors, 8 objects) and `npm run build` pass.
- Pictures: `npm run preview` with a mocked image API (gpt-image-2.6 first, falls back to the next model if a key
  can't use it), sketch-to-picture with `--from` (multipart upload), phone photos (huge, rotated, HEIC) and
  numbered multi-picture display on the game screen. A real gpt-image-2.6 call still needs a key in `.env`.
- Downloads: every source did a real search, a real `get` and loaded in the engine (35 models):
  Poly Pizza, Kenney (`--only`), KayKit (GitHub and itch.io), Quaternius (Poly Pizza bundles and itch.io,
  including the 122 MB Universal Base Characters), Smithsonian (Draco decoded, rotated upright, licence checked
  against Open Access), Objaverse (web and LOD tiers), Poly Haven.
- Remix: every op on bundled KayKit/Kenney models, a Smithsonian scan and an Objaverse model; all 18 outputs
  loaded and animated in the engine.

Known limits: 71 of 84 Quaternius pack pages only link Google Drive (single models still come through Poly
Pizza); Smithsonian licence checks use the shared DEMO_KEY (about 10 per hour per network) unless a mentor adds
`SI_API_KEY`; Poly Pizza search sees the first ~27 results; Objaverse is mostly CC-BY (credits are written
automatically); copying animations needs matching bone names.

## Prompt tests: Codex (gpt-6-astra, low) vs Claude Sonnet (low), Nov 14, 2026

The same 6 kid messages (a first-person beach shooter where birds shoot back, made "super realistic", with
weather, shelters, poop, crates, falling birds, ammo and waves) were replayed on fresh copies of this branch.

- Astra low followed the rules from the start: picture first, asked how you win, short kid replies, connected
  options; it built shelters and guns from shapes.
- Sonnet needed changes: it skipped the skills, built everything from boxes, chose the goal itself and wrote
  developer reports. Fixed by a 7-step "every message" checklist at the top of AGENTS.md, an example kid reply,
  "build by the second reply", "never re-offer a skipped option", and test helpers that actually work
  (`game.module()`, `cameraRig.aimAt()`; a plain `import()` of a game file loaded an empty second copy).
- Final Sonnet low run (`claude -p` with plain user turns): kid-style replies, picture + win/lose question,
  playable on the second reply, real models for guns, gulls, palms and umbrellas, all 6 features working;
  about 8 minutes and $1.24 at API prices for the 6 messages.
- Test message delivery matters: messages forwarded between Claude Desktop sessions arrive as "another session's
  request" and push the model into developer-report style. Use `claude -p --resume` for prompt tests.

## Codex models with the phone rule (Nov 14, 2026)

Same 6 messages, Codex CLI 0.166 (`codex exec` + `exec resume`), low effort, fresh worktrees at 2d7fb3e.
Results are online at https://kids-ai-game-jam-test.netlify.app (with the Sonnet run for comparison).

| | Astra | Sol | Luna |
|---|---|---|---|
| Time for 6 messages | 20 min | 13 min | 17 min |
| First playable | message 3 | message 3 | message 5 |
| Phone buttons | switch, fire | 1-4, fire | gun names, fire |
| New models | 9 | 2 | 3 |
| Notes | most creative, connected options | plain replies, repeated "name the game" | asked two questions at once, wordy HUD |

All three Codex models showed a second picture for "make it realistic" instead of building (Sonnet built on
message 2). Upright phones misplaced first-person guns: the engine now asks players to turn the phone sideways.

### Lessons from the beach test (Nov 14, 2026)

- **The beach test was biased.** The example reply in AGENTS.md described the same game (gulls pooping, hiding
  under umbrellas, palm trees or a beach hut, crates washing ashore), and kid message 5 was an option an earlier
  AI had suggested. Every model copied those ideas. The example is now from an unrelated game, and the example
  game mixes no longer mention kitchens or meatballs. Never put a test scenario in the prompt or skills.
- **Counting cost:** `claude -p --resume` reports `total_cost_usd` and `modelUsage` for the whole session so far,
  and Codex's `turn.completed` usage is also a running total. Use the last turn, or price each request from the
  logs: `~/.claude/projects/<folder>/<session>.jsonl` (`message.usage`, one entry per `message.id`) and
  `~/.codex/sessions/**/rollout-*-<thread>.jsonl` (`token_count` events, `last_token_usage`).
- **Keep the game open in a browser** during tests (one tab per dev server). Without it `npm run preview`
  opens pictures in the computer's picture viewer instead of on the game screen.

## Unbiased test: tiny tanks on a kitchen table (Nov 14, 2026)

Six kid messages written before any AI replied (message 4 is "1", which picks that AI's ⭐ option), fresh
worktrees at f15fa4a, low effort unless noted, one message at a time (`claude -p --resume`, `codex exec resume`),
the game open in a browser. API prices are list prices, counted request by request (Haiku 5.5 requests over 100k
prompt tokens use its higher price card).

1. tiny tank fight with bot tanks on a kitchen table top, you can fall off the table, lots of dishes and other
   stuff and greasy bits, you shoot meatballs at the other tanks and squeeze ketchup out, view from behind
2. yes make it look like a real kitchen, you win when all the bot tanks fall off and you lose if you fall off
3. the ketchup should make them slip off the table and i want a big pile of meatballs you drive over to get more
4. 1
5. can the bot tanks be different colors
6. i want more levels like the kitchen counter and the fridge and the sink

| AI | Time | API price | Requests | Tokens in: cached + new · out | Playable | New models | Notes |
|---|---|---|---|---|---|---|---|
| Claude Fable 5.2 | 12 min | $4.77 | 46 | 4.90M + 128k · 44k | msg 2 | 18 | best game: tank models to pick, bots race to the pile, counter level |
| Claude Opus 5.5 | 12 min | $2.50 | 61 | 5.25M + 93k · 35k | msg 2 | 10 | nearly as good at half the price; built 3 levels |
| Claude Sonnet 5.5 | 8 min | $0.94 | 44 | 3.73M + 82k · 24k | msg 2 | 9 | solid; repeated a twist question; levels as a picture |
| Claude Haiku 5.5 medium | 12 min | $0.72 | 77 | 10.2M + 163k · 84k | msg 2 | 6 | OK; wordy HUD, 4 numbered options |
| Claude Haiku 5.5 low | 11 min | $0.37 | 65 | 6.56M + 114k · 50k | msg 2 | 4 | weak look (see-through tanks, no kitchen), no fire button on phones |
| Codex gpt-6.1-sol | 12 min | $0.87 | 56 | 4.65M + 110k · 19k | msg 2 | 7 | answered "1" and "more levels" with pictures only |
| Codex gpt-6.1-terra | 6 min | $0.28 | 47 | 3.03M + 74k · 11k | msg 2 | 4 | fast, cheap, decent; "Your game is saved" filler |
| Codex gpt-6-luna | 11 min | $0.08 | 85 | 5.62M + 105k · 25k | msg 1 | 4 | weakest: no picture, never asked how to win, tiny options |

Prices per million tokens used: Fable 5.2 $8 in / $16 1h cache write / $0.20 cache read / $40 out; Opus 5.5
$4 / $8 / $0.20 / $20; Sonnet 5.5 $2 / $4 / $0.10 / $10; Haiku 5.5 $0.10 / $0.20 / $0.01 / $0.50 (prompts over
100k: $0.50 / $1 / $0.05 / $2.50); gpt-6.1-sol $2 / cached $0.10 / out $10; gpt-6.1-terra $1 / $0.05 / $5;
gpt-6-luna $0.10 / $0.01 / $0.50. No Codex request went over the 272k long-context limit.

Beach test, same method (prompt still had the beach example): Astra $11.31 (20 min), gpt-6-sol $2.05 (13 min),
gpt-6.1-sol $1.12 (15 min), Luna $0.12 (17 min), Sonnet 5.5 $1.24 (8 min), Haiku 5.5 low $0.63 (12 min),
Haiku 5.5 medium $1.02 (15 min).

Every model except Luna showed a picture first and was playable by message 2. "More levels" mostly got a picture
first (the "new look → picture" rule); only Opus and Fable built a level in that turn. Engine follow-up: when a
game adds 4+ touch buttons they wrap to two rows and cover the bottom-right HUD text.

Results and screenshots: https://kids-ai-game-jam-test.netlify.app
