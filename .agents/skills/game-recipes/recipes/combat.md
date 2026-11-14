# Shooting, throwing, spells, melee

## Projectiles (blaster bolts, fireballs, snowballs)

Simple moving objects checked by distance. Reliable, no physics needed.

```js
// src/game/shooting.js
import { THREE, world, cameraRig, input, tune, near, sfx, fx, ball, ui } from '../engine/index.js';
import { enemies, hitEnemy } from './enemies.js';

const S = tune('Shooting', {
  bulletSpeed: { value: 30, min: 5, max: 120 },
  fireRate: { value: 6, min: 0.5, max: 30 }, // shots per second
  damage: { value: 1, min: 1, max: 10, step: 1 },
  range: { value: 40, min: 5, max: 200 },
  bulletSize: { value: 0.12, min: 0.03, max: 1 },
  color: '#5ef2ff',
});

const bullets = [];
let cooldown = 0;

export function setupShooting(player) {
  player.faceCamera = true; // the character turns where you aim
  ui.crosshair(true);
}

export function updateShooting(dt, player) {
  cooldown -= dt;
  if (input.held('fire') && cooldown <= 0) {
    cooldown = 1 / S.fireRate;
    shoot(player);
  }
  for (const b of [...bullets]) {
    b.position.addScaledVector(b.userData.velocity, dt);
    b.userData.life -= dt;
    const hit = enemies.find((e) => !e.dead && near(b, e.position.clone().setY(e.position.y + 1), 1));
    if (hit) hitEnemy(hit, S.damage);
    if (hit || b.userData.life <= 0) {
      if (hit) fx.burst(b.position, { color: S.color, count: 8, speed: 3 });
      world.remove(b);
      bullets.splice(bullets.indexOf(b), 1);
    }
  }
}

// One shape and material shared by every bullet (making new ones per shot slows the game down).
const bulletGeo = new THREE.SphereGeometry(1, 12, 8);
const bulletMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(S.color).multiplyScalar(4) }); // > 1 glows

function shoot(player) {
  // Aim where the camera looks (center of the screen).
  const dir = new THREE.Vector3();
  world.camera.getWorldDirection(dir);
  const start = player.position.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(dir, 0.8);
  const b = new THREE.Mesh(bulletGeo, bulletMat);
  b.scale.setScalar(S.bulletSize);
  b.position.copy(start);
  world.add(b);
  b.userData.velocity = dir.multiplyScalar(S.bulletSpeed);
  b.userData.life = S.range / S.bulletSpeed;
  bullets.push(b);
  sfx('laser');
}
```

- Top-down games: aim with the mouse on the ground instead of the camera direction. See `views.md`.
- Gravity (thrown balls, grenades): add `b.userData.velocity.y -= 9.8 * dt` before moving.
- A weapon in the hand: KayKit characters already hold one (choose with `hide`), or attach a model to
  the hand bone (see the `character-animation` skill).
- Play a shooting animation: `player.action('1H_Ranged_Shoot')` (KayKit) or `'Punch'` (robot).
- Physics balls that knock things over: `ball({ ..., physics: 'dynamic', mass: 2 })` then
  `physics.setVelocity(b, dir.multiplyScalar(25))` and remove it with `after(5, () => world.remove(b))`.

## Hitscan (instant laser, no flying bullet)

```js
const from = world.camera.position.clone();
const dir = new THREE.Vector3();
world.camera.getWorldDirection(dir);
const hit = physics.raycast(from, dir, 100, { ignore: player.object });
if (hit) fx.burst(hit.point, { color: '#ff0', count: 6 }); // hit.object is what was hit
```
Characters (enemies) have physics bodies too, so `hit.object` can be an enemy's model:
`const e = enemies.find((e) => e.object === hit.object)`.

## Melee (sword, punch)

Turn toward the closest enemy in reach (kids don't aim well), remember clicks made during a swing,
and hit everything near the blade when the swing lands.

```js
const M = tune('Sword', { reach: { value: 2.2, min: 0.5, max: 6 }, swingSpeed: { value: 1.4, min: 0.5, max: 3 } });
let queued = false;
// in update:
if (input.pressed('fire')) queued = true;
if (queued && !player.animator.busy) {
  queued = false;
  const target = enemies.filter((e) => !e.dead).sort((a, b) => distance2D(a.position, player.position) - distance2D(b.position, player.position))[0];
  if (target && distance2D(target.position, player.position) < M.reach * 1.5) {
    player.object.rotation.y = Math.atan2(target.position.x - player.position.x, target.position.z - player.position.z);
  }
  player.action('1H_Melee_Attack_Chop', { speed: M.swingSpeed });
  sfx('whoosh');
  after(0.3 / M.swingSpeed, () => {   // when the blade lands
    for (const e of [...enemies]) if (!e.dead && distance2D(e.position, player.position) < M.reach) hitEnemy(e, 1);
  });
}
```
Knockback: push the enemy away in `hitEnemy`: `e.velocity.add(e.position.clone().sub(player.position).setY(0).normalize().multiplyScalar(8))`.

## Enemies that shoot back

Same bullet code with the direction from the enemy to the player, and `near(b, player.position.clone().setY(player.position.y + 1), 0.8)`
calls `hurtPlayer()`. Keep their bullets slower (8-15) so players can dodge.
