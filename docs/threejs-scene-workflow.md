# Three.js 场景技能与工作流程

2026-10-20 用户要求选择一套全面、合理的 Three.js skill，安装到 T3，并用于之后的场景制作。本项目选择 [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills)，固定提交 `0e181866f095b5f06d005133876e926515390d95`。

## 选择依据

这是一个包含 13 个按需加载专题的套件，覆盖场景、几何、材质、贴图、灯光、加载、动画、交互、shader、后处理、性能、React Three Fiber 与资产处理。内容明确面向 Three.js r186，与 Mining 和 light-study 当前的 `three@0.186.1` 对齐；各专题区分 WebGL 与 WebGPU/TSL。安装产物为 13 份 SKILL.md，没有运行时代码或需要自动执行的外部脚本。

相对其他候选：iulian640 更侧重 WebGPU 性能经验；linegel 的 27 项套件对高级程序化图形、image pipeline 和验证很深入，但明确不覆盖通用模型导入、灯光设计、picking/UI 等环节；dgreenheck 更侧重 TSL 实现。因此，按本次“长期场景制作、覆盖全面”的标准选择 CloudAI-X。先前对性能专题资料的推荐仍保留在 [专项调研](../light-study/docs/threejs-skills-research.md) 中。

本次核对了 13 项名称、范围及文件结构，审读了与当前任务相关的内容，并验证安装文件与固定来源一致；没有把上游 README 的全部示例验证声明当成本次独立复现。skill 是 API 与工程方法参考，不自动保证美术质量或 GPU 收益。

## T3 安装与验证

- 原始文件：`/root/.agents/skills/threejs-*/SKILL.md`，13 项。
- 标准 Claude 用户目录：`/root/.claude/skills/threejs-*`，链接到同一份文件，避免两份内容更新不一致。
- 来源、MIT 许可与文件哈希：`/root/.agents/skill-sources/cloudai-x-threejs-skills/`；项目副本见 [安装记录](tooling/threejs-skill-install.json)。上游 SKILL.md 保持原样。
- 使用内置 skill-installer 的 GitHub 安装脚本，按固定提交安装全部 `skills/threejs-*` 路径，没有安装其他候选套件。
- 调用了 T3 CodexProvider 使用的同一 `codex app-server` → `skills/list` 接口：13 项全部识别、启用，无相关解析错误。
- 直接调用 T3 的 `discoverClaudeSkills`，以 `/root/.claude` 为配置根扫描本项目：13 项全部识别、启用。自定义 Claude 配置根或其他 provider 未作发现验证。
- 下一轮消息可由技能目录发现；用户可通过 `$threejs-fundamentals`、`$threejs-lighting` 等名称显式调用。当前任务也可直接读已安装文件使用。

## 场景制作时如何使用

1. **确认当前任务和画面目标。** 先读对应阶段文档与 AGENTS.md，区分场景构图、资产、材质、光照、交互或性能问题。使用 `threejs-fundamentals` 核对相机、尺寸、坐标、renderer 与生命周期。先明确可见结果，不从通用示例重建已有工程。
2. **制作并接入资产。** 按需读取 `threejs-geometry`、`threejs-loaders`、`threejs-asset-pipeline`。资产制作继续遵守本项目 Blender/Tripo 规则，记录来源与哈希；保持造型质量。压缩、合批、实例化、边界更新须对应真实资产和实际后端，不把 WebGL 的 multi-draw 结论套到 WebGPU。
3. **建立材质和光照。** 读取 `threejs-materials`、`threejs-textures`、`threejs-lighting`，检查色彩/数据贴图区别、UV 尺度、粗糙度、环境补光和阴影。保持已认可的夜景冷暖、灯体柔影与材质响应；白天分别检查晒面、阴影补光和色调。
4. **按需增加 shader、后处理和交互。** 自定义光照读 `threejs-shaders`，输出通道读 `threejs-postprocessing`，操作与动画读 `threejs-interaction` / `threejs-animation`；只有修改 R3F 子项目时才读取 `threejs-react-three-fiber`。使用当前 renderer 对应章节，不因通用样例改成持续渲染、切换后端或增加不需要的效果。
5. **从真实成本决定优化。** 使用 `threejs-performance`。区分 CPU 提交、GPU 执行、呈现帧率、draw 数与资源字节数；固定机位、像素分辨率、DPR、场景状态和实际渲染暖帧再做对照。GPU 性能结论需要相应硬件证据，软件 GPU 数字不换算成用户笔记本收益。
6. **公开后验证场景。** 所有可试玩修改先发布用户可访问的独立测试入口，再检查画面、操作与截图。只做用户要求的电脑端验证；遵守正式/测试入口隔离。结果同时写明画面变化、验证环境和仍未证明的部分。

项目约定优先于 skill 的通用建议。尤其不能用降分辨率、砍造型或按角色距离卸载普通物体作为本轮优化达标手段；缺失依赖或错误后端必须显式定位，不能静默兜底。

## 当前矿镇街景的首次应用

已按安装后的 `threejs-performance` 的 Measure First、Draw Calls、Fill Rate、WebGPU and TSL 章节，核对当前记录并整理下一轮工作；这是任务准备，没有新增画面或实机性能结论。

- 已有实机基线：2406×1309 / DPR1，GPU 总计 6.23 ms，主通道 4.85 ms，独立法线 0.66 ms。固定同条件后再比较；19 批和 48 draws 本身不能解释主片元成本。
- 主成本先分解为灯光/BRDF、材质环境采样、双 HDR 输出与 MSAA/resolve。单项诊断必须让目标路径实际发生改变，并检查生成 shader，不能仅将灯强度设零就称其计算已移除。
- 三灯先验证范围/有效贡献跳过及合理的昼夜变体。增加灯数后才比较内置 clustered 与现有可见度的接合，并计入 compute/列表成本。
- 合批保留空间边界和正确 bounds；一般场景常驻。保留既有静止停止提交的调度，不机械照搬 skill 的连续 animation loop。
- WebGPU 使用每灯 `light.shadow.autoUpdate/needsUpdate`、`info.render.drawCalls` 与实际 GPU 时间戳。skill 的 WebGL 全局 shadowMap 示例及 WebGL 计数器不能直接用于此子项目。

下一轮实现与验收仍接续 [当前阶段文档](phase-light-study-night.md) 及 [架构审查](../light-study/docs/lighting-architecture-review.md)。
