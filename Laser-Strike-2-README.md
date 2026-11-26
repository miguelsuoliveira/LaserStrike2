# Laser Strike 2

Laser Strike 2 is a single-player, top-down Canvas arcade game set in Port Meridian, based off Counter-Strike 2. The map, interface, and animated crew designs are drawn by the source. They require no external asset downloads. Music and sound effects are synthesized in the browser and can be toggled separately in Settings. Graphics presets range from the original Low look to higher-resolution Medium and High, with added lighting and arena detail.

## Launch locally

From the repository root, use Node.js 22 and run:

```sh
npm ci
npm run dev
```

Open the address printed by Vite in Chrome or Edge. Use `npm run build` to build for static hosting. The starter's `npm run status` starts or checks the competition sharing tunnel.

## Online edition

Run `npm ci` and `npm run build`, then run `npm start` and open `http://localhost:8080` to test. Choose **Play Online**, customize your character if you like, create a room, and share its link or code. If you accidentally disconnect, reopen the lobby in the same browser within 90 seconds to rejoin the ongoing match with your stats.

To deploy on Render, connect your GitHub repository as a Node **Web Service**. Use `npm ci --include=dev && npm run build` as the build command, `npm start` as the start command, and `/healthz` as the health check path. The server reads Render’s `PORT` and `RENDER_EXTERNAL_URL`. On other hosts, set `ONLINE_ORIGIN` to the public HTTPS URL. Use one instance because room state lives in memory.

## LAN edition

Run `npm run lan` on the same computer hosting the public game. Players on the host’s Wi‑Fi open the public game and choose **Play LAN Server** to connect automatically. The host creates a room, and the other players choose display names and enter the room code. The host sets team size and bot difficulty before starting. Players choose either team with space available, and bots fill the remaining slots when the host starts the match. Esc pauses the match for the room. If the host leaves, the remaining players return to the normal main menu. Rooms stay in memory while the host is running. On a static host such as Netlify, start `npm run lan` on the laptop, open the LAN page it prints, create a room, and share **Copy room link**. The link opens the host directly and fills in the room code.

## Play

Pick 1v1 through 10v10 and join a crew. Bots fill the other positions. Move with WASD, aim with the mouse, click to pulse, and press R to reload. The shop shows damage per hit for all five items. A countdown beside the active character shows how long planting or defusing has left. A red X confirms a hit and the crosshair briefly shows the combined damage of consecutive hits. Press E beside a dropped weapon to swap it for yours. Ground labels show the shop price, and swapping costs no credits. Hold E at an eligible relay site, B toggles the shop during preparation, Tab shows team statistics while held, and Esc pauses.

Use + and − next to match size to choose 2 to 30 rounds. The default is 11. Teams switch sides before the middle round of an odd limit or the first round of the second half of an even limit. A majority wins, and only even limits can end in a draw. Crews keep their scores, roster, and statistics at the switch. At the end of a decisive match, the winners’ stage ranks the entire winning crew by total damage. Shopping lasts ten seconds. Click **Ready** to start early once all connected players are ready. Use the music and sound effects buttons at the top right to mute either channel. Surviving characters carry equipment forward, and all roster members receive the same round reward for their team.

## Source

- `src/game/match.js` implements rules, combat, bot decisions, objectives and credits.
- `src/game/arena.js` defines geometry, collision and navigation.
- `src/game/arena-art.js` draws the original map, crews and gameplay effects.
- `src/game/strike.js` and `src/game/strike.css` provide input and menus.


## Verify

Run `node scripts/test-strike.mjs` to verify match rules, spawning and navigation across all roster sizes. With the development server running and Playwright Chromium installed, run `node scripts/test-strike-browser.mjs` to exercise the menu, shop, scoreboard, active controls and pause flow. Set `STRIKE_BROWSER_CHANNEL` to `chrome` or `msedge` to use an installed browser.

The public link uses the starter's Cloudflare tunnel and stays available while the host computer and game server stay online.
