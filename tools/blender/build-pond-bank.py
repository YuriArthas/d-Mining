"""Original grid-cut grass/dirt pond banks. Exposed faces only; no bevels."""
import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
out=ROOT/'assets-source/quarry-v2/pond-bank-blender';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# One-metre cells, asymmetric shore. The right pond rotates this shared asset 180 degrees.
rows=[[-4,-2,3],[-3,-4,4],[-2,-5,4],[-1,-5,5],[0,-5,5],[1,-4,5],[2,-5,4],[3,-3,3]]
water={(x,z) for z,lo,hi in rows for x in range(lo,hi)}
shore=set()
for x,z in water:
    for dx,dz in [(-1,0),(1,0),(0,-1),(0,1)]:
        if (x+dx,z+dz) not in water:shore.add((x+dx,z+dz))
vertices=[];faces=[]
def quad(v):
    i=len(vertices);vertices.extend((x,-z,y) for x,y,z in v);faces.append(tuple(range(i,i+4)))
for x,z in sorted(shore):
    y=.38
    quad([(x,y,z),(x,y,z+1),(x+1,y,z+1),(x+1,y,z)])
    # Vertical sides, never internal coplanar faces between neighbouring cells.
    if (x-1,z) not in shore:quad([(x,.022,z),(x,.022,z+1),(x,y,z+1),(x,y,z)])
    if (x+1,z) not in shore:quad([(x+1,.022,z+1),(x+1,.022,z),(x+1,y,z),(x+1,y,z+1)])
    if (x,z-1) not in shore:quad([(x+1,.022,z),(x,.022,z),(x,y,z),(x+1,y,z)])
    if (x,z+1) not in shore:quad([(x,.022,z+1),(x+1,.022,z+1),(x+1,y,z+1),(x,y,z+1)])
mesh=bpy.data.meshes.new('grid-grass-bank');mesh.from_pydata(vertices,[],faces);mesh.update()
obj=bpy.data.objects.new('raw-grass-dirt-shore',mesh);bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
tri=obj.modifiers.new('triangulate','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
positions=[];normals=[]
for face in obj.data.polygons:
    for i in face.vertices:
        v=obj.data.vertices[i].co;n=face.normal
        positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)])
        normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
waterPositions=[]
for z,lo,hi in rows:
    # Merge each row; adjacent rows share an edge, never overlap.
    for x,y,zz in [(lo,0,z),(lo,0,z+1),(hi,0,z+1),(lo,0,z),(hi,0,z+1),(hi,0,z)]:waterPositions.extend([x,y,zz])
data={'positions':positions,'normals':normals,'triangles':len(obj.data.polygons),'waterPositions':waterPositions,'waterRows':rows,'shoreCells':sorted(shore),'waterY':.32,'bankHeight':.38,'bedY':.022}
runtime=ROOT/'src/game/assets/ground-details/pond-bank.json';runtime.write_text(json.dumps(data,separators=(',',':')))
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'source.blend'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(out/'result.json').write_text(json.dumps({'generator':'Blender','generationId':'grid-pond-bank-blender-v3','script':str(Path(__file__).relative_to(ROOT)),'source':str((out/'source.blend').relative_to(ROOT)),'triangles':len(obj.data.polygons),'waterTriangles':len(waterPositions)//9,'dimensions':[12,.38,10],'textures':[],'surfaceDetail':'shared 128px ground atlas; procedural 16px-per-tile animated water','runtimeSha256':sha(runtime),'blendSha256':sha(out/'source.blend'),'scriptSha256':sha(Path(__file__))},indent=2))
print('grid bank triangles',len(obj.data.polygons))
