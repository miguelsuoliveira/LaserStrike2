// Quick shapes for building levels, already in the world and (optionally) solid.
//   box({ size: [4, 1, 4], position: [0, 0.5, 0], color: '#888888' })
//   box({ size: [2, 2, 2], position: [3, 5, 0], texture: 'assets/textures/wood_planks', physics: 'dynamic' })
//   ball({ radius: 0.5, position: [0, 3, 0], color: 'red', physics: 'dynamic', bounciness: 0.8 })
//   cylinder({ radius: 1, height: 3, position: [5, 1.5, 0] })
//   await ground({ texture: 'assets/textures/grass', size: 200 })   big flat floor (top at y = 0)
// Common options:
//   physics: 'fixed' (default for box/cylinder: solid, never moves) | 'dynamic' (falls, can be pushed)
//            | 'kinematic' (moved by your code, pushes others) | false (not solid)
//   rotation: [x, y, z] in degrees       glow: '#00ffff' (makes it shine), glowStrength: 0.3 (big glowing areas
//                                        like lava: use a dark color + low glowStrength, or the screen washes out)
//   texture: a folder in assets/textures (tiles every `tile` meters, default 2)
//   opacity: 0.5 see-through; opacity: 0 = invisible but solid (invisible walls, a ramp over steep stairs)
//   mass, bounciness, friction           roughness: 0..1, metalness: 0..1
import * as THREE from 'three';
import { world } from './world.js';
import { physics } from './physics.js';
import { loadMaterial } from './assets.js';

function finish(mesh, opts, defaultPhysics, shape) {
  const invisible = opts.opacity === 0; // invisible walls and ramps: solid, but no shadow and not drawn
  mesh.castShadow = !invisible;
  mesh.receiveShadow = !invisible;
  if (invisible) mesh.material.colorWrite = mesh.material.depthWrite = false;
  const p = opts.position || [0, 0, 0];
  if (Array.isArray(p)) mesh.position.set(p[0], p[1], p[2]);
  else mesh.position.copy(p);
  if (opts.rotation) {
    const r = opts.rotation.map((d) => THREE.MathUtils.degToRad(d));
    mesh.rotation.set(r[0], r[1], r[2]);
  }
  if (opts.texture) {
    worldUVs(mesh.geometry, opts.tile ?? 2);
    loadMaterial(opts.texture, { repeat: 1 })
      .then((m) => {
        mesh.material = m.clone();
        if (opts.color) mesh.material.color.set(opts.color);
        applyGlow(mesh.material, opts.glow, opts.glowStrength);
      })
      .catch((e) => console.warn(e.message));
  }
  if (opts.add !== false) world.add(mesh);
  const type = opts.physics ?? defaultPhysics;
  if (type) physics.add(mesh, { ...opts, type, shape });
  return mesh;
}

function material(opts) {
  const m = new THREE.MeshStandardMaterial({
    color: opts.color || '#b8b8b8',
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0,
    transparent: opts.opacity !== undefined && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
  });
  applyGlow(m, opts.glow, opts.glowStrength);
  return m;
}

// Bright enough to glow (bloom) whatever the color: dark colors like blue get a bigger boost.
function applyGlow(m, glow, strength = 1) {
  if (!glow) return;
  m.emissive.set(glow);
  const c = m.emissive;
  const luminance = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  m.emissiveIntensity = Math.min(25, 2.8 / Math.max(0.05, luminance)) * strength;
}

export function box(opts = {}) {
  const s = Array.isArray(opts.size) ? opts.size : [opts.size ?? 1, opts.size ?? 1, opts.size ?? 1];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), material(opts));
  return finish(mesh, opts, 'fixed', 'box');
}

export function ball(opts = {}) {
  const r = opts.radius ?? 0.5;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), material(opts));
  return finish(mesh, opts, 'dynamic', 'ball');
}

export function cylinder(opts = {}) {
  const r = opts.radius ?? 0.5;
  const h = opts.height ?? 1;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(opts.radiusTop ?? r, r, h, 32), material(opts));
  return finish(mesh, opts, 'fixed', 'cylinder');
}

export async function ground({ size = 200, texture, tile = 4, color = '#6b8f4e', thickness = 2 } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, thickness, size), material({ color, roughness: 1 }));
  mesh.name = 'ground';
  mesh.position.y = -thickness / 2;
  mesh.receiveShadow = true;
  if (texture) {
    worldUVs(mesh.geometry, tile);
    try {
      mesh.material = await loadMaterial(texture, { repeat: 1 });
    } catch (e) {
      console.warn(e.message);
    }
  }
  world.add(mesh);
  physics.add(mesh, { type: 'fixed', shape: 'box', friction: 0.9 });
  return mesh;
}

// Sets UVs from the vertex positions so textures tile evenly on any size.
function worldUVs(geometry, tile) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u;
    let v;
    if (ny >= nx && ny >= nz) [u, v] = [pos.getX(i), pos.getZ(i)];
    else if (nx >= nz) [u, v] = [pos.getZ(i), pos.getY(i)];
    else [u, v] = [pos.getX(i), pos.getY(i)];
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
}
