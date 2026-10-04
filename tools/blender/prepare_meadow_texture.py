"""Make the generated albedo periodic at its borders and export a small WebP."""
from PIL import Image
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
im=Image.open(root/'output/imagegen/sunvale-meadow-albedo.png').convert('RGB')
# Blend opposite strips into the same boundary value; preserve the authored center.
for _ in range(2):
 px=im.load();w,h=im.size
 for i in range(32):
  weight=.5*(1-i/32)**2
  for j in range(h):
   a,b=px[i,j],px[w-1-i,j]
   px[i,j]=tuple(round(p*(1-weight)+q*weight) for p,q in zip(a,b))
   px[w-1-i,j]=tuple(round(q*(1-weight)+p*weight) for p,q in zip(a,b))
 im=im.transpose(Image.Transpose.TRANSPOSE)
p=root/'src/game/assets/meadow-albedo.webp';im.save(p,quality=88,method=6)
lookup=[v/255/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4 for v in range(256)]
hist=im.histogram();mean=[sum(hist[i+c*256]*lookup[i] for i in range(256))/(im.width*im.height) for c in range(3)]
print(json.dumps({'bytes':p.stat().st_size,'meanLinear':mean}))

# The same authored paths as Blender, rasterized as a soft material mask rather
# than floating strips of geometry. Catmull-Rom interpolation keeps turns smooth.
import ast, math
from PIL import ImageDraw, ImageFilter
source=ast.parse((root/'tools/blender/build_valley.py').read_text())
trails=next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='TRAILS' for t in n.targets))
mask=Image.new('L',(1024,1024));draw=ImageDraw.Draw(mask)
for points,width in trails:
 points=[points[0]]+points+[points[-1]];curve=[]
 for i in range(1,len(points)-2):
  p0,p1,p2,p3=points[i-1:i+3]
  for j in range(25):
   t=j/24
   pos=[.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(2)]
   curve.append(tuple((v+72)/144*1024 for v in pos))
 draw.line(curve,fill=255,width=round(width/144*1024),joint='curve')
 r=width/144*1024*.5
 for x,y in (curve[0],curve[-1]):draw.ellipse((x-r,y-r,x+r,y+r),fill=255)
mask.filter(ImageFilter.GaussianBlur(1.8)).save(root/'src/game/assets/path-mask.png',optimize=True)
