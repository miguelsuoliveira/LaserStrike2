#!/usr/bin/env node
// Opens the game in a hidden Chrome window, waits, optionally presses keys,
// takes a screenshot and prints any errors. Lets the AI SEE the game.
//   npm run snap                                  screenshot -> .screenshots/snap.png
//   npm run snap -- --keys "w:1500, space, d:800" hold W 1.5 s, tap Space, hold D 0.8 s
//   npm run snap -- --wait 3                      wait 3 s before the screenshot (default 2)
//   npm run snap -- --title                       don't skip the title screen
//   npm run snap -- --eval "game.world.scene.children.length"   print a value from the page
//   npm run snap -- --out jump                    save as .screenshots/jump.png
//   npm run snap -- --shots 3                     3 screenshots, one per --wait seconds
//   npm run snap -- --keys "mouse:800x300, click, fire:1500"   move the mouse, click, hold the left button 1.5 s
//   npm run snap -- --set "Health.hearts=1, Sky.timeOfDay=20"  slider values for this run only (not saved)
//   npm run snap -- --before "game.player.teleport([0, 20, 0])" run code after loading, before the keys
//   npm run snap -- --before "game.cameraRig.pitch = -0.7"   look up (sky, flying things); .yaw turns left/right
//        --before and --eval may use await: --eval "const m = await game.module('birds'); return m.birds.length"
//   npm run snap -- --zoom 2                      zoom into the middle of the screen (small things in top-down games)
// Uses the running `npm run dev` server if there is one, otherwise starts its own.
// Needs Google Chrome (or Microsoft Edge) installed.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(ROOT, '.screenshots');
fs.mkdirSync(outDir, { recursive: true });

const { chromium } = await import('playwright-core');

// 1. Find or start a dev server.
let server = null;
let base = opt('url', null);
if (!base) {
  for (const port of [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180]) {
    try {
      const r = await fetch(`http://localhost:${port}/__project`, { signal: AbortSignal.timeout(800) });
      if (r.ok && path.resolve(await r.text()) === ROOT) {
        base = `http://localhost:${port}/`;
        break;
      }
    } catch {
      // not running on this port
    }
  }
}
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false, open: false } });
  await server.listen();
  base = server.resolvedUrls.local[0];
}

// 2. Open Chrome.
let browser;
const launchErrors = [];
for (const channel of ['chrome', 'msedge', 'chromium']) {
  try {
    browser = await chromium.launch({
      channel: channel === 'chromium' ? undefined : channel,
      headless: true,
      args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    });
    break;
  } catch (e) {
    launchErrors.push(`${channel}: ${e.message.split('\n')[0]}`);
  }
}
if (!browser) {
  console.log('Could not open Chrome or Edge for the screenshot. Install Google Chrome.\n' + launchErrors.join('\n'));
  await server?.close();
  process.exit(2);
}

const [w, h] = String(opt('size', '1024x576')).split('x').map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h } });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    const text = m.text();
    if (!/deprecated parameters|GPU stall|WebGL-|Automatic fallback to software|Failed to load resource/i.test(text)) problems.push(`${m.type().toUpperCase()}: ${text}`);
  }
});
page.on('pageerror', (e) => problems.push(`ERROR: ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) problems.push(`ERROR: file not found (${r.status()}): ${new URL(r.url()).pathname}`);
});

const url = new URL(base);
if (!opt('title', false)) url.searchParams.set('play', '1');
const set = opt('set', null);
if (set && set !== true) url.searchParams.set('tune', set);
url.searchParams.set('demo', '1');
const started = Date.now();
await page.goto(url.toString());
try {
  // With --title, setup() is still waiting for the Play button, so a visible screen counts as ready.
  const titleMode = !!opt('title', false);
  await page.waitForFunction((t) => window.__gameReady === true || document.querySelector('.error-box') || (t && document.querySelector('.screen')), titleMode, { timeout: 45000 });
} catch {
  problems.push('ERROR: the game did not finish setup() within 45 seconds');
}
const loadSeconds = ((Date.now() - started) / 1000).toFixed(1);

// Runs code in the page. Code with `await` runs inside an async function.
const runInPage = (code) =>
  page.evaluate(async (e) => {
    try {
      return await (0, eval)(e);
    } catch (err) {
      if (!(err instanceof SyntaxError) || !/await|import|return/.test(err.message)) throw err;
      try {
        return await (0, eval)(`(async () => (${e}\n))()`);
      } catch (err2) {
        if (!(err2 instanceof SyntaxError)) throw err2;
        return await (0, eval)(`(async () => {${e}\n})()`);
      }
    }
  }, code);

const before = opt('before', null);
if (before && before !== true) {
  try {
    await runInPage(before);
  } catch (e) {
    problems.push(`ERROR: --before code failed: ${e.message}`);
  }
}

// 3. Keys: "w:1500, space, d:800" (hold times in ms, default tap).
const KEY = { space: 'Space', shift: 'Shift', enter: 'Enter', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', escape: 'Escape', ctrl: 'Control' };
const keys = opt('keys', '');
if (keys && keys !== true) {
  await page.mouse.move(w / 2, h / 2);
  for (const part of keys.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [name, ms] = part.split(':');
    // mouse:800x300 moves the mouse; click / click:800x300 clicks; fire:1000 holds the left button
    const at = ms && ms.includes('x') ? ms.split('x').map(Number) : null;
    if (name === 'mouse' && at) {
      await page.mouse.move(at[0], at[1]);
      continue;
    }
    if (name === 'click' || name === 'rightclick') {
      if (at) await page.mouse.move(at[0], at[1]);
      await page.mouse.click(...(at || [w / 2, h / 2]), { button: name === 'click' ? 'left' : 'right' });
      continue;
    }
    if (name === 'fire') {
      await page.mouse.down();
      await page.waitForTimeout(Number(ms || 80));
      await page.mouse.up();
      continue;
    }
    if (name === 'wait') {
      await page.waitForTimeout(Number(ms || 500));
      continue;
    }
    const combo = name.split('+').map((k) => KEY[k.toLowerCase()] || (k.length === 1 ? `Key${k.toUpperCase()}` : k));
    for (const k of combo) await page.keyboard.down(/^[0-9]$/.test(k) ? `Digit${k}` : k);
    await page.waitForTimeout(Number(ms || 80));
    for (const k of combo.reverse()) await page.keyboard.up(/^[0-9]$/.test(k) ? `Digit${k}` : k);
  }
}

const wait = Number(opt('wait', 2));
const shots = Number(opt('shots', 1));
const name = opt('out', 'snap');
const files = [];
for (let i = 0; i < shots; i++) {
  await page.waitForTimeout(wait * 1000);
  const file = path.join(outDir, shots > 1 ? `${name}-${i + 1}.png` : `${name}.png`);
  const zoom = Number(opt('zoom', 1));
  const clip = zoom > 1 ? { x: (w - w / zoom) / 2, y: (h - h / zoom) / 2, width: w / zoom, height: h / zoom } : undefined;
  await page.screenshot({ path: file, clip });
  files.push(path.relative(ROOT, file));
}

const info = await page.evaluate(() => {
  const g = window.game;
  let objects = 0;
  g?.world.scene.traverse(() => objects++);
  const cam = g?.world.camera.position;
  return {
    fps: window.__fps,
    objects,
    camera: cam ? `${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}, ${cam.z.toFixed(1)}` : '?',
    errorBox: document.querySelector('.error-box')?.style.display !== 'none' ? document.querySelector('.error-box')?.innerText : null,
    screen: document.querySelector('.screen')?.innerText || null,
    hud: [...document.querySelectorAll('.hud-text')].map((e) => e.textContent).join(' | '),
  };
});
let evalResult;
const expr = opt('eval', null);
if (expr && expr !== true) {
  try {
    const v = await runInPage(expr);
    evalResult = typeof v === 'object' ? JSON.stringify(v) : String(v);
  } catch (e) {
    evalResult = `eval failed: ${e.message}`;
  }
}

await browser.close();
await server?.close();

console.log(`Screenshot: ${files.join(', ')}  (read the image to see the game)`);
console.log(`Loaded in ${loadSeconds}s, ${info.fps ?? '?'} FPS in the hidden browser (real laptops are faster), ${info.objects} objects, camera at ${info.camera}`);
if (info.hud) console.log(`On screen: ${info.hud}`);
if (info.screen) console.log(`Screen showing: ${info.screen.replace(/\n+/g, ' / ')}`);
if (evalResult !== undefined) console.log(`Eval: ${evalResult}`);
const unique = [...new Set(problems)];
if (info.errorBox) unique.unshift(`ERROR BOX ON SCREEN: ${info.errorBox.replace(/\n+/g, ' / ')}`);
if (unique.length) {
  console.log(`\nProblems (${unique.length}):`);
  for (const p of unique.slice(0, 15)) console.log(`- ${p.slice(0, 600)}`);
  process.exit(unique.some((p) => p.startsWith('ERROR')) ? 1 : 0);
} else {
  console.log('No errors.');
}
