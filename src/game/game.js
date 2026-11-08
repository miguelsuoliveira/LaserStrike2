// COIN RUSH: the example game. Make it yours: change it, or ask the AI to
// replace it with your own idea. setup() runs once, update(dt) runs every frame.
import {
  THREE, world, createPlayer, loadModel, ground, box, ui, sfx, fx, tune,
  random, pick, near, wave, every, restartGame,
} from '../engine/index.js';

// Every number you might want to change lives on a slider (press ` to open).
const GAME = tune('Game', {
  coins: { value: 10, min: 1, max: 50, step: 1 },
  timeLimit: { value: 60, min: 10, max: 300, step: 1 },
  coinSpinSpeed: { value: 3, min: 0, max: 20 },
  pickupDistance: { value: 1.5, min: 0.5, max: 5 },
});

let player;
const coins = [];
let collected = 0;
let timeLeft = 0;
let gameOver = false;

export async function setup() {
  // The world: grass, a few things to climb on and boxes to knock over.
  await ground({ texture: 'assets/textures/grass', size: 200 });
  box({ size: [6, 1.2, 6], position: [10, 0.6, -8], texture: 'assets/textures/wood_planks' });
  box({ size: [3, 0.4, 8], position: [10, 0.9, -1], rotation: [-14, 0, 0], texture: 'assets/textures/wood_planks' });
  box({ size: [4, 4, 4], position: [-12, 2, -12], texture: 'assets/textures/brick' });
  for (let i = 0; i < 5; i++) {
    box({ size: 0.9, position: [4, 0.45 + i * 0.95, 4], texture: 'assets/textures/wood_planks', physics: 'dynamic', mass: 2 });
  }
  decorate();

  player = await createPlayer({
    model: 'assets/models/characters/knight.glb',
    hide: ['2H_Sword', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '1H_Sword_Offhand'],
  });

  for (let i = 0; i < GAME.coins; i++) {
    const coin = await loadModel('assets/models/platformer/coin.glb', {
      size: 0.9,
      position: [random(-25, 25), 1, random(-25, 25)],
    });
    coins.push(coin);
  }

  await ui.title({
    title: 'Coin Rush',
    text: 'Collect every coin before the time runs out!\nWASD move, Space jump, Shift run, mouse look',
  });
  timeLeft = GAME.timeLimit;
}

export function update(dt) {
  if (gameOver) return;

  for (const coin of coins) {
    if (!coin.visible) continue;
    coin.rotation.y += GAME.coinSpinSpeed * dt;
    coin.position.y = 1 + wave(3, 0.15, coin.id);
    if (near(player.position.clone().setY(player.position.y + 1), coin, GAME.pickupDistance)) {
      coin.visible = false;
      collected++;
      sfx('coin');
      fx.burst(coin.position, { color: '#ffd23f' });
      fx.popup(coin.position, '+1', { color: '#ffd23f' });
    }
  }

  timeLeft -= dt;
  ui.text('coins', `Coins: ${collected} / ${coins.length}`);
  ui.text('time', `${Math.ceil(timeLeft)}`, { at: 'top', size: 44 });

  if (collected === coins.length) endGame(true);
  else if (timeLeft <= 0) endGame(false);
}

async function endGame(won) {
  gameOver = true;
  player.frozen = true;
  sfx(won ? 'win' : 'lose');
  if (won) player.action('Cheer');
  await ui.screen({
    title: won ? 'You win!' : "Time's up!",
    text: won ? `All coins with ${Math.ceil(timeLeft)} seconds left!` : `You got ${collected} of ${coins.length} coins.`,
    button: 'Play again',
    pause: false,
  });
  restartGame();
}

// Trees, rocks, plants and a campfire around the play area.
function decorate() {
  for (let i = 0; i < 40; i++) {
    const angle = random(0, Math.PI * 2);
    const dist = random(28, 90);
    loadModel(`assets/models/nature/tree_single_${i % 2 ? 'a' : 'b'}.glb`, {
      height: random(5, 10),
      position: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
      rotation: random(0, 360),
      physics: 'fixed',
    });
  }
  for (let i = 0; i < 30; i++) {
    const angle = random(0, Math.PI * 2);
    const dist = random(8, 35);
    loadModel(`assets/models/realistic/${pick(['fern_02', 'fern_02', 'tree_stump_01'])}.glb`, {
      scale: random(0.8, 1.4),
      position: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
      rotation: random(0, 360),
    });
  }
  loadModel('assets/models/realistic/rock_moss_set_01.glb', { size: 6, position: [-8, 0, 10], physics: 'fixed', shape: 'mesh' });

  // Campfire: a fire pit, a flickering light and rising sparks.
  const fire = new THREE.Vector3(-4, 0, -6);
  loadModel('assets/models/realistic/stone_fire_pit.glb', { position: fire, physics: 'fixed' });
  const light = new THREE.PointLight('#ff9a3c', 25, 14);
  light.position.set(fire.x, 1.2, fire.z);
  world.add(light);
  every(0.06, () => {
    light.intensity = 22 + random(-6, 6);
    fx.burst(fire.clone().setY(0.3), { color: '#ff7a1a', count: 2, speed: 1, size: 0.35, life: 0.7, gravity: -3 });
  });
}
