# Three.js / WebGPU skills 调研

调研日期：2026-10-20。任务是网上寻找并评估对 Mining 光照/性能工作的帮助。本轮只审读公开源码、文档、相关脚本与作者证据，再与项目安装的 Three.js r186 源码核对；没有安装 skill、运行外部诊断脚本、改动渲染代码或发布新版本。

## 结论

最值得参考的是 `iulian640/threejs-webgpu-skill` 的灯光架构说明、`linegel/threejs-complete-set-of-skill` 的 image-pipeline 方法，以及 `dgreenheck/webgpu-claude-skill` 的 TSL/WGSL 实现参考。它们提供了具体实现入口和测量方法，但没有已验证能让本项目 6.23 ms 降到某个目标的成品方案。

本次发现修正 L9 的实施顺序：项目 r186 已有 `DynamicLighting` 和 `ClusteredLighting`，应先检查和复用这些能力，再决定必须自写的部分。当前三灯均 `castShadow=true`，不进入两者的批处理路径；静态遮挡图集又接在 `light.shadow.shadowNode` 上，因此不能直接关闭投影或加一行配置就宣称完成优化。

## 1. iulian640/threejs-webgpu-skill

- [仓库固定版本](https://github.com/iulian640/threejs-webgpu-skill/tree/b216614add1c3c45aaa34acdb3985e248e05223f)，提交于 2026-07-15；文档以 r185 为核对版本。
- 重点来源：[lighting-shadows.md](https://github.com/iulian640/threejs-webgpu-skill/blob/b216614add1c3c45aaa34acdb3985e248e05223f/docs/lighting-shadows.md)、[performance.md](https://github.com/iulian640/threejs-webgpu-skill/blob/b216614add1c3c45aaa34acdb3985e248e05223f/docs/performance.md)、`scripts/`。
- 帮助：解释灯光展开、uniform 数组批处理、空间聚类的区别；区分 shader 编译/变体成本与持续帧耗时；指出多 pass 应按真实输出目标预编译。对定位我们三灯逐片元展开、昼夜变体和后处理成本有直接参考价值。
- 依赖：附带诊断脚本使用 Node、`puppeteer-core` 和系统 Chrome，部分图片分析可选 `pngjs`；不是自动接入项目的分析器。

必须保留的限制：

1. 作者在 performance §7 报告 35 灯场景从约 31.8 到 56.7 FPS，随后在同节明确写了 **Reverted after on-screen confirmation**：可见窗口中 clustered 为 110–120 FPS，dynamic 为 115–124 FPS，因收益中性到略负而撤回。这些均为作者报告，本轮未复现。不能只引用前半段“接近两倍”，也不采用该文开头“ratios transfer between machines”的泛化。文中对后台时钟的机制归因同样不是我们本轮独立验证的结论。
2. `scripts/lib/fps-session.js` 统计独立 RAF 回调。我们的场景静止时停止绘制，它仍可能读到屏幕刷新率；不能把该数字当实际提交帧率或 GPU 成本。应保留实际渲染提交及分 pass GPU 时间戳，并对测量本身的开销做独立对照。
3. `light-bisect.js` 顺次切换灯并读取画面亮度，没有在每次实验前恢复完整基线，也不测 GPU 成本。两次 RAF 等待不能替代本项目的渲染完成条件。可借鉴诊断接口，不能直接当每盏灯的独立成本分析。
4. 文档的“仅 SpotLight 投影、PointLight 只照亮”是其场景策略，会改变我们已认可的灯笼照射范围及柔影，不直接采用。
5. 文档给出的 `renderer.shadowMap.autoUpdate/needsUpdate` 示例不适用于当前 r186 WebGPU 阴影更新路径：实际读取的是每盏灯的 `light.shadow.autoUpdate/needsUpdate`。本项目已使用后者。

## 2. linegel/threejs-complete-set-of-skill

- [仓库固定版本](https://github.com/linegel/threejs-complete-set-of-skill/tree/e3c9563a070b214aa73b84d1ea6026c9ec4db6cb)，提交于 2026-09-24；相关文档以 r185 为基准。
- 优先读 [threejs-image-pipeline](https://github.com/linegel/threejs-complete-set-of-skill/blob/e3c9563a070b214aa73b84d1ea6026c9ec4db6cb/skills/threejs-image-pipeline/SKILL.md)。它要求逐项列清 HDR、depth、normal、emissive 等信号的写入者、读取者、物理格式、尺寸与生存期；比较 MRT 的写入/resolve/后续读取成本和重建/窄范围重绘成本，不能仅凭“少一个 pass”判断更快。
- 对我们最有用：检查双全分辨率 half-float 输出、4× MSAA、独立法线通道，以及 emissive 是否值得全屏 HDR 存储。当前主 pass 4.85 ms、法线 0.66 ms 让这些成为需要拆测的候选，尚未确定实际节省量。AO 在主照明前使用几何法线，不能忽略依赖顺序直接合并 pass。
- [threejs-scalable-real-time-shadows](https://github.com/linegel/threejs-complete-set-of-skill/blob/e3c9563a070b214aa73b84d1ea6026c9ec4db6cb/skills/threejs-scalable-real-time-shadows/SKILL.md) 主要处理方向光、CSM/clipmap、缓存失效和动态投影物一致性，更适合后续太阳和大世界；不是现有灯笼 BRDF 的直接补丁。
- 仓库含实际示例和验证产物，本轮重点审读 skill 文档、示例说明与性能声明，未完整审计或执行其 clipmap 实现。
- 性能证据明确有限：`docs/visual-validation/webgpu-shadow-architecture-bench/bundle/performance-envelope.json` 标记 `claimStatus: NOT_CLAIMED`，理由是没有具名硬件时间戳；16.67 ms 是未来目标，不是已完成测量。

## 3. dgreenheck/webgpu-claude-skill

- [仓库固定版本](https://github.com/dgreenheck/webgpu-claude-skill/tree/af2319bd01bb7cc881267a9ef42cafdaf5e9029d)，提交于 2026-04-10；README 对齐 r183+。
- [webgpu-threejs-tsl](https://github.com/dgreenheck/webgpu-claude-skill/blob/af2319bd01bb7cc881267a9ef42cafdaf5e9029d/skills/webgpu-threejs-tsl/SKILL.md) 包含 node materials、TSL 控制流、compute、post-processing、`wgslFn` 的文档和示例。
- 对我们有用：实现灯光范围判断、自定义材质函数、buffer 与 WGSL 接入时做语法/API 参考，减少混用 WebGL 与 WebGPU 接口。
- 不提供本项目可直接替换的照明架构或性能保证。较老示例必须按 r186 核对；使用 `wgslFn` 本身不保证生成的 GPU 程序更快。

## 4. 其他候选

- [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills/tree/0e181866f095b5f06d005133876e926515390d95)，提交于 2026-10-19，明确面向 r186。通用性能、灯光、shader 知识较完整，能帮助核对 renderer.info 指标、材质和资源管理。性能示例以 WebGL 为主并有 WebGPU 专节；适合作为日常参考，不能把“减 draw calls”自动当成我们主片元成本的解法。
- [cazala/webgpu-skill](https://github.com/cazala/webgpu-skill/tree/e4398058672173cf596379a816bb99fdb67c71b8)，提交于 2026-07-23。适合原生 WebGPU 的 buffer 布局、绑定、compute、同步、生命周期及 WGSL 排错。若要扩展灯数据/compute 列表有帮助，Three 集成仍需自己解决。
- [m4bwav/threewright](https://github.com/m4bwav/threewright/tree/7b3c27b4245db03ac8b667c0e175851ed46a6282)，提交于 2026-10-18，跟进 r186。包含检查、截图/差分及 shader 诊断工具；但 `scripts/lib/shaders.mjs` 对 WebGPU 仅返回说明，实际导出的是 WebGL `.vert/.frag`，不能替代现有 WGSL 捕获和 WebGPU 分通道计时。其作者评测主要验证 skill 使用/任务行为，不是 Mining 性能测试。本轮未运行 CLI 或引入其维护流程。
- [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills/tree/8286774b22a2566bf894dbc825825c16921866af)，提交于 2026-09-28。`threejs-debug-profiler` 强调固定真实场景、分类瓶颈、单项改动复测、保持画面和游戏交互，适合作为验证规范；没有现成聚类灯光实现。本轮仅审读，不复用以前其他任务的测试通过数作为新证据。

## 与当前 r186 源码核对

- `node_modules/three/examples/jsm/lighting/DynamicLighting.js`：批处理灯数据以减少 shader 展开/变体，不进行空间剔除。
- `node_modules/three/examples/jsm/tsl/lighting/DynamicLightsNode.js:36`：`canBatchLight()` 明确排除 `castShadow=true`。
- `node_modules/three/examples/jsm/lighting/ClusteredLighting.js`：现成 Forward+ 三维分区；每帧建立/更新空间灯列表，有额外 compute、buffer 和编译成本。
- `node_modules/three/examples/jsm/tsl/lighting/ClusteredLightsNode.js:219`：只有不投影的 PointLight 进入聚类路径；其他灯保留普通材质灯路径。
- 同文件 `:363`：在完整 BRDF 前用距离平方与 cutoff 比较，已有我们要验证的无贡献计算跳过机制。
- `node_modules/three/src/nodes/lighting/ShadowNode.js:800` 与 `src/renderers/common/Renderer.js:713`：WebGPU 使用每灯 shadow 更新属性，不能套用文档的全局 WebGL 风格示例。
- 项目 `light-study/src/streetLighting.ts:40`：三盏灯均投影；`staticShadow.ts:20`：静态可见度通过 shadowNode 注入。必须设计此可见度与新灯循环的接合，保留周边地面和后续动态遮挡职责。

## 建议实验顺序

1. 保持现有视觉参考，在三灯路径验证完整灯计算的范围/有效贡献跳过，和合理的昼夜变体。少灯时额外 compute 可能得不偿失，不预设 clustered 胜出。
2. 按 image-pipeline 方法拆测主通道材质/环境、附件格式与数量、MSAA/resolve、法线 pass。诊断中移除效果不等于接受该视觉结果；最终方案须保持已认可画面。
3. 扩展到 3/12/30 灯时，再比较现有路径、精简灯计算与基于引擎 ClusteredLighting 的可见度接入。分别构造灯光空间分散和高度重叠场景；统计实际像素灯数与总 GPU 成本。
4. 采用同一实机、同机位、2406×1309 / DPR1、实际渲染暖帧和分 pass 时间戳；测量开销也需隔离。软件 GPU/后台浏览器只能提供对应环境的证据，不能据此承诺用户笔记本的收益。

后续可试玩原型继续遵守先发布独立公开入口、再做桌面画面/交互验证的项目约定。本轮调研记录不改变该流程。
