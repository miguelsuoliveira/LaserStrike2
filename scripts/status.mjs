#!/usr/bin/env node
// The AI's first command for every message from the team:
//   npm run status
// It makes sure the game and its public link are running (setting up or repairing whatever is not),
// then prints what the AI needs for this reply: the checked link, where the team is in the workshop,
// and a few random idea sparks. Safe to run any time; about a second when everything is fine.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readPlan, planAdvice, sparkLine } from './spark.mjs';
import { findGame, ensureLink, linkReport, linkOff } from './lib/share.mjs';
import { useLocalTools } from './lib/tools.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
useLocalTools(ROOT);

const installed = fs.existsSync(path.join(ROOT, 'node_modules', 'vite', 'package.json'));
const game = installed ? await findGame(ROOT) : null;
if (!game) {
  // Not installed, or the game stopped: the full setup (it prints the link and what to do next).
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'setup.mjs')], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  console.log(`The game is running: ${game.url}`);
  if (!linkOff(ROOT)) console.log(linkReport(await ensureLink(ROOT, game, (msg) => console.log(msg))));
}

const plan = readPlan(ROOT);
if (game) console.log(planAdvice(plan)); // (the setup above already said it)
console.log(sparkLine(plan.stage));
