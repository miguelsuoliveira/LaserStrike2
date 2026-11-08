// Put things in a character's hand, on its head or back.
//   const torch = await loadModel('assets/models/dungeon/torch_lit.glb', { size: 0.6, add: false });
//   attach(player, torch, { to: 'left hand', upright: true });
//   attach(player, sword, { to: 'right hand', position: [0, 0.1, 0], rotation: [0, 0, 90] });
//   attach(enemy, hat, { to: 'head', position: [0, 0.25, 0] });
//   detach(torch)
// `to`: 'right hand' | 'left hand' | 'head' | 'back' | any bone name (dots don't matter: 'handslot.r' = 'handslotr').
// `size` of the item stays in meters even if the character is scaled.
// upright: true keeps it pointing up whatever the hand does (torches, lanterns, flags).
// position (meters) and rotation (degrees) nudge it; check with `npm run snap -- --zoom 2`.
import * as THREE from 'three';

const attached = new Set();

const ALIASES = {
  'right hand': ['handslot.r', 'hand.r', 'handr', 'palm2.r', 'righthand', 'mixamorigrighthand', 'hand_r', 'r_hand', 'wrist.r'],
  'left hand': ['handslot.l', 'hand.l', 'handl', 'palm2.l', 'lefthand', 'mixamoriglefthand', 'hand_l', 'l_hand', 'wrist.l'],
  head: ['head', 'mixamorighead', 'neck'],
  back: ['chest', 'spine2', 'spine1', 'spine', 'torso', 'mixamorigspine2', 'body'],
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Finds a bone (or any part) by name, ignoring dots, spaces and capitals.
export function findBone(target, name) {
  const root = target.object || target;
  const wanted = (ALIASES[name] || [name]).map(norm);
  for (const w of wanted) {
    let found = null;
    root.traverse((o) => {
      if (!found && norm(o.name) === w) found = o;
    });
    if (found) return found;
  }
  return null;
}

export function attach(target, item, { to = 'right hand', position = [0, 0, 0], rotation = [0, 0, 0], upright = false } = {}) {
  const bone = findBone(target, to);
  if (!bone) {
    const names = [];
    (target.object || target).traverse((o) => o.isBone && names.push(o.name));
    throw new Error(`attach(): no "${to}" found. Bones: ${names.join(', ') || 'none (this model has no skeleton)'}`);
  }
  item.removeFromParent();
  bone.add(item);
  // Undo the bone's scale so the item keeps its real size.
  bone.updateWorldMatrix(true, false);
  const s = new THREE.Vector3();
  bone.getWorldScale(s);
  item.scale.divide(s);
  item.position.set(position[0], position[1], position[2]).divide(s);
  item.rotation.set(...rotation.map((d) => THREE.MathUtils.degToRad(d)));
  item.userData.attach = { bone, upright, rotation: item.quaternion.clone() };
  item.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  attached.add(item);
  return item;
}

export function detach(item) {
  attached.delete(item);
  item.removeFromParent();
}

const _q = new THREE.Quaternion();
const _parent = new THREE.Quaternion();
const _yaw = new THREE.Quaternion();
const _e = new THREE.Euler();

// Runs every frame after animations: keeps upright items upright.
export function updateAttachments() {
  for (const item of attached) {
    const a = item.userData.attach;
    if (!item.parent) {
      attached.delete(item);
      continue;
    }
    if (!a.upright) continue;
    a.bone.updateWorldMatrix(true, false);
    a.bone.getWorldQuaternion(_parent);
    // World rotation we want: only the character's turn (yaw) plus the item's own rotation.
    _e.setFromQuaternion(_parent, 'YXZ');
    _yaw.setFromEuler(_e.set(0, _e.y, 0));
    _q.copy(_parent).invert().multiply(_yaw).multiply(a.rotation);
    item.quaternion.copy(_q);
  }
}
