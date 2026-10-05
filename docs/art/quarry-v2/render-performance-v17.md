# V17：绘制提交、重复物件与水面反射开销

目标：处理用户报告的约 55.8 万三角面、CPU 11 ms、24 FPS。先消除可证明的浪费，保留场景资产、真实平面反射和当前水面材质。

## 实现

- GPU 提交从单一未完成帧改为最多两帧。只用零超时的 fence 查询，不调用 `finish`，不无限积压；调试模式可退回一帧作对照。
- 重复不透明物件按共享 geometry、material、阴影属性和 16 m 空间分组做 InstancedMesh。329 个 Mesh 合为 124 批，新增 21,056 字节实例矩阵。不处理传送模型的动态材质、特殊地面、已有实例和自定义绘制回调。普通场景没有距离卸载。
- 三维标识原来的 ExtrudeGeometry 为每个字形轮廓创建正面/侧面 material group。按同材质重排 index，整行仅两组；保留所有顶点、三角面、法线和文字厚度。
- 两个水塘仍共享每帧最多一次、上限 1024×640 的真实平面反射。根据水面投影给反射 render target 设置 scissor，加入 3 px 波纹/滤波余量。相机近裁面穿过水面时完整捕获。没有降低分辨率或剔除场景内容。
- 左上角区分逻辑 CPU（全部模拟 tick 均值）、绘制提交 CPU（仅已提交帧均值，含反射）、GPU 主画面/反射、各通道 draw calls 和跳帧比例。三角面仍为主画面加反射总和。
- GPU 使用 `EXT_disjoint_timer_query_webgl2` 分段异步查询，主画面在反射前后分两段，查询不嵌套；每四帧采一次，最多八组在途。结果未完成不读取，disjoint 结果丢弃。不支持时明确显示不可用。

## 可公开复测

入口：<https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html>。正式 Mining 保持不变。

正常参数启用所有优化。`?debug=1&batching=0&textGroups=0&reflectionScissor=0&framesInFlight=1` 是同一公开入口的基线对照。

调试接口 `window.__miningValidation.performance({reflection:'frozen'|'live',framesInFlight:1|2})` 用于固定机位 A/B；冻结不是默认游戏行为。`snapshot().renderer` 提供分段 CPU/GPU、绘制数与队列计数；`facilities.ponds.reflectionTarget.scissorFraction` 提供实际捕获面积比例。

## 验证边界

所有运行验证都在先发布后的公开 URL，桌面 1280×720。当前工具环境没有 T3 桌面浏览器宿主，因此使用公开 URL 上的 Playwright + SwiftShader，RAF 人为放慢 400 ms，不能用于声称用户硬件已经达到 60 FPS。

204 项测试通过，包括队列上限与清理、CPU 分母、GPU 非嵌套/异步/上限/disjoint、实例世界变换、特殊物件排除、反射状态恢复、反射采样区域覆盖和真正立体字形。

中间版本只合批物件，在部分机位未达到预定的 20% draw-call 降幅，结构对照断言失败，但没有页面/着色器错误。随后定位并合并立体文字的冗余 material groups；最终结果以最终公开回归为准。

证据：`artifacts/render-performance-v17/public-report.json` 为基线和中间结果，`artifacts/render-performance-v17/final/public-report.json` 为最终结果，截图同目录。

## 最终公开对照结果

| 同机位 | 基线绘制次数 | 最终绘制次数 | 降幅 | 反射 scissor 面积占比 |
| --- | ---: | ---: | ---: | ---: |
| 出生点 | 915 | 517 | 43.5% | 2.39% |
| 两塘正面 | 524 | 354 | 32.4% | 8.77% |
| 水塘近景 | 1,295 | 495 | 61.8% | 100%（近裁面相交，完整捕获） |

最终脚本退出码 0，页面错误 0；主/反射调用数和三角面之和匹配总计，队列不超两帧，冻结时反射捕获不增加且反射调用数为零，恢复后重新捕获。启动器正式/测试入口各一个。

两塘正面三角面由 567,994 到 577,924（主画面 282,978 + 反射 294,946）。空间实例批次的剔除粒度使部分批内离屏三角形一起提交，增加约 1.7%，因此本轮收益不能表述为减面。真实场景资产数仍为 1,335；水面 target 分辨率和内存上限不变。截图比较保留地面、建筑、灯、文字和水面倒影，没有通过隐藏物件减少绘制。

冻结/恢复只在自动化浏览器会话内切换，玩家默认仍为实时反射和两帧队列。用户硬件能否稳定 60 FPS 尚未实测；新的分段 GPU/HUD 可以继续明确是主画面填充、反射还是 CPU 提交占主要成本。
