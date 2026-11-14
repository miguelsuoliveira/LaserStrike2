#!/usr/bin/env node
// Free asset helper. Everything lands in public/assets and is listed in
// public/assets/CATALOG.md (what the AI reads) and CREDITS.md (who made it).
// Every get prints the size and the loadModel('assets/models/...') path to use.
//
//   npm run assets -- catalog                       rebuild CATALOG.md after adding files by hand
//   npm run assets -- polyhaven search tree         realistic models, skies, textures (CC0); also: search tree
//   npm run assets -- polyhaven fir_tree_01         download one (1k). Options: --res 2k --name x --folder models/x
//   npm run assets -- pizza search dragon           low-poly single models (CC0/CC-BY) [--by Kenney|Quaternius|KayKit] [--cc0] [--animated] [--thumbs]
//   npm run assets -- pizza get <id>                [--name x] [--folder models/characters]
//   npm run assets -- kenney list [word]            Kenney 3D kits (CC0)   kenney get <kit> [--only "a,b"] [--all]
//   npm run assets -- kaykit list                   KayKit packs (CC0)     kaykit get <pack> [--only "a,b"] [--all]
//   npm run assets -- quaternius list [word]        Quaternius packs (CC0) quaternius get <pack> [--only "a,b"] [--all]
//   npm run assets -- itch get <creator>/<game>     a free itch.io pack [--file word] [--only "a,b"] [--all]
//   npm run assets -- smithsonian search skull      museum scans (CC0, checked)   smithsonian get <id> [--small]
//   npm run assets -- objaverse search dragon       6,000 models (mostly CC-BY) [--cc0] [--animated] [--max-tris N] [--thumbs]
//   npm run assets -- objaverse get <id>            [--lod 1|2|3] [--name x]
//   npm run assets -- url <https://...file.glb> --author "Name" --license CC0 [--folder models/props] [--name x]
//   npm run assets -- zip ~/Downloads/pack.zip --author Kenney --license CC0 [--folder models/pack_name]
//        (unpacks only .glb/.gltf models and .ogg/.mp3/.wav sounds)
//   npm run assets -- sounds                        convert .ogg/.wav in public/assets/sounds to .mp3 (needs ffmpeg)
// Big kits list their model names first: pick with --only. Over 5 MB warns, over 30 MB needs --force.
// --thumbs saves numbered preview pictures in .previews/thumbs/<source>/ (sheet.jpg shows all).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gltfInfo } from './lib/gltf-info.mjs';
import { ASSETS, MAX_MB, ROOT, WARN_MB, Oops, credit, externalUris, get, makeLoadable, mb, packToGlb, readZip, rel, safeName, sizeOf, zipModels } from './lib/asset-tools.mjs';
import * as pizza from './sources/pizza.mjs';
import * as kenney from './sources/kenney.mjs';
import * as kaykit from './sources/kaykit.mjs';
import * as quaternius from './sources/quaternius.mjs';
import * as itch from './sources/itch.mjs';
import * as smithsonian from './sources/smithsonian.mjs';
import * as objaverse from './sources/objaverse.mjs';

try {
  process.loadEnvFile(path.join(ROOT, '.env')); // optional keys: SI_API_KEY, GITHUB_TOKEN
} catch {
  // no .env: fine
}

const BOOL = new Set(['all', 'animated', 'cc0', 'force', 'small', 'thumbs', 'no-catalog']);
const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const name = rest[i].slice(2);
    flags[name] = BOOL.has(name) || !rest[i + 1] || rest[i + 1].startsWith('--') ? true : rest[++i];
  } else args.push(rest[i]);
}

// ---------------------------------------------------------------- Poly Haven

let phIndex = null;
async function polyhavenIndex() {
  if (!phIndex) phIndex = await get('https://api.polyhaven.com/assets?t=all', 'json');
  return phIndex;
}

async function search(words = args) {
  words = words.map((w) => w.toLowerCase());
  if (!words.length) return console.log('Usage: npm run assets -- search <words>');
  const index = await polyhavenIndex();
  const TYPES = ['sky (hdri)', 'texture', 'model'];
  const hits = Object.entries(index)
    .filter(([id, a]) => {
      const text = [id, a.name, ...(a.tags || []), ...(a.categories || [])].join(' ').toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => (b[1].download_count || 0) - (a[1].download_count || 0))
    .slice(0, 25);
  if (!hits.length) return console.log('Nothing found on Poly Haven. Try a simpler word (tree, rock, sky, wood).');
  console.log('Poly Haven results (CC0). Download with: npm run assets -- polyhaven <id>\n');
  for (const [id, a] of hits) console.log(`${id.padEnd(36)} ${TYPES[a.type].padEnd(11)} ${(a.categories || []).slice(0, 3).join(', ')}`);
}

async function polyhaven() {
  if (args[0] === 'search') return search(args.slice(1));
  const id = args[0] === 'get' ? args[1] : args[0];
  if (!id) return console.log('Usage: npm run assets -- polyhaven search <words>   or   npm run assets -- polyhaven <id> [--res 1k]');
  const res = flags.res || '1k';
  const info = await get(`https://api.polyhaven.com/info/${id}`, 'json');
  const files = await get(`https://api.polyhaven.com/files/${id}`, 'json');
  const authors = Object.keys(info.authors || {}).join(', ') || 'Poly Haven';
  const name = flags.name || safeName(id);
  let saved;

  if (info.type === 0) {
    const file = files.hdri?.[res]?.hdr;
    if (!file) throw new Error(`No ${res} HDR for ${id}`);
    saved = path.join(ASSETS, flags.folder || 'hdri', `${name}.hdr`);
    fs.mkdirSync(path.dirname(saved), { recursive: true });
    fs.writeFileSync(saved, await get(file.url));
  } else if (info.type === 1) {
    const dir = path.join(ASSETS, flags.folder || 'textures', name);
    fs.mkdirSync(dir, { recursive: true });
    const pickMap = (keys) => keys.map((k) => files[k]?.[res]?.jpg || files[k]?.[res]?.png).find(Boolean);
    const maps = { 'color.jpg': pickMap(['Diffuse', 'diff']), 'normal.jpg': pickMap(['nor_gl']), 'arm.jpg': pickMap(['arm']) };
    for (const [file, entry] of Object.entries(maps)) if (entry) fs.writeFileSync(path.join(dir, file), await get(entry.url));
    saved = dir;
  } else {
    const entry = files.gltf?.[res]?.gltf;
    if (!entry) throw new Error(`No ${res} glTF for ${id}`);
    // Trees and big plants are hundreds of MB: check before downloading.
    const bytes = entry.size + Object.values(entry.include || {}).reduce((sum, inc) => sum + (inc.size || 0), 0);
    if (bytes > MAX_MB * 1048576 && !flags.force) {
      throw new Oops(`"${info.name}" is ${mb(bytes)} at ${res}: too big for school laptops (limit ${MAX_MB} MB). Pick another one (or add --force if a mentor says OK).`);
    }
    const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-'));
    try {
      const main = path.join(tmp, path.basename(entry.url));
      fs.writeFileSync(main, await get(entry.url));
      for (const [relPath, inc] of Object.entries(entry.include || {})) {
        const p = path.join(tmp, relPath);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, await get(inc.url));
      }
      saved = path.join(ASSETS, flags.folder || 'models/realistic', `${name}.glb`);
      fs.mkdirSync(path.dirname(saved), { recursive: true });
      await packToGlb(main, saved);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  credit(`${rel(saved)}: "${info.name}" by ${authors}, CC0, https://polyhaven.com/a/${id}`);
  console.log(`Saved ${rel(saved)} (${sizeOf(saved)})`);
  if (fs.statSync(saved).isFile() && fs.statSync(saved).size > WARN_MB * 1048576) console.log('Heads up: that is big, so the game will take longer to load.');
  const use = { 0: `await world.setSky('${rel(saved)}')`, 1: `box({ texture: '${rel(saved)}' })` }[info.type] || `await loadModel('${rel(saved)}', { height: 1 })`;
  console.log(`Use it:  ${use}`);
  if (!flags['no-catalog']) await catalog(true);
}

// ---------------------------------------------------------------- any URL / zip

async function url() {
  const link = args[0];
  if (!link || !flags.author || !flags.license) {
    return console.log('Usage: npm run assets -- url <link> --author "Name" --license CC0 [--folder models/props] [--name x]');
  }
  if (!/cc0|cc-by|public domain|mit/i.test(flags.license)) {
    console.log(`Warning: license "${flags.license}" may not allow sharing. Prefer CC0.`);
  }
  const raw = link.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  const ext = path.extname(new URL(raw).pathname).toLowerCase();
  const folder = flags.folder || (['.ogg', '.mp3', '.wav'].includes(ext) ? 'sounds' : ['.hdr'].includes(ext) ? 'hdri' : 'models/props');
  const name = flags.name || safeName(path.basename(raw).replace(/\.gltf\.glb$/i, ''));
  const out = path.join(ASSETS, folder, `${name}${ext === '.gltf' ? '.glb' : ext}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (ext === '.gltf') {
    // A .gltf needs its .bin and texture files: download them all, then pack into one .glb.
    const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-'));
    try {
      const text = await get(raw);
      const json = JSON.parse(text.toString('utf8'));
      const main = path.join(tmp, 'model.gltf');
      fs.writeFileSync(main, text);
      const uris = [...(json.buffers || []), ...(json.images || [])].map((x) => x.uri).filter((u) => u && !u.startsWith('data:'));
      for (const u of uris) {
        const p = path.join(tmp, decodeURIComponent(u));
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, await get(new URL(u, raw).toString()));
      }
      await packToGlb(main, out);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } else {
    const data = await get(raw);
    const external = ext === '.glb' ? externalUris(data) : [];
    if (external.length) {
      // Some .glb files (Kenney kits) keep textures in separate files: fetch them and pack them in.
      const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-'));
      try {
        const main = path.join(tmp, 'model.glb');
        fs.writeFileSync(main, data);
        for (const u of external) {
          const p = path.join(tmp, decodeURIComponent(u));
          fs.mkdirSync(path.dirname(p), { recursive: true });
          fs.writeFileSync(p, await get(new URL(u, raw).toString()));
        }
        await packToGlb(main, out);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    } else {
      fs.writeFileSync(out, ext === '.glb' ? await makeLoadable(data) : data); // Draco -> meshopt
    }
  }
  credit(`${rel(out)}: by ${flags.author}, ${flags.license}, ${link}`);
  console.log(`Saved ${rel(out)} (${sizeOf(out)})`);
  if (!flags['no-catalog']) await catalog(true);
}

async function zip() {
  const file = args[0];
  if (!file || !flags.author || !flags.license) {
    return console.log('Usage: npm run assets -- zip <file.zip> --author "Kenney" --license CC0 [--folder models/pack_name]');
  }
  const pack = safeName(path.basename(file));
  const entries = readZip(fs.readFileSync(file)).filter((e) => !e.name.endsWith('/') && !e.name.includes('__MACOSX'));
  // .glb preferred, .gltf packed into .glb, textures next to the model packed in (Kenney "GLB format").
  const models = zipModels(entries);
  const audio = entries.filter((e) => /\.(ogg|mp3|wav)$/i.test(e.name));
  let n = 0;
  const modelDir = path.join(ASSETS, flags.folder || `models/${pack}`);
  for (const m of models) {
    try {
      const buf = await m.load();
      fs.mkdirSync(modelDir, { recursive: true });
      fs.writeFileSync(path.join(modelDir, `${m.name}.glb`), buf);
      n++;
    } catch (e) {
      if (!(e instanceof Oops)) throw e;
      console.log(`Skipped ${m.name}: ${e.message}`);
    }
  }
  const soundDir = path.join(ASSETS, flags.soundFolder || `sounds/${pack}`);
  for (const e of audio) {
    fs.mkdirSync(soundDir, { recursive: true });
    fs.writeFileSync(path.join(soundDir, `${safeName(path.basename(e.name))}${path.extname(e.name).toLowerCase()}`), e.read());
    n++;
  }
  if (models.length) credit(`${rel(modelDir)}/: by ${flags.author}, ${flags.license}, ${flags.source || path.basename(file)}`);
  if (audio.length) credit(`${rel(soundDir)}/: by ${flags.author}, ${flags.license}, ${flags.source || path.basename(file)}`);
  console.log(`Unpacked ${n} files (${models.length} models, ${audio.length} sounds).`);
  if (audio.some((e) => !/\.mp3$/i.test(e.name))) await sounds();
  await catalog(true);
}

// .ogg/.wav -> .mp3 so every browser (Safari too) can play them.
async function sounds() {
  const dir = path.join(ASSETS, 'sounds');
  let ok = true;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    ok = false;
  }
  if (!ok) return console.log('ffmpeg not found: keeping .ogg/.wav files (fine in Chrome, Edge and Firefox).');
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of fs.existsSync(dir) ? walk(dir) : []) {
    if (!/\.(ogg|wav)$/i.test(f)) continue;
    const out = f.replace(/\.(ogg|wav)$/i, '.mp3');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-ac', '1', '-b:a', '96k', out]);
    fs.rmSync(f);
  }
  console.log('Sounds converted to .mp3');
}

// ---------------------------------------------------------------- catalog

async function catalog(quiet = false) {
  const lines = [
    '# Asset catalog',
    '',
    'Auto-generated by `npm run assets -- catalog`. Paths start at public/, so use them as written:',
    "`loadModel('assets/models/...')`, `sound.play('assets/sounds/...')`, `loadMaterial('assets/textures/...')`.",
    'Sizes are meters before scaling (loadModel `height`/`size` options rescale). Details: `npm run inspect -- public/<path>`.',
    'Everything here is free to use: CC0, or CC-BY where CREDITS.md says so (CC-BY authors go in the game credits).',
    '',
  ];
  const walk = (d) =>
    fs.existsSync(d)
      ? fs
          .readdirSync(d, { withFileTypes: true })
          .sort((a, b) => a.name.localeCompare(b.name))
          .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
      : [];

  // Models, grouped by folder.
  const models = walk(path.join(ASSETS, 'models')).filter((f) => /\.(glb|gltf)$/i.test(f));
  const byFolder = {};
  for (const f of models) (byFolder[rel(path.dirname(f))] ||= []).push(f);
  const animSets = new Map();
  const dims = (s) => s.map((v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))).join(' x ');
  for (const [folder, files] of Object.entries(byFolder)) {
    lines.push(`## ${folder}/`, '');
    const notes = path.join(ASSETS, '..', folder, 'NOTES.md');
    if (fs.existsSync(notes)) lines.push(fs.readFileSync(notes, 'utf8').trim(), '');
    const plain = [];
    for (const f of files) {
      let info;
      try {
        info = gltfInfo(f);
      } catch {
        plain.push(`${path.basename(f)} (unreadable)`);
        continue;
      }
      const name = path.basename(f);
      if (info.animations.length) {
        const key = info.animations.map((a) => a.name).join(', ');
        let anims;
        if (animSets.has(key)) anims = `same animations as ${animSets.get(key)}`;
        else {
          animSets.set(key, name);
          anims = `animations: ${key}`;
        }
        lines.push(`- **${name}** ${dims(info.size)} m, ${info.rigged ? 'rigged' : 'animated parts (no skeleton)'}; ${anims}`);
      } else {
        plain.push(`${name.replace(/\.(glb|gltf)$/, '')} (${dims(info.size)})`);
      }
    }
    if (plain.length) lines.push(`- ${plain.join(', ')}`);
    lines.push('');
  }

  const hdri = walk(path.join(ASSETS, 'hdri')).filter((f) => /\.hdr$/i.test(f));
  if (hdri.length) {
    lines.push('## Skies (HDRI photos)', '', "Use with `world.setSky('assets/hdri/<name>.hdr')`.", '');
    lines.push(`- ${hdri.map((f) => path.basename(f, '.hdr')).join(', ')}`, '');
  }
  const textures = fs.existsSync(path.join(ASSETS, 'textures'))
    ? fs.readdirSync(path.join(ASSETS, 'textures')).filter((d) => fs.existsSync(path.join(ASSETS, 'textures', d, 'color.jpg')))
    : [];
  if (textures.length) {
    lines.push('## Textures (realistic surfaces)', '', "Use with `box({ texture: 'assets/textures/<name>' })`, `ground({ texture })` or `await loadMaterial('assets/textures/<name>')`.", '');
    lines.push(`- ${textures.sort().join(', ')}`, '');
  }
  const audio = walk(path.join(ASSETS, 'sounds')).concat(walk(path.join(ASSETS, 'music'))).filter((f) => /\.(mp3|ogg|wav|m4a)$/i.test(f));
  if (audio.length) {
    lines.push('## Sounds and music', '', "Use with `sound.play('assets/sounds/<folder>/<file>')` or `sound.music(...)`. No file needed for `sfx('coin')` etc.", '');
    const byDir = {};
    for (const f of audio) (byDir[rel(path.dirname(f))] ||= []).push(path.basename(f));
    for (const [d, names] of Object.entries(byDir)) lines.push(`- ${d}/: ${names.join(', ')}`);
    lines.push('');
  }
  const images = walk(path.join(ASSETS, 'images')).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  if (images.length) {
    lines.push('## Images (drawings, photos, logos)', '', "Use with `await loadTexture('assets/images/<file>')`.", '');
    lines.push(`- ${images.map((f) => rel(f)).join(', ')}`, '');
  }
  fs.writeFileSync(path.join(ASSETS, 'CATALOG.md'), lines.join('\n'));
  if (quiet !== 'silent') console.log(`Updated public/assets/CATALOG.md (${models.length} models, ${hdri.length} skies, ${textures.length} textures, ${audio.length} sounds)`);
}

// ---------------------------------------------------------------- run the command

const commands = { catalog, search, polyhaven, url, zip, sounds };
const sources = { pizza, kenney, kaykit, quaternius, itch, smithsonian, objaverse };
try {
  if (sources[cmd]) {
    const src = sources[cmd];
    const sub = args[0];
    const fn = ['search', 'list', 'get'].includes(sub) && src[sub];
    if (!fn) {
      console.log(src.usage);
      process.exit(sub ? 1 : 0);
    }
    const saved = await fn(args.slice(1), flags);
    if (saved?.length && !flags['no-catalog']) {
      await catalog('silent');
      console.log('Added to CATALOG.md and CREDITS.md.');
    }
  } else if (commands[cmd]) {
    await commands[cmd]();
  } else {
    const lines = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1);
    const help = lines.slice(0, lines.findIndex((l) => !l.startsWith('//')));
    console.log(help.join('\n').replace(/^\/\/ ?/gm, ''));
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  // One helpful line, never a stack trace (DEBUG=1 shows it).
  console.log(e instanceof Oops ? e.message : `Problem: ${e.message}`);
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
}
