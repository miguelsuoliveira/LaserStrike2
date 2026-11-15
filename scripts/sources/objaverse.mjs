// Objaverse (objaverse.allenai.org, Allen Institute for AI): 800,000 Sketchfab models with their licences.
//   Default: the whole Objaverse 1.0 set. Search goes through Sketchfab's public search (best matches first),
//   keeps the models that are in Objaverse with a CC0 or CC-BY licence, and downloads the .glb from the
//   Objaverse files on Hugging Face (allenai/objaverse, no account needed).
//   --checked: only the 6,015 hand-checked models of the "clean" set (Hugging Face codepawl/objaverse-clean-glb:
//   licences, brands, fan art and grown-up content checked; "web" and "lods" files load in our engine).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { CACHE, ROOT, UA, WARN_MB, MAX_MB, download, fanArt, wordsMatch, get as fetchUrl, licence, makeLoadable, mb, num, oops, saveModel, saveThumbs, table, mapLimit, request } from '../lib/asset-tools.mjs';

const BASE = 'https://huggingface.co/datasets/codepawl/objaverse-clean-glb/resolve/main';
const OV = 'https://huggingface.co/datasets/allenai/objaverse/resolve/main';
const SKETCHFAB = 'https://api.sketchfab.com/v3';

export const usage = `Objaverse: 800,000 models of almost anything (objaverse.allenai.org; CC-BY: credit the author)
  npm run assets -- objaverse search dragon [--thumbs] [--animated] [--max-tris 20000] [--cc0]
  npm run assets -- objaverse get <id> [--name x] [--folder models/props] [--big]
  --checked: search only the 6,000 hand-checked models (safer, smaller): objaverse search dragon --checked
             and get them with: objaverse get <id> [--lod 1|2|3]`;

// ---------------------------------------------------------------- the whole Objaverse (800,000 models)

let pathsCache = null;
async function objaversePaths() {
  if (pathsCache) return pathsCache;
  const file = path.join(CACHE, 'objaverse-object-paths.json.gz');
  if (!fs.existsSync(file)) await download(`${OV}/object-paths.json.gz`, file, { label: 'the list of all 800,000 Objaverse models (20 MB, once)' });
  pathsCache = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  return pathsCache;
}

// Sketchfab licence names -> ours (CC0 and CC-BY only: the others don't allow changes or need share-alike).
function sketchfabLicence(label) {
  const l = String(label || '').toLowerCase();
  if (l === 'cc0 public domain' || l === 'cc0') return 'CC0';
  if (l === 'cc attribution' || l === 'cc-by' || l === 'by') return 'CC-BY 4.0';
  return null;
}

const FOUND = path.join(CACHE, 'objaverse-found.json');
function remember(rows) {
  let found = {};
  try {
    found = JSON.parse(fs.readFileSync(FOUND, 'utf8'));
  } catch {
    // first search
  }
  for (const r of rows) found[r.uid] = { name: r.name, author: r.author, authorUrl: r.authorUrl, licence: r.licence, url: r.url, tris: r.tris, animated: r.animated };
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(FOUND, JSON.stringify(found));
}

function thumbOf(r) {
  const imgs = (r.thumbnails?.images || []).slice().sort((a, b) => a.width - b.width);
  return (imgs.find((i) => i.width >= 256) || imgs.at(-1))?.url;
}

async function searchAll(words, flags) {
  const paths = await objaversePaths();
  const maxTris = Number(flags['max-tris']) || 0;
  const params = new URLSearchParams({ type: 'models', q: words.join(' '), downloadable: 'true', count: '24' });
  if (flags.animated) params.set('animated', 'true');
  if (maxTris) params.set('max_face_count', String(maxTris));
  let url = `${SKETCHFAB}/search?${params}`;
  const hits = [];
  let seen = 0;
  for (let page = 0; page < 5 && url && hits.length < 12; page++) {
    const res = await request(url, { as: 'json', timeout: 30000, soft: true });
    if (!res) oops('Sketchfab search did not answer. Try again in a minute, or use --checked (works from the saved list).');
    for (const r of res.results || []) {
      seen++;
      const lic = sketchfabLicence(r.license?.label);
      if (!paths[r.uid] || !lic || r.isAgeRestricted) continue;
      if (flags.cc0 && lic !== 'CC0') continue;
      if (fanArt(`${r.name} ${(r.tags || []).map((t) => t.name).join(' ')}`)) continue;
      hits.push({
        uid: r.uid,
        name: r.name.trim(),
        author: r.user?.displayName || r.user?.username || 'unknown',
        authorUrl: r.user?.profileUrl || `https://sketchfab.com/${r.user?.username}`,
        licence: lic,
        url: `https://sketchfab.com/3d-models/${r.uid}`,
        tris: r.faceCount,
        animated: r.animationCount || 0,
        thumb: thumbOf(r),
      });
    }
    url = res.next;
  }
  const shown = hits.slice(0, 12).map((r, i) => ({ ...r, n: i + 1 }));
  if (!shown.length) return console.log(`No Objaverse model for "${words.join(' ')}" (looked at ${seen} Sketchfab results). Try one simpler word, or --checked.`);
  // File sizes (without downloading): Hugging Face says how big each file is.
  await mapLimit(shown, 6, async (r) => {
    const head = await fetch(`${OV}/${paths[r.uid]}`, { method: 'HEAD', redirect: 'manual', headers: UA, signal: AbortSignal.timeout(15000) }).catch(() => null);
    r.bytes = Number(head?.headers.get('x-linked-size') || head?.headers.get('content-length')) || 0;
  });
  remember(shown);
  console.log(`Objaverse results for "${words.join(' ')}" (best matches first). Get one with: npm run assets -- objaverse get <id>\n`);
  table(shown, [
    ['#', 'n'],
    ['id', 'uid', 32],
    ['title', 'name', 30],
    ['by', 'author', 16],
    ['licence', 'licence'],
    ['triangles', (r) => num(r.tris)],
    ['file', (r) => (r.bytes ? mb(r.bytes) : '?')],
    ['animated', (r) => (r.animated ? `${r.animated}` : '')],
  ]);
  console.log('\nCC-BY = free, but the author must be named in the game credits. Styles vary (cartoon, realistic, scans):');
  console.log('look at the pictures (--thumbs). Over 5 MB or 60,000 triangles: get makes a lighter copy for you.');
  if (flags.thumbs) await saveThumbs('objaverse', shown.map((r) => ({ n: r.n, url: r.thumb })));
}

async function getAll(uid, flags) {
  const paths = await objaversePaths();
  if (!paths[uid]) oops(`"${uid}" is not in Objaverse. Copy the id from the search results.`);
  let info = null;
  try {
    info = JSON.parse(fs.readFileSync(FOUND, 'utf8'))[uid];
  } catch {
    // not searched on this computer
  }
  if (!info) {
    const r = await request(`${SKETCHFAB}/models/${uid}`, { as: 'json', soft: true, timeout: 30000 });
    if (r) info = { name: r.name, author: r.user?.displayName || r.user?.username, authorUrl: r.user?.profileUrl, licence: sketchfabLicence(r.license?.label), url: `https://sketchfab.com/3d-models/${uid}` };
  }
  if (!info) oops(`Couldn't find who made "${uid}" (needed for the credits). Search for it first, then get it.`);
  if (!info.licence) oops(`"${info.name}" isn't CC0 or CC-BY, so it can't go in the game. Pick another one.`);
  const fileUrl = `${OV}/${paths[uid]}`;
  const head = await fetch(fileUrl, { method: 'HEAD', redirect: 'manual', headers: UA, signal: AbortSignal.timeout(15000) }).catch(() => null);
  const bytes = Number(head?.headers.get('x-linked-size') || head?.headers.get('content-length')) || 0;
  if (bytes > 80 * 1048576 && !flags.force) oops(`"${info.name}" is ${mb(bytes)}: too big to download for a game. Pick a smaller one.`);
  console.log(`Downloading "${info.name}" (${bytes ? mb(bytes) : 'size unknown'})...`);
  const buf = await makeLoadable(await fetchUrl(fileUrl, 'buffer', { timeout: 10 * 60000 }), { label: info.name });
  const lic = info.licence;
  const credit = `"${info.name}" by ${info.author} (${info.authorUrl}), ${lic === 'CC0' ? 'CC0' : 'CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/)'}, ${info.url}, via Objaverse (Allen Institute for AI), changed: converted/resized`;
  // Raw Sketchfab files are often big: save the original, then make a light copy for the game.
  const big = buf.length > WARN_MB * 1048576 || (info.tris || 0) > 60000;
  const [saved] = saveModel(buf, { folder: flags.folder || 'models/objaverse', name: flags.name || info.name, credit, licence: lic, flags: { ...flags, force: flags.force || (big && !flags.big) } });
  if (!big || flags.big) return [saved];
  const out = saved.replace(/\.glb$/, '_small.glb');
  console.log(`\nMaking a lighter copy for the game (20,000 triangles, 1024 px textures)...`);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/remix.mjs'), 'shrink', saved, '--out', path.basename(out)], { stdio: 'inherit' });
  if (r.status === 0 && fs.existsSync(out)) {
    fs.rmSync(saved); // the game only needs the light copy (the remix credit line keeps the author)
    const credits = path.join(ROOT, 'public/assets/CREDITS.md');
    const line = `- ${path.relative(path.join(ROOT, 'public'), saved).split(path.sep).join('/')}: `;
    if (fs.existsSync(credits)) fs.writeFileSync(credits, fs.readFileSync(credits, 'utf8').split('\n').filter((l) => !l.startsWith(line)).join('\n'));
    console.log(`Use the light copy: await loadModel('${path.relative(path.join(ROOT, 'public'), out).split(path.sep).join('/')}', { height: 2 })`);
    return [out];
  }
  return [saved];
}

// ---------------------------------------------------------------- the 6,000 checked models (--checked)

let rowsCache = null;
async function rows() {
  if (rowsCache) return rowsCache;
  const file = path.join(CACHE, 'objaverse-metadata.jsonl');
  const old = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs > 30 * 86400000;
  if (!fs.existsSync(file) || old) {
    try {
      await download(`${BASE}/metadata.jsonl`, file, { label: 'the Objaverse model list (once)' });
    } catch (e) {
      if (!fs.existsSync(file)) throw e;
    }
  }
  rowsCache = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  return rowsCache;
}

export async function search(words, flags) {
  if (!words.length) return console.log(usage);
  if (!flags.checked) return searchAll(words, flags);
  const maxTris = Number(flags['max-tris']) || Infinity;
  const ws = words.map((w) => w.toLowerCase());
  const hits = (await rows())
    .filter((r) => {
      return wordsMatch(`${r.title} ${r.kind || ''}`, ws) && !fanArt(`${r.title} ${r.id}`);
    })
    .filter((r) => (!flags.cc0 || licence(r.license) === 'CC0') && (!flags.animated || r.animations > 0) && r.triangles <= maxTris && r.files?.web)
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
  const shown = hits.slice(0, 12).map((r, i) => ({ ...r, n: i + 1 }));
  if (!shown.length) return console.log(`No Objaverse model for "${words.join(' ')}"${flags.cc0 ? ' with CC0 (only 39 are CC0, try without --cc0)' : ''}. Try one simpler word.`);
  console.log(`Objaverse checked-set results (${hits.length} found, best first). Get one with: npm run assets -- objaverse get <id>\n`);
  table(shown, [
    ['#', 'n'],
    ['id', 'id', 44],
    ['title', 'title', 30],
    ['by', 'authors', 18],
    ['licence', (r) => licence(r.license)],
    ['triangles', (r) => num(r.triangles)],
    ['size', (r) => mb(r.web_bytes)],
    ['animated', (r) => (r.animations ? `${r.animations}` : '')],
  ]);
  console.log('\nCC-BY = free, but the author must be named in the game credits. Many are realistic scans; check the pictures (--thumbs).');
  if (flags.thumbs) await saveThumbs('objaverse', shown.map((r) => ({ n: r.n, url: `${BASE}/${r.thumbnail}` })));
}

export async function get(args, flags) {
  if (!args[0]) return console.log(usage);
  if (/^[0-9a-f]{32}$/.test(args[0])) return getAll(args[0], flags);
  const r = (await rows()).find((x) => x.id === args[0]);
  if (!r) oops(`No Objaverse model with id "${args[0]}". Copy the id from the search results.`);
  const lic = licence(r.license);
  if (!lic) oops(`"${r.title}" has the licence ${r.license}, which isn't CC0 or CC-BY.`);
  const tier = flags.lod ? `lod${flags.lod}` : 'web';
  const file = r.files?.[tier];
  if (!file) oops(`"${r.title}" has no ${tier} file. Use --lod 1, 2 or 3, or leave --lod out.`);
  const buf = await makeLoadable(await fetchUrl(`${BASE}/${file}`), { label: r.title });
  return saveModel(buf, {
    folder: flags.folder || 'models/objaverse',
    name: flags.name || r.title,
    credit: `"${r.title}" by ${r.authors} (${r.author_url}), ${lic === 'CC0' ? 'CC0' : `${lic} (${r.license_url})`}, ${r.source_url}, changed: converted/resized`,
    licence: lic,
    flags,
  });
}
