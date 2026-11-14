# Health, damage, lives, game over

```js
// src/game/health.js
import { tune, ui, sfx, fx, time, restartGame } from '../engine/index.js';

const H = tune('Health', {
  maxHealth: { value: 100, min: 1, max: 500, step: 1 },
  invincibleTime: { value: 1, min: 0, max: 5 }, // seconds of safety after a hit
  lives: { value: 3, min: 1, max: 10, step: 1 },
});

let player = null;
let health = 0;
let lives = 0;
let invincibleUntil = 0;
export let dead = false;

export function setupHealth(p) {
  player = p;
  health = H.maxHealth;
  lives = H.lives;
  player.onFall = () => hurtPlayer(25);
  showHealth();
}

export function hurtPlayer(amount) {
  if (dead || time.now < invincibleUntil) return;
  invincibleUntil = time.now + H.invincibleTime;
  health = Math.max(0, health - amount);
  sfx('hurt');
  fx.flash('#ff0000', 0.25);
  fx.shake(0.3, 0.2);
  showHealth();
  if (health <= 0) loseLife();
}

export function heal(amount) {
  health = Math.min(H.maxHealth, health + amount);
  showHealth();
}

// Call from update(dt): blink while safe after a hit.
export function updateHealth() {
  const safe = time.now < invincibleUntil;
  player.model.visible = !safe || Math.floor(time.now * 10) % 2 === 0;
}

function showHealth() {
  const ratio = health / H.maxHealth;
  ui.bar('health', health, H.maxHealth, { label: 'Health', color: ratio > 0.3 ? '#4ade80' : '#ff4d4d' });
  ui.text('lives', '❤'.repeat(Math.max(0, lives)), { at: 'top-right', color: '#ff4d6d', size: 32 });
}

async function loseLife() {
  lives--;
  if (lives > 0) {
    health = H.maxHealth;
    player.teleport(player.spawn); // back to the start (or the last checkpoint)
    showHealth();
    return;
  }
  dead = true;
  player.frozen = true;
  player.model.visible = true;
  sfx('lose');
  if (player.animator.has('Death')) await player.action('Death_A');
  await ui.screen({ title: 'Game Over', text: 'Try again?', button: 'Restart' });
  restartGame();
}
```

In `game.js`: `setupHealth(player)` at the end of `setup()`, `updateHealth()` in `update(dt)`,
and call `hurtPlayer(10)` from enemies, lava or traps.

- Hearts instead of a bar: set `maxHealth` to 5, damage 1, and show `'❤'.repeat(health)`.
- Health pickups: in `collectibles.md`, call `heal(25)` instead of adding score.
- Lava/spikes: see `levels.md` (kill zones).
- To test the game-over screen: `npm run snap -- --set "Health.lives=1, Health.maxHealth=1"` (doesn't change the game).
