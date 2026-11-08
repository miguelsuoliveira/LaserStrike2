# Game flow: title, win/lose, rounds, score, timer, pause

## Title screen and instructions

At the end of `setup()` (after loading):
```js
await ui.title({ title: 'Lava Escape', text: 'Climb before the lava gets you!\nWASD move · Space jump · Shift run' });
```
It's skipped automatically after `restartGame()`.

## Win / lose

```js
let gameOver = false;
async function endGame(won) {
  if (gameOver) return;
  gameOver = true;
  player.frozen = true;
  sfx(won ? 'win' : 'lose');
  await ui.screen({ title: won ? 'You win!' : 'Game over', text: `Score: ${score}`, button: 'Play again', pause: false });
  restartGame();
}
// at the top of update(dt):  if (gameOver) return;
```

## Score and timer

```js
let score = 0;
let timeLeft = G.timeLimit; // G = tune('Game', { timeLimit: 60 })
// in update:
timeLeft -= dt;
ui.text('score', `Score: ${score}`);
ui.text('timer', Math.ceil(timeLeft), { at: 'top', size: 44, color: timeLeft < 10 ? '#ff5050' : '#ffffff' });
if (timeLeft <= 0) endGame(false);
```
Stopwatch (speedruns): count up `elapsed += dt` and show `elapsed.toFixed(1)`.

## High score (saved in this browser)

```js
const best = Number(localStorage.getItem('best') || 0);
if (score > best) { localStorage.setItem('best', score); ui.message('NEW RECORD!'); }
ui.text('best', `Best: ${Math.max(best, score)}`, { at: 'top-right' });
```

Best time (lower is better, for races and speedruns):
```js
const bestTime = Number(localStorage.getItem('bestTime')) || Infinity;
if (elapsed < bestTime) { localStorage.setItem('bestTime', elapsed); ui.message('NEW BEST TIME!'); }
ui.text('best', bestTime === Infinity ? 'Best: --' : `Best: ${bestTime.toFixed(1)}s`, { at: 'bottom-right' });
```
Use a different key per game (`'lavaTower.bestTime'`) so games on the same laptop don't mix.

## Rounds / waves / levels

Spawning takes a moment (models load), so keep a flag: a new wave starts only when the last one is
fully spawned AND all its enemies are gone.

```js
let wave = 0;
let spawningWave = false;
async function nextWave() {
  spawningWave = true;
  wave++;
  ui.text('wave', `Wave ${wave}`, { at: 'top' });
  ui.message(`Wave ${wave}!`, { seconds: 2 });
  sfx('powerup');
  const count = W.firstWave + (wave - 1) * W.extraPerWave; // W = tune('Waves', { firstWave: 3, extraPerWave: 2 })
  for (let i = 0; i < count; i++) await spawnEnemy(randomSpawnPoint());
  spawningWave = false;
}
// in update:
if (!spawningWave && enemies.length === 0) nextWave();
```
Different levels: keep each level's build function in `level.js` (`buildLevel1()`, `buildLevel2()`),
and remove the old objects with `world.remove(obj)` (keep them in an array), or simplest:
save the level number with `localStorage.setItem('level', 2)` and `restartGame()`, then in `setup()`
build the level that `localStorage.getItem('level')` says.

## Pause

```js
if (input.pressed('p')) ui.screen({ title: 'Paused', button: 'Continue' }); // pauses until clicked
```

## Difficulty choice

```js
const G = tune('Game', { difficulty: { value: 'normal', options: ['easy', 'normal', 'hard'] } });
const enemySpeed = { easy: 1.5, normal: 2.5, hard: 4 }[G.difficulty];
```

## Credits screen (first names only!)

`await ui.screen({ title: 'Made by', text: 'Ana, Leo and Sam\nGame Jam 2026', button: 'Play again' })`
