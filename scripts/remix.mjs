#!/usr/bin/env node
// Remix a 3D model FILE: smaller, recolored, only some parts, more animations.
// Always writes a NEW .glb (the original stays). Default: <name>_remix.glb next to the input.
//   npm run remix -- parts <file>                         what's inside: parts, materials (+ colors), animations, triangles, textures
//   npm run remix -- shrink <file> [--tris 20000] [--texture 1024] [--skinned] [--out x.glb]
//        fewer triangles + smaller textures; makes Draco downloads loadable. --skinned also simplifies rigged parts
//   npm run remix -- color <file> <part|material|all> "#3366ff" [--keep-texture] [--out x.glb]
//        quote the color: the terminal ignores words starting with #. Names work too: red, gold, hotpink
//   npm run remix -- keep <file> <part names...> [--out x.glb]      only these parts (just the sword)
//   npm run remix -- remove <file> <part names...> [--out x.glb]    drop parts (no shield)
//   npm run remix -- turn <file> [--x 90] [--y 180] [--z 90] [--out x.glb]   stand up a model lying on its side
//   npm run remix -- anims <file>                         list animations with seconds
//   npm run remix -- add-anims <character.glb> <from.glb> [--only "Dance,Wave"] [--out x.glb]
//        copies animations between models whose skeletons have the same bone names
//   npm run remix -- rename-anim <file> <old> <new> [--out x.glb]
// Names are matched loosely (case, dots and spaces don't matter: handslot.r = handslotr).
// Files can be given as in game code too: assets/models/characters/barbarian.glb
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ImageUtils, PropertyType } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, resample, weld, weldPrimitive, unweldPrimitive, simplifyPrimitive, compressTexture, cloneDocument, getBounds } from '@gltf-transform/functions';
import { Color, Euler, Quaternion } from 'three';
import { gltfIO, writeCompact } from './lib/gltf-io.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUBLIC = path.join(ROOT, 'public');
const ASSETS = path.join(PUBLIC, 'assets');
const CREDITS = path.join(ASSETS, 'CREDITS.md');
const HERE = process.env.INIT_CWD || process.cwd();
const MARK = 'ai-game-jam-starter remix';

class Oops extends Error {}

// ---------------------------------------------------------------- arguments

const [op, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
const VALUE_FLAGS = ['tris', 'texture', 'out', 'only', 'x', 'y', 'z'];
const BOOL_FLAGS = ['keep-texture', 'skinned'];

function parseArgs() {
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) {
      args.push(a);
      continue;
    }
    let [name, value] = a.slice(2).split(/=(.*)/s);
    if (BOOL_FLAGS.includes(name)) {
      flags[name] = true;
    } else if (name === 'only') {
      // --only Dance Wave   or   --only "Dance, Wave"
      const list = value !== undefined ? [value] : [];
      while (value === undefined && i + 1 < rest.length && !rest[i + 1].startsWith('--')) list.push(rest[++i]);
      flags.only = (flags.only || []).concat(list.flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean));
    } else if (VALUE_FLAGS.includes(name)) {
      if (value === undefined) value = rest[++i];
      if (value === undefined) throw fail(`--${name} needs a value`);
      flags[name] = value;
    } else {
      throw fail(`unknown option --${name}. Options: ${[...VALUE_FLAGS, ...BOOL_FLAGS].map((f) => `--${f}`).join(', ')}`);
    }
  }
}

function fail(msg) {
  return new Oops(msg);
}

// ---------------------------------------------------------------- helpers

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
// three.js removes . : / [ ] from names and turns spaces into _ (handslot.r -> handslotr).
const threeName = (s) => String(s ?? '').replace(/\s/g, '_').replace(/[[\].:/]/g, '');
const rel = (p) => (p.startsWith(ROOT + path.sep) ? path.relative(ROOT, p) : p);
const fmtBytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtNum = (n) => n.toLocaleString('en-US');
const list = (names, max = 40) => (names.length > max ? `${names.slice(0, max).join(', ')} ... (${names.length - max} more)` : names.join(', '));

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

// Finds the model file: a path from here, from the project, from public/ (like game code), or a bare name.
function findModel(p, what = 'model') {
  if (!p) throw fail(`which ${what}? Give a file, e.g. public/assets/models/characters/barbarian.glb`);
  for (const t of [path.resolve(HERE, p), path.resolve(ROOT, p), path.resolve(PUBLIC, p)]) {
    if (fs.existsSync(t) && fs.statSync(t).isFile()) {
      if (!/\.(glb|gltf)$/i.test(t)) throw fail(`${p} is not a .glb or .gltf model`);
      return t;
    }
  }
  const want = norm(path.basename(p).replace(/\.(glb|gltf)$/i, ''));
  const hits = walkFiles(path.join(ASSETS, 'models')).filter((f) => /\.(glb|gltf)$/i.test(f) && norm(path.basename(f).replace(/\.(glb|gltf)$/i, '')) === want);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw fail(`"${p}" matches several files: ${hits.map(rel).join(', ')}. Use the full path.`);
  throw fail(`file not found: ${p} (try a path like public/assets/models/characters/barbarian.glb; public/assets/CATALOG.md lists them)`);
}

// Reads the GLB/glTF JSON without decoding anything (cheap).
function readJson(file) {
  const buf = fs.readFileSync(file);
  if (/\.gltf$/i.test(file)) return JSON.parse(buf.toString('utf8'));
  if (buf.readUInt32LE(0) !== 0x46546c67) return null;
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

// Bytes on disk, including a .gltf's .bin and texture files.
function fileBytes(file) {
  let total = fs.statSync(file).size;
  if (/\.gltf$/i.test(file)) {
    const json = readJson(file) || {};
    for (const r of [...(json.buffers || []), ...(json.images || [])]) {
      const f = r.uri && !r.uri.startsWith('data:') ? path.join(path.dirname(file), decodeURIComponent(r.uri)) : null;
      if (f && fs.existsSync(f)) total += fs.statSync(f).size;
    }
  }
  return total;
}

function isRemix(file) {
  try {
    const asset = readJson(file)?.asset || {};
    return String(asset.generator || '').includes(MARK);
  } catch {
    return false;
  }
}

function outPathFor(input) {
  let out;
  if (flags.out) {
    let o = flags.out;
    if (!/\.glb$/i.test(o)) o = o.replace(/\.gltf$/i, '') + '.glb';
    if (!o.includes('/') && !o.includes(path.sep)) out = path.join(path.dirname(input), o);
    else if (/^assets\//.test(o)) out = path.join(PUBLIC, o);
    else out = path.resolve(HERE, o);
  } else {
    out = path.join(path.dirname(input), `${path.basename(input).replace(/\.(glb|gltf)$/i, '')}_remix.glb`);
  }
  if (path.resolve(out) === path.resolve(input)) throw fail('--out is the original file. Pick a new name: the original always stays.');
  if (fs.existsSync(out) && !isRemix(out)) throw fail(`${rel(out)} already exists and is not a remix. Pick another --out name.`);
  return out;
}

async function load(file) {
  const io = await gltfIO();
  try {
    return await io.read(file);
  } catch (e) {
    throw fail(`could not read ${rel(file)} (${e.message.split('\n')[0]})`);
  }
}

const sceneOf = (doc) => doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
const jointsOf = (doc) => new Set(doc.getRoot().listSkins().flatMap((s) => s.listJoints()));

function primTris(prim) {
  const mode = prim.getMode();
  const idx = prim.getIndices();
  const n = idx ? idx.getCount() : prim.getAttribute('POSITION')?.getCount() || 0;
  if (mode === 4) return Math.floor(n / 3);
  if (mode === 5 || mode === 6) return Math.max(0, n - 2);
  return 0;
}
const meshTris = (mesh) => (mesh ? mesh.listPrimitives().reduce((s, p) => s + primTris(p), 0) : 0);

function descendants(node) {
  const out = [node];
  for (const c of node.listChildren()) out.push(...descendants(c));
  return out;
}

function sceneNodes(doc) {
  const out = [];
  for (const scene of doc.getRoot().listScenes()) for (const n of scene.listChildren()) out.push(...descendants(n));
  return out;
}

const totalTris = (doc) => sceneNodes(doc).reduce((s, n) => s + meshTris(n.getMesh()), 0);

// Parts = nodes with a mesh. Groups = named nodes (not bones) that contain parts.
function partsOf(doc) {
  const joints = jointsOf(doc);
  const nodes = sceneNodes(doc);
  const parts = nodes.filter((n) => n.getMesh());
  const groups = nodes.filter((n) => !n.getMesh() && !joints.has(n) && n.getName() && descendants(n).some((d) => d !== n && d.getMesh()));
  return { parts, groups, joints };
}

const partLabel = (n, i) => threeName(n.getName()) || (n.getMesh()?.getName() ? `${threeName(n.getMesh().getName())} (unnamed part)` : `(unnamed part ${i + 1})`);

function heldBy(node, joints) {
  for (let p = node.getParentNode(); p; p = p.getParentNode()) if (joints.has(p)) return p;
  return null;
}

// Loose name matching: exact (ignoring case, dots, spaces) first, then "contains".
// candidates: [{ keys: [names...], item }]
function pickLoose(query, candidates) {
  const k = norm(query);
  if (!k) return [];
  const exact = candidates.filter((c) => c.keys.some((x) => norm(x) === k));
  if (exact.length) return exact.map((c) => c.item);
  return candidates.filter((c) => c.keys.some((x) => norm(x).includes(k))).map((c) => c.item);
}

function partCandidates(doc) {
  const { parts, groups } = partsOf(doc);
  return [...parts, ...groups].map((n) => ({ keys: [n.getName(), threeName(n.getName()), n.getMesh()?.getName()].filter(Boolean), item: n }));
}

function partNames(doc) {
  return partsOf(doc).parts.map(partLabel);
}

function pickParts(doc, queries) {
  if (!queries.length) throw fail(`which parts? Parts are: ${list(partNames(doc))}`);
  const cands = partCandidates(doc);
  const found = new Set();
  for (const q of queries) {
    const hits = pickLoose(q, cands);
    if (!hits.length) throw fail(`no part named "${q}". Parts are: ${list(partNames(doc))}`);
    hits.forEach((h) => found.add(h));
  }
  return [...found];
}

// Linear glTF color factor <-> "#rrggbb" (sRGB, like CSS and three.js).
const toHex = (f) => `#${new Color().setRGB(f[0], f[1], f[2]).getHexString()}`;
function parseColor(s) {
  if (!s) throw fail('missing the color. Put it in quotes: "#3366ff" (the terminal ignores words that start with #), or use a name like blue');
  const t = s.trim().toLowerCase();
  let hex = null;
  if (/^#?[0-9a-f]{6}$/.test(t)) hex = t.replace('#', '');
  else if (/^#?[0-9a-f]{3}$/.test(t)) hex = t.replace('#', '').split('').map((c) => c + c).join('');
  else if (Color.NAMES[t.replace(/[\s_-]/g, '')] !== undefined) return new Color(Color.NAMES[t.replace(/[\s_-]/g, '')]);
  if (!hex) throw fail(`"${s}" isn't a color. Use a hex code in quotes like "#3366ff" or a name like red, blue, gold, hotpink`);
  return new Color(`#${hex}`);
}

function animDuration(anim) {
  let d = 0;
  for (const s of anim.listSamplers()) {
    const input = s.getInput();
    if (input) d = Math.max(d, input.getMax([])[0] ?? 0);
  }
  return d;
}

// Loose animation lookup like the engine's anim.play(): exact, any case, starts with, contains.
function findAnims(anims, query) {
  const q = query.toLowerCase();
  const levels = [(n) => n === query, (n) => n.toLowerCase() === q, (n) => n.toLowerCase().startsWith(q), (n) => n.toLowerCase().includes(q), (n) => norm(n).includes(norm(query))];
  for (const test of levels) {
    const hits = anims.filter((a) => test(a.getName() || ''));
    if (hits.length) return hits;
  }
  return [];
}

// ---------------------------------------------------------------- credits and catalog

function creditLines() {
  return fs.existsSync(CREDITS) ? fs.readFileSync(CREDITS, 'utf8').split('\n') : [];
}

function creditFor(file) {
  if (!file.startsWith(PUBLIC + path.sep)) return null;
  const r = path.relative(PUBLIC, file).split(path.sep).join('/');
  const lines = creditLines();
  const exact = lines.find((l) => l.startsWith(`- ${r}:`));
  if (exact) return exact.slice(`- ${r}:`.length).trim();
  const folder = lines
    .map((l) => l.match(/^- (assets\/[^:]*\/):\s*(.*)$/))
    .filter((m) => m && r.startsWith(m[1]))
    .sort((a, b) => b[1].length - a[1].length)[0];
  return folder ? folder[2] : null;
}

function licenseInfo(doc, input) {
  const credit = creditFor(input);
  const extras = doc.getRoot().getAsset().extras || {};
  const fromFile = extras.license ? `by ${String(extras.author || 'unknown').replace(/\s*\(http[^)]*\)/, '')}, ${extras.license}${extras.source ? `, ${extras.source}` : ''}` : null;
  const text = credit || fromFile;
  const ccby = !!text && /CC[- ]?BY/i.test(text);
  return { credit, text, ccby };
}

// Adds (or replaces) the CREDITS.md line for the new file, saying what was changed.
function writeCredit(out, input, lic, change) {
  if (!out.startsWith(ASSETS + path.sep) || !lic.text || !fs.existsSync(CREDITS)) return false;
  const outRel = path.relative(PUBLIC, out).split(path.sep).join('/');
  const line = `- ${outRel}: ${path.basename(input)} ${change}; ${lic.text}`;
  const text = fs.readFileSync(CREDITS, 'utf8');
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`- ${outRel}:`));
  if (i >= 0) {
    lines[i] = line;
    fs.writeFileSync(CREDITS, lines.join('\n'));
  } else {
    fs.appendFileSync(CREDITS, `${text.endsWith('\n') ? '' : '\n'}${line}\n`);
  }
  return true;
}

const authorOf = (text) => text.match(/(?:^|; )(?:"[^"]*" )?by ([^,;]+)/)?.[1]?.trim() || 'the author';

function rebuildCatalog() {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/assets.mjs'), 'catalog'], { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- saving

async function save(doc, input, change, extraLines = [], extraCredit = '') {
  const out = outPathFor(input);
  const asset = doc.getRoot().getAsset();
  asset.generator = `${MARK} (glTF-Transform)`;
  asset.extras = { ...(asset.extras || {}), remix: [...(asset.extras?.remix || []), `${change} (from ${path.basename(input)})`] };
  const lic = licenseInfo(doc, input);
  if (extraCredit) {
    lic.text = lic.text ? `${lic.text}; ${extraCredit}` : extraCredit;
    lic.ccby = /CC[- ]?BY/i.test(lic.text);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    // Unindexed triangles (some downloads) compress badly: index them first.
    const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
    if (prims.some((p) => !p.getIndices() && [4, 5, 6].includes(p.getMode()))) await doc.transform(weld());
    await writeCompact(out, doc);
  } catch (e) {
    throw fail(`could not save ${rel(out)} (${e.message.split('\n')[0]})`);
  }
  const before = fileBytes(input);
  const after = fs.statSync(out).size;
  console.log(`Saved ${rel(out)}  (${fmtBytes(after)}, the original ${path.basename(input)} is ${fmtBytes(before)} and unchanged)`);
  for (const l of extraLines) console.log(l);
  if (out.startsWith(ASSETS + path.sep)) {
    const credited = writeCredit(out, input, lic, change);
    const catalog = rebuildCatalog();
    const gamePath = path.relative(PUBLIC, out).split(path.sep).join('/');
    console.log(`Use it: loadModel('${gamePath}', { height: 2 })${catalog ? '  (CATALOG.md updated)' : '  (run npm run assets -- catalog to list it)'}`);
    if (credited) console.log('CREDITS.md: added a line for the new file.');
    else if (!lic.text && !input.startsWith(ASSETS + path.sep)) console.log(`Credits: add a line for ${gamePath} to public/assets/CREDITS.md (who made it, license, link).`);
  } else {
    console.log('To use it in the game, save it under public/assets/models/<folder>/ (use --out).');
  }
  if (lic.ccby) console.log(`License: CC-BY. The game's credits screen must name ${authorOf(lic.text)} and say the model was changed (${change}).`);
  return out;
}

// ---------------------------------------------------------------- ops

async function parts() {
  const file = findModel(args[0]);
  const doc = await load(file);
  const root = doc.getRoot();
  const { parts, groups, joints } = partsOf(doc);
  const anims = root.listAnimations();
  const json = readJson(file) || {};
  const used = json.extensionsUsed || [];

  const skins = root.listSkins();
  const bits = [`${fmtBytes(fileBytes(file))}`, `${fmtNum(totalTris(doc))} triangles`];
  if (skins.length) bits.push(`rigged (${jointsOf(doc).size} bones)`);
  bits.push(`${anims.length} animations`);
  console.log(`${rel(file)}  ${bits.join(', ')}`);

  console.log(`Parts (${parts.length})  names for keep / remove / color, and loadModel({ hide })`);
  const rows = parts.map((n, i) => {
    const mats = [...new Set(n.getMesh().listPrimitives().map((p) => p.getMaterial()?.getName() || '(no material)'))];
    const notes = [];
    if (n.getSkin()) notes.push('bends with bones');
    const bone = heldBy(n, joints);
    if (bone && !n.getSkin()) notes.push(`held by bone ${threeName(bone.getName())}`);
    return [partLabel(n, i), `${fmtNum(meshTris(n.getMesh()))} tris`, mats.join(', '), notes.join(', ')];
  });
  const w0 = Math.min(32, Math.max(...rows.map((r) => r[0].length), 4));
  const w1 = Math.max(...rows.map((r) => r[1].length), 4);
  for (const r of rows.slice(0, 80)) console.log(`  ${r[0].padEnd(w0)}  ${r[1].padStart(w1)}  ${r[2]}${r[3] ? `  (${r[3]})` : ''}`);
  if (rows.length > 80) console.log(`  ... and ${rows.length - 80} more`);
  if (groups.length) console.log(`Groups (hold several parts): ${list(groups.map((g) => threeName(g.getName())), 30)}`);

  const materials = root.listMaterials();
  console.log(`Materials (${materials.length})`);
  for (const m of materials) {
    const users = parts.filter((n) => n.getMesh().listPrimitives().some((p) => p.getMaterial() === m)).length;
    const tex = m.getBaseColorTexture();
    const size = tex?.getImage() ? ImageUtils.getSize(tex.getImage(), tex.getMimeType()) : null;
    const texText = tex ? `texture ${size ? size.join('x') : '?'}` : 'no texture';
    const glow = m.getEmissiveFactor().some((v) => v > 0) ? `, glows ${toHex(m.getEmissiveFactor())}` : '';
    console.log(`  ${m.getName() || '(unnamed)'}  color ${toHex(m.getBaseColorFactor())}, ${texText}${glow}, used by ${users} part${users === 1 ? '' : 's'}`);
  }

  const textures = root.listTextures();
  if (textures.length) {
    const t = textures.map((x) => {
      const s = x.getImage() ? ImageUtils.getSize(x.getImage(), x.getMimeType()) : null;
      return `${s ? s.join('x') : '?'} ${String(x.getMimeType()).replace('image/', '')} ${fmtBytes(x.getImage()?.byteLength || 0)}`;
    });
    console.log(`Textures (${textures.length}): ${list(t, 12)}`);
  } else console.log('Textures: none');

  if (anims.length) {
    const names = anims.map((a) => `${a.getName() || '(no name)'} (${animDuration(a).toFixed(1)}s)`);
    console.log(`Animations (${anims.length}): ${list(names, 15)}${anims.length > 15 ? '  -> npm run remix -- anims <file> lists all' : ''}`);
  } else console.log('Animations: none');

  if (used.includes('KHR_draco_mesh_compression')) console.log('Draco file: the game cannot load it as it is. `npm run remix -- shrink <file>` makes a copy it can load.');
  const lic = licenseInfo(doc, file);
  if (lic.text) console.log(`License: ${lic.text}`);
  const tris = totalTris(doc);
  if (tris > 50000 || fileBytes(file) > 10 * 1048576) console.log(`Big for school laptops: try npm run remix -- shrink ${rel(file)}`);
}

async function anims() {
  const file = findModel(args[0]);
  const doc = await load(file);
  const clips = doc.getRoot().listAnimations();
  if (!clips.length) {
    console.log(`${path.basename(file)} has no animations. Animate it with code (character-animation skill) or copy some with add-anims.`);
    return;
  }
  console.log(`${path.basename(file)}: ${clips.length} animations (play with anim.play('Name'))`);
  const w = Math.min(40, Math.max(...clips.map((a) => (a.getName() || '').length)));
  for (const a of clips) console.log(`  ${(a.getName() || '(no name)').padEnd(w)}  ${animDuration(a).toFixed(2).padStart(6)} s  ${a.listChannels().length} tracks`);
}

async function shrink() {
  const file = findModel(args[0]);
  const doc = await load(file);
  const target = Number(flags.tris ?? 20000);
  const texLimit = Number(flags.texture ?? 1024);
  if (!(target > 0)) throw fail('--tris needs a number, e.g. --tris 20000');
  if (!(texLimit >= 16)) throw fail('--texture needs a size in pixels, e.g. --texture 1024');

  const trisBefore = totalTris(doc);
  const texBefore = doc.getRoot().listTextures().map((t) => texDesc(t));
  await doc.transform(dedup({ keepUniqueNames: true }), prune({ keepLeaves: true, keepAttributes: true }), resample(), weld());

  // Triangles: simplify meshes that don't bend with bones (or all with --skinned).
  const skinnedMeshes = new Set(doc.getRoot().listNodes().filter((n) => n.getSkin() && n.getMesh()).map((n) => n.getMesh()));
  const meshes = doc.getRoot().listMeshes();
  const canSimplify = (m) => (flags.skinned || !skinnedMeshes.has(m)) && !m.listPrimitives().some((p) => p.listTargets().length);
  const sceneUses = new Map();
  for (const n of sceneNodes(doc)) if (n.getMesh()) sceneUses.set(n.getMesh(), (sceneUses.get(n.getMesh()) || 0) + 1);
  const simpleTris = meshes.filter(canSimplify).reduce((s, m) => s + meshTris(m) * (sceneUses.get(m) || 0), 0);
  const fixedTris = totalTris(doc) - simpleTris;
  const notes = [];
  let result = doc;
  if (totalTris(doc) > target && simpleTris > 0) {
    const ratio = Math.min(1, Math.max(0.01, (target - fixedTris) / simpleTris));
    const { MeshoptSimplifier } = await import('meshoptimizer');
    await MeshoptSimplifier.ready;
    // Faceted models (every corner has its own normal, common in scans) look like loose triangles to
    // the simplifier: drop the normals, join the corners, and make new normals afterwards.
    const shading = new Map();
    for (const m of meshes.filter(canSimplify)) for (const prim of m.listPrimitives()) {
      const kind = dropSplitNormals(prim);
      if (kind) shading.set(m.listPrimitives().indexOf(prim) + ':' + meshes.indexOf(m), kind);
    }
    // Try gentle first (shape error limits), loosen until we get close to the target.
    for (const error of [0.01, 0.05, 1]) {
      const copy = cloneDocument(doc);
      const skinnedCopy = new Set(copy.getRoot().listNodes().filter((n) => n.getSkin() && n.getMesh()).map((n) => n.getMesh()));
      copy.getRoot().listMeshes().forEach((m, mi) => {
        if ((!flags.skinned && skinnedCopy.has(m)) || m.listPrimitives().some((p) => p.listTargets().length)) return;
        m.listPrimitives().forEach((prim, pi) => {
          if (primTris(prim) >= 64 && [4, 5, 6].includes(prim.getMode())) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error, lockBorder: false });
          const kind = shading.get(pi + ':' + mi);
          if (kind) rebuildNormals(copy, prim, kind === 'flat');
        });
      });
      result = copy;
      if (totalTris(copy) <= target * 1.1) break;
    }
    await result.transform(prune({ keepLeaves: true }));
  }
  const skippedSkinned = flags.skinned ? 0 : [...skinnedMeshes].length;
  if (totalTris(result) > target * 1.1) {
    if (skippedSkinned && fixedTris > target * 0.5) notes.push(`Rigged parts (${fmtNum(fixedTris)} triangles) bend with bones, so they were not simplified. Add --skinned to simplify them too, then check the animations with npm run snap.`);
    else notes.push(`Could not get down to ${fmtNum(target)} triangles without breaking the shape.`);
  } else if (skippedSkinned && totalTris(result) < trisBefore) {
    notes.push(`Left ${skippedSkinned} rigged part${skippedSkinned === 1 ? '' : 's'} as they were (they bend with bones; --skinned simplifies them too).`);
  }

  // Textures: at most --texture pixels, WebP when that is smaller.
  let webp = false;
  const sharp = (await import('sharp')).default;
  for (const tex of result.getRoot().listTextures()) {
    const mime = tex.getMimeType();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime) || !tex.getImage()) continue;
    const size = ImageUtils.getSize(tex.getImage(), mime);
    const tooBig = size && Math.max(size[0], size[1]) > texLimit;
    const old = { image: tex.getImage(), mime, uri: tex.getURI() };
    try {
      await compressTexture(tex, { encoder: sharp, targetFormat: 'webp', quality: 88, resize: tooBig ? [texLimit, texLimit] : undefined });
    } catch {
      continue; // unreadable image: keep it as it was
    }
    if (!tooBig && tex.getImage().byteLength >= old.image.byteLength * 0.9) tex.setImage(old.image).setMimeType(old.mime).setURI(old.uri);
    if (tex.getMimeType() === 'image/webp') webp = true;
  }
  if (webp) result.createExtension(EXTTextureWebP).setRequired(true);

  const texAfter = result.getRoot().listTextures().map((t) => texDesc(t));
  const lines = [`  Triangles: ${fmtNum(trisBefore)} -> ${fmtNum(totalTris(result))}`];
  if (texBefore.length) lines.push(`  Textures:  ${summarizeTex(texBefore)} -> ${summarizeTex(texAfter)}`);
  lines.push(...notes.map((n) => `  ${n}`));
  const out = await save(result, file, `shrunk to ${fmtNum(totalTris(result))} triangles`, lines);
  if (fs.statSync(out).size > fileBytes(file)) {
    const draco = (readJson(file)?.extensionsUsed || []).includes('KHR_draco_mesh_compression');
    console.log(draco ? 'The new file is bigger than the Draco original, but the game can only load the new one.' : 'The new file is not smaller: this model was already small. Keep using the original.');
  }
}

// If normals split almost every vertex, removes them and welds the corners together.
// Returns 'flat' (faceted look, rebuilt faceted later), 'smooth', or null (left alone).
function dropSplitNormals(prim) {
  const normal = prim.getAttribute('NORMAL');
  const pos = prim.getAttribute('POSITION');
  if (!normal || !pos || prim.getMode() !== 4) return null;
  const p = pos.getArray();
  const unique = new Set();
  for (let i = 0; i < p.length; i += 3) unique.add(`${p[i]},${p[i + 1]},${p[i + 2]}`);
  if (pos.getCount() < unique.size * 2.5) return null; // normal hard edges split less than this
  const n = normal.getArray();
  const idx = prim.getIndices()?.getArray();
  const corner = (f, k) => (idx ? idx[f * 3 + k] : f * 3 + k);
  const faces = idx ? idx.length / 3 : pos.getCount() / 3;
  const same = (a, b) => Math.abs(n[a * 3] - n[b * 3]) + Math.abs(n[a * 3 + 1] - n[b * 3 + 1]) + Math.abs(n[a * 3 + 2] - n[b * 3 + 2]) < 1e-3;
  let flat = 0;
  for (let f = 0; f < faces; f++) if (same(corner(f, 0), corner(f, 1)) && same(corner(f, 1), corner(f, 2))) flat++;
  prim.setAttribute('NORMAL', null);
  prim.setAttribute('TANGENT', null);
  weldPrimitive(prim);
  return flat > faces * 0.9 ? 'flat' : 'smooth';
}

// New normals after simplifying: faceted (one normal per triangle) or smooth (averaged where corners meet).
function rebuildNormals(doc, prim, flat) {
  if (flat) unweldPrimitive(prim);
  const pos = prim.getAttribute('POSITION');
  const count = pos.getCount();
  const idx = prim.getIndices()?.getArray();
  const p = new Float32Array(count * 3);
  const v = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    pos.getElement(i, v);
    p.set(v, i * 3);
  }
  // Corners at the same spot share one normal (smooth across UV seams).
  const slot = new Int32Array(count);
  const slots = new Map();
  for (let i = 0; i < count; i++) {
    const key = flat ? i : `${p[i * 3]},${p[i * 3 + 1]},${p[i * 3 + 2]}`;
    if (!slots.has(key)) slots.set(key, slots.size);
    slot[i] = slots.get(key);
  }
  const sum = new Float32Array(slots.size * 3);
  const faces = idx ? idx.length / 3 : count / 3;
  for (let f = 0; f < faces; f++) {
    const [a, b, c] = idx ? [idx[f * 3], idx[f * 3 + 1], idx[f * 3 + 2]] : [f * 3, f * 3 + 1, f * 3 + 2];
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      sum[slot[k] * 3] += nx;
      sum[slot[k] * 3 + 1] += ny;
      sum[slot[k] * 3 + 2] += nz;
    }
  }
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const s = slot[i] * 3;
    const len = Math.hypot(sum[s], sum[s + 1], sum[s + 2]) || 1;
    out.set([sum[s] / len, sum[s + 1] / len, sum[s + 2] / len], i * 3);
  }
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(doc.getRoot().listBuffers()[0] || doc.createBuffer()));
  if (flat) weldPrimitive(prim); // index again (smaller file)
}

function texDesc(t) {
  const s = t.getImage() ? ImageUtils.getSize(t.getImage(), t.getMimeType()) : null;
  return `${s ? s.join('x') : '?'} ${String(t.getMimeType()).replace('image/', '')}`;
}
function summarizeTex(descs) {
  const counts = new Map();
  for (const d of descs) counts.set(d, (counts.get(d) || 0) + 1);
  return [...counts].map(([d, n]) => (n > 1 ? `${n} x ${d}` : d)).join(', ') || 'none';
}

async function color() {
  const file = findModel(args[0]);
  const doc = await load(file);
  const what = args[1];
  const c = parseColor(args[2]);
  if (!what) throw fail(`what should change color? A part, a material or all. Parts are: ${list(partNames(doc))}`);
  const root = doc.getRoot();
  const materials = root.listMaterials();
  let targets = [];
  let label;

  if (['all', 'everything', '*'].includes(what.toLowerCase())) {
    targets = materials.slice();
    // Primitives without a material get one, so they can be colored.
    const missing = root.listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => !p.getMaterial());
    if (missing.length) {
      const m = doc.createMaterial('remix_color');
      missing.forEach((p) => p.setMaterial(m));
      targets.push(m);
    }
    label = 'everything';
  } else {
    const matCands = materials.map((m) => ({ keys: [m.getName(), threeName(m.getName())].filter(Boolean), item: m }));
    const k = norm(what);
    const exactMat = matCands.filter((x) => x.keys.some((n) => norm(n) === k)).map((x) => x.item);
    const partHits = pickLoose(what, partCandidates(doc));
    const exactPart = partCandidates(doc).filter((x) => x.keys.some((n) => norm(n) === k));
    if (exactMat.length && !exactPart.length) {
      targets = exactMat;
      label = `material ${exactMat.map((m) => m.getName()).join(', ')}`;
    } else if (partHits.length) {
      // Give the chosen parts their own copy of a shared material, so only they change.
      const prims = new Set(partHits.flatMap((n) => descendants(n)).filter((n) => n.getMesh()).flatMap((n) => n.getMesh().listPrimitives()));
      const otherUsers = (m) => m.listParents().some((p) => p.propertyType === PropertyType.PRIMITIVE && !prims.has(p));
      const copies = new Map();
      for (const p of prims) {
        let m = p.getMaterial();
        if (!m) {
          m = copies.get(null) || doc.createMaterial(`${threeName(partHits[0].getName())}_color`);
          copies.set(null, m);
        } else if (otherUsers(m)) {
          if (!copies.has(m)) copies.set(m, m.clone().setName(`${m.getName() || 'material'}_${threeName(partHits[0].getName()) || 'part'}`));
          m = copies.get(m);
        }
        p.setMaterial(m);
        if (!targets.includes(m)) targets.push(m);
      }
      label = `part${partHits.length > 1 ? 's' : ''} ${partHits.map((n) => threeName(n.getName()) || n.getMesh()?.getName()).join(', ')}`;
    } else {
      const looseMat = matCands.filter((x) => x.keys.some((n) => norm(n).includes(k))).map((x) => x.item);
      if (!looseMat.length) {
        throw fail(`no part or material named "${what}". Parts are: ${list(partNames(doc))}. Materials are: ${materials.map((m) => m.getName() || '(unnamed)').join(', ')}. Or use all.`);
      }
      targets = looseMat;
      label = `material ${looseMat.map((m) => m.getName()).join(', ')}`;
    }
  }

  const linear = c.toArray();
  let textured = 0;
  for (const m of targets) {
    const alpha = m.getBaseColorFactor()[3];
    m.setBaseColorFactor([linear[0], linear[1], linear[2], alpha]);
    if (m.getBaseColorTexture()) {
      textured++;
      if (!flags['keep-texture']) m.setBaseColorTexture(null);
    }
  }
  if (!flags['keep-texture']) await doc.transform(prune({ keepLeaves: true, propertyTypes: [PropertyType.TEXTURE, PropertyType.ACCESSOR] }));
  const hex = `#${c.getHexString()}`;
  const lines = [`  Colored ${label} ${hex}${textured ? (flags['keep-texture'] ? ' (kept the texture: the color tints it, dark textures stay dark)' : ' (removed the texture for a flat color; --keep-texture tints it instead)') : ''}`];
  await save(doc, file, `recolored ${label === 'everything' ? '' : `${label} `}${hex}`.replace('  ', ' '), lines);
}

// Removes the skeleton and its animations when no part bends with bones any more.
function dropUnusedSkeleton(doc) {
  const root = doc.getRoot();
  const skinned = root.listNodes().some((n) => n.getSkin() && n.getMesh());
  if (skinned) return false;
  const joints = jointsOf(doc);
  if (!joints.size) return false;
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) if (joints.has(ch.getTargetNode())) ch.dispose();
  }
  for (const n of root.listNodes()) n.setSkin(null);
  root.listSkins().forEach((s) => s.dispose());
  return true;
}

async function keep() {
  const file = findModel(args[0]);
  const doc = await load(file);
  const chosen = pickParts(doc, args.slice(1));
  const keepNodes = new Set(chosen.flatMap((n) => descendants(n)));
  const joints = jointsOf(doc);
  let removed = 0;
  for (const n of sceneNodes(doc)) {
    if (n.getMesh() && !keepNodes.has(n)) {
      n.setMesh(null).setSkin(null);
      removed++;
    }
  }
  const animsBefore = doc.getRoot().listAnimations().length;
  const dropped = dropUnusedSkeleton(doc);
  if (dropped) {
    // Items held in a hand: take them out of the skeleton as they sit in the hand.
    const scene = sceneOf(doc);
    for (const n of chosen) if (heldBy(n, joints)) scene.addChild(n);
  }
  await doc.transform(prune({ keepLeaves: false }));
  const animsAfter = doc.getRoot().listAnimations().length;
  const lines = [`  Kept ${chosen.map((n) => threeName(n.getName()) || n.getMesh()?.getName()).join(', ')} (${fmtNum(totalTris(doc))} triangles), removed ${removed} other part${removed === 1 ? '' : 's'}`];
  if (dropped) lines.push(`  Removed the skeleton${animsBefore > animsAfter ? ` and ${animsBefore - animsAfter} animations` : ''} (nothing left that bends).`);
  await save(doc, file, `with only ${chosen.map((n) => threeName(n.getName())).join(', ')} kept`, lines);
}

async function remove() {
  const file = findModel(args[0]);
  const doc = await load(file);
  const chosen = pickParts(doc, args.slice(1));
  const joints = jointsOf(doc);
  const gone = new Set(chosen.flatMap((n) => descendants(n)).filter((n) => n.getMesh()));
  const all = sceneNodes(doc).filter((n) => n.getMesh());
  if (all.every((n) => gone.has(n))) throw fail('that would remove every part. Use keep to choose what stays.');
  for (const n of chosen) {
    const sub = descendants(n);
    // Whole branch goes if no bones live inside it; otherwise only the meshes.
    if (!sub.some((d) => joints.has(d))) n.dispose();
    else sub.forEach((d) => d.getMesh() && d.setMesh(null).setSkin(null));
  }
  dropUnusedSkeleton(doc);
  await doc.transform(prune({ keepLeaves: false }));
  const names = chosen.map((n) => threeName(n.getName()) || n.getMesh()?.getName());
  await save(doc, file, `with ${names.join(', ')} removed`, [`  Removed ${names.join(', ')} (${fmtNum(totalTris(doc))} triangles left)`]);
}

async function turn() {
  const file = findModel(args[0]);
  const doc = await load(file);
  const deg = (k) => Number(flags[k] ?? 0);
  if (![deg('x'), deg('y'), deg('z')].every(Number.isFinite)) throw fail('--x, --y and --z take degrees, e.g. --x -90');
  if (!deg('x') && !deg('y') && !deg('z')) throw fail('say how to turn it: --x 90 or --x -90 (tip forward/back), --z 90 (roll sideways), --y 180 (face the other way)');
  const scene = sceneOf(doc);
  const q = new Quaternion().setFromEuler(new Euler(...['x', 'y', 'z'].map((k) => (deg(k) * Math.PI) / 180), 'XYZ'));
  const holder = doc.createNode('turned').setRotation([q.x, q.y, q.z, q.w]);
  for (const n of scene.listChildren()) holder.addChild(n);
  scene.addChild(holder);
  const b = getBounds(scene);
  const size = b.max.map((v, k) => v - b.min[k]);
  const turned = ['x', 'y', 'z'].filter((k) => deg(k)).map((k) => `${k} ${deg(k)}`).join(', ');
  await save(doc, file, `turned (${turned} degrees)`, [`  Turned ${turned} degrees. Now about ${size.map((v) => v.toFixed(2)).join(' x ')} (width x height x depth, before loadModel scales it)`]);
}

// Bone names often differ only by a prefix (mixamorig:Hips vs Hips).
const boneKey = (s) => norm(s).replace(/^(mixamorig\d*|armature|characterrig|rig|def|bip\d*|bone)/, '');

async function addAnims() {
  const file = findModel(args[0], 'character');
  const fromFile = findModel(args[1], 'file to copy animations from');
  if (path.resolve(file) === path.resolve(fromFile)) throw fail('the two files are the same. Give the character first, then the file with the animations.');
  const doc = await load(file);
  const src = await load(fromFile);
  const root = doc.getRoot();
  const srcAnims = src.getRoot().listAnimations();
  if (!srcAnims.length) throw fail(`${path.basename(fromFile)} has no animations to copy.`);

  let clips = srcAnims;
  if (flags.only?.length) {
    const picked = new Set();
    for (const q of flags.only) {
      const hits = findAnims(srcAnims, q);
      if (!hits.length) throw fail(`no animation "${q}" in ${path.basename(fromFile)}. It has: ${list(srcAnims.map((a) => a.getName()), 60)}`);
      hits.forEach((h) => picked.add(h));
    }
    clips = srcAnims.filter((a) => picked.has(a));
  }

  // Target nodes by name: bones first, then everything else.
  const joints = jointsOf(doc);
  const nodes = [...root.listNodes()].sort((a, b) => Number(joints.has(b)) - Number(joints.has(a)));
  const exact = new Map();
  const loose = new Map();
  for (const n of nodes) {
    if (!exact.has(norm(n.getName()))) exact.set(norm(n.getName()), n);
    if (!loose.has(boneKey(n.getName()))) loose.set(boneKey(n.getName()), n);
  }
  const findNode = (name) => exact.get(norm(name)) || loose.get(boneKey(name)) || null;

  const buffer = root.listBuffers()[0] || doc.createBuffer();
  const copied = new Map();
  const copyAccessor = (a) => {
    if (!copied.has(a)) {
      copied.set(a, doc.createAccessor(a.getName()).setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buffer));
    }
    return copied.get(a);
  };

  const have = new Set(root.listAnimations().map((a) => (a.getName() || '').toLowerCase()));
  const added = [];
  const skipped = [];
  let matched = 0;
  let total = 0;
  let scaleWarn = 0;
  for (const clip of clips) {
    const name = clip.getName() || 'Animation';
    if (have.has(name.toLowerCase())) {
      skipped.push(`${name} (already there)`);
      continue;
    }
    const anim = doc.createAnimation(name);
    const samplers = new Map();
    let ok = 0;
    for (const ch of clip.listChannels()) {
      const srcNode = ch.getTargetNode();
      const pathName = ch.getTargetPath();
      const dst = srcNode && findNode(srcNode.getName());
      if (!dst || (pathName === 'weights' && !dst.getMesh())) continue;
      const s = ch.getSampler();
      if (!samplers.has(s)) {
        const ns = doc.createAnimationSampler().setInput(copyAccessor(s.getInput())).setOutput(copyAccessor(s.getOutput())).setInterpolation(s.getInterpolation());
        anim.addSampler(ns);
        samplers.set(s, ns);
      }
      anim.addChannel(doc.createAnimationChannel().setTargetNode(dst).setTargetPath(pathName).setSampler(samplers.get(s)));
      ok++;
      // Moves made in centimeters on a character in meters fly away (Mixamo).
      if (pathName === 'translation') {
        const v = s.getOutput().getElement(0, []);
        const len = Math.hypot(v[0], v[1], v[2]);
        const rest = Math.hypot(...dst.getTranslation());
        if (len > 1e-3 && rest > 1e-3 && (len / rest > 20 || rest / len > 20)) scaleWarn++;
      }
    }
    total += clip.listChannels().length;
    matched += ok;
    if (!ok) {
      anim.dispose();
      skipped.push(`${name} (no bone names matched)`);
      continue;
    }
    added.push(`${name} (${ok}/${clip.listChannels().length} tracks)`);
    have.add(name.toLowerCase());
  }

  if (!added.length) {
    const why = matched === 0 && total > 0 ? ' The bone names are different, so these skeletons do not fit each other.' : '';
    throw fail(`nothing added. Skipped: ${list(skipped, 20)}.${why}`);
  }
  await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR] }));
  const lines = [`  Added ${added.length} animation${added.length === 1 ? '' : 's'}: ${list(added, 20)}`, `  Tracks matched: ${fmtNum(matched)} of ${fmtNum(total)}`];
  const already = skipped.filter((x) => x.endsWith('(already there)'));
  const other = skipped.filter((x) => !x.endsWith('(already there)'));
  if (already.length) lines.push(`  Skipped ${already.length} the character already has${already.length <= 8 ? `: ${already.map((x) => x.replace(' (already there)', '')).join(', ')}` : ''} (rename-anim first to keep both)`);
  if (other.length) lines.push(`  Skipped: ${list(other, 20)}`);
  if (matched < total * 0.6) lines.push('  Many bones did not match: parts of the body may stay still or in a T-pose. Check with npm run snap.');
  if (scaleWarn) lines.push(`  Warning: ${scaleWarn} moves look like they were made at a different size (cm vs m); the character may jump away. Check with npm run snap.`);
  const fromCredit = licenseInfo(src, fromFile).text;
  const ownCredit = licenseInfo(doc, file).text;
  const extraCredit = fromCredit && fromCredit !== ownCredit ? `animations from ${path.basename(fromFile)}: ${fromCredit}` : '';
  await save(doc, file, `with animations added from ${path.basename(fromFile)}`, lines, extraCredit);
}

async function renameAnim() {
  const file = findModel(args[0]);
  const [, oldName, newName] = args;
  if (!oldName || !newName) throw fail('usage: npm run remix -- rename-anim <file> <old name> <new name>');
  const doc = await load(file);
  const all = doc.getRoot().listAnimations();
  if (!all.length) throw fail(`${path.basename(file)} has no animations.`);
  const hits = findAnims(all, oldName);
  if (!hits.length) throw fail(`no animation "${oldName}". It has: ${list(all.map((a) => a.getName()), 60)}`);
  if (hits.length > 1) throw fail(`"${oldName}" matches ${hits.length} animations: ${list(hits.map((a) => a.getName()), 20)}. Use the full name.`);
  if (all.some((a) => a !== hits[0] && (a.getName() || '').toLowerCase() === newName.toLowerCase())) throw fail(`there is already an animation called ${newName}.`);
  const was = hits[0].getName();
  hits[0].setName(newName);
  await save(doc, file, `with animation ${was} renamed to ${newName}`, [`  Renamed ${was} -> ${newName}`]);
}

// ---------------------------------------------------------------- run

const ops = { parts, shrink, color, keep, remove, turn, anims, 'add-anims': addAnims, 'rename-anim': renameAnim };
const aliases = { list: 'parts', info: 'parts', recolor: 'color', colour: 'color', only: 'keep', drop: 'remove', delete: 'remove', rotate: 'turn', 'add-anim': 'add-anims', animations: 'anims', rename: 'rename-anim' };

function usage() {
  const lines = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1);
  const help = lines.slice(0, lines.findIndex((l) => !l.startsWith('//')));
  console.log(help.join('\n').replace(/^\/\/ ?/gm, ''));
}

try {
  const name = aliases[op] || op;
  if (!op || op === 'help' || op === '--help') {
    usage();
  } else if (!ops[name]) {
    console.log(`Unknown remix command "${op}". Commands: ${Object.keys(ops).join(', ')}`);
    process.exitCode = 1;
  } else {
    parseArgs();
    await ops[name]();
  }
} catch (e) {
  if (e instanceof Oops) console.log(`remix ${op}: ${e.message}`);
  else console.log(`remix ${op} failed: ${String(e?.message || e).split('\n')[0]}`);
  process.exitCode = 1;
}
