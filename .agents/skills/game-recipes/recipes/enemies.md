# Enemies (chase, attack, take hits, waves)

Animated enemies use `createCharacter`: real collisions (walls, stairs), gravity and automatic
idle/walk/run animations. Good enemy models: `skeleton_minion.glb`, `skeleton_warrior.glb`,
`robot.glb`, or any rigged character in the catalog.

```js
// src/game/enemies.js
import { createCharacter, tune, distance2D, random, fx, sfx } from '../engine/index.js';

export const E = tune('Enemies', {
  speed: { value: 2.2, min: 0, max: 12 },
  health: { value: 3, min: 1, max: 30, step: 1 },
  damage: { value: 10, min: 0, max: 100 },
  attackRange: { value: 1.6, min: 0.5, max: 6 },
  attackCooldown: { value: 1.2, min: 0.1, max: 5 },
  sightRange: { value: 30, min: 1, max: 200 },
  maxAlive: { value: 10, min: 1, max: 60, step: 1 },
});

export const enemies = [];

export async function spawnEnemy(position) {
  const e = await createCharacter({
    model: 'assets/models/characters/skeleton_minion.glb',
    height: 1.7,
    position,
    speed: E.speed,
    animations: { walk: 'Walking_D_Skeletons' },
  });
  e.hp = E.health;
  e.cooldown = 0;
  e.dead = false;
  enemies.push(e);
  e.action('Spawn_Ground_Skeletons'); // climbs out of the ground (skeletons only)
  return e;
}

// hurtPlayer(amount) is your function from health.md
export function updateEnemies(dt, player, hurtPlayer) {
  for (const e of enemies) {
    if (e.dead || e.animator.busy) continue; // busy = playing attack/hit/spawn
    e.speed = E.speed;
    const d = distance2D(e.position, player.position);
    if (d > E.sightRange) continue; // too far: stands still
    e.walkTo(player.position, E.attackRange * 0.8);
    e.cooldown -= dt;
    if (d <= E.attackRange && e.cooldown <= 0) {
      e.cooldown = E.attackCooldown;
      e.action('1H_Melee_Attack_Chop');
      hurtPlayer(E.damage);
    }
  }
}

export async function hitEnemy(e, damage = 1) {
  if (e.dead) return;
  e.hp -= damage;
  sfx('hit');
  fx.burst(e.position.clone().setY(e.position.y + 1.2), { color: '#ffffff', count: 12 });
  if (e.hp > 0) {
    e.action('Hit_A');
    return;
  }
  e.dead = true;
  e.frozen = true;
  enemies.splice(enemies.indexOf(e), 1);
  await e.action('Death_A');
  e.remove();
}

// Waves: call from update(dt). Spawns around the player, never more than maxAlive.
let spawnTimer = 0;
let spawning = false;
export async function updateSpawner(dt, player, everySeconds = 3) {
  spawnTimer -= dt;
  if (spawnTimer > 0 || spawning || enemies.length >= E.maxAlive) return;
  spawnTimer = everySeconds;
  spawning = true;
  const angle = random(0, Math.PI * 2);
  const dist = random(15, 25);
  await spawnEnemy([player.position.x + Math.cos(angle) * dist, 0, player.position.z + Math.sin(angle) * dist]);
  spawning = false;
}
```

Notes:
- `e.walkTo(target)` must be called every frame (it stops when not called).
- Enemies run: `e.move(x, z, true)` or raise `E.speed`.
- Animation names differ per model: check the catalog or `npm run inspect -- public/assets/models/characters/<file>.glb`.
  Names are matched loosely (`'attack'` finds the first animation containing "attack").
- Many enemies: keep `maxAlive` under ~30 on school laptops.

## Patrol (walk between points until the player is close)

```js
e.route = [vec(0, 0, 0), vec(10, 0, 0), vec(10, 0, 10)];
e.next = 0;
// in update:
if (distance2D(e.position, player.position) < 8) e.walkTo(player.position, 1.2);
else if (e.walkTo(e.route[e.next], 0.6) < 0.6) e.next = (e.next + 1) % e.route.length;
```

## Flying enemies (drones, bats, ghosts): a complete module

Things that fly don't need a character controller: move the model yourself.

```js
// src/game/drones.js
import { loadModel, tune, world, turnTowards, near, random, wave, sfx, fx } from '../engine/index.js';

const D = tune('Drones', {
  speed: { value: 4, min: 0, max: 20 },
  health: { value: 2, min: 1, max: 20, step: 1 },
  flyHeight: { value: 1.5, min: 0.3, max: 10 },
  spawnEvery: { value: 2, min: 0.2, max: 10 },
  maxAlive: { value: 15, min: 1, max: 60, step: 1 },
});
export const drones = [];
let timer = 0;
let loading = false;

export async function spawnDrone(position) {
  const d = await loadModel('assets/models/shooter/enemy_flying.glb', { size: 1.2, position });
  d.userData.hp = D.health;
  drones.push(d);
  return d;
}

export function updateDrones(dt, player, hurtPlayer) {
  timer -= dt;
  if (timer <= 0 && !loading && drones.length < D.maxAlive) {
    timer = D.spawnEvery;
    loading = true;
    const a = random(0, Math.PI * 2);
    spawnDrone([player.position.x + Math.cos(a) * 25, D.flyHeight, player.position.z + Math.sin(a) * 25]).then(() => (loading = false));
  }
  const target = player.position.clone().setY(player.position.y + D.flyHeight);
  for (const d of drones) {
    turnTowards(d, target, dt, 6);
    const dir = target.clone().sub(d.position).normalize();
    d.position.addScaledVector(dir, D.speed * dt);
    d.userData.model.position.y = wave(4, 0.15, d.id); // gentle bob, same at any frame rate
    if (near(d, target, 1)) {
      hurtPlayer(1);
      d.position.addScaledVector(dir, -3); // bounce back
    }
  }
}

export function hitDrone(d, damage = 1) {
  d.userData.hp -= damage;
  fx.burst(d.position, { color: '#ffffff', count: 8 });
  if (d.userData.hp > 0) return sfx('hit');
  sfx('explode');
  fx.burst(d.position, { color: '#ff8800', count: 40, speed: 8 });
  world.remove(d);
  drones.splice(drones.indexOf(d), 1);
}
```
Use `hitDrone` from the bullet code in `combat.md` (check `near(b, d, 1)` against `drones`).

## Boss

Same as an enemy with a bigger `height` (3-4), more `hp`, a health bar
(`ui.bar('boss', boss.hp, maxHp, { at: 'top', color: '#ff3b3b', label: 'BOSS', width: 400 })`) and
an attack pattern using `every(4, () => ...)` (charge, jump with `boss.jump(1.5)`, summon minions).
