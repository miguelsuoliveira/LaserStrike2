#!/usr/bin/env node
// For people improving this starter (mentors, maintainers). Not for the kids' AI.
// Test the rules and tools with a real agent without touching this repo: the agent's save points
// are git commits, and its game, downloads and plan would otherwise land in your working tree.
//
//   node scripts/test-run.mjs new [name]
//        copies this folder as it is now (uncommitted changes included, no .git, no node_modules)
//        to ../<this folder>-test-<name>. Open THAT folder with the agent you want to test.
//   node scripts/test-run.mjs collect [name]
//        gathers what the test produced into .tmp-review/<name>/ here: the agent's transcript
//        (Codex session logs for that folder), our-game.md, the game code, logs,
//        screenshots, preview pictures, save points and a list of new assets.
//   node scripts/test-run.mjs list
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = path.dirname(ROOT);
const PREFIX = `${path.basename(ROOT)}-test-`;
const [cmd, nameArg] = process.argv.slice(2);
const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// The list of test copies lives here (not in the copies: a test agent should find nothing that says "test").
const RUNS_FILE = path.join(ROOT, '.tmp-review', 'runs.json');
const copies = () => {
  let runs = [];
  try {
    runs = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8'));
  } catch {}
  return runs
    .filter((r) => fs.existsSync(r.dir))
    .map((r) => ({ name: r.name, dir: r.dir, time: Date.parse(r.created) }))
    .sort((x, y) => x.time - y.time);
};

if (cmd === 'new') {
  let name = nameArg ? safe(nameArg) : '';
  if (!name) {
    let n = 1;
    while (fs.existsSync(path.join(PARENT, `${PREFIX}${n}`))) n++;
    name = String(n);
  }
  const dest = path.join(PARENT, PREFIX + name);
  if (fs.existsSync(dest)) fail(`${dest} already exists. Pick another name.`);
  const SKIP = new Set(['.git', 'node_modules', 'dist', 'logs', '.screenshots', '.previews', '.cache', '.tools', '.DS_Store']);
  fs.cpSync(ROOT, dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(ROOT, src);
      if (!rel) return true;
      const top = rel.split(path.sep)[0];
      if (SKIP.has(top) || /^\.tmp-/.test(top)) return false;
      return true;
    },
  });
  fs.mkdirSync(path.dirname(RUNS_FILE), { recursive: true });
  fs.writeFileSync(RUNS_FILE, JSON.stringify([...copies(), { name, dir: dest, created: new Date().toISOString() }].map((r) => ({ name: r.name, dir: r.dir, created: r.created || new Date(r.time).toISOString() })), null, 2) + '\n');
  // Its own save-point history from the start, so save points can never land in a repo around it.
  try {
    execFileSync('git', ['init', '-q'], { cwd: dest, stdio: 'ignore' });
  } catch {}
  console.log(`Fresh copy: ${dest}`);
  console.log('\nOpen that folder with the agent you are testing, for example:');
  console.log(`  cd "${dest}" && codex`);
  console.log('and write like the kids would: "Hi! We\'re ready to make our game."');
  console.log(`\nAfterwards: node scripts/test-run.mjs collect ${name}`);
} else if (cmd === 'collect') {
  const all = copies();
  const run = nameArg ? all.find((c) => c.name === safe(nameArg)) : all.at(-1);
  if (!run) fail(nameArg ? `No test copy named "${nameArg}". Try: node scripts/test-run.mjs list` : 'No test copies yet. Make one: node scripts/test-run.mjs new');
  const out = path.join(ROOT, '.tmp-review', run.name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const report = [`Test run "${run.name}"`, `folder: ${run.dir}`, `collected: ${new Date().toISOString()}`, ''];

  // 1. The plan, the game, logs and pictures.
  const take = (rel, maxBytes = 3e6) => {
    const src = path.join(run.dir, rel);
    if (!fs.existsSync(src)) return 0;
    let n = 0;
    fs.cpSync(src, path.join(out, 'game', rel), {
      recursive: true,
      filter: (f) => {
        const st = fs.statSync(f);
        if (st.isDirectory()) return true;
        if (st.size > maxBytes) return false;
        n++;
        return true;
      },
    });
    return n;
  };
  for (const rel of ['our-game.md', 'src/game', 'src/tuning.json', 'logs', '.screenshots', '.previews', 'public/assets/CREDITS.md']) {
    report.push(`${String(take(rel)).padStart(4)} file(s)  ${rel}`);
  }

  // 2. Assets the agent added (names and sizes only).
  const listFiles = (dir, base = dir, acc = new Map()) => {
    if (!fs.existsSync(dir)) return acc;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) listFiles(f, base, acc);
      else acc.set(path.relative(base, f), fs.statSync(f).size);
    }
    return acc;
  };
  const before = listFiles(path.join(ROOT, 'public', 'assets'));
  const added = [...listFiles(path.join(run.dir, 'public', 'assets'))].filter(([f]) => !before.has(f) && !f.endsWith('.DS_Store'));
  fs.writeFileSync(path.join(out, 'new-assets.txt'), added.map(([f, size]) => `${(size / 1024).toFixed(0).padStart(7)} KB  ${f}`).join('\n') + '\n');
  report.push(`${String(added.length).padStart(4)} new asset file(s) (new-assets.txt)`);

  // 3. Save points.
  try {
    const log = execFileSync('git', ['log', '--reverse', '--format=%h %ad %s', '--date=format:%H:%M:%S'], { cwd: run.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    fs.writeFileSync(path.join(out, 'save-points.txt'), log);
    report.push(`${String(log.split('\n').filter(Boolean).length).padStart(4)} save point(s) (save-points.txt)`);
  } catch {
    report.push('   0 save points (the copy has no git history)');
  }

  // 4. Transcripts: session logs of agents that worked in that folder.
  const tdir = path.join(out, 'transcripts');
  fs.mkdirSync(tdir, { recursive: true });
  const real = fs.realpathSync(run.dir);
  const needles = [...new Set([run.dir, real, JSON.stringify(run.dir).slice(1, -1), JSON.stringify(real).slice(1, -1)])];
  const mentions = (file) => {
    try {
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(Math.min(fs.statSync(file).size, 256 * 1024));
      fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      const text = buf.toString('utf8');
      return needles.some((n) => text.includes(n));
    } catch {
      return false;
    }
  };
  const walk = (dir, depth, hit) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) depth > 0 && walk(f, depth - 1, hit);
      else if (e.name.endsWith('.jsonl') && fs.statSync(f).mtimeMs >= run.time - 60000) hit(f);
    }
  };
  const home = os.homedir();
  // Codex keeps one log per session; the log names the folder it worked in.
  let found = 0;
  walk(path.join(process.env.CODEX_HOME || path.join(home, '.codex'), 'sessions'), 5, (f) => {
    if (!mentions(f)) return;
    fs.copyFileSync(f, path.join(tdir, `codex-${path.basename(f)}`));
    found++;
  });
  report.push(`${String(found).padStart(4)} transcript(s) (transcripts/)`);
  if (!found) {
    report.push(
      '',
      'No session log found for that folder (looked in ~/.codex/sessions).',
      `Export or copy the conversation by hand into ${path.join(tdir, 'transcript.md')} (any text format works).`,
    );
  }
  fs.writeFileSync(path.join(out, 'REPORT.txt'), report.join('\n') + '\n');
  console.log(report.join('\n'));
  console.log(`\nEverything is in ${path.relative(ROOT, out)}${path.sep} (git ignores it).`);
} else if (cmd === 'list') {
  const all = copies();
  if (!all.length) console.log('No test copies yet. Make one: node scripts/test-run.mjs new');
  for (const c of all) console.log(`${c.name.padEnd(20)} ${new Date(c.time).toISOString().slice(0, 16).replace('T', ' ')}  ${c.dir}`);
} else {
  console.log('Use: node scripts/test-run.mjs new [name] | collect [name] | list');
}

function fail(msg) {
  console.log(msg);
  process.exit(1);
}
