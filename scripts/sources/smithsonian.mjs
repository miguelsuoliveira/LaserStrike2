// Smithsonian 3D (3d.si.edu): real museum objects scanned in 3D (fossils, planes, statues).
// Search needs no key. Files are Draco-compressed, so get converts them for the engine.
// Licence: the 3D API doesn't say. Smithsonian Open Access marks most 3D scans CC0, but not
// all (some portrait busts, some space items), so get checks each model there first.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, ROOT, get as fetchUrl, mapLimit, mb, num, oops, request, saveModel, saveThumbs, table } from '../lib/asset-tools.mjs';
import { gltfIO, writeCompact } from '../lib/gltf-io.mjs';

const API = 'https://3d-api.si.edu/api/v1.0/content/file/search';
const DOC = 'https://3d-api.si.edu/content/document/3d_package:';

export const usage = `Smithsonian 3D: real museum objects (scans), CC0 when the museum says so (get checks)
  npm run assets -- smithsonian search dinosaur [--thumbs]
  npm run assets -- smithsonian get <id> [--small] [--name x] [--folder models/museum]`;

const uuidOf = (s) => String(s || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]?.toLowerCase();

// Web3D files are the light ones made for browsers: Thumb (~20k triangles) and Low (~100-150k).
function pick(files, small) {
  const web = files.filter((f) => f.content.usage === 'Web3D' && f.content.file_type === 'glb');
  const order = small ? ['Thumb', 'Low', 'Medium'] : ['Low', 'Thumb', 'Medium'];
  for (const q of order) {
    const f = web.find((x) => x.content.quality === q);
    if (f) return f.content;
  }
  return null;
}
const trisOf = (uri) => Number(uri?.match(/-(\d+)k-/)?.[1]) * 1000 || null;

export async function search(words, flags) {
  if (!words.length) return console.log(usage);
  const res = await request(`${API}?q=${encodeURIComponent(words.join(' '))}&file_type=glb&rows=300`, { as: 'json' });
  const models = new Map();
  for (const r of res.rows || []) {
    const id = uuidOf(r.content.model_url);
    if (id) (models.get(id) || models.set(id, { id, title: r.title, files: [] }).get(id)).files.push(r);
  }
  const rows = [...models.values()]
    .map((m) => ({ ...m, file: pick(m.files, flags.small) }))
    .filter((m) => m.file)
    .slice(0, 12)
    .map((m, i) => ({ ...m, n: i + 1, tris: trisOf(m.file.uri) }));
  if (!rows.length) return console.log(`No museum scans for "${words.join(' ')}". Try another word (skull, fossil, airplane, statue, mask).`);
  await mapLimit(rows, 6, async (m) => {
    const head = await request(m.file.uri, { as: 'response', method: 'HEAD' }).catch(() => null);
    m.bytes = Number(head?.headers.get('content-length')) || null;
  });
  console.log('Smithsonian museum scans. Get one with: npm run assets -- smithsonian get <id>\n');
  table(rows, [
    ['#', 'n'],
    ['id', 'id'],
    ['title', 'title', 44],
    ['triangles', (m) => num(m.tris)],
    ['download', (m) => (m.bytes ? mb(m.bytes) : '')],
  ]);
  console.log('\nThese are real scanned objects (realistic, not cartoon). Add --small to get the lighter Thumb version.');
  if (flags.thumbs) {
    // Pictures are Image2D files of the model, or listed in its Voyager document.
    const urls = await mapLimit(rows, 6, async (m) => {
      const all = await request(`${API}?model_url=${m.id}&rows=100`, { as: 'json', soft: true }).catch(() => null);
      const pics = (all?.rows || []).filter((r) => r.content.usage === 'Image2D').map((r) => r.content);
      const pic = pics.find((c) => c.quality === 'Thumb') || pics.find((c) => c.quality === 'Low');
      if (pic) return pic.uri;
      const doc = await request(`${DOC}${m.id}/document.json`, { as: 'json', soft: true }).catch(() => null);
      const imgs = (doc?.metas || []).flatMap((x) => x.images || []);
      const img = imgs.find((i) => i.quality === 'Thumb') || imgs[0];
      return img ? `${DOC}${m.id}/${img.uri}` : null;
    });
    await saveThumbs('smithsonian', rows.map((m, i) => ({ n: m.n, url: urls[i] })));
  }
}

// Is this model CC0 in Smithsonian Open Access? Answers are kept in .cache/.
async function checkLicence(id) {
  const file = path.join(CACHE, 'smithsonian-licences.json');
  const known = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (known[id]) return known[id];
  const doc = await request(`${DOC}${id}/document.json`, { as: 'json', soft: true });
  const record = (doc?.metas || []).map((m) => m.collection?.edanRecordId).find(Boolean);
  let answer;
  if (!record) answer = { ok: false, why: 'it has no museum record' };
  else {
    const key = process.env.SI_API_KEY || 'DEMO_KEY';
    const res = await request(`https://api.si.edu/openaccess/api/v1.0/content/${encodeURIComponent(record)}?api_key=${key}`, { as: 'response' });
    if (res.status === 404) answer = { ok: false, why: 'it is not in Smithsonian Open Access' };
    else if (!res.ok) {
      return {
        ok: null,
        why:
          res.status === 403 && process.env.SI_API_KEY
            ? 'the SI_API_KEY in .env was refused (check it)'
            : res.status === 429 || res.status === 403
            ? "the museum's free licence check is used up for this hour (DEMO_KEY allows about 10). Try again later, or a mentor adds a free key from https://api.data.gov/signup to .env as SI_API_KEY=..."
            : `the licence check answered ${res.status}`,
      };
    } else {
      const dn = (await res.json()).response?.content?.descriptiveNonRepeating || {};
      const media = dn.online_media?.media?.find((m) => uuidOf(m.id) === id);
      const access = media?.usage?.access || dn.metadata_usage?.access;
      answer = access === 'CC0' ? { ok: true, record: dn.record_link || record } : { ok: false, why: `its usage is "${access || 'not CC0'}"` };
    }
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...known, [id]: answer }));
  return answer;
}

export async function get(args, flags) {
  const id = uuidOf(args[0]);
  if (!id) return console.log(`${usage}\n(The id looks like 68adcbc1-84bc-4e3c-9f85-a08c81a5a820: copy it from the search.)`);
  const res = await request(`${API}?model_url=${id}&rows=100`, { as: 'json' });
  if (!res.rows?.length) oops(`No Smithsonian model with id ${id}. Copy the id from the search results.`);
  const title = res.rows[0].title;
  const lic = await checkLicence(id);
  if (lic.ok === null) oops(`Couldn't check the licence of "${title}": ${lic.why}`);
  if (!lic.ok) oops(`"${title}" is not free to use (${lic.why}), so it can't go in the game. Pick another one.`);
  const file = pick(res.rows, flags.small);
  if (!file) oops(`"${title}" has no web version to download. Pick another one.`);
  // Draco -> meshopt, which the engine loads.
  const io = await gltfIO();
  const doc = await io.readBinary(new Uint8Array(await fetchUrl(file.uri)));
  // The museum viewer turns scans upright with a rotation from its document: do the same.
  const voyager = await request(`${DOC}${id}/document.json`, { as: 'json', soft: true }).catch(() => null);
  const base = file.uri.split('/').pop();
  const vm = (voyager?.models || []).find((m) => (m.derivatives || []).some((d) => (d.assets || []).some((a) => a.uri === base)));
  if (vm?.rotation) {
    const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
    const upright = doc.createNode('upright').setRotation(vm.rotation);
    for (const n of scene.listChildren()) {
      scene.removeChild(n);
      upright.addChild(n);
    }
    scene.addChild(upright);
  }
  const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-'));
  let buf;
  try {
    await writeCompact(path.join(tmp, 'm.glb'), doc);
    buf = fs.readFileSync(path.join(tmp, 'm.glb'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return saveModel(buf, {
    folder: flags.folder || 'models/museum',
    name: flags.name || title.split(':')[0].slice(0, 40),
    credit: `"${title}" by Smithsonian Institution, CC0 (Smithsonian Open Access), https://3d-api.si.edu/voyager/3d_package:${id}, changed: converted to GLB`,
    flags,
  });
}
