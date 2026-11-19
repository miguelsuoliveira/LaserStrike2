# Mentor guide

Everything a mentor needs before and during the jam. Kids never need to read this.

## The week before

1. **Accounts and money**
   - Every team needs Codex signed in on its laptop (a ChatGPT account with Codex, or an API key). Check OpenAI's
     terms for under-18s and get parents' consent where needed; don't share one personal account across teams.
   - Set a spend limit per team where you can, and top up early: eight agents working at once can run into
     rate limits on a new account.
   - **Pick the model and the effort before the day** (`/model` in Codex) and use the same on every laptop. In our
     tests (`docs/TESTING.md`, Nov 14) the same six kid messages took between 6 and 20 minutes and cost between
     $0.08 and $11 depending on the model; the building windows at the jam are 50 minutes, so speed matters.
2. **Calibrate the cost.** One mentor builds a small game with this starter for one hour, then checks what it
   used (`/status` in Codex, or the usage page of the account). Multiply by teams and hours.
3. **Prepare every laptop** (kids bring their own: check them before the session, and have one spare):
   - Install Codex. Node.js 22, Git and Chrome are best installed too; what is missing, the setup fetches into
     the project folder (`.tools/`): Node.js on every system, Git on Windows, a small browser for the AI's
     screenshots when there is no Chrome or Edge.
   - Download first, then open: clone the repo (or unpack the ZIP) into a folder named after the team, and always
     start Codex **in that folder**. Started anywhere else, it doesn't get its rules and helpers. Trust the
     folder when Codex asks, so its commands may use the internet.
   - Run the setup once (needs internet; about 100 MB, plus 40 MB for the tunnel program). Mac and Linux:
     `sh scripts/bootstrap.sh`. **Windows: double-click `setup.cmd`.** It installs everything, starts the game in
     the background, opens it in the browser and prints its public link. On the day, the AI runs
     `npm run status` by itself with every message, which repairs whatever stopped; kids never type commands.
   - **Windows notes.** PowerShell often blocks `npm` ("running scripts is disabled"): `npm.cmd run ...` always
     works, and the AI is told to use it. Avoid folders that sync to the cloud (OneDrive) and very long paths.
     Under WSL, use the Mac and Linux commands; the game opens in the Windows browser, but the AI's screenshots
     need Chrome installed inside the Linux system.
   - **Decide about public links.** Each game gets a public link (a Cloudflare Quick Tunnel) so the host and the
     other kids can play it. Anyone who has a link can open that game while the laptop is on. It shows only the
     game, but check that this fits your event and your parents' consent forms. To switch it off, put
     `PUBLIC_LINK=off` into `.env` on each laptop.
   - Picture previews: copy `.env.example` to `.env` and add an `OPENAI_API_KEY` (the image AI is gpt-image-2.6,
     a few cents per picture; set a monthly limit on that key). Without a key, the AI uses photos of the kids'
     own sketches and simple sketches it draws itself.
   - Check `npm run snap` (should print "No errors."), then start `codex` inside the team's folder and say "I'm
     a mentor checking the setup: what can you do in this project?".
4. **Test day**: run all laptops at once on the event Wi-Fi, each asking the AI for one feature. Open every
   game's public link on the host laptop, and one of them on a phone that is **not** on the event Wi-Fi: some
   networks block tunnels (they need outgoing port 7844) or the `trycloudflare.com` address.
5. **Optional**: download extra asset packs you expect kids to ask for (Kenney zips, see
   `.agents/skills/free-assets/SKILL.md`), so nobody waits on downloads during the jam.

## During the jam

- **How a team starts:** the world is empty, and the kids can already walk around in it. The AI asks for their
  idea (typed, or a photo of the whiteboard) and offers three ideas only if they have none. The whiteboard work
  (story, feelings, the stage questions) stays the team's own: the AI only gets what they choose to tell it. Then it builds in stages: World, Player + view, Goal, Mechanics,
  Details. Each stage takes a few rounds: a playable draft, the kids play, 2-3 fresh directions; after two
  rounds one option is the door (🚪) to the next stage. Every reply ends with the progress line, the game's link
  and numbered options, so kids can answer "2".
- **Your schedule is yours, not the AI's.** It doesn't know the clock or your two stages. It follows the kids:
  when they come back from the whiteboard and start talking about the goal and the rules, it goes there with
  them. A team stuck on its world after the break: tell them to say "now the goal".
- **Whiteboard photos:** a phone photo sent to the laptop (AirDrop, email, chat) and dropped into the Codex
  window or into `public/assets/images/` becomes the plan, a preview picture, a texture or a model idea.
- **The public link and the host's list.** Every reply from the AI ends with `🔗 https://....trycloudflare.com`.
  The team gives it to the host for the shared list (team, game title, play link, controls, status). Controls
  are the same in every game unless the team added a key: W A S D move, mouse looks, Space jumps or acts, Shift
  runs; on phones a joystick and buttons appear.
- **When a link changes.** A link dies when its laptop sleeps, closes, restarts or loses Wi-Fi; the next one is
  different. The AI then says "New link! Tell your host", and the host updates the list by hand. The setup keeps
  laptops from falling asleep by themselves while the game runs, but not past a closed lid: **lids open and
  chargers in, also during the break.**
- **Showing a game on the projector, trying another team's game, the final demos:** all of them open the team's
  link on another computer, so that team's laptop must stay on, awake and online. Ask the team not to send the
  AI anything meanwhile: every change reloads the game for everybody who has it open. Add `?demo` to the link
  to hide the slider button, and click the game once for sound and mouse look.
- **Big picture:** kids tend to ask for one small thing at a time. The AI is told to read between the lines, offer
  the bigger version of what they seem to want, and keep every new part (shop, room, loot, mini-game) connected
  in a "game map" in `our-game.md`. If a team's game turns into a pile of unconnected pieces, ask them what game
  it should feel like and let the AI suggest how to tie it together.
- **One player only:** no multiplayer, online or on one keyboard.
- **Save points** are the safety net: the AI makes one after every step that works.
  - `npm run undo` throws away changes since the last save (kept in `git stash list` as a backup).
  - `npm run saves` then `npm run load -- <n>` goes back further. Newer saves stay in the list.
  - Recover an undone change: `git stash list`, then `git stash apply stash@{0}`.
- **Sliders** (`` ` `` in the game) change numbers instantly and cost nothing. Push kids to tune instead of prompting.
- **The AI is stuck** (same error twice, going in circles): `npm run undo`, start a new conversation in Codex
  (`/new`), and ask for a smaller step. Kids can type `$bug` for bugs.
- **Model Lab station** (optional, mentor-operated): turn a kid's drawing into a 3D model with an AI model
  generator (Meshy, Tripo), download as GLB, drop it in `public/assets/models/<folder>/`, run
  `npm run assets -- catalog`. See `.agents/skills/character-animation/SKILL.md` section 6.

## Where things are

| Need | Look at |
|---|---|
| What the AI is told | `AGENTS.md` (rules), `ENGINE.md` (engine reference), and what `npm run status` prints with every message |
| Recipes the AI follows | `.agents/skills/*/SKILL.md`, `.agents/skills/game-recipes/recipes/*.md` |
| The team's plan | `our-game.md` |
| What models exist | `public/assets/CATALOG.md` (`npm run assets -- catalog` rebuilds it) |
| Errors from the game | `logs/browser.log` and the red box in the game |
| Slider values | `src/tuning.json` holds only sliders people moved; "↺ Reset to code values" in a slider folder (or deleting its lines) undoes them |
| Codex settings | `.codex/config.toml`: commands may write in the folder and use the internet |
| The public link | `logs/tunnel.json` (the current link), `logs/tunnel.log` (what happened to it) |
| Downloaded programs | `.tools/` (cloudflared; Node.js and Git when the computer had none) |
| Idea ingredients | `scripts/spark.mjs` (the lists behind `npm run spark`; add your own) |

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` says the port is in use | another game is running: close the other terminal, or use the URL it prints |
| The game should stop (it runs in the background after the setup) | `npm run setup -- --stop` in the team's folder (stops the public link too) |
| No public link, or friends can't open it | `npm run share` says why; `logs/tunnel.log` has the details. Usual causes: no internet, the network blocks the tunnel (try the hotspot), or the laptop slept. A new link needs up to a minute before it opens everywhere |
| Friends see errors when many open the link in the same moment | a Quick Tunnel carries up to 200 requests at once, and the live game loads many small files: reload a few seconds apart. For a demo to a whole room, upload `npm run build` instead |
| The link shows an error page | the game or the laptop stopped: `npm run share` (new link if the old one can't be saved), then update the host's list |
| Windows: "running scripts is disabled" | write `npm.cmd` instead of `npm` (nothing on the computer needs changing) |
| "Save points need Git" | Windows: run `setup.cmd` again (it fetches Git into the folder). Mac: `xcode-select --install` in Terminal |
| The laptop still falls asleep | plug it in and keep the lid open; check the system's sleep settings (managed school laptops can override the setup) |
| The AI answers with setup steps or developer reports | it was started outside the game folder, or with rules it didn't read: quit, `cd` into the folder, start it again and say hi |
| Black screen, no error | wait for loading; check `logs/browser.log`; try the "Graphics > quality: low" slider |
| Slow on an old laptop | slider Graphics > quality = low, fewer enemies, smaller `ground` size |
| `npm run snap` can't open a browser | install Google Chrome (Windows has Edge, which works too); under WSL install Chrome inside Linux |
| Sound doesn't play | click the game once (browsers block sound until you interact) |
| Model looks wrong (huge, sideways, floating) | `npm run inspect -- public/assets/...glb`, then use `height`, `turn`, `hide` options |
| Rate-limit or "overloaded" errors from the AI | wait a minute; check the account's limits; stagger big requests between teams |
| The team wants to keep the game after the jam (the link dies with the laptop) | `npm run build`, then upload the `dist/` folder to itch.io (HTML game) or Netlify Drop |

## Rebuilding the asset pack

`node scripts/build-starter-pack.mjs` downloads every starter asset again from KayKit (GitHub),
Kenney (GitHub starter kits) and Poly Haven, and rebuilds `CATALOG.md` and `CREDITS.md`.
