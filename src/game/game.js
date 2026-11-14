// OUR GAME. It starts as an empty world: the AI builds it with you, one choice at a time
// (Player, World, Goal, Twist; the plan is in our-game.md).
// setup() runs once, update(dt) runs every frame.
import { THREE, world, ground } from '../engine/index.js';

export async function setup() {
  // An empty stage: a plain floor with a grid, waiting for your world.
  await ground({ color: '#c9d2da', size: 200 });
  const grid = new THREE.GridHelper(200, 100, '#9eabb7', '#b3bec8');
  grid.position.y = 0.01;
  world.add(grid);
  world.camera.position.set(0, 6, 12);
  world.camera.lookAt(0, 0, 0);
}

export function update(dt) {}
