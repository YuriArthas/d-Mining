"""Build original blockcraft vegetation/stone meshes and their hand-painted pixel atlas.

Run: blender --background --python tools/blender/build_nature.py
All design coordinates are game X/Y/Z; conversion to Blender is (x, -z, y).
The trees use a few broad chamfered crown volumes, with sparse pixel accents.
"""
from pathlib import Path
import bpy
import bmesh
import hashlib
import json
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/pinewind'
SOURCE = ROOT / 'source-art/nature.blend'
ATLAS = OUT / 'nature-atlas.png'
GLB = OUT / 'nature.glb'
SIZE, TILE = 256, 32
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.parent.mkdir(parents=True, exist_ok=True)

# Deliberately arranged blocks of colour: no noise, tiny leaf chips, transparency,
# baked lighting gradients, or texture generated from a previous model.
pixels = bytearray([255, 0, 255, 255] * SIZE * SIZE)
def rect(tile, x, y, w, h, color):
    tx, ty = (tile % 8) * TILE, (tile // 8) * TILE
    for py in range(max(0,y), min(TILE,y+h)):
        for px in range(max(0,x), min(TILE,x+w)):
            p = ((ty+py)*SIZE + tx+px)*4
            pixels[p:p+4] = bytes((*color,255))

def paint_leaf(tile, base, shade, light, glint):
    rect(tile,0,0,32,32,base)
    # Mostly clean colour, with two quiet authored patches. The rounded broad
    # planes carry the form; sparse block accents retain a little pixel character.
    for x,y,w,h in [(19,19,10,7),(24,15,5,4)]:
        rect(tile,x,y,w,h,shade)
    for x,y,w,h in [(4,5,10,5),(4,10,5,4)]:
        rect(tile,x,y,w,h,light)
    rect(tile,5,5,5,2,glint)

paint_leaf(0,(99,157,55),(91,149,52),(108,166,59),(116,172,65))
paint_leaf(1,(124,179,58),(116,171,54),(134,187,64),(142,193,69))
paint_leaf(2,(48,126,78),(44,119,76),(57,135,82),(64,141,87))
paint_leaf(3,(62,145,85),(56,138,81),(70,153,89),(76,158,94))
paint_leaf(4,(107,163,54),(98,155,50),(117,171,59),(124,177,64))
paint_leaf(5,(130,183,66),(121,175,61),(139,191,71),(148,197,78))

# Bark bands turn corners as broad rectangular furrows, with one cut branch knot.
for tile,base,dark,light in [
    (8,(113,69,41),(79,48,34),(143,91,49)),
    (9,(138,90,49),(98,60,37),(171,114,59)),
]:
    rect(tile,0,0,32,32,base)
    for x,y,w,h in [(3,0,4,13),(6,10,4,12),(3,20,4,12),
                    (22,0,4,8),(25,6,4,16),(22,20,4,12)]:rect(tile,x,y,w,h,dark)
    for x,y,w,h in [(11,0,3,9),(14,8,3,13),(11,22,3,10),
                    (0,13,3,8),(19,1,2,8)]:rect(tile,x,y,w,h,light)
    rect(tile,17,13,6,7,dark)
    rect(tile,19,15,2,3,light)
rect(10,0,0,32,32,(169,119,66))
for inset,color in [(3,(111,72,43)),(5,(176,127,73)),(9,(132,87,48)),
                    (11,(183,134,79)),(14,(143,94,52))]:
    rect(10,inset,inset,32-2*inset,32-2*inset,color)

def paint_stone(tile,base,shade,light,vein):
    rect(tile,0,0,32,32,base)
    for x,y,w,h in [(0,21,11,6),(0,27,6,5)]:rect(tile,x,y,w,h,shade)
    rect(tile,19,5,9,5,light)
    # A short local fracture accent, without a stripe across the whole face.
    for x,y,w,h in [(18,19,6,2),(24,21,7,2)]:
        rect(tile,x,y,w,h,vein)

paint_stone(16,(104,136,143),(96,126,134),(116,146,152),(90,121,131))
paint_stone(17,(128,157,159),(119,148,151),(140,166,167),(113,142,149))
paint_stone(18,(83,112,126),(77,103,119),(94,122,135),(69,97,113))
paint_stone(19,(113,142,143),(104,133,136),(125,153,151),(98,127,132))
paint_leaf(20,(123,164,65),(114,156,60),(133,172,72),(140,177,77))
# Moss capped side texture only on the upper stone belt.
paint_stone(21,(106,136,142),(89,116,126),(127,155,158),(75,102,116))
for x,y,w,h in [(0,0,32,5),(0,5,10,3),(7,8,7,3),(23,5,9,5)]:
    rect(21,x,y,w,h,(108,157,55))
rect(21,0,0,32,2,(148,183,72))

for tile,base,shadow,highlight in [
    (24,(253,198,49),(226,142,31),(255,226,92)),
    (25,(251,238,193),(219,200,146),(255,250,220)),
    (26,(164,104,210),(128,74,171),(193,137,231)),
    (27,(127,84,39),(90,60,34),(168,110,43)),
    (28,(69,136,57),(47,105,49),(94,161,63)),
    (29,(223,127,35),(184,88,27),(246,164,51)),
]:
    rect(tile,0,0,32,32,base)
    rect(tile,0,25,32,7,shadow)
    rect(tile,0,0,32,3,highlight)
    rect(tile,0,3,4,17,highlight)
    rect(tile,22,15,10,10,shadow)

# Two texels of edge extension around every tile protect mip/atlas boundaries.
source_pixels=bytes(pixels)
for tile in range(64):
    tx,ty=(tile%8)*TILE,(tile//8)*TILE
    for y in range(TILE):
        for x in range(TILE):
            sx,sy=max(2,min(29,x)),max(2,min(29,y))
            dst=((ty+y)*SIZE+tx+x)*4
            src=((ty+sy)*SIZE+tx+sx)*4
            pixels[dst:dst+4]=source_pixels[src:src+4]

def png_chunk(name,data):
    return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
raw=b''.join(b'\0'+pixels[y*SIZE*4:(y+1)*SIZE*4] for y in range(SIZE))
ATLAS.write_bytes(b'\x89PNG\r\n\x1a\n'+
    png_chunk(b'IHDR',struct.pack('>IIBBBBB',SIZE,SIZE,8,6,0,0,0))+
    png_chunk(b'sRGB',b'\0')+png_chunk(b'IDAT',zlib.compress(raw,9))+png_chunk(b'IEND',b''))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):bpy.data.materials.remove(data)
image=bpy.data.images.load(str(ATLAS),check_existing=False)
image.colorspace_settings.name='sRGB'
material=bpy.data.materials.new('Nature_PixelAtlas_Opaque')
material.use_nodes=True
principled=material.node_tree.nodes.get('Principled BSDF')
principled.inputs['Roughness'].default_value=.92
principled.inputs['Metallic'].default_value=0
texture=material.node_tree.nodes.new('ShaderNodeTexImage')
texture.name='HandPainted_256px_PixelAtlas'
texture.image=image
texture.interpolation='Closest'
texture.extension='EXTEND'
material.node_tree.links.new(texture.outputs['Color'],principled.inputs['Base Color'])

def contour(width,depth,corner=.18,stepped=False):
    x,z=width/2,depth/2
    c=min(width,depth)*corner
    if corner<=0:return [(-x,-z),(x,-z),(x,z),(-x,z)]
    if stepped:
        return [(-x+c,-z),(x-c,-z),(x-c,-z+c),(x,-z+c),
                (x,z-c),(x-c,z-c),(x-c,z),(-x+c,z),
                (-x+c,z-c),(-x,z-c),(-x,-z+c),(-x+c,-z+c)]
    return [(-x+c,-z),(x-c,-z),(x,-z+c),(x,z-c),
            (x-c,z),(-x+c,z),(-x,z-c),(-x,-z+c)]

class Mesh:
    def __init__(self,name):self.name=name;self.vertices=[];self.faces=[];self.tiles=[];self.axes=[]
    def poly(self,points,tile,axes=None):
        start=len(self.vertices)
        self.vertices.extend(points)
        self.faces.append(tuple(range(start,start+len(points))))
        self.tiles.append(tile)
        self.axes.append(axes)
    def ring(self,layers,side,top,bottom=None,stepped=False,corner=.18,offset=(0,0,0)):
        # Layer tuple: y, width, depth, centre x, centre z. Equal consecutive
        # heights create genuine horizontal terraces, not a beveled smooth blob.
        ox,oy,oz=offset
        rings=[[(x+cx+ox,y+oy,z+cz+oz) for x,z in contour(w,d,corner,stepped)]
               for y,w,d,cx,cz in layers]
        self.poly(rings[0],bottom if bottom is not None else side if isinstance(side,int) else side[0])
        for j in range(len(rings)-1):
            a,b=rings[j:j+2]
            for i in range(len(a)):
                tile=side if isinstance(side,int) else side[j%len(side)]
                if abs(a[i][1]-b[i][1])<.00001:tile=top
                self.poly([a[i],b[i],b[(i+1)%len(b)],a[(i+1)%len(a)]],tile)
        self.poly(list(reversed(rings[-1])),top)
    def box(self,cx,y,cz,w,h,d,tile,top=None):
        self.ring([(y,w,d,cx,cz),(y+h,w,d,cx,cz)],tile,top if top is not None else tile,corner=0)
    def extrude(self,points,z0,z1,tile):
        # XY polygon, thickness along game Z.
        a=[(x,y,z0) for x,y in points];b=[(x,y,z1) for x,y in points]
        self.poly(list(reversed(a)),tile);self.poly(b,tile)
        for i in range(len(a)):
            k=(i+1)%len(a);self.poly([a[i],a[k],b[k],b[i]],tile)
    def finish(self):
        mesh=bpy.data.meshes.new(self.name+'_mesh')
        mesh.from_pydata([(x,-z,y) for x,y,z in self.vertices],[],self.faces)
        mesh.materials.append(material)
        mesh.update()
        # The planar map lives inside a padded tile. Nearest filtering keeps
        # coloured pixels sharp; the inset prevents atlas neighbour bleeding.
        uv=mesh.uv_layers.new(name='PixelAtlasUV')
        for polygon,tile,forced_axes in zip(mesh.polygons,self.tiles,self.axes):
            points=[self.vertices[mesh.loops[li].vertex_index] for li in polygon.loop_indices]
            extents=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
            # Side faces: horizontal direction + height; top/bottom: X + Z.
            if extents[1]<.00001:axes=(0,2)
            else:axes=(0 if extents[0]>=extents[2] else 2,1)
            if forced_axes is not None:axes=forced_axes
            # A slanted thin leaf/grass edge spans its extrusion axis as well
            # as its sloping edge. Projecting only onto XY collapses that face.
            # Preserve every existing valid projection; repair only zero-area
            # projections by choosing the face's largest projected area.
            def projected_area(pair):
                a,b=pair
                return abs(sum(points[i][a]*points[(i+1)%len(points)][b]-
                               points[(i+1)%len(points)][a]*points[i][b]
                               for i in range(len(points))))
            if projected_area(axes)<1e-12:
                axes=max([(0,1),(0,2),(1,2)],key=projected_area)
            mins=[min(p[a] for p in points) for a in axes]
            scales=[max(p[a] for p in points)-mins[i] for i,a in enumerate(axes)]
            for li,p in zip(polygon.loop_indices,points):
                u=(p[axes[0]]-mins[0])/max(scales[0],.000001)
                v=(p[axes[1]]-mins[1])/max(scales[1],.000001)
                uv.data[li].uv=((tile%8*TILE+2.5+u*(TILE-5))/SIZE,
                               1-(tile//8*TILE+2.5+(1-v)*(TILE-5))/SIZE)
        # Recalculate each closed volume with no smoothing or geometric reduction.
        bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00000001)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(mesh);bm.free()
        for p in mesh.polygons:p.use_smooth=False
        mesh.calc_loop_triangles()
        obj=bpy.data.objects.new(self.name,mesh)
        bpy.context.collection.objects.link(obj)
        obj['authoring']='New Blender geometry; broad chamfered toy-like masses, no decimation'
        obj['atlas']='nature-atlas.png, 256px, 32px tiles, nearest'
        return obj

def crown(mesh,cx,cy,cz,w,h,d,side=0,top=1):
    # Eight broad perimeter faces and large continuous bevel planes. These are
    # original authored volumes, with no stair ledges, sphere subdivision or
    # small leaf cubes. Three or four complete masses form each oak/bush.
    mesh.ring([(0,w*.67,d*.67,0,0),(h*.20,w*.94,d*.94,0,0),
               (h*.68,w,d,0,0),(h,w*.70,d*.70,0,0)],
              side,top,corner=.27,offset=(cx,cy,cz))

def trunk(mesh,height=.65,width=.12):
    mesh.ring([(0,width*1.45,width*1.45,0,0),(.075,width,width,0,0),
               (height,width*.85,width*.85,.012,-.008)],8,10,corner=.06)
    # Four broad roots: readable large blocks, never branch/leaf networks.
    for sx,sz in [(1,0),(-1,0),(0,1),(0,-1)]:
        mesh.ring([(0,width*1.45,width*1.45,sx*width*.6,sz*width*.6),
                   (.045,width*.72,width*.72,sx*width*.42,sz*width*.42)],8,9,corner=.04)

assets=[]
m=Mesh('tree_oak');trunk(m)
crown(m,-.205,.415,-.025,.50,.325,.49)
crown(m,.225,.48,-.025,.44,.335,.46)
crown(m,.015,.405,.22,.47,.285,.42)
crown(m,.005,.66,-.025,.55,.34,.53)
assets.append(m.finish())

m=Mesh('tree_pine');trunk(m,.47,.105)
# Three complete faceted taper crowns, with broad bevelled undersides and a
# stout capped tip. Each crown is one continuous slope, without square stairs.
for bottom,w,h in [(.22,.70,.35),(.44,.53,.31),(.65,.36,.35)]:
    m.ring([(bottom,w*.74,w*.74,0,0),(bottom+h*.16,w,w,0,0),
            (bottom+h,w*.13,w*.13,0,0)],2,3,corner=.28)
assets.append(m.finish())

m=Mesh('bush')
crown(m,-.42,0,0,1.16,1.04,1.70,4,5)
crown(m,.43,.11,-.05,1.14,1.20,1.78,4,5)
crown(m,-.03,.63,.14,1.20,.87,1.72,4,5)
assets.append(m.finish())

def chiseled_mass(mesh,base,upper,top_height,pitch,side,top):
    """A single broad irregular rock volume, with an inclined upper fracture.

    No nested rings or continuous horizontal terraces. Offset polygon corners
    define a few large chiseled side planes; one broad sloped plane caps them.
    """
    px,pz=pitch
    maximum=max(x*px+z*pz for x,z in upper)
    bottom=[(x,0,z) for x,z in base]
    roof=[(x,top_height+x*px+z*pz-maximum,z) for x,z in upper]
    mesh.poly(bottom,side)
    for i in range(len(base)):
        k=(i+1)%len(base)
        mesh.poly([bottom[i],roof[i],roof[k],bottom[k]],side)
    mesh.poly(list(reversed(roof)),top,axes=(0,2))

m=Mesh('rock_a')
# A wide fractured boulder with a genuine side notch, rather than a smaller
# concentric rock stacked on a larger one. All corners are deliberately authored.
chiseled_mass(m,
    [(-.78,-1),(.55,-1),(1,-.50),(.81,.10),(1,.64),(.50,1),(-.72,.94),(-1,.40),(-1,-.65)],
    [(-.60,-.70),(.37,-.73),(.75,-.40),(.45,.04),(.72,.47),(.24,.73),(-.58,.66),(-.82,.27),(-.80,-.39)],
    1,(-.13,-.09),16,17)
assets.append(m.finish())

m=Mesh('rock_b')
# More diagonal and slab-like than rock_a; the large top fracture slopes across
# almost the full width, producing a different silhouette even at small scale.
chiseled_mass(m,
    [(-.62,-1),(.76,-.91),(1,-.50),(.88,.55),(.30,1),(-.56,.80),(-1,.31),(-.88,-.58)],
    [(-.47,-.82),(.59,-.73),(.88,-.40),(.62,.36),(.12,.72),(-.39,.61),(-.76,.17),(-.72,-.41)],
    1,(-.26,-.12),18,19)
assets.append(m.finish())

m=Mesh('cliff')
# Dominant rock face with a single offset low shoulder. Moss occupies the upper
# plateau only, so the silhouette cannot read as concentric green-banded tiers.
chiseled_mass(m,
    [(-.75,-1),(.32,-1),(.62,-.76),(.56,.58),(.32,.84),(-.75,1),(-1,.68),(-1,-.72)],
    [(-.68,-.85),(.19,-.88),(.45,-.60),(.35,.48),(.10,.68),(-.67,.78),(-.89,.53),(-.88,-.60)],
    1,(-.055,-.025),16,20)
chiseled_mass(m,
    [(.18,-.51),(.70,-.54),(.93,-.28),(1,.39),(.74,.86),(.14,.82),(.04,.53),(.08,-.30)],
    [(.24,-.39),(.69,-.42),(.86,-.22),(.90,.35),(.64,.73),(.16,.68),(.12,.43),(.17,-.23)],
    .56,(-.045,.035),18,17)
assets.append(m.finish())

def flower(name,petal):
    m=Mesh(name)
    m.box(0,0,0,.066,.45,.066,28)
    # Thick stem, two broad leaves and four full chamfered petals.
    m.extrude([(-.025,.16),(-.17,.24),(-.17,.29),(-.10,.29),(.015,.20)],-.024,.024,28)
    m.extrude([(.02,.25),(.16,.31),(.16,.35),(.09,.35),(-.015,.28)],-.022,.022,28)
    m.ring([(.43,.18,.18,0,0),(.525,.18,.18,0,0)],petal,petal,corner=.22)
    for x,z in [(-.115,0),(.115,0),(0,-.115),(0,.115)]:
        m.ring([(.44,.132,.132,x,z),(.455,.165,.165,x,z),
                (.525,.137,.137,x,z)],petal,petal,corner=.22)
    m.box(0,.51,0,.105,.04,.105,27 if petal==24 else 29)
    return m.finish()
assets.extend([flower('flower_yellow',24),flower('flower_ivory',25),flower('flower_purple',26)])

m=Mesh('grass')
for points,z0,z1 in [
    ([(-.045,0),(.035,0),(.035,.45),(-.035,.45)],-.025,.025),
    ([(-.025,0),(-.09,0),(-.20,.29),(-.20,.35),(-.13,.35),(-.065,.20)],-.055,.005),
    ([(.015,0),(.08,0),(.18,.22),(.18,.31),(.115,.31),(.055,.17)],.015,.075),
]:m.extrude(points,z0,z1,28)
assets.append(m.finish())

# Asset library convention: origin is ground-centre, each object is self-contained.
# Objects overlap deliberately in the authoring library; the game clones by name.
for obj in assets:obj.select_set(False)
scene=bpy.context.scene
scene['asset_pack']='Blockcraft nature; newly authored Blender geometry and pixel atlas'
scene['layout']='Asset library at common origin. Select one named mesh to inspect.'
scene.render.engine='BLENDER_EEVEE'
scene.view_settings.view_transform='Standard'
scene.unit_settings.system='METRIC'
image.pack()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',export_yup=True,
    export_normals=True,export_texcoords=True,export_materials='EXPORT',
    export_animations=False,export_cameras=False,export_lights=False,
    export_extras=True,export_image_format='AUTO',export_keep_originals=False)

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
records=[]
for obj in assets:
    coords=[(v.co.x,v.co.z,-v.co.y) for v in obj.data.vertices]
    low=[round(min(v[i] for v in coords),6) for i in range(3)]
    high=[round(max(v[i] for v in coords),6) for i in range(3)]
    records.append({'name':obj.name,'triangles':len(obj.data.loop_triangles),
                    'vertices':len(obj.data.vertices),'bounds':{'min':low,'max':high},
                    'dimensions':[round(high[i]-low[i],6) for i in range(3)]})
data={'authoring':'Blender 5.1.2, new authored geometry; no decimation or reused models',
      'coordinateConvention':'game (x,y,z) -> Blender (x,-z,y); glTF Y-up',
      'materialCount':1,'atlas':{'size':[SIZE,SIZE],'tileSize':[TILE,TILE],
                              'filter':'nearest','alpha':'OPAQUE','source':'hand-authored pixel rectangles'},
      'assets':records,'totalTriangles':sum(x['triangles'] for x in records),
      'files':{str(p.relative_to(ROOT)):{'sha256':sha(p),'bytes':p.stat().st_size}
               for p in [Path(__file__),SOURCE,ATLAS,GLB]}}
(ROOT/'artifacts/nature-asset.json').write_text(json.dumps(data,indent=2)+'\n')
print('NATURE_ASSET_MANIFEST '+json.dumps(data))
