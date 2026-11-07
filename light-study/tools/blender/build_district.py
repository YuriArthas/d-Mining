"""Author a new 56 m four-block town. No model imports, no decimation.

blender -b --python tools/blender/build_district.py
Metric primitive helpers construct all geometry anew. Four-sided façades,
courtyards, a complete ring road and a central cross are part of this model.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from district_primitives import *
import numpy as np

for name in ['roof_red', 'leaf_light']:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    MATERIALS[name] = material


def wall_face(prefix, width, height, origin, angle, entry=False, store=False):
    start = len(SOURCE_OBJECTS)
    openings = [(-2.02, -.72, .33, 2.91), (.25, 2.35, 1.20, 2.64)] if entry else [(-2.25, -.65, 1.35, 2.75), (.65, 2.25, 1.35, 2.75)]
    if height > 4.8:
        openings += [(-1.875,-.825,3.65,4.55),(.825,1.875,3.65,4.55)]
    xs = sorted(set([-width/2, width/2] + [v for a,b,c,d in openings for v in (a,b)]))
    ys = sorted(set([.32, height] + [v for a,b,c,d in openings for v in (c,d)]))
    cut_wall(prefix+'_wall', xs, ys, -.32, 0, openings, current_wall)
    if entry:
        door(prefix+'_door', -1.37)
        window(prefix+'_window', 1.30, 1.92, 2.10, 1.44)
    else:
        for x in (-1.45, 1.45):
            window(prefix+f'_window_{x}', x, 2.05, 1.60, 1.40)
    # Upper windows also occupy real wall openings.
    if height > 4.8:
        for x in (-1.35, 1.35):
            window(prefix+f'_upper_{x}', x, 4.1, 1.05, .9, False)
    for y in (.48, 3.25, height-.05):
        box(prefix+f'_belt_{y}', (0,y,.10), (width+.08,.22,.25), 'sandstone' if y<1 else 'wood', .022)
    if store:
        for i in range(7):
            x=.10+(i+.5)*2.6/7
            beam(prefix+f'_awning_{i}',(x,3.14,.18),(x,2.90,1.12),2.6/7-.006,.075,'canvas_red' if i%2==0 else 'canvas_cream',.012)
            box(prefix+f'_valance_{i}',(x,2.82,1.12),(2.6/7-.006,.18,.06),'canvas_red' if i%2==0 else 'canvas_cream',.01)
        beam(prefix+'_sign_arm',(-2.5,3.7,0),(-2.5,3.7,1.1),.1,.1,'iron',.01)
        box(prefix+'_sign',(-2.5,3.2,.8),(.14,.65,.85),'painted_wood',.035)
        for x in (-2.59,-2.41):
            beam(prefix+f'_sign_pick_{x}',(x,2.98,.55),(x,3.36,1.02),.065,.065,'brass',.007)
            beam(prefix+f'_sign_head_{x}',(x,3.28,.55),(x,3.4,.92),.1,.07,'brass',.007)
    transform_group(start, origin, angle)


def house(prefix, origin, angle, wall, height, store, side_entry):
    global current_wall
    current_wall=wall
    start=len(SOURCE_OBJECTS);w=6.3;d=5.8
    box(prefix+'_foundation',(0,.19,-d/2),(w+.12,.32,d+.12),'sandstone',.04)
    wall_face(prefix+'_front',w,height,(0,0,0),0,True,store)
    wall_face(prefix+'_back',w,height,(0,0,-d),math.pi,False,False)
    for side in (-1,1):
        wall_face(prefix+f'_side_{side}',d,height,(side*w/2,0,-d/2),side*math.pi/2,side==side_entry,False)
        for z in (0,-d):
            box(prefix+f'_corner_{side}_{z}',(side*(w/2-.05),height/2+.15,z),(.24,height,.24),'wood',.024)
    peak=height+1.55
    for back in (False,True):
        z=-d if back else 0
        verts=[(-w/2,height,z-.16),(w/2,height,z-.16),(0,peak,z-.16),(-w/2,height,z+.16),(w/2,height,z+.16),(0,peak,z+.16)]
        mesh(prefix+f'_gable_{back}',verts,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],wall,.02)
        beam(prefix+f'_gable_beam_{back}',(0,height,z+.20),(0,peak-.08,z+.20),.17,.17,'wood',.018)
    roof_start=len(SOURCE_OBJECTS)
    roof(prefix+'_roof',w,d,height+.08,peak+.12)
    if 'inn' in prefix or 'workshop' in prefix:
        for obj in SOURCE_OBJECTS[roof_start:]:
            if obj['material_role']=='roof':
                obj.data.materials[0]=MATERIALS['roof_red'];obj['material_role']='roof_red'
    box(prefix+'_chimney',(1.7,height+.75,-3.8),(.72,1.85,.78),'sandstone',.03)
    box(prefix+'_chimney_cap',(1.7,height+1.70,-3.8),(.96,.16,1.02),'sandstone',.025)
    transform_group(start,origin,angle)


def paving(prefix,x0,x1,z0,z1):
    print('Building road '+prefix,flush=True)
    rows=math.ceil((z1-z0)/1.06);dz=(z1-z0)/rows
    for row in range(rows):
        offset=.64 if row%2 else 0
        edges=sorted(set([x0,x1]+[x0+offset+i*1.34 for i in range(math.ceil((x1-x0)/1.34)+1) if x0+.10<x0+offset+i*1.34<x1-.10]))
        for col,(a,b) in enumerate(zip(edges[:-1],edges[1:])):
            box(f'Paving_{prefix}_{row}_{col}',((a+b)/2,.10,z0+(row+.5)*dz),(b-a-.035,.12,dz-.035),'limestone',.022)


def lamp(i,x,z,dx,dz):
    prefix=f'DistrictLamp_{i}';lx=x+dx*.68;lz=z+dz*.68;ly=3.05
    box(prefix+'_foot',(x,.35,z),(.58,.42,.58),'sandstone',.04)
    box(prefix+'_post',(x,1.96,z),(.25,2.85,.25),'wood',.025)
    for y in (.68,3.35):box(prefix+f'_collar_{y}',(x,y,z),(.29,.16,.29),'iron',.012)
    beam(prefix+'_arm',(x,3.64,z),(lx,3.64,lz),.14,.14,'iron',.016)
    beam(prefix+'_brace',(x,3.10,z),(lx,3.53,lz),.085,.085,'iron',.01)
    box(prefix+'_cage_hanger',(lx,3.49,lz),(.08,.28,.08),'iron',.01)
    box(prefix+'_glass',(lx,ly,lz),(.44,.50,.44),'lampglass',.018)
    for sx in (-1,1):
        for sz in (-1,1):box(prefix+f'_cage_corner_{sx}_{sz}',(lx+sx*.2475,ly,lz+sz*.2475),(.065,.61,.065),'iron',.009)
    for y in (-.325,.315):box(prefix+f'_cage_cap_{y}',(lx,ly+y,lz),(.64,.11,.64),'iron',.018)
    verts=[(lx+a,y,lz+b) for y,s in ((ly+.37,.33),(ly+.55,.11)) for a,b in ((-s,-s),(s,-s),(s,s),(-s,s))]
    mesh(prefix+'_cage_roof',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'iron',.012)
    return {'id':i,'position':[lx,ly,lz],'radius':.22,'distance':12,'intensity':22}


def bench(prefix,x,z,angle):
    start=len(SOURCE_OBJECTS)
    for x1 in (-.85,.85):
        for z1 in (-.25,.25):box(prefix+f'_leg_{x1}_{z1}',(x1,.53,z1),(.14,.55,.14),'wood',.02)
    for z1 in (-.24,0,.24):box(prefix+f'_seat_{z1}',(0,.84,z1),(2.1,.12,.22),'wood',.018)
    for x1 in (-.85,.85):box(prefix+f'_upright_{x1}',(x1,1.0,-.34),(.13,1.15,.13),'wood',.02)
    for y in (1.15,1.43):box(prefix+f'_back_{y}',(0,y,-.34),(2.10,.20,.12),'wood',.02)
    transform_group(start,(x,0,z),angle)


def tree(prefix,x,z):
    # Simple authored solid crowns, a broad trunk and no thin branch/leaf network.
    lathe(prefix+'_trunk',(x,.3,z),[(.43,0),(.31,2.7),(.22,3.5)],'wood',10)
    for i,(dx,y,dz,scale) in enumerate([(-.65,3.8,0,(1.25,1.35,1.25)),(.65,4.25,.2,(1.5,1.55,1.35)),(.1,3.8,-.8,(1.3,1.2,1.3))]):
        bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=2,radius=1)
        verts=[(x+dx+v.co.x*scale[0],y+v.co.z*scale[1],z+dz+v.co.y*scale[2]) for v in bm.verts]
        bm.verts.index_update();faces=[tuple(v.index for v in f.verts) for f in bm.faces];bm.free()
        mesh(prefix+f'_crown_{i}',verts,faces,'leaf' if i%2 else 'leaf_light',0)


box('District_foundation',(0,-.13,0),(57,.30,57),'sandstone',.08)
for i,(a,b) in enumerate([(-28,-22),(-3,3),(22,28)]):paving(f'vertical_{i}',a,b,-28,28)
for i,(a,b) in enumerate([(-22,-3),(3,22)]):
    for j,(c,d) in enumerate([(-28,-22),(-3,3),(22,28)]):paving(f'horizontal_{i}_{j}',a,b,c,d)

blocks=[];houses=[]
for block,(sx,sz,name) in enumerate([(-1,-1,'shops'),(1,-1,'homes'),(-1,1,'workshop'),(1,1,'inn')]):
    print('Building block '+name,flush=True)
    cx,cz=sx*12.5,sz*12.5
    blocks.append({'id':name,'center':[cx,0,cz],'bounds':[cx-9.5,cz-9.5,cx+9.5,cz+9.5]})
    box(name+'_court',(cx,.15,cz),(18.3,.22,18.3),'sandstone',.03)
    # Continuous footpaths, with openings aligned to the cross and ring roads.
    for edge in (-1,1):
        for k in range(15):
            t=-8.9+(k+.5)*17.8/15
            box(f'Sidewalk_{name}_x_{edge}_{k}',(cx+edge*8.95,.26,cz+t),(.95,.30,17.8/15-.025),'limestone',.022)
            box(f'Sidewalk_{name}_z_{edge}_{k}',(cx+t,.26,cz+edge*8.95),(17.8/15-.025,.30,.95),'limestone',.022)
    for col in (-1,1):
        for row in (-1,1):
            prefix=f'House_{name}_{col}_{row}'
            height=5.05+((block+(col>0)+(row>0))%3)*.28
            if name=='inn' and col==1 and row==1:height=6.15
            front=(cx+col*4.35,0,cz+row*7.7)
            angle=0 if row>0 else math.pi
            wall=['plaster_ivory','plaster_blue','plaster_rose'][(block+(col>0)+(row>0))%3]
            house(prefix,front,angle,wall,height,name in ('shops','inn'),col*(1 if row>0 else -1))
            houses.append({'name':prefix,'block':name,'front':front,'angle':angle,'width':6.3,'depth':5.8,'height':height,'wall':wall})
    # Small paved communal court with a tree, benches, well and modest props.
    if name in ('homes','shops'):
        tree(name+'_tree',cx,cz)
        bench(name+'_bench',cx,cz+1.5,0)
    if name=='inn':
        lathe('Inn_well',(cx,.30,cz),[(.85,0),(.85,.72),(.67,.82),(.67,.60)],'sandstone',20)
        for dx in (-1,1):box(f'Inn_well_post_{dx}',(cx+dx,1.45,cz),(.18,2.3,.18),'wood',.02)
        beam('Inn_well_crossbar',(cx-1.15,2.6,cz),(cx+1.15,2.6,cz),.20,.20,'wood',.02)
    for i in range(3 if name=='workshop' else 1):
        x=cx-1.0+i*.95;z=cz-.9
        box(f'{name}_crate_{i}',(x,.67,z),(.80,.72,.78),'wood',.028)
        beam(f'{name}_crate_diagonal_{i}',(x-.34,.34,z+.42),(x+.34,.98,z+.42),.09,.07,'painted_wood',.01)
        lathe(f'{name}_barrel_{i}',(x,.30,z+1.15),[(.32,0),(.40,.4),(.33,.86)],'wood',14)
        for y in (.47,1.0):lathe(f'{name}_barrel_band_{i}_{y}',(x,y,z+1.15),[(.38,0),(.38,.09)],'iron',14)

lamp_sites=[(-3.55,-8,1,0),(3.55,8,-1,0),(-8,3.55,0,-1),(8,-3.55,0,1),
            (-21.45,-12,-1,0),(21.45,12,1,0),(-12,21.45,0,1),(12,-21.45,0,-1),
            (-21.45,14,-1,0),(21.45,-14,1,0),(14,21.45,0,1),(-14,-21.45,0,-1)]
lamps=[lamp(i,*site) for i,site in enumerate(lamp_sites)]

# Check finite, non-degenerate closed geometry before packing the lightmap UVs.
print('Validating district geometry',flush=True)
totals=Counter();errors=[];points=[]
for obj in SOURCE_OBJECTS:
    data=obj.data;data.calc_loop_triangles();uv=data.uv_layers[0].data
    points.extend(Q(v.co) for v in data.vertices)
    for tri in data.loop_triangles:
        a,b,c=[data.vertices[n].co for n in tri.vertices]
        if (b-a).cross(c-a).length<1e-10:errors.append(obj.name+': zero area')
        p,q,r=[uv[n].uv for n in tri.loops]
        if abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))<1e-10:errors.append(obj.name+': zero UV')
    bm=bmesh.new();bm.from_mesh(data)
    if any(not e.is_manifold for e in bm.edges):errors.append(obj.name+': nonmanifold')
    bm.free();totals[obj['material_role']]+=len(data.loop_triangles)
if errors:raise RuntimeError('\n'.join(errors[:30]))
for obj in SOURCE_OBJECTS:
    obj.select_set(True);obj.data.uv_layers.new(name='IrradianceUV');obj.data.uv_layers.active_index=1
bpy.context.view_layer.objects.active=SOURCE_OBJECTS[0]
print('Packing 4096 lightmap UVs',flush=True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.001,margin_method='FRACTION',correct_aspect=False,scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
for obj in SOURCE_OBJECTS:
    obj.data.uv_layers.active_index=0;obj.data.uv_layers[0].active_render=True
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene['authorship']='Newly authored 56 m four-block district; no model import, no decimation.'
bpy.context.preferences.filepaths.save_version=0
source=ROOT/'source-art/district.blend';glb=ROOT/'public/assets/district.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
# Join only material-compatible pieces within one quadrant for the exported
# runtime asset. Source .blend keeps all editable pieces. This preserves every
# triangle, UV island and vertex tint, and avoids thousands of runtime objects.
groups={}
for obj in SOURCE_OBJECTS:
    center=sum((Q(v.co) for v in obj.data.vertices),Vector())/len(obj.data.vertices)
    region=f'{int(center.x>=0)}_{int(center.z>=0)}'
    role=obj['material_role']
    owner=obj.name.split('_')[1] if role=='lampglass' else 'solid'
    groups.setdefault((region,role,owner),[]).append(obj)
bpy.ops.object.select_all(action='DESELECT')
for (region,role,owner),objects in groups.items():
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    obj=bpy.context.object;obj.name=f'DistrictLamp_{owner}_glass' if role=='lampglass' else f'District_{region}_{role}'
    obj.select_set(False)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_yup=True,export_texcoords=True,export_normals=True,export_vertex_color='ACTIVE',export_materials='EXPORT',export_extras=True,export_cameras=False,export_lights=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
layout={'name':'Pinewind four-block district','size':56,'roadWidth':6,'blocks':blocks,'houses':houses,'lamps':lamps,'atlasSize':4096}
layout_path=ROOT/'public/assets/district-layout.json';layout_path.write_text(json.dumps(layout,indent=2)+'\n')
record={'title':'New four-block mining district','generator':'Blender '+bpy.app.version_string,'tripoTaskId':None,
 'authorship':'New metric closed primitive meshes. Shared authoring helpers, no existing model imports and no decimation.',
 'source':str(source.relative_to(ROOT)),'sourceSha256':sha(source),'script':str(Path(__file__).relative_to(ROOT)),'scriptSha256':sha(Path(__file__)),
 'helpers':'tools/blender/district_primitives.py','helpersSha256':sha(Path(__file__).with_name('district_primitives.py')),
 'resource':str(glb.relative_to(ROOT)),'resourceSha256':sha(glb),'resourceBytes':glb.stat().st_size,
 'layout':str(layout_path.relative_to(ROOT)),'layoutSha256':sha(layout_path),'triangles':sum(totals.values()),'trianglesByMaterial':dict(totals),
 'meshes':len(SOURCE_OBJECTS),'exportBatches':len(groups),'buildings':len(houses),'blocks':4,'lamps':len(lamps),'textureDimensions':{'stone/plaster':[512,512],'wood':[256,256],'irradiance':[4096,4096]},
 'bounds':{'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]},
 'validation':{'zeroAreaTriangles':0,'invalidUvTriangles':0,'nonManifoldMeshes':0}}
(ROOT/'artifacts/district-asset.json').write_text(json.dumps(record,indent=2)+'\n')
print('DISTRICT_RESULT '+json.dumps({k:record[k] for k in ['triangles','meshes','resourceBytes','buildings','bounds']}))
