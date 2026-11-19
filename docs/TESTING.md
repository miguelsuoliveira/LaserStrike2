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

## Physics fixes and model checks (Nov 15, 2026)

Problems seen in the kitchen-tank games: tanks flying into the air after driving over plates, things stuck
inside other models, models driving or shooting sideways, colliders much bigger than the model. Changes:

- **Tanks and cars flying:** stepping up onto a plate or kerb (autostep, 25 cm in one physics step) counted as
  driving up a ramp, so leaving the plate launched the car at up to 15 m/s. Climb speed is now smoothed and capped
  (`speed × 0.85`), so only real ramps launch; `ramps: false` never jumps. Test: plate 0.24 m max height
  (was several meters), 15° ramp still jumps to 2.2 m.
- **Colliders fit models:** fixed models get their exact shape (trimesh with internal-edge fix: walk through
  doorways, under tables, up stairs), moving models a convex hull, `box()`/`ball()`/`cylinder()` their own shape,
  sensors a box, hidden parts nothing. Before, every model was a box around everything.
- **Collider view:** `npm run snap -- --colliders` (slider Physics > showColliders): green = scenery, blue =
  moving, pink = sensors, yellow arrow = where a character or vehicle thinks forward is.
- **Physics checks** (warnings in snap and `logs/browser.log`): two things starting inside each other, something
  falling through the world right after it appears, a character or car created inside something (lifted out),
  a vehicle model wider than long (probably sideways).
- **Enemies:** `walkTo` follows walls around obstacles (picks one side and keeps it), climbs stairs instead of
  avoiding them, and sidesteps when stuck. No maze solving yet (a navmesh would be next).
- Small dynamic things get CCD; `material: 'ice' | 'grease' | 'rubber' | ...`; `box({ opacity: 0 })` is an
  invisible solid (walls, a ramp over steep stairs).
- Known limit: characters (capsule radius ~0.4 m) can't climb steep model stairs (30 cm steps, 30 cm deep);
  20 cm × 60 cm stairs work. Use an invisible ramp.
- Prompt: step 7 "check every new model once with `--colliders`: front arrow, collider, size, no warnings".
- Bug found by the castle test and fixed (7bb2ba5): the stuck check also ran on `teleport()`, which games use to
  move climbing zombies up ladders, so zombies popped onto the wall. It now runs only when something is created.

**Objaverse:** `npm run assets -- objaverse search <words>` now searches all 800,000 Objaverse 1.0 models
(Sketchfab's public search, kept if the model is in `allenai/objaverse` and CC0/CC-BY, not age-restricted, no
known brands), downloads the .glb from Hugging Face and shrinks anything over 5 MB or 60k triangles.
`--checked` keeps the old 6,000-model set. About half to three quarters of Sketchfab's hits are in Objaverse.

## Test 3: knight defends a high castle (Nov 15, 2026)

Same method as the kitchen test, fresh worktrees at 6d156c7, each game open in a hidden Chrome page (instead of
browser tabs), low effort. Fable 5.2 left out (too expensive); Haiku 5.5 and GPT-6 Luna dropped (Luna took over
30 minutes for 5 messages).

1. knight third person in a high castle with a sword or a bow, and waves of zombies attack the castle with ladders
   and other stuff
2. yes make it look like a real castle, you win if you survive 10 waves and you lose if the zombies get in and get you
3. i want fire arrows to set them on fire, and you have to run down to get more arrows and supplies
4. 1
5. can we push the ladders off the walls
6. add more medieval weapons like a catapult and boiling oil and a crossbow

| AI | Time | API price | Requests | Tokens in: cached + new · out | Collider checks | Notes |
|---|---|---|---|---|---|---|
| Claude Opus 5.5 | 14 min | $2.92 | 61 | 6.08M + 113k · 40k | 19 | best game: every request built and tested, asked about the twist |
| Codex gpt-6.1-sol | 17 min | $1.23 | 80 | 7.52M + 113k · 26k | 38 | built everything incl. the catapult; "tested and saved!" filler |
| Claude Sonnet 5.5 | 13 min | $1.58 | 66 | 6.73M + 115k · 45k | 15 | all weapons; marked the Twist itself; starts facing a tower wall |
| Codex gpt-6.1-terra | 11 min | $0.72 | 106 | 10.0M + 130k · 18k | 18 | catapult only as pictures; plain look |
| (dropped) Haiku 5.5 medium | 25 min | $1.73 | 151 | 25.5M + 248k · 152k | 15 | 130 of 151 requests over 100k tokens |
| (dropped) Haiku 5.5 low | 9 min | $0.37 | 57 | 5.88M + 122k · 51k | 9 | same options 4 times; game over in 12 s |

All four were playable by message 2, used the collider view, and showed no physics warnings at the end. Every AI
picked Poly Pizza models (mostly the same zombie) and the bundled knight; nobody offered the kids a choice of
knight or used Objaverse, although Poly Pizza has 12 knights and Objaverse at least 12 animated ones.

Results and screenshots: https://kids-ai-game-jam-test.netlify.app

## Phones never zoom (Nov 15, 2026)

On an iPhone the games could zoom in (Safari ignores `user-scalable=no`), and on Netlify the "Powered by Netlify"
badge (bottom-right corner, on by default for new free projects; Project configuration > General) covered the
touch buttons. The engine now stops pinch and double-tap zoom and iPhone's landscape text enlarging, resets a page
that got zoomed anyway, keeps the bottom-right corner empty (buttons sit above it, at most 3 per row, so 4+ buttons
no longer cover the HUD), and moves bottom-right HUD text to the top right on phones. Games already on the test
site got the same fix as a small patch in their page.

## Test 3a: castle again with GPT-6.1 Sol, no bundled knight or trees (Nov 15, 2026)

The knight and all bundled trees were removed (0c70f68) because every test-3 game used them. Same six messages,
fresh worktree at 6597b77.

| AI | Time | API price | Requests | Tokens in: cached + new · out | Collider checks |
|---|---|---|---|---|---|
| Codex gpt-6.1-sol low | 26 min | $1.77 | 88 | 10.4M + 161k · 40k | 29 |

It built every request (fire arrows, supply runs, traps built from supply kits, ladder pushing, catapult, oil,
crossbow), but it got the knight by downloading the whole KayKit adventurers pack, the same knight that used to be
bundled, and never showed the kids a choice of knights. Removing defaults alone doesn't make the AI offer choices.

## How to run a test (since Nov 16, 2026)

Don't point a test agent at your working copy of this repo: its save points are git commits, and its game,
downloads and plan land in your tree. Instead:

1. `node scripts/test-run.mjs new codex-low` makes a fresh copy next to the repo (your uncommitted changes
   included, no `node_modules`, so the agent's own setup is part of the test).
2. Open that folder with the agent and write like the kids would, one message at a time.
3. `node scripts/test-run.mjs collect codex-low` gathers the transcript (Codex session logs),
   `our-game.md`, the game code, logs, screenshots, pictures and save points into `.tmp-review/codex-low/`.

## Public link (Nov 19, 2026)

Tested on Linux arm64 (Node 22, cloudflared 2026.11.1) with real Quick Tunnels; not yet on macOS or Windows.

- Fresh copy: `npm run setup` installed, started the game, downloaded cloudflared, and printed a link only after
  fetching `/__id` through it. A new link took 8-32 s; a second `setup`, `share` or `save` reused it in under 1 s.
- A phone-sized browser opened the link (game ready in 4.8 s, 44 requests, none failed); a file edit reached that
  page by hot reload in about a second, with no build.
- Killed the tunnel: the next `npm run save` noticed, started a new one and reported the link as NEW (8 s).
- Through the link, `.env`, `.git`, `logs/`, `/@fs/` and the dev tools (`/__project`, `/__preview`,
  `/__open-in-editor`) answer 404; slider saves and log lines from visitors are dropped.
- `scripts/bootstrap.sh` with no Node.js on the PATH: Node 22 into `.tools/node`, then the normal setup.
  `scripts/bootstrap.ps1` is untested.

Two traps found: cloudflared only dials `127.0.0.1`, so the tunnel is pointed at whichever loopback address the
game answers on; and a new link's name appears up to 26 s after the tunnel connects, while looking it up too early
makes resolvers remember "no such name" for 60 s. The tools now ask Cloudflare's name servers directly until the
name exists, and only then fetch the game through it.

## Codex-only, and getting ready for Windows (Nov 19, 2026)

The Claude Code files (CLAUDE.md, hooks, skill links) are gone; `npm run status` now does what the per-message
hook did. Checked on Linux arm64 with a fresh copy: the first `npm run status` installed, started the game and
printed a checked link; later calls took 0.3 s; `npm run save` without Git on the PATH explained itself and
still printed the link; a killed tunnel came back as "NEW ... tell your host"; check and snap passed.

Found by reading, not by running: five scripts built the project path from `new URL(import.meta.url).pathname`,
which gives `\C:\Users\...` on Windows and `%20` for spaces in folder names on every system. They use
`fileURLToPath` now.

**Not run on Windows yet. What to check there** (fresh folder from the ZIP, ideally a laptop without Node.js and Git):

1. Double-click `setup.cmd`: Node.js lands in `.tools\node`, Git in `.tools\git`, the engine installs, the game
   opens in the browser, a link is printed, and the link opens on a phone.
2. Open the folder in Codex and say hi: it runs `npm run status` (or `npm.cmd run status`), and its reply ends
   with the link line. No setup talk.
3. After Codex's command has returned, the game and the link are still up (the background processes survive).
4. Ask for one small change: the page behind the link updates by itself; `npm run save` prints "Saved" and the link.
5. Leave the laptop alone past its sleep time: it stays awake (a hidden `powershell` process keeps it so).
6. Let it sleep on purpose (close the lid a minute): the next reply says "New link! Tell your host".
7. `npm.cmd run snap` prints "No errors." (it uses Edge when there is no Chrome).
8. A folder name with a space ("My Game") works.

When something fails, `logs\dev-server.log` and `logs\tunnel.log` say why.
