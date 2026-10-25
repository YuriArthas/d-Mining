"""自动化矿道 hall props (world 2, layer 1): a near-future mining base built into the cave, plastic-toy tech style.
The world 2 base kit (tech_props.py: kiosks, lamp post, name board, bollard, ceiling lamp, crates) with a cyan
accent, then chunky mining robots, a drill machine with its spinning bit, wall fans with spinning blades, bulkhead
wall panels, an ore hopper, a crusher, an ore cart, a hazard-striped garage gate, and the hero on the north wall: a
tunnel boring machine's shield in the shared facade, its cutterhead turning.
Run: blender -b --python tools/blender/build_automine.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import finish, model, mesh, box, lathe, prism, stepped, circle
from tech_props import tech_start, tech_services, tech_facade, bevel_box, ring_segments

# The world 2 base kit (tech_props.py) with a deep cyan accent, then this hall's own tiles. Glow tiles are deep and
# saturated: the atlas emission (x2.2) on top of the lit colour would wash bright ones out.
ACCENT = ('1890b0', '22a8cc')
TILES = [
    ('e07a1e', [(3, 3, 26, 3, 'ee8c30'), (3, 26, 26, 3, 'c46612')]),          # 20 machine orange paint
    ('e8b830', [(3, 3, 26, 3, 'f4c848'), (3, 26, 26, 3, 'cc9e20')]),          # 21 robot yellow paint
    ('24324a', [(2, 14, 28, 2, '31415c')]),                                   # 22 navy
    ('c25a0a', [(6, 6, 20, 20, 'd86c14')]),                                   # 23 glow orange (deep)
    ('4a6ad8', [(4, 4, 8, 20, '6a86f0'), (18, 8, 6, 16, '3a56b8')]),          # 24 cobalt ore
    ('0e5a78', [(4, 6, 18, 3, '1c8cb0'), (4, 13, 12, 3, '1c8cb0'), (4, 20, 22, 3, '1c8cb0')]),  # 25 glow screen, data rows
    ('22242a', [(0, 4, 32, 4, '30333a'), (0, 16, 32, 4, '30333a'), (0, 28, 32, 4, '30333a')]),  # 26 rubber tread
]
tech_start('Automine', 'automine', ACCENT, TILES, glowing={23, 25})
tech_services()

# MINING ROBOT, ~2.5 m: tread blocks, a chunky yellow body, a head with a cyan visor, one arm ending in a drill.
model('Robot_Miner')
for x in (-.75, .75):
    bevel_box('Tread', (x, .35, 0), (.5, .7, 1.7), 26, .15)
    box('TreadHub', (x * 1.03, .35, 0), (.08, .36, .36), 2)
bevel_box('Hip', (0, .85, 0), (1.3, .3, 1.0), 0, .12)
bevel_box('Body', (0, 1.5, 0), (1.5, 1.0, 1.1), 21, .2)
box('BodyPanel', (0, 1.55, .56), (.9, .5, .04), 0)
box('BodyLight', (0, 1.55, .59), (.6, .14, .03), 7)
bevel_box('Head', (0, 2.25, .05), (.9, .5, .8), 21, .14)
box('Visor', (0, 2.28, .46), (.7, .2, .04), 7)
box('Antenna', (.3, 2.65, -.2), (.06, .35, .06), 10)
box('AntennaTip', (.3, 2.85, -.2), (.12, .1, .12), 8)
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
box('Window', (-.7, 2.1, .72), (1.3, .7, .04), 25)
box('Mast', (.9, 3.6, -.6), (.5, 6.4, .5), 0)
box('MastStripe', (.9, 2.0, -.33), (.52, .8, .04), 5)
bevel_box('Motor', (.9, 5.4, .2), (1.1, 1.0, 1.1), 20, .18)
box('MotorLight', (.9, 5.4, .77), (.5, .3, .04), 23)
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
box('Vent', (-.95, 1.35, .09), (1.2, 1.1, .06), 18)
box('Screen', (.9, 3.4, .1), (1.4, 1.0, .06), 25)
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
box('LevelLight', (0, 2.5, 1.42), (.6, .25, .04), 23)
for k in range(5): box('Ore', (-.8 + k * .4, 3.5, (k % 2) * .4 - .2), (.4, .3, .4), 24)

# CRUSHER at the west conveyor's end: an orange machine block with a hopper mouth and a glowing gauge.
model('Crusher')
bevel_box('Body', (0, 1.2, 0), (3.0, 2.4, 2.4), 20, .3)
bevel_box('Mouth', (0, 2.7, 0), (2.2, .6, 1.8), 0, .2)
box('Gauge', (0, 1.5, 1.22), (1.2, .7, .04), 25)
box('Stripe', (0, .4, 1.21), (2.8, .3, .04), 5)
for x in (-1.6, 1.6): box('Vent', (x, 1.4, 0), (.06, 1.0, 1.6), 18)

# ORE CART for the rail: a navy tub on a gunmetal chassis, cobalt ore heaped on top, a cyan running light.
model('Ore_Cart')
bevel_box('Chassis', (0, .45, 0), (1.3, .3, 2.0), 0, .12)
for z in (-.65, .65):
    for x in (-.68, .68): box('Wheel', (x, .3, z), (.14, .48, .48), 10)
bevel_box('Tub', (0, .95, 0), (1.25, .7, 1.9), 22, .16)
box('TubBand', (0, 1.1, .96), (1.1, .2, .04), 5)
box('RunLight', (0, .7, 1.01), (.6, .1, .04), 7)
for k in range(4): box('Ore', (-.35 + (k % 2) * .7, 1.4, -.5 + (k // 2) * .9), (.45, .3, .45), 24)

# GARAGE GATE (front +Z), set against the south wall: a hazard-striped frame round a half-open roller door
# with the bay glowing orange behind it.
model('Garage_Gate')
for x in (-2.6, 2.6): box('Pillar', (x, 2.4, 0), (.8, 4.8, 1.0), 5)
box('Lintel', (0, 5.1, 0), (6.0, .9, 1.1), 0)
box('LintelSign', (0, 5.1, .57), (3.0, .5, .04), 25)
box('Bay', (0, 2.2, -.6), (4.4, 4.4, .2), 23)
box('Door', (0, 3.4, -.1), (4.4, 2.6, .2), 2)
for y in (2.4, 3.0, 3.6, 4.2): box('DoorRib', (0, y, .02), (4.4, .1, .06), 0)
box('DoorEdge', (0, 2.12, .02), (4.4, .14, .08), 5)
for x in (-2.6, 2.6): box('Signal', (x, 4.95, .52), (.3, .3, .1), 8)

# THE NORTH WALL: the shared facade (navy panels), and the tunnel boring machine's SHIELD set in it (origin at its
# centre, front +Z): a broad white ring with a yellow outer band, a cyan glow lip, dark seams, four hydraulic rams
# at the diagonals reaching into the rock. Its CUTTERHEAD turns inside (TBM_Cutter, about z, face toward +Z): a
# dark disc, six yellow spokes and a rim, rows of steel disc cutters, muck slots and a white hub with a cyan cap.
tech_facade('TBM_Facade', 22)
model('TBM_Shield')
ring_segments('Shield', 5.2, 6.4, -.8, .6, 28, 1)
ring_segments('ShieldBand', 6.4, 6.75, -.6, .4, 28, 11)
ring_segments('ShieldLip', 5.0, 5.22, -.5, .72, 28, 7)
for k in range(8):
    a = k * math.pi / 4 + math.pi / 8; c, s_ = math.cos(a), math.sin(a)
    prism('Seam', [(c * 5.3 - s_ * .06, s_ * 5.3 + c * .06), (c * 6.3 - s_ * .06, s_ * 6.3 + c * .06), (c * 6.3 + s_ * .06, s_ * 6.3 - c * .06), (c * 5.3 + s_ * .06, s_ * 5.3 - c * .06)], .6, .64, 0, axis='z')
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2; c, s_ = math.cos(a), math.sin(a)
    rot = lambda pts: [(px * c - py * s_, px * s_ + py * c) for px, py in pts]
    prism('Ram', rot([(6.6, -.32), (8.6, -.32), (8.6, .32), (6.6, .32)]), -.5, .14, 2, axis='z')
    prism('RamSleeve', rot([(6.5, -.5), (7.4, -.5), (7.4, .5), (6.5, .5)]), -.6, .3, 21, axis='z')
    prism('RamFoot', rot([(8.4, -.7), (9.0, -.7), (9.0, .7), (8.4, .7)]), -.7, .2, 0, axis='z')
model('TBM_Cutter')
prism('Face', circle(5.0, 28), -.4, .1, 10, axis='z')
ring_segments('Rim', 4.55, 5.0, .1, .5, 28, 21)
for k in range(6):
    a = k * math.pi / 3; c, s_ = math.cos(a), math.sin(a)
    rot = lambda pts: [(px * c - py * s_, px * s_ + py * c) for px, py in pts]
    prism('Spoke', rot([(.9, -.42), (4.6, -.5), (4.6, .5), (.9, .42)]), .1, .55, 21, axis='z')
    for rr in (1.9, 3.0, 4.1): prism('Cutter', circle(.26, 8, c * rr, s_ * rr), .55, .78, 2, axis='z')
    b = a + math.pi / 6; cb, sb = math.cos(b), math.sin(b)
    for rr in (2.4, 3.6): prism('Cutter', circle(.24, 8, cb * rr, sb * rr), .1, .34, 2, axis='z')
    prism('MuckSlot', [(cb * 3.9 - sb * .45, sb * 3.9 + cb * .45), (cb * 4.45 - sb * .55, sb * 4.45 + cb * .55), (cb * 4.45 + sb * .55, sb * 4.45 - cb * .55), (cb * 3.9 + sb * .45, sb * 3.9 - cb * .45)], .1, .14, 15, axis='z')
prism('Hub', circle(1.05, 12), .1, .95, 1, axis='z')
prism('HubBand', circle(1.12, 12), .45, .6, 11, axis='z')
prism('HubCap', circle(.5, 10), .95, 1.15, 7, axis='z')

finish(__file__)
