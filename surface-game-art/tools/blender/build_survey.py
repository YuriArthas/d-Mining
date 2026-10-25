"""遗迹勘探站 hall props (world 2, layer 4): the world 2 base kit (tech_props.py, gold accent) and an ancient temple in
chunky sandstone blocks: the temple front for the north wall, the round glyph door and its turning glyph, a seated
statue, whole and broken pillars, rubble blocks; and the colony's survey gear: a white scaffold tower with yellow
rails and a yellow lattice lamp tower. The floor, rail and glow halos come from tools/underground/surveyHall.ts.
Run: blender -b --python tools/blender/build_survey.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import finish, model, box, prism, circle
from tech_props import tech_start, tech_services, bevel_box, ring_segments

ACCENT = ('b88214', 'c89420')  # deep gold
TILES = [
    ('d6b47a', [(0, 14, 32, 2, 'b89458'), (15, 0, 2, 14, 'b89458'), (2, 2, 28, 2, 'e4c48c')]),          # 20 sandstone blocks
    ('b8935c', [(0, 20, 32, 2, 'a07e4a'), (9, 0, 2, 20, 'a07e4a'), (24, 22, 2, 10, 'a07e4a')]),         # 21 sandstone shade
    ('c9a46a', [(5, 6, 6, 4, '8e6c3e'), (16, 6, 10, 2, '8e6c3e'), (5, 16, 18, 2, '8e6c3e'), (20, 22, 6, 6, '8e6c3e')]),  # 22 carved glyphs
    ('143a5c', [(0, 0, 3, 32, '1c4c72'), (29, 0, 3, 32, '1c4c72')]),                                    # 23 deep teal-blue banner
    ('0a6e80', [(6, 6, 20, 20, '1088a0')]),                                                             # 24 glow cyan (deep)
    ('d9a032', [(3, 3, 26, 3, 'f0bc4a'), (3, 26, 26, 3, 'b8822a')]),                                    # 25 gold trim
    ('7a5a40', [(4, 6, 12, 4, '8a6a4c'), (18, 20, 10, 6, '6a4c34')]),                                   # 26 rubble rock
    ('4e3824', [(4, 14, 24, 2, '5e4430'), (14, 4, 2, 24, '5e4430')]),                                   # 27 dark carved stone (door disc)
]
tech_start('Survey', 'survey', ACCENT, TILES, glowing={24})
tech_services()

def slab(name, at, size, t, q=.06):
    """A carved block: a box with its vertical edges cut a little (weathered)."""
    return bevel_box(name, at, size, t, q)

# TEMPLE FRONT on the north wall (front +Z, its back at local z = -.3), 19.2 m wide and 20 m tall: courses of
# sandstone blocks over a dark back wall, two stepped pylons with cyan slits, teal banners with gold glyphs, a
# stepped lintel and three broad steps at its foot. It hides the voxel wall behind the glyph door.
model('Survey_Facade')
box('Wall', (0, 10, 0), (17.4, 20, .6), 21)
widths = (2.4, 3.1, 2.2, 2.9, 2.6, 3.3, 2.0)
for row, y in enumerate((1.6, 3.4, 5.2, 7.0, 16.0, 17.8)):
    x = -8.1 + (row % 2) * .9
    k = row
    while x < 8.0:
        w = min(widths[k % len(widths)], 8.1 - x)
        if w > .4: slab('Course', (x + w / 2, y, .38), (w - .1, 1.7, .3), 20 if (k + row) % 3 else 22)
        x += w; k += 1
for side in (-1, 1):
    x = side * 8.9
    for i, (y, h) in enumerate(((1.2, 2.4), (3.9, 3.0), (7.0, 3.2), (10.3, 3.4), (13.8, 3.6), (17.4, 3.6))):
        slab('PylonBlock', (x, y, .5), (2.0 - i * .06, h - .08, 1.6), 20 if i % 2 else 21)
    box('PylonSlit', (x - side * .45, 9.5, 1.32), (.16, 9.0, .06), 24)
    box('PylonSlitLow', (x - side * .45, 2.6, 1.32), (.16, 2.2, .06), 24)
    # Teal banner with a gold eye glyph.
    box('Banner', (side * 6.3, 12.0, .42), (2.2, 6.6, .08), 23)
    box('BannerRod', (side * 6.3, 15.4, .5), (2.6, .16, .16), 25)
    prism('BannerRing', circle(.62, 12, side * 6.3, 13.0), .46, .5, 16, axis='z')
    prism('BannerEye', circle(.3, 10, side * 6.3, 13.0), .5, .54, 23, axis='z')
    box('BannerLine', (side * 6.3, 10.7, .48), (.16, 3.0, .06), 16)
for i, (w, y) in enumerate(((19.4, 19.0), (17.0, 18.0))):
    slab('Lintel', (0, y, .6 + i * .2), (w, 1.0, 1.2), 20 if i else 21)
for i in range(3):
    slab('Step', (0, .2 + i * .4, 1.6 - i * .5), (16.4 - i * 1.2, .4, 1.6), 20 if i % 2 else 21, .1)

# GLYPH DOOR (front +Z, centre at the origin): a ring of carved blocks with a keystone, a stone disc inside it and
# a glowing gold lip; the glyph itself turns (Glyph_Rotor).
model('Glyph_Door')
ring_segments('Ring', 4.6, 6.0, -.7, .7, 16, 20, gaps=(4,))
ring_segments('RingCarve', 5.0, 5.6, .7, .78, 16, 22, gaps=(4,))
slab('Keystone', (0, 6.1, 0), (1.8, 2.0, 1.7), 22)
prism('Disc', circle(4.62, 24), -.5, -.1, 27, axis='z')
ring_segments('Lip', 4.36, 4.62, -.1, .3, 24, 7)
for side in (-1, 1): slab('DoorFoot', (side * 5.0, -5.4, 0), (2.4, 1.6, 1.8), 21)
model('Glyph_Rotor')
ring_segments('GlyphRing', 1.0, 1.4, 0, .22, 16, 7)
prism('GlyphDot', circle(.5, 12), 0, .26, 16, axis='z')
for k in range(8):
    a = k * math.pi / 4
    c, s = math.cos(a), math.sin(a)
    r1 = 3.7 if k % 2 == 0 else 2.9
    prism('GlyphRay', [(1.8 * c - .16 * s, 1.8 * s + .16 * c), (r1 * c - .16 * s, r1 * s + .16 * c), (r1 * c + .16 * s, r1 * s - .16 * c), (1.8 * c + .16 * s, 1.8 * s - .16 * c)], 0, .22, 7, axis='z')
ring_segments('GlyphOuter', 3.95, 4.15, 0, .18, 24, 24, gaps=(2, 8, 14, 20))

# SEATED STATUE (front +Z), about 9.5 m: a stepped plinth, a seated body of big blocks, hands on the knees, a gold
# emblem on the chest, a head with a headdress and glowing cyan eyes (at local (+-.34, 7.15, .82)).
model('Statue')
slab('Plinth', (0, .7, 0), (3.6, 1.4, 3.2), 21, .2)
slab('PlinthTop', (0, 1.55, 0), (3.2, .3, 2.9), 20, .15)
slab('Seat', (0, 2.4, -.5), (2.8, 1.4, 2.0), 21)
slab('Knees', (0, 2.9, .7), (2.6, .9, 1.4), 20)
for side in (-1, 1):
    slab('Shin', (side * .65, 2.0, 1.25), (.9, 1.6, .7), 22)
    slab('Arm', (side * 1.45, 4.3, .0), (.75, 2.6, 1.0), 20)
    slab('Hand', (side * 1.0, 3.5, .95), (.8, .5, .9), 21)
slab('Torso', (0, 4.6, -.25), (2.3, 2.8, 1.5), 20)
slab('Belt', (0, 3.35, -.2), (2.4, .35, 1.6), 25)
prism('Emblem', circle(.5, 10, 0, 4.9), .5, .6, 25, axis='z')
prism('EmblemEye', circle(.22, 8, 0, 4.9), .6, .66, 24, axis='z')
slab('Neck', (0, 6.2, -.3), (.9, .5, .9), 21)
slab('Head', (0, 7.1, -.15), (1.6, 1.6, 1.6), 20)
slab('Headdress', (0, 8.1, -.25), (2.2, .7, 1.8), 22)
for side in (-1, 1): slab('Flap', (side * 1.0, 6.9, -.25), (.4, 2.0, 1.4), 22)
box('Brow', (0, 7.45, .67), (1.3, .18, .2), 21)
box('Nose', (0, 7.0, .72), (.24, .5, .2), 21)
for side in (-1, 1): box('Eye', (side * .34, 7.15, .7), (.3, .14, .12), 24)
box('Mouth', (0, 6.6, .67), (.6, .1, .12), 21)

# PILLARS: drums of sandstone on a base with a gold band and a cap (7.2 m); the broken one stops short under a
# cracked top block.
def pillar(name, drums, broken=False):
    model(name)
    slab('Base', (0, .4, 0), (2.0, .8, 2.0), 21, .14)
    y = .8
    for i in range(drums):
        h = 1.35
        prism('Drum', circle(.8 - i * .02, 8, 0, 0, math.pi / 8), y, y + h - .05, 20 if i % 2 else 21)
        y += h
    if broken:
        prism('Crack', [(-.7, -.3), (-.2, -.75), (.6, -.5), (.75, .2), (.2, .7), (-.6, .5)], y, y + .7, 22)
    else:
        prism('Band', circle(.86, 8, 0, 0, math.pi / 8), 3.4, 3.7, 25)
        slab('Cap', (0, y + .35, 0), (2.1, .7, 2.1), 20, .14)
pillar('Ruin_Pillar', 4)
pillar('Ruin_Pillar_Broken', 2, broken=True)

# RUBBLE: two or three fallen sandstone blocks.
model('Ruin_Block')
slab('Block', (0, .45, 0), (1.4, .9, 1.1), 20, .1)
slab('Block', (.9, .3, .5), (.9, .6, .8), 21, .08)
slab('Block', (.2, 1.05, .1), (.8, .4, .7), 22, .08)

# SURVEY SCAFFOLD (front +Z), 3 m wide, 2 m deep, 6.6 m tall: white posts and beams, braces, two plank decks with
# yellow rails at the front, an instrument box with a cyan screen and a lamp on top (light at (0, 6.95, .3)).
model('Scaffold')
for x in (-1.4, 1.4):
    for z in (-.9, .9): box('Post', (x, 3.3, z), (.16, 6.6, .16), 1)
for y in (.2, 3.2, 6.2):
    for z in (-.9, .9): box('Beam', (0, y, z), (3.0, .14, .14), 1)
    for x in (-1.4, 1.4): box('Beam', (x, y, 0), (.14, .14, 1.9), 1)
for y0, y1 in ((.2, 3.2), (3.2, 6.2)):
    for x0, x1 in ((-1.4, 1.4),):
        prism('Brace', [(x0, y0), (x0 + .12, y0), (x1, y1 - .12), (x1, y1)], .86, .94, 1, axis='z')
        prism('Brace', [(x0, y0), (x0 + .12, y0), (x1, y1 - .12), (x1, y1)], -.94, -.86, 1, axis='z')
for y in (3.2, 6.2):
    box('Deck', (0, y + .1, 0), (3.0, .08, 1.9), 2)
    box('Rail', (0, y + 1.0, .95), (3.0, .1, .1), 11)
    for x in (-1.4, 0, 1.4): box('RailPost', (x, y + .55, .95), (.08, .9, .08), 11)
bevel_box('Instrument', (-.6, 3.75, -.2), (.9, .8, .7), 1, .1)
box('InstrumentScreen', (-.6, 3.8, .16), (.6, .4, .04), 24)
box('LampMast', (.9, 6.7, -.6), (.1, 1.0, .1), 0)
box('LampHead', (.9, 7.1, -.45), (.5, .28, .3), 11)
box('Lamp', (.9, 7.0, -.29), (.4, .14, .04), 9)

# LAMP TOWER, 6.6 m: a yellow lattice mast on a charcoal foot crowned by a four-light head facing +Z (lights at
# local (+-.28, 6.2 / 6.6, .32)).
model('Lamp_Tower')
bevel_box('Foot', (0, .2, 0), (1.1, .4, 1.1), 0, .14)
for x in (-.35, .35):
    for z in (-.35, .35): box('Leg', (x, 3.1, z), (.1, 5.6, .1), 11)
for y in (1.0, 2.2, 3.4, 4.6, 5.8):
    for z in (-.35, .35): box('Ring', (0, y, z), (.8, .08, .08), 11)
    for x in (-.35, .35): box('Ring', (x, y, 0), (.08, .08, .8), 11)
for y0 in (.4, 1.6, 2.8, 4.0, 5.2):
    prism('Brace', [(-.35, y0), (-.27, y0), (.35, y0 + 1.12), (.27, y0 + 1.2)], .33, .37, 11, axis='z')
box('HeadPlate', (0, 6.4, .1), (1.1, 1.0, .16), 0)
for x in (-.28, .28):
    for y in (6.18, 6.62): box('Light', (x, y, .22), (.4, .32, .08), 9)

finish(__file__)
