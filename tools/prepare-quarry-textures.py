"""Rebase existing high-quality UASTC mip chains without recompressing their pixels."""
import json, struct, sys
from pathlib import Path


def read_glb(path):
    blob = path.read_bytes()
    length = struct.unpack_from('<I', blob, 12)[0]
    return json.loads(blob[20:20+length]), blob[28+length:]


def texture_source(document, index):
    return document['textures'][index]['extensions']['KHR_texture_basisu']['source']


def rebase_ktx(blob, dimension):
    assert blob[:12] == bytes.fromhex('ab4b5458203230bb0d0a1a0a')
    header = list(struct.unpack_from('<13I2Q', blob, 12))
    width, height, levels = header[2], header[3], header[7]
    assert width == height and header[8] == 2  # square UASTC, independent Zstd levels
    skip = 0
    while width > dimension:
        width //= 2
        skip += 1
    assert width == dimension and skip < levels
    entries = [struct.unpack_from('<3Q', blob, 80+i*24) for i in range(levels)][skip:]
    header[2] = header[3] = dimension
    header[7] = len(entries)
    result = bytearray(80+24*len(entries))
    # Relocate DFD/KVD/SGD metadata. UASTC has no shared supercompression data.
    for offset_index, length_index in [(9,10),(11,12),(13,14)]:
        offset, length = header[offset_index], header[length_index]
        if length:
            # DFD and KVD must be adjacent; SGD/level payloads are 8 aligned.
            if offset_index == 13:
                result.extend(b'\0'*(-len(result)%8))
            header[offset_index] = len(result)
            result.extend(blob[offset:offset+length])
        else:
            header[offset_index] = 0
    # KTX2 stores the smallest level first in the file, while the index remains
    # ordered level 0 (largest) through the smallest mip.
    for i in reversed(range(len(entries))):
        offset, length, uncompressed = entries[i]
        struct.pack_into('<3Q', result, 80+i*24, len(result), length, uncompressed)
        result.extend(blob[offset:offset+length])
    result[:12] = blob[:12]
    struct.pack_into('<13I2Q', result, 12, *header)
    return result


def prepare(name):
    base = Path('assets-source/quarry-v1') / name
    document, binary = read_glb(base / 'uastc.glb')
    assert len(document['buffers']) == 1
    replacements = {}
    for material in document['materials']:
        for reference, slot, dimension in [
            (material['pbrMetallicRoughness'], 'baseColorTexture', 512),
            (material, 'normalTexture', 256),
            (material['pbrMetallicRoughness'], 'metallicRoughnessTexture', 128),
        ]:
            if slot not in reference:
                continue
            image_index = texture_source(document, reference[slot]['index'])
            view_index = document['images'][image_index]['bufferView']
            view = document['bufferViews'][view_index]
            offset = view.get('byteOffset',0)
            replacements[view_index] = rebase_ktx(binary[offset:offset+view['byteLength']], dimension)
    output = bytearray()
    for index, view in enumerate(document['bufferViews']):
        offset = view.get('byteOffset',0)
        data = replacements.get(index, binary[offset:offset+view['byteLength']])
        output.extend(b'\0'*(-len(output)%4))
        view['byteOffset'], view['byteLength'] = len(output), len(data)
        output.extend(data)
    document['buffers'][0]['byteLength'] = len(output)
    output.extend(b'\0'*(-len(output)%4))
    metadata = json.dumps(document,separators=(',',':')).encode()
    metadata += b' '*(-len(metadata)%4)
    blob = struct.pack('<III',0x46546C67,2,28+len(metadata)+len(output)) + struct.pack('<II',len(metadata),0x4E4F534A) + metadata + struct.pack('<II',len(output),0x004E4942) + output
    (base/'residency.glb').write_bytes(blob)
    print(name,'color=512, normal=256, ORM=128; original encoded mip payloads preserved',flush=True)


if __name__ == '__main__':
    for name in sys.argv[1:]:
        prepare(name)
