"""Author small pixel grain atlas and UV emission masks; no new model generation."""
from pathlib import Path
from PIL import Image
import random,base64,json,struct,io,hashlib
ROOT=Path(__file__).resolve().parents[2];runtime=ROOT/'src/game/assets/ground-details';source=ROOT/'assets-source/quarry-v2/ground-details-blender'
rng=random.Random(20261005);atlas=Image.new('L',(128,128),128)
for tile in range(4):
 ox=(tile%2)*64;oy=(tile//2)*64;step=4 if tile==0 else 2
 for y in range(0,64,step):
  for x in range(0,64,step):
   v=rng.choices([102,116,128,140,154],[1,2,8,2,1])[0] if tile!=1 else rng.choices([114,122,128,136,145],[1,2,20,2,1])[0]
   for dy in range(step):
    for dx in range(step):atlas.putpixel((ox+x+dx,oy+y+dy),v)
# PNG is the editable/reference source; runtime is exact single-channel data, decoded once.
def save(name,im):
 im.save(source/(name+'.png'));p=runtime/(name+'.json');p.write_text(json.dumps({'size':im.width,'data':base64.b64encode(im.tobytes()).decode()},separators=(',',':')));return {'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':im.width}
items=[save('ground-atlas',atlas)]
for name in ['lantern-post','pit-box-lantern']:
 b=(ROOT/'assets-source/quarry-v2'/name/'model.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:]
 tex=g['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index'];im=g['images'][g['textures'][tex]['source']];v=g['bufferViews'][im['bufferView']];offset=v.get('byteOffset',0)
 color=Image.open(io.BytesIO(binary[offset:offset+v['byteLength']])).convert('RGB');mask=Image.new('L',color.size)
 # Cream panes only; warm timber and dark iron are excluded. Separate local height gate in shader excludes foundations.
 mask.putdata([round(255*max(0,min(1,(min(r,g)-165)/40))*max(0,min(1,(1.45-r/max(g,1))/.22))*max(0,min(1,(b-85)/45))) for r,g,b in color.getdata()])
 mask=mask.resize((128,128),Image.Resampling.LANCZOS);items.append(save(name+'-emission',mask))
(source/'textures.json').write_text(json.dumps({'generator':'authored Python/Pillow','script':'tools/blender/paint-ground-details.py','textures':items},indent=2))
