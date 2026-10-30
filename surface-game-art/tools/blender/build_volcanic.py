"""熔岩矿洞 hall props: hexagonal basalt column clusters, lava-basin rim stones, ember vents, obsidian clusters,
iron-roofed service stalls, the name board on basalt uprights and lava-capped pit posts, on the shared footprints in
cave_props.py. Each prop's collider follows its parts.
Run: blender -b --python tools/blender/build_volcanic.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post, solid, solid_of

TILES = [
    ('3e2a28', [(4, 6, 24, 3, '4c3632'), (6, 24, 18, 2, '32221f')]),          # 0 dark basalt frame
    ('7a5a44', [(4, 5, 24, 3, '8a6a52'), (6, 24, 19, 2, '6a4c38')]),          # 1 counter timber
    ('7a5650', [(4, 5, 10, 3, '8a645c'), (18, 20, 10, 6, '6a4a44')]),         # 2 basalt
    ('54423e', [(3, 4, 9, 3, '62504a'), (17, 20, 9, 4, '483834')]),           # 3 ash
    ('545a68', [(4, 4, 3, 3, '9aa0b0'), (25, 4, 3, 3, '9aa0b0'), (4, 25, 3, 3, '9aa0b0'), (25, 25, 3, 3, '9aa0b0'), (2, 14, 28, 2, '464b58')]),  # 4 iron roof, rivets
    ('b0603c', [(2, 6, 28, 3, 'c0704a'), (2, 20, 28, 3, '98502e')]),          # 5 rust copper
    ('cfc6cc', [(4, 4, 3, 24, 'bdb4bc')]),                                    # 6 pale ash
    ('ff7a2a', [(6, 6, 20, 20, 'ffb050'), (11, 11, 10, 10, 'ffe08a')]),       # 7 glow lava
    ('ffb840', [(8, 8, 16, 16, 'fff0a0')]),                                   # 8 glow ember gold
    ('ffd38a', [(6, 6, 20, 20, 'fff0c8')]),                                   # 9 glow warm (lantern)
    ('2c2e38', [(4, 5, 22, 3, '3a3c48')]),                                    # 10 iron
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),          # 11 gold
    ('e0603a', [(4, 4, 8, 20, 'ff9a6a'), (18, 8, 6, 16, 'b03a24')]),          # 12 fire ore
    ('6a5a56', [(2, 10, 28, 3, '7a6862'), (2, 20, 28, 3, '5a4c48')]),         # 13 chain
    ('5a3a34', [(4, 5, 24, 3, '684640')]),                                    # 14 board plank
    ('16141c', []),                                                           # 15 shadow
    ('2a1e1e', [(5, 4, 6, 22, '7a3a32'), (19, 8, 4, 16, '58302a')]),          # 16 obsidian, red sheen
    ('a08078', [(5, 5, 22, 22, 'ae8e84')]),                                   # 17 basalt column top
]
start('Volcanic', 'volcanic', TILES, glowing={7, 8, 9})

def hexcol(name, x, z, r, y0, y1, spin=0, top=17, side=2):
    return mesh(name, [(x + math.cos(spin + k * math.pi / 3) * r, y, z + math.sin(spin + k * math.pi / 3) * r) for y in (y0, y1) for k in range(6)],
                [(5, 4, 3, 2, 1, 0), (6, 7, 8, 9, 10, 11)] + [(k, (k + 1) % 6, (k + 1) % 6 + 6, k + 6) for k in range(6)], [side, top] + [side] * 6)

# BASALT COLUMNS, unit height (placed scaled by the tallest column's height): a tight honeycomb of hex columns
# stepping down from the middle, a few glowing ember seams between them.
model('Basalt_Columns')
R = .085
cells = [(0, 0, 1.0), (1, 0, .82), (.5, .87, .9), (-.5, .87, .7), (-1, 0, .76), (-.5, -.87, .62), (.5, -.87, .86),
         (2, 0, .5), (1.5, .87, .58), (1, 1.73, .42), (-1.5, .87, .46), (-2, 0, .38), (-1, -1.73, .34), (1.5, -.87, .55), (0, -1.73, .44), (0, 1.73, .5)]
for i, (u, v, h) in enumerate(cells):
    hexcol('Column', u * R * 1.73, v * R * 1.73, R, -.02, h, spin=math.pi / 6)
    box('ColumnCap', (u * R * 1.73, h + .006, v * R * 1.73), (R * 1.1, .012, R * .5), 17 if i % 3 else 2)
for u, v, h in [(.5, .29, .55), (-.5, .29, .42), (0, -.58, .5), (1.25, .43, .3), (-1.25, .43, .28), (.75, -1.3, .4), (-.75, -1.3, .3), (1.75, -.43, .3)]:
    box('EmberSeam', (u * R * 1.73, h / 2, v * R * 1.73), (.04, h, .04), 7)
# Two short columns carry pools of lava on their tops.
for u, v, h in [(1.5, .87, .58), (-1, -1.73, .34)]:
    hexcol('LavaTop', u * R * 1.73, v * R * 1.73, R * .7, h, h + .012, spin=math.pi / 6, top=7, side=7)
solid_of('Column', hull=True)  # one hull round the honeycomb, stepping down from the middle
# A short honeycomb stub for wall feet (about 1 m, unit scale).
model('Basalt_Stub')
for u, v, h in [(0, 0, .95), (1, 0, .7), (.5, .87, .8), (-.5, .87, .55), (-1, 0, .6), (.5, -.87, .45)]:
    hexcol('Stub', u * .28 * 1.73, v * .28 * 1.73, .28, -.02, h, spin=math.pi / 6)
solid_of(hull=True)

# LAVA RIM STONE: one chunky basalt block for the ring round the lava basin, a glowing underlip on the inner side.
model('Lava_Rim')
prism('Stone', [(-.6, -.34), (.55, -.38), (.68, .1), (.42, .42), (-.46, .38), (-.68, .02)], 0, .55, 2)
prism('StoneTop', [(-.5, -.26), (.46, -.3), (.56, .08), (.34, .32), (-.38, .3), (-.56, .02)], .55, .62, 17)
box('Underlip', (0, .5, -.36), (.9, .08, .06), 7)
solid_of(hull=True)

# EMBER VENT: a broad faceted cone with a glowing crater and a few lava lumps (about 1.2 m tall, unit scale).
model('Ember_Vent')
lathe('Cone', [(0, 1.2), (.3, 1.0), (.75, .6), (1.05, .42)], 9, 2, spin=.2, cap_top=False)
lathe('Lip', [(1.05, .42), (1.12, .4), (1.12, .3)], 9, 17, spin=.2, cap_top=False, cap_bottom=False)
lathe('Crater', [(1.12, .3), (.98, .22)], 9, 7, spin=.2, cap_bottom=False)
for a in (0.4, 2.3, 4.4):
    prism('Lump', circle(.16, 6, math.cos(a) * .95, math.sin(a) * .95), 0, .26, 7)
solid_of(hull=True)  # the cone (its crater is not walked into)

# OBSIDIAN CLUSTER: chunky black-violet glass spikes out of a basalt foot, an ember glint at the base.
model('Obsidian_Cluster')
solid_of([lathe('Foot', [(0, .55), (.22, .46), (.36, .16)], 7, 2)], hull=True)
for i, (x, z, h, lx, lz) in enumerate([(0, 0, 1.6, 0, 0), (.3, .12, 1.05, .32, .1), (-.26, .2, .9, -.36, .14), (.06, -.28, .8, .08, -.3)]):
    solid_of([spike('Obsidian', x, z, h, .17 + .04 * (i == 0), 5, 16, lean=(lx, lz), y=.18, spin=i)], hull=True)  # spike by spike
prism('Glint', circle(.12, 6, .28, -.22), .02, .14, 8)

# SERVICE STALL with riveted iron roof on square basalt posts (shared frame in cave_props.stall).
def iron_post(x, z):
    hexcol('PostFoot', x, z, .34, 0, .5, top=2)
    box('Post', (x, 2.1, z), (.3, 3.2, .3), 10)
    box('PostBand', (x, 1.2, z), (.36, .12, .36), 5)
    box('PostBand', (x, 3.0, z), (.36, .12, .36), 5)
def iron_roof():
    box('RoofBeam', (0, 3.62, -.9), (5.0, .22, .26), 10)
    mesh('Roof', [(-3.0, 3.75, -1.9), (3.0, 3.75, -1.9), (3.0, 4.35, -.3), (-3.0, 4.35, -.3), (-3.0, 3.75, 1.8), (3.0, 3.75, 1.8),
                  (-3.0, 3.6, -1.9), (3.0, 3.6, -1.9), (3.0, 3.6, 1.8), (-3.0, 3.6, 1.8)],
         [(0, 1, 2, 3), (3, 2, 5, 4), (9, 8, 7, 6), (6, 7, 1, 0), (8, 9, 4, 5), (6, 0, 3, 4, 9), (1, 7, 8, 5, 2)], [4, 4, 10, 10, 5, 0, 0])
    box('RoofRidge', (0, 4.42, -.3), (6.2, .16, .3), 5)
    box('RoofEdge', (0, 3.72, 1.82), (6.1, .12, .14), 5)
    for x in (-2.2, 2.2): box('FrontPost', (x, 2.35, 1.6), (.18, 2.7, .18), 10); solid((x, 1.35, 1.6), (.24, 2.7, .24))  # down to the floor
stall('Stall_Sell', 'coin', iron_roof, iron_post)
stall('Stall_Shop', 'pick', iron_roof, iron_post)

lantern_post()

# NAME BOARD on two basalt-column uprights, each crowned by a glowing ember stone.
def upright(x):
    hexcol('UprightFoot', x, 0, .55, 0, .7, top=17)
    hexcol('Upright', x, 0, .34, .7, 7.5, spin=math.pi / 6)
    hexcol('UprightCap', x, 0, .5, 7.5, 7.85, top=17)
    lathe('UprightEmber', [(7.85, .26), (8.1, .26), (8.35, 0)], 6, 7, cx=x)
name_board(upright)

# PIT POST with a lava cap.
pit_post(lambda: (prism('PostLip', stepped(.56, .56, .12), 1.1, 1.18, 17), lathe('PostLava', [(1.18, .2), (1.36, .18), (1.5, 0)], 6, 7)))
finish(__file__)
