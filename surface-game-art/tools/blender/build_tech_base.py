"""第二世界 surface base props, "plastic-toy tech": the drill rig and its spinning bit, the ore buyer and the gear
workshop, the world portal frame, storage tanks, the teleport station, wind turbines (tower + spinning rotor), solar rows, a habitat dome and module, the ore silo and
its conveyor (frame, sliding cleats and ore), cargo containers, lamp posts, hazard bollards, an antenna mast and a
parked mining mech. Chunky chamfered blocks, mid-tone greys, one glow accent per piece, hazard stripes.
Run: blender -b --python tools/blender/build_tech_base.py
Shared atlas, primitives and report in cave_props.py; tools/underground/techBaseHall.ts places the props.
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle

# Panels carry thick dark seams inside the tile (the face UVs span its inner 27 px). Glow tiles are deep and
# saturated: the emission (x2.2) plus the lit colour must stay cyan/orange, not wash out to white.
SEAM = '2c323c'
def panel(base, light, dark):
    return (base, [(3, 3, 26, 2, light), (3, 27, 26, 2, dark), (3, 3, 2, 26, light), (27, 3, 2, 26, dark), (3, 15, 26, 2, SEAM)])
TILES = [
    ('3a414c', [(3, 3, 26, 2, '4a525e'), (3, 26, 26, 3, '2c323c')]),          # 0 gunmetal frame
    panel('c9ced6', 'dde1e7', '8f96a2'),                                       # 1 light panel, seams
    panel('8d95a1', '9ea6b2', '646c78'),                                       # 2 mid grey panel
    ('4a525e', [(5, 5, 4, 22, '363c46'), (14, 5, 4, 22, '363c46'), (23, 5, 4, 22, '363c46')]),  # 3 grating
    panel('24324a', '33456a', '18223a'),                                       # 4 navy
    ('f2c230', [(3, 3, 6, 26, '2a2a2e'), (15, 3, 6, 26, '2a2a2e'), (27, 3, 2, 26, '2a2a2e')]),  # 5 hazard stripes
    panel('d8dde4', 'e6e9ee', 'a9b0ba'),                                       # 6 pale panel (never pure white)
    ('0e8eb0', [(6, 6, 20, 20, '24b8d8'), (11, 11, 10, 10, '40d4ee')]),        # 7 glow cyan (deep)
    ('c4520a', [(6, 6, 20, 20, 'dc6a14'), (11, 11, 10, 10, 'ee8a24')]),        # 8 glow orange (deep)
    ('b08a50', [(6, 6, 20, 20, 'c8a068')]),                                    # 9 glow warm white
    ('2a2e36', [(3, 3, 26, 2, '363b45')]),                                     # 10 dark iron
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),           # 11 gold
    ('5a7cf0', [(4, 4, 8, 20, '8aa4ff'), (18, 8, 6, 16, '3a5ad0')]),           # 12 cobalt ore
    ('3a3f48', [(2, 10, 28, 3, '4a505a')]),                                    # 13 cable
    ('1c2a3a', [(4, 5, 24, 3, '263648')]),                                     # 14 screen
    ('16181e', []),                                                            # 15 shadow
    panel('e0782a', 'f08e44', 'b65a1a'),                                       # 16 orange paint
    panel('2a9a9a', '3cb2b0', '1e7676'),                                       # 17 teal paint
    ('1c3a6a', [(3, 3, 26, 2, '5a86c8'), (3, 15, 26, 2, '5a86c8'), (3, 27, 26, 2, '5a86c8'), (3, 3, 2, 26, '5a86c8'), (15, 3, 2, 26, '5a86c8'), (27, 3, 2, 26, '5a86c8')]),  # 18 solar cells
    ('2a2c30', [(3, 14, 26, 4, '34373c')]),                                    # 19 rubber belt
    ('b8a48a', [(4, 5, 10, 3, 'c8b49a')]),                                     # 20 concrete
    panel('b03a30', 'c84e42', '882a22'),                                       # 21 red paint
]
start('TechBase', 'tech-base', TILES, glowing={7, 8, 9})

def cbox(name, at, size, t, q=None):
    """A box with chamfered vertical edges (the chunky toy look)."""
    x, y, z = at; w, h, d = size
    q = min(w, d) * .14 if q is None else q
    return prism(name, [(px + x, pz + z) for px, pz in stepped(w, d, q)], y - h / 2, y + h / 2, t)
def beam(name, a, b, w, h, t):
    """A square beam from point a to point b (w across, h up)."""
    ax, ay, az = a; bx, by, bz = b
    d = [bx - ax, by - ay, bz - az]; L = math.sqrt(sum(v * v for v in d)); d = [v / L for v in d]
    up = [0, 1, 0] if abs(d[1]) < .95 else [1, 0, 0]
    side = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]
    n = math.sqrt(sum(v * v for v in side)); side = [v / n for v in side]
    up2 = [side[1] * d[2] - side[2] * d[1], side[2] * d[0] - side[0] * d[2], side[0] * d[1] - side[1] * d[0]]
    v = []
    for e in (a, b):
        for s, u in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            v.append(tuple(e[k] + side[k] * s * w / 2 + up2[k] * u * h / 2 for k in range(3)))
    return mesh(name, v, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], t)
def slab(name, top, thick, t):
    """A slab under four top corners."""
    v = list(top) + [(x, y - thick, z) for x, y, z in top]
    return mesh(name, v, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], t)

# SERVICE BUILDINGS, front +Z, 11 x 8 m on a plinth: a tall hall with a facade screen (the game's sign floats in
# front of it), a roll-up door over a raised dock on one side and a counter window under an awning on the other
# (the service ring stands before the window), roof machinery and a stack. `door` is the door's side (+1 / -1).
def hall(name, paint, accent, door):
    model(name)
    cbox('Plinth', (0, .2, 0), (11.6, .4, 8.6), 0)
    box('PlinthStripe', (0, .42, 4.25), (11.0, .06, .14), 5)
    cbox('Hall', (0, 3.2, -.6), (10.4, 5.6, 6.6), 6)
    cbox('HallBand', (0, .95, -.6), (10.6, .9, 6.8), paint)
    cbox('HallTop', (0, 6.15, -.6), (10.6, .3, 6.8), 2)
    cbox('Parapet', (0, 6.55, -.6), (10.7, .5, 6.9), 0)
    box('FacadeScreen', (0, 4.95, 2.75), (6.2, 1.6, .14), 14)
    for y in (4.05, 5.85): box('FacadeGlow', (0, y, 2.8), (6.4, .14, .12), accent)
    dx, wx = door * 2.6, -door * 2.8
    for x in (dx - 1.95, dx + 1.95): box('DoorFrame', (x, 2.1, 2.76), (.3, 3.8, .2), 5)
    box('DoorHeader', (dx, 4.05, 2.76), (4.2, .3, .2), 5)
    box('Door', (dx, 2.15, 2.72), (3.6, 3.5, .1), 2)
    for y in (1.0, 1.7, 2.4, 3.1): box('DoorRib', (dx, y, 2.79), (3.5, .08, .06), 0)
    cbox('Dock', (dx, .6, 3.95), (5.2, 1.0, 2.6), 2)
    box('DockEdge', (dx, 1.12, 5.22), (5.2, .06, .12), 5)
    cbox('DockStep', (dx - door * 3.15, .3, 4.3), (1.1, .6, 1.8), 2)
    cbox('Cart', (dx + door * .8, 1.6, 3.8), (1.7, .9, 1.1), paint)
    for k in range(3): cbox('CartOre', (dx + door * (.3 + k * .45), 2.2, 3.8), (.42, .38, .42), 12 if k != 1 else 11, q=.08)
    cbox('CranePost', (dx + door * 2.4, 3.3, 4.75), (.4, 5.4, .4), 0, q=.06)
    beam('CraneArm', (dx + door * 2.4, 5.7, 4.75), (dx - door * .4, 5.7, 4.75), .35, .4, paint)
    box('CraneHook', (dx - door * .2, 4.75, 4.75), (.1, 1.5, .1), 13)
    cbox('CraneLoad', (dx - door * .2, 3.75, 4.75), (.9, .6, .9), 12, q=.1)
    box('Window', (wx, 2.25, 2.72), (2.8, 1.5, .08), 14)
    box('WindowGlow', (wx, 3.08, 2.8), (3.0, .12, .12), accent)
    for x in (wx - 1.5, wx + 1.5): box('WindowFrame', (x, 2.25, 2.78), (.18, 1.7, .14), 0)
    cbox('Counter', (wx, .95, 3.35), (3.4, 1.1, 1.1), 6)
    cbox('CounterTop', (wx, 1.56, 3.4), (3.7, .14, 1.4), 0)
    box('CounterGlow', (wx, 1.05, 3.92), (3.0, .14, .05), accent)
    cbox('Awning', (wx, 3.55, 3.45), (3.9, .25, 1.7), paint)
    box('AwningGlow', (wx, 3.4, 4.28), (3.6, .08, .08), accent)
    cbox('RoofHopper', (dx, 7.75, -2.0), (3.0, 2.0, 2.6), paint)
    box('HopperMouth', (dx, 8.76, -2.0), (2.5, .06, 2.1), 15)
    lathe('Stack', [(6.8, .5), (10.8, .42)], 8, 2, cx=-dx * 1.35, cz=-2.9)
    lathe('StackBand', [(10.0, .46), (10.4, .46)], 8, 5, cx=-dx * 1.35, cz=-2.9, cap_bottom=False)
    cbox('RoofUnit', (wx * .3, 7.25, -2.6), (2.4, .9, 1.8), 2)
    box('Vent', (wx * .3, 7.25, -1.68), (2.0, .5, .06), 3)
    for x in (-5.25, 5.25): box('CornerGlow', (x, 3.4, 2.74), (.12, 4.4, .06), accent)
hall('Ore_Buyer', 16, 8, -1)
# The ore buyer's coin plate on the screen's end, and an ore heap by its dock.
plate = circle(.55, 12, -4.2, 4.95)
prism('CoinPlate', plate, 2.82, 2.9, 10, axis='z')
prism('Coin', circle(.38, 10, -4.2, 4.95), 2.9, 3.0, 11, axis='z')
for k, (x, z, sz) in enumerate(((-6.4, 4.4, .9), (-6.9, 3.4, .7), (-6.0, 3.6, .6), (-6.6, 5.2, .55), (-7.2, 4.6, .5))):
    cbox('OreHeap', (x, sz / 2, z), (sz, sz, sz), 12 if k % 2 == 0 else 11, q=sz * .2)
hall('Gear_Workshop', 17, 7, 1)
# The workshop's giant pickaxe on its roof, and a workbench with a tool rack by its door.
prism('PickHead', [(-2.4, 9.6), (-.8, 10.2), (.8, 10.2), (2.4, 9.6), (2.0, 9.25), (0, 9.7), (-2.0, 9.25)], -.8, -.4, 12)
prism('PickHandle', [(-.2, 6.9), (.2, 6.9), (.2, 9.8), (-.2, 9.8)], -.75, -.45, 16)
cbox('PickMount', (0, 6.95, -.6), (1.6, .4, .8), 0)
cbox('Bench', (6.9, .85, 3.8), (1.0, .9, 2.4), 2)
cbox('BenchTop', (6.9, 1.36, 3.8), (1.2, .12, 2.6), 0)
cbox('Rack', (7.35, 2.2, 3.8), (.2, 1.6, 2.4), 4)
for k in range(3):
    cbox('Tool', (7.22, 2.3, 3.0 + k * .8), (.08, 1.0, .14), 2, q=.02)
    cbox('ToolHead', (7.2, 2.85, 3.0 + k * .8), (.1, .16, .5), 12 if k != 1 else 11, q=.03)
prism('PickPlate', circle(.55, 12, 4.2, 4.95), 2.82, 2.9, 10, axis='z')
prism('PickBadge', [(3.85, 5.1), (4.05, 5.2), (4.35, 5.2), (4.55, 5.1), (4.45, 5.0), (4.2, 5.08), (3.95, 5.0)], 2.9, 3.0, 12, axis='z')

# WORLD PORTAL FRAME, front +Z (placed facing the shaft): a low round base (kept behind the portal's zone, which
# stays at ground level) with a glowing rim, two navy pillars at
# +-2.6 with fins, a lintel at 6.5 m and a ring frame round the portal disc (radius 1.85, 2.9 m up).
model('Portal_Frame')
lathe('Base', [(0, 2.6), (.2, 2.6), (.26, 2.45)], 14, 0)
lathe('BaseGlow', [(.26, 2.38), (.28, 2.38), (.29, 2.24)], 28, 8, cap_bottom=False, cap_top=False)
lathe('BaseTop', [(.27, 2.24), (.29, 2.24)], 28, 4, cap_bottom=False)
for sx in (-1, 1):
    cbox('PillarFoot', (sx * 2.6, .7, 0), (1.5, .8, 1.5), 0)
    cbox('Pillar', (sx * 2.6, 3.4, 0), (1.0, 6.0, 1.1), 4)
    box('PillarGlow', (sx * 2.6, 3.4, .56), (.16, 4.6, .04), 8)
    cbox('Fin', (sx * 3.4, 2.7, 0), (.5, 4.2, .8), 2)
    beam('RingArm', (sx * 2.12, 2.9, 0), (sx * 2.42, 2.9, 0), .36, .36, 0)
cbox('Lintel', (0, 6.7, 0), (7.0, .9, 1.3), 4)
box('LintelGlow', (0, 6.7, .66), (6.2, .16, .04), 8)
for k in range(16):
    a0, a1 = k * math.pi / 8, (k + 1) * math.pi / 8
    beam('Ring', (math.cos(a0) * 2.15, 2.9 + math.sin(a0) * 2.15, 0), (math.cos(a1) * 2.15, 2.9 + math.sin(a1) * 2.15, 0), .4, .36, 0)
    beam('RingGlow', (math.cos(a0) * 1.95, 2.9 + math.sin(a0) * 1.95, 0), (math.cos(a1) * 1.95, 2.9 + math.sin(a1) * 1.95, 0), .12, .4, 8)

# STORAGE TANK (origin at its foot), 5.9 m: a banded cylinder with a dome, a ladder and a glowing gauge.
model('Storage_Tank')
lathe('Foot', [(0, 1.9), (.4, 1.9), (.5, 1.75)], 12, 0)
lathe('Body', [(.5, 1.6), (1.4, 1.6), (1.7, 1.6), (4.0, 1.6), (4.3, 1.6), (4.6, 1.6)], 12, 1, tiles_by_band=[1, 16, 1, 16, 1], cap_bottom=False, cap_top=False)
lathe('Dome', [(4.6, 1.6), (5.2, 1.35), (5.7, .8), (5.9, .1)], 12, 2)
box('Ladder', (1.66, 2.9, 0), (.08, 4.8, .5), 0)
box('Gauge', (0, 3.0, 1.62), (.7, .7, .06), 7)

# DRILL RIG over the shaft (origin at the shaft's centre): four legs at +-10.4 on hazard-striped feet, beams round
# the sides at 9.6 m (above the mine signs) and a deck frame at 15 m with diagonal braces above head height, a motor housing hanging over
# the middle down to 10.5 m and the drill stem to 8.6 m (the bit spins below it, Drill_Bit).
L, DECK = 10.4, 15.0
model('Drill_Rig')
for sx in (-1, 1):
    for sz in (-1, 1):
        x, z = sx * L, sz * L
        cbox('Foot', (x, .25, z), (2.0, .5, 2.0), 0)
        cbox('FootStripe', (x, .8, z), (1.4, .6, 1.4), 5)
        cbox('Leg', (x, 8.0, z), (1.1, 14.4, 1.1), 2)
        box('LegGlow', (x + sx * .56, 8.0, z + sz * .2), (.04, 11.0, .18), 7)
        cbox('LegCap', (x, 15.35, z), (1.5, .5, 1.5), 0)
for s in (-1, 1):
    beam('SideBeamX', (-L, 9.6, s * L), (L, 9.6, s * L), .6, .7, 0)
    beam('SideBeamZ', (s * L, 9.6, -L), (s * L, 9.6, L), .6, .7, 0)
    beam('DeckBeamX', (-L, DECK, s * L), (L, DECK, s * L), .9, .9, 1)
    beam('DeckBeamZ', (s * L, DECK, -L), (s * L, DECK, L), .9, .9, 1)
    for d in (-1, 1):  # a V of braces on every side, from the side beam's ends up to the deck's middle
        beam('Brace', (d * L, 10.0, s * L), (0, DECK - .5, s * L), .4, .4, 2)
        beam('Brace', (s * L, 10.0, d * L), (s * L, DECK - .5, 0), .4, .4, 2)
for s in (-1, 1):
    beam('CrossBeam', (s * L, DECK + .2, s * L), (0, DECK + .2, 0), .7, .7, 0)
    beam('CrossBeam', (s * L, DECK + .2, -s * L), (0, DECK + .2, 0), .7, .7, 0)
for s in (-1, 1):  # deck parapets with a glowing rail
    box('Parapet', (0, DECK + .9, s * L), (2 * L + .8, .6, .3), 4)
    box('Parapet', (s * L, DECK + .9, 0), (.3, .6, 2 * L + .8), 4)
    box('ParapetGlow', (0, DECK + 1.24, s * L), (2 * L, .08, .34), 7)
    box('ParapetGlow', (s * L, DECK + 1.24, 0), (.34, .08, 2 * L), 7)
cbox('Housing', (0, 13.0, 0), (4.4, 5.0, 4.4), 1)
cbox('HousingBand', (0, 11.1, 0), (4.6, .7, 4.6), 5)
cbox('HousingTop', (0, 15.75, 0), (3.6, .6, 3.6), 0)
for k in range(4):
    a = k * math.pi / 2; c, s = math.cos(a), math.sin(a)
    box('HousingGlow', (c * 2.23, 13.6, s * 2.23), (.1 if abs(c) > .5 else 3.0, 2.2, 3.0 if abs(c) > .5 else .1), 7)
cbox('Motor', (0, 16.9, 0), (2.4, 1.8, 2.4), 16)
lathe('Pulley', [(18.0, .3), (18.2, .3)], 12, 0)
prism('Wheel', circle(1.2, 12, 0, 18.9), -.25, .25, 10, axis='z')
prism('WheelHub', circle(.35, 8, 0, 18.9), -.35, .35, 8, axis='z')
cbox('Beacon', (1.4, 18.0, 1.4), (.3, .3, .3), 8, q=.05)
lathe('Stem', [(8.6, .38), (10.6, .38)], 8, 10, cap_top=False)
lathe('Collar', [(10.3, .8), (10.6, .9), (10.75, .6)], 10, 0)
box('Sign', (0, 13.6, 2.27), (2.8, 1.0, .08), 14)
box('SignGlow', (0, 13.6, 2.3), (2.2, .2, .04), 8)

# DRILL BIT, spinning about y (origin at its top, hanging 2.4 m): a fluted cone with three orange cutter fins.
model('Drill_Bit')
lathe('BitCone', [(-2.4, .02), (-2.0, .32), (-1.0, .78), (-.3, .9), (0, .7)], 8, 2)
lathe('BitCollar', [(-.1, .55), (.05, .6), (.15, .4)], 8, 7)
for k in range(3):
    a = k * 2 * math.pi / 3; a2 = a + .55
    beam('Fin', (math.cos(a) * .3, -2.1, math.sin(a) * .3), (math.cos(a2) * 1.0, -.4, math.sin(a2) * 1.0), .18, .5, 16)

# TELEPORT STATION (local +Z faces the pad and the spawn): a round platform with a glowing rim, two pillars at
# +-1.9 across, a lintel, and an octagonal ring frame round the portal disc (2.75 m up, ~1.34 m radius).
model('Tech_Station')
lathe('Platform', [(0, 3.1), (.32, 3.1), (.4, 2.95)], 12, 0)
lathe('PlatformGlow', [(.4, 2.72), (.43, 2.72), (.44, 2.58)], 24, 7, cap_bottom=False)
cbox('Step', (0, .1, 3.0), (2.6, .2, 1.4), 2)
for sx in (-1, 1):
    cbox('Pillar', (sx * 1.9, 2.8, 0), (.85, 4.8, .85), 1)
    box('PillarGlow', (sx * 1.9, 2.8, .44), (.14, 3.6, .04), 7)
    cbox('PillarFoot', (sx * 1.9, .7, 0), (1.15, .6, 1.15), 5)
    cbox('PillarCap', (sx * 1.9, 5.3, 0), (1.15, .3, 1.15), 0)
cbox('Lintel', (0, 5.65, 0), (5.0, .6, 1.0), 4)
box('LintelGlow', (0, 5.65, .51), (4.2, .14, .04), 7)
for k in range(12):
    a0, a1 = k * math.pi / 6, (k + 1) * math.pi / 6
    beam('Ring', (math.cos(a0) * 1.62, 2.75 + math.sin(a0) * 1.62, 0), (math.cos(a1) * 1.62, 2.75 + math.sin(a1) * 1.62, 0), .34, .3, 2)
    beam('RingGlow', (math.cos(a0) * 1.42, 2.75 + math.sin(a0) * 1.42, 0), (math.cos(a1) * 1.42, 2.75 + math.sin(a1) * 1.42, 0), .1, .34, 7)
for sx in (-1, 1):
    beam('RingArm', (sx * 1.78, 2.75, 0), (sx * 1.5, 2.75, 0), .3, .3, 0)

# WIND TURBINE: a tapered tower (22.6 m to the hub) with a nacelle; the rotor turns about its own z.
model('Wind_Turbine_Tower')
cbox('Base', (0, .5, 0), (3.2, 1.0, 3.2), 20)
lathe('Tower', [(1.0, .95), (8, .78), (16, .6), (22.0, .48)], 8, 6, tiles_by_band=[6, 6, 6])
lathe('TowerStripe', [(2.0, .94), (2.6, .93)], 8, 5, cap_bottom=False, cap_top=False)
cbox('Nacelle', (0, 22.6, -.3), (1.5, 1.5, 3.4), 6)
cbox('NacelleTrim', (0, 23.4, -.6), (1.2, .16, 2.4), 2)
cbox('NacelleLight', (0, 23.55, -1.6), (.3, .2, .3), 8, q=.05)
model('Wind_Turbine_Rotor')
cbox('Hub', (0, 0, 0), (1.2, 1.2, .9), 6)
mesh('Nose', [(-.6, -.6, .45), (.6, -.6, .45), (.6, .6, .45), (-.6, .6, .45), (0, 0, 1.3)], [(0, 1, 2, 3), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], 6)
for k in range(3):
    a = k * 2 * math.pi / 3 + math.pi / 2
    c, s = math.cos(a), math.sin(a); px, py = -s, c
    def at(r, w, dz): return (c * r + px * w, s * r + py * w, dz)
    root, tip = .5, 10.5
    v = [at(root, -.5, -.14), at(root, .5, -.14), at(tip, .22, -.08), at(tip, -.18, -.08),
         at(root, -.5, .14), at(root, .5, .14), at(tip, .22, .08), at(tip, -.18, .08)]
    mesh('Blade', v, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 6)
    v = [at(9.0, -.24, -.1), at(9.0, .27, -.1), at(10.55, .23, -.09), at(10.55, -.19, -.09),
         at(9.0, -.24, .1), at(9.0, .27, .1), at(10.55, .23, .09), at(10.55, -.19, .09)]
    mesh('BladeTip', v, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 16)

# SOLAR ROW, 12 m along x: posts, a rail and panels tilted toward the sun (+Z, up).
model('Solar_Row')
for x in (-4.5, -1.5, 1.5, 4.5):
    cbox('Post', (x, .7, 0), (.25, 1.4, .25), 0, q=.04)
beam('Rail', (-6, 1.45, 0), (6, 1.45, 0), .3, .3, 0)
for k in range(4):
    x0, x1 = -6 + k * 3 + .06, -3 + k * 3 - .06
    slab('Panel', [(x0, 1.1, 1.05), (x1, 1.1, 1.05), (x1, 2.05, -1.05), (x0, 2.05, -1.05)], .1, 18)

# HABITAT DOME: a ring base, a low wall with a glowing window band, a panelled dome, a door facing +Z.
model('Habitat_Dome')
lathe('DomeBase', [(0, 6.5), (1.0, 6.4), (1.1, 6.2)], 16, 0)
lathe('DomeWall', [(1.1, 6.1), (3.0, 6.0)], 16, 6, cap_bottom=False, cap_top=False)
lathe('DomeWindows', [(1.9, 6.04), (2.5, 6.04)], 16, 7, cap_bottom=False, cap_top=False)
lathe('DomeShell', [(3.0, 6.0), (4.5, 5.5), (5.8, 4.4), (6.7, 2.8), (7.1, 1.2), (7.2, 0)], 16, 1)
lathe('DomeHatch', [(7.15, 1.0), (7.5, .9), (7.6, .4)], 8, 2)
lathe('DomeHatchGlow', [(7.6, .4), (7.7, .3)], 8, 7)
cbox('Door', (0, 1.5, 5.95), (2.2, 2.8, 1.0), 4)
box('DoorGlow', (0, 2.98, 6.46), (2.0, .14, .06), 8)
box('DoorPanel', (0, 1.4, 6.46), (1.4, 2.2, .04), 2)

# HABITAT MODULE: a chamfered capsule block on skids with windows, a door and a roof unit.
model('Habitat_Module')
cbox('Skid', (0, .25, 0), (8.6, .5, 3.6), 0)
cbox('Body', (0, 2.1, 0), (8.4, 3.2, 4.2), 6, q=.9)
cbox('Band', (0, 1.0, 0), (8.5, .5, 4.3), 4, q=.92)
for x in (-2.8, -.8, 1.2):
    box('Window', (x, 2.5, 2.08), (1.3, .8, .08), 7)
cbox('Door', (3.0, 1.85, 2.0), (1.4, 2.5, .6), 2)
box('DoorLight', (3.0, 3.25, 2.32), (1.2, .12, .04), 8)
cbox('RoofUnit', (-1.5, 4.05, 0), (3.0, .7, 2.0), 2)
box('RoofVent', (-1.5, 4.05, 1.02), (2.4, .4, .06), 3)

# ORE SILO (origin at its foot): a banded tower, a conical top, a glowing band and the conveyor's intake on -X.
model('Ore_Silo')
lathe('SiloBase', [(0, 3.5), (1.0, 3.5), (1.1, 3.3)], 12, 20)
lathe('SiloBody', [(1.1, 3.2), (4.0, 3.2), (4.8, 3.2), (12.0, 3.2)], 12, 1, tiles_by_band=[1, 5, 16], cap_bottom=False)
lathe('SiloGlow', [(11.2, 3.24), (11.6, 3.24)], 12, 7, cap_bottom=False, cap_top=False)
lathe('SiloTop', [(12.0, 3.35), (12.4, 3.35), (14.6, 1.2), (15.0, .5)], 12, 2)
cbox('Intake', (-3.4, 3.4, 0), (1.6, 1.6, 2.0), 16)
box('IntakeMouth', (-4.22, 3.3, 0), (.06, .9, 1.4), 15)
cbox('Ladder', (2.2, 7, 2.4), (.3, 12, .3), 0, q=.04)

# CONVEYOR frame, 16 m along +x from its origin (belt top 3.2 m): a bed with glowing side strips, two legs, a
# hopper at the start. The cleats and ore riding on it are separate props (they slide in the game).
model('Conveyor_Frame')
cbox('Bed', (8, 2.95, 0), (16.2, .5, 1.7), 0, q=.1)
box('Belt', (8, 3.2, 0), (16.0, .06, 1.3), 19)
for s in (-1, 1):
    box('Rail', (8, 3.35, s * .8), (16.2, .3, .14), 2)
    box('RailGlow', (8, 3.35, s * .88), (15.6, .08, .04), 7)
for x in (8, 13.5):
    cbox('Leg', (x, 1.4, 0), (.5, 2.8, 1.5), 2, q=.08)
    box('LegStripe', (x, .4, 0), (.54, .5, 1.54), 5)
cbox('Hopper', (.6, 3.9, 0), (1.8, 1.4, 2.2), 16)
box('HopperMouth', (.6, 4.62, 0), (1.4, .06, 1.8), 15)
model('Conveyor_Cleat')
box('Cleat', (0, .06, 0), (.16, .12, 1.3), 10)
model('Conveyor_Ore')
for k, (x, z, s) in enumerate(((0, 0, .5), (.35, .25, .36), (-.3, -.2, .32))):
    cbox('Ore', (x, .15 + s / 2, z), (s, s, s), 12 if k != 1 else 11, q=s * .2)

# CARGO CONTAINERS, 6 x 2.6 x 2.5: ribbed sides, an end with doors and a hazard band.
for name, paint in (('Container_Orange', 16), ('Container_Navy', 4), ('Container_Teal', 17)):
    model(name)
    cbox('Body', (0, 1.3, 0), (6.0, 2.5, 2.5), paint, q=.12)
    for x in (-2.2, -1.1, 0, 1.1, 2.2):
        for s in (-1, 1):
            box('Rib', (x, 1.3, s * 1.27), (.22, 2.2, .08), paint)
    box('Door', (3.02, 1.3, 0), (.06, 2.2, 2.2), 0)
    box('DoorStripe', (3.06, .45, 0), (.04, .3, 2.2), 5)
    box('Code', (-.5, 1.9, 1.32), (1.6, .5, .03), 14)

# LAMP POST: a post with an arm and a cyan light strip under it.
model('Lamp_Post')
cbox('Base', (0, .25, 0), (.7, .5, .7), 0)
cbox('Pole', (0, 2.8, 0), (.3, 4.6, .3), 2, q=.05)
cbox('Head', (.55, 5.2, 0), (1.7, .32, .55), 0)
box('Light', (.65, 5.02, 0), (1.4, .06, .38), 7)
box('Stripe', (0, .65, 0), (.34, .3, .34), 5)

# HAZARD BOLLARD with a glowing cap.
model('Bollard')
cbox('Body', (0, .5, 0), (.5, 1.0, .5), 5, q=.08)
cbox('Cap', (0, 1.06, 0), (.56, .14, .56), 8, q=.08)

# ANTENNA MAST: a tapered pole with a dish and a beacon.
model('Antenna_Mast')
cbox('Base', (0, .4, 0), (2.2, .8, 2.2), 20)
lathe('Mast', [(.8, .4), (14, .22)], 6, 2)
lathe('Dish', [(9.0, .2), (9.3, 1.6), (9.5, 1.9)], 10, 6, cx=.0, cap_top=False)
cbox('DishArm', (0, 9.1, 0), (.3, .3, .3), 0)
cbox('Beacon', (0, 14.2, 0), (.4, .4, .4), 8, q=.06)
for y in (4, 8, 12):
    cbox('Ring', (0, y, 0), (.8, .2, .8), 0)

# MINING MECH, parked, facing +Z (about 4.8 m): stubby legs on big feet, an orange cab with a cyan visor, a drill
# arm and a claw arm, a light bar and an antenna.
model('Mining_Mech')
for sx in (-1, 1):
    cbox('Foot', (sx * 1.15, .3, .2), (1.3, .6, 2.0), 0)
    cbox('Leg', (sx * 1.15, 1.45, 0), (.75, 1.7, .85), 2)
    cbox('Knee', (sx * 1.15, 1.6, .5), (.85, .6, .3), 5)
cbox('Hips', (0, 2.55, 0), (2.8, .7, 1.6), 0)
cbox('Cab', (0, 3.85, 0), (3.1, 2.0, 2.5), 16, q=.4)
box('Visor', (0, 4.15, 1.26), (2.1, .6, .06), 7)
cbox('CabRoof', (0, 4.95, -.1), (2.6, .2, 2.0), 0)
box('LightBar', (0, 5.1, .8), (1.8, .16, .2), 8)
cbox('Engine', (0, 3.6, -1.55), (2.0, 1.4, .8), 2)
for sx in (-1, 1):
    lathe('Exhaust', [(3.4, .14), (5.4, .14)], 6, 10, cx=sx * .7, cz=-1.85)
cbox('Antenna', (1.1, 5.6, -.6), (.1, 1.2, .1), 0, q=.02)
cbox('AntennaTip', (1.1, 6.25, -.6), (.2, .14, .2), 8, q=.03)
for sx in (-1, 1):
    cbox('Shoulder', (sx * 1.95, 4.1, .2), (.9, .9, .9), 2)
    beam('UpperArm', (sx * 2.05, 3.9, .3), (sx * 2.15, 2.6, 1.1), .55, .55, 0)
    cbox('Forearm', (sx * 2.15, 2.4, 1.5), (.7, .7, 1.2), 16)
# The drill on the right arm, pointing forward.
v = []
for k in range(6):
    a = k * math.pi / 3
    v.append((2.15 + math.cos(a) * .38, 2.4 + math.sin(a) * .38, 2.1))
v.append((2.15, 2.4, 3.6))
mesh('DrillCone', v, [tuple(range(6))] + [(k, (k + 1) % 6, 6) for k in range(6)], 6)
for sx, dz in ((-1, .25), (-1, -.25)):
    beam('Claw', (-2.15, 2.4, 2.1), (-2.15 + .2, 2.4 + dz * 2, 2.9), .2, .2, 0)
finish(__file__)
