// The skills live in .agents/skills (Codex and other agents read them there).
// Claude Code reads .claude/skills, so this makes .claude/skills point to the same folder.
// Runs after `npm install` and from `npm run check`; safe to run any time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const real = path.join(root, '.agents', 'skills');
const link = path.join(root, '.claude', 'skills');

export function linkSkills() {
  if (!fs.existsSync(real)) return false;
  try {
    if (fs.realpathSync(link) === fs.realpathSync(real)) return true;
  } catch {}
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.rmSync(link, { recursive: true, force: true });
  try {
    // 'junction' works on Windows without admin rights; other systems ignore the type.
    fs.symlinkSync(process.platform === 'win32' ? real : '../.agents/skills', link, 'junction');
  } catch {
    fs.cpSync(real, link, { recursive: true });
  }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  linkSkills();
}
