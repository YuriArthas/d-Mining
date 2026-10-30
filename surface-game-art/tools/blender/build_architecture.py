"""Roblox-leaning toy village: broad chamfered forms with restrained pixel accents.
Run: blender -b --python tools/blender/build_architecture.py
The authoring helpers use Three's (x,y,z); P maps into Blender's Z-up system.
Geometry and texture together carry the style; no screen pixelation is involved.
Each model says how it collides right after its parts (solid, solid_of, mesh_solid or passable, collision.py).
"""
import bpy, bmesh, math, json, hashlib, struct, zlib, pathlib, sys
from mathutils import Vector, Matrix
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import collision

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/pinewind'
OUT.mkdir(parents=True, exist_ok=True)
(ROOT/'source-art').mkdir(exist_ok=True)
(ROOT/'artifacts').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)

layout=json.loads((ROOT/'layout.json').read_text())

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
 ('5e3b28',[]), #0 walnut structure, warm like the original's dark timber
 ('b5793f',[(4,5,24,3,'c38b4c'),(6,24,19,2,'aa713a')]), #1 broad timber
 ('e3aa60',[(4,5,24,3,'eebc77'),(7,24,17,2,'d49b54')]), #2 honey timber
 ('b0a89e',[(4,5,10,3,'bdb5ab'),(18,20,10,6,'a49c92')]), #3 quiet warm masonry
 ('f4e3bf',[(4,5,7,4,'f9ebce'),(22,23,6,4,'ecdab7')]), #4 plaster
 ('f18133',[(3,3,26,4,'f99646'),(4,26,24,2,'e7782f')]), #5 broad orange roof
 ('159aa5',[(3,3,26,4,'2daeb6'),(4,26,24,2,'128d98')]), #6 broad teal roof
 ('60d0e3',[(3,3,25,4,'91e5ed'),(4,7,6,9,'82dee9'),(21,21,7,7,'4cbcd4')]), #7 toy glazing
 ('f2be56',[(3,3,26,4,'ffd27a'),(5,26,24,3,'e2ad49')]), #8 gold accent
 ('7a7069',[(4,5,22,3,'887e76'),(6,25,20,3,'6d645d')]), #9 matte warm iron
 ('674833',[(4,6,24,3,'75543b')]), #10 dark timber
 ('e2dace',[(3,3,11,3,'ebe4d9'),(19,23,9,4,'d5cdc0')]), #11 pale cream stone
 ('d86a2b',[(4,5,24,3,'e07832')]), #12 orange edge
 ('42bec5',[(3,3,24,4,'60cbd0')]), #13 teal highlight
 ('bd8749',[(10,3,2,26,'ab773f'),(22,3,2,26,'ab773f'),(4,6,4,11,'cb9859')]), #14 quiet door planks
 ('ffd079',[(4,4,24,24,'ffe2a1'),(8,8,16,16,'fff0c8')]), #15 lamp
 ('fff0cc',[(5,9,5,5,'34adb5'),(10,12,4,5,'34adb5'),(19,22,6,4,'e5bd70'),(22,18,5,5,'e5bd70')]), #16 egg ivory
 ('65d5cc',[(5,9,5,5,'fff0cc'),(10,12,4,5,'fff0cc'),(19,22,6,4,'209fa7'),(22,18,5,5,'209fa7')]), #17 egg teal
 ('c99cdd',[(5,9,5,5,'fff0cc'),(10,12,4,5,'fff0cc'),(19,22,6,4,'a575c5'),(22,18,5,5,'a575c5')]), #18 egg lavender
 ('8c8279',[(4,5,10,3,'998f86'),(19,22,9,5,'7f756c')]), #19 warm grey stone
 ('9a3d2c',[(4,5,24,3,'b04a36')]), #20 rust-red band
 ('f58a3b',[(4,4,24,4,'ffa055')]), #21 orange trim
 ('1b929d',[(4,4,24,4,'2ca5af')]), #22 teal trim
 ('dfba73',[(4,4,24,3,'eed09a')]), #23 broad straw
 ('fff0cc',[]), #24 solid egg ivory
 ('65d5cc',[]), #25 solid egg teal
 ('c99cdd',[]), #26 solid egg lavender
]
def shade(h,f):
    c=rgb(h); return ''.join('%02x'%int(round(v*(1+f) if f<0 else v+(255-v)*f)) for v in c)
GRASS_TILE=len(recipes)
recipes.append(('6cc24a',[(3,4,9,3,'7fd15a'),(17,9,8,3,'7fd15a'),(6,21,10,3,'5fb43f'),(20,24,7,3,'5fb43f')])) # terrace grass
PACK_ROOF=len(recipes)
recipes.append(('d9483b',[(3,3,26,4,'e8604f'),(4,26,24,2,'c43d31')])) # backpack shop's broad red roof
# Bridge boards in three close honey tones. Grain sits mid-board: bands along a board's edges read as stair
# nosings once boards line up along an arch.
DECK_TILES=[]
for base,marks in (('e2a85e',[(4,13,11,2,'d59a52'),(19,18,9,2,'eab570')]),('d99f57',[(6,11,9,2,'cc914c'),(17,19,11,2,'e3aa63')]),('e9b46b',[(3,16,12,2,'dca55f'),(20,10,8,2,'f0c07c')])):
    DECK_TILES.append(len(recipes)); recipes.append((base,marks))
# Each egg gets its own body colour; ivory and deep spots keep the established egg motif.
EGG_TILES={}
for e in layout['eggs']:
    base=shade(e['color'],.16); deep=shade(e['color'],-.32)
    spotted=len(recipes); recipes.append((base,[(5,9,5,5,'fff0cc'),(10,12,4,5,'fff0cc'),(19,22,6,4,deep),(22,18,5,5,deep)]))
    plain=len(recipes); recipes.append((base,[]))
    EGG_TILES[e['id']]=(spotted,plain)
# Portal scenery: the caves around the teleport station and the next worlds beside the gate.
def add_tile(base,marks): recipes.append((base,marks)); return len(recipes)-1
CAP_TILE=add_tile('e5582c',[(3,3,26,3,'ee6a3a'),(4,26,24,3,'cf4a24')])
SPOT_TILE=add_tile('e5582c',[(10,7,12,18,'fff1d0'),(7,10,18,12,'fff1d0')])
GILL_TILE=add_tile('ecc58c',[(3,6,26,2,'dcae74'),(3,14,26,2,'dcae74'),(3,22,26,2,'dcae74')])
PURPLE_TILE=add_tile('a46cf5',[(4,4,6,24,'c9a2ff'),(20,6,4,20,'8b56dd')])
BLUE_TILE=add_tile('46b2f5',[(4,4,6,24,'96dcff'),(20,6,4,20,'2f93dd')])
ROCK_TILE=add_tile('8a8290',[(4,5,10,3,'9a93a0'),(18,20,9,5,'7b7383')])
TEAL_TILE=add_tile('4fe0d0',[(4,4,6,24,'a2f6ec'),(20,6,4,20,'2fbfb0')])
ICE_TILE=add_tile('bde7fb',[(4,4,7,22,'eaf9ff'),(19,8,5,18,'9cd2f0')])
SNOW_TILE=add_tile('f5fbff',[(4,6,10,3,'e1eef8'),(18,20,9,3,'e1eef8')])
BASALT_TILE=add_tile('584a42',[(4,5,11,3,'6a5b52'),(17,20,10,4,'4a3d36')])
MAGMA_TILE=add_tile('ff7a1c',[(4,6,12,3,'ffc83c'),(14,16,13,3,'ffb02e'),(6,24,8,3,'ffd85a')])
SAND_TILE=add_tile('f0d08c',[(4,6,11,3,'f7deaa'),(17,19,10,3,'e2bc72')])
CACTUS_TILE=add_tile('45b04c',[(6,2,3,28,'67cc6c'),(16,2,3,28,'379a40'),(25,2,3,28,'67cc6c')])
METEOR_TILE=add_tile('6f6590',[(4,5,10,3,'81779f'),(18,20,9,5,'615783')])
BEACON_TILE=add_tile('9ff4ff',[(6,6,20,20,'d8fdff')])
assert len(recipes)<=64, 'atlas full'
# Tiles that light themselves (lamp glass, the beacon, magma, crystals, ice): the game adds each one's own
# colour as emission at this strength, so they stay bright in shade (StaticSurface/albedoLift.ts).
GLOW={15:.8,BEACON_TILE:.9,MAGMA_TILE:.75,PURPLE_TILE:.3,BLUE_TILE:.3,TEAL_TILE:.3,ICE_TILE:.18}
assert len(GLOW)<=12
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
# Soft halos the game draws round lights (lamp glass, the beacon, magma), in their model's own frame.
HALOS=[]
def halo(ob,at,size,color): HALOS.append({'object':ob,'node':ACTIVE.name,'at':[round(v,3) for v in at],'size':size,'color':color})

def model(name,at=(0,0,0),yaw=0):
    global ACTIVE
    taken=bpy.data.objects.get(name)
    if taken: assert name not in MODELS,'two models named '+name; taken.name=name+'_Part'
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
    o.location=P(at); o.rotation_euler[2]=yaw
    o['authorship']='New Blender toy architecture with restrained hand-authored pixel accents'
    MODELS[name]=o; ACTIVE=o; return o

# The active model's collision (collision.py): boxes and hulls in its own frame, its triangles, or nothing.
def solid(at,size,yaw=0): collision.solid(ACTIVE,at,size,yaw)
def solid_of(parts=None,hull=False): collision.solid_of(ACTIVE,parts,hull)
def mesh_solid(): collision.mesh_solid(ACTIVE)
def passable(reason): collision.passable(ACTIVE,reason)

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

def ngon(r,n,phase=0.,sx=1.,sz=1.,wobble=None):
    """A ring of n points in x,z, angle increasing like octagon(); wobble scales each point's radius."""
    return [(math.cos(phase+2*math.pi*i/n)*r*sx*(1+(wobble[i%len(wobble)] if wobble else 0)),
             math.sin(phase+2*math.pi*i/n)*r*sz*(1+(wobble[i%len(wobble)] if wobble else 0))) for i in range(n)]

def loft(name,rings,bands,bottom=None,top=None,apex=None,at=(0,0,0),tilt=(0,0),spin=0):
    """A closed solid through stacked rings [(y, ngon outline)], bottom to top: a flat bottom, one tile per band
    between rings, then a flat top or a point at `apex`. Tilted about its base centre (radians about X, then Z),
    turned by `spin` about Y and moved to `at`."""
    n=len(rings[0][1]); verts=[(x,y,z) for y,outline in rings for x,z in outline]
    faces=[tuple(range(n))]; ts=[bottom if bottom is not None else bands[0]]
    for k in range(len(rings)-1):
        a=k*n; b=a+n
        for i in range(n): faces.append((a+i,b+i,b+(i+1)%n,a+(i+1)%n)); ts.append(bands[min(k,len(bands)-1)])
    last=(len(rings)-1)*n; cap=top if top is not None else bands[-1]
    if apex is None: faces.append(tuple(reversed(range(last,last+n)))); ts.append(cap)
    else:
        verts.append(apex)
        for i in range(n): faces.append((last+i,len(verts)-1,last+(i+1)%n)); ts.append(cap)
    turn=Matrix.Rotation(spin,3,'Y')@Matrix.Rotation(tilt[1],3,'Z')@Matrix.Rotation(tilt[0],3,'X')
    return mesh(name,[tuple(Vector(at)+turn@Vector(v)) for v in verts],faces,ts)

def annulus(name,cx,cz,r0,r1,y0,y1,n,t):
    """A flat ring lying on the ground (a pad's rim): outer wall, inner wall, top and bottom."""
    o=[(cx+x,cz+z) for x,z in ngon(r1,n)]; i=[(cx+x,cz+z) for x,z in ngon(r0,n)]
    vs=[(x,y,z) for y in (y0,y1) for x,z in o]+[(x,y,z) for y in (y0,y1) for x,z in i]
    fs=[]
    for k in range(n):
        j=(k+1)%n
        fs+=[(k,k+n,j+n,j),(2*n+k,2*n+j,3*n+j,3*n+k),(n+k,3*n+k,3*n+j,n+j),(k,j,2*n+j,2*n+k)]
    return mesh(name,vs,fs,t)

def clip_front(outline,zmax):
    """Cut an outline (x,z) by the plane z=zmax, keeping the back; the order is kept."""
    out=[]
    for i,(x0,z0) in enumerate(outline):
        x1,z1=outline[(i+1)%len(outline)]
        if z0<=zmax: out.append((x0,z0))
        if (z0<=zmax)!=(z1<=zmax): t=(zmax-z0)/(z1-z0); out.append((x0+(x1-x0)*t,zmax))
    return out

def teleport_pad(name,cx,cz,radius):
    """A round pad flush with the ground where a portal's zone is: a stone rim with a gold lip round a teal
    pool (the game draws the glowing water over the pool)."""
    annulus(name+'_Rim',cx,cz,radius-.22,radius+.18,-.06,.12,24,19)
    annulus(name+'_GoldLip',cx,cz,radius-.3,radius-.18,-.06,.14,24,8)
    slab(name+'_Pool',[(cx+x,cz+z) for x,z in ngon(radius-.26,24)],-.06,.07,13)

def crystal(name,at,h,r,tilt,spin,t):
    """A six-sided crystal with a pointed tip, standing from `at`."""
    return loft(name,[(0,ngon(r,6)),(h*.7,ngon(r*1.06,6))],[t],apex=(0,h,0),at=at,tilt=tilt,spin=spin)

def decor_mushroom(name,at,spin=0):
    x,y,z=at
    for k,(dx,dz,s,turn) in enumerate(((0,0,1,0),(1.15,.85,.38,.6),(-.95,1.05,.3,1.3),(.9,-.95,.26,2.1))):
        base=(x+dx,y-.1,z+dz)
        stem=loft(name+'_Stem',[(0,ngon(.62*s,8)),(.35*s,ngon(.55*s,8)),(1.9*s,ngon(.42*s,8)),(2.25*s,ngon(.5*s,8))],[4],at=base,spin=spin+turn)
        cap=loft(name+'_Cap',[(2.15*s,ngon(.45*s,10)),(2.05*s,ngon(1.55*s,10)),(2.45*s,ngon(1.68*s,10)),(2.95*s,ngon(1.35*s,10)),(3.3*s,ngon(.75*s,10))],
             [GILL_TILE,CAP_TILE,SPOT_TILE,SPOT_TILE],bottom=GILL_TILE,top=CAP_TILE,apex=(0,3.42*s,0),at=base,spin=spin+turn)
        # The big one's cap is over the head; the small ones' caps are at body height.
        solid_of([stem],hull=True)
        if s<.5: solid_of([cap],hull=True)

def decor_crystals(name,at,spin=0):
    x,y,z=at; wob=[.05,-.08,.1,-.04,.07,-.1,0]
    loft(name+'_Rock',[(-.1,ngon(1.05,7,0,1,1,wob)),(.3,ngon(1.0,7,.2,1,1,wob)),(.55,ngon(.62,7,.4,1,1,wob))],[ROCK_TILE],at=(x,y,z),spin=spin)
    turn=Matrix.Rotation(spin,3,'Y')
    for (dx,dy,dz),h,r,tilt,t in (((0,.2,-.1),2.5,.36,(-.08,.06),BLUE_TILE),((.5,.15,.25),1.75,.3,(.3,-.35),TEAL_TILE),((-.55,.15,.2),1.4,.27,(.32,.4),PURPLE_TILE),
                                  ((.2,.15,-.55),1.15,.24,(-.4,-.2),TEAL_TILE),((-.4,.15,-.45),.85,.2,(-.35,.45),BLUE_TILE)):
        crystal(name+'_Crystal',tuple(Vector((x,y,z))+turn@Vector((dx,dy,dz))),h,r,tilt,spin,t)
    solid_of(name,hull=True)

def decor_ice(name,at,spin=0):
    x,y,z=at; turn=Matrix.Rotation(spin,3,'Y')
    loft(name+'_Snow',[(-.1,ngon(1.45,8,0,1,1,[.06,-.05,.08,0,-.07,.05,-.03,.04])),(.12,ngon(1.3,8,.2)),(.24,ngon(.85,8,.4))],[SNOW_TILE],at=(x,y,z),spin=spin)
    for (dx,dz),h,phase in (((0,0),3.1,0),((.95,.55),2.3,.4),((-.85,.6),1.7,.9)):
        base=tuple(Vector((x,y+.1,z))+turn@Vector((dx,0,dz))); w=h*.3
        loft(name+'_Spike',[(0,ngon(.8*w,6,phase)),(.18*h,ngon(.64*w,6,phase))],[ICE_TILE],apex=(0,.62*h,0),at=base,spin=spin)
        loft(name+'_SpikeTop',[(.4*h,ngon(.58*w,6,phase+.5)),(.52*h,ngon(.45*w,6,phase+.5))],[ICE_TILE],apex=(0,h,0),at=base,spin=spin)
    crystal(name+'_Shard',tuple(Vector((x,y+.1,z))+turn@Vector((.65,0,-.75))),.85,.16,(-.3,-.3),spin,ICE_TILE)
    solid_of(name,hull=True)

def decor_lava(name,at,spin=0):
    x,y,z=at; turn=Matrix.Rotation(spin,3,'Y'); wob=[.06,-.07,.09,-.05,.04,-.09,.02]
    basalt=loft(name+'_Basalt',[(-.1,ngon(1.2,7,0,1,1,wob)),(.4,ngon(1.12,7,.25,1,1,wob)),(.75,ngon(.82,7,.5,1,1,wob)),(.62,ngon(.55,7,.5,1,1,wob))],[BASALT_TILE],top=MAGMA_TILE,at=(x,y,z),spin=spin)
    halo(basalt,(x,y+.85,z),2.0,'ff8a2a')
    for (dx,dz),h,r,tilt in (((.95,.5),.9,.18,(.3,-.35)),((1.1,-.25),.6,.15,(-.2,-.4)),((-1.0,.35),.7,.16,(.3,.35))):
        crystal(name+'_Ember',tuple(Vector((x,y,z))+turn@Vector((dx,0,dz))),h,r,tilt,spin,MAGMA_TILE)
    loft(name+'_Pebble',[(-.05,ngon(.42,6,.3,1,1,[.1,-.1,.05])),(.3,ngon(.25,6,.6))],[BASALT_TILE],at=tuple(Vector((x,y,z))+turn@Vector((-.85,0,-.85))),spin=spin)
    solid_of([name+'_Basalt',name+'_Ember'],hull=True)

def decor_desert(name,at):
    x,y,z=at; k=1.35; wob=[.04,-.06,.08,-.03,.05,-.07,.03,-.05,.06]
    loft(name+'_Dune',[(-.5,ngon(1.75*k,9,0,1.15,.9,wob)),(.15,ngon(1.6*k,9,.1,1.15,.9,wob)),(.6,ngon(1.1*k,9,.2,1.1,.85,wob)),(.85,ngon(.55*k,9,.3))],[SAND_TILE],at=(x,y,z))
    def cactus(cx,cz,s,arms=True):
        loft(name+'_Cactus',[(0,ngon(.3*s,8,math.pi/8)),(2.2*s,ngon(.3*s,8,math.pi/8)),(2.42*s,ngon(.2*s,8,math.pi/8))],[CACTUS_TILE],at=(cx,y+.4,cz))
        if not arms: return
        box(name+'_CactusArm',(cx+.48*s,y+.4+1.32*s,cz),(.62*s,.32*s,.32*s),CACTUS_TILE)
        loft(name+'_CactusArmUp',[(0,ngon(.18*s,8,math.pi/8)),(.95*s,ngon(.18*s,8,math.pi/8)),(1.08*s,ngon(.11*s,8,math.pi/8))],[CACTUS_TILE],at=(cx+.7*s,y+.4+1.18*s,cz))
        box(name+'_CactusArm',(cx-.44*s,y+.4+1.7*s,cz),(.55*s,.28*s,.28*s),CACTUS_TILE)
        loft(name+'_CactusArmUp',[(0,ngon(.16*s,8,math.pi/8)),(.7*s,ngon(.16*s,8,math.pi/8)),(.8*s,ngon(.1*s,8,math.pi/8))],[CACTUS_TILE],at=(cx-.62*s,y+.4+1.58*s,cz))
    cactus(x-.45,z+.15,1.3); cactus(x+.55,z+.75,.62,False)
    bx,bz=x+1.25,z-.5
    box(name+'_BeaconFoot',(bx,y+.75,bz),(.75,.4,.75),9)
    box(name+'_BeaconPost',(bx,y+1.55,bz),(.28,1.3,.28),9)
    halo(box(name+'_BeaconLight',(bx,y+2.45,bz),(.6,.55,.6),BEACON_TILE),(bx,y+2.45,bz),1.5,'8ff6ff')
    box(name+'_BeaconCap',(bx,y+2.8,bz),(.7,.16,.7),8)
    box(name+'_BeaconAerial',(bx,y+3.2,bz),(.08,.7,.08),9)
    # The dune is a low hump to walk over; the cacti and the beacon stand in the way.
    solid_of(name+'_Dune',hull=True); solid_of([name+'_Beacon'])
    for o in [o for o in ACTIVE.children if o.name.startswith(name+'_Cactus') and not o.name.startswith(name+'_CactusArm')]: solid_of([o],hull=True)

def decor_meteor(name,at):
    x,y,z=at
    loft(name+'_Rock',[(-.5,ngon(1.5,7,0,1.1,.95,[.05,-.08,.1,-.03,.07,-.1,.02])),(.25,ngon(1.45,7,.3,1.1,.95,[-.04,.09,-.06,.08,-.02,.05,-.08])),
                      (.95,ngon(1.05,7,.6,1,1,[.08,-.05,.04,-.09,.06,0,-.04])),(1.35,ngon(.5,7,.9))],[METEOR_TILE],at=(x,y,z))
    for (dx,dy,dz),h,r,tilt in (((.6,.6,.3),1.4,.25,(.35,-.4)),((-.5,.6,.35),1.0,.21,(.4,.35)),((.1,.95,-.4),1.2,.22,(-.35,-.1)),((-.95,.1,-.25),.7,.17,(-.2,.5))):
        crystal(name+'_Crystal',(x+dx,y+dy,z+dz),h,r,tilt,0,PURPLE_TILE)
    star=[(math.cos(math.pi/2+i*math.pi/5)*(.85 if i%2==0 else .37),math.sin(math.pi/2+i*math.pi/5)*(.85 if i%2==0 else .37)+y+2.8) for i in range(10)]
    prism(name+'_Star',[(x+u,v) for u,v in star],z-.15,z+.15,8)
    solid_of([name+'_Rock',name+'_Crystal'],hull=True)  # the star floats overhead

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
    # The thick walnut end face is structural fascia, not a postprocess outline.
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
    halo(box(name+'_Light',(x,y,z),(.43*s,.64*s,.43*s),15),(x,y,z),1.2*s,'ffcf6a')
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
    post=[box('Shop_PorchPost',(xx,2.28,5.22),(.52,3.55,.52),10),box('Shop_PorchFoot',(xx,.95,5.22),(.76,.48,.76),3)]
    solid_of(post)
    beam('Shop_PorchBracket',(xx,3.02,5.22),(xx-math.copysign(.75,xx),3.65,5.22),.35,.35,2)
# The porch floor and its two steps stay walkable through: the sale ring reaches the lower step, and standing on it
# would lift a player out of the ring (a trip there landed against it and crept up its edge).
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
# Every service building: an 8.6 x 6 x 6.8 m body; the crates, barrels and benches round it are their own.
solid((0,3,0),(8.6,6,6.8)); solid_of('Shop_Crate'); solid_of('Shop_Barrel',hull=True); solid_of('Shop_Bench')

# BACKPACK SHOP: the chamfered pavilion with continuous red hips, a big backpack badge over the door and
# packs on show either side of the steps.
def backpack(name,at,s=1,yaw=0):
    """A chunky toy rucksack: body, rounded flap, front pocket, gold buckle, side pockets and a bedroll on top.
    `at` is the middle of its base; it faces +Z turned by `yaw`."""
    x0,y0,z0=at; c,sn=math.cos(yaw),math.sin(yaw)
    def part(n,o,size,t):
        # A box turned by `yaw` about the pack's base: vertices are rotated, the model keeps its own origin.
        ox,oy,oz=o; hx,hy,hz=[v*s/2 for v in size]
        verts=[]
        for dx,dy,dz in ((-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)):
            lx,lz=ox*s+dx*hx,oz*s+dz*hz
            verts.append((x0+lx*c+lz*sn,y0+oy*s+dy*hy,z0-lx*sn+lz*c))
        mesh(name+'_'+n,verts,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(7,6,2,3),(0,4,7,3),(2,6,5,1)],t)
    part('Body',(0,.55,0),(.92,1.1,.58),21)
    part('Flap',(0,1.02,.06),(.98,.3,.66),12)
    part('FlapLip',(0,.86,.33),(.7,.24,.08),12)
    part('Pocket',(0,.42,.33),(.62,.46,.14),5)
    part('Buckle',(0,.82,.39),(.17,.17,.06),8)
    for side in (-1,1):
        part('SidePocket',(side*.5,.38,0),(.12,.42,.4),5)
        part('Strap',(side*.25,.6,-.31),(.12,.9,.06),10)
    part('Bedroll',(0,1.3,-.02),(1.06,.26,.3),23)
    part('Handle',(0,1.48,-.1),(.3,.1,.08),10)
model('Pack_Shop',(17,0,3),-.13)
foot=stepped_outline(8.2,6.5,.9)
slab('Pack_Foundation',[(x*1.06,z*1.06) for x,z in foot],.04,.42,19)
slab('Pack_FoundationCap',[(x*1.08,z*1.08) for x,z in foot],.42,.64,11)
slab('Pack_Plaster',foot,.64,3.95,4)
for xx in (-3.20,3.20):
    for zz in (-3.23,3.23): box('Pack_CornerTimber',(xx,2.28,zz),(.44,3.52,.44),10)
for zz in (-2.32,2.32):
    for xx in (-4.08,4.08): box('Pack_SideTimber',(xx,2.28,zz),(.44,3.52,.44),10)
slab('Pack_HeavyEave',[(x*1.26,z*1.26) for x,z in foot],3.98,4.36,0)
hip_roof('Pack_ContinuousHip',foot,[(1.24,4.32),(.92,5.42),(.60,6.28)],PACK_ROOF)
for i in (1,3,5,7):
    x,z=foot[i]
    beam('Pack_HipRib',(x*1.24,4.38,z*1.24),(x*.60,6.33,z*.60),.17,.14,12)
slab('Pack_RoofGoldCap',[(x*.60,z*.60) for x,z in foot],6.26,6.44,8)
box('Pack_LanternGlass',(0,6.88,0),(1.48,.95,1.48),7)
for xx in (-.76,.76):
    for zz in (-.76,.76): box('Pack_LanternCorner',(xx,6.90,zz),(.18,1.08,.18),8)
box('Pack_LanternBase',(0,6.42,0),(1.90,.20,1.90),0)
hip_roof('Pack_LanternRoof',stepped_outline(2.18,2.18,.30),[(1,7.36),(.68,7.78)],PACK_ROOF)
box('Pack_LanternFinial',(0,7.97,0),(.46,.30,.46),8)
box('Pack_FrontLedger',(0,3.80,3.34),(6.65,.29,.33),1)
door('Pack_Door',(0,.65,3.30),1.76,2.74,14)
for xx in (-2.18,2.18): window('Pack_FrontWindow',(xx,2.52,3.32),1.48,1.60)
window('Pack_EastWindow',(4.15,2.40,0),2.35,2.25,True)
solid_of([box('Pack_FirstStep',(0,.14,4.73),(3.55,.28,.80),3)])
solid_of([box('Pack_UpperStep',(0,.37,4.02),(3.25,.30,1.0),11)])
lamp('Pack_Lantern',(1.25,3.26,3.72),.80)
# Badge: a big backpack on a walnut plate above the door, read from across the plaza.
prism('Pack_BadgeBacking',[(x,y+5.10) for x,y in stepped_outline(1.55,1.70,.28)],3.74,3.95,0)
prism('Pack_BadgeBody',[(x,y+4.98) for x,y in stepped_outline(1.02,1.10,.18)],3.96,4.12,21)
prism('Pack_BadgeFlap',[(x,y+5.40) for x,y in stepped_outline(1.10,.42,.12)],4.13,4.24,12)
prism('Pack_BadgePocket',[(x,y+4.72) for x,y in stepped_outline(.62,.40,.08)],4.13,4.22,5)
prism('Pack_BadgeBuckle',[(x,y+5.22) for x,y in stepped_outline(.18,.18,.04)],4.25,4.31,8)
prism('Pack_BadgeHandle',[(x,y+5.72) for x,y in stepped_outline(.40,.16,.05)],3.96,4.06,10)
# Packs on show: a crate with a pack each side of the steps, and a row hanging under the east eave.
for side in (-1,1):
    crate('Pack_ShowCrate'+'LR'[side>0],(side*3.05,.10,4.45),.86)
    backpack('Pack_ShowPack'+'LR'[side>0],(side*3.05,.96,4.45),.92,side*-.25)
for i,zz in enumerate((-1.75,-.05,1.65)):
    box('Pack_HangPeg',(4.55,3.05,zz),(.5,.12,.12),10)
    backpack('Pack_HangPack',(4.62,1.72,zz),.78,math.pi/2)
crate('Pack_SideCrate',(-4.65,.10,1.7),.9); backpack('Pack_SidePack',(-4.65,1.0,1.7),.8,-math.pi/2)
solid((0,3,0),(8.6,6,6.8))
for side in 'LR': solid_of(['Pack_ShowCrate'+side,'Pack_ShowPack'+side])
solid_of(['Pack_SideCrate','Pack_SidePack'])

def egg(name,at,h,t,plain=None):
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
    plain=plain if plain is not None else {16:24,17:25,18:26}[t]; tiles=[plain,plain]
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
solid((0,3,0),(8.6,6,6.8)); solid_of('Forge_Barrel',hull=True); solid_of('Forge_Crate')

# OPEN MINE: strong diagonal timber is the Roblox half of the fusion. The roof,
# wheel silhouette, footings and joinery provide the more Minecraft-like steps.
model('Mine_Headframe',(0,0,-11))
mesh_solid()  # its legs and piers as they are: the shaft between them stays open
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

# BRIDGE (layout `bridge`): a humpback timber footbridge. The deck is one smooth raised-cosine arch that
# leaves the path at ground level on both banks, so there is no slab, ramp or step to climb: boards laid
# across it with dark seams between them, walnut side beams under the overhanging board ends tracing the
# arch, stone footings where the arch meets the banks. Posts, rails and the four lantern pillars are a
# separate model, so the game collides with them apart from the deck the character stands on.
bridge=layout['bridge']; BL=bridge['halfSpan']; BH=bridge['rise']; BW=bridge['width']/2
def deck(z):
    u=max(-1.0,min(1.0,z/BL)); return .047+BH*(1+math.cos(math.pi*u))/2
def arch_band(name,x0,x1,top,bottom,z0,z1,n,t):
    # A band along z whose top and bottom follow two curves; sections wind like box().
    zs=[z0+(z1-z0)*i/n for i in range(n+1)]
    verts=[v for z in zs for v in ((x0,bottom(z),z),(x1,bottom(z),z),(x1,top(z),z),(x0,top(z),z))]
    faces=[(3,2,1,0),(4*n,4*n+1,4*n+2,4*n+3)]
    for i in range(n):
        a,b=4*i,4*i+4
        faces+=[(a,a+1,b+1,b),(b+3,b+2,a+2,a+3),(a,b,b+3,a+3),(a+2,b+2,b+1,a+1)]
    return mesh(name,verts,faces,t)
model('Creek_Bridge',(bridge['x'],0,bridge['z']))
mesh_solid()  # the deck the character walks on
BOARDS=21; pitch=2*BL/BOARDS; seam=.035; board=.2
for i in range(BOARDS):
    za,zb=-BL+i*pitch,-BL+(i+1)*pitch; ya,yb=deck(za),deck(zb)
    # Each board's top is the arch chord, trimmed by half a seam at either end; 0.2 m thick at right angles.
    l=math.hypot(zb-za,yb-ya); dz,dy=(zb-za)/l,(yb-ya)/l
    (az,ay),(bz,by)=(za+dz*seam/2,ya+dy*seam/2),(zb-dz*seam/2,yb-dy*seam/2)
    (cz,cy),(ez,ey)=(az+dy*board,ay-dz*board),(bz+dy*board,by-dz*board)
    hw=BW-(.06 if i%2 else 0)
    verts=[(-hw,cy,cz),(hw,cy,cz),(hw,ay,az),(-hw,ay,az),(-hw,ey,ez),(hw,ey,ez),(hw,by,bz),(-hw,by,bz)]
    mesh('Bridge_Board_%02d'%i,verts,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(7,6,2,3),(0,4,7,3),(2,6,5,1)],DECK_TILES[(i*7+i//3)%3])
arch_band('Bridge_SeamFill',-(BW-.3),BW-.3,lambda z:deck(z)-.03,lambda z:deck(z)-.24,-BL,BL,28,10)
for sx in (-1,1):
    # Below ground beyond |z| 4.5, so the beams stop there.
    arch_band('Bridge_SideBeam',min(sx*2.22,sx*2.50),max(sx*2.22,sx*2.50),lambda z:deck(z)-.19,lambda z:deck(z)-.62,-4.5,4.5,24,0)
    # Stone footings flank the feet of the arch on the banks, outside the boards so none shows through.
    for sz in (-1,1):
        fx,fz=sx*3.0,sz*2.95
        # Down to the creek bed: the banks under the footings are sunk below the meadow.
        slab('Bridge_Footing',[(fx+a,fz+b) for a,b in stepped_outline(.70,1.30,.18)],-1.1,.40,19)
        slab('Bridge_FootingCap',[(fx+a,fz+b) for a,b in stepped_outline(.80,1.40,.20)],.40,.50,11)
model('Creek_Bridge_Rails',(bridge['x'],0,bridge['z']))
mesh_solid()  # apart from the deck: a character brushing a post still finds the deck
RX=2.42; RAIL_END=BL-.06
for sx in (-1,1):
    x=sx*RX
    for z in (-3.7,-1.85,0,1.85,3.7):
        y=deck(z)
        box('Bridge_Post',(x,y+.33,z),(.42,1.56,.42),0)
        box('Bridge_PostCap',(x,y+1.19,z),(.58,.16,.58),8)
    arch_band('Bridge_Handrail',x-.19,x+.19,lambda z:deck(z)+1.02,lambda z:deck(z)+.77,-RAIL_END,RAIL_END,32,2)
    arch_band('Bridge_MidRail',x-.11,x+.11,lambda z:deck(z)+.52,lambda z:deck(z)+.36,-RAIL_END,RAIL_END,32,1)
    for sz in (-1,1):
        px,pz=sx*2.6,sz*(BL-.05)
        slab('Bridge_PillarPlinth',[(px+a,pz+b) for a,b in stepped_outline(.9,.9,.19)],0,.3,19)
        slab('Bridge_Pillar',[(px+a,pz+b) for a,b in stepped_outline(.68,.68,.14)],.3,1.28,3)
        slab('Bridge_PillarCap',[(px+a,pz+b) for a,b in stepped_outline(.88,.88,.17)],1.28,1.45,11)
        lamp('Bridge_Lantern',(px,1.45+.445*.75,pz),.75)

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
solid_of()
model('Ore_Crates',(10.8,.03,-5.9),.18)
crate('Plaza_CrateA',(0,0,0),.90); crate('Plaza_CrateB',(.10,.90,.06),.65)
solid_of('Plaza_CrateA'); solid_of('Plaza_CrateB')
model('Plaza_Signpost',(-3.7,.04,13.1),-.15)
box('Signpost_Timber',(0,1.57,0),(.40,3.14,.40),0)
box('Signpost_Cap',(0,3.22,0),(.68,.18,.68),21)
prism('Signpost_MineArrow',[(-1.35,2.20),(.90,2.20),(1.25,2.475),(.90,2.75),(-1.35,2.75)],-.13,.13,2)
prism('Signpost_PetArrow',[(1.22,1.38),(-.75,1.38),(-1.08,1.65),(-.75,1.92),(1.22,1.92)],-.13,.13,6)
beam('Signpost_PickHandle',(-.40,2.25,.23),(.08,2.68,.23),.15,.13,0)
beam('Signpost_PickHead',(-.25,2.66,.24),(.28,2.35,.24),.20,.14,0)
prism('Signpost_Egg',[(xx,yy+1.65) for xx,yy in stepped_outline(.29,.37,.07)],.17,.29,16)
solid_of('Signpost_Timber')  # the arrows point out over the head
for i,(x,z,yaw) in enumerate(((-9.8,7.4,.1),(8.5,10.3,-.4))):
    model('Plaza_Lamp_%d'%i,(x,0,z),yaw)
    box('Lamp_Post',(0,1.80,0),(.41,3.60,.41),0)
    box('Lamp_Foot',(0,.26,0),(.75,.52,.75),3)
    box('Lamp_Arm',(.39,3.52,0),(1.17,.31,.31),1)
    beam('Lamp_Bracket',(0,2.92,0),(.66,3.52,0),.26,.26,2)
    lamp('Lamp_Lantern',(.78,3.13,0),1.05)
    solid_of('Lamp_Foot'); solid_of('Lamp_Post')

# Adapt the approved Pinewind authoring method to the real playable mine.
# No imported legacy meshes, Decimate, or decorative shaft floor.
for name,service in [('Merchant_Store','sale'),('Copper_Forge','shop'),('Pack_Shop','bags')]:
    anchor=layout['services'][service]['anchor']
    MODELS[name].location=P((anchor['x'],0,anchor['z']))
    MODELS[name].rotation_euler[2]=anchor['yaw']
MODELS['Mine_Headframe'].location=P((0,0,0))
MODELS['Mine_Headframe'].scale=(1.5,1.8,1)
MODELS['Ore_Cart'].location=P((12,0,-5))
MODELS['Ore_Crates'].location=P((-13,0,1))
MODELS['Plaza_Signpost'].location=P((layout['props']['signpost']['x'],0,layout['props']['signpost']['z']))
for i,lamp_at in enumerate(layout['props']['lamps']):
    MODELS['Plaza_Lamp_%d'%i].location=P((lamp_at['x'],0,lamp_at['z'])); MODELS['Plaza_Lamp_%d'%i].rotation_euler[2]=lamp_at['yaw']
for ob in list(bpy.data.objects):
    if ob.name.startswith(('Mine_Lift','Mine_Access','Mine_DeckLantern','Mine_RearLoading')):
        bpy.data.objects.remove(ob,do_unlink=True)
# Each actual pet SKU receives its own solid egg in its own colour, sized for the labels.
for i,p in enumerate(layout['eggs']):
    model('Egg_'+p['id'],(p['x'],p['y'],p['z']),p['yaw'])
    slab('Egg_Plinth',stepped_outline(2.45,2.45,.30),0,.35,11)
    slab('Egg_GoldLip',stepped_outline(2.18,2.18,.26),.35,.49,8)
    slab('Egg_Nest',stepped_outline(1.95,1.95,.26),.49,.66,23)
    spotted,plain=EGG_TILES[p['id']]
    egg('Egg_Display',(0,.66,0),2.25,spotted,plain)
    solid((0,1.5,0),(1.9,3,1.9))  # the egg and its nest; the plinth's lip stays a step
# Timber planters with grass tops and a honey-timber front lip. Small risers keep every tier walkable.
terrace=layout['terrace']; tz=(terrace['minZ']+terrace['maxZ'])/2; tl=terrace['maxZ']-terrace['minZ']; tw=terrace['width']
for tier in layout['tiers']:
    model('Terrace_'+str(tier['tier']),(tier['x'],0,tz))
    box('Terrace_Timber',(0,(tier['y']-.16)/2,0),(tw,tier['y']-.16,tl),1)
    box('Terrace_Grass',(0,tier['y']-.08,0),(tw,.16,tl),GRASS_TILE)
    box('Terrace_Lip',(-tw/2+.12,tier['y']-.095,0),(.24,.21,tl),2)
    solid_of()
for i,p in enumerate(layout['steps']):
    model('TerraceStep_'+str(i),(p['x'],0,p['z']))
    box('Terrace_Step',(0,p['y']/2,0),(p['width'],p['y'],p['depth']),2)
    solid_of()
# TELEPORT STATION: one per world, replacing the ring of layer portals. A stepped octagonal platform, two
# chunky stone pillars with gold bands, a teal-roofed lintel with a crest, and a broad teal ring in the opening
# (the swirling portal disc inside it is a runtime effect). Its front (+Z) faces the spawn.
st=layout['station']
model('Teleport_Station',(st['x'],0,st['z']),st['yaw'])
octagon=lambda r:[(math.cos(math.pi/8+i*math.pi/4)*r,math.sin(math.pi/8+i*math.pi/4)*r) for i in range(8)]
# The platform's front is cut straight where the round teleport pad (the zone that opens the sheet) meets it.
pad_at=math.hypot(st['pad']['x']-st['x'],st['pad']['z']-st['z']); pad_r=layout['stationPad']['radius']; front=pad_at-pad_r+.1
slab('Station_Plinth',clip_front(octagon(3.15),front),0,.24,19)
slab('Station_Deck',clip_front(octagon(2.8),front),.24,.42,11)
slab('Station_GoldRim',clip_front(octagon(2.86),front),.40,.46,8)
slab('Station_Inlay',clip_front(octagon(1.55),front),.42,.47,13)
teleport_pad('Station_Pad',0,pad_at,pad_r)
for side in (-1,1):
    x=side*1.9
    slab('Station_PillarFoot',[(x+u,v) for u,v in stepped_outline(1.15,1.15,.22)],.42,1.0,19)
    slab('Station_Pillar',[(x+u,v) for u,v in stepped_outline(.86,.86,.18)],1.0,4.75,3)
    for y in (1.6,3.9): slab('Station_PillarBand',[(x+u,v) for u,v in stepped_outline(.98,.98,.2)],y,y+.22,8)
    slab('Station_PillarCap',[(x+u,v) for u,v in stepped_outline(1.12,1.12,.22)],4.75,5.1,0)
    lamp('Station_Lamp',(x,3.25,.62),.85)
box('Station_Lintel',(0,5.38,0),(4.9,.62,1.05),10)
box('Station_LintelGold',(0,5.06,.54),(4.4,.12,.1),8)
for sz in (-1,1): tilted_box('Station_Roof',(0,5.98,sz*.36),(5.3,.26,.95),6,sz*.62,'X')
box('Station_RoofRidge',(0,6.26,0),(5.5,.22,.3),13)
prism('Station_Crest',[(x,y+6.75) for x,y in stepped_outline(.78,.9,.2)],-.14,.14,7)
prism('Station_CrestGold',[(x,y+6.75) for x,y in stepped_outline(.46,.56,.12)],.15,.22,8)
circle=[(math.cos(2*math.pi*i/20)*1.62,math.sin(2*math.pi*i/20)*1.62) for i in range(20)]
ring('Station_Ring',circle,.82,-.16,.16,2.75,13)
ring('Station_RingGold',[(x*1.05,y*1.05) for x,y in circle],.93,.17,.24,2.75,8)
for side in (-1,1): box('Station_RingStrut',(side*1.42,2.75,0),(.5,.34,.3),0)
DECOR={'mushroom':decor_mushroom,'crystal':decor_crystals,'ice':decor_ice,'lava':decor_lava}
for i,d in enumerate(layout['stationDecor']): DECOR[d['kind']]('Station_'+d['kind'].title(),(d['x'],d['y'],d['z']),.5+i*1.1)
# The platform in its two steps (each low enough to step up), the two pillars; the pad in front is flush.
solid_of('Station_Plinth',hull=True); solid_of(['Station_Deck','Station_GoldRim','Station_Inlay'],hull=True)
for side in (-1,1): solid((side*1.9,2.4,0),(.9,4.8,.9))

# Functional furniture: a newly authored shell; its live label is attached in-game.
# A faceted teal toy cabinet with a recessed capsule display and bold roof/collars.
model('Capsule_Cabinet',tuple(layout['feedback']['capsule']),layout['feedback'].get('capsuleYaw',0))
slab('Capsule_Base',stepped_outline(2.5,2.2,.22),0,.28,19)
slab('Capsule_Body',stepped_outline(2.2,1.9,.18),.28,2.15,6)
slab('Capsule_LowerCollar',stepped_outline(2.5,2.2,.22),2.15,2.38,8)
box('Capsule_DisplayBack',(0,3.15,-.8),(2.1,1.6,.2),0)
for x in [-1.02,1.02]:box('Capsule_DisplayPost',(x,3.15,0),(.20,1.7,1.8),1)
for x,y,z,t in [(-.50,2.38,.23,16),(.41,2.38,.15,17),(0,2.70,-.23,18)]:egg('Capsule_Prize',(x,y,z),.85,t)
slab('Capsule_Crown',stepped_outline(2.5,2.2,.24),3.92,4.12,8)
roof('Capsule_Roof',2.7,2.4,4.12,.45,6,1)
box('Capsule_PrizeSlot',(0,.88,.96),(.92,.48,.13),0)
box('Capsule_PrizeTray',(0,.60,1.00),(1.10,.12,.20),8)
box('Capsule_Dial',(.66,1.55,1.00),(.38,.38,.18),8)
solid((0,2.15,0),(2.5,4.3,2.2))

# Gate to the next world, standing in the pass of the south ridge at house scale: chamfered stone
# pillars, a timber lintel with a sign board under a small gable, lamps on the pillar fronts and
# side walls that meet the hill slopes. The two doors are separate models hinged at the pillars so
# the game can swing them open. The front (sign, lamps, studs) faces the spawn (-Z).
gate=layout['gate']; half_open=gate['opening']/2; gh=gate['height']; wall_to=gate['wallTo']
model('World_Gate',(gate['x'],0,gate['z']))
for sx in (-1,1):
    px=sx*(half_open+1.0)
    slab('Gate_PillarPlinth',[(px+x,z) for x,z in stepped_outline(2.6,3.0,.30)],0,.8,19)
    slab('Gate_Pillar',[(px+x,z) for x,z in stepped_outline(2.0,2.4,.26)],.8,gh-.75,3)
    slab('Gate_PillarCap',[(px+x,z) for x,z in stepped_outline(2.5,2.9,.28)],gh-.75,gh-.2,11)
    slab('Gate_PillarCrown',[(px+x,z) for x,z in stepped_outline(1.6,2.0,.22)],gh-.2,gh+.25,8)
    lamp('Gate_Lamp',(px,gh-2.9,-1.55),1.1)
    ww=wall_to-half_open-2.0; wx=sx*(half_open+2.0+ww/2)
    box('Gate_SideWall',(wx,1.7,0),(ww,3.4,1.4),3)
    box('Gate_SideWallCap',(wx,3.55,0),(ww+.2,.3,1.7),11)
lw=2*half_open+2.2
box('Gate_Lintel',(0,gh-1.6,0),(lw,1.3,1.6),10)
box('Gate_LintelGold',(0,gh-2.3,-.82),(lw-.4,.18,.12),8)
box('Gate_SignBoard',(0,gh-1.6,-.9),(6.6,1.05,.22),0)
box('Gate_Frieze',(0,gh-.55,0),(lw,.8,1.2),1)
for sz in (-1,1): tilted_box('Gate_RoofPlane',(0,gh+.15,sz*.72),(lw+.9,.32,1.75),5,sz*.52,'X')
box('Gate_RoofRidge',(0,gh+.62,0),(lw+1.1,.3,.42),21)
gp=layout['gatePad']; teleport_pad('Gate_Pad',gp['x']-gate['x'],gp['z']-gate['z'],gp['radius'])
for d in layout['gateDecor']: {'desert':decor_desert,'meteor':decor_meteor}[d['kind']]('Gate_'+d['kind'].title(),(d['x'],d['y'],d['z']))
# The pillars on their plinths, the side walls to the slopes and the lintel; the opening stays open (the game
# closes it with the portal sheet), the pad in it is flush.
for sx in (-1,1):
    px=sx*(half_open+1.0); ww=wall_to-half_open-2.0
    solid((px,.4,0),(2.6,.8,3.0)); solid((px,gh/2,0),(2.0,gh,2.4)); solid((sx*(half_open+2.0+ww/2),1.85,0),(ww,3.7,1.4))
solid((0,gh-1.6,0),(lw,1.3,1.6))
for side,sx in (('L',-1),('R',1)):
    model('World_Gate_Door'+side,(gate['x']+sx*half_open,0,gate['z']))
    passable('left out by the game: the portal sheet closes the opening')
    w=half_open-.05; cx=-sx*w/2
    box('GateDoor_Leaf',(cx,3.65,0),(w,7.2,.36),14)
    for y in (1.0,3.65,6.3): box('GateDoor_Band',(cx,y,0),(w-.1,.34,.5),20)
    for y in (1.0,6.3):
        for k in range(3): box('GateDoor_Stud',(cx+(k-1)*(w-1.0)/2,y,-.31),(.24,.24,.12),8)
    box('GateDoor_Ring',(-sx*(w-.5),3.65,-.31),(.38,.52,.12),8)

# Glowing tiles and halos for the game, once every model is built (the mine's removed lift lantern drops out).
def alive(ob):
    try: return bpy.data.objects.get(ob.name) is ob
    except ReferenceError: return False
(ROOT.parent/'src/game/content/pinewind/architecture-glow.json').write_text(json.dumps({'atlasTiles':8,'glow':{str(k):v for k,v in sorted(GLOW.items())},
    'halos':[{k:h[k] for k in ('node','at','size','color')} for h in HALOS if alive(h['object'])]},indent=1)+'\n')

# A bounded set of prominent block edges receive a single broad chamfer.
# Main diagonal beams already have eight-sided sections, so no bevel modifier
# is applied to them. Preserve nearest sampling and the authored atlas UVs.
bevel_count=0
for ob in [o for o in bpy.data.objects if o.type=='MESH']:
    prominent=any(key in ob.name for key in ('Shop_CornerTimber','Shop_PorchPost','Forge_FrontPost','Pack_CornerTimber','Pack_SideTimber','Station_Pillar','Bridge_PostCap','Shop_FoundationCap','Pack_FoundationCap'))
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
collisions=collision.write(list(MODELS.values()))
uncovered={name:collision.uncovered(root) for name,root in MODELS.items()}
uncovered={k:v for k,v in uncovered.items() if v}
bpy.context.preferences.filepaths.save_version=0
source=ROOT/'source-art/architecture.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
# Keep editable objects in .blend; join each named prefab only in its runtime export.
for name,root in MODELS.items():
    meshes=[o for o in root.children_recursive if o.type=='MESH']
    if not meshes: continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes: ob.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.join()
    bpy.context.object.name=name+'_Mesh'
# Lightmap UVs (TEXCOORD_1): a second unwrap of every runtime mesh into one shared atlas, islands at one
# texel density in world units, for the offline light bake (tools/terrain/bakeLight.mjs). Faces resting
# face-down on the ground are never seen and are left out of the atlas (parked on one corner texel).
joined=[o for o in (bpy.data.objects.get(name+'_Mesh') for name in MODELS) if o]
for ob in joined:
    ob.data.uv_layers.active=ob.data.uv_layers.new(name='Lightmap')
bpy.ops.object.select_all(action='DESELECT')
for ob in joined: ob.select_set(True)
bpy.context.view_layer.objects.active=joined[0]
bpy.ops.object.mode_set(mode='EDIT')
hidden_faces=0
for ob in joined:
    bm=bmesh.from_edit_mesh(ob.data); world=ob.matrix_world; rotation=world.to_3x3().normalized()
    for f in bm.faces:
        down=(rotation@f.normal).z<-.9 and (world@f.calc_center_median()).z<.06
        f.select_set(not down); hidden_faces+=down
    bmesh.update_edit_mesh(ob.data)
bpy.ops.uv.smart_project(angle_limit=math.radians(45),island_margin=0.0,area_weight=0.0,correct_aspect=True,scale_to_bounds=False)
bpy.ops.uv.average_islands_scale()
bpy.ops.uv.pack_islands(rotate=True,margin_method='FRACTION',margin=.0016,shape_method='CONCAVE')
for ob in joined:
    bm=bmesh.from_edit_mesh(ob.data); layer=bm.loops.layers.uv['Lightmap']
    for f in bm.faces:
        if not f.select:
            for loop in f.loops: loop[layer].uv=(.0002,.0002)
    bmesh.update_edit_mesh(ob.data)
bpy.ops.object.mode_set(mode='OBJECT')
for ob in joined:
    ob.data.uv_layers.active=ob.data.uv_layers['PixelAtlas']; ob.data.uv_layers['PixelAtlas'].active_render=True
glb=OUT/'architecture.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
report={'schema':1,'collision':collisions,'uncoveredParts':uncovered,'authorship':'Pinewind playable adaptation, regenerated from approved authoring scripts; open 16m square mine, gameplay-aligned services and egg terraces; no legacy model import or decimation','blenderVersion':bpy.app.version_string,'coordinateConvention':'Source helpers Three Y-up -> Blender (x,-z,y), exported glTF Y-up','atlas':{'file':str(ATLAS.relative_to(ROOT)),'size':[256,256],'usedTiles':len(recipes),'tilePixels':32,'filter':'Closest / glTF NEAREST','pixelArt':'Low contrast sparse grouped marks; large calm toy-color areas, limited plank/glass/egg accents; no random noise','sha256':sha(ATLAS)},'geometryChecks':geometry_checks,'lightmapUv':{'layer':'Lightmap','gltf':'TEXCOORD_1','method':'smart_project 45 deg, average island scale, pack (margin 0.0016, 2.5 texels at 1536)','hiddenGroundFaces':hidden_faces},'models':stats,'triangles':sum(s['triangles'] for s in stats),'vertices':sum(s['vertices'] for s in stats),'meshCount':sum(s['meshes'] for s in stats),'worldBounds':{'min':[round(min(v[a] for v in all_bounds),4) for a in range(3)],'max':[round(max(v[a] for v in all_bounds),4) for a in range(3)]},'files':{str(p.relative_to(ROOT)):{'bytes':p.stat().st_size,'sha256':sha(p)} for p in (pathlib.Path(__file__).resolve(),source,glb,ATLAS)}}
(ROOT/'artifacts/architecture-asset.json').write_text(json.dumps(report,indent=2)+'\n')
print('ARCHITECTURE_ASSET '+json.dumps({k:report[k] for k in ('triangles','vertices','meshCount','worldBounds')}))
print('ARCHITECTURE_UNCOVERED '+json.dumps(uncovered))
