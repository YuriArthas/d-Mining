from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
raw=root/'artifacts/district-ao/ao.npy';baked=np.load(raw)
# AO is a 0.42 m low-frequency field; area-filter the 4K bake to a 2K scalar atlas.
pixels=np.asarray(Image.fromarray(baked).resize((2048,2048),Image.Resampling.BOX))
target=root/'public/assets/district-ao.webp'
Image.fromarray(pixels).save(target,'WEBP',quality=90,method=6)
decoded=np.asarray(Image.open(target).convert('L'));error=np.abs(decoded.astype(float)-pixels)*.55/255
assert np.isfinite(error).all() and np.quantile(error,.99)<.014
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report=json.loads((root/'artifacts/district-ao/report.json').read_text())
report.update(resource='public/assets/district-ao.webp',resourceSha256=sha(target),resourceBytes=target.stat().st_size,finishScript='tools/finish-district-ao.py',finishScriptSha256=sha(Path(__file__)),encoding='area-filtered 2048 grayscale WebP Q90; runtime single-channel R8',bakeSize=4096,size=2048,encodingLossless=False,aoFactorEncodingError={'mean':float(error.mean()),'p99':float(np.quantile(error,.99)),'max':float(error.max())},minimum=int(pixels.min()),maximum=int(pixels.max()),mean=float(pixels.mean()))
(root/'artifacts/district-ao-asset.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
