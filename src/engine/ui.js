// Text and screens on top of the game.
//   ui.text('score', 'Score: 0')                       top-left by default
//   ui.text('timer', '60', { at: 'top-right', size: 40, color: '#ffdd00' })
//      at: 'top-left' | 'top' | 'top-right' | 'bottom-left' | 'bottom' | 'bottom-right' | 'center'
//   ui.bar('health', 80, 100, { color: '#e33', label: 'Health' })   a bar that fills up
//   ui.remove('score')
//   ui.message('Level 2!', { seconds: 2 })             big text in the middle for a moment
//   await ui.title({ title: 'My Game', text: 'Collect all the stars!', button: 'Play' })
//   await ui.screen({ title: 'You win!', text: 'Score: 10', button: 'Play again' })
//   image: 'assets/images/logo.png' on title/screen shows a picture above the title (the kids' logo)
//   ui.crosshair(true)                                 dot in the middle for aiming
// While a screen is open the game is paused.
import { setPaused } from './state.js';
import { input } from './input.js';

const slots = {};
const items = {};

function slot(at) {
  if (!slots[at]) {
    const el = document.createElement('div');
    el.className = `hud hud-${at}`;
    document.body.appendChild(el);
    slots[at] = el;
  }
  return slots[at];
}

export const ui = {
  text(id, text, { at = 'top-left', size, color } = {}) {
    let el = items[id];
    if (!el) {
      el = document.createElement('div');
      el.className = 'hud-text';
      slot(at).appendChild(el);
      items[id] = el;
    }
    el.textContent = text;
    if (size) el.style.fontSize = `${size}px`;
    if (color) el.style.color = color;
    return el;
  },

  bar(id, value, max = 100, { at = 'top-left', color = '#4ade80', label = '', width = 220 } = {}) {
    let el = items[id];
    if (!el) {
      el = document.createElement('div');
      el.className = 'hud-bar';
      el.innerHTML = '<span class="hud-bar-label"></span><div class="hud-bar-track"><div class="hud-bar-fill"></div></div>';
      slot(at).appendChild(el);
      items[id] = el;
    }
    el.querySelector('.hud-bar-label').textContent = label;
    el.querySelector('.hud-bar-track').style.width = `${width}px`;
    const fill = el.querySelector('.hud-bar-fill');
    fill.style.width = `${Math.max(0, Math.min(1, value / max)) * 100}%`;
    fill.style.background = color;
    return el;
  },

  remove(id) {
    items[id]?.remove();
    delete items[id];
  },

  message(text, { seconds = 2, color } = {}) {
    const el = document.createElement('div');
    el.className = 'hud-message';
    el.textContent = text;
    if (color) el.style.color = color;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('hide'), seconds * 1000);
    setTimeout(() => el.remove(), seconds * 1000 + 600);
  },

  crosshair(show = true) {
    let el = document.querySelector('.crosshair');
    if (!el && show) {
      el = document.createElement('div');
      el.className = 'crosshair';
      document.body.appendChild(el);
    }
    if (el) el.style.display = show ? 'block' : 'none';
  },

  // The first screen. Skipped automatically when the page URL has ?play
  // (used by restartGame() and by the screenshot tool).
  title(options) {
    if (new URLSearchParams(location.search).has('play')) return Promise.resolve();
    return this.screen({ button: 'Play', ...options });
  },

  screen({ title = '', text = '', button = 'OK', color, image, pause = true } = {}) {
    input.unlockPointer();
    if (pause) setPaused(true);
    const el = document.createElement('div');
    el.className = 'screen';
    const box = document.createElement('div');
    box.className = 'screen-box';
    const h = document.createElement('h1');
    h.textContent = title;
    if (color) h.style.color = color;
    const p = document.createElement('p');
    p.textContent = text;
    const b = document.createElement('button');
    b.textContent = button;
    if (image) {
      const img = document.createElement('img');
      img.src = image;
      img.className = 'screen-image';
      box.append(img);
    }
    box.append(h, p, b);
    el.appendChild(box);
    document.body.appendChild(el);
    return new Promise((resolve) => {
      const close = () => {
        window.removeEventListener('keydown', onKey);
        el.remove();
        if (pause) setPaused(false);
        resolve();
      };
      const onKey = (e) => {
        if (e.code === 'Enter' || e.code === 'Space') close();
      };
      b.onclick = close;
      setTimeout(() => window.addEventListener('keydown', onKey), 300);
    });
  },
};
