# Mentor guide

Everything a mentor needs before and during the jam. Kids never need to read this.

## The week before

1. **Accounts and money**
   - Claude Code needs either a Claude account or an Anthropic API key. Claude accounts are for adults (18+)
     and are per person, so don't share one across kids. For a kids' event, use an organization API account
     and check with Anthropic that your setup is OK for under-18s. Ask about event credits at the same time.
   - In the Claude Console create **one workspace per team** with its own monthly spend limit, and one API key
     per workspace. Buy credits a week early: new accounts start on low usage tiers with low rate limits, and
     8 agents running at once can hit them.
   - Pick the model in `.claude/settings.json` (`"model": "opus"` = the latest Opus, at medium effort by default).
     Don't use max effort or the most expensive model at a jam.
2. **Calibrate the cost.** One mentor builds a small game with this starter for one hour, then reads the
   status line (it shows money spent in the session). Multiply by teams and hours. Our rough estimate was
   $15-40 per team for ~3 hours of building; measure your own.
3. **Prepare every laptop** (one per team, plus one spare):
   - Install Node.js 22 LTS or newer, Git, Google Chrome, and Claude Code (or Codex).
     Windows: Claude Code needs Git for Windows.
   - Clone the repo into a folder named after the team, run `npm install` (needs internet; about 100 MB).
   - Picture previews: copy `.env.example` to `.env` and add an `OPENAI_API_KEY` (the image AI is gpt-image-2.6,
     a few cents per picture; set a monthly limit on that key). Without a key, the AI uses the kids' paper
     sketches (phone photos) and simple sketches it draws itself.
   - Run `npm run dev` (the game opens), `npm run snap` (should print "No errors."), and `claude` or `codex`
     (log in with the team's key, then ask "what can you do in this project?").
   - Codex: trust the folder when asked, so `.codex/config.toml` lets commands reach the internet (downloads,
     previews). Codex reads `AGENTS.md` and the skills in `.agents/skills/`; kids type `$idea` instead of `/idea`.
   - Leave the game and Claude Code open in two windows side by side.
4. **Test day**: run all laptops at once on the event Wi-Fi, each asking the AI for one feature. Bring a
   phone hotspot as backup.
5. **Optional**: download extra asset packs you expect kids to ask for (Kenney zips, see
   `.agents/skills/free-assets/SKILL.md`), so nobody waits on downloads during the jam.

## During the jam

- **How a team starts:** the world is empty. The AI asks four choices one at a time (Player + view, World, Goal,
  Twist), builds a playable draft after each, and keeps the plan and checklist in `our-game.md`. Every reply ends
  with the progress line and 2-3 numbered options, so kids can answer "2".
- **Big picture:** kids tend to ask for one small thing at a time. The AI is told to read between the lines, offer
  the bigger version of what they seem to want, and keep every new part (shop, room, loot, mini-game) connected
  in a "game map" in `our-game.md`. If a team's game turns into a pile of unconnected pieces, ask them what game
  it should feel like and let the AI suggest how to tie it together.
- **One player only:** no multiplayer, online or on one keyboard.
- **Paper first:** give each team paper and pens. A sketch photographed with a phone (AirDrop/email into
  `public/assets/images/`) becomes a preview picture, a texture or a model idea.

- **Save points** are the safety net. Remind teams to `npm run save -- "..."` every time something works.
  - `npm run undo` throws away changes since the last save (kept in `git stash list` as a backup).
  - `npm run saves` then `npm run load -- <n>` goes back further. Newer saves stay in the list.
  - Recover an undone change: `git stash list`, then `git stash apply stash@{0}`.
- **Sliders** (`` ` `` in the game) change numbers instantly and cost nothing. Push kids to tune instead of prompting.
- **The AI is stuck** (same error twice, going in circles): `npm run undo`, start a fresh conversation
  (`/clear` in Claude Code), and ask for a smaller step. Use the `/bug` command for bugs.
- **Model Lab station** (optional, mentor-operated): turn a kid's drawing into a 3D model with an AI model
  generator (Meshy, Tripo), download as GLB, drop it in `public/assets/models/<folder>/`, run
  `npm run assets -- catalog`. See `.agents/skills/character-animation/SKILL.md` section 6.
- **Feature freeze** 20 minutes before demos: only bug fixes and slider tuning after that.
- **Demo**: `npm run dev` is fine. Add `?demo` to the URL to hide the slider button.

## Where things are

| Need | Look at |
|---|---|
| What the AI is told | `AGENTS.md` (rules + engine reference), `CLAUDE.md` |
| Recipes the AI follows | `.agents/skills/*/SKILL.md`, `.agents/skills/game-recipes/recipes/*.md` |
| The team's plan | `our-game.md` |
| What models exist | `public/assets/CATALOG.md` (`npm run assets -- catalog` rebuilds it) |
| Errors from the game | `logs/browser.log` and the red box in the game |
| Slider values | `src/tuning.json` holds only sliders people moved; "↺ Reset to code values" in a slider folder (or deleting its lines) undoes them |
| Permissions and hooks | `.claude/settings.json`: edits are auto-accepted; `npm install`, `git push`, `rm -rf` are blocked |

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` says the port is in use | another game is running: close the other terminal, or use the URL it prints |
| Black screen, no error | wait for loading; check `logs/browser.log`; try the "Graphics > quality: low" slider |
| Slow on an old laptop | slider Graphics > quality = low, fewer enemies, smaller `ground` size |
| `npm run snap` can't find Chrome | install Google Chrome (or Microsoft Edge on Windows) |
| Sound doesn't play | click the game once (browsers block sound until you interact) |
| Model looks wrong (huge, sideways, floating) | `npm run inspect -- public/assets/...glb`, then use `height`, `turn`, `hide` options |
| Rate-limit or "overloaded" errors from the AI | wait a minute; check the team's workspace limits; stagger big requests between teams |
| The team wants to share the game | `npm run build`, then upload the `dist/` folder to itch.io (HTML game) or Netlify Drop |

## Rebuilding the asset pack

`node scripts/build-starter-pack.mjs` downloads every starter asset again from KayKit (GitHub),
Kenney (GitHub starter kits) and Poly Haven, and rebuilds `CATALOG.md` and `CREDITS.md`.
