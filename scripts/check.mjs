#!/usr/bin/env node
// Fast check for mistakes that stop the game from loading: syntax errors,
// imports of files or names that don't exist, broken src/tuning.json.
//   npm run check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let ok = true;

// Claude Code reads skills from .claude/skills; keep it pointing at .agents/skills.
(await import('./link-skills.mjs')).linkSkills();

try {
  JSON.parse(fs.readFileSync(path.join(ROOT, 'src/tuning.json'), 'utf8'));
} catch (e) {
  ok = false;
  console.log(`src/tuning.json is broken: ${e.message}`);
}

const { build } = await import('vite');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'game-check-'));
const started = Date.now();
try {
  await build({
    root: ROOT,
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true, copyPublicDir: false, minify: false, reportCompressedSize: false },
  });
} catch (e) {
  ok = false;
  const msg = String(e.message || e)
    .replace(/\x1b\[[0-9;]*m/g, '') // no terminal colors
    .replaceAll(ROOT + path.sep, '')
    .split('\n')
    .slice(0, 12)
    .join('\n');
  console.log(`Code problem:\n${msg}`);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}

// Asset paths used in code must exist in public/.
const srcFiles = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(d, e.name));
    else if (e.name.endsWith('.js')) srcFiles.push(path.join(d, e.name));
  }
};
walk(path.join(ROOT, 'src/game'));
for (const f of srcFiles) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/['"`](assets\/[^'"`$]+?\.(glb|gltf|hdr|mp3|ogg|wav|png|jpe?g|webp))['"`]/g)) {
    if (!fs.existsSync(path.join(ROOT, 'public', m[1]))) {
      ok = false;
      console.log(`Missing file: public/${m[1]} (used in ${path.relative(ROOT, f)})`);
    }
  }
}

// Engine helpers used without importing them (a crash only when that line runs).
const engineIndex = fs.readFileSync(path.join(ROOT, 'src/engine/index.js'), 'utf8');
const engineNames = new Set();
for (const m of engineIndex.matchAll(/export\s*\{([^}]*)\}/g)) {
  for (const part of m[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop().trim();
    if (name) engineNames.add(name);
  }
}
for (const m of engineIndex.matchAll(/export\s+(?:async\s+)?(?:function|const|let)\s+(\w+)/g)) engineNames.add(m[1]);
for (const f of srcFiles) {
  const text = fs.readFileSync(f, 'utf8');
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
  const imported = new Set();
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) imported.add(part.trim().split(/\s+as\s+/).pop().trim());
  }
  for (const m of text.matchAll(/import\s+(?:\*\s+as\s+)?(\w+)/g)) imported.add(m[1]);
  for (const name of engineNames) {
    if (imported.has(name)) continue;
    const declared = new RegExp(`(?:function\\s+|const\\s+|let\\s+|var\\s+|class\\s+)${name}\\b|[{,]\\s*${name}\\s*[,}=]`).test(code);
    const used = new RegExp(`(?<![\\w.$])${name}\\s*(?:\\(|\\.|\\[)`).test(code);
    if (used && !declared) {
      ok = false;
      console.log(`${path.relative(ROOT, f)} uses \`${name}\` but doesn't import it: add it to the import from '../engine/index.js'`);
    }
  }
}

console.log(ok ? `OK: the code builds (${((Date.now() - started) / 1000).toFixed(1)}s). Run \`npm run snap\` to see it running.` : 'Fix the problems above.');
process.exit(ok ? 0 : 1);
