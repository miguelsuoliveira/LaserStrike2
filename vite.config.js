import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const TUNING_FILE = path.resolve('src/tuning.json');
const LOG_FILE = path.resolve('logs/browser.log');
const MAX_LOG_LINES = 300;

// Dev-server helpers for the game jam:
// - POST /__tuning saves slider values into src/tuning.json.
// - POST /__log appends browser errors and logs to logs/browser.log,
//   so the AI can read what went wrong without anyone copying it.
// - When the AI edits src/tuning.json, the new numbers are sent to the
//   running game live instead of reloading the page.
function gameJamTools() {
  let lastWritten = null;

  const readBody = (req) =>
    new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => resolve(body));
    });

  return {
    name: 'game-jam-tools',
    configureServer(server) {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      fs.writeFileSync(LOG_FILE, `[${time()}] dev server started\n`);

      // Lets `npm run snap` check this server belongs to this project.
      server.middlewares.use('/__project', (req, res) => res.end(server.config.root));

      server.middlewares.use('/__tuning', async (req, res) => {
        if (req.method !== 'POST') return res.end();
        const body = await readBody(req);
        try {
          const text = JSON.stringify(JSON.parse(body), null, 2) + '\n';
          if (!fs.existsSync(TUNING_FILE) || fs.readFileSync(TUNING_FILE, 'utf8') !== text) {
            lastWritten = text;
            fs.writeFileSync(TUNING_FILE, text);
          }
          res.end('ok');
        } catch (e) {
          res.statusCode = 400;
          res.end(String(e));
        }
      });

      server.middlewares.use('/__log', async (req, res) => {
        if (req.method !== 'POST') return res.end();
        const body = await readBody(req);
        try {
          const { level, message } = JSON.parse(body);
          appendLog(`[${time()}] ${level.toUpperCase()}: ${String(message).slice(0, 2000)}`);
        } catch {
          // ignore broken log lines
        }
        res.end('ok');
      });
    },
    async hotUpdate({ file, read, server }) {
      if (this.environment.name !== 'client') return;
      if (path.resolve(file) === TUNING_FILE) {
        const text = await read();
        if (text !== lastWritten) {
          try {
            server.ws.send({ type: 'custom', event: 'tuning:update', data: JSON.parse(text) });
            appendLog(`[${time()}] INFO: tuning.json changed, sent new values to the game`);
          } catch (e) {
            appendLog(`[${time()}] ERROR: src/tuning.json is not valid JSON: ${e.message}`);
          }
        }
        return [];
      }
    },
  };
}

function time() {
  return new Date().toTimeString().slice(0, 8);
}

function appendLog(line) {
  let lines = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean) : [];
  lines.push(line);
  if (lines.length > MAX_LOG_LINES) lines = lines.slice(-MAX_LOG_LINES);
  fs.writeFileSync(LOG_FILE, lines.join('\n') + '\n');
}

export default defineConfig({
  base: './',
  plugins: [gameJamTools()],
  server: {
    watch: { ignored: ['**/logs/**', '**/.screenshots/**', '**/dist/**'] },
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
});
