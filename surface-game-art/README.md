# 松风矿谷可玩场景资产

根据已认可的 `surface-study` 制作方法重新适配主线矿井、服务点和宠物阶梯。来源见 [溯源报告](../docs/mining-surface-origin-20261021.md)。不导入作废旧模型，不使用 Decimate 或 Tripo。

## 环境与生成

Node 24、Blender 5.1.2、KTX-Software 4.4.2。游戏本身依赖仓库根目录的锁文件；离线美术工具单独锁在本目录，不增加运行时依赖。KTX 的 `toktx` 与 `ktx` 须在 PATH，或通过 `KTX_BIN` 指定其目录（本机：`/opt/ktx/bin`）。

### 松风谷（世界 1 地表）

以下命令从仓库根目录运行：

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix surface-game-art
node tools/export-pinewind-layout.mjs
blender -b --python surface-game-art/tools/blender/build_architecture.py
blender -b --python surface-game-art/tools/blender/build_nature.py
node tools/export-pinewind-scene.mjs
KTX_BIN=/opt/ktx/bin node tools/pack-pinewind.mjs
```

`layout.json` 由 `src/game/content/pinewind/hubLayout.ts`（第一世界地表布局的唯一数据源）导出，包含服务点、蛋台与台阶、传送门、宠物屋、道具，以及地形用的广场、道路、铺地和植被避让区（`grounds`）。建筑脚本按每种蛋的颜色生成蛋贴图。Blender 保留可编辑 `.blend`、原始 GLB、两张 256² 图集及逐模型三角形数。离线 Three 工具生成连续地形、自然物实例、道路、1024² 接触阴影和对应三角网格碰撞；不把离线几何生成器引入游戏。`export-pinewind-scene.mjs` 把每个建筑模型的位置和碰撞写进 `src/game/content/pinewind/authored.json`。

打包只做 KTX2 UASTC、Meshopt 和 gzip，检查前后面数相同；产物写入 `src/game/assets/scene/` 的 `.part` 与 manifest。`provenance.json` 记录源文件、生成工具、依赖锁文件、贴图与产物 SHA-256。逐模型面数与贴图尺寸在 `artifacts/*-asset.json`；没有 Tripo 任务 ID。

只更新工具来源记录、保留当前资产字节时使用：

```sh
node tools/pack-pinewind.mjs --provenance-only
```

### 地下大厅与世界 2、3 的地表基地

每个大厅或基地由两部分组成：
- Blender 道具套件 `tools/blender/build_<套件>.py`（共用 `cave_props.py`、`tech_props.py`），输出 `public/assets/underground/<套件>-props.glb`；
- 场景脚本 `tools/underground/<名字>Hall.ts`：生成洞壁、地面等，并按名字摆放道具。

```sh
blender -b --python surface-game-art/tools/blender/build_crystal.py      # 在 surface-game-art 目录运行
KTX_BIN=/opt/ktx/bin node tools/build-underground.mjs crystal           # 在仓库根目录运行
```

构建会烘焙遮蔽并打包，输出 `src/game/assets/scene/<名字>.*`，碰撞写到 `src/game/content/underground/<名字>.json`。只改布局不必重跑 Blender。

### 碰撞

每个模型怎么碰撞，写在 Blender 里建它的那个函数中，紧跟在零件后面（`tools/blender/collision.py`）。四种写法：
- `solid(at, size, yaw)`：盒子；
- `solid_of(零件或名字前缀, hull=True)`：按零件生成盒子或凸包；
- `mesh_solid()`：用模型自己的三角形（松风谷的桥面、矿架；大厅和基地不支持）；
- `passable(原因)`：不挡人（头顶上的、贴地的）。

没写的模型，导出时报错。场景构建按模型的位置、朝向和缩放换算碰撞（`src/game/world/propCollision.ts`）：大厅和基地在 `build-underground.mjs` 里换算；松风谷在游戏里按 `authored.json` 换算。场景脚本里只给自己生成的形状（洞壁、地面、坑沿）写 `box()`/`hull()`。

`tools/tests/prop-collision.test.mjs` 检查每个道具都有碰撞设定。游戏里用 `?debug=1` 打开解锁页，点"显示碰撞"可以看到附近的碰撞体线框。

## 发布与公开验证

```sh
npm run build
node tools/publish-pinewind.mjs
ARTIFACT_DIR=artifacts/pinewind-public-new node tools/check-pinewind-public.cjs
```

发布到独立 `/games/mining-surface-play/index.html`，保护其他游戏文件。发布器使用 `/root/threejs_space/d-game1`，不会执行 host 的全量游戏构建。首次加入首页需先准备首页入口，再传 `--launcher`；现已列出，不必重复。

公开检查使用本项目安装的 Playwright（`package.json` 的开发依赖，版本要和本机已装的浏览器对应；也可用 `MINING_PLAYWRIGHT_MODULE` 另指）。它需要可用的 Chromium，采用 SwiftShader 和独立测试存档；不是手机或物理 GPU 性能测试。每次选新 `ARTIFACT_DIR`，不要覆盖历史证据。
