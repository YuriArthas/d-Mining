"""自动化矿道 hall props (world 2, layer 1): a near-future mining base built into the cave, plastic-toy tech style.
Tech kiosk stalls on the shared frame, a light-bar lamp post, a screen name board, hazard bollards, chunky mining
robots, a drill machine with its spinning bit, wall fans with spinning blades, bulkhead wall panels, an ore hopper,
a crusher, an ore cart, a hazard-striped garage gate and stacked crates. Shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_automine.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, name_board, pit_post

# Plastic-toy tech: light panel grey (never pure white), gunmetal, navy, deep cyan and orange glow, hazard stripes.
# Glow tiles are deep and saturated: the atlas emission (x2.2) on top of the lit colour would wash bright ones out.
TILES = [
    ('3a414c', [(4, 6, 24, 2, '4a525e')]),                                   # 0 gunmetal frame
    ('c9ced6', [(2, 2, 28, 2, 'dbdfe5'), (2, 28, 28, 2, 'a9b0ba')]),          # 1 light panel
    ('8d95a1', [(4, 5, 10, 3, '9aa2ad'), (18, 20, 10, 6, '7f8794')]),         # 2 mid grey
    ('5a6270', [(3, 4, 26, 2, '666e7c'), (3, 14, 26, 2, '666e7c'), (3, 24, 26, 2, '666e7c')]),  # 3 deck grating
    ('24324a', [(2, 14, 28, 2, '31415c')]),                                   # 4 navy roof
    ('f2c230', [(0, 0, 8, 32, '2a2a2e'), (16, 0, 8, 32, '2a2a2e')]),          # 5 hazard stripes
    ('dde1e7', [(3, 3, 26, 2, 'c9ced6')]),                                    # 6 pale panel
    ('1890b0', [(6, 6, 20, 20, '22a8cc')]),                                   # 7 glow cyan (deep)
    ('c25a0a', [(6, 6, 20, 20, 'd86c14')]),                                   # 8 glow orange (deep)
    ('b89a60', [(6, 6, 20, 20, 'c8ac72')]),                                   # 9 glow warm white (deep)
    ('2a2e36', [(4, 5, 22, 3, '363b45')]),                                    # 10 iron
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),          # 11 gold
    ('4a6ad8', [(4, 4, 8, 20, '6a86f0'), (18, 8, 6, 16, '3a56b8')]),          # 12 cobalt ore
    ('4a4f58', [(2, 10, 28, 3, '5a606a')]),                                   # 13 cable
    ('1c2a3a', [(4, 5, 24, 3, '263648')]),                                    # 14 screen board
    ('16181e', []),                                                           # 15 shadow
    ('0e5a78', [(4, 6, 18, 3, '1c8cb0'), (4, 13, 12, 3, '1c8cb0'), (4, 20, 22, 3, '1c8cb0')]),  # 16 glow screen, data rows
    ('2c3038', [(3, 4, 26, 3, '1a1d22'), (3, 11, 26, 3, '1a1d22'), (3, 18, 26, 3, '1a1d22'), (3, 25, 26, 3, '1a1d22')]),  # 17 vent grille
    ('a81e14', [(8, 8, 16, 16, 'c43020')]),                                   # 18 glow red signal
    ('22242a', [(0, 4, 32, 4, '30333a'), (0, 16, 32, 4, '30333a'), (0, 28, 32, 4, '30333a')]),  # 19 rubber tread
    ('e07a1e', [(3, 3, 26, 3, 'ee8c30'), (3, 26, 26, 3, 'c46612')]),          # 20 machine orange paint
    ('e8b830', [(3, 3, 26, 3, 'f4c848'), (3, 26, 26, 3, 'cc9e20')]),          # 21 robot yellow paint
]
start('Automine', 'automine', TILES, glowing={7, 8, 9, 16, 18})

def bevel_box(name, at, size, t, q=.12):
    """A chamfered box: the chunky toy-tech block (octagonal in plan, edges cut by q)."""
    x, y, z = at; w, h, d = size
    return prism(name, [(x + px, z + pz) for px, pz in stepped(w, d, min(q, w / 3, d / 3))], y - h / 2, y + h / 2, t)

# SERVICE STALL: the shared frame under a navy kiosk roof with an orange light strip and a data screen on top.
def kiosk_roof():
    bevel_box('Roof', (0, 3.75, 0), (5.9, .32, 3.7), 4, .3)
    box('RoofFascia', (0, 3.5, 1.78), (5.6, .3, .12), 0)
    box('RoofStrip', (0, 3.5, 1.86), (5.2, .1, .06), 8)
    box('ScreenBack', (0, 4.45, .9), (3.0, 1.1, .2), 0)
    box('Screen', (0, 4.45, 1.01), (2.7, .85, .04), 16)
    for x in (-1.2, 1.2): box('ScreenLeg', (x, 4.0, .9), (.14, .5, .14), 10)
stall('Stall_Sell', 'coin', kiosk_roof)
stall('Stall_Shop', 'pick', kiosk_roof)

# LAMP POST (the shared Lantern_Post slot and collider, .4 x 2.8): a gunmetal post with a cyan light bar.
model('Lantern_Post')
bevel_box('PostFoot', (0, .2, 0), (.6, .4, .6), 2, .12)
box('Post', (0, 1.45, 0), (.24, 2.5, .24), 0)
box('PostStripe', (0, .55, 0), (.26, .3, .26), 5)
box('Arm', (.38, 2.72, 0), (.9, .16, .2), 0)
box('LightBar', (.5, 2.6, 0), (.7, .08, .16), 7)

# NAME BOARD: gunmetal uprights with cyan caps; a glowing cyan edge round the navy screen.
def upright(x):
    bevel_box('UprightFoot', (x, .35, 0), (.9, .7, .9), 2, .2)
    box('Upright', (x, 3.9, 0), (.46, 7.4, .46), 0)
    box('UprightStripe', (x, 1.1, 0), (.5, .5, .5), 5)
    box('UprightCap', (x, 7.75, 0), (.7, .3, .7), 7)
name_board(upright)
for y in (4.86, 7.14): box('BoardEdge', (0, y, .08), (7.5, .1, .06), 7)
for x in (-3.72, 3.72): box('BoardEdge', (x, 6.0, .08), (.1, 2.38, .06), 7)

# PIT POST: a hazard-striped bollard with an orange signal lamp.
def bollard():
    box('Stripe', (0, .7, 0), (.5, .3, .5), 5)
    box('Lamp', (0, 1.2, 0), (.34, .2, .34), 8)
pit_post(bollard)

# MINING ROBOT, ~2.5 m: tread blocks, a chunky yellow body, a head with a cyan visor, one arm ending in a drill.
model('Robot_Miner')
for x in (-.75, .75):
    bevel_box('Tread', (x, .35, 0), (.5, .7, 1.7), 19, .15)
    box('TreadHub', (x * 1.03, .35, 0), (.08, .36, .36), 2)
bevel_box('Hip', (0, .85, 0), (1.3, .3, 1.0), 0, .12)
bevel_box('Body', (0, 1.5, 0), (1.5, 1.0, 1.1), 21, .2)
box('BodyPanel', (0, 1.55, .56), (.9, .5, .04), 0)
box('BodyLight', (0, 1.55, .59), (.6, .14, .03), 7)
bevel_box('Head', (0, 2.25, .05), (.9, .5, .8), 21, .14)
box('Visor', (0, 2.28, .46), (.7, .2, .04), 7)
box('Antenna', (.3, 2.65, -.2), (.06, .35, .06), 10)
box('AntennaTip', (.3, 2.85, -.2), (.12, .1, .12), 18)
bevel_box('Shoulder', (.95, 1.75, 0), (.4, .4, .4), 0, .1)
box('ArmUpper', (1.05, 1.45, .25), (.24, .7, .24), 2)
box('ArmFore', (1.05, 1.15, .7), (.26, .26, .8), 21)
# The drill points forward: a six-sided cone along +Z built from a spike laid on its side.
pts = []; s6 = 6
for zz, rr in ((1.1, .2), (1.25, .2), (1.75, 0)):
    for k in range(s6):
        a = 2 * math.pi * k / s6
        pts.append((1.05 + math.cos(a) * rr, 1.15 + math.sin(a) * rr, zz))
faces = [tuple(reversed(range(s6)))] + [(k, (k + 1) % s6, (k + 1) % s6 + s6, k + s6) for k in range(s6)] + [(s6 + k, s6 + (k + 1) % s6, 2 * s6 + (k + 1) % s6, 2 * s6 + k) for k in range(s6)]
mesh('Drill', pts, faces, 2)
bevel_box('ShoulderL', (-.95, 1.75, 0), (.4, .4, .4), 0, .1)
box('ArmL', (-1.0, 1.35, .15), (.24, .8, .24), 2)
box('ClawL', (-1.0, .9, .3), (.34, .2, .4), 0)

# DRILL MACHINE (static part): a big orange cabin on a gunmetal base with a mast; the spinning bit is Drill_Bit.
model('Drill_Machine')
bevel_box('Base', (0, .4, 0), (3.6, .8, 3.0), 0, .3)
for x in (-1.5, 1.5): box('BaseStripe', (x, .4, 1.52), (.5, .6, .04), 5)
bevel_box('Cabin', (-.7, 1.75, -.3), (1.8, 1.9, 2.0), 20, .25)
box('Window', (-.7, 2.1, .72), (1.3, .7, .04), 16)
box('Mast', (.9, 3.6, -.6), (.5, 6.4, .5), 0)
box('MastStripe', (.9, 2.0, -.33), (.52, .8, .04), 5)
bevel_box('Motor', (.9, 5.4, .2), (1.1, 1.0, 1.1), 20, .18)
box('MotorLight', (.9, 5.4, .77), (.5, .3, .04), 8)
box('Spindle', (.9, 3.8, .2), (.3, 2.4, .3), 2)
box('Hose', (.0, 3.0, -.9), (1.6, .18, .18), 13)

# DRILL BIT (spins about its own vertical axis): a ribbed chunky auger with a point.
model('Drill_Bit')
lathe('Auger', [(0, 0), (.5, .32), (.75, .38), (1.1, .3), (1.35, .38), (1.7, .3), (1.95, .38), (2.3, .26)], 6, 2, cap_bottom=False)
for k in range(3):
    a = k * 2 * math.pi / 3
    box('Flute', (math.cos(a) * .3, 1.4, math.sin(a) * .3), (.14, 1.6, .14), 20)

# WALL FAN (static frame, front +Z) and its BLADES (spin about Z through the origin).
model('Fan_Frame')
prism('Housing', [(x, y) for x, y in circle(1.45, 8, 0, 0, math.pi / 8)], -.5, 0, 0, axis='z')
prism('Rim', [(x, y) for x, y in circle(1.25, 8, 0, 0, math.pi / 8)], 0, .08, 5, axis='z')
prism('Hub', [(x, y) for x, y in circle(.32, 8)], -.1, .25, 2, axis='z')
box('RimLight', (0, -1.38, .05), (1.0, .1, .1), 7)
model('Fan_Blades')
prism('Spinner', [(x, y) for x, y in circle(.26, 8)], .1, .32, 1, axis='z')
for k in range(4):
    a = k * math.pi / 2 + .3
    c, s = math.cos(a), math.sin(a)
    blade = [(.2, -.16), (1.1, -.26), (1.15, .22), (.2, .14)]
    prism('Blade', [(px * c - py * s, px * s + py * c) for px, py in blade], .12, .2, 1, axis='z')

# BULKHEAD wall panel (front +Z, 4 m wide, 5 m tall): a framed light panel with a vent, a screen and a cyan strip.
model('Bulkhead')
box('Frame', (0, 2.5, -.2), (4.2, 5.0, .4), 0)
box('Panel', (0, 2.6, .02), (3.6, 4.2, .1), 1)
box('PanelSeam', (0, 2.6, .08), (3.6, .08, .04), 2)
box('Vent', (-.95, 1.35, .09), (1.2, 1.1, .06), 17)
box('Screen', (.9, 3.4, .1), (1.4, 1.0, .06), 16)
box('Strip', (0, 4.65, .1), (3.6, .12, .06), 7)
box('Foot', (0, .25, .05), (4.3, .5, .6), 5)
for x in (-1.8, 1.8):
    for y in (.8, 4.4): box('Bolt', (x, y, .1), (.16, .16, .06), 2)

# ORE HOPPER at a conveyor's end: a funnel bin on legs with an orange warning band and a level light.
model('Ore_Hopper')
for x in (-1, 1):
    for z in (-1, 1): box('Leg', (x, 1.0, z), (.25, 2.0, .25), 0)
prism('Bin', [(px, pz) for px, pz in stepped(2.8, 2.8, .4)], 2.0, 3.4, 2)
box('Band', (0, 3.1, 1.42), (2.4, .3, .04), 5)
box('LevelLight', (0, 2.5, 1.42), (.6, .25, .04), 8)
for k in range(5): box('Ore', (-.8 + k * .4, 3.5, (k % 2) * .4 - .2), (.4, .3, .4), 12)

# CRUSHER at the west conveyor's end: an orange machine block with a hopper mouth and a glowing gauge.
model('Crusher')
bevel_box('Body', (0, 1.2, 0), (3.0, 2.4, 2.4), 20, .3)
bevel_box('Mouth', (0, 2.7, 0), (2.2, .6, 1.8), 0, .2)
box('Gauge', (0, 1.5, 1.22), (1.2, .7, .04), 16)
box('Stripe', (0, .4, 1.21), (2.8, .3, .04), 5)
for x in (-1.6, 1.6): box('Vent', (x, 1.4, 0), (.06, 1.0, 1.6), 17)

# ORE CART for the rail: a navy tub on a gunmetal chassis, cobalt ore heaped on top, a cyan running light.
model('Ore_Cart')
bevel_box('Chassis', (0, .45, 0), (1.3, .3, 2.0), 0, .12)
for z in (-.65, .65):
    for x in (-.68, .68): box('Wheel', (x, .3, z), (.14, .48, .48), 10)
bevel_box('Tub', (0, .95, 0), (1.25, .7, 1.9), 4, .16)
box('TubBand', (0, 1.1, .96), (1.1, .2, .04), 5)
box('RunLight', (0, .7, 1.01), (.6, .1, .04), 7)
for k in range(4): box('Ore', (-.35 + (k % 2) * .7, 1.4, -.5 + (k // 2) * .9), (.45, .3, .45), 12)

# GARAGE GATE (front +Z), set against the south wall: a hazard-striped frame round a half-open roller door
# with the bay glowing orange behind it.
model('Garage_Gate')
for x in (-2.6, 2.6): box('Pillar', (x, 2.4, 0), (.8, 4.8, 1.0), 5)
box('Lintel', (0, 5.1, 0), (6.0, .9, 1.1), 0)
box('LintelSign', (0, 5.1, .57), (3.0, .5, .04), 16)
box('Bay', (0, 2.2, -.6), (4.4, 4.4, .2), 8)
box('Door', (0, 3.4, -.1), (4.4, 2.6, .2), 2)
for y in (2.4, 3.0, 3.6, 4.2): box('DoorRib', (0, y, .02), (4.4, .1, .06), 0)
box('DoorEdge', (0, 2.12, .02), (4.4, .14, .08), 5)
for x in (-2.6, 2.6): box('Signal', (x, 4.95, .52), (.3, .3, .1), 18)

# CRATE STACK: two chunky navy-and-grey crates and a small one.
model('Crate_Stack')
for (x, y, z, s, t) in ((0, .5, 0, 1.0, 4), (.15, 1.4, .05, .8, 1), (1.05, .35, .2, .7, 20)):
    bevel_box('Crate', (x, y, z), (s, s * .9 if y > .5 else s, s), t, .1)
    box('CrateBand', (x, y, z + s / 2 + .01), (s * .8, .12, .03), 5)

finish(__file__)
