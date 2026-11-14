// One place to read and write glTF/GLB files with gltf-transform.
// Understands every extension three.js loads, including compressed files:
// meshopt (Objaverse, our own output) and Draco (Smithsonian scans).
//   const io = await gltfIO();  const doc = await io.read(file);  await io.write(out, doc);
//   await writeCompact(out, doc)   writes a small GLB: geometry compressed with meshopt
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRDracoMeshCompression } from '@gltf-transform/extensions';

let ioPromise = null;

export function gltfIO() {
  ioPromise ??= (async () => {
    const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
    const draco3d = (await import('draco3dgltf')).default;
    await MeshoptDecoder.ready;
    await MeshoptEncoder.ready;
    return new NodeIO()
      .setLogger(new Logger(Logger.Verbosity.WARN))
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({
        'meshopt.decoder': MeshoptDecoder,
        'meshopt.encoder': MeshoptEncoder,
        'draco3d.decoder': await draco3d.createDecoderModule(),
      });
  })();
  return ioPromise;
}

// Drop Draco (the engine doesn't load it) and save with meshopt geometry compression,
// which the engine's loader decodes.
export async function writeCompact(outPath, doc) {
  const io = await gltfIO();
  const { reorder, quantize } = await import('@gltf-transform/functions');
  const { MeshoptEncoder } = await import('meshoptimizer');
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === KHRDracoMeshCompression.EXTENSION_NAME)?.dispose();
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(outPath, doc);
}
