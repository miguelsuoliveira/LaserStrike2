// Camera that follows something.
//   cameraRig.follow(object, { mode: 'third' })
//   Modes:
//     'third'  behind the target, mouse turns the camera (click the game to lock the mouse, Esc to unlock)
//     'chase'  behind the target's back, turns with it (cars, planes, boats)
//     'first'  from the eyes (the player's model is hidden)
//     'top'    high above, looking down (top-down games)
//     'side'   from the side (2.5D platformers)
//     'fixed'  doesn't move; place world.camera yourself
//   cameraRig.yaw / cameraRig.pitch   where the camera looks (radians; negative pitch looks up)
//   cameraRig.forward()               flat direction the camera looks (for aiming)
//   cameraRig.aimAt(target)           turn the camera to look at a position or object (tests, cutscenes)
// Sliders: "Camera" (distance, height, mouse sensitivity, field of view).
import * as THREE from 'three';
import { world } from './world.js';
import { input } from './input.js';
import { physics } from './physics.js';
import { tune } from './tuning.js';
import { clamp } from './utils.js';

let C;
const _target = new THREE.Vector3();
const _want = new THREE.Vector3();
const _dir = new THREE.Vector3();

export const cameraRig = {
  target: null,
  mode: 'third',
  yaw: 0,
  pitch: 0.35,
  height: 1.6, // where on the target to look (meters above its position)
  shake: new THREE.Vector3(),

  init() {
    C = tune('Camera', {
      distance: { value: 6, min: 1, max: 40 },
      height: { value: 1.5, min: 0, max: 20 },
      mouseSensitivity: { value: 1, min: 0.1, max: 4 },
      fieldOfView: { value: 60, min: 30, max: 110, step: 1 },
      smoothing: { value: 12, min: 1, max: 40 },
      topDownHeight: { value: 18, min: 5, max: 80 },
      topDownAngle: { value: 65, min: 30, max: 90, step: 1 }, // 90 = straight down
      invertY: false,
    });
  },

  follow(object, { mode = 'third', height } = {}) {
    this.target = object;
    this.mode = mode;
    if (height !== undefined) this.height = height;
    if (object) this.yaw = object.rotation.y + Math.PI;
    input.wantsPointerLock = mode === 'third' || mode === 'first';
  },

  aimAt(target) {
    const to = new THREE.Vector3();
    if (target?.isObject3D) target.getWorldPosition(to);
    else if (Array.isArray(target)) to.fromArray(target);
    else to.copy(target);
    to.sub(world.camera.getWorldPosition(new THREE.Vector3()));
    this.yaw = Math.atan2(-to.x, -to.z);
    this.pitch = -Math.atan2(to.y, Math.hypot(to.x, to.z));
  },

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  },

  right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  },

  update(dt) {
    const cam = world.camera;
    if (cam.fov !== C.fieldOfView) {
      cam.fov = C.fieldOfView;
      cam.updateProjectionMatrix();
    }
    cam.position.sub(this.shake);
    this.shake.set(0, 0, 0);
    if (!this.target || this.mode === 'fixed') return;

    const sens = 0.0025 * C.mouseSensitivity;
    if (this.mode === 'third' || this.mode === 'first') {
      this.yaw -= input.mouse.dx * sens + input.look.x * dt * 2.5;
      this.pitch += (input.mouse.dy * sens + input.look.y * dt * 2) * (C.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, this.mode === 'first' ? -1.4 : -0.6, 1.3);
    }

    this.target.getWorldPosition(_target);
    _target.y += this.height;
    const k = 1 - Math.exp(-C.smoothing * dt);

    if (this.mode === 'third' || this.mode === 'chase') {
      if (this.mode === 'chase') {
        const want = this.target.rotation.y + Math.PI;
        let diff = want - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * Math.min(1, 4 * dt);
        this.pitch = 0.25;
      }
      _dir.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      const lookAt = _target.clone().add(new THREE.Vector3(0, C.height - 1.5, 0));
      let dist = C.distance;
      // Don't let walls get between the camera and the player.
      const hit = physics.raycast(lookAt, _dir, dist, { ignore: this.target });
      if (hit && !hit.object?.userData?.cameraIgnore) dist = Math.max(0.5, hit.distance - 0.3);
      _want.copy(lookAt).addScaledVector(_dir, dist);
      cam.position.lerp(_want, hit ? 1 : k);
      cam.lookAt(lookAt);
    } else if (this.mode === 'first') {
      cam.position.copy(_target);
      cam.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
    } else if (this.mode === 'top') {
      const back = C.topDownHeight / Math.tan(THREE.MathUtils.degToRad(Math.min(89.5, C.topDownAngle)));
      _want.set(_target.x, _target.y + C.topDownHeight, _target.z + back);
      cam.position.lerp(_want, k);
      cam.lookAt(_target);
      this.yaw = 0;
    } else if (this.mode === 'side') {
      _want.set(_target.x, _target.y + C.height, _target.z + C.distance * 2);
      cam.position.lerp(_want, k);
      cam.lookAt(_target.x, _target.y + C.height * 0.3, _target.z);
      this.yaw = 0;
    }
    world.focus.copy(_target);
  },

  // Called by the engine after update() to add screen shake.
  applyShake(amount) {
    if (amount <= 0) return;
    this.shake.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    world.camera.position.add(this.shake);
  },
};
