"""The later worlds' egg stands, one prop per egg (Egg_stand-<egg id>): the same stand as Pinewind's terrace (a
stepped plinth, a lip and a nest under a big faceted egg; build_architecture.py) in each world's palette - world 2
white panels, a yellow lip and a teal nest; world 3 deep navy, a gold lip and a violet nest. Each egg has its own
body colour with ivory and deep spots, as on the terrace. The bases place them (techBaseHall.ts, starBaseHall.ts).
Eggs and colours come from surface-game-art/egg-stands.json (node tools/export-egg-stands.mjs).
Run: blender -b --python tools/blender/build_egg_stands.py
"""
import sys, json, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cave_props
from cave_props import start, finish, model, mesh, prism, stepped, solid, ROOT

EGGS = json.loads((ROOT / 'egg-stands.json').read_text())['eggs']
def shade(h, f):
    c = cave_props.rgb(h); return ''.join('%02x' % int(round(v * (1 + f) if f < 0 else v + (255 - v) * f)) for v in c)
def panel(base, light, dark):
    return (base, [(3, 3, 26, 2, light), (3, 27, 26, 2, dark), (3, 3, 2, 26, light), (27, 3, 2, 26, dark)])
# Per world: plinth, lip, nest.
KITS = {
    2: [panel('eceeef', 'f8f9f9', 'cfd3d7'), ('f5c02a', [(3, 3, 26, 3, 'ffd65a'), (3, 26, 26, 3, 'dca41c')]), ('1fb0b8', [(3, 4, 26, 4, '3ccad0'), (3, 20, 26, 3, '168890')])],
    3: [panel('2a3152', '3a4470', '1c2238'), ('f2be36', [(3, 3, 26, 4, 'ffd86a'), (5, 26, 24, 3, 'd8a020')]), ('6a48c8', [(3, 4, 26, 4, '8462dc'), (3, 20, 26, 3, '5236a4')])],
}
TILES, KIT_TILES, EGG_TILES = [], {}, {}
for world, kit in KITS.items():
    KIT_TILES[world] = list(range(len(TILES), len(TILES) + len(kit))); TILES.extend(kit)
for e in EGGS:
    base, deep = shade(e['color'], .16), shade(e['color'], -.32)
    EGG_TILES[e['id']] = (len(TILES), len(TILES) + 1)
    TILES.append((base, [(5, 9, 5, 5, 'fff0cc'), (10, 12, 4, 5, 'fff0cc'), (19, 22, 6, 4, deep), (22, 18, 5, 5, deep)]))
    TILES.append((base, []))
start('EggStands', 'egg-stands', TILES, glowing=set(), rows=8)

def egg(name, at, h, spotted, plain):
    """A connected, solid eight-sided egg with four broad faceted bands (as Pinewind's). Atlas V follows the WHOLE
    egg, so spots do not repeat as stripes on every band."""
    x, y, z = at
    profile = [(0, .24), (.22, .42), (.62, .40), (.86, .25), (1.0, .10)]
    n = 8; vs = []
    for yy, r in profile:
        for i in range(n):
            a = 2 * math.pi * i / n + math.pi / 8
            vs.append((x + math.cos(a) * r * h, y + yy * h, z + math.sin(a) * r * h))
    faces = [tuple(range(n)), tuple(reversed(range((len(profile) - 1) * n, len(profile) * n)))]; tiles = [plain, plain]
    for k in range(len(profile) - 1):
        for i in range(n):
            j = (i + 1) % n
            faces.append((k * n + i, (k + 1) * n + i, (k + 1) * n + j, k * n + j))
            tiles.append(spotted if i in (0, 2, 5) else plain)
    ob = mesh(name, vs, faces, tiles)
    W, H, uv = cave_props.W, cave_props.H, ob.data.uv_layers.active
    for poly in ob.data.polygons:
        if poly.index < 2: continue
        t = tiles[poly.index]; facet = (poly.index - 2) % n
        tx, ty = (t % 8) * 32 + 2.5, (t // 8) * 32 + 2.5
        for li in poly.loop_indices:
            vi = ob.data.loops[li].vertex_index
            u = 0 if vi % n == facet else 1; v = profile[vi // n][0]
            uv.data[li].uv = ((tx + 27 * u) / W, 1 - (ty + 27 * (1 - v)) / H)
    return ob

# The stand's heights are the game's (LockedEggs: the egg starts at .66 m; EggStandLabels: its top at 2.91 m).
for e in EGGS:
    plinth, lip, nest = KIT_TILES[e['world']]
    model('Egg_' + e['id'])
    prism('Egg_Plinth', stepped(2.45, 2.45, .30), 0, .35, plinth)
    prism('Egg_Lip', stepped(2.18, 2.18, .26), .35, .49, lip)
    prism('Egg_Nest', stepped(1.95, 1.95, .26), .49, .66, nest)
    egg('Egg_Display', (0, .66, 0), 2.25, *EGG_TILES[e['id']])
    solid((0, 1.5, 0), (1.9, 3, 1.9))  # as Pinewind's stands: the egg and its nest, the plinth's lip stays a step
finish(__file__)
