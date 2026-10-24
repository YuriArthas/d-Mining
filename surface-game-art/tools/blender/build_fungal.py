"""蘑菇洞穴 hall props: chunky toy mushrooms, two service stalls, lanterns, the name board frame, crystals.
Run: blender -b --python tools/blender/build_fungal.py
Shared atlas, primitives and prop footprints in cave_props.py. Each prop is a root object named for its role;
tools/underground/fungalHall.ts places them.
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, stall, lantern_post, name_board, pit_post

# Quiet bases with a few grouped marks.
TILES = [
    ('5a4234', [(4, 6, 24, 3, '674c3b'), (6, 24, 18, 2, '4f392c')]),          # 0 dark timber
    ('c08a52', [(4, 5, 24, 3, 'cf9a61'), (6, 24, 19, 2, 'ad7a45')]),          # 1 honey timber
    ('5b6478', [(4, 5, 10, 3, '68728a'), (18, 20, 10, 6, '515a6d')]),         # 2 slate stone
    ('3f8f72', [(3, 4, 9, 3, '4ea383'), (17, 20, 9, 4, '357a61')]),           # 3 moss
    ('2fb7a8', [(5, 7, 7, 6, 'bff7ec'), (19, 18, 6, 5, 'bff7ec'), (10, 24, 4, 3, 'bff7ec')]),  # 4 teal cap, spots
    ('8a5ad6', [(5, 7, 7, 6, 'f0dcff'), (19, 18, 6, 5, 'f0dcff'), (10, 24, 4, 3, 'f0dcff')]),  # 5 violet cap, spots
    ('e9e1c8', [(4, 4, 3, 24, 'd8cfb3'), (20, 6, 3, 22, 'd8cfb3')]),          # 6 stem cream, fibres
    ('7ff5e4', [(8, 8, 16, 16, 'c8fff6')]),                                   # 7 glow teal
    ('c49bff', [(8, 8, 16, 16, 'eadbff')]),                                   # 8 glow violet
    ('ffd38a', [(6, 6, 20, 20, 'fff0c8')]),                                   # 9 glow warm (lantern)
    ('283447', [(4, 5, 22, 3, '344257')]),                                    # 10 navy iron
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),          # 11 gold
    ('58d6c8', [(4, 4, 8, 20, '9af0e6'), (18, 8, 6, 16, '3db3a7')]),          # 12 crystal teal
    ('a07a52', [(2, 10, 28, 3, 'b48c62'), (2, 20, 28, 3, '8d6a46')]),         # 13 rope / straps
    ('7a6aa8', [(4, 5, 24, 3, '8a7bb8')]),                                    # 14 dusk plank (board)
    ('3a3550', []),                                                           # 15 deep shadow
]
start('Fungal', 'fungal', TILES, glowing={7, 8, 9})

# GIANT MUSHROOM, unit height (placed scaled by its height; the cap spans ~0.45 of it). A faceted stem with a
# root flare and a skirt, a broad two-tier cap with pale spots, glowing gills underneath and a glow band.
def giant(name, cap_tile, glow_tile):
    model(name)
    lathe('Stem', [(0, .085), (.05, .07), (.16, .052), (.45, .046), (.62, .05), (.72, .055)], 9, 6)
    lathe('Root', [(0, .13), (.04, .1), (.09, .06)], 9, 0, cap_top=False)
    lathe('Skirt', [(.56, .055), (.6, .1), (.63, .105), (.645, .06)], 9, 6, cap_top=False, cap_bottom=False)
    lathe('Gills', [(.66, .07), (.69, .33), (.705, .43)], 12, glow_tile, spin=.13, cap_bottom=False, cap_top=False)
    lathe('Cap', [(.69, .44), (.735, .47), (.80, .44), (.885, .34), (.955, .19), (.99, .05)], 12, cap_tile, spin=.13, cap_bottom=False)
    lathe('CapGlowBand', [(.705, .445), (.715, .462), (.728, .468)], 12, glow_tile, spin=.13, cap_bottom=False, cap_top=False)
giant('Mushroom_Teal', 4, 7)
giant('Mushroom_Violet', 5, 8)
# A clump of three small glowing mushrooms (about 0.9 m tall), for wall feet and shelves.
model('Mushroom_Cluster')
for i, (x, z, h, t, g) in enumerate([(0, 0, .95, 4, 7), (.42, .2, .62, 5, 8), (-.3, .34, .5, 4, 7)]):
    lathe('SmallStem', [(0, .07 * h), (h * .7, .05 * h)], 7, 6, cx=x, cz=z)
    lathe('SmallCap', [(h * .66, .32 * h), (h * .8, .3 * h), (h * .93, .16 * h), (h, .03)], 9, t, cx=x, cz=z, spin=i)
    lathe('SmallGlow', [(h * .63, .1 * h), (h * .665, .3 * h)], 9, g, cx=x, cz=z, cap_bottom=False, cap_top=False, spin=i)

# SERVICE STALL under a broad mushroom-cap canopy on two stem posts (shared frame in cave_props.stall).
def fungal_stall(name, cap_tile, badge):
    def post(x, z): lathe('Post', [(.2, .2), (.5, .15), (3.4, .14), (3.7, .18)], 8, 6, cx=x, cz=z)
    def roof():
        lathe('Canopy', [(3.55, 2.9), (3.62, 3.05), (3.9, 2.85), (4.4, 2.1), (4.85, 1.0), (5.0, .2)], 14, cap_tile, cz=-.3, spin=.1, cap_bottom=False)
        lathe('CanopyGills', [(3.48, .4), (3.55, 2.88)], 14, 8 if cap_tile == 5 else 7, cz=-.3, spin=.1, cap_bottom=False, cap_top=False)
    stall(name, badge, roof, post)
fungal_stall('Stall_Sell', 5, 'coin')
fungal_stall('Stall_Shop', 4, 'pick')

lantern_post()

# NAME BOARD FRAME: two mushroom-stem uprights with caps.
def upright(x):
    lathe('Upright', [(0, .3), (.4, .22), (7.2, .2), (7.6, .28)], 8, 6, cx=x)
    lathe('UprightCap', [(7.55, .62), (7.7, .66), (8.0, .5), (8.25, .12)], 10, 5 if x < 0 else 4, cx=x, cap_bottom=False)
name_board(upright)

# CRYSTAL CLUSTER: a few chunky teal prisms leaning out of a rock foot.
model('Crystal_Cluster')
lathe('CrystalFoot', [(0, .55), (.25, .45), (.38, .15)], 7, 2)
for i, (x, z, h, lean) in enumerate([(0, 0, 1.5, 0), (.32, .14, 1.0, .35), (-.28, .2, .85, -.4), (.05, -.3, .7, .25)]):
    c, s = math.cos(lean), math.sin(lean); r = .16 + .04 * (i == 0)
    pts = []
    for y, rr in ((0, r), (h * .78, r), (h, 0)):
        for k in range(6):
            a = 2 * math.pi * k / 6 + i
            px, py = math.cos(a) * rr, y
            pts.append((x + px * c + py * s * .35, .2 + py * c - px * s * .1, z + math.sin(a) * rr))
    faces = [(0, 1, 2, 3, 4, 5)[::-1]] + [(k, (k + 1) % 6, (k + 1) % 6 + 6, k + 6) for k in range(6)] + [(6 + k, 6 + (k + 1) % 6, 12 + (k + 1) % 6, 12 + k) for k in range(6)]
    mesh('Crystal', pts, faces, 12)

# PIT POST with a glowing crystal cap at the pit corners.
pit_post(lambda: lathe('PostCrystal', [(1.1, .2), (1.35, .2), (1.6, 0)], 6, 7))

# POOL RIM STONE: one chunky rim block (placed in a ring round the glowing pool).
model('Pool_Stone')
prism('Stone', [(-.55, -.32), (.5, -.36), (.62, .1), (.4, .38), (-.42, .34), (-.62, .02)], 0, .42, 2)
prism('StoneMoss', [(-.45, -.22), (.4, -.26), (.48, .06), (.3, .26), (-.34, .24), (-.5, .0)], .42, .48, 3)

finish(__file__)
