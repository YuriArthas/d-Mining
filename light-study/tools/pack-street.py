"""Build the street's complete asset set without changing geometry or pixels."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/assets'
OUTPUT = ROOT / '.packed/assets'
if OUTPUT.parent.exists():
    shutil.rmtree(OUTPUT.parent)
(OUTPUT / 'materials').mkdir(parents=True)
records = []


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def webp(source, target):
    with Image.open(source) as image:
        image.save(target, 'WEBP', lossless=True, exact=True, method=6)
        with Image.open(target) as decoded:
            if image.size != decoded.size or image.convert('RGBA').tobytes() != decoded.convert('RGBA').tobytes():
                raise ValueError(f'Lossless pixel validation failed: {source}')
    records.append({'source': str(source.relative_to(ROOT)), 'sourceSha256': sha(source),
                    'file': str(target.relative_to(OUTPUT.parent)), 'sha256': sha(target),
                    'bytes': target.stat().st_size, 'decodedPixelsIdentical': True})


for name in ['district.glb.br', 'district-layout.json', 'district-light.webp', 'district-light.json']:
    shutil.copyfile(SOURCE / name, OUTPUT / name)

manifest = json.loads((SOURCE / 'materials/materials.json').read_text())
overrides = manifest['variants']['crafted']['materials']
# Keep authored scalar material values; omit the unavailable baseline maps.
for name in overrides:
    manifest['materials'][name].pop('maps', None)
maps = {}
for material in [*manifest['materials'].values(), *overrides.values()]:
    for record in material.get('maps', {}).values():
        source = SOURCE / 'materials' / record['file']
        target = OUTPUT / 'materials' / source.with_suffix('.webp').name
        if target.name not in maps:
            webp(source, target)
            maps[target.name] = target.stat().st_size
        record.update(file=target.name, sha256=sha(target), bytes=target.stat().st_size)
manifest['availableProfiles'] = ['crafted']
budget = {**manifest['variantBudgets']['crafted'], 'textureCount': len(maps), 'downloadBytes': sum(maps.values())}
manifest['budget'] = budget
manifest['variantBudgets'] = {'crafted': budget}
(OUTPUT / 'materials/materials.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')
(ROOT / 'artifacts/street-packed.json').write_text(json.dumps({
    'method': 'Lossless WebP; only the crafted profile; GLB stored once using HTTP Brotli content coding',
    'sourceManifestSha256': sha(SOURCE / 'materials/materials.json'),
    'packedManifestSha256': sha(OUTPUT / 'materials/materials.json'),
    'scriptSha256': sha(Path(__file__)), 'textures': records,
}, indent=2) + '\n')
(OUTPUT.parent / 'DEPLOY.txt').write_text(
    'Complete district release; 5 MB is a reference target, not a hard limit.\n'
    'Serve assets/district.glb from assets/district.glb.br with Content-Type: model/gltf-binary, '
    'Content-Encoding: br and Vary: Accept-Encoding. No uncompressed model file is needed.\n'
    'The w-sunjun-public Node server implements this in server/static-file.mjs, including '
    'streamed identity responses for clients that refuse Brotli, and HEAD requests.\n'
    'Serve all other files normally. There are no external CDN asset dependencies.\n'
    'Original Blender sources, bake evidence and rollback archives are development records, '
    'not files required to load or render this release.\n'
)
print(f'Packed street: {len(maps)} material maps, {sum(maps.values())} bytes; all decoded pixels identical.')
