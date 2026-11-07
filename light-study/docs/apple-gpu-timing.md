# Apple GPU：计时口径与无用附件写回

2026-10-20。公开入口：<https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html>。本轮按已安装 `threejs-performance`、`threejs-postprocessing` 的 WebGPU / TSL 章节核对 Three 0.186.1 实现，保留现有模型与光影。

## 用户实机证据

iPhone 13 Pro / Edge 截图显示 `WebGPU · apple`，实际缓冲 585 × 982、DPR 1.5，117,156 三角面 / 19 常驻批次、44 draws / 8 passes。旧 `GPU sample` 为 28.77 ms，CPU submit 为 2.00 ms；两个光晕 pass 分别为 5.56 / 5.70 ms。

发布附件调整和 `Submit → complete` 后，用户反馈后者一般为 **12 ms**。当时尚未取得同一版、同一采样帧对应的 GPU 起止时间；该反馈不能证明 28.77 → 12 ms 的性能收益，也不能将 12 ms 直接当作纯 GPU 执行耗时。后续五次实机上报见文末。

## 确认的计时问题

此前沿用 r186 `WebGPUTimestampQueryPool` 的口径，将一帧所有 render pass 的 end − start 相加。它是 pass 时长总和；只有各区间互不重叠且忽略间隙时才近似整帧跨度。

当前 WebKit 主分支 `Source/WebGPU/WebGPU/CommandEncoder.mm` 将 pass 起始索引映射到 Metal `startOfVertexSampleIndex`，结束索引映射到 `endOfFragmentSampleIndex`。这类分阶段流水执行允许区间重叠，直接相加可能重复计时。原始来源保存于 `artifacts/post-targets/webkit/`：

<https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebGPU/WebGPU/CommandEncoder.mm>

这是对当前源码的核对，未确认它与用户的具体 iOS/WebKit 构建相同；还不能认定用户截图的高读数已经由重叠解释。

## 本轮修改

- `streetProfiler.ts` 通过 r186 的 backend hook 使用独立 query pool，仅在首帧、每 15 个实际提交帧或主动请求时采样。中间帧显式清空 Three 复用描述符上的 `timestampWrites`，避免无读回时仍逐帧写查询。
- `gpuTiming.ts` 根据同一帧的原始纳秒时间戳计算 `GPU frame span = 最晚结束 − 最早开始`，同时保留 `Pass sum` 和 `overlap = 区间总和 − 区间并集`。间隙计入跨度，不能误算成负重叠；GPU 跨度也不等于独占的 GPU 忙碌时间。
- 性能栏中的 `Submit → complete` 与 GPU 读数绑定同一个采样帧并显示帧号。它从 CPU 开始编码到 `queue.onSubmittedWorkDone()` 回调计时，包含 CPU 编码、队列等待、采样帧的 query resolve/copy 和通知延迟，不包含屏幕最终呈现的测量。
- 保留 `?timing=off` 对照：不创建本项目计时 query/buffer、不写时间戳；仍可读取最新提交到完成的墙钟耗时。
- 修正 AO 横纵模糊标签，不再把纵向模糊误标成第二个 Contact AO。

渲染附件方面，默认 `post optimized` 保持主照明 4× MSAA 与双 HDR 输出，resolve 后丢弃后续不读取的多采样颜色/深度附件，并去掉全屏合成不需要的 canvas 深度。`?post=reference` 保留原附件设置。

**更正初步判断：** Three r186 已自动将 canvas 全屏 Quad 设为单采样；前后实际都是 1 sample。不能把“移除全屏 4× MSAA”算作本轮收益。有效改动是主通道多采样附件的 `store → discard` 及 canvas 深度移除。所有光晕 shader、17 次采样、半分辨率、强度和半径保持。

## 验证与边界

- `node --test light-study/tools/gpu-timing.test.mjs`：重叠、间隙、嵌套/乱序、大时间基值、零长区间及非法时间戳共五组测试通过。
- 附件修改前后，公开页 585 × 982 / DPR 1 的九组同机位日夜、AO 和恢复截图逐像素相同；拖动、resize、空闲停止提交均通过。证据为 `artifacts/post-targets/portrait/report.json` 与 `visual-comparison.json`。这里匹配的是实机截图的物理像素数，不是模拟 iPhone GPU。
- 同条件软件 GPU 三个暖帧的旧 pass-sum 中位数为 2585.87 → 2606.50 ms（约慢 0.8%），**没有证明性能改善**。不能把附件理论上减少的写回字节数换算成 Apple GPU 节省的毫秒数。
- 新计时器公开原始时间戳、实际附件描述符、采样/非采样帧与关闭计时路径检查使用 `tools/check-post-targets.cjs`，结果保存在 `artifacts/post-targets/descriptors/`。reference、optimized、timing-off 三个公开路径全部通过，退出码 0、无页面/GPU 错误或警告。直接审计原始时间戳的 span/sum/overlap 与性能栏数据一致；提交到完成绑定同帧。8 个非采样 pass 均无 timestampWrites，关闭计时后无 GPU 读数/查询。重复采样与空闲停止提交正常。三条路径的 1440 × 900 街口截图与之前公开版逐像素一致，见同目录 `visual-comparison.json`。
- 该目录 `attempt-1.json`、`attempt-2.json` 保留了验证脚本自身的错误断言：先误认为最后创建的描述符就是最终合成，后误认为旧版最终合成是 4 samples。RenderPipeline 先打开合成 encoder、后提交它；实际都是单采样。这两次不是应用/GPU 校验错误，不能作为通过证据。

最终公开街景模块为 `street-b3yFDMRn.js`；发布已逐文件核对公开 HTTP 哈希，其他 1,116 个游戏发布文件不变。

本轮仅处理独立公开样板；未改 Mining 正式/测试入口。这个发布阶段尚待 Apple 实机的新口径数据，不声明硬件性能收益。

## 11:03 UTC：五份 iPhone 实机上报

用户连续点击上报后，服务器收到五份同一构建 `street-BPXekKtl.js` 的 iPhone / Edge 报告。GPU 为 apple、实际缓冲 585×982、DPR 1.5，夜景、AO 开启、post optimized。镜头均有变化，为 44 或 48 draws / 8 passes；运行错误为空。

| 报告前缀 | GPU 跨度 ms | Pass 总和 ms | 重叠 ms | 提交到完成 ms |
|---|---:|---:|---:|---:|
| ec7eebc5 | 9.19 | 23.03 | 13.94 | 28 |
| c5a2218c | 8.71 | 22.48 | 13.85 | 14 |
| 6c52c2e2 | 9.80 | 25.75 | 16.02 | 16 |
| 31b285c3 | 7.36 | 16.47 | 9.20 | 13 |
| 1f0c8a59 | 7.96 | 20.47 | 12.57 | 15 |

五次主动采样的 GPU 跨度中位数为 **8.71 ms**，pass 总和为 22.48 ms，重叠为 13.85 ms。现在已由用户设备报告确认：这些 pass 的计时区间大量重叠，原简单求和口径确实高估整帧跨度。但旧截图的 28.77 ms 没有逐 pass 起止记录，不能精确还原那一帧的跨度；这也不是把场景从 28 ms 优化到 8 ms 的收益证明。

各报告带来的历史窗口重叠，按本组的 `(frame, startedAtMs)` 去重并检查重复记录完全一致后，得到第 43–192 帧共 **150 帧**，其中 15 帧有 GPU 时间戳：

- 提交到完成中位数 9 ms，P90 13 ms，最高 56 ms；这是按需渲染/交互过程的数据，不能换算成稳定 FPS。
- 15 个 GPU 采样的跨度中位数 7.67 ms，范围 4.45–9.80 ms。主动上报帧与拖动过程的采样分布不同，不混称同机位基准。
- CPU 提交段中位数 2 ms，P90 6 ms，最高 44 ms。第 159 帧总计 56 ms、CPU 段 44 ms，该帧没有 GPU 采样；第 180 帧 CPU 21 ms、总计 26 ms，GPU 跨度 5.73 ms。存在独立的 CPU 提交长帧，现有报告没有调用栈，不能判定是 GC、首次创建管线/资源还是驱动阻塞。
- 五个主动上报帧，从主照明结束到最后 pass 结束的间隔只有 0.47–1.07 ms。它是整个依赖链的尾段跨度，不能称为后处理的独占计算耗时；同样不能将两个光晕 pass 各 4 ms 相加成独占 8 ms。

全部 15 个采样重新从各 pass 的相对起止计算跨度、求和、区间并集，误差均小于 0.00002 ms。分析记录及源报告哈希见 `artifacts/iphone-reports/20261020-1103-analysis.json`，复现脚本 `tools/analyze-iphone-reports.py`；交互时间线在同目录 HTML。原报告仍保存在公共服务器的数据目录，未修改。

下一阶段优先分离 CPU 提交长帧，以及主照明与前置法线/AO 的整帧成本。涉及 GPU 通道的收益必须用同机位整帧 A/B 验证，不能按重叠的 pass 时长直接相加估算。本次读取与分析没有改运行时代码、画质或公开场景版本，也没有量化时间戳采样本身的成本。


## 12:28 UTC：一份完整历史报告确认首次可见材质的创建长帧

新版 Apple 报告 `5450a143-4527-402e-94d7-c74bcd1581b3` 保存 224 帧 / 17 个 GPU 样本。221 个操作帧 CPU 中位数 2 ms、P95 6 ms；14 个操作 GPU 样本跨度中位数 7.405 ms、最大 10.999 ms。两次操作期创建帧分别出现 CPU 205 ms（第一次移动）和 47 ms（第 146 帧）。后者的独占 CPU 分项为法线 28 ms、主照明 16 ms；同帧新增两条管线/两个 program，前后无新建。

按完整相机轨迹在同一公开版本重放，确认第 146 帧第一次建立 `street lantern 0` 的单采样法线与 4x MSAA 主照明管线；相同视角再次经过不重建。实机长帧与软件重放的触发机制证据分开记录。当前 street.ts 只等首帧完成即解除 loading，未准备全部材质/pass 组合，这是可针对性修复的初始化缺口；还不能把所有 47 ms 都说成驱动编译。

首帧 GPU 跨度 750 ms 中约 722 ms 为 pass 区间间隙，再次说明跨度不能当成纯 GPU 忙碌时间。首次移动还重复 19 个阴影 pass，需要准备阶段稳定后才进入交互。正常 GPU 开销仍需独立对照优化。

本轮没有修改或发布运行时代码。完整数据、审计脚本、关键帧交互图和公开重放见 `artifacts/iphone-reports/5450a143/analysis.md` 与 `analysis.json`、`replay.json`。
