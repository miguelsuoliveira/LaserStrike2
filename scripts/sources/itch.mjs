// itch.io free downloads (Quaternius and KayKit full packs). Same steps as the
// Download button: game page -> download page -> pick a file -> signed link (valid 60 s).
import fs from 'node:fs';
import path from 'node:path';
import { DOWNLOADS, cookieJar, download, licence, oops, readZip, request, safeName, savePack, table, zipModels } from '../lib/asset-tools.mjs';

export const usage = `itch.io: whole free packs as zips (models only are unpacked)
  npm run assets -- itch get quaternius/universal-base-characters [--file word] [--only words] [--all]
  (a game page link works too: https://kaylousberg.itch.io/kaykit-forest)`;

// Attribute order changes between page loads, so find the tag first, then the value.
const meta = (html, name) => html.match(new RegExp(`<meta [^>]*name="${name}"[^>]*>`))?.[0].match(/value="([^"]*)"/)?.[1];
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export function parseSpec(spec) {
  const s = String(spec || '');
  const m = s.match(/([a-z0-9-]+)\.itch\.io\/([a-z0-9_-]+)/i) || s.match(/^([a-z0-9-]+)\/([a-z0-9_-]+)$/i);
  return m ? { creator: m[1].toLowerCase(), game: m[2].toLowerCase() } : null;
}

// Files offered on the download page: [{ id, name, size }]
async function files(creator, game) {
  const url = `https://${creator}.itch.io/${game}`;
  const jar = cookieJar();
  const html = await request(url, { as: 'text', jar }).catch((e) => {
    if (/404/.test(e.message)) oops(`No itch.io page at ${url}. Check the name.`);
    throw e;
  });
  const title = decode(
    html.match(/<meta [^>]*property="og:title"[^>]*>/)?.[0].match(/content="([^"]*)"/)?.[1] || html.match(/<title>([^<]*?)( by [^<]*)?<\/title>/)?.[1] || game,
  ).trim();
  const csrf = meta(html, 'csrf_token');
  const res = await request(`${url}/download_url`, { method: 'POST', as: 'response', jar, referer: url, body: new URLSearchParams({ csrf_token: csrf || '' }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.url) oops(`"${title}" is not a free download (it costs money or needs a login). Pick a free pack.`);
  const page = await request(j.url, { as: 'text', jar });
  const list = [];
  for (const block of page.split('data-upload_id="').slice(1)) {
    const id = block.match(/^(\d+)/)?.[1];
    const name = decode(block.match(/<strong[^>]*class="name"[^>]*>([^<]*)</)?.[1] || block.match(/class="name"[^>]*title="([^"]*)"/)?.[1] || '');
    const size = block.match(/class="file_size"[^>]*><span>([^<]*)</)?.[1] || '';
    if (id && name && !list.some((f) => f.id === id)) list.push({ id, name, size });
  }
  if (!list.length) oops(`Couldn't find any files on the "${title}" download page.`);
  return { url, jar, title, csrf: meta(page, 'csrf_token'), downloadPage: j.url, list };
}

// Which file to take: --file word, else the one that looks like glTF/GLB (not source/Unity/FBX).
function choose(list, word) {
  if (word) {
    const hits = list.filter((f) => f.name.toLowerCase().includes(String(word).toLowerCase()));
    return hits.length === 1 ? hits[0] : hits.length ? null : 'none';
  }
  const bad = /source|blend|unity|unreal|fbx|\bobj\b|godot only|\.(rar|7z|unitypackage|exe|apk|pdf|png|jpe?g|gif|mp4|txt)$/i;
  const ok = list.filter((f) => !bad.test(f.name));
  if (ok.length === 1) return ok[0];
  const good = ok.filter((f) => /gltf|glb|standard|free|web/i.test(f.name));
  if (good.length === 1) return good[0];
  return list.length === 1 ? list[0] : null;
}

// Download (or reuse) a pack zip and unpack its models. Used by quaternius and kaykit too.
export async function itchPack(creator, game, flags, { folder, author, credit, cmd, licence: lic = 'CC0' } = {}) {
  const f = await files(creator, game);
  const pick = choose(f.list, flags.file);
  if (!pick || pick === 'none') {
    console.log(`"${f.title}" has ${f.list.length} files${pick === 'none' ? `, none with "${flags.file}" in the name` : ''}. Pick one with --file <word>:\n`);
    table(f.list, [
      ['file', 'name', 60],
      ['size', 'size'],
    ]);
    return [];
  }
  const zip = path.join(DOWNLOADS, `itch-${creator}-${game}-${pick.id}.zip`);
  if (!fs.existsSync(zip)) {
    const res = await request(`${f.url}/file/${pick.id}?source=game_download`, {
      method: 'POST',
      as: 'json',
      jar: f.jar,
      referer: f.downloadPage,
      body: new URLSearchParams({ csrf_token: f.csrf || '' }),
    });
    if (!res.url) oops(`itch.io didn't give a download link for "${pick.name}". Try again in a minute.`);
    await download(res.url, zip, { label: `"${f.title}" (${pick.name})` });
  }
  const buf = fs.readFileSync(zip);
  if (buf.readUInt32LE(0) !== 0x04034b50) oops(`"${pick.name}" is not a zip, so this tool can't unpack it. Ask a mentor.`);
  const items = zipModels(readZip(buf));
  return savePack(items, {
    title: f.title,
    folder: flags.folder || folder || `models/${safeName(game)}`,
    credit: credit || `"${f.title}" by ${author || creator}, ${lic}, ${f.url}`,
    cmd: cmd || `npm run assets -- itch get ${creator}/${game}${flags.file ? ` --file "${flags.file}"` : ''}${flags.license ? ` --license ${flags.license}` : ''}`,
    flags,
  });
}

// Creators whose packs are all CC0. Anyone else: read the page and pass --license.
const CC0 = { quaternius: 'Quaternius', kaylousberg: 'Kay Lousberg (KayKit)', kenney: 'Kenney' };

export async function get(args, flags) {
  const spec = parseSpec(args[0]);
  if (!spec) return console.log(usage);
  const known = CC0[spec.creator];
  const lic = known ? 'CC0' : licence(flags.license);
  if (!lic) {
    return console.log(
      `Check the licence on https://${spec.creator}.itch.io/${spec.game} first. If it says CC0 (or CC-BY), run again with --license CC0 (or --license CC-BY).`,
    );
  }
  return itchPack(spec.creator, spec.game, flags, {
    author: known || flags.author || spec.creator,
    licence: lic,
  });
}
