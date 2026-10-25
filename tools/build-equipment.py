"""The 30 tools and 30 backpacks the miner carries and the shop shows: Blender-authored, no Decimate.
Levels 1-10 (world 1) are joke items from home and kitchen; 11-30 are still the old pick and bag series until their
worlds get their own sets.

Model conventions (Blender, Z up; glTF turns Z into Y):
- ToolNN: the fist holds the grip at the origin, the handle runs up +Z and the striking end points +Y (a pick's
  point). Everything sits under a 'Hold' empty; clubs tilt it toward +Y so their end lands where a pick's point
  would (the shop resets it to stand them upright). 'PickaxeTip' marks where the hit lands. Empties named 'Spin*'
  turn about their local Z (glTF Y) while the tool works (a mixer's whisks).
- BagNN: the face against the miner's back is at y = +.15 and the bag grows toward -Y (away from the miner).
  'BagFill' is an empty at the bottom of the visible load; the game scales it on Z (glTF Y) with how full the
  backpack is. Window and dome parts use the 'EquipGlass' material.
Each model is one atlas mesh ('Body') plus its glass, spinning and fill parts, so it draws in a few calls.
Usage: blender -b --python tools/build-equipment.py
"""
import bpy, bmesh, math, json, hashlib, random
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets-source/shop-showroom'; OUT = ROOT / 'src/game/assets/shop'
bpy.ops.wm.read_factory_settings(use_empty=True)

# The atlas: 16 x 8 flat colour cells of 16 px. 0-31 are the old series' colours (levels 11-30 still use them).
LEGACY = ['936039','d49b59','40362f','adc4cd','617681','273d50','da8544','59b8ad','efcf6b','9178ca','8bb4eb','d65b45','7bc657','ede0b5','a1d4e0','cf53a7',
          'b77445','935034','dca36c','f2c28f','27374a','6d8191','b1c8d0','e1edf0','8a633e','bd8f60','5d4740','f0bb55','50859b','d7e6df','726a71','b58c57']
NAMED = dict(
    wood='c98a4b', wood_dark='8a5a2e', steel='b9c3cc', iron='5a6470', black='2b2d33', crust='d8913a', crumb='f6d58e',
    fish='6f8fa8', belly='eef3f5', red='e2403a', deep_red='c9302c', white='f6f4ee', pink='ff7fb8', yellow='ffd23f',
    sky='3fb4ff', lime='7bd34f', melon='f0485a', green='2f8a3a', ink='1d1d1f', duck='ffd21f', beak='ff8a1f', bone='efe3c4',
    bone_shade='c9b58d', card='c99d64', card_dark='9c7444', wicker='d9a75a', wicker_dark='b47a36', water='4fb6e8',
    gold='ffc531', purple='9b5de5', orange='ff7a2f', leather='6b4226', stone='7a7f88', stone_light='a3a9b2',
    pig='ffa6c9', pig_dark='e9789f', mint='9ee6cf', mint_dark='5cc2a6', chrome='d8dde3', drum='3a3f47', blue='2c64c8',
    emerald='4ad66d', burlap='c79a4a', burlap_dark='9b7a45', coral='ff5d8f', cream='fff3c4', chest_dark='5d3a1e',
    chest='8b5a2b', leaf='46b04a', coin='ffe066', pan='3d4048', rubber='d8342e', candy_blue='5bc8ff', tape='e8c87a',
    gum_red='e8333a', plant='3cb85a', sand='e9cf8f', ore_rock='6e5a4a', ore_dark='4a3d33',
)
HEX = LEGACY + list(NAMED.values())
C = {name: 32 + i for i, name in enumerate(NAMED)}
assert len(HEX) <= 128
W, H, CELL = 256, 128, 16
img = bpy.data.images.new('EquipAtlas', width=W, height=H)
px = [0.0] * (W * H * 4)
for i, h in enumerate(HEX + ['ff00ff'] * (128 - len(HEX))):
    rgb = [int(h[k:k + 2], 16) / 255 for k in (0, 2, 4)]
    cx, cy = (i % 16) * CELL, (i // 16) * CELL
    for y in range(cy, cy + CELL):
        for x in range(cx, cx + CELL):
            o = (y * W + x) * 4; px[o:o + 4] = rgb + [1.0]
img.pixels = px
SRC.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
img.filepath_raw = str(SRC / 'equipment-atlas.png'); img.file_format = 'PNG'; img.save(); img.pack()
atlas = bpy.data.materials.new('EquipAtlas'); atlas.use_nodes = True
bsdf = atlas.node_tree.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = .86
tex = atlas.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Closest'
atlas.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
glass = bpy.data.materials.new('EquipGlass'); glass.use_nodes = True
g = glass.node_tree.nodes['Principled BSDF']
g.inputs['Base Color'].default_value = (.78, .93, 1, 1); g.inputs['Alpha'].default_value = .32; g.inputs['Roughness'].default_value = .2
glass.surface_render_method = 'BLENDED'

def cell_uv(c):
    return ((c % 16) * CELL + CELL / 2) / W, ((c // 16) * CELL + CELL / 2) / H

# Parts collect into slots: 'body' joins into the model's atlas mesh, other keys become their own meshes.
parts = {}
def finish(o, color, slot='body', smooth=False, bevel=0, angle=40):
    """Material, UVs (each face on its colour cell; `color` may be a function of the face) and shading."""
    if bevel:
        m = o.modifiers.new('Bevel', 'BEVEL'); m.width = bevel; m.segments = 1; m.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.update()
    me = o.data; me.materials.clear(); me.materials.append(glass if slot == 'glass' else atlas)
    uv = me.uv_layers.active or me.uv_layers.new(name='UVMap')
    mw = o.matrix_world
    for poly in me.polygons:
        c = color(mw @ poly.center, (mw.to_3x3() @ poly.normal).normalized()) if callable(color) else color
        u = cell_uv(c)
        for li in poly.loop_indices: uv.data[li].uv = u
    if smooth:
        me.shade_smooth(); me.set_sharp_from_angle(angle=math.radians(angle))
    else:
        me.shade_flat()
    parts.setdefault(slot, []).append(o); return o

def apply(o, rot=None):
    if rot: o.rotation_euler = rot
    bpy.context.view_layer.objects.active = o
    for s in bpy.context.selected_objects: s.select_set(False)
    o.select_set(True); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return o

def box(at, size, c, bevel=.012, rot=None, slot='body'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at); o = bpy.context.object; o.scale = size
    return finish(apply(o, rot), c, slot, bevel=bevel)

def cyl(at, r, depth, c, n=12, rot=None, r2=None, slot='body', smooth=True, bevel=0):
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r if r2 is None else r2, depth=depth, location=at)
    return finish(apply(bpy.context.object, rot), c, slot, smooth=smooth, bevel=bevel)

def ball(at, scale, c, seg=12, rings=8, rot=None, slot='body', smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=at)
    o = bpy.context.object; o.scale = scale
    return finish(apply(o, rot), c, slot, smooth=smooth, angle=70)

def ring(at, R, r, c, rot=None, major=16, minor=6, slot='body'):
    bpy.ops.mesh.primitive_torus_add(major_segments=major, minor_segments=minor, major_radius=R, minor_radius=r, location=at)
    return finish(apply(bpy.context.object, rot), c, slot, smooth=True, angle=70)

def mesh(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); return o

def lathe(profile, c, n=12, at=(0, 0, 0), axis='Z', scale=(1, 1, 1), slot='body', smooth=True, cap=True):
    """A turned solid: profile [(radius, height)] from bottom to top around `axis` (Z or Y)."""
    verts, faces = [], []
    for r, h in profile:
        for k in range(n):
            a = 2 * math.pi * k / n; x, y = math.cos(a) * r * scale[0], math.sin(a) * r * scale[1]
            verts.append((x, y, h * scale[2]) if axis == 'Z' else (x, h * scale[2], -y))
    for j in range(len(profile) - 1):
        for k in range(n):
            a, b = j * n + k, j * n + (k + 1) % n
            faces.append((a, b, b + n, a + n))
    if cap:
        faces.append(tuple(range(n - 1, -1, -1))); top = (len(profile) - 1) * n; faces.append(tuple(range(top, top + n)))
    o = mesh('Lathe', verts, faces); o.location = at
    return finish(apply(o), c, slot, smooth=smooth, angle=60)

def slab(points, thick, c, at=(0, 0, 0), plane='YZ', slot='body', bevel=.008):
    """A flat outline [(u, v)] extruded `thick` across the plane (YZ: thickness along X; XZ: along Y)."""
    n = len(points); verts = []
    for s in (-thick / 2, thick / 2):
        for u, v in points: verts.append((s, u, v) if plane == 'YZ' else (u, s, v))
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    o = mesh('Slab', verts, faces); o.location = at
    if plane == 'XZ': o.data.flip_normals()
    return finish(apply(o), c, slot, bevel=bevel)

def tube(points, r, c, slot='body', cyclic=False, sides=0):
    """A wire along a polyline (square section unless `sides`)."""
    cu = bpy.data.curves.new('Tube', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = sides; cu.resolution_u = 1
    sp = cu.splines.new('POLY'); sp.points.add(len(points) - 1); sp.use_cyclic_u = cyclic
    for p, q in zip(sp.points, points): p.co = (*q, 1)
    cu.use_fill_caps = True
    o = bpy.data.objects.new('Tube', cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    for s in bpy.context.selected_objects: s.select_set(False)
    o.select_set(True); bpy.ops.object.convert(target='MESH')
    return finish(o, c, slot, smooth=True)

def crescent(cz, r, a0, a1, w, thick, c, cy=0, steps=10, tip_w=.006):
    """A pick head: an arc of radius r about (y=cy, z=cz) in the YZ plane from angle a0 to a1 (degrees, 0 = +Y),
    `w` thick at the middle and pointed at both ends. Returns the a0 end (the point)."""
    outer, inner = [], []
    for i in range(steps + 1):
        t = i / steps; a = math.radians(a0 + (a1 - a0) * t); half = tip_w + w / 2 * math.sin(math.pi * t) ** .7
        outer.append((cy + math.cos(a) * (r + half), cz + math.sin(a) * (r + half)))
        inner.append((cy + math.cos(a) * (r - half), cz + math.sin(a) * (r - half)))
    slab(outer + inner[::-1], thick, c)
    a = math.radians(a0); return (0, cy + math.cos(a) * r, cz + math.sin(a) * r)

def chunks(center, rx, ry, height, colours, n, seed, size=.07, shape='cube', slot='fill'):
    """A heap of ore: a mound of rock with chunks on its surface, `height` tall above `center`."""
    rnd = random.Random(seed); x0, y0, z0 = center
    lathe([(rx, 0), (rx * .92, height * .35), (rx * .62, height * .72), (rx * .2, height * .95), (0.01, height)], C['ore_rock'], 10,
          at=center, scale=(1, ry / rx, 1), slot=slot)
    for i in range(n):
        a = rnd.uniform(0, 2 * math.pi); d = math.sqrt(rnd.uniform(.05, .9))
        x, y = math.cos(a) * d, math.sin(a) * d; z = height * (1 - d * d) ** .8 * .9
        at = (x0 + x * rx, y0 + y * ry, z0 + z); s = size * rnd.uniform(.75, 1.25); col = colours[i % len(colours)]
        rot = (rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3))
        if shape == 'ball': ball(at, (s, s, s), col, 7, 4, slot=slot)
        elif shape == 'coin': cyl(at, s, s * .3, col, 10, rot=(rnd.uniform(-.6, .6), rnd.uniform(-.6, .6), 0), slot=slot, smooth=False)
        else: box(at, (s, s * .9, s * .8), col, 0, rot=rot, slot=slot)

def empty(name, at=(0, 0, 0), rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o); o.location = at; o.rotation_euler = rot
    return o

def join(objs, name):
    for s in bpy.context.selected_objects: s.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.object; o.name = name; o.data.name = name; return o

def attach(child, parent, inverse=None):
    """Parent keeping hold-space coordinates: `inverse` is the parent's own placement in hold space."""
    child.parent = parent; child.matrix_parent_inverse = inverse.inverted() if inverse else Matrix.Identity(4)

def grow(k):
    """Scale every collected part about the origin (the grip)."""
    for objs in parts.values():
        for o in objs: o.location = o.location * k; o.scale = (k, k, k); apply(o)

roots, report = [], []
def model(name, tilt=0, tip=None, spins=(), fill=None):
    """Join the collected parts into model `name`. spins: [(slot, point, axis 'Y'|'Z')]; fill: bottom point of
    the load. Clubs tilt `tilt` degrees toward +Y under 'Hold'."""
    root = empty(name); holder = empty('Hold', rot=(-math.radians(tilt), 0, 0)) if name.startswith('Tool') else root
    if holder is not root: holder.parent = root
    bpy.context.view_layer.update()
    tris = 0
    def place(obj, parent, inverse=None):
        nonlocal tris
        tris += sum(len(p.vertices) - 2 for p in obj.data.polygons); attach(obj, parent, inverse)
    place(join(parts.pop('body'), 'Body'), holder)
    if 'glass' in parts: place(join(parts.pop('glass'), 'Glass'), holder)
    for slot, point, axis in spins:
        pivot = empty('Spin' + slot.title(), point, (-math.pi / 2, 0, 0) if axis == 'Y' else (0, 0, 0)); attach(pivot, holder)
        place(join(parts.pop(slot), slot.title()), pivot, pivot.matrix_basis.copy())
    if fill is not None:
        pivot = empty('BagFill', fill); attach(pivot, holder)
        place(join(parts.pop('fill'), 'Load'), pivot, pivot.matrix_basis.copy())
    if tip is not None:
        marker = empty('PickaxeTip', tip); attach(marker, holder)
    assert not parts, f'{name}: unplaced parts {list(parts)}'
    roots.append(root); report.append({'node': name, 'triangles': tris})

# ---------------------------------------------------------------- TOOLS, world 1
def wood_handle(top=.72, r=.048, c='wood'):
    cyl((0, 0, (top - .22) / 2), r, top + .22, C[c], 10)
    cyl((0, 0, -.05), r + .012, .26, C['leather'], 10)                 # grip wrap
    for z in (-.17, .07): cyl((0, 0, z), r + .02, .03, C['wood_dark'], 10)
    cyl((0, 0, -.235), r + .02, .05, C['wood_dark'], 10)              # pommel

# 1 老木镐: the one plain pick, chunky and friendly, so a new player knows what it is for.
wood_handle()
tip = crescent(.2, .46, 32, 148, .14, .13, C['stone'])
crescent(.2, .46, 34, 146, .05, .135, C['stone_light'], steps=8)
box((0, 0, .66), (.17, .2, .22), C['iron'], .03)
for z in (.6, .72): box((0, 0, z), (.18, .21, .035), C['wood_dark'], .008)
model('Tool01', tip=tip)

# 2 不粘锅: a frying pan with an egg still in it; its bottom slaps the rock.
cyl((0, 0, .1), .042, .64, C['black'], 10)
cyl((0, 0, -.06), .056, .3, C['wood'], 10)
cyl((0, 0, -.23), .062, .05, C['wood_dark'], 10)
box((0, 0, .44), (.1, .07, .1), C['black'], .02)
cyl((0, .02, .74), .34, .06, C['black'], 20, rot=(math.pi / 2, 0, 0))     # base, facing +Y
cyl((0, -.03, .74), .3, .03, C['pan'], 20, rot=(math.pi / 2, 0, 0))       # cooking face, toward -Y
ring((0, -.05, .74), .33, .035, C['black'], rot=(math.pi / 2, 0, 0), major=20)
ball((.05, -.06, .72), (.15, .03, .12), C['white'], 10, 6)
ball((.07, -.08, .74), (.055, .03, .055), C['yellow'], 8, 6)
model('Tool02', tilt=38, tip=(0, .06, .74))

# 3 硬法棍: a three-day-old baguette for a head, harder than the rock.
wood_handle(.66)
prof = [(.01, -.55), (.06, -.52), (.1, -.42), (.11, -.25), (.11, 0), (.11, .25), (.1, .42), (.06, .52), (.01, .55)]
lathe(prof, C['crust'], 10, at=(0, 0, .68), axis='Y', scale=(1, 1.05, 1))
for i, y in enumerate((-.36, -.12, .12, .36)):
    box((0, y, .785), (.07, .16, .03), C['crumb'], .01, rot=(0, 0, .55))
box((0, 0, .6), (.14, .14, .14), C['wood_dark'], .02)
ring((0, 0, .66), .1, .022, C['red'], rot=(math.pi / 2, 0, 0), major=12)
model('Tool03', tip=(0, .57, .66))

# 4 翻身咸鱼: a whole salted fish held by its tail, flat across Y so its side slaps the rock. Back blue-grey, belly white.
fish = lambda p, n: C['belly'] if p.z < .62 and n.x > .55 else C['fish']
tube([(0, 0, -.22), (0, 0, .12)], .05, C['wicker_dark'], sides=2)      # rope-wrapped tail stalk
for z in (-.16, -.06, .04): ring((0, 0, z), .055, .016, C['wicker'], major=10, minor=4)
slab([(0, -.32), (.2, -.42), (.12, -.24), (0, -.2), (-.12, -.24), (-.2, -.42)], .04, C['fish'], plane='XZ')
lathe([(.02, .1), (.08, .18), (.15, .36), (.17, .55), (.14, .76), (.08, .92), (.02, .98)], fish, 12, scale=(1, .42, 1))
slab([(-.02, .3), (-.04, .62), (-.15, .5), (-.14, .36)], .02, C['fish'], plane='XZ')                       # back fin
slab([(.02, .25), (.03, .45), (.14, .38)], .02, C['fish'], plane='XZ')                                     # belly fin
for side in (-1, 1):
    y = side * .062
    cyl((-.02, y, .82), .04, .02, C['white'], 10, rot=(math.pi / 2, 0, 0))
    for a in (.785, -.785): box((-.02, y + side * .012, .82), (.055, .008, .012), C['ink'], 0, rot=(0, a, 0))   # X eyes
    box((.0, y * .95, .7), (.1, .006, .02), C['iron'], 0, rot=(0, .4, 0))                                    # gill
box((0, 0, .965), (.05, .06, .03), C['ink'], .005)
model('Tool04', tilt=30, tip=(0, .07, .55))

# 5 通天搋子: a plunger. Pine stick, red rubber cup.
cyl((0, 0, .18), .045, .82, C['crumb'], 10)
cyl((0, 0, -.05), .056, .24, C['red'], 10)
cyl((0, 0, -.22), .06, .05, C['deep_red'], 10)
lathe([(.05, .55), (.09, .6), (.17, .68), (.2, .78), (.21, .86), (.18, .87)], C['rubber'], 14, cap=False)
cyl((0, 0, .865), .185, .012, C['deep_red'], 14)
ring((0, 0, .86), .2, .025, C['deep_red'], major=16, minor=5)
model('Tool05', tilt=36, tip=(0, 0, .87))

# 6 巨无霸棒棒糖: a swirl lollipop on a white stick; the disc faces the camera behind the miner.
cyl((0, 0, .2), .035, .86, C['white'], 10)
cyl((0, 0, -.05), .045, .24, C['coral'], 10)
cyl((0, .0, .86), .3, .1, C['white'], 24, rot=(math.pi / 2, 0, 0), bevel=.02)
for side in (-1, 1):
    pts = []
    for i in range(34):
        t = i / 33; a = t * math.pi * 5; r = .02 + .26 * t
        pts.append((math.cos(a) * r, side * .052, .86 + math.sin(a) * r))
    tube(pts, .024, C['pink'])
for i, a in enumerate((0, 2.1, 4.2)):
    ball((math.cos(a) * .12, -.06, .86 + math.sin(a) * .12), (.025, .02, .025), [C['yellow'], C['candy_blue'], C['lime']][i], 6, 4)
ring((0, 0, .54), .05, .02, C['coral'], rot=(0, 0, 0), major=10, minor=4)
model('Tool06', tilt=34, tip=(0, .05, .86))

# 7 狂暴打蛋器: an electric hand mixer held like a drill; both whisks spin while it works.
box((0, 0, -.02), (.11, .13, .3), C['mint'], .035)
box((0, -.005, -.02), (.115, .07, .22), C['mint_dark'], .02)                     # finger grip
box((0, .1, .24), (.2, .48, .22), C['mint'], .06)
box((0, .1, .356), (.13, .3, .025), C['white'], .01)
cyl((0, -.02, .37), .035, .03, C['red'], 10)                                    # speed button
for i, y in enumerate((.04, .1, .16)): box((0, y, .37), (.02, .018, .012), C['iron'], 0)
box((0, .34, .24), (.17, .02, .17), C['white'], .02)                           # whisk plate
for x in (-.055, .055):
    slot = 'a' if x < 0 else 'b'
    cyl((x, .36, .2), .025, .04, C['chrome'], 10, rot=(math.pi / 2, 0, 0))
    cyl((x, .46, .2), .011, .2, C['chrome'], 6, rot=(math.pi / 2, 0, 0), slot=slot)
    for k in range(3):
        phi = k * math.pi / 3; pts = []
        for i in range(12):
            t = i / 12 * 2 * math.pi; r = .065 * math.sin(t); yy = .66 - .1 * math.cos(t)
            pts.append((x + r * math.cos(phi), yy, .2 + r * math.sin(phi)))
        tube(pts, .007, C['chrome'], slot=slot, cyclic=True)
    ball((x + .02, .7, .22), (.05, .05, .04), C['cream'], 8, 5, slot=slot)     # whipped cream
grow(1.45); S = 1.45
model('Tool07', tip=(0, .78 * S, .2 * S), spins=[('a', (-.055 * S, .4 * S, .2 * S), 'Y'), ('b', (.055 * S, .4 * S, .2 * S), 'Y')])

# 8 瓜瓜锤: a whole watermelon mallet, light and dark stripes.
wood_handle(.6)
stripes = lambda p, n: C['green'] if int((math.atan2(p.z - .7, p.x) / (2 * math.pi) * 12) % 2) else C['lime']
lathe([(.01, -.36), (.14, -.32), (.21, -.2), (.23, 0), (.21, .2), (.14, .32), (.01, .36)], stripes, 12, at=(0, .02, .7), axis='Y')
cyl((0, .4, .7), .02, .07, C['wood_dark'], 6, rot=(math.pi / 2, 0, 0))
slab([(0, 0), (.06, .05), (.13, .03), (.07, -.02)], .015, C['leaf'], at=(0, .4, .74), plane='XZ')
box((0, 0, .53), (.12, .12, .1), C['wood_dark'], .02)
model('Tool08', tip=(0, .38, .7))

# 9 嘎嘎鸭锤: a big rubber duck on a stick, beak first.
cyl((0, 0, .2), .042, .86, C['sky'], 10)
cyl((0, 0, -.05), .054, .24, C['white'], 10)
for z in (-.18, .08): cyl((0, 0, z), .06, .03, C['sky'], 10)
ball((0, -.02, .74), (.22, .26, .17), C['duck'], 14, 9)                         # body
ball((0, .12, .93), (.14, .14, .14), C['duck'], 12, 8)                          # head
slab([(-.02, 0), (.06, .02), (.12, .1), (.04, .06)], .04, C['duck'], at=(0, -.28, .74), plane='YZ')      # tail
box((0, .27, .9), (.11, .1, .05), C['beak'], .02)                                # beak
for side in (-1, 1):
    ball((side * .1, .19, .97), (.03, .025, .035), C['white'], 8, 5)
    ball((side * .118, .205, .975), (.014, .012, .018), C['ink'], 6, 4)
    ball((side * .19, 0, .74), (.04, .14, .08), C['yellow'], 8, 5)              # wings
model('Tool09', tilt=18, tip=(0, .32, .9))

# 10 霸王龙骨: a dinosaur bone club with a cracked knob.
for z, s in ((-.16, .9), (.86, 1.35)):
    for sx in (-1, 1): ball((sx * .07 * s, 0, z), (.085 * s, .08 * s, .09 * s), C['bone'], 10, 6)
lathe([(.075, -.12), (.055, .1), (.05, .45), (.06, .7), (.09, .82)], C['bone'], 10)
cyl((0, 0, -.02), .065, .18, C['leather'], 10)
for z in (.25, .5): ring((0, 0, z), .055, .012, C['bone_shade'], major=10, minor=4)
box((.05, .05, .9), (.01, .08, .05), C['bone_shade'], 0, rot=(.5, 0, .3))
model('Tool10', tilt=34, tip=(0, .08, .9))

# ---------------------------------------------------------------- TOOLS, levels 11-30: the old series for now
for level in range(11, 31):
    k = (level - 1) % 10; era = (level - 1) // 10; metal = [3, 4, 6, 3, 7, 14, 9, 8, 11, 5][k]; accent = [8, 10, 15][era]
    cyl((0, 0, .24), .043 + .003 * (k % 3), .90, 5, 10, smooth=False)
    cyl((0, 0, -.02), .052, .21, 2, 10, smooth=False)
    for z in [-.12, .09, .56]: cyl((0, 0, z), .057, .025, accent, 10, smooth=False)
    width = .7 + .045 * k; height = .67 + .015 * (k % 3)
    pts = [(-width * .45, height - .08), (-width * .45, height + .04), (-.09, height + .12), (.12, height + .10), (width * .32, height),
           (width * .6, height - .24), (width * .45, height - .20), (.12, height - .035), (-.08, height - .015)]
    slab(pts, .12 + .01 * (k % 3), metal, bevel=.015)
    cyl((0, 0, .61), .077, .16, 5, 10, smooth=False)
    if k >= 3: box((0, -.07, height), (.17, .19, .14), metal, .025)
    if k in [4, 6, 8, 9]:
        for sign in [-1, 1]: ball((sign * .087, 0, height), (.047, .065, .09), accent, 6, 4, smooth=False)
    if k in [5, 7, 9]: slab([(-.14, height + .04), (-width * .6, height - .17), (-width * .36, height + .12), (-.1, height + .17)], .10, metal)
    for z in [.18, .35, .45]: cyl((0, 0, z), .052, .025, accent, 10, smooth=False)
    model(f'Tool{level:02d}', tip=(0, width * .6, height - .24))

# ---------------------------------------------------------------- BACKPACKS, world 1
def straps(c, top=.22, bottom=-.22):
    """The two shoulder straps between the bag and the miner's back, kept inside the bag's outline."""
    for x in (-.15, .15): box((x, .17, (top + bottom) / 2), (.06, .05, top - bottom), C[c], .015)
ORE = [C['gold'], C['sky'], C['emerald'], C['purple'], C['red'], C['orange']]

# 1 麻布袋: a burlap sack tied at the neck, ore poking out of its mouth.
straps('leather', .16, -.24)
lathe([(.05, -.33), (.24, -.3), (.3, -.14), (.29, .04), (.2, .2), (.14, .25), (.17, .31), (.15, .33)], C['burlap'], 12, at=(0, -.12, 0), scale=(1, .9, 1), cap=False)
lathe([(.05, -.33), (.14, -.33)], C['burlap_dark'], 12, at=(0, -.12, 0), scale=(1, .9, 1), cap=False)
cyl((0, -.12, .2), .13, .02, C['ore_dark'], 12, smooth=False)
ring((0, -.12, .245), .15, .025, C['wicker_dark'], major=14, minor=4)
box((.07, -.39, -.06), (.16, .03, .15), C['burlap_dark'], .01, rot=(0, .2, 0))  # patch
chunks((0, -.12, .2), .13, .11, .14, ORE, 7, 1)
model('Bag01', fill=(0, -.12, .2))

# 2 快递纸箱: a parcel box, flaps open, tape across, ore heaped inside.
straps('card_dark')
box((0, -.1, -.06), (.56, .46, .5), C['card'], .01)
box((0, -.1, .19), (.5, .4, .01), C['card_dark'], 0)
box((0, -.335, -.06), (.1, .012, .5), C['tape'], 0)
for sx in (-1, 1):
    box((sx * .33, -.1, .26), (.12, .44, .012), C['card'], 0, rot=(0, sx * -.7, 0))
for sy in (-1, 1):
    box((0, -.1 + sy * .27, .27), (.54, .1, .012), C['card'], 0, rot=(sy * .9, 0, 0))
box((-.14, -.338, .02), (.16, .008, .1), C['white'], 0)
for i in range(3): box((-.18 + i * .04, -.343, .02), (.012, .004, .06), C['ink'], 0)
chunks((0, -.1, .19), .2, .16, .16, ORE, 9, 2)
model('Bag02', fill=(0, -.1, .19))

# 3 野餐篮: a wicker basket with a checked cloth, a baguette sticking out.
straps('wicker_dark')
lathe([(.0, -.3), (.24, -.3), (.3, .14), (.3, .16)], lambda p, n: C['wicker_dark'] if int((p.z + .3) / .055) % 2 else C['wicker'], 14,
      at=(0, -.11, 0), scale=(1, .72, 1), cap=False)
lathe([(.29, .14), (.0, .14)], C['wicker_dark'], 14, at=(0, -.11, 0), scale=(1, .72, 1), cap=False)
ring((0, -.11, .16), .3, .028, C['wicker_dark'], major=16, minor=4, rot=None)
bpy.context.object.scale = (1, .72, 1); apply(bpy.context.object)
handle = [(math.cos(a) * .26, -.11, .16 + math.sin(a) * .26) for a in [i * math.pi / 10 for i in range(11)]]
tube(handle, .022, C['wicker_dark'], sides=1)
for i in range(4):
    for j in range(2):
        box((-.21 + i * .06, -.33 - j * .005, .1 - j * .06), (.06, .01, .06), C['red'] if (i + j) % 2 else C['white'], 0)
lathe([(.05, -.3), (.065, -.25), (.065, .25), (.04, .3)], C['crust'], 8, at=(.12, -.05, .25), axis='Z')
bpy.context.object.rotation_euler = (.3, .4, 0); apply(bpy.context.object)
chunks((0, -.11, .14), .2, .14, .12, ORE, 8, 3)
model('Bag03', fill=(0, -.11, .14))

# 4 金鱼缸: a glass tank with water, a goldfish and a plant; the ore settles as gravel on its floor.
straps('blue')
box((0, -.1, -.27), (.58, .44, .06), C['blue'], .02)
box((0, -.1, .27), (.58, .44, .05), C['blue'], .02)
box((0, -.1, .305), (.3, .2, .03), C['sky'], .01)
for sx in (-1, 1):
    for sy in (-1, 1): box((sx * .27, -.1 + sy * .2, 0), (.04, .04, .5), C['blue'], .01)
box((0, -.1, 0), (.52, .38, .5), C['water'], .02, slot='glass')
box((0, -.1, -.235), (.5, .36, .02), C['sand'], 0)
ball((.08, -.12, .14), (.08, .05, .06), C['orange'], 10, 6)
slab([(0, 0), (.06, .05), (.06, -.05)], .015, C['orange'], at=(.14, -.12, .14), plane='XZ')
for sy in (-1, 1): ball((.03, -.12 + sy * .045, .155), (.012, .008, .012), C['ink'], 6, 4)
for i in range(3):
    o = box((-.17 + i * .03, -.02, -.12 + i * .05), (.04, .02, .22 + i * .06), C['plant'], 0, rot=(0, .15 * (i - 1), 0))
for i, z in enumerate((.02, .1, .19)): ball((.12 - i * .02, -.15, .21 + z * .3), (.015, .015, .015), C['belly'], 6, 4)
chunks((0, -.1, -.225), .23, .16, .18, ORE + [C['sand']], 10, 4, size=.06)
model('Bag04', fill=(0, -.1, -.225))

# 5 西瓜背包: a whole watermelon with a zip round its middle and a leaf on top.
straps('green', .18, -.18)
stripes = lambda p, n: C['green'] if int(((math.atan2(p.y + .12, p.x) / (2 * math.pi) * 14) % 14)) % 2 else C['lime']
lathe([(.01, -.3), (.17, -.26), (.27, -.12), (.3, .02), (.27, .16), (.17, .27), (.01, .31)], stripes, 14, at=(0, -.12, 0), scale=(1, .88, 1))
ring((0, -.12, .02), .3, .014, C['iron'], major=18, minor=4)
bpy.context.object.scale = (1, .88, 1); apply(bpy.context.object)
box((.0, -.39, .02), (.04, .02, .07), C['chrome'], .008)
cyl((0, -.12, .33), .02, .06, C['wood_dark'], 6)
slab([(0, 0), (.08, .06), (.17, .04), (.1, -.02)], .015, C['leaf'], at=(0, -.12, .35), plane='XZ')
model('Bag05')

# 6 小猪存钱罐: a pink piggy bank, its snout looking back at the camera, a coin stuck in its slot.
straps('pig_dark', .14, -.16)
ball((0, -.12, 0), (.27, .25, .24), C['pig'], 14, 9)
cyl((0, -.39, -.01), .09, .06, C['pig_dark'], 12, rot=(math.pi / 2, 0, 0))
for sx in (-1, 1):
    cyl((sx * .03, -.42, -.01), .018, .01, C['ink'], 6, rot=(math.pi / 2, 0, 0))
    ball((sx * .12, -.33, .1), (.03, .02, .035), C['ink'], 6, 4)
    cyl((sx * .13, -.2, .23), .065, .12, C['pig_dark'], 4, r2=.0, rot=(-.35, sx * .35, math.pi / 4))       # ears
    for sy in (-1, 1): cyl((sx * .14, -.12 + sy * .12, -.22), .05, .1, C['pig_dark'], 8)
box((0, -.12, .245), (.12, .025, .02), C['ink'], 0)
cyl((0, -.12, .28), .06, .015, C['gold'], 14, rot=(math.pi / 2, 0, 0), smooth=False)
model('Bag06')

# 7 复古冰箱: a rounded mint fridge with chrome handles and fridge magnets.
straps('mint_dark')
box((0, -.08, 0), (.48, .4, .8), C['mint'], .07)
box((0, -.285, .17), (.44, .01, .008), C['mint_dark'], 0)
for z, h in ((.29, .14), (-.06, .3)):
    box((.17, -.3, z), (.035, .04, h), C['chrome'], .012)
box((0, -.08, -.42), (.4, .3, .04), C['iron'], .01)
for (x, z, c) in ((-.12, .3, C['red']), (-.05, .05, C['yellow']), (-.15, -.15, C['sky']), (.02, -.25, C['lime'])):
    box((x, -.29, z), (.06, .02, .06), c, .01, rot=(0, .3, 0))
box((-.02, -.288, -.06), (.12, .006, .14), C['white'], 0, rot=(0, -.08, 0))
model('Bag07')

# 8 滚筒洗衣机: a front-loader; the ore tumbles behind its round glass door.
straps('iron')
body = box((0, -.08, 0), (.56, .44, .64), C['white'], .04)
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=.19, depth=.3, location=(0, -.3, -.05), rotation=(math.pi / 2, 0, 0))
cut = bpy.context.object
mod = body.modifiers.new('Door', 'BOOLEAN'); mod.object = cut; mod.operation = 'DIFFERENCE'; mod.solver = 'EXACT'
bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier=mod.name); bpy.data.objects.remove(cut)
finish(body, C['white']); parts['body'].pop()
cyl((0, -.155, -.05), .19, .01, C['drum'], 20, rot=(math.pi / 2, 0, 0), smooth=False)
ring((0, -.31, -.05), .2, .035, C['chrome'], rot=(math.pi / 2, 0, 0), major=20)
cyl((0, -.31, -.05), .18, .01, C['water'], 20, rot=(math.pi / 2, 0, 0), slot='glass', smooth=False)
box((0, -.305, .25), (.5, .02, .1), C['steel'], .01)
for x in (-.16, .15): cyl((x, -.32, .25), .035, .03, C['sky'] if x > 0 else C['iron'], 10, rot=(math.pi / 2, 0, 0))
box((0, -.318, .25), (.12, .008, .05), C['ink'], 0)
chunks((0, -.2, -.24), .2, .06, .3, ORE, 10, 5, size=.065)
model('Bag08', fill=(0, -.2, -.24))

# 9 扭蛋机: a red capsule machine; the balls inside its dome are the load.
straps('deep_red')
box((0, -.1, -.2), (.42, .38, .32), C['gum_red'], .04)
cyl((0, -.1, -.03), .2, .03, C['deep_red'], 16, smooth=False)
cyl((0, -.3, -.16), .07, .03, C['chrome'], 14, rot=(math.pi / 2, 0, 0))
box((0, -.325, -.16), (.11, .025, .03), C['steel'], .01)
box((.0, -.29, -.3), (.12, .02, .06), C['ink'], .01)
box((.13, -.29, -.1), (.03, .02, .06), C['ink'], .005)
ball((0, -.1, .2), (.23, .23, .23), C['water'], 16, 10, slot='glass')
cyl((0, -.1, .43), .07, .05, C['gum_red'], 12)
ball((0, -.1, .46), (.05, .05, .03), C['gum_red'], 10, 5)
chunks((0, -.1, -.01), .17, .17, .32, [C['red'], C['yellow'], C['sky'], C['lime'], C['pink'], C['purple']], 13, 6, size=.055, shape='ball')
model('Bag09', fill=(0, -.1, -.01))

# 10 海盗宝箱: a pirate chest, lid thrown back, gold and gems heaped too high to close it.
straps('chest_dark', .0, -.26)
box((0, -.1, -.13), (.58, .42, .34), C['chest'], .02)
for x in (-.29, .29):
    box((x, -.1, -.13), (.04, .44, .36), C['gold'], .01)
box((0, -.1, -.3), (.6, .44, .03), C['chest_dark'], .005)
box((0, -.315, -.02), (.1, .02, .12), C['gold'], .015)
box((0, -.326, -.04), (.02, .006, .04), C['ink'], 0)
box((0, -.1, .035), (.54, .38, .01), C['chest_dark'], 0)
n = 10; verts, faces = [], []
for x in (-.29, .29):
    for i in range(n + 1):
        a = math.pi * i / n; verts.append((x, -.21 + .21 * math.cos(a), .21 * math.sin(a)))
m = n + 1
faces += [(i, i + 1, m + i + 1, m + i) for i in range(n)] + [tuple(range(m))[::-1], tuple(range(m, 2 * m))]
lid = mesh('Lid', verts, faces); lid.location = (0, .11, .04); lid.rotation_euler = (-1.75, 0, 0)
finish(apply(lid), C['chest'])
chunks((0, -.1, .04), .24, .16, .16, [C['gold'], C['coin'], C['gold'], C['red'], C['sky'], C['emerald']], 14, 7, size=.06, shape='coin')
model('Bag10', fill=(0, -.1, .04))

# ---------------------------------------------------------------- BACKPACKS, levels 11-30: the old series for now
for level in range(11, 31):
    k = (level - 1) % 10; era = (level - 1) // 10; color = [0, 7, 6, 9, 0, 4, 3, 7, 9, 5][k]; trim = [8, 10, 15][era]
    w = .50 + .025 * (k % 4); h = .64 + .025 * (k % 3)
    if k < 4:
        box((0, 0, 0), (w, .29, h), color, .06)
        box((0, -.15, .22), (w * 1.04, .065, .18), color, .025)
        box((0, -.19, -.14), (w * .72, .13, .22), trim, .035)
        for x in [-w * .35, w * .35]: box((x, -.198, .12), (.045, .025, .09), 5, .008)
    elif k in [4, 5]:
        cyl((0, 0, 0), .29, h, 0, 12, smooth=False)
        for z in [-h * .36, h * .36]: cyl((0, 0, z), .305, .07, trim, 12, smooth=False)
        cyl((0, 0, h * .5), .30, .035, 4, 12, smooth=False)
    elif k in [7, 8]:
        cyl((0, 0, 0), .26, h, color, 10, smooth=False)
        for z in [-h * .48, h * .48]: cyl((0, 0, z), .29, .09, 5, 10, smooth=False)
        box((0, -.255, 0), (.23, .03, .31), trim, .035)
    else:
        box((0, 0, 0), (w, .36, h), 5, .04)
        box((0, -.205, 0), (w * .84, .065, h * .83), color, .04)
        cyl((0, -.255, 0), .11, .05, trim, 8, rot=(math.pi / 2, 0, 0), smooth=False)
        for x in [-w * .36, w * .36]: box((x, -.25, 0), (.05, .035, h * .72), trim, .01)
    for x in [-.17, .17]: box((x, .17, .02), (.065, .065, .58), 2, .018)
    box((0, 0, h * .5 + .045), (.21, .07, .06), 5, .02)
    for x in [-w * .45, w * .45]: ball((x, -.05, .05), (.06, .14, .19), trim, 6, 4, smooth=False)
    model(f'Bag{level:02d}')

for s in bpy.context.selected_objects: s.select_set(False)
for i, r in enumerate(roots):
    r.select_set(True)
    for o in r.children_recursive: o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(SRC / 'equipment.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'equipment.glb'), export_format='GLB', use_selection=True, export_animations=False,
                          export_extras=False, export_yup=True)
manifest = {'maker': 'Blender', 'script': 'tools/build-equipment.py', 'source': 'assets-source/shop-showroom/equipment.blend',
            'texture': [W, H], 'models': report, 'files': []}
for path in [OUT / 'equipment.glb', SRC / 'equipment-atlas.png', SRC / 'equipment.blend', Path(__file__)]:
    manifest['files'].append({'file': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT / 'equipment-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'models': len(report), 'world1': report[:10] + report[30:40]}, ensure_ascii=False))
