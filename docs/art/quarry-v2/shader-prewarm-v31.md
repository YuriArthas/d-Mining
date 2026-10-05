# V31 — 首屏材质预热与 shader 整理

用户授权继续处理 shader 编译和加载阻塞。已发布到 Mining 测试版，正式入口未覆盖。

## 实现

- `MaterialPreparation.ts` 清理数学上不贡献画面的贴图路径：金属度为 0 时移除 metalnessMap；切线空间 normalScale 为 (0,0) 时移除 normalMap；AO 强度为 0 时移除 aoMap。共享 ORM 的 roughnessMap 保留，实际下载资产不变。
- 材质装饰改为幂等，复制已包装材质时沿用 shader 缓存身份，避免相同 shader 因重复包装得到不同 key。
- 保留 10 个聚光灯的数量、位置、亮度、锥角、衰减与 Three PBR 函数，将十份展开的计算改为一个 uniform 控制的循环。仍计算相同灯光贡献；这不是把每片元光源数量降为一个。当前明确只支持无阴影、无投影贴图的场地灯，若配置改变则 shader 显式报错。
- 游戏初始化时暂停空场景 3D 绘制，下载/上传不再与每帧无用的 3D 绘制争用 GPU。
- 地下九层在加载阶段分层生成，各层之间让出主线程；准备完保持常驻，未按玩家距离裁剪或卸载普通场景。
- `prepareShaders.ts` 在实际开局光照、昼夜、环境、雾、相机配置下选取首屏材质代表，并保持实例化/几何属性组合。支持 `KHR_parallel_shader_compile` 时批量 `compileAsync`；无扩展时分批提交和首次使用，避免仅调用 compileAsync 后仍在游戏首帧同步等待。
- 首次使用在默认 framebuffer 的 1×1 scissor 内完成，防止普通离屏目标改变 tone mapping / output color space，导致预热错误变体。原始几何与材质共享；临时实例缓冲释放，renderer 状态恢复。shader 失败会中止加载并显示错误。
- 预热可取消；加载中切换昼夜时，完成前重新确认最终状态。首屏准备结束后才启动游戏绘制和交互更新。

## 公开采样

前后均为服务器 Chromium + SwiftShader、960×540、公开入口。此环境不支持并行编译扩展。单次采样只用于定位机制，不代表用户 PC / iPhone 性能保证。

| 指标 | 旧版有效采样 | 最终有效采样 |
| --- | ---: | ---: |
| 启动 shader 程序数 | 33 | 29 |
| 常见标准材质片元源码 | 约 95 KB | 约 84 KB |
| getProgramInfoLog 累计等待 | 3.280s | 1.804s |
| 其中单次最长等待 | 242.5ms | 150.3ms |
| 首批游戏 RAF 回调最大 CPU 耗时 | 4168.8ms | 32.3ms |
| 全加载流程最大主线程长任务 | 约 4170ms | 318ms |
| 首次可玩（从初始化开始） | 11.001s | 8.458s |

最终预热约 3.323s（含提交、首次使用、UI 让出时间），地下场景准备约 0.779s。两者都已移出游戏首帧。启动 shader 无 USE_METALNESSMAP 的有效定义。

证据：旧版 `artifacts/startup-audit-detailed/cold.json`，最终 `artifacts/shader-prewarm-v31-batched/cold.json` 及相应 CPU profile。`shader-prewarm-v31` 是首次失败采样，包含 shader 预处理错误，**不可用于收益比较**；`shader-prewarm-v31-final` 是中间实现，随后继续解决了无并行扩展时排队过多造成的 1.27s 等待。

## 验证与剩余项

13 项针对性测试通过，覆盖贴图通道保留、缓存幂等、循环结构、并行/兼容两条预热路径、预热取消和状态恢复、已有灯光及场地回归。

`tools/check-shader-prewarm.cjs` 在公开页面通过：无页面/shader 错误，昼夜切换、深层传送和返回地表正常，十层普通场景保持常驻。已查看同相机的木台阶与火把墙面截图；去除 HUD 后 RGB 平均绝对差各通道均小于 0.04/255，未见光照变化。图片和报告位于 `artifacts/shader-prewarm-visual/`。

仍有约 318ms 的同步场景组装长任务，以及无并行扩展时单程序约 150ms 的编译等待。预热针对首屏实际变体，不保证后续第一次看到新材质/昼夜切换不再编译。并行扩展路径完成了流程测试，但当前服务器无法提供真实支持该扩展的 GPU 运行证据。

本轮未调整下载缓存策略或把逐贴图 fence 改为批量上传；这些仍是后续加载优化项。
