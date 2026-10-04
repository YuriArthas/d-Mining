"""Subset installed Noto Sans CJK Bold outlines for runtime extruded labels."""
import sys,json,re
from pathlib import Path
sys.path.insert(0,str(Path('.tools/fonttools').resolve()))
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
font=TTFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',fontNumber=2)
chars=set(chr(c) for c in range(32,127))
for p in [Path('src/game/content/themes.ts'),Path('src/game/content/layers.ts'),Path('src/game/world/SurfaceHub.ts'),Path('src/game/world/SurfaceAssetPlan.ts'),Path('src/game/world/sceneryKit.ts')]:
 chars.update(re.findall(r'[\u4e00-\u9fff]',p.read_text()))
cmap=font.getBestCmap();glyphset=font.getGlyphSet();glyphs={}
class Pen(BasePen):
 def __init__(self):super().__init__(glyphset);self.parts=[];self.start=None
 def emit(self,op,*points):self.parts.append(op+' '+' '.join(str(round(v,3)) for p in points for v in p))
 def _moveTo(self,p):self.start=p;self.emit('m',p)
 def _lineTo(self,p):self.emit('l',p)
 def _curveToOne(self,a,b,c):self.emit('b',c,a,b)
 def _qCurveToOne(self,a,b):self.emit('q',b,a)
 def _closePath(self):self.emit('l',self.start)
 def _endPath(self):pass
for c in sorted(chars):
 if ord(c) not in cmap:continue
 name=cmap[ord(c)];pen=Pen();glyphset[name].draw(pen)
 glyphs[c]={'ha':font['hmtx'][name][0],'x_min':0,'x_max':font['hmtx'][name][0],'o':' '.join(pen.parts)}
head=font['head'];data={'glyphs':glyphs,'familyName':'Noto Sans CJK SC Bold (Mining subset)','ascender':font['hhea'].ascent,'descender':font['hhea'].descent,'underlinePosition':-100,'underlineThickness':50,'boundingBox':{'yMin':head.yMin,'yMax':head.yMax,'xMin':head.xMin,'xMax':head.xMax},'resolution':head.unitsPerEm,'original_font_information':{'license':'SIL Open Font License 1.1','source':'Noto Sans CJK SC Bold'}}
Path('src/game/assets/sign-font.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print('Sign font glyphs:',len(glyphs))
