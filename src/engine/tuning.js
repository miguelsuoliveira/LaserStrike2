// Sliders for every game number. Call tune() ONCE at the top of a file:
//
//   const P = tune('Player', {
//     speed: 6,                                  // slider, range guessed
//     jumpHeight: { value: 2, min: 0, max: 10 }, // slider with your range
//     color: '#ff8800',                          // color picker
//     invincible: false,                         // checkbox
//     mode: { value: 'easy', options: ['easy', 'hard'] }, // dropdown
//   });
//   ...then read P.speed every frame. Moving a slider changes it live.
//
// When a person MOVES a slider, that value is saved in src/tuning.json (while
// `npm run dev` runs) and wins over the number in code. Everything else uses the
// number in code. "Reset" in a folder deletes its saved values.
// Editing src/tuning.json updates the running game live (delete a line = back to the code value).
// Press ` (backquote) or click "Sliders" to show/hide the panel.
import GUI from 'lil-gui';
import saved from '../tuning.json';

const state = {};
const defaults = {};
const controllers = {};
let gui = null;
let saveTimer = null;
let toggleButton = null;
const params = new URLSearchParams(location.search);
const hiddenByUrl = params.has('demo');
// ?tune=Health.hearts=1,Sky.timeOfDay=20 sets sliders for this page load only (used by `npm run snap -- --set`).
const overrides = {};
for (const pair of (params.get('tune') || '').split(',').filter(Boolean)) {
  const [key, raw] = pair.split('=').map((x) => x.trim());
  const [folder, name] = key.split('.');
  const value = raw === 'true' ? true : raw === 'false' ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
  (overrides[folder] ||= {})[name] = value;
}
const saving = import.meta.env.DEV && !params.has('tune');

function getGui() {
  if (gui) return gui;
  gui = new GUI({ title: 'Sliders (press ` to hide)', width: 300 });
  gui.domElement.classList.add('tuning-panel');
  gui.close();
  gui.hide();
  toggleButton = document.createElement('button');
  toggleButton.className = 'tuning-button';
  toggleButton.textContent = 'Sliders';
  toggleButton.onclick = () => toggleSliders();
  if (!hiddenByUrl) document.body.appendChild(toggleButton);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') toggleSliders();
  });
  return gui;
}

export function toggleSliders(show) {
  const g = getGui();
  const visible = show ?? g._hidden;
  if (visible) {
    g.show();
    g.open();
  } else {
    g.hide();
  }
}

function niceStep(range) {
  const raw = range / 200;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) || raw;
}

function normalize(def) {
  if (def && typeof def === 'object' && !Array.isArray(def) && 'value' in def) return { ...def };
  if (Array.isArray(def)) return { value: def[0], min: def[1], max: def[2], step: def[3] };
  return { value: def };
}

function sameType(a, b) {
  return typeof a === typeof b;
}

export function tune(folderName, defs) {
  const values = (state[folderName] ||= {});
  const ctrls = (controllers[folderName] ||= {});
  const g = getGui();
  let folder = g.folders.find((f) => f._title === folderName);
  if (!folder) {
    folder = g.addFolder(folderName);
    folder.close();
  }
  const defs0 = (defaults[folderName] ||= {});

  for (const [key, raw] of Object.entries(defs)) {
    if (ctrls[key]) continue; // already registered (tune() called twice)
    const spec = normalize(raw);
    defs0[key] = spec.value;
    const savedValue = overrides[folderName]?.[key] ?? saved?.[folderName]?.[key];
    values[key] = savedValue !== undefined && sameType(savedValue, spec.value) ? savedValue : spec.value;

    let c;
    const v = values[key];
    if (typeof spec.value === 'function') {
      c = folder.add(values, key);
    } else if (spec.options) {
      c = folder.add(values, key, spec.options);
    } else if (typeof v === 'boolean') {
      c = folder.add(values, key);
    } else if (typeof v === 'string' && v.startsWith('#')) {
      c = folder.addColor(values, key);
    } else if (typeof v === 'number') {
      const base = Math.abs(spec.value) || 1;
      let min = spec.min ?? (spec.value < 0 ? -base * 4 : 0);
      let max = spec.max ?? base * 4;
      min = Math.min(min, v);
      max = Math.max(max, v);
      c = folder.add(values, key, min, max, spec.step ?? niceStep(max - min));
    } else {
      c = folder.add(values, key);
    }
    // Only a person moving the slider saves it (code changing the value doesn't).
    if (typeof spec.value !== 'function') {
      c.onChange((value) => {
        (saved[folderName] ||= {})[key] = value;
        scheduleSave();
      });
    }
    ctrls[key] = c;
  }

  if (!folder.controllers.some((c) => c.property === '__reset')) {
    const reset = {
      __reset() {
        delete saved[folderName];
        for (const [k, v] of Object.entries(defaults[folderName])) {
          if (typeof v === 'function') continue;
          state[folderName][k] = v;
          controllers[folderName][k].updateDisplay();
        }
        scheduleSave();
      },
    };
    folder.add(reset, '__reset').name('↺ Reset to code values');
  }
  // Keep the reset button last.
  const resetCtrl = folder.controllers.find((c) => c.property === '__reset');
  folder.$children.appendChild(resetCtrl.domElement);
  return values;
}

function scheduleSave() {
  if (!saving) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    for (const f of Object.keys(saved)) if (!Object.keys(saved[f] || {}).length) delete saved[f];
    fetch('/__tuning', { method: 'POST', body: JSON.stringify(saved) }).catch(() => {});
  }, 400);
}

// The AI (or you) edited src/tuning.json: update the live values and sliders.
if (import.meta.hot) {
  import.meta.hot.on('tuning:update', (data) => {
    for (const k of Object.keys(saved)) delete saved[k];
    Object.assign(saved, data);
    for (const [folder, values] of Object.entries(state)) {
      for (const k of Object.keys(values)) {
        const def = defaults[folder]?.[k];
        if (typeof def === 'function') continue;
        let v = data[folder]?.[k];
        if (v === undefined || !sameType(v, def)) v = def; // line deleted: back to the code value
        values[k] = v;
        const c = controllers[folder]?.[k];
        if (c) {
          if (typeof v === 'number' && c._max !== undefined) {
            if (v > c._max) c.max(v);
            if (v < c._min) c.min(v);
          }
          c.updateDisplay();
        }
      }
    }
  });
}
