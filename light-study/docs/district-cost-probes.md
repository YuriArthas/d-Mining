# 半分辨率光晕与街区分项对照

上一份 iPhone 报告 `8647dd1f` 的旧/新 GPU 中位数为 9.458 / 8.622 ms，P95 为 13.170 / 13.021 ms。3 通道方案仍未达到 3 / 5 ms；本轮针对滤波工作量及主绘制成本继续处理，实机收益必须由新版报告确认。

## 正常画面

- 默认 `pipeline=static`：光晕水平、垂直两方向都在半分辨率宽高的 HDR 目标执行，最终全分辨率输出只读取已经滤好的光晕。夜景 4 passes；日景保留原 AO，8 passes。
- 仍为 sigma 3、17 taps、1.5 半分辨率像素间距、0.28 强度；保持两种灯体色度、单 HDR alpha 发光编码、色调映射和输出色彩空间。
- 相比上一版全分辨率垂直滤波，该方向滤波覆盖像素约降为 1/4，多一次半分辨率写回/采样。减少计算与增加写回的净收益由实测决定，不能仅凭 4 与 3 的 pass 数判断。
- 全部 642,264 三角面、55 场景批次、材质法线/PBR、天空/月光/太阳、4× MSAA、DPR 上限 1.5 和静态逐帧绘制保持原样。
- `pipeline=fused` 是上次 iPhone 测量使用的 3 通道方案；`pipeline=reference` 仍保留最初 8 通道版本。原“查看旧管线”按钮继续指向 8 通道参考，不与本轮统计的 `baselineVariant=fused` 混淆。
- 每个后处理输出图保留独立 RenderPipeline，切换时复用已构建的输出，不再每次重建同一个 RenderPipeline 的输出材质。

## 修复两套 Node 注册表混用

原 `districtModel.ts` 从 `three/src/nodes/lighting/IrradianceNode.js` 取得运行时类，而 renderer、其他节点来自 `three/webgpu`。r186 的包入口是已打包模块，直接导入 `src` 会带入另一份 Node 基类及 ID 分配器；它们不是同一个类。

最小复现确认：包内的 π 常量与源码版第 64 个 IrradianceNode 均可得到 ID/hash `63`，NodeBuilder 的共享查询把常量错误地解析成 IrradianceNode。完整诊断顺序中出现的 `Invalid generated code, expected a "vec3"` 及部分材质恢复异常与该问题相符。单次加载或较少切换不一定触发，所以单视角截图不够。

已改用 `THREE.IrradianceNode`，所有运行时节点来自同一入口；其他 `three/src` 引用仅为 TypeScript 类型，会在构建时移除。复现脚本和实例/哈希证据见 `artifacts/district-public/half-halo-release/reproduce-node-collision.mjs`。此修复处理着色正确性和编译稳定性，不能据此断言此前的 8.6 ms 全部由它造成。新旧光晕对照两组均包含该修复，`fused` 保留上一版算法，不复现其错误的模块混用。

## 一次操作取得归因数据

性能面板“优化对照并上报（约 2 分钟）”固定当前相机，自动预热当前模式所有驻留材质，按以下顺序再倒序各测 8 秒。夜间共 12 轮、96 秒测量，另外需要准备时间。正常模式的两组结果可用于比较画面一致的优化；诊断组会暂时改变画面，仅用于量成本。

| ID | 实际变化 | 夜晚稳定 passes |
| --- | --- | ---: |
| fused | 上一版，全分辨率垂直光晕 | 3 |
| static | 本版，半分辨率双向光晕 | 4 |
| no-halo | 本版移除光晕节点，仍经最终色调映射 | 2 |
| no-environment | 本版移除环境节点及天空环境光/反射采样；背景保留 | 4 |
| no-shadow | 本版不采月光阴影，月光和其他照明保留 | 4 |
| baked-material | 本版仅保留底色贴图、烘焙灯光及发光，跳过完整材质着色 | 4 |

诊断均独立从 `static` 基线移除一项，没有把前一个诊断的缺失继续叠加。`baked-material` 是完整材质着色的下界实验，移除了实时天空/月光、法线与粗糙度纹理和 BRDF，画面不等价；不能直接作为最终低画质模式。它用显式 fragmentNode 移除计算，保留输出 alpha 的灯体编码，不让光晕随该诊断一起被隐式关闭。白天不运行该项，共 10 轮、80 秒。

阴影诊断通过 `receiveShadow=false` 移除物体的阴影采样，原值逐物体保存并恢复，光源和静态缓存保留。直接关闭灯的 `castShadow` 会让 r186 销毁 ShadowNode，造成恢复风险，本轮不采用该方式。

每轮准备后要求无新建管线，再开始持续渲染。测量帧出现新建 pipeline/program、后台切换、窗口变化、固定相机移动或设置变化时明确拒绝结果。结束和失败均恢复原管线、诊断状态、连续绘制/巡游状态与控件；开始新对照时清除旧回执，失败不残留旧成功结果。

## 上报格式与计时边界

`scene.benchmark.type = district-cost-comparison`，保留 `reference`、`optimized`、逐轮 `rounds`，新增 `baselineVariant`、`optimizedVariant` 与带 `diagnosticOnly` 标签的 `variants`。FrameContext 和环形历史保存 `materialDiagnostic`，因此不同诊断不会混在一起统计。每轮还保存实际 lighting 快照及整轮新管线检查结果。

每轮保留完整帧间隔、GPU 原始 pass 起止时间、CPU/完成时间汇总，另保留最近 1800 帧的逐帧历史。基准测量按至少 250 ms 间隔采 GPU，避免高刷新设备每 15 帧采样导致过大的报告或相邻重复采样；正常观察仍每 15 帧采样。原始分项时间在 Apple GPU 上可能重叠，不能相加当作整帧耗时，也不能把某个 pass 窗口当作关闭它的节省值。

读取命令：`node tools/read-performance-history.mjs <report.json>`，兼容旧的四轮 ABBA 和本轮正反顺序诊断。

## 验证

公开检查入口仍为 `https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html`。验证脚本 `tools/check-district-cost.cjs` 覆盖日夜三视角、实际 pass/MSAA 数、生成 WGSL 的计算移除、诊断后逐像素恢复、连续渲染、完整按钮上报及中断恢复。

桌面 Chromium/SwiftShader 用于图像、shader 和上报流程，不构成 iPhone 3 / 5 ms 验收。最终公开检查结果保存在 `artifacts/district-public/half-halo-release/`；`half-halo-r1/`、`r2/`、`r3/` 是修正前的候选证据，不能作为整套检查通过的依据。

当前公开构建 `district-B1tsrFsk.js`，完整部署包 **31 文件 / 11,228,105 字节**；没有新增场景模型或纹理。发布器校验该次发布中其他游戏的 1157 个文件未变。

完整公开按钮保存回执 `0ae019ad-cbbb-4c73-a709-cf27313bc62d`，报告体 286,576 字节，读报工具解析通过。12 轮均有有效帧与 GPU 样本，实际 passes 符合各组定义，测量期无新建管线/程序，错误为空。恢复后与测试前逐像素相同；第二次测量中改变窗口尺寸正确拒绝结果、清除旧回执并恢复管线/诊断/渲染状态与控件。软件环境每轮仅 1–4 个 GPU 样本，因此不对该报告做手机性能或稳定加速比结论。

最终构建完成日夜三视角各两管线共 12 张公开截图。`fused` 与上一版对应截图均逐像素一致；本版与 fused 的夜景平均 RGB 差为 0.01128 / 0.00363 / 0.00499（0–255），最大通道差 10 / 2 / 2；白天最大差均为 1。查看全景、街口和灯边未发现新增墙面/路面异常，变化集中于光晕过滤边缘。实际维持模型面数与 4× MSAA。

最终 WGSL 也验证了诊断的实际行为：无环境组生成的 7 个片元程序都没有 PMREM 函数，无阴影组的 7 个片元程序都没有 `textureSampleCompare`，烘焙材质组的 5 个片元程序都没有 GGX、PMREM 或阴影比较采样。完整效果恢复后逐像素相同。

一次合并图像/诊断/巡游脚本在完成全部截图、诊断和恢复检查后，巡游阶段出现 `Target page, context or browser has been closed`；页面错误记录为空，内核日志未找到相应 OOM/segfault，退出原因未确定，不能将该长脚本标记为完整通过。保留其 `views.json`，随后以新浏览器单独执行 7.5 / 15 / 22.5 秒三个巡游姿态，均为 4 passes、无错误，见 `tour.json`。汇总将已完成检查与这次中断分别记录在 `validation-summary.json`，没有用重试覆盖失败记录。
