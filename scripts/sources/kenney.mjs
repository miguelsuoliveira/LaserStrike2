// Kenney (kenney.nl): ~50 free 3D kits, all CC0, as zips. The download link needs the
// kit page as Referer (and its cookie), like clicking Download in a browser.
import fs from 'node:fs';
import path from 'node:path';
import { DOWNLOADS, cachedJson, cookieJar, download, oops, readZip, request, safeName, savePack, saveThumbs, table, wrap, zipModels } from '../lib/asset-tools.mjs';

const SITE = 'https://kenney.nl';

export const usage = `Kenney: whole 3D kits (CC0)
  npm run assets -- kenney list [word] [--thumbs]
  npm run assets -- kenney get car-kit [--only "police,taxi"] [--all]`;

// [{ id: 'car-kit', title: 'Car Kit', thumb }] from the 3D category pages. Cached for a week.
export function kits() {
  return cachedJson('kenney-3d-kits.json', 7, async () => {
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const html = await request(`${SITE}/assets/category:3D/page:${page}`, { as: 'text', soft: true });
      if (!html) break;
      const before = all.length;
      for (const m of html.matchAll(/<a href='https:\/\/kenney\.nl\/assets\/([a-z0-9-]+)'>\s*<div class='cover' style='background-image:url\("([^"]+)"\)'><\/div>\s*<\/a>\s*<h2><a[^>]*>([^<]*)<\/a>/g)) {
        if (!all.some((k) => k.id === m[1])) all.push({ id: m[1], thumb: m[2], title: m[3].trim() });
      }
      if (all.length === before) break;
    }
    if (!all.length) oops('Kenney changed its website, so the kit list is empty. Browse https://kenney.nl/assets/category:3D');
    return all;
  });
}

const matches = (k, words) => words.every((w) => `${k.id} ${k.title}`.toLowerCase().includes(w.toLowerCase()));

export async function list(words, flags) {
  const all = await kits();
  if (!words.length) {
    console.log(`${all.length} Kenney 3D kits (all CC0). See one with: npm run assets -- kenney get <kit>\n`);
    console.log(wrap(all.map((k) => k.id)));
    return;
  }
  const hits = all.filter((k) => matches(k, words)).map((k, i) => ({ ...k, n: i + 1 }));
  if (!hits.length) return console.log(`No Kenney kit matches "${words.join(' ')}". Run: npm run assets -- kenney list`);
  table(hits.slice(0, 12), [
    ['#', 'n'],
    ['kit', 'id'],
    ['title', 'title'],
  ]);
  if (flags.thumbs) await saveThumbs('kenney', hits.slice(0, 12).map((k) => ({ n: k.n, url: k.thumb })));
}

export async function get(args, flags) {
  if (!args.length) return console.log(usage);
  const all = await kits();
  const kit = all.find((k) => k.id === args[0]) || all.find((k) => matches(k, args));
  if (!kit) oops(`No Kenney kit called "${args.join(' ')}". See them all: npm run assets -- kenney list`);
  const zip = path.join(DOWNLOADS, `kenney-${kit.id}.zip`);
  if (!fs.existsSync(zip)) {
    const page = `${SITE}/assets/${kit.id}`;
    const jar = cookieJar();
    await request(page, { as: 'text', jar });
    const hex = Buffer.from(`assets/${kit.id}`).toString('hex');
    const link = await request(`${SITE}/download-link/${hex}`, { as: 'json', jar, referer: page });
    if (!link?.url) oops(`Kenney didn't give a download link for ${kit.title}. Try again in a minute.`);
    await download(link.url, zip, { label: `${kit.title} zip`, jar, referer: page });
  }
  return savePack(zipModels(readZip(fs.readFileSync(zip))), {
    title: kit.title,
    folder: flags.folder || `models/${safeName(kit.id)}`,
    credit: `"${kit.title}" by Kenney, CC0, ${SITE}/assets/${kit.id}`,
    cmd: `npm run assets -- kenney get ${kit.id}`,
    flags,
  });
}
