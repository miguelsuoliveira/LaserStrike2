---
name: bug
description: Fix something that is broken - an error box on screen, a black or frozen game, things not appearing, falling through the floor, controls not working, "it doesn't work". Use when kids report a bug or type /bug. Reads the browser log, reproduces with a screenshot, fixes the smallest thing, and teaches the bug-card habit.
---

# Bug hunt

1. **Get the bug card.** If the kids didn't say it already, ask in one line:
   "What did you do? What did you expect? What happened instead?"
2. **Read the evidence** (cheap first):
   - `tail -n 30 logs/browser.log` (errors from their browser, newest last; a `--- game page loaded ---`
     line marks each reload)
   - `npm run check` (code that can't load, missing asset files)
   - Only if still unclear: `npm run snap` (add `--keys "..."` to repeat what they did, `--eval` to print values)
     and look at `.screenshots/snap.png`.
3. **Fix the smallest thing** that explains it. Don't rewrite working code. Don't "fix" by deleting the feature.
4. **Confirm**: `npm run check`, and `npm run snap` if it was visual. Tell them in one or two sentences what
   was wrong, in kid words ("the coins were spawning under the ground, so you couldn't see them").
5. If the second attempt fails too: stop. Suggest `npm run undo` (back to the last save point) or
   `npm run saves` + `npm run load -- <n>`, then try a simpler approach. Call a mentor if it's the engine.

## Common causes in this project

| Symptom | Usual cause |
|---|---|
| Error box: `X is not defined` / `is not exported` | missing import from `'../engine/index.js'` or a typo in a name |
| Error box: `Could not load model "assets/..."` | wrong path; check `public/assets/CATALOG.md` |
| Model invisible | spawned below ground (y < 0), far away, `scale` tiny, or `add: false` |
| Player falls through the world | the ground/level piece has no physics (`physics: false`) or was made with `loadModel` without `physics: 'fixed'` |
| Can walk through a model | add `physics: 'fixed'` to its `loadModel` options (`shape: 'mesh'` for exact shape) |
| Can't walk through a doorway/arch | it uses a box collider: use `shape: 'mesh'` |
| Things happen 60 times | code in `update(dt)` that should run once (use a flag, or move it to `setup`) |
| Game gets slower and slower | creating objects every frame or never removing them (`world.remove`) |
| A number doesn't change when edited in code | the kids moved that slider, so `src/tuning.json` has it and wins: edit or delete it there |
| A slider changes nothing | the value is only read in `setup()` (level layout, counts): reload the page |
| Player/car stuck in the floor | it was placed below y = 0, or the floor has no physics |
| Black screen, no error | `setup()` is still waiting (an `await` that never finishes) or the camera is inside something |
| Animation T-pose / frozen | the clip name doesn't exist (warning in the log lists real names) |
| Sound doesn't play | the browser needs one click/key first; or a wrong file path (log shows it) |

Then encourage them: describing a bug well is a real game maker's skill, and it makes the next fix faster.
