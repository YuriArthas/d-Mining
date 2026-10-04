import bpy, math, random, json, os, sys, time
from mathutils import Vector
random.seed(2407)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
START=time.time();bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
COLL=[];MATS={};OBJS=[]
def lin(v):return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
def rgb(h):return tuple(lin(int(h[i:i+2],16)/255) for i in (1,3,5))
def mat(name,h,rough=.85):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb(h),1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb(h),1);bs.inputs['Roughness'].default_value=rough
 MATS[name]=m;return m
for name,h in [('wood:cedar','#a86835'),('wood:dark','#62432f'),('wood:cut','#deb16c'),('stone:limestone','#d7c9a2'),('stone:rock','#a6ae9b'),('default:plaster','#f8e2b3'),('default:teal','#167d87'),('default:coral','#dc6942'),('default:cream','#fff0c3'),('default:navy','#264c62'),('metal:iron','#385a62'),('metal:brass','#cc9c46'),('canvas:linen','#ffe2a1'),('canvas:blue','#398db6'),('leaves:oak','#45a363'),('leaves:lime','#83bd45'),('leaves:pine','#23867a'),('ground:terrain','#ffffff'),('grass:blades','#ffffff'),('water:river','#259dab'),('default:flower','#ffe7a3'),('default:petal','#ed9889')]:mat(name,h)
def xyz(p):return (p[0],-p[2],p[1])
def mesh(name,verts,faces,material,colors=None):
 me=bpy.data.meshes.new(name);me.from_pydata([xyz(p) for p in verts],[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(MATS[material]);OBJS.append(ob)
 for poly in me.polygons:poly.use_smooth=True
 if colors:
  ca=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
  ca.data.foreach_set('color',[a for c in colors for a in c]);me.color_attributes.active_color=ca
 return ob
def solid(at,half,yaw=0):COLL.append({'at':list(at),'half':list(half),'yaw':yaw})
def box(name,at,size,material,bevel=.12,collision=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(at));ob=bpy.context.object;ob.name=name;ob.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 ob.data.materials.append(MATS[material]);OBJS.append(ob)
 if bevel:
  mod=ob.modifiers.new('soft crafted edges','BEVEL');mod.width=bevel;mod.segments=4
  mod=ob.modifiers.new('weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=40
 if collision:solid(at,[x/2 for x in size])
 return ob
def ellipsoid(name,at,scale,material,seed=0):
 # Petals are centimetre-sized; they do not need the same tessellation as tree crowns.
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16 if name=='wildflower petal' else 32,ring_count=8 if name=='wildflower petal' else 20,location=xyz(at));ob=bpy.context.object;ob.name=name
 for v in ob.data.vertices:
  p=v.co;f=1+.065*math.sin(p.x*5+p.z*3+seed)+.045*math.sin(p.y*6-p.z*2+seed)
  p.x*=scale[0]*f;p.y*=scale[2]*f;p.z*=scale[1]*f
 for p in ob.data.polygons:p.use_smooth=True
 ob.data.materials.append(MATS[material]);OBJS.append(ob);return ob
def tube(name,points,radius,material,radii=None):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=18;cu.bevel_depth=radius;cu.bevel_resolution=5
 sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for i,(bp,p) in enumerate(zip(sp.bezier_points,points)):
  bp.co=xyz(p);bp.handle_left_type=bp.handle_right_type='AUTO';bp.radius=radii[i] if radii else 1
 ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);ob.data.materials.append(MATS[material]);OBJS.append(ob);return ob
def cyl(name,at,r,depth,material,axis=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth,location=xyz(at));ob=bpy.context.object;ob.name=name
 if axis:ob.rotation_euler=Vector((0,0,1)).rotation_difference(Vector(xyz(axis))).to_euler()
 mod=ob.modifiers.new('rounded rims','BEVEL');mod.width=min(.08,r*.12);mod.segments=3
 mod=ob.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 ob.data.materials.append(MATS[material]);OBJS.append(ob);return ob
# A single continuous landscape, with an exact aperture. The central playable clearing stays level.
PEAKS=[(-116,-114,78,48,49),(-40,-190,114,47,62),(68,-145,85,50,48),(151,-68,94,49,60),(158,94,85,60,58),(-145,68,92,60,64),(2,190,104,67,54)]
PEAKS=[(x*1.65,z*1.65,h*.78,w*1.10,d*1.10) for x,z,h,w,d in PEAKS]
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def height(x,z):
 edge=max(abs(x)-32,abs(z)-38,0);mask=smooth(edge/26)
 # Open river valley: broad, not a ring of independent sphere props.
 h=sum(p[2]*math.exp(-(((x-p[0])/p[3])**2+((z-p[1])/p[4])**2)*1.4) for p in PEAKS)
 h+=max(0,4+3*math.sin(x*.057+math.sin(z*.026))+3*math.sin(z*.049-x*.016))
 h*=1+.15*math.sin(x*.055+z*.03)+.10*math.cos(z*.065-x*.045)+.04*math.sin(x*.19+z*.12)
 return max(0,h*mask)
def groundcolor(x,z,y):
 slope=math.hypot(height(x+.5,z)-height(x-.5,z),height(x,z+.5)-height(x,z-.5))
 g=rgb('#59b249');stone=rgb('#a4b7ad');snow=rgb('#ebf4e4')
 rock=smooth((slope-.5)/1.2)*smooth((y-10)/25);snowy=smooth((y-65)/24)
 n=.91+.075*math.sin(x*.16+math.sin(z*.15))+.045*math.cos(z*.3)
 return tuple(((g[i]*(1-rock)+stone[i]*rock)*(1-snowy)+snow[i]*snowy)*n for i in range(3))+(1,)
verts=[];cols=[];faces=[];N=301;STEP=2.4
# Force -8 and +8 into the grid to preserve the full mining aperture precisely.
coords=sorted(set([round(-360+i*STEP,4) for i in range(N)]+[-8,8]));N=len(coords)
for z in coords:
 for x in coords:
  y=height(x,z);verts.append((x,y+.008,z));cols.append(groundcolor(x,z,y))
for j in range(N-1):
 for i in range(N-1):
  x=(coords[i]+coords[i+1])/2;z=(coords[j]+coords[j+1])/2
  if abs(x)<8 and abs(z)<8:continue
  a=j*N+i;faces.append((a,a+N,a+N+1,a+1))
mesh('continuous valley / open mine aperture',verts,faces,'ground:terrain',cols)
# Nearby slope collision is independent of the render mesh, tiled and streamed.
for cz in range(-88,105,16):
 for cx in range(-88,105,16):
  vs=[];ix=[];high=0
  for j in range(9):
   for i in range(9):
    y=height(cx-8+i*2,cz-8+j*2);high=max(high,y);vs.extend([i*2-8,y,j*2-8])
  if high<.15:continue
  for j in range(8):
   for i in range(8):a=j*9+i;ix.extend([a,a+9,a+1,a+1,a+9,a+10])
  COLL.append({'at':[cx,0,cz],'half':[8,high+.1,8],'yaw':0,'triangles':{'vertices':vs,'indices':ix}})
# Earthen circulation surface, soft-edged colour bands on an open plaza.
TRAILS=[([(-21,26),(-13,18),(-5,12),(4,12),(15,11)],3.5),([(-13,15),(-15,8),(-15,-2),(-22,-7)],3.2),([(10,11),(12,1),(12,-12),(3,-18),(2,-28),(3,-39)],2.4)]
def distpath(x,z):
 best=999
 for points,w in TRAILS:
  for a,b in zip(points,points[1:]):
   dx=b[0]-a[0];dz=b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)))
   best=min(best,math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)-w/2)
 return best
# Smooth Blender Bezier splines provide continuous paths rather than faceted paving.
# Paths are now blended into the ground material through an offline mask.
# Buildings have a continuous swept roof, eaves, individual overlapping shingles and crafted frames.
def roof(x,z,w,d,eave,ridge,material):
 vs=[];fs=[];sections=32
 for iz in range(3):
  zz=z-d*.5+iz*d*.5
  for i in range(sections+1):
   t=-1+2*i/sections;y=eave+(ridge-eave)*(1-abs(t)**.85)+.30*abs(t)**6
   vs.append((x+t*w*.5,y,zz))
 for j in range(2):
  for i in range(sections):a=j*(sections+1)+i;fs.append((a,a+sections+1,a+sections+2,a+1))
 ob=mesh('swept tiled roof',vs,fs,material);m=ob.modifiers.new('roof thickness','SOLIDIFY');m.thickness=.18;m=ob.modifiers.new('rounded roof edge','BEVEL');m.width=.07;m.segments=3
 for zz in [z-d/2,z+d/2]:tube('roof fascia',[(x+t*w/2,eave+(ridge-eave)*(1-abs(t)**.85)+.30*abs(t)**6,zz) for t in [-1,-.75,-.5,-.25,0,.25,.5,.75,1]],.105,'wood:dark')
 # Raised seams read as tiled bands without building the roof from disconnected blocks.
 for zz in [z-d/2+.35+i*.72 for i in range(int(d/.72))]:
  tube('overlapping roof tile ribs',[(x+t*w/2,eave+(ridge-eave)*(1-abs(t)**.85)+.33*abs(t)**6+.035,zz) for t in [-1,-.75,-.5,-.25,0,.25,.5,.75,1]],.045,material)
 tube('ridge cap',[(x,ridge+.1,z-d/2-.1),(x,ridge+.12,z),(x,ridge+.1,z+d/2+.1)],.15,material)
def house(x,z,w,d,paint,roofmat):
 box('lime plaster workshop',(x,2.2,z),(w,4.4,d),'default:plaster',.22,True)
 for xx in [x-w/2,x+w/2]:
  for zz in [z-d/2,z+d/2]:box('timber corner post',(xx,2.25,zz),(.32,4.5,.32),'wood:dark',.08)
 box('stone foundation',(x,.25,z),(w+.25,.5,d+.25),'stone:limestone',.14)
 roof(x,z,w+1.8,d+1.7,4.5,7.6,roofmat)
 # Front gable closes the silhouette beneath the pitched roof.
 mesh('plaster gable',[(x-w/2,4.4,z+d/2),(x+w/2,4.4,z+d/2),(x,7.35,z+d/2)],[(0,1,2)],'default:plaster')
 tube('gable timber',[(x-w/2,4.4,z+d/2+.06),(x,7.35,z+d/2+.06),(x+w/2,4.4,z+d/2+.06)],.13,'wood:dark')
 for dx in [-w*.30,w*.30]:
  box('inset window',(x+dx,2.7,z+d/2+.025),(1.35,1.6,.10),'default:navy',.17)
  for off in [-.77,.77]:box('painted window shutter',(x+dx+off,2.7,z+d/2+.10),(.36,1.85,.16),paint,.06)
  for off in [-.85,.85]:box('window frame',(x+dx,2.7+off,z+d/2+.13),(1.6,.13,.16),'wood:cut',.035)
  box('window crossbar',(x+dx,2.7,z+d/2+.14),(.1,1.7,.12),'wood:cut',.03)
  box('window crossbar',(x+dx,2.7,z+d/2+.14),(1.45,.1,.12),'wood:cut',.03)
  box('flower box',(x+dx,1.7,z+d/2+.35),(1.8,.35,.6),paint,.09)
  for k in range(5):ellipsoid('window herbs',(x+dx-.7+k*.35,2.0,z+d/2+.35),(.32,.35,.30),'leaves:lime',k)
 box('arched door dark recess',(x,.0+1.5,z+d/2+.04),(1.8,3,.10),'wood:dark',.35)
 tube('rounded entrance arch',[(x-1.05,0,z+d/2+.16),(x-1.05,2.1,z+d/2+.16),(x,3.4,z+d/2+.16),(x+1.05,2.1,z+d/2+.16),(x+1.05,0,z+d/2+.16)],.17,'stone:limestone')
 # Side walls are visible from the arrival path; frame them as finished facades.
 for side in [-1,1]:
  xx=x+side*(w/2+.04)
  for zz in [z-d*.25,z+d*.25]:
   box('side window',(xx,2.6,zz),(.10,1.6,1.5),'default:navy',.08)
   for off in [-.85,.85]:box('side window jamb',(xx+side*.08,2.6,zz+off),(.16,1.95,.15),paint,.04)
   for off in [-.85,.85]:box('side window sill',(xx+side*.08,2.6+off,zz),(.22,.15,1.9),'wood:cut',.04)
   box('side window muntin',(xx+side*.14,2.6,zz),(.12,1.7,.10),'wood:cut',.025)
  for yy in [.6,4.1]:box('side timber band',(xx+side*.06,yy,z),(.20,.2,d),'wood:dark',.04)
  tube('side wall timber diagonal',[(xx+side*.07,.65,z-d*.45),(xx+side*.07,2.3,z),(xx+side*.07,4,z+d*.45)],.085,'wood:dark')
 # A chimney and timber corbels complete the roof silhouette.
 box('plaster chimney',(x+w*.27,6.8,z-d*.2),(.8,3,.9),'stone:limestone',.09)
 box('chimney cap',(x+w*.27,8.3,z-d*.2),(1.05,.24,1.15),'wood:dark',.06)
house(-23,-9,9,7,'default:teal','default:teal');house(18,3,9,7,'default:coral','default:coral')
# Sale counter and scalloped cloth porch; the gameplay ring stays in front at (15,11).
box('sale counter',(15,1,8),(5.3,2,1.6),'wood:cedar',.18,True);box('counter lip',(15,2.05,8),(5.7,.22,1.9),'wood:cut',.09)
for xx in [11.6,20.8]:tube('porch column',[(xx,0,8.8),(xx,2.5,8.8),(xx,4.7,8.8)],.16,'wood:dark');solid((xx,2.3,8.8),(.22,2.3,.22))
for i in range(12):
 x0=11.3+i*.82;vs=[];fs=[]
 for j in range(17):
  t=j/16;zz=5.9+t*3.7;y=4.9-.55*t-.22*math.sin(t*math.pi)
  for xx in [x0,x0+.82]:vs.append((xx,y,zz))
 for j in range(16):a=j*2;fs.append((a,a+1,a+3,a+2))
 mesh('striped linen canopy',vs,fs,'canvas:linen' if i%2 else 'canvas:blue')
 tube('scalloped canopy valance',[(x0,4.35,9.6),(x0+.41,4.05,9.6),(x0+.82,4.35,9.6)],.09,'canvas:linen' if i%2 else 'canvas:blue')
for k in range(4):ellipsoid('ore samples',(13.4+k*.9,2.4,8),(.35,.4,.3),'default:teal' if k%2 else 'metal:brass',k)
# Windmill landmark to the west, articulated blades and tapered tower.
for y,r in [(1.6,1.8),(4.8,1.5),(8,1.1)]:cyl('windmill tower',(-30,y,-16),r,3.2,'default:plaster')
roof(-30,-16,4.2,3.7,9.7,12,'default:teal');solid((-30,5,-16),(1.8,5,1.8))
for a in [math.pi*.15+i*math.pi/2 for i in range(4)]:
 pts=[(-30+math.cos(a)*r,9+math.sin(a)*r,-13.9) for r in [0,2,4.4]];tube('windmill spar',pts,.10,'wood:dark')
 vs=[]
 for r,off in [(1.4,-.18),(4.3,-.18),(4.3,.85),(1.4,.25)]:vs.append((-30+math.cos(a)*r-math.sin(a)*off,9+math.sin(a)*r+math.cos(a)*off,-13.8))
 mesh('linen windmill sail',vs,[(0,1,2,3)],'canvas:linen')
ellipsoid('windmill hub',(-30,9,-13.7),(.45,.45,.25),'metal:brass')
# The mining opening retains all 64 cells, with its front edge kept open.
for x in [-8.45,8.45]:
 for z in range(-7,9,2):box('rounded mine coping',(x,.20,z),(.62,.4,1.94),'stone:limestone',.15)
for x in range(-7,9,2):box('rounded mine coping',(x,.20,-8.45),(1.94,.4,.62),'stone:limestone',.15)
for x,z in [(-10,-10),(-13,-11)]:tube('oak derrick mast',[(x,0,z),(x+.1,3,z),(x+.15,7,z)],.27,'wood:cedar');solid((x,3.5,z),(.34,3.5,.34))
tube('derrick arm',[(-13,7,-11),(-9.5,7.3,-10),(-5.5,7.1,-9)],.25,'wood:dark')
tube('derrick brace',[(-13,4,-11),(-10,6,-10),(-6,7.1,-9)],.15,'wood:cut')
cyl('pulley',(-5.5,6.8,-9),.45,.18,'metal:iron',(0,0,1));tube('hoist rope',[(-5.5,6.5,-9),(-5.5,4,-9),(-5.5,1.7,-9)],.025,'wood:cut')
# Ore cart, rails and timber storage establish a working mine, away from the main path.
for x in [-18,-16.5]:tube('curved rail',[(x,.12,6),(x,.12,0),(x-1,.12,-6)],.065,'metal:iron')
for z in range(-6,8):box('rail sleeper',(-17.3,.07,z),(2.6,.14,.28),'wood:dark',.04)
box('cart undercarriage',(-17.3,.6,1),(2.2,.28,3),'wood:dark',.07)
box('cart floor',(-17.3,.95,1),(2.4,.4,3),'default:teal',.18)
for x in [-18.5,-16.1]:box('cart side',(x,1.55,1),(.20,1.5,3.15),'default:teal',.09)
for z in [-.6,2.6]:box('cart end',(-17.3,1.55,z),(2.4,1.5,.2),'default:teal',.09)
for x in [-18.6,-16]:
 for z in [.0,2]:cyl('cart wheel',(x,.58,z),.48,.22,'metal:iron',(1,0,0))
for k in range(7):ellipsoid('cart ore',(-17.8+random.random(),1.6+random.random()*.7,.2+random.random()*1.7),(.42,.45,.4),'stone:rock',k)
solid((-17.3,1.2,1),(1.4,1.2,1.9))
for i in range(7):cyl('stacked timber',(-29+(i%3)*.7,.4+(i//3)*.65,-4),.32,4,'wood:cedar',(0,0,1))
# Watercourse and arched footbridge form a second plane behind the central activity.
vs=[];fs=[]
for i in range(141):
 x=-42+i*.6;z=-27+4*math.sin(x*.06);w=2.7+.5*math.sin(x*.19)
 for side in [-1,1]:vs.append((x,.065,z+side*w))
 if i<140:a=i*2;fs.append((a,a+1,a+3,a+2))
mesh('valley stream',vs,fs,'water:river')
for i in range(29):
 zz=-32.3+i*.37;y=.17+.55*math.sin(i/28*math.pi)
 ob=box('bridge deck',(2,y,zz),(3.4,.18,.36),'wood:cut',.05);solid((2,y,zz),(1.7,.09,.18))
for x in [.2,3.8]:
 tube('curving bridge rail',[(x,1.1,-32.5),(x,1.65,-27),(x,1.1,-21.8)],.095,'wood:dark')
 for z in [-32,-29.5,-27,-24.5,-22]:tube('bridge baluster',[(x,.2,z),(x,.7,z),(x,1.15+.5*math.sin((z+32.5)/10.7*math.pi),z)],.055,'wood:cedar')
# Smooth weathered river stones, each with an actual continuous silhouette.
for i in range(45):
 x=random.uniform(-43,43);z=-27+4*math.sin(x*.06)+(3.1 if i%2 else -3.1)
 ellipsoid('river bank boulder',(x,.35,z),(.7+random.random()*.7,.5+random.random()*.7,.55+random.random()*.7),'stone:rock',i)
# Branching broadleaf trees: irregular overlapping lobes and exposed branching, not a sphere-on-a-stick.
def tree(x,z,h,seed):
 y=height(x,z);rng=random.Random(seed);tube('branching oak',[(x,y,z),(x-.25,y+h*.27,z),(x+.2,y+h*.56,z+.15),(x,y+h*.78,z)],h*.055,'wood:cedar',[1,.76,.43,.12]);solid((x,y+h*.28,z),(h*.065,h*.28,h*.065))
 for i in range(6):
  a=i*2.399+seed;r=h*(.20+rng.random()*.08);cx=x+math.cos(a)*r;cz=z+math.sin(a)*r;cy=y+h*(.63+rng.random()*.16)
  tube('oak branch',[(x,y+h*.34,z),((x+cx)/2,y+h*.54,(z+cz)/2),(cx,cy,cz)],h*.023,'wood:dark',[1,.65,.08])
  ellipsoid('sculpted leaf cluster',(cx,cy,cz),(h*.23,h*.16,h*.20),'leaves:oak' if i%3 else 'leaves:lime',seed+i)
  ellipsoid('leaf tuft',(cx+.4,cy+h*.1,cz-.2),(h*.13,h*.12,h*.14),'leaves:lime',seed+i+9)
for k,(x,z,h) in enumerate([(-31,14,12),(-34,27,11),(-16,35,10),(9,37,12),(29,24,13),(34,10,12),(32,-12,11),(-33,-32,13),(-16,-38,12),(16,-40,12),(42,-32,13),(-49,-2,15),(-45,40,14),(45,43,16),(58,7,14),(-57,-47,17),(60,-48,15)]):tree(x,z,h,k+3)
for k in range(18):
 x=-64+k*7.5;z=-54-7*math.sin(k*1.7);tree(x,z,10+2*math.sin(k),k+50)
# Ferns, flowers and grass are assembled once here and exported as geometry.
def allowed(x,z):
 if abs(x)<9.4 and abs(z)<9.4:return False
 if math.hypot(x+13,z-18)<2.6 or math.hypot(x-15,z-11)<3.8:return False
 if (-30<x<-12 and -17<z<10) or (11<x<24 and -2<z<10):return False
 if abs(z-(-27+4*math.sin(x*.06)))<3.4 and abs(x)<44:return False
 return distpath(x,z)>.35
vs=[];fs=[];cs=[];basegreens=[rgb(h) for h in ['#459b47','#73ba48','#9dcb55']]
for i in range(5700):
 x=random.uniform(-65,65);z=random.uniform(-58,58)
 if not allowed(x,z):continue
 if math.sin(x*.29+math.sin(z*.21))*math.cos(z*.26)<-.25 and random.random()<.9:continue
 for k in range(6):
  a=random.random()*math.tau;h=random.uniform(.22,.62);w=random.uniform(.035,.065);bend=random.uniform(.12,.3);bx=x+random.uniform(-.22,.22);bz=z+random.uniform(-.22,.22);base=len(vs);green=random.choice(basegreens);y=height(bx,bz)
  for j in range(6):
   t=j/5
   for sign in [-1,1]:
    vs.append((bx+math.cos(a)*bend*t*t-math.sin(a)*w*sign*(1-t),y+h*t+.016,bz+math.sin(a)*bend*t*t+math.cos(a)*w*sign*(1-t)))
    cs.append(tuple(c*(.72+.28*t) for c in green)+(t,))
  for j in range(5):a=base+j*2;fs.append((a,a+1,a+3,a+2))
mesh('curved meadow grasses',vs,fs,'grass:blades',cs)
for i in range(90):
 x=random.uniform(-34,34);z=random.uniform(-38,35)
 if not allowed(x,z):continue
 y=height(x,z)
 for k in range(3):
  xx=x+random.uniform(-.5,.5);zz=z+random.uniform(-.5,.5);h=random.uniform(.35,.65)
  tube('flower stalk',[(xx,y,zz),(xx+.04,y+h*.6,zz),(xx+.08,y+h,zz)],.018,'leaves:oak')
  for j in range(5):a=j/5*math.tau;ellipsoid('wildflower petal',(xx+.08+math.cos(a)*.09,y+h,zz+math.sin(a)*.09),(.11,.045,.075),'default:flower' if i%2 else 'default:petal',j)
# Offline vertex-colour contact shading on ground: no startup geometry bake.
# Save editable objects, then evaluate modifiers and merge by material for the runtime GLB.
bpy.context.scene.world.color=(.25,.45,.7)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets-source/valley/sunvale.blend'))
# Convert the whole selection once; per-object operators repeatedly rebuild the depsgraph.
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active=next(o for o in bpy.context.selected_objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
# Give every mesh a linear vertex colour layer. The terrain and grass retain authored colour.
for ob in bpy.context.scene.objects:
 if ob.type!='MESH':continue
 if not ob.data.color_attributes:
  ca=ob.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
  # Subtle underside/contact occlusion is baked offline; runtime sunlight remains dynamic.
  vals=[]
  for v in ob.data.vertices:
   up=(ob.matrix_world.to_3x3()@v.normal).z;shade=.84+.16*max(0,up)
   vals.extend([shade,shade,shade,1])
  ca.data.foreach_set('color',vals);ob.data.color_attributes.active_color=ca
by_mat={}
for ob in list(bpy.context.scene.objects):
 if ob.type=='MESH':by_mat.setdefault(ob.data.materials[0].name,[]).append(ob)
for name,objs in by_mat.items():
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objs:ob.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=name
out=os.path.join(ROOT,'artifacts/sunvale-uncompressed.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_materials='EXPORT',export_attributes=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_yup=True)
json.dump({'solids':COLL,'version':'sunvale-v1'},open(os.path.join(ROOT,'src/game/assets/sunvale-collision.json'),'w'))
tris=sum(len(o.data.loop_triangles) or sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
json.dump({'seconds':time.time()-START,'bytes':os.path.getsize(out),'triangles':tris,'materialBatches':len(by_mat),'solids':len(COLL)},open(os.path.join(ROOT,'assets-source/valley/build.json'),'w'),indent=2)
print('SUNVALE_ASSET',time.time()-START,os.path.getsize(out),tris,flush=True)
