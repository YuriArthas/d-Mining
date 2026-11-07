from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
raw=root/'artifacts/district-bake/rgbm-top-down.npy'
original=np.load(raw)
# Keep the 8-bit HDR multiplier; quantize RGB to 31 steps in each multiplier
# range. This changes lighting precision, never atlas resolution or geometry.
pixels=original.copy()
pixels[:,:,:3]=np.rint(np.rint(original[:,:,:3]/255*31)/31*255).astype(np.uint8)
target=root/'public/assets/district-light.webp'
Image.fromarray(pixels).save(target,'WEBP',lossless=True,exact=True,method=6)
assert np.array_equal(np.asarray(Image.open(target).convert('RGBA')),pixels)
report=json.loads((root/'artifacts/district-bake/report.json').read_text())
decoded=pixels[:,:,:3].astype(np.float32)/255*pixels[:,:,3:4].astype(np.float32)/255*report['range']
reference=np.flipud(np.load(root/'artifacts/district-bake/radiance-reference.npz')['rgb'].astype(np.float32))
error=np.abs(decoded-reference)
report.update(encoding='RGBM RGB5 / M8, lossless WebP storage',rgbBits=5,multiplierBits=8,
 resource='public/assets/district-light.webp',resourceSha256=hashlib.sha256(target.read_bytes()).hexdigest(),resourceBytes=target.stat().st_size,
 decodedEncodingPixelsIdentical=True,encodingLosslessRelativeToBake=False,
 finishScript='tools/finish-district-bake.py',finishScriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 storageErrorAgainstFloat16Reference={'mean':float(error.mean()),'p99':float(np.quantile(error,.99)),'max':float(error.max())})
(root/'artifacts/district-light-asset.json').write_text(json.dumps(report,indent=2)+'\n')
(root/'public/assets/district-light.json').write_text(json.dumps({key:report[key] for key in ['encoding','range','size','lampCount','modelSha256','layoutSha256','resourceSha256']},separators=(',',':'))+'\n')
print(json.dumps({'bytes':target.stat().st_size,'range':report['range'],'error':report['maxQuantizationError']}))
