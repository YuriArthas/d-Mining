import {createHash} from 'node:crypto';

export function readGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw Error('Expected GLB v2');
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binary = bytes.subarray(28 + jsonLength, 28 + jsonLength + bytes.readUInt32LE(20 + jsonLength));
  return {document, binary};
}

export function viewBytes(binary, view) {
  return binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}

// Texture transport changes must not invalidate a geometry-only shadow bake.
export function geometryHash(bytes) {
  const {document, binary} = readGlb(bytes);
  const imageViews = new Set((document.images ?? []).map(image => image.bufferView));
  const hash = createHash('sha256');
  hash.update(JSON.stringify([document.meshes, document.accessors, document.nodes, document.scenes, document.scene]));
  for (const [index, original] of document.bufferViews.entries()) {
    if (imageViews.has(index)) continue;
    const view = structuredClone(original);
    delete view.byteOffset;
    const packed = view.extensions?.EXT_meshopt_compression;
    if (packed) delete packed.byteOffset;
    hash.update(JSON.stringify([index, view]));
    if (original.buffer === 0) hash.update(viewBytes(binary, original));
    const compression = original.extensions?.EXT_meshopt_compression;
    if (compression?.buffer === 0) hash.update(viewBytes(binary, compression));
  }
  return hash.digest('hex');
}

export function replaceImages(bytes, replacements) {
  const {document, binary} = readGlb(bytes);
  const replacementViews = new Map([...replacements].map(([index, image]) => [document.images[index].bufferView, image]));
  const blocks = [], pointers = new Map();
  let length = 0;
  const relocate = (view, replacement) => {
    if (view.buffer !== 0) return;
    const key = `${view.byteOffset ?? 0}:${view.byteLength}`;
    let target = pointers.get(key);
    if (!target) {
      const data = replacement ?? viewBytes(binary, view);
      const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
      data.copy(padded);
      target = {offset:length, length:data.length};
      pointers.set(key, target);
      blocks.push(padded);
      length += padded.length;
    }
    view.byteOffset = target.offset;
    view.byteLength = target.length;
  };
  for (const [index, view] of document.bufferViews.entries()) {
    relocate(view, replacementViews.get(index));
    if (view.extensions?.EXT_meshopt_compression) relocate(view.extensions.EXT_meshopt_compression);
  }
  document.buffers[0].byteLength = length;
  const json = Buffer.from(JSON.stringify(document));
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
  json.copy(paddedJson);
  const output = Buffer.alloc(28 + paddedJson.length + length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedJson.length, 12); output.writeUInt32LE(0x4e4f534a, 16); paddedJson.copy(output, 20);
  output.writeUInt32LE(length, 20 + paddedJson.length); output.writeUInt32LE(0x004e4942, 24 + paddedJson.length);
  Buffer.concat(blocks).copy(output, 28 + paddedJson.length);
  if (geometryHash(output) !== geometryHash(bytes)) throw Error('Texture replacement changed geometry');
  return output;
}
