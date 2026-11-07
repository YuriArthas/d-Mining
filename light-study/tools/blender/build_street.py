"""New metric mining street, authored from primitives; no model imports.

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


# Every object below is newly authored. Shared helpers define metric UVs and
# closed primitive shells; neither courtyard nor older game models are loaded.
def transform_group(start, origin, angle):
    c,s=math.cos(angle),math.sin(angle)
    for obj in SOURCE_OBJECTS[start:]:
        for v in obj.data.vertices:
            x,y,z=Q(v.co)
            v.co=P((origin[0]+c*x+s*z,origin[1]+y,origin[2]-s*x+c*z))
        obj.data.update()

# Continuous stone street with inset side gutters, broad slabs and raised curbs.
box('Street_foundation',(0,-.08,-7),(22,.32,37),'sandstone',.06)
floor_count=0
for row in range(32):
    z=-22.8+row*1.05
    offset=.55 if row%2 else 0
    edges=sorted(set([-4.15,4.15]+[round(-4.15+offset+i*1.38,4) for i in range(8) if -4.15<-4.15+offset+i*1.38<4.15]))
    for col,(a,b) in enumerate(zip(edges[:-1],edges[1:])):
        if b-a<.15:continue
        box(f'Paving_{row}_{col}',((a+b)/2,.105,z+.525),(b-a-.035,.11,1.015),'limestone',.025)
        floor_count+=1
for side in (-1,1):
    for i in range(28):
        box(f'Curb_{side}_{i}',(side*4.02,.22,-22.3+i*1.2),(.28,.22,1.17),'sandstone',.026)
        box(f'Walk_{side}_{i}',(side*4.78,.26,-22.3+i*1.2),(1.20,.30,1.17),'limestone',.025)
    for z in (7,-1,-9,-17):
        for k in range(6):box(f'Gutter_grate_{side}_{z}_{k}',(side*3.75,.17,z+k*.085),(.28,.04,.035),'iron',.006)

# Closed timber doors, real deep openings, broad glazed shop windows.
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


def shop(prefix,origin,angle,wall,height,awning):
    start=len(SOURCE_OBJECTS);w=6.3;d=4.9
    holes=[(-2.02,-.72,.33,2.91),(.15,2.43,1.12,2.62),(-.65,.65,3.72,4.65)]
    cut_wall(prefix+'_facade',[-w/2,-2.02,-.72,-.65,.15,.65,2.43,w/2],[.33,1.12,2.62,2.91,3.72,4.65,height],-.36,0,holes,wall)
    for sx in (-1,1):
        box(prefix+f'_side_{sx}',(sx*(w/2-.18),height/2+.18,-d/2),(.36,height-.32,d),wall,.025)
        box(prefix+f'_corner_{sx}',(sx*(w/2-.08),height/2+.15,.12),(.23,height,.23),'wood',.025)
    box(prefix+'_back',(0,height/2+.18,-d+.18),(w,.32+height,.36),wall,.025)
    box(prefix+'_floor',(0,.20,-d/2),(w,.25,d),'sandstone',.02)
    # Broad stone footing has actual joints and visible bevels.
    for i in range(5):box(prefix+f'_base_{i}',(-w/2+(i+.5)*w/5,.40,.08),(w/5-.025,.24,.5),'sandstone',.025)
    door(prefix+'_door',-1.37);window(prefix+'_display',1.29,1.87,2.28,1.50)
    window(prefix+'_loft',0,4.185,1.30,.93,False)
    box(prefix+'_storey_beam',(0,3.35,.10),(w+.16,.20,.30),'wood',.025)
    box(prefix+'_top_beam',(0,height-.02,.1),(w+.22,.23,.32),'wood',.025)
    peak=height+1.65
    verts=[(-w/2,height,-.36),(w/2,height,-.36),(0,peak,-.36),(-w/2,height,0),(w/2,height,0),(0,peak,0)]
    mesh(prefix+'_gable',verts,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],wall,.018)
    beam(prefix+'_gable_upright',(0,height,.10),(0,peak-.1,.10),.16,.16,'wood',.016)
    roof(prefix+'_roof',w,d,height+.06,peak+.10)
    box(prefix+'_chimney',(1.7,height+.85,-3.6),(.72,2.0,.77),'sandstone',.026)
    box(prefix+'_chimney_cap',(1.7,height+1.87,-3.6),(.92,.16,.97),'sandstone',.025)
    if awning:
        for i in range(7):
            x=.15+(i+.5)*2.45/7
            o=beam(prefix+f'_awning_{i}',(x,3.20,.24),(x,2.95,1.22),2.45/7-.008,.07,'canvas_red' if i%2==0 else 'canvas_cream',.012)
            box(prefix+f'_valance_{i}',(x,2.88,1.24),(2.45/7-.008,.21,.07),'canvas_red' if i%2==0 else 'canvas_cream',.01)
        for x in (.18,2.56):beam(prefix+f'_awning_brace_{x}',(x,2.55,.13),(x,2.95,1.15),.07,.08,'iron',.01)
    # A hanging pictogram sign reads from along the street (two faces).
    beam(prefix+'_sign_arm',(-2.65,3.78,.08),(-2.65,3.78,1.18),.11,.11,'iron',.012)
    for z in (.45,1.05):beam(prefix+f'_sign_hanger_{z}',(-2.65,3.76,z),(-2.65,3.43,z),.04,.045,'iron',.006)
    box(prefix+'_sign',(-2.65,3.11,.76),(.13,.69,.91),'painted_wood',.04)
    for x in (-2.73,-2.57):
        beam(prefix+f'_pick_handle_{x}',(x,2.91,.50),(x,3.30,1.00),.065,.065,'brass',.008)
        beam(prefix+f'_pick_head_{x}',(x,3.18,.50),(x,3.37,.92),.11,.08,'brass',.01)
    transform_group(start,origin,angle)

shops=[]
for side in (-1,1):
    for i,z in enumerate((3,-5.4,-13.8)):
        name=f'Shop_{"west" if side<0 else "east"}_{i}'
        wall=['plaster_blue','plaster_ivory','plaster_rose'][(i+(side>0))%3]
        shop(name,(side*5.10,0,z),-side*math.pi/2,wall,5.15+(i%2)*.38,(side<0 and i==0) or (side>0 and i==1))
        shops.append({'name':name,'position':[side*5.1,0,z],'width':6.3,'depth':4.9,'wall':wall})

# Street-end gatehouse: a real open arch with individual radial stone voussoirs.
start=len(SOURCE_OBJECTS)
for side in (-1,1):
    box(f'Gate_pier_{side}',(side*3.15,2.6,-.4),(3.2,5.2,.8),'plaster_ivory',.03)
    box(f'Gate_pier_base_{side}',(side*3.15,.45,-.32),(3.35,.62,1.0),'sandstone',.035)
box('Gate_upper_wall',(0,5.45,-.4),(9.5,1.4,.8),'plaster_ivory',.025)
for i in range(13):
    a=i*math.pi/13+.009;b=(i+1)*math.pi/13-.009
    pts=[(r*math.cos(t),2.4+r*math.sin(t),z) for z in (.12,-.82) for r,t in ((1.58,a),(2.1,a),(2.1,b),(1.58,b))]
    mesh(f'Gate_arch_stone_{i}',pts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'sandstone',.018)
# Fill the spandrel above the outer arch; the only opening is the arch itself.
for i in range(13):
    a=i*math.pi/13;b=(i+1)*math.pi/13
    xa,ya=2.1*math.cos(a),2.4+2.1*math.sin(a)
    xb,yb=2.1*math.cos(b),2.4+2.1*math.sin(b)
    verts=[(x,y,z) for z in (-.8,0) for x,y in ((xa,ya),(xb,yb),(xb,4.85),(xa,4.85))]
    mesh(f'Gate_spandrel_{i}',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'plaster_ivory',0)
for side in (-1,1):
    for j in range(6):box(f'Gate_arch_leg_{side}_{j}',(side*1.84,.2+(j+.5)*2.2/6,-.35),(.52,2.2/6-.018,.96),'sandstone',.018)
verts=[]
for z in (-.8,0):verts.extend([(-4.75,6.1,z),(4.75,6.1,z),(0,7.4,z)])
mesh('Gate_gable',verts,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'plaster_ivory',.018)
roof('Gate_roof',9.5,2.8,6.12,7.5)
# Dark brass clock face and two thick hands, no text texture required.
verts=[(.64*math.cos(i*math.tau/24),5.35+.64*math.sin(i*math.tau/24),z) for z in (.08,.22) for i in range(24)]
faces=[tuple(reversed(range(24))),tuple(range(24,48))]+[(i,(i+1)%24,(i+1)%24+24,i+24) for i in range(24)]
mesh('Gate_clock',verts,faces,'iron',.01)
beam('Gate_clock_hand_a',(0,5.35,.25),(.0,5.81,.25),.07,.07,'brass',.005)
beam('Gate_clock_hand_b',(0,5.35,.25),(.31,5.22,.25),.07,.07,'brass',.005)
transform_group(start,(0,0,-23.1),0)

# Newly made tall timber street lamps. Cage groups have a per-lamp shadow role.
lamps=[]
for i,(side,z) in enumerate(((-1,4.0),(1,-5.0),(-1,-14.1))):
    x=side*4.15;lx=x-side*.62;ly=3.0
    prefix=f'StreetLamp_{i}'
    box(prefix+'_foot',(x,.37,z),(.60,.42,.60),'sandstone',.035)
    box(prefix+'_cap',(x,.60,z),(.49,.10,.49),'sandstone',.024)
    box(prefix+'_post',(x,2.0,z),(.25,2.8,.25),'wood',.025)
    for y in (.79,3.35):box(prefix+f'_collar_{y}',(x,y,z),(.29,.17,.29),'iron',.012)
    beam(prefix+'_arm',(x,3.62,z),(lx,3.62,z),.14,.14,'iron',.016)
    beam(prefix+'_brace',(x,3.14,z),(lx+side*.15,3.57,z),.09,.09,'iron',.012)
    box(prefix+'_cage_hanger',(lx,3.47,z),(.09,.28,.09),'iron',.012)
    box(prefix+'_glass',(lx,ly,z),(.44,.50,.44),'lampglass',.018)
    for sx in (-1,1):
        for sz in (-1,1):box(prefix+f'_cage_corner_{sx}_{sz}',(lx+sx*.2475,ly,z+sz*.2475),(.065,.61,.065),'iron',.009)
    box(prefix+'_cage_bottom',(lx,ly-.325,z),(.62,.11,.62),'iron',.018)
    box(prefix+'_cage_top',(lx,ly+.315,z),(.64,.11,.64),'iron',.018)
    verts=[(lx+a,y,z+b) for y,s in ((ly+.37,.33),(ly+.53,.11)) for a,b in ((-s,-s),(s,-s),(s,s),(-s,s))]
    mesh(prefix+'_cage_roof',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'iron',.012)
    lamps.append({'id':i,'position':[lx,ly,z],'radius':.22,'distance':10.0,'intensity':18})

# Handcrafted street furniture: benches, coopered barrels, supply crates.
for i,(x,z) in enumerate(((-4.65,.4),(4.65,-10),(-4.65,-18))):
    for dx in (-.30,.30):
        for dz in (-.83,.83):box(f'Bench_{i}_leg_{dx}_{dz}',(x+dx,.56,z+dz),(.16,.52,.19),'wood',.02)
    for k in range(3):box(f'Bench_{i}_seat_{k}',(x+(k-1)*.24,.86,z),(.22,.13,2.08),'wood',.02)
    outer=1 if x>0 else -1
    for dz in (-.82,.82):box(f'Bench_{i}_post_{dz}',(x+outer*.36,1.1,z+dz),(.13,1.12,.15),'wood',.02)
    for y in (1.16,1.45):box(f'Bench_{i}_back_{y}',(x+outer*.35,y,z),(.13,.23,2.10),'wood',.02)
for i,(x,z) in enumerate(((-4.7,6.1),(4.7,1),(-4.7,-8.5),(4.7,-17.9))):
    profile=[(.31,0),(.36,.12),(.42,.45),(.36,.88),(.32,.97)]
    lathe(f'Barrel_{i}',(x,.42,z),profile,'wood',16)
    for y,rad in ((.56,.375),(1.15,.393)):
        lathe(f'Barrel_{i}_band_{y}',(x,y,z),[(rad,0),(rad,.10)],'iron',16)
    box(f'Crate_{i}',(x,.72,z+1.1),(.69,.62,.72),'wood',.028)
    for h in (.48,.96):box(f'Crate_{i}_rim_{h}',(x,h,z+1.1),(.74,.10,.77),'wood',.014)
    beam(f'Crate_{i}_diagonal',(x-.30,.49,z+1.49),(x+.30,.96,z+1.49),.09,.07,'wood',.012)

# Structural and UV validation; all sources are closed finite metric meshes.
totals=Counter();errors=[];points=[];mesh_stats=[]
for obj in SOURCE_OBJECTS:
    data=obj.data;data.calc_loop_triangles();uv=data.uv_layers.active.data
    points.extend(Q(v.co) for v in data.vertices)
    for t in data.loop_triangles:
        a,b,c=[data.vertices[n].co for n in t.vertices]
        if (b-a).cross(c-a).length<1e-10:errors.append(obj.name+': zero area')
        p,q,r=[uv[n].uv for n in t.loops]
        if abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))<1e-10:errors.append(obj.name+': zero UV')
    if any(not all(math.isfinite(n) for n in v.co) for v in data.vertices):errors.append(obj.name+': nonfinite')
    bm=bmesh.new();bm.from_mesh(data)
    if any(not e.is_manifold for e in bm.edges):errors.append(obj.name+': nonmanifold')
    bm.free()
    count=len(data.loop_triangles);totals[obj['material_role']]+=count
    mesh_stats.append({'name':obj.name,'material':obj['material_role'],'triangles':count})
if errors:raise RuntimeError('\n'.join(errors[:40]))
# A second, non-overlapping UV set stores ONLY static lantern visibility.
# Metric material UVs and all geometry remain untouched.
for obj in SOURCE_OBJECTS:
    obj.select_set(True)
    obj.data.uv_layers.new(name='StaticShadowUV')
    obj.data.uv_layers.active_index=1
bpy.context.view_layer.objects.active=SOURCE_OBJECTS[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.001,margin_method='FRACTION',correct_aspect=False,scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
for obj in SOURCE_OBJECTS:
    obj.data.uv_layers.active_index=0
    obj.data.uv_layers[0].active_render=True
bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene['authorship']='New Blender street, no imported geometry and no decimation.'
bpy.context.preferences.filepaths.save_version=0
SOURCE=ROOT/'source-art/street.blend';GLB=ROOT/'public/assets/street.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True,export_cameras=False,export_lights=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
layout={'lamps':lamps,'shops':shops,'streetWidth':8.3,'streetLength':33.6}
LAYOUT=ROOT/'public/assets/street-layout.json';LAYOUT.write_text(json.dumps(layout,indent=2)+'\n')
record={'title':'Newly authored mining town lamplit street','generator':'Blender '+bpy.app.version_string,'tripoTaskId':None,'authorship':'Blender-authored closed primitive architecture, street furniture and lanterns. No existing meshes imported; no decimation.',
'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':sha(SOURCE),'script':str(Path(__file__).relative_to(ROOT)),'scriptSha256':sha(Path(__file__)),'resource':str(GLB.relative_to(ROOT)),'resourceSha256':sha(GLB),'resourceBytes':GLB.stat().st_size,
'layout':str(LAYOUT.relative_to(ROOT)),'layoutSha256':sha(LAYOUT),'triangles':sum(totals.values()),'trianglesByMaterial':dict(totals),'meshes':len(SOURCE_OBJECTS),'pavingSlabs':floor_count,'textureDimensions':{'limestone':[512,512],'sandstone':[512,512],'plaster_blue':[512,512],'plaster_ivory':[512,512],'plaster_rose':[512,512],'wood':[256,256],'painted_wood':[256,256]},'textures':'Uses retained crafted 512px stone/plaster and 256px wood maps; new flat materials have no image texture.',
'staticShadowAtlas':{'uv':'TEXCOORD_1','size':4096,'contents':'three independent static lantern visibility channels; lighting and materials remain real time'},
'bounds':{'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]},'validation':{'zeroAreaTriangles':0,'invalidUvTriangles':0,'nonManifoldMeshes':0,'finiteVertices':True},'meshStats':mesh_stats,**layout}
(ROOT/'artifacts/street-asset.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ('resource','triangles','meshes','bounds','validation')},indent=2))
