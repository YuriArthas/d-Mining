"""Prepare the API-generated raster; preserve its alpha and record provenance."""
from PIL import Image
from pathlib import Path
import hashlib,json
source=Path('output/imagegen/guide-arrow/roblox-arrow-source.png')
target=Path('src/game/assets/guide-arrow/roblox-arrow-v1.webp')
im=Image.open(source).convert('RGBA')
# The API returned an alpha cutout. Crop empty margin, retain original edge alpha.
bounds=im.getchannel('A').point(lambda a: 255 if a>=16 else 0).getbbox()
assert bounds
im=im.crop((bounds[0]-2,bounds[1]-2,bounds[2]+2,bounds[3]+2))
im.thumbnail((512,1536),Image.Resampling.LANCZOS)
im.save(target,format='WEBP',quality=95,method=6)
left,top,right,bottom=bounds
crop_w=right-left+4;crop_h=bottom-top+4
# The two cuts lie on the straight shaft, retaining the complete authored head and tail.
head_pixels=510-(top-2);tail_pixels=(bottom+2)-1390
metadata={
 'generator':'imagegen skill CLI / Images API','model':'gpt-image-2',
 'prompt':'docs/art/guide-arrow/prompt.txt','source':str(source),'runtime':str(target),
 'alpha':'preserved from API response; no procedural replacement',
 'crop':list(bounds),'size':list(im.size),'bytes':target.stat().st_size,
 'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'headV':1-head_pixels/crop_h,'tailV':tail_pixels/crop_h,
 'headAspect':head_pixels/crop_w,'tailAspect':tail_pixels/crop_w,
}
Path('src/game/assets/guide-arrow/layout.json').write_text(json.dumps({k:metadata[k] for k in ['headV','tailV','headAspect','tailAspect']},indent=2)+'\n')
Path('docs/art/guide-arrow/asset.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(metadata,indent=2))
