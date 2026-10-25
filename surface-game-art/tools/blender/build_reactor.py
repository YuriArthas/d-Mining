"""地心反应堆 hall props (world 2, layer 6): the world 2 base kit in big flat colour blocks (light panel white, bright
yellow, charcoal, orange glow) round the planet's molten core. White kiosks with icon screens (an ore chunk for the
sale, crossed pickaxes for the shop) on the shared stall frame, a white lamp post, a screen name board, a yellow
bollard, the reactor facade on the north wall, the reactor ring with its turning rotor, the core clamps, cooling
towers with turning fans, a ceiling lamp and crate stacks. The core itself, the floor, the rail and the glow
halos are built by tools/underground/reactorHall.ts. Shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_reactor.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, stall, name_board, pit_post

# Glow tiles are deep and saturated: the atlas emission (x2.2) on top of the lit colour would wash bright ones out.
TILES = [
    ('2c2e33', [(4, 6, 24, 2, '383b42')]),                                    # 0 charcoal frame
    ('d6dadf', [(2, 2, 28, 2, 'e4e7eb'), (2, 28, 28, 2, 'b4bac2')]),          # 1 light panel
    ('8a9099', [(4, 5, 10, 3, '969ca5'), (18, 20, 10, 6, '7c828c')]),         # 2 mid grey
    ('25272c', [(0, 10, 32, 2, '31343b'), (15, 0, 2, 32, '31343b')]),         # 3 dark panel, seams
    ('dfe2e6', [(2, 14, 28, 2, 'c8ccd2')]),                                   # 4 white roof
    ('f2c230', [(0, 0, 8, 32, '2a2a2e'), (16, 0, 8, 32, '2a2a2e')]),          # 5 hazard stripes
    ('e6e8ec', [(3, 3, 26, 2, 'd2d6dc')]),                                    # 6 pale panel
    ('c2460a', [(6, 6, 20, 20, 'd45a12')]),                                   # 7 glow orange (deep)
    ('a01e0a', [(8, 8, 16, 16, 'b82c10')]),                                   # 8 glow red (deep)
    ('b89a60', [(6, 6, 20, 20, 'c8ac72')]),                                   # 9 glow warm white (deep)
    ('2a2e36', [(4, 5, 22, 3, '363b45')]),                                    # 10 iron
    ('f0bf2e', [(3, 3, 26, 3, 'f8d04a'), (3, 26, 26, 3, 'd2a01c')]),          # 11 yellow paint
    ('c8401c', [(4, 4, 8, 20, 'de5a2c'), (18, 8, 6, 16, 'a83414')]),          # 12 ore red
    ('4a4f58', [(2, 10, 28, 3, '5a606a')]),                                   # 13 cable
    ('1c1a1e', [(4, 5, 24, 3, '242228')]),                                    # 14 screen board
    ('16181e', []),                                                           # 15 shadow
    ('b88214', [(6, 6, 20, 20, 'c89420')]),                                   # 16 glow gold (deep)
    ('0c6c74', [(6, 6, 20, 20, '12808a')]),                                   # 17 glow teal (deep)
    ('2c3038', [(3, 4, 26, 3, '1a1d22'), (3, 11, 26, 3, '1a1d22'), (3, 18, 26, 3, '1a1d22'), (3, 25, 26, 3, '1a1d22')]),  # 18 vent grille
    ('e07a1e', [(3, 3, 26, 3, 'ee8c30'), (3, 26, 26, 3, 'c46612')]),          # 19 orange paint
]
start('Reactor', 'reactor', TILES, glowing={7, 8, 9, 16, 17})

def bevel_box(name, at, size, t, q=.12):
    """A chamfered box: the chunky toy-tech block (octagonal in plan, edges cut by q)."""
    x, y, z = at; w, h, d = size
    return prism(name, [(x + px, z + pz) for px, pz in stepped(w, d, min(q, w / 3, d / 3))], y - h / 2, y + h / 2, t)
def ring_segments(name, r0, r1, z0, z1, n, t, cy=0, spin=0, gaps=()):
    """A flat ring in the XY plane (facing +Z) from n trapezoid prisms, skipping the segment indices in `gaps`."""
    for k in range(n):
        if k in gaps: continue
        a0, a1 = spin + 2 * math.pi * k / n, spin + 2 * math.pi * (k + 1) / n
        outline = [(math.cos(a0) * r0, cy + math.sin(a0) * r0), (math.cos(a0) * r1, cy + math.sin(a0) * r1),
                   (math.cos(a1) * r1, cy + math.sin(a1) * r1), (math.cos(a1) * r0, cy + math.sin(a1) * r0)]
        prism(name, outline, z0, z1, t, axis='z')

# SERVICE STALLS: the shared frame under a white kiosk roof with a yellow fascia and a big icon screen on top, its
# icon glowing: a faceted ore chunk for the sale, crossed pickaxes for the shop. The screen's face is at local
# z = 1.08, centre y = 4.6, 2.9 x 1.3 (the hall builder puts its halo there).
def kiosk_roof(icon):
    def roof():
        bevel_box('Roof', (0, 3.75, 0), (5.9, .34, 3.7), 4, .32)
        box('RoofFascia', (0, 3.5, 1.78), (5.6, .32, .14), 11)
        box('RoofStrip', (0, 3.36, 1.86), (5.0, .08, .06), 9)
        box('ScreenBack', (0, 4.6, .9), (3.2, 1.55, .3), 1)
        box('Screen', (0, 4.6, 1.06), (2.9, 1.3, .04), 14)
        for x in (-1.3, 1.3): box('ScreenLeg', (x, 4.0, .9), (.18, .5, .18), 0)
        icon()
    return roof
ICON = lambda pts, k=1.45: [(px * k, 4.6 + (py - 4.6) * k) for px, py in pts]  # icons fill the screen
def ore_icon():
    prism('IconOre', ICON([(-.42, 4.38), (-.18, 4.2), (.3, 4.26), (.48, 4.56), (.3, 4.95), (-.1, 5.02), (-.44, 4.78)]), 1.08, 1.12, 7, axis='z')
    prism('IconOreFacet', ICON([(-.1, 4.62), (.22, 4.5), (.3, 4.78), (0, 4.9)]), 1.12, 1.14, 16, axis='z')
def pick_icon():
    for s in (-1, 1):
        c, sn = math.cos(s * math.pi / 4), math.sin(s * math.pi / 4)
        rot = lambda pts: [(1.3 * (px * c - py * sn), 4.6 + 1.3 * (px * sn + py * c)) for px, py in pts]
        prism('IconHandle', rot([(-.05, -.55), (.05, -.55), (.05, .38), (-.05, .38)]), 1.08, 1.11, 16, axis='z')
        prism('IconHead', rot([(-.42, .3), (-.12, .46), (.12, .46), (.42, .3), (.32, .24), (0, .34), (-.32, .24)]), 1.1, 1.13, 17, axis='z')
def white_post(x, z):
    bevel_box('PostFoot', (x, .4, z), (.5, .4, .5), 11, .1)
    box('Post', (x, 2.0, z), (.3, 3.4, .3), 1)
    box('PostLight', (x, 2.0, z + .16), (.08, 2.6, .04), 9)
stall('Stall_Sell', 'coin', kiosk_roof(ore_icon), white_post)
stall('Stall_Shop', 'pick', kiosk_roof(pick_icon), white_post)

# LAMP POST (the shared Lantern_Post slot and collider, .4 x 2.8): a white post with a yellow band and a warm
# light box on its arm (light centre at local (.55, 2.52, 0)).
model('Lantern_Post')
bevel_box('PostFoot', (0, .2, 0), (.62, .4, .62), 0, .12)
box('Post', (0, 1.45, 0), (.26, 2.5, .26), 1)
box('PostBand', (0, .75, 0), (.28, .34, .28), 11)
box('Arm', (.38, 2.78, 0), (.92, .18, .24), 1)
box('LightHood', (.55, 2.66, 0), (.6, .1, .34), 11)
box('Light', (.55, 2.55, 0), (.5, .12, .26), 9)

# NAME BOARD: white uprights with yellow bands and orange lamp caps; an orange glow edge round the dark screen.
def upright(x):
    bevel_box('UprightFoot', (x, .35, 0), (.9, .7, .9), 0, .2)
    box('Upright', (x, 3.9, 0), (.46, 7.4, .46), 1)
    box('UprightBand', (x, 1.1, 0), (.5, .5, .5), 11)
    box('UprightCap', (x, 7.75, 0), (.7, .3, .7), 7)
name_board(upright)
for y in (4.86, 7.14): box('BoardEdge', (0, y, .08), (7.5, .1, .06), 7)
for x in (-3.72, 3.72): box('BoardEdge', (x, 6.0, .08), (.1, 2.38, .06), 7)

# PIT POST: a yellow bollard with a black band and an orange signal lamp at y = 1.2 (the rail's corner posts).
def bollard():
    box('Band', (0, .7, 0), (.5, .2, .5), 0)
    box('Lamp', (0, 1.2, 0), (.36, .2, .36), 7)
pit_post(bollard)

# REACTOR FACADE on the north wall (front +Z, its back at local z = -.3), 19.2 m wide and 20 m tall: a dark
# panelled wall between two white pylons with yellow bands and orange glow strips, a white lintel and a hazard
# plinth. It hides the voxel wall behind the core.
model('Reactor_Facade')
box('Wall', (0, 10, 0), (17.4, 20, .6), 3)
for side in (-1, 1):
    x = side * 8.9
    box('Pylon', (x, 10, .4), (1.6, 20, 1.4), 1)
    for y in (2.2, 9.0, 15.8): box('PylonBand', (x, y, .4), (1.66, .6, 1.46), 11)
    box('PylonStrip', (x - side * .82, 10, .9), (.08, 16, .12), 7)
    bevel_box('PylonFoot', (x, .6, .7), (2.2, 1.2, 2.0), 0, .3)
box('Lintel', (0, 19.4, .5), (17.4, 1.2, 1.2), 1)
box('LintelBand', (0, 18.75, 1.12), (17.4, .14, .06), 7)
box('Plinth', (0, .55, .55), (16.2, 1.1, .9), 5)
box('PlinthTop', (0, 1.15, .55), (16.4, .12, 1.0), 0)
for x in (-6, -3, 3, 6):
    box('Vent', (x, 3.0, .32), (1.6, 1.2, .06), 18)
    box('VentLight', (x, 3.8, .33), (1.4, .1, .05), 7)

# REACTOR RING round the core (front +Z, centre at the origin): a broad white ring with a yellow outer band,
# an orange glow lip on its inner edge and four yellow clamps at the diagonals reaching in to the core.
model('Reactor_Ring')
ring_segments('Ring', 5.0, 6.2, -.6, .6, 24, 1)
ring_segments('RingBand', 6.2, 6.5, -.45, .45, 24, 11)
ring_segments('RingLip', 4.82, 5.02, -.2, .62, 24, 7)
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    c, s = math.cos(a), math.sin(a)
    rot = lambda pts: [(px * c - py * s, px * s + py * c) for px, py in pts]
    prism('ClampArm', rot([(4.2, -.55), (6.9, -.75), (6.9, .75), (4.2, .55)]), -.5, .9, 11, axis='z')
    prism('ClampJaw', rot([(3.9, -.8), (4.5, -.8), (4.5, .8), (3.9, .8)]), -.3, 1.1, 0, axis='z')
    prism('ClampLight', rot([(5.2, -.12), (6.4, -.12), (6.4, .12), (5.2, .12)]), .9, .96, 9, axis='z')
# The ROTOR turns about Z just inside the ring: eight glowing pods on a thin dark track.
model('Reactor_Rotor')
ring_segments('Track', 5.0, 5.3, .62, .74, 32, 0)
for k in range(8):
    a = 2 * math.pi * k / 8
    c, s = math.cos(a), math.sin(a)
    prism('Pod', [(5.15 * c + px * c - py * s, 5.15 * s + px * s + py * c) for px, py in ((-.3, -.4), (.3, -.4), (.3, .4), (-.3, .4))], .7, 1.0, 16, axis='z')

# COOLING TOWER (on the floor beside the facade): a white drum with yellow bands, an orange vent ring and a dark
# grille, crowned by a fan housing; the fan (Cooling_Fan) turns on top at y = 8.15.
model('Cooling_Tower')
lathe('Drum', [(0, 2.3), (.6, 2.3), (.6, 2.0), (7.4, 2.0), (7.8, 1.7)], 12, 1, tiles_by_band=[0, 1, 1, 1])
for y in (1.4, 5.6): lathe('Band', [(y, 2.04), (y + .5, 2.04)], 12, 11, cap_top=False, cap_bottom=False)
lathe('VentRing', [(3.4, 2.04), (3.8, 2.04)], 12, 7, cap_top=False, cap_bottom=False)
lathe('Housing', [(7.8, 1.8), (8.2, 1.8)], 12, 0)
for k in range(4):
    a = k * math.pi / 2
    box('Grille', (math.cos(a) * 2.02, 4.6, math.sin(a) * 2.02), (.9 if k % 2 else .06, .8, .06 if k % 2 else .9), 18)
model('Cooling_Fan')
lathe('Hub', [(0, .3), (.25, .3)], 8, 2)
for k in range(5):
    a = k * 2 * math.pi / 5
    c, s = math.cos(a), math.sin(a)
    prism('Blade', [(px * c - pz * s, px * s + pz * c) for px, pz in ((.25, -.18), (1.6, -.3), (1.6, .26), (.25, .14))], .06, .16, 2)

# CEILING LAMP (hangs from the rock): a rod, a yellow housing and a warm glowing underside at y = -.26.
model('Ceiling_Lamp')
box('Rod', (0, 2.2, 0), (.12, 4.0, .12), 0)
bevel_box('Housing', (0, 0, 0), (1.8, .5, 1.1), 11, .2)
box('Light', (0, -.27, 0), (1.5, .06, .8), 9)

# CRATE STACK: chunky white, yellow and charcoal crates with hazard bands.
model('Crate_Stack')
for (x, y, z, s, t) in ((0, .5, 0, 1.0, 1), (.15, 1.4, .05, .8, 11), (1.05, .35, .2, .7, 0)):
    bevel_box('Crate', (x, y, z), (s, s * .9 if y > .5 else s, s), t, .1)
    box('CrateBand', (x, y, z + s / 2 + .01), (s * .8, .12, .03), 5)

finish(__file__)
