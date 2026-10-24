"""地下遗迹 hall props: a buried sandstone temple. Whole and broken columns with jade glyph bands, a toppled drum,
the temple gate that frames the name board, a carved guardian head, flame braziers, broad vine curtains, rubble
and glyph blocks, and the service stalls under striped cloth awnings (red for the sale, teal for the shop) on
stone posts, on the shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_ruins.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post

TILES = [
    ('b09a74', [(4, 6, 24, 3, 'bea882'), (6, 24, 18, 2, 'a08a66')]),                          # 0 dark sandstone (frames)
    ('e2cfa6', [(4, 5, 24, 3, 'ecdab4'), (6, 24, 19, 2, 'd4c096')]),                          # 1 light sandstone (counter)
    ('cdb78e', [(4, 5, 10, 3, 'd8c49c'), (18, 20, 10, 6, 'bea67e')]),                         # 2 stone
    ('6a9a48', [(3, 4, 9, 3, '7aac56'), (17, 20, 9, 4, '5a8a3c')]),                           # 3 moss
    ('cf4a3c', [(0, 0, 32, 8, 'e05a48'), (0, 16, 32, 8, 'e05a48')]),                          # 4 red cloth, stripes
    ('2fa08a', [(0, 0, 32, 8, '3fb49c'), (0, 16, 32, 8, '3fb49c')]),                          # 5 teal cloth, stripes
    ('f4e8cc', [(4, 4, 3, 24, 'e8dcbe')]),                                                     # 6 cream
    ('7ff5c4', [(8, 8, 16, 16, 'd0ffe8')]),                                                    # 7 glow jade
    ('ffb45c', [(8, 8, 16, 16, 'ffe0a8')]),                                                    # 8 glow flame
    ('ffd38a', [(6, 6, 20, 20, 'fff0c8')]),                                                    # 9 glow warm (lantern)
    ('7a5a36', [(4, 5, 22, 3, '8c6a44')]),                                                     # 10 bronze
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),                          # 11 gold
    ('58d6a8', [(4, 4, 8, 20, '9af0d0'), (18, 8, 6, 16, '3db388')]),                          # 12 jade ore
    ('a07a52', [(2, 10, 28, 3, 'b48c62'), (2, 20, 28, 3, '8d6a46')]),                         # 13 rope
    ('c8ae80', [(4, 5, 24, 3, 'd4bc8e'), (6, 22, 20, 2, 'b89e72')]),                          # 14 carved board
    ('6a5638', []),                                                                            # 15 shadow
    ('e6d4ac', [(3, 0, 3, 32, 'cbb78e'), (13, 0, 3, 32, 'cbb78e'), (23, 0, 3, 32, 'cbb78e')]),  # 16 fluted column
    ('d6c094', [(4, 4, 10, 3, 'b29a70'), (4, 4, 3, 10, 'b29a70'), (18, 16, 10, 3, 'b29a70'), (25, 16, 3, 10, 'b29a70')]),  # 17 carved block
    ('5ff0b8', [(4, 6, 8, 3, '2fae7e'), (8, 6, 3, 10, '2fae7e'), (18, 4, 10, 3, '2fae7e'), (18, 4, 3, 12, '2fae7e'), (6, 22, 20, 3, '2fae7e')]),  # 18 glow jade glyphs
    ('4f9a42', [(4, 4, 10, 6, '62b252'), (16, 18, 10, 6, '3e8034')]),                          # 19 vine leaves
    ('ffe08a', [(8, 8, 16, 16, 'fff6d0')]),                                                    # 20 glow flame core
    ('9a8462', [(4, 6, 24, 3, 'a89270')]),                                                     # 21 carved recess
]
start('Ruins', 'ruins', TILES, glowing={7, 8, 9, 18, 20})

# COLUMN, 9 m: a stepped plinth, a fluted eight-sided shaft with a jade glyph band, a flared capital and abacus.
def column_base():
    prism('Plinth', stepped(2.6, 2.6, .35), 0, .5, 2)
    prism('PlinthTop', stepped(2.15, 2.15, .3), .5, .8, 1)
    lathe('Torus', [(.8, .92), (.92, .98), (1.08, .86)], 8, 1, spin=math.pi / 8, cap_bottom=False)
def column_band(y):
    lathe('GlyphBand', [(y, .86), (y + .5, .86)], 8, 18, spin=math.pi / 8, cap_top=False, cap_bottom=False)
    lathe('BandRim', [(y - .12, .9), (y, .9)], 8, 0, spin=math.pi / 8, cap_bottom=False)
    lathe('BandRim', [(y + .5, .9), (y + .62, .9)], 8, 0, spin=math.pi / 8, cap_bottom=False)
model('Column_Whole')
column_base()
lathe('Shaft', [(1.08, .82), (7.6, .74)], 8, 16, spin=math.pi / 8, cap_top=False, cap_bottom=False)
column_band(3.0)
lathe('Capital', [(7.6, .76), (7.95, 1.02), (8.2, 1.1)], 8, 1, spin=math.pi / 8, cap_bottom=False)
prism('Abacus', stepped(2.6, 2.6, .3), 8.2, 9.0, 0)
# BROKEN COLUMN: the shaft snaps off at about 4.4 m in a jagged top; a fallen chunk leans at its foot.
model('Column_Broken')
column_base()
tops = [4.6, 4.1, 4.9, 3.7, 4.3, 3.5, 4.0, 4.7]
v = [(math.cos(math.pi / 8 + i * math.pi / 4) * .82, 1.08, math.sin(math.pi / 8 + i * math.pi / 4) * .82) for i in range(8)]
v += [(math.cos(math.pi / 8 + i * math.pi / 4) * .78, tops[i], math.sin(math.pi / 8 + i * math.pi / 4) * .78) for i in range(8)]
v.append((0, 4.25, 0))
mesh('BrokenShaft', v, [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)] + [(8 + i, 16, 8 + (i + 1) % 8) for i in range(8)],
     [16] * 8 + [2] * 8)
column_band(2.6)
prism('Chunk', [(-.5, -.4), (.45, -.5), (.6, .2), (.1, .55), (-.55, .3)], 0, .7, 2)
mesh('ChunkMove', [(1.2 + x, y, .9 + z) for x, y, z in [(-.4, 0, -.4), (.5, 0, -.4), (.5, 0, .4), (-.4, 0, .4), (-.3, .6, -.3), (.4, .5, -.3), (.4, .7, .3), (-.3, .6, .3)]],
     [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (7, 6, 2, 3), (0, 4, 7, 3), (2, 6, 5, 1)], 16)
# TOPPLED DRUM: one fallen column drum lying along X, a jade band round its middle.
model('Column_Drum')
def drum(r, x0, x1, t, cap):
    n = 8; v = []
    for x in (x0, x1):
        for i in range(n):
            a = math.pi / 8 + i * math.pi / 4
            v.append((x, r * math.cos(math.pi / 8) + math.sin(a) * r, math.cos(a) * r))
    f = [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)] + [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    mesh('Drum', v, f, [t] * n + [cap, cap])
drum(.82, -.9, -.2, 16, 1); drum(.86, -.2, .25, 18, 0); drum(.82, .25, .9, 16, 1)

# TEMPLE GATE framing the name board (placed at the board, front +Z): two massive pillars with jade glyph strips,
# a carved lintel with a glowing glyph frieze, and a stepped crown. The board stands between the pillars.
model('Temple_Gate')
for side in (-1, 1):
    x = side * 6.1
    box('PillarFoot', (x, .4, -.3), (2.5, .8, 2.4), 2)
    box('Pillar', (x, 4.9, -.3), (1.8, 8.2, 1.9), 17)
    box('PillarGlyph', (x, 4.9, .69), (.7, 6.0, .1), 18)
    box('PillarTrim', (x, 8.95, -.3), (2.2, .4, 2.2), 0)
box('Lintel', (0, 9.9, -.3), (14.6, 1.6, 2.2), 17)
box('Frieze', (0, 9.9, .84), (10.4, .7, .1), 18)
box('LintelTrim', (0, 10.85, -.3), (15.2, .3, 2.5), 0)
box('Crown', (0, 11.45, -.4), (11.0, .9, 1.8), 1)
box('Crown2', (0, 12.3, -.5), (7.0, .8, 1.5), 17)
box('Crown3', (0, 13.05, -.6), (3.2, .7, 1.2), 1)
lathe('CrownGem', [(13.4, .5), (13.9, .5), (14.6, 0)], 4, 7, cz=.15, spin=math.pi / 4, cap_bottom=False)
box('Step', (0, .06, 1.4), (9.0, .12, 1.0), 2)

# GUARDIAN HEAD, about 4.6 m: a carved block face on a plinth, jade eyes, a broad brow, ear flaps, a crested
# headdress. Faces +Z.
model('Guardian_Head')
prism('Plinth', stepped(3.0, 2.8, .35), 0, .7, 2)
box('Neck', (0, 1.1, 0), (2.1, .8, 1.9), 17)
box('Head', (0, 2.65, 0), (2.7, 2.4, 2.4), 1)
box('Brow', (0, 3.3, 1.15), (2.8, .42, .4), 0)
for x in (-.58, .58): box('Eye', (x, 2.95, 1.22), (.6, .32, .1), 18)
box('Nose', (0, 2.5, 1.32), (.55, .85, .42), 1)
box('Mouth', (0, 1.95, 1.21), (1.5, .28, .1), 21)
for x in (-1.5, 1.5): box('Ear', (x, 2.6, 0), (.4, 1.8, 1.5), 0); box('EarJade', (x * 1.02, 2.6, .55), (.42, .4, .4), 12)
box('Headdress', (0, 4.1, -.05), (3.1, .55, 2.6), 5)
box('HeaddressBand', (0, 4.1, 1.27), (3.1, .3, .1), 11)
mesh('Crest', [(x, 4.37 + y, z) for x, y, z in [(-1.1, 0, -.4), (1.1, 0, -.4), (1.1, 0, .4), (-1.1, 0, .4), (-.5, 1.0, -.25), (.5, 1.0, -.25), (.5, 1.0, .25), (-.5, 1.0, .25)]],
     [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (7, 6, 2, 3), (0, 4, 7, 3), (2, 6, 5, 1)], 17)
lathe('CrestGem', [(5.37, .22), (5.6, .22), (5.85, 0)], 4, 7, spin=math.pi / 4, cap_bottom=False)

# BRAZIER, 1.4 m bowl on a pedestal with a cluster of flame spikes (glow).
model('Brazier')
prism('Foot', stepped(1.0, 1.0, .22), 0, .25, 2)
lathe('Pedestal', [(.25, .3), (.4, .22), (.9, .2), (1.0, .26)], 8, 1, spin=math.pi / 8)
lathe('Bowl', [(1.0, .26), (1.12, .58), (1.36, .72), (1.44, .66)], 8, 10, spin=math.pi / 8, cap_top=False)
lathe('Coals', [(1.32, .64), (1.36, .64)], 8, 20, spin=math.pi / 8, cap_bottom=False)
for x, z, h, r, t, lean in [(0, 0, 1.25, .3, 20, (0, 0)), (.25, .12, .85, .22, 8, (.12, 0)), (-.24, .1, .8, .2, 8, (-.12, .05)), (.05, -.26, .9, .22, 8, (0, -.12)), (-.1, .28, .65, .18, 20, (0, .1))]:
    spike('Flame', x, z, h, r, 5, t, lean=lean, y=1.34, tip=.25, spin=x * 3)

# VINE CURTAIN, hung from its top (the origin) against a wall, front +Z: three broad strips of chunky diamond
# leaves over a root mass, with a few jade blossoms.
model('Vine_Curtain')
box('Root', (0, -.3, -.2), (3.4, .6, .5), 19)
for k, (x, n) in enumerate([(-1.1, 6), (0, 8), (1.05, 5)]):
    for i in range(n):
        y = -.7 - i * .62; w = .62 - i * .03; dx = .14 * (1 if (i + k) % 2 else -1)
        prism('Leaf', [(x + dx, y - .5), (x + dx + w, y), (x + dx, y + .5), (x + dx - w, y)], -.12 - .02 * (i % 2), .1, 19, axis='z')
        if (i + k) % 3 == 2: lathe('Blossom', [(y - .14, .13), (y + .14, .13)], 5, 7, cx=x + dx, cz=.18)

# RUBBLE: three tumbled sandstone blocks; GLYPH BLOCK: a carved block with glowing jade glyphs.
model('Rubble')
prism('Block', [(-.6, -.45), (.5, -.55), (.65, .3), (-.4, .5)], 0, .7, 2)
prism('Block', [(.4, .2), (1.2, .1), (1.25, .8), (.5, .85)], 0, .5, 1)
prism('Block', [(-.3, -.2), (.35, -.3), (.4, .25), (-.25, .3)], .7, 1.1, 17)
model('Glyph_Block')
box('Block', (0, .45, 0), (1.15, .9, 1.0), 17)
box('GlyphFront', (0, .48, .51), (.7, .5, .04), 18)
box('GlyphTop', (0, .91, 0), (.6, .03, .5), 18)

# SERVICE STALLS: stone column posts, a beam, and a striped cloth awning sloping to the front with a scalloped
# valance. Red for the sale, teal for the shop.
def stone_post(x, z):
    prism('PostFoot', [(x + a, z + b) for a, b in stepped(.6, .6, .12)], .2, .5, 2)
    lathe('Post', [(.5, .2), (3.55, .18)], 8, 16, cx=x, cz=z, spin=math.pi / 8)
    box('PostCap', (x, 3.65, z), (.55, .2, .55), 1)
def awning(cloth):
    def roof():
        box('Beam', (0, 3.85, -.9), (5.0, .35, .45), 0)
        n = 6; w = 5.8 / n
        for i in range(n):
            x0, x1 = -2.9 + i * w, -2.9 + (i + 1) * w
            t = cloth if i % 2 == 0 else 6
            zb, yb, zf, yf, th = -1.8, 4.5, 1.75, 3.62, .1
            v = [(x0, yb, zb), (x1, yb, zb), (x1, yf, zf), (x0, yf, zf), (x0, yb + th, zb), (x1, yb + th, zb), (x1, yf + th, zf), (x0, yf + th, zf)]
            mesh('Cloth', v, [(0, 1, 2, 3), (7, 6, 5, 4), (3, 2, 6, 7), (0, 4, 5, 1), (0, 3, 7, 4), (1, 5, 6, 2)], t)
            prism('Valance', [(x0 + .02, 3.66), (x1 - .02, 3.66), ((x0 + x1) / 2, 3.24)], 1.72, 1.8, t, axis='z')
        box('RopeTop', (0, 3.66, 1.35), (.05, .14, .05), 13)
    return roof
stall('Stall_Sell', 'coin', awning(4), stone_post)
stall('Stall_Shop', 'pick', awning(5), stone_post)
lantern_post()
def upright(x):
    box('UprightFoot', (x, .3, 0), (.8, .6, .8), 2)
    box('Upright', (x, 3.9, 0), (.48, 7.4, .48), 16)
    box('UprightCap', (x, 7.75, 0), (.8, .3, .8), 0)
    lathe('UprightGem', [(7.9, .18), (8.1, .18), (8.4, 0)], 4, 7, cx=x, spin=math.pi / 4, cap_bottom=False)
name_board(upright)
pit_post(lambda: lathe('PostJade', [(1.1, .24), (1.25, .24), (1.6, 0)], 4, 7, spin=math.pi / 4))
finish(__file__)
