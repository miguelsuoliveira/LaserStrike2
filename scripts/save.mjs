#!/usr/bin/env node
// Save points (like in a video game), using git underneath.
//   npm run save -- "enemies chase the player"   make a save point
//   npm run saves                                list save points
//   npm run undo                                 throw away changes since the last save point
//   npm run load -- 3                            go back to save point #3 (newer ones stay in the list)
// A save ends with the game's public link, checked (see lib/share.mjs): friends see the saved change there.
// Nothing is ever lost: undo/load first stash the current files ("git stash list").
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { useLocalTools, hasGit } from './lib/tools.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // fileURLToPath: Windows drives, spaces in folder names
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

const [cmd, ...rest] = process.argv.slice(2);

useLocalTools(ROOT); // Git that the setup put into .tools/ (Windows)
if (!hasGit()) {
  console.log(
    'Save points need Git, and this computer has none.\n' +
      'For the AI: run `npm run setup` once (on Windows it gets Git by itself). If this message comes again, tell the team\n' +
      'in one sentence to ask a mentor to install Git, and carry on: the game itself is fine.',
  );
  if (cmd === 'save') await printLink();
  process.exit(cmd === 'save' ? 0 : 1);
}
if (tryGit('rev-parse', '--is-inside-work-tree') !== 'true') {
  git('init', '-q');
}
if (!tryGit('config', 'user.name')) git('config', 'user.name', 'Game Jam Team');
if (!tryGit('config', 'user.email')) git('config', 'user.email', 'team@game-jam.local');
// Same line endings on every system (see .gitattributes), without warnings on Windows.
if (tryGit('config', '--local', 'core.autocrlf') !== 'false') tryGit('config', '--local', 'core.autocrlf', 'false');

const changed = () => git('status', '--porcelain') !== '';

// The public link, checked through the internet (started again if it stopped). Never stops a save.
async function printLink() {
  try {
    const { findGame, ensureLink, linkReport, linkOff } = await import('./lib/share.mjs');
    if (linkOff(ROOT)) return;
    const game = await findGame(ROOT);
    if (!game) return console.log('No public link: the game is not running. `npm run share` starts it and prints the link.');
    console.log(linkReport(await ensureLink(ROOT, game, (msg) => console.log(msg))));
  } catch (e) {
    console.log(`No public link right now (${e.message}). Leave the link line out of your reply.`);
  }
}

function list() {
  const out = tryGit('log', '--reverse', '--format=%h|%ar|%s') || '';
  return out
    .split('\n')
    .filter(Boolean)
    .map((line, i) => {
      const [hash, when, ...msg] = line.split('|');
      return { n: i + 1, hash, when, message: msg.join('|') };
    });
}

function backup(reason) {
  if (!changed()) return;
  git('stash', 'push', '--include-untracked', '-m', `backup before ${reason}`);
  console.log('(Your unsaved changes were kept in a backup: a mentor can get them back with "git stash list".)');
}

if (cmd === 'save') {
  const message = rest.join(' ').trim() || 'save point';
  if (!changed()) {
    console.log('Nothing changed since the last save point.');
  } else {
    git('add', '-A');
    git('commit', '-q', '-m', message);
    console.log(`Saved: #${list().length} "${message}"`);
  }
  await printLink();
} else if (cmd === 'saves') {
  const saves = list();
  if (!saves.length) console.log('No save points yet. Make one with: npm run save -- "what works now"');
  for (const s of saves.slice(-20)) console.log(`#${s.n}  ${s.when.padEnd(16)} ${s.message}`);
  if (changed()) console.log('\n(There are unsaved changes since the last save point.)');
} else if (cmd === 'undo') {
  if (!changed()) {
    console.log('Nothing to undo: no changes since the last save point.');
    process.exit(0);
  }
  backup('undo');
  console.log(`Back to the last save point: "${list().at(-1)?.message}"`);
} else if (cmd === 'load') {
  const n = Number(rest[0]);
  const saves = list();
  const target = saves.find((s) => s.n === n);
  if (!target) {
    console.log(`No save point #${rest[0]}. Run: npm run saves`);
    process.exit(1);
  }
  backup(`loading save #${n}`);
  git('restore', `--source=${target.hash}`, '--staged', '--worktree', '--', '.');
  if (changed()) {
    git('add', '-A');
    git('commit', '-q', '-m', `went back to save #${n}: ${target.message}`);
  }
  console.log(`Loaded save #${n} "${target.message}". (It is now save #${list().length}; newer saves are still in the list.)`);
} else {
  console.log('Use: npm run save -- "message" | npm run saves | npm run undo | npm run load -- <number>');
}
