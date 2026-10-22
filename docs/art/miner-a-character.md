# A 矿工角色试装

采用第一组 Image 2.5 候选 A「方块感矿工」，生成三维模型后在 Blender 建立骨骼、计算并修正权重，再接入 Mining 的玩家角色。

## 模型与源文件

- 参考图：`output/imagegen/character-concepts-20261021/a-blocky-miner.png`。
- Tripo 新任务：`b054bf79-1490-4bf9-8774-287dd54f35f2`，模型版本 `v3.0-20250812`，生成时提交 12,000 面限制，产出 11,678 个三角面。
- 原始模型：`assets-source/miner-a/miner-a-original.glb`。
- Blender 源文件：`assets-source/miner-a/miner-a-rigged.blend`，包含网格、贴图、16 根骨骼、顶点权重和四个动作。
- 生成与绑定脚本：`tools/generate-miner-a.mjs`、`tools/rig-miner-a.py`。
- 游戏资产：`src/game/assets/character/miner-a.glb`；完整来源、动作版本、贴图尺寸与 SHA-256 见同目录的 `miner-a.manifest.json`。

按仓库现有忽略规则，原始 GLB 与 Blender 工作文件不纳入 Git；运行用 GLB、绑定脚本、参考图与固定版本的 RAB 动作数据纳入版本管理。当前可编辑文件可从 [Blender 源文件](https://w-sunjun-public.dev.clock-p.com/art/miner-a-mining-20261021/miner-a-rigged.blend) 下载，SHA-256：`5bcf82b8a150582d685de7319793b027b250af6e08245dedabc2bdf72545e6b5`。需要重建时，先运行 `node tools/generate-miner-a.mjs` 下载记录中的 Tripo 原始模型，再运行 `blender --background --factory-startup --python-exit-code 1 --python tools/rig-miner-a.py`。

保留生成模型的轮廓、三角面和 2048×2048 贴图。绑定前合并重合顶点以修复网格邻接，保留各面的 UV。骨架枢轴根据生成模型的截面和服装部位确定，使用 Blender 骨骼热权重，平滑相邻关节并限制到每顶点最多四个影响；头盔与头部整体跟随头骨。

## 动作来源

| 游戏动作 | RAB 动作 | Animation / Version |
| --- | --- | --- |
| 待机 | [RoMixamo · 徒手站立待机](https://rab-sunjun-public.dev.clock-p.com/animations/4748) | 4748 / 4748 |
| 行走 | [RoMixamo · 徒手向前走](https://rab-sunjun-public.dev.clock-p.com/animations/4768) | 4768 / 4768 |
| 跑步 | [RoMixamo · 中速跑步](https://rab-sunjun-public.dev.clock-p.com/animations/4472) | 4472 / 4472 |
| 挥镐 | 代码手调（`src/game/presentation/minerMotions.ts`） | — |
| 起跳 / 下落 / 落地 | 代码手调（同上） | — |

待机、行走、跑步来自 RAB 的 R15 动作库，原始 Motion JSON 保存在 `assets-source/miner-a/rab-*.json`。按角色的静止姿势校正四肢旋转，行走与跑步另作下述膝部重定向；水平根位移由游戏控制，烘焙时校正脚底高度和循环接缝。没有使用 Tripo 自动绑定或自动生成的动作。

2026-10-22 起挥镐与跳跃改为代码手调：RAB 库里没有镐子挥击，只有约 2 秒的持斧下劈和带落地的长跳跃，压进 0.5 秒攻击周期或 0.75 秒滞空都显得拖沓。Miner A 的骨骼静止旋转全部为单位四元数、轴向与模型一致，所以姿势直接写成骨骼局部欧拉角，运行时生成四元数关键帧；落地下蹲按角色腿长做两节腿解算，双脚留在原地。GLB 里仍带着原来的 RAB `Mine` 片段（约 20 KB），运行时不再使用。

### 脚部绑定修正

生成网格的左右靴子在静止姿势中分别向外偏约 24.59°、26.16°。脚部绑定根据实际鞋底的长轴消除该偏角，再应用原始 RAB Run 的髋、膝、踝旋转。鞋底完全跟随脚骨，鞋帮向小腿平滑过渡，避免脚掌被小腿权重拉歪；没有逐帧强制脚尖平行。

回归验证直接测量变形后鞋底的方向，与原始 RAB 关节层级计算出的方向比较，不读取绑定偏角元数据。按 60 fps 遍历 Run、Walk 和 Idle 的全周期：旧模型在 Run 中左右脚最大方向误差为 29.24°、32.08°，修正后为 0.45°、0.40°。三组动作均小于 0.5°。旧模型会触发此回归测试失败。

### 大腿与膝部修正

背面跑步检查发现，原膝轴比网格截面中心向外偏约 3.3 厘米，膝附近的热权重还混入了脚骨影响。现在按真实网格横截面重新定位膝、踝轴心，膝部只在同侧大腿与小腿间过渡，鞋底继续完整跟随脚骨。

R15 源动作的膝弯折方向在该角色的短腿比例上仍有侧偏，因此 Walk、Run 使用两节腿重定向：以骨盆前方确定膝盖弯折平面，保留按角色骨长计算的髋与踝端点，以及源动作的脚掌朝向。没有改动 RAB 原始动作文件；Idle 不做此膝平面调整。绑定参数与重定向误差记录在模型 manifest 和 Blender 自定义属性中。

回归验证覆盖膝轴居中、膝部权重范围、行走与跑步全周期的膝弯折平面，以及之前的脚掌方向、地面接触和网格拉伸检查。修正前模型会同时触发膝轴和弯折平面两项测试失败。背面关键帧对照、公开游戏录像与检查结果保存在 `artifacts/miner-a-knees-fix/`。

## 游戏表现

人物替换原有圆柱占位外观，身高保持 1.85 米。现有移动、碰撞、跳跃、相机和传送逻辑继续控制角色。动画根据实际水平位移平滑切换，遇墙停下也会回到待机；步频随实际速度变化。

跳跃按脚底的实际竖直速度切换三个姿势：起跳上升时右膝上收、左臂上扬、镐子举在胸前；过了最高点换成双臂张开、双腿微分的下落姿势；落地后骨盆下沉约 13 厘米、膝盖弯曲，0.32 秒内回到移动或待机，下落越快蹲得越深。只有真正起跳才收膝；走下矮台阶、短暂离地不算下落，也不触发下蹲。空中仍可挥镐，此时腿保持空中姿势。

### 挥镐与基础工具

基础镐由 Blender 自制，木柄、握把和金属镐头合成一个网格，456 个三角面，使用一张 64×64 自制贴图。脚本为 `tools/build-basic-pickaxe.py`，运行资产与来源记录位于 `src/game/assets/tools/basic-pickaxe.*`。没有 Tripo 生成任务。可编辑源文件：[basic-pickaxe.blend](https://w-sunjun-public.dev.clock-p.com/art/miner-a-mining-20261021/basic-pickaxe.blend)，SHA-256：`ebca2e1e0f99477885482df977530ee33f43052d6509e22c91d7c592cbf33f5b`。重建命令：`blender --background --factory-startup --python-exit-code 1 --python tools/build-basic-pickaxe.py`。

镐子挂在右手骨骼上，角色朝选中的矿块转身，并按目标高度俯身或后仰（挖脚下的矿块时上身前倾，挖头顶的矿块时后仰）。一次挥击分五段：镐子竖在胸前 → 举到头后上方 → 加速砸下（全程 30% 处接触）→ 短暂停顿 → 回到胸前。接触时镐柄从拳头斜向上伸出、镐尖朝前下方，正对胸口高度的方块面。

有效挖矿命中才触发挥击，满包、冷却、不可挖目标、空点和零伤害重试都不挥。挥击时长等于攻击间隔，但限制在 0.22–0.6 秒：攻速超过每秒约 4.5 次时，每次命中照常结算，手臂按 0.22 秒一次连贯挥动，最多只排一次，停手后不补播。停止挖掘后回到移动或待机，传送取消动作。

伤害、冷却和矿产结算仍由原有挖矿逻辑决定，命中在挥击开始时生效；接触帧放在较早的 30% 处，攻速 2 时约 0.15 秒后镐尖落下。保留原有八米选取范围，远处矿块采用朝向挥击，不拉伸手臂或镐子。目前所有装备等级共用这把基础镐外观，尚未制作整套进阶装备。

角色在启动阶段异步加载，失败会显示加载错误。退出时释放动画、骨架、网格和贴图。专门的角色诊断随现有调试快照提供，普通玩家界面不展示这些信息。

## 验证与入口

- 试玩入口：<https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html>（2026-10-22 起的主线公开入口）。
- 构建：`npm run build`。
- 定向验证：`node --test tools/tests/miner-avatar.test.mjs tools/tests/miner-mining.test.mjs tools/tests/mining-combat.test.mjs tools/tests/runtime-lifecycle.test.mjs`。
- 公网浏览器验证：`node tools/check-miner-avatar.cjs`，结果保存在 `artifacts/miner-a/report.json`。
- 脚部修正的定向公网验证：`node tools/check-miner-feet.cjs`；结果、截图和录像保存在 `artifacts/miner-a-feet-fix/`。验证实际加载的模型哈希、键盘跑动的多个动作阶段及停步回到 Idle。
- 膝部修正的背面公网验证：`node tools/check-miner-rear.cjs`；结果保存在 `artifacts/miner-a-knees-fix/after/`。
- 挥镐与工具公网验证：`node tools/check-miner-mining.cjs`；检查实际鼠标挖矿、命中次数、松手恢复、边走边挖与空点不挥击，结果保存在 `artifacts/miner-a-mining/public/`。
- 手调动作测试：`node --test tools/tests/miner-motion.test.mjs`（举镐高度与接触位置、低处/高处目标、高攻速连贯挥动不补播、起跳→下落→落地顺序、矮台阶不触发、落地下蹲双脚不动）。
- 手调动作与贴图的公网手机检查：`node tools/check-miner-motion-mobile.cjs`（横屏、触控、DPR 2）；触控跳跃、摇杆进老矿井、按住挖矿，并在页面内逐帧截取跳跃与挥镐，结果保存在 `artifacts/miner-motion-mobile/`。
- 调动作用的离线预览：`tools/motion-preview/`（Vite 开发服务器 + `render-sheets.cjs` 输出侧面、背后、游戏视角的逐帧拼图），只用于制作，验收以公开入口为准。
- 发布结果与公网文件哈希：`artifacts/preview-release.json`。仅更新测试入口，正式 Mining 不变。

资产测试覆盖权重归一化、骨架、动作变化与循环、脚底高度，以及跑动时的相邻顶点拉伸。浏览器使用桌面 Chromium / SwiftShader，属于软件渲染的功能验证，不代表用户设备性能。截图和录像保存为外部文件，不作为会话的图片输入；外观最终以用户在测试入口的观察为准。
