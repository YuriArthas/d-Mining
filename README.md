# Mining

横屏单机挖矿游戏，支持电脑和手机。已有第三人称移动/相机、普通地形与体素共用 Rapier、多矿物挖掘、鼠标选格与触点长按。矿区逻辑规模 100 × 100 × 2000 格，使用唯一稀疏数据源，渲染/碰撞独立合并与加载。P3A 已实现独立背包/钱包 API、多格采集入包、地表踩圈售卖和返回按钮；P3C 已按物品体积计容并按各矿物单价售卖。P3B.1 接入背包升级；P3B.2 接入单格血量、力量/攻速和镐子升级。宠物与实际存档读写后置。

- 游戏列表：<https://w-sunjun-public.dev.clock-p.com/>
- 正式 Mining：<https://w-sunjun-public.dev.clock-p.com/games/mining/index.html>
- Mining 测试版：<https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html>

所有可试玩改动先发布到测试入口，再进行公开版本的场景与交互验证；不做只有开发者可访问的本地游戏预览。需要隔离时新增公开列表入口。正式版与测试版独立发布。
- [MVP Draft](docs/draft-mining-mvp.md)
- [P0 拆分与当前状态](docs/phase0.md)
- [P1 拆分、自复核与难度评估](docs/phase1.md)
- [P1.V 验证阶段与证据](docs/phase1-validation.md)
- [P2 提前实施：稀疏地形与独立合并](docs/phase2-terrain.md)
- [P3A：背包与售卖 API、架构边界及验证](docs/phase3-inventory-sale.md)
- [P3B.1：UI 背包升级](docs/phase3b-backpack-upgrade.md)
- [P3B.2：矿物血量、敲击与镐子升级](docs/phase3b-mining-combat.md)
- [P3B.3：受损方块裂痕](docs/phase3b-block-cracks.md)
- [P3C：矿物体积与独立售价](docs/phase3c-item-volume.md)
- [P3D：地下房间、深度解锁与家中传送](docs/phase3d-underground-rooms.md)
- [P3E：矿层分布与首轮成长节奏](docs/phase3e-depth-strata.md)
- [P3F：各层对齐入口与固定表皮](docs/phase3f-aligned-entrances.md)
- [场景 Draft：主题封装、十层矿区与三十种资源](docs/draft-scene-themes.md)（主题与资源清单）

- [S1：场景首版实现与验证](docs/phase-scene-themes.md)
- [S1.1：十个场景精修](docs/phase-scene-polish.md)
- [S1.2：表层林间矿场](docs/phase-surface-camp.md)
- [S1.3：表层风格、光照与平台衔接](docs/phase-surface-style.md)
- [S1.4：重新调整表层造型语言](docs/phase-surface-hub.md)
- [S1.5：表层曲面造型与材质细化](docs/phase-surface-sculpt.md)
- [S1.6：光影与材质着色](docs/phase-surface-lighting.md)
- [S1.7 翡翠山谷场景重塑](docs/phase-surface-valley.md)：专门建模的曲面矿口、售卖站、矿车与卷扬机，山谷环境、山泉及天空。
- [S1.8 平地草甸与完整远景](docs/phase-surface-meadow.md)：布局重排、哑光草地、连续曲面；普通场景常驻，体素与碰撞独立管理。
- [S2 矿场院落整体重建](docs/phase-surface-quarry.md)：Image 2.5 + Tripo 新资产、紧凑院落、连续地面及纹理材质。此前 S1.9 Sunvale 已作废。

## 构建与公开验证

需要 Node.js **24.x**。

```bash
nvm use
npm ci --ignore-scripts
npm run build
```

构建检查（游戏实际验证在上方公开测试入口进行）：

```bash
npm test
npm run build
```

打开上方公开的 Mining 测试版。`dist/index.html` 是独立交付入口；整个 `dist/` 可放入普通静态 HTTP 服务，也支持子目录。不启动私有本地预览；静态服务不是游戏运行依赖。运行产物不需要 Node、Vite、专用后端或外部 CDN。

当前运行 60 Hz 固定物理步长，并将绘制调度限制为最高约 60 FPS；尚未验证目标手机 60 FPS。Rapier WASM 随 JS 包交付，地形 Worker 是构建后的本地资源。

## 当前操作

- 电脑：右键拖动转镜头；WASD / 方向键移动，空格跳跃，左键按住挖掘高亮方块，攻击距离约 4 格。
- 手机横屏：左摇杆移动、右侧按钮跳跃。长按场景中的目标约 180ms 挖掘，挖掘时滑动可换目标；先拖动超过 10px 则转镜头，本次手势不挖掘。松手停止，挖空后继续查询当前触点下的新表面。
- 当前有 30 种资源（10 种基础岩土、20 种矿物）；背包保存件数，按各矿物体积计算占用，按各自单价售卖。每次敲击检查满包；已经销毁的格子全部入包，即使这时已经超量。背包 add 本身没有容量限制。
- 背包初始容量 50。满包后点击“返回地表”，走入地表东侧收购摊前的金色圆圈自动出售；返回落在圈外，背包和已挖矿坑保留。底层允许超容量，画面区分容量占用和物品件数；当前镐子每次只攻击一个格子。
- 地表及地下房间地板只有上下对齐的 8×8 格入口能挖，木质或主题边框标记入口，入口外固定地面不能挖；穿过一格厚表皮后，下方矿体可自由向四周开采。
- 共十个场景主题：地表及每 400 米一处地下营地，直到 3600 米；地下房间 20×20 格、高 10 格。到达深度即可解锁，回家通过“传送”选择营地。每处可踩圈售卖，部分设升级摊；主题、矿物分布与设施配置见场景 Draft。
- 点击 HUD“升级”打开界面，分为镐子和背包两页。背包暂设容量 100 / 200 / 400，费用 20 / 50 / 100 金币；购买保留已有矿物，金币不足或达到最高档不可购买。界面内屏蔽游戏输入，关闭后恢复。
- 矿物的体积/血量/售价见 [P3C 临时配置表](docs/phase3c-item-volume.md)：例如金矿占 10 容量、200 HP、售价 40 金币；未打碎不入包，切换目标或远行保留剩余血量。只为受损格子记录 HP；方块表面按损失血量比例显示 10 档裂痕，切换目标仍保留，挖碎后消失。
- 镐子初始力量 10、攻速 2 次/秒；力量每级 +5，Lv.6/11/16 攻速翻倍为 4/8/16 次/秒，暂时最高 16 次/秒。升级费用暂设 `5 + (当前等级−1)×2` 金币。松手、切目标和升级都不重置已有冷却；只有当前目标显示血条。
- 楼层表统一控制深度、主题引用、矿物分布和营地位置。同一种矿的 HP、体积、售价不随深度改变。各层为连续基础岩体加成簇矿物，主题不改变碰撞合并规则。
- [矿样验证版](https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1&samples=1) 展开“矿样与合并检查”，可定位整片、条带、交错样本并开关表面网格线，查看同面积的渲染/碰撞三角形数。
- 从西南侧平地沿土路走到矿区即可挖掘。打开 [验证调试版](https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1) 可查看渲染区域/碰撞体/稀疏修改载荷，并定位地表或直接选择十个主题场景；碰撞场定位在矿样验证版开启，这些按钮仅用于验证。
- 碰撞场有窄道、低顶、转角和 8m 深浅井；井内八级阶梯可逐级跳回地面。角色支持坡道/小台阶贴地、顶头碰撞、平滑朝向与位置插值；镜头支持低顶/墙角避障、平滑拉远和近距离角色淡出，可向上看出口或接近垂直观察脚下。主角和镐子动作按用户要求可跳过。
- 正式流程只有退出功能；没有暂停、重开或后台处理流程。矿坑、背包和金币仅保留在当前会话内存，刷新会重置。触控手感与实际手机 60 FPS 尚未验收。

## 发布测试版

```bash
npm run publish:preview
```

该命令构建并发布到公开测试入口，校验公网文件哈希，并检查正式 Mining 未被修改。之后在公开入口验证。

## 挂入游戏列表

`../d-game1` 的游戏列表并列提供正式 Mining 与 Mining 测试版。日常修改只发布到 `dist/games/mining-test/`。宿主构建保留 `dist/games/mining/` 的正式构建，测试源码不会自动覆盖它。

```bash
npm ci --ignore-scripts
npm --prefix ../d-Block-Blast ci --ignore-scripts
npm --prefix ../d-game1 ci --ignore-scripts
npm --prefix ../d-game1 run build
```

宿主默认读取同级 `d-Mining`，可通过 `MINING_TEST_PROJECT` 指定测试源码位置；依赖或源码缺失时明确失败。Mining 自己的构建不依赖宿主。点击“退出游戏”先卸载场景，再返回游戏列表；独立部署时显示“已退出游戏”。游戏始终按横屏布局：竖向窗口内整屏顺时针旋转 90°，横向窗口直接铺满；不显示旋转提醒。画布尺寸、触控方向与安全区域同步转换。

宿主支持 `GAME_BUILD_OUT_DIR` 指定构建产物目录。构建完成后先发布到公开测试入口，再进行游戏场景与交互验证；不需要重启现有静态服务或 Clockbridge。正式构建的输入可通过 `MINING_RELEASE_DIST` 指定。

## 源码入口

| 文件 | 职责 |
| --- | --- |
| `src/game/content/layers.ts` | 楼层深度、主题引用、矿物概率与设施配置的唯一来源 |
| `src/game/content/themes.ts` / `resources.ts` | 十个可复用主题、三十种资源及独立物品属性 |
| `src/game/world/scenery.ts` / `presentation/SceneryMesh.ts` | 普通场景描述、顶点色网格合并及资源释放 |
| `src/main.tsx` | React 应用入口 |
| `src/App.tsx` | 场景与 UI 组装、退出与 Canvas 卸载 |
| `src/game/config.ts` | 已实际使用的尺寸、相机与输入参数 |
| `src/game/ThirdPersonCamera.ts` | 地下相机、观察点避障、近裁剪面保护、距离恢复与角色淡出 |
| `src/game/movement.ts` | 移动/支持面参数、固定步长与高刷绘制调度 |
| `src/game/validation/course.ts` | 普通测试地形、浅井和出口阶梯的共享定义 |
| `src/game/terrain/SparseWorld.ts` / `meshing.ts` | 唯一稀疏逻辑源、删除区间、按需采样与独立网格构建 |
| `src/game/terrain/RegionPipeline.ts` / `TerrainLayers.ts` | 分别管理渲染/碰撞的 Worker、缓存、版本、合并粒度和加载距离 |
| `src/game/validation/terrain.worker.ts` / `TerrainStream.ts` | 批量构建协议、连续挖除与双层一致提交 |
| `src/game/validation/physics.ts` | Rapier 世界、普通碰撞地形、胶囊控制器 |
| `src/game/GameInput.ts` / `bindInput.ts` | 统一动作与浏览器输入适配 |
| `src/game/validation/ValidationScene.tsx` / `Controls.tsx` | 验证场景、帧调度、输入/镜头、选矿和调试 UI |
| `src/game/logic/` | 通用背包、钱包、区域检测、稀疏血量、攻击冷却和镐子属性；背包按外部单位体积计容，只报告满状态，不限制 add |
| `src/game/application/Mining.ts` / `Sale.ts` | 挖矿准入与产物入包、按数量和外部单价报价/售卖 |
| `src/game/application/GameSession.ts` / `items.ts` | 会话接线、掉落配置、售卖区与返回点 |
| `src/game/presentation/BlockCracks.ts` / `cracks.ts` | 血量驱动的独立裂痕表现、区域批绘制与像素图集 |
| `src/game/application/MiningCombat.ts` / `PickaxeUpgrade.ts` | 单格攻击规则、独立升级报价与购买 |
| `src/game/application/BackpackUpgrade.ts` | 临时升级配置、报价与扣钱扩容规则 |
| `src/game/ui/InventoryHud.tsx` / `UpgradePanel.tsx` / `TargetHealth.tsx` | 只读快照展示、返回与升级命令 |
| `src/styles.css` | 横屏布局与安全区域 |
| `vite.config.ts` | 相对资源路径与构建输出 |
| `server/serve.mjs` | 本地静态验证服务器 |

## 当前直接依赖与许可

版本固定在 `package.json` 和锁文件中。以下为已有依赖记录；用户已取消 P0.6，不再安排该专项工作。

| 名称 | 版本 | 用途 | 许可 / 来源 |
| --- | --- | --- | --- |
| React / React DOM | 19.3.0 | UI 与应用挂载 | MIT，https://github.com/facebook/react |
| Three.js | 0.186.1 | 3D 渲染 | MIT，https://github.com/mrdoob/three.js |
| Rapier 3D compat | 0.19.3 | WASM 碰撞与角色控制器 | Apache-2.0，https://github.com/dimforge/rapier.js |
| React Three Fiber | 9.8.1 | React 场景组织 | MIT，https://github.com/pmndrs/react-three-fiber |
| Vite | 8.3.2 | 构建与开发服务 | MIT，https://github.com/vitejs/vite |
| Vite React 插件 | 6.1.1 | React 编译 | MIT，https://github.com/vitejs/vite-plugin-react |
| TypeScript | 7.0.2 | 类型检查 | Apache-2.0，https://github.com/microsoft/TypeScript |
| React / React DOM / Three 类型定义 | 19.3.0 / 19.3.0 / 0.186.0 | 开发类型定义 | MIT，https://github.com/DefinitelyTyped/DefinitelyTyped |

当前 favicon 为项目内编写的 SVG；使用系统字体，无外部模型、贴图或音频。

## 当前表层重建

[林地矿营 Tripo 组件与布局](docs/art/quarry-v2/layout-plan.md) 已替代旧 S2 场景。所有新资产由 Tripo 生成，旧 quarry-v1 与减面树禁止复用。生成记录位于 assets-source/quarry-v2，运行时资源位于 src/game/assets/camp。

`npm run art:build` 仅转换纹理与传输格式，不减面。需要 Python Pillow、KTX Software 4.4.2（默认 /opt/ktx/bin，也可设置 KTX_BIN）和网络用于 glTF Transform 4.5.1。`npm run publish:preview` 构建并验证公开测试入口，保留正式版哈希。
