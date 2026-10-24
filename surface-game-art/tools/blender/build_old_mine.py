"""老矿井 hall props: plank-roofed sale stall, timber support sets, two big hoist headframes, ore carts on rail
track, crates, barrels and glowing amber ore piles, plus the shared lantern post, name board and pit post
(footprints in cave_props.py).
Run: blender -b --python tools/blender/build_old_mine.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mathutils import Vector
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, stall, lantern_post, name_board, pit_post

TILES = [
    ('6a4e3a', [(4, 6, 24, 3, '7a5c46'), (6, 24, 18, 2, '5a4030')]),          # 0 dark timber
    ('c89458', [(4, 5, 24, 3, 'd8a468'), (6, 24, 19, 2, 'b47f46')]),          # 1 honey timber
    ('8a7764', [(4, 5, 10, 3, '978470'), (18, 20, 10, 6, '7a6856')]),         # 2 stone
    ('8a6f50', [(3, 4, 9, 3, '9a7f60'), (17, 20, 9, 4, '7a6044')]),           # 3 dirt
    ('b07040', [(2, 6, 28, 3, 'c0804e'), (2, 20, 28, 3, '9a5e34')]),          # 4 roof plank
    ('84502e', [(2, 6, 28, 3, '94603c'), (2, 20, 28, 3, '704226')]),          # 5 roof plank dark
    ('e6d2b0', [(4, 4, 3, 24, 'd6c2a0')]),                                    # 6 pale
    ('ffc878', [(8, 8, 16, 16, 'fff0c8')]),                                   # 7 glow amber
    ('ff9a4c', [(8, 8, 16, 16, 'ffd0a0')]),                                   # 8 glow ember
    ('ffd38a', [(6, 6, 20, 20, 'fff0c8')]),                                   # 9 glow warm (lantern)
    ('3e3e48', [(4, 5, 22, 3, '4e4e5a')]),                                    # 10 iron
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),          # 11 gold
    ('a8582a', [(4, 4, 8, 20, 'c87436'), (18, 8, 6, 16, '86441e')]),          # 12 copper ore
    ('a07a52', [(2, 10, 28, 3, 'b48c62'), (2, 20, 28, 3, '8d6a46')]),         # 13 rope
    ('9a7450', [(4, 5, 24, 3, 'aa845e')]),                                    # 14 board plank
    ('3a2a20', []),                                                           # 15 shadow
    ('a4a8b2', [(2, 4, 28, 4, 'c4c8d0'), (2, 24, 28, 3, '868a94')]),          # 16 rail steel
    ('b8543c', [(3, 3, 26, 4, 'cc6a50'), (3, 25, 26, 4, '9a4430')]),          # 17 cart paint
    ('b47e4a', [(6, 0, 3, 32, '9a6638'), (18, 0, 3, 32, '9a6638')]),          # 18 barrel staves
    ('7a2c02', [(5, 6, 9, 8, 'b85a08'), (17, 16, 9, 9, 'b85a08')]),           # 19 amber ore (glow; deep, so emission stays orange)
    ('4e4648', [(6, 6, 20, 20, '5e5658')]),                                   # 20 wheel
    ('dcc89c', [(4, 6, 24, 2, 'c8b486'), (4, 20, 24, 2, 'c8b486')]),          # 21 sack cloth
]
start('OldMine', 'old-mine', TILES, glowing={7, 8, 9, 19})

def beam(name, a, b, w, d, t):
    """A square timber from point a to point b (w across, d deep)."""
    A, B = Vector(a), Vector(b); u = (B - A).normalized()
    ref = Vector((0, 1, 0)) if abs(u.y) < .9 else Vector((1, 0, 0))
    s = u.cross(ref).normalized(); v = s.cross(u).normalized()
    pts = [tuple(e + s * i * w / 2 + v * j * d / 2) for e in (A, B) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    return mesh(name, pts, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], t)
def slab(name, x0, x1, z0, z1, y0, y1, th, t):
    """A sloped plank: y0 along its back edge (z0), y1 along its front edge (z1)."""
    v = [(x0, y0 - th, z0), (x1, y0 - th, z0), (x1, y1 - th, z1), (x0, y1 - th, z1), (x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1)]
    return mesh(name, v, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], t)
def lantern(x, y, z, s=1.0):
    """A hanging lantern whose top is at y."""
    box('LanternCap', (x, y - .05 * s, z), (.4 * s, .1 * s, .4 * s), 10)
    box('LanternGlass', (x, y - .32 * s, z), (.32 * s, .44 * s, .32 * s), 9)
    box('LanternFoot', (x, y - .58 * s, z), (.38 * s, .08 * s, .38 * s), 10)
def wheel(x, y, z0, z1, r=.3):
    prism('Wheel', circle(r, 10, x, y), z0, z1, 20, axis='z')
    prism('Hub', circle(r * .35, 6, x, y), z0 - .03, z1 + .03, 10, axis='z')

# SALE STALL under a sloped plank shed roof on the shared back posts, braced to a front beam.
def roof():
    box('BackBeam', (0, 3.85, -.9), (5.0, .3, .4), 0)
    box('FrontBeam', (0, 3.5, 1.55), (5.2, .26, .3), 0)
    for side in (-1, 1): beam('Brace', (side * 2.2, 2.7, -.9), (side * 2.2, 3.45, 1.5), .22, .22, 0)
    for k in range(5):
        x0 = -3.0 + k * 1.2
        slab('RoofPlank', x0, x0 + 1.15, -1.7, 1.95, 4.32 + (k % 2) * .04, 3.68, .18, 4 if k % 2 else 5)
    slab('RoofRidge', -3.05, 3.05, -1.75, -1.25, 4.44, 4.36, .14, 0)
stall('Stall_Sell', 'coin', roof)

lantern_post()

# NAME BOARD: chunky timber uprights on stone feet, a crossbeam over the board with two lanterns.
def upright(x):
    box('UprightFoot', (x, .3, 0), (.8, .6, .8), 2)
    box('Upright', (x, 3.95, 0), (.5, 7.5, .5), 0)
    beam('UprightBrace', (x, 6.2, .02), (x * .78, 7.45, .02), .22, .22, 0)
name_board(upright)
box('TopBeam', (0, 7.85, 0), (9.0, .5, .6), 1)
box('TopBeamCap', (0, 8.15, 0), (9.3, .12, .7), 0)
for x in (-3.0, 3.0): box('Rope', (x, 7.42, .5), (.05, .36, .05), 13); lantern(x, 7.25, .5, .9)

# PIT POST: a stone post with an iron lantern box on top.
def pit_cap():
    box('CapPlate', (0, 1.14, 0), (.5, .08, .5), 10)
    box('CapGlass', (0, 1.36, 0), (.36, .36, .36), 9)
    box('CapTop', (0, 1.6, 0), (.46, .12, .46), 10)
pit_post(pit_cap)

# TIMBER SUPPORT SET against a wall, front +Z: two thick posts, a cap beam, knee braces, a hanging lantern.
model('Timber_Set')
for side in (-1, 1):
    box('PostFoot', (side * 2.0, .25, 0), (.85, .5, .85), 2)
    box('Post', (side * 2.0, 3.5, 0), (.6, 6.5, .6), 0)
    beam('Knee', (side * 2.0, 5.0, .05), (side * 1.0, 6.55, .05), .3, .34, 1)
box('Cap', (0, 6.95, 0), (5.6, .7, .8), 1)
box('CapTrim', (0, 7.36, 0), (5.8, .14, .9), 0)
box('Wedge', (0, 6.42, .0), (1.2, .3, .7), 0)
box('Rope', (0, 6.15, .25), (.05, .5, .05), 13); lantern(0, 5.92, .25)

# HOIST HEADFRAME (the hall's landmark), front +Z, ~11 m: four raked legs on a plank deck, cross-braces, a top
# platform with a big sheave wheel, a rope down to a hanging ore bucket, a winch drum and two lanterns.
model('Hoist')
prism('Deck', stepped(6.4, 5.2, .5), 0, .25, 1)
for x0, z0 in ((-2.6, 1.9), (2.6, 1.9), (-2.6, -1.9), (2.6, -1.9)):
    box('LegFoot', (x0, .5, z0), (.9, .5, .9), 2)
    beam('Leg', (x0, .6, z0), (x0 * .42, 9.4, z0 * .5), .55, .55, 0)
for y, k in ((3.4, .82), (6.4, .6)):
    for z0 in (1.9, -1.9):
        x = 2.6 * k; z = z0 * (1 - (1 - .5) * (y - .6) / 8.8)
        beam('CrossX', (-x, y, z), (x, y, z), .36, .36, 1)
    for x0 in (-2.6, 2.6):
        x = x0 * k; z = 1.9 * (1 - .5 * (y - .6) / 8.8)
        beam('CrossZ', (x, y, -z), (x, y, z), .36, .36, 1)
beam('DiagFront', (-2.3, 1.2, 1.75), (1.6, 6.1, 1.25), .26, .26, 0)
beam('DiagBack', (2.3, 1.2, -1.75), (-1.6, 6.1, -1.25), .26, .26, 0)
box('Platform', (0, 9.55, 0), (3.2, .35, 2.4), 1)
box('PlatformRail', (0, 10.0, 1.15), (3.2, .14, .12), 0)
for x in (-.5, .5): box('SheaveBlock', (x, 10.05, 0), (.3, .7, .5), 0)
prism('Sheave', circle(1.35, 14, 0, 11.2), -.18, .18, 0, axis='z')
prism('SheaveRim', circle(.95, 14, 0, 11.2), -.22, .22, 20, axis='z')
prism('SheaveHub', circle(.35, 8, 0, 11.2), -.3, .3, 11, axis='z')
box('HoistRope', (1.32, 6.4, 0), (.08, 9.4, .08), 13)
box('BucketBail', (1.32, 2.0, 0), (.9, .08, .08), 10)
prism('Bucket', [(x + 1.32, z) for x, z in stepped(1.1, 1.1, .2)], .6, 1.7, 0)
box('BucketBand', (1.32, 1.5, 0), (1.15, .14, 1.15), 10)
for x, z, t in ((-.2, -.15, 19), (.2, .1, 19), (0, .25, 12), (.15, -.25, 19)): box('BucketOre', (x + 1.32, 1.82, z), (.32, .3, .32), t)
for x in (-1.5, 1.5): box('Rope', (x, 9.1, 1.3), (.05, .5, .05), 13); lantern(x, 8.85, 1.3, 1.1)
# Winch beside the deck: a drum on two cheeks, with a crank.
for z in (-.85, .85): box('WinchCheek', (3.9, .75, z), (.9, 1.5, .25), 0)
prism('WinchDrum', circle(.55, 10, 3.9, 1.1), -.72, .72, 1, axis='z')
prism('WinchBand', circle(.6, 10, 3.9, 1.1), -.12, .12, 10, axis='z')
box('Crank', (3.9, 1.1, 1.05), (.12, .7, .12), 10)

# ORE CART on rails, along X: a red-painted tub with iron bands, four wheels and a heap of glowing amber ore.
model('Ore_Cart')
prism('Tub', [(-.95, -.6), (.95, -.6), (.95, .6), (-.95, .6)], .45, 1.25, 17)
box('TubLip', (0, 1.3, 0), (2.05, .12, 1.32), 10)
for x in (-.6, .6): box('TubBand', (x, .85, 0), (.14, .82, 1.26), 10)
box('Chassis', (0, .38, 0), (1.7, .16, 1.0), 0)
for x in (-.6, .6):
    wheel(x, .3, .5, .62); wheel(x, .3, -.62, -.5)
for x, z, s, t in ((-.45, -.2, .42, 19), (.1, .15, .5, 19), (.5, -.15, .38, 12), (-.1, -.25, .34, 12), (.35, .25, .3, 19)):
    box('Ore', (x, 1.3 + s * .3, z), (s, s * .8, s), t)
box('Hitch', (1.05, .45, 0), (.3, .12, .2), 10)

# RAIL TRACK, 4 m along X: two steel rails on timber sleepers (visual only; the floor carries the player).
model('Rail_Track')
for z in (-.55, .55): box('Rail', (0, .12, z), (4.0, .1, .12), 16)
for k in range(5): box('Sleeper', (-1.6 + k * .8, .05, 0), (.34, .1, 1.6), 0)
# A buffer stop for a track's end.
model('Rail_Buffer')
for z in (-.55, .55): box('BufferPost', (0, .45, z), (.3, .9, .3), 0)
box('BufferBeam', (.05, .78, 0), (.4, .36, 1.6), 17)
for z in (-.4, .4): box('BufferPad', (.3, .78, z), (.14, .26, .26), 10)

# CRATES: a stack of three, banded.
model('Crate_Stack')
for x, y, z, s, yaw in ((-.55, .5, 0, 1.0, 0), (.55, .45, .1, .9, 0), (-.1, 1.42, .05, .85, 0)):
    box('Crate', (x, y, z), (s, s, s), 1); box('CrateBand', (x, y, z), (s + .04, .14, s + .04), 0)
    box('CrateSlat', (x, y, z + s / 2 + .01), (s * .9, .12, .03), 0)
# BARRELS: three staved barrels with iron hoops.
model('Barrel_Group')
for x, z, h in ((0, 0, 1.1), (.75, .25, 1.0), (.2, .8, .95)):
    lathe('Barrel', [(0, .32), (h * .5, .4), (h, .32)], 10, 18, cx=x, cz=z)
    for y in (h * .18, h * .82): lathe('Hoop', [(y - .04, .37), (y + .04, .37)], 10, 10, cx=x, cz=z, cap_top=False, cap_bottom=False)
# SACKS of ore beside a crate.
model('Sack_Pile')
for x, z, s in ((0, 0, .7), (.6, .2, .6), (.25, .62, .55)):
    lathe('Sack', [(0, s * .5), (s * .45, s * .6), (s * .85, s * .38), (s, .05)], 8, 21, cx=x, cz=z)
box('Crate', (-.65, .4, .45), (.8, .8, .8), 1); box('CrateBand', (-.65, .4, .45), (.84, .12, .84), 0)

# ORE PILE: a big heap of rock with glowing amber chunks (the cart depot's load).
model('Ore_Pile')
lathe('Heap', [(0, 1.5), (.35, 1.3), (.8, .85), (1.15, .3)], 8, 2, spin=.3)
for x, y, z, s in ((-.5, .55, .6, .45), (.6, .7, .3, .5), (.1, 1.05, -.2, .42), (-.7, .4, -.5, .4), (.9, .35, -.6, .38), (0, .3, 1.15, .35)):
    box('Glint', (x, y, z), (s, s * .85, s), 19)
for x, y, z, s in ((-.2, .9, .4, .4), (.5, .5, .8, .36), (-.9, .5, .1, .34)): box('Copper', (x, y, z), (s, s, s), 12)
# ORE ROCK: a lump at the wall foot with two amber glints.
model('Ore_Rock')
lathe('Rock', [(0, .62), (.3, .55), (.62, .3), (.78, .06)], 7, 2, spin=.4)
box('Glint', (.32, .42, .25), (.24, .2, .24), 19); box('Glint', (-.2, .55, -.18), (.2, .18, .2), 19)

finish(__file__)
