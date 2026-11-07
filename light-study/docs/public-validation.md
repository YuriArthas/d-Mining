# 当前：白天日照与阴影补光（2026-10-20）

[直接查看晴日街景](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?scene=street&light=day)。入口 `index-AKTRDoSj.js`，街景 `street-B2lCsFt_.js`，共享模块 `style-zM0WhtM3.js`。仅街景白天的日照、天空/地面环境辐射和曝光改变，全部模型与贴图保留。

先运行 `npm --prefix light-study run publish` 发布，再以 `node light-study/tools/check-street-day.cjs` 检查公开桌面三个机位及真实昼夜按钮；最后运行 `python3 light-study/tools/verify-street-day.py`。三段均退出 0，日志分别为 `artifacts/day-r1-publish.log`、`day-r1-check.log`、`day-r1/verification.log`。

- `artifacts/day-r1/report.json`：街口、街中、灯下公开截图，昼夜切换、常驻几何、相机移动复用阴影与静止停帧通过；页面/WGSL 错误与警告均为零。
- `artifacts/day-r1/verification.json`：源码、构建、HTTP 与浏览器加载哈希一致。夜景同机位与上一版逐像素相同；白天切回后逐像素相同。38 个资源、2,906 个范围外工作区文件、1,116 个其他游戏发布文件不变。
- 同机位固定石板区域的屏幕线性亮度，受光区 .355 → .792，阴影区 .114 → .531，两区比值约 3.11 → 1.49。坐标和 RGB 原值写入报告；这是画面采样，不是物理照度测量或美术验收。
- 原白天及夜晚的备份在 `artifacts/before-day-refinement/`；交互对照为 `artifacts/day-r1/review.html`。明亮暖日照、较浅冷色阴影与材质细节经三个公开视角目测检查。

T3 浏览器再次明确报告主机 AppArmor 阻止启动，采用既有公开 Chromium/Vulkan SwiftShader 检查。本轮没有新增灯、纹理分辨率或渲染通道；未重测完整性能基准，不声称真实 GPU 帧率已验证。详细参数见 [street.md](street.md)。

## 历史：街景首版（2026-10-20）

[公开街景](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html) 已成为默认入口；小院对照保留。当时入口 `index-MqsuN4Mf.js`，街景模块 `street-CrmxbVFH.js`。完整资产、成本、修正过程和验证边界见 [street.md](street.md)。

`artifacts/street-final/` 的画面、组合交互、三帧成本和小院回归四段检查全部完成，退出码为 0；`verification.json` 确认源码/构建/公开/浏览器一致。昼夜、AO、拖动复原以及旧小院画面均逐像素一致；此前软件浏览器的切换崩溃保留记录并已在最终版完整复测通过。真实显卡 FPS 未测。

以下为小院历次版本的历史证据；旧 bundle 名称不代表当前发布版本。

## 历史：按灯体尺寸柔化柱影（2026-10-20）

当时公开构建 `index-Chal1Q84.js`：[直接看墙角柱影](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?light=night&study=both&view=wall)。用户认可整体光感后指出柱影过硬，本轮只调整 focused 夜景的灯影；灯芯、光晕、亮度、材质和几何资源保持。

以灯罩宽度 0.44 m 对应的等效发光半径 0.22 m 计算 PCSS 半影。先搜索遮挡距离，再让半影随遮挡物到接收面的距离扩大，贴近物体时回到紧致的接触边缘。接收面平面修正避免大范围过滤把墙面自身当成遮挡；每条立方体采样方向独立转换透视深度，日夜切换实时读取阴影相机的 near/far。这是单张深度立方体上的有限尺寸光源近似，照明和高光仍使用原点灯，不是光追或 GI。

先发布，再运行桌面 Chromium / Vulkan SwiftShader 检查。T3 preview 仍被主机 AppArmor 阻止。最终画面与运行两段均完整结束、退出码为 **0**，页面、GPU 错误和警告均为零。

- `artifacts/soft-shadow-final/report.json`：墙角、全景、地面、背面、关闭 AO、恢复 AO；缓存与静止检查。
- `artifacts/soft-shadow-final/runtime/report.json`：同灯同机位切换硬影/软影、各三次暖帧；晴日/暖阳/夜晚恢复、原版截图。
- `artifacts/soft-shadow-final/verification.json`：当前源码、构建、公开 HTTP 和浏览器 bundle 一致；909 个范围外源码文件、1116 个其他游戏发布文件及全部模型/贴图资源未变。
- 五组截图逐像素一致：原版与上轮原版；关闭软影与上轮同灯墙角；AO 恢复；昼夜切回；分段运行的同机位软影。不会把旧报告当作当前验证。
- `artifacts/soft-shadow-final/review.html`：局部/全景对照。T3 HTML 预览异常退出后，单独 Chromium 验证图片解码、两次切换与布局，见同目录 `review-preview-check.json`。

目测墙面柱影已从硬切边变成宽缓过渡，柱脚暗部保留，墙背面没有新增暖色漏光。放大后半影仍有少量采样颗粒；PCSS 是近似，未代替用户的美术验收。本次未新增 Claude 审看，下面的两轮 Claude 意见属于此前 L1–L4。

## 本轮采样成本

同一公开构建、同灯与材质、墙角固定机位，1440×900、DPR1、AO 开启，各测三次精确暖帧：

| 阴影 | draws | passes | CPU 提交范围 | GPU timestamp 中位数 |
| --- | ---: | ---: | ---: | ---: |
| 原硬影 | 42 | 8 | 2.40–3.20 ms | 5881.28 ms |
| 有限尺寸软影 | 42 | 8 | 2.10–2.60 ms | 7340.60 ms |

软影每个接收片元增加 24 次遮挡深度读取，有遮挡时再做 48 次比较采样；原硬影为 5 次比较采样。复用同一张 1024×1024×6 阴影图，未增加灯、阴影图或渲染通道。额外消耗在片元采样与计算，本次软件 GPU 时间约为硬影的 1.25 倍。静止时不提交帧，移动相机、切 AO 和硬/软影均复用阴影缓存。上述时间只代表 SwiftShader，不能换算用户显卡 FPS；本轮未做手机或物理 GPU 性能验收。

初次公开候选的深度采样 shader 编译失败保存在 `soft-shadow-r1*` / `soft-shadow-r2*`，没有记为通过。最终使用独立的普通/比较采样器绑定读取同一阴影资源，解决 r186 将不同采样器合并的问题；未修改 Three.js 依赖。修改前源码和发布记录见 `artifacts/before-soft-shadow/`。

---

# 历史：四组夜景对照（2026-10-20）

当时公开构建 `index-B4SMkFgz.js`：[打开本轮夜景](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?light=night&study=both)。按 `docs/phase-light-study-night.md` 完成灰泥收敛、冷色暗部和灯芯发光；只发布独立的 `/games/mining-light/`。

每次先公开发布再截图。T3 预览明确返回主机 AppArmor 限制，采用既有 Chromium / Vulkan SwiftShader 流程。完整脚本曾收到 SIGTERM（143），中断记录已保存；随后将画面和运行检查拆成两段，逐组保存报告。最终两段均完整完成，退出码均为 **0**，合计 **9 类检查通过**，页面及 GPU 错误为零。

- `artifacts/night-final/report.json`：四组同机位对照，墙/地面/背面，以及“只改材质”的对应近景；4 类检查完整完成。
- `artifacts/night-final/runtime/report.json`：重新核对四组状态，昼夜恢复、贴图/纯色切换、静止缓存、三次暖帧、AO、1920×1080；7 类检查完整完成，其中前 2 类与画面检查重叠。
- `artifacts/night-final-check.log` / `artifacts/night-final-runtime-check.log`：最终执行日志。
- `artifacts/night-final/runtime/11-clean-courtyard-both-1080.png`：最终 1080p 场景截图。
- `artifacts/night-final/review.html`：同机位滑动对照、四组切换和近景图。T3 HTML 预览返回浏览器异常退出后，用 Chromium 单独检查此报告页面，滑杆、七张切换图、图片解码和宽度均通过；记录在同目录 `review-preview-check.json`。

原版 1440×900 截图与最初 `comparison-first/01-courtyard-baseline.png` **逐像素相同**。两套 GLB、原版材质和石板贴图保持不变；两个视图分段读取了同一 bundle、模型和材质版本。源码、构建、公开 HTTP 下载与浏览器实际版本的哈希已核对，见 `artifacts/final-verification.json`。发布时其他游戏的 1,116 个文件未变；范围外的 909 个源码文件也通过了前后哈希核对。

## 视觉审看

第一版收敛降低了迷彩斑，但灰泥过平、灯罩过于均匀。Claude 第一轮指出这两点后，保留低对比底色，在法线/粗糙度中补回抹灰起伏，并为前移灯具添加中心亮、边缘暖暗的磨砂发光分布。第二轮 Claude 确认两项已闭环，没有新增阻塞；背面图未发现暖色漏光。两次意见及处理见 `artifacts/claude-night-review-r1.md`、`artifacts/claude-night-review-r2.md`。

复查时运行状态报告仍在补测，因此 Claude 没有据最终报告确认缓存和性能；这部分由主任务随后完成的 `runtime/report.json` 提供实测。近景灰泥有块状起伏，玻璃角部较暗，石板保留跨缝高光，均作为后续视觉取舍记录；没有代替用户完成审美验收。

## 软件适配器测量

同一公开构建，1440×900、DPR1、AO 开启，各测三次精确暖帧：

| 对照 | draws | passes | CPU 提交范围 | GPU render timestamp 中位数 |
| --- | ---: | ---: | ---: | ---: |
| 原版 | 34 | 6 | 1.30–1.40 ms | 3175.71 ms |
| 一起改 | 42 | 8 | 1.50–1.60 ms | 3426.70 ms |

适配器为 Google SwiftShader，不能换算成用户显卡 FPS，也没有手机或物理 GPU 验收。两组静止两秒均无新增帧；测量时方向光与点光阴影都使用缓存。focused 模式多两次半分辨率光晕模糊，关闭 AO 时仍保留灯芯光晕（21 draws / 4 passes）；阴影采样和后处理仍有运行成本。

模型常驻总计 21,954 三角形、202 个源网格、18 批，包含互斥显示的两种灯具；不是每帧都绘制两套。33 张贴图下载约 1.88 MB，RGBA 含 mip 估算 36.7 MB。灯芯用节点计算，没有新增贴图或几何。上述纹理估算不是整机显存占用。

---

# 历史：夜晚原版公开验证

2026-10-19，当前公开构建 `index-I6KiUGoj.js`，夜晚直达：[打开夜晚](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?light=night)。每轮先发布再截图；T3 browser open 明确报告主机 AppArmor 不支持自动化，改用既有 Playwright Chromium/Vulkan SwiftShader 流程。

8 组检查通过，页面/GPU 错误为零：夜晚直达、公开 bundle/资产哈希、三视角按钮、晴日/暖阳/夜晚完整状态恢复、贴图/纯色对照、静止两秒零新增绘制及阴影缓存、侧面/背面截图、1920×1080 含 UI 和纯场景截图。另完成独立源码与实际截图审看；已修复背面墙脚漏光，复查正面未出现新增阴影斑点。

1440×900、DPR1、夜晚、表面细节与接触 AO 开启，三次暖帧为 34 draws / 6 passes，CPU 提交 1.20–1.50 ms，GPU render timestamp 中位数 2612.49 ms。适配器是 Google SwiftShader，不能据此宣称用户显卡帧率达标。灯光静态时不重绘阴影立方体，但着色仍有阴影采样成本。渲染器跟踪内存计数约 114.3 MB，不是完整设备显存测量。

模型仍是 20,258 三角形、1,408,972 字节几何数组，原始模型和21张贴图资源哈希均未变。灯架的独立投影控制使合批数由12变为13；日夜两个环境各初始化一次，切换时复用。

当前源码、构建、公开 HTTP 下载与浏览器 bundle/资产 revision 一致。其他游戏的1,116个发布文件哈希保持不变，公开列表保留所有独立入口。只检查电脑端。

- `artifacts/night-public/report.json`：本轮完整检查与适配器数据。
- `artifacts/night-public/09-clean-courtyard-night-1080.png`：最终夜晚截图。
- `artifacts/final-verification.json`：当前版本一致性与统计。
- `artifacts/public-release.json`：当前公开发布与保护的其他游戏哈希。
- `artifacts/before-night/`：夜晚修改前的发布和验证记录。
- `artifacts/night-first/` / `artifacts/night-second/`：夜景调整过程。

---

# 夜晚之前的白天基线

2026-10-19，当时公开构建 `index-IJzBVtWl.js`。先发布到独立公开入口，再运行桌面检查与截图。T3 browser open 明确返回主机 AppArmor 不支持自动化，因此使用既有 Playwright Chromium/Vulkan SwiftShader 流程。

11 组检查通过，页面/GPU 错误为零：真实 WebGPU、12 材质/21 贴图与模型版本、缓存阴影/单次环境生成、静止两秒零新增绘制、三视角、晴日/暖阳与表面细节/纯色对照、同机位 AO 测量、鼠标环视、1080p、公开列表、顺序打开 DPR 1.5。补充查看侧面、背面、石板近景和门窗接缝；门窗透光缝已经修复。

同一 1440×900、DPR1、晴日、有材质全景，三次暖帧：

| SSAO | draws | passes | CPU 提交范围 | GPU render timestamp 中位数 |
| --- | ---: | ---: | ---: | ---: |
| 关闭 | 15 | 2 | 0.70–0.80 ms | 1951.32 ms |
| 开启，默认 | 32 | 6 | 1.00–1.10 ms | 2419.53 ms |

以上是软件适配器测量，不能换算成用户显卡帧率，也不证明在普通显卡上的性能达标。PBR 贴图/环境采样增加片元成本，三角形少与 draw call 少不能替代实际 GPU 测量。当前保留默认接触 AO 的视觉效果，静止停止绘制，最多一帧在途。

模型 20,258 三角形、12 个材质合批；顶点/索引数组 1,408,972 字节（不含环境、阴影、后处理与驱动内存）。21 张 PNG 共 1,077,602 字节；按 RGBA+mip 的理论纹理估算 19,922,937 字节。

源码、原始 Blender 模型、贴图、构建产物、公开 HTTP 下载与浏览器实际 bundle/资源 revision 一致。发布保护了 1,116 个其他游戏文件，包含 Mining 正式版、测试版与原松风矿谷。公开列表包含四个独立入口。

- `artifacts/public/report.json`：完整浏览器证据与适配器。
- `artifacts/public-release.json`：发布和其他游戏的逐文件哈希。
- `artifacts/asset-manifest.json`：模型、纹理、源文件追溯。
- `artifacts/final-verification.json`：最终版本一致性与统计。
- `artifacts/public/09-clean-courtyard-1080.png`：默认晴日全景。

按用户要求只做电脑端，没有手机、Safari 或物理 GPU 验收。

## 当前街景：静态柔影缓存（2026-10-20 UTC）

当前公开模块 `street-CSyQuXj_.js`。固定灯具的遮挡结果改为图集复用，保留原实时入口 `?shadows=live`；光照和材质仍实时计算。三次同环境软件 GPU 暖帧中位数 21134.15 → 8138.69 ms（减少 61.49%），不是笔记本硬件性能预测。白天三个机位及恢复路径逐像素不变，三机位夜间软影已公开对照。图集增加 64 MiB 纹理，适用于当前静态样板。

完整有效/无效测量、制作来源和实机验证边界见 [night-performance.md](night-performance.md)。
