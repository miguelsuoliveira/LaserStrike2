// The game's public link: a Cloudflare Quick Tunnel from the internet to the game running on this
// computer (`npm run setup`, `npm run share` and `npm run save` use this).
// - No account needed. The link looks like https://four-random-words.trycloudflare.com
// - It works only while this computer is on, online, and the game and the tunnel are running.
// - The same link is kept as long as the tunnel lives; a new tunnel means a new link.
// - A link is only ever reported after it was fetched through the internet and answered as THIS game.
// Switch it off for a computer with PUBLIC_LINK=off in .env.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const WIN = process.platform === 'win32';
const PORTS = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stateFile = (root) => path.join(root, 'logs', 'tunnel.json');
const logFile = (root) => path.join(root, 'logs', 'tunnel.log');
const lockFile = (root) => path.join(root, 'logs', 'tunnel.lock');
// What the share tools did and when, next to cloudflared's own lines in logs/tunnel.log (for finding problems).
const note = (root, text) => {
  try {
    fs.appendFileSync(logFile(root), `${new Date().toISOString().slice(0, 19)}Z SHARE ${text}\n`);
  } catch {}
};

// The dev server of THIS project, if it is running: { url, port, id }.
export async function findGame(root, timeout = 600) {
  for (const port of PORTS) {
    try {
      const r = await fetch(`http://localhost:${port}/__project`, { signal: AbortSignal.timeout(timeout) });
      if (!r.ok || path.resolve((await r.text()).trim()) !== root) continue;
      const id = await (await fetch(`http://localhost:${port}/__id`, { signal: AbortSignal.timeout(timeout) })).text();
      if (!/^[a-f0-9]{16}$/.test(id.trim())) continue; // a server from before the public link: not usable
      return { url: `http://localhost:${port}/`, port, id: id.trim() };
    } catch {}
  }
  return null;
}

export function linkOff(root) {
  let v = process.env.PUBLIC_LINK;
  try {
    v ??= fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*PUBLIC_LINK\s*=\s*(\S+)/m)?.[1];
  } catch {}
  return /^(off|0|false|no)$/i.test(v || '');
}

export function readLink(root) {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(root), 'utf8'));
    return s?.url && s?.pid ? s : null;
  } catch {
    return null;
  }
}

// Is the link reachable from the internet, and does it show this game (not an old one)?
export async function checkLink(url, id, timeout = 6000) {
  try {
    const r = await fetch(`${url}/__id`, { signal: AbortSignal.timeout(timeout), cache: 'no-store' });
    return r.ok && (await r.text()).trim() === id;
  } catch {
    return false;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// Only ever stop a process that really is cloudflared (process numbers get reused).
function isCloudflared(pid) {
  if (!pid || !alive(pid)) return false;
  const r = WIN
    ? spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' })
    : spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
  return /cloudflared/i.test(r.stdout || '');
}

export function stopLink(root) {
  const s = readLink(root);
  let stopped = false;
  if (s && isCloudflared(s.pid)) {
    try {
      process.kill(s.pid);
      stopped = true;
    } catch {}
  }
  fs.rmSync(stateFile(root), { force: true });
  return stopped;
}

function findCloudflared(root) {
  const local = path.join(root, '.tools', WIN ? 'cloudflared.exe' : 'cloudflared');
  if (fs.existsSync(local)) return local;
  const r = spawnSync(WIN ? 'where' : 'which', ['cloudflared'], { encoding: 'utf8' });
  const found = r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : '';
  return found && fs.existsSync(found) ? found : null;
}

// Cloudflare's own program, from its official releases, into .tools/ (git ignores it). About 40 MB, once.
async function downloadCloudflared(root, say) {
  const arch = { x64: 'amd64', arm64: 'arm64', arm: 'arm', ia32: '386' }[process.arch];
  const asset = {
    darwin: `cloudflared-darwin-${arch === 'arm64' ? 'arm64' : 'amd64'}.tgz`,
    win32: `cloudflared-windows-${arch === '386' ? '386' : 'amd64'}.exe`,
    linux: `cloudflared-linux-${arch}`,
  }[process.platform];
  if (!asset || !arch) throw new Error(`no cloudflared download for ${process.platform} ${process.arch}`);
  say('Getting the sharing tool (cloudflared, about 40 MB, only once)...');
  const tools = path.join(root, '.tools');
  fs.mkdirSync(tools, { recursive: true });
  const res = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`, { signal: AbortSignal.timeout(240000) });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const bin = path.join(tools, WIN ? 'cloudflared.exe' : 'cloudflared');
  if (asset.endsWith('.tgz')) {
    const tgz = path.join(tools, asset);
    fs.writeFileSync(tgz, bytes);
    const r = spawnSync('tar', ['-xzf', tgz, '-C', tools], { stdio: 'ignore' });
    fs.rmSync(tgz, { force: true });
    if (r.status !== 0 || !fs.existsSync(bin)) throw new Error('could not unpack cloudflared');
  } else {
    fs.writeFileSync(`${bin}.part`, bytes);
    fs.renameSync(`${bin}.part`, bin);
  }
  if (!WIN) fs.chmodSync(bin, 0o755);
  if (spawnSync(bin, ['--version'], { stdio: 'ignore' }).status !== 0) {
    fs.rmSync(bin, { force: true });
    throw new Error('the downloaded cloudflared does not run on this computer');
  }
  return bin;
}

// The game listens on "localhost", which is 127.0.0.1 on some computers and ::1 on others; the tunnel
// program only tries one of them. Find the one that answers.
async function gameAddress(port) {
  for (const host of ['127.0.0.1', '[::1]']) {
    try {
      if ((await fetch(`http://${host}:${port}/__id`, { signal: AbortSignal.timeout(1500) })).ok) return `http://${host}:${port}`;
    } catch {}
  }
  return `http://localhost:${port}`;
}

// A brand-new link's name appears on the internet a moment after the tunnel connects. Looking it up too
// early makes the network remember "no such name" for a minute, for everybody on it. So ask Cloudflare's
// own name servers (which nobody caches) until the name is there, and only then use it normally.
async function waitForName(root, hostname, maxMs = 75000) {
  let why = 'not there in time';
  try {
    const { Resolver } = await import('node:dns/promises');
    const system = new Resolver({ timeout: 2000, tries: 1 });
    const servers = (await Promise.all((await system.resolveNs('trycloudflare.com')).slice(0, 2).map((n) => system.resolve4(n)))).flat();
    const direct = new Resolver({ timeout: 1500, tries: 1 });
    direct.setServers(servers);
    for (const end = Date.now() + maxMs; Date.now() < end; await sleep(700)) {
      try {
        if ((await direct.resolve4(hostname)).length) return note(root, `name is on the internet: ${hostname}`);
      } catch (e) {
        if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
          why = `cannot ask the name servers (${e.code})`; // this network doesn't let us
          break;
        }
      }
    }
  } catch (e) {
    why = `cannot find the name servers (${e.code || e.message})`;
  }
  note(root, `name check: ${why}; waiting 4 s instead`);
  await sleep(4000);
}

async function startTunnel(root, game, say) {
  const bin = findCloudflared(root) || (await downloadCloudflared(root, say));
  const target = await gameAddress(game.port);
  fs.mkdirSync(path.join(root, 'logs'), { recursive: true });
  fs.writeFileSync(logFile(root), '');
  const out = fs.openSync(logFile(root), 'a');
  let exited = false;
  const child = spawn(bin, ['tunnel', '--url', target, '--no-autoupdate'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  child.on('error', () => (exited = true));
  child.on('exit', () => (exited = true));
  child.unref();
  const giveUp = (why) => {
    try {
      if (!exited) process.kill(child.pid);
    } catch {}
    const tail = fs
      .readFileSync(logFile(root), 'utf8')
      .split('\n')
      .filter((l) => / ERR /.test(l) || /^(error|failed)/i.test(l))
      .map((l) => l.replace(/^\S+ ERR\s*/, '').replace(/\s(connIndex|event|ingressRule|originService|dest)=\S+/g, ''))
      .slice(-1)
      .join('')
      .slice(0, 240);
    throw new Error(tail ? `${why}: ${tail}` : why);
  };

  // 1. Cloudflare gives the link, then connects it.
  let url = null;
  for (let i = 0; i < 80 && !exited; i++) {
    await sleep(500);
    const text = fs.readFileSync(logFile(root), 'utf8');
    url ||= text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0] || null;
    if (url && /Registered tunnel connection/.test(text)) break;
  }
  if (exited) giveUp('the tunnel program stopped (often no internet, or the network blocks it)');
  if (!url) giveUp('Cloudflare gave no link within 40 seconds (often no internet, or the network blocks it)');

  // 2. Wait until the internet knows the new name, then fetch the game through it until it answers as this game.
  note(root, `tunnel connected: ${url} -> ${target}`);
  await waitForName(root, new URL(url).hostname);
  let ok = false;
  let tries = 0;
  for (; tries < 40 && !ok && !exited; tries++) {
    if (tries) await sleep(2000);
    ok = await checkLink(url, game.id);
  }
  note(root, ok ? `checked through the internet after ${tries} tr${tries === 1 ? 'y' : 'ies'}: it shows this game` : 'never answered as this game');
  if (!ok) giveUp(`the new link ${url} did not answer within 90 seconds, so it is not safe to share`);
  const state = { url, pid: child.pid, port: game.port, created: new Date().toISOString() };
  fs.writeFileSync(stateFile(root), JSON.stringify(state, null, 2) + '\n');
  return state;
}

// Makes sure there is a working public link to the running game. Reuses the current one when it still
// works; otherwise starts a new tunnel. Returns:
//   { status: 'ok', url, fresh, replaced } | { status: 'off' } | { status: 'failed', reason }
export async function ensureLink(root, game, say = () => {}) {
  if (linkOff(root)) return { status: 'off' };
  if (!game) return { status: 'failed', reason: 'the game is not running' };
  fs.mkdirSync(path.join(root, 'logs'), { recursive: true });

  // One at a time (a save and a share may run together): wait for the other one, then use its result.
  const lock = lockFile(root);
  for (let i = 0; i < 120; i++) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
      break;
    } catch {
      let stale = true;
      try {
        stale = Date.now() - fs.statSync(lock).mtimeMs > 150000 || !alive(Number(fs.readFileSync(lock, 'utf8')));
      } catch {}
      if (stale) fs.rmSync(lock, { force: true });
      else await sleep(1000);
    }
  }
  try {
    const old = readLink(root);
    if (old && old.port === game.port && isCloudflared(old.pid)) {
      for (let i = 0; i < 3; i++) {
        if (await checkLink(old.url, game.id)) return { status: 'ok', url: old.url, fresh: false, replaced: null };
        await sleep(1500);
      }
    }
    if (old) stopLink(root);
    const state = await startTunnel(root, game, say);
    return { status: 'ok', url: state.url, fresh: true, replaced: old?.url || null };
  } catch (e) {
    return { status: 'failed', reason: String(e.message || e) };
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

// What the AI reads after a command.
export function linkReport(link) {
  if (link.status === 'off') return 'Public link: switched off on this computer (PUBLIC_LINK=off in .env). Leave the link line out of your replies.';
  if (link.status === 'failed') {
    return (
      `No public link right now (${link.reason}).\n` +
      'For the AI: leave the link line out of your reply; never show a link that was not just checked. `npm run share` tries again.'
    );
  }
  if (!link.fresh) return `Public link (checked just now through the internet, it works): ${link.url}`;
  if (link.replaced) {
    return (
      `Public link, NEW (checked, it works): ${link.url}\n` +
      'For the AI: the old link is dead. Say so in your reply: "New link! Tell your host, so the game list gets updated."'
    );
  }
  return `Public link (new; checked through the internet, it works): ${link.url}`;
}
