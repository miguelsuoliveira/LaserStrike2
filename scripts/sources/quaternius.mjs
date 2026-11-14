// Quaternius (quaternius.com): 84 packs, all CC0. Newer packs download from itch.io;
// older ones only link Google Drive, so those come from Poly Pizza bundles instead.
import { cachedJson, oops, request, savePack, saveThumbs, table, wrap } from '../lib/asset-tools.mjs';
import { itchPack } from './itch.mjs';
import { bundleItems, creator } from './pizza.mjs';

const SITE = 'https://quaternius.com';

export const usage = `Quaternius: packs of low-poly models (CC0): monsters, animals, robots, nature, sci-fi
  npm run assets -- quaternius list [word] [--thumbs]
  npm run assets -- quaternius get ultimatemonsters [--only "dragon,yeti"] [--all]`;

// Names compared loosely: "Ultimate Monsters Bundle" == "ultimatemonsters".
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '').replace(/lowpoly|bundle|pack|kit|game|\d+/g, '').replace(/s$/, '');

export function packs() {
  return cachedJson('quaternius-packs.json', 7, async () => {
    const html = await request(`${SITE}/index.html`, { as: 'text' });
    const all = [];
    for (const m of html.matchAll(/href="\/packs\/([a-z0-9_-]+)\.html"\s*>\s*<img[^>]*src="([^"]+)"[^]*?class="PackText">([^<]*)<[^]*?<noscript>([^<]*)<\/noscript>/g)) {
      if (!all.some((p) => p.id === m[1])) all.push({ id: m[1], thumb: SITE + m[2], title: m[3].trim(), tags: m[4] });
    }
    if (!all.length) oops('Quaternius changed its website, so the pack list is empty. Browse https://quaternius.com');
    return all;
  });
}

// Where a pack can be downloaded from: its itch.io page, a Poly Pizza bundle, or nowhere we can reach.
async function source(pack) {
  const page = await cachedJson(`quaternius-pack-${pack.id}.json`, 7, async () => {
    const html = await request(`${SITE}/packs/${pack.id}.html`, { as: 'text' });
    return { itch: html.match(/https:\/\/quaternius\.itch\.io\/([a-z0-9-]+)/)?.[1] || null, models: Number(html.match(/Models<div class="text-right">(\d+)/)?.[1]) || null };
  });
  if (page.itch) return { ...page, how: 'itch' };
  const pz = await creator('Quaternius').catch(() => null);
  const bundle = pz?.lists.find((l) => norm(l.name) === norm(pack.id) || norm(l.name) === norm(pack.title));
  if (bundle) return { ...page, how: 'pizza', bundle };
  const games = await cachedJson('quaternius-itch-games.json', 7, async () => {
    const html = await request('https://quaternius.itch.io/', { as: 'text' });
    return [...new Set([...html.matchAll(/href="https:\/\/quaternius\.itch\.io\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
  }).catch(() => []);
  const game = games.find((g) => norm(g) === norm(pack.id) || norm(g) === norm(pack.title));
  if (game) return { ...page, itch: game, how: 'itch' };
  return { ...page, how: 'none' };
}

const HOW = { itch: 'itch.io zip', pizza: 'Poly Pizza bundle', none: 'single models: pizza search <word> --by quaternius' };

const matches = (p, words) => words.every((w) => `${p.id} ${p.title} ${p.tags}`.toLowerCase().includes(w.toLowerCase()));

export async function list(words, flags) {
  const all = await packs();
  if (!words.length) {
    console.log(`${all.length} Quaternius packs (all CC0). Search them: npm run assets -- quaternius list <word>\n`);
    console.log(wrap(all.map((p) => p.id)));
    return;
  }
  const hits = all.filter((p) => matches(p, words)).slice(0, 12);
  if (!hits.length) return console.log(`No Quaternius pack matches "${words.join(' ')}". Try: npm run assets -- pizza search ${words[0]} --by quaternius`);
  const rows = [];
  for (const [i, p] of hits.entries()) rows.push({ ...p, n: i + 1, ...(await source(p)) });
  console.log('Quaternius packs (CC0). Get one with: npm run assets -- quaternius get <pack>\n');
  table(rows, [
    ['#', 'n'],
    ['pack', 'id'],
    ['title', 'title', 36],
    ['models', (r) => r.models || ''],
    ['download', (r) => HOW[r.how], 50],
  ]);
  if (flags.thumbs) await saveThumbs('quaternius', rows.map((r) => ({ n: r.n, url: r.thumb })));
}

export async function get(args, flags) {
  if (!args.length) return console.log(usage);
  const all = await packs();
  const want = args.join(' ').toLowerCase();
  const pack = all.find((p) => p.id === want || norm(p.title) === norm(want)) || all.find((p) => matches(p, args));
  if (!pack) oops(`No Quaternius pack called "${want}". Search: npm run assets -- quaternius list <word>`);
  const src = await source(pack);
  const folder = flags.folder || `models/${pack.id}`;
  const cmd = `npm run assets -- quaternius get ${pack.id}`;
  if (src.how === 'itch') {
    return itchPack('quaternius', src.itch, flags, { folder, cmd, credit: `"${pack.title}" by Quaternius, CC0, https://quaternius.itch.io/${src.itch}` });
  }
  if (src.how === 'pizza') {
    const items = (await bundleItems(src.bundle, 'Quaternius')).filter((it) => it.licence);
    const lics = [...new Set(items.map((it) => it.licence))];
    return savePack(items, {
      title: `${pack.title} (Poly Pizza bundle "${src.bundle.name}")`,
      folder,
      credit: `"${pack.title}" by Quaternius, ${lics.join(' and ')}, ${SITE}/packs/${pack.id}.html (files from poly.pizza)`,
      cmd,
      flags,
    });
  }
  oops(`"${pack.title}" is only on Google Drive, which this tool can't download. Get single models instead: npm run assets -- pizza search <word> --by quaternius`);
}

