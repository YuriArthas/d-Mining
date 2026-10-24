"""蘑菇洞穴 hall props: chunky toy mushrooms, two service stalls, lanterns, the name board frame, crystals.
Run: blender -b --python tools/blender/build_fungal.py
Same method as build_architecture.py: broad faceted forms, a small hand-painted pixel atlas, no imported
geometry, no Decimate. Glowing parts use a second material (emission from the same atlas). Each prop is a
root object named for its role; tools/build-underground.mjs places them from src/game/content/underground.
"""
import bpy, bmesh, math, json, hashlib, struct, zlib, pathlib
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/underground'; OUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'source-art').mkdir(exist_ok=True); (ROOT / 'artifacts').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)

# 32-pixel tiles, 8 x 4 atlas (256 x 128): quiet bases with a few grouped marks.
W, H = 256, 128
pixels = bytearray([255] * (W * H * 4))
def rgb(h): return tuple(bytes.fromhex(h.lstrip('#')))
def rect(x, y, w, h, c):
    c = rgb(c)
    for yy in range(max(0, y), min(H, y + h)):
        for xx in range(max(0, x), min(W, x + w)):
            i = (yy * W + xx) * 4; pixels[i:i + 4] = bytes((*c, 255))
def tile(i, base, marks):
    ox, oy = (i % 8) * 32, (i // 8) * 32
    rect(ox, oy, 32, 32, base)
    for x, y, w, h, c in marks: rect(ox + x, oy + y, w, h, c)
TILES = [
    ('5a4234', [(4, 6, 24, 3, '674c3b'), (6, 24, 18, 2, '4f392c')]),          # 0 dark timber
    ('c08a52', [(4, 5, 24, 3, 'cf9a61'), (6, 24, 19, 2, 'ad7a45')]),          # 1 honey timber
    ('5b6478', [(4, 5, 10, 3, '68728a'), (18, 20, 10, 6, '515a6d')]),         # 2 slate stone
    ('3f8f72', [(3, 4, 9, 3, '4ea383'), (17, 20, 9, 4, '357a61')]),           # 3 moss
    ('2fb7a8', [(5, 7, 7, 6, 'bff7ec'), (19, 18, 6, 5, 'bff7ec'), (10, 24, 4, 3, 'bff7ec')]),  # 4 teal cap, spots
    ('8a5ad6', [(5, 7, 7, 6, 'f0dcff'), (19, 18, 6, 5, 'f0dcff'), (10, 24, 4, 3, 'f0dcff')]),  # 5 violet cap, spots
    ('e9e1c8', [(4, 4, 3, 24, 'd8cfb3'), (20, 6, 3, 22, 'd8cfb3')]),          # 6 stem cream, fibres
    ('7ff5e4', [(8, 8, 16, 16, 'c8fff6')]),                                   # 7 glow teal
    ('c49bff', [(8, 8, 16, 16, 'eadbff')]),                                   # 8 glow violet
    ('ffd38a', [(6, 6, 20, 20, 'fff0c8')]),                                   # 9 glow warm (lantern)
    ('283447', [(4, 5, 22, 3, '344257')]),                                    # 10 navy iron
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),          # 11 gold
    ('58d6c8', [(4, 4, 8, 20, '9af0e6'), (18, 8, 6, 16, '3db3a7')]),          # 12 crystal teal
    ('a07a52', [(2, 10, 28, 3, 'b48c62'), (2, 20, 28, 3, '8d6a46')]),         # 13 rope / straps
    ('7a6aa8', [(4, 5, 24, 3, '8a7bb8')]),                                    # 14 dusk plank (board)
    ('3a3550', []),                                                           # 15 deep shadow
]
for i, (base, marks) in enumerate(TILES): tile(i, base, marks)
for i in range(len(TILES)):
    ox, oy = (i % 8) * 32, (i // 8) * 32
    for yy in range(32):
        for xx in range(32):
            if xx < 2 or xx > 29 or yy < 2 or yy > 29:
                sx, sy = ox + min(29, max(2, xx)), oy + min(29, max(2, yy))
                pixels[((oy + yy) * W + ox + xx) * 4:((oy + yy) * W + ox + xx) * 4 + 4] = pixels[(sy * W + sx) * 4:(sy * W + sx) * 4 + 4]
def png(path):
    raw = b''.join(b'\0' + pixels[y * W * 4:(y + 1) * W * 4] for y in range(H))
    def chunk(k, d): return struct.pack('>I', len(d)) + k + d + struct.pack('>I', zlib.crc32(k + d) & 0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
ATLAS = OUT / 'fungal-atlas.png'; png(ATLAS)
image = bpy.data.images.load(str(ATLAS)); image.name = 'Fungal_256x128_Pixels'; image.pack()
def atlas_material(name, glow):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .9; bsdf.inputs['Metallic'].default_value = 0
    tex = m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image; tex.interpolation = 'Closest'; tex.extension = 'EXTEND'
    m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if glow:
        m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = 2.2
    return m
BASE, GLOW = atlas_material('Fungal_Atlas', False), atlas_material('Fungal_Glow', True)
GLOWING = {7, 8, 9}

P = lambda v: (v[0], -v[2], v[1])  # authoring in three's (x, y, z); Blender is Z-up
ACTIVE = None; MODELS = {}
def model(name):
    global ACTIVE
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o)
    o['authorship'] = 'Blender toy cave props (build_fungal.py), no imported geometry'
    MODELS[name] = o; ACTIVE = o; return o
def mesh(name, verts, faces, tiles=0):
    me = bpy.data.meshes.new(name + '_Mesh'); me.from_pydata([P(v) for v in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); ob.parent = ACTIVE
    ob.data.materials.append(BASE); ob.data.materials.append(GLOW)
    uv = me.uv_layers.new(name='Atlas')
    for p in me.polygons:
        p.use_smooth = False
        t = tiles[p.index] if isinstance(tiles, (list, tuple)) else tiles
        p.material_index = 1 if t in GLOWING else 0
        pts = [Vector(verts[me.loops[j].vertex_index]) for j in p.loop_indices]
        a = (pts[1] - pts[0]).normalized(); n = (pts[1] - pts[0]).cross(pts[-1] - pts[0]).normalized(); b = n.cross(a).normalized()
        co = [(v.dot(a), v.dot(b)) for v in pts]
        lo = [min(c[k] for c in co) for k in range(2)]; hi = [max(c[k] for c in co) for k in range(2)]
        tx, ty = (t % 8) * 32 + 2.5, (t // 8) * 32 + 2.5
        for j, c in zip(p.loop_indices, co):
            u = (c[0] - lo[0]) / max(hi[0] - lo[0], 1e-7); v = (c[1] - lo[1]) / max(hi[1] - lo[1], 1e-7)
            uv.data[j].uv = ((tx + 27 * u) / W, 1 - (ty + 27 * (1 - v)) / H)
    return ob
def box(name, at, size, t=0):
    x, y, z = at; a, b, c = [s / 2 for s in size]
    v = [(x-a, y-b, z-c), (x+a, y-b, z-c), (x+a, y+b, z-c), (x-a, y+b, z-c), (x-a, y-b, z+c), (x+a, y-b, z+c), (x+a, y+b, z+c), (x-a, y+b, z+c)]
    return mesh(name, v, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (7, 6, 2, 3), (0, 4, 7, 3), (2, 6, 5, 1)], t)
def lathe(name, rings, sides, t, cx=0, cz=0, spin=0, cap_top=True, cap_bottom=True, tiles_by_band=None):
    """Faceted solid of revolution: rings = [(y, r), ...] bottom to top."""
    v = []
    for y, r in rings:
        for i in range(sides):
            a = spin + 2 * math.pi * i / sides
            v.append((cx + math.cos(a) * r, y, cz + math.sin(a) * r))
    f, tl = [], []
    for k in range(len(rings) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            f.append((k * sides + i, (k + 1) * sides + i, (k + 1) * sides + j, k * sides + j))
            tl.append(tiles_by_band[k] if tiles_by_band else t)
    if cap_bottom and rings[0][1] > 0: f.append(tuple(reversed(range(sides)))); tl.append(tiles_by_band[0] if tiles_by_band else t)
    if cap_top and rings[-1][1] > 0: f.append(tuple(range((len(rings) - 1) * sides, len(rings) * sides))); tl.append(tiles_by_band[-1] if tiles_by_band else t)
    return mesh(name, v, f, tl)
def prism(name, outline, y0, y1, t=0, axis='y'):
    n = len(outline)
    if axis == 'y':
        v = [(x, y0, z) for x, z in outline] + [(x, y1, z) for x, z in outline]
    else:  # outline in XY, extruded along Z
        v = [(x, y, y0) for x, y in outline] + [(x, y, y1) for x, y in outline]
    f = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, v, f, t)
def stepped(w, h, q):
    x, z = w / 2, h / 2
    return [(-x + q, -z), (x - q, -z), (x, -z + q), (x, z - q), (x - q, z), (-x + q, z), (-x, z - q), (-x, -z + q)]

# GIANT MUSHROOM, unit height (placed scaled by its height; the cap spans ~0.45 of it). A faceted stem with a
# root flare and a skirt, a broad two-tier cap with pale spots, glowing gills underneath and a glow band.
def giant(name, cap_tile, glow_tile):
    model(name)
    lathe('Stem', [(0, .085), (.05, .07), (.16, .052), (.45, .046), (.62, .05), (.72, .055)], 9, 6)
    lathe('Root', [(0, .13), (.04, .1), (.09, .06)], 9, 0, cap_top=False)
    lathe('Skirt', [(.56, .055), (.6, .1), (.63, .105), (.645, .06)], 9, 6, cap_top=False, cap_bottom=False)
    lathe('Gills', [(.66, .07), (.69, .33), (.705, .43)], 12, glow_tile, spin=.13, cap_bottom=False, cap_top=False)
    lathe('Cap', [(.69, .44), (.735, .47), (.80, .44), (.885, .34), (.955, .19), (.99, .05)], 12, cap_tile, spin=.13, cap_bottom=False)
    lathe('CapGlowBand', [(.705, .445), (.715, .462), (.728, .468)], 12, glow_tile, spin=.13, cap_bottom=False, cap_top=False)
giant('Mushroom_Teal', 4, 7)
giant('Mushroom_Violet', 5, 8)
# A clump of three small glowing mushrooms (about 0.9 m tall), for wall feet and shelves.
model('Mushroom_Cluster')
for i, (x, z, h, t, g) in enumerate([(0, 0, .95, 4, 7), (.42, .2, .62, 5, 8), (-.3, .34, .5, 4, 7)]):
    lathe('SmallStem', [(0, .07 * h), (h * .7, .05 * h)], 7, 6, cx=x, cz=z)
    lathe('SmallCap', [(h * .66, .32 * h), (h * .8, .3 * h), (h * .93, .16 * h), (h, .03)], 9, t, cx=x, cz=z, spin=i)
    lathe('SmallGlow', [(h * .63, .1 * h), (h * .665, .3 * h)], 9, g, cx=x, cz=z, cap_bottom=False, cap_top=False, spin=i)

# SERVICE STALL, front +Z: a timber counter under a broad mushroom-cap canopy on two stem posts, a hanging
# warm lantern, crates of ore and a round badge plate (coin for sell, pickaxe for the shop).
def stall(name, cap_tile, badge):
    model(name)
    prism('Deck', stepped(5.6, 3.6, .4), 0, .22, 2)
    box('Counter', (0, .62, .55), (4.4, .9, 1.0), 1)
    box('CounterTop', (0, 1.12, .62), (4.7, .14, 1.22), 0)
    for x in (-1.5, 0, 1.5): box('CounterPanel', (x, .62, 1.07), (1.25, .62, .06), 0)
    for side in (-1, 1):
        lathe('Post', [(.2, .2), (.5, .15), (3.4, .14), (3.7, .18)], 8, 6, cx=side * 2.2, cz=-.9)
    lathe('Canopy', [(3.55, 2.9), (3.62, 3.05), (3.9, 2.85), (4.4, 2.1), (4.85, 1.0), (5.0, .2)], 14, cap_tile, cz=-.3, spin=.1, cap_bottom=False)
    lathe('CanopyGills', [(3.48, .4), (3.55, 2.88)], 14, 8 if cap_tile == 5 else 7, cz=-.3, spin=.1, cap_bottom=False, cap_top=False)
    box('Shelf', (0, 1.75, -1.15), (4.0, .1, .7), 0)
    for x in (-1.3, 0, 1.3): box('Stock', (x, 1.98, -1.15), (.62, .36, .5), 12 if badge == 'coin' else 11)
    # Warm lantern hanging from the canopy edge, front centre.
    box('LanternRope', (0, 3.25, 1.35), (.05, .7, .05), 13)
    box('LanternCap', (0, 2.88, 1.35), (.42, .1, .42), 10)
    box('LanternGlass', (0, 2.62, 1.35), (.34, .44, .34), 9)
    box('LanternFoot', (0, 2.37, 1.35), (.4, .08, .4), 10)
    for x, z in ((-2.6, .9), (2.65, .6)):
        box('Crate', (x, .5, z), (.78, .62, .78), 1); box('CrateBand', (x, .5, z), (.82, .14, .82), 0)
        for k in range(3): box('Ore', (x - .2 + k * .2, .9, z), (.2, .18, .2), 12 if k % 2 else 11)
    # Badge on a navy round plate under the canopy, facing the hall.
    plate = [(math.cos(2 * math.pi * i / 12) * .58, math.sin(2 * math.pi * i / 12) * .58 + 3.05) for i in range(12)]
    prism('BadgePlate', plate, 1.22, 1.34, 10, axis='z')
    if badge == 'coin':
        coin = [(math.cos(2 * math.pi * i / 10) * .36, math.sin(2 * math.pi * i / 10) * .36 + 3.05) for i in range(10)]
        prism('BadgeCoin', coin, 1.34, 1.44, 11, axis='z')
        prism('BadgeCoinMark', [(-.06, 2.85), (.06, 2.85), (.06, 3.25), (-.06, 3.25)], 1.44, 1.48, 10, axis='z')
    else:
        prism('BadgePickHead', [(-.4, 3.2), (-.12, 3.32), (.12, 3.32), (.4, 3.2), (.3, 3.12), (0, 3.2), (-.3, 3.12)], 1.34, 1.46, 12, axis='z')
        prism('BadgePickHandle', [(-.05, 2.7), (.05, 2.7), (.05, 3.24), (-.05, 3.24)], 1.34, 1.44, 1, axis='z')
stall('Stall_Sell', 5, 'coin')
stall('Stall_Shop', 4, 'pick')

# LANTERN POST: a timber post with an iron arm and a warm hanging lantern (paths and the pit corners).
model('Lantern_Post')
box('PostFoot', (0, .18, 0), (.5, .36, .5), 2)
box('Post', (0, 1.4, 0), (.24, 2.8, .24), 0)
box('Arm', (.32, 2.72, 0), (.74, .14, .14), 10)
box('Rope', (.62, 2.5, 0), (.04, .36, .04), 13)
box('LanternCap', (.62, 2.28, 0), (.34, .08, .34), 10)
box('LanternGlass', (.62, 2.06, 0), (.26, .36, .26), 9)
box('LanternFoot', (.62, 1.85, 0), (.32, .06, .32), 10)

# NAME BOARD FRAME on the north wall: two mushroom-stem uprights and a broad dusk-plank board; the layer's
# name is 3D text the game floats in front of it.
model('Name_Board')
for side in (-1, 1):
    lathe('Upright', [(0, .3), (.4, .22), (7.2, .2), (7.6, .28)], 8, 6, cx=side * 3.9)
    lathe('UprightCap', [(7.55, .62), (7.7, .66), (8.0, .5), (8.25, .12)], 10, 5 if side < 0 else 4, cx=side * 3.9, cap_bottom=False)
box('Board', (0, 6.0, -.1), (7.4, 2.4, .3), 14)
box('BoardTrim', (0, 7.25, -.05), (7.8, .16, .4), 11)
box('BoardTrimLow', (0, 4.75, -.05), (7.8, .16, .4), 11)

# CRYSTAL CLUSTER: a few chunky teal prisms leaning out of a rock foot.
model('Crystal_Cluster')
lathe('CrystalFoot', [(0, .55), (.25, .45), (.38, .15)], 7, 2)
for i, (x, z, h, lean) in enumerate([(0, 0, 1.5, 0), (.32, .14, 1.0, .35), (-.28, .2, .85, -.4), (.05, -.3, .7, .25)]):
    c, s = math.cos(lean), math.sin(lean); r = .16 + .04 * (i == 0)
    pts = []
    for y, rr in ((0, r), (h * .78, r), (h, 0)):
        for k in range(6):
            a = 2 * math.pi * k / 6 + i
            px, py = math.cos(a) * rr, y
            pts.append((x + px * c + py * s * .35, .2 + py * c - px * s * .1, z + math.sin(a) * rr))
    faces = [(0, 1, 2, 3, 4, 5)[::-1]] + [(k, (k + 1) % 6, (k + 1) % 6 + 6, k + 6) for k in range(6)] + [(6 + k, 6 + (k + 1) % 6, 12 + (k + 1) % 6, 12 + k) for k in range(6)]
    mesh('Crystal', pts, faces, 12)

# PIT POST: a short stone post with a glowing crystal cap at the pit corners.
model('Pit_Post')
prism('PostBase', stepped(.7, .7, .14), 0, .3, 2)
prism('Post', stepped(.46, .46, .1), .3, 1.1, 2)
lathe('PostCrystal', [(1.1, .2), (1.35, .2), (1.6, 0)], 6, 7)

# POOL RIM STONE: one chunky rim block (placed in a ring round the glowing pool).
model('Pool_Stone')
prism('Stone', [(-.55, -.32), (.5, -.36), (.62, .1), (.4, .38), (-.42, .34), (-.62, .02)], 0, .42, 2)
prism('StoneMoss', [(-.45, -.22), (.4, -.26), (.48, .06), (.3, .26), (-.34, .24), (-.5, .0)], .42, .48, 3)

# Origins: each part's own centre (no transform tricks); the root stays at its authored base.
for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method='FIXED', ngon_method='BEAUTY')
    bm.to_mesh(ob.data); bm.free(); ob.data.update()

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'source-art/fungal.blend'))
glb = OUT / 'fungal-props.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_apply=True, export_yup=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
tris = {name: sum(len(p.vertices) - 2 for o in m.children_recursive if o.type == 'MESH' for p in o.data.polygons) for name, m in MODELS.items()}
report = {'script': 'tools/blender/build_fungal.py', 'source': 'source-art/fungal.blend', 'texture': [W, H], 'models': tris,
          'triangles': sum(tris.values()), 'sha256': {'glb': sha(glb), 'atlas': sha(ATLAS)}}
(ROOT / 'artifacts/fungal-props.json').write_text(json.dumps(report, indent=2) + '\n')
print('FUNGAL_PROPS', json.dumps(report))
