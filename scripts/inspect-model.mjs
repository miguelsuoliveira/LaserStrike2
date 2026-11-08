#!/usr/bin/env node
// Prints what is inside a .glb / .gltf model: size in meters, triangles,
// textures, parts, skeleton and animation names. Cheap for the AI to read.
//   npm run inspect -- public/assets/models/characters/robot.glb
//   npm run inspect -- public/assets/models/racing     (every model in a folder, one line each)
import fs from 'node:fs';
import path from 'node:path';
import { gltfInfo } from './lib/gltf-info.mjs';

const args = process.argv.slice(2);
if (!args.length) {
  console.log('Usage: npm run inspect -- <file.glb | folder>');
  process.exit(1);
}

const files = [];
for (const a of args) collect(a);
if (!files.length) {
  console.log('No .glb or .gltf files found.');
  process.exit(1);
}
const brief = files.length > 1;
const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : '?');
for (const f of files) {
  let info;
  try {
    info = gltfInfo(f);
  } catch (e) {
    console.log(`${f}: could not read (${e.message})`);
    continue;
  }
  const { size } = info;
  if (brief) {
    const a = info.animations.length ? `, ${info.animations.length} animations` : '';
    console.log(`${f}  ${info.mb.toFixed(1)} MB, ${fmt(size[0])} x ${fmt(size[1])} x ${fmt(size[2])} m${info.rigged ? ', rigged' : ''}${a}`);
    continue;
  }
  console.log(`${f}  (${info.mb.toFixed(1)} MB)`);
  console.log(`  Size (meters): width ${fmt(size[0])}, height ${fmt(size[1])}, depth ${fmt(size[2])}  (loadModel(..., { height }) rescales it)`);
  console.log(`  Triangles: ${info.triangles.toLocaleString()}  Meshes: ${info.meshes}  Materials: ${info.materials}  Textures: ${info.textures.join(', ') || 'none'}`);
  console.log(`  Parts: ${info.parts.join(', ') || '(unnamed)'}`);
  if (info.rigged) console.log(`  Rigged: yes, ${info.bones.length} bones: ${info.bones.join(', ')}`);
  else console.log('  Rigged: no (no skeleton; animate it with code)');
  if (info.extensions.length) console.log(`  Extensions: ${info.extensions.join(', ')}`);
  const anims = info.animations.map((a) => `${a.name} (${a.seconds.toFixed(1)}s)`);
  console.log(`  Animations (${anims.length}): ${anims.join(', ') || 'none'}`);
}

function collect(p) {
  if (!fs.existsSync(p)) {
    console.log(`Not found: ${p}`);
    return;
  }
  if (fs.statSync(p).isDirectory()) {
    for (const name of fs.readdirSync(p).sort()) collect(path.join(p, name));
  } else if (/\.(glb|gltf)$/i.test(p)) {
    files.push(p);
  }
}
