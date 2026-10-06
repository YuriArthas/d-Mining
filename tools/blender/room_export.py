"""Shared packaging only. Each scene supplies newly generated meshes and atlas pixels."""
import bpy,json,hashlib,base64
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def export_room(slug,meshes,pixels,recipe):
 layout_path=ROOT/f'src/game/content/rooms/{slug}.layout.json'
 scene_path=ROOT/f'src/game/content/rooms/{slug}.scene.json'
 layout=json.loads(layout_path.read_text());scene=json.loads(scene_path.read_text())
 asset=scene['asset'];out=ROOT/f'src/game/assets/rooms/{asset}.json';source=ROOT/f'assets-source/{asset}'
 source.mkdir(parents=True,exist_ok=True)
 mats={}
 for key,style in layout['materials'].items():
  c=style['color'].lstrip('#');m=bpy.data.materials.new(key);m.diffuse_color=(*[int(c[i:i+2],16)/255 for i in (0,2,4)],1);mats[key]=m
 parts=[]
 for group in layout['groups']:
  anchor=[0,0,0] if group['anchor']=='room' else scene['facilities'][group['anchor']]['at']
  base=[a+b for a,b in zip(anchor,group['offset'])]
  for p in group['instances']:
   o=bpy.data.objects.new(p['name'],meshes[p['mesh']]);bpy.context.collection.objects.link(o)
   o.location=[a+b for a,b in zip(base,p['at'])];o.scale=p['scale'];o.rotation_euler=p['rotation']
   if not o.data.materials:o.data.materials.append(mats[p['material']])
   o.material_slots[0].link='OBJECT';o.material_slots[0].material=mats[p['material']];parts.append(p)
 data={}
 for name,m in meshes.items():
  m.calc_loop_triangles();positions=[];normals=[];uv=[];indices=[]
  for t in m.loop_triangles:
   for vi in t.vertices:
    p=m.vertices[vi].co;n=m.vertices[vi].normal if m.polygons[t.polygon_index].use_smooth else t.normal
    positions.extend(round(v,5) for v in p);normals.extend(round(v,5) for v in n);uv.extend([round(p.x+.5,5),round(p.z+.5,5)]);indices.append(len(indices))
  data[name]={'positions':positions,'normals':normals,'uv':uv,'indices':indices}
 out.write_text(json.dumps({'id':asset,'generator':'Blender','meshes':data,'texture':{'size':layout['textureSize'],'data':base64.b64encode(pixels).decode()}},separators=(',',':'))+'\n')
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source/'source.blend'))
 sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 record={'generator':'Blender','recipe':str(Path(recipe).relative_to(ROOT)),'exporter':'tools/blender/room_export.py','source':str((source/'source.blend').relative_to(ROOT)),
 'layout':str(layout_path.relative_to(ROOT)),'sceneDefinition':str(scene_path.relative_to(ROOT)),'instances':len(parts),'triangles':sum(len(data[p['mesh']]['indices'])//3 for p in parts),'uniqueMeshes':len(data),'textureSize':layout['textureSize'],
 'assetSha256':sha(out),'recipeSha256':sha(Path(recipe)),'exporterSha256':sha(Path(__file__)),'sourceSha256':sha(source/'source.blend'),'layoutSha256':sha(layout_path),'sceneSha256':sha(scene_path)}
 doc=ROOT/f'docs/art/{asset}';doc.mkdir(parents=True,exist_ok=True);(doc/'asset-record.json').write_text(json.dumps(record,indent=2)+'\n');print(record)
