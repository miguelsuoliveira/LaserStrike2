// Keyboard, mouse and gamepad.
//   input.held('w')          true while the key is down
//   input.pressed('space')   true only in the frame it was pressed
//   input.released('e')      true only in the frame it was let go
//   input.move               { x, y } from WASD / arrows / left stick (-1..1), y = forward
//   input.mouse              { x, y } screen position (-1..1), dx/dy movement this frame
// Key names: 'a'..'z', '0'..'9', 'space', 'shift', 'ctrl', 'alt', 'enter',
// 'escape', 'tab', 'up', 'down', 'left', 'right', 'mouse' (left button),
// 'rightmouse'. Action names that also work with a gamepad:
// 'jump' (space), 'fire' (left mouse), 'run' (shift), 'interact' (e).

const held = new Set();
const pressed = new Set();
const released = new Set();

const ACTIONS = {
  jump: ['space', 'pad-a'],
  fire: ['mouse', 'pad-rt', 'pad-x'],
  run: ['shift', 'pad-lb', 'pad-l3'],
  interact: ['e', 'pad-b'],
  pause: ['escape', 'p', 'pad-start'],
};
const PAD_BUTTONS = ['pad-a', 'pad-b', 'pad-x', 'pad-y', 'pad-lb', 'pad-rb', 'pad-lt', 'pad-rt', 'pad-back', 'pad-start', 'pad-l3', 'pad-r3', 'pad-up', 'pad-down', 'pad-left', 'pad-right'];

function keyName(code) {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5).toLowerCase();
  if (code.startsWith('Shift')) return 'shift';
  if (code.startsWith('Control')) return 'ctrl';
  if (code.startsWith('Alt')) return 'alt';
  return code.toLowerCase();
}

const names = (name) => ACTIONS[name] || [name.toLowerCase()];

export const input = {
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 }, // right stick
  mouse: { x: 0, y: 0, dx: 0, dy: 0, wheel: 0 },
  locked: false,
  wantsPointerLock: false,
  canvas: null,

  held: (name) => names(name).some((n) => held.has(n)),
  pressed: (name) => names(name).some((n) => pressed.has(n)),
  released: (name) => names(name).some((n) => released.has(n)),

  init(canvas) {
    this.canvas = canvas;
    const press = (n) => {
      if (!held.has(n)) pressed.add(n);
      held.add(n);
    };
    const release = (n) => {
      held.delete(n);
      released.add(n);
    };
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, .lil-gui')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) press(keyName(e.code));
    });
    window.addEventListener('keyup', (e) => release(keyName(e.code)));
    window.addEventListener('blur', () => {
      for (const n of [...held]) release(n);
    });
    canvas.addEventListener('mousedown', (e) => {
      press(e.button === 2 ? 'rightmouse' : 'mouse');
      if (this.wantsPointerLock && !this.locked && !document.querySelector('.screen')) {
        canvas.requestPointerLock?.()?.catch?.(() => {});
      }
    });
    window.addEventListener('mouseup', (e) => release(e.button === 2 ? 'rightmouse' : 'mouse'));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      // Mouse look works when the pointer is locked, or while dragging.
      if (this.locked || held.has('mouse') || held.has('rightmouse')) {
        this.mouse.dx += e.movementX;
        this.mouse.dy += e.movementY;
      }
    });
    window.addEventListener('wheel', (e) => (this.mouse.wheel += Math.sign(e.deltaY)), { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  },

  unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  },

  // Called by the engine at the start of each frame.
  poll() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const pad = pads[0];
    if (pad) {
      PAD_BUTTONS.forEach((n, i) => {
        const on = pad.buttons[i]?.pressed;
        if (on && !held.has(n)) {
          pressed.add(n);
          held.add(n);
        } else if (!on && held.has(n)) {
          held.delete(n);
          released.add(n);
        }
      });
    }
    const dead = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    let x = (this.held('d') || this.held('right') ? 1 : 0) - (this.held('a') || this.held('left') ? 1 : 0);
    let y = (this.held('w') || this.held('up') ? 1 : 0) - (this.held('s') || this.held('down') ? 1 : 0);
    if (pad) {
      x += dead(pad.axes[0] || 0);
      y -= dead(pad.axes[1] || 0);
      this.look.x = dead(pad.axes[2] || 0);
      this.look.y = dead(pad.axes[3] || 0);
    }
    const len = Math.hypot(x, y);
    this.move.x = len > 1 ? x / len : x;
    this.move.y = len > 1 ? y / len : y;
  },

  // Called by the engine at the end of each frame.
  endFrame() {
    pressed.clear();
    released.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  },
};
