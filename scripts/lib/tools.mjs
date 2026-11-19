// Programs the setup put inside the project (.tools/) for computers that lacked them:
// Node.js (scripts/bootstrap.sh, bootstrap.ps1) and, on Windows, Git (scripts/setup.mjs).
// The scripts call useLocalTools() first, so they find these even when the computer's PATH doesn't.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WIN = process.platform === 'win32';

export function useLocalTools(root) {
  const dirs = [path.join(root, '.tools', 'git', 'cmd'), path.join(root, '.tools', 'node', WIN ? '' : 'bin')];
  const key = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  const have = (process.env[key] || '').split(path.delimiter);
  const add = dirs.filter((d) => fs.existsSync(d) && !have.includes(d));
  if (add.length) process.env[key] = [...add, ...have].join(path.delimiter);
}

export function hasGit() {
  if (process.platform === 'darwin') {
    // A Mac without the developer tools has a pretend git that only opens an "install" window.
    const where = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout?.trim();
    if (!where) return false;
    if (where === '/usr/bin/git' && spawnSync('xcode-select', ['-p'], { stdio: 'ignore' }).status !== 0) return false;
  }
  return spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0;
}

// Linux inside Windows (WSL): the browser and the screen belong to Windows.
export function isWsl() {
  if (process.platform !== 'linux') return false;
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    return /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
}

// A setting from the computer's environment or the project's .env file.
export function setting(root, name) {
  if (process.env[name] !== undefined) return process.env[name];
  try {
    return fs.readFileSync(path.join(root, '.env'), 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(\\S+)`, 'm'))?.[1] || '';
  } catch {
    return '';
  }
}
export const isOff = (value) => /^(off|0|false|no)$/i.test(value || '');
