# Mining

横屏单机挖矿游戏，支持电脑和手机。已有第三人称移动/相机、普通地形与体素共用 Rapier、多矿物挖掘、鼠标选格与触点长按。矿区逻辑规模 100 × 100 × 2000 格，使用唯一稀疏数据源，渲染/碰撞独立合并与加载。P3A 已实现独立背包/钱包 API、多格采集入包、地表踩圈售卖和返回按钮；P3C 已按物品体积计容并按各矿物单价售卖。P3B.1 接入背包升级；P3B.2 接入单格血量、力量/攻速和镐子升级。宠物与实际存档读写后置。

- 游戏列表：<https://w-sunjun-public.dev.clock-p.com/>
- Mining：<https://w-sunjun-public.dev.clock-p.com/games/mining/index.html>
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

## 开发与独立运行

需要 Node.js **24.x**。

```bash
nvm use
npm ci --ignore-scripts
npm run dev
```

静态构建与本地检查：

```bash
npm test
npm run build
npm run serve
```

打开 <http://127.0.0.1:4175>。`dist/index.html` 是独立交付入口；整个 `dist/` 可放入普通静态 HTTP 服务，也支持子目录。`server/serve.mjs` 仅供本地测试，不是游戏运行依赖。运行产物不需要 Node、Vite、专用后端或外部 CDN。

当前运行 60 Hz 固定物理步长，并将绘制调度限制为最高约 60 FPS；尚未验证目标手机 60 FPS。Rapier WASM 随 JS 包交付，地形 Worker 是构建后的本地资源。

## 当前操作

- 电脑：右键拖动转镜头；WASD / 方向键移动，空格跳跃，左键按住挖掘高亮方块，攻击距离约 4 格。
- 手机横屏：左摇杆移动、右侧按钮跳跃。长按场景中的目标约 180ms 挖掘，挖掘时滑动可换目标；先拖动超过 10px 则转镜头，本次手势不挖掘。松手停止，挖空后继续查询当前触点下的新表面。
- 当前有岩石、深层岩石、煤、铜、金、水晶六种矿物；背包保存件数，按各矿物体积计算占用，按各自单价售卖。每次敲击检查满包；已经销毁的格子全部入包，即使这时已经超量。背包 add 本身没有容量限制。
- 背包初始容量 50。满包后点击“返回地表”，走入出生平台上的金色圆圈自动出售；返回落在圈外，背包和已挖矿坑保留。底层允许超容量，画面区分容量占用和物品件数；当前镐子每次只攻击一个格子。
- 点击 HUD“升级”打开界面，分为镐子和背包两页。背包暂设容量 100 / 200 / 400，费用 20 / 50 / 100 金币；购买保留已有矿物，金币不足或达到最高档不可购买。界面内屏蔽游戏输入，关闭后恢复。
- 矿物的体积/血量/售价见 [P3C 临时配置表](docs/phase3c-item-volume.md)：例如金矿占 10 容量、200 HP、售价 40 金币；未打碎不入包，切换目标或远行保留剩余血量。只为受损格子记录 HP；方块表面按损失血量比例显示 10 档裂痕，切换目标仍保留，挖碎后消失。
- 镐子初始力量 10、攻速 2 次/秒；力量每级 +5，Lv.6/11/16 攻速翻倍为 4/8/16 次/秒，暂时最高 16 次/秒。升级费用暂设 `5 + (当前等级−1)×2` 金币。松手、切目标和升级都不重置已有冷却；只有当前目标显示血条。
- 调试版展开“矿样与合并检查”，可定位整片、条带、交错样本并开关表面网格线，查看同面积的渲染/碰撞三角形数。
- 从出生平台沿前方坡道走到矿区即可挖掘。打开 [验证调试版](https://w-sunjun-public.dev.clock-p.com/games/mining/index.html?debug=1) 可查看渲染区域/碰撞体/稀疏修改载荷，并定位地表、碰撞场或 1000 层测试洞室；这些定位按钮仅用于验证。
- 碰撞场有窄道、低顶、转角和 8m 深浅井；井内八级阶梯可逐级跳回地面。角色支持坡道/小台阶贴地、顶头碰撞、平滑朝向与位置插值；镜头支持低顶/墙角避障、平滑拉远和近距离角色淡出，可向上看出口或接近垂直观察脚下。主角和镐子动作按用户要求可跳过。
- 正式流程只有退出功能；没有暂停、重开或后台处理流程。矿坑、背包和金币仅保留在当前会话内存，刷新会重置。触控手感与实际手机 60 FPS 尚未验收。

## 挂入游戏列表

`../d-game1` 的宿主构建会先构建 Block Blast 和 Mining，再将它们分别复制到 `dist/games/block-blast/` 与 `dist/games/mining/`。

```bash
npm ci --ignore-scripts
npm --prefix ../d-Block-Blast ci --ignore-scripts
npm --prefix ../d-game1 ci --ignore-scripts
npm --prefix ../d-game1 run build
```

宿主默认读取同级 `d-Mining`，可通过 `MINING_PROJECT` 指定其他源码位置；依赖或源码缺失时明确失败。Mining 自己的构建不依赖宿主。点击“退出游戏”先卸载场景，再返回游戏列表；独立部署时显示“已退出游戏”。游戏始终按横屏布局：竖向窗口内整屏顺时针旋转 90°，横向窗口直接铺满；不显示旋转提醒。画布尺寸、触控方向与安全区域同步转换。

宿主支持 `GAME_BUILD_OUT_DIR` 指定预览构建目录。线上更新先在临时目录完成构建与检查，再发布到宿主实际服务的 `dist/`；不需要重启现有静态服务或 Clockbridge。

## 源码入口

| 文件 | 职责 |
| --- | --- |
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
