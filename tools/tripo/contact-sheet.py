from pathlib import Path
from PIL import Image,ImageDraw
import json,sys
names=json.loads(Path('src/game/world/CampExpansion.ts').read_text().split('EXPANSION_ASSETS=')[1].split(' as const;')[0])
files=[(n,Path('assets-source/quarry-v2')/n/'rendered.webp') for n in names]
files=[(n,p) for n,p in files if p.exists()]
for start in range(0,len(files),12):
 batch=files[start:start+12];out=Image.new('RGB',(1000,280*((len(batch)+3)//4)),'#eeeadd');d=ImageDraw.Draw(out)
 for i,(name,p) in enumerate(batch):
  im=Image.open(p).convert('RGBA');im.thumbnail((250,250));x=i%4*250;y=i//4*280;out.paste(im,(x,y),im);d.text((x+8,y+255),name,fill='black')
 out.save(f'artifacts/expansion-models-{start//12+1}.jpg')
print(len(files),'rendered model previews')
