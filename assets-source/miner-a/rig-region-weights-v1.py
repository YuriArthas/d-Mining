"""为 A 矿工建立可编辑骨架、关节权重，并烘焙固定版本 RAB R15 动作。"""
import bpy
import json
import math
import hashlib
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets-source/miner-a'
OUTPUT = ROOT / 'src/game/assets/character'
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE / 'miner-a-original.glb'))
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
mesh.name = 'MinerA'
# 该 Tripo 任务在 Blender 中为 +X 朝前、Z 朝上；游戏为 -Z 朝前、Y 朝上。
# 先变成 Blender +Y 朝前，再由 glTF 导出进行坐标转换。
points = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
zmin, zmax = min(p.z for p in points), max(p.z for p in points)
factor = 1.85 / (zmax - zmin)
for vertex, p in zip(mesh.data.vertices, points):
    vertex.co = Vector((-p.y * factor, p.x * factor, (p.z - zmin) * factor))
mesh.matrix_world.identity()
mesh.data.update()

def pt(x, depth, z):
    return Vector((x * factor, depth * factor, (z - zmin) * factor))

# 坐标由本次生成网格的截面确定；保留原网格和 UV，不减面。
spec = {
    'Root': (None, pt(0, 0, -.105), pt(0, 0, -.04)),
    'LowerTorso': ('Root', pt(0, 0, -.105), pt(0, .015, -.005)),
    'UpperTorso': ('LowerTorso', pt(0, .015, -.005), pt(0, .008, .25)),
    'Head': ('UpperTorso', pt(0, .008, .25), pt(0, .008, .46)),
}
for side, sign in [('Left', -1), ('Right', 1)]:
    shoulder, elbow, wrist, hand = [pt(sign*x, y, z) for x, y, z in [(.157,.005,.18),(.214,.015,-.005),(.246,.035,-.145),(.249,.04,-.218)]]
    hip, knee, ankle, toe = [pt(sign*x, y, z) for x, y, z in [(.087,-.005,-.13),(.119,-.025,-.295),(.127,-.028,-.425),(.127,.07,-.47)]]
    spec.update({
        side+'UpperArm': ('UpperTorso', shoulder, elbow),
        side+'LowerArm': (side+'UpperArm', elbow, wrist),
        side+'Hand': (side+'LowerArm', wrist, hand),
        side+'UpperLeg': ('LowerTorso', hip, knee),
        side+'LowerLeg': (side+'UpperLeg', knee, ankle),
        side+'Foot': (side+'LowerLeg', ankle, toe),
    })

armature = bpy.data.armatures.new('MinerA_R15')
rig = bpy.data.objects.new('MinerA_Rig', armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
mesh.select_set(False)
rig.show_in_front = True
armature.display_type = 'STICK'
bpy.ops.object.mode_set(mode='EDIT')
for name, (parent, head, tail) in spec.items():
    bone = armature.edit_bones.new(name)
    bone.head = head
    # 所有骨骼局部坐标统一为 R15 的 X 右、Y 上、Z 后，关节枢轴独立于显示长度。
    bone.tail = head + Vector((0, 0, max(.045, (tail-head).length)))
    bone.use_deform = name != 'Root'
    if parent:
        bone.parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
mesh.parent = rig
modifier = mesh.modifiers.new('Miner skin', 'ARMATURE')
modifier.object = rig

def segment_distance(p, a, b):
    ab = b-a
    t = max(0, min(1, (p-a).dot(ab)/ab.length_squared))
    return (p-a-ab*t).length

# 先按身体区域约束候选骨骼，再平滑相邻关节，防止近身手臂吸到胸部或另一条腿。
groups = {name: mesh.vertex_groups.new(name=name) for name in spec if name != 'Root'}
counts = {name: 0 for name in groups}
for v in mesh.data.vertices:
    p = v.co
    x, y, z = p.x/factor, p.y/factor, p.z/factor+zmin
    side = 'Left' if x < 0 else 'Right'
    if z > .285:
        weights = {'Head': 1.0}
    else:
        if z > .22:
            candidates = ['Head', 'UpperTorso', side+'UpperArm']
        elif abs(x) > (.158 if z > .08 else .172) and z > -.235:
            candidates = [side+'UpperArm', side+'LowerArm', side+'Hand']
        elif z < -.17:
            candidates = [side+'UpperLeg', side+'LowerLeg', side+'Foot']
        elif z < -.075:
            candidates = ['LowerTorso', side+'UpperLeg']
        else:
            candidates = ['LowerTorso', 'UpperTorso']
        distances = sorted((segment_distance(p, spec[n][1], spec[n][2]), n) for n in candidates)
        nearest = distances[0][0]
        # 指数权重只混合局部相邻关节；硬帽和头部整体跟随头骨。
        values = [(n, math.exp(-((d-nearest)/.045)**2)) for d,n in distances if d-nearest < .11]
        total = sum(w for _,w in values)
        weights = {n:w/total for n,w in values if w/total > .005}
        norm = sum(weights.values())
        weights = {n:w/norm for n,w in weights.items()}
    for name, weight in weights.items():
        groups[name].add([v.index], weight, 'REPLACE')
    counts[max(weights, key=weights.get)] += 1

# A 站姿相对于 R15 垂直四肢的静止偏转。导入动作时消除该偏转，避免一直张开双臂。
offsets = {name: Quaternion() for name in spec}
for side in ['Left', 'Right']:
    for suffix in ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg']:
        name = side+suffix
        d = (spec[name][2]-spec[name][1]).normalized()
        canonical = Vector((d.x, d.z, -d.y))
        offsets[name] = Vector((0,-1,0)).rotation_difference(canonical)
    offsets[side+'Foot'] = Quaternion()

for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'

fps = 60
bpy.context.scene.render.fps = fps
rig.animation_data_create()
sources = []
foot_vertices = [v.index for v in mesh.data.vertices if v.co.z < .18]
loop_metrics = {}
for clip_name, source_name in [('Idle','idle'), ('Walk','walk'), ('Run','move')]:
    source = json.loads((SOURCE/f'rab-{source_name}.json').read_text())
    motion = source['currentVersion']['motion']
    duration = motion['durationSeconds']
    action = bpy.data.actions.new(clip_name)
    rig.animation_data.action = action
    count = round(duration*fps)
    all_samples = []
    first = motion['keyframes'][0]
    frames = motion['keyframes']
    def sample(t):
        before, after = frames[0], frames[-1]
        for a,b in zip(frames,frames[1:]):
            if a['timeSeconds'] <= t <= b['timeSeconds']:
                before, after = a,b
                break
        alpha = max(0,min(1,(t-before['timeSeconds'])/max(1e-9,after['timeSeconds']-before['timeSeconds'])))
        result = {}
        for joint in motion['joints']:
            key = joint['jointKey']
            a,b = before['transforms'][key],after['transforms'][key]
            qa = Quaternion((a['quaternion'][3],*a['quaternion'][:3]))
            qb = Quaternion((b['quaternion'][3],*b['quaternion'][:3]))
            result[key] = (qa.slerp(qb,alpha), Vector(a['position']).lerp(Vector(b['position']),alpha))
        return result
    start_sample = sample(0)
    for frame in range(count+1):
        bpy.context.scene.frame_set(frame)
        t = duration*frame/count
        transforms = sample(t)
        # 将最后 10% 的采样平滑接回首帧，消除导入动作本身的循环接缝。
        closing = max(0,(frame/count-.9)/.1)
        closing = closing*closing*(3-2*closing)
        for bone in rig.pose.bones:
            bone.location = (0,0,0)
            bone.rotation_quaternion = Quaternion()
        for joint in motion['joints']:
            name = joint['childPartName']
            parent = spec[name][0]
            q, translation = transforms[joint['jointKey']]
            q = q.slerp(start_sample[joint['jointKey']][0],closing)
            translation = translation.lerp(start_sample[joint['jointKey']][1],closing)
            bone = rig.pose.bones[name]
            bone.rotation_quaternion = offsets[parent] @ q @ offsets[name].inverted()
            # RAB 的根位移策略锁定到首帧；水平位移交给游戏。
            if name == 'LowerTorso':
                translation = Vector((0,first['transforms'][joint['jointKey']]['position'][1],0))
            bone.location = translation*(1.85/5)
        bpy.context.view_layer.update()
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        floor = min(evaluated.data.vertices[i].co.z for i in foot_vertices)
        rig.pose.bones['Root'].location.y = -floor
        bpy.context.view_layer.update()
        for bone in rig.pose.bones:
            bone.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=bone.name)
            bone.keyframe_insert(data_path='location',frame=frame,group=bone.name)
        all_samples.append({b.name:list(b.rotation_quaternion) for b in rig.pose.bones})
    loop_metrics[clip_name] = max(1-abs(Quaternion(all_samples[0][n]).dot(Quaternion(all_samples[-1][n]))) for n in spec)
    track = rig.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name,0,action)
    strip.action_frame_start = 0
    strip.action_frame_end = count
    track.mute = True
    sources.append({'clip':clip_name,'animationId':source['animationId'],'animationVersionId':source['currentVersion']['animationVersionId'],'name':source['name'],'source':source['meta'],'duration':count/fps,'url':'https://rab-sunjun-public.dev.clock-p.com/animations/'+source['animationId']})
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.location=(0,0,0)
    bone.rotation_quaternion=Quaternion()
for image in bpy.data.images:
    if image.size[0] > 0 and image.name != 'Render Result':
        image.pack()
rig['animation_sources'] = json.dumps(sources,ensure_ascii=False)
rig['retargeting'] = 'RAB R15 local joint rotations; rest-pose correction; root translation in-place; sole grounding; loop seam correction'
bpy.context.scene.frame_start=0
bpy.context.scene.frame_end=114
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'miner-a-rigged.blend'))
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active=rig
for track in rig.animation_data.nla_tracks:
    track.mute = False
bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'miner-a.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_def_bones=False,export_all_influences=False,export_materials='EXPORT',export_yup=True)
data=(OUTPUT/'miner-a.glb').read_bytes()
report={'taskId':json.loads((SOURCE/'task.json').read_text())['taskId'],'vertices':len(mesh.data.vertices),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'bones':len(rig.data.bones),'weights':'region-constrained smooth joint weights, rigid head/helmet','dominantVertexCounts':counts,'loopQuaternionError':loop_metrics,'height':1.85,'textures':[[im.name,*im.size] for im in bpy.data.images if im.size[0]>0 and im.name!='Render Result'],'sources':sources,'blend':'assets-source/miner-a/miner-a-rigged.blend','glb':'src/game/assets/character/miner-a.glb','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
(SOURCE/'rig-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(OUTPUT/'miner-a.manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('MINER_RIG',json.dumps(report,ensure_ascii=False))
