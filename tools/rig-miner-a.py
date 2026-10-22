"""为 A 矿工建立可编辑骨架、关节权重，并烘焙固定版本 RAB R15 动作。"""
import bpy
import json
import math
import hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets-source/miner-a'
OUTPUT = ROOT / 'src/game/assets/character'
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE / 'miner-a-original.glb'), merge_vertices=True)
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

# 靴子的静止姿势带有外撇；由真实鞋底拟合前后轴，不能假定脚掌朝正前方。
# 这些轴是绑定校正，不修改 RAB Run 的髋、膝、踝关键帧。
foot_binding = {}
for side, sign in [('Left', -1), ('Right', 1)]:
    sole = np.array([(v.co.x, v.co.y) for v in mesh.data.vertices if v.co.x*sign > 0 and v.co.z < .055])
    eigenvalues, axes = np.linalg.eigh(np.cov(sole.T))
    if len(sole) < 40 or eigenvalues[-1] / eigenvalues[0] < 1.5:
        raise RuntimeError(f'{side} 鞋底前后轴不明确，不能自动校正绑定')
    forward = axes[:, -1]
    if forward[1] < 0:
        forward = -forward
    # Blender +Y 朝前，对应 R15/glTF 的 -Z。
    yaw = math.atan2(-forward[0], forward[1])
    foot_binding[side] = {'restForward': [float(forward[0]), 0, -float(forward[1])], 'restYawDegrees': math.degrees(yaw), 'yawRadians': yaw}

# 坐标由本次生成网格的截面确定；保留原网格和 UV，不减面。
spec = {
    'Root': (None, pt(0, 0, -.105), pt(0, 0, -.04)),
    'LowerTorso': ('Root', pt(0, 0, -.105), pt(0, .015, -.005)),
    'UpperTorso': ('LowerTorso', pt(0, .015, -.005), pt(0, .008, .25)),
    'Head': ('UpperTorso', pt(0, .008, .25), pt(0, .008, .46)),
}
for side, sign in [('Left', -1), ('Right', 1)]:
    shoulder, elbow, wrist, hand = [pt(sign*x, y, z) for x, y, z in [(.17,.005,.20),(.213,.015,.105),(.245,.035,.015),(.249,.04,-.172)]]
    hip, knee, ankle, toe = [pt(sign*x, y, z) for x, y, z in [(.087,-.005,-.13),(.119,-.025,-.275),(.127,-.028,-.365),(.127,.07,-.47)]]
    spec.update({
        side+'UpperArm': ('UpperTorso', shoulder, elbow),
        side+'LowerArm': (side+'UpperArm', elbow, wrist),
        side+'Hand': (side+'LowerArm', wrist, hand),
        side+'UpperLeg': ('LowerTorso', hip, knee),
        side+'LowerLeg': (side+'UpperLeg', knee, ankle),
        side+'Foot': (side+'LowerLeg', ankle, toe),
    })

# 膝和踝枢轴放在网格横截面的中心，避免外侧枢轴把弯膝轮廓向外扯。
# 用边与截面的真实交点，不能用顶点均值（局部三角面密度并不均匀）。
joint_pivots = {}
for side, sign in [('Left', -1), ('Right', 1)]:
    for suffix in ['LowerLeg', 'Foot']:
        name=side+suffix
        parent,head,tail=spec[name]
        section=[]
        for edge in mesh.data.edges:
            a,b=(mesh.data.vertices[i].co for i in edge.vertices)
            if (a.z-head.z)*(b.z-head.z)>0 or abs(b.z-a.z)<1e-8:
                continue
            p=a.lerp(b,(head.z-a.z)/(b.z-a.z))
            if .025<p.x*sign<.36:
                section.append(p)
        if len(section)<20:
            raise RuntimeError(f'{name} 横截面不足，无法定位关节')
        center=Vector(((min(p.x for p in section)+max(p.x for p in section))/2,
                       (min(p.y for p in section)+max(p.y for p in section))/2,head.z))
        joint_pivots[name]={'before':list(head),'after':list(center)}
        spec[name]=(parent,center,tail)
        old_parent,old_head,_=spec[parent]
        spec[parent]=(old_parent,old_head,center)

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
    bone.tail = tail
    bone.use_deform = name != 'Root'
    if parent:
        bone.parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
# 先用真实解剖方向计算 Blender 骨骼热权重，再固定头盔并规范影响数。
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print('HEAT_TOTALS',min(sum(g.weight for g in v.groups) for v in mesh.data.vertices),sum(not v.groups for v in mesh.data.vertices))
if any(sum(g.weight for g in v.groups) < .00001 for v in mesh.data.vertices):
    raise RuntimeError('Blender 热权重存在未绑定顶点，需要修正骨架')
groups = {g.name:g for g in mesh.vertex_groups}
for v in mesh.data.vertices:
    if v.co.z/factor+zmin > .285:
        for group in list(v.groups):
            mesh.vertex_groups[group.group].remove([v.index])
        groups['Head'].add([v.index],1,'REPLACE')
bpy.context.view_layer.objects.active=mesh
rig.select_set(False)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
# 按焊接后网格邻接平滑关节权重，UV 仍保留在各面的角点。
adjacency=[set() for _ in mesh.data.vertices]
for edge in mesh.data.edges:
    a,b=edge.vertices
    adjacency[a].add(b)
    adjacency[b].add(a)
weight_maps=[{g.group:g.weight for g in v.groups} for v in mesh.data.vertices]
for _ in range(6):
    next_weights=[]
    for v,neighbors,weights in zip(mesh.data.vertices,adjacency,weight_maps):
        if not neighbors or v.co.z/factor+zmin>.285:
            next_weights.append(weights)
            continue
        mixed={i:w*.35 for i,w in weights.items()}
        for index in neighbors:
            for group,weight in weight_maps[index].items():
                mixed[group]=mixed.get(group,0)+weight*.65/len(neighbors)
        next_weights.append(mixed)
    weight_maps=next_weights
for v,weights in zip(mesh.data.vertices,weight_maps):
    for group in list(v.groups):
        mesh.vertex_groups[group.group].remove([v.index])
    # 膝部按沿腿部的位置刷权重，使内外侧在同一关节处弯折。
    # 限定同侧相邻骨骼，避免热权重将膝附近拉向脚掌或髋部。
    side='Left' if v.co.x<0 else 'Right'
    leg_names=[side+'UpperLeg',side+'LowerLeg',side+'Foot']
    leg_weight=sum(weights.get(groups[n].index,0) for n in leg_names)
    knee_z=spec[side+'LowerLeg'][1].z
    ankle_z=spec[side+'Foot'][1].z
    if v.co.z<knee_z+.13 and leg_weight>.9:
        def smooth(a,b,x):
            t=max(0,min(1,(x-a)/(b-a)))
            return t*t*(3-2*t)
        thigh=smooth(knee_z-.055,knee_z+.065,v.co.z)
        shin=smooth(ankle_z-.055,ankle_z+.06,v.co.z)
        painted={groups[side+'UpperLeg'].index:thigh,
                 groups[side+'LowerLeg'].index:(1-thigh)*shin,
                 groups[side+'Foot'].index:(1-thigh)*(1-shin)}
        # 上端接回原有大腿权重，保留髋部的平滑过渡。
        blend=1-smooth(knee_z+.08,knee_z+.13,v.co.z)
        weights={i:w*(1-blend) for i,w in weights.items()}
        for i,w in painted.items():
            weights[i]=weights.get(i,0)+w*blend
    # 鞋底保持完整形状，由踝骨控制；鞋帮上部继续平滑过渡到小腿。
    foot_index=groups[('Left' if v.co.x<0 else 'Right')+'Foot'].index
    sole_weight=max(0,min(1,(.20-v.co.z)/.09))
    sole_weight=sole_weight*sole_weight*(3-2*sole_weight)
    weights={i:w*(1-sole_weight) for i,w in weights.items()}
    weights[foot_index]=weights.get(foot_index,0)+sole_weight
    selected=sorted(weights.items(),key=lambda v:v[1],reverse=True)[:4]
    total=sum(w for _,w in selected)
    for group,weight in selected:
        mesh.vertex_groups[group].add([v.index],weight/total,'REPLACE')
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
counts={n:0 for n in spec if n!='Root'}
for v in mesh.data.vertices:
    dominant=max(v.groups,key=lambda g:g.weight)
    counts[mesh.vertex_groups[dominant.group].name]+=1
# 权重已完成，统一骨骼局部坐标用于 R15 旋转重定向。
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
mesh.select_set(False)
bpy.ops.object.mode_set(mode='EDIT')
for name,(_,head,tail) in spec.items():
    bone=armature.edit_bones[name]
    bone.tail=head+Vector((0,0,max(.045,(tail-head).length)))
    bone.roll=0
bpy.ops.object.mode_set(mode='OBJECT')

# A 站姿相对于 R15 垂直四肢的静止偏转。导入动作时消除该偏转，避免一直张开双臂。
offsets = {name: Quaternion() for name in spec}
for side in ['Left', 'Right']:
    for suffix in ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg']:
        name = side+suffix
        d = (spec[name][2]-spec[name][1]).normalized()
        canonical = Vector((d.x, d.z, -d.y))
        offsets[name] = Vector((0,-1,0)).rotation_difference(canonical)
    offsets[side+'Foot'] = Quaternion((0,1,0),foot_binding[side]['yawRadians'])

for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'

fps = 60
bpy.context.scene.render.fps = fps
rig.animation_data_create()
sources = []
foot_vertices = [v.index for v in mesh.data.vertices if v.co.z < .18]
loop_metrics = {}
knee_retarget_metrics = {}
idle_motion=json.loads((SOURCE/'rab-idle.json').read_text())['currentVersion']['motion']
idle_transforms=idle_motion['keyframes'][0]['transforms']
for clip_name, source_name in [('Idle','idle'), ('Walk','walk'), ('Run','move'), ('Mine','mine')]:
    source = json.loads((SOURCE/f'rab-{source_name}.json').read_text())
    motion = source['currentVersion']['motion']
    source_start,source_end=(.10,1.95) if clip_name=='Mine' else (0,motion['durationSeconds'])
    duration = source_end-source_start
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
    start_sample = sample(source_start)
    knee_metrics={'maxLateralBefore':0,'maxLateralAfter':0,'maxAnkleDrift':0}
    for frame in range(count+1):
        bpy.context.scene.frame_set(frame)
        t = duration*frame/count
        transforms = sample(t+source_start)
        # 将最后 10% 的采样平滑接回首帧，消除导入动作本身的循环接缝。
        closing = max(0,(frame/count-.9)/.1)
        closing = closing*closing*(3-2*closing)
        for bone in rig.pose.bones:
            bone.location = (0,0,0)
            bone.rotation_quaternion = Quaternion()
        # 先完整采样源动作，再按该角色比例重定向两节腿。
        # 保留髋与踝端点、脚掌朝向；膝的弯折平面朝骨盆前方，避免
        # R15 转换动作中的侧向膝旋转在短粗腿上表现为向外拧。
        local_rotations={j['childPartName']:transforms[j['jointKey']][0].slerp(start_sample[j['jointKey']][0],closing) for j in motion['joints']}
        if clip_name=='Mine':
            # 下劈的躯干转动归到上身；游戏中的下肢仍由 Idle/Walk/Run 控制。
            local_rotations['UpperTorso']=local_rotations['LowerTorso'] @ local_rotations['UpperTorso']
            for j in motion['joints']:
                name=j['childPartName']
                if name=='LowerTorso' or 'Leg' in name or 'Foot' in name:
                    q=idle_transforms[j['jointKey']]['quaternion']
                    local_rotations[name]=Quaternion((q[3],*q[:3]))
        world_rotations={'Root':Quaternion()}
        def world_rotation(name):
            if name not in world_rotations:
                world_rotations[name]=world_rotation(spec[name][0]) @ local_rotations[name]
            return world_rotations[name]
        for name in local_rotations:
            world_rotation(name)
        if clip_name in ['Walk','Run']:
            forward=world_rotations['LowerTorso'] @ Vector((0,0,-1))
            for side in ['Left','Right']:
                upper,lower,foot=(side+s for s in ['UpperLeg','LowerLeg','Foot'])
                upper_length=(spec[upper][2]-spec[upper][1]).length
                lower_length=(spec[lower][2]-spec[lower][1]).length
                old_thigh=world_rotations[upper] @ Vector((0,-1,0))
                old_shin=world_rotations[lower] @ Vector((0,-1,0))
                ankle=old_thigh*upper_length+old_shin*lower_length
                distance=ankle.length
                axis=ankle.normalized()
                pole=forward-axis*forward.dot(axis)
                if pole.length<1e-5:
                    raise RuntimeError(f'{clip_name} {side} 膝盖朝向无解')
                pole.normalize()
                along=(upper_length**2-lower_length**2+distance**2)/(2*distance)
                height=math.sqrt(max(0,upper_length**2-along**2))
                knee=axis*along+pole*height
                new_thigh=knee.normalized()
                new_shin=(ankle-knee).normalized()
                upper_world=old_thigh.rotation_difference(new_thigh) @ world_rotations[upper]
                lower_world=old_shin.rotation_difference(new_shin) @ world_rotations[lower]
                local_rotations[upper]=world_rotations['LowerTorso'].inverted() @ upper_world
                local_rotations[lower]=upper_world.inverted() @ lower_world
                local_rotations[foot]=lower_world.inverted() @ world_rotations[foot]
                normal=axis.cross(pole).normalized()
                knee_metrics['maxLateralBefore']=max(knee_metrics['maxLateralBefore'],abs((old_thigh*upper_length).dot(normal)))
                knee_metrics['maxLateralAfter']=max(knee_metrics['maxLateralAfter'],abs(knee.dot(normal)))
                knee_metrics['maxAnkleDrift']=max(knee_metrics['maxAnkleDrift'],(new_thigh*upper_length+new_shin*lower_length-ankle).length)
        for joint in motion['joints']:
            name = joint['childPartName']
            parent = spec[name][0]
            q, translation = transforms[joint['jointKey']]
            q = local_rotations[name]
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
    knee_retarget_metrics[clip_name]=knee_metrics
    track = rig.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name,0,action)
    strip.action_frame_start = 0
    strip.action_frame_end = count
    track.mute = True
    sources.append({'clip':clip_name,'animationId':source['animationId'],'animationVersionId':source['currentVersion']['animationVersionId'],'name':source['name'],'source':source['meta'],'duration':count/fps,'sourceRange':[source_start,source_end],'url':'https://rab-sunjun-public.dev.clock-p.com/animations/'+source['animationId']})
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.location=(0,0,0)
    bone.rotation_quaternion=Quaternion()
for image in bpy.data.images:
    if image.size[0] > 0 and image.name != 'Render Result':
        image.pack()
rig['animation_sources'] = json.dumps(sources,ensure_ascii=False)
rig['retargeting'] = 'RAB R15 local joint rotations; rest-pose correction; root translation in-place; sole grounding; loop seam correction'
rig['foot_binding'] = json.dumps(foot_binding)
rig['joint_pivots'] = json.dumps(joint_pivots)
rig['knee_retarget'] = json.dumps(knee_retarget_metrics)
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
report={'taskId':json.loads((SOURCE/'task.json').read_text())['taskId'],'vertices':len(mesh.data.vertices),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'bones':len(rig.data.bones),'weights':'Blender bone-heat weights from authored anatomical skeleton; rigid head/helmet; normalized max 4 influences','dominantVertexCounts':counts,'loopQuaternionError':loop_metrics,'height':1.85,'textures':[[im.name,*im.size] for im in bpy.data.images if im.size[0]>0 and im.source=='FILE'],'sources':sources,'blend':'assets-source/miner-a/miner-a-rigged.blend','glb':'src/game/assets/character/miner-a.glb','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
report['footBinding']=foot_binding
report['jointPivots']=joint_pivots
report['kneeRetarget']=knee_retarget_metrics
(SOURCE/'rig-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(OUTPUT/'miner-a.manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('MINER_RIG',json.dumps(report,ensure_ascii=False))
