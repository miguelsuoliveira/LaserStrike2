// KayKit by Kay Lousberg (CC0). Ten packs on GitHub (downloaded as one zip each, no
// API limits) plus more free packs on itch.io (kaylousberg.itch.io).
import fs from 'node:fs';
import path from 'node:path';
import { DOWNLOADS, cachedJson, download, oops, readZip, request, safeName, savePack, saveThumbs, table, zipModels } from '../lib/asset-tools.mjs';
import { itchPack } from './itch.mjs';

const OWNER = 'KayKit-Game-Assets';
const KNOWN = ['Character-Pack-Adventures', 'Character-Pack-Skeletons', 'City-Builder-Bits', 'Dungeon-Remastered', 'Furniture-Bits', 'Halloween-Bits', 'Medieval-Hexagon-Pack', 'Prototype-Bits', 'Restaurant-Bits', 'Space-Base-Bits'].map((n) => ({ name: `KayKit-${n}-1.0`, default_branch: 'main' }));
// GitHub repo -> the short id (same id as on itch.io where the pack is on both).
const ALIAS = { 'character-pack-adventures': 'adventurers', 'character-pack-skeletons': 'skeletons', 'medieval-hexagon-pack': 'medieval-hexagon' };

export const usage = `KayKit: low-poly packs (CC0); characters come with 70+ animations
  npm run assets -- kaykit list [--thumbs]
  npm run assets -- kaykit get dungeon-remastered [--only "chest,torch"] [--all]`;

export function packs() {
  return cachedJson('kaykit-packs.json', 7, async () => {
    const headers = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const repos = (await request(`https://api.github.com/users/${OWNER}/repos?per_page=100`, { as: 'json', headers, soft: true }).catch(() => null)) || KNOWN;
    const gh = repos
      .filter((r) => /^KayKit-/.test(r.name))
      .map((r) => {
        const short = r.name.replace(/^KayKit-/, '').replace(/-\d+(\.\d+)*$/, '').toLowerCase();
        return { id: ALIAS[short] || short, title: r.name.replace(/-\d+(\.\d+)*$/, '').replace(/-/g, ' '), where: 'github', repo: r.name, branch: r.default_branch || 'main' };
      });
    const html = await request('https://kaylousberg.itch.io/', { as: 'text', soft: true }).catch(() => null);
    const itch = [];
    const cells = (html || '').split(/<div[^>]*class="game_cell /).slice(1);
    // A pack can show up twice on the page; if any copy has a price, it isn't free.
    const paid = new Set(cells.filter((c) => /price_value/.test(c)).map((c) => c.match(/kaylousberg\.itch\.io\/([a-z0-9-]+)/)?.[1]));
    for (const cell of cells) {
      // itch.io shuffles attribute order, so read the title link tag as a whole.
      const link = cell.match(/<a [^>]*class="title game_link"[^>]*>([^<]*)/);
      const slug = link?.[0].match(/kaylousberg\.itch\.io\/([a-z0-9-]+)/)?.[1];
      const title = link?.[1]?.replace(/&amp;/g, '&').trim();
      const thumb = cell.match(/data-lazy_src="([^"]+)"/)?.[1];
      if (!slug || !title || paid.has(slug) || /\(Legacy\)/.test(title)) continue; // paid or old
      const id = slug.replace(/^kaykit-/, '');
      if (!gh.some((g) => g.id === id) && !itch.some((g) => g.id === id)) itch.push({ id, title, where: 'itch', game: slug, thumb });
    }
    return [...gh, ...itch];
  });
}

export async function list(words, flags) {
  const all = (await packs()).filter((p) => words.every((w) => `${p.id} ${p.title}`.toLowerCase().includes(w.toLowerCase())));
  if (!all.length) return console.log(`No KayKit pack matches "${words.join(' ')}". Run: npm run assets -- kaykit list`);
  console.log('KayKit packs (all CC0). Get one with: npm run assets -- kaykit get <pack>\n');
  const rows = all.map((p, i) => ({ ...p, n: i + 1 }));
  table(rows, [
    ['#', 'n'],
    ['pack', 'id'],
    ['title', 'title', 50],
    ['from', (p) => (p.where === 'github' ? 'GitHub (small zip)' : 'itch.io')],
  ]);
  console.log('\nCharacters: "adventurers" and "skeletons" have animations inside each model (best for players and enemies).');
  if (flags.thumbs) {
    const shown = rows.slice(0, 12);
    await saveThumbs('kaykit', shown.map((p) => ({ n: p.n, url: p.thumb || `https://opengraph.githubassets.com/1/${OWNER}/${p.repo}` })));
  }
}

export async function get(args, flags) {
  if (!args.length) return console.log(usage);
  const all = await packs();
  const want = args.join(' ').toLowerCase();
  const pack = all.find((p) => p.id === want) || all.find((p) => args.every((w) => `${p.id} ${p.title}`.toLowerCase().includes(w.toLowerCase())));
  if (!pack) oops(`No KayKit pack called "${want}". See them all: npm run assets -- kaykit list`);
  const folder = flags.folder || `models/kaykit_${safeName(pack.id)}`;
  const cmd = `npm run assets -- kaykit get ${pack.id}`;
  if (pack.where === 'itch') {
    return itchPack('kaylousberg', pack.game, flags, { folder, cmd, credit: `"${pack.title}" by Kay Lousberg (KayKit), CC0, https://kaylousberg.itch.io/${pack.game}` });
  }
  const zip = path.join(DOWNLOADS, `kaykit-${pack.repo}.zip`);
  if (!fs.existsSync(zip)) await download(`https://codeload.github.com/${OWNER}/${pack.repo}/zip/refs/heads/${pack.branch}`, zip, { label: `${pack.title} (GitHub)` });
  return savePack(zipModels(readZip(fs.readFileSync(zip))), {
    title: pack.title,
    folder,
    credit: `"${pack.title}" by Kay Lousberg (KayKit), CC0, https://github.com/${OWNER}/${pack.repo}`,
    cmd,
    flags,
  });
}
