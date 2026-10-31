# Mining

Roblox 风格的挖矿游戏，移植到 Web（Three.js r186 / WebGL，React，Rapier）。三个世界，每个世界是地表加六层地下休整层；第一世界的地表是松风矿谷。

可将构建产物部署到自己的静态服务器。测试入口与正式入口分开管理，不覆盖正式游戏或其他游戏。

## 构建、测试与发布

需要 Node.js **24.x**。

```bash
npm ci --ignore-scripts
npm test                 # 单元与集成测试（node --test tools/tests/*.test.mjs）
npx tsc --noEmit -p .    # 类型检查（含未使用变量检查）
npx vite build
# 仅在配置好自己的发布目标、并确认发布范围后执行：
node tools/publish-pinewind.mjs   # 发布到 games/mining-surface-play/ 并核对公网哈希
```

`dist/` 是独立的静态产物，可放进任意静态服务（支持子目录），运行时不需要 Node、后端或外部 CDN。

## 本地工具与部署配置

机器专用路径、部署域名放在仓库根目录的 `.local-tools.json`（已忽略，不随交付提供）。键名与环境变量相同，环境变量优先；`MINING_LOCAL_TOOLS_FILE` 可指定另一份 JSON 配置，显式指定的文件不存在或格式错误会报错。不要将密钥或内部地址写进源码。

| 配置 | 用途 |
| --- | --- |
| `MINING_HOST_ROOT` | 发布宿主项目的绝对目录，其 `dist/` 是已配置的静态服务根目录 |
| `MINING_PUBLIC_ROOT` | 宿主公开根 URL；发布前必须与上方目录对应 |
| `MINING_GAME_URL` | 浏览器检查使用的完整游戏页面 URL，不带 query/hash |
| `MINING_PLAYWRIGHT_MODULE` | 可选 Playwright 模块路径；默认使用本项目安装的 `playwright`，缺少则报错 |
| `MINING_REPORT_DIR` | 宿主保存性能报告的目录，用于读取/验证工具 |
| `MINING_LOG_ENDPOINT` | 启动遥测接收 URL；独立默认未配置、不发遥测请求 |
| `MINING_LOG_ENABLED` | `true`/`false` 或 `1`/`0`；配置 endpoint 后默认启用，显式启用而缺少 endpoint 会报错 |
| `MINING_LOG_PATH_PREFIX` | 启用遥测的页面路径前缀，默认 `/`；可将遥测限制在一个测试入口 |
| `MINING_LOG_ORIGINS` | 日志接收器允许的 HTTP(S) origin，逗号分隔，必填 |
| `MINING_LOG_DIR` | 日志接收器存储目录，必填 |
| `MINING_ANIMATION_SERVICE_ROOT` | 私有 RAB 服务的位置，仅供维护者按 manifest 中真实 animationId 查找；不写入交付 manifest |
| `TRIPO_API_KEY` / `TRIPO_CONFIG_PATH` | 生成工具凭据；未设置 key 时读取指定配置或用户目录下 `.tripo/config.json` |

Vite 只将遥测配置注入页面，不会注入整份本地配置。`MINING_LOG_ENABLED=false npm run build` 可生成明确关闭启动遥测的独立产物。本机原部署参数保存在忽略配置中，构建时按原测试路径启用。源码的独立默认不包含任何私有 endpoint。性能报告按钮仍使用同源 `/api/mining/performance-reports`，需要部署方提供该接口；接口失败会报告失败，不声称提交成功。

`npm run publish:preview` 发布到 `games/mining-test/`；`node tools/publish-pinewind.mjs` 默认发布到 `games/mining-surface-play/`。后者的 `--launcher` 更新宿主列表，`--formal` 发布正式入口，须分别确认对应授权。发布工具缺少宿主路径或公开 URL 时直接报错。浏览器工具使用本地 Playwright 或显式配置的模块，不固定依赖兄弟项目。

## 交付与历史记录边界

运行交付内容是 `dist/`；源码交付应保留运行源码、依赖清单、构建及必要工具、真实素材来源与许可证。`.local-tools.json`、`.env*.local`、`AGENTS.md`、`docs/` 的阶段报告、`output/`、`artifacts/`、`assets-source/` 的历史任务响应和日志不作为公开交付内容。历史报告未改写，其中可能保留原部署域名、机器路径与内部服务信息；**不要直接将整个工作目录打包交付**。源码素材审计需要原始记录时，应单独审查后提供，不能用脱敏文字替代真实来源或许可。

矿工 manifest 保留真实 Tripo task ID、动作 animation/version ID、原始 provider/externalId、资源哈希。仅移除了私有 RAB 服务 URL；服务名称与来源元数据保留，不据此新增作者或许可声明。rig 工具仍从现有 `assets-source/miner-a/rab-*.json` 读取固定动作数据，不重新生成资产。

## 美术管线

规则、模块化、需要精确尺寸的部件用 Blender 脚本自制；每件资产记录脚本、源文件、面数、贴图尺寸和哈希。

- 松风矿谷地表：
  ```bash
  node tools/export-pinewind-layout.mjs
  (cd surface-game-art && blender -b --python tools/blender/build_architecture.py)
  node tools/export-pinewind-scene.mjs       # 生成地形、摆放、离线烘焙光照（约 100 秒）
  KTX_BIN=<ktx 目录> node tools/pack-pinewind.mjs
  ```
- 地下大厅（第一世界的六个休整层：old-mine、fungal、crystal、ruins、frozen、volcanic）：
  ```bash
  (cd surface-game-art && blender -b --python tools/blender/build_<id>.py)   # 道具，共用 cave_props.py
  KTX_BIN=<ktx 目录> node tools/build-underground.mjs <id>                   # 洞穴外壳（共用 caveKit.ts）、烘焙、打包
  ```
  每层的数据在 `src/game/content/underground/<id>Hall.ts`，离线搭建在 `surface-game-art/tools/underground/<id>Hall.ts`。
- 第二世界的六个休整层（automine、gear、refinery、survey、cryo、reactor）同一流程，另共用第二世界基地套件：道具
  `tools/blender/tech_props.py`（白色亭子、灯柱、名牌、护栏柱、吊灯、货箱、北墙门面 `tech_facade`），搭建 `tools/underground/techKit.ts`
  （平滑水泥地面并把灯光池烘进顶点色、黄色走道和箭头、竖井护栏、亭子与灯的光晕）。为手机做的假发光：材质名
  `Glow halo` 的网格在游戏里叠加绘制（不写深度、不受雾影响），名字带 `gloss` 的材质保留粗糙度。
- 第二世界地表（沙漠殖民地）也走这条流程：`build_tech_base.py` + `tools/underground/techBaseHall.ts`，
  `node tools/build-underground.mjs tech-base`，布局数据在 `src/game/content/world2/techBase.ts`；它烘的是白天太阳。
  背对太阳的正面（传送门、传送站、矿石收购站）用两块"背光"贴图格（暗白、暗黄、自发光），看起来和朝阳面一样亮。
  第二世界的场景（地表和六个休整层，`AuthoredInstance.world = 2`）开局不下载，玩家第一次前往时才载入，传送等它载完再到达。
- 工具和背包：`blender -b --python tools/build-equipment.py`，输出 `src/game/assets/shop/equipment.glb` 和
  `equipment-manifest.json`（名字、介绍、动作类型在 `src/game/content/shopCatalog.ts`）。三个世界各一套：世界 1 家里的东西
  （仙人掌、咸鱼、打蛋器……；纸箱、鱼缸、扭蛋机……），世界 2 机械（电钻、链锯、激光剑……；电池组、反应堆舱、火箭……），
  世界 3 奇幻和宇宙（彩虹、章鱼触手、黑洞锤……；水母、沙漏、传送门……）。工具的握点在原点、打击方向 +Y；棍棒类在
  `Hold` 节点里朝前倾，商店里摆正。`Spin*` 节点：工具的在工作时转，背包的一直慢慢转；动作类型 `drill` 的工具平端前顶并
  抖动，其他是挥镐。背包的 `BagFill` 节点按装满程度长高。材质：`EquipAtlas` 平涂色块，`EquipGlass` 按色块着色的透明件，
  `EquipGlow` 自发光件。展厅场景单独由 `tools/build-shop-showroom.py` 生成。
- 第三世界的休整层仍用 Blender 场景套件：`tools/blender/build-crystal.py`、`build-chamber.py -- <id>`。

运行时模型在 `src/game/assets/scene/`，测试 `tools/tests/shipped-assets.test.mjs` 保证这里只有游戏实际摆放的模型。

## 源码地图

| 位置 | 内容 |
| --- | --- |
| `src/game/content/gameContent.ts` | 整个游戏的内容组装：三个世界、会话区域、第一世界地表、地形生成配置 |
| `src/game/content/journeyWorlds.ts` / `layers.ts` | 三个世界各自的七层（由十个层模板生成）、层校验 |
| `src/game/content/pinewind/` / `pinewindSurface.ts` | 松风矿谷布局（服务建筑、蛋台、小溪、传送站）与地表内容 |
| `src/game/content/underground/` | 地下大厅数据（布局、灯光、氛围） |
| `src/game/content/rooms/` | 地下休整层的场景配置与套件布局 |
| `src/game/content/resources.ts` / `journeyResources.ts` | 84 种方块与矿石、工具与背包价格 |
| `src/game/application/GameSession.ts` | 游戏会话：挖矿、售卖、商店、宠物、奖励、世界与层的解锁和传送 |
| `src/game/terrain/` | 稀疏体素世界、矿物生成、渲染/碰撞网格 |
| `src/game/presentation/` | 场景表现：地表与大厅加载、烘焙光照、灯光、角色、宠物、特效 |
| `src/game/runtime/` | 启动组装、每帧更新、调试接口（`?debug=1`） |
| `src/game/ui/` | Roblox 风格 UI：HUD、各面板、商店展厅 |
| `src/game/validation/` | 主场景（ValidationScene）、角色物理、地形流式加载 |
| `tools/tests/` | 测试；`fixtures/` 里是共用夹具 |
| `docs/` | 各阶段记录；当前地下层的做法与经验见 `docs/phase-layers-20261024.md` |

## 依赖

| 名称 | 版本 | 许可 |
| --- | --- | --- |
| React / React DOM | 19.3.0 | MIT |
| Three.js | 0.186.1 | MIT |
| Rapier 3D compat | 0.19.3 | Apache-2.0 |
| React Three Fiber | 9.8.1 | MIT |
| Vite / Vite React 插件 | 8.3.2 / 6.1.1 | MIT |
| TypeScript | 7.0.2 | Apache-2.0 |
