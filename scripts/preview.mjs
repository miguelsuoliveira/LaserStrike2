#!/usr/bin/env node
// Picture previews: show the kids what something will look like BEFORE building it.
//
//   npm run preview -- --show public/assets/images/dragon_sketch.jpg [more images...]
//        shows pictures on top of the running game: the kids' paper sketches (phone photos),
//        model thumbnails, a sketch the AI drew. Several pictures are numbered 1, 2, 3.
//   npm run preview -- "a chubby green dragon with tiny wings" --name dragon
//        an image AI (gpt-image-2.6, needs OPENAI_API_KEY in .env) draws a concept picture.
//   npm run preview -- "make it a 3D game character" --from public/assets/images/dragon_sketch.jpg
//        turns the kids' own sketch into a concept picture, keeping their design.
//   Options: --name x (file name), --wide (16:9 instead of square)
//
// Pictures are saved in .previews/ (not part of the game). If the game isn't running, they
// open in the computer's picture viewer instead.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, '.previews');
const MODELS = [process.env.IMAGE_MODEL, 'gpt-image-2.6', 'gpt-image-2.5-flare', 'gpt-image-1'].filter(Boolean);

const argv = process.argv.slice(2);
const flags = { from: [] };
const words = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--show') flags.show = true;
  else if (a === '--wide') flags.wide = true;
  else if (a === '--name') flags.name = argv[++i];
  else if (a === '--from') flags.from.push(argv[++i]);
  else words.push(a);
}

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {}

if (flags.show) {
  if (!words.length) fail('Give one or more pictures: npm run preview -- --show public/assets/images/sketch.jpg');
  const files = [];
  for (const w of words) files.push(await viewable(existing(w)));
  await show(files);
} else {
  const prompt = words.join(' ').trim();
  if (!prompt) fail('Describe the picture: npm run preview -- "a red race car made of candy" --name candy_car');
  const sketches = [];
  for (const f of flags.from) sketches.push(await viewable(existing(f)));
  const file = await generate(prompt, sketches);
  console.log(`Saved ${path.relative(ROOT, file)}`);
  await show([file]);
}

async function generate(prompt, sketches) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    fail(
      'No OPENAI_API_KEY in .env, so no image AI today. Instead:\n' +
        '- ask the kids to draw it on paper and photograph it, then show it with --show, or\n' +
        '- draw a simple SVG sketch into .previews/<name>.svg and run npm run preview -- --show .previews/<name>.svg',
    );
  }
  const full = sketches.length
    ? `This is a kid's pen-and-paper sketch for their 3D video game. Turn it into a clean, colorful concept picture. ` +
      `Keep their design: the same shapes, parts, colors and ideas they drew. ${prompt}. No text.`
    : `${prompt}. Concept picture for a kids' 3D video game, colorful, clear shapes, no text.`;
  const name = safe(flags.name || (sketches.length ? path.parse(sketches[0]).name : prompt)) || 'preview';
  fs.mkdirSync(OUT, { recursive: true });
  let n = 1;
  while (fs.existsSync(path.join(OUT, `${name}_${n}.png`))) n++;
  const file = path.join(OUT, `${name}_${n}.png`);
  console.log('Drawing the picture (10-60 seconds)...');
  fs.writeFileSync(file, await openaiImage(key, full, sketches));
  return file;
}

// Uses the first model in MODELS that this key can use (gpt-image-2.6 unless IMAGE_MODEL is set).
async function openaiImage(key, prompt, sketches) {
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const size = flags.wide ? '1536x1024' : '1024x1024';
  let last = '';
  for (const model of MODELS) {
    let r;
    if (sketches.length) {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt);
      form.append('size', size);
      for (const s of sketches) {
        const type = s.endsWith('.png') ? 'image/png' : s.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        form.append(sketches.length > 1 ? 'image[]' : 'image', new Blob([fs.readFileSync(s)], { type }), path.basename(s));
      }
      r = await request(`${base}/images/edits`, form, key);
    } else {
      r = await request(`${base}/images/generations`, JSON.stringify({ model, prompt, n: 1, size }), key);
    }
    const item = r.json?.data?.[0];
    if (r.ok && item?.b64_json) return console.log(`(${model})`), Buffer.from(item.b64_json, 'base64');
    if (r.ok && item?.url) return console.log(`(${model})`), Buffer.from(await (await fetch(item.url)).arrayBuffer());
    last = r.text;
    if (!/does not exist|not found|model_not_found|unknown model|invalid model|not supported/i.test(r.text)) break;
  }
  fail(`The image AI said no: ${errorText(last)}`);
}

async function request(url, body, key) {
  const headers = { Authorization: `Bearer ${key}` };
  if (typeof body === 'string') headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(180000) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { ok: res.ok, text, json };
  } catch (e) {
    fail(`Could not reach the image AI (${e.name === 'TimeoutError' ? 'too slow' : 'no internet?'}).`);
  }
}

function existing(p) {
  const file = path.resolve(p);
  if (!fs.existsSync(file)) fail(`No file ${p}`);
  if (!/\.(png|jpe?g|webp|svg|gif|heic|heif)$/i.test(file)) fail(`${path.basename(file)} is not a picture (.jpg .png .webp .svg .gif .heic)`);
  return file;
}

// Phone photos are huge, sideways or HEIC: make a small, upright JPG copy in .previews/.
async function viewable(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.svg' || ext === '.gif') return file;
  if (fs.statSync(file).size < 1.5e6 && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.heic' && ext !== '.heif') return file;
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${safe(path.parse(file).name)}_small.jpg`);
  try {
    const sharp = (await import('sharp')).default;
    await sharp(file).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(out);
    return out;
  } catch {
    if (process.platform === 'darwin') {
      execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '1600', file, '--out', out], { stdio: 'ignore' });
      return out;
    }
    fail(`Can't open ${path.basename(file)}. Send the photo as JPG (iPhone: Settings > Camera > Formats > Most Compatible).`);
  }
}

function safe(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

function errorText(text) {
  try {
    const j = JSON.parse(text);
    return String(j.error?.message || j.error || text).slice(0, 300);
  } catch {
    return String(text).slice(0, 300);
  }
}

// On the running game if there is one, otherwise in the computer's picture viewer.
async function show(files) {
  for (const port of [5173, 5174, 5175]) {
    try {
      const r = await fetch(`http://localhost:${port}/__project`, { signal: AbortSignal.timeout(800) });
      if (path.resolve((await r.text()).trim()) !== ROOT) continue;
      const res = await fetch(`http://localhost:${port}/__preview`, {
        method: 'POST',
        body: JSON.stringify({ images: files }),
      });
      if (res.ok && (await res.text()) !== '0') {
        console.log(`Showing ${files.length > 1 ? `${files.length} pictures` : 'the picture'} on the game screen (click or press a key to close).`);
        return;
      }
    } catch {}
  }
  const opener = process.platform === 'darwin' ? ['open'] : process.platform === 'win32' ? ['cmd', '/c', 'start', ''] : ['xdg-open'];
  for (const f of files) spawn(opener[0], [...opener.slice(1), f], { detached: true, stdio: 'ignore' }).unref();
  console.log('The game is not open, so the picture opens in the picture viewer.');
}

function fail(msg) {
  console.log(msg);
  process.exit(1);
}
