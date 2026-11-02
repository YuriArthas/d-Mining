"""Blender 自制宠物身体：圆角方块，底面中心为原点，6 个平面各自铺满一块花纹 UV。
脸是游戏里贴在正面的另一块平面（代码生成），花纹和配色也由运行时按物种决定，所以这里只有一个共用网格。"""
import bpy, bmesh, math, json, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets-source/pets'
OUTPUT = ROOT / 'src/game/assets/pets'
SOURCE.mkdir(parents=True, exist_ok=True); OUTPUT.mkdir(parents=True, exist_ok=True)
EDGE, BEVEL, SEGMENTS = 1.0, 0.17, 4

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_cube_add(size=EDGE, location=(0, 0, EDGE / 2))
cube = bpy.context.object; cube.name = 'PetCube'
# Origin on the floor: local coordinates become x, y in -0.5..0.5 and z in 0..1.
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
bevel = cube.modifiers.new('SoftEdges', 'BEVEL')
bevel.width = BEVEL; bevel.segments = SEGMENTS; bevel.profile = 0.5; bevel.limit_method = 'NONE'
bpy.context.view_layer.objects.active = cube; bpy.ops.object.modifier_apply(modifier=bevel.name)

# Each flat side maps the full 0..1 tile (the cube spans x, y in -0.5..0.5 and z in 0..1);
# the rounded edges take the projection of their main axis.
mesh = cube.data
uv = mesh.uv_layers.active.data
for poly in mesh.polygons:
    axis = max(range(3), key=lambda i: abs(poly.normal[i]))
    for li in poly.loop_indices:
        x, y, z = mesh.vertices[mesh.loops[li].vertex_index].co
        uv[li].uv = (y + .5, z) if axis == 0 else (x + .5, z) if axis == 1 else (x + .5, y + .5)
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))

material = bpy.data.materials.new('PetBody'); material.use_nodes = True
material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 0.8
mesh.materials.append(material)
cube['maker'] = 'Blender authored, no Tripo task'; cube['origin'] = 'bottom centre'

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'pet-cube.blend'))
bpy.ops.object.select_all(action='DESELECT'); cube.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT / 'pet-cube.glb'), export_format='GLB', use_selection=True, export_animations=False, export_yup=True, export_normals=True, export_texcoords=True)
data = (OUTPUT / 'pet-cube.glb').read_bytes()
uvs = [uv[i].uv[:] for i in range(len(uv))]
report = {
    'maker': 'Blender', 'script': 'tools/build-pet-cube.py', 'blend': 'assets-source/pets/pet-cube.blend', 'glb': 'src/game/assets/pets/pet-cube.glb',
    'triangles': sum(len(p.vertices) - 2 for p in mesh.polygons), 'vertices': len(mesh.vertices),
    'edge': EDGE, 'bevel': BEVEL, 'segments': SEGMENTS, 'origin': 'bottom centre, +Z (glTF) is the face side',
    'uvRange': [min(u for u, _ in uvs), min(v for _, v in uvs), max(u for u, _ in uvs), max(v for _, v in uvs)],
    'textures': 'none; colour, pattern and face are drawn at runtime per species',
    'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
}
(OUTPUT / 'pet-cube.manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('PET_CUBE', json.dumps(report))
