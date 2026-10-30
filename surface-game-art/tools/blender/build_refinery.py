"""水晶精炼厂 hall props (world 2, layer 3): the world 2 base kit (tech_props.py) with a deep magenta accent, round the
crystals the colony harvests. Faceted glowing crystals (giant, cluster, small) in deep magenta and violet with
lighter tip facets, a yellow cradle at the giant's foot, a white laser rig, white-framed crystal tanks and a yellow
crystal cart, and the hero on the north wall: three refining columns on a deck in the shared facade, a crystal core
turning in each. The laser beams, the floor, the rail and the glow halos are built by tools/underground/refineryHall.ts.
Run: blender -b --python tools/blender/build_refinery.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import finish, model, mesh, box, lathe, prism, solid, solid_of, passable
from tech_props import tech_start, tech_services, tech_facade, bevel_box

ACCENT = ('8a1a7a', 'a42a92')  # deep magenta
# Glow tiles stay deep and saturated: the atlas emission (x2.2) washes bright ones out to pink and white.
TILES = [
    ('761270', [(4, 4, 10, 24, '881a80')]),                                   # 20 glow crystal magenta (deep)
    ('44208a', [(4, 4, 10, 24, '52289c')]),                                   # 21 glow crystal violet (deep)
    ('8c2286', [(6, 6, 20, 20, '9a2a94')]),                                   # 22 glow crystal tip facet (deep)
    ('2e2846', [(4, 6, 20, 4, '3a3456'), (8, 20, 14, 4, '262038')]),          # 23 crystal root rock
]
tech_start('Refinery', 'refinery', ACCENT, TILES, glowing={20, 21, 22})

def crystal(name, x, z, h, r, sides=6, lean=(0, 0), y=0, tip=.74, spin=0, tint=20):
    """A faceted crystal prism to `tip` of its height, then a point, leaning by (dx, dz) per metre; its sides
    alternate the crystal tile with violet, the point is the lighter facet."""
    pts = []
    for yy, rr in ((0, r), (h * tip, r * 1.04), (h, 0)):
        for k in range(sides):
            a = spin + 2 * math.pi * k / sides
            pts.append((x + math.cos(a) * rr + lean[0] * yy, y + yy, z + math.sin(a) * rr + lean[1] * yy))
    s = sides
    faces = [tuple(reversed(range(s)))] + [(k, (k + 1) % s, (k + 1) % s + s, k + s) for k in range(s)] + [(s + k, s + (k + 1) % s, 2 * s + (k + 1) % s, 2 * s + k) for k in range(s)]
    other = 21 if tint == 20 else 20
    tiles = [tint] + [tint if k % 2 else other for k in range(s)] + [22 if k % 2 else tint for k in range(s)]
    return mesh(name, pts, faces, tiles)

# GIANT CRYSTAL (~9.5 m) on a dark rock root, ringed by a yellow cradle: posts and two rails, open to the front.
model('Crystal_Giant')
giant = [prism('Root', [(math.cos(a) * rr, math.sin(a) * rr) for a, rr in ((k * math.pi / 4 + .2, 2.3 + (k % 2) * .4) for k in range(8))], 0, .7, 23)]
giant.append(crystal('Main', 0, 0, 9.6, 1.35, 6, (.06, .02), .4, .76, .3, 20))
for (x, z, h, r, lx, lz, t) in ((1.3, .5, 5.2, .8, .22, .08, 21), (-1.2, .7, 4.4, .7, -.24, .1, 20), (.3, -1.3, 6.0, .75, .04, -.2, 21),
                                (-.7, -1.0, 3.2, .55, -.2, -.22, 20), (1.1, -.9, 2.6, .5, .26, -.2, 20)):
    giant.append(crystal('Shard', x, z, h, r, 6, (lx, lz), .5, .72, x * 2, t))
cradle = []
for k in range(6):
    a = math.pi * .35 + k * math.pi * 1.3 / 5  # a horseshoe round the back, open toward +Z
    x, z = math.cos(a) * 2.9, -math.sin(a) * 2.9
    cradle.append([box('CradlePost', (x, 1.35, z), (.24, 2.7, .24), 11), box('CradleFoot', (x, .15, z), (.5, .3, .5), 0)])
# The rock root and each crystal; the cradle as a fence, post to post (its rails close the gaps).
for part in giant: solid_of([part], hull=True)
for k in range(5): solid_of(cradle[k] + cradle[k + 1], hull=True)
for k in range(5):
    a0, a1 = math.pi * .35 + k * math.pi * 1.3 / 5, math.pi * .35 + (k + 1) * math.pi * 1.3 / 5
    for y in (1.3, 2.55):
        x0, z0, x1, z1 = math.cos(a0) * 2.9, -math.sin(a0) * 2.9, math.cos(a1) * 2.9, -math.sin(a1) * 2.9
        L, yaw = math.hypot(x1 - x0, z1 - z0), math.atan2(z1 - z0, x1 - x0)
        c, s = math.cos(yaw), math.sin(yaw)
        prism('CradleRail', [((x0 + x1) / 2 + px * c - pz * s, (z0 + z1) / 2 + px * s + pz * c) for px, pz in ((-L / 2, -.08), (L / 2, -.08), (L / 2, .08), (-L / 2, .08))], y - .08, y + .08, 11)

# CRYSTAL CLUSTER (~2.6 m) and SMALL CRYSTALS (~1.2 m): for the rock faces and the wall feet.
model('Crystal_Cluster')
prism('Root', [(math.cos(k * math.pi / 3) * .9, math.sin(k * math.pi / 3) * .9) for k in range(6)], 0, .25, 23)
for (x, z, h, r, lx, lz, t) in ((0, 0, 2.6, .42, .03, .02, 20), (.5, .2, 1.7, .32, .3, .1, 21), (-.45, .25, 1.5, .3, -.32, .12, 20),
                                (.1, -.5, 1.9, .3, .05, -.3, 21), (-.3, -.35, 1.1, .24, -.25, -.25, 20)):
    solid_of([crystal('Crystal', x, z, h, r, 5, (lx, lz), .1, .7, x * 3, t)], hull=True)  # crystal by crystal; the low root is a step
model('Crystal_Small')
for (x, z, h, r, lx, lz, t) in ((0, 0, 1.25, .26, .05, 0, 20), (.3, .12, .8, .18, .35, .1, 21), (-.24, .2, .7, .17, -.3, .15, 21)):
    crystal('Crystal', x, z, h, r, 5, (lx, lz), 0, .7, x * 4, t)
solid_of(hull=True)

# LASER RIG (front +Z): a white base and turret, a white arm up to a yellow joint, a long white boom forward and a
# charcoal emitter head with a glowing magenta lens at local (0, 4.1, 2.75) (the hall builder draws the beam).
model('Laser_Rig')
bevel_box('Base', (0, .3, 0), (1.8, .6, 1.8), 1, .3)
box('BaseBand', (0, .5, .91), (1.4, .16, .04), 5)
bevel_box('Turret', (0, .9, 0), (1.1, .6, 1.1), 11, .18)
box('Arm', (0, 2.4, -.1), (.5, 2.6, .5), 1)
box('ArmLight', (0, 2.4, .16), (.08, 1.8, .04), 9)
bevel_box('Joint', (0, 3.9, 0), (.8, .7, .8), 11, .14)
box('Boom', (0, 4.1, 1.2), (.46, .46, 2.4), 1)
box('BoomBand', (0, 4.1, .6), (.5, .5, .3), 5)
bevel_box('Head', (0, 4.1, 2.45), (.7, .7, .6), 0, .12)
prism('Lens', [(math.cos(k * math.pi / 4) * .22, 4.1 + math.sin(k * math.pi / 4) * .22) for k in range(8)], 2.75, 2.82, 20, axis='z')
box('Cable', (-.3, 1.6, -.4), (.12, 2.2, .12), 13)
solid((0, .9, 0), (1.9, 1.8, 1.9)); solid((0, 2.4, 0), (.6, 3.0, .6))  # base and turret, the arm; the boom is overhead

# CRYSTAL TANK (front +Z, ~4 m): a white plinth, four white posts, two glowing rings for the glass, a white cap
# with a yellow band and a pipe; a crystal glows inside.
model('Crystal_Tank')
lathe('Plinth', [(0, 1.25), (.5, 1.25), (.62, 1.1)], 8, 1, spin=math.pi / 8)
lathe('PlinthBand', [(.18, 1.27), (.36, 1.27)], 8, 5, cap_top=False, cap_bottom=False, spin=math.pi / 8)
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    box('Post', (math.cos(a) * .95, 2.0, math.sin(a) * .95), (.2, 2.8, .2), 1)
for y in (1.05, 3.0): lathe('GlassRing', [(y, 1.0), (y + .1, 1.0)], 12, 20, cap_top=False, cap_bottom=False)
lathe('Cap', [(3.35, 1.15), (3.75, 1.15), (3.95, .7), (4.05, .3)], 8, 1, spin=math.pi / 8)
lathe('CapBand', [(3.45, 1.17), (3.62, 1.17)], 8, 11, cap_top=False, cap_bottom=False, spin=math.pi / 8)
box('Pipe', (0, 4.35, -.5), (.24, .6, .24), 2)
box('PipeRun', (0, 4.6, -1.0), (.24, .24, 1.2), 2)
crystal('Inside', 0, 0, 2.3, .38, 6, (0, 0), .62, .72, .2, 20)
crystal('InsideShard', .32, .15, 1.3, .2, 5, (.2, .05), .62, .7, .5, 21)
crystal('InsideShard', -.3, -.12, 1.1, .18, 5, (-.2, -.05), .62, .7, 1.1, 21)
solid_of(['Plinth', 'Post', 'Cap'], hull=True)  # the round tank, plinth to cap

# CRYSTAL CART (front +Z): a yellow tub on a charcoal chassis heaped with crystal chunks.
model('Crystal_Cart')
bevel_box('Chassis', (0, .42, 0), (1.3, .28, 2.0), 0, .12)
for z in (-.65, .65):
    for x in (-.68, .68): box('Wheel', (x, .28, z), (.14, .46, .46), 10)
bevel_box('Tub', (0, .92, 0), (1.25, .68, 1.9), 11, .16)
box('TubBand', (0, 1.06, .96), (1.1, .18, .04), 5)
for (x, z, h, t) in ((-.3, -.5, .8, 20), (.3, -.3, .6, 21), (0, .2, .9, 20), (-.32, .6, .55, 21), (.34, .55, .7, 20)):
    crystal('Chunk', x, z, h, .17, 5, (x * .3, 0), 1.2, .68, x * 5, t)
solid((0, .75, 0), (1.4, 1.5, 2.1))

# THE NORTH WALL: the shared facade (dark panels), a white DECK across it above the name board (local to the
# facade: y 7.8-8.4, z .3-3.4) with a yellow edge, brackets and the columns' header pipe; the REFINING COLUMNS
# stand on it (origin at the foot, front +Z): a white base, a glass shaft of glowing rings between four white
# posts (`glass` m tall), a white cap with a yellow band and a pipe up to the header. A CORE turns in each
# (Refinery_Core: a big crystal and two shards, origin at its foot).
tech_facade('Refinery_Facade')
model('Refinery_Deck')
bevel_box('Deck', (0, 8.1, 1.85), (16.4, .6, 3.1), 1, .3)
box('DeckEdge', (0, 8.42, 3.36), (16.0, .06, .14), 11)
box('DeckStripe', (0, 8.05, 3.42), (15.6, .3, .04), 5)
for x in (-6.6, -2.4, 2.4, 6.6):
    mesh('Bracket', [(x - .2, 7.8, .3), (x + .2, 7.8, .3), (x + .2, 7.8, 2.6), (x - .2, 7.8, 2.6), (x - .2, 5.6, .3), (x + .2, 5.6, .3)],
         [(0, 1, 2, 3), (4, 5, 1, 0), (3, 2, 5, 4), (0, 3, 4), (1, 5, 2)], 0)
box('Header', (0, 18.0, 1.6), (11.0, .5, .5), 2)
for x in (-5.2, 5.2): box('HeaderDrop', (x, 17.15, 1.6), (.4, 1.7, .4), 2)
for x in (-7.6, 7.6): box('HeaderRun', (x * .86, 18.0, 1.6), (2.4, .4, .4), 13)
passable('across the facade 7.8 m up, its brackets from 5.6 m')
def column(name, glass):
    model(name)
    lathe('Base', [(0, 1.5), (.85, 1.5), (1.05, 1.28)], 8, 1, spin=math.pi / 8)
    lathe('BaseBand', [(.3, 1.52), (.55, 1.52)], 8, 11, cap_top=False, cap_bottom=False, spin=math.pi / 8)
    top = 1.05 + glass
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        box('Post', (math.cos(a) * 1.22, 1.05 + glass / 2, math.sin(a) * 1.22), (.24, glass, .24), 1)
    for k in range(4): lathe('GlassRing', [(1.1 + k * (glass - .2) / 3, 1.18), (1.22 + k * (glass - .2) / 3, 1.18)], 12, 20, cap_top=False, cap_bottom=False)
    lathe('Cap', [(top, 1.45), (top + .6, 1.45), (top + .9, .9), (top + 1.1, .4)], 8, 1, spin=math.pi / 8)
    lathe('CapBand', [(top + .12, 1.47), (top + .36, 1.47)], 8, 11, cap_top=False, cap_bottom=False, spin=math.pi / 8)
    box('CapLight', (0, top + .45, 1.47), (.5, .16, .04), 7)
    passable('stands on the deck, 8.4 m up')
column('Refinery_Column_Tall', 7.0)
column('Refinery_Column_Short', 5.4)
model('Refinery_Core')
crystal('Core', 0, 0, 3.4, .62, 6, (0, 0), 0, .7, .2, 20)
crystal('CoreShard', .62, .2, 1.8, .3, 5, (.16, .05), .5, .68, .5, 21)
crystal('CoreShard', -.56, -.24, 1.5, .26, 5, (-.16, -.05), .9, .7, 1.1, 21)
passable('turns in its column on the deck, 9 m up')

tech_services()
finish(__file__)
