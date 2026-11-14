// Objaverse clean GLB (Hugging Face dataset codepawl/objaverse-clean-glb): 6,015 checked
// Sketchfab models, almost all CC-BY 4.0 (39 are CC0). The "web" files load in our engine
// (meshopt + WebP); "lods/" are smaller copies of the same. mobile/ and ktx2/ use KTX2: not usable.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, download, fanArt, wordsMatch, get as fetchUrl, licence, makeLoadable, mb, num, oops, saveModel, saveThumbs, table } from '../lib/asset-tools.mjs';

const BASE = 'https://huggingface.co/datasets/codepawl/objaverse-clean-glb/resolve/main';

export const usage = `Objaverse: 6,000 checked models of everything (most CC-BY: credit the author)
  npm run assets -- objaverse search dragon [--cc0] [--animated] [--max-tris 20000] [--thumbs]
  npm run assets -- objaverse get <id> [--lod 1|2|3] [--name x] [--folder models/props]`;

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
  console.log(`Objaverse results (${hits.length} found, best first). Get one with: npm run assets -- objaverse get <id>\n`);
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
