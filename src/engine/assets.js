// Loading models and textures. Paths start at the public/ folder.
//   const tree = await loadModel('assets/models/nature/tree.glb', { height: 5, position: [3, 0, -2] })
//   Options:
//     height: 1.8      scale so the model is this many meters tall (or size: 2 = biggest side)
//     scale: 0.5       extra scale on top
//     position: [x, y, z], rotation: 90 (degrees around Y), turn: 180 (fix a model that faces backwards)
//     hide: ['Shield'] hide parts whose name contains these words (see `npm run inspect`)
//     physics: 'fixed' | 'dynamic' | 'kinematic'   + any physics.add options (shape, mass...)
//     add: false       don't add it to the world yet
//   The model's feet are put at y = 0 and it is centered, so position = where it stands.
//   Each call gives a new copy, so loading the same file 20 times is fast.
//   model.userData.model is the inner loaded scene; model.animations lists its clips.
//
//   const mat = await loadMaterial('assets/textures/grass', { repeat: 20 })  -> realistic material
//   const tex = await loadTexture('assets/images/my-drawing.png')
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { world } from './world.js';
import { physics } from './physics.js';

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const textureLoader = new THREE.TextureLoader();
const gltfCache = new Map();
const textureCache = new Map();
const materialCache = new Map();

function loadGltf(path) {
  if (!gltfCache.has(path)) {
    gltfCache.set(
      path,
      gltfLoader.loadAsync(path).catch((e) => {
        gltfCache.delete(path);
        throw new Error(`Could not load model "${path}". Check the file exists in public/${path} (${e.message})`);
      }),
    );
  }
  return gltfCache.get(path);
}

export async function loadModel(path, opts = {}) {
  const gltf = await loadGltf(path);
  const model = SkeletonUtils.clone(gltf.scene);

  const hide = [].concat(opts.hide || []).map((s) => s.toLowerCase());
  model.traverse((o) => {
    if (hide.length && o.name && hide.some((h) => o.name.toLowerCase().includes(h))) o.visible = false;
    if (o.isMesh) {
      o.castShadow = opts.shadows !== false;
      o.receiveShadow = opts.shadows !== false;
      // Shared materials are cloned so changing one copy's color doesn't change all copies.
      if (o.material) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      if (o.isSkinnedMesh) o.frustumCulled = false;
    }
  });

  if (opts.turn) model.rotation.y = THREE.MathUtils.degToRad(opts.turn);

  // Measure (skinned meshes too) and scale.
  model.updateMatrixWorld(true);
  const box = visibleBox(model);
  const size = box.getSize(new THREE.Vector3());
  let scale = 1;
  if (opts.height) scale = opts.height / (size.y || 1);
  else if (opts.size) scale = opts.size / (Math.max(size.x, size.y, size.z) || 1);
  scale *= opts.scale ?? 1;
  model.scale.multiplyScalar(scale);

  // Feet on the ground, centered.
  if (opts.center !== false) {
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x * scale, -box.min.y * scale, -c.z * scale);
  }

  const holder = new THREE.Group();
  holder.name = path.split('/').pop().replace(/\.(glb|gltf)$/, '');
  holder.add(model);
  holder.userData.model = model;
  holder.animations = gltf.animations;
  holder.userData.size = size.clone().multiplyScalar(scale);

  if (opts.position) setPosition(holder, opts.position);
  if (opts.rotation) holder.rotation.y = THREE.MathUtils.degToRad(opts.rotation);
  if (opts.add !== false) world.add(holder);
  if (opts.physics) physics.add(holder, { ...opts, type: opts.physics });
  return holder;
}

// Box around visible parts only (hidden weapons etc. don't count).
function visibleBox(root) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let visible = true;
    for (let p = o; p && p !== root.parent; p = p.parent) if (!p.visible) visible = false;
    if (!visible) return;
    tmp.makeEmpty().expandByObject(o, o.isSkinnedMesh);
    box.union(tmp);
  });
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  return box;
}

function setPosition(object, p) {
  if (Array.isArray(p)) object.position.set(p[0], p[1], p[2]);
  else object.position.copy(p);
}

export async function loadTexture(path, { repeat, color = true } = {}) {
  const key = `${path}|${repeat}|${color}`;
  if (!textureCache.has(key)) {
    textureCache.set(
      key,
      textureLoader.loadAsync(path).then((t) => {
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        if (repeat) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          const r = Array.isArray(repeat) ? repeat : [repeat, repeat];
          t.repeat.set(r[0], r[1]);
        }
        return t;
      }),
    );
  }
  return textureCache.get(key);
}

// A folder with color.jpg (+ optional normal.jpg, arm.jpg = ao/roughness/metal) -> realistic material.
export async function loadMaterial(folder, { repeat = 1, color, roughness, metalness } = {}) {
  const key = `${folder}|${repeat}|${color}|${roughness}|${metalness}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const tryLoad = (file, isColor) => loadTexture(`${folder}/${file}`, { repeat, color: isColor }).catch(() => null);
  const [map, normalMap, arm] = await Promise.all([tryLoad('color.jpg', true), tryLoad('normal.jpg', false), tryLoad('arm.jpg', false)]);
  if (!map) throw new Error(`No color.jpg found in public/${folder}`);
  const mat = new THREE.MeshStandardMaterial({ map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm });
  mat.roughness = roughness ?? 1;
  mat.metalness = metalness ?? (arm ? 1 : 0);
  if (color) mat.color.set(color);
  materialCache.set(key, mat);
  return mat;
}

// Load several models at the start so there is no pause later.
export function preload(paths) {
  return Promise.all(paths.map((p) => loadGltf(p)));
}
