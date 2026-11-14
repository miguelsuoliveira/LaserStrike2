// Phone and tablet controls, so every game is playable on mobile. They appear by themselves on
// touch screens (or with ?touch in the URL to try them on a computer):
//   left side   a thumb joystick (moves like WASD: input.move)
//   right side  drag to look around (like the mouse)
//   buttons     Jump is there by default; games add one for every other key they use:
//     input.touchButton('fire', '🔫')        hold to fire (same as holding the left mouse button)
//     input.touchButton('1', 'Laser')        tap = pressing the 1 key
//     input.touchButton('run', '🏃')          any key or action name
//     input.touchButton('jump', null)         remove a button (no jumping in this game)
//   ui.hint('E', 'open') becomes a button you can tap on phones.
import { input } from './input.js';

export const isTouch =
  new URLSearchParams(location.search).has('touch') ||
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window);

const LOOK_SPEED = 2.2; // screen pixels -> mouse pixels
const STICK_RADIUS = 56;
const buttons = new Map(); // key -> element
let bar = null;

export function setupTouch() {
  if (!isTouch) return;
  document.body.classList.add('touch');
  const stick = document.createElement('div');
  stick.className = 'touch-stick';
  stick.innerHTML = '<div class="touch-knob"></div>';
  stick.style.display = 'none';
  bar = document.createElement('div');
  bar.className = 'touch-buttons';
  document.body.append(stick, bar);
  const knob = stick.firstChild;

  let stickId = null;
  let stickX = 0;
  let stickY = 0;
  let lookId = null;
  let lookX = 0;
  let lookY = 0;

  const onCanvas = (e) => e.target === input.canvas;
  window.addEventListener(
    'touchstart',
    (e) => {
      for (const t of e.changedTouches) {
        if (!onCanvas(t)) continue;
        if (t.clientX < window.innerWidth * 0.45 && stickId === null) {
          stickId = t.identifier;
          stickX = t.clientX;
          stickY = t.clientY;
          stick.style.display = 'block';
          stick.style.left = `${stickX}px`;
          stick.style.top = `${stickY}px`;
          knob.style.transform = 'translate(-50%, -50%)';
        } else if (lookId === null) {
          lookId = t.identifier;
          lookX = t.clientX;
          lookY = t.clientY;
        }
      }
      if (onCanvas(e)) e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - stickX;
          let dy = t.clientY - stickY;
          const len = Math.hypot(dx, dy);
          if (len > STICK_RADIUS) {
            dx *= STICK_RADIUS / len;
            dy *= STICK_RADIUS / len;
          }
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          input.touchMove.x = dx / STICK_RADIUS;
          input.touchMove.y = -dy / STICK_RADIUS;
        } else if (t.identifier === lookId) {
          input.mouse.dx += (t.clientX - lookX) * LOOK_SPEED;
          input.mouse.dy += (t.clientY - lookY) * LOOK_SPEED;
          lookX = t.clientX;
          lookY = t.clientY;
        }
      }
      e.preventDefault();
    },
    { passive: false },
  );
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null;
        stick.style.display = 'none';
        input.touchMove.x = 0;
        input.touchMove.y = 0;
      } else if (t.identifier === lookId) lookId = null;
    }
  };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  input.touchButton('jump', '⤒');
}

// Makes any element press a key while a finger is on it (used by buttons and ui.hint).
// key can be a function, for elements whose key changes (the hint).
export function holdToPress(el, key) {
  let pressedKey = null;
  const down = (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('down');
    pressedKey = typeof key === 'function' ? key() : key;
    if (pressedKey) input.press(pressedKey);
  };
  const up = (e) => {
    e.preventDefault();
    el.classList.remove('down');
    if (pressedKey) input.release(pressedKey);
    pressedKey = null;
  };
  el.addEventListener('touchstart', down, { passive: false });
  el.addEventListener('touchend', up);
  el.addEventListener('touchcancel', up);
}

input.touchButton = (key, label = key.toUpperCase()) => {
  if (!isTouch || !bar) return;
  buttons.get(key)?.remove();
  buttons.delete(key);
  if (label === null) return;
  const b = document.createElement('div');
  b.className = 'touch-button';
  b.textContent = label;
  holdToPress(b, key);
  bar.prepend(b);
  buttons.set(key, b);
};
