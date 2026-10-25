"""第二世界 surface props, a desert mining colony in big flat colour blocks (white, bright yellow, teal, charcoal) on
warm sand: the drill tower over the shaft and its spinning bit, the ore buyer and the gear shop (white domes with a
yellow / teal front, an open counter, shelves of goods, a robot clerk and a big emblem: red crystals, crossed
pickaxes), the world portal (a white ring with yellow clamps) on its stepped dais, the teleport station, rail posts,
lamp posts, palms, cacti, ore crates and barrels, storage tanks, wind turbines (tower + spinning rotor), solar rows,
habitat domes and a module, the ore silo and its conveyor (frame, sliding cleats and ore), cargo containers, an
antenna mast and a parked mining mech.
Run: blender -b --python tools/blender/build_tech_base.py
Shared atlas, primitives and report in cave_props.py; tools/underground/techBaseHall.ts places the props.
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike

# Panels carry soft seams inside the tile (the face UVs span its inner 27 px). Glow tiles are deep and saturated:
# the emission (x2.2) plus the lit colour must keep their hue, not wash out to white. The two sunless tiles are
# white and yellow for fronts that face away from the sun (the portal, the station, the ore buyer): dark, they
# glow to the colour the sunlit ones show, so those fronts read as bright as the rest.
def panel(base, light, dark):
    return (base, [(3, 3, 26, 2, light), (3, 27, 26, 2, dark), (3, 3, 2, 26, light), (27, 3, 2, 26, dark)])
TILES = [
    ('2c2e33', [(3, 3, 26, 2, '3a3d44'), (3, 26, 26, 3, '222428')]),          # 0 charcoal frame
    panel('eceeef', 'f8f9f9', 'cfd3d7'),                                       # 1 white panel
    panel('b4bac2', 'c6cbd2', '959ba4'),                                       # 2 light grey
    ('5c5c5a', [(3, 27, 26, 2, '545452')]),                                    # 3 sunless white (glows: faces that never see the sun)
    panel('1e2c44', '2c3e5e', '141e30'),                                       # 4 navy board
    ('f5c02a', [(3, 3, 6, 26, '2a2a2e'), (15, 3, 6, 26, '2a2a2e'), (27, 3, 2, 26, '2a2a2e')]),  # 5 hazard stripes
    ('f4f3ee', [(3, 27, 26, 2, 'dedcd4')]),                                    # 6 white
    ('0e8eb0', [(6, 6, 20, 20, '24b8d8'), (11, 11, 10, 10, '40d4ee')]),        # 7 glow cyan (deep)
    ('c4520a', [(6, 6, 20, 20, 'dc6a14'), (11, 11, 10, 10, 'ee8a24')]),        # 8 glow orange (deep)
    ('b89a60', [(6, 6, 20, 20, 'c8ac72')]),                                    # 9 glow warm white (deep)
    ('2a2e36', [(3, 3, 26, 2, '363b45')]),                                     # 10 dark iron
    ('f5c02a', [(3, 3, 26, 3, 'ffd65a'), (3, 26, 26, 3, 'dca41c')]),           # 11 yellow paint
    ('d8302a', [(4, 4, 10, 22, 'f05a48'), (18, 8, 8, 18, 'a81e1a')]),          # 12 red crystal
    ('5e4812', [(3, 3, 26, 3, '6a5418'), (3, 26, 26, 3, '52400e')]),           # 13 sunless yellow (glows likewise)
    ('1c2a3a', [(4, 5, 24, 3, '263648')]),                                     # 14 screen
    ('16181e', []),                                                            # 15 shadow
    panel('e8782a', 'f69244', 'c05c1a'),                                       # 16 orange paint
    panel('1fb0b8', '3ccad0', '168890'),                                       # 17 teal paint
    ('1c3a6a', [(3, 3, 26, 2, '5a86c8'), (3, 15, 26, 2, '5a86c8'), (3, 27, 26, 2, '5a86c8'), (3, 3, 2, 26, '5a86c8'), (15, 3, 2, 26, '5a86c8'), (27, 3, 2, 26, '5a86c8')]),  # 18 solar cells
    ('2a2c30', [(3, 14, 26, 4, '34373c')]),                                    # 19 rubber belt
    ('ddd2bc', [(4, 5, 10, 3, 'e8dfcc'), (18, 20, 8, 3, 'cfc3aa')]),           # 20 sand concrete
    ('5a1ea8', [(6, 6, 20, 20, '7230c8'), (11, 11, 10, 10, '8c48e0')]),        # 21 glow violet (deep)
    ('c07c3c', [(2, 9, 28, 2, 'a86630'), (2, 20, 28, 2, 'a86630'), (6, 3, 2, 26, 'd08c4a')]),  # 22 wood planks
    ('a0703e', [(0, 6, 32, 3, '86592e'), (0, 20, 32, 3, '86592e')]),           # 23 palm trunk rings
    ('4cae3c', [(14, 0, 4, 32, '6cc850'), (2, 4, 10, 2, '3a8c2c'), (20, 18, 10, 2, '3a8c2c')]),  # 24 palm leaf
    ('5aa848', [(4, 0, 3, 32, '4a9038'), (14, 0, 3, 32, '4a9038'), (24, 0, 3, 32, '4a9038')]),  # 25 cactus ribs
    ('2a7ae8', [(4, 4, 10, 22, '5a9cf6'), (18, 8, 8, 18, '1a58c0')]),          # 26 blue gem
    ('a4aab4', [(3, 4, 26, 4, 'c4c9d0'), (3, 18, 26, 3, '868c96')]),           # 27 steel
    ('8a5a36', [(3, 3, 26, 2, '9c6a42'), (3, 26, 26, 3, '74482a')]),           # 28 warm interior
    ('f2be36', [(3, 3, 26, 4, 'ffd86a'), (5, 26, 24, 3, 'd8a020')]),           # 29 gold
    ('0c6c74', [(6, 6, 20, 20, '12808a'), (11, 11, 10, 10, '1a9aa4')]),        # 30 glow teal (deep)
    ('a0603a', [(3, 12, 26, 3, '7c4626'), (12, 3, 8, 8, 'b87448')]),           # 31 backpack leather
]
start('TechBase', 'tech-base', TILES, glowing={3, 7, 8, 9, 13, 21, 30})

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
def arch(r, wall, y0, n=14):
    """A barrel-vault outline in XY, right foot to left foot: walls `wall` high from y0, then a half circle."""
    yc = y0 + wall
    return [(r, y0), (r, yc)] + [(r * math.cos(math.pi * k / n), yc + r * math.sin(math.pi * k / n)) for k in range(1, n)] + [(-r, yc), (-r, y0)]
def band(name, outer, inner, z0, z1, t, closed=False):
    """A band between two outlines of equal length in XY (an arch or a ring), extruded from z0 to z1."""
    m = len(outer); v = [(x, y, z0) for x, y in outer] + [(x, y, z1) for x, y in outer] + [(x, y, z0) for x, y in inner] + [(x, y, z1) for x, y in inner]
    f = []
    for i in range(m if closed else m - 1):
        j = (i + 1) % m
        f += [(m + i, m + j, 3 * m + j, 3 * m + i), (i, 2 * m + i, 2 * m + j, j), (i, j, m + j, m + i), (2 * m + i, 3 * m + i, 3 * m + j, 2 * m + j)]
    if not closed: f += [(0, m, 3 * m, 2 * m), (m - 1, 3 * m - 1, 4 * m - 1, 2 * m - 1)]
    return mesh(name, v, f, t)
def ring(name, cy, r0, r1, z0, z1, t, n=24):
    """A round ring in the XY plane round (0, cy), facing +Z."""
    return band(name, circle(r1, n, 0, cy), circle(r0, n, 0, cy), z0, z1, t, closed=True)
def radial(name, cy, a, r0, r1, w, z0, z1, t):
    """A radial block in the XY plane round (0, cy), from r0 to r1 at angle a, w across."""
    c, s = math.cos(a), math.sin(a)
    prism(name, [(c * r0 - s * w / 2, cy + s * r0 + c * w / 2), (c * r1 - s * w / 2, cy + s * r1 + c * w / 2),
                 (c * r1 + s * w / 2, cy + s * r1 - c * w / 2), (c * r0 + s * w / 2, cy + s * r0 - c * w / 2)], z0, z1, t, axis='z')
def strip(name, pts, widths, up, thick, t):
    """A bent leaf strip through `pts` (3D), `widths` across (perpendicular to `up` and the strip), `thick` deep."""
    v = []
    for k, (p, w) in enumerate(zip(pts, widths)):
        a, b = pts[max(k - 1, 0)], pts[min(k + 1, len(pts) - 1)]
        d = [b[i] - a[i] for i in range(3)]
        side = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]
        n = math.sqrt(sum(x * x for x in side)) or 1; side = [x / n for x in side]
        for s in (-1, 1):
            for h in (0, -thick):
                v.append(tuple(p[i] + side[i] * s * w / 2 + up[i] * h for i in range(3)))
    f = []
    for k in range(len(pts) - 1):
        a, b = 4 * k, 4 * (k + 1)
        f += [(a, a + 2, b + 2, b), (a + 1, b + 1, b + 3, a + 3), (a, b, b + 1, a + 1), (a + 2, a + 3, b + 3, b + 2)]
    f += [(0, 1, 3, 2), (4 * len(pts) - 4, 4 * len(pts) - 2, 4 * len(pts) - 1, 4 * len(pts) - 3)]
    return mesh(name, v, f, t)
def crystal(name, x, y, z, h, r, t, lean=(0, 0)):
    spike(name, x, z, h, r, 6, t, lean=lean, y=y, tip=.7, spin=.3)
def pickaxe(name, c, d, length, head, z0, z1, handle_t=22, head_t=10):
    """A flat pickaxe in the XY plane: the handle from c along -d (length), the curved head across its top at c."""
    p = (-d[1], d[0])
    beam(name + 'Handle', (c[0] - d[0] * length, c[1] - d[1] * length, (z0 + z1) / 2), (c[0], c[1], (z0 + z1) / 2), length * .1, z1 - z0, handle_t)
    pts = [(c[0] + p[0] * s * head - d[0] * abs(s) ** 1.6 * head * .4, c[1] + p[1] * s * head - d[1] * abs(s) ** 1.6 * head * .4) for s in (-1, -.5, 0, .5, 1)]
    for a, b in zip(pts, pts[1:]):
        beam(name + 'Head', (a[0], a[1], (z0 + z1) / 2), (b[0], b[1], (z0 + z1) / 2), head * .26, (z1 - z0) * 1.2, head_t)

# DOME HALLS, front +Z, about 12 x 9 m on a plinth (top .4): a white barrel vault with a coloured front band, a
# white front wall with an opening (x +-3.5, y .4-4.4) framed in the paint colour, a navy board over it (the
# game's sign floats in front at z 2.46, y 5.6) and a big emblem disc poking above the band. Inside: a warm back
# wall with shelves of goods, a lit ceiling, a counter in the opening and a robot clerk behind it.
Y0, WALL, RO, RS, RI = .4, 2.4, 6.0, 5.6, 4.9
YC = Y0 + WALL
def dome_hall(name, paint, glow, clerk_x, front=None, white=6):
    front = paint if front is None else front
    model(name)
    cbox('Plinth', (0, .2, -.9), (12.8, .4, 9.4), 2)
    prism('Vault', arch(RS, WALL, Y0), -5.0, -1.0, 1, axis='z')
    band('Shell', arch(RS, WALL, Y0), arch(RI, WALL, Y0), -1.0, 2.2, 1)
    band('Front', arch(RO, WALL, Y0), arch(RI, WALL, Y0), 2.2, 3.1, front)
    band('FrontLip', arch(RI + .12, WALL, Y0), arch(RI, WALL, Y0), 3.1, 3.18, glow)
    band('Rib', arch(RS + .16, WALL, Y0), arch(RS - .1, WALL, Y0), -3.4, -2.9, paint)
    # The front wall round the opening.
    a0 = math.asin((4.4 - YC) / RI)
    top = [(RI * math.cos(a), YC + RI * math.sin(a)) for a in (a0 + (math.pi - 2 * a0) * k / 12 for k in range(13))]
    prism('Wall', top, 2.0, 2.25, white, axis='z')
    for s in (-1, 1):
        side = [(s * 3.5, Y0), (s * RI, Y0), (s * RI, YC)] + [(s * RI * math.cos(a), YC + RI * math.sin(a)) for a in (a0 * k / 3 for k in range(1, 4))] + [(s * 3.5, 4.4)]
        prism('Wall', side, 2.0, 2.25, white, axis='z')
        box('OpeningPost', (s * 3.7, 2.4, 2.3), (.4, 4.0, .4), front)
        box('WallLamp', (s * 4.3, 3.7, 2.32), (.32, .5, .18), 9)
    box('OpeningLintel', (0, 4.6, 2.3), (7.8, .5, .4), front)
    box('Board', (0, 5.6, 2.3), (5.4, 1.3, .2), 4)
    box('BoardTrim', (0, 6.3, 2.32), (5.6, .1, .22), glow)
    # Inside, seen through the opening.
    box('BackWall', (0, 2.6, -1.0), (9.6, 4.4, .2), 28)
    box('Floor', (0, .42, .5), (9.6, .04, 3.0), 2)
    box('CeilingLight', (0, 4.28, 1.5), (7.0, .1, .5), 9)
    for y in (1.7, 2.9): box('Shelf', (0, y, -.65), (7.6, .1, .55), 22)
    # The counter in the opening.
    box('Counter', (0, .95, 2.65), (6.6, 1.1, .8), front)
    box('CounterTop', (0, 1.56, 2.7), (6.9, .12, 1.0), white)
    box('CounterGlow', (0, 1.25, 3.06), (6.2, .1, .04), glow)
    # The robot clerk: a white body and head, a dark visor with glowing eyes, arms on the counter.
    x = clerk_x
    cbox('ClerkBody', (x, 1.75, 1.3), (.9, .95, .62), 6, q=.12)
    cbox('ClerkHead', (x, 2.62, 1.3), (1.0, .72, .78), 6, q=.16)
    box('ClerkVisor', (x, 2.64, 1.7), (.78, .4, .04), 14)
    for dx in (-.18, .18): box('ClerkEye', (x + dx, 2.66, 1.73), (.12, .14, .03), 7)
    box('ClerkAntenna', (x, 3.12, 1.3), (.05, .3, .05), 0)
    box('ClerkBulb', (x, 3.3, 1.3), (.14, .14, .14), 8)
    for dx in (-.58, .58): beam('ClerkArm', (x + dx, 2.0, 1.3), (x + dx * 1.1, 1.66, 2.3), .2, .2, 2)
    # Roof: an air unit and a vent stack on the vault.
    cbox('RoofUnit', (-2.2, 8.15, -3.4), (2.0, .8, 1.6), 2)
    box('RoofVent', (-2.2, 8.15, -2.58), (1.6, .4, .06), 0)
    lathe('Stack', [(7.4, .32), (9.6, .28)], 8, 6, cx=2.6, cz=-3.8)
    lathe('StackBand', [(9.0, .31), (9.3, .31)], 8, paint, cx=2.6, cz=-3.8, cap_bottom=False)
    # The emblem disc above the band.
    prism('EmblemRim', circle(1.78, 24, 0, 7.9), 3.0, 3.3, front, axis='z')
    prism('EmblemDisc', circle(1.46, 24, 0, 7.9), 3.3, 3.42, white, axis='z')

dome_hall('Ore_Buyer', 11, 8, 1.7, front=13, white=3)  # its front never sees the sun
# Red crystals rising out of the emblem, ore on the shelves and the counter (crystals, gems, gold).
crystal('EmblemCrystal', 0, 6.75, 3.75, 2.5, .62, 12)
crystal('EmblemCrystal', -.8, 6.9, 3.7, 1.7, .44, 12, lean=(-.28, 0))
crystal('EmblemCrystal', .82, 6.85, 3.7, 1.8, .46, 12, lean=(.26, 0))
for k, x in enumerate((-3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0)):
    for y in (1.75, 2.95):
        t = (12, 26, 29)[(k + int(y)) % 3]
        if t == 29: cbox('ShelfGold', (x, y + .2, -.65), (.6, .3, .4), 29, q=.08)
        else: crystal('ShelfOre', x, y + .05, -.65, .55, .18, t)
for x, t in ((-2.6, 12), (-1.9, 12), (-.6, 26), (-.2, 26)): crystal('CounterOre', x, 1.62, 2.7, .7, .22, t)
cbox('CounterGold', (.6, 1.78, 2.7), (.7, .32, .5), 29, q=.1)
cbox('Scale', (-1.2, 1.7, 2.75), (.9, .16, .6), 2)
cbox('ScaleTray', (-1.2, 1.85, 2.75), (1.0, .08, .7), 29)

dome_hall('Gear_Workshop', 17, 30, -1.7)
# Crossed pickaxes on the emblem, pickaxes on the back wall and backpacks on the shelves; tools on the counter.
pickaxe('EmblemPickA', (.9, 8.75), (.7071, .7071), 2.4, .95, 3.42, 3.62)
pickaxe('EmblemPickB', (-.9, 8.75), (-.7071, .7071), 2.4, .95, 3.62, 3.82)
for k, x in enumerate((-3.0, -1.5, 0, 1.5, 3.0)):
    pickaxe('WallPick', (x, 4.0), (0, 1), 1.0, .42, -.88, -.8, head_t=(12, 26, 29, 27, 16)[k])
for k, x in enumerate((-2.8, -1.4, 0, 1.4, 2.8)):
    cbox('Backpack', (x, 2.0, -.65), (.62, .6, .4), 31, q=.08)
    box('BackpackFlap', (x, 2.18, -.44), (.5, .22, .04), (16, 17, 11, 16, 17)[k])
    cbox('Toolbox', (x + .1, 3.15, -.65), (.7, .4, .38), (16, 17, 11, 17, 16)[k], q=.06)
for k, x in enumerate((-.4, .6, 1.6)):
    beam('CounterPickHandle', (x - .5, 1.68, 2.62), (x + .4, 1.68, 2.62), .1, .08, 22)
    beam('CounterPickHead', (x + .4, 1.68, 2.32), (x + .4, 1.68, 2.92), .14, .12, (26, 29, 12)[k])
cbox('Anvil', (-2.4, 1.78, 2.7), (.9, .32, .5), 10, q=.08)

# WORLD PORTAL DAIS, front +Z (placed facing the shaft), origin on the ground under the portal: a white platform
# (top .9, x +-5.2, z -3.4 to 5.4) with a concrete top, low curbs with a yellow top on three sides, two steps to
# the front (.3 each, to z 7.0) with yellow noses, and two lamp pylons at its front corners.
model('Portal_Dais')
cbox('Platform', (0, .4, 1.0), (10.4, .8, 8.8), 1, q=.3)
cbox('PlatformTop', (0, .85, 1.0), (10.3, .1, 8.7), 20, q=.3)
box('PlatformEdge', (0, .92, 5.15), (8.0, .04, .3), 5)
for k, (z, top) in enumerate(((5.8, .6), (6.6, .3))):
    box('Step', (0, top / 2, z), (8.0, top, .8), 6)
    box('StepNose', (0, top - .03, z + .36), (8.04, .07, .1), 11)
for s in (-1, 1):
    box('Curb', (s * 5.0, 1.2, 1.0), (.4, .6, 8.8), 6)
    box('CurbTop', (s * 5.0, 1.53, 1.0), (.5, .08, 8.9), 11)
    cbox('Pylon', (s * 4.6, 2.1, 5.0), (.7, 2.4, .7), 6, q=.1)
    box('PylonBand', (s * 4.6, 1.5, 5.0), (.74, .2, .74), 11)
    cbox('PylonLamp', (s * 4.6, 3.55, 5.0), (.62, .5, .62), 9, q=.1)
    cbox('PylonCap', (s * 4.6, 3.88, 5.0), (.8, .16, .8), 0, q=.1)
box('CurbBack', (0, 1.2, -3.2), (10.4, .6, .4), 6)
box('CurbBackTop', (0, 1.53, -3.2), (10.5, .08, .5), 11)

# WORLD PORTAL FRAME, front +Z, origin on the dais floor: a broad white ring round the portal disc (radius 1.85,
# 2.9 m up) with a violet glow lip, a yellow outer band and six yellow clamps, set in a yellow plinth; white pylons
# with violet strips either side and a white lintel (the sign floats above it at 7.7 m).
model('Portal_Frame')
ring('Ring', 2.9, 1.98, 2.7, -.45, .45, 3)
ring('RingBand', 2.9, 2.7, 2.92, -.3, .3, 13)
ring('RingLip', 2.9, 1.86, 1.99, -.5, .55, 21)
for k in range(6):
    a = math.pi / 6 + k * math.pi / 3
    radial('Clamp', 2.9, a, 2.5, 3.2, .55, -.55, .55, 13)
    radial('ClampLight', 2.9, a, 2.7, 3.05, .18, .55, .6, 9)
cbox('Plinth', (0, .35, 0), (3.8, .7, 1.7), 13, q=.25)
box('PlinthStripe', (0, .35, .86), (3.4, .3, .04), 5)
for s in (-1, 1):
    cbox('Pylon', (s * 3.7, 3.0, 0), (1.0, 6.0, 1.1), 3, q=.16)
    for y in (1.0, 5.2): box('PylonBand', (s * 3.7, y, 0), (1.06, .3, 1.16), 13)
    box('PylonGlow', (s * 3.7, 3.1, .56), (.16, 3.4, .04), 21)
    box('Arm', (s * 3.05, 2.9, 0), (.5, .5, .6), 0)
cbox('Lintel', (0, 6.4, 0), (8.6, .8, 1.2), 3, q=.18)
box('LintelBand', (0, 6.02, .61), (8.4, .14, .04), 13)
box('LintelGlow', (0, 6.42, .61), (7.0, .12, .04), 21)

# DRILL TOWER over the shaft (origin at the shaft's centre): four yellow legs from striped feet at the apron's
# corners (+-10.2) leaning in to a white column (y 12.5-23.5) with yellow bands, lit windows and the name screen
# on its +Z face (the game's sign at y 16.4), a yellow motor housing and a wheel on top, a brace ring at 7 m and the
# stem down to 11.4 m (the bit spins below it, Drill_Bit).
F, C = 10.2, 2.4
model('Drill_Rig')
for sx in (-1, 1):
    for sz in (-1, 1):
        x, z = sx * F, sz * F
        cbox('Foot', (x, .4, z), (2.2, .8, 2.2), 11)
        cbox('FootStripe', (x, .95, z), (2.3, .3, 2.3), 5)
        cbox('FootPlate', (x, 1.15, z), (1.6, .1, 1.6), 0)
        box('FootLight', (x - sx * 1.12, .5, z - sz * .6), (.06, .3, .3), 8)
        beam('Leg', (x, 1.0, z), (sx * C, 13.0, sz * C), 1.1, 1.1, 11)
        beam('LegStrip', (x - sx * .05, 1.6, z - sz * .05), (sx * (C - .05), 12.6, sz * (C - .05)), 1.16, .2, 0)
B = F - (F - C) * (7 - 1) / 12
for s in (-1, 1):
    beam('Brace', (-B, 7, s * B), (B, 7, s * B), .6, .6, 6)
    beam('Brace', (s * B, 7, -B), (s * B, 7, B), .6, .6, 6)
cbox('Column', (0, 18.0, 0), (5.2, 11.0, 5.2), 1, q=.5)
for y in (13.0, 20.6): cbox('ColumnBand', (0, y, 0), (5.4, .6, 5.4), 11, q=.52)
cbox('ColumnFoot', (0, 12.5, 0), (4.2, .5, 4.2), 0, q=.4)
for k in range(4):
    a = k * math.pi / 2; c, s = math.cos(a), math.sin(a)
    for d in (-1.3, 0, 1.3):
        if k == 1 and d == 0: continue
        box('Window', (s * 2.62 + c * d, 18.7, c * 2.62 - s * d), (.5 if abs(c) > .5 else .06, 1.5, .06 if abs(c) > .5 else .5), 9)
box('Screen', (0, 16.4, 2.66), (4.6, 1.6, .12), 4)
for y in (15.5, 17.3): box('ScreenGlow', (0, y, 2.7), (4.8, .12, .1), 8)
cbox('Motor', (0, 24.5, 0), (4.2, 2.0, 4.2), 11, q=.4)
box('MotorStripe', (0, 23.75, 2.11), (4.0, .3, .04), 5)
cbox('MotorCap', (0, 25.7, 0), (3.4, .4, 3.4), 0, q=.3)
prism('Wheel', circle(1.3, 14, 0, 27.1), -.25, .25, 10, axis='z')
prism('WheelHub', circle(.38, 8, 0, 27.1), -.35, .35, 11, axis='z')
box('WheelPost', (0, 26.2, 0), (.5, 1.0, .5), 0)
cbox('Beacon', (1.4, 26.1, 1.4), (.45, .45, .45), 8, q=.06)
lathe('Stem', [(11.4, .5), (12.6, .5)], 8, 10, cap_top=False)
lathe('Collar', [(12.0, .8), (12.3, .9), (12.5, .7)], 10, 11)

# DRILL BIT, spinning about y (origin at its top, 7 m long): a steel core tapering to a point inside a spiral
# flight of three turns, a yellow collar on top.
model('Drill_Bit')
PROFILE = [(-7.0, .05), (-6.2, .36), (-3.0, 1.05), (-.8, 1.25), (0, 1.0)]
def core(y):
    for (y0, r0), (y1, r1) in zip(PROFILE, PROFILE[1:]):
        if y0 <= y <= y1: return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
    return PROFILE[-1][1]
lathe('Core', PROFILE, 10, 2)
lathe('Collar', [(-.3, 1.3), (0, 1.35), (.3, .9)], 10, 11)
v, f, N, TURNS = [], [], 42, 3
for k in range(N + 1):
    u = k / N; y = -.7 - u * 5.9; a = u * TURNS * 2 * math.pi; c, s = math.cos(a), math.sin(a)
    ri, ro = core(y) - .08, core(y) + .75 * (1 - .55 * u)
    for r, h in ((ri, 0), (ro, 0), (ri, -.16), (ro, -.16)): v.append((c * r, y + h, s * r))
for k in range(N):
    a, b = 4 * k, 4 * (k + 1)
    f += [(a, a + 1, b + 1, b), (a + 2, b + 2, b + 3, a + 3), (a + 1, a + 3, b + 3, b + 1), (a, b, b + 2, a + 2)]
f += [(0, 2, 3, 1), (4 * N, 4 * N + 1, 4 * N + 3, 4 * N + 2)]
mesh('Flight', v, f, 27)

# TELEPORT STATION (local +Z faces the pad and the spawn): a round white platform with a glowing rim, two white
# pillars at +-1.9 across, a teal lintel, and a ring frame round the portal disc (2.75 m up, ~1.34 m radius).
model('Tech_Station')
lathe('Platform', [(0, 3.1), (.32, 3.1), (.4, 2.95)], 16, 6)
lathe('PlatformGlow', [(.4, 2.72), (.43, 2.72), (.44, 2.58)], 24, 7, cap_bottom=False)
cbox('Step', (0, .1, 3.0), (2.6, .2, 1.4), 2)
for sx in (-1, 1):
    cbox('Pillar', (sx * 1.9, 2.8, 0), (.85, 4.8, .85), 3)
    box('PillarGlow', (sx * 1.9, 2.8, .44), (.14, 3.6, .04), 7)
    cbox('PillarFoot', (sx * 1.9, .7, 0), (1.15, .6, 1.15), 17)
    cbox('PillarCap', (sx * 1.9, 5.3, 0), (1.15, .3, 1.15), 0)
cbox('Lintel', (0, 5.65, 0), (5.0, .6, 1.0), 17)
box('LintelGlow', (0, 5.65, .51), (4.2, .14, .04), 7)
ring('Ring', 2.75, 1.42, 1.78, -.17, .17, 3, n=16)
ring('RingGlow', 2.75, 1.34, 1.43, -.2, .2, 7, n=16)
for sx in (-1, 1): box('RingArm', (sx * 1.66, 2.75, 0), (.4, .3, .3), 0)

# RAIL POSTS round the shaft (the rails between them are the hall builder's): a white post with a yellow band and
# a warm glowing cap; a taller striped post either side of each opening.
model('Rail_Post')
cbox('Post', (0, .55, 0), (.3, 1.1, .3), 6, q=.05)
box('Band', (0, .3, 0), (.34, .14, .34), 11)
cbox('Cap', (0, 1.18, 0), (.36, .16, .36), 9, q=.05)
model('Rail_Gate')
cbox('Post', (0, .8, 0), (.5, 1.6, .5), 5, q=.08)
cbox('Cap', (0, 1.7, 0), (.56, .2, .56), 8, q=.08)

# LAMP POST: a white pole on a charcoal foot, a yellow band, a lantern head glowing warm.
model('Lamp_Post')
cbox('Base', (0, .2, 0), (.6, .4, .6), 0)
cbox('Pole', (0, 2.6, 0), (.26, 4.4, .26), 6, q=.05)
box('Band', (0, 1.0, 0), (.3, .24, .3), 11)
cbox('Head', (0, 5.0, 0), (.8, .3, .8), 0, q=.12)
cbox('Lantern', (0, 4.7, 0), (.6, .4, .6), 9, q=.1)
cbox('HeadCap', (0, 5.22, 0), (.5, .14, .5), 0, q=.08)

# PALM: a thick ringed trunk leaning and curving, seven broad drooping fronds, three coconuts.
model('Palm_Tree')
def lean(y): return (.05 * y + .014 * y * y, 0)
rings_, H = [], 6.4
for k in range(9):
    y = H * k / 8; cx, cz = lean(y); r = .44 - .14 * k / 8 + (.05 if k % 2 == 0 else 0)
    rings_.append([(cx + math.cos(2 * math.pi * i / 8) * r, y, cz + math.sin(2 * math.pi * i / 8) * r) for i in range(8)])
v = [p for rr in rings_ for p in rr]
f = [(k * 8 + i, k * 8 + (i + 1) % 8, (k + 1) * 8 + (i + 1) % 8, (k + 1) * 8 + i) for k in range(8) for i in range(8)]
f.append(tuple(range(64, 72)))
mesh('Trunk', v, f, 23)
tx, tz = lean(H)
cbox('Crown', (tx, H + .1, tz), (.9, .5, .9), 24, q=.2)
for k in range(7):
    a = 2 * math.pi * k / 7 + (.2 if k % 2 else 0); c, s = math.cos(a), math.sin(a)
    L = 3.6 + (k % 3) * .35
    pts = [(tx + c * .2, H + .2, tz + s * .2), (tx + c * L * .35, H + .75, tz + s * L * .35), (tx + c * L * .7, H + .45, tz + s * L * .7), (tx + c * L, H - .7, tz + s * L)]
    strip('Frond', pts, (.3, 1.1, .85, .08), (0, 1, 0), .1, 24)
for k in range(3):
    a = 2 * math.pi * k / 3 + .5
    cbox('Coconut', (tx + math.cos(a) * .32, H - .25, tz + math.sin(a) * .32), (.34, .34, .34), 22, q=.08)

# CACTI: a saguaro with two arms, and a cluster of barrel cacti.
model('Cactus_A')
lathe('Body', [(0, .44), (2.8, .44), (3.15, .3), (3.3, 0)], 8, 25)
beam('ArmR', (.3, 1.5, 0), (1.05, 1.5, 0), .46, .46, 25)
lathe('ArmRUp', [(1.3, .24), (2.35, .24), (2.55, .14), (2.62, 0)], 8, 25, cx=1.05)
beam('ArmL', (-.3, 1.05, 0), (-.9, 1.05, 0), .42, .42, 25)
lathe('ArmLUp', [(.85, .22), (1.75, .22), (1.95, .12), (2.0, 0)], 8, 25, cx=-.9)
cbox('Flower', (0, 3.32, 0), (.2, .12, .2), 16, q=.04)
model('Cactus_B')
for k, (x, z, r, h) in enumerate(((0, 0, .5, .9), (.75, .3, .36, .62), (-.55, .5, .32, .5), (.2, -.7, .3, .45))):
    lathe('Barrel', [(0, r * .8), (h * .25, r), (h * .8, r), (h, r * .5), (h + .06, 0)], 8, 25, cx=x, cz=z)
    cbox('Bloom', (x, h + .05, z), (.14, .1, .14), 16 if k % 2 else 12, q=.03)

# ORE CRATES (wood with a charcoal band, crystals on top) and a BARREL.
for name, t in (('Crate_Red', 12), ('Crate_Blue', 26)):
    model(name)
    cbox('Crate', (0, .45, 0), (1.1, .9, 1.1), 22, q=.06)
    cbox('CrateBand', (0, .8, 0), (1.14, .12, 1.14), 0, q=.06)
    crystal('Ore', 0, .86, 0, .62, .2, t)
    crystal('Ore', -.25, .86, .2, .42, .14, t, lean=(-.3, .1))
    crystal('Ore', .28, .86, -.15, .46, .15, t, lean=(.3, -.1))
model('Barrel')
lathe('Body', [(0, .4), (.1, .44), (.9, .44), (1.0, .4)], 10, 16)
for y in (.25, .75): lathe('Hoop', [(y, .455), (y + .08, .455)], 10, 0, cap_bottom=False, cap_top=False)
lathe('Lid', [(1.0, .36), (1.04, .36)], 10, 0)

# STORAGE TANK (origin at its foot), 5.9 m: a white cylinder with yellow bands, a dome, a ladder, a glowing gauge.
model('Storage_Tank')
lathe('Foot', [(0, 1.9), (.4, 1.9), (.5, 1.75)], 12, 0)
lathe('Body', [(.5, 1.6), (1.4, 1.6), (1.7, 1.6), (4.0, 1.6), (4.3, 1.6), (4.6, 1.6)], 12, 1, tiles_by_band=[1, 11, 1, 11, 1], cap_bottom=False, cap_top=False)
lathe('Dome', [(4.6, 1.6), (5.2, 1.35), (5.7, .8), (5.9, .1)], 12, 6)
box('Ladder', (1.66, 2.9, 0), (.08, 4.8, .5), 0)
box('Gauge', (0, 3.0, 1.62), (.7, .7, .06), 7)

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

# HABITAT DOME: a ring base, a low wall with a glowing window band, a white dome with a yellow band, a yellow door
# facing +Z.
model('Habitat_Dome')
lathe('DomeBase', [(0, 6.5), (1.0, 6.4), (1.1, 6.2)], 16, 2)
lathe('DomeWall', [(1.1, 6.1), (3.0, 6.0)], 16, 6, cap_bottom=False, cap_top=False)
lathe('DomeWindows', [(1.9, 6.04), (2.5, 6.04)], 16, 7, cap_bottom=False, cap_top=False)
lathe('DomeShell', [(3.0, 6.0), (4.5, 5.5), (5.8, 4.4), (6.7, 2.8), (7.1, 1.2), (7.2, 0)], 16, 1)
lathe('DomeBand', [(3.0, 6.06), (3.5, 5.9)], 16, 11, cap_bottom=False, cap_top=False)
lathe('DomeHatch', [(7.15, 1.0), (7.5, .9), (7.6, .4)], 8, 2)
lathe('DomeHatchGlow', [(7.6, .4), (7.7, .3)], 8, 7)
cbox('Door', (0, 1.5, 5.95), (2.2, 2.8, 1.0), 11)
box('DoorGlow', (0, 2.98, 6.46), (2.0, .14, .06), 8)
box('DoorPanel', (0, 1.4, 6.46), (1.4, 2.2, .04), 6)

# HABITAT MODULE: a white capsule block on skids with a teal band, windows, a door and a roof unit.
model('Habitat_Module')
cbox('Skid', (0, .25, 0), (8.6, .5, 3.6), 0)
cbox('Body', (0, 2.1, 0), (8.4, 3.2, 4.2), 6, q=.9)
cbox('Band', (0, 1.0, 0), (8.5, .5, 4.3), 17, q=.92)
for x in (-2.8, -.8, 1.2):
    box('Window', (x, 2.5, 2.08), (1.3, .8, .08), 7)
cbox('Door', (3.0, 1.85, 2.0), (1.4, 2.5, .6), 11)
box('DoorLight', (3.0, 3.25, 2.32), (1.2, .12, .04), 8)
cbox('RoofUnit', (-1.5, 4.05, 0), (3.0, .7, 2.0), 2)
box('RoofVent', (-1.5, 4.05, 1.02), (2.4, .4, .06), 0)

# ORE SILO (origin at its foot): a white tower with a hazard band and a yellow top band, a conical top, a glowing
# band and the conveyor's intake on -X.
model('Ore_Silo')
lathe('SiloBase', [(0, 3.5), (1.0, 3.5), (1.1, 3.3)], 12, 20)
lathe('SiloBody', [(1.1, 3.2), (4.0, 3.2), (4.8, 3.2), (12.0, 3.2)], 12, 1, tiles_by_band=[1, 5, 1], cap_bottom=False)
lathe('SiloBand', [(10.6, 3.24), (11.6, 3.24)], 12, 11, cap_bottom=False, cap_top=False)
lathe('SiloGlow', [(11.6, 3.24), (11.85, 3.24)], 12, 8, cap_bottom=False, cap_top=False)
lathe('SiloTop', [(12.0, 3.35), (12.4, 3.35), (14.6, 1.2), (15.0, .5)], 12, 6)
cbox('Intake', (-3.4, 3.4, 0), (1.6, 1.6, 2.0), 11)
box('IntakeMouth', (-4.22, 3.3, 0), (.06, .9, 1.4), 15)
cbox('Ladder', (2.2, 7, 2.4), (.3, 12, .3), 0, q=.04)

# CONVEYOR frame, 16 m along +x from its origin (belt top 3.2 m): a bed with glowing side strips, two legs, a
# hopper at the start. The cleats and ore riding on it are separate props (they slide in the game).
model('Conveyor_Frame')
cbox('Bed', (8, 2.95, 0), (16.2, .5, 1.7), 0, q=.1)
box('Belt', (8, 3.2, 0), (16.0, .06, 1.3), 19)
for s in (-1, 1):
    box('Rail', (8, 3.35, s * .8), (16.2, .3, .14), 11)
    box('RailGlow', (8, 3.35, s * .88), (15.6, .08, .04), 9)
for x in (8, 13.5):
    cbox('Leg', (x, 1.4, 0), (.5, 2.8, 1.5), 6, q=.08)
    box('LegStripe', (x, .4, 0), (.54, .5, 1.54), 5)
cbox('Hopper', (.6, 3.9, 0), (1.8, 1.4, 2.2), 11)
box('HopperMouth', (.6, 4.62, 0), (1.4, .06, 1.8), 15)
model('Conveyor_Cleat')
box('Cleat', (0, .06, 0), (.16, .12, 1.3), 10)
model('Conveyor_Ore')
for k, (x, z, s) in enumerate(((0, 0, .5), (.35, .25, .36), (-.3, -.2, .32))):
    cbox('Ore', (x, .15 + s / 2, z), (s, s, s), (12, 29, 26)[k], q=s * .2)

# CARGO CONTAINERS, 6 x 2.6 x 2.5: ribbed sides, an end with doors and a hazard band.
for name, paint in (('Container_Orange', 16), ('Container_Navy', 4), ('Container_Teal', 17)):
    model(name)
    cbox('Body', (0, 1.3, 0), (6.0, 2.5, 2.5), paint, q=.12)
    for x in (-2.2, -1.1, 0, 1.1, 2.2):
        for s in (-1, 1):
            box('Rib', (x, 1.3, s * 1.27), (.22, 2.2, .08), paint)
    box('Door', (3.02, 1.3, 0), (.06, 2.2, 2.2), 0)
    box('DoorStripe', (3.06, .45, 0), (.04, .3, 2.2), 5)
    box('Code', (-.5, 1.9, 1.32), (1.6, .5, .03), 6)

# ANTENNA MAST: a tapered pole with a dish and a beacon.
model('Antenna_Mast')
cbox('Base', (0, .4, 0), (2.2, .8, 2.2), 20)
lathe('Mast', [(.8, .4), (14, .22)], 6, 6)
lathe('Dish', [(9.0, .2), (9.3, 1.6), (9.5, 1.9)], 10, 6, cx=.0, cap_top=False)
cbox('DishArm', (0, 9.1, 0), (.3, .3, .3), 0)
cbox('Beacon', (0, 14.2, 0), (.4, .4, .4), 8, q=.06)
for y in (4, 8, 12):
    cbox('Ring', (0, y, 0), (.8, .2, .8), 11)

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
mesh('DrillCone', v, [tuple(range(6))] + [(k, (k + 1) % 6, 6) for k in range(6)], 27)
for sx, dz in ((-1, .25), (-1, -.25)):
    beam('Claw', (-2.15, 2.4, 2.1), (-2.15 + .2, 2.4 + dz * 2, 2.9), .2, .2, 0)
finish(__file__)
