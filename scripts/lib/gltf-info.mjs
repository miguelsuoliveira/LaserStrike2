// Reads a .glb / .gltf file without a browser: size in meters (rest pose),
// triangles, textures, skeleton, part names and animation names.
//   gltfInfo(file)                 fast and synchronous. Decodes meshopt files (Objaverse, remix output);
//                                  Draco files (Smithsonian scans) get their size from the bounds stored in the file.
//   await gltfInfoDecoded(file)    same result, but decodes Draco first (exact size).
import fs from 'node:fs';
import path from 'node:path';

const COMPRESSION = ['EXT_meshopt_compression', 'KHR_meshopt_compression', 'KHR_draco_mesh_compression'];

// The meshopt decoder works synchronously once loaded.
let meshopt = null;
try {
  const { MeshoptDecoder } = await import('meshoptimizer');
  await MeshoptDecoder.ready;
  meshopt = MeshoptDecoder;
} catch {
  // not installed: compressed files fall back to the bounds stored in the file
}

function readGltf(file) {
  const buf = fs.readFileSync(file);
  if (file.toLowerCase().endsWith('.gltf')) {
    const json = JSON.parse(buf.toString('utf8'));
    const buffers = (json.buffers || []).map((b) => {
      if (!b.uri) return null;
      if (b.uri.startsWith('data:')) return Buffer.from(b.uri.split(',')[1], 'base64');
      const p = path.join(path.dirname(file), decodeURIComponent(b.uri));
      return fs.existsSync(p) ? fs.readFileSync(p) : null;
    });
    return { json, buffers, bytes: buf.length + buffers.reduce((s, b) => s + (b ? b.length : 0), 0) };
  }
  return parseGlb(buf);
}

function parseGlb(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file');
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buf.length) {
    const len = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const chunk = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    offset += 8 + len;
  }
  return { json, buffers: [bin], bytes: buf.length };
}

function imageSize(data) {
  if (!data || data.length < 24) return null;
  if (data[0] === 0x89 && data[1] === 0x50) return [data.readUInt32BE(16), data.readUInt32BE(20)];
  if (data[0] === 0xff && data[1] === 0xd8) {
    let i = 2;
    while (i < data.length) {
      if (data[i] !== 0xff) return null;
      const marker = data[i + 1];
      const len = data.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    const kind = data.toString('ascii', 12, 16);
    if (kind === 'VP8 ' && data.length >= 30) return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L' && data.length >= 25) {
      const b = data.readUInt32LE(21);
      return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
    }
    if (kind === 'VP8X' && data.length >= 30) return [data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1];
  }
  return null;
}

// Minimal 4x4 matrix helpers (column-major, like glTF).
function compose(t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

export function gltfInfo(file) {
  return infoFrom(readGltf(file), file);
}

// Decodes meshopt / Draco geometry first (through gltf-transform), so sizes are exact.
export async function gltfInfoDecoded(file) {
  const raw = readGltf(file);
  const used = raw.json.extensionsUsed || [];
  const needs = meshopt ? ['KHR_draco_mesh_compression'] : COMPRESSION;
  if (!used.some((e) => needs.includes(e))) return infoFrom(raw, file);
  const { gltfIO } = await import('./gltf-io.mjs');
  const io = await gltfIO();
  const doc = await io.read(file);
  for (const ext of doc.getRoot().listExtensionsUsed()) if (COMPRESSION.includes(ext.extensionName)) ext.dispose();
  const decoded = parseGlb(Buffer.from(await io.writeBinary(doc)));
  return { ...infoFrom(decoded, file), mb: raw.bytes / 1048576, extensions: used };
}

function infoFrom({ json, buffers, bytes }, file) {
  const acc = json.accessors || [];
  const meshes = json.meshes || [];
  const nodes = json.nodes || [];

  const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  // Reads an accessor into an array of numbers (normalized ints become 0..1).
  // The bytes of a buffer view (meshopt views are decoded; null if they can't be read).
  const views = new Map();
  const viewData = (index) => {
    if (views.has(index)) return views.get(index);
    const bv = json.bufferViews[index];
    const ext = bv.extensions?.EXT_meshopt_compression || bv.extensions?.KHR_meshopt_compression;
    let data = null;
    if (ext) {
      const src = buffers[ext.buffer];
      if (meshopt && src) {
        try {
          const target = new Uint8Array(ext.count * ext.byteStride);
          const source = new Uint8Array(src.buffer, src.byteOffset + (ext.byteOffset || 0), ext.byteLength);
          meshopt.decodeGltfBuffer(target, ext.count, ext.byteStride, source, ext.mode, ext.filter);
          data = Buffer.from(target.buffer, target.byteOffset, target.byteLength);
        } catch {
          data = null;
        }
      }
    } else {
      const b = buffers[bv.buffer || 0];
      const fallback = json.buffers?.[bv.buffer || 0]?.extensions?.EXT_meshopt_compression?.fallback;
      if (b && !fallback) data = b.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    }
    views.set(index, data);
    return data;
  };
  const read = (index) => {
    const a = acc[index];
    const n = SIZES[a.type];
    const out = new Array(a.count * n).fill(0);
    if (a.bufferView === undefined) return out;
    const bv = json.bufferViews[a.bufferView];
    const b = viewData(a.bufferView);
    if (!b) return out;
    const size = BYTES[a.componentType];
    const stride = bv.byteStride || size * n;
    const base = a.byteOffset || 0;
    const get = {
      5120: (o) => b.readInt8(o) / (a.normalized ? 127 : 1),
      5121: (o) => b.readUInt8(o) / (a.normalized ? 255 : 1),
      5122: (o) => b.readInt16LE(o) / (a.normalized ? 32767 : 1),
      5123: (o) => b.readUInt16LE(o) / (a.normalized ? 65535 : 1),
      5125: (o) => b.readUInt32LE(o),
      5126: (o) => b.readFloatLE(o),
    }[a.componentType];
    for (let i = 0; i < a.count; i++)
      for (let k = 0; k < n; k++) out[i * n + k] = get(base + i * stride + k * size);
    return out;
  };
  // Draco data (and meshopt without the decoder) can't be read here.
  const hasData = (index) => {
    const a = acc[index];
    return !!a && a.bufferView !== undefined && !!viewData(a.bufferView);
  };
  // The corners of an accessor's stored min/max box (quantized values scaled like three.js does).
  const boundsCorners = (index) => {
    const a = acc[index];
    if (!a?.min || !a?.max) return [];
    const scale = a.normalized ? 1 / ({ 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] || 1) : 1;
    const lo = a.min.map((v) => v * scale);
    const hi = a.max.map((v) => v * scale);
    const out = [];
    for (let c = 0; c < 8; c++) out.push([c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]]);
    return out;
  };

  // Triangles per mesh.
  const meshTris = meshes.map((m) =>
    m.primitives.reduce((s, p) => {
      if (p.mode !== undefined && p.mode !== 4) return s;
      const count = p.indices !== undefined ? acc[p.indices].count : acc[p.attributes.POSITION]?.count || 0;
      return s + Math.floor(count / 3);
    }, 0),
  );

  // World-space bounding box of every vertex in the model's rest pose.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let tris = 0;
  const scene = json.scenes?.[json.scene ?? 0];
  const worldOf = [];
  const walk = (i, parent) => {
    const n = nodes[i];
    worldOf[i] = mul(parent, n.matrix || compose(n.translation, n.rotation, n.scale));
    for (const c of n.children || []) walk(c, worldOf[i]);
  };
  for (const r of scene?.nodes || []) walk(r, compose());
  const visit = (i) => {
    const n = nodes[i];
    const world = worldOf[i];
    if (n.mesh !== undefined) {
      tris += meshTris[n.mesh];
      // Skinned meshes are placed by their bones: sum of weight x (joint world x inverse bind).
      const skin = n.skin !== undefined ? json.skins[n.skin] : null;
      let jointMats = null;
      if (skin) {
        const ibm = skin.inverseBindMatrices !== undefined ? read(skin.inverseBindMatrices) : null;
        jointMats = skin.joints.map((j, k) => mul(worldOf[j], ibm ? ibm.slice(k * 16, k * 16 + 16) : compose()));
      }
      for (const p of meshes[n.mesh].primitives) {
        if (p.attributes.POSITION === undefined) continue;
        const needed = [p.attributes.POSITION];
        if (skin) needed.push(skin.inverseBindMatrices, p.attributes.JOINTS_0, p.attributes.WEIGHTS_0);
        if (needed.some((a) => a !== undefined && !hasData(a))) {
          // Rest pose = bind pose, so any joint's (world x inverse bind) places the box.
          const place = jointMats && hasData(skin.inverseBindMatrices) ? jointMats[0] : world;
          for (const pt of boundsCorners(p.attributes.POSITION)) {
            const w = apply(place, pt);
            for (let k = 0; k < 3; k++) {
              min[k] = Math.min(min[k], w[k]);
              max[k] = Math.max(max[k], w[k]);
            }
          }
          continue;
        }
        const pos = read(p.attributes.POSITION);
        const joints = jointMats && p.attributes.JOINTS_0 !== undefined ? read(p.attributes.JOINTS_0) : null;
        const weights = joints && p.attributes.WEIGHTS_0 !== undefined ? read(p.attributes.WEIGHTS_0) : null;
        for (let v = 0; v < pos.length / 3; v++) {
          const pt = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
          let w = [0, 0, 0];
          if (weights) {
            for (let k = 0; k < 4; k++) {
              const wt = weights[v * 4 + k];
              if (!wt) continue;
              const q = apply(jointMats[joints[v * 4 + k]], pt);
              w = [w[0] + q[0] * wt, w[1] + q[1] * wt, w[2] + q[2] * wt];
            }
          } else {
            w = apply(world, pt);
          }
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], w[k]);
            max[k] = Math.max(max[k], w[k]);
          }
        }
      }
    }
    for (const c of n.children || []) visit(c);
  };
  for (const r of scene?.nodes || []) visit(r);

  const anims = (json.animations || []).map((a) => {
    let dur = 0;
    for (const s of a.samplers) dur = Math.max(dur, acc[s.input]?.max?.[0] || 0);
    return { name: a.name || '(no name)', seconds: dur };
  });

  const textures = (json.images || []).map((img) => {
    let data = null;
    if (img.bufferView !== undefined) {
      data = viewData(img.bufferView);
    } else if (img.uri && !img.uri.startsWith('data:')) {
      const p = path.join(path.dirname(file), decodeURIComponent(img.uri));
      if (fs.existsSync(p)) data = fs.readFileSync(p);
    }
    const s = imageSize(data);
    return s ? `${s[0]}x${s[1]}` : '?';
  });

  const skins = json.skins || [];
  // three.js removes . : / [ ] from names and turns spaces into _ (handslot.r -> handslotr).
  const threeName = (n) => n.replace(/\s/g, '_').replace(/[[\].:/]/g, '');
  const bones = skins[0]?.joints.map((j) => threeName(nodes[j].name || `#${j}`)) || [];
  const parts = [...new Set(nodes.filter((n) => n.mesh !== undefined).map((n) => n.name).filter(Boolean).map(threeName))];
  return {
    file,
    mb: bytes / 1048576,
    size: max.map((v, k) => v - min[k]),
    min,
    max,
    triangles: tris,
    meshes: meshes.length,
    materials: (json.materials || []).length,
    textures,
    rigged: skins.length > 0,
    bones,
    parts,
    animations: anims,
    extensions: json.extensionsUsed || [],
  };
}
