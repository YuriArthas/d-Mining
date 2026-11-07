"""Pad atlas islands without altering covered visibility texels (Pillow/numpy)."""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
raw = root / 'artifacts/static-shadow-bake/raw.png'
a = np.asarray(Image.open(raw)).copy()
rgb, valid = a[:, :, :3].copy(), a[:, :, 3] > 0
original = valid.copy()
# Four texels separate islands. Extend 12 pixels into empty space, never average
# across islands or modify a covered pixel. The remaining empty atlas is white.
for iteration in range(12):
    previous = valid.copy()
    for dy, dx in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
        y, x = slice(max(0,dy), min(4096,4096+dy)), slice(max(0,dx), min(4096,4096+dx))
        sy, sx = slice(max(0,-dy), min(4096,4096-dy)), slice(max(0,-dx), min(4096,4096-dx))
        take = ~valid[y,x] & previous[sy,sx]
        rgb[y,x][take] = rgb[sy,sx][take]
        valid[y,x][take] = True
rgb[~valid] = 255
assert np.array_equal(rgb[original], a[:,:,:3][original])
resource = root / 'public/assets/street-shadow.png'
Image.fromarray(rgb).save(resource, optimize=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
deps = ['public/assets/street.glb','public/assets/street-layout.json','public/assets/materials/materials.json','src/lampShadow.ts','src/staticShadowBake.ts','src/streetModel.ts','src/streetLighting.ts','src/street.ts','src/materials.ts','tools/finish-street-shadow.py']
report = json.loads((root/'artifacts/static-shadow-bake/report.json').read_text())
provenance = dict(method='Public WebGPU PCSS visibility bake; RGB stores one static lantern each; 12px dilation; no lighting or BRDF baked',size=4096,channels=3,gpuBytes=4096*4096*4,dependencies={p:sha(root/p) for p in deps},rawSha256=sha(raw),resource='public/assets/street-shadow.png',resourceSha256=sha(resource),bakeReport='artifacts/static-shadow-bake/report.json',bakeReportSha256=sha(root/'artifacts/static-shadow-bake/report.json'),bundles=report['bundles'])
(root/'artifacts/street-shadow-asset.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(json.dumps(dict(bytes=resource.stat().st_size,sha256=sha(resource))))
