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
