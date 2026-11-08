// The 3D world: renderer, scene, camera, sky, sun, fog and glow (bloom).
//   world.scene, world.camera, world.renderer, world.sun
//   world.add(object)            add to the scene
//   world.remove(object)         remove from the scene (and its physics body)
//   world.setSky('assets/hdri/sunset.hdr')   use a photo sky (HDRI) instead of the default sky
//   world.setSky('space')                    black space with stars (set the light with the Sky sliders)
//   world.setSky('default')                  back to the default sky
//   world.focus                  the point shadows follow (the player sets it)
// Sliders: "Sky" (time of day, clouds, fog) and "Graphics" (quality, glow).
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { tune } from './tuning.js';
import { physics } from './physics.js';

let S; // sky settings
let G; // graphics settings
let composer = null;
let bloomPass = null;
let pmrem = null;
let envTarget = null;
let lastSkyKey = '';
let lastQuality = '';
let hdriTexture = null;
let stars = null;
const skyScene = new THREE.Scene();
const _moon = new THREE.Color('#8fa8ff');
const _night = new THREE.Color('#3a4a80');
const _nightFog = new THREE.Color('#070b1a');
const _sunsetFog = new THREE.Color('#6d5a5a');

export const world = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000),
  renderer: null,
  sun: new THREE.DirectionalLight('#fff4e0', 3),
  ambient: new THREE.HemisphereLight('#cfe6ff', '#5b4a3a', 0.6),
  sky: new Sky(),
  focus: new THREE.Vector3(),

  init() {
    S = tune('Sky', {
      timeOfDay: { value: 14, min: 5, max: 21, step: 0.1 },
      sunDirection: { value: 200, min: 0, max: 360, step: 1 },
      clouds: { value: 0.4, min: 0, max: 1 },
      haze: { value: 2, min: 0, max: 20 },
      fogDistance: { value: 250, min: 20, max: 1000, step: 1 },
      sunBrightness: { value: 3, min: 0, max: 10 },
      skyLight: { value: 0.6, min: 0, max: 3 },
    });
    G = tune('Graphics', {
      quality: { value: 'high', options: ['low', 'medium', 'high'] },
      glow: { value: 0.3, min: 0, max: 3 },
      glowThreshold: { value: 2.5, min: 0, max: 10 },
      brightness: { value: 1, min: 0.2, max: 3 },
      showFPS: false,
    });

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(renderer.domElement);
    this.renderer = renderer;
    pmrem = new THREE.PMREMGenerator(renderer);

    this.camera.position.set(0, 5, 10);
    this.scene.add(this.camera);

    this.sky.scale.setScalar(2000);
    this.scene.add(this.sky);
    skyScene.add(new Sky()); // copy used to light the world
    // The sun disc is thousands of times brighter than the rest of the sky,
    // which makes the glow (bloom) wash out the whole screen. Cap it.
    // It's also too bright to show directly, and black at night: tame both.
    [this.sky, skyScene.children[0]].forEach((sky, i) => {
      const scale = '0.3';
      sky.material.fragmentShader = sky.material.fragmentShader.replace(
        'gl_FragColor = vec4( texColor, 1.0 );',
        `gl_FragColor = vec4( min( texColor * ${scale}, vec3( 4.0 ) ) + vec3( 0.003, 0.006, 0.018 ), 1.0 );`,
      );
      sky.material.needsUpdate = true;
    });

    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera;
    sc.left = -40;
    sc.right = 40;
    sc.top = 40;
    sc.bottom = -40;
    sc.near = 1;
    sc.far = 300;
    this.scene.add(this.sun, this.sun.target, this.ambient);
    this.scene.fog = new THREE.Fog('#c9dcef', 10, 250);

    window.addEventListener('resize', () => this.resize());
    this.applyQuality();
  },

  add(...objects) {
    for (const o of objects) this.scene.add(o);
    return objects[0];
  },

  remove(...objects) {
    for (const o of objects) {
      physics.remove(o);
      o.removeFromParent();
    }
  },

  async setSky(path = 'default') {
    if (stars) stars.visible = path === 'space';
    if (path === 'default') {
      hdriTexture = null;
      this.sky.visible = true;
      lastSkyKey = '';
      return;
    }
    if (path === 'space') {
      hdriTexture = 'space';
      this.sky.visible = false;
      this.scene.background = new THREE.Color('#03040c');
      stars ||= makeStars();
      stars.visible = true;
      this.scene.add(stars);
      if (envTarget) envTarget.dispose();
      envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
      this.scene.environment = envTarget.texture;
      this.scene.environmentIntensity = 0.35;
      lastSkyKey = 'space';
      return;
    }
    const tex = await new HDRLoader().loadAsync(path);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    hdriTexture = tex;
    this.sky.visible = false;
    this.scene.background = tex;
    if (envTarget) envTarget.dispose();
    envTarget = pmrem.fromEquirectangular(tex);
    this.scene.environment = envTarget.texture;
    lastSkyKey = 'hdri';
  },

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    composer?.setSize(w, h);
  },

  applyQuality() {
    const q = G.quality;
    lastQuality = q;
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, q === 'high' ? 2 : q === 'medium' ? 1.25 : 1));
    r.shadowMap.enabled = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.scene.traverse((o) => {
      if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
    });
    composer?.dispose();
    composer = null;
    if (q !== 'low') {
      const target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        type: THREE.HalfFloatType,
        samples: q === 'high' ? 4 : 0,
      });
      composer = new EffectComposer(r, target);
      composer.setPixelRatio(r.getPixelRatio());
      composer.addPass(new RenderPass(this.scene, this.camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), G.glow, 0.15, G.glowThreshold);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }
  },

  updateSky() {
    // Sun position from the time of day: 6:00 sunrise, 12:00 noon, 18:00 sunset.
    const elevation = Math.sin(((S.timeOfDay - 6) / 12) * Math.PI) * 65;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(S.sunDirection);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    const day = THREE.MathUtils.smoothstep(elevation, -4, 8);

    // At night the same light becomes soft blue moonlight from high up.
    const lightDir = sunDir.clone();
    if (day < 1) lightDir.y = THREE.MathUtils.lerp(0.8, Math.max(lightDir.y, 0.15), day);
    lightDir.normalize();
    this.sun.position.copy(this.focus).addScaledVector(lightDir, 100);
    this.sun.target.position.copy(this.focus);
    this.sun.intensity = S.sunBrightness * day + 1.6 * (1 - day);
    this.sun.color.setHSL(0.09, 0.6, 0.55 + 0.4 * THREE.MathUtils.smoothstep(elevation, 0, 30));
    this.sun.color.lerp(_moon, 1 - day);
    this.ambient.intensity = S.skyLight * (1.2 - 0.2 * day);
    this.ambient.color.set('#cfe6ff').lerp(_night, 1 - day);
    this.renderer.toneMappingExposure = G.brightness * (0.85 + 0.15 * day);

    const fog = this.scene.fog;
    fog.far = S.fogDistance;
    fog.near = S.fogDistance * 0.1;

    if (hdriTexture === 'space') {
      fog.color.set('#03040c');
      stars.position.copy(this.camera.position);
      this.sun.intensity = S.sunBrightness;
      this.sun.color.set('#ffffff');
      this.ambient.intensity = S.skyLight;
      this.ambient.color.set('#9fb0ff');
      this.renderer.toneMappingExposure = G.brightness;
      return;
    }
    if (hdriTexture) {
      fog.color.set('#cdd6e0').multiplyScalar(0.4 + 0.6 * day);
      return;
    }
    const key = [S.timeOfDay, S.sunDirection, S.clouds, S.haze].join();
    for (const sky of [this.sky, skyScene.children[0]]) {
      const u = sky.material.uniforms;
      u.sunPosition.value.copy(sunDir);
      u.turbidity.value = S.haze;
      u.rayleigh.value = 1 + (1 - day) * 2;
      u.cloudCoverage.value = S.clouds;
      u.cloudDensity.value = S.clouds * 0.8;
    }
    this.sky.material.uniforms.time.value = performance.now() / 1000;
    // Fog matches the sky near the horizon: pale blue by day, warm and dim at sunset, dark at night.
    const high = THREE.MathUtils.smoothstep(elevation, 2, 30);
    fog.color.setHSL(0.58, 0.45, 0.68).lerp(_sunsetFog, (1 - high) * 0.85).lerp(_nightFog, 1 - day);
    this.scene.background = null;

    // Re-light the world from the sky only when the sky changes.
    if (key !== lastSkyKey) {
      lastSkyKey = key;
      const copy = skyScene.children[0];
      copy.material.uniforms.showSunDisc.value = 0;
      copy.scale.setScalar(100);
      if (envTarget) envTarget.dispose();
      envTarget = pmrem.fromScene(skyScene, 0, 0.1, 200);
      this.scene.environment = envTarget.texture;
      this.scene.environmentIntensity = 0.15 + 0.85 * day;
    }
  },

  render() {
    if (G.quality !== lastQuality) this.applyQuality();
    this.updateSky();
    if (composer) {
      bloomPass.strength = G.glow;
      bloomPass.threshold = G.glowThreshold;
      composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  },
};

// Thousands of little dots on a huge sphere that follows the camera.
function makeStars() {
  const count = 4000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(900);
    pos.set([v.x, v.y, v.z], i * 3);
    c.setHSL(0.55 + Math.random() * 0.15, 0.5, 0.6 + Math.random() * 0.4).multiplyScalar(1 + Math.random() * 3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -1;
  return points;
}
