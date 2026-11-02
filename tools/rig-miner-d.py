"""为 D 小探险家（Tripo 84856ff3）建立 R15 骨架并烘焙 RAB R15 动作。

骨骼和权重都借自已上线的 A 矿工（src/game/assets/character/miner-a.glb）：
- 关节：在 A、D 两个身体上用网格截面找同样的标志点（胯下、腋下、颈部最细处、手指尖、四肢截面中心），
  A 的每个关节按它在标志点之间的相对位置搬到 D 身上，四肢关节再对准 D 自己的截面中心。这样保留 A 为
  R15 动作定下的关节约定（Root 在胯下、静止旋转全为单位四元数、膝踝枢轴在截面中心）。
- 权重：按骨骼把 A 的网格变形到 D 的比例（每根骨骼沿骨方向按长度、横向按截面宽度缩放），再按最近表面
  的重心坐标把 A 的最终权重转移到 D 的每个顶点；之后重新套用 A 的修正：头盔整块跟头、膝部按腿上位置
  重刷、鞋底整块跟脚，最多 4 根骨骼并归一化。
动作烘焙（A 字站姿偏转、脚掌朝向、两节腿膝部重定向、根位移、接缝）与 rig-miner-a.py 相同，动作数据
同样取 assets-source/miner-a/rab-*.json。
Run: blender -b --python tools/rig-miner-d.py
"""
import bpy
import json
import math
import hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets-source/miner-d'
MOTIONS = ROOT / 'assets-source/miner-a'
OUTPUT = ROOT / 'src/game/assets/character'
HEIGHT = 1.85
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# ---------------------------------------------------------------------------------------------------------------
# A 矿工：已上线的骨架（静止姿势）、网格与最终权重。
bpy.ops.import_scene.gltf(filepath=str(OUTPUT / 'miner-a.glb'))
a_rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
a_mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
A_JOINT = {b.name: np.array(a_rig.matrix_world @ b.head_local) for b in a_rig.data.bones}
A_PARENT = {b.name: (b.parent.name if b.parent else None) for b in a_rig.data.bones}
A_V = np.array([list(a_mesh.matrix_world @ v.co) for v in a_mesh.data.vertices])
A_T = np.array([list(p.vertices) for p in a_mesh.data.polygons])
GROUPS = [g.name for g in a_mesh.vertex_groups]
A_W = np.zeros((len(A_V), len(GROUPS)))
for v in a_mesh.data.vertices:
    for g in v.groups:
        A_W[v.index, g.group] = g.weight
if A_T.shape[1] != 3:
    raise RuntimeError('A 矿工网格应为三角面')
# 导出的 GLB 在 UV 接缝处拆开了顶点；截面按拓扑连环，所以另备一份按位置焊接的三角形索引（权重仍按原顶点）。
A_U, weld = np.unique(np.round(A_V, 5), axis=0, return_inverse=True)
A_TW = weld.ravel()[A_T]
for o in list(bpy.context.scene.objects):
    bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# D：Tripo 模型在 Blender 中 +X 朝前、Z 朝上；转成 +Y 朝前（glTF 导出再转坐标），身高 1.85 米，脚底着地。
bpy.ops.import_scene.gltf(filepath=str(SOURCE / 'miner-d-original.glb'), merge_vertices=True)
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
mesh.name = 'MinerD'
points = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
zmin, zmax = min(p.z for p in points), max(p.z for p in points)
factor = HEIGHT / (zmax - zmin)
for vertex, p in zip(mesh.data.vertices, points):
    vertex.co = Vector((-p.y * factor, p.x * factor, (p.z - zmin) * factor))
mesh.matrix_world.identity()
mesh.data.update()
# 贴图提亮：Tripo 把明暗烤进了贴图，用到部分的明暗中位数只有 0.46（参考图 0.89），在游戏里比场景和宠物暗一档。
# sRGB 值先取 0.7 次方再乘 1.15：暗部提得多、亮部几乎不动（0.46→0.67，0.2→0.37，0.92→0.97）。
TEXTURE_LIFT = {'gamma': .7, 'gain': 1.15}
for image in bpy.data.images:
    if image.size[0] > 0 and image.source == 'FILE':
        px = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32); image.pixels.foreach_get(px); px = px.reshape(-1, 4)
        px[:, :3] = np.minimum(1, px[:, :3] ** TEXTURE_LIFT['gamma'] * TEXTURE_LIFT['gain'])
        image.pixels.foreach_set(px.ravel())
        lifted = SOURCE / 'miner-d-color-lifted.jpg'
        image.filepath_raw = str(lifted); image.file_format = 'JPEG'
        bpy.context.scene.render.image_settings.quality = 92
        image.save()
        # The exporter writes a packed image's original bytes: load the lifted file and put it in the material.
        fresh = bpy.data.images.load(str(lifted))
        for material in bpy.data.materials:
            for node in (material.node_tree.nodes if material.use_nodes else []):
                if node.type == 'TEX_IMAGE' and node.image == image:
                    node.image = fresh
        break
D_V = np.array([list(v.co) for v in mesh.data.vertices])
D_T = np.array([list(p.vertices) for p in mesh.data.polygons])
if D_T.shape[1] != 3:
    raise RuntimeError('D 网格应为三角面')

# ---------------------------------------------------------------------------------------------------------------
# 标志点：水平面切过网格，每个跨过它的三角形贡献一段轮廓，共用一条边的段连成闭合环；按环判断哪里是
# 躯干、哪里是手臂和腿（大平面上的交点很稀，按 x 间隙分段会把同一个躯干拆开）。
def loops(V, T, z):
    above = V[:, 2] > z
    crossing = T[above[T].sum(1) % 3 != 0]
    parent = {}
    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]; k = parent[k]
        return k
    point = {}
    for tri in crossing:
        keys = []
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
            if above[a] != above[b]:
                k = (min(a, b), max(a, b)); keys.append(k)
                if k not in point:
                    pa, pb = V[a], V[b]; point[k] = pa + (pb - pa) * ((z - pa[2]) / (pb[2] - pa[2])); parent[k] = k
        for k in keys[1:]:
            parent[find(k)] = find(keys[0])
    rings = {}
    for k in point:
        rings.setdefault(find(k), []).append(point[k])
    return [np.array(r) for r in rings.values() if len(r) >= 3]
def central(rs):
    for r in rs:
        if r[:, 0].min() <= 0 <= r[:, 0].max():
            return r
    return None
def side_rings(rs, side):
    return [r for r in rs if (r[:, 0] * side).min() > 0]

def landmarks(V, T):
    zs = np.arange(.05, HEIGHT - .02, .004)
    crotch = max(z for z in zs if z < 1.0 and central(loops(V, T, z)) is None and len(loops(V, T, z)) >= 2)
    widths = []
    for z in zs:
        if crotch + .4 < z < HEIGHT - .15:
            c = central(loops(V, T, z))
            if c is not None:
                widths.append((z, c[:, 0].max() - c[:, 0].min()))
    neck = min(widths, key=lambda t: t[1])[0]
    def arm_apart(z):
        rs = loops(V, T, z); c = central(rs)
        return c is not None and any(r[:, 0].max() - r[:, 0].min() > .04 and r[:, 0].min() > c[:, 0].max() for r in side_rings(rs, 1))
    armpit = max(z for z in zs if crotch + .2 < z < neck - .05 and all(arm_apart(z - k * .008) for k in range(6)))
    # The hands hang outside the legs (both legs stay within x 0.34 on both bodies).
    hand = V[(V[:, 0] > .345) & (V[:, 2] > .45) & (V[:, 2] < armpit)]
    fingertip = hand[:, 2].min()
    return {'crotch': float(crotch), 'neck': float(neck), 'armpit': float(armpit), 'fingertip': float(fingertip)}
armpit_edge = {}
def limb_centre(V, T, z, side, kind):
    """Centre (x, y, z) and x width of the arm (the outermost ring on that side) or the leg (the biggest ring on that
    side) in the section at z."""
    rs = side_rings(loops(V, T, z), side)
    if not rs and kind == 'arm' and armpit_edge.get(id(V)):
        # Above the armpit the arm is still joined to the torso: its part of the ring outside the torso's width
        # just under the armpit.
        c = central(loops(V, T, z)); edge = armpit_edge[id(V)]
        if c is not None and ((c[:, 0] * side) > edge).sum() >= 3:
            rs = [c[(c[:, 0] * side) > edge]]
    if not rs:
        raise RuntimeError(f'{kind} {z:.3f}: 没有截面')
    r = max(rs, key=lambda r: (r[:, 0] * side).max()) if kind == 'arm' else max(rs, key=lambda r: np.ptp(r[:, 0]) * np.ptp(r[:, 1]))
    return np.array([(r[:, 0].min() + r[:, 0].max()) / 2, (r[:, 1].min() + r[:, 1].max()) / 2, z]), float(np.ptp(r[:, 0]))

LA, LD = landmarks(A_U, A_TW), landmarks(D_V, D_T)
# The torso's half width just under each armpit (where the arm ring first stands apart).
armpit_edge = {}
for V, T, L in ((A_U, A_TW, LA), (D_V, D_T, LD)):
    c = central(loops(V, T, L['armpit'] - .01)); armpit_edge[id(V)] = float(c[:, 0].max())
print('LANDMARKS', json.dumps({'A': LA, 'D': LD}))
def band(z):
    """A height on A's body to the same relative height on D's: sole-crotch, crotch-neck, neck-top."""
    for lo, hi in (('sole', 'crotch'), ('crotch', 'neck'), ('neck', 'top')):
        a0 = 0 if lo == 'sole' else LA[lo]; a1 = HEIGHT if hi == 'top' else LA[hi]
        d0 = 0 if lo == 'sole' else LD[lo]; d1 = HEIGHT if hi == 'top' else LD[hi]
        if z <= a1 or hi == 'top':
            return d0 + (z - a0) * (d1 - d0) / (a1 - a0)

# D 的关节：躯干和头沿中线按高度带搬；腿的髋、膝、踝按高度带定高度，再对准 D 的腿截面中心；
# 肩按 A 肩在“腋下到颈”之间的位置搬，横向按两身体在该高度的肩宽比例；肘、腕按 A 在“肩到指尖”之间的
# 比例定高度，再对准 D 的手臂截面中心。
D_JOINT = {}
for name in ('Root', 'LowerTorso', 'UpperTorso', 'Head'):
    j = A_JOINT[name]; D_JOINT[name] = np.array([0, j[1], band(j[2])])
shoulder_a = A_JOINT['RightUpperArm']
def shoulder_width(V, T, z):
    c = central(loops(V, T, z)); return float(c[:, 0].max()) if c is not None else None
za_s = shoulder_a[2]; zd_s = band(za_s)
sx = shoulder_a[0] * shoulder_width(D_V, D_T, zd_s) / shoulder_width(A_U, A_TW, za_s)
arm_t = {n: (shoulder_a[2] - A_JOINT['Right' + n][2]) / (shoulder_a[2] - LA['fingertip']) for n in ('LowerArm', 'Hand')}
for side, sign in (('Left', -1), ('Right', 1)):
    D_JOINT[side + 'UpperArm'] = np.array([sign * sx, shoulder_a[1], zd_s])
    for n, t in arm_t.items():
        z = zd_s - t * (zd_s - LD['fingertip'])
        D_JOINT[side + n] = limb_centre(D_V, D_T, z, sign, 'arm')[0]
    for n in ('UpperLeg', 'LowerLeg', 'Foot'):
        z = band(A_JOINT['Right' + n][2])
        c = limb_centre(D_V, D_T, z, sign, 'leg')[0]
        # 髋在胯下以上：截面是整个躯干，沿用 A 髋的横向位置比例（按两腿中心距）。
        if n == 'UpperLeg' and z > LD['crotch'] - .01:
            ref_a = limb_centre(A_U, A_TW, LA['crotch'] * .8, 1, 'leg')[0][0]
            ref_d = limb_centre(D_V, D_T, LD['crotch'] * .8, 1, 'leg')[0][0]
            c = np.array([sign * abs(A_JOINT['Right' + n][0]) * ref_d / ref_a, A_JOINT['Right' + n][1], z])
        D_JOINT[side + n] = c
# 末端：手掌（腕下方手套中部）、脚尖（鞋底最前方）、头顶。
TIPS_A, TIPS_D = {}, {}
for V, T, L, J, tips in ((A_U, A_TW, LA, A_JOINT, TIPS_A), (D_V, D_T, LD, D_JOINT, TIPS_D)):
    for side, sign in (('Left', -1), ('Right', 1)):
        wrist = J[side + 'Hand']
        tips[side + 'Hand'] = limb_centre(V, T, wrist[2] - (wrist[2] - L['fingertip']) * .55, sign, 'arm')[0]
        sole = V[(V[:, 0] * sign > .03) & (V[:, 2] < .06)]
        tips[side + 'Foot'] = np.array([J[side + 'Foot'][0], sole[:, 1].max() - .03, .05])
    tips['Head'] = np.array([0, J['Head'][1], HEIGHT - .05])
CHILD = {'LowerTorso': 'UpperTorso', 'UpperTorso': 'Head'}
for side in ('Left', 'Right'):
    CHILD.update({side + 'UpperArm': side + 'LowerArm', side + 'LowerArm': side + 'Hand', side + 'UpperLeg': side + 'LowerLeg', side + 'LowerLeg': side + 'Foot'})
def end(J, tips, name):
    return J[CHILD[name]] if name in CHILD else tips[name]
print('JOINTS_D', json.dumps({k: [round(float(x), 4) for x in v] for k, v in D_JOINT.items()}))

# ---------------------------------------------------------------------------------------------------------------
# 权重转移：先按骨骼把 A 的网格变形到 D 的比例，再取最近表面点的权重。
def width(V, T, name, J, tips, L):
    a, b = J[name], end(J, tips, name); z = (a[2] + b[2]) / 2
    if 'Arm' in name or 'Hand' in name:
        return limb_centre(V, T, z, 1, 'arm')[1]
    if 'Leg' in name or 'Foot' in name:
        return limb_centre(V, T, max(z, .08), 1, 'leg')[1]
    c = central(loops(V, T, z)); return float(np.ptp(c[:, 0]))
deform = {}
for name in GROUPS:
    if name == 'Root':
        continue
    side_name = name.replace('Left', 'Right')
    ha, ea, hd, ed = A_JOINT[name], end(A_JOINT, TIPS_A, name), D_JOINT[name], end(D_JOINT, TIPS_D, name)
    da, dd = ea - ha, ed - hd
    along = np.linalg.norm(dd) / np.linalg.norm(da)
    across = width(D_V, D_T, side_name, D_JOINT, TIPS_D, LD) / width(A_U, A_TW, side_name, A_JOINT, TIPS_A, LA)
    rot = np.array(Vector(da).rotation_difference(Vector(dd)).to_matrix())
    u = da / np.linalg.norm(da)
    deform[name] = (ha, hd, u, along, across, rot)
def moved(P, name):
    """A's points carried by one bone to D: along the bone scaled by the length ratio, across by the width ratio,
    turned from A's bone direction to D's and moved to D's joint."""
    ha, hd, u, along, across, rot = deform[name]
    q = P - ha; par = np.outer(q @ u, u)
    return hd + (par * along + (q - par) * across) @ rot.T
A_MOVED = np.zeros_like(A_V)
for i, name in enumerate(GROUPS):
    if name in deform and A_W[:, i].any():
        A_MOVED += A_W[:, i:i + 1] * moved(A_V, name)
tree = BVHTree.FromPolygons([Vector(p) for p in A_MOVED], [list(t) for t in A_T])
D_W = np.zeros((len(D_V), len(GROUPS)))
far = 0
for i, p in enumerate(D_V):
    location, _, face, distance = tree.find_nearest(Vector(p))
    a, b, c = (A_MOVED[k] for k in A_T[face])
    v0, v1, v2 = b - a, c - a, np.array(location) - a
    d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
    den = d00 * d11 - d01 * d01 or 1e-12
    w1 = (d11 * d20 - d01 * d21) / den; w2 = (d00 * d21 - d01 * d20) / den; w0 = 1 - w1 - w2
    bary = np.clip([w0, w1, w2], 0, 1); bary /= bary.sum()
    D_W[i] = bary @ A_W[A_T[face]]
    far = max(far, distance)
print('TRANSFER max distance %.3f m' % far)
# 转移只看最近表面：D 的肚子比 A 往前凸，胸口和腰包离 A 垂在身前的手更近，会被绑到手和前臂上，跑步时
# 拉出长刺。手指尖到腋下之间按截面分区：从中线附近开始的环是躯干和腿，更外面的是手臂和手指，以前者的外缘为界；界内的顶点去掉手臂
# 骨骼，界外且贴着手臂中线（13 厘米内，腰带上的工具包不算）的去掉躯干和腿；腋下到肩之间胸口中间去掉
# 手臂权重，肩头保留转移来的过渡。
def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
ARM = {side: [GROUPS.index(side + n) for n in ('UpperArm', 'LowerArm', 'Hand')] for side in ('Left', 'Right')}
edges_at = {}
def body_edge(z, side):
    """How far out the torso or the leg reaches at z on that side: the rings that start near the middle (|x| < .2;
    the arms and the fingers hang farther out on both bodies), or None where nothing hangs outside them."""
    key = (round(z / .005), side)
    if key not in edges_at:
        rs = side_rings(loops(D_V, D_T, z), side); c = central(loops(D_V, D_T, z))
        body = [r for r in rs if (r[:, 0] * side).min() < .2] + ([c] if c is not None else [])
        outside = [r for r in rs if (r[:, 0] * side).min() >= .2]
        edges_at[key] = max(float((r[:, 0] * side).max()) for r in body) if body and outside else None
    return edges_at[key]
def arm_distance(p, side):
    """Distance from the arm's centre line (shoulder, elbow, wrist, palm)."""
    chain = [D_JOINT[side + n] for n in ('UpperArm', 'LowerArm', 'Hand')] + [TIPS_D[side + 'Hand'], FINGERTIP[side]]
    best = 1e9
    for a, b in zip(chain, chain[1:]):
        t = np.clip((p - a) @ (b - a) / ((b - a) @ (b - a)), 0, 1); best = min(best, np.linalg.norm(p - (a + t * (b - a))))
    return best
FINGERTIP = {}
for side, sign in (('Left', -1), ('Right', 1)):
    hand = D_V[(D_V[:, 0] * sign > .345) & (D_V[:, 2] > .45)]
    FINGERTIP[side] = hand[hand[:, 2].argmin()]
edge_at_armpit = armpit_edge[id(D_V)]
head_from = LD['neck'] - (LA['neck'] - 1.452)
# The collar under the rigid head follows the chest: A's head weights reach down onto D's short neck and
# shoulders and tear against the arms there; below the head's line they fade out over 8 cm.
head = GROUPS.index('Head')
for i, p in enumerate(D_V):
    if p[2] < head_from and D_W[i, head] > 0:
        cut = D_W[i, head] * (1 - smooth(head_from - .08, head_from, p[2]))
        D_W[i, head] -= cut; D_W[i, GROUPS.index('UpperTorso')] += cut
# Between the fingertips and the armpit: the arm is what hangs outside the torso or the leg and is joined to the
# arm's own line through the mesh (grown from the points right on the line); a pouch on the belt is outside too but
# joined only through the belt, which is not, and a thumb sticking forward is joined through the glove.
zone = (D_V[:, 2] >= LD['fingertip'] - .01) & (D_V[:, 2] < LD['armpit'] - .02)
side_of = np.where(D_V[:, 0] < 0, -1, 1)
edge_of = np.array([body_edge(p[2], s) if z else None for p, s, z in zip(D_V, side_of, zone)], dtype=object)
outside = np.array([e is not None and p[0] * s > e + .004 for p, s, e in zip(D_V, side_of, edge_of)])
near = np.array([z and arm_distance(p, 'Left' if s < 0 else 'Right') < .09 for p, s, z in zip(D_V, side_of, zone)])
neighbours = [[] for _ in D_V]
for a, b, c in D_T:
    for u, w in ((a, b), (b, c), (c, a)):
        neighbours[u].append(w); neighbours[w].append(u)
is_arm = near.copy(); queue = list(np.flatnonzero(near))
while queue:
    u = queue.pop()
    for w in neighbours[u]:
        if not is_arm[w] and zone[w] and (outside[w] or near[w]) and side_of[w] == side_of[u]:
            is_arm[w] = True; queue.append(w)
split = {'arm': 0, 'body': 0, 'chest': 0}
for i, p in enumerate(D_V):
    side = 'Left' if p[0] < 0 else 'Right'
    arm = ARM[side]; row = D_W[i]
    merged = zone[i] and edge_of[i] is None and p[2] >= LD['armpit'] - .1
    # Between the armpit and the head's line (and just under the armpit, where the arm ring has not stood apart yet)
    # the middle of the chest does not follow the arms: their share fades in from 70% to 120% of the torso's half
    # width under the armpit (no hard seam between neighbours).
    if (merged or LD['armpit'] - .02 <= p[2] <= head_from) and row[ARM['Left'] + ARM['Right']].sum() > 0:
        keep = smooth(edge_at_armpit * .7, edge_at_armpit * 1.2, abs(p[0]))
        if keep < 1:
            out = row.copy(); out[ARM['Left'] + ARM['Right']] *= keep
            out[GROUPS.index('UpperTorso')] += row[ARM['Left'] + ARM['Right']].sum() * (1 - keep)
            D_W[i] = out / out.sum(); split['chest'] += 1
        continue
    if not zone[i] or edge_of[i] is None:
        continue
    if is_arm[i]:
        keep = np.zeros_like(row); keep[arm] = row[arm]
        if keep.sum() < 1e-3:
            keep[GROUPS.index(side + ('Hand' if p[2] < D_JOINT[side + 'Hand'][2] else 'LowerArm'))] = 1
        D_W[i] = keep / keep.sum(); split['arm'] += 1
    else:
        rest = row.copy(); rest[ARM['Left'] + ARM['Right']] = 0
        if rest.sum() < 1e-3:
            rest[GROUPS.index('UpperTorso' if p[2] > D_JOINT['UpperTorso'][2] else 'LowerTorso')] = 1
        D_W[i] = rest / rest.sum(); split['body'] += 1
print('SPLIT', split)

# ---------------------------------------------------------------------------------------------------------------
# 骨架：A 的骨骼层级与命名，D 的关节位置。
spec = {}
for name, parent in A_PARENT.items():
    if name == 'Root':
        spec[name] = (None, Vector(D_JOINT['Root']), Vector(D_JOINT['Root']) + Vector((0, 0, .065)))
    else:
        spec[name] = (parent, Vector(D_JOINT[name]), Vector(end(D_JOINT, TIPS_D, name)))

# 靴子：由真实鞋底拟合前后轴（绑定校正，不改 RAB 关键帧）。
foot_binding = {}
for side, sign in [('Left', -1), ('Right', 1)]:
    sole = np.array([(v.co.x, v.co.y) for v in mesh.data.vertices if v.co.x * sign > 0 and v.co.z < .055])
    eigenvalues, axes = np.linalg.eigh(np.cov(sole.T))
    if len(sole) < 40 or eigenvalues[-1] / eigenvalues[0] < 1.5:
        raise RuntimeError(f'{side} 鞋底前后轴不明确，不能自动校正绑定')
    forward = axes[:, -1]
    if forward[1] < 0:
        forward = -forward
    yaw = math.atan2(-forward[0], forward[1])
    foot_binding[side] = {'restForward': [float(forward[0]), 0, -float(forward[1])], 'restYawDegrees': math.degrees(yaw), 'yawRadians': yaw}

# 膝和踝枢轴放在网格横截面的中心（边与截面的真实交点）。
joint_pivots = {}
for side, sign in [('Left', -1), ('Right', 1)]:
    for suffix in ['LowerLeg', 'Foot']:
        name = side + suffix
        parent, head, tail = spec[name]
        centre = limb_centre(D_V, D_T, head.z, sign, 'leg')[0]
        joint_pivots[name] = {'before': list(head), 'after': list(centre)}
        spec[name] = (parent, Vector(centre), tail)
        old_parent, old_head, _ = spec[parent]
        spec[parent] = (old_parent, old_head, Vector(centre))

armature = bpy.data.armatures.new('MinerD_R15')
rig = bpy.data.objects.new('MinerD_Rig', armature)
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
    bone.tail = tail if (tail - head).length > .01 else head + Vector((0, 0, .05))
    bone.use_deform = name != 'Root'
    if parent:
        bone.parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

# 转移来的权重，套用 A 的修正：头盔与头整块跟头（颈部最细处略下方以上），膝部按腿上位置重刷，鞋底整块跟脚。
for name in GROUPS:
    if name != 'Root':
        mesh.vertex_groups.new(name=name)
groups = {g.name: g for g in mesh.vertex_groups}
def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
counts = {n: 0 for n in spec if n != 'Root'}
for v, row in zip(mesh.data.vertices, D_W):
    weights = {groups[GROUPS[k]].index: float(w) for k, w in enumerate(row) if w > 1e-4 and GROUPS[k] != 'Root'}
    if v.co.z > head_from:
        weights = {groups['Head'].index: 1.0}
    side = 'Left' if v.co.x < 0 else 'Right'
    leg_names = [side + 'UpperLeg', side + 'LowerLeg', side + 'Foot']
    leg_weight = sum(weights.get(groups[n].index, 0) for n in leg_names)
    knee_z = spec[side + 'LowerLeg'][1].z
    ankle_z = spec[side + 'Foot'][1].z
    if v.co.z < knee_z + .13 and leg_weight > .9:
        thigh = smooth(knee_z - .055, knee_z + .065, v.co.z)
        shin = smooth(ankle_z - .055, ankle_z + .06, v.co.z)
        painted = {groups[side + 'UpperLeg'].index: thigh,
                   groups[side + 'LowerLeg'].index: (1 - thigh) * shin,
                   groups[side + 'Foot'].index: (1 - thigh) * (1 - shin)}
        blend = 1 - smooth(knee_z + .08, knee_z + .13, v.co.z)
        weights = {i: w * (1 - blend) for i, w in weights.items()}
        for i, w in painted.items():
            weights[i] = weights.get(i, 0) + w * blend
    # 手臂同理：A 的肘很高、手套很长，转移后 D 的前臂皮肤大多跟了手；按沿臂的高度重刷上臂、前臂、手，
    # 肩部保留转移来的权重（与躯干的过渡）。
    arm_names = [side + 'UpperArm', side + 'LowerArm', side + 'Hand']
    arm_weight = sum(weights.get(groups[n].index, 0) for n in arm_names)
    elbow_z = spec[side + 'LowerArm'][1].z
    wrist_z = spec[side + 'Hand'][1].z
    if v.co.z < elbow_z + .12 and arm_weight > .9:
        upper = smooth(elbow_z - .04, elbow_z + .04, v.co.z)
        fore = smooth(wrist_z - .03, wrist_z + .03, v.co.z)
        painted = {groups[side + 'UpperArm'].index: upper,
                   groups[side + 'LowerArm'].index: (1 - upper) * fore,
                   groups[side + 'Hand'].index: (1 - upper) * (1 - fore)}
        blend = 1 - smooth(elbow_z + .06, elbow_z + .12, v.co.z)
        weights = {i: w * (1 - blend) for i, w in weights.items()}
        for i, w in painted.items():
            weights[i] = weights.get(i, 0) + w * blend
    foot_index = groups[side + 'Foot'].index
    sole_weight = max(0, min(1, (.20 - v.co.z) / .09))
    sole_weight = sole_weight * sole_weight * (3 - 2 * sole_weight)
    weights = {i: w * (1 - sole_weight) for i, w in weights.items()}
    weights[foot_index] = weights.get(foot_index, 0) + sole_weight
    selected = sorted(weights.items(), key=lambda t: t[1], reverse=True)[:4]
    total = sum(w for _, w in selected)
    for group, weight in selected:
        mesh.vertex_groups[group].add([v.index], weight / total, 'REPLACE')
    counts[mesh.vertex_groups[selected[0][0]].name] += 1
modifier = mesh.modifiers.new('Armature', 'ARMATURE')
modifier.object = rig
mesh.parent = rig

# 权重已完成，统一骨骼局部坐标用于 R15 旋转重定向。
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
mesh.select_set(False)
bpy.ops.object.mode_set(mode='EDIT')
for name, (_, head, tail) in spec.items():
    bone = armature.edit_bones[name]
    bone.tail = head + Vector((0, 0, max(.045, (tail - head).length)))
    bone.roll = 0
bpy.ops.object.mode_set(mode='OBJECT')

# A 站姿相对于 R15 垂直四肢的静止偏转。导入动作时消除该偏转，避免一直张开双臂。
offsets = {name: Quaternion() for name in spec}
for side in ['Left', 'Right']:
    for suffix in ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg']:
        name = side + suffix
        d = (spec[name][2] - spec[name][1]).normalized()
        canonical = Vector((d.x, d.z, -d.y))
        offsets[name] = Vector((0, -1, 0)).rotation_difference(canonical)
    offsets[side + 'Foot'] = Quaternion((0, 1, 0), foot_binding[side]['yawRadians'])

for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'

fps = 60
bpy.context.scene.render.fps = fps
rig.animation_data_create()
sources = []
foot_vertices = [v.index for v in mesh.data.vertices if v.co.z < .18]
loop_metrics = {}
knee_retarget_metrics = {}
idle_motion = json.loads((MOTIONS / 'rab-idle.json').read_text())['currentVersion']['motion']
idle_transforms = idle_motion['keyframes'][0]['transforms']
for clip_name, source_name in [('Idle', 'idle'), ('Walk', 'walk'), ('Run', 'move'), ('Mine', 'mine')]:
    source = json.loads((MOTIONS / f'rab-{source_name}.json').read_text())
    motion = source['currentVersion']['motion']
    source_start, source_end = (.10, 1.95) if clip_name == 'Mine' else (0, motion['durationSeconds'])
    duration = source_end - source_start
    action = bpy.data.actions.new(clip_name)
    rig.animation_data.action = action
    count = round(duration * fps)
    all_samples = []
    first = motion['keyframes'][0]
    frames = motion['keyframes']
    def sample(t):
        before, after = frames[0], frames[-1]
        for a, b in zip(frames, frames[1:]):
            if a['timeSeconds'] <= t <= b['timeSeconds']:
                before, after = a, b
                break
        alpha = max(0, min(1, (t - before['timeSeconds']) / max(1e-9, after['timeSeconds'] - before['timeSeconds'])))
        result = {}
        for joint in motion['joints']:
            key = joint['jointKey']
            a, b = before['transforms'][key], after['transforms'][key]
            qa = Quaternion((a['quaternion'][3], *a['quaternion'][:3]))
            qb = Quaternion((b['quaternion'][3], *b['quaternion'][:3]))
            result[key] = (qa.slerp(qb, alpha), Vector(a['position']).lerp(Vector(b['position']), alpha))
        return result
    start_sample = sample(source_start)
    knee_metrics = {'maxLateralBefore': 0, 'maxLateralAfter': 0, 'maxAnkleDrift': 0}
    for frame in range(count + 1):
        bpy.context.scene.frame_set(frame)
        t = duration * frame / count
        transforms = sample(t + source_start)
        closing = max(0, (frame / count - .9) / .1)
        closing = closing * closing * (3 - 2 * closing)
        for bone in rig.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = Quaternion()
        local_rotations = {j['childPartName']: transforms[j['jointKey']][0].slerp(start_sample[j['jointKey']][0], closing) for j in motion['joints']}
        if clip_name == 'Mine':
            local_rotations['UpperTorso'] = local_rotations['LowerTorso'] @ local_rotations['UpperTorso']
            for j in motion['joints']:
                name = j['childPartName']
                if name == 'LowerTorso' or 'Leg' in name or 'Foot' in name:
                    q = idle_transforms[j['jointKey']]['quaternion']
                    local_rotations[name] = Quaternion((q[3], *q[:3]))
        world_rotations = {'Root': Quaternion()}
        def world_rotation(name):
            if name not in world_rotations:
                world_rotations[name] = world_rotation(spec[name][0]) @ local_rotations[name]
            return world_rotations[name]
        for name in local_rotations:
            world_rotation(name)
        if clip_name in ['Walk', 'Run']:
            forward = world_rotations['LowerTorso'] @ Vector((0, 0, -1))
            for side in ['Left', 'Right']:
                upper, lower, foot = (side + s for s in ['UpperLeg', 'LowerLeg', 'Foot'])
                upper_length = (spec[upper][2] - spec[upper][1]).length
                lower_length = (spec[lower][2] - spec[lower][1]).length
                old_thigh = world_rotations[upper] @ Vector((0, -1, 0))
                old_shin = world_rotations[lower] @ Vector((0, -1, 0))
                ankle = old_thigh * upper_length + old_shin * lower_length
                distance = ankle.length
                axis = ankle.normalized()
                pole = forward - axis * forward.dot(axis)
                if pole.length < 1e-5:
                    raise RuntimeError(f'{clip_name} {side} 膝盖朝向无解')
                pole.normalize()
                along = (upper_length ** 2 - lower_length ** 2 + distance ** 2) / (2 * distance)
                height = math.sqrt(max(0, upper_length ** 2 - along ** 2))
                knee = axis * along + pole * height
                new_thigh = knee.normalized()
                new_shin = (ankle - knee).normalized()
                upper_world = old_thigh.rotation_difference(new_thigh) @ world_rotations[upper]
                lower_world = old_shin.rotation_difference(new_shin) @ world_rotations[lower]
                local_rotations[upper] = world_rotations['LowerTorso'].inverted() @ upper_world
                local_rotations[lower] = upper_world.inverted() @ lower_world
                local_rotations[foot] = lower_world.inverted() @ world_rotations[foot]
                normal = axis.cross(pole).normalized()
                knee_metrics['maxLateralBefore'] = max(knee_metrics['maxLateralBefore'], abs((old_thigh * upper_length).dot(normal)))
                knee_metrics['maxLateralAfter'] = max(knee_metrics['maxLateralAfter'], abs(knee.dot(normal)))
                knee_metrics['maxAnkleDrift'] = max(knee_metrics['maxAnkleDrift'], (new_thigh * upper_length + new_shin * lower_length - ankle).length)
        for joint in motion['joints']:
            name = joint['childPartName']
            parent = spec[name][0]
            q, translation = transforms[joint['jointKey']]
            q = local_rotations[name]
            translation = translation.lerp(start_sample[joint['jointKey']][1], closing)
            bone = rig.pose.bones[name]
            bone.rotation_quaternion = offsets[parent] @ q @ offsets[name].inverted()
            if name == 'LowerTorso':
                translation = Vector((0, first['transforms'][joint['jointKey']]['position'][1], 0))
            bone.location = translation * (1.85 / 5)
        bpy.context.view_layer.update()
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        floor = min(evaluated.data.vertices[i].co.z for i in foot_vertices)
        rig.pose.bones['Root'].location.y = -floor
        bpy.context.view_layer.update()
        for bone in rig.pose.bones:
            bone.keyframe_insert(data_path='rotation_quaternion', frame=frame, group=bone.name)
            bone.keyframe_insert(data_path='location', frame=frame, group=bone.name)
        all_samples.append({b.name: list(b.rotation_quaternion) for b in rig.pose.bones})
    loop_metrics[clip_name] = max(1 - abs(Quaternion(all_samples[0][n]).dot(Quaternion(all_samples[-1][n]))) for n in spec)
    knee_retarget_metrics[clip_name] = knee_metrics
    track = rig.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, 0, action)
    strip.action_frame_start = 0
    strip.action_frame_end = count
    track.mute = True
    sources.append({'clip': clip_name, 'animationId': source['animationId'], 'animationVersionId': source['currentVersion']['animationVersionId'], 'name': source['name'], 'source': source['meta'], 'duration': count / fps, 'sourceRange': [source_start, source_end]})
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.location = (0, 0, 0)
    bone.rotation_quaternion = Quaternion()
for image in bpy.data.images:
    if image.size[0] > 0 and image.name != 'Render Result':
        image.pack()
rig['animation_sources'] = json.dumps(sources, ensure_ascii=False)
rig['retargeting'] = 'RAB R15 local joint rotations; rest-pose correction; root translation in-place; sole grounding; loop seam correction'
rig['foot_binding'] = json.dumps(foot_binding)
rig['joint_pivots'] = json.dumps(joint_pivots)
rig['knee_retarget'] = json.dumps(knee_retarget_metrics)
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 114
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'miner-d-rigged.blend'))
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active = rig
for track in rig.animation_data.nla_tracks:
    track.mute = False
bpy.ops.export_scene.gltf(filepath=str(OUTPUT / 'miner-d.glb'), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=False, export_force_sampling=True, export_skins=True, export_def_bones=False, export_all_influences=False, export_materials='EXPORT', export_yup=True)
data = (OUTPUT / 'miner-d.glb').read_bytes()
report = {'taskId': json.loads((SOURCE / 'task.json').read_text())['taskId'], 'vertices': len(mesh.data.vertices), 'triangles': sum(len(p.vertices) - 2 for p in mesh.data.polygons), 'bones': len(rig.data.bones),
          'weights': 'Transferred from Miner A (miner-a.glb) through a bone-wise deformation of its mesh to D proportions and the nearest surface point; rigid head and helmet, knee, forearm and sole repainted, normalized max 4 influences',
          'landmarks': {'A': LA, 'D': LD}, 'transferMaxDistance': far, 'dominantVertexCounts': counts, 'loopQuaternionError': loop_metrics, 'height': HEIGHT,
          'textures': [[im.name, *im.size] for im in bpy.data.images if im.size[0] > 0 and im.source == 'FILE'], 'sources': sources,
          'blend': 'assets-source/miner-d/miner-d-rigged.blend', 'glb': 'src/game/assets/character/miner-d.glb', 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
report['footBinding'] = foot_binding
report['jointPivots'] = joint_pivots
report['kneeRetarget'] = knee_retarget_metrics
report['joints'] = {k: [round(float(x), 4) for x in v[1]] for k, v in spec.items()}
report['textureLift'] = TEXTURE_LIFT
(SOURCE / 'rig-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
(OUTPUT / 'miner-d.manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print('MINER_RIG', json.dumps({k: report[k] for k in ('triangles', 'bones', 'transferMaxDistance', 'dominantVertexCounts', 'loopQuaternionError')}, ensure_ascii=False))
