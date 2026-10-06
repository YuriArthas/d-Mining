"""Author a small pixel-stone mask atlas. No photographic inputs or runtime noise.
R: albedo multiplier, G: shallow relief, B: soil pockets, A: edge loss.
Four 30x30 drawings, enlarged 4x with nearest sampling and a 4px gutter.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import base64
import hashlib
import json
import random

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src/game/assets/ground-details/road-stone.json'
atlas = Image.new('RGBA', (256, 256))
for variant in range(4):
    rng = random.Random(8407 + variant)
    tile = Image.new('RGBA', (30, 30), (128, 128, 0, 0))
    draw = ImageDraw.Draw(tile)
    # Large interlocking fracture faces; each has a stepped rather than soft edge.
    faces = [
        [(0, 0), (16, 0), (16, 4), (12, 4), (12, 7), (7, 7), (7, 10), (0, 10)],
        [(17, 3), (29, 3), (29, 17), (23, 17), (23, 14), (19, 14), (19, 9), (17, 9)],
        [(4, 12), (14, 12), (14, 15), (18, 15), (18, 21), (12, 21), (12, 24), (4, 24)],
        [(0, 25), (9, 25), (9, 28), (18, 28), (18, 29), (0, 29)],
        [(21, 22), (29, 22), (29, 29), (18, 29), (18, 26), (21, 26)],
    ]
    for i, polygon in enumerate(faces):
        value = [114, 141, 120, 144, 109][(i + variant) % 5]
        draw.polygon(polygon, fill=(value, 128 + (value - 128)//2, 0, 0))
    # Sparse feldspar inclusions and shallow pits. Keep most of each face quiet.
    for i in range(15):
        x, y = rng.randrange(2, 27), rng.randrange(2, 27)
        w, h = rng.randrange(1, 4), rng.randrange(1, 3)
        light = i % 4 == 0
        value = rng.choice([148, 154]) if light else rng.choice([98, 107, 117])
        draw.rectangle((x, y, x+w, y+h), fill=(value, 142 if light else 111, 0 if light else 45, 0))
    # Short irregular edge breaks, with soil below; no continuous green outline.
    for edge in range(4):
        if (variant + edge) % 3 == 0:
            continue
        start = rng.randrange(5, 23)
        length = rng.randrange(2, 5)
        for s in range(start, start+length):
            depth = 2 if s == start+1 else 1
            for d in range(depth):
                x, y = [(s,d), (29-d,s), (s,29-d), (d,s)][edge]
                tile.putpixel((x,y), (91, 75, 230, 255))
    tile = tile.transpose([Image.Transpose.ROTATE_90, Image.Transpose.ROTATE_180,
                           Image.Transpose.ROTATE_270, Image.Transpose.FLIP_LEFT_RIGHT][variant])
    face = tile.resize((120,120), Image.Resampling.NEAREST)
    padded = Image.new('RGBA',(128,128))
    padded.paste(face,(4,4))
    # Edge extrusion prevents other variants bleeding into the mip chain.
    for x in range(128):
        for y in range(128):
            if x < 4 or y < 4 or x >= 124 or y >= 124:
                padded.putpixel((x,y),face.getpixel((min(119,max(0,x-4)),min(119,max(0,y-4)))))
    atlas.paste(padded,((variant % 2)*128,(variant//2)*128))
raw = atlas.tobytes()
# Store the authored pixels once, not sixteen copies of each pixel.
encoded = atlas.resize((64,64), Image.Resampling.NEAREST).tobytes()
OUT.write_text(json.dumps({'size':256,'sourceSize':64,'channels':4,'sha256':hashlib.sha256(raw).hexdigest(),
                          'data':base64.b64encode(encoded).decode()},separators=(',',':'))+'\n')
preview = ROOT / 'artifacts/road-material'
preview.mkdir(parents=True, exist_ok=True)
atlas.getchannel('R').save(preview/'stone-albedo-mask.png')
print(json.dumps({'size':256,'variants':4,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}))
