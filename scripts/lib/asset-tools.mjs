// Shared helpers for scripts/assets.mjs and the download sources in scripts/sources/.
// Downloading (with short, friendly error messages), caching, zips, packing models into
// one .glb the engine can load, saving + crediting, and preview pictures.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { gltfIO, writeCompact } from './gltf-io.mjs';
import { gltfInfo } from './gltf-info.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ASSETS = path.join(ROOT, 'public/assets');
export const CACHE = path.join(ROOT, '.cache');
export const DOWNLOADS = path.join(CACHE, 'downloads');
export const UA = { 'User-Agent': 'ai-game-jam-starter/1.0 (kids game jam, education)' };
export const WARN_MB = 5;
export const MAX_MB = 30;

// A problem the kids/mentor can act on: printed as one line, no stack trace.
export class Oops extends Error {}
export const oops = (msg) => {
  throw new Oops(msg);
};

// ---------------------------------------------------------------- downloading

const host = (url) => new URL(url).hostname.replace(/^www\./, '');
const HINTS = {
  401: 'it wants a login',
  403: 'it refused (not allowed)',
  404: 'not found',
  410: 'it is gone',
  429: 'too many requests: wait a minute and try again',
};

// Cookies between requests (Kenney and itch.io need them).
export function cookieJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    store(res) {
      for (const c of res.headers.getSetCookie?.() || []) {
        const kv = c.split(';')[0];
        const i = kv.indexOf('=');
        if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
      }
    },
  };
}

// fetch() with a timeout and a one-line explanation when it fails.
//   as: 'buffer' | 'text' | 'json' | 'response'   soft: return null instead of failing on 4xx/5xx
export async function request(url, { as = 'buffer', method = 'GET', headers = {}, body, jar, referer, timeout = 60000, soft = false } = {}) {
  const h = { ...UA, ...headers };
  if (jar?.header()) h.cookie = jar.header();
  if (referer) h.referer = referer;
  if (body instanceof URLSearchParams) h['content-type'] = 'application/x-www-form-urlencoded';
  let res;
  try {
    res = await fetch(url, { method, headers: h, body, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  } catch (e) {
    const code = e.cause?.code || e.name;
    const why = /ENOTFOUND|EAI_AGAIN/.test(code) ? 'no internet, or the site is down'
      : /Timeout|Abort|ETIMEDOUT/.test(code) ? 'it took too long'
      : code;
    oops(`Couldn't reach ${host(url)} (${why}). Check the Wi-Fi and try again.`);
  }
  jar?.store(res);
  if (as === 'response') return res;
  if (!res.ok) {
    if (soft) return null;
    const hint = HINTS[res.status] || (res.status >= 500 ? 'the site has a problem right now, try again later' : 'unexpected answer');
    oops(`${host(url)} answered ${res.status} (${hint}): ${url.split('?')[0]}`);
  }
  try {
    if (as === 'json') return await res.json();
    if (as === 'text') return await res.text();
    return Buffer.from(await res.arrayBuffer());
  } catch {
    oops(`${host(url)} sent something unexpected. Try again in a minute.`);
  }
}

export const get = (url, as = 'buffer', opts = {}) => request(url, { ...opts, as });

// Big files (zips): streamed to disk, with a line before and after.
export async function download(url, file, { label, jar, referer } = {}) {
  const res = await request(url, { as: 'response', jar, referer, timeout: 15 * 60000 });
  if (!res.ok) oops(`${host(url)} answered ${res.status} for the download. Try again in a minute.`);
  const bytes = Number(res.headers.get('content-length')) || 0;
  console.log(`Downloading ${label || path.basename(file)}${bytes ? ` (${mb(bytes)})` : ''}...`);
  const started = Date.now();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part));
  } catch {
    fs.rmSync(part, { force: true });
    oops(`The download stopped halfway. Check the Wi-Fi and run the same command again.`);
  }
  fs.renameSync(part, file);
  console.log(`Downloaded in ${((Date.now() - started) / 1000).toFixed(0)} s (kept in .cache/, so next time is instant).`);
  return file;
}

// Run fn on every item, a few at a time.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// JSON kept in .cache/ for maxDays. If refreshing fails, an old copy is better than nothing.
export async function cachedJson(name, maxDays, make) {
  const file = path.join(CACHE, name);
  const fresh = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < maxDays * 86400000;
  if (fresh) return JSON.parse(fs.readFileSync(file, 'utf8'));
  try {
    const data = await make();
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    throw e;
  }
}

// ---------------------------------------------------------------- names, credits, sizes

export function safeName(s) {
  return String(s)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function credit(line) {
  const file = path.join(ASSETS, 'CREDITS.md');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '# Credits\n\nAll assets are CC0 (public domain) unless a line says otherwise.\n\n');
  if (!fs.readFileSync(file, 'utf8').includes(line)) fs.appendFileSync(file, `- ${line}\n`);
}

export const mb = (bytes) => `${(bytes / 1048576).toFixed(bytes < 104858 ? 2 : 1)} MB`;

export function sizeOf(p) {
  const bytes = fs.statSync(p).isDirectory()
    ? fs.readdirSync(p).reduce((sum, f) => sum + fs.statSync(path.join(p, f)).size, 0)
    : fs.statSync(p).size;
  return mb(bytes);
}

// Path as the game uses it (starts at public/).
export function rel(p) {
  return path.relative(path.join(ROOT, 'public'), p).split(path.sep).join('/');
}

export const num = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-US'));

// Licence names as we write them in credits. Anything else is not allowed in the game.
export function licence(text) {
  const t = String(text || '').toUpperCase();
  if (/CC0|PUBLIC DOMAIN/.test(t)) return 'CC0';
  const by = t.match(/CC[- ]BY[- ]?(\d\.\d)?$/) || t.match(/^CC[- ]BY[- ](\d\.\d)/);
  if (by && !/NC|ND|SA/.test(t)) return `CC-BY${by[1] ? ` ${by[1]}` : ''}`;
  return null;
}

// Fan art, brands and grown-up stuff: not for the kids' games (search results skip these).
const FAN_ART =
  /\b(spyro|pok[eé]mon|pikachu|mario|luigi|bowser|sonic|minecraft|creeper|fortnite|zelda|warcraft|alexstras?za|overwatch|star ?wars|darth|yoda|marvel|avengers|spider-?man|batman|superman|disney|mickey|pixar|lego|roblox|among ?us|master ?chief|nintendo|genshin|naruto|dragon ?ball|goku|dratini|charizard|eevee|bulbasaur|squirtle|kirby|pac-?man|harry ?potter|optimus prime|gundam|hello ?kitty|shrek|sexy|nsfw|nude|naked|bikini|lingerie|gore|nazi|swastika)\b/i;
export const fanArt = (title) => FAN_ART.test(String(title));

// Every search word matches a whole word of the text, plurals allowed: "car" finds "Race Car"
// and "cars" but not "Carton".
export function wordsMatch(text, words) {
  const have = String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.every((w) => {
    const q = String(w).toLowerCase();
    return have.some((h) => h.startsWith(q) && h.length <= q.length + 2);
  });
}

// Print rows as a padded table. cols: [[header, key, maxWidth]]
export function table(rows, cols) {
  const cell = (r, [, key, max = 40]) => {
    const v = String(typeof key === 'function' ? key(r) : (r[key] ?? ''));
    return v.length > max ? `${v.slice(0, max - 1)}…` : v;
  };
  const widths = cols.map((c) => Math.max(c[0].length, ...rows.map((r) => cell(r, c).length)));
  const line = (vals) => vals.map((v, i) => (i === vals.length - 1 ? v : v.padEnd(widths[i]))).join('  ').trimEnd();
  console.log(line(cols.map((c) => c[0])));
  for (const r of rows) console.log(line(cols.map((c) => cell(r, c))));
}

// Long lists of names, wrapped.
export function wrap(items, first = '  ', width = 100) {
  const indent = ' '.repeat(first.length);
  const lines = [];
  let cur = first;
  for (const [i, it] of items.entries()) {
    const piece = it + (i < items.length - 1 ? ', ' : '');
    if (cur.length + piece.length > width && cur.trim() !== first.trim()) {
      lines.push(cur.trimEnd());
      cur = indent;
    }
    cur += piece;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines.join('\n');
}

// ---------------------------------------------------------------- zips

// Minimal zip reader (no extra tools needed on Windows/Mac/Linux).
export function readZip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) oops('That file is not a zip (or the download broke). Delete it from .cache/downloads and try again.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.push({
      name,
      size,
      read() {
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const data = buf.subarray(start, start + compSize);
        if (method === 0) return data;
        if (method === 8) return zlib.inflateRawSync(data);
        oops(`${path.basename(name)} uses a zip compression this tool can't open. Unzip it by hand (mentor).`);
      },
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// URIs of textures/buffers a .glb or .gltf expects to find next to it.
export function gltfJson(buf) {
  if (buf.readUInt32LE(0) === 0x46546c67) return JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    oops('That file is not a 3D model (.glb/.gltf).');
  }
}
export function externalUris(buf) {
  const json = gltfJson(buf);
  return [...(json.buffers || []), ...(json.images || [])].map((x) => x.uri).filter((u) => u && !u.startsWith('data:'));
}

// .gltf (+ .bin + textures) or .glb on disk -> one .glb file.
export async function packToGlb(gltfPath, outPath) {
  const io = await gltfIO();
  const doc = await io.read(gltfPath);
  await io.write(outPath, doc);
}

// 1x1 white PNG, stands in for a missing texture while the model is read.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

// Returns a .glb buffer the engine can load: textures packed in, Draco removed.
//   resolve(uri) -> Buffer for files the model points to (zips, websites)
export async function makeLoadable(buf, { resolve, label = 'model' } = {}) {
  const json = gltfJson(buf);
  const used = [...(json.extensionsUsed || []), ...(json.extensionsRequired || [])];
  if (used.includes('KHR_texture_basisu')) oops(`${label} uses KTX2 textures, which the game can't load. Pick another one.`);
  const isGlb = buf.readUInt32LE(0) === 0x46546c67;
  const uris = externalUris(buf);
  const draco = used.includes('KHR_draco_mesh_compression');
  if (isGlb && !uris.length && !draco) return buf;
  const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-'));
  try {
    const main = path.join(tmp, isGlb ? 'model.glb' : 'model.gltf');
    fs.writeFileSync(main, buf);
    const images = new Set((json.images || []).map((i) => i.uri));
    const missing = new Set();
    for (const u of uris) {
      let data = resolve ? await resolve(decodeURIComponent(u)) : null;
      if (!data && images.has(u)) {
        // A texture the pack forgot: leave it out instead of losing the whole model.
        missing.add(u);
        data = PIXEL;
      }
      if (!data) oops(`${label} needs the file "${u}", which is missing.`);
      const p = path.join(tmp, decodeURIComponent(u));
      if (!p.startsWith(tmp)) oops(`${label} points outside its folder ("${u}"), so it was skipped.`);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, data);
    }
    const out = path.join(tmp, 'out.glb');
    const io = await gltfIO();
    const doc = await io.read(main);
    for (const tex of doc.getRoot().listTextures()) {
      if (missing.has(tex.getURI())) {
        console.log(`(${label}: texture "${tex.getURI()}" is missing in the pack, left out)`);
        tex.dispose();
      }
    }
    if (draco) await writeCompact(out, doc);
    else await io.write(out, doc);
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// One model per name from a zip: .glb preferred over .gltf, source/ folders skipped.
// Each item: { name, path, size, load() -> loadable .glb Buffer }
export function zipModels(entries) {
  const files = entries.filter((e) => !e.name.endsWith('/') && !/(^|\/)(__MACOSX|\._)/.test(e.name));
  const byPath = new Map(files.map((e) => [e.name, e]));
  const byLower = new Map(files.map((e) => [e.name.toLowerCase(), e]));
  const find = (from, uri) => {
    const want = path.posix.normalize(path.posix.join(path.posix.dirname(from), uri));
    const hit = byPath.get(want) || byLower.get(want.toLowerCase());
    if (hit) return hit;
    // Some packs keep textures in a different folder: same file name anywhere in the zip.
    const base = path.posix.basename(uri).toLowerCase();
    return files.find((e) => path.posix.basename(e.name).toLowerCase() === base);
  };
  const models = files.filter((e) => /\.(glb|gltf)$/i.test(e.name) && !/(^|\/)sources?\//i.test(e.name));
  const groups = new Map();
  for (const e of models) {
    const key = safeName(path.posix.basename(e.name).replace(/\.gltf(\.glb)?$/i, '').replace(/\.glb$/i, ''));
    (groups.get(key) || groups.set(key, []).get(key)).push(e);
  }
  const items = [];
  for (const [key, list] of groups) {
    const glb = list.filter((e) => /\.glb$/i.test(e.name));
    const pick = glb.length ? glb : list;
    for (const e of pick) {
      let name = key;
      if (pick.length > 1) {
        // Same name in different folders (e.g. "Origin at 0" and "Rigged to Head Bone"): add the folder that differs.
        const parts = e.name.split('/');
        const other = pick.find((o) => o !== e).name.split('/');
        const i = parts.findIndex((s, k) => s !== other[k]);
        name = `${key}_${safeName(parts[Math.min(i, parts.length - 2)])}`;
      }
      // .gltf models keep geometry in a .bin next to them: count it in the size estimate.
      const deps = [];
      if (/\.gltf$/i.test(e.name) && e.size < 2e6) {
        try {
          for (const u of externalUris(e.read())) {
            const d = find(e.name, decodeURIComponent(u));
            if (d) deps.push(d);
          }
        } catch {
          // a broken .gltf shows up as an error when it's saved
        }
      }
      items.push({
        name,
        path: e.name,
        size: e.size,
        files: [e, ...deps],
        load: () => makeLoadable(e.read(), { label: path.posix.basename(e.name), resolve: (u) => find(e.name, u)?.read() }),
      });
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- saving

function modelLine(file) {
  let info = null;
  try {
    info = gltfInfo(file);
  } catch {
    // still saved; inspect will say more
  }
  const bits = [sizeOf(file)];
  if (info) {
    bits.push(`${num(info.triangles)} triangles`);
    if (info.animations.length) {
      const names = info.animations.map((a) => a.name);
      bits.push(`${names.length} animation${names.length > 1 ? 's' : ''}: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ', ...' : ''}`);
    } else bits.push('no animations');
  }
  return { text: bits.join(', '), info };
}

// "public/assets/models/x", "assets/models/x" and "models/x" all mean the same folder.
const cleanFolder = (f) => String(f).replace(/\\/g, '/').replace(/^(\.\/)?(public\/)?(assets\/)?/, '');

function sizeCheck(bytes, flags, what) {
  if (bytes > MAX_MB * 1048576 && !flags.force) {
    oops(`${what} is ${mb(bytes)}: too big for school laptops (limit ${MAX_MB} MB). Pick a smaller one (or add --force if a mentor says OK).`);
  }
}

// Save one model, credit it, print how to use it. Returns [file].
//   opts: { folder: 'models/polypizza', name, credit: '"Title" by X, CC0, link', licence, flags }
export function saveModel(buf, { folder, name, credit: creditText, licence: lic = 'CC0', flags = {} }) {
  sizeCheck(buf.length, flags, 'This model');
  // A different model with the same name is already there (two "Dragon"s): use dragon_2.
  const credits = fs.existsSync(path.join(ASSETS, 'CREDITS.md')) ? fs.readFileSync(path.join(ASSETS, 'CREDITS.md'), 'utf8') : '';
  let out;
  for (let n = 1; ; n++) {
    out = path.join(ASSETS, cleanFolder(folder), `${safeName(name) || 'model'}${n > 1 ? `_${n}` : ''}.glb`);
    const line = credits.split('\n').find((l) => l.startsWith(`- ${rel(out)}: `));
    if (!fs.existsSync(out) || !line || line === `- ${rel(out)}: ${creditText}`) break;
  }
  const existed = fs.existsSync(out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  credit(`${rel(out)}: ${creditText}`);
  const { text, info } = modelLine(out);
  console.log(`\nSaved public/${rel(out)} (${text})${existed ? ' - replaced the old file' : ''}`);
  if (buf.length > WARN_MB * 1048576) {
    console.log(`Too big for a game (${mb(buf.length)}): shrink it now and use the small copy:`);
    console.log(`  npm run remix -- shrink public/${rel(out)}`);
  }
  if (info?.triangles > 150000) console.log(`Heads up: ${num(info.triangles)} triangles is a lot. Fine for one, slow if you place many.`);
  console.log(`Use it:  await loadModel('${rel(out)}', { height: 2 })`);
  if (lic !== 'CC0') console.log(`Licence ${lic}: put the author in the game's credits screen (CREDITS.md has the line).`);
  return [out];
}

// Save several models from a kit/pack. Big packs without --only/--all just print the names.
//   items from zipModels() or similar: { name, path, size, load() }
//   opts: { title, folder, credit, cmd, flags, limit }
export async function savePack(items, { title, folder, credit: creditText, cmd, flags = {}, limit = 40 }) {
  if (!items.length) oops(`${title} has no .glb/.gltf models inside (maybe only FBX/OBJ). Pick another pack.`);
  const seen = new Map();
  for (const it of items) {
    const k = seen.get(it.name) || 0;
    seen.set(it.name, k + 1);
    if (k) it.name = `${it.name}_${k + 1}`;
  }
  const words = String(flags.only === true ? '' : flags.only || '')
    .split(/[,\s]+/)
    .map(safeName)
    .filter(Boolean);
  let chosen = items;
  if (words.length) {
    // An exact name wins ("police" = police, not tractor_police); otherwise any name containing the word.
    const pick = (w) => (items.some((it) => it.name === w) ? items.filter((it) => it.name === w) : items.filter((it) => it.name.includes(w)));
    chosen = [...new Set(words.flatMap(pick))];
    if (!chosen.length) chosen = items.filter((it) => words.some((w) => safeName(it.path).includes(w)));
    if (!chosen.length) {
      console.log(`No model names in ${title} contain "${words.join('", "')}". The names are:`);
      printNames(items);
      return [];
    }
  } else if (items.length > limit && !flags.all) {
    const files = new Map(items.flatMap((it) => (it.files || [{ name: it.path, size: it.size || 0 }]).map((f) => [f.name, f.size])));
    const total = [...files.values()].reduce((s, n) => s + n, 0);
    console.log(`${title} has ${items.length} models. That's a lot, so pick a few by words in their names:`);
    console.log(`  ${cmd} --only "${exampleWords(items)}"`);
    console.log(`  ${cmd} --all            (all ${items.length}${total ? `, about ${mb(total)}` : ''})\n`);
    printNames(items);
    return [];
  }
  const dir = path.join(ASSETS, cleanFolder(folder));
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  const skipped = [];
  let bytes = 0;
  for (const it of chosen) {
    let buf;
    try {
      buf = await it.load();
      sizeCheck(buf.length, flags, it.name);
    } catch (e) {
      if (!(e instanceof Oops)) throw e;
      skipped.push(`${it.name}: ${e.message}`);
      continue;
    }
    const out = path.join(dir, `${it.name}.glb`);
    fs.writeFileSync(out, buf);
    bytes += buf.length;
    saved.push(out);
  }
  if (!saved.length) oops(`Nothing saved from ${title}. ${skipped[0] || ''}`);
  credit(`${rel(dir)}/: ${creditText}`);
  const names = saved.map((f) => path.basename(f, '.glb'));
  console.log(`\nSaved ${saved.length} model${saved.length > 1 ? 's' : ''} to public/${rel(dir)}/ (${mb(bytes)}):`);
  console.log(wrap(names));
  for (const s of skipped) console.log(`Skipped ${s}`);
  const big = saved.filter((f) => fs.statSync(f).size > WARN_MB * 1048576);
  if (big.length) console.log(`Heads up: ${big.map((f) => `${path.basename(f, '.glb')} (${sizeOf(f)})`).join(', ')} ${big.length > 1 ? 'are' : 'is'} big, so the game will take longer to load.`);
  const first = modelLine(saved[0]);
  console.log(`Use it:  await loadModel('${rel(saved[0])}', { height: 2 })   (${names[0]}: ${first.text})`);
  return saved;
}

function printNames(items) {
  // Group by folder (when there are several), then by first word: "debris: bolt, bumper, ..."
  const folders = new Map();
  for (const it of items) {
    const dir = path.posix.dirname(it.path).split('/').slice(1).join('/') || '.';
    (folders.get(dir) || folders.set(dir, []).get(dir)).push(it.name);
  }
  for (const [dir, names] of folders) {
    if (folders.size > 1) console.log(`${dir}/`);
    const byWord = new Map();
    for (const n of names) {
      const w = n.split('_')[0];
      (byWord.get(w) || byWord.set(w, []).get(w)).push(n);
    }
    const groups = [...byWord].filter(([, list]) => list.length >= 4);
    const loose = [...byWord].filter(([, list]) => list.length < 4).flatMap(([, list]) => list);
    if (loose.length) console.log(wrap(loose));
    for (const [w, list] of groups) console.log(wrap(list.map((n) => n.slice(w.length + 1) || n), `  ${w}_*: `));
  }
}

function exampleWords(items) {
  const firsts = [...new Set(items.map((it) => it.name.split('_')[0]))];
  return firsts.slice(0, 2).join(',') || items[0].name;
}

// ---------------------------------------------------------------- preview pictures

// Saves .previews/thumbs/<source>/<n>.<ext> plus sheet.jpg (all of them, numbered).
export async function saveThumbs(source, list) {
  const dir = path.join(ROOT, '.previews', 'thumbs', source);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const files = await mapLimit(list, 6, async ({ n, url }) => {
    if (!url) return null;
    const res = await request(url, { as: 'response', timeout: 30000 }).catch(() => null);
    if (!res?.ok) return null;
    const type = res.headers.get('content-type') || '';
    const ext = /webp/.test(type) ? 'webp' : /png/.test(type) ? 'png' : /jpe?g/.test(type) ? 'jpg' : path.extname(new URL(url).pathname).slice(1) || 'jpg';
    const file = path.join(dir, `${n}.${ext}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return { n, file };
  });
  const ok = files.filter(Boolean);
  if (!ok.length) return console.log('(No preview pictures could be downloaded.)');
  const sheet = await contactSheet(ok, path.join(dir, 'sheet.jpg'));
  const shown = path.relative(ROOT, dir).split(path.sep).join('/');
  console.log(`\nPictures: ${sheet ? `${shown}/sheet.jpg (all, numbered) and ` : ''}${shown}/1.${path.extname(ok[0].file).slice(1)} ... (one per result number)`);
}

async function contactSheet(files, out) {
  try {
    const sharp = (await import('sharp')).default;
    const W = 256;
    const T = 192;
    const cols = Math.min(4, files.length);
    const rows = Math.ceil(files.length / cols);
    const tiles = await Promise.all(
      files.map(async ({ n, file }, i) => {
        const img = await sharp(file).resize(W, T, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).toBuffer();
        const label = Buffer.from(
          `<svg width="${W}" height="${T}"><rect x="6" y="6" width="44" height="34" rx="8" fill="#222"/><text x="28" y="31" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" fill="#fff" text-anchor="middle">${n}</text></svg>`,
        );
        return [
          { input: img, left: (i % cols) * W, top: Math.floor(i / cols) * T },
          { input: label, left: (i % cols) * W, top: Math.floor(i / cols) * T },
        ];
      }),
    );
    await sharp({ create: { width: cols * W, height: rows * T, channels: 3, background: '#ffffff' } })
      .composite(tiles.flat())
      .jpeg({ quality: 80 })
      .toFile(out);
    return out;
  } catch {
    return null; // single pictures are still there
  }
}
