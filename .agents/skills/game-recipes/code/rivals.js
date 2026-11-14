// Computer cars that race around the track from race-track.js, each in its own lane.
// Copy to src/game/rivals.js. In setup(): await setupRivals(); in update(dt): updateRivals(dt).
// Freeze them for a countdown with: for (const r of rivals) r.car.frozen = true;
import { createVehicle, tune, near } from '../engine/index.js';
import { trackPath, sideAt, startPosition } from './track.js';

export const RIVALS = tune('Rivals', {
  topSpeed: { value: 19, min: 5, max: 40 }, // the fastest computer car (yours: Car > maxSpeed)
  speedDifference: { value: 1.5, min: 0, max: 8 }, // how much slower each next one is
  steering: { value: 2, min: 0.5, max: 6 },
  lookAhead: { value: 2, min: 1, max: 5, step: 1 }, // how many road points ahead they aim
  laneWidth: { value: 3, min: 0, max: 6 },
});

export const rivals = [];

export async function setupRivals(models = ['assets/models/racing/vehicle_truck_yellow.glb', 'assets/models/racing/vehicle_truck_green.glb']) {
  for (const [k, model] of models.entries()) {
    const lane = k % 2 ? 1 : -1;
    const car = await createVehicle({ model, size: 3, position: startPosition(lane), rotation: 0, camera: 'none', controls: false });
    car.maxSpeed = RIVALS.topSpeed - k * RIVALS.speedDifference;
    rivals.push({ car, lane, next: 2, stuck: 0 });
  }
}

// Where a rival aims: a road point a little ahead, moved sideways into its lane.
function target(r, ahead) {
  const i = (r.next + ahead) % trackPath.length;
  return trackPath[i].clone().addScaledVector(sideAt(i), r.lane * RIVALS.laneWidth);
}

export function updateRivals(dt) {
  for (const [k, r] of rivals.entries()) {
    const car = r.car;
    car.maxSpeed = RIVALS.topSpeed - k * RIVALS.speedDifference;
    if (near(car.position, target(r, 0), 10)) r.next = (r.next + 1) % trackPath.length;
    // Turn towards the aim point.
    const t = target(r, RIVALS.lookAhead);
    const want = Math.atan2(t.x - car.position.x, t.z - car.position.z);
    let diff = want - car.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
    car.steer = Math.max(-1, Math.min(1, diff * RIVALS.steering));
    car.throttle = 1;
    // Stuck against a wall or a car for 2 seconds? Put it back on the road.
    r.stuck = !car.frozen && Math.abs(car.speed) < 1 ? r.stuck + dt : 0;
    if (r.stuck > 2) {
      const p = target(r, 0);
      const n = target(r, 1);
      car.teleport(p, (Math.atan2(n.x - p.x, n.z - p.z) * 180) / Math.PI);
      r.stuck = 0;
    }
  }
}
