# AI Game Jam Starter (3D, three.js)

A starter project for a 4-5 hour game jam where kids (12+) with no coding experience build a real 3D
game by talking to an AI coding agent (Claude Code, or Codex). The boring and hard parts are already
done, so the kids spend their time on ideas, design and tuning.

![The example game: a knight in a field with trees, rocks, coins and a campfire](docs/screenshot.jpg)

Out of the box:

- A realistic-looking 3D world: animated sky with clouds and time of day, sun shadows, fog, glow, photo skies.
- A third-person player that walks, runs, jumps, climbs steps and pushes things, with automatic animations.
- Physics (Rapier): things fall, stack, bounce and get knocked over.
- Characters with real collisions for enemies and NPCs, and an arcade car.
- Sliders for every number (press `` ` `` in the game). Slider values save to `src/tuning.json` automatically.
- Title / win / lose screens, HUD text and health bars, made-up sound effects, particles, screen shake.
- 160+ free (CC0) models: 7 animated characters (knight, mage, rogue, barbarian, two skeletons, robot),
  vehicles and race track pieces, dungeon, graveyard, space base, city, nature, realistic props;
  4 photo skies, 12 realistic textures, 19 sounds. See [`public/assets/CATALOG.md`](public/assets/CATALOG.md).
- AI rules ([`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md)) that keep the AI short, kid-friendly,
  safe and cheap, plus skills with tested recipes for common game features.
- Tools for the AI: `npm run snap` lets it *see* the game (headless screenshot + errors), browser errors
  are copied to `logs/browser.log`, and `npm run check` catches broken code in under a second.
- Save points for kids who never used git: `npm run save`, `npm run saves`, `npm run undo`, `npm run load`.

Mentors: read [`MENTORS.md`](MENTORS.md). Print [`docs/PROMPT-CARD.md`](docs/PROMPT-CARD.md) for each team.

## Quick start

You need [Node.js 22 or newer](https://nodejs.org), [Git](https://git-scm.com) and Google Chrome.

```bash
git clone <this repo> my-game
cd my-game
npm install
npm run dev
```

The game opens in the browser. In a second terminal, in the same folder, start the AI:

```bash
claude
```

Then ask for something, for example: *"Let's make our own game. Use the idea skill to ask us questions first."*

## Controls in the example game

| Key | Does |
|---|---|
| W A S D or arrows | move |
| Shift | run |
| Space | jump |
| Mouse | look around (click the game to lock the mouse, Esc to unlock) |
| `` ` `` (backquote) | show or hide the sliders |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | start the game (keep it running; it reloads by itself) |
| `npm run save -- "what works now"` | make a save point |
| `npm run saves` | list save points |
| `npm run undo` | throw away changes since the last save point (they're kept in a backup) |
| `npm run load -- 3` | go back to save point #3 |
| `npm run check` | quick check that the code loads |
| `npm run snap` | screenshot of the game + any errors (the AI uses this to see) |
| `npm run inspect -- <file.glb>` | size, parts, bones and animation names of a model |
| `npm run assets -- search rock` | search free realistic models, skies and textures (Poly Haven) |
| `npm run build` | make a `dist/` folder you can upload anywhere (itch.io, Netlify, GitHub Pages) |

## Slash commands for the kids (Claude Code)

- `/idea` plan a game or a big feature together (the AI asks questions first)
- `/explain` explain the last change like you're 12, plus a Code Detective challenge
- `/bug` fix something that's broken

## Project layout

```
src/game/          the kids' game (game.js is the example "Coin Rush")
src/tuning.json    slider values (saved automatically)
src/engine/        the engine (world, physics, player, cars, UI, sound, effects)
public/assets/     models, skies, textures, sounds + CATALOG.md and CREDITS.md
.claude/skills/    guides the AI reads: game-recipes, character-animation, free-assets, game-feel, make-it-ours, idea, explain, bug
scripts/           check, snap, save points, model inspector, asset downloader
```

## Using Codex or another agent

`AGENTS.md` holds all the rules and the engine reference, and tells the agent where the skills are.
Claude Code reads it through `CLAUDE.md`. Other agents that read `AGENTS.md` work the same way.

## Credits and license

Code: MIT (see [`LICENSE`](LICENSE)). Assets: CC0 (public domain) from KayKit (Kay Lousberg), Kenney,
Quaternius and Poly Haven; full list in [`public/assets/CREDITS.md`](public/assets/CREDITS.md).
Built with [three.js](https://threejs.org), [Rapier](https://rapier.rs), [lil-gui](https://lil-gui.georgealways.com) and [Vite](https://vite.dev).
