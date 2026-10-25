"""The 30 tools and 30 backpacks the miner carries and the shop shows: Blender-authored, no Decimate.
Levels 1-10 (world 1) are joke items from home and kitchen, 11-20 (world 2) machines, 21-30 (world 3) fantasy and
space.

Model conventions (Blender, Z up; glTF turns Z into Y):
- ToolNN: the fist holds the grip at the origin, the handle runs up +Z and the striking end points +Y (a pick's
  point). Everything sits under a 'Hold' empty; clubs tilt it toward +Y so their end lands where a pick's point
  would (the shop resets it to stand them upright). 'PickaxeTip' marks where the hit lands. Empties named 'Spin*'
  turn about their local Z (glTF Y) while the tool works (a mixer's whisks, a drill bit, a gear); a backpack's turn
  all the time (a portal's swirl).
- BagNN: the face against the miner's back is at y = +.15 and the bag grows toward -Y (away from the miner).
  'BagFill' is an empty at the bottom of the visible load; the game scales it on Z (glTF Y) with how full the
  backpack is. Window and dome parts use 'EquipGlass' (tinted by the atlas, see-through), lit-up parts 'EquipGlow'.
Each model is one atlas mesh ('Body') plus its glass, glow, spinning and fill parts, so it draws in a few calls.
Usage: blender -b --python tools/build-equipment.py
"""
import bpy, bmesh, math, json, hashlib, random
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets-source/shop-showroom'; OUT = ROOT / 'src/game/assets/shop'
bpy.ops.wm.read_factory_settings(use_empty=True)

# The atlas: 16 x 16 flat colour cells of 16 px, one per named colour.
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
    terracotta='c8643c', cactus='4cae4c', cactus_dark='2f7f3a', flower='ff6fb5',
    hazard='f2c230', orange_paint='f08a24', navy='233a5e', neon_cyan='3ff0ff', neon_pink='ff3fa4', laser='59f5ff',
    flame='ff9a2a', flame_core='ffe36b', plasma='9a5bff', plasma_dark='4a2a8a', robot_white='eef1f4', screen='1c2333',
    battery='5df27a', toolbox='d83a32', oil_blue='2a7fd1', microwave='e3e7ea', dish='e3e7ec', container='e8742c',
    container_dark='b5561c', glass_tint='cdeeff', glass_green='b9ffd0',
    ice_pink='ffb3d1', mint_cream='b8f2d0', choco='7a4a2e', cone='e0a25a', cone_dark='b97a36', octo='ff7fae',
    octo_spot='ffd2e3', star='fff27a', lightning='ffe14d', dragon_purple='5b2a86', lavender='c8a8ff', clock_face='fffaf0',
    unicorn='fff4fb', galaxy='2a1a6e', galaxy2='5b3fd1', void_black='140b22', void='c27bff',
    cloud_shade='dfe9f5', pumpkin='ff8c1a', pumpkin_dark='e06a00', candle='ffd34d', honey='ffb627', honey_dark='d98a0b',
    jelly='e3c4ff', jelly_glow='f0a8ff', planet='ff7b54', planet_band='ffb38a', ring_c='ffe2b0', egg_red='e85d75',
    egg_spot='6c3fd1', book='a32f45', page='fff7e0', sand_gold='f2c14e', portal='b06cff', portal_rim='6b5f7a',
)
HEX = list(NAMED.values())
C = {name: i for i, name in enumerate(NAMED)}
assert len(HEX) <= 256
W, H, CELL = 256, 256, 16
img = bpy.data.images.new('EquipAtlas', width=W, height=H)
px = [0.0] * (W * H * 4)
for i, h in enumerate(HEX + ['ff00ff'] * (256 - len(HEX))):
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
# Glass takes its tint from the atlas, see-through; glow parts light themselves with the atlas colour.
glass = bpy.data.materials.new('EquipGlass'); glass.use_nodes = True
g = glass.node_tree.nodes['Principled BSDF']; g.inputs['Alpha'].default_value = .34; g.inputs['Roughness'].default_value = .2
t = glass.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest'
glass.node_tree.links.new(t.outputs['Color'], g.inputs['Base Color'])
glass.surface_render_method = 'BLENDED'
glow = bpy.data.materials.new('EquipGlow'); glow.use_nodes = True
e = glow.node_tree.nodes['Principled BSDF']; e.inputs['Emission Strength'].default_value = 1.0
t = glow.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest'
glow.node_tree.links.new(t.outputs['Color'], e.inputs['Base Color']); glow.node_tree.links.new(t.outputs['Color'], e.inputs['Emission Color'])

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
    me = o.data; me.materials.clear(); me.materials.append(glass if slot == 'glass' else glow if slot.endswith('glow') else atlas)
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

def segment(p0, p1, r0, r1, c, n=8, slot='body', smooth=True):
    """A tapered cylinder from p0 (radius r0) to p1 (radius r1)."""
    a, b = Vector(p0), Vector(p1); d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r0, radius2=r1, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    return finish(apply(o), c, slot, smooth=smooth)

def star(outer, inner, points=5, spin=90):
    """A star outline [(u, v)] around the origin."""
    return [((outer if k % 2 == 0 else inner) * math.cos(math.radians(spin + 180 * k / points)),
             (outer if k % 2 == 0 else inner) * math.sin(math.radians(spin + 180 * k / points))) for k in range(2 * points)]

def helix(y0, y1, r0, r1, turns, cz, steps=24, x=0):
    """Points winding round a line along +Y at height cz."""
    return [(x + (r0 + (r1 - r0) * t) * math.cos(2 * math.pi * turns * t), y0 + (y1 - y0) * t,
             cz + (r0 + (r1 - r0) * t) * math.sin(2 * math.pi * turns * t)) for t in (i / steps for i in range(steps + 1))]

def crescent(cz, r, a0, a1, w, thick, c, cy=0, steps=10, tip_w=.006, taper=True, slot='body'):
    """A pick head: an arc of radius r about (y=cy, z=cz) in the YZ plane from angle a0 to a1 (degrees, 0 = +Y),
    `w` thick at the middle and pointed at both ends. Returns the a0 end (the point)."""
    outer, inner = [], []
    for i in range(steps + 1):
        t = i / steps; a = math.radians(a0 + (a1 - a0) * t); half = tip_w + w / 2 * math.sin(math.pi * t) ** .7 if taper else w / 2
        outer.append((cy + math.cos(a) * (r + half), cz + math.sin(a) * (r + half)))
        inner.append((cy + math.cos(a) * (r - half), cz + math.sin(a) * (r - half)))
    slab(outer + inner[::-1], thick, c, slot=slot)
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
AXES = {'X': (0, math.pi / 2, 0), 'Y': (-math.pi / 2, 0, 0), 'Z': (0, 0, 0)}
def model(name, tilt=0, tip=None, spins=(), fill=None):
    """Join the collected parts into model `name`. spins: [(slot, point, axis 'X'|'Y'|'Z' or an Euler rotation whose
    Z is the axis)]; a slot's glowing parts are '<slot>_glow'. fill: bottom point of the load ('fill', 'fill_glow').
    Clubs tilt `tilt` degrees toward +Y under 'Hold'."""
    root = empty(name); holder = empty('Hold', rot=(-math.radians(tilt), 0, 0)) if name.startswith('Tool') else root
    if holder is not root: holder.parent = root
    bpy.context.view_layer.update()
    tris = 0
    def place(obj, parent, inverse=None):
        nonlocal tris
        tris += sum(len(p.vertices) - 2 for p in obj.data.polygons); attach(obj, parent, inverse)
    place(join(parts.pop('body'), 'Body'), holder)
    if 'glass' in parts: place(join(parts.pop('glass'), 'Glass'), holder)
    if 'glow' in parts: place(join(parts.pop('glow'), 'Glow'), holder)
    def hang(pivot, slot, label):
        for key, suffix in ((slot, ''), (slot + '_glow', 'Glow')):
            if key in parts: place(join(parts.pop(key), label + suffix), pivot, pivot.matrix_basis.copy())
    for slot, point, axis in spins:
        pivot = empty('Spin' + slot.title(), point, AXES.get(axis, axis)); attach(pivot, holder)
        hang(pivot, slot, slot.title())
    if fill is not None:
        pivot = empty('BagFill', fill); attach(pivot, holder)
        hang(pivot, 'fill', 'Load')
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

# 2 扎手仙人掌: a potted cactus held by its pot, a pink flower on top.
lathe([(.07, -.27), (.085, -.26), (.1, -.05), (.115, -.04), (.115, .02), (.1, .03)], C['terracotta'], 10)
cyl((0, 0, .025), .1, .01, C['ore_dark'], 10, smooth=False)
lathe([(.07, .02), (.11, .1), (.12, .3), (.11, .6), (.08, .74), (.02, .79)], C['cactus'], 8, smooth=False)
for s in (-1, 1):
    segment((s * .1, 0, .36 + s * .06), (s * .2, 0, .4 + s * .06), .05, .045, C['cactus'], 8, smooth=False)
    segment((s * .2, 0, .38 + s * .06), (s * .21, 0, .56 + s * .06), .045, .035, C['cactus'], 8, smooth=False)
for k in range(10):
    a = k * 2.4; z = .12 + k * .06
    box((math.cos(a) * .12, math.sin(a) * .12, z), (.03, .008, .008), C['white'], 0, rot=(0, 0, a))
for k in range(5):
    a = k * 2 * math.pi / 5
    ball((math.cos(a) * .045, math.sin(a) * .045, .8), (.04, .04, .02), C['flower'], 8, 4)
ball((0, 0, .81), (.025, .025, .02), C['yellow'], 6, 4)
model('Tool02', tilt=34, tip=(0, 0, .82))

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

# ---------------------------------------------------------------- TOOLS, world 2: machines
def handle(top=.72, c='steel', grip='black', r=.045, n=10):
    cyl((0, 0, (top - .22) / 2), r, top + .22, C[c], n)
    cyl((0, 0, -.05), r + .012, .26, C[grip], n)
    cyl((0, 0, -.235), r + .02, .05, C[grip], n)

# 11 大扳手: a giant open-ended spanner with a nut caught in its jaw.
box((0, 0, .2), (.1, .055, .86), C['chrome'], .02)
box((0, 0, -.06), (.12, .075, .3), C['orange_paint'], .025)
box((0, 0, .62), (.13, .06, .1), C['chrome'], .015)
cz, R = .8, .2
jaw = [(R * math.cos(math.radians(a)), cz + R * math.sin(math.radians(a))) for a in [115 + i * 310 / 16 for i in range(17)]]
slab(jaw + [(.06, cz + .03), (-.06, cz + .03)], .07, C['chrome'], plane='XZ')
cyl((0, 0, cz + .085), .05, .08, C['gold'], 6, rot=(math.pi / 2, 0, 0), smooth=False)
model('Tool11', tilt=30, tip=(0, 0, 1.0))

# 12 冲击电钻: a yellow cordless drill; its bit spins.
box((0, 0, -.02), (.11, .13, .3), C['hazard'], .03)
box((0, 0, -.2), (.16, .2, .1), C['black'], .02)
box((0, .07, .1), (.04, .05, .06), C['black'], .01)
box((0, .08, .22), (.17, .4, .2), C['hazard'], .05)
box((0, -.1, .22), (.175, .06, .21), C['black'], .02)
for y in (.02, .08, .14): box((0, y, .325), (.13, .02, .012), C['black'], 0)
cyl((0, .33, .22), .06, .1, C['black'], 12, rot=(math.pi / 2, 0, 0))
cyl((0, .39, .22), .045, .04, C['chrome'], 12, rot=(math.pi / 2, 0, 0))
cyl((0, .6, .22), .02, .42, C['steel'], 8, rot=(math.pi / 2, 0, 0), slot='a')
tube(helix(.42, .78, .024, .024, 3, .22), .011, C['chrome'], slot='a')
cyl((0, .835, .22), .022, .05, C['steel'], 8, r2=0, rot=(-math.pi / 2, 0, 0), slot='a')
grow(1.35); S = 1.35
model('Tool12', tip=(0, .86 * S, .22 * S), spins=[('a', (0, .6 * S, .22 * S), 'Y')])

# 13 链锯: an orange chainsaw held by its rear grip; the bar points at the rock.
box((0, 0, -.02), (.1, .12, .28), C['orange_paint'], .03)
box((0, 0, .15), (.12, .14, .08), C['orange_paint'], .02)
box((0, .16, .24), (.24, .36, .24), C['orange_paint'], .05)
box((0, .16, .37), (.18, .3, .03), C['black'], .01)
for y in (.08, .16, .24): box((.121, y, .24), (.01, .03, .14), C['black'], 0)
tube([(-.13, .12, .3), (-.13, .12, .44), (0, .14, .5), (.13, .12, .44), (.13, .12, .3)], .018, C['black'], sides=1)
slab([(.3, .18), (.95, .18), (1.0, .2), (1.02, .24), (1.0, .28), (.95, .3), (.3, .3)], .025, C['steel'])
for y in [.34 + .06 * i for i in range(11)]:
    for z in (.305, .175): box((0, y, z), (.035, .035, .025), C['black'], 0)
box((0, .32, .24), (.05, .05, .16), C['black'], .01)
grow(1.3); S = 1.3
model('Tool13', tip=(0, 1.02 * S, .24 * S))

# 14 马蹄磁铁: a horseshoe magnet with ore stuck to its poles.
handle(.45, 'steel', 'red')
R, cz = .2, .62
u = [(-R, 0, .95), (-R, 0, cz)] + [(R * math.cos(math.radians(a)), 0, cz + R * math.sin(math.radians(a))) for a in range(180, 361, 30)] + [(R, 0, cz), (R, 0, .95)]
tube(u, .07, C['red'], sides=1)
for x in (-R, R): cyl((x, 0, .93), .075, .1, C['chrome'], 8)
box((.25, .03, 1.0), (.07, .06, .06), C['purple'], 0, rot=(.4, .3, .2))
box((-.23, -.02, 1.02), (.06, .06, .05), C['gold'], 0, rot=(.2, .5, .1))
box((.17, -.03, 1.03), (.05, .05, .04), C['emerald'], 0, rot=(.6, .1, .3))
model('Tool14', tilt=30, tip=(0, 0, 1.0))

# 15 机械爪: a robot claw that has caught a gem.
handle(.62, 'iron', 'blue')
box((0, 0, .7), (.16, .2, .18), C['hazard'], .03)
box((0, .2, .7), (.08, .28, .08), C['iron'], .01)
box((0, -.14, .7), (.12, .1, .12), C['iron'], .02)
cyl((0, .36, .7), .07, .06, C['chrome'], 10, rot=(math.pi / 2, 0, 0))
box((0, 0, .795), (.06, .06, .02), C['neon_cyan'], 0, slot='glow')
for k in range(3):
    a = math.radians(90 + 120 * k); c, sn = math.cos(a), math.sin(a)
    segment((c * .05, .38, .7 + sn * .05), (c * .13, .48, .7 + sn * .13), .025, .022, C['chrome'], 6)
    segment((c * .13, .48, .7 + sn * .13), (c * .07, .6, .7 + sn * .07), .022, .012, C['chrome'], 6)
    ball((c * .13, .48, .7 + sn * .13), (.03, .03, .03), C['iron'], 6, 4)
ball((0, .52, .7), (.07, .07, .07), C['purple'], 6, 4, smooth=False)
model('Tool15', tip=(0, .6, .7))

# 16 霓虹路牌: a construction sign with a glowing arrow and rim.
cyl((0, 0, .25), .035, .94, C['steel'], 8)
cyl((0, 0, -.06), .05, .28, C['black'], 8)
box((0, 0, .82), (.5, .06, .3), C['navy'], .02)
for at, size in (((0, 0, .97), (.52, .07, .025)), ((0, 0, .67), (.52, .07, .025)), ((.25, 0, .82), (.025, .07, .32)), ((-.25, 0, .82), (.025, .07, .32))):
    box(at, size, C['neon_cyan'], 0, slot='glow')
slab([(-.17, -.03), (.05, -.03), (.05, -.09), (.18, 0), (.05, .09), (.05, .03), (-.17, .03)], .075, C['neon_pink'], at=(0, 0, .82), plane='XZ', slot='glow')
model('Tool16', tilt=30, tip=(0, 0, .97))

# 17 激光剑: a glowing blade on a chrome hilt.
cyl((0, 0, -.02), .045, .36, C['chrome'], 12)
for z in (-.12, -.06, 0, .06): ring((0, 0, z), .047, .01, C['black'], major=12, minor=4)
cyl((0, 0, .19), .055, .06, C['black'], 12)
box((0, 0, .19), (.16, .03, .03), C['chrome'], .005)
box((0, -.045, .05), (.02, .02, .03), C['red'], 0)
cyl((0, 0, .66), .04, .9, C['laser'], 10, slot='glow')
ball((0, 0, 1.11), (.04, .04, .03), C['laser'], 8, 4, slot='glow')
model('Tool17', tilt=34, tip=(0, 0, 1.1))

# 18 火箭锤: a hammer whose head is a rocket, nose first, flame out the back.
handle(.6, 'steel', 'red')
box((0, 0, .64), (.1, .1, .1), C['iron'], .015)
lathe([(.01, -.36), (.1, -.34), (.13, -.2), (.13, .18), (.1, .28), (.05, .36), (.01, .4)],
      lambda p, n: C['red'] if p.y > .25 else C['blue'] if abs(p.y) < .04 else C['white'], 12, at=(0, 0, .74), axis='Y')
for s in (-1, 1):
    box((s * .15, -.28, .74), (.1, .14, .02), C['red'], .005)
    box((0, -.28, .74 + s * .15), (.02, .14, .1), C['red'], .005)
    cyl((s * .128, .06, .74), .045, .02, C['sky'], 10, rot=(0, math.pi / 2, 0))
cyl((0, -.38, .74), .07, .06, C['iron'], 10, rot=(math.pi / 2, 0, 0))
cyl((0, -.5, .74), .08, .2, C['flame'], 10, r2=0, rot=(math.pi / 2, 0, 0), slot='glow')
cyl((0, -.46, .74), .045, .14, C['flame_core'], 8, r2=0, rot=(math.pi / 2, 0, 0), slot='glow')
model('Tool18', tip=(0, .4, .74))

# 19 齿轮战斧: an axe blade in front, a gear behind that spins as it swings.
handle(.66, 'wood_dark', 'black')
box((0, 0, .72), (.12, .16, .24), C['iron'], .02)
slab([(.06, .6), (.2, .54), (.4, .44), (.47, .6), (.47, .84), (.4, 1.0), (.2, .9), (.06, .84)], .07, C['steel'])
slab([(.4, .45), (.46, .44), (.5, .62), (.5, .84), (.44, 1.01), (.39, .99), (.46, .84), (.46, .6)], .075, C['chrome'])
cyl((0, -.26, .72), .16, .06, C['orange_paint'], 16, rot=(0, math.pi / 2, 0), slot='a', smooth=False)
for k in range(10):
    a = 2 * math.pi * k / 10
    box((0, -.26 + math.cos(a) * .19, .72 + math.sin(a) * .19), (.06, .06, .05), C['orange_paint'], 0, rot=(a, 0, 0), slot='a')
cyl((0, -.26, .72), .05, .08, C['iron'], 8, rot=(0, math.pi / 2, 0), slot='a')
model('Tool19', tip=(0, .48, .72), spins=[('a', (0, -.26, .72), 'X')])

# 20 等离子钻: a white sci-fi drill with purple glow; its cone bit spins.
box((0, 0, -.02), (.11, .13, .3), C['robot_white'], .035)
box((0, -.005, -.02), (.115, .07, .22), C['navy'], .02)
box((0, .1, .24), (.2, .46, .22), C['robot_white'], .06)
box((0, .1, .24), (.205, .3, .05), C['navy'], .01)
for s in (-1, 1): box((s * .104, .1, .24), (.01, .26, .02), C['plasma'], 0, slot='glow')
box((0, -.14, .24), (.15, .03, .15), C['plasma'], .01, slot='glow')
cyl((0, .36, .24), .08, .06, C['navy'], 14, rot=(math.pi / 2, 0, 0))
ring((0, .36, .24), .09, .022, C['plasma'], rot=(math.pi / 2, 0, 0), major=14, slot='glow')
cyl((0, .56, .24), .085, .36, C['plasma_dark'], 12, r2=0, rot=(-math.pi / 2, 0, 0), slot='a', smooth=False)
tube(helix(.4, .72, .085, .012, 2.5, .24), .012, C['chrome'], slot='a')
grow(1.35); S = 1.35
model('Tool20', tip=(0, .75 * S, .24 * S), spins=[('a', (0, .56 * S, .24 * S), 'Y')])

# ---------------------------------------------------------------- TOOLS, world 3: fantasy and space
# 21 冰淇淋甜筒: held by the waffle cone, three scoops and a cherry.
lathe([(.02, -.26), (.06, -.1), (.1, .08), (.14, .28), (.155, .34), (.15, .36)],
      lambda p, n: C['cone_dark'] if (int((p.z + .3) / .07) + int((math.atan2(p.y, p.x) + 3.2) / .52)) % 2 else C['cone'], 12)
ball((0, 0, .44), (.17, .17, .14), C['ice_pink'], 12, 8)
ball((.1, -.08, .36), (.04, .04, .07), C['ice_pink'], 8, 5)
ball((0, 0, .64), (.155, .155, .13), C['mint_cream'], 12, 8)
ball((0, 0, .82), (.13, .13, .11), C['choco'], 12, 8)
ball((0, 0, .95), (.045, .045, .045), C['red'], 8, 6)
tube([(0, 0, .99), (.02, .01, 1.06)], .006, C['green'])
for k in range(8):
    a = k * .8
    box((math.cos(a) * .1, math.sin(a) * .1, .86 + (k % 2) * .03), (.04, .012, .012), [C['yellow'], C['sky'], C['pink'], C['lime']][k % 4], 0, rot=(0, .3, a))
model('Tool21', tilt=30, tip=(0, 0, 1.0))

# 22 彩虹镐: a rainbow arc for a head, a cloud on each end.
handle(.66, 'white', 'purple')
for i, c in enumerate(['red', 'orange', 'yellow', 'lime', 'sky', 'purple']):
    crescent(.2, .54 - i * .036, 30, 150, .037, .12, C[c], steps=12, taper=False)
for a in (30, 150):
    x, z = .455 * math.cos(math.radians(a)), .2 + .455 * math.sin(math.radians(a))
    for dx, dz, r in ((0, 0, .08), (.06, .03, .06), (-.06, .02, .06), (0, -.05, .06)):
        ball((0, x + dx, z + dz), (r * 1.1, r, r), C['white'], 8, 5)
model('Tool22', tip=(0, .45, .43))

# 23 章鱼触手: a curling pink tentacle with suckers.
cyl((0, 0, -.08), .055, .3, C['leather'], 10)
pts = [(0, 0, .05), (0, .02, .25), (0, 0, .45), (0, .05, .62), (0, .14, .76), (0, .26, .82), (0, .36, .78), (0, .4, .68), (0, .36, .6), (0, .3, .62)]
rad = [.1, .095, .088, .08, .07, .06, .05, .04, .03, .022]
for i in range(len(pts) - 1): segment(pts[i], pts[i + 1], rad[i], rad[i + 1], C['octo'], 10)
for p, r in zip(pts, rad):
    ball(p, (r, r, r), C['octo'], 8, 5)
for p, r in list(zip(pts, rad))[1:8]: ball((p[0] + r * .85, p[1], p[2]), (.012, r * .4, r * .4), C['octo_spot'], 6, 4)
model('Tool23', tilt=25, tip=pts[5])

# 24 星星魔杖: a glowing star on a white and gold stick.
cyl((0, 0, .2), .03, .84, C['white'], 8)
tube([(.032 * math.cos(t * 8 * math.pi), .032 * math.sin(t * 8 * math.pi), -.15 + .75 * t) for t in (i / 30 for i in range(31))], .01, C['gold'])
cyl((0, 0, -.08), .042, .22, C['purple'], 8)
slab(star(.26, .11), .09, C['star'], at=(0, 0, .84), plane='XZ', slot='glow')
for s in (-1, 1):
    for x in (-.05, .05): box((x, s * .047, .86), (.025, .01, .04), C['ink'], 0)
for at in ((.22, 0, 1.02), (.27, 0, .7), (-.24, 0, 1.06)): ball(at, (.025, .025, .025), C['star'], 6, 4, slot='glow')
model('Tool24', tilt=30, tip=(0, 0, 1.1))

# 25 闪电三叉戟: a gold trident wrapped in lightning.
cyl((0, 0, .25), .032, .98, C['gold'], 8)
cyl((0, 0, -.08), .045, .24, C['blue'], 8)
box((0, 0, .78), (.36, .06, .05), C['gold'], .01)
cyl((0, 0, .95), .03, .3, C['gold'], 8); cyl((0, 0, 1.14), .045, .1, C['chrome'], 8, r2=0)
for x in (-.16, .16):
    cyl((x, 0, .89), .025, .2, C['gold'], 8); cyl((x, 0, 1.03), .04, .09, C['chrome'], 8, r2=0)
bolt = [(-.02, .26), (.06, .26), (.02, .13), (.07, .13), (-.04, -.04), (0, .09), (-.05, .09)]
slab(bolt, .03, C['lightning'], at=(.2, 0, .45), plane='XZ', slot='glow')
slab([(-u, v) for u, v in bolt][::-1], .03, C['lightning'], at=(-.21, 0, .6), plane='XZ', slot='glow')
model('Tool25', tilt=28, tip=(0, 0, 1.19))

# 26 龙骨镰: a scythe of dragon bone with a purple fang for a blade.
cyl((0, 0, .22), .045, .9, C['bone'], 8)
for z in (-.1, .12, .32, .52): ball((0, 0, z), (.062, .062, .035), C['bone_shade'], 8, 4)
cyl((0, 0, -.05), .056, .2, C['leather'], 8)
tip = crescent(.24, .52, 14, 96, .22, .08, C['dragon_purple'], steps=12)
crescent(.24, .43, 18, 92, .045, .085, C['lavender'], steps=10)
ball((0, 0, .73), (.1, .11, .09), C['bone'], 10, 6)
for s in (-1, 1): ball((s * .075, .03, .75), (.022, .022, .022), C['plasma'], 6, 4, slot='glow')
for k in range(3): segment((0, -.06, .66 + k * .07), (0, -.2, .74 + k * .09), .035, .004, C['bone_shade'], 6)
model('Tool26', tip=tip)

# 27 独角兽角钻: a unicorn head held like a drill; its spiral horn spins.
box((0, 0, -.02), (.11, .13, .3), C['ice_pink'], .035)
box((0, .06, .24), (.18, .34, .22), C['unicorn'], .07)
for i, (y, c) in enumerate(((-.07, 'pink'), (.0, 'purple'), (.07, 'sky'), (.14, 'lime'))): ball((0, y, .36), (.05, .05, .045), C[c], 8, 5)
for s in (-1, 1):
    ball((s * .092, .14, .28), (.012, .03, .035), C['ink'], 6, 4)
    ball((s * .092, .19, .22), (.01, .03, .02), C['ice_pink'], 6, 4)
    cyl((s * .06, -.04, .37), .03, .08, C['unicorn'], 6, r2=0)
ring((0, .24, .24), .08, .02, C['gold'], rot=(math.pi / 2, 0, 0), major=14)
cyl((0, .49, .24), .075, .46, C['unicorn'], 10, r2=0, rot=(-math.pi / 2, 0, 0), slot='a', smooth=False)
tube(helix(.27, .7, .075, .008, 3, .24), .011, C['gold'], slot='a')
grow(1.3); S = 1.3
model('Tool27', tip=(0, .72 * S, .24 * S), spins=[('a', (0, .49 * S, .24 * S), 'Y')])

# 28 怀表镐: a giant pocket watch for a hammer head; its hands race while it works.
handle(.58, 'gold', 'leather')
cyl((0, 0, .76), .22, .08, C['gold'], 20, rot=(math.pi / 2, 0, 0))
cyl((0, 0, .76), .19, .086, C['clock_face'], 20, rot=(math.pi / 2, 0, 0), smooth=False)
for s in (-1, 1):
    for k in range(4):
        a = k * math.pi / 2; box((math.cos(a) * .15, s * .044, .76 + math.sin(a) * .15), (.025, .006, .025), C['ink'], 0)
    box((0, s * .05, .82), (.018, .008, .12), C['ink'], 0, slot='a')
    box((.04, s * .05, .76), (.09, .008, .016), C['ink'], 0, slot='a')
cyl((0, 0, .76), .015, .11, C['gold'], 8, rot=(math.pi / 2, 0, 0), slot='a')
cyl((0, 0, 1.0), .035, .05, C['gold'], 8)
ring((0, 0, 1.06), .045, .012, C['gold'], rot=(math.pi / 2, 0, 0), major=12, minor=4)
model('Tool28', tip=(0, .045, .76), spins=[('a', (0, 0, .76), 'Y')])

# 29 黑洞锤: a black sphere ringed by a glowing disk that turns while it works.
handle(.6, 'iron', 'purple')
box((0, 0, .62), (.08, .08, .1), C['iron'], .01)
ball((0, 0, .78), (.17, .17, .17), C['void_black'], 14, 9)
ring((0, 0, .78), .28, .03, C['void'], rot=(0, .4, 0), major=24, minor=4, slot='a_glow')
ring((0, 0, .78), .21, .02, C['jelly_glow'], rot=(0, .4, 0), major=20, minor=4, slot='a_glow')
for k in range(5):
    a = k * 2 * math.pi / 5; v = Matrix.Rotation(.4, 3, 'Y') @ Vector((math.cos(a) * .245, math.sin(a) * .245, 0))
    ball((v.x, v.y, .78 + v.z), (.018, .018, .018), C['star'], 6, 4, slot='a_glow')
model('Tool29', tip=(0, .17, .78), spins=[('a', (0, 0, .78), (0, .4, 0))])

# 30 银河之镐: a pick of deep space, full of stars, a glowing core.
handle(.7, 'navy', 'gold')
for z in (-.17, .3, .62): cyl((0, 0, z), .06, .03, C['gold'], 10)
tip = crescent(.2, .48, 28, 152, .18, .14, C['galaxy'])
crescent(.2, .48, 34, 146, .07, .145, C['galaxy2'], steps=8)
box((0, 0, .66), (.18, .2, .2), C['gold'], .03)
ball((0, 0, .66), (.07, .11, .09), C['void'], 6, 4, smooth=False, slot='glow')
for a in range(40, 141, 20):
    for s in (-1, 1):
        r = .48 + (.04 if a % 40 else -.04)
        ball((s * .072, r * math.cos(math.radians(a)), .2 + r * math.sin(math.radians(a))), (.016, .016, .016), C['star'], 6, 4, slot='glow')
model('Tool30', tip=tip)

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

# ---------------------------------------------------------------- BACKPACKS, world 2: machines
def cut(body, at, size, rot=(0, 0, 0), shape='box'):
    """Hollow a recess out of `body` (already finished) and repaint it."""
    if shape == 'box': bpy.ops.mesh.primitive_cube_add(size=1, location=at); tool = bpy.context.object; tool.scale = size
    else: bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=size[0], depth=size[1], location=at, rotation=rot); tool = bpy.context.object
    m = body.modifiers.new('Cut', 'BOOLEAN'); m.object = tool; m.operation = 'DIFFERENCE'; m.solver = 'EXACT'
    bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier=m.name); bpy.data.objects.remove(tool)

# 11 工具箱: an open red tool tote, a screwdriver and spanner poking out of the ore.
straps('iron')
box((0, -.1, -.12), (.58, .42, .36), C['toolbox'], .02)
box((0, -.1, .07), (.6, .44, .03), C['deep_red'], .005)
for x in (-.25, .25): box((x, -.1, .17), (.03, .03, .2), C['iron'], .005)
box((0, -.1, .27), (.53, .04, .04), C['iron'], .01)
for x in (-.18, .18): box((x, -.316, -.0), (.06, .02, .05), C['chrome'], .005)
box((0, -.312, -.15), (.2, .006, .08), C['hazard'], 0)
segment((.12, -.05, .12), (.16, -.02, .3), .025, .025, C['hazard'], 8); segment((.16, -.02, .3), (.18, -.01, .42), .008, .008, C['chrome'], 6)
box((-.13, -.14, .26), (.04, .015, .3), C['chrome'], .005, rot=(0, -.35, 0))
chunks((0, -.1, .08), .22, .15, .14, ORE, 9, 11)
model('Bag11', fill=(0, -.1, .08))

# 12 油桶: a blue oil drum, green ooze spilling over its lid.
straps('blue')
cyl((0, -.13, 0), .27, .7, C['oil_blue'], 16)
for z in (-.35, -.12, .12, .35): ring((0, -.13, z), .272, .018, C['blue'], major=16, minor=4)
cyl((0, -.13, .356), .25, .01, C['iron'], 16, smooth=False)
cyl((.12, -.13, .37), .035, .03, C['chrome'], 8)
box((0, -.397, 0), (.18, .01, .18), C['hazard'], 0)
box((0, -.403, 0), (.06, .004, .1), C['ink'], 0); box((0, -.403, -.06), (.03, .004, .025), C['ink'], 0)
ball((-.08, -.2, .365), (.11, .1, .02), C['battery'], 10, 4)
ball((-.17, -.36, .3), (.035, .025, .08), C['battery'], 8, 5); ball((-.19, -.37, .2), (.025, .02, .03), C['battery'], 6, 4)
model('Bag12')

# 13 喷气背包: twin chrome tanks with flames out of their nozzles.
straps('iron')
box((0, -.06, 0), (.2, .18, .5), C['orange_paint'], .04)
cyl((0, -.155, .14), .04, .01, C['white'], 12, rot=(math.pi / 2, 0, 0), smooth=False)
box((.012, -.16, .15), (.025, .004, .006), C['red'], 0, rot=(0, .6, 0))
for x in (-.16, .16):
    cyl((x, -.13, .02), .11, .6, C['chrome'], 12)
    ball((x, -.13, .32), (.11, .11, .07), C['chrome'], 12, 6)
    for z in (.15, -.12): ring((x, -.13, z), .112, .012, C['red'], major=12, minor=4)
    cyl((x, -.13, -.33), .07, .08, C['iron'], 10, r2=.09)
    cyl((x, -.13, -.47), .001, .2, C['flame'], 10, r2=.075, slot='glow')
    cyl((x, -.13, -.44), .001, .12, C['flame_core'], 8, r2=.045, slot='glow')
model('Bag13')

# 14 微波炉: a microwave; the ore turns on its plate behind the door glass.
straps('iron')
body = box((0, -.08, 0), (.6, .42, .42), C['microwave'], .03)
cut(body, (-.075, -.3, 0), (.36, .2, .31)); finish(body, C['microwave']); parts['body'].pop()
box((-.075, -.198, 0), (.34, .01, .29), C['drum'], 0)
cyl((-.075, -.24, -.135), .12, .015, C['white'], 14, smooth=False)
box((-.075, -.293, 0), (.34, .01, .29), C['glass_tint'], 0, slot='glass')
box((.2, -.292, 0), (.14, .006, .34), C['iron'], 0)
box((.2, -.297, .11), (.1, .004, .05), C['battery'], 0, slot='glow')
for i in range(6): box((.17 + (i % 2) * .06, -.297, .02 - (i // 2) * .05), (.04, .006, .03), C['steel'], 0)
box((.115, -.31, 0), (.02, .03, .24), C['chrome'], .005)
chunks((-.075, -.24, -.128), .11, .05, .2, ORE, 8, 12, size=.055)
model('Bag14', fill=(-.075, -.24, -.128))

# 15 电池组: a see-through battery; its glowing green bars are the load.
straps('black')
for z in (-.31, .31): box((0, -.1, z), (.46, .4, .08), C['black'], .02)
for x in (-.21, .21):
    for y in (-.28, .08): box((x, y, 0), (.04, .04, .58), C['black'], .005)
box((0, -.1, 0), (.42, .36, .56), C['glass_green'], 0, slot='glass')
for i in range(5): box((0, -.1, -.24 + i * .105), (.34, .28, .085), C['battery'], .01, slot='fill_glow')
cyl((-.12, -.1, .37), .04, .05, C['red'], 10); cyl((.12, -.1, .37), .04, .05, C['iron'], 10)
slab([(-.02, .26), (.06, .26), (.02, .13), (.07, .13), (-.04, -.04), (0, .09), (-.05, .09)], .01, C['lightning'], at=(-.01, -.31, -.38), plane='XZ', slot='glow')
model('Bag15', fill=(0, -.1, -.285))

# 16 机器人背包: a little robot, screen face, antenna light.
straps('iron')
box((0, -.1, -.08), (.5, .4, .44), C['robot_white'], .06)
box((0, -.1, .27), (.4, .34, .26), C['robot_white'], .06)
box((0, -.1, .15), (.16, .2, .04), C['iron'], .01)
box((0, -.272, .27), (.32, .01, .18), C['screen'], .01)
for x in (-.08, .08): box((x, -.279, .29), (.06, .006, .07), C['laser'], .01, slot='glow')
box((0, -.279, .22), (.08, .006, .015), C['laser'], 0, slot='glow')
cyl((0, -.1, .46), .01, .1, C['iron'], 6); ball((0, -.1, .53), (.035, .035, .035), C['red'], 8, 5, slot='glow')
for s in (-1, 1):
    cyl((s * .205, -.1, .27), .05, .04, C['orange_paint'], 10, rot=(0, math.pi / 2, 0))
    cyl((s * .27, -.1, -.06), .04, .24, C['iron'], 8); ball((s * .27, -.1, -.2), (.05, .05, .05), C['orange_paint'], 8, 5)
box((0, -.302, -.08), (.24, .006, .16), C['navy'], 0)
for i, c in enumerate(('battery', 'red', 'hazard')): box((-.07 + i * .07, -.307, -.08), (.04, .006, .04), C[c], 0, slot='glow' if c == 'battery' else 'body')
model('Bag16')

# 17 卫星锅: a backpack with a satellite dish aimed at the sky.
straps('iron')
box((0, -.08, -.1), (.46, .36, .5), C['dish'], .04)
box((0, -.262, -.1), (.4, .006, .08), C['navy'], 0)
box((.15, -.262, .05), (.06, .006, .03), C['battery'], 0, slot='glow')
cyl((0, -.1, .2), .04, .12, C['iron'], 8)
dish = lathe([(0, 0), (.1, .012), (.18, .045), (.24, .09), (.25, .1)], C['dish'], 16, at=(0, -.12, .28), cap=False)
dish.rotation_euler = (-.7, 0, 0); apply(dish)
segment((0, -.12, .29), (0, -.28, .48), .012, .012, C['iron'], 6)
ball((0, -.28, .48), (.035, .035, .035), C['red'], 8, 5, slot='glow')
model('Bag17')

# 18 迷你集装箱: an orange shipping container, doors and lock bars facing back.
straps('container_dark')
box((0, -.1, 0), (.48, .42, .7), C['container'], .015)
for y in [-.28 + .07 * i for i in range(6)]:
    for x in (-.245, .245): box((x, y, 0), (.012, .03, .66), C['container_dark'], 0)
box((0, -.315, 0), (.008, .008, .66), C['container_dark'], 0)
for x in (-.15, -.05, .05, .15): cyl((x, -.322, 0), .01, .64, C['iron'], 6, smooth=False); box((x + .02, -.33, -.05), (.04, .012, .02), C['iron'], 0)
for z in (-.355, .355): box((0, -.1, z), (.5, .44, .03), C['container_dark'], .005)
box((-.12, -.317, .22), (.12, .004, .06), C['white'], 0)
model('Bag18')

# 19 反应堆舱: a glass reactor tube; the glowing fluid inside is the load.
straps('iron')
for z in (-.3, .3): cyl((0, -.06, z), .2, .12, C['iron'], 14)
for z in (-.37, .37): cyl((0, -.06, z), .205, .03, C['hazard'], 14, smooth=False)
cyl((0, -.06, 0), .16, .5, C['glass_green'], 14, slot='glass')
cyl((0, -.06, 0), .14, .48, C['battery'], 14, slot='fill_glow')
for k in range(4): ball((math.cos(k * 1.7) * .07, -.06 + math.sin(k * 1.7) * .07, -.15 + k * .1), (.02, .02, .02), C['white'], 6, 4, slot='fill')
for k in range(3):
    a = math.radians(-90 + 120 * k); cyl((math.cos(a) * .19, -.06 + math.sin(a) * .19, 0), .018, .5, C['chrome'], 6)
tube([(.12, -.06, .36), (.22, -.06, .42), (.28, -.06, .3), (.28, -.06, -.1)], .025, C['chrome'], sides=1)
box((0, -.262, .3), (.08, .006, .06), C['hazard'], 0)
model('Bag19', fill=(0, -.06, -.24))

# 20 火箭: a white rocket with fins, a porthole and a flame below.
straps('iron')
lathe([(.01, -.36), (.17, -.33), (.2, -.1), (.2, .12), (.16, .28), (.08, .38), (.01, .42)],
      lambda p, n: C['red'] if p.z > .25 else C['blue'] if -.06 < p.z < 0 else C['robot_white'], 14, at=(0, -.08, 0))
cyl((0, -.275, .1), .075, .02, C['glass_tint'], 12, rot=(math.pi / 2, 0, 0), slot='glass', smooth=False)
ring((0, -.28, .1), .08, .015, C['chrome'], rot=(math.pi / 2, 0, 0), major=14, minor=4)
for s in (-1, 1): slab([(s * .17, -.05), (s * .32, -.25), (s * .32, -.36), (s * .17, -.3)][::s], .03, C['red'], at=(0, -.08, 0), plane='XZ')
slab([(-.17, -.05), (-.32, -.25), (-.32, -.36), (-.17, -.3)], .03, C['red'], at=(0, -.08, 0), plane='YZ')
cyl((0, -.08, -.39), .1, .08, C['iron'], 12, r2=.07)
cyl((0, -.08, -.53), .001, .2, C['flame'], 12, r2=.085, slot='glow')
cyl((0, -.08, -.5), .001, .12, C['flame_core'], 8, r2=.05, slot='glow')
model('Bag20')

# ---------------------------------------------------------------- BACKPACKS, world 3: fantasy and space
# 21 云朵: a smiling cloud dripping a little rain.
straps('cloud_shade', .1, -.1)
puff = lambda p, n: C['cloud_shade'] if p.z < -.08 else C['white']
for at, sc in (((0, -.12, .05), (.22, .2, .2)), ((-.2, -.12, -.02), (.17, .16, .16)), ((.2, -.12, -.03), (.18, .16, .16)),
               ((-.08, -.12, .18), (.16, .15, .15)), ((.1, -.12, .17), (.15, .14, .14)), ((0, -.12, -.1), (.25, .17, .12))):
    ball(at, sc, puff, 12, 8)
for x in (-.07, .07): ball((x, -.315, .07), (.022, .01, .03), C['ink'], 6, 4)
for x in (-.13, .13): ball((x, -.3, .01), (.035, .01, .02), C['pink'], 6, 4)
box((0, -.318, .0), (.06, .008, .012), C['ink'], 0)
for x, z in ((-.12, -.3), (.05, -.33), (.17, -.28)): ball((x, -.12, z), (.03, .03, .045), C['sky'], 8, 5)
model('Bag21')

# 22 南瓜灯: a jack-o'-lantern whose carved face glows.
straps('green', .14, -.18)
lathe([(.01, -.26), (.2, -.24), (.3, -.1), (.31, .03), (.27, .16), (.15, .24), (.01, .25)],
      lambda p, n: C['pumpkin_dark'] if int((math.atan2(p.y + .12, p.x) + math.pi) / (2 * math.pi) * 16) % 2 else C['pumpkin'], 16, at=(0, -.12, 0), scale=(1, .85, 1))
cyl((0, -.12, .28), .03, .1, C['green'], 6, r2=.02)
slab([(0, 0), (.08, .06), (.16, .04), (.09, -.02)], .015, C['leaf'], at=(0, -.12, .3), plane='XZ')
for x in (-.1, .1): slab([(-.045, 0), (.045, 0), (0, .07)], .03, C['candle'], at=(x, -.37, .05), plane='XZ', slot='glow')
slab([(-.025, 0), (.025, 0), (0, .04)], .03, C['candle'], at=(0, -.385, -.01), plane='XZ', slot='glow')
slab([(-.14, 0), (-.12, -.04), (-.07, -.07), (-.02, -.03), (.03, -.07), (.07, -.03), (.12, -.06), (.14, 0)], .03, C['candle'], at=(0, -.375, -.06), plane='XZ', slot='glow')
model('Bag22')

# 23 蜂巢: a straw beehive with honey dripping and two bees.
straps('honey_dark')
lathe([(.01, -.3), (.24, -.3), (.27, -.15), (.26, 0), (.21, .15), (.12, .26), (.01, .3)],
      lambda p, n: C['honey_dark'] if int((p.z + .3) / .06) % 2 else C['honey'], 14, at=(0, -.12, 0))
cyl((0, -.37, -.2), .06, .03, C['ink'], 12, rot=(math.pi / 2, 0, 0), smooth=False)
ball((.12, -.34, .05), (.05, .03, .04), C['honey'], 8, 5); ball((.13, -.35, -.02), (.025, .02, .04), C['honey'], 6, 4)
for at in ((-.24, -.3, .22), (.26, -.25, .3)):
    x, y, z = at
    ball(at, (.05, .04, .04), C['duck'], 8, 5)
    box((x, y, z), (.02, .085, .085), C['ink'], 0)
    for s in (-1, 1): ball((x + s * .03, y + .01, z + .05), (.035, .01, .025), C['glass_tint'], 6, 4, slot='glass')
model('Bag23')

# 24 水母: a jellyfish; the ore floats inside its see-through bell, glowing tentacles below.
straps('jelly', .14, -.06)
lathe([(.28, -.06), (.3, .04), (.27, .17), (.18, .27), (.01, .31)], C['jelly'], 16, at=(0, -.12, 0), cap=False, slot='glass')
cyl((0, -.12, -.06), .27, .01, C['jelly'], 16, slot='glass', smooth=False)
ring((0, -.12, -.06), .28, .03, C['jelly_glow'], major=20, minor=4, slot='glow')
for x in (-.08, .08): ball((x, -.39, .12), (.02, .012, .025), C['ink'], 6, 4)
for k in range(6):
    a = k * 2 * math.pi / 6 + .3; x0, y0 = math.cos(a) * .19, -.12 + math.sin(a) * .19
    tube([(x0 + .03 * math.sin(i * 1.4 + k), y0, -.07 - i * .07) for i in range(6)], .016, C['jelly_glow'], slot='glow', sides=1)
chunks((0, -.12, -.05), .2, .18, .24, ORE, 10, 14, size=.055)
model('Bag24', fill=(0, -.12, -.05))

# 25 带环星球: a striped planet with a ring and a little moon.
straps('planet', .12, -.12)
ball((0, -.12, 0), (.25, .25, .25), lambda p, n: C['planet_band'] if int((p.z + .3) / .08) % 2 else C['planet'], 16, 10)
o = ring((0, -.12, 0), .38, .045, C['ring_c'], rot=(math.pi / 2 - .4, 0, .3), major=28, minor=4)
for x in (-.08, .08): ball((x, -.36, .05), (.022, .012, .03), C['ink'], 6, 4)
ball((.34, -.2, .3), (.05, .05, .05), C['stone_light'], 8, 5)
for at in ((-.32, -.22, .3), (.3, -.25, -.28)): ball(at, (.02, .02, .02), C['star'], 6, 4, slot='glow')
model('Bag25')

# 26 龙蛋: a red dragon egg, a crack near the top with eyes peeking out.
straps('egg_spot')
lathe([(.01, -.32), (.16, -.29), (.25, -.17), (.27, 0), (.24, .16), (.16, .29), (.01, .36)],
      lambda p, n: C['egg_spot'] if math.sin(p.x * 23) + math.sin(p.z * 19 + 1) + math.sin(p.y * 17) > 1.4 else C['egg_red'], 14, at=(0, -.12, 0))
ball((0, -.35, .15), (.1, .03, .05), C['ink'], 10, 5)
for x in (-.035, .035): ball((x, -.375, .155), (.015, .01, .015), C['flame_core'], 6, 4, slot='glow')
for x in (-.05, .05): cyl((x, -.12, .37), .025, .07, C['bone'], 6, r2=0)
ring((0, -.12, -.28), .2, .05, C['wicker'], major=16, minor=4)
model('Bag26')

# 27 魔法书: a big spell book, a glowing gem on its cover.
straps('book')
box((0, -.02, 0), (.5, .04, .62), C['book'], .01)
box((.01, -.1, 0), (.47, .14, .58), C['page'], .005)
box((-.25, -.1, 0), (.04, .2, .62), C['book'], .01)
box((0, -.19, 0), (.5, .04, .62), C['book'], .01)
for x in (-.22, .22):
    for z in (-.28, .28): box((x, -.212, z), (.07, .01, .07), C['gold'], .003)
ball((0, -.215, .03), (.07, .03, .09), C['void'], 6, 4, slot='glow', smooth=False)
ring((0, -.212, .03), .1, .012, C['gold'], rot=(math.pi / 2, 0, 0), major=16, minor=4)
box((.255, -.1, 0), (.03, .22, .08), C['leather'], .005)
box((.1, -.1, -.34), (.03, .02, .1), C['red'], 0)
for at in ((.3, -.25, .3), (-.32, -.2, .2), (.28, -.22, -.25)): ball(at, (.02, .02, .02), C['star'], 6, 4, slot='glow')
model('Bag27')

# 28 沙漏: an hourglass; the sand heaping in its lower bulb is the load.
straps('wood_dark')
for z in (-.33, .33): cyl((0, -.12, z), .22, .05, C['wood_dark'], 12)
for k in range(3):
    a = math.radians(90 + 120 * k); cyl((math.cos(a) * .19, -.12 + math.sin(a) * .19, 0), .02, .62, C['gold'], 6)
lathe([(.03, 0), (.1, .04), (.17, .12), (.18, .2), (.14, .28), (.02, .3)], C['glass_tint'], 14, at=(0, -.12, 0), cap=False, slot='glass')
lathe([(.02, -.3), (.14, -.28), (.18, -.2), (.17, -.12), (.1, -.04), (.03, 0)], C['glass_tint'], 14, at=(0, -.12, 0), cap=False, slot='glass')
lathe([(.02, .05), (.13, .16), (.15, .19), (.0, .19)], C['sand_gold'], 12, at=(0, -.12, 0))
cyl((0, -.12, -.14), .008, .28, C['sand_gold'], 6)
lathe([(.16, 0), (.15, .05), (.09, .12), (.01, .16)], C['sand_gold'], 12, at=(0, -.12, -.29), slot='fill')
for k in range(4): box((math.cos(k * 1.6) * .08, -.12 + math.sin(k * 1.6) * .08, -.27 + .02 * k), (.03, .03, .03), ORE[k], 0, rot=(k, k * .5, 0), slot='fill')
model('Bag28', fill=(0, -.12, -.29))

# 29 迷你传送门: a stone ring around a swirling portal.
straps('portal_rim', .14, -.2)
ring((0, -.12, .02), .27, .07, C['portal_rim'], rot=(math.pi / 2, 0, 0), major=20, minor=6)
for k in range(6):
    a = k * math.pi / 3; box((math.cos(a) * .27, -.195, .02 + math.sin(a) * .27), (.05, .02, .05), C['void'], 0, rot=(0, -a, 0), slot='glow')
box((0, -.12, -.33), (.3, .2, .06), C['stone'], .01)
cyl((0, -.12, .02), .22, .02, C['portal'], 20, rot=(math.pi / 2, 0, 0), slot='a_glow', smooth=False)
for y in (-.135, -.105):
    tube([(math.cos(t * 6) * (.02 + .18 * t), y, .02 + math.sin(t * 6) * (.02 + .18 * t)) for t in (i / 20 for i in range(21))], .012, C['jelly_glow'], slot='a_glow')
model('Bag29', spins=[('a', (0, -.12, .02), 'Y')])

# 30 黑洞罐: a black hole in a jar; the ore it has caught settles on the bottom.
straps('gold', .1, -.24)
lathe([(.2, -.3), (.23, -.25), (.24, .15), (.2, .24), (.16, .27), (.16, .3)], C['glass_tint'], 16, at=(0, -.1, 0), slot='glass')
cyl((0, -.1, .33), .18, .06, C['gold'], 14); ball((0, -.1, .37), (.04, .04, .025), C['gold'], 8, 4)
box((0, -.315, .22), (.14, .006, .05), C['page'], 0)
ball((0, -.1, .08), (.08, .08, .08), C['void_black'], 10, 6)
ring((0, -.1, .08), .14, .02, C['void'], rot=(.5, 0, 0), major=18, minor=4, slot='a_glow')
ring((0, -.1, .08), .105, .012, C['jelly_glow'], rot=(.5, 0, 0), major=16, minor=4, slot='a_glow')
chunks((0, -.1, -.29), .2, .18, .2, ORE, 10, 13, size=.05)
model('Bag30', fill=(0, -.1, -.29), spins=[('a', (0, -.1, .08), (.5, 0, 0))])

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
print(json.dumps({'models': len(report), 'triangles': {r['node']: r['triangles'] for r in report}}, ensure_ascii=False))
