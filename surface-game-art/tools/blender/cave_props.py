"""Shared helpers for the underground hall prop kits (build_<hall>.py): a small hand-painted pixel atlas, faceted
mesh primitives authored in three's (x, y, z), and the props every hall shares with one footprint (the service
stall frame, the lantern post, the name board, the pit post), so tools/underground/caveKit.ts can give them the
same colliders. No imported geometry, no Decimate.

Atlas: 32-pixel tiles, 8 x 4 (256 x 128; `start(..., rows=8)` for 8 x 8, 256 x 256). Tiles 0-15 have fixed roles that the shared props use; 16-31 are free:
  0 dark frame  1 counter  2 stone  3 ground accent  4 roof A  5 roof B  6 pale  7 glow A  8 glow B  9 glow warm
  10 iron  11 gold  12 ore  13 rope  14 board  15 shadow
Usage: start('OldMine', 'old-mine', TILES, glowing={7, 8, 9, ...}); model(...); box(...); ...; finish(__file__)
"""
import bpy, bmesh, math, json, hashlib, struct, zlib, pathlib
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/underground'
W, H = 256, 128
S = {'slug': '', 'pixels': None, 'base': None, 'glow': None, 'glowing': set(), 'active': None, 'models': {}, 'atlas': None, 'authorship': ''}

def rgb(h): return tuple(bytes.fromhex(h.lstrip('#')))
def rect(x, y, w, h, c):
    c = rgb(c); pixels = S['pixels']
    for yy in range(max(0, y), min(H, y + h)):
        for xx in range(max(0, x), min(W, x + w)):
            i = (yy * W + xx) * 4; pixels[i:i + 4] = bytes((*c, 255))
def tile(i, base, marks):
    ox, oy = (i % 8) * 32, (i // 8) * 32
    rect(ox, oy, 32, 32, base)
    for x, y, w, h, c in marks: rect(ox + x, oy + y, w, h, c)

def start(name, slug, tiles, glowing, emission=2.2, rows=4):
    """Clear the scene, paint the atlas from `tiles` [(base, [(x, y, w, h, colour), ...]), ...] and make the two
    atlas materials (the glow one emits the atlas colour)."""
    global H
    H = rows * 32
    assert len(tiles) <= rows * 8, 'atlas full'
    OUT.mkdir(parents=True, exist_ok=True); (ROOT / 'source-art').mkdir(exist_ok=True); (ROOT / 'artifacts').mkdir(exist_ok=True)
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials): bpy.data.materials.remove(block)
    S['pixels'] = pixels = bytearray([255] * (W * H * 4)); S['glowing'] = set(glowing); S['models'] = {}
    S['slug'] = slug; S['authorship'] = f"Blender toy cave props (build_{slug.replace('-', '_')}.py), no imported geometry"
    for i, (base, marks) in enumerate(tiles): tile(i, base, marks)
    # Edge-extend each tile by 2 px, so sampling at a face's UV border never bleeds into the neighbour.
    for i in range(len(tiles)):
        ox, oy = (i % 8) * 32, (i // 8) * 32
        for yy in range(32):
            for xx in range(32):
                if xx < 2 or xx > 29 or yy < 2 or yy > 29:
                    sx, sy = ox + min(29, max(2, xx)), oy + min(29, max(2, yy))
                    pixels[((oy + yy) * W + ox + xx) * 4:((oy + yy) * W + ox + xx) * 4 + 4] = pixels[(sy * W + sx) * 4:(sy * W + sx) * 4 + 4]
    raw = b''.join(b'\0' + pixels[y * W * 4:(y + 1) * W * 4] for y in range(H))
    def chunk(k, d): return struct.pack('>I', len(d)) + k + d + struct.pack('>I', zlib.crc32(k + d) & 0xffffffff)
    S['atlas'] = atlas = OUT / f'{slug}-atlas.png'
    atlas.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    image = bpy.data.images.load(str(atlas)); image.name = f'{name}_{W}x{H}_Pixels'; image.pack()
    def material(label, glow):
        m = bpy.data.materials.new(label); m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Roughness'].default_value = .9; bsdf.inputs['Metallic'].default_value = 0
        tex = m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image; tex.interpolation = 'Closest'; tex.extension = 'EXTEND'
        m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if glow:
            m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = emission
        return m
    S['base'], S['glow'] = material(f'{name}_Atlas', False), material(f'{name}_Glow', True)

P = lambda v: (v[0], -v[2], v[1])  # authoring in three's (x, y, z); Blender is Z-up
def model(name):
    """A prop root (an empty) named for its role; the hall builder places it by this name."""
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o)
    o['authorship'] = S['authorship']
    S['models'][name] = o; S['active'] = o; return o
def mesh(name, verts, faces, tiles=0):
    """A flat-shaded part of the active prop; `tiles` is one atlas tile or one per face. Each face's UVs span
    the inner 27 px of its tile, projected on the face's own plane."""
    me = bpy.data.meshes.new(name + '_Mesh'); me.from_pydata([P(v) for v in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); ob.parent = S['active']
    ob.data.materials.append(S['base']); ob.data.materials.append(S['glow'])
    uv = me.uv_layers.new(name='Atlas')
    for p in me.polygons:
        p.use_smooth = False
        t = tiles[p.index] if isinstance(tiles, (list, tuple)) else tiles
        p.material_index = 1 if t in S['glowing'] else 0
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
    """An outline extruded from y0 to y1: outline in XZ along Y, or (axis='z') in XY along Z."""
    n = len(outline)
    if axis == 'y':
        v = [(x, y0, z) for x, z in outline] + [(x, y1, z) for x, z in outline]
    else:
        v = [(x, y, y0) for x, y in outline] + [(x, y, y1) for x, y in outline]
    f = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, v, f, t)
def stepped(w, h, q):
    """A w x h rectangle with its corners cut by q (an octagon outline)."""
    x, z = w / 2, h / 2
    return [(-x + q, -z), (x - q, -z), (x, -z + q), (x, z - q), (x - q, z), (-x + q, z), (-x, z - q), (-x, -z + q)]
def circle(r, n, cx=0, cy=0, spin=0): return [(cx + math.cos(spin + 2 * math.pi * i / n) * r, cy + math.sin(spin + 2 * math.pi * i / n) * r) for i in range(n)]
def spike(name, x, z, h, r, sides, t, lean=(0, 0), y=0, tip=.78, spin=0):
    """A crystal/icicle prism: straight sides to `tip` of its height, then a point; leaning by (dx, dz) per metre."""
    pts = []
    for yy, rr in ((0, r), (h * tip, r), (h, 0)):
        for k in range(sides):
            a = spin + 2 * math.pi * k / sides
            pts.append((x + math.cos(a) * rr + lean[0] * yy, y + yy, z + math.sin(a) * rr + lean[1] * yy))
    s = sides
    faces = [tuple(reversed(range(s)))] + [(k, (k + 1) % s, (k + 1) % s + s, k + s) for k in range(s)] + [(s + k, s + (k + 1) % s, 2 * s + (k + 1) % s, 2 * s + k) for k in range(s)]
    return mesh(name, pts, faces, t)

# SERVICE STALL, front +Z (placed turned to face the hall). The shared footprint: a 5.6 x 3.6 deck, a counter in
# front (local z .05-1.05), two back posts at x = +-2.2, z = -.9 up to 3.7 m, a back shelf with stock, crates at
# the sides, a hanging lantern at the front (0, 2.4-3.6, 1.35) and a badge plate at (0, 3.05, 1.22-1.48): coin for
# the sale, pickaxe for the shop. `roof()` adds the hall's own canopy over y = 3.5, reaching z = +1.6 (it must
# carry the lantern rope); `post()` may replace the plain square posts.
def stall(name, badge, roof, post=None, stock_tile=None):
    model(name)
    prism('Deck', stepped(5.6, 3.6, .4), 0, .22, 2)
    box('Counter', (0, .62, .55), (4.4, .9, 1.0), 1)
    box('CounterTop', (0, 1.12, .62), (4.7, .14, 1.22), 0)
    for x in (-1.5, 0, 1.5): box('CounterPanel', (x, .62, 1.07), (1.25, .62, .06), 0)
    for side in (-1, 1):
        if post: post(side * 2.2, -.9)
        else: box('PostFoot', (side * 2.2, .4, -.9), (.42, .36, .42), 2); box('Post', (side * 2.2, 2.0, -.9), (.28, 3.4, .28), 0)
    roof()
    box('Shelf', (0, 1.75, -1.15), (4.0, .1, .7), 0)
    for x in (-1.3, 0, 1.3): box('Stock', (x, 1.98, -1.15), (.62, .36, .5), stock_tile if stock_tile is not None else (12 if badge == 'coin' else 11))
    box('LanternRope', (0, 3.25, 1.35), (.05, .7, .05), 13)
    box('LanternCap', (0, 2.88, 1.35), (.42, .1, .42), 10)
    box('LanternGlass', (0, 2.62, 1.35), (.34, .44, .34), 9)
    box('LanternFoot', (0, 2.37, 1.35), (.4, .08, .4), 10)
    for x, z in ((-2.6, .9), (2.65, .6)):
        box('Crate', (x, .5, z), (.78, .62, .78), 1); box('CrateBand', (x, .5, z), (.82, .14, .82), 0)
        for k in range(3): box('Ore', (x - .2 + k * .2, .9, z), (.2, .18, .2), 12 if k % 2 else 11)
    prism('BadgePlate', circle(.58, 12, 0, 3.05), 1.22, 1.34, 10, axis='z')
    if badge == 'coin':
        prism('BadgeCoin', circle(.36, 10, 0, 3.05), 1.34, 1.44, 11, axis='z')
        prism('BadgeCoinMark', [(-.06, 2.85), (.06, 2.85), (.06, 3.25), (-.06, 3.25)], 1.44, 1.48, 10, axis='z')
    else:
        prism('BadgePickHead', [(-.4, 3.2), (-.12, 3.32), (.12, 3.32), (.4, 3.2), (.3, 3.12), (0, 3.2), (-.3, 3.12)], 1.34, 1.46, 12, axis='z')
        prism('BadgePickHandle', [(-.05, 2.7), (.05, 2.7), (.05, 3.24), (-.05, 3.24)], 1.34, 1.44, 1, axis='z')

def lantern_post(name='Lantern_Post'):
    """A post with an iron arm and a warm hanging lantern, 2.8 m (collider: .4 x 2.8 x .4)."""
    model(name)
    box('PostFoot', (0, .18, 0), (.5, .36, .5), 2)
    box('Post', (0, 1.4, 0), (.24, 2.8, .24), 0)
    box('Arm', (.32, 2.72, 0), (.74, .14, .14), 10)
    box('Rope', (.62, 2.5, 0), (.04, .36, .04), 13)
    box('LanternCap', (.62, 2.28, 0), (.34, .08, .34), 10)
    box('LanternGlass', (.62, 2.06, 0), (.26, .36, .26), 9)
    box('LanternFoot', (.62, 1.85, 0), (.32, .06, .32), 10)

def name_board(upright):
    """The name board on the north wall: `upright(x)` builds each of the two uprights at x = +-3.9 (collider:
    .6 x 7.6 x .6 each); a broad board (y 4.8-7.2) carries the layer's name, which the game floats in front."""
    model('Name_Board')
    for side in (-1, 1): upright(side * 3.9)
    box('Board', (0, 6.0, -.1), (7.4, 2.4, .3), 14)
    box('BoardTrim', (0, 7.25, -.05), (7.8, .16, .4), 11)
    box('BoardTrimLow', (0, 4.75, -.05), (7.8, .16, .4), 11)

def pit_post(cap):
    """A short stone post at each pit corner (collider .7 x 1.1 x .7); `cap()` tops it at y = 1.1."""
    model('Pit_Post')
    prism('PostBase', stepped(.7, .7, .14), 0, .3, 2)
    prism('Post', stepped(.46, .46, .1), .3, 1.1, 2)
    cap()

def finish(script):
    """Triangulate, save the .blend, export the GLB and write the provenance report (script, source, texture,
    triangles per prop, hashes) to artifacts/<slug>-props.json."""
    name = S['slug']
    for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method='FIXED', ngon_method='BEAUTY')
        bm.to_mesh(ob.data); bm.free(); ob.data.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'source-art/{name}.blend'))
    glb = OUT / f'{name}-props.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_apply=True, export_yup=True)
    def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
    tris = {k: sum(len(p.vertices) - 2 for o in m.children_recursive if o.type == 'MESH' for p in o.data.polygons) for k, m in S['models'].items()}
    report = {'script': f'tools/blender/{pathlib.Path(script).name}', 'source': f'source-art/{name}.blend', 'texture': [W, H], 'models': tris,
              'triangles': sum(tris.values()), 'sha256': {'glb': sha(glb), 'atlas': sha(S['atlas'])}}
    (ROOT / f'artifacts/{name}-props.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f"{name.upper().replace('-', '_')}_PROPS", json.dumps(report))
