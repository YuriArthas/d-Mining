"""第三世界 surface props, 星陨秘境: a crater where a star fell, in big flat colour blocks (white marble, pale lilac
stone, gold, deep violet / teal / pink crystal) on pale stardust: the ore buyer and the gear shop (white marble
observatories with gold-ribbed domes, an open counter, shelves of goods and a big emblem: a star crystal, crossed
pickaxes), the fallen star (hung and turning over the shaft), the crater arch at the far side of the shaft (the
world's name on its keystone), the world portal (a marble ring with gold clamps on a round step), the teleport
station, rail posts round the crater's mouth, star lanterns, crystal trees (a thick pale trunk, three big faceted
crowns) in violet, teal and pink, crystal clusters and a small fallen shard.
Run: blender -b --python tools/blender/build_star_base.py
Shared atlas, primitives and report in cave_props.py; tools/underground/starBaseHall.ts places the props.
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike

# Panels carry soft seams inside the tile. Glow tiles are deep and saturated (the emission plus the lit colour must
# keep their hue). The sunless white and gold glow too, for fronts that face away from the sun (the observatories'
# porticoes face the path, some of them north): dark, they glow to the colour the sunlit ones show.
def panel(base, light, dark):
    return (base, [(3, 3, 26, 2, light), (3, 27, 26, 2, dark), (3, 3, 2, 26, light), (27, 3, 2, 26, dark)])
def facets(base, light, dark):
    return (base, [(4, 4, 10, 22, light), (18, 8, 8, 18, dark)])
TILES = [
    panel('f2eef8', 'fbf9fd', 'd9d2e6'),                                       # 0 white marble
    panel('b9aed6', 'cac1e2', '9d91bf'),                                       # 1 lilac stone
    panel('d9d1ea', 'e6e0f2', 'c2b8da'),                                       # 2 pale lilac stone
    ('f2be36', [(3, 3, 26, 4, 'ffd86a'), (5, 26, 24, 3, 'd8a020')]),           # 3 gold
    ('5e5a66', [(3, 27, 26, 2, '56525e')]),                                    # 4 sunless white (glows)
    ('5e4812', [(3, 3, 26, 3, '6a5418'), (3, 26, 26, 3, '52400e')]),           # 5 sunless gold (glows)
    ('5a1ea8', [(6, 6, 20, 20, '7230c8'), (11, 11, 10, 10, '8c48e0')]),        # 6 glow violet (deep)
    ('0c6c74', [(6, 6, 20, 20, '12808a'), (11, 11, 10, 10, '1a9aa4')]),        # 7 glow teal (deep)
    ('b89a60', [(6, 6, 20, 20, 'c8ac72')]),                                    # 8 glow warm white (deep)
    ('8a1e62', [(6, 6, 20, 20, 'a42c78'), (11, 11, 10, 10, 'bc3c8e')]),        # 9 glow pink (deep)
    panel('4a3488', '5a42a0', '3a286e'),                                       # 10 violet board
    panel('1fb0b8', '3ccad0', '168890'),                                       # 11 teal paint
    panel('e46aa6', 'f084b8', 'c8508a'),                                       # 12 pink paint
    facets('ffcf3a', 'ffe27a', 'e0a818'),                                      # 13 star gold
    facets('9c66e6', 'b88cf2', '7a46c8'),                                      # 14 violet crystal
    facets('36d2ca', '6ae6de', '1ea8a2'),                                      # 15 teal crystal
    facets('f08ac6', 'f8acd8', 'd466a6'),                                      # 16 pink crystal
    ('ebe2d2', [(0, 6, 32, 3, 'd8cdb8'), (0, 20, 32, 3, 'd8cdb8')]),           # 17 pale trunk rings
    ('b8865a', [(3, 3, 26, 2, 'c89868'), (3, 26, 26, 3, '9c6e46')]),           # 18 warm interior
    ('c07c3c', [(2, 9, 28, 2, 'a86630'), (2, 20, 28, 2, 'a86630'), (6, 3, 2, 26, 'd08c4a')]),  # 19 wood
    ('c4520a', [(6, 6, 20, 20, 'dc6a14'), (11, 11, 10, 10, 'ee8a24')]),        # 20 glow orange (deep)
    ('2e2640', []),                                                            # 21 shadow
    ('8a8098', [(3, 4, 12, 6, '9c92aa'), (16, 18, 12, 6, '786e88')]),          # 22 moon rock
    ('a4aab4', [(3, 4, 26, 4, 'c4c9d0'), (3, 18, 26, 3, '868c96')]),           # 23 steel
    ('a0603a', [(3, 12, 26, 3, '7c4626'), (12, 3, 8, 8, 'b87448')]),           # 24 backpack leather
    ('d8302a', [(4, 4, 10, 22, 'f05a48'), (18, 8, 8, 18, 'a81e1a')]),          # 25 red gem
    ('2a7ae8', [(4, 4, 10, 22, '5a9cf6'), (18, 8, 8, 18, '1a58c0')]),          # 26 blue gem
]
GLOW = {4, 5, 6, 7, 8, 9, 20}
start('StarBase', 'star-base', TILES, glowing=GLOW)

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
def crystal(name, x, y, z, h, r, t, lean=(0, 0), sides=6):
    spike(name, x, z, h, r, sides, t, lean=lean, y=y, tip=.7, spin=.3)
def gem(name, x, y, z, w, h, t, sides=6, spin=0):
    """A chunky faceted gem (a bipyramid with a short waist): the crystal trees' crowns."""
    v = [(x, y - h * .45, z)]
    for yy, rr in ((y - h * .1, w / 2), (y + h * .15, w / 2)):
        for k in range(sides):
            a = spin + 2 * math.pi * k / sides
            v.append((x + math.cos(a) * rr, yy, z + math.sin(a) * rr))
    v.append((x, y + h * .55, z))
    s = sides; top = 2 * s + 1
    f = [(0, 1 + (k + 1) % s, 1 + k) for k in range(s)] + [(1 + k, 1 + (k + 1) % s, 1 + s + (k + 1) % s, 1 + s + k) for k in range(s)] + [(1 + s + k, 1 + s + (k + 1) % s, top) for k in range(s)]
    return mesh(name, v, f, t)
def star_points(outer, inner, tilt=0, cx=0, cy=0):
    return [(cx + math.cos(math.pi / 2 + tilt + k * math.pi / 5) * (outer if k % 2 == 0 else inner),
             cy + math.sin(math.pi / 2 + tilt + k * math.pi / 5) * (outer if k % 2 == 0 else inner)) for k in range(10)]
def star3d(name, cx, cy, z, outer, inner, depth, t):
    """A faceted five-point star in the XY plane round (cx, cy): its outline at z, a raised apex front and back."""
    pts = star_points(outer, inner, 0, cx, cy)
    v = [(x, y, z) for x, y in pts] + [(cx, cy, z + depth / 2), (cx, cy, z - depth / 2)]
    f = [(k, (k + 1) % 10, 10) for k in range(10)] + [((k + 1) % 10, k, 11) for k in range(10)]
    return mesh(name, v, f, t)
def pickaxe(name, c, d, length, head, z0, z1, handle_t=19, head_t=23):
    """A flat pickaxe in the XY plane: the handle from c along -d (length), the curved head across its top at c."""
    p = (-d[1], d[0])
    beam(name + 'Handle', (c[0] - d[0] * length, c[1] - d[1] * length, (z0 + z1) / 2), (c[0], c[1], (z0 + z1) / 2), length * .1, z1 - z0, handle_t)
    pts = [(c[0] + p[0] * s * head - d[0] * abs(s) ** 1.6 * head * .4, c[1] + p[1] * s * head - d[1] * abs(s) ** 1.6 * head * .4) for s in (-1, -.5, 0, .5, 1)]
    for a, b in zip(pts, pts[1:]):
        beam(name + 'Head', (a[0], a[1], (z0 + z1) / 2), (b[0], b[1], (z0 + z1) / 2), head * .26, (z1 - z0) * 1.2, head_t)

# OBSERVATORIES, front +Z, about 11 x 12 m on a round plinth (top .4): a white marble drum round (0, -3.4) behind a
# marble portico (z 0 - 2.3) with an opening (x +-3.5, y .4-4.4) framed in the paint colour, a dome in the paint
# colour ribbed in gold or marble, a violet board over the opening (the game's sign floats in front at z 2.46,
# y 5.6) and an emblem on top. Inside: a warm back wall with shelves of goods, a lit ceiling, a counter.
DC, DR = -3.4, 4.6
def observatory(name, paint, glow, front=None, white=0, dome_t=2, rib_t=3):
    front = paint if front is None else front
    model(name)
    lathe('Plinth', [(0, 6.2), (.4, 6.2)], 16, 2, cz=-2.2, spin=math.pi / 16)
    lathe('Drum', [(.4, DR), (4.6, DR)], 12, 0, cz=DC, spin=math.pi / 12, cap_top=False, cap_bottom=False)
    lathe('DrumBand', [(4.3, DR + .1), (4.7, DR + .1)], 12, paint, cz=DC, spin=math.pi / 12, cap_bottom=False)
    dome = [(4.7, DR - .15)] + [(4.7 + 3.4 * math.sin(math.pi / 2 * k / 5), (DR - .15) * math.cos(math.pi / 2 * k / 5)) for k in range(1, 5)] + [(8.1, 0)]
    lathe('Dome', dome, 12, dome_t, cz=DC, spin=math.pi / 12)
    for k in range(6):
        a = math.pi / 12 + k * math.pi / 3
        rib = [(math.cos(a) * (DR - .08) * math.cos(math.pi / 2 * j / 5), 4.7 + 3.45 * math.sin(math.pi / 2 * j / 5), DC + math.sin(a) * (DR - .08) * math.cos(math.pi / 2 * j / 5)) for j in range(6)]
        for p, q in zip(rib, rib[1:]): beam('DomeRib', p, q, .26, .2, rib_t)
    lathe('Lantern', [(8.0, .7), (8.9, .7), (9.3, 0)], 8, 3, cz=DC)
    cbox('LanternGlow', (0, 8.45, DC), (.9, .5, .9), glow, q=.15)
    # The portico: two piers either side of the opening, a beam over it and a roof slab, open in front.
    for s in (-1, 1):
        box('PorticoPier', (s * 3.95, 2.6, 1.15), (.9, 4.4, 2.3), white)
        box('PorticoSide', (s * 4.35, 2.6, -.2), (.1, 4.4, .6), white)
    box('PorticoBeam', (0, 4.6, 1.15), (8.8, .4, 2.3), white)
    box('PorticoRoof', (0, 4.95, 1.0), (9.2, .3, 2.7), 2)
    for s in (-1, 1):
        lathe('Column', [(.4, .36), (4.4, .3)], 8, white, cx=s * 3.75, cz=2.42)
        cbox('ColumnCap', (s * 3.75, 4.5, 2.42), (.8, .2, .8), 3, q=.1)
        box('WallLamp', (s * 4.35, 3.7, 2.36), (.3, .5, .16), 8)
    box('OpeningLintel', (0, 4.6, 2.36), (8.4, .5, .3), front)
    box('Board', (0, 5.6, 2.3), (5.4, 1.3, .2), 10)
    box('BoardTrim', (0, 6.3, 2.32), (5.6, .1, .22), glow)
    box('BoardTrim', (0, 4.92, 2.32), (5.6, .1, .22), glow)
    cbox('Pediment', (0, 6.6, 1.4), (6.2, .5, 2.4), white, q=.2)
    # Inside, seen through the opening.
    box('BackWall', (0, 2.6, .1), (7.6, 4.4, .2), 18)
    box('Floor', (0, .42, 1.2), (7.6, .04, 2.2), 2)
    box('Ceiling', (0, 4.38, 1.15), (7.0, .04, 2.3), 18)
    box('CeilingLight', (0, 4.3, 1.5), (6.4, .1, .5), 8)
    for y in (1.7, 2.9): box('Shelf', (0, y, .45), (6.6, .1, .5), 19)
    box('Counter', (0, .95, 2.65), (6.6, 1.1, .8), front)
    box('CounterTop', (0, 1.56, 2.7), (6.9, .12, 1.0), 0)
    box('CounterGlow', (0, 1.25, 3.06), (6.2, .1, .04), glow)

observatory('Star_Buyer', 3, 20, front=5, white=4, dome_t=3, rib_t=0)
# A big star crystal over the portico (violet crystals round a gold star), ore on the shelves and the counter.
star3d('EmblemStar', 0, 8.5, 1.4, 1.5, .64, .7, 13)
star3d('EmblemCore', 0, 8.5, 1.45, .7, .3, .9, 6)
for x, h, lean in ((-1.3, 1.5, (-.3, 0)), (1.3, 1.6, (.3, 0)), (-.6, 1.1, (-.1, .1)), (.7, 1.2, (.1, .1))):
    crystal('EmblemCrystal', x, 6.8, 1.4, h, .32, 14, lean=lean)
for k, x in enumerate((-2.6, -1.7, -.85, 0, .85, 1.7, 2.6)):
    for y in (1.75, 2.95):
        t = (14, 15, 16, 13)[(k + int(y)) % 4]
        if t == 13: star3d('ShelfStar', x, y + .32, .45, .3, .13, .14, 13)
        else: crystal('ShelfOre', x, y + .05, .45, .55, .18, t)
for x, t in ((-2.6, 14), (-1.9, 15), (-.6, 16), (-.2, 14)): crystal('CounterOre', x, 1.62, 2.7, .7, .22, t)
star3d('CounterStar', .9, 1.98, 2.7, .42, .18, .2, 13)
cbox('Scale', (-1.2, 1.7, 2.75), (.9, .16, .6), 23)
cbox('ScaleTray', (-1.2, 1.85, 2.75), (1.0, .08, .7), 3)

observatory('Star_Workshop', 11, 7, dome_t=11, rib_t=3)
# Crossed pickaxes over the portico on a gold ring, pickaxes on the back wall, backpacks on the shelves.
ring('EmblemRing', 8.3, 1.5, 1.85, 1.15, 1.45, 3)
prism('EmblemDisc', circle(1.5, 24, 0, 8.3), 1.15, 1.35, 0, axis='z')
pickaxe('EmblemPickA', (.9, 9.0), (.7071, .7071), 2.3, .9, 1.4, 1.6)
pickaxe('EmblemPickB', (-.9, 9.0), (-.7071, .7071), 2.3, .9, 1.6, 1.8)
for k, x in enumerate((-2.6, -1.3, 0, 1.3, 2.6)):
    pickaxe('WallPick', (x, 4.0), (0, 1), 1.0, .42, .22, .3, head_t=(25, 26, 3, 23, 14)[k])
    cbox('Backpack', (x, 2.0, .45), (.62, .6, .4), 24, q=.08)
    box('BackpackFlap', (x, 2.18, .66), (.5, .22, .04), (11, 12, 3, 11, 12)[k])
    cbox('Toolbox', (x + .1, 3.15, .45), (.7, .4, .38), (11, 12, 3, 12, 11)[k], q=.06)
for k, x in enumerate((-.4, .6, 1.6)):
    beam('CounterPickHandle', (x - .5, 1.68, 2.62), (x + .4, 1.68, 2.62), .1, .08, 19)
    beam('CounterPickHead', (x + .4, 1.68, 2.32), (x + .4, 1.68, 2.92), .14, .12, (26, 3, 25)[k])
cbox('Anvil', (-2.4, 1.78, 2.7), (.9, .32, .5), 23, q=.08)

# THE FALLEN STAR, hung over the shaft and turning: a big faceted gold star, a violet core on both faces, a ring of
# small shards round it. Origin at its centre.
model('Fallen_Star')
star3d('Star', 0, 0, 0, 4.2, 1.8, 2.4, 13)
star3d('CoreFront', 0, 0, .55, 1.9, .82, 1.6, 6)
star3d('CoreBack', 0, 0, -.55, 1.9, .82, 1.6, 6)
for k in range(5):
    a = math.pi / 2 + math.pi / 5 + k * 2 * math.pi / 5
    gem('Orbit', math.cos(a) * 4.6, math.sin(a) * 4.6, 0, .7, 1.0, (14, 15, 16, 14, 15)[k], spin=k)

# THE CRATER ARCH at the far side of the shaft, front +Z: two moonstone pillars topped with crystals, a gold arch
# between them, the keystone's violet board facing the spawn (the world's name floats at y 11.6, z .6).
model('Crater_Arch')
for s in (-1, 1):
    lathe('Pillar', [(0, 1.3), (.5, 1.3), (.5, 1.0), (8.6, .85), (9.0, 1.1), (9.4, 1.1)], 8, 1, cx=s * 9.0, spin=math.pi / 8)
    lathe('PillarBand', [(3.0, 1.02), (3.4, 1.02)], 8, 3, cx=s * 9.0, spin=math.pi / 8, cap_bottom=False)
    crystal('PillarCrystal', s * 9.0, 9.3, 0, 2.6, .55, 14 if s < 0 else 15)
    crystal('PillarCrystal', s * 9.0 - .5, 9.3, .3, 1.6, .36, 16, lean=(-.3, .1))
    crystal('PillarCrystal', s * 9.0 + .5, 9.3, -.3, 1.7, .38, 14, lean=(.3, -.1))
arc = [(math.cos(math.pi * k / 16) * 9.0, 8.4 + math.sin(math.pi * k / 16) * 3.2) for k in range(17)]
band('Arch', [(x * 1.06, y + .3) for x, y in arc], [(x * .94, y - .3) for x, y in arc], -.4, .4, 3)
cbox('Keystone', (0, 11.6, 0), (5.4, 1.6, .9), 2, q=.3)
box('KeystoneBoard', (0, 11.6, .46), (5.0, 1.25, .06), 10)
star3d('KeystoneStar', 0, 13.0, 0, .8, .34, .5, 13)

# THE WORLD PORTAL, front +Z (placed facing the shaft), origin on the ground under the ring's centre: a thin round
# plate (the glowing pad the game draws in front, 2.8 m out, lies just above it), a white marble ring round the sheet the game draws (2.9 m up, 1.85 across) with gold clamps and two pedestals,
# a violet crystal crown on top.
model('Star_Portal')
lathe('Plate', [(0, 3.4), (.04, 3.4)], 24, 2, spin=math.pi / 24)
lathe('PlateRim', [(0, 3.6), (.05, 3.6)], 24, 3, spin=math.pi / 24, cap_top=False)
ring('Ring', 2.9, 2.0, 2.55, -.35, .35, 0, n=28)
ring('RingTrim', 2.9, 2.55, 2.68, -.4, .4, 3, n=28)
ring('RingGlow', 2.9, 1.92, 2.02, -.3, .3, 6, n=28)
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    cbox('Clamp', (math.cos(a) * 2.6, 2.9 + math.sin(a) * 2.6, 0), (.6, .6, .9), 3, q=.1)
for s in (-1, 1):
    cbox('Pedestal', (s * 2.1, .7, 0), (1.2, 1.0, 1.2), 2, q=.18)
    cbox('PedestalCap', (s * 2.1, 1.28, 0), (1.3, .16, 1.3), 3, q=.18)
crystal('Crown', 0, 5.4, 0, 1.8, .5, 14)
crystal('Crown', -.7, 5.3, 0, 1.2, .34, 15, lean=(-.35, 0))
crystal('Crown', .7, 5.3, 0, 1.25, .34, 16, lean=(.35, 0))

# THE TELEPORT STATION, front +Z (placed facing the spawn): a round plate flush with the stardust (the glowing pad
# the game draws 2.8 m in front lies on it), two marble pillars with gold caps, an arched lintel and a teal ring
# round the portal disc the game draws (2.75 m up, 1.32 across).
model('Star_Station')
lathe('Platform', [(0, 3.1), (.05, 3.1)], 20, 2, spin=math.pi / 20)
lathe('PlatformRim', [(0, 3.3), (.06, 3.3)], 20, 3, spin=math.pi / 20, cap_top=False)
for s in (-1, 1):
    cbox('PillarFoot', (s * 1.9, .25, 0), (1.1, .5, 1.1), 1, q=.14)
    lathe('Pillar', [(.05, .5), (4.9, .42)], 8, 0, cx=s * 1.9)
    cbox('PillarCap', (s * 1.9, 5.05, 0), (1.1, .3, 1.1), 3, q=.14)
    star3d('PillarStar', s * 1.9, 5.65, 0, .45, .2, .3, 13)
band('Lintel', [(math.cos(math.pi * k / 12) * 2.5, 5.0 + math.sin(math.pi * k / 12) * 1.0) for k in range(13)],
     [(math.cos(math.pi * k / 12) * 1.9, 4.9 + math.sin(math.pi * k / 12) * .7) for k in range(13)], -.4, .4, 0)
ring('DiscRing', 2.75, 1.36, 1.6, -.15, .15, 7, n=28)
ring('DiscTrim', 2.75, 1.6, 1.7, -.18, .18, 3, n=28)

# RAIL POSTS round the crater's mouth: a short moonstone post with a gold cap and a small glowing star on top; the
# gate posts either side of each opening are taller with a bigger star.
model('Star_Post')
cbox('Post', (0, .55, 0), (.34, 1.1, .34), 1, q=.06)
cbox('Cap', (0, 1.14, 0), (.44, .1, .44), 3, q=.06)
star3d('Star', 0, 1.42, 0, .22, .1, .12, 13)
model('Star_Post_Gate')
cbox('Post', (0, .8, 0), (.46, 1.6, .46), 1, q=.08)
cbox('Cap', (0, 1.65, 0), (.58, .12, .58), 3, q=.08)
star3d('Star', 0, 2.05, 0, .36, .16, .2, 13)
star3d('Glow', 0, 2.05, 0, .2, .09, .24, 20)

# STAR LANTERN: a white pole on a lilac foot, a gold band, a gold star head with a warm glowing heart (halo 4.8 up).
model('Star_Lamp')
cbox('Base', (0, .2, 0), (.6, .4, .6), 1)
cbox('Pole', (0, 2.4, 0), (.24, 4.0, .24), 0, q=.05)
box('Band', (0, 1.0, 0), (.3, .24, .3), 3)
star3d('Head', 0, 4.85, 0, .72, .31, .42, 13)
star3d('Heart', 0, 4.85, 0, .36, .16, .5, 20)

# CRYSTAL TREES: a thick pale trunk leaning a little, three big faceted crowns (no thin branches).
for name, tiles in (('Crystal_Tree_Violet', (14, 16, 14)), ('Crystal_Tree_Teal', (15, 14, 15)), ('Crystal_Tree_Pink', (16, 15, 16))):
    model(name)
    lathe('Trunk', [(0, .55), (1.4, .45), (2.8, .36), (3.4, .3)], 7, 17)
    beam('Bough', (0, 2.6, 0), (-.9, 3.4, .2), .34, .34, 17)
    beam('Bough', (0, 2.4, 0), (.85, 3.2, -.3), .32, .32, 17)
    gem('Crown', 0, 4.6, 0, 2.6, 3.0, tiles[0], sides=7)
    gem('Crown', -1.15, 3.7, .25, 1.7, 2.0, tiles[1], spin=.4)
    gem('Crown', 1.05, 3.5, -.35, 1.6, 1.9, tiles[2], spin=.8)

# CRYSTAL CLUSTERS on the stardust (the glow tiles keep them bright in the shade) and a small fallen shard.
for name, t, glow in (('Crystal_Cluster_Violet', 14, 6), ('Crystal_Cluster_Teal', 15, 7), ('Crystal_Cluster_Pink', 16, 9)):
    model(name)
    lathe('Foot', [(0, .9), (.25, .8), (.4, .3)], 7, 22)
    for (x, z), h, r, lean in (((0, 0), 1.9, .34, (0, 0)), ((.5, .2), 1.3, .26, (.3, .1)), ((-.45, .25), 1.1, .24, (-.3, .15)), ((.1, -.45), 1.2, .25, (.05, -.3))):
        crystal('Crystal', x, .2, z, h, r, t, lean=lean)
    crystal('Heart', 0, .3, 0, .9, .16, glow)
model('Star_Fragment')
lathe('Rock', [(-.2, 1.1), (.3, 1.0), (.65, .55), (.8, 0)], 7, 22)
star3d('Star', .2, 1.25, .1, .9, .38, .5, 13)
star3d('Core', .2, 1.25, .1, .42, .18, .62, 6)
finish(__file__)
