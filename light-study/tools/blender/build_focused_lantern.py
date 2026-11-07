"""Original chunky freestanding lantern for the light-study focused-light variant.

Run: blender -b --python tools/blender/build_focused_lantern.py
All design coordinates use Three.js Y-up metres. No source geometry is imported.
Metric UV construction follows the study's authored courtyard helper convention.
"""
import bpy
import bmesh
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
for folder in ('public/assets', 'source-art', 'artifacts'):
    (ROOT / folder).mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for mat in list(bpy.data.materials):
    bpy.data.materials.remove(mat)

NAMES = ('iron', 'wood', 'sandstone', 'lampglass')
MATERIALS = {}
for name in NAMES:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
    shader.inputs['Roughness'].default_value = .8
    MATERIALS[name] = material

P = lambda v: (v[0], -v[2], v[1])
Q = lambda v: Vector((v.x, v.z, -v.y))
SOURCE_OBJECTS = []
LAMP_CENTER = (-2.65, 2.75, -.45)
POST_X, POST_Z = -3.15, -1.30


def mesh(name, vertices, faces, material, bevel=0, grain=(1, 0, 0)):
    data = bpy.data.meshes.new(name + '_geometry')
    data.from_pydata([P(v) for v in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATERIALS[material])
    obj['material_role'] = material
    obj['metric_uv'] = '1 unit = 1 metre; U follows grain on wood'
    obj['grain_axis_y_up'] = list(grain)
    obj['shadow_role'] = ('emissive_no_shadow' if '_glass' in name else
                          'enclosure_exclude_own_lamp_shadow' if '_cage_' in name else
                          'structural_shadow_caster')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    if bevel:
        mod = obj.modifiers.new('Authored light-catching edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = .6
        mod.affect = 'EDGES'
        mod.use_clamp_overlap = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    data = obj.data
    uv = data.uv_layers.new(name='MetricUV')
    grain = Vector(grain)
    for face in data.polygons:
        normal = Q(face.normal).normalized()
        if material == 'wood':
            u = grain - normal * grain.dot(normal)
            if u.length_squared < .01:
                seed = Vector((0, 1, 0)) if abs(normal.y) < .9 else Vector((1, 0, 0))
                u = seed - normal * seed.dot(normal)
            u.normalize()
        else:
            seed = Vector((0, 0, -1)) if abs(normal.x) > .707 else Vector((1, 0, 0))
            u = (seed - normal * seed.dot(normal)).normalized()
        v = normal.cross(u).normalized()
        for loop in face.loop_indices:
            co = Q(data.vertices[data.loops[loop].vertex_index].co)
            uv.data[loop].uv = (co.dot(u), co.dot(v))
        face.use_smooth = False
    obj.select_set(False)
    SOURCE_OBJECTS.append(obj)
    return obj


def box(name, center, size, material, bevel=.016, grain=None):
    x, y, z = center
    a, b, c = [n / 2 for n in size]
    vertices = [(x-a, y-b, z-c), (x+a, y-b, z-c), (x+a, y+b, z-c), (x-a, y+b, z-c),
                (x-a, y-b, z+c), (x+a, y-b, z+c), (x+a, y+b, z+c), (x-a, y+b, z+c)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
             (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5)]
    if grain is None:
        axis = max(range(3), key=lambda i: size[i])
        grain = tuple(1 if i == axis else 0 for i in range(3))
    return mesh(name, vertices, faces, material, bevel, grain)


def beam(name, a, b, width, depth, material, bevel=.014):
    a, b = Vector(a), Vector(b)
    along = (b-a).normalized()
    seed = Vector((0, 1, 0)) if abs(along.y) < .9 else Vector((1, 0, 0))
    u = along.cross(seed).normalized()
    v = along.cross(u).normalized()
    vertices = [tuple(p + u*s*width/2 + v*t*depth/2)
                for p in (a, b) for s, t in ((-1,-1), (1,-1), (1,1), (-1,1))]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7)]
    faces += [(i, (i+1)%4, (i+1)%4+4, i+4) for i in range(4)]
    return mesh(name, vertices, faces, material, bevel, along)


# Square sandstone footing, capped with a generous bevel. It leaves a clear
# walking gap beside the bench and accepts warm light without a blue base tint.
box('Focused_lantern_post_stone_foot', (POST_X,.30,POST_Z), (.62,.28,.62), 'sandstone', .035)
box('Focused_lantern_post_stone_cap', (POST_X,.47,POST_Z), (.52,.10,.52), 'sandstone', .025)
# Broad timber upright and collars. Neither tiny ornaments nor leaflike detail.
box('Focused_lantern_post_wood_upright', (POST_X,1.90,POST_Z), (.25,2.84,.25), 'wood', .025)
box('Focused_lantern_post_iron_bottom_collar', (POST_X,.64,POST_Z), (.29,.18,.29), 'iron', .014)
box('Focused_lantern_post_iron_top_collar', (POST_X,3.20,POST_Z), (.30,.20,.30), 'iron', .014)
# The arm projects diagonally into the courtyard rather than along the wall.
beam('Focused_lantern_post_iron_arm', (POST_X,3.32,POST_Z), (-2.65,3.32,-.45), .16,.16,'iron',.018)
beam('Focused_lantern_post_iron_brace', (POST_X,2.91,POST_Z), (-2.84,3.30,-.77), .11,.11,'iron',.012)
box('Focused_lantern_cage_hanger', (-2.65,3.21,-.45), (.11,.26,.11), 'iron', .012)

# A squat square lantern has a broad glowing core and readable thick corners.
# Opaque glass emission is assigned by the runtime material library; no blend.
box('Focused_lantern_glass', LAMP_CENTER, (.44,.50,.44), 'lampglass', .018)
for sx in (-1,1):
    for sz in (-1,1):
        box(f'Focused_lantern_cage_corner_{sx}_{sz}',
            (-2.65+sx*.2475,2.75,-.45+sz*.2475),(.065,.61,.065),'iron',.009)
box('Focused_lantern_cage_bottom', (-2.65,2.425,-.45), (.62,.11,.62), 'iron', .018)
box('Focused_lantern_cage_top_rim', (-2.65,3.065,-.45), (.64,.11,.64), 'iron', .018)
# A closed low hip roof retains a chunky silhouette from all orbit angles.
x,y,z=-2.65,3.12,-.45
vertices=[(x-.31,y,z-.31),(x+.31,y,z-.31),(x+.31,y,z+.31),(x-.31,y,z+.31),
          (x-.105,y+.14,z-.105),(x+.105,y+.14,z-.105),
          (x+.105,y+.14,z+.105),(x-.105,y+.14,z+.105)]
faces=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
mesh('Focused_lantern_cage_roof',vertices,faces,'iron',.012)

# Validate every closed shell, finite metric UV, triangle area and unit normal.
totals=Counter()
errors=[]
all_points=[]
mesh_stats=[]
for obj in SOURCE_OBJECTS:
    data=obj.data
    data.calc_loop_triangles()
    uv=data.uv_layers.active.data
    for vertex in data.vertices:
        if not all(math.isfinite(n) for n in vertex.co): errors.append(obj.name+': nonfinite vertex')
        all_points.append(Q(vertex.co))
    for face in data.polygons:
        if not all(math.isfinite(n) for n in face.normal) or abs(face.normal.length-1) > 1e-5:
            errors.append(obj.name+': invalid normal')
    for tri in data.loop_triangles:
        a,b,c=[data.vertices[i].co for i in tri.vertices]
        if (b-a).cross(c-a).length < 1e-10: errors.append(obj.name+': zero-area triangle')
        p,q,r=[uv[i].uv for i in tri.loops]
        area=(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x)
        if not all(math.isfinite(n) for v in (p,q,r) for n in v) or abs(area)<1e-10:
            errors.append(obj.name+': invalid UV triangle')
    bm=bmesh.new(); bm.from_mesh(data)
    if any(not edge.is_manifold for edge in bm.edges): errors.append(obj.name+': nonmanifold edge')
    bm.free()
    count=len(data.loop_triangles)
    totals[obj['material_role']]+=count
    mesh_stats.append({'name':obj.name,'material':obj['material_role'],'triangles':count,
                       'shadowRole':obj['shadow_role']})
if sum(totals.values()) >= 3000: errors.append('Triangle budget exceeded')
if errors:
    raise RuntimeError('\n'.join(errors[:30]))

bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene['authorship']='Original focused-light lantern. No imported geometry or decimation.'
bpy.context.scene['lamp_center_y_up']=list(LAMP_CENTER)
bpy.context.scene['suggested_light_position_y_up']=list(LAMP_CENTER)
SOURCE=ROOT/'source-art/focused-lantern.blend'
GLB=ROOT/'public/assets/focused-lantern.glb'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',export_yup=True,
                          export_texcoords=True,export_normals=True,export_materials='EXPORT',
                          export_extras=True,export_cameras=False,export_lights=False)
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
SCRIPT=Path(__file__).resolve()
manifest={
    'title':'Original freestanding chunky lantern for focused courtyard light',
    'generator':'Blender '+bpy.app.version_string,
    'source':str(SOURCE.relative_to(ROOT)), 'sourceSha256':sha(SOURCE),
    'script':str(SCRIPT.relative_to(ROOT)), 'scriptSha256':sha(SCRIPT),
    'resource':str(GLB.relative_to(ROOT)), 'resourceSha256':sha(GLB),
    'resourceBytes':GLB.stat().st_size, 'tripoTaskId':None,
    'authorship':'New Blender-authored geometry. No imported model, no decimation, no imported texture.',
    'triangles':sum(totals.values()), 'trianglesByMaterial':dict(sorted(totals.items())),
    'meshes':len(SOURCE_OBJECTS),
    'bounds':{'min':[round(min(p[i] for p in all_points),5) for i in range(3)],
              'max':[round(max(p[i] for p in all_points),5) for i in range(3)]},
    'coordinateSystem':'glTF / Three.js Y-up metres',
    'textureDimensions':{}, 'textureCount':0,
    'textures':'No own textures. Use existing runtime material library by exact material name.',
    'uv':{'scale':'1 UV unit = 1 metre','stoneIronGlass':'Orthogonal metric face projection after beveling',
          'wood':'U follows upright grain; V is perpendicular surface direction',
          'bevels':'Finite metric UV projection on every bevel face'},
    'whiteMaterialNames':list(NAMES), 'vertexColors':False,
    'lampCenter':list(LAMP_CENTER),'suggestedLampLight':list(LAMP_CENTER),
    'lampNote':'Opaque emissive glass casts no shadow. Exclude cage pieces from own point-light shadow; post/foot/arm cast shadows.',
    'dimensions':{'foot':[.62,.28,.62], 'pavingTop':.16,
                  'postCenterXZ':[POST_X,POST_Z], 'glass':[.44,.50,.44],
                  'armTop':3.40},
    'validation':{'finiteVertices':True,'finiteUnitNormals':True,'zeroAreaTriangles':0,
                  'invalidUvTriangles':0,'nonManifoldMeshes':0,'closedBacksAndSides':True},
    'meshStats':mesh_stats,
}
(ROOT/'artifacts/focused-lantern-asset.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ('resource','resourceSha256','triangles','meshes','bounds','validation')},indent=2))
