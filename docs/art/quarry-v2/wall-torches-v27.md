# V27 — 围墙壁挂火把

四面内围墙各放 2 支，共 8 支。北/南面 x=-15、33，墙面 z=-27、69；西/东面 z=9、49，墙面 x=-35、53。固定架中心高 1.75m，火焰顶约 3m；坐标锚定 `SurfaceSite.boundary`。场景物件不因角色距离消失。

造型为 Blender 自制规则组件：方形固定板、铆钉、短托架、斜木柄、铁箍和多层实体方块火焰。火焰各面可见，顶端通过 vertex shader 轻微跳动，没有透明贴片或全屏 bloom。

- 单模型 192 三角，8 实例共 1,536 三角，3 个 InstancedMesh 批次。
- 使用手工顶点配色，无贴图（0KB 纹理），单次创建和实例化。
- 模型生成脚本：`tools/blender/build-wall-torch.py`。
- Blender 源文件与哈希：`assets-source/quarry-v2/wall-torch-blender/source.blend`、`result.json`。
- 运行时网格：`src/game/assets/ground-details/wall-torch.json`。
- 无 Tripo 任务 ID；这是 Blender 新生成资产。

表现和照明分离：`WallTorchView` 管造型/火焰，`SceneLightingRig` 管 8 个真实 PointLight。每个强度 24、最大范围 10m、decay=2、castShadow=false。亮度低于路灯（150），只照墙边局部。白天火焰隐藏，点光 intensity=0 且 visible=false；地下沿用表层光照停用规则，普通模型保持驻留。光源数量会增加前向照明计算，但不会增加阴影贴图或阴影通道；不能用桌面软件 GPU 测试宣称 iPhone 性能不变。

构建和公开哈希检查通过，仅发布 Mining 测试版。3 项 surface-details 测试通过，覆盖昼夜、无阴影、模型驻留及光源停用。公开桌面回归：`tools/check-wall-torches.cjs`，图片/状态：`artifacts/wall-torches-v27/`。首次白天截图超时，白天状态检查已通过；后续检查暂停测试页游戏 RAF 后截取夜景，避免软件 GPU 绘制与截图争用。测试专用 RAF 控制未进入游戏代码。
