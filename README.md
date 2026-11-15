# AI Game Jam Starter (3D, three.js)

A starter project for a 4-5 hour game jam where kids (12+) with no coding experience build a real 3D
game by talking to an AI coding agent (Claude Code, or Codex). The boring and hard parts are already
done, so the kids spend their time on ideas, design and tuning.

The game starts with an empty world. The AI guides each team through four choices
(**Player** + view, **World**, **Goal**, **Twist**), builds a playable first draft after each one, and keeps
the team's plan and checklist in [`our-game.md`](our-game.md). It shows pictures before building (the kids'
paper sketches or gpt-image-2.6) and downloads models on demand from Kenney, KayKit, Quaternius, Poly Pizza,
Poly Haven, the Smithsonian and Objaverse (800,000 models).

![What the engine can do: a knight in a field with trees, rocks, coins and a campfire (an earlier example game)](docs/screenshot.jpg)

Out of the box:

- A realistic-looking 3D world: animated sky with clouds and time of day, sun shadows, fog, glow, photo skies.
- A third-person player that walks, runs, jumps, climbs steps and pushes things, with automatic animations.
- Physics (Rapier): things fall, stack, bounce and get knocked over. Colliders fit each model (exact for scenery),
  a collider view (`npm run snap -- --colliders`) shows them with a "forward" arrow on characters and cars, and
  physics checks warn about things that start inside each other, fall through the floor or face sideways.
- Characters with real collisions for enemies and NPCs, and an arcade car.
- Sliders for every number (press `` ` `` in the game). Slider values save to `src/tuning.json` automatically.
- Title / win / lose screens, HUD text and health bars, made-up sound effects, particles, screen shake.
- 140+ free (CC0) models: 6 animated characters (mage, rogue, barbarian, two skeletons, robot),
  vehicles and race track pieces, dungeon, graveyard, space base, city, rocks, realistic props (no knight and no
  trees on purpose: the AI shows the kids pictures of real choices from the libraries instead);
  4 photo skies, 12 realistic textures, 19 sounds. See [`public/assets/CATALOG.md`](public/assets/CATALOG.md).
- AI rules ([`AGENTS.md`](AGENTS.md), read by Codex and, through [`CLAUDE.md`](CLAUDE.md), Claude Code) that keep
  the AI short, kid-friendly, safe and cheap, plus skills (plain Markdown in [`.agents/skills/`](.agents/skills))
  with tested recipes for game features, model downloads and model remixing.
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

(or `codex`). Then just say hi: *"Hi! We're ready to make our game."* The AI asks the first choice.

Optional: copy `.env.example` to `.env` and add an `OPENAI_API_KEY` for picture previews (gpt-image-2.6).

## Controls

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
| `npm run assets -- ...` | search and download free models (Kenney, KayKit, Quaternius, Poly Pizza, Poly Haven, Smithsonian, Objaverse); see the skills |
| `npm run remix -- ...` | change a model file: color, parts, size, animations |
| `npm run preview -- "..."` | show a picture on the game screen (a sketch photo, or one drawn by the image AI) |
| `npm run build` | make a `dist/` folder you can upload anywhere (itch.io, Netlify, GitHub Pages) |

## Commands for the kids (`/idea` in Claude Code, `$idea` in Codex)

- `/idea` plan a game or a big feature together (the AI asks questions first)
- `/explain` explain the last change like you're 12, plus a Code Detective challenge
- `/bug` fix something that's broken

## Project layout

```
our-game.md        the team's 4 choices and checklist (the AI keeps it updated)
src/game/          the kids' game (starts as an empty world)
src/tuning.json    slider values (saved automatically)
src/engine/        the engine (world, physics, player, cars, UI, sound, effects)
public/assets/     models, skies, textures, sounds + CATALOG.md and CREDITS.md
.agents/skills/    guides the AI reads (Codex reads them here; npm install links them to .claude/skills for Claude Code)
scripts/           check, snap, save points, model inspector, asset downloader, remix, preview
```

## Using Codex or another agent

`AGENTS.md` holds all the rules (`ENGINE.md` the engine reference), and lists the skills in `.agents/skills/`, which is
where Codex looks for repo skills. Claude Code reads `AGENTS.md` through `CLAUDE.md`.

For Codex, trust this folder when it asks: `.codex/config.toml` then lets commands use the internet (model
downloads and picture previews need it). Without trust, start it with
`codex --config sandbox_workspace_write.network_access=true`.

## Credits and license

Code: MIT (see [`LICENSE`](LICENSE)). Assets: CC0 (public domain) from KayKit (Kay Lousberg), Kenney,
Quaternius and Poly Haven; full list in [`public/assets/CREDITS.md`](public/assets/CREDITS.md).
Built with [three.js](https://threejs.org), [Rapier](https://rapier.rs), [lil-gui](https://lil-gui.georgealways.com) and [Vite](https://vite.dev).
