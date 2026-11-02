"""The shop showroom: the stage and the mine cart each item stands on. Blender-authored, no reused scenery/Decimate.
The tools and backpacks themselves are built by tools/build-equipment.py."""
import bpy,math,json,hashlib,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'assets-source/shop-showroom';OUT=ROOT/'src/game/assets/shop'
SRC.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
hexes=['936039','d49b59','40362f','adc4cd','617681','273d50','da8544','59b8ad','efcf6b','9178ca','8bb4eb','d65b45','7bc657','ede0b5','a1d4e0','cf53a7', 'b77445','935034','dca36c','f2c28f','27374a','6d8191','b1c8d0','e1edf0','8a633e','bd8f60','5d4740','f0bb55','50859b','d7e6df','726a71','b58c57']
colors=[tuple(int(h[i:i+2],16)/255 for i in (0,2,4)) for h in hexes]
tex=bpy.data.images.new('ShopPalette128',width=128,height=128);pixels=[]
for y in range(128):
 for x in range(128):
  c=colors[(y//16)*4+x//32];n=(((x*13+y*7)%7)-3)*.003
  pixels.extend([max(0,min(1,v+n)) for v in c]+[1])
tex.pixels=pixels;tex.filepath_raw=str(SRC/'shop-palette.png');tex.file_format='PNG';tex.save();tex.pack()
mat=bpy.data.materials.new('CraftedShopAtlas');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.86
node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=tex;node.interpolation='Closest';mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
parts=[]
def finish(o,color,bevel=0):
 if bevel:
  m=o.modifiers.new('DesignedEdges','BEVEL');m.width=bevel;m.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
 o.data.materials.clear();o.data.materials.append(mat)
 uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
 for poly in o.data.polygons:
  for j,i in enumerate(poly.loop_indices):uv.data[i].uv=((color%4*32+3+(j%2)*25)/128,(color//4*16+3+(j//2%2)*9)/128)
 parts.append(o);return o
def box(name,pos,size,color,bevel=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,color,bevel)
def cyl(name,pos,r,d,color,vertices=10,axis='Z'):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d,location=pos);o=bpy.context.object;o.name=name
 if axis=='X':o.rotation_euler[1]=math.pi/2
 if axis=='Y':o.rotation_euler[0]=math.pi/2
 return finish(o,color)
def gem(name,pos,scale,color):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=pos);o=bpy.context.object;o.name=name;o.scale=scale;return finish(o,color)
def profile(name,points,thick,color):
 n=len(points);verts=[(x,y,z) for x in [-thick/2,thick/2] for y,z in points]
 faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,color)
def group(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o)
 for p in parts:p.parent=o
 parts.clear();return o
def select(root):
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=root
# The showroom scenery, with a reusable cart node. All dimensions authored here.
box('Floor',(0,0,-.2),(48,26,.4),21,.02)
for y in [-1.05,1.05]:box('Rail',(0,y,.14),(48,.13,.20),3,.02)
for x in range(-23,24):box('Sleeper',(x,0,.025),(.28,2.9,.12),24,.015)
random.seed(42)
for i in range(21):
 x=-22+i*2.2
 box('BackWall',(x,5.7,4.8),(2.4,1.5,11),16 if i%3 else 18,.12)
 for z in [1.0,3.5,6.5]:gem('CutRock',(x+random.uniform(-.5,.5),4.7+random.uniform(-.5,.2),z),(1.7,1.4,2.2),[16,17,18,19][i%4])
for x in [-13,-6.5,6.5,13]:
 box('MinePost',(x,4.0,3.9),(.40,.50,7.8),24,.025)
 box('Beam',(x,3.9,7.7),(6.8,.6,.6),24,.03)
 for z in [1.0,6.3]:box('PostIron',(x,3.7,z),(.47,.12,.23),5,.01)
 cyl('LampRoof',(x,3.35,5.6),.25,.12,5,8)
 box('LampGlow',(x,3.35,5.35),(.27,.24,.43),27,.015)
stage=group('ShowroomStage')
# The cart has an open rim, tapered box sides, bolts, hubs and wheel spokes.
box('CartBed',(0,0,.77),(2.7,1.6,.18),22,.04)
for sign in [-1,1]:
 o=box('CartSide',(0,sign*.81,1.27),(2.92,.15,1.08),22,.04);o.rotation_euler[0]=sign*.13
 box('CartRim',(0,sign*.89,1.82),(3.1,.17,.12),23,.02)
 o=box('CartEnd',(sign*1.40,0,1.27),(.15,1.75,1.08),22,.04);o.rotation_euler[1]=-sign*.12
 box('EndRim',(sign*1.51,0,1.82),(.15,1.90,.12),23,.02)
 for x in [-.88,.88]:
  cyl('Wheel',(x,sign*.98,.45),.43,.23,5,12,'Y');cyl('WheelHub',(x,sign*1.115,.45),.20,.07,21,8,'Y')
  for a in [0,math.pi/3,2*math.pi/3]:
   o=box('WheelSpoke',(x,sign*1.12,.45),(.60,.025,.07),4,.005);o.rotation_euler[1]=a
 for x in [-1.15,1.15]:cyl('Rivet',(x,sign*.905,1.50),.055,.04,4,8,'Y')
cart=group('ShowCart')
select(stage);cart.select_set(True)
for o in cart.children_recursive:o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'shop-showroom.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'showroom.glb'),export_format='GLB',use_selection=True,export_animations=False)
manifest={'maker':'Blender','script':'tools/build-shop-showroom.py','source':['assets-source/shop-showroom/shop-showroom.blend'],'texture':[128,128],'showroomTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for r in [stage,cart] for o in r.children_recursive if o.type=='MESH'),'files':[]}
for path in [OUT/'showroom.glb',SRC/'shop-palette.png',SRC/'shop-showroom.blend',Path(__file__)]:
 manifest['files'].append({'file':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'showroom':manifest['showroomTriangles'],'files':manifest['files']},ensure_ascii=False))
