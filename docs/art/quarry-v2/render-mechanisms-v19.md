# V19：iPhone Edge 帧率机制审计与地下阴影边界

用户实机：iPhone 13 Pro / Edge，V17 约 30 FPS，V18 关闭水面反射后约 40 FPS。用户认为没有低电量/限制帧速率，不把系统限制当作解释。以下区分已复现的代码错误、实现风险和未完成的实机归因。

## 已确认并修正

### 1. 60 Hz 调度器对时间戳波动丢帧

旧实现只允许提前 0.25 ms，又在迟到时重置 deadline。固定平均 60 Hz、时间戳交替 ±0.3 ms 的输入，100 秒只能调度约 50 FPS；±0.5/1/2 ms 也有同样问题。旧测试只使用完全均匀的时间戳。

现改为选择最接近 60 Hz deadline 的 RAF，用半周期容差避免抖动造成漏帧，真实长暂停后重新对齐而不连续补画。新增测试覆盖 ±0.3/0.5/1/2/4 ms，全部保留 60 FPS；30/40/50/59.94 Hz 输入全部保留，75/90/120/144 Hz 平均约束为 60 Hz。

这是机制错误的确定复现，不等于证明用户设备的全部 40 FPS 都由它造成。

### 2. 不再逐帧用 GPU fence 管理默认呈现

之前每帧创建 fence、下一帧查询、主动 flush；即使 GPU timeout 为零，WebKit 的 `FenceSync` / `ClientWaitSync` IPC 仍标记为 Synchronous，不能描述成无主线程等待成本。默认改为普通 RAF 调用 Three.render，由浏览器管理呈现和命令提交。原最多两帧 fence 模式只保留作显式对照。

GPU timer 的 `getParameter` / query 结果查询也会涉及同步调用。默认关闭 GPU 计时，仅 `?gpuTiming=1` 时开启；左上角明确显示未开启，不把未知耗时写成 0。

这修正了不必要的同步机制；具体减少多少 iPhone 耗时仍需实机复测。

### 3. 天空先画且禁用深度测试

旧天空是视口分辨率的程序 shader，包含多层云噪声与星空，`depthTest=false` 且 `renderOrder=-1000`，地面/建筑后面也会执行整屏天空 shader。现为最后一个不透明绘制、开启深度测试且不写深度；地面、建筑遮挡的位置可以提前深度拒绝。天空内容、分辨率和透明物件的后续绘制保持原来设置。

### 4. 错把主题区间用作地表灯光作用区间

此前 `theme.motif==='meadow'` 控制表层灯光，第一主题覆盖 0～400 m；矿块同时 `receiveShadow=true`。这使地下矿块错误地继续接收地表建筑投影。

现矿块既不接收、也不投射阴影；地表灯具组和全局阴影通道按玩家实际高度启用，地下 4 m 以下禁用。地表/地下转换独立于主题定义；地下休整层也无阴影。返回地表重新启用并刷新静态阴影。普通场景模型没有按距离隐藏/卸载，地表灯的发光装饰仍与真实光源独立。

## 已核查，未当作根因

- R3F `frameloop=never`，priority 1 回调拥有绘制；没有一套自动循环再叠一套手动循环持续渲染。
- 水面反射仍为 off，反射绘制为零。
- 天空环境立方图只在初始化捕获日夜两份，Three 的 PMREM 按 texture version 缓存；不是每帧重烘焙。
- 地表 shadow maps 关闭 autoUpdate，只在场景/模式边界更新。缓存阴影图不意味着光照/阴影采样零成本。
- 地表仍有 10 个聚光灯、2 个路灯点光源、1 个方向光及半球光；默认 forward PBR 会把可见灯纳入材质程序。7 个阴影光源的采样也仍有成本。这是后续地表烘焙/lightmap 的明确候选，不在本轮未经对照就删光源。
- 抗锯齿仍开启、DPR 上限仍 1.5；R3F 已请求 high-performance。没有偷偷降低像素、面数或缩短普通场景远景。

## 浏览器资料（2026-10-05 查询）

- MDN [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)：回调频率一般随显示刷新率，常见 60 Hz，也有 120 Hz 等。不是承诺复杂 3D 场景一定达标，但不能据此把 40 FPS 当成正常限值。
- [Edge 引擎平台资料](https://en.wikipedia.org/wiki/Microsoft_Edge)：iOS 平台列为 WebKit，桌面/Android 为 Blink。这是平台差异，不是低帧率免责。
- Apple [EU alternative engines](https://developer.apple.com/support/alternative-browser-engines/)：欧盟系统/授权条件下允许替代引擎，不能把“所有 iOS 浏览器永远同一个引擎”写成绝对规则。
- WebKit 上游 [GPU IPC](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/GPUProcess/graphics/RemoteGraphicsContextGL.messages.in)：`FenceSync`、`ClientWaitSync`、多类 Get/query 均为同步消息。该源码说明机制，不是针对用户未知版本的逐行二进制鉴定。
- MDN [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)：RAF 自带帧边界，通常不需要显式 flush；避免生产路径的同步 getParameter 等查询。
- WebKit [120 Hz tracking issue](https://bugs.webkit.org/show_bug.cgi?id=173434)：高刷新率支持存在版本/平台差异，不能用屏幕 120 Hz 直接推出网页可达 120 FPS；本项目目标仍为 60。

Google / DuckDuckGo 搜索受到无脚本页面/机器人验证阻挡；直接读取了上述资料和 WebKit 当前源代码。没有完成用户 iPhone 上的浏览器基准或声称更新后已达 60 FPS。

## 新面板与复测

左上角区分浏览器 RAF Hz、实际提交 FPS、限帧调度跳过比例、fence 等待跳帧和同步 CPU 时间。高刷新屏的正常 60Hz 限帧会产生调度跳过，因此不能把所有调度跳过都当故障。

默认公开入口为 browser submission + GPU timing off + reflection off。对照参数 `?submission=fenced&gpuTiming=1`，反射要另用 `reflection=live` 明确开启。`__miningValidation.performance({submission:'browser'|'fenced'})` 可在固定机位切换提交机制。

公开验证脚本：`tools/check-render-mechanisms.cjs`。先发布，再测试实际桌面页面；软件 GPU + 400 ms RAF 延迟只验证机制、画面与资源行为，不用于声称用户手机帧率。

证据：`artifacts/render-mechanisms-v19/`。正式 Mining 不变。

## 最终验证结果

- 当前代码 210 项测试全部通过；构建、公网文件哈希校验通过，正式 Mining 未改。
- 公开运行脚本退出码 0，页面错误 0。加载完成后连续五个实际绘制帧，`fenceSync/clientWaitSync/flush/beginQuery/getQueryParameter` 调用合计为 0。
- 地表同机位仍为 173 次绘制、282,978 三角面，与 V18 相同；画面截图保留原场景。改动重点为调度/提交和深度拒绝，不用减少内容解释收益。
- 地下约 82 m：地表灯具组关闭、方向光不投影、全局阴影关闭、体素阴影接收者/投射者均为 0。
- 400 m 休整层：阴影关闭、地表灯具组关闭，实际画面与行走落地正常。
- 返回地表：阴影和地表灯具组恢复；browser/fenced 对照切换正常；退出返回带正式/测试两个入口的列表。
- 仍未获得用户 iPhone 上新版本的帧率，因此不声称已完成 60 FPS 硬件验收。地表灯光/阴影烘焙尚未实施。
