"""New metric courtyard for the Mining light/material study.

Run from any directory: blender -b --python tools/blender/build_courtyard.py
All coordinates below are Three.js Y-up metres. No source assets are imported.
The restrained geometry intentionally leaves broad light-catching surfaces.
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

NAMES = ('limestone', 'sandstone', 'plaster_blue', 'plaster_ivory', 'wood',
         'painted_wood', 'iron', 'brass', 'lampglass', 'terracotta', 'soil', 'leaf')
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


def mesh(name, vertices, faces, material, bevel=0, grain=(1, 0, 0)):
    data = bpy.data.meshes.new(name + '_geometry')
    data.from_pydata([P(v) for v in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATERIALS[material])
    obj['material_role'] = material
    obj['metric_uv'] = '1 unit = 1 metre; U follows long grain on wood'
    obj['grain_axis_y_up'] = list(grain)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    # Recalculate the closed shell before beveling; no imported normals/models.
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    if bevel:
        mod = obj.modifiers.new('Real light-catching edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = .6
        mod.affect = 'EDGES'
        mod.use_clamp_overlap = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Authored UVs after beveling: every bevel also has finite, metric UV area.
    data = obj.data
    uv = data.uv_layers.new(name='MetricUV')
    grain = Vector(grain)
    for face in data.polygons:
        normal = Q(face.normal).normalized()
        if material in ('wood', 'painted_wood'):
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


def box(name, center, size, material, bevel=.018, grain=None):
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


def chipped_paver(name, a, b, z0, z1):
    # Three deliberately placed shallow corner losses, not random edge noise.
    # Bottom remains rectangular, so the fractured triangular face takes light.
    chip=.085
    vertices=[(a,.05,z0),(b,.05,z0),(b,.05,z1),(a,.05,z1),
              (a,.16,z0),(b-chip,.16,z0),(b,.16,z0+chip),(b,.16,z1),(a,.16,z1)]
    faces=[(3,2,1,0),(4,5,6,7,8),(0,4,5,1),(1,6,7,2),
           (2,7,8,3),(3,8,4,0),(1,5,6)]
    return mesh(name,vertices,faces,'limestone',.02)


def lathe(name, center, profile, material, sides=16):
    x, y, z = center
    vertices = [(x+r*math.cos(2*math.pi*i/sides), y+h, z+r*math.sin(2*math.pi*i/sides))
                for r,h in profile for i in range(sides)]
    faces = [tuple(reversed(range(sides)))]
    for j in range(len(profile)-1):
        for i in range(sides):
            n = (i+1)%sides
            faces.append((j*sides+i, j*sides+n, (j+1)*sides+n, (j+1)*sides+i))
    faces.append(tuple(range((len(profile)-1)*sides, len(profile)*sides)))
    return mesh(name, vertices, faces, material)


def cut_wall(name, xs, ys, z0, z1, holes, material):
    """A single manifold shell with true holes, no overlay or Boolean scars."""
    cells = set()
    for i in range(len(xs)-1):
        for j in range(len(ys)-1):
            cx,cy = (xs[i]+xs[i+1])/2, (ys[j]+ys[j+1])/2
            if not any(a < cx < b and c < cy < d for a,b,c,d in holes):
                cells.add((i,j))
    vertices, faces, index = [], [], {}
    def vertex(point):
        if point not in index:
            index[point] = len(vertices)
            vertices.append(point)
        return index[point]
    def face(points):
        faces.append(tuple(vertex(p) for p in points))
    for i,j in sorted(cells):
        a,b,c,d=xs[i],xs[i+1],ys[j],ys[j+1]
        face([(a,c,z0),(a,d,z0),(b,d,z0),(b,c,z0)])
        face([(a,c,z1),(b,c,z1),(b,d,z1),(a,d,z1)])
        if (i-1,j) not in cells: face([(a,c,z0),(a,c,z1),(a,d,z1),(a,d,z0)])
        if (i+1,j) not in cells: face([(b,c,z0),(b,d,z0),(b,d,z1),(b,c,z1)])
        if (i,j-1) not in cells: face([(a,c,z0),(b,c,z0),(b,c,z1),(a,c,z1)])
        if (i,j+1) not in cells: face([(a,d,z0),(a,d,z1),(b,d,z1),(b,d,z0)])
    return mesh(name,vertices,faces,material,.025)


# Patio: discrete broad masonry, true 4 cm joints and 9 cm recess. No dark
# lines painted onto an otherwise flat floor. Low foundation closes all sides.
box('Courtyard_foundation', (0,-.085,1.5), (12,.31,9), 'sandstone', .06)
gap, row_depth, slab_width = .04, .9, 1.34
floor_count = 0
for row in range(10):
    z0,z1 = -3+row*row_depth+gap/2, -3+(row+1)*row_depth-gap/2
    offset = -.67 if row%2 else 0
    edges = sorted(set([-6,6]+[round(-6+offset+k*slab_width,5) for k in range(11)
                                      if -6 < -6+offset+k*slab_width < 6]))
    for col,(left,right) in enumerate(zip(edges[:-1],edges[1:])):
        a,b=left+gap/2,right-gap/2
        if b-a < .08:
            continue
        name=f'Paving_row_{row:02d}_stone_{col:02d}'
        if (row,col) in ((3,3),(5,6),(8,4)):
            chipped_paver(name+'_small_corner_chip',a,b,z0,z1)
        else:
            box(name, ((a+b)/2,.105,(z0+z1)/2),
                (b-a,.11,z1-z0), 'limestone', .025)
        floor_count+=1

# Back wall grows above the stone plinth. Openings go all the way through.
cut_wall('Blue_plaster_wall', [-4.8,-2.15,-.65,1.875,3.525,4.8],
         [.71,1.50,2.75,2.86,3.96], -3.025,-2.575,
         [(-2.15,-.65,1.50,2.75),(1.875,3.525,.70,2.86)], 'plaster_blue')
box('Ivory_return_wall', (-4.8,2.335,-.60), (.45,3.25,4.4), 'plaster_ivory', .025)

# Two solid courses of warm stone; broad cap joints create readable scale.
# Front plinth stops at the door opening. Left corner is an exact butt joint.
for y in (.2975,.5725):
    for lo,hi,tag in ((-4.49,1.875,'left'),(3.525,4.95,'right')):
        width=hi-lo
        count=max(1,round(width/1.25))
        for i in range(count):
            a,b=lo+i*width/count,lo+(i+1)*width/count
            box(f'Back_plinth_{tag}_{y}_{i}', ((a+b)/2,y,-2.8),
                (b-a-.018,.263,.62), 'sandstone', .018)
    for i in range(4):
        a=-3.11+i*4.82/4
        box(f'Return_plinth_{y}_{i}',(-4.8,y,a+4.82/8),(.62,.263,4.82/4-.018),'sandstone',.018)

# Copings with generous overhang, no repeated small-brick noise.
for i in range(7):
    a=-4.46+i*9.49/7
    box(f'Blue_wall_coping_{i}',(a+9.49/14,4.055,-2.8),(9.49/7-.022,.22,.68),'sandstone',.035)
for i in range(4):
    a=-3.14+i*4.90/4
    box(f'Ivory_wall_coping_{i}',(-4.8,4.055,a+4.90/8),(.68,.22,4.90/4-.022),'sandstone',.035)

# Door: deep opening, visible thick reveals, substantial timber surround.
for side in (-1,1):
    box(f'Door_jamb_{side}', (2.7+side*.825,1.56,-2.55),(.23,2.8,.32),'wood',.035)
box('Door_lintel',(2.7,2.91,-2.54),(2.12,.30,.42),'wood',.035)
box('Door_threshold',(2.7,.225,-2.53),(1.85,.13,.66),'sandstone',.025)
# Backing overlaps the aperture edges by 1 cm: the recessed front planks must
# not expose daylight between their narrow face and the shallower casing.
box('Door_leaf_back',(2.7,1.51,-2.89),(1.67,2.72,.10),'painted_wood',.008)
for i in range(5):
    box(f'Door_vertical_plank_{i}',(2.7+(i-2)*.281,1.50,-2.80),(.271,2.50,.10),'painted_wood',.012)
for y in (.57,2.40):
    box(f'Door_wood_batten_{y}',(2.7,y,-2.715),(1.42,.16,.09),'wood',.016)
box('Door_handle_plate',(3.16,1.36,-2.71),(.13,.23,.045),'iron',.012)
box('Door_brass_handle',(3.16,1.36,-2.64),(.055,.15,.09),'brass',.014)

# Recessed shutter opening. Cross-frame and sill get genuine warm highlights.
for side in (-1,1):
    box(f'Window_outer_jamb_{side}',(-1.4+side*.76,2.125,-2.54),(.20,1.49,.24),'wood',.025)
box('Window_outer_lintel',(-1.4,2.81,-2.54),(1.90,.22,.30),'wood',.025)
box('Window_stone_sill',(-1.4,1.47,-2.45),(1.98,.19,.65),'sandstone',.03)
box('Window_shutter_back',(-1.4,2.125,-2.96),(1.52,1.27,.10),'painted_wood',.008)
for i in range(4):
    box(f'Window_shutter_board_{i}',(-1.4+(i-1.5)*.321,2.125,-2.885),(.310,1.17,.06),'painted_wood',.012)
for y in (1.73,2.52):
    box(f'Window_shutter_crossrail_{y}',(-1.4,y,-2.825),(1.31,.105,.06),'wood',.012)

# Short bench, facing into the courtyard. Chunky seat and back catch bands of
# light without becoming a wire-like detail network.
for x in (-4.33,-3.74):
    for z in (-.90,1.02):
        box(f'Bench_leg_{x}_{z}',(x,.405,z),(.17,.49,.19),'wood',.023)
for i in range(3):
    box(f'Bench_seat_plank_{i}',(-4.31+i*.28,.715,.06),(.26,.13,2.40),'wood',.025)
for z in (-.91,1.03):
    box(f'Bench_back_post_{z}',(-4.36,.93,z),(.12,1.08,.14),'wood',.02)
for y in (1.04,1.32):
    box(f'Bench_back_board_{y}',(-4.30,y,.06),(.13,.22,2.42),'wood',.022)

# Single wall lantern: clear silhouette, opaque emissive glass role at runtime.
# Runtime light should sit just ahead of the glass, not inside opaque geometry.
LAMP_CENTER = (.90,2.72,-2.03)
LAMP_LIGHT = (.90,2.73,-1.74)
box('Lantern_wall_plate',(.90,3.10,-2.50),(.20,.35,.10),'iron',.024)
beam('Lantern_bracket',(.90,3.20,-2.49),(.90,3.20,-2.03),.065,.065,'iron',.009)
beam('Lantern_bracket_brace',(.90,2.99,-2.49),(.90,3.20,-2.14),.045,.045,'iron',.007)
box('Lantern_hanger',(.90,3.095,-2.03),(.055,.20,.055),'iron',.007)
box('Lantern_glass',LAMP_CENTER,(.34,.48,.34),'lampglass',.014)
for dx in (-.19,.19):
    for dz in (-.19,.19):
        box(f'Lantern_post_{dx}_{dz}',(.90+dx,2.72,-2.03+dz),(.045,.56,.045),'iron',.006)
box('Lantern_base',(.90,2.42,-2.03),(.48,.08,.48),'iron',.018)
lathe('Lantern_roof',(.90,2.995,-2.03),[(.34,0),(.34,.045),(.07,.23),(.045,.26)],'iron',4)

# A pair of restrained pots. Seven thick blades are a single broad accent,
# not a dense fine-leaf canopy that competes with the material sample.
profile=[(.27,0),(.37,.10),(.45,.48),(.39,.79),(.44,.81),(.44,.93),
         (.34,.93),(.34,.82),(.31,.72),(.25,.16)]
lathe('Large_terracotta_pot',(4.18,.16,-1.47),profile,'terracotta')
lathe('Large_pot_soil',(4.18,.89,-1.47),[(.305,0),(.305,.045)],'soil')

def broad_leaf(name, angle, length, bend, width):
    side=Vector((math.cos(angle),0,math.sin(angle)))
    across=Vector((-math.sin(angle),0,math.cos(angle)))
    root=Vector((4.18,.93,-1.47))
    # Four low-poly sections, thick closed blade. The apex has nonzero width.
    vertices=[]
    for t,w in ((0,.08),(.33,width),(.72,width*.73),(1,.015)):
        center=root+side*(bend*t*t)+Vector((0,length*(t-.24*t*t),0))
        for sign,thick in ((-1,-.018),(1,-.018),(1,.018),(-1,.018)):
            vertices.append(tuple(center+across*(w*sign)+Vector((0,thick,0))))
    faces=[(0,3,2,1),(12,13,14,15)]
    for k in range(3):
        for j in range(4): faces.append((4*k+j,4*k+(j+1)%4,4*(k+1)+(j+1)%4,4*(k+1)+j))
    mesh(name,vertices,faces,'leaf')

for i in range(7):
    broad_leaf(f'Plant_broad_leaf_{i}',i*2.399,1.00+(i%3)*.18,.48+(i%2)*.22,.13+(i%2)*.025)
lathe('Small_terracotta_pot',(-3.73,.16,1.94),[(r*.63,h*.63) for r,h in profile],'terracotta',14)

# Deterministic validation of source geometry including every beveled UV.
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
        if face.normal.length < .999: errors.append(obj.name+': invalid normal')
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
    mesh_stats.append({'name':obj.name,'material':obj['material_role'],'triangles':count})
if errors:
    raise RuntimeError('\n'.join(errors[:30]))

bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene['authorship']='New Blender courtyard authored for the light/material study. No imported geometry.'
bpy.context.scene['lamp_center_y_up']=list(LAMP_CENTER)
bpy.context.scene['suggested_light_position_y_up']=list(LAMP_LIGHT)
SOURCE=ROOT/'source-art/courtyard.blend'
GLB=ROOT/'public/assets/courtyard.glb'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',export_yup=True,
                          export_texcoords=True,export_normals=True,export_materials='EXPORT',
                          export_extras=True,export_cameras=False,export_lights=False)
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
SCRIPT=Path(__file__).resolve()
manifest={
    'title':'New chunky courtyard geometry for directional light and material study',
    'generator':'Blender '+bpy.app.version_string,
    'source':str(SOURCE.relative_to(ROOT)), 'sourceSha256':sha(SOURCE),
    'script':str(SCRIPT.relative_to(ROOT)), 'scriptSha256':sha(SCRIPT),
    'resource':str(GLB.relative_to(ROOT)), 'resourceSha256':sha(GLB),
    'resourceBytes':GLB.stat().st_size, 'tripoTaskId':None,
    'authorship':'Original modeled geometry. No old models, no decimation, no imported textures.',
    'triangles':sum(totals.values()), 'trianglesByMaterial':dict(sorted(totals.items())),
    'meshes':len(SOURCE_OBJECTS), 'pavingSlabs':floor_count,
    'bounds':{'min':[round(min(p[i] for p in all_points),5) for i in range(3)],
              'max':[round(max(p[i] for p in all_points),5) for i in range(3)]},
    'coordinateSystem':'glTF / Three.js Y-up metres',
    'textureDimensions':{}, 'textures':'No image textures in GLB; runtime material maps supplied separately.',
    'uv':{'scale':'1 UV unit = 1 metre','stonePlaster':'Orthogonal world-coordinate face projection after beveling',
          'wood':'U follows each board/member long axis; V is perpendicular surface direction',
          'bevels':'Finite metric UV projection on every bevel face'},
    'whiteMaterialNames':list(NAMES), 'vertexColors':False,
    'lampCenter':list(LAMP_CENTER),'suggestedLampLight':list(LAMP_LIGHT),
    'lampNote':'Runtime emissive glass should not cast shadows; light is 0.29m in front of glass center.',
    'dimensions':{'patio':[12,9],'pavingTop':.16,'pavingJoint':.04,'pavingBevel':.025,
                  'jointRecess':.09,'wallHeightAboveFloor':3.8,'wallThickness':.45,
                  'backWallX':[-4.8,4.8],'backWallZ':-2.8,'doorOpening':[1.65,2.7],
                  'windowOpening':[1.5,1.25]},
    'validation':{'finiteVertices':True,'finiteUnitNormals':True,'zeroAreaTriangles':0,
                  'invalidUvTriangles':0,'nonManifoldMeshes':0,'closedBacksAndSides':True},
    'meshStats':mesh_stats,
}
(ROOT/'artifacts/courtyard-asset.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ('resource','resourceSha256','triangles','meshes','bounds','validation')},indent=2))
