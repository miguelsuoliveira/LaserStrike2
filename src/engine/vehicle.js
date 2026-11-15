// An arcade car (or kart, truck, tank, hover-board). W/S or Up/Down = gas/brake/reverse,
// A/D or Left/Right = steer, Space = handbrake (drift). Collides with walls, drives up ramps, falls off cliffs.
//   const car = await createVehicle({
//     model: 'assets/models/racing/vehicle_truck_red.glb',
//     size: 3,                 // length in meters
//     position: [0, 0, 0],
//     rotation: 0,             // degrees, which way it starts facing
//     camera: 'chase',         // 'chase' | 'top' | 'none'
//   });
//   car.object / car.position, car.speed (m/s, negative = reverse), car.frozen = true,
//   car.teleport([x, y, z], rotationDegrees), car.boost(2) (2x speed for a moment), car.controls = false (drive it from code)
//   car.steer / car.throttle  (-1..1) when controls = false (AI cars); car.maxSpeed = 18 (this car only)
//   car.boosting (true during a boost), car.grounded
//   ramps: false   never jump off ramps (tanks, trucks); by default driving fast up a real ramp launches the car
//   The model's front must point +Z: if it drives sideways or backwards, fix it with turn: 90, -90 or 180
//   (check with `npm run snap -- --colliders`: the yellow arrow is forward).
// Sliders "Car": maxSpeed, acceleration, brakes, turnSpeed, grip, gravity.
import * as THREE from 'three';
import { physics } from './physics.js';
import { input } from './input.js';
import { tune } from './tuning.js';
import { cameraRig } from './camera.js';
import { loadModel } from './assets.js';
import { damp } from './utils.js';
import { warnOnce } from './physics.js';

const vehicles = [];
let V = null;


export async function createVehicle(opts = {}) {
  V ||= tune('Car', {
    maxSpeed: { value: 22, min: 1, max: 80 },
    reverseSpeed: { value: 7, min: 1, max: 30 },
    acceleration: { value: 14, min: 1, max: 80 },
    brakes: { value: 30, min: 1, max: 100 },
    turnSpeed: { value: 2.2, min: 0.2, max: 6 },
    grip: { value: 6, min: 0.5, max: 20 }, // low = drifty, high = sticks to the road
    gravity: { value: 25, min: 1, max: 80 },
  });
  const object = await loadModel(opts.model || 'assets/models/racing/vehicle_truck_red.glb', {
    size: opts.size ?? 3,
    position: opts.position || [0, 0, 0],
    rotation: opts.rotation,
    turn: opts.turn,
  });
  const s = object.userData.size; // width, height, length after scaling
  if (s.x > s.z * 1.2)
    warnOnce(`sideways:${object.name}`, `the vehicle "${object.name}" is wider than it is long, so it probably drives sideways. Look at it with npm run snap -- --colliders (the yellow arrow is forward) and fix it with turn: 90 or turn: -90.`);
  const R = physics.RAPIER;
  const hx = s.x / 2;
  const hy = Math.max(0.2, s.y / 2 - 0.15, hx); // at least half the width: the capsule below is as wide as the car
  const hz = s.z / 2;
  const LIFT = 0.1; // start a bit above the ground: a collider that starts touching the ground sinks in and gets stuck
  const body = physics.world.createRigidBody(
    R.RigidBodyDesc.kinematicPositionBased().setTranslation(object.position.x, object.position.y + hy + LIFT, object.position.z),
  );
  // A capsule lying along the car (front to back): box colliders snag on flat ground and stop the car.
  const radius = hy;
  const collider = physics.world.createCollider(
    R.ColliderDesc.capsule(Math.max(0.05, hz - radius), radius).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }),
    body,
  );
  const controller = physics.world.createCharacterController(0.03);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(800);
  controller.enableAutostep(0.25, 0.3, false);
  controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(40));
  controller.enableSnapToGround(0.4);
  physics.register(object, body, collider);
  physics.showFacing(object, Math.max(1.2, s.z * 0.9));
  object.userData.cameraIgnore = true;
  let checkSpawn = true; // started (or teleported) inside something? lift it out first

  let heading = object.rotation.y;
  const createdAtStep = physics.steps;
  let vy = 0;
  let climb = 0; // m/s upwards while driving up a slope
  const ramps = opts.ramps ?? true;
  let boostUntil = 0;
  let boostScale = 1;
  const sideways = new THREE.Vector2(); // drift velocity (x = forward, y = sideways)
  const tilt = new THREE.Euler();

  const car = {
    object,
    body,
    collider,
    speed: 0,
    grounded: true,
    frozen: false,
    controls: opts.controls ?? true,
    steer: 0,
    throttle: 0,
    get position() {
      return object.position;
    },
    get heading() {
      return heading;
    },
    teleport(p, rotationDegrees) {
      const v = Array.isArray(p) ? new THREE.Vector3(...p) : p;
      object.position.copy(v);
      if (rotationDegrees !== undefined) heading = THREE.MathUtils.degToRad(rotationDegrees);
      body.setTranslation({ x: v.x, y: v.y + hy + LIFT, z: v.z }, true);
      checkSpawn = true;
      this.speed = 0;
      sideways.set(0, 0);
      vy = 0;
    },
    get boosting() {
      return performance.now() < boostUntil;
    },
    boost(scale = 2, seconds = 1.5) {
      boostScale = scale;
      boostUntil = performance.now() + seconds * 1000;
    },
    update(dt) {
      // New colliders (the ground, walls) only become solid after the first physics step:
      // moving before that lets the car fall into the ground and get stuck.
      if (physics.steps <= createdAtStep) return;
      if (checkSpawn) {
        checkSpawn = false;
        physics.unstick(body, collider, object.name);
      }
      if (this.controls) {
        this.throttle = this.frozen ? 0 : input.move.y;
        this.steer = this.frozen ? 0 : -input.move.x;
      } else if (this.frozen) {
        this.throttle = 0; // frozen computer cars stay put too
        this.steer = 0;
      }
      const boost = performance.now() < boostUntil ? boostScale : 1;
      const top = (this.maxSpeed ?? V.maxSpeed) * boost;
      // Gas, brake, reverse.
      if (this.throttle > 0) this.speed = Math.min(top, this.speed + V.acceleration * boost * this.throttle * dt);
      else if (this.throttle < 0) {
        if (this.speed > 0.5) this.speed = Math.max(0, this.speed - V.brakes * dt);
        else this.speed = Math.max(-V.reverseSpeed, this.speed + V.acceleration * this.throttle * dt);
      } else this.speed = damp(this.speed, 0, 0.8, dt);
      if (this.speed > top) this.speed = damp(this.speed, top, 3, dt);
      const handbrake = this.controls && !this.frozen && input.held('space');
      if (handbrake) this.speed = damp(this.speed, 0, 1.5, dt);

      // Steering works better at speed, and backwards when reversing.
      const steerAmount = this.steer * V.turnSpeed * Math.min(1, Math.abs(this.speed) / 6) * Math.sign(this.speed || 1);
      if (this.grounded) heading += steerAmount * dt;

      // Grip: how fast sideways sliding stops (drifting).
      const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
      sideways.y = damp(sideways.y, 0, handbrake ? V.grip * 0.15 : V.grip, dt);
      sideways.y += -steerAmount * this.speed * 1.2 * dt * (handbrake ? 3 : 1); // (per second, so fast laptops don't slide more)
      const move = fwd.multiplyScalar(this.speed).addScaledVector(side, sideways.y);

      vy = this.grounded ? -1 : vy - V.gravity * dt;
      // Don't glue the car to the ground while it climbs, or it can't fly off the top of a ramp.
      if (climb > 2 && ramps) controller.disableSnapToGround();
      else controller.enableSnapToGround(0.4);
      controller.computeColliderMovement(collider, { x: move.x * dt, y: vy * dt, z: move.z * dt }, R.QueryFilterFlags.EXCLUDE_SENSORS);
      const moved = controller.computedMovement();
      const wasGrounded = this.grounded;
      this.grounded = controller.computedGrounded();
      // Driving up a ramp: remember how fast we climb, so driving off the top is a real jump.
      // Smoothed and capped: a step up onto a plate or kerb (autostep lifts the car in one go) is not a ramp,
      // and used to launch cars and tanks high into the air when they drove off the other side.
      if (this.grounded) {
        const rate = THREE.MathUtils.clamp(moved.y / dt, 0, Math.abs(this.speed) * 0.85);
        climb = damp(climb, rate, 5, dt);
      } else if (wasGrounded && ramps && climb > 2) vy = Math.max(vy, Math.min(climb, 12));
      if (!this.grounded && vy > 12) vy = 12;
      // Bumped into a wall: lose speed.
      const want = Math.hypot(move.x, move.z) * dt;
      const got = Math.hypot(moved.x, moved.z);
      // Only walls count (steep contacts): touching the ground must never slow the car.
      let wall = false;
      for (let i = 0; i < controller.numComputedCollisions(); i++) {
        const c = controller.computedCollision(i);
        if (c && Math.abs(c.normal1.y) < 0.5) wall = true;
      }
      if (wall && want > 0.01 && got < want * 0.5) this.speed *= 0.6;

      const t = body.translation();
      const next = { x: t.x + moved.x, y: t.y + moved.y, z: t.z + moved.z };
      body.setNextKinematicTranslation(next);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      body.setNextKinematicRotation(q);
      object.position.set(next.x, next.y - hy, next.z);

      // Lean into turns and tip forward when braking, just for looks.
      tilt.set(
        damp(tilt.x, this.grounded ? -this.throttle * 0.03 : 0.15, 6, dt),
        heading,
        damp(tilt.z, -steerAmount * Math.min(1, Math.abs(this.speed) / 10) * 0.08, 6, dt),
        'YXZ',
      );
      object.rotation.copy(tilt);
    },
  };

  if (!vehicles.length) physics.onFixedUpdate((step) => vehicles.forEach((v) => v.update(step)));
  vehicles.push(car);
  const cam = opts.camera ?? 'chase';
  if (cam !== 'none') cameraRig.follow(object, { mode: cam, height: 1.2 });
  if (window.game && car.controls) window.game.car = car; // the one you drive
  return car;
}
