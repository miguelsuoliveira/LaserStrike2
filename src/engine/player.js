// Characters that walk with real collisions (walls, stairs, slopes, gravity)
// and play their animations automatically.
//
// THE PLAYER (keyboard + mouse + camera):
//   const player = await createPlayer({
//     model: 'assets/models/characters/knight.glb',   // or your own THREE object (a blob made of spheres)
//     height: 1.8,
//     position: [0, 1, 0],
//     camera: 'third',           // 'third' | 'first' | 'top' | 'side' | 'none'
//     hide: ['Shield'],          // hide model parts by name
//     animations: { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', jump: 'Jump_Full_Short', fall: 'Jump_Idle' },
//   });
//   Sliders "Player": walkSpeed, runSpeed, jumpHeight, gravity, acceleration, airControl, turnSpeed...
//
// ENEMIES / ANIMALS / NPCs (you steer them in update):
//   const zombie = await createCharacter({ model: 'assets/models/characters/skeleton_minion.glb', position: [5, 0, 5], speed: 2 });
//   zombie.walkTo(player.position)       // call every frame; walks there (around walls and boxes in the way)
//   zombie.move(x, z)                    // or: walk in a direction this frame (x/z from -1 to 1)
//   zombie.stop()
//   zombie.remove()                      // gone from the world
//
// Both have:
//   .object (the model, use .position for where its feet are), .grounded, .velocity, .frozen = true,
//   .teleport([x, y, z]), .tryJump() (normal jump), .jump(2) (always jumps, 2x higher: jump pads),
//   await .action('Attack'), .animator (see animation.js),
//   .speed (walking speed, NPCs), .onFall = () => {} (fell off the world; then it respawns)
//   player.faceCamera = true   always face where the camera looks (shooters)
//   .lookAt = somePosition     always face that point (mouse aiming in top view, NPCs watching you); null = off
import * as THREE from 'three';
import { world } from './world.js';
import { physics } from './physics.js';
import { input } from './input.js';
import { tune } from './tuning.js';
import { cameraRig } from './camera.js';
import { loadModel } from './assets.js';
import { animate, forgetAnimator } from './animation.js';
import { damp } from './utils.js';

const characters = [];
const _ahead = new THREE.Vector3();
const _from = new THREE.Vector3();
const _rideP = new THREE.Vector3();
const _rideV = new THREE.Vector3();
const _rideQ = new THREE.Quaternion();
const _rideQ2 = new THREE.Quaternion();
const _rideE = new THREE.Euler();

// Every frame, before physics: read the keyboard for the player.
export function updateCharacters(dt) {
  for (const c of characters) c.frame?.(dt);
}

// Every frame, after physics: NPCs must be steered again next frame.
export function endCharactersFrame() {
  for (const c of characters) if (c !== playerRef) c.stop();
}

let fixedHooked = false;
function hookFixedUpdate() {
  if (fixedHooked) return;
  fixedHooked = true;
  physics.onFixedUpdate((step) => {
    for (const c of characters) c.update(step);
  });
}

// Guesses that fit most free characters; options.animations overrides them.
const DEFAULT_ANIMATIONS = {
  idle: ['Idle', 'idle'],
  walk: ['Walking_A', 'Walk', 'walk'],
  run: ['Running_A', 'Run', 'run', 'sprint'],
  jump: ['Jump_Full_Short', 'Jump_Start', 'Jump', 'jump'],
  fall: ['Jump_Idle', 'Fall', 'Jump', 'jump'],
};

let npcSettings = null;

export async function createCharacter(opts = {}) {
  npcSettings ||= { walkSpeed: 3, runSpeed: 6, jumpHeight: 1.2, gravity: 25, fallGravity: 1.5, acceleration: 10, airControl: 0.5, turnSpeed: 8, maxSlope: 50, stepHeight: 0.4, fallLimit: -40 };
  const P = opts.settings || npcSettings;
  let height = opts.height ?? 1.8;
  let object;
  if (opts.model?.isObject3D) {
    // Your own shape (built from boxes/spheres, a drawing cut-out...): feet at y = 0, front = +Z.
    object = new THREE.Group();
    object.add(opts.model);
    object.userData.model = opts.model;
    object.animations = opts.model.animations || [];
    if (opts.height === undefined) height = Math.max(0.3, new THREE.Box3().setFromObject(opts.model).getSize(new THREE.Vector3()).y);
    const p = opts.position || [0, 0, 0];
    if (Array.isArray(p)) object.position.set(p[0], p[1], p[2]);
    else object.position.copy(p);
    if (opts.rotation) object.rotation.y = THREE.MathUtils.degToRad(opts.rotation);
    world.add(object);
  } else {
    object = await loadModel(opts.model || 'assets/models/characters/robot.glb', {
      height,
      hide: opts.hide,
      turn: opts.turn,
      position: opts.position || [0, 0, 0],
      rotation: opts.rotation,
    });
  }
  const radius = opts.radius ?? Math.min(0.45, height * 0.22);
  const halfHeight = Math.max(0.05, height / 2 - radius);
  const R = physics.RAPIER;

  // Start a little above the ground: a capsule that starts touching the floor sinks into it.
  const LIFT = 0.1;
  const body = physics.world.createRigidBody(
    R.RigidBodyDesc.kinematicPositionBased().setTranslation(object.position.x, object.position.y + halfHeight + radius + LIFT, object.position.z),
  );
  const collider = physics.world.createCollider(R.ColliderDesc.capsule(halfHeight, radius), body);
  const controller = physics.world.createCharacterController(0.02);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(60);
  physics.register(object, body, collider);
  physics.showFacing(object, radius + 0.8);
  object.userData.cameraIgnore = true;
  let checkSpawn = true; // started (or teleported) inside something? lift it out first
  // walkTo: going around things in the way, and getting unstuck
  const avoid = { side: 1, until: 0, stuckUntil: 0, stuckFor: 0, last: new THREE.Vector3(), lastTime: 0 };

  const anim = animate(object);
  const names = { ...DEFAULT_ANIMATIONS, ...(opts.animations || {}) };
  const pick = (want) => [].concat(want).find((n) => n && anim.has(n)) || null;
  const clip = {
    idle: pick(names.idle),
    walk: pick(names.walk),
    run: pick(names.run) || pick(names.walk),
    jump: pick(names.jump),
    fall: pick(names.fall) || pick(names.jump),
  };

  const velocity = new THREE.Vector3();
  const createdAtStep = physics.steps;
  const want = { x: 0, z: 0, run: false };
  let coyote = 0;
  let jumpBuffer = 0;
  let forcedJump = 0;
  let facing = object.rotation.y;
  let lastState = '';
  const t = body.translation();
  const spawn = new THREE.Vector3(t.x, t.y - halfHeight - radius, t.z);

  const c = {
    object,
    model: object.userData.model,
    animator: anim,
    body,
    collider,
    controller,
    velocity,
    settings: P,
    speed: opts.speed ?? P.walkSpeed,
    grounded: false,
    frozen: false,
    faceCamera: false,
    lookAt: null,
    spawn,
    onFall: null,
    height,
    get position() {
      return object.position;
    },

    move(x, z, run = false) {
      want.x = x;
      want.z = z;
      want.run = run;
    },

    walkTo(target, stopDistance = 0.5) {
      const p = target.isVector3 ? target : target.position;
      const dx = p.x - object.position.x;
      const dz = p.z - object.position.z;
      const d = Math.hypot(dx, dz);
      if (d < stopDistance) {
        this.stop();
        return d;
      }
      let mx = dx / d;
      let mz = dz / d;
      const now = performance.now() / 1000;
      // Stuck (wants to walk but hardly moved for a second): walk sideways for a moment.
      if (now - avoid.lastTime > 0.5) {
        const movedBy = Math.hypot(object.position.x - avoid.last.x, object.position.z - avoid.last.z);
        avoid.stuckFor = movedBy < 0.15 && !this.frozen ? avoid.stuckFor + (now - avoid.lastTime) : 0;
        avoid.last.copy(object.position);
        avoid.lastTime = now;
        if (avoid.stuckFor > 1) {
          avoid.side = -avoid.side;
          avoid.stuckUntil = now + 0.8;
          avoid.stuckFor = 0;
        }
      }
      if (now < avoid.stuckUntil) {
        [mx, mz] = [mx * 0.3 + mz * avoid.side, mz * 0.3 - mx * avoid.side];
      } else {
        // Something solid right ahead (a wall, a crate; not the target, not small stuff underfoot)? Go along it.
        _from.set(object.position.x, object.position.y + Math.min(height * 0.5, (P.stepHeight ?? 0.4) + 0.15), object.position.z);
        const look = radius + 0.8;
        const hit = physics.raycast(_from, _ahead.set(mx, 0, mz), look, { ignore: object });
        const o = hit?.object;
        const isTarget = o && (o === target || o === target.object || Math.hypot(o.position.x - p.x, o.position.z - p.z) < 1.5);
        // Stairs: just before the riser we hit, the floor is already higher than our feet (a step we can climb).
        let stairs = false;
        if (hit && !isTarget) {
          _ahead.set(hit.point.x - mx * 0.12, _from.y, hit.point.z - mz * 0.12);
          const down = physics.raycast(_ahead, { x: 0, y: -1, z: 0 }, _from.y - object.position.y + 0.1, { ignore: object });
          stairs = !!down && down.point.y > object.position.y + 0.08;
        }
        if (hit && !isTarget && !stairs && hit.distance < d - 0.3 && Math.abs(hit.normal.y) < 0.6) {
          // Follow the wall one way (the side nearer the target), and keep going that way until the way is clear.
          const nl = Math.hypot(hit.normal.x, hit.normal.z) || 1;
          const nx = hit.normal.x / nl;
          const nz = hit.normal.z / nl;
          if (now > avoid.until) avoid.side = -nz * mx + nx * mz >= 0 ? 1 : -1;
          avoid.until = now + 0.6;
          mx = -nz * avoid.side + nx * 0.15; // along the wall, a little away from it
          mz = nx * avoid.side + nz * 0.15;
        }
      }
      this.move(mx, mz);
      return d;
    },

    stop() {
      want.x = 0;
      want.z = 0;
    },

    teleport(p) {
      const v = Array.isArray(p) ? new THREE.Vector3(...p) : p;
      object.position.copy(v);
      body.setTranslation({ x: v.x, y: v.y + halfHeight + radius + LIFT, z: v.z }, true);
      velocity.set(0, 0, 0);
      checkSpawn = true;
    },

    // Always jumps, even in the air (jump pads, bounces). 2 = twice as high.
    jump(multiplier = 1) {
      forcedJump = multiplier;
    },

    // Jumps only if standing on something (or about to land): normal jumping.
    tryJump() {
      jumpBuffer = 0.12;
    },

    action(name, options) {
      return anim.once(name, options);
    },

    remove() {
      const i = characters.indexOf(c);
      if (i >= 0) characters.splice(i, 1);
      physics.world.removeCharacterController(controller);
      physics.world.removeRigidBody(body);
      physics.remove(object);
      forgetAnimator(object);
      object.removeFromParent();
    },

    // Moves the character. The engine runs it 60 times a second (inside the physics step).
    update(dt) {
      // The ground and walls only become solid after the first physics step: wait for it.
      if (physics.steps <= createdAtStep) return;
      if (checkSpawn) {
        checkSpawn = false;
        physics.unstick(body, collider, object.name || 'a character');
      }
      const isPlayer = this === playerRef;
      let mx = this.frozen ? 0 : want.x;
      let mz = this.frozen ? 0 : want.z;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      const speed = isPlayer ? (want.run ? P.runSpeed : P.walkSpeed) : want.run ? this.speed * 2 : this.speed;
      const control = this.grounded ? 1 : P.airControl;
      velocity.x = damp(velocity.x, mx * speed, P.acceleration * control, dt);
      velocity.z = damp(velocity.z, mz * speed, P.acceleration * control, dt);

      // Jumping is a little forgiving: works just after leaving a ledge or just before landing.
      coyote = this.grounded ? 0.12 : coyote - dt;
      jumpBuffer -= dt;
      const power = forcedJump > 0 ? forcedJump : jumpBuffer > 0 && coyote > 0 && !this.frozen ? 1 : 0;
      if (power > 0) {
        velocity.y = Math.sqrt(2 * P.gravity * P.jumpHeight * power);
        coyote = 0;
        jumpBuffer = 0;
        if (clip.jump) anim.play(clip.jump, { fade: 0.1, loop: false });
        lastState = 'jump';
      }
      forcedJump = 0;
      // Falling faster than rising makes jumps feel snappy instead of floaty.
      velocity.y -= P.gravity * (velocity.y < 0 ? P.fallGravity ?? 1 : 1) * dt;
      if (this.jumpReleased && velocity.y > 0) velocity.y *= P.shortHop ?? 1; // let go early = small hop
      this.jumpReleased = false;
      if (isPlayer && cameraRig.mode === 'side') velocity.z = -object.position.z * 10;

      controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(P.maxSlope));
      controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(P.maxSlope));
      if (P.stepHeight > 0) controller.enableAutostep(P.stepHeight, 0.2, true);
      else controller.disableAutostep();
      controller.enableSnapToGround(this.grounded ? 0.3 : 0);

      // Ride moving platforms (physics: 'kinematic' objects your code moves or turns): carry the
      // character along. Rapier's controller alone only half-follows them, so players slid off.
      // The game already moved the platform object this frame; its body is still where it was, so
      // body pose -> object pose is exactly this frame's platform motion.
      const desired = { x: velocity.x * dt, y: velocity.y * dt, z: velocity.z * dt };
      let rideFilter;
      let riding = false;
      if (this.grounded && velocity.y <= 0) {
        const p = body.translation();
        const hit = physics.world.castRay(new R.Ray(p, { x: 0, y: -1, z: 0 }), halfHeight + radius + 0.3, true, undefined, undefined, collider);
        const pb = hit?.collider.parent();
        const plat = pb?.userData?.type === 'kinematic' ? pb.userData.object : null;
        if (plat) {
          const bt = pb.translation();
          const br = pb.rotation();
          plat.getWorldPosition(_rideP);
          plat.getWorldQuaternion(_rideQ);
          _rideQ.multiply(_rideQ2.set(br.x, br.y, br.z, br.w).invert()); // platform turn this frame
          _rideV.set(p.x - bt.x, p.y - bt.y, p.z - bt.z).applyQuaternion(_rideQ).add(_rideP); // where we get carried
          const surfaceY = p.y - hit.timeOfImpact; // platform top under us (before it moved)
          desired.x += _rideV.x - p.x;
          desired.z += _rideV.z - p.z;
          desired.y = surfaceY + (_rideV.y - p.y) + 0.02 + halfHeight + radius - p.y; // feet stay on top
          const yaw = _rideE.setFromQuaternion(_rideQ, 'YXZ').y;
          object.rotation.y += yaw;
          facing += yaw;
          const rideHandle = hit.collider.handle;
          rideFilter = (c) => c.handle !== rideHandle; // we keep the feet on it ourselves
          riding = true;
        }
      }
      controller.computeColliderMovement(collider, desired, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, rideFilter);
      const moved = controller.computedMovement();
      const wasGrounded = this.grounded;
      this.grounded = riding || controller.computedGrounded();
      if (this.grounded && velocity.y < 0) velocity.y = -1;
      if (!this.grounded && velocity.y > 0 && moved.y < velocity.y * dt * 0.5) velocity.y = 0; // bumped head
      const pos = body.translation();
      const next = { x: pos.x + moved.x, y: pos.y + moved.y, z: pos.z + moved.z };
      body.setNextKinematicTranslation(next);
      object.position.set(next.x, next.y - halfHeight - radius, next.z);

      // Face the walking direction (or the camera).
      const flatSpeed = Math.hypot(velocity.x, velocity.z);
      if (this.lookAt) facing = Math.atan2(this.lookAt.x - object.position.x, this.lookAt.z - object.position.z);
      else if (this.faceCamera && cameraRig.mode !== 'top' && cameraRig.mode !== 'side') facing = cameraRig.yaw + Math.PI;
      else if (Math.hypot(mx, mz) > 0.1) facing = Math.atan2(mx, mz);
      let diff = facing - object.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      object.rotation.y += diff * Math.min(1, P.turnSpeed * dt);

      // Animations.
      const walkSpeed = isPlayer ? P.walkSpeed : this.speed;
      if (!anim.busy) {
        let state;
        if (!this.grounded && (velocity.y < -2 || lastState === 'jump')) state = velocity.y > 0 ? 'jump' : 'fall';
        else if (flatSpeed > walkSpeed * 1.15 && clip.run) state = 'run';
        else if (flatSpeed > 0.3) state = 'walk';
        else state = 'idle';
        if (this.grounded && !wasGrounded) state = flatSpeed > 0.3 ? (flatSpeed > walkSpeed * 1.15 ? 'run' : 'walk') : 'idle';
        if (state !== lastState && !(state === 'fall' && lastState === 'jump' && clip.fall === clip.jump)) {
          if (clip[state]) anim.play(clip[state], { fade: 0.15, loop: state !== 'jump' });
          lastState = state;
        }
        if (anim.current && (state === 'walk' || state === 'run')) {
          const base = state === 'run' ? (isPlayer ? P.runSpeed : walkSpeed * 2) : walkSpeed;
          anim.current.timeScale = THREE.MathUtils.clamp(flatSpeed / (base || 1), 0.5, 1.6);
        }
      } else {
        lastState = '';
      }


      if (object.position.y < P.fallLimit) {
        this.teleport(spawn);
        this.onFall?.();
      }
    },
  };

  if (clip.idle) anim.play(clip.idle);
  characters.push(c);
  hookFixedUpdate();
  return c;
}

let playerRef = null;

export async function createPlayer(opts = {}) {
  const P = tune('Player', {
    walkSpeed: { value: 4, min: 0, max: 20 },
    runSpeed: { value: 8, min: 0, max: 40 },
    jumpHeight: { value: 1.6, min: 0, max: 12 },
    gravity: { value: 25, min: 1, max: 80 },
    fallGravity: { value: 1.5, min: 1, max: 4 }, // x gravity while falling (higher = less floaty)
    shortHop: { value: 0.5, min: 0, max: 1 }, // let go of jump early: keep this much upward speed (1 = off)
    acceleration: { value: 14, min: 1, max: 60 },
    airControl: { value: 0.5, min: 0, max: 1 },
    turnSpeed: { value: 12, min: 1, max: 40 },
    maxSlope: { value: 50, min: 10, max: 80, step: 1 },
    stepHeight: { value: 0.4, min: 0, max: 1.5 },
    fallLimit: { value: -40, min: -200, max: 0, step: 1 },
  });
  const player = await createCharacter({ ...opts, settings: P });
  playerRef = player;
  if (window.game) window.game.player = player; // for the browser console and `npm run snap -- --eval`

  // Keyboard/gamepad steering, relative to the camera (read every frame).
  player.frame = () => {
    const f = cameraRig.forward();
    const r = cameraRig.right();
    let mx = r.x * input.move.x + f.x * input.move.y;
    let mz = r.z * input.move.x + f.z * input.move.y;
    if (cameraRig.mode === 'side') {
      mx = input.move.x;
      mz = 0;
    }
    player.move(mx, mz, input.held('run'));
    if (input.pressed('jump')) player.tryJump();
    if (input.released('jump')) player.jumpReleased = true;
  };

  if (opts.camera !== 'none') cameraRig.follow(player.object, { mode: opts.camera || 'third', height: player.height * 0.85 });
  if (opts.camera === 'first') player.model.visible = false;
  return player;
}
