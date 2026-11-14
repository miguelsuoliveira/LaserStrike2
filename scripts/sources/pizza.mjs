// Poly Pizza (poly.pizza): 10,000+ low-poly models, CC0 or CC-BY. No API key needed:
// the search, model and creator pages carry their data as JSON (__SERVER_APP_STATE__).
import { cachedJson, fanArt, get, licence, wordsMatch, makeLoadable, mapLimit, num, oops, saveModel, saveThumbs, safeName, table } from '../lib/asset-tools.mjs';

const SITE = 'https://poly.pizza';
const CREATORS = { kenney: 'Kenney', quaternius: 'Quaternius', kaykit: 'Kay Lousberg', kay: 'Kay Lousberg' };

export const usage = `Poly Pizza: low-poly models (CC0 or CC-BY), single files
  npm run assets -- pizza search dragon [--by Kenney|Quaternius|KayKit] [--cc0] [--animated] [--thumbs]
  npm run assets -- pizza get <id> [--name x] [--folder models/characters]`;

async function state(pathname, what) {
  const html = await get(SITE + pathname, 'text');
  const m = html.match(/__SERVER_APP_STATE__\s*=\s*(\{.*?\})\s*<\/script>/s);
  if (!m) oops(`Poly Pizza changed its pages, so ${what} didn't work. Try https://poly.pizza in a browser.`);
  return JSON.parse(m[1]).initialData || {};
}

// All models and bundles of one creator (Quaternius has 1,400+). Cached for a day.
export function creator(name) {
  return cachedJson(`pizza-user-${safeName(name)}.json`, 1, async () => {
    const d = await state(`/u/${encodeURIComponent(name)}`, `the creator page for ${name}`);
    if (!d.User) oops(`No Poly Pizza creator called "${name}".`);
    return {
      models: d.User.models.map(row),
      lists: (d.User.lists || [])
        .filter((l) => l.Models?.length && l.Name !== 'Upload')
        .map((l) => ({ name: l.Name, models: l.Models.map((x) => ({ id: x.PublicID, resource: x.S3ID })) })),
    };
  });
}

const row = (m) => ({ id: m.publicID, title: m.title?.trim(), by: m.creator?.username, licence: licence(m.licence), raw: m.licence, preview: m.previewUrl });

export async function info(id) {
  const d = await state(`/m/${encodeURIComponent(id)}`, `the model page for ${id}`).catch((e) => {
    if (/404/.test(e.message)) oops(`No Poly Pizza model with id "${id}". Copy the id from the search results.`);
    throw e;
  });
  const m = d.model;
  if (!m?.ResourceID) oops(`No Poly Pizza model with id "${id}". Copy the id from the search results.`);
  return { id: m.PublicID, title: m.Title?.trim(), by: m.Creator?.Username, licence: licence(m.Licence), raw: m.Licence, tris: m.Tris, animated: m.Animated, resource: m.ResourceID };
}

export async function search(words, flags) {
  const by = flags.by && flags.by !== true ? CREATORS[String(flags.by).toLowerCase()] || flags.by : null;
  if (!words.length && !by) return console.log(usage);
  let hits;
  if (by) {
    const all = (await creator(by)).models;
    hits = all.filter((m) => wordsMatch(m.title, words));
  } else {
    const q = new URLSearchParams();
    if (flags.animated) q.set('anim', '1');
    if (flags.cc0) q.set('lic', '1');
    const d = await state(`/search/${encodeURIComponent(words.join(' '))}${q.size ? `?${q}` : ''}`, 'the search');
    hits = (d.result || []).map(row);
  }
  hits = hits.filter((m) => m.licence && (!flags.cc0 || m.licence === 'CC0') && !fanArt(m.title));
  // Model pages tell triangles and animation. With --by --animated we check more of them.
  const check = hits.slice(0, by && flags.animated ? 48 : 12);
  const details = await mapLimit(check, 6, (m) => info(m.id).catch(() => null));
  check.forEach((m, i) => Object.assign(m, details[i] ? { tris: details[i].tris, animated: details[i].animated } : {}));
  if (by && flags.animated) hits = check.filter((m) => m.animated);
  const shown = hits.slice(0, 12).map((m, i) => ({ ...m, n: i + 1 }));
  if (!shown.length) {
    if (by) return console.log(`Nothing called "${words.join(' ')}"${flags.animated ? ' (animated)' : ''} by ${by} on Poly Pizza. Try without --by, or whole packs: npm run assets -- ${by === 'Kay Lousberg' ? 'kaykit list' : by === 'Kenney' ? 'kenney list' : 'quaternius list'}`);
    return console.log(`Nothing on Poly Pizza for "${words.join(' ')}". Try one simple word (dragon, car, tree), or: npm run assets -- objaverse search ${words[0]}`);
  }
  console.log(`Poly Pizza results (low-poly). Get one with: npm run assets -- pizza get <id>\n`);
  table(shown, [
    ['#', 'n'],
    ['id', 'id'],
    ['title', 'title', 30],
    ['by', 'by', 20],
    ['licence', 'licence'],
    ['triangles', (m) => num(m.tris)],
    ['animated', (m) => (m.animated ? 'yes' : m.animated === false ? '' : '?')],
  ]);
  if (shown.some((m) => m.licence !== 'CC0')) console.log('\nCC-BY = free, but the author must be named in the game credits. CC0 = no strings.');
  if (flags.thumbs) await saveThumbs('pizza', shown.map((m) => ({ n: m.n, url: m.preview })));
}

export async function get_(args, flags) {
  const id = String(args[0] || '').replace(/^.*\/m\//, '').replace(/[?#].*$/, '');
  if (!id) return console.log(usage);
  const m = await info(id);
  if (!m.licence) oops(`"${m.title}" has the licence "${m.raw}", which isn't CC0 or CC-BY. Pick another one.`);
  const buf = await makeLoadable(await get(`https://static.poly.pizza/${m.resource}.glb`), { label: m.title });
  return saveModel(buf, {
    folder: flags.folder || 'models/polypizza',
    name: flags.name || m.title,
    credit: `"${m.title}" by ${m.by}, ${m.licence}, ${SITE}/m/${m.id}`,
    licence: m.licence,
    flags,
  });
}

// Bundles ("lists") as pack items, for quaternius get.
export async function bundleItems(bundle, byName) {
  const titles = new Map((await creator(byName)).models.map((m) => [m.id, m]));
  return bundle.models.map((x) => {
    const m = titles.get(x.id);
    return {
      name: safeName(m?.title || x.id),
      path: `${bundle.name}/${m?.title || x.id}`,
      licence: m?.licence,
      load: async () => makeLoadable(await get(`https://static.poly.pizza/${x.resource}.glb`), { label: m?.title || x.id }),
    };
  });
}

export { get_ as get };
