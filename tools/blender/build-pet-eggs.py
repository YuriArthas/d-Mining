"""Deterministic symmetrical pet eggs, six authored 128px textures, editable blend files."""
import bpy,math,json,hashlib
from array import array
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SIZE=128
PALETTES=[('meadow','fff2d6','70c849','348bce'),('crystal','d9f5ff','9e78ec','6452ba'),('ember','fff1c5','f48a37','c95338'),('tide','daf8f0','33afb9','287995'),('moon','353668','f7df97','595197'),('core','ffe1a0','cc8833','896037')]
def rgb(s):return tuple(int(s[i:i+2],16)/255 for i in (0,2,4))
def texel(kind,x,y,base,accent):
 u=x/SIZE;v=y/SIZE
 # Equirectangular patterns wrap exactly at the seam. No baked lighting.
 col=int(u*6);row=int(v*4);a=(u*6+.5*(row%2))%1-.5;b=(v*4)%1-.5
 if kind=='meadow':mask=(a*a+(b*.9)**2)<.052
 elif kind=='crystal':mask=abs(a)+abs(b)<.3
 elif kind=='ember':mask=abs(b-.14*math.cos(a*6.283))<.065 or (abs(a)<.10 and b<-.08 and b>-.27)
 elif kind=='tide':mask=abs(math.sin(u*math.pi*8)*.045+(v*4)%1-.5)<.07
 elif kind=='moon':mask=(abs(a)<.045 and abs(b)<.26) or (abs(b)<.045 and abs(a)<.18) or (a*a+b*b<.009)
 else:mask=abs(a)+abs(b*.6)>.44
 if v<.1 or v>.88:mask=False
 return accent if mask else base
for kind,bg,fg,stand in PALETTES:
 name='egg-'+kind+'-blender';out=ROOT/'assets-source/quarry-v2'/name;out.mkdir(parents=True,exist_ok=True)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 im=bpy.data.images.new(name+'-color-128',width=SIZE,height=SIZE,alpha=False);im.colorspace_settings.name='sRGB';pix=array('f')
 for y in range(SIZE):
  for x in range(SIZE):pix.extend((*texel(kind,x,y,rgb(bg),rgb(fg)),1))
 im.pixels.foreach_set(pix);im.filepath_raw=str(out/'color-128.png');im.file_format='PNG';im.save();bpy.data.images.remove(im)
 im=bpy.data.images.load(str(out/'color-128.png'));im.pack()
 def material(name,color):
  m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*rgb(color),1);n.inputs['Metallic'].default_value=0;n.inputs['Roughness'].default_value=.72;return m
 shell=material('painted-shell',bg);shader=shell.node_tree.nodes.get('Principled BSDF');tex=shell.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;shell.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,radius=1,location=(0,0,1.8));egg=bpy.context.object;egg.name='symmetric-egg'
 for v in egg.data.vertices:
  taper=1-.23*v.co.z;v.co.x*=.86*taper;v.co.y*=.86*taper;v.co.z*=1.22
 for p in egg.data.polygons:p.use_smooth=True
 egg.data.materials.append(shell)
 for label,z,width,height,color in [('plinth',.2,2.6,.4,stand),('ivory-rim',.48,2.7,.16,'fff0d2')]:
  bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,z));o=bpy.context.object;o.name=label;o.scale=(width,width,height);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  bevel=o.modifiers.new('soft crafted edge','BEVEL');bevel.width=.07;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
  o.data.materials.append(material(label,color))
 bpy.ops.object.select_all(action='SELECT');tris=0
 for o in bpy.context.selected_objects:
  o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
 assert tris<=1600,tris
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'source.blend'))
 bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'),export_format='GLB',use_selection=True,export_yup=True)
 result={'status':'success','generator':'Blender','generationId':name+'-v1','type':'authored_mesh','faceLimit':1600,'triangles':tris,'textureSize':128,'reference':'tools/blender/build-pet-eggs.py','recipeSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
 (out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(name,tris)
