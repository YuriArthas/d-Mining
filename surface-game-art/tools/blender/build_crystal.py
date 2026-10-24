"""水晶洞穴 hall props: giant crystal spires (cyan, pink, violet), small crystal clusters, an open geode half
shell, geode rim stones, the sale stall under a silver canopy crowned with crystals, the name board frame on pale
stone pillars, the pit post with a crystal cap, and the lantern post (a pale crystal lamp). Shared atlas,
primitives and prop footprints in cave_props.py.
Run: blender -b --python tools/blender/build_crystal.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, stall, lantern_post, name_board, pit_post

TILES = [
    ('5a6890', [(4, 6, 24, 3, '6a78a2'), (6, 24, 18, 2, '4c5a80')]),           # 0 silver-blue frame
    ('c8d0e6', [(4, 5, 24, 3, 'd8def0'), (6, 24, 19, 2, 'b6c0da')]),           # 1 pale stone (counter)
    ('8a96bc', [(4, 5, 10, 3, '98a4c8'), (18, 20, 10, 6, '7a86ae')]),          # 2 blue stone
    ('6a78b4', [(3, 4, 9, 3, '7a88c4'), (17, 20, 9, 4, '5c6aa4')]),            # 3 crystal sand
    ('dfe6f6', [(3, 4, 26, 3, 'f2f6ff'), (5, 25, 22, 2, 'c8d2ea')]),           # 4 silver roof
    ('a8b4d8', [(3, 4, 26, 3, 'bac4e4'), (5, 25, 22, 2, '96a2c8')]),           # 5 silver trim
    ('eef2ff', [(4, 4, 3, 24, 'dce4f8')]),                                     # 6 pale
    ('9af6ff', [(8, 8, 16, 16, 'e0fcff')]),                                    # 7 glow cyan
    ('ffa6ea', [(8, 8, 16, 16, 'ffe0f6')]),                                    # 8 glow pink
    ('e0f4ff', [(6, 6, 20, 20, 'ffffff')]),                                    # 9 glow lamp (pale crystal)
    ('3a4670', [(4, 5, 22, 3, '4a5682')]),                                     # 10 iron
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),           # 11 gold
    ('58d6e8', [(4, 4, 8, 20, '9af0f6'), (18, 8, 6, 16, '3db3c7')]),           # 12 ore crystal
    ('8a90b0', [(2, 10, 28, 3, '9aa0c0'), (2, 20, 28, 3, '7a80a0')]),          # 13 rope
    ('3e4a86', [(4, 5, 24, 3, '4c58a0')]),                                     # 14 board
    ('22283f', []),                                                            # 15 shadow
    ('48d2ee', [(3, 3, 9, 26, '8ceaff'), (20, 3, 6, 26, '30b4d6')]),           # 16 crystal cyan body, facets
    ('f070cc', [(3, 3, 9, 26, 'ffaee6'), (20, 3, 6, 26, 'd456b0')]),           # 17 crystal pink body
    ('a07cf4', [(3, 3, 9, 26, 'c8b0ff'), (20, 3, 6, 26, '8462d8')]),           # 18 crystal violet body
    ('cdb0ff', [(8, 8, 16, 16, 'f0e6ff')]),                                    # 19 glow violet
    ('5c6698', [(4, 5, 10, 3, '6a74a8'), (18, 20, 10, 6, '4e5888')]),          # 20 rock foot
    ('b8a6e0', [(4, 4, 24, 4, 'cabcf0'), (6, 22, 20, 3, 'a694d0')]),           # 21 geode lining
]
start('Crystal', 'crystal', TILES, glowing={7, 8, 9, 19})
TINT = {'cyan': (16, 7), 'pink': (17, 8), 'violet': (18, 19)}

def crystal(name, base, axis, h, r, body, glow, sides=6, tip=.72, spin=0):
    """A faceted crystal prism: straight sides to `tip` of its length, then a point that glows."""
    ax = [axis[0], axis[1], axis[2]]; n = math.sqrt(sum(v * v for v in ax)); ax = [v / n for v in ax]
    ref = (0, 0, 1) if abs(ax[1]) > .9 else (0, 1, 0)
    u = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]]
    un = math.sqrt(sum(v * v for v in u)); u = [v / un for v in u]
    w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]]
    pts = []
    for t, rr in ((0, r), (h * tip, r * 1.04), (h, 0)):
        for k in range(sides):
            a = spin + 2 * math.pi * k / sides; c, s = math.cos(a) * rr, math.sin(a) * rr
            pts.append(tuple(base[i] + ax[i] * t + u[i] * c + w[i] * s for i in range(3)))
    S = sides
    faces = [tuple(reversed(range(S)))] + [(k, (k + 1) % S, (k + 1) % S + S, k + S) for k in range(S)] + [(S + k, S + (k + 1) % S, 2 * S + (k + 1) % S, 2 * S + k) for k in range(S)]
    return mesh(name, pts, faces, [body] + [body] * S + [glow] * S)
def lean(a, tilt): return (math.sin(tilt) * math.cos(a), math.cos(tilt), math.sin(tilt) * math.sin(a))

# GIANT SPIRE, unit height (placed scaled by its height): a tall central prism with four leaning companions on a
# chunky rock foot, so the silhouette reads as one big crystal clump from across the hall.
def spire(name, tint, second):
    model(name)
    body, glow = TINT[tint]; body2, glow2 = TINT[second]
    lathe('Foot', [(0, .24), (.05, .22), (.11, .15), (.15, .07)], 8, 20, spin=.2)
    crystal('Core', (0, .05, 0), lean(.3, .05), 1.0, .14, body, glow, spin=.3)
    for i, (a, tilt, h, r, alt) in enumerate([(0, .42, .62, .1, False), (2.1, .5, .52, .09, True), (3.7, .38, .46, .085, False), (5.0, .6, .34, .07, True)]):
        crystal('Side', (math.cos(a) * .12, .06, math.sin(a) * .12), lean(a, tilt), h, r, body2 if alt else body, glow2 if alt else glow, spin=a)
spire('Spire_Cyan', 'cyan', 'violet')
spire('Spire_Pink', 'pink', 'violet')
spire('Spire_Violet', 'violet', 'cyan')

# SMALL CLUSTER, about 1.2 m: for wall feet and the stall's crates.
def cluster(name, tint, second):
    model(name)
    body, glow = TINT[tint]; body2, glow2 = TINT[second]
    lathe('Foot', [(0, .45), (.15, .38), (.28, .14)], 7, 20)
    for i, (x, z, a, tilt, h, r) in enumerate([(0, 0, 0, .08, 1.25, .17), (.26, .1, .4, .45, .8, .13), (-.24, .16, 2.6, .5, .7, .12), (.04, -.26, 4.6, .4, .6, .11)]):
        crystal('Crystal', (x, .15, z), lean(a, tilt), h, r, body2 if i % 2 else body, glow2 if i % 2 else glow, spin=i)
cluster('Cluster_Cyan', 'cyan', 'pink')
cluster('Cluster_Pink', 'pink', 'cyan')

# OPEN GEODE: a half shell (front open toward +Z), rough rock outside, lilac lining inside, crystals growing in
# from the lining toward the centre. About 5 m wide and 3.4 m high.
model('Geode_Open')
R, sides, bands = 2.6, 9, 5
verts, faces, tiles = [], [], []
def ring(scale, y0):
    out = []
    for b in range(bands + 1):
        phi = b / bands * math.pi / 2 * .92
        for k in range(sides + 1):
            th = math.pi + k / sides * math.pi  # back half: -Z side
            rr = R * scale * math.cos(phi) * (1 + .06 * math.sin(k * 2.3 + b))
            out.append((math.cos(th) * rr, y0 + R * scale * 1.25 * math.sin(phi), math.sin(th) * rr))
    return out
outer, inner = ring(1, 0), ring(.8, .15)
verts = outer + inner; m = len(outer); row = sides + 1
for b in range(bands):
    for k in range(sides):
        i = b * row + k
        faces.append((i, i + 1, i + row + 1, i + row)); tiles.append(20)
        faces.append((m + i + row, m + i + row + 1, m + i + 1, m + i)); tiles.append(21)
for k in range(sides):  # rim band along the open front edge and the top
    faces.append((k, k + 1, m + k + 1, m + k)); tiles.append(6)
for b in range(bands):  # the two cut ends
    for e in (0, sides):
        i = b * row + e
        faces.append((i, i + row, m + i + row, m + i) if e == 0 else (m + i, m + i + row, i + row, i)); tiles.append(6)
top = bands * row
faces.append(tuple([top + k for k in range(row)] + [m + top + k for k in reversed(range(row))])); tiles.append(20)
mesh('Shell', verts, faces, tiles)
for i, (k, b, h, r, t) in enumerate([(1, 0, 1.3, .2, 'pink'), (3, 1, 1.6, .24, 'cyan'), (5, 0, 1.4, .22, 'violet'), (7, 1, 1.2, .2, 'pink'), (4, 3, 1.1, .18, 'pink'), (2, 2, .9, .16, 'violet'), (6, 2, 1.0, .17, 'cyan')]):
    x, y, z = inner[b * row + k]
    body, glow = TINT[t]
    crystal('Inner', (x, y, z), (-x, max(.3, 1.4 - y), -z * 1.2 + .8), h, r, body, glow, spin=i)
lathe('Floor', [(0, R * .82), (.16, R * .78)], 10, 3, spin=0)

# GEODE RIM STONE: one chunky pale stone with crystal teeth on its inner edge (placed in a ring round the pool).
model('Geode_Stone')
prism('Stone', [(-.6, -.34), (.55, -.38), (.68, .1), (.44, .4), (-.46, .36), (-.68, .02)], 0, .46, 2)
prism('Lining', [(-.48, -.24), (.44, -.28), (.52, .06), (.32, .26), (-.36, .24), (-.52, 0)], .46, .52, 21)
for x, h, t in ((-.25, .5, 'cyan'), (.05, .66, 'pink'), (.33, .42, 'violet')):
    crystal('Tooth', (x, .46, -.18), lean(-math.pi / 2, .35), h, .09, TINT[t][0], TINT[t][1], spin=x)

# SALE STALL under a silver canopy crowned with a crystal clump; pale stone posts.
def roof():
    prism('Roof', stepped(5.8, 3.6, .4), 3.6, 3.86, 4)
    prism('RoofTrim', stepped(6.1, 3.9, .45), 3.5, 3.6, 5)
    prism('RoofCap', stepped(4.2, 2.4, .35), 3.86, 4.06, 5)
    crystal('Crown', (0, 4.0, -.2), lean(0, .02), 1.7, .3, 16, 7, spin=.3)
    crystal('Crown', (-.55, 4.0, -.1), lean(math.pi, .4), 1.1, .2, 17, 8, spin=1)
    crystal('Crown', (.55, 4.0, -.3), lean(0, .45), 1.0, .2, 18, 19, spin=2)
for name, badge in (('Stall_Sell', 'coin'), ('Stall_Shop', 'pick')):
    stall(name, badge, roof, lambda x, z: (prism('PostFoot', [(x + a, z + b) for a, b in stepped(.56, .56, .12)], .2, .55, 2), prism('Post', [(x + a, z + b) for a, b in stepped(.36, .36, .08)], .55, 3.55, 1)), stock_tile=16)

lantern_post()

# NAME BOARD on two pale stone pillars, each capped with a crystal clump.
def upright(x):
    prism('UprightFoot', [(x + a, b) for a, b in stepped(1.0, 1.0, .2)], 0, .6, 2)
    prism('Upright', [(x + a, b) for a, b in stepped(.62, .62, .14)], .6, 7.5, 1)
    prism('UprightCap', [(x + a, b) for a, b in stepped(.9, .9, .2)], 7.5, 7.8, 5)
    t = 'cyan' if x < 0 else 'pink'
    crystal('CapCrystal', (x, 7.8, 0), lean(0, .05), 1.4, .26, TINT[t][0], TINT[t][1], spin=x)
    crystal('CapCrystal', (x + .2, 7.8, .1), lean(.4, .5), .8, .16, 18, 19, spin=x + 1)
name_board(upright)

# PIT POST with a cyan crystal cap.
pit_post(lambda: crystal('PostCrystal', (0, 1.1, 0), (0, 1, 0), .7, .17, 16, 7))
finish(__file__)
