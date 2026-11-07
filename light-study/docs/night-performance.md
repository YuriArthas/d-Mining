# 街景夜间 GPU 成本：静态柔影缓存

入口：[默认静态柔影](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html) · [原实时柔影对照](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?shadows=live)

## 问题与证据

用户笔记本 Chrome 截图显示 WebGPU / lovelace，CPU submit 1.30 ms、GPU sample 16.45 ms（frame 330），117,156 常驻三角面、19 批、48 draws / 8 passes。这是已运行后的单帧 GPU 样本，不能归因为首次加载。Three r186 的时间戳池在解析时返回上一帧各通道之和；每 15 帧采样不等于累计 15 帧。

此前只缓存了三盏灯的立方体深度图。每次移动视角，仍在每个范围内片元执行每灯 24 次遮挡搜索、最多 48 次柔影过滤。阴影生成的 draws 消失不代表阴影接收计算消失，三灯街景扩大了这笔成本。

加入 `StreetProfiler`，使用 r186 Inspector 的真实 pass UID 对应 GPU timestamp，避免把 CPU 提交时间或启动时深度图刷新当成稳定渲染成本。`night-profile-valid/report.json` 在相同软件 GPU、1440×900、DPR1、AO 开启下：实时柔影两帧 20106.03 / 20198.64 ms；硬影两帧 9271.69 / 9238.92 ms。约 96% 的柔影帧成本在主照明通道，仅改变柔影就减少约 54% 的总成本。

这里的秒级数值是 Vulkan SwiftShader 软件实现，不能换算成用户 NVIDIA GPU 的 FPS 或预计毫秒数。

## 实施

- 给现有 Blender 街景添加独立全局 `TEXCOORD_1` 图集。逐物件展开对比证明原 POSITION、NORMAL、TEXCOORD_0 完全相同；1058 源网格、117,156 三角面与全部材质保留。
- 通过已发布的 `?bakeShadow=1` 制作路由，使用同样的三灯位置、1024²立方体深度图、0.22 m 发光半径、24/48 PCSS、bias 与材质法线，生成每灯一个遮挡通道。它缓存遮挡系数，不烘焙灯色、强度、BRDF、高光、环境、AO 或发光。
- 4096² PNG，RGB 对应三灯。仅填充岛外 12px 边缘，不改覆盖 texel；线性过滤、无 mip、NoColorSpace。下载 1,838,228 bytes，GPU RGBA8 约 64 MiB，另外增加 UV1 顶点数据。原材质贴图不变。
- 街道接收面编译成图集查找，生成的街道着色器不再包含点灯立方体读取和 PCSS 循环。外部背景地面没有该图集，保留独立实时柔影接收路径；月光/太阳投影、AO、光晕继续实时计算。
- 默认使用缓存；显式 `?shadows=live` 提供原实时对照。缓存缺失/来源哈希过期会报错，不静默切回另一套结果。缓存模式的调试软/硬切换明确要求使用 live 对照。
- 性能栏显示实际 drawing-buffer 尺寸、DPR、阴影模式和逐通道计时；打开性能栏会请求一个当前视角的暖帧样本。

这是固定灯具、固定街景的样板。移动遮挡物和游戏角色尚未接入这套缓存，不能将本轮结果称为动态游戏场景验收。灯位、模型、阴影算法或法线相关输入改变时需重新制作并验证缓存。

## 无效诊断与舍弃方案

- `night-profile/` 中先关 AO 再切硬影的诊断无效：外部开关当时处于 object uniform group，普通 Standard 材质不因该值单独改变而上传，GPU 实际仍运行柔影。改为 render group 后，以 AO 保持开启的 `night-profile-valid/` 重测，并用画面差异证明切换生效。不能使用无效数据推导“PCSS 没有成本”。
- 尝试共享 depth prepass 的 `depth-reuse/`、`depth-reuse-r2/` 分别失败于 MSAA 数量和深度纹理尺寸；r3 完整路径只有约 1% 软件收益，关 AO 路径还有 WGSL 错误。方案全部移除，保留日志，不把它算成已交付优化。
- 预计算 Vogel 圆盘/背面跳过的草案未发布，已撤回。本轮结果来自复用静态遮挡，而非少量算术改写。
- 最终公开检查的首次 resize 断言读在浏览器 resize 事件之前（窗口已改，drawing buffer 仍为 1440）。修正测试为等待 drawing-buffer 尺寸更新后再 settle，接续完成缩放/拖动和 live 检查；保留 `resize-test-first-attempt.json` 与原日志。没有为通过该断言改动运行时代码。

## 复现与来源

先 `npm --prefix light-study run publish`，再 `node light-study/tools/check-street-shadow.cjs`；测试只访问公开入口，单个软件 GPU 浏览器顺序测量缓存和 live，记录暖帧、三机位、昼夜/AO/控制恢复、resize、错误与 WGSL。

资产来源：`artifacts/street-shadow-asset.json`。制作记录：`artifacts/static-shadow-bake/report.json`；原始输出 SHA-256 `16575272698848ff20a1301751fc2284c63bf58e0b517b33dc8aae3f2b7b1dbd`，最终图集 `540fec1511f163c64311d43d655aa2823ce3b0e0e25fa7f541cf2ae4a528441d`。构建校验模型、布局、材质清单、制作/加载脚本与阴影算法依赖。

最终公开桌面结果写入 `artifacts/static-shadow-final/report.json`；同机位图像比较和范围核对写入 `artifacts/static-shadow-final/verification.json`。

## 最终公开结果

同一浏览器/SwiftShader、同一最终 UV 模型、1440×900、DPR1、街口、AO/光晕开启，各预热后取三个独立帧。两版均为 48 draws / 8 passes。

| 模式 | 三次 GPU 总耗时 ms | 总耗时中位数 ms | 主照明通道中位数 ms |
| --- | ---: | ---: | ---: |
| 缓存柔影 | 8138.69 / 8132.41 / 8149.14 | 8138.69 | 7282.78 |
| 实时 PCSS | 21086.55 / 21134.15 / 21193.24 | 21134.15 | 20234.30 |

总耗时下降 **61.49%**。软件环境结果只证明该实现确实消除了大笔计算；用户截图的 16.45 ms 尚无同一笔记本更新后的实测值。

- 当前公开模块 `street-CSyQuXj_.js`，浏览器读取与本机构建、公开 HTTP 哈希一致。
- 缓存与实时三机位对照保留原有光感，阴影采样噪声随图集插值变平滑；非逐像素等价。三个机位的平均通道差/255 分别为 0.199, 0.265, 0.403。目测柱影、墙面与地面响应保留，不能替代用户视觉认可。
- 三个白天机位与 L7 逐像素一致；昼夜、AO、拖动/缩放恢复均逐像素一致；live 街口与已留档夜景逐像素一致。
- 13 个带街道材质标签的片元着色器都没有点灯深度立方体读取/PCSS；3 个保留 PCSS 的片元变体来自独立背景地面。
- 页面/GPU/WGSL 错误与警告为零。最终浏览器接续检查与独立图像/来源核对均退出 0。首次测试脚本失败及原因保留，未混称所有尝试均通过。
- Three 资源统计由先前约 179.0 MiB 增至 244.6 MiB，主要增加 64 MiB 图集与约 1.77 MiB 顶点数据。这不是驱动实际显存峰值；用静态资源换逐帧计算。
- 2,906 个范围外工作区文件不变，发布保护的 1,116 个其他游戏文件不变。Mining 正式与测试版均未覆盖。

## L12 后续优化

在用户 6.23 ms 实机反馈与架构审查之后，继续完成当前三灯街景的 shader/pass 优化；公开入口默认使用新路径，旧路径可用 `?render=reference` 对照。实现、逐项诊断及最新验证见 [street-optimization.md](street-optimization.md)。上文 L8 的旧 bundle 与测量保留为历史证据，不能当作当前发布版本。
