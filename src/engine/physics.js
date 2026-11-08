// Physics (Rapier). Objects fall, bounce, stack and get pushed around.
//   physics.add(mesh, { type: 'dynamic' })   falls and tumbles (default)
//   physics.add(mesh, { type: 'fixed' })     never moves: floors, walls, levels
//   physics.add(mesh, { type: 'kinematic' }) you move it in code, it pushes others (moving platforms)
//   Options: shape: 'box' | 'ball' | 'capsule' | 'cylinder' | 'mesh' (exact, fixed only) | 'hull'
//            mass, friction (0..1+), bounciness (0..1), sensor: true (detects, doesn't block),
//            lockRotation: true (stays upright), gravity: 1 (0 = floats)
//   physics.onHit(object, (other) => {})     called when object starts touching another object
//                                            (other === player.object when it's the player)
//   physics.push(object, { x, y, z })        instant kick (impulse)
//   physics.setVelocity(object, { x, y, z }) / physics.getVelocity(object)
//   physics.raycast(from, direction, maxDistance, { ignore: object }) -> { object, point, normal, distance } | null
//   physics.remove(object)                   world.remove(object) does this for you
//   physics.teleport(object, position)       move a physics object instantly
// Bodies are found with object.userData.body. The raw Rapier module is physics.RAPIER.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { tune } from './tuning.js';

const bodies = new Map(); // object -> body
const colliderToObject = new Map(); // collider handle -> object
const hitHandlers = new Map(); // object -> [fn]
let eventQueue = null;
let accumulator = 0;
const STEP = 1 / 60;
const fixedUpdates = new Set();
let P;

const _box = new THREE.Box3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

export const physics = {
  RAPIER,
  world: null,
  steps: 0, // how many physics steps have run (new colliders are only solid for queries after one)

  async init() {
    await RAPIER.init();
    P = tune('Physics', { gravity: { value: 20, min: 0, max: 60 }, showColliders: false });
    this.world = new RAPIER.World({ x: 0, y: -P.gravity, z: 0 });
    eventQueue = new RAPIER.EventQueue(true);
  },

  add(object, opts = {}) {
    const type = opts.type || 'dynamic';
    if (bodies.has(object)) this.remove(object);
    object.updateWorldMatrix(true, true);

    const desc =
      type === 'fixed'
        ? RAPIER.RigidBodyDesc.fixed()
        : type === 'kinematic'
          ? RAPIER.RigidBodyDesc.kinematicPositionBased()
          : RAPIER.RigidBodyDesc.dynamic();
    object.getWorldPosition(_v);
    object.getWorldQuaternion(_q);
    desc.setTranslation(_v.x, _v.y, _v.z).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    if (opts.lockRotation) desc.lockRotations();
    if (opts.gravity !== undefined) desc.setGravityScale(opts.gravity);
    if (opts.damping !== undefined) desc.setLinearDamping(opts.damping);
    if (opts.ccd) desc.setCcdEnabled(true);
    const body = this.world.createRigidBody(desc);

    const colliderDesc = makeShape(object, opts.shape || (type === 'fixed' && opts.exact ? 'mesh' : 'box'), opts);
    colliderDesc.setFriction(opts.friction ?? 0.7);
    colliderDesc.setRestitution(opts.bounciness ?? 0);
    if (opts.mass !== undefined) colliderDesc.setMass(opts.mass);
    if (opts.sensor) {
      colliderDesc.setSensor(true);
      colliderDesc.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL); // also notice the player
    }
    colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(colliderDesc, body);

    body.userData = { object, type };
    object.userData.body = body;
    object.userData.collider = collider;
    bodies.set(object, body);
    colliderToObject.set(collider.handle, object);
    if (P.showColliders) addDebugShape(object, opts);
    return body;
  },

  remove(object) {
    const body = bodies.get(object);
    if (!body) {
      object.traverse?.((child) => child !== object && bodies.has(child) && this.remove(child));
      return;
    }
    for (let i = 0; i < body.numColliders(); i++) colliderToObject.delete(body.collider(i).handle);
    this.world.removeRigidBody(body);
    bodies.delete(object);
    hitHandlers.delete(object);
    delete object.userData.body;
    delete object.userData.collider;
  },

  // Links a body you made yourself (with physics.world / physics.RAPIER) to an object.
  register(object, body, collider) {
    body.userData = { object, type: 'manual' }; // you move it yourself
    object.userData.body = body;
    object.userData.collider = collider;
    colliderToObject.set(collider.handle, object);
    collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  },

  // fn(stepSeconds) runs before every physics step (60 times a second).
  onFixedUpdate(fn) {
    fixedUpdates.add(fn);
    return () => fixedUpdates.delete(fn);
  },

  onHit(object, fn) {
    if (!hitHandlers.has(object)) hitHandlers.set(object, []);
    hitHandlers.get(object).push(fn);
  },

  push(object, impulse) {
    const body = bodies.get(object);
    body?.applyImpulse({ x: impulse.x || 0, y: impulse.y || 0, z: impulse.z || 0 }, true);
  },

  setVelocity(object, v) {
    bodies.get(object)?.setLinvel({ x: v.x || 0, y: v.y || 0, z: v.z || 0 }, true);
  },

  getVelocity(object) {
    const v = bodies.get(object)?.linvel();
    return v ? new THREE.Vector3(v.x, v.y, v.z) : new THREE.Vector3();
  },

  teleport(object, position) {
    const p = Array.isArray(position) ? { x: position[0], y: position[1], z: position[2] } : position;
    object.position.set(p.x, p.y, p.z);
    const body = bodies.get(object);
    if (body) {
      body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  },

  raycast(from, direction, maxDistance = 100, { ignore } = {}) {
    const dir = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
    const ray = new RAPIER.Ray({ x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z });
    const ignoreBody = ignore ? ignore.userData?.body : undefined;
    const hit = this.world.castRayAndGetNormal(ray, maxDistance, true, undefined, undefined, undefined, ignoreBody, (c) => !c.isSensor());
    if (!hit) return null;
    const point = new THREE.Vector3(from.x, from.y, from.z).addScaledVector(dir, hit.timeOfImpact);
    return {
      object: colliderToObject.get(hit.collider.handle) || null,
      point,
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      distance: hit.timeOfImpact,
    };
  },

  objectFromCollider(collider) {
    return colliderToObject.get(collider.handle) || null;
  },

  step(dt) {
    this.world.gravity = { x: 0, y: -P.gravity, z: 0 };
    // Kinematic bodies follow their objects.
    for (const [object, body] of bodies) {
      if (body.userData.type === 'kinematic') {
        object.getWorldPosition(_v);
        object.getWorldQuaternion(_q);
        body.setNextKinematicTranslation(_v);
        body.setNextKinematicRotation(_q);
      }
    }
    // Fixed 60 steps per second. Characters and cars move inside each step (onFixedUpdate), so
    // they go the same speed on 30, 60 or 144 Hz screens.
    accumulator = Math.min(accumulator + dt, STEP * 5);
    while (accumulator >= STEP) {
      for (const fn of fixedUpdates) fn(STEP);
      this.world.timestep = STEP;
      this.world.step(eventQueue);
      this.steps++;
      accumulator -= STEP;
      eventQueue.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        const a = colliderToObject.get(h1);
        const b = colliderToObject.get(h2);
        if (a && hitHandlers.has(a)) for (const fn of hitHandlers.get(a)) fn(b || null);
        if (b && hitHandlers.has(b)) for (const fn of hitHandlers.get(b)) fn(a || null);
      });
    }
    // Dynamic bodies move their objects.
    for (const [object, body] of bodies) {
      if (body.userData.type !== 'dynamic') continue;
      const t = body.translation();
      const r = body.rotation();
      if (object.parent && !object.parent.isScene) {
        // Convert world transform into the parent's space.
        _m.compose(_v.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), object.getWorldScale(_s));
        _m.premultiply(object.parent.matrixWorld.clone().invert());
        _m.decompose(object.position, object.quaternion, _s);
      } else {
        object.position.set(t.x, t.y, t.z);
        object.quaternion.set(r.x, r.y, r.z, r.w);
      }
    }
  },
};

// Builds a collider shape that fits the object's meshes (in the object's own space, world scale).
function makeShape(object, shape, opts) {
  const scale = object.getWorldScale(new THREE.Vector3());
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
  _box.makeEmpty();
  object.traverse((child) => {
    if (!child.isMesh || child.userData.noCollider) return;
    const g = child.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const m = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld);
    _box.union(g.boundingBox.clone().applyMatrix4(m));
  });
  if (_box.isEmpty()) _box.set(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
  if (opts.size) {
    const s = Array.isArray(opts.size) ? opts.size : [opts.size, opts.size, opts.size];
    _box.setFromCenterAndSize(_box.getCenter(new THREE.Vector3()), new THREE.Vector3(s[0], s[1], s[2]).divide(scale));
  }
  const size = _box.getSize(new THREE.Vector3()).multiply(scale);
  const center = _box.getCenter(new THREE.Vector3()).multiply(scale);
  let desc;

  if (shape === 'ball' || shape === 'sphere') {
    desc = RAPIER.ColliderDesc.ball(opts.radius ?? Math.max(size.x, size.y, size.z) / 2);
  } else if (shape === 'capsule') {
    const radius = opts.radius ?? Math.max(size.x, size.z) / 2;
    desc = RAPIER.ColliderDesc.capsule(Math.max(0.01, size.y / 2 - radius), radius);
  } else if (shape === 'cylinder') {
    desc = RAPIER.ColliderDesc.cylinder(size.y / 2, opts.radius ?? Math.max(size.x, size.z) / 2);
  } else if (shape === 'mesh' || shape === 'hull') {
    const { vertices, indices } = collectGeometry(object, inv, scale);
    if (shape === 'hull') desc = RAPIER.ColliderDesc.convexHull(vertices);
    else desc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    if (!desc) desc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
    return desc; // vertices are already in object space
  } else {
    desc = RAPIER.ColliderDesc.cuboid(Math.max(0.01, size.x / 2), Math.max(0.01, size.y / 2), Math.max(0.01, size.z / 2));
  }
  desc.setTranslation(center.x, center.y, center.z);
  return desc;
}

function collectGeometry(object, inv, scale) {
  const vertices = [];
  const indices = [];
  const scaleM = new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z);
  object.traverse((child) => {
    if (!child.isMesh || child.userData.noCollider) return;
    const g = child.geometry;
    const pos = g.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld).premultiply(scaleM);
    const base = vertices.length / 3;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      vertices.push(_v.x, _v.y, _v.z);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) indices.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) indices.push(base + i);
  });
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

function addDebugShape(object) {
  const helper = new THREE.BoxHelper(object, '#00ff88');
  helper.userData.noCollider = true;
  object.parent?.add(helper);
  const update = () => {
    helper.update();
    requestAnimationFrame(update);
  };
  update();
}
