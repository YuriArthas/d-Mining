# 街景性能上报

用户要求将性能数据直接发给 `w-sunjun-public`，不再手抄 iPhone 性能栏数字。

## 使用

打开 <https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html>，点击“性能”→“上报性能”。按钮会补采当前视角的一帧，发送后显示“已上报 · 报告编号”。采样/发送时禁止重复点击；失败明确显示原因，可点击重试。

仅点击按钮才发送报告。打开页面、显示性能栏和拖动均不自动上报。报告包含：

- 当前构建模块 URL、Three 版本、浏览器 UA、GPU 适配器信息和计时支持/开关状态。
- 实际渲染像素数、DPR、当前帧的相机位置/目标、日夜/AO/渲染模式，以及移动灯的运行状态、时间和位置。
- 同一帧的 CPU 提交、提交到完成、GPU frame span、Pass sum、overlap 和每个 pass 的相对起止时间。
- 最近最多 1800 个实际渲染帧、模型版本、灯光设置、内存计数和运行错误。60 FPS 连续操作时约覆盖 30 秒；更低帧率覆盖更久。静止等待和上报不会清空历史，刷新页面才开启新 session。未采 GPU 的帧明确保留 null，不用旧读数填补。
- 历史每帧的 CPU 阶段、阶段标记范围外耗时、新建 pipeline/program 次数；GPU 仍只在每 15 帧及明确主动采样时测量。
- 按日夜、AO、实际分辨率、视角预设、移动灯状态和诊断配置分别汇总中位数、P95、最大值与长帧数。首次绘制、配置切换、性能栏/上报补采帧单独分组，不混入正常操作统计。动画帧标为 animation。只把首帧标为 startup；开放交互前的当前配置准备另存 warmup，不代表所有变体都已预热。

这些是客户端诊断数据，不能当作可信跑分。软件浏览器验证报告的 GPU 为 SwiftShader，不能混作用户 Apple GPU 的结果。

## 接口与存储

- 同域 `POST /api/mining-light/performance-reports`，JSON schemaVersion 3，同时接受旧 schemaVersion 1、2。
- 处理器在 `../d-game1/server/performance-reports.mjs`，由已有 `server/serve.mjs` 接入；沿用 `d-game1-test-server.service` 和 `d-game1-clockbridge.service`，未另开网站或临时进程。
- 文件位于 `/root/threejs_space/d-game1/data/mining-light-reports/<完整报告 UUID>.json`。文件包含服务端接收时间、完整报告及报告 ID；目录在 dist 外，重新发布网站不会覆盖报告，并已排除 git 跟踪。
- 先写临时文件、同步文件数据，再原子改名；完成后才返回 HTTP 201 保存回执。目录与文件分别使用 0700 / 0600，不提供公开读取或列表接口。
- 拒绝无效 JSON/字段、错误 Origin、超过 2 MiB 的请求。每分钟最多 30 次请求、最多保存 2,000 份报告；超限明确返回错误，不自动覆盖旧报告。不会记录请求 IP、Cookie 或登录凭据。

下一次用户说“已上报”时，直接读取上述目录中新报告，按服务端接收时间和浏览器/GPU 信息找到用户的 iPhone 报告。界面的八位编号是完整 UUID 前缀，可用于定位。报告中 `latestFrame` 是本次点击实际采到的帧；分析历史帧时注意区分首次编译、不同视角/日夜和是否采样。

读取新版报告：`node light-study/tools/read-performance-history.mjs /root/threejs_space/d-game1/data/mining-light-reports/<UUID>.json`。输出设备/构建、分组统计、最慢 CPU/completion 帧和新建管线帧；不要把 SwiftShader 验证报告和用户 Apple GPU 报告混在一起。

## schemaVersion 2 / 3 历史格式

- `sessionId` 在页面加载时生成，连续上报同一 ID，刷新产生新 ID；跨报告去重使用 sessionId + frame，不能只用帧号。
- `history.rows` 是全部最多 1800 帧的列式数组，列名在 `history.columns`；设置通过 `settings` 索引关联 `history.contexts`，每帧仍单独保留相机坐标，时间数字舍入至 0.001 ms。`wallSpanMs` 包含中间停顿，不能当作连续采样时长或计算 FPS。
- schema 3 在原 21 列之后追加 `movingTimeSeconds`、`lightX`、`lightY`、`lightZ`。上下文保留 `motion`，灯位和时间独立逐帧保存，不因每次移动创建新的配置组。后台校验模式、位置和列数。
- `cpuStages` 为 `[stageLabelIndex, inclusiveMs, exclusiveMs]` 数组，名称见 `history.stageLabels`。Three Inspector 调用嵌套，exclusive 已扣除子阶段；只能相加 exclusive。`cpuOutsideStagesMs` 保留标记范围之外的工作。阶段及 pipeline/program 创建计数不等于调用栈或 GPU 编译耗时；JS 计时还受浏览器精度限制。
- `history.summary` 每个配置、帧来源各一组，包含 CPU / 未采 GPU 的 CPU / completion / GPU 的 count、median、P95、max。GPU 缺测为 null，count 为 0 时统计也为 null。P95 采用 nearest rank。
- `recentFrames` 改为最多 149 条完整详情：分布在窗口内的最多 96 个 GPU 样本、正常操作最慢 CPU 和 completion 各 16 帧、最后 20 帧和首帧，重叠去重。其余帧的数值、CPU 阶段和相机仍完整保存在 rows。`latestFrame` 始终是本次点击补采的完整帧。
- 环形缓存每帧 O(1) 插入；排序、统计和列式编码只在点击时做。不自动发网络请求；移动灯运行时持续记录，暂停或关闭且相机静止时不新增帧。后台仅在落盘完成后返回成功。
- 点击上报时请求下一次可采样帧，不等待动画停止。历史导出截止该帧；有较早 GPU 读回尚未结束时，待读回结束主动安排补采，避免暂停场景无后续帧导致等待不结束。

## 验证

- `node --test ../d-game1/tools/tests/performance-reports.mjs`：六组通过，包括保存回执与文件一致、非法来源/请求、声明长度和分块超限、并发存储上限、限流、磁盘失败不返回成功。
- `node tools/check-performance-report.cjs`：发布后从公开入口实际点击。无自动上报；连续点击只写一份；浏览器请求内容与服务器文件完全一致；模拟保存失败不显示旧成功，重试成功；390×655 下按钮高度至少 44px、触摸提交成功；上报后恢复空闲不持续渲染。报告在 `artifacts/performance-report/public-check.json`。
- `artifacts/performance-report/visual-comparison.json`：1440×900 隐藏界面的街景与修改前逐像素一致。没有改模型、灯光、shader 或效果参数。
- 公开检查走 Chromium / Vulkan SwiftShader。T3 原生预览明确返回主机 AppArmor 不支持错误，使用项目已有流程；窄屏触摸检查不等于 iPhone Edge 实机验收。
- 首轮验证公开模块为 `street-BQ1mj79R.js`。随后仅修正报告字段：`timestampSupported` 读取设备能力，不与 `timing=off` 混同；最终模块 `street-BPXekKtl.js`，关闭计时的公开上报检查通过：设备支持保持 true，开关 false，GPU 数值为 null，提交到完成与帧上下文完整保存，另存 `timing-disabled.json`。

公开端到端验证写入了三份 SwiftShader 测试报告，编号前缀分别为 `e347387a`（桌面）、`891ba10c`（失败后重试）、`56a30fbe`（窄屏触摸）。最终关闭计时验证的编号见 `timing-disabled.json`；这些不是用户实机回报。


### 历史上报修订（2026-10-20）

- 10 组前端纯数据测试通过：原 GPU 算法五组，加历史容量/空闲保留、统计/null、配置/补采隔离、最慢帧与体积上限、CPU 嵌套独占归因五组。1800 帧、8 个 CPU 阶段的典型完整历史小于 1 MiB；1800 个不同分辨率配置的极端夹具仍小于 2 MiB。
- 后台八组测试通过，覆盖 schema 1 兼容、完整大历史落盘，以及损坏的上下文/阶段索引、顺序、计数、诊断字段、越界窗口拒绝。存储和失败语义沿用原实现。
- 公开版本 `street-KVJ9sFUy.js`，本轮实际公开验证记录在 `artifacts/performance-history/`；不覆盖历史版本的验收记录。
- 公开一次上报保存 77 帧、9 个 GPU 样本（含此前 72 次移动视角）；浏览器请求与落盘数据完全一致，按原始列式数据独立复算各分组中位数/P95/最大值/count/null 均通过。重复点击、失败与重试、窄屏触摸、空闲停止提交及关闭 GPU 计时路径均通过。1440×900 的场景与前版逐像素一致。
- 本轮五份 QA 报告为 SwiftShader：`8e4a413a`、`a93a3822`、`9c67f6cc`、`918bfb38`、`c49918fe`，不得混入 iPhone 性能样本。它们验证功能正确性，不证明 Apple GPU 耗时改善。

### 移动灯 schema 3 修订（2026-10-20）

- 13 组前端测试与九组服务端测试通过，包括运动时间/暂停、动态灯位不拆分配置组、导出截止帧、schema 1/2 兼容与 schema 3 校验。
- 公开最终构建 `street-BEst4ygv.js`。连续动画上报保存实际灯位与六面动态阴影；暂停场景中人为阻塞此前 GPU 读回，放行后报告仍完成；关闭 GPU 计时后动画上报正常，GPU 数值保持 null。请求体与落盘数据完全一致。
- 用实际 14 阶段运动帧扩展到 1800 帧 / 120 个 GPU 样本，完整 JSON 为 1,011,898 字节，低于 2 MiB 上限。证据在 `artifacts/moving-light/payload-size.json`。
- SwiftShader QA 报告编号前缀为 `38435e45`（动画）、`ed20e69e`（延迟读回）、`bad59ba0`（关闭计时），不属于用户实机数据。最终公开证据见 `artifacts/moving-light/verification.json`。

### 动态照明自动对照修订（2026-10-20）

新增“自动对照并上报”：先在固定夜间视角连续运动 30 秒，再对两个姿态执行正/逆顺序的关闭灯、无阴影、PCF、原 PCSS、独立阴影对照；每组预热后五帧，活动阴影每帧重新生成。最后一次上传全部结果并恢复原状态。尺寸改变或进入后台会明确中断，失败不保留过期成功；操作期间锁定控件。

仍使用 schema 3 和原服务。`scene.benchmark.motion` 保存独立动态段的 CPU/GPU/completion 统计及完整 GPU 区间；`rounds` 保存 20 组固定姿态结果与原始样本。`history.contexts` 增加 dynamicShadow、shadowGeometry、scheduler、benchmarkPhase，因此诊断不会混入原正常动画分组。最大两帧在途时，GPU readback、completion 和帧号仍独立配对。完整协议、3/5 ms 目标及当前验证范围见 [dynamic-light-optimization.md](dynamic-light-optimization.md)。
