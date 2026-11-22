# Laser Strike 2

Laser Strike 2 is a single-player, top-down Canvas arcade game set in Port Meridian, based off Counter-Strike 2. The map, interface, and animated crew designs are drawn by the source. They require no external asset downloads. Music and sound effects are synthesized in the browser and can be toggled separately in Settings. Graphics presets range from the original Low look to higher-resolution Medium and High, with added lighting and arena detail.

## Launch locally

From the repository root, use Node.js 22 and run:

```sh
npm ci
npm run dev
```

Open the address printed by Vite in Chrome or Edge. Use `npm run build` to build for static hosting. The starter's `npm run status` starts or checks the competition sharing tunnel.

## LAN edition

Run `npm run lan` on the same computer hosting the public game. Players on the host’s Wi‑Fi open the public game and choose **Play LAN Server** to connect automatically. The host creates a room, and the other players choose display names and enter the room code. The host sets team size and bot difficulty before starting. Players choose either team with space available, and bots fill the remaining slots when the host starts the match. Esc pauses the match for the room. If the host leaves, the remaining players return to the normal main menu. Rooms stay in memory while the host is running.

## Play

Pick 1v1 through 10v10 and join a crew. Bots fill the other positions. Move with WASD, aim with the mouse, click to pulse, and press R to reload. The shop shows damage per hit for all five items. A countdown beside the active character shows how long planting or defusing has left. A red X confirms a hit and the crosshair briefly shows the combined damage of consecutive hits. Press E beside a dropped weapon to swap it for yours. Ground labels show the shop price, and swapping costs no credits. Hold E at an eligible relay site, B toggles the shop during preparation, Tab shows team statistics while held, and Esc pauses.

Win six rounds in a match of up to ten. A 5–5 score ends in a draw. The crews keep their scores, roster, and statistics when activation and defense swap before round six. At the end of a decisive match, the winners’ stage ranks the entire winning crew by total damage. Surviving characters carry equipment forward, and all roster members receive the same round reward for their team.

## Source

- `src/game/match.js` implements rules, combat, bot decisions, objectives and credits.
- `src/game/arena.js` defines geometry, collision and navigation.
- `src/game/arena-art.js` draws the original map, crews and gameplay effects.
- `src/game/strike.js` and `src/game/strike.css` provide input and menus.


## Verify

Run `node scripts/test-strike.mjs` to verify match rules, spawning and navigation across all roster sizes. With the development server running and Playwright Chromium installed, run `node scripts/test-strike-browser.mjs` to exercise the menu, shop, scoreboard, active controls and pause flow. Set `STRIKE_BROWSER_CHANNEL` to `chrome` or `msedge` to use an installed browser.

The public link uses the starter's Cloudflare tunnel and stays available while the host computer and game server stay online.
