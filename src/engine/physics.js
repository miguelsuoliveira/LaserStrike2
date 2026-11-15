// Physics (Rapier). Objects fall, bounce, stack and get pushed around.
//   physics.add(mesh, { type: 'dynamic' })   falls and tumbles (default)
//   physics.add(mesh, { type: 'fixed' })     never moves: floors, walls, levels
//   physics.add(mesh, { type: 'kinematic' }) you move it in code, it pushes others (moving platforms)
//   Options:
//     shape: leave it out and the engine picks: box()/ball()/cylinder() keep their shape, 'fixed' models get
//            their exact shape ('mesh': drive under tables, walk through arches and up stairs), moving models
//            a 'hull' (shrink-wrapped, solid inside), sensors a 'box'. Or choose:
//            'box' | 'ball' | 'capsule' | 'cylinder' | 'mesh' (exact, not for dynamic) | 'hull'
//     material: 'ice' | 'grease' | 'rubber' | 'wood' | 'metal' | 'stone'  (sets friction and bounciness)
//     mass, friction (0..1+), bounciness (0..1), sensor: true (detects, doesn't block),
//     lockRotation: true (stays upright), gravity: 1 (0 = floats), damping (slows down in the air),
//     ccd: true (fast things never pass through walls; automatic for dynamic things under 0.5 m: bullets, balls)
//   physics.onHit(object, (other) => {})     called when object starts touching another object
//                                            (other === player.object when it's the player)
//   physics.push(object, { x, y, z })        instant kick (impulse)
//   physics.setVelocity(object, { x, y, z }) / physics.getVelocity(object)
//   physics.raycast(from, direction, maxDistance, { ignore: object }) -> { object, point, normal, distance } | null
//   physics.remove(object)                   world.remove(object) does this for you
//   physics.teleport(object, position)       move a physics object instantly
// Collider view: slider Physics > showColliders (or `npm run snap -- --colliders`). Green lines = solid
// scenery, blue = things that move, pink = sensors, yellow arrows = where characters and vehicles think
// "forward" is (it must come out of the model's face or nose).
// Physics checks (while developing; shown by `npm run snap` and in logs/browser.log): things that start inside
// each other, things that fall through the floor at the start, characters and cars that start stuck (they are
// lifted out), car models that face sideways.
// Bodies are found with object.userData.body. The raw Rapier module is physics.RAPIER.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { tune } from './tuning.js';

const DEV = !!import.meta.env?.DEV;
const bodies = new Map(); // object -> body
const colliderToObject = new Map(); // collider handle -> object
const hitHandlers = new Map(); // object -> [fn]
const facing = new Map(); // object -> arrow length (characters and vehicles, for the collider view)
const newDynamic = new Set(); // dynamic objects to check for overlaps after their first step
const warned = new Set();
let eventQueue = null;
let accumulator = 0;
const STEP = 1 / 60;
const fixedUpdates = new Set();
let P;
let debugLines = null;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

// friction, bounciness
const MATERIALS = { ice: [0.02, 0.05], grease: [0.04, 0], rubber: [1.2, 0.75], wood: [0.6, 0.15], metal: [0.35, 0.1], stone: [0.8, 0.05] };
const PRIMITIVES = { BoxGeometry: 'box', PlaneGeometry: 'box', SphereGeometry: 'ball', IcosahedronGeometry: 'ball', CylinderGeometry: 'cylinder', CapsuleGeometry: 'capsule' };
const MAX_EXACT_TRIANGLES = 150000; // bigger fixed models get a hull (shrink-wrap) instead
const MAX_HULL_POINTS = 20000;

// Prints a "Physics check:" warning once (only while developing).
export function warnOnce(key, message) {
  if (!DEV || warned.has(key)) return;
  warned.add(key);
  console.warn(`Physics check: ${message}`);
}

// Meshes that make up the collider: visible ones (hidden parts don't collide), not marked noCollider.
function solidMeshes(object) {
  const out = [];
  object.traverse((c) => {
    if (!c.isMesh || c.userData.noCollider) return;
    for (let p = c; p && p !== object.parent; p = p.parent) if (!p.visible) return;
    out.push(c);
  });
  return out;
}

export function nameOf(object) {
  if (!object) return 'something';
  if (object.name) return object.name;
  if (object.geometry) return `a ${object.geometry.type.replace('Geometry', '').toLowerCase() || 'shape'}`;
  return 'something';
}

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

    let shape = opts.shape || (opts.exact ? 'mesh' : autoShape(object, type, opts));
    if (shape === 'mesh' && type === 'dynamic') shape = 'hull'; // exact shapes can't tumble
    const fit = measure(object, opts);

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
    const small = Math.min(fit.size.x, fit.size.y, fit.size.z) < 0.5;
    if (opts.ccd || (type === 'dynamic' && small && opts.ccd !== false)) desc.setCcdEnabled(true);
    const body = this.world.createRigidBody(desc);

    const material = MATERIALS[opts.material] || [];
    let collider = null;
    const tries = shape === 'mesh' ? ['mesh', 'mesh-plain', 'hull', 'box'] : shape === 'hull' ? ['hull', 'box'] : [shape];
    for (const s of tries) {
      try {
        const colliderDesc = makeShape(object, s, opts, fit);
        colliderDesc.setFriction(opts.friction ?? material[0] ?? 0.7);
        colliderDesc.setRestitution(opts.bounciness ?? material[1] ?? 0);
        if (opts.mass !== undefined) colliderDesc.setMass(opts.mass);
        if (opts.sensor) {
          colliderDesc.setSensor(true);
          colliderDesc.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL); // also notice the player
        }
        colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        collider = this.world.createCollider(colliderDesc, body);
        break;
      } catch {
        // this shape didn't work for this model (broken mesh): try a simpler one
      }
    }

    body.userData = { object, type, addedAt: this.steps };
    object.userData.body = body;
    object.userData.collider = collider;
    bodies.set(object, body);
    if (collider) colliderToObject.set(collider.handle, object);
    if (DEV && type === 'dynamic' && collider && !opts.sensor) newDynamic.add(object);
    return body;
  },

  remove(object) {
    const body = bodies.get(object);
    facing.delete(object);
    if (!body) {
      object.traverse?.((child) => child !== object && bodies.has(child) && this.remove(child));
      return;
    }
    for (let i = 0; i < body.numColliders(); i++) colliderToObject.delete(body.collider(i).handle);
    this.world.removeRigidBody(body);
    bodies.delete(object);
    hitHandlers.delete(object);
    newDynamic.delete(object);
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

  // Shows a yellow "forward" arrow on this object in the collider view (characters and vehicles do this).
  showFacing(object, length = 1.5) {
    facing.set(object, length);
  },

  // A character or car that starts inside something solid gets lifted out (up to 4 m) and a warning.
  // Only when it's created: teleport() is also used to move characters along ladders and walls on purpose.
  // Returns how far it was lifted (0 = it was free).
  unstick(body, collider, label = 'it') {
    const pos = collider.translation(); // the collider's own place and turn (a car's capsule lies down)
    const rot = collider.rotation();
    const solid = (c) => {
      const b = c.parent();
      return !b || b.isFixed() || (b.isKinematic() && b.userData?.type !== 'manual'); // not other characters
    };
    const blockerAt = (y) => {
      let hit = null;
      this.world.intersectionsWithShape({ x: pos.x, y, z: pos.z }, rot, collider.shape, (c) => ((hit = c), false), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, collider, body, solid);
      return hit;
    };
    const first = blockerAt(pos.y);
    if (!first) return 0;
    const what = nameOf(colliderToObject.get(first.handle));
    for (let dy = 0.2; dy <= 4.01; dy += 0.2) {
      if (!blockerAt(pos.y + dy)) {
        const b = body.translation();
        body.setTranslation({ x: b.x, y: b.y + dy, z: b.z }, true);
        warnOnce(`stuck:${label}:${what}`, `"${label}" started inside "${what}", so it was lifted ${dy.toFixed(1)} m out. Start it on top of things, not inside them.`);
        return dy;
      }
    }
    warnOnce(`stuck:${label}:${what}`, `"${label}" is stuck inside "${what}" and can't move. Start it somewhere free.`);
    return 0;
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
      if (newDynamic.size) checkOverlaps(this.world);
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
      if (t.y < -100 && !body.isSleeping()) {
        // Gone for good: stop simulating it.
        body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        body.sleep();
        if (this.steps - (body.userData.addedAt ?? 0) < 240)
          warnOnce(`fell:${nameOf(object)}`, `"${nameOf(object)}" fell through the world right after it appeared. What it should stand on needs physics ('fixed'), and it must start on top of it.`);
      }
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

  // Collider view (slider Physics > showColliders). The engine calls this every frame.
  drawDebug(scene) {
    if (!P?.showColliders) {
      if (debugLines) debugLines.visible = false;
      return;
    }
    if (!debugLines) {
      const geometry = new THREE.BufferGeometry();
      debugLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
      debugLines.name = 'collider view';
      debugLines.renderOrder = 999;
      debugLines.frustumCulled = false;
      debugLines.userData.noCollider = true;
      debugLines.userData.cameraIgnore = true;
    }
    if (debugLines.parent !== scene) scene.add(debugLines);
    debugLines.visible = true;
    const pos = [];
    const col = [];
    const passes = [
      [(c) => c.isSensor(), [1, 0.35, 0.9]],
      [(c) => !c.isSensor() && (!c.parent() || c.parent().isFixed()), [0.2, 1, 0.45]],
      [(c) => !c.isSensor() && c.parent() && !c.parent().isFixed(), [0.25, 0.7, 1]],
    ];
    for (const [pick, rgb] of passes) {
      const { vertices } = this.world.debugRender(undefined, pick);
      for (let i = 0; i < vertices.length; i++) pos.push(vertices[i]);
      for (let i = 0; i < vertices.length / 3; i++) col.push(rgb[0], rgb[1], rgb[2]);
    }
    // Yellow arrows: which way is forward (+Z) for characters and vehicles.
    for (const [object, length] of facing) {
      if (!object.parent) continue;
      const size = object.userData.size;
      object.getWorldPosition(_v);
      _v.y += Math.max(0.3, (size?.y ?? 1.5) * 0.6);
      _v2.set(0, 0, 1).applyQuaternion(object.getWorldQuaternion(_q));
      _v2.y = 0;
      _v2.normalize();
      const tip = _v.clone().addScaledVector(_v2, length);
      const side = new THREE.Vector3(_v2.z, 0, -_v2.x).multiplyScalar(length * 0.15);
      const back = tip.clone().addScaledVector(_v2, -length * 0.25);
      for (const [a, b] of [[_v, tip], [tip, back.clone().add(side)], [tip, back.clone().sub(side)]]) {
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        col.push(1, 0.9, 0.1, 1, 0.9, 0.1);
      }
    }
    const g = debugLines.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  },
};

// Which collider fits best when the game didn't say.
function autoShape(object, type, opts) {
  if (opts.sensor) return 'box';
  const meshes = solidMeshes(object);
  if (!meshes.length) return 'box';
  if (meshes.length === 1) {
    const m = meshes[0];
    const prim = PRIMITIVES[m.geometry?.type];
    const aligned = m === object || (m.parent === object && m.quaternion.x === 0 && m.quaternion.y === 0 && m.quaternion.z === 0);
    if (prim && aligned) return prim;
  }
  if (type !== 'fixed') return 'hull';
  let tris = 0;
  for (const m of meshes) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  if (tris > MAX_EXACT_TRIANGLES) {
    warnOnce(`bigmesh:${nameOf(object)}`, `"${nameOf(object)}" has ${Math.round(tris).toLocaleString('en-US')} triangles, so its collider is a shrink-wrap (solid inside, you can't go under or into it). For exact walls and floors shrink it first (npm run remix -- shrink) or add shape: 'mesh'.`);
    return 'hull';
  }
  return 'mesh';
}

// The object's box in its own space (world scale): size, center, and the matrices to get there.
function measure(object, opts) {
  const scale = object.getWorldScale(new THREE.Vector3());
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const box = new THREE.Box3();
  for (const child of solidMeshes(object)) {
    const g = child.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const m = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld);
    box.union(g.boundingBox.clone().applyMatrix4(m));
  }
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
  if (opts.size) {
    const s = Array.isArray(opts.size) ? opts.size : [opts.size, opts.size, opts.size];
    box.setFromCenterAndSize(box.getCenter(new THREE.Vector3()), new THREE.Vector3(s[0], s[1], s[2]).divide(scale));
  }
  return { scale, inv, size: box.getSize(new THREE.Vector3()).multiply(scale), center: box.getCenter(new THREE.Vector3()).multiply(scale) };
}

// Builds a collider shape that fits the object's meshes (in the object's own space, world scale).
function makeShape(object, shape, opts, { scale, inv, size, center }) {
  let desc;
  if (shape === 'ball' || shape === 'sphere') {
    desc = RAPIER.ColliderDesc.ball(opts.radius ?? Math.max(size.x, size.y, size.z) / 2);
  } else if (shape === 'capsule') {
    const radius = opts.radius ?? Math.max(size.x, size.z) / 2;
    desc = RAPIER.ColliderDesc.capsule(Math.max(0.01, size.y / 2 - radius), radius);
  } else if (shape === 'cylinder') {
    desc = RAPIER.ColliderDesc.cylinder(size.y / 2, opts.radius ?? Math.max(size.x, size.z) / 2);
  } else if (shape === 'mesh' || shape === 'mesh-plain') {
    const { vertices, indices } = collectGeometry(object, inv, scale);
    // FIX_INTERNAL_EDGES: no bumps where two triangles of a flat floor meet.
    desc = shape === 'mesh' ? RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES) : RAPIER.ColliderDesc.trimesh(vertices, indices);
    return desc; // vertices are already in object space
  } else if (shape === 'hull') {
    const { vertices } = collectGeometry(object, inv, scale, MAX_HULL_POINTS);
    desc = RAPIER.ColliderDesc.convexHull(vertices);
    if (!desc) throw new Error('no hull');
    return desc;
  } else {
    desc = RAPIER.ColliderDesc.cuboid(Math.max(0.01, size.x / 2), Math.max(0.01, size.y / 2), Math.max(0.01, size.z / 2));
  }
  desc.setTranslation(center.x, center.y, center.z);
  return desc;
}

function collectGeometry(object, inv, scale, maxPoints = Infinity) {
  const vertices = [];
  const indices = [];
  const scaleM = new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z);
  const meshes = solidMeshes(object);
  let total = 0;
  for (const child of meshes) total += child.geometry.attributes.position.count;
  const every = Math.max(1, Math.ceil(total / maxPoints)); // hulls of huge models: every Nth point is plenty
  for (const child of meshes) {
    const g = child.geometry;
    const pos = g.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld).premultiply(scaleM);
    const base = vertices.length / 3;
    for (let i = 0; i < pos.count; i += every) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      vertices.push(_v.x, _v.y, _v.z);
    }
    if (every > 1) continue; // hull only needs points
    if (g.index) for (let i = 0; i < g.index.count; i++) indices.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) indices.push(base + i);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

// Dynamic things that start deep inside something else get shot out at high speed: warn about it.
function checkOverlaps(world) {
  for (const object of newDynamic) {
    const collider = object.userData.collider;
    if (!collider || !collider.isValid?.()) continue;
    let deepest = 0;
    let other = null;
    world.contactPairsWith(collider, (c2) => {
      if (c2.isSensor()) return;
      world.contactPair(collider, c2, (manifold) => {
        for (let i = 0; i < manifold.numContacts(); i++) {
          const d = manifold.contactDist(i);
          if (d < deepest) {
            deepest = d;
            other = c2;
          }
        }
      });
    });
    if (deepest < -0.08) {
      const a = nameOf(object);
      const b = nameOf(colliderToObject.get(other.handle));
      warnOnce(`overlap:${a}:${b}`, `"${a}" starts ${(-deepest).toFixed(2)} m inside "${b}", so it will jump or fly out. Put things on top of each other or apart, not inside.`);
    }
  }
  newDynamic.clear();
}
