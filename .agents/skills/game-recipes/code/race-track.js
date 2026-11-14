// A race track: a loop of road with walls on both sides and a jump ramp.
// Copy to src/game/track.js, then in setup(): await buildTrack(); and start the car at startPosition().
// The middle line of the road (trackPath) is also used for checkpoints and computer cars (rivals.js).
import { THREE, world, box, loadMaterial, tune, vec } from '../engine/index.js';

// Track shape numbers are used when the game starts: after changing them, restart the game.
export const TRACK = tune('Track', {
  width: { value: 14, min: 8, max: 30, step: 1 },
  straightLength: { value: 120, min: 40, max: 300, step: 10 },
  curveRadius: { value: 40, min: 20, max: 100, step: 5 },
  wallHeight: { value: 1.2, min: 0.5, max: 4 },
  wallColorA: '#e63946',
  wallColorB: '#f1faee',
  rampAngle: { value: 15, min: 5, max: 30, step: 1 },
  rampLength: { value: 10, min: 4, max: 20, step: 1 },
  rampWidth: { value: 10, min: 4, max: 20, step: 1 },
});

// Points along the middle of the road, in driving order (a closed loop).
export const trackPath = [];

function buildPath() {
  const L = TRACK.straightLength;
  const R = TRACK.curveRadius;
  const step = 8;
  // Right straight, driving towards +Z.
  for (let z = -L / 2; z < L / 2; z += step) trackPath.push(vec(R, 0, z));
  // Far curve.
  const curveSteps = Math.ceil((Math.PI * R) / step);
  for (let i = 0; i < curveSteps; i++) {
    const a = (i / curveSteps) * Math.PI;
    trackPath.push(vec(R * Math.cos(a), 0, L / 2 + R * Math.sin(a)));
  }
  // Left straight, driving towards -Z.
  for (let z = L / 2; z > -L / 2; z -= step) trackPath.push(vec(-R, 0, z));
  // Near curve, back to the start.
  for (let i = 0; i < curveSteps; i++) {
    const a = Math.PI + (i / curveSteps) * Math.PI;
    trackPath.push(vec(R * Math.cos(a), 0, -L / 2 + R * Math.sin(a)));
  }
}

// Sideways direction (pointing to the right of the driver) at point i.
export function sideAt(i) {
  const n = trackPath.length;
  const prev = trackPath[(i - 1 + n) % n];
  const next = trackPath[(i + 1) % n];
  const dir = next.clone().sub(prev).normalize();
  return vec(-dir.z, 0, dir.x);
}

function buildWalls() {
  const n = trackPath.length;
  for (const side of [-1, 1]) {
    const edge = trackPath.map((p, i) => p.clone().addScaledVector(sideAt(i), (side * TRACK.width) / 2));
    for (let i = 0; i < n; i++) {
      const a = edge[i];
      const b = edge[(i + 1) % n];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const len = a.distanceTo(b) + 0.4; // a little overlap so there are no gaps
      const angle = THREE.MathUtils.radToDeg(Math.atan2(b.x - a.x, b.z - a.z));
      box({
        size: [0.6, TRACK.wallHeight, len],
        position: [mid.x, TRACK.wallHeight / 2, mid.z],
        rotation: [0, angle, 0],
        color: i % 2 ? TRACK.wallColorA : TRACK.wallColorB,
      });
    }
  }
}

// A flat grey road ribbon on top of the sand (just for looks, the sand is the solid floor).
async function buildRoad() {
  const n = trackPath.length;
  const positions = [];
  const uvs = [];
  const indices = [];
  let dist = 0;
  for (let i = 0; i <= n; i++) {
    const p = trackPath[i % n];
    if (i > 0) dist += p.distanceTo(trackPath[i - 1]);
    const s = sideAt(i % n).multiplyScalar(TRACK.width / 2);
    positions.push(p.x - s.x, 0.02, p.z - s.z, p.x + s.x, 0.02, p.z + s.z);
    uvs.push(0, dist / TRACK.width, 1, dist / TRACK.width);
    if (i < n) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const road = new THREE.Mesh(geo, await loadMaterial('assets/textures/asphalt'));
  road.receiveShadow = true;
  world.add(road);
}

// The jump ramp sits on the left straight (cars drive towards -Z there).
function buildRamp() {
  const t = 0.5;
  const tilt = THREE.MathUtils.degToRad(TRACK.rampAngle);
  // Sink the ramp so its low end starts exactly at the ground.
  const y = (TRACK.rampLength / 2) * Math.sin(tilt) - (t / 2) * Math.cos(tilt);
  box({
    size: [TRACK.rampWidth, t, TRACK.rampLength],
    position: [-TRACK.curveRadius, y, 0],
    rotation: [TRACK.rampAngle, 0, 0],
    texture: 'assets/textures/wood_planks',
  });
}

// Where to put the cars at the start (on the right straight, facing +Z). lane: -1 left, 0 middle, 1 right.
export function startPosition(lane = 0) {
  return [TRACK.curveRadius + lane * 4, 0, -TRACK.straightLength / 2 + 10];
}

// Checkpoint gates spread around the loop (use with near(car.position, gate, TRACK.width / 2 + 2)).
export function gates(count = 4) {
  return Array.from({ length: count }, (_, k) => trackPath[Math.floor((k + 1) * trackPath.length / count) % trackPath.length]);
}

export async function buildTrack() {
  buildPath();
  buildWalls();
  buildRamp();
  await buildRoad();
}
