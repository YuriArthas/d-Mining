# 关卡与运行逻辑的修改入口

本轮采用对象组合和普通函数，不引入统一基类、ECS 或事件总线。当前仍通过正常构建和发布应用配置，没有在线编辑器或热更新。

## 常见美术调整

| 要改什么 | 数据入口 | 派生行为 |
| --- | --- | --- |
| 售卖/升级房子的位置、朝向、模型、尺寸、碰撞与标识 | `src/game/content/surfaceFacilities.ts` | 同一 anchor 派生模型、独立碰撞、门前触发圈与招牌。外观 asset 与 sell/shop 业务类型独立 |
| 公共招牌 | `src/game/content/surfaceSigns.ts` | 位置、朝向、文字、宽度、颜色 |
| 传送展位 | `src/game/content/portalSlots.ts` | 按稳定 layerId 指定坐标、模型和 tint；缺展位、重复坐标、越界直接报错 |
| 楼层深度、主题、矿物和房间规格 | `src/game/content/layers.ts`、`roomLayout.ts` | 逻辑空洞、地板、视觉、落点、解锁深度与传送展示一致；Worker 消费相同序列化层配置 |
| 主题配色 | `src/game/content/themes.ts` | 主题与深度/经济独立；现有主题 motif 选择对应组件生成实现 |
| 资源用途 | `src/game/content/assetProfiles.ts`、`materialPresets.ts` | 显式材质策略及粗糙度/金属度/环境响应、合批标记、布局归属和碰撞预设；不从名称前缀猜行为 |
| 主照明、夜空与地下雾 | `src/game/world/environment.ts`、`SceneLighting.ts` | EnvironmentController 接收环境参数；预热与运行共用应用逻辑 |
| 路灯和墙上火把 | `src/game/world/StreetLights.ts`、`WallTorches.ts` | 外观 fixture 和实际 light 分别定义；灯具不自动创建光源 |
| 草数量与随机种子 | `src/game/content/grass.ts` | 确定性散布，避开道路、入口、设施与普通碰撞 |
| 道路路径 | `src/game/content/trails.ts` | 同一条带范围派生地面、路沿与草排除区；当前生成器支持正交道路 |
| 围墙层数、后退距离、场地范围 | `src/game/world/SurfaceSite.ts` | 数据对象驱动围墙模块、边界碰撞及火把位置；功能区域需一起检查空间余量 |

`content/campContent.ts` 是当前矿场内容的装配与校验入口，产物只有数据和几何描述，没有 Three/Rapier 对象和任意执行回调。表层部分数据仍放在已有 world 配置文件中，不为了目录统一增加无意义转发层。

地下房间默认尺寸仍为 20×20×10 格，入口仍全层垂直对齐 8×8 格。可选 room 规格允许扩大尺寸、在合法区域内平移；目前不支持缩到原主题布景所需空间以下。模板内的树、晶体、摊位等造型算法继续属于实现，改变已有参数和新增造型算法是不同工作。

## 运行职责

- `runtime/startGame.ts`：启动装配、并行准备、预热与资源移交；`DisposalScope` 管取消/失败的逆序释放和迟到资源。
- `runtime/updateGame.ts`：可读的帧调用顺序，不再持有相机、采掘等模块内部状态。
- `PlayerController`：移动/传送等待和固定步进；`CameraView`：相机与角色插值显示；`MiningInteraction`：选格、攻击适配、描边/裂痕。
- `EnvironmentController`：拥有天空和局部光源 rig；借用场景和 React 创建的主光；退出恢复原 Scene 状态。
- `SceneryView`：普通视觉常驻；`SceneryCollision`：独立管理附近普通碰撞。体素管线保持独立。
- `ModelAssetLoader`：有界下载、解码、上传；`assembleSurface`：实例化与合批；`SceneAssetBundle`：共享资源去重释放。表层细节通过明确句柄访问，不通过 userData 寻找控制器。
- `GameSession`：构造时接收 SessionContent，没有对当前地图模块的导入。背包、采矿、钱包等原有业务对象保留。
- `ValidationScene.tsx`：保留 React/R3F 接入、唯一 RAF、绘制提交和基础角色节点；调试适配位于 `runtime/debugGame.ts`。

“关卡配置独立”不表示每个叶子 shader 或生成器都能任意互换。局部点光索引仍由已配置灯表在模块初始化时构建，当前只支持单个活动游戏会话；配置变更需要重建，不支持同时挂两个不同灯表的场景。资源槽位和 shader 策略仍需要对应实现。

## 配置修改后的检查

移动烘焙对象需要重新烘焙；烘焙校验比较实际变换和几何身份，字段顺序或显式填写原默认值不算几何变化。不要为了让配置实验通过而改写旧烘焙的资源身份。

设施模型、碰撞、触发圈均有独立定义；替换外观时尺寸不合适，应显式调碰撞，不能自动照搬模型包围盒。新增传送点必须分配合法展位，扩展场地时也要同步规划道路。

全部可试玩改动先发布 Mining 测试版，再进行电脑端公开验证。普通场景不按距离卸载；真实手机性能需要设备数据，本轮软件渲染浏览器只用于功能与画面对照。

## Review 后补充的配置约束

- 房间造型的 `size` 保留原始几何参数（例如 torus 的弧度）；`worldScale` 在旋转后应用。不要把布局比例直接乘到几何参数上。
- 售卖/升级圈使用业务触发半径，房间扩大时仅移动中心，不扩大触发圈。
- 房间普通碰撞不得占用固定 8×8 入口；非法平移在内容装配阶段报错，不自动修复布局。
- 传送点之间至少留出两个“触发半径 + 退出滞回”的距离，同时避免模型重叠。
- `content/surfaceDetails.ts` 在内容装配阶段生成草、路沿、池塘、火把、地面涂绘及围墙数据；对应表现模块消费 `surface.details`，不再自行读取当前地图。改源配置后仍需重新构建；烘焙与局部点光表的既有约束不变。

## 独立地下场景（第二层开始）

`Layer.scene` 选择场景资产，和深度、主题配色及矿物独立。第二层的 `timber-station-v2` 已迁出原主题分支：

- `content/rooms/oldMine.scene.json` 定义参考尺寸、出生/售卖/商店位置、招牌、交互圈、图集采样与局部照明参数。`sceneDefinitions.ts` 只注册轻量元数据，体素 Worker 不导入网格或布景实例。
- `content/rooms/oldMine.layout.json` 定义材质，以及墙体、支撑、矿口、升降机、售卖台、仓储、轨道、工坊、矿脉九个组的摆放、独立碰撞和照明采样点。
- `content/rooms/sceneAssets.ts` 单独注册重资源；`assets/rooms/old-mine-v2.json` 仅保存 Blender 网格和小图集像素。
- `world/authoredRoomPlan.ts` 按配置展开各组与功能位置，生成实例、碰撞和标识。层号由楼层顺序派生，深度由 Layer 派生；中央 8×8 入口固定，地板按房间边界铺到入口边缘，业务圈保持原触发半径。
- `presentation/AuthoredRoomView.ts` 仅消费组件数据，按网格/材质实例化；静态照明贴图只影响对应房间材质，释放由场景所有者管理。`roomIllumination.ts` 根据该场景的照明配置生成局部光照数据，不根据灯具模型自动创建真实灯。
- `content/initialAccess.ts` 配置当前美术测试版本初始开放的层（全部九个地下层，方便逐层检查），正式版与测试版共用，不能根据发布路径改变访问权限；`Exploration` 不因此伪造最大探索深度。

第三层到第十层现在也全部使用独立的 scene/layout JSON。当前九个地下层都绑定 `Layer.scene`，不再进入旧主题生成器；旧生成器仅作为未配置独立场景的兼容路径保留。售卖和升级分别绑定 sell/shop 锚点，具体阶段、主题和生成命令见 `art/underground-rollout.md`。


### 第二层的具体编辑方式

| 修改目标 | 修改位置 | 需要重新导出网格吗 |
| --- | --- | --- |
| 柜台及售卖触发区一起移动 | `oldMine.scene.json → facilities.sell.at` | 不需要 |
| 移动一组道具 | `oldMine.layout.json → groups[].offset` | 不需要 |
| 某件道具的位置、尺寸、旋转或颜色 | 对应组的 `instances` / 顶层 `materials` | 不需要 |
| 某件道具的碰撞 | 对应组的 `solids`，与视觉独立编辑 | 不需要 |
| 局部灯位、强度、冷暖、衰减、顶部压暗 | 组内 `lamps` / 场景 `render.lighting` | 不需要 |
| 图集平铺密度、行列、边距、材质粗糙度 | 场景 `render.atlas` / `render.surface` | 不需要，图集内容必须匹配规格 |
| 新造型或图集像素 | Blender 生成脚本 | 需要 |

所有配置仍在构建时生效，随后发布测试版；没有运行时热编辑。

坐标约定：`referenceSize` 和位置使用米，X/Y-up/Z，Y=0 是本层地板；Layer 的房间尺寸仍使用格子。
`groups[].anchor` 显式选择 `room`、`spawn`、`sell` 或 `shop`，`offset` 和每个实例的位置相对此基准。
售卖组绑定 `sell`，因此改售卖位置会同步移动柜台、该组碰撞和灯位；单改组 offset 则只改变布景相对触发点的位置。
组内视觉、碰撞、照明采样点分别声明，不从模型外形推断功能。

`fixed: true` 保留全局矿口对齐，不随房间缩放平移；`floor` 标记让四块地板围绕固定入口铺开。
普通实例随参考尺寸映射到实际房间。招牌、圈和功能点采用同一基准，但触发半径、容差和出生悬空间隙保持米制。
招牌模板支持 `{name}`、`{number}`、`{depth}`；不再在公共实现内写第二层编号。

`tools/blender/build-old-mine.py` 读取同一份 scene/layout JSON，创建 Blender 场景并导出网格与图集。
摆放或材质参数改动不需要重导运行时网格；需要同步 `.blend` 源场景与资源记录时重新运行该脚本。
`asset-record.json` 分别记录模型、脚本、布局、场景定义和 Blender 源文件的哈希。

### 继续迁移下一层

1. 为该层新增自己的 scene JSON、layout JSON 和资产生成脚本/资源。
2. 在 `sceneDefinitions.ts` 注册元数据，在 `sceneAssets.ts` 注册资产；通过 `Layer.scene` 绑定。
3. 填写功能位置、招牌和局部渲染参数；若 `Layer.shop=true`，必须配置商店位置。
4. 运行内容检查，发布公开测试版，再验证落点、碰撞、采矿、售卖/商店与返回。

当前 renderer 支持既有实例化网格、正方形 RGBA 图集、局部静态光照场；需要水、粒子或全新 shader 时仍需新增相应表现实现。
房间空洞仍由矩形规格定义；任意洞穴轮廓不属于本次配置拆分。

### 第四至第十层编辑入口

`crystal`、`ruins`、`frozen`、`volcanic`、`fossil`、`machinery`、`core` 均在 `content/rooms/<id>.scene.json` 配置设施和局部照明，在同名 `.layout.json` 编辑组件、独立碰撞和灯位。`build-crystal.py` 与 `build-chamber.py -- <id>` 读取这些布局，生成各自的新网格、64×64图集和Blender源文件。`room_export.py` 共享打包流程，各层模型独立。

美术测试初始全解锁不会修改最大探索深度。恢复正式探索进度时显式调整 `initialAccess.ts`，不要根据正式/测试URL偷偷改变解锁规则。
