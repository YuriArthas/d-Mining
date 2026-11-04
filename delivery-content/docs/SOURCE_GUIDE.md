# 源工程接续与构建

这是 r10 交付快照。完整游戏源码、锁文件、运行素材和 `dist/` 同包提供。素材来源与本次许可资料范围见 `ASSET_PROVENANCE.md`、`ASSET_AUTHORIZATION.md`。

## 干净构建

需要 Node.js 24.x 和 npm。解压后在本目录执行：

```sh
npm ci --ignore-scripts
npm run verify:source
npm run build
npm run serve
```

浏览器打开 `http://127.0.0.1:4175/`。`server/serve.mjs` 只是本地静态文件服务；部署时直接上传整个 `dist/`，不需要 Node.js、Vite、数据库服务或专用后端。也可以用其他普通 HTTP(S) 静态服务器托管。不要用 `file://`。

运行所需的库、Worker、WASM、字体、模型和贴图已打入产物，游戏不通过 CDN 下载运行包。源码构建的依赖由 `package-lock.json` 锁定，安装时由 npm 获取；交付包不包含 `node_modules`、npm 缓存或 npm 包归档。无需执行美术生成工具即可构建游戏。

`DELIVERY.json.buildTime` 固定构建标识，`revision` 标记本轮交付；重复构建可逐文件比较 `dist` 的 SHA-256。旧 ZIP 在新包生成并通过核对后删除，不创建备份。 每次交付改动必须重新生成完整源码 ZIP 与 dist ZIP，核对修复已入包并提供下载路径；只构建或提交 push 不算交付完成。

## 实际入口与消费者

| 职责 | 文件及调用路径 |
| --- | --- |
| HTML 与启动界面 | `index.html` → `src/bootstrap.ts` → `src/main.tsx`；`vite.config.ts` 注入 `src/boot/loading.js`、loading CSS/SVG |
| 游戏装配 | `src/App.tsx` 建立输入、会话、存档、画面与 UI |
| 规则与交易 | `src/game/application/GameSession.ts`；`logic/` 中的 Pickaxe、AttackCooldown、Inventory、Wallet、Rebirth、pets 等；`application/` 下的服务组织购买、出售和开蛋 |
| 锁矿与保留 | `logic/Inventory.ts`、`MaterialStore.ts` 与 `GameSession.lockItem`；矿物锁定状态参与出售过滤并进入存档，背包界面提供触控开关 |
| 售矿表现 | `presentation/MiningOverlay.ts`、`saleFlight.ts`、`ui/hud/Hud.tsx` 和 `audio/sfx.ts` 共用金币飞行时间表；金币交易仍由 GameSession 结算 |
| 键鼠与触控 | `src/game/bindInput.ts`、`GameInput.ts`、`TouchGesture.ts`、`Controls.tsx` |
| 画面与循环 | `src/game/validation/ValidationScene.tsx` 是实际 WebGL 画面入口；`movement.ts` 提供固定物理步长与 60 Hz 渲染调度；`world/`、`presentation/`、`terrain/` 实现场景、角色与矿块 |
| 核心数值 | `src/game/content/economy.json` → `economy.ts` 的 `validateEconomy` → Pickaxe、GameSession、resources、journeyWorlds、petContent、Rebirth |
| 地层与资源 | `content/journeyWorlds.ts`、`layers.ts`、`resources.ts`、`journeyResources.ts`；经济表决定深度、概率、HP、售价和等级门槛 |
| 布局与碰撞 | `content/pinewind/hubLayout.ts`、`pinewind/authored.json`、`rooms/*.layout.json`、`rooms/*.scene.json`、`underground/*.json` → `world/` 与场景装配 |
| 文本 | `src/game/i18n/locales/*.json` 自动发现；内容保存稳定文本引用，显示边界解析，详见 I18N_DELIVERY.md |
| 存档 | `src/game/persistence/`，由 SaveCoordinator 协调 LocalStorageSaveStore，以单键快照保存全部进度和稀疏矿坑；默认 debug 使用不持久化的 MemorySaveStore，显式 saveTest 使用独立 localStorage 验收键；详见 SAVES.md |
| 调试边界 | `runtime/debugOptions.ts` 统一精确的 `?debug=1` 开关；只在开启后构造诊断计量和碰撞视图、挂载调试接口或启用诊断调参 |
| 运行素材 | `src/game/assets/`，原始许可在 `licenses/`；来源清单在 `public/provenance/asset-inventory.json` |
| 音频 | `src/game/audio/` 的合成器、音效和曲谱代码，使用 Web Audio 本地生成 |

相对上述表格，`logic/`、`content/` 等简写均位于 `src/game/`。源文件名中的 validation 不表示它只用于测试。

测试与调试源码保留在完整包，正常启动不执行自动化测试，也不构造帧率计量、渲染剖析和碰撞调试视图；没有要求把所有诊断代码从 dist 剔除。`?debug=1` 使用刷新即清空的内存会话；`?debug=1&kit=1` 打开独立 UI 示例。正式与测试普通存档仍按命名空间隔离，持久化统一采用 localStorage；不读取、迁移或删除旧存储方案的进度。

## 修改数值

读取 `docs/PARAMETERS.md` 和 `parameter-catalog.json`，修改唯一数据源，执行测试并重新构建。参数改变不会自动迁移已有存档中的物品、已售金币或已挖矿坑；验证初始条件时使用 `?debug=1&saveTest=unique-review-id` 的隔离存档。不要用调试操作改玩家正常存档。

## 美术工作文件

`surface-game-art/` 保存当前场景的 Blender 源文件、制作脚本、布局和小图集；`assets-source/` 保存角色、商店、宠物和基础镐的工作文件；根 `tools/` 中的相关 Python/资产脚本用于记录生产流程。它们不参与普通 `npm run build`，不是运行时依赖。

工作文件副本清除了内部路径/服务地址；运行 GLB、场景 bundle 和贴图保持原字节。原文件和交付副本的哈希、生产方法、面数、贴图尺寸见素材清单。Blender 5.1.2、KTX-Software 4.4.2 等离线美术工具未随包提供；没有宣称不同工具版本下重新生成美术能与当前资源逐字节相同。

## 本次导入的已知差异

默认语言改为中文；关闭 MSAA；地表隐藏地下灯光并预热有灯/无灯两套程序。`npm run build:profile` 生成未压缩且带 source map 的诊断产物，普通 `npm run build` 保持生产构建。普通存档会话恢复为必须支持 Web Locks，因此 HTTP 兼容回归测试当前失败；本次按原包覆盖，未改写这项行为。
