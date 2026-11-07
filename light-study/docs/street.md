# 松风矿街

公开入口：https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html

## 场景与光感

2026-10-20 按用户“现在做成街景，还是这种光影感觉”的要求，把独立光照样板扩展为短街。街口、中段、街尾交错布置三盏灯，保留暖色局部照明与冷暗间隔。店面采用真实厚墙洞口、粗木框架、石台基、双坡屋顶和少量条纹雨棚；招牌用镐头图案。窗玻璃有低强度暖色自发光，没有给每个窗户额外增加点灯。

## 新资产来源

- Blender 源文件：`source-art/street.blend`；生成脚本：`tools/blender/build_street.py`。
- GLB：`public/assets/street.glb`，8,708,000 bytes；布局：`public/assets/street-layout.json`。
- 117,156 个三角面，1,058 个源网格，208 块路面石板。闭合流形、三角面和 UV 非零面积、有限顶点检查通过。
- 全部几何为此次新作，沿用通用建模函数，没有导入旧场景网格，没有减面步骤，没有 Tripo 任务。
- 沿用已认可的石灰石、砂岩、蓝色/米色粉刷墙 512² PBR 贴图及木材/漆木 256² 贴图；玫瑰色灰泥共享米色贴图并调色。新屋顶、雨棚、窗玻璃为无贴图材质。纹理资源没有新增。
- 每个模型、材质、源码和构建资源的 SHA256 均由 `artifacts/street-asset.json`、`materials-asset.json` 和 `asset-manifest.json` 记录并在发布前校验。

## 渲染

三盏暖灯各使用 1024² × 6 面阴影图；2048² 方向光阴影覆盖整条街。保持 .22 m 发光半径、24 blocker / 48 filter 的软影质量。灯的物理照射范围以外跳过阴影采样，范围以内仍使用同一套 PCSS；仅自身灯框从该灯的投影层排除，灯柱和其他灯具继续投影。

昼夜天空各初始化一次，并复用同一个 PMREM 环境节点，只更新纹理绑定，避免换天空时重编译整套多灯材质。街景 PCSS 使用 GPU 循环表达同样的 24/48 次采样，减少 TSL 节点和着色器代码展开；小院仍保留原来的表达。静态阴影缓存；相机移动不刷新阴影，日夜切换刷新。接触 AO、磨砂灯芯和深度遮挡后的局部光晕沿用小院参数。画面静止时停止提交帧，最多一帧在途。

## 公开检查

检查命令按阶段分开执行，均访问公开入口，桌面 1440×900、DPR1：

```bash
ARTIFACT_DIR=../artifacts/street-final node tools/check-street.cjs
CHECK_MODE=runtime ARTIFACT_DIR=../artifacts/street-final/runtime node tools/check-street.cjs
CHECK_MODE=performance PERF_FILTER=soft ARTIFACT_DIR=../artifacts/street-final/performance node tools/check-street.cjs
CHECK_MODE=courtyard ARTIFACT_DIR=../artifacts/street-final/courtyard node tools/check-street.cjs
```

首轮组合检查在软件浏览器里由 AO 对照切换到白天时出现 `Target crashed`，失败记录保留在 `artifacts/street-before-env-cache/runtime/`。排查确认原环境贴图切换会生成另一整套多灯着色器，已改为稳定环境绑定。随后完整组合复测通过，记录在 `artifacts/street-unrolled-stable-env/`；最终 GPU 循环版本另行重测，报告不混用。

T3 内置浏览器被主机 AppArmor 明确阻止，使用既有 Chromium/Vulkan SwiftShader 流程。软件 GPU 的时间戳不能当成真实显卡 FPS。本轮仅电脑端，不做手机检查。

## 街景首版结果（2026-10-20 UTC，白天调整前）

当时构建入口 `index-MqsuN4Mf.js`，街景模块 `street-CrmxbVFH.js`，共享模块 `style-zM0WhtM3.js`。四段公开检查均完整完成、进程退出码为 0，页面与 WGSL 错误、警告为零。`artifacts/street-final/verification.json` 核对源码、模型、构建、HTTP 与浏览器加载哈希；909 个范围外源码文件、1,116 个其他游戏发布文件保持不变。

- 三个视角按钮、实际鼠标拖动、昼夜、AO、阴影缓存与静止停帧均通过。AO 恢复、日夜恢复、机位恢复和旧小院柱影对照均逐像素相同。
- GPU 循环与原展开版的街口逐像素相同；街中与灯下各仅有 1 个颜色通道相差 1/255。没有降低几何、阴影分辨率或采样数。
- 固定街口、1440×900、DPR1、AO 与软影开启，预热后取三个独立时间戳帧：48 draws / 8 passes；CPU 提交 3.2–7.2 ms，SwiftShader GPU 中位数 20038.78 ms。后者是 CPU 软件模拟的 GPU 时间，不能推算真实显卡 FPS，也不能与不同机位的小院测量直接比较。
- Three.js 资源统计约 179.0 MiB，其中纹理约 169.0 MiB；这不是浏览器进程总内存或驱动实际显存峰值。三盏点灯的深度图为 1024²×6×3，方向光深度图 2048²，静态缓存减少重复投影绘制，逐像素软影采样仍有成本。
- 首次进入同一夜景时，44 个生成着色器的总源码量 4,293,021 → 977,528 bytes（减少 77.2%）。同机两次单次启动记录 55.47 → 30.63 秒，仅为该软件环境的加载/编译观察，包含网络等波动，不是硬件启动基准。

当前只验收电脑端公开样板，没有手机、真实 GPU 或动态角色的性能结论。截图入口为 `artifacts/street-final/review.html`；`performance/report.json` 保留每帧原始值，`runtime/report.json` 保留组合操作及编译计数。

## 晴日调整（2026-10-20 UTC）

用户指出旧白天阴影太重、受光面不够亮、整体偏灰。仅 `src/streetLighting.ts` 的白天参数与天空生成值改变，夜间参数、所有模型与材质资源保持。

| 参数 | 之前 | 当前 |
| --- | --- | --- |
| 日照强度 | 3.6 | 6 |
| 日照颜色 | `#fff0d9` | `#ffe4bd` |
| 环境强度 | .50 | 1.25 |
| 曝光 | .95 | 1.1 |
| 日间环境辐射 | 较暗的灰褐下半球 | 明亮蓝色天空、浅暖地面反射近似 |

日照与填充分别调整：日照让石材、浅墙出现暖白亮面；天空和地面反射近似让背光墙面、屋檐和阴影里的颜色可读。Neutral tone mapping 保持，接触 AO 与太阳阴影设置保持。没有新灯、新渲染通道、屏幕提亮滤镜或实时 GI。

当前公开入口 `index-AKTRDoSj.js`，街景 `street-B2lCsFt_.js`。`artifacts/day-r1/` 包含三个白天视角、夜景保留和白天切换恢复截图；后两项分别与旧夜景及新白天逐像素一致。发布、公开浏览器检查与哈希验证全部退出 0，无页面/WGSL 错误或警告。源码/构建/公开/浏览器哈希一致，38 个资源、2,906 个范围外工作区文件、1,116 个其他游戏发布文件未变。

检查命令（仓库根目录）为 `node light-study/tools/check-street-day.cjs` 和 `python3 light-study/tools/verify-street-day.py`，均在公开发布后执行。此次没有重跑性能基准；前节成本属于上一版固定夜景的软件渲染测量，不作为此次白天帧率。公开对照图为 `artifacts/day-r1/review.html`。

## 当前街景：静态柔影缓存（2026-10-20 UTC）

当前公开模块 `street-CSyQuXj_.js`。固定灯具的遮挡结果改为图集复用，保留原实时入口 `?shadows=live`；光照和材质仍实时计算。三次同环境软件 GPU 暖帧中位数 21134.15 → 8138.69 ms（减少 61.49%），不是笔记本硬件性能预测。白天三个机位及恢复路径逐像素不变，三机位夜间软影已公开对照。图集增加 64 MiB 纹理，适用于当前静态样板。

完整有效/无效测量、制作来源和实机验证边界见 [night-performance.md](night-performance.md)。
