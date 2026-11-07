"""Metric primitive authoring helpers for new district geometry; no model imports.

Run from any directory: blender -b --python tools/blender/build_street.py
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
         'painted_wood', 'iron', 'brass', 'lampglass', 'terracotta', 'soil', 'leaf', 'roof', 'canvas_red', 'canvas_cream', 'windowglass', 'plaster_rose')
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
    if bevel:
        edges=[edge for edge in bm.edges if edge.is_manifold and edge.calc_face_angle()>.6]
        bmesh.ops.bevel(bm,geom=edges,offset=bevel,segments=2,profile=.5,affect='EDGES',clamp_overlap=True)
        # Bevel intersections at collinear window-grid corners can leave
        # coincident vertices. Weld numerical duplicates, preserving the shape.
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
        bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-7)
    bm.normal_update()
    bm.to_mesh(data)
    bm.free()
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
    colors=data.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='POINT')
    h=2166136261
    for c in name:h=((h^ord(c))*16777619)&0xffffffff
    varied=name.startswith(('Paving_','Sidewalk_','Curb_'))
    value=.69+((h>>8)&65535)/65535*.43 if varied else 1
    warmth=(h&255)/255-.5 if varied else 0
    tint=(value*(1+.11*warmth),value*(1+.025*warmth),value*(1-.13*warmth),1)
    for color in colors.data:color.color=tint
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




def transform_group(start, origin, angle):
    c,s=math.cos(angle),math.sin(angle)
    for obj in SOURCE_OBJECTS[start:]:
        for v in obj.data.vertices:
            x,y,z=Q(v.co)
            v.co=P((origin[0]+c*x+s*z,origin[1]+y,origin[2]-s*x+c*z))
        obj.data.update()


def door(prefix,x):
    box(prefix+'_back',(x,1.60,-.22),(1.28,2.58,.14),'painted_wood',.015)
    for i in range(5):box(prefix+f'_board_{i}',(x+(i-2)*.232,1.61,-.11),(.22,2.45,.08),'painted_wood',.01)
    for y in (.65,2.48):box(prefix+f'_rail_{y}',(x,y,-.035),(1.24,.15,.12),'wood',.014)
    for dx in (-.73,.73):box(prefix+f'_jamb_{dx}',(x+dx,1.64,.10),(.19,2.78,.32),'wood',.025)
    box(prefix+'_lintel',(x,3.02,.12),(1.75,.25,.38),'wood',.026)
    box(prefix+'_threshold',(x,.29,.30),(1.65,.14,.80),'sandstone',.028)
    box(prefix+'_handle',(x+.39,1.50,.035),(.06,.15,.12),'brass',.012)


def window(prefix,x,y,width,height,glowing=True):
    box(prefix+'_recess',(x,y,-.24),(width+.04,height+.04,.12),'wood',.008)
    box(prefix+'_pane',(x,y,-.155),(width-.12,height-.12,.025),'windowglass' if glowing else 'painted_wood',.005)
    for dx in (-width/2,width/2):box(prefix+f'_jamb_{dx}',(x+dx,y,.06),(.16,height+.24,.25),'wood',.02)
    for dy in (-height/2,height/2):box(prefix+f'_rail_{dy}',(x,y+dy,.07),(width+.34,.17,.28),'wood',.022)
    box(prefix+'_sill',(x,y-height/2-.08,.22),(width+.52,.17,.63),'sandstone',.025)
    for dx in (-width/6,width/6):box(prefix+f'_mullion_{dx}',(x+dx,y,-.06),(.085,height,.10),'wood',.01)
    box(prefix+'_transom',(x,y+.10,-.04),(width,.08,.12),'wood',.01)


def roof(prefix,width,depth,eaves,peak):
    for side in (-1,1):
        x=side*(width/2+.38)
        # A separate thick sloping slab on each side of the roof ridge.
        verts=[(0,peak,.38),(x,eaves,.38),(x,eaves,-depth-.38),(0,peak,-depth-.38)]
        verts += [(a,b-.14,c) for a,b,c in verts]
        mesh(prefix+f'_slope_{side}',verts,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'roof',.018)
        beam(prefix+f'_fascia_{side}',(0,peak,.43),(x,eaves,.43),.18,.20,'wood',.02)
        beam(prefix+f'_back_fascia_{side}',(0,peak,-depth-.4),(x,eaves,-depth-.4),.16,.17,'wood',.02)
        for k in range(1,7):
            t=k/7
            beam(prefix+f'_tile_course_{side}_{k}',(x*t,peak+(eaves-peak)*t+.025,.38),(x*t,peak+(eaves-peak)*t+.025,-depth-.38),.025,.035,'roof',.004)
        box(prefix+f'_eave_{side}',(x,eaves-.03,-depth/2),(.20,.20,depth+.9),'wood',.02)
    beam(prefix+'_ridge',(0,peak+.06,.48),(0,peak+.06,-depth-.48),.22,.22,'roof',.025)
