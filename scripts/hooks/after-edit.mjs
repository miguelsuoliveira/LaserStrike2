#!/usr/bin/env node
// Claude Code hook: right after the AI edits a file, catch syntax errors
// and broken src/tuning.json so they get fixed before anyone reloads the game.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let file = '';
try {
  file = JSON.parse(raw).tool_input?.file_path || '';
} catch {
  process.exit(0);
}
if (!file || !fs.existsSync(file)) process.exit(0);

if (file.endsWith('tuning.json')) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`src/tuning.json is not valid JSON anymore: ${e.message}. Fix it (the sliders read this file).`);
    process.exit(2);
  }
} else if (/[\\/]src[\\/].*\.js$/.test(file)) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    const msg = (r.stderr || '').split('\n').filter((l) => l && !l.startsWith('Node.js')).slice(0, 8).join('\n');
    console.error(`Syntax error in ${file}:\n${msg}`);
    process.exit(2);
  }
}
