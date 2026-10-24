# Mining

Roblox 风格的挖矿游戏，移植到 Web（Three.js r186 / WebGL，React，Rapier）。三个世界，每个世界是地表加六层地下休整层；第一世界的地表是松风矿谷。

- 游戏列表：<https://w-sunjun-public.dev.clock-p.com/>
- 正式 Mining：<https://w-sunjun-public.dev.clock-p.com/games/mining/index.html>（未经授权不要覆盖）
- 主线测试入口：<https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html>

所有可试玩改动先发布到公开测试入口，再做场景、交互与截图验证；不用只有开发者能看到的本地预览。

## 构建、测试与发布

需要 Node.js **24.x**。

```bash
npm ci --ignore-scripts
npm test                 # 单元与集成测试（node --test tools/tests/*.test.mjs）
npx tsc --noEmit -p .    # 类型检查（含未使用变量检查）
npx vite build
PINEWIND_RELEASE_RECORD=artifacts/<名字>-release.json node tools/publish-pinewind.mjs   # 发布到主线测试入口并核对公网哈希
```

`dist/` 是独立的静态产物，可放进任意静态服务（支持子目录），运行时不需要 Node、后端或外部 CDN。

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
- 第二、三世界的休整层仍用 Blender 场景套件：`tools/blender/build-crystal.py`、`build-chamber.py -- <id>`。

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
