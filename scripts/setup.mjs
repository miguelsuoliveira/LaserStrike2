#!/usr/bin/env node
// One command that gets a fresh copy ready to play and to share. The AI runs it, never the kids.
//   npm run setup                install what's missing, start the game, open it in the browser,
//                                and make a public link to it (a Cloudflare Quick Tunnel, see lib/share.mjs)
//   npm run share                the same, but it only prints the checked public link (use it any time)
//   npm run setup -- --no-open   start the game without opening a browser window
//   npm run setup -- --no-share  no public link this time (PUBLIC_LINK=off in .env switches it off for good)
//   npm run setup -- --no-start  only install
//   npm run setup -- --stop      stop the game and the public link that setup started
// Safe to run any time: what already runs is kept (same game, same link); only what stopped is started again.
// The last lines it prints tell the AI what to do next.
// It also: gets Git on Windows when it is missing (save points need it), keeps the computer awake while the
// game runs (KEEP_AWAKE=off in .env switches that off), and gets a browser for `npm run snap` if there is none.
// No Node.js on the computer at all? scripts/bootstrap.sh (Mac, Linux) or scripts/bootstrap.ps1 (Windows) gets it first.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readPlan, planAdvice } from './spark.mjs';
import { findGame, ensureLink, linkReport, stopLink } from './lib/share.mjs';
import { useLocalTools, hasGit, isWsl, setting, isOff } from './lib/tools.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGS = path.join(ROOT, 'logs');
const PID_FILE = path.join(LOGS, 'dev-server.pid');
const AWAKE_FILE = path.join(LOGS, 'awake.pid');
const WIN = process.platform === 'win32';
useLocalTools(ROOT);
const flags = new Set(process.argv.slice(2));
const notes = []; // things only a grown-up can fix
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (flags.has('--stop')) {
  const pid = Number(fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, 'utf8'));
  try {
    if (pid) process.kill(pid);
    console.log(pid ? 'Stopped the game.' : 'Setup did not start a game here (close the terminal that runs `npm run dev`).');
  } catch {
    console.log('The game was not running anymore.');
  }
  fs.rmSync(PID_FILE, { force: true });
  fs.rmSync(AWAKE_FILE, { force: true }); // the keep-awake helper stops by itself when the game stops
  if (stopLink(ROOT)) console.log('Stopped the public link (it will not work anymore; the next one is a new link).');
  process.exit(0);
}

// 1. Node
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  console.log(
    `This computer has Node.js ${process.versions.node}; the game needs 22 or newer.\n` +
      'NEXT, for the AI: this needs a grown-up. Tell the team in one sentence: "Please ask a mentor to install Node.js 22 (nodejs.org)".',
  );
  process.exit(1);
}
if (major < 22) notes.push(`Node.js ${process.versions.node} is older than the 22 this was tested with (a mentor can update it later).`);

// 2. Install what's missing (npm install with the lock file: no new packages).
const stamp = path.join(ROOT, 'node_modules', '.package-lock.json');
const lock = path.join(ROOT, 'package-lock.json');
const needInstall =
  !fs.existsSync(path.join(ROOT, 'node_modules', 'vite', 'package.json')) ||
  !fs.existsSync(stamp) ||
  (fs.existsSync(lock) && fs.statSync(lock).mtimeMs > fs.statSync(stamp).mtimeMs + 1000);
function install(why) {
  console.log(`${why} (about a minute, needs the internet)...`);
  const args = ['install', '--no-audit', '--no-fund', '--loglevel=error'];
  const env = { ...process.env, AIJAM_SETUP: '1' };
  const npmCli = process.env.npm_execpath;
  const r =
    npmCli && /\.[cm]?js$/.test(npmCli)
      ? spawnSync(process.execPath, [npmCli, ...args], { cwd: ROOT, stdio: 'inherit', env })
      : spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit', env, shell: true });
  if (r.status !== 0) {
    console.log(
      '\nThe install did not work (see the lines above; often no internet).\n' +
        'NEXT, for the AI: try once more. If it fails again, tell the team in one sentence to ask a mentor to check the internet.',
    );
    process.exit(1);
  }
}
// Does the installed engine load on THIS computer? (A folder installed on another system, or by an
// AI working inside a sandbox, has the wrong built-in parts: install again.)
const engineLoads = () =>
  spawnSync(process.execPath, ['--input-type=module', '-e', "await import('vite')"], { cwd: ROOT, stdio: 'ignore' }).status === 0;
if (needInstall) install('Installing the game engine');
if (!engineLoads()) {
  install('The engine was installed for a different kind of computer: installing it for this one');
  if (!engineLoads()) {
    console.log(
      'The game engine does not load on this computer even after installing it again.\n' +
        'NEXT, for the AI: this needs a grown-up. Tell the team in one sentence to ask a mentor to delete the node_modules folder and run `npm run setup`.',
    );
    process.exit(1);
  }
}

// Git, for save points. Windows often has none: get the small official one (MinGit) into .tools/git.
async function getGitForWindows() {
  console.log('No Git on this computer: getting it into this project (about 40 MB, only once)...');
  const api = await fetch('https://api.github.com/repos/git-for-windows/git/releases/latest', {
    headers: { 'User-Agent': 'ai-game-jam-starter', Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!api.ok) throw new Error(`GitHub answered ${api.status}`);
  const want = process.arch === 'arm64' ? /^MinGit-[\d.]+-arm64\.zip$/ : /^MinGit-[\d.]+-64-bit\.zip$/;
  const asset = (await api.json()).assets.find((a) => want.test(a.name));
  if (!asset) throw new Error('no MinGit download in the latest Git for Windows release');
  const tools = path.join(ROOT, '.tools');
  const dir = path.join(tools, 'git');
  const zip = path.join(tools, asset.name);
  fs.mkdirSync(tools, { recursive: true });
  const res = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(240000) });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // Windows 10 and 11 have tar (it reads zip files); PowerShell is the slower fallback.
  if (spawnSync('tar', ['-xf', zip, '-C', dir], { stdio: 'ignore' }).status !== 0) {
    spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`], { stdio: 'ignore' });
  }
  fs.rmSync(zip, { force: true });
  useLocalTools(ROOT);
}
if (!hasGit()) {
  if (WIN) {
    try {
      await getGitForWindows();
    } catch (e) {
      console.log(`(Could not get Git: ${e.message})`);
    }
  }
  if (!hasGit()) {
    notes.push(
      'Git is missing, so save points (`npm run save`, undo, load) do not work yet. ' +
        (process.platform === 'darwin' ? 'On a Mac: run `xcode-select --install` in the Terminal app.' : 'Install Git (git-scm.com).'),
    );
  }
}

// A shell that cannot show windows (an AI app that runs commands in its own sandbox, or a remote machine)
// can build and check the game, but the kids would never see it. (Linux inside Windows shows them in Windows.)
const wsl = isWsl();
const noScreen = process.platform === 'linux' && !wsl && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;

// 3. Start the game (or find the one already running) and make sure a browser shows it.
function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? ['open', url] : WIN ? ['cmd', '/c', 'start', '', url] : wsl ? ['cmd.exe', '/c', 'start', '', url] : ['xdg-open', url];
  try {
    spawn(cmd[0], cmd.slice(1), { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } catch {}
}

let game = null;
let url = null;
let state = 'not started';
if (!flags.has('--no-start')) {
  const wantOpen = !flags.has('--no-open') && !noScreen;
  game = await findGame(ROOT);
  url = game?.url || null;
  if (url) {
    state = 'was already running';
    // Running, but nobody is looking at it? Open it again.
    try {
      const watching = Number(await (await fetch(`${url}__clients`, { signal: AbortSignal.timeout(600) })).text());
      if (wantOpen && watching === 0) {
        openBrowser(url);
        state = 'was running; opened it in the browser again';
      }
    } catch {}
  } else {
    fs.mkdirSync(LOGS, { recursive: true });
    const out = fs.openSync(path.join(LOGS, 'dev-server.log'), 'a');
    const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [vite, ...(wantOpen ? ['--open'] : [])], {
      cwd: ROOT,
      detached: true,
      stdio: ['ignore', out, out],
      windowsHide: true,
    });
    child.on('error', () => {});
    child.unref();
    if (child.pid) fs.writeFileSync(PID_FILE, String(child.pid));
    for (let i = 0; i < 60 && !game; i++) {
      await sleep(500);
      game = await findGame(ROOT);
    }
    url = game?.url || null;
    state = url ? (wantOpen ? 'started and opened in the browser' : 'started') : 'did not start';
  }
}

// Keep the computer awake while the game runs: a sleeping laptop kills the public link (and the next one is a
// new link). Not past a closed lid. The helper watches the game's process and ends with it.
function keepAwake() {
  if (isOff(setting(ROOT, 'KEEP_AWAKE'))) return;
  const alive = (pid) => {
    try {
      return !!pid && (process.kill(pid, 0), true);
    } catch (e) {
      return e.code === 'EPERM';
    }
  };
  const gamePid = Number(fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, 'utf8'));
  if (!alive(gamePid)) return; // started some other way (`npm run dev`): nothing to watch
  if (alive(Number(fs.existsSync(AWAKE_FILE) && fs.readFileSync(AWAKE_FILE, 'utf8')))) return;
  let cmd = null;
  if (process.platform === 'darwin') cmd = ['caffeinate', '-i', '-s', '-w', String(gamePid)];
  else if (WIN) {
    const ps =
      "$t = Add-Type -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint esFlags);' -Name Power -Namespace GameJam -PassThru; " +
      `while (Get-Process -Id ${gamePid} -ErrorAction SilentlyContinue) { [void]$t::SetThreadExecutionState([uint32]2147483649); Start-Sleep -Seconds 30 }`;
    cmd = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')];
  } else if (!wsl && spawnSync('which', ['systemd-inhibit'], { stdio: 'ignore' }).status === 0) {
    cmd = ['systemd-inhibit', '--what=idle:sleep', '--who=game jam', '--why=the game and its public link are running', 'tail', `--pid=${gamePid}`, '-f', '/dev/null'];
  }
  if (!cmd) return;
  try {
    const child = spawn(cmd[0], cmd.slice(1), { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
    if (child.pid) fs.writeFileSync(AWAKE_FILE, String(child.pid));
  } catch {}
}
if (game) keepAwake();

// 4. The public link: reuse the one that works, otherwise make a new one. Always checked through the internet.
let link = null;
if (game && !flags.has('--no-share')) link = await ensureLink(ROOT, game, (msg) => console.log(msg));

// `npm run share`: only the link.
if (flags.has('--share')) {
  if (!game) console.log('The game did not start (logs/dev-server.log says why), so there is no link. Run `npm run setup` to see more.');
  else console.log(linkReport(link));
  process.exit(link?.status === 'failed' || !game ? 1 : 0);
}

// 5. Things the AI should know about this computer.
const chromePaths = {
  darwin: ['/Applications/Google Chrome.app', `${process.env.HOME}/Applications/Google Chrome.app`, '/Applications/Microsoft Edge.app'],
  win32: [
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
  linux: ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/opt/microsoft/msedge/msedge'],
}[process.platform] || [];
const hasPlaywrightBrowser = () => {
  try {
    const dir = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.HOME || process.env.USERPROFILE || '', process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : process.platform === 'win32' ? 'AppData/Local/ms-playwright' : '.cache/ms-playwright');
    return fs.readdirSync(dir).some((d) => d.startsWith('chromium'));
  } catch {
    return false;
  }
};
if (!chromePaths.some((p) => fs.existsSync(p)) && !hasPlaywrightBrowser()) {
  // No Chrome or Edge: get the small test browser, so the AI can still look at the game (`npm run snap`).
  console.log('No Chrome or Edge on this computer: getting a small browser for screenshots (about 100 MB, only once)...');
  const cli = path.join(ROOT, 'node_modules', 'playwright-core', 'cli.js');
  spawnSync(process.execPath, [cli, 'install', 'chromium-headless-shell'], { cwd: ROOT, stdio: 'ignore', timeout: 600000 });
  if (!hasPlaywrightBrowser()) notes.push('No Chrome or Edge was found, so `npm run snap` (the AI\'s eyes) does not work until Google Chrome is installed.');
  else if (process.platform === 'linux') notes.push('`npm run snap` uses a downloaded browser; if it cannot start, install Google Chrome (in WSL: inside the Linux system).');
}
let imageKey = !!process.env.OPENAI_API_KEY;
try {
  imageKey ||= /^\s*OPENAI_API_KEY\s*=\s*\S+/m.test(fs.readFileSync(path.join(ROOT, '.env'), 'utf8'));
} catch {}

// 6. Report, and say what comes next.
const shared = link?.status === 'ok';
if (flags.has('--no-start')) console.log('Installed. The game was not started (--no-start).');
else if (url && noScreen) {
  console.log(
    `The game ${state} (${url}), but only inside this shell: it has no screen, so it cannot open on the kids' screen from here.\n` +
      "For the AI: your commands run in a sandbox or on another machine, not on the kids' computer. You can still build,\n" +
      '`npm run check` and `npm run snap`. ' +
      (shared
        ? 'The public link below is how the team plays: tell them once to open it in their browser.'
        : 'Tell the team once, in one sentence: "Please ask a mentor to open this folder with Codex on this computer,\nso the game shows on your screen." Then carry on with the workshop.'),
  );
} else if (url) console.log(`Ready: the game ${state}: ${url}`);
else {
  console.log(
    'Installed, but the game did not start by itself (logs/dev-server.log says why).\n' +
      'For the AI: start it yourself as a background process that keeps running (`npm run dev`), then go on. Do not ask the kids to do it.',
  );
}
if (link) console.log(linkReport(link));
if (path.resolve(process.execPath).startsWith(path.join(ROOT, '.tools') + path.sep)) {
  const dir = path.dirname(process.execPath);
  console.log(
    'Node.js for this project lives inside it (.tools/node), not on the computer. For the AI: start EVERY command with\n' +
      (WIN ? `  $env:Path = "${dir};$env:Path"; npm.cmd run ...` : `  PATH="${dir}:$PATH" npm run ...`),
  );
  notes.push('Node.js is only inside this project folder (.tools/node). Installing Node.js 22 on the computer makes everything simpler.');
}
console.log(
  imageKey
    ? 'Pictures: the image AI is ready (`npm run preview -- "..."`).'
    : 'Pictures: no image AI key here, so use photos of the kids\' own drawings or draw simple SVG sketches (see AGENTS.md).',
);
for (const n of notes) console.log(`Note for a mentor: ${n}`);

const plan = readPlan(ROOT);
console.log('\nNEXT, for the AI (the kids are waiting; they are game designers, not developers):');
console.log('- Read AGENTS.md now if you have not (it is the rule book for this project), and work from this folder.');
console.log("- Don't report this setup, and don't give the kids commands, file names, controls lists or a tour of the project.");
if (shared) {
  console.log(
    `- End every reply with the link line (the link emoji, then the link): ${link.url}\n` +
      '  Their game, playable on any phone or computer. `npm run status` and `npm run save` print it again, checked:\n' +
      '  only show a link one of them printed in this turn.',
  );
}
console.log(`- ${planAdvice(plan).replaceAll('\n', '\n  ')}`);
