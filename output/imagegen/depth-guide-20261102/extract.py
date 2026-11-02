from PIL import Image,ImageDraw
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[3]
source=Path(__file__).with_name('concept.png')
im=Image.open(source).convert('RGBA')
# Image 2.5's second row contains the fully illuminated medallions. Crop art, retain alpha outside the round rim.
assets=[]
for name,x,y,r in [('chest',332,455,70),('coin',571,455,70),('crystal',803,455,70),('ember',1274,152,68),('amethyst',1504,152,68)]:
 tile=im.crop((x-r,y-r,x+r,y+r));mask=Image.new('L',tile.size);ImageDraw.Draw(mask).ellipse((1,1,r*2-2,r*2-2),fill=255);tile.putalpha(mask)
 path=root/'src/game/assets/hud'/f'depth-{name}.webp';tile.resize((96,96),Image.Resampling.LANCZOS).save(path,lossless=True)
 assets.append({'path':str(path.relative_to(root)),'size':[96,96],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
Path(__file__).with_name('manifest.json').write_text(json.dumps({'model':'gpt-image-2.5','mode':'authorized imagegen CLI API','prompt':'prompt.txt','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'assets':assets},indent=2)+'\n')
