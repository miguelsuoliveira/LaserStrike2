// OUR GAME. It starts as an empty world: the AI builds it with you in stages
// (Theme, then World, Player, Goal, Mechanics, Details; the plan is in our-game.md).
// setup() runs once, update(dt) runs every frame.
import { THREE, world, ground, createPlayer } from '../engine/index.js';

export async function setup() {
  // An empty stage: a plain floor with a grid, waiting for your world.
  await ground({ color: '#c9d2da', size: 200 });
  const grid = new THREE.GridHelper(200, 100, '#9eabb7', '#b3bec8');
  grid.position.y = 0.01;
  world.add(grid);

  // The explorer: invisible, sees through its own eyes, so you can walk around your world
  // (WASD, mouse, Space) before you choose who you are. The Player stage replaces it.
  await createPlayer({ model: new THREE.Group(), height: 1.7, camera: 'first', position: [0, 0, 0] });
}

export function update(dt) {}
