// Shows errors on screen in a friendly box, and (while `npm run dev` is
// running) copies errors, warnings and log() calls into logs/browser.log so
// the AI can read them.
//   log('player hp', hp)   -> prints in the browser console AND logs/browser.log

const IGNORE = [
  'using deprecated parameters for the initialization function', // Rapier, harmless
  '[vite]',
];
const recent = new Map();
let overlay = null;

export function sendLog(level, message) {
  if (!import.meta.env.DEV) return;
  if (IGNORE.some((s) => message.includes(s))) return;
  // Don't flood the log with the same line every frame.
  const now = performance.now();
  const last = recent.get(message);
  if (last && now - last < 3000) return;
  recent.set(message, now);
  if (recent.size > 200) recent.clear();
  fetch('/__log', { method: 'POST', body: JSON.stringify({ level, message }) }).catch(() => {});
}

export function log(...args) {
  console.log(...args);
  sendLog('log', args.map(format).join(' '));
}

function format(value) {
  if (value instanceof Error) return cleanStack(value);
  if (value && value.isVector3) return `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// Turns "http://localhost:5173/src/game/game.js?t=123:42:7" into "src/game/game.js:42:7".
function cleanStack(error) {
  const text = `${error.name || 'Error'}: ${error.message}\n${error.stack || ''}`;
  return text
    .split('\n')
    .filter((line, i) => i === 0 || (line.includes('/src/') && !line.includes('node_modules')))
    .slice(0, 6)
    .map((line) => line.replace(/https?:\/\/[^/]+\//g, '').replace(/\?t=\d+/g, '').replace(/\?v=[\w]+/g, ''))
    .filter((line, i, all) => all.indexOf(line) === i)
    .join('\n');
}

export function reportError(error, where = '') {
  const message = error instanceof Error ? cleanStack(error) : String(error);
  const full = where ? `${message}\n(while running ${where})` : message;
  console.error(error);
  sendLog('error', full);
  showError(full);
}

function showError(message) {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'error-box';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';
  const title = document.createElement('b');
  title.textContent = 'Oops! Something broke.';
  const text = document.createElement('pre');
  text.textContent = message;
  const hint = document.createElement('div');
  hint.textContent = import.meta.env.DEV
    ? 'Tell the AI "fix the error". It can read logs/browser.log.'
    : 'Check the browser console for details.';
  const close = document.createElement('button');
  close.textContent = 'Hide';
  close.onclick = () => (overlay.style.display = 'none');
  overlay.append(title, text, hint, close);
  overlay.style.display = 'block';
}

export function installDebug() {
  window.addEventListener('error', (e) => reportError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason || 'Promise failed'));
  const warn = console.warn.bind(console);
  console.warn = (...args) => {
    warn(...args);
    sendLog('warn', args.map(format).join(' '));
  };
  const error = console.error.bind(console);
  console.error = (...args) => {
    error(...args);
    sendLog('error', args.map(format).join(' '));
  };
  sendLog('info', `--- game page loaded ${location.search} ---`);
}
