# 松风矿谷迁入当前 master 工作区

## 基线与回滚

用户最终选择：**当前主工作目录 master，包含未提交进展**。仓库没有 `main` 分支。

- 原工作目录：`/root/threejs_space/d-Mining`，本轮未写入该目录。
- 独立工作区：`/root/.t3/worktrees/d-Mining/surface-roblox`，分支 `codex/mining-surface-roblox`。
- 基准提交：`25c23697a46c386d75609b3e6456e190722e119f`，包含新矿工角色。
- 未提交工作快照：2026-10-21 **14:07:03 UTC**，1513 个文件。捕获前后逐文件哈希稳定。工作树 HEAD 已对齐该提交，校验对齐过程未改变 1549 个现有工作文件。
- [基线清单](../artifacts/master-baseline/manifest.json)；外部压缩包 `/tmp/mining-master-baseline-20261021T140703Z/workspace.tar.gz`，SHA-256 `30f5ab0698e84628ba9fd69509b1ef24dd963ef73490bec81992525426766515`。

先前基于 `063ec84` 与旧覆盖快照的实现已回滚：恢复 15 个修改文件、归档其专用运行时代码、移除旧试玩发布与首页入口，并确认其他 1204 个公开游戏文件未变。见 [回滚记录](../artifacts/surface-origin-20261021/rollback.json)。当前实现没有恢复那套运行时代码；复用的是已认可画风的美术制作源工具。

不能用 `git diff HEAD` 代表本轮贡献：其中大量文件是用户选定基线原本就有的未提交进展。本轮单独对以上 1513 文件快照做差异记录，见 [任务增量清单](../artifacts/pinewind-task-delta/manifest.json)。没有提交、推送或合并。

## 制作来源

完整历史保留在 [Mining 地表样板溯源](mining-surface-origin-20261021.md)。主会话是 [Mining 教学与玩法系统改动](t3-thread://v1/6c769403-d3c0-4896-a27c-19e6b0b55c09)，第 13–20 轮；最终版于北京时间 10 月 20 日 00:13:15.123 发布。

关键转折是用户否定全屏像素化，要求改原始模型和贴图，随后要求更偏 Roblox。保留宽连续坡屋顶、厚门窗与深蓝边、大块树冠、连续河岸、橙顶与青蓝顶、小尺寸纹理。此轮按主线场地重新适配桥、矿架、建筑、蛋与阶梯；没有导入独立样板的 WebGPU 启动器。

## 架构接法与实际边界

相对选定快照，`src/game/application/`（14 文件）、`logic/`（22）、`persistence/`（9）、`terrain/`（12）逐字节相同。`PlayerController.ts`、`updateGame.ts`、`debugGame.ts`、`MinerAvatar.ts`、游戏依赖和构建配置也保持基线内容。采矿结算、经济、存档格式、角色控制、引导和世界准入规则仍由主线负责。

新增的是可注入的纯数据 `AuthoredSurface` 与 `withPinewindSurface(base)`，只组合 surface/environment；session、rooms、layers、hub、returnPoint 保留原引用。第一世界采用新场景；其余世界的规则和拓展布局沿用主线。

现有文件的扩展分为以下几处：

1. `App.tsx` 选择新场景配置并识别独立试玩 URL；默认显示原始画面，既有调色仍可切换。
2. `StaticSurface` 根据配置通过既有 `loadModelAssets` 加载两份新资产，继续使用下载预取、KTX2/Meshopt、GPU 上传、取消和错误清理流程。loader 新增可选 `coordinateSpace: authored`，保留美术坐标和节点层级，默认规范化行为不变。
3. `SurfaceScene` 提取共同接口；`assembleAuthoredSurface` 只负责克隆命名节点、标签/圈标和接触阴影。资源沿用会话级 `SceneAssetBundle`，包含交互后克隆材质的回收；没有新的全局材质缓存。
4. 可走桥面、坡道、台阶、树干和建筑写入 `content.surface.plan`，仍交给 `SceneryCollision`。新场景已经开放出生通道，因此只对它跳过旧围墙裁切；没有另写碰撞系统。普通美术常驻、体素渲染、体素碰撞、附近普通碰撞各自独立。
5. 出售/商店位置改在既有 `surfaceFacilities` 描述中；可见建筑、圈标、碰撞和触发继续共用派生数据。传送站沿用原 `portalId` 绑定与解锁更新。蛋名称价格、附近按钮和概率面板均沿用主线 UI。
6. `FeedbackFixtures` 保留实时文字，家具外壳由新 Blender 资产提供；`JourneyGates` 只调整第一段道路外观。`EnvironmentController` 允许配置白天开场，之后仍走原昼夜周期。仍是 WebGLRenderer、主线 PBR 材质和烘焙阴影，不开启实时 shadow map。

共有 11 个基线现有文件发生变化（包括 1 个更新布局断言的测试文件）。其余新增运行时文件是场景数据、装配接口和资产包，详见增量清单；美术生成器只在离线工具中执行。

## 场景适配与资产

真实可采矿井保持 `x/z = -8…8` 的 16m 方形开口；矿架围绕它搭建，没有用装饰洞口盖住可采区域。溪桥连接出生点和矿前广场，两端增加可见连续引坡，实际角色无需跳跃即可过桥。宠物仍使用主线三层台地与楼梯，最高可走到约 y=4.027。出售建筑锚点为 (-17,12)，商店为 (-20,-13)，交互位置由其偏移派生。

| 资产包 | 包内三角形 | gzip 下载字节 | 纹理 |
| --- | ---: | ---: | --- |
| pinewind-architecture | 13,920 | 84,184 | 256² 建筑/蛋图集 |
| pinewind-landscape | 101,682 | 669,084 | 256² 自然图集、512/64 地面纹理、1024² 接触阴影 |

这里是资产包面数，不能当作某一帧总渲染面数。自然源库为 1,812 面；landscape 包含实例化自然物、地形、水与投影在地表的接触阴影网格。压缩前后面数一致，没有以减面替代制作。

Blender 5.1.2 源文件、生成脚本、逐模型面数、贴图尺寸和哈希均保留在 `surface-game-art/`。不使用 Tripo，不伪造任务 ID。[重建说明](../surface-game-art/README.md) 与 [来源清单](../surface-game-art/provenance.json) 包含独立锁定的离线依赖和实际命令。

## 发布与验证

试玩：[Mining · 松风矿谷试玩](https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html)。已列在公开首页，正式 Mining、mining-test 和 mining-surface 对照保留。发布器针对 `/root/threejs_space/d-game1` 的独立路径逐文件发布；当前 [发布记录](../artifacts/pinewind-public-release.json) 核对公开哈希并保护了其他 1208 个游戏文件，没有运行 host 全量游戏构建。

构建与类型检查通过，117 项相关单元/集成测试通过，覆盖分层依赖、资源释放、实际 Rapier 角色过桥和上楼梯、引导、存档、宠物、进度和昼夜。两份 GLB validator 均无错误；验证器对 KTX2/Meshopt 扩展支持不足产生警告，公开浏览器实际加载成功。

公开测试使用 Chromium / SwiftShader、1440×900、独立 IndexedDB 测试存档。功能检查覆盖：加载与烘焙阴影开关、W 走过桥、真实矿口与采矿结算、返回地表、进入出售圈、商店 E、16 个常驻蛋标签与直接显示的概率、三层台阶、传送站锁定/解锁后到达老矿井、第二世界门阻挡、昼夜状态、保存刷新、首页入口及仅请求两份新场景资源。未收到页面或 console 错误。

采矿使用已有 debug `hit` 调用主线结算，不等于鼠标瞄准验收；远距离测试间使用 debug teleport 设置起点，随后桥、台阶和交互区域靠真实键盘移动。老矿井解锁测试先传到真实地下房间，不代表正常游玩完成 400m 进度。世界门按主线 `worldGateZ(2)=69` 验证，112 是世界空间分区边界，不能混用。

T3 preview 因主机 AppArmor 明确不可用，按仓库 Playwright 流程回退。SwiftShader 下逻辑帧会领先实际 GPU 提交；截图工具已改为等待实际提交并完成绘制，不能只等待逻辑帧计数。最终画面证据以 `artifacts/pinewind-public-submitted/` 为准；此前 `pinewind-public-complete` 的功能断言有效，但部分截图滞后，不作为对应动作的视觉结论。

这次仅提供桌面公开画面/功能证据，不声称物理 GPU 性能、手机兼容性或用户审美验收。第二、三世界及全部经济流程没有逐项浏览器重跑；保留配置/代码与相关测试通过不等于这些内容的新一轮完整人工验收。
