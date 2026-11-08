---
name: game-recipes
description: Tested code patterns for common game features in this engine. Read before building any gameplay feature - collectibles, enemies that chase or patrol, health and damage, shooting, timers and score, waves, levels and obstacle courses, moving platforms, doors and keys, checkpoints, vehicles (cars, boats, planes, spaceships), top-down or side-scroller views, power-ups, talking characters, menus and high scores.
---

# Game recipes

Pick the recipe that matches the request and read only that file. Copy the pattern, then adapt
names, models and numbers to the kids' idea. Every recipe puts its numbers on `tune()` sliders.

| Kids want... | Read |
|---|---|
| coins, gems, stars, power-ups, pick up / collect / inventory | `recipes/collectibles.md` |
| enemies, monsters, zombies, animals that chase, patrol, attack; waves; bosses | `recipes/enemies.md` |
| health, lives, damage, hearts, game over, respawn | `recipes/health.md` |
| shoot, throw, spells, bullets, arrows, swords (melee) | `recipes/combat.md` |
| level, obstacle course, platforms, lava, traps, moving platforms, jump pads, checkpoints, doors, keys, buttons, mazes | `recipes/levels.md` |
| car, kart, racing, laps, boat, plane, spaceship, flying, riding | `recipes/vehicles.md` (+ ready-made `code/race-track.js`, `code/rivals.js`) |
| top-down, side view (2.5D), first person, switch camera, minimap | `recipes/views.md` |
| title screen, win/lose, levels/rounds, timer, score, high score, pause, difficulty | `recipes/game-flow.md` |
| talk to characters, quests, signs, "press E" | `recipes/talking.md` |

## Ground rules for every feature

1. Smallest version first: one enemy before a wave, one coin before 50.
2. Put new systems in their own file in `src/game/` (`enemies.js`, `level.js`) with `export` functions,
   and call them from `game.js` `setup()` / `update(dt)`.
3. Numbers go on sliders: `const E = tune('Enemies', { speed: 2 })`.
4. Things that disappear: `world.remove(obj)` (or `character.remove()` for characters) and take them out of your array.
5. Loop over a copy when removing while looping: `for (const e of [...enemies])`.
6. Snippets use helpers without always showing the import: import everything you use from
   `'../engine/index.js'` (`npm run check` names any missing one).
7. `npm run check` after editing. `npm run snap` when you need to see it.
8. Don't load models inside `update()`. Load in `setup()` or in an async spawn function, and only spawn
   when below a maximum count.
