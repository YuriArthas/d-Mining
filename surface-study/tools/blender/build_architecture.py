"""Roblox-leaning toy village: broad chamfered forms with restrained pixel accents.
Run: blender -b --python tools/blender/build_architecture.py
The authoring helpers use Three's (x,y,z); P maps into Blender's Z-up system.
Geometry and texture together carry the style; no screen pixelation is involved.
"""
import bpy, bmesh, math, json, hashlib, struct, zlib, pathlib
from mathutils import Vector, Matrix

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/blockcraft'
OUT.mkdir(parents=True, exist_ok=True)
(ROOT/'source-art').mkdir(exist_ok=True)
(ROOT/'artifacts').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)

# 32-pixel motifs separated by two-pixel gutters. All marks are deliberately
# grouped, hand-placed rectangles; no photographic overlay or random noise.
SIZE=256; TILE=32
pixels=bytearray([255]*(SIZE*SIZE*4))
def rgb(h): return tuple(bytes.fromhex(h.lstrip('#')))
def rect(x,y,w,h,c):
    c=rgb(c) if isinstance(c,str) else c
    for yy in range(max(0,y),min(SIZE,y+h)):
        for xx in range(max(0,x),min(SIZE,x+w)):
            i=(yy*SIZE+xx)*4; pixels[i:i+4]=bytes((*c,255))
def tile(i,base,marks):
    ox=(i%8)*32; oy=(i//8)*32
    rect(ox,oy,32,32,base)
    for x,y,w,h,c in marks: rect(ox+x,oy+y,w,h,c)
# Large, quiet patches survive an overview. Strong outlines belong to geometry.
recipes=[
 ('192f46',[]), #0 quiet structural navy
 ('b5793f',[(4,5,24,3,'c38b4c'),(6,24,19,2,'aa713a')]), #1 broad timber
 ('e3aa60',[(4,5,24,3,'eebc77'),(7,24,17,2,'d49b54')]), #2 honey timber
 ('899cab',[(4,5,10,3,'9aabba'),(18,20,10,6,'8195a5')]), #3 quiet masonry
 ('f4e3bf',[(4,5,7,4,'f9ebce'),(22,23,6,4,'ecdab7')]), #4 plaster
 ('f18133',[(3,3,26,4,'f99646'),(4,26,24,2,'e7782f')]), #5 broad orange roof
 ('159aa5',[(3,3,26,4,'2daeb6'),(4,26,24,2,'128d98')]), #6 broad teal roof
 ('60d0e3',[(3,3,25,4,'91e5ed'),(4,7,6,9,'82dee9'),(21,21,7,7,'4cbcd4')]), #7 toy glazing
 ('f2be56',[(3,3,26,4,'ffd27a'),(5,26,24,3,'e2ad49')]), #8 gold accent
 ('4e7185',[(4,5,22,3,'608396'),(6,25,20,3,'45677c')]), #9 matte metal
 ('674833',[(4,6,24,3,'75543b')]), #10 dark timber
 ('bcc8cb',[(3,3,11,3,'cbd5d6'),(19,23,9,4,'afbdc3')]), #11 pale stone
 ('d86a2b',[(4,5,24,3,'e07832')]), #12 orange edge
 ('42bec5',[(3,3,24,4,'60cbd0')]), #13 teal highlight
 ('bd8749',[(10,3,2,26,'ab773f'),(22,3,2,26,'ab773f'),(4,6,4,11,'cb9859')]), #14 quiet door planks
 ('ffd079',[(4,4,24,24,'ffe2a1'),(8,8,16,16,'fff0c8')]), #15 lamp
 ('fff0cc',[(5,9,5,5,'34adb5'),(10,12,4,5,'34adb5'),(19,22,6,4,'e5bd70'),(22,18,5,5,'e5bd70')]), #16 egg ivory
 ('65d5cc',[(5,9,5,5,'fff0cc'),(10,12,4,5,'fff0cc'),(19,22,6,4,'209fa7'),(22,18,5,5,'209fa7')]), #17 egg teal
 ('c99cdd',[(5,9,5,5,'fff0cc'),(10,12,4,5,'fff0cc'),(19,22,6,4,'a575c5'),(22,18,5,5,'a575c5')]), #18 egg lavender
 ('506b82',[(4,5,10,3,'607b90'),(19,22,9,5,'47647b')]), #19 dark stone
 ('31576e',[(4,5,24,3,'3c647b')]), #20 navy metal
 ('f58a3b',[(4,4,24,4,'ffa055')]), #21 orange trim
 ('1b929d',[(4,4,24,4,'2ca5af')]), #22 teal trim
 ('dfba73',[(4,4,24,3,'eed09a')]), #23 broad straw
 ('fff0cc',[]), #24 solid egg ivory
 ('65d5cc',[]), #25 solid egg teal
 ('c99cdd',[]), #26 solid egg lavender
]
for i,(base,marks) in enumerate(recipes): tile(i,base,marks)
# Duplicate boundary pixels into the 2px gutters for mip-safe atlas islands.
for i in range(len(recipes)):
    ox=(i%8)*32; oy=(i//8)*32
    for yy in range(32):
        for xx in range(32):
            if xx<2 or xx>29 or yy<2 or yy>29:
                sx=ox+min(29,max(2,xx)); sy=oy+min(29,max(2,yy))
                src=(sy*SIZE+sx)*4; dst=((oy+yy)*SIZE+ox+xx)*4
                pixels[dst:dst+4]=pixels[src:src+4]
# Unused space intentionally opaque dark blue; helpful when inspecting UVs.
for i in range(len(recipes),64): tile(i,'192f46',[])
def png(path):
    raw=b''.join(b'\0'+pixels[y*SIZE*4:(y+1)*SIZE*4] for y in range(SIZE))
    def chunk(k,d): return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',SIZE,SIZE,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
ATLAS=OUT/'architecture-atlas.png'; png(ATLAS)
image=bpy.data.images.load(str(ATLAS)); image.name='Architecture_256_Handpainted_Pixels'; image.pack()
material=bpy.data.materials.new('Architecture_Pixel_Atlas_Opaque'); material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Roughness'].default_value=.96
bsdf.inputs['Metallic'].default_value=0; bsdf.inputs['Specular IOR Level'].default_value=.12
tex=material.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image; tex.interpolation='Closest'; tex.extension='EXTEND'
material.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])

P=lambda v:(v[0],-v[2],v[1])
MODELS={}; ACTIVE=None

def model(name,at=(0,0,0),yaw=0):
    global ACTIVE
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
    o.location=P(at); o.rotation_euler[2]=yaw
    o['authorship']='New Blender toy architecture with restrained hand-authored pixel accents'
    MODELS[name]=o; ACTIVE=o; return o

def mesh(name,verts,faces,tiles=0):
    me=bpy.data.meshes.new(name+'_Mesh'); me.from_pydata([P(v) for v in verts],[],faces); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); ob.parent=ACTIVE
    ob.data.materials.append(material)
    uv=me.uv_layers.new(name='PixelAtlas')
    # Face-local dominant axis projection gives meaningful orientation, including
    # diagonal joinery. UV islands use the guarded 28x28 interior of each tile.
    for p in me.polygons:
        p.use_smooth=False
        t=tiles[p.index] if isinstance(tiles,(tuple,list)) else tiles
        points=[Vector(verts[me.loops[j].vertex_index]) for j in p.loop_indices]
        a=(points[1]-points[0]); a.normalize()
        n=(points[1]-points[0]).cross(points[-1]-points[0]); n.normalize()
        b=n.cross(a); b.normalize()
        coords=[(v.dot(a),v.dot(b)) for v in points]
        lo=[min(v[j] for v in coords) for j in range(2)]; hi=[max(v[j] for v in coords) for j in range(2)]
        tx=(t%8)*32+2.5; ty=(t//8)*32+2.5
        for j,c in zip(p.loop_indices,coords):
            u=(c[0]-lo[0])/max(hi[0]-lo[0],1e-7); v=(c[1]-lo[1])/max(hi[1]-lo[1],1e-7)
            uv.data[j].uv=((tx+27*u)/SIZE,1-(ty+27*(1-v))/SIZE)
    return ob

def box(name,at,size,t=0):
    x,y,z=at; a,b,c=[s/2 for s in size]
    verts=[(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),
           (x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
    faces=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(7,6,2,3),(0,4,7,3),(2,6,5,1)]
    return mesh(name,verts,faces,t)

def beam(name,a,b,w,d,t=1):
    a,b=Vector(a),Vector(b); direction=(b-a).normalized()
    cross=Vector((0,0,1)) if abs(direction.z)<.9 else Vector((1,0,0))
    u=direction.cross(cross).normalized(); v=direction.cross(u).normalized()
    q=min(w,d)*.14
    section=[(-w/2+q,-d/2),(w/2-q,-d/2),(w/2,-d/2+q),(w/2,d/2-q),(w/2-q,d/2),(-w/2+q,d/2),(-w/2,d/2-q),(-w/2,-d/2+q)]
    verts=[tuple(p+u*su+v*sv) for p in (a,b) for su,sv in section]
    faces=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    return mesh(name,verts,faces,t)

def tilted_box(name,at,size,t,angle,axis='X'):
    ob=box(name,at,size,t); center=Vector(P(at)); rot=Matrix.Rotation(angle,3,axis)
    for v in ob.data.vertices: v.co=center+rot@(v.co-center)
    return ob

def prism(name,outline,z0,z1,t=0,side=None):
    outline=list(outline); n=len(outline)
    area=sum(outline[i][0]*outline[(i+1)%n][1]-outline[(i+1)%n][0]*outline[i][1] for i in range(n))
    if area<0:
        outline.reverse()
        if isinstance(side,(tuple,list)): side=[side[(n-2-i)%n] for i in range(n)]
    vs=[(x,y,z) for z in (z0,z1) for x,y in outline]
    fs=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    ts=[t,t]+([side]*n if isinstance(side,int) else side if side else [t]*n)
    return mesh(name,vs,fs,ts)

def slab(name,outline,y0,y1,t=0):
    # Outline counterclockwise in x,z; reverse top/bottom because Y is up.
    n=len(outline); vs=[(x,y,z) for y in (y0,y1) for x,z in outline]
    fs=[tuple(range(n)),tuple(reversed(range(n,n*2)))]+[(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
    return mesh(name,vs,fs,t)

def stepped_outline(w,h,q):
    a=w/2; b=h/2
    return [(-a+q,-b),(a-q,-b),(a,-b+q),(a,b-q),(a-q,b),(-a+q,b),(-a,b-q),(-a,-b+q)]

def window(name,at,w,h,side=False):
    # Author on the front, then transform vertices for an east-facing window.
    before=set(bpy.data.objects)
    x,y,z=at
    for tag,scale,dep,t in [('Outline',1,.18,0),('Glass',.78,.31,7)]:
        outline=[(xx*scale,yy*scale) for xx,yy in stepped_outline(w,h,min(w,h)*.16)]
        ob=prism(name+'_'+tag,outline,-.04,dep,t)
    box(name+'_CrossHorizontal',(0,0,.36),(w*.77,.18,.15),4)
    box(name+'_CrossVertical',(0,0,.36),(.18,h*.77,.15),4)
    box(name+'_Sill',(0,-h/2-.06,.18),(w+.3,.26,.55),2)
    for ob in set(bpy.data.objects)-before:
        for v in ob.data.vertices:
            # Return to Three space for the chosen orientation and local offset.
            xx,yy,zz=v.co.x,v.co.z,-v.co.y
            q=(x+zz,y+yy,z-xx) if side else (x+xx,y+yy,z+zz)
            v.co=P(q)

def door(name,at,w=1.8,h=2.8,t=14):
    x,y,z=at
    def outline(w,h,q):
        return [(-w/2,0),(w/2,0),(w/2,h-1.8*q),(w/2-.5*q,h-.6*q),(w/2-1.5*q,h),(-w/2+1.5*q,h),(-w/2+.5*q,h-.6*q),(-w/2,h-1.8*q)]
    prism(name+'_ChamferFrame',[(x+xx,y+yy-.08) for xx,yy in outline(w+.6,h+.35,.28)],z-.12,z+.08,0)
    prism(name+'_Leaf',[(x+xx,y+yy) for xx,yy in outline(w,h,.23)],z+.10,z+.22,t)
    for yy in (.46,1.65): box(name+'_WideBatten',(x,y+yy,z+.30),(w*.9,.23,.17),2)
    box(name+'_SquareHandle',(x+w*.29,y+1.18,z+.41),(.23,.23,.15),8)

def roof(name,width,depth,eave,rise,t=5,courses=4):
    # Closed continuous slopes with only four broad raised panels per side.
    # The thick navy end face is structural fascia, not a postprocess outline.
    half=width/2; courses=4; step=half/courses
    outline=[(-half,eave),(0,eave+rise),(half,eave),(half,eave-.38),(0,eave+rise-.38),(-half,eave-.38)]
    prism(name+'_ContinuousRoof',outline,-depth/2,depth/2,0,[t,t,0,0,0,0])
    for side in (-1,1):
        for j in range(courses):
            x0=side*(j*step+.035); x1=side*((j+1)*step-.035)
            y0=eave+rise*(1-abs(x0)/half)+.055
            y1=eave+rise*(1-abs(x1)/half)+.055
            panel=[(x0,y0),(x1,y1),(x1,y1-.10),(x0,y0-.10)]
            prism(name+'_BroadPanel',panel,-depth/2+.16,depth/2-.16,t)
    gable=[(-half+.20,eave-.20),(half-.20,eave-.20),(0,eave+rise-.30)]
    for sign in (-1,1):
        prism(name+'_Gable',gable,sign*(depth/2-.30)-.07,sign*(depth/2-.30)+.07,4)
    for xx in (-half,half): box(name+'_EaveBeam',(xx,eave-.17,0),(.40,.44,depth+.38),0)
    # A shallow bevelled ridge cap gives a single broad highlight at the apex.
    prism(name+'_Ridge',[(-.42,eave+rise-.02),(-.27,eave+rise+.23),(.27,eave+rise+.23),(.42,eave+rise-.02)],-depth/2-.12,depth/2+.12,21 if t==5 else 13)

def hip_roof(name,outline,rings,t=6):
    # A sealed eight-sided hip with large flat slopes and two gentle pitches.
    n=len(outline); verts=[(x*scale,y,z*scale) for scale,y in rings for x,z in outline]
    faces=[tuple(range(n)),tuple(reversed(range((len(rings)-1)*n,len(rings)*n)))]
    for k in range(len(rings)-1):
        for i in range(n):
            j=(i+1)%n; faces.append((k*n+i,(k+1)*n+i,(k+1)*n+j,k*n+j))
    return mesh(name,verts,faces,t)

def lamp(name,at,s=1):
    x,y,z=at
    box(name+'_Light',(x,y,z),(.43*s,.64*s,.43*s),15)
    for xx in (-.24,.24):
        for zz in (-.24,.24): box(name+'_Frame',(x+xx*s,y,z+zz*s),(.10*s,.74*s,.10*s),0)
    box(name+'_Base',(x,y-.38*s,z),(.64*s,.13*s,.64*s),0)
    box(name+'_Cap',(x,y+.39*s,z),(.66*s,.17*s,.66*s),0)
    box(name+'_CapStep',(x,y+.54*s,z),(.38*s,.14*s,.38*s),8)
    box(name+'_Hook',(x,y+.72*s,z),(.12*s,.25*s,.12*s),0)

def crate(name,at,s=1):
    x,y,z=at
    box(name+'_Body',(x,y+s/2,z),(s,s,s),1)
    for xx in (-.44,.44):
        for zz in (-.53,.53): box(name+'_Edge',(x+xx*s,y+s/2,z+zz*s),(.15*s,1.08*s,.13*s),2)
    for yy in (.08,.92):
        for zz in (-.54,.54): box(name+'_Rail',(x,y+yy*s,z+zz*s),(1.08*s,.15*s,.12*s),2)
    beam(name+'_Brace',(x-.36*s,y+.20*s,z+.61*s),(x+.36*s,y+.80*s,z+.61*s),.14*s,.10*s,2)

def barrel(name,at,s=1):
    x,y,z=at; outline=stepped_outline(1.0*s,1.0*s,.18*s)
    poly=[(xx+x,zz+z) for xx,zz in outline]
    slab(name+'_OctagonBody',poly,y,y+1.18*s,1)
    for yy in (.08,.94): slab(name+'_IronBand',[(x+(xx-x)*1.08,z+(zz-z)*1.08) for xx,zz in poly],y+yy*s,y+(yy+.16)*s,0)
    slab(name+'_Lid',poly,y+1.18*s,y+1.25*s,2)

# THE SHOP: oversized timber pavilion, broad orange slopes and toy joinery.
model('Merchant_Store',(-17,0,-1),.10)
box('Shop_Foundation',(0,.22,0),(8.5,.44,7.0),19)
box('Shop_FoundationCap',(0,.50,0),(8.7,.20,7.2),11)
box('Shop_PlasterVolume',(0,2.85,0),(7.7,4.70,6.5),4)
for xx in (-3.73,3.73):
    for zz in (-3.15,3.15):
        box('Shop_CornerTimber',(xx,2.90,zz),(.48,4.95,.48),10)
        for yy in (.88,1.38): box('Shop_CornerQuoin',(xx,yy,zz),(.67,.42,.67),3)
for yy in (.78,4.88):
    box('Shop_FrontLedger',(0,yy,3.32),(7.95,.38,.30),1)
    box('Shop_EastLedger',(3.90,yy,0),(.31,.38,6.5),1)
for xx in (-1.32,1.32): box('Shop_DoorPosts',(xx,2.83,3.35),(.32,4.05,.32),1)
roof('Shop_Roof',9.6,8.0,5.20,2.55)
box('Shop_GableKingpost',(0,6.18,3.70),(.40,1.75,.35),10)
window('Shop_GableWindow',(0,6.40,3.83),1.32,1.32)
for xx in (-2.53,2.53):
    window('Shop_FrontWindow',(xx,2.65,3.36),1.91,2.15)
    for side in (-1,1): box('Shop_Shutter',(xx+side*1.04,2.65,3.53),(.32,2.10,.25),21)
window('Shop_EastWindow',(3.91,2.92,-.2),2.65,2.45,True)
# One broad porch awning with four bold panel strips and clean fascia.
box('Shop_Porch',(0,.57,4.55),(8.9,.34,2.8),2)
tilted_box('Shop_Canopy',(0,4.04,4.48),(8.9,.28,2.65),6,math.atan(.54/2.65))
box('Shop_CanopyFascia',(0,3.77,5.80),(9.08,.38,.28),0)
for xx in (-3.4,-1.13,1.13,3.4):
    beam('Shop_CanopyPanelRib',(xx,4.36,3.18),(xx,3.82,5.78),.15,.13,13)
for xx in (-3.82,3.82):
    box('Shop_PorchPost',(xx,2.28,5.22),(.52,3.55,.52),10)
    box('Shop_PorchFoot',(xx,.95,5.22),(.76,.48,.76),3)
    beam('Shop_PorchBracket',(xx,3.02,5.22),(xx-math.copysign(.75,xx),3.65,5.22),.35,.35,2)
for z,y in ((6.12,.14),(5.65,.32)): box('Shop_EntryStep',(0,y,z),(3.5,.28,.70),11)
door('Shop_Door',(0,.76,3.39),1.76,2.76)
lamp('Shop_Lantern',(-1.30,3.30,3.85),.90)
box('Shop_Chimney',(2.60,7.05,-1.30),(1.14,3.20,1.27),3)
box('Shop_ChimneyCap',(2.60,8.70,-1.30),(1.55,.30,1.68),11)
box('Shop_ChimneyDarkMouth',(2.60,8.91,-1.30),(.92,.14,1.02),0)
# Pixel coin on a square hanging plate, no small lettering.
box('Shop_SignArm',(-4.16,4.74,4.03),(.24,.25,1.64),0)
box('Shop_SignDrop',(-4.16,4.24,4.73),(.18,.86,.18),0)
prism('Shop_SignInk',[(x-4.16,y+3.91) for x,y in stepped_outline(1.24,1.24,.25)],4.68,4.91,0)
prism('Shop_SignGold',[(x-4.16,y+3.91) for x,y in stepped_outline(.91,.91,.18)],4.92,5.03,8)
box('Shop_SignCoin',( -4.16,3.91,5.10),(.24,.54,.14),2)
crate('Shop_CrateA',(4.33,.15,1.80),1.12); crate('Shop_CrateB',(4.33,1.27,1.80),.78)
barrel('Shop_Barrel',(-4.60,.10,2.40),1)
box('Shop_BenchSeat',(2.40,1.15,4.75),(2.40,.24,.70),2)
for xx in (1.5,3.3): box('Shop_BenchFoot',(xx,.84,4.75),(.27,.60,.56),10)

# PET PAVILION: chamfered toy pavilion with continuous copper-green hips.
model('Pet_Conservatory',(17,0,3),-.13)
foot=stepped_outline(8.2,6.5,.9)
slab('Pet_Foundation',[(x*1.06,z*1.06) for x,z in foot],.04,.42,19)
slab('Pet_FoundationCap',[(x*1.08,z*1.08) for x,z in foot],.42,.64,11)
slab('Pet_Plaster',foot,.64,3.95,4)
for xx in (-3.20,3.20):
    for zz in (-3.23,3.23): box('Pet_CornerTimber',(xx,2.28,zz),(.44,3.52,.44),10)
for zz in (-2.32,2.32):
    for xx in (-4.08,4.08): box('Pet_SideTimber',(xx,2.28,zz),(.44,3.52,.44),10)
slab('Pet_HeavyEave',[(x*1.26,z*1.26) for x,z in foot],3.98,4.36,0)
hip_roof('Pet_ContinuousHip',foot,[(1.24,4.32),(.92,5.42),(.60,6.28)],6)
# Four broad corner ribs are secondary to the large calm teal roof planes.
for i in (1,3,5,7):
    x,z=foot[i]
    beam('Pet_HipRib',(x*1.24,4.38,z*1.24),(x*.60,6.33,z*.60),.17,.14,13)
# Clean gold cap and a toy roof lantern with a broad bevelled crown.
slab('Pet_RoofGoldCap',[(x*.60,z*.60) for x,z in foot],6.26,6.44,8)
box('Pet_LanternGlass',(0,6.88,0),(1.48,.95,1.48),7)
for xx in (-.76,.76):
    for zz in (-.76,.76): box('Pet_LanternCorner',(xx,6.90,zz),(.18,1.08,.18),8)
box('Pet_LanternBase',(0,6.42,0),(1.90,.20,1.90),0)
hip_roof('Pet_LanternRoof',stepped_outline(2.18,2.18,.30),[(1,7.36),(.68,7.78)],6)
box('Pet_LanternFinial',(0,7.97,0),(.46,.30,.46),8)
box('Pet_FrontLedger',(0,3.80,3.34),(6.65,.29,.33),1)
door('Pet_Door',(0,.65,3.30),1.76,2.74,6)
for xx in (-2.18,2.18): window('Pet_FrontWindow',(xx,2.52,3.32),1.48,1.60)
window('Pet_EastWindow',(4.15,2.40,0),2.35,2.25,True)
box('Pet_FirstStep',(0,.14,4.73),(3.55,.28,.80),3)
box('Pet_UpperStep',(0,.37,4.02),(3.25,.30,1.0),11)
lamp('Pet_Lantern',(1.25,3.26,3.72),.80)
# Egg sign uses chunky white geometric tiers, with atlas spots replacing specks.
prism('Pet_BadgeBacking',[(x,y+5.10) for x,y in stepped_outline(1.40,1.65,.28)],3.74,3.95,0)
prism('Pet_BadgeEgg',[(-.26,4.52),(.26,4.52),(.47,4.76),(.46,5.14),(.27,5.47),(.10,5.64),(-.10,5.64),(-.27,5.47),(-.46,5.14),(-.47,4.76)],3.98,4.13,16)

def egg(name,at,h,t):
    # A connected, solid eight-sided egg with four broad faceted bands. Atlas
    # V follows the WHOLE egg, so spots do not repeat as stripes on every band.
    x,y,z=at
    profile=[(0,.24),(.22,.42),(.62,.40),(.86,.25),(1.0,.10)]
    n=8; vs=[]
    for yy,r in profile:
        for i in range(n):
            a=2*math.pi*i/n+math.pi/8
            vs.append((x+math.cos(a)*r*h,y+yy*h,z+math.sin(a)*r*h))
    faces=[tuple(range(n)),tuple(reversed(range((len(profile)-1)*n,len(profile)*n)))]
    plain={16:24,17:25,18:26}[t]; tiles=[plain,plain]
    for k in range(len(profile)-1):
        for i in range(n):
            j=(i+1)%n
            faces.append((k*n+i,(k+1)*n+i,(k+1)*n+j,k*n+j))
            tiles.append(t if i in (0,2,5) else plain)
    ob=mesh(name+'_SolidEgg',vs,faces,tiles)
    for poly in ob.data.polygons:
        if poly.index<2: continue
        tile_index=tiles[poly.index]; facet=(poly.index-2)%n
        tx=(tile_index%8)*32+2.5; ty=(tile_index//8)*32+2.5
        for li in poly.loop_indices:
            vi=ob.data.loops[li].vertex_index; ring_index=vi//n
            u=0 if vi%n==facet else 1; v=profile[ring_index][0]
            ob.data.uv_layers.active.data[li].uv=((tx+27*u)/SIZE,1-(ty+27*(1-v))/SIZE)
# Pedestal is intentionally large and simple, the egg remains the focal detail.
nestx,nestz=-3.40,5.10
slab('Pet_NestFoot',[(nestx+x,nestz+z) for x,z in stepped_outline(3.45,3.0,.5)],.08,.46,11)
slab('Pet_NestGold',[(nestx+x,nestz+z) for x,z in stepped_outline(3.1,2.7,.45)],.46,.66,8)
slab('Pet_NestStraw',[(nestx+x,nestz+z) for x,z in stepped_outline(2.8,2.4,.4)],.66,.83,23)
egg('Pet_MainEgg',(nestx,.83,nestz),1.96,16)
egg('Pet_TealEgg',(nestx+.98,.83,nestz+.42),.93,17)
egg('Pet_LavenderEgg',(nestx-.90,.83,nestz+.57),.86,18)
barrel('Pet_Barrel',(4.62,.10,1.85),.80)

# FORGE: open bay and oversized masonry make it distinct from the closed shop.
model('Copper_Forge',(-20,0,-17),.12)
box('Forge_Foundation',(0,.26,0),(7.0,.52,5.8),19)
box('Forge_BackWall',(0,2.35,-2.08),(6.25,4.15,.85),4)
box('Forge_WestMasonry',(-2.65,1.92,-.10),(1.15,3.34,4.55),3)
for xx in (-2.82,2.82):
    box('Forge_FrontPost',(xx,2.52,2.34),(.62,4.50,.62),10)
    box('Forge_FrontFoot',(xx,.80,2.34),(.80,.55,.80),3)
    beam('Forge_Knee',(xx,3.25,2.34),(xx-math.copysign(.98,xx),4.32,2.34),.42,.42,2)
box('Forge_FrontHeader',(0,4.48,2.34),(6.16,.66,.64),0)
roof('Forge_Roof',7.8,6.40,4.70,1.80,6,4)
box('Forge_Chimney',(-1.74,5.47,-.92),(1.52,5.74,1.62),3)
box('Forge_ChimneyTop',(-1.74,8.38,-.92),(1.97,.32,2.07),11)
box('Forge_ChimneyMouth',(-1.74,8.62,-.92),(1.23,.17,1.33),0)
box('Forge_Furnace',(-1.20,1.45,.20),(2.28,2.17,2.10),19)
prism('Forge_FireHole',[(-1.95,.65),(-.45,.65),(-.45,1.60),(-.65,1.60),(-.65,1.88),(-1.75,1.88),(-1.75,1.60),(-1.95,1.60)],1.27,1.45,0)
box('Forge_Ember',(-1.20,1.0,1.48),(1.08,.42,.12),15)
box('Forge_Hearth',(-1.20,.64,1.58),(2.02,.24,.90),0)
for xx in (-1.62,-1.20,-.78): box('Forge_Coal',(xx,.91,1.60),(.29,.21,.40),21)
box('Forge_AnvilStump',(1.25,.79,1.48),(1.36,1.05,1.23),1)
box('Forge_AnvilFoot',(1.25,1.36,1.48),(1.15,.23,.95),0)
box('Forge_AnvilWaist',(1.25,1.59,1.48),(.70,.40,.68),9)
box('Forge_AnvilTop',(1.37,1.89,1.48),(1.65,.28,.92),9)
box('Forge_AnvilHornStep',(2.36,1.89,1.48),(.46,.22,.60),9)
box('Forge_AnvilHornTip',(2.70,1.91,1.48),(.25,.16,.36),9)
box('Forge_HammerHandle',(1.10,2.10,1.48),(.61,.12,.14),2)
box('Forge_HammerHead',(.83,2.15,1.48),(.29,.30,.40),0)
lamp('Forge_Lantern',(2.82,3.76,2.77),.90)
barrel('Forge_Barrel',(3.75,.10,-.25),.93); crate('Forge_Crate',(3.55,.10,1.38),.95)

# OPEN MINE: strong diagonal timber is the Roblox half of the fusion. The roof,
# wheel silhouette, footings and joinery provide the more Minecraft-like steps.
model('Mine_Headframe',(0,0,-11))
for side in (-1,1):
    for end in (-1,1):
        bx,bz=side*6.8,end*4.65; tx,tz=side*3.72,end*2.15
        box('Mine_Pier',(bx,.32,bz),(1.92,.64,1.92),19)
        box('Mine_PierCap',(bx,.72,bz),(1.64,.20,1.64),11)
        beam('Mine_MainLeg',(bx,.80,bz),(tx,13.85,tz),1.02,1.02,1)
        # Broad iron bands separated from masonry give clear material hierarchy.
        for f in (.10,.80):
            p=tuple(b+(t-b)*f for b,t in zip((bx,.80,bz),(tx,13.85,tz)))
            q=tuple(p[i]+((tx,13.85,tz)[i]-(bx,.80,bz)[i])*.035 for i in range(3))
            beam('Mine_IronCollar',p,q,1.14,1.14,0)
for end in (-1,1):
    box('Mine_CrossHeader',(0,10.68,end*2.75),(9.1,.82,.84),0)
    box('Mine_TopHeader',(0,13.85,end*2.17),(8.80,.84,.98),0)
    for side in (-1,1):
        beam('Mine_FrontBrace',(side*5.57,5.15,end*3.75),(side*.78,10.62,end*2.75),.61,.60,2)
        box('Mine_HeaderBolt',(side*3.55,10.70,end*3.22),(.23,.23,.13),8)
for side in (-1,1):
    beam('Mine_SideBraceA',(side*5.9,4.2,-3.9),(side*4.2,11.6,2.52),.52,.56,2)
    beam('Mine_SideBraceB',(side*5.9,4.2,3.9),(side*4.2,11.6,-2.52),.52,.56,2)
    box('Mine_SideHeader',(side*3.73,13.83,0),(.96,.84,5.75),0)
roof('Mine_Roof',10.70,6.50,14.30,2.25,5,5)
# Wheel is a true grid-stepped ring with a hole, not a painted circle.
wheelshape=[(math.cos(2*math.pi*i/12+math.pi/12)*2.20,math.sin(2*math.pi*i/12+math.pi/12)*2.20) for i in range(12)]

def ring(name,shape,inner,z0,z1,cy,t):
    n=len(shape); vs=[(x*s,y*s+cy,z) for z,s in ((z0,1),(z1,1),(z0,inner),(z1,inner)) for x,y in shape]
    fs=[]
    for i in range(n):
        j=(i+1)%n
        fs += [(i,j,j+n,i+n),(i+2*n,i+3*n,j+3*n,j+2*n),(i+n,j+n,j+3*n,i+3*n),(i,i+2*n,j+2*n,j)]
    return mesh(name,vs,fs,t)
ring('Mine_WheelIron',wheelshape,.70,2.62,3.06,12.35,0)
ring('Mine_WheelGold',[(x*.91,y*.91) for x,y in wheelshape],.86,3.07,3.20,12.35,8)
for i in range(6):
    a=i*math.pi/3; dx,dy=math.cos(a)*1.76,math.sin(a)*1.76
    beam('Mine_WheelSpoke',(0,12.35,2.93),(dx,12.35+dy,2.93),.42,.34,2)
prism('Mine_WheelHub',[(x,y+12.35) for x,y in stepped_outline(.98,.98,.22)],2.76,3.46,0)
prism('Mine_WheelHubGold',[(x,y+12.35) for x,y in stepped_outline(.51,.51,.12)],3.46,3.66,8)
for x in (-1.20,1.20):
    box('Mine_LiftGuide',(x,2.90,-.20),(.32,21.8,.33),9)
    box('Mine_LiftCable',(x*.60,6.20,-.20),(.13,15.0,.13),10)
box('Mine_LiftBase',(0,-3.80,-.20),(2.75,.32,2.38),0)
box('Mine_LiftTop',(0,-.92,-.20),(2.75,.25,2.38),9)
for x in (-1.20,1.20):
    for z in (-1.20,.80): box('Mine_LiftCorner',(x,-2.35,z),(.29,2.80,.29),0)
for z in (-1.20,.80):
    box('Mine_LiftGuard',(0,-2.73,z),(2.45,.28,.26),2)
    for x in (-.65,0,.65): box('Mine_LiftBar',(x,-3.22,z),(.16,.90,.16),9)
for i in range(7): box('Mine_AccessDeck',(-7.0+i*1.03,-.03,4.42),(.97,.30,1.84),2)
for z in (3.52,5.32):
    for x in (-7.35,-5.2,-3.10,-1.0): box('Mine_AccessPost',(x,.76,z),(.36,1.85,.36),0)
    box('Mine_AccessUpperRail',(-4.18,1.56,z),(6.75,.35,.35),2)
    box('Mine_AccessLowerRail',(-4.18,.86,z),(6.75,.23,.25),1)
beam('Mine_AccessBrace',(-6.50,-4.20,4.42),(-2.20,-.25,4.42),.42,.42,10)
lamp('Mine_DeckLantern',(-6.65,2.18,4.35),1.1)
box('Mine_RearLoadingFoot',(0,.29,-7.45),(5.85,.58,1.70),19)
for x in (-2,2): box('Mine_RearLoadingPost',(x,1.26,-7.45),(.30,1.94,.30),1)
box('Mine_RearLoadingRail',(0,2.15,-7.45),(4.60,.26,.28),2)

# BRIDGE: a shallow arch of nine wide boards, smooth thick rail segments.
model('Creek_Bridge',(2,0,24))
def deck(z): return .40+.90*(1-(z/5.22)**2)
for i in range(9):
    z=(i-4)*1.16; y=deck(z); slope=-1.8*z/(5.22*5.22)
    tilted_box('Bridge_WidePlank_%02d'%i,(0,y,z),(5.0,.35,1.12),2 if i%3 else 1,-math.atan(slope))
for x in (-2.33,2.33):
    anchors=[-5.22,-2.61,0,2.61,5.22]
    for z in anchors:
        y=deck(z)
        box('Bridge_Post',(x,y+.61,z),(.48,1.69,.48),0)
        box('Bridge_PostCap',(x,y+1.54,z),(.67,.20,.67),8)
    for za,zb in zip(anchors,anchors[1:]):
        beam('Bridge_Stringer',(x,deck(za)-.24,za),(x,deck(zb)-.24,zb),.56,.54,0)
        beam('Bridge_Handrail',(x,deck(za)+1.29,za),(x,deck(zb)+1.29,zb),.44,.40,2)
        beam('Bridge_LowerRail',(x,deck(za)+.60,za),(x,deck(zb)+.60,zb),.27,.25,1)
for z in (-5.70,5.70):
    box('Bridge_Masonry',(0,-.48,z),(5.90,1.38,1.60),19)
    box('Bridge_MasonryCap',(0,.28,z),(6.24,.30,1.80),11)
    for x in (-2.76,2.76):
        box('Bridge_EndPier',(x,.79,z),(.80,1.03,.80),3)
        box('Bridge_EndPierCap',(x,1.35,z),(1.02,.23,1.02),11)
lamp('Bridge_NorthLantern',(-2.76,1.89,-5.70),.82)
lamp('Bridge_SouthLantern',(2.76,1.89,5.70),.82)

# PLAZA PROPS retain the previous placement anchors, but every mesh is new.
model('Ore_Cart',(8.9,.08,-4.4),-.32)
box('Cart_Chassis',(0,.66,0),(2.05,.24,2.65),0)
box('Cart_TubFloor',(0,.91,0),(2.10,.34,2.65),9)
# A two-step flare is intentionally voxel-like without becoming a solid crate.
for y,w in ((1.22,2.28),(1.64,2.52)):
    for x in (-w/2,w/2): box('Cart_Side',(x,y,0),(.20,.44,2.72),9)
    for z in (-1.32,1.32): box('Cart_End',(0,y,z),(w,.44,.20),9)
for x in (-1.32,1.32): box('Cart_GoldRim',(x,1.92,0),(.18,.18,2.94),8)
for z in (-1.40,1.40): box('Cart_EndRim',(0,1.92,z),(2.80,.18,.18),8)
# Wheel geometry authored front then rotated to the cart side.
for x in (-1.12,1.12):
    for z in (-.88,.88):
        o=prism('Cart_PixelWheel',[(xx,yy+.45) for xx,yy in stepped_outline(.90,.90,.18)],-.12,.12,0)
        for v in o.data.vertices:
            xx,yy,zz=v.co.x,v.co.z,-v.co.y; v.co=P((x+zz,yy,z-xx))
        box('Cart_AxleCap',(x+math.copysign(.18,x),.45,z),(.18,.28,.28),8)
for x,z,s in ((-.55,-.62,.64),(.40,-.58,.74),(-.46,.51,.78),(.54,.45,.60),(0,0,.86)):
    box('Cart_OreBlock',(x,1.68+s*.22,z),(s,s*.64,s),19)
box('Cart_GoldOre',(0,2.08,0),(.54,.60,.58),8)
box('Cart_GoldOreStep',(.13,2.45,.04),(.30,.18,.34),8)
model('Ore_Crates',(10.8,.03,-5.9),.18)
crate('Plaza_CrateA',(0,0,0),.90); crate('Plaza_CrateB',(.10,.90,.06),.65)
model('Plaza_Signpost',(-3.7,.04,13.1),-.15)
box('Signpost_Timber',(0,1.57,0),(.40,3.14,.40),0)
box('Signpost_Cap',(0,3.22,0),(.68,.18,.68),21)
prism('Signpost_MineArrow',[(-1.35,2.20),(.90,2.20),(1.25,2.475),(.90,2.75),(-1.35,2.75)],-.13,.13,2)
prism('Signpost_PetArrow',[(1.22,1.38),(-.75,1.38),(-1.08,1.65),(-.75,1.92),(1.22,1.92)],-.13,.13,6)
beam('Signpost_PickHandle',(-.40,2.25,.23),(.08,2.68,.23),.15,.13,0)
beam('Signpost_PickHead',(-.25,2.66,.24),(.28,2.35,.24),.20,.14,0)
prism('Signpost_Egg',[(xx,yy+1.65) for xx,yy in stepped_outline(.29,.37,.07)],.17,.29,16)
for i,(x,z,yaw) in enumerate(((-9.8,7.4,.1),(8.5,10.3,-.4))):
    model('Plaza_Lamp_%d'%i,(x,0,z),yaw)
    box('Lamp_Post',(0,1.80,0),(.41,3.60,.41),0)
    box('Lamp_Foot',(0,.26,0),(.75,.52,.75),3)
    box('Lamp_Arm',(.39,3.52,0),(1.17,.31,.31),1)
    beam('Lamp_Bracket',(0,2.92,0),(.66,3.52,0),.26,.26,2)
    lamp('Lamp_Lantern',(.78,3.13,0),1.05)

# A bounded set of prominent block edges receive a single broad chamfer.
# Main diagonal beams already have eight-sided sections, so no bevel modifier
# is applied to them. Preserve nearest sampling and the authored atlas UVs.
bevel_count=0
for ob in [o for o in bpy.data.objects if o.type=='MESH']:
    prominent=any(key in ob.name for key in ('Shop_CornerTimber','Shop_PorchPost','Forge_FrontPost','Pet_CornerTimber','Pet_SideTimber','Bridge_PostCap','Shop_FoundationCap','Pet_FoundationCap','Bridge_MasonryCap'))
    if not prominent: continue
    bpy.context.view_layer.objects.active=ob
    mod=ob.modifiers.new('BroadSingleChamfer','BEVEL'); mod.width=.055; mod.segments=1
    mod.affect='EDGES'; mod.limit_method='ANGLE'; mod.angle_limit=.50
    bpy.ops.object.modifier_apply(modifier=mod.name); bevel_count+=1

# Explicit triangulation removes zero-area triangles produced at collinear
# stepped polygon vertices, while retaining every visible outline and UV.
removed_degenerate=0
for ob in [o for o in bpy.data.objects if o.type=='MESH']:
    bm=bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='BEAUTY')
    zero=[f for f in bm.faces if f.calc_area()<1e-8]
    removed_degenerate+=len(zero)
    if zero: bmesh.ops.delete(bm,geom=zero,context='FACES_ONLY')
    bm.to_mesh(ob.data); bm.free(); ob.data.update()

# Every object owns a useful origin for the parent's spatial batching.
for ob in [o for o in bpy.data.objects if o.type=='MESH']:
    lo=Vector(tuple(min(v.co[a] for v in ob.data.vertices) for a in range(3)))
    hi=Vector(tuple(max(v.co[a] for v in ob.data.vertices) for a in range(3)))
    center=(lo+hi)*.5
    for v in ob.data.vertices: v.co-=center
    ob.location+=center

# Static authoring verification; rendering is deliberately left to the public
# scene after parent publication. Flat normals and UVs are exported explicitly.
bpy.context.view_layer.update()
stats=[]; all_bounds=[]; geometry_checks={'negativeVolumes':[], 'zeroAreaTriangles':0, 'collinearTrianglesRemoved':removed_degenerate,'singleChamferObjects':bevel_count,'nonFinitePositions':0}
for name,root in MODELS.items():
    children=list(root.children_recursive); tris=0; verts=0; bb=[]
    for ob in children:
        if ob.type!='MESH': continue
        ob.data.calc_loop_triangles(); tris+=len(ob.data.loop_triangles); verts+=len(ob.data.vertices)
        for vert in ob.data.vertices:
            if not all(math.isfinite(v) for v in vert.co): geometry_checks['nonFinitePositions']+=1
        volume=0
        for tri in ob.data.loop_triangles:
            a,b,c=[ob.data.vertices[i].co for i in tri.vertices]
            volume+=a.dot(b.cross(c))/6
            if (b-a).cross(c-a).length<1e-8: geometry_checks['zeroAreaTriangles']+=1
        if volume < -1e-6: geometry_checks['negativeVolumes'].append({'name':ob.name,'volume':volume})
        assert ob.data.uv_layers.active, ob.name+' lacks UVs'
        for uv in ob.data.uv_layers.active.data: assert all(math.isfinite(v) and 0<=v<=1 for v in uv.uv),ob.name
        for v in ob.bound_box:
            p=ob.matrix_world@Vector(v); bb.append((p.x,p.z,-p.y))
    all_bounds+=bb
    stats.append({'name':name,'meshes':len(children),'triangles':tris,'vertices':verts,'worldBounds':{'min':[round(min(v[a] for v in bb),4) for a in range(3)],'max':[round(max(v[a] for v in bb),4) for a in range(3)]}})
assert not geometry_checks['negativeVolumes'],geometry_checks
assert geometry_checks['zeroAreaTriangles']==0,geometry_checks
assert geometry_checks['nonFinitePositions']==0,geometry_checks
bpy.context.preferences.filepaths.save_version=0
source=ROOT/'source-art/architecture.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
glb=OUT/'architecture.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
report={'schema':1,'authorship':'New Blender-authored toy architecture with broad continuous roofs, chunky chamfers and restrained pixel accents; no imported or simplified prior models','blenderVersion':bpy.app.version_string,'coordinateConvention':'Source helpers Three Y-up -> Blender (x,-z,y), exported glTF Y-up','atlas':{'file':str(ATLAS.relative_to(ROOT)),'size':[256,256],'usedTiles':len(recipes),'tilePixels':32,'filter':'Closest / glTF NEAREST','pixelArt':'Low contrast sparse grouped marks; large calm toy-color areas, limited plank/glass/egg accents; no random noise','sha256':sha(ATLAS)},'geometryChecks':geometry_checks,'models':stats,'triangles':sum(s['triangles'] for s in stats),'vertices':sum(s['vertices'] for s in stats),'meshCount':sum(s['meshes'] for s in stats),'worldBounds':{'min':[round(min(v[a] for v in all_bounds),4) for a in range(3)],'max':[round(max(v[a] for v in all_bounds),4) for a in range(3)]},'files':{str(p.relative_to(ROOT)):{'bytes':p.stat().st_size,'sha256':sha(p)} for p in (pathlib.Path(__file__).resolve(),source,glb,ATLAS)}}
(ROOT/'artifacts/architecture-asset.json').write_text(json.dumps(report,indent=2)+'\n')
print('ARCHITECTURE_ASSET '+json.dumps({k:report[k] for k in ('triangles','vertices','meshCount','worldBounds')}))
