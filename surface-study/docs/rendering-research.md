# Three.js r186 地表场景渲染核查

核查日期：2026-10-19。版本来自本项目父目录实际安装的 `three@0.186.1`、`@types/three@0.186.0`。本文是源码与一手示例研究，不代表公开浏览器画面或物理 GPU 性能验收。

## 真正使用 WebGPU

`WebGPURenderer` 即便指定 `forceWebGL: false`，仍安装自动 WebGL 回退。r186 已公开导出底层构件，可以明确不提供回退：

```ts
import { Renderer, WebGPUBackend, StandardNodeLibrary } from 'three/webgpu';

const options = {
  antialias: true,
  powerPreference: 'high-performance' as const,
  trackTimestamp: true,
};
const backend = new WebGPUBackend(options);
const renderer = new Renderer(backend, options);
renderer.library = new StandardNodeLibrary();
await renderer.init();
// 初始化失败应显示可读错误，不创建另一种渲染器继续假装成功。
```

`Renderer` 的 `getFallback` 默认是 null。`StandardNodeLibrary` 提供与 `WebGPURenderer` 相同的标准材质映射。发布检查还应记录 `renderer.backend.isWebGPUBackend` 和实际适配器信息；仅看类名或启动参数不能证明后台。

本地源码：

- `node_modules/three/src/Three.WebGPU.js`：三个类均为正式导出。
- `node_modules/three/src/renderers/webgpu/WebGPURenderer.js`：默认回退注入。
- `node_modules/three/src/renderers/common/Renderer.js`：init/getFallback。
- `node_modules/three/src/renderers/webgpu/WebGPUBackend.js`：requestAdapter、device、timestamp feature。

## 静态日光与环境

单一主光建立清楚的体块方向，用环境反射提供冷色阴面与粗糙材质的层次，不把环境光加到足以抹平阴影。

```ts
import { PCFShadowMap, PMREMGenerator } from 'three/webgpu';

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 2.2;
sun.shadow.normalBias = 0.025; // 起始值，依实际米制尺度/画面修正
sun.shadow.autoUpdate = false;
sun.shadow.needsUpdate = true;

// environmentScene 只含静态天空/环境构件，先完成 renderer.init()。
const generator = new PMREMGenerator(renderer);
const environmentTarget = generator.fromScene(
  environmentScene, 0.02, 0.1, 300, { size: 128 },
);
scene.environment = environmentTarget.texture;
scene.environmentIntensity = 0.45;
generator.dispose(); // 保留 environmentTarget，最终 teardown 再 dispose 它
```

- 阴影相机包围主场景的实际 caster/receiver；不为遥远背景山把同一张阴影图浪费到巨大范围。
- 阴影仅在光、caster 或阴影相机改变时重绘。相机绕静态场景旋转不用重绘这张阴影。
- r186 WebGPU 已移除 `PCFSoftShadowMap` 的过滤实现。`PCFShadowMap` 使用 5 次 Vogel 分布采样，每次有硬件 PCF，`radius` 控制半径。
- `SkyMesh` 来自 `three/addons/objects/SkyMesh.js`，其 `sunPosition`、`turbidity`、`rayleigh`、`mieCoefficient`、`mieDirectionalG`、`showSunDisc` 均为 uniform，需写 `.value`。新实现还有云噪声成本；静态天空渐变与云几何也是合理美术方案。
- 使用 SkyMesh 生成 PMREM 时可暂时 `sky.showSunDisc.value = false` 避免尖锐太阳热点，生成后恢复；可见天空和环境采样强度分别控制。
- PMREM 只在环境本身改变时生成，不能放在每帧逻辑更新里。

本地源码：`src/nodes/lighting/ShadowNode.js`、`ShadowFilterNode.js`、`src/lights/LightShadow.js`、`src/renderers/common/extras/PMREMGenerator.js`、`examples/jsm/objects/SkyMesh.js`，均相对父项目 `node_modules/three/`。

## 适度 AO：先明确代价与对象

r186 新增 `SSAONode`，带深度感知模糊，适合静态/按需渲染；GTAO 若不配去噪有可见噪点，若 `useTemporalFiltering = true` 则必须配 TRAA，并承担历史帧收敛与拖影。

```ts
import { RenderPipeline } from 'three/webgpu';
import {
  pass, mrt, normalView, builtinAOContext, screenUV,
} from 'three/tsl';
import { ssao } from 'three/addons/tsl/display/SSAONode.js';

const prePass = pass(scene, camera);
prePass.transparent = false;
prePass.setMRT(mrt({ output: normalView }));
const aoPass = ssao(
  prePass.getTextureNode('depth'), prePass.getTextureNode('output'), camera,
);
aoPass.resolutionScale = 0.5;
aoPass.radius.value = 0.7;
aoPass.intensity.value = 0.65;
aoPass.samples.value = 12;
aoPass.blurEnabled = true;

const scenePass = pass(scene, camera);
scenePass.options.samples = 4;
scenePass.contextNode = builtinAOContext(
  aoPass.getTextureNode().sample(screenUV).r,
);
const pipeline = new RenderPipeline(renderer);
pipeline.outputNode = scenePass;
// 在一次准许的渲染提交中调用 pipeline.render()。
```

这会多绘一遍场景几何，另有 AO、模糊与输出 pass。通过 `builtinAOContext` 只影响环境项，避免把太阳直射、发光体与天空一起乘黑。官方 r186 示例还展示了把 normals 编码到 unsigned-byte attachment 的带宽优化；需要同时配套 pack/unpack，不能只换纹理类型。

样例中数值只用于开始调试，必须在最终公开镜头下对照接触关系和成本。若手工/顶点遮蔽已充分表达接触关系，可以关闭运行时 AO，而不是叠加强烈黑边。

来源：

- https://github.com/mrdoob/three.js/blob/r186/examples/webgpu_postprocessing_ao.html
- `node_modules/three/examples/jsm/tsl/display/SSAONode.js`
- `node_modules/three/examples/jsm/tsl/display/GTAONode.js`
- `node_modules/three/src/renderers/common/RenderPipeline.js`

## 提交调度与真实指标

`Renderer.init()` 自己启动内部 RAF，它更新 NodeFrame；不能用私有 API 停掉它，否则 AO 的 FRAME 更新可能失效。本项目保留这个轻量更新，只在画面改变时额外预约一次应用绘制 RAF，不运行第二套持续绘制循环。隐藏标签页不提交场景；静止画面没有新的场景绘制。

`renderer.info.autoReset = false`，只在一次完整、实际获准的绘制前 `renderer.info.reset()`，绘制结束立刻复制 `info.render.drawCalls/triangles/frameCalls`。这样被跳过的内部 tick 不会清空上次的指标。`info.memory.total`、`texturesSize` 可以记录分配量，但不等于驱动所有真实显存占用。

GPU timestamp 的方法名是 `resolveTimestampsAsync('render')`，r186 没有 `getTimestampAsync`。它把 query 数据异步映射回 CPU，返回最后一帧所有 GPU render passes 的毫秒总和：

```ts
let timestampReadPending = false;
let gpuMs: number | null = null;
const hasTimestamp = renderer.hasFeature('timestamp-query');

function pollGpuTime() {
  if (!hasTimestamp || timestampReadPending) return;
  timestampReadPending = true;
  void renderer.resolveTimestampsAsync('render')
    .then(value => { if (Number.isFinite(value)) gpuMs = value; })
    .catch(reportGpuError)
    .finally(() => { timestampReadPending = false; });
}
```

不要在 RAF 中 await 它再继续绘制，不重叠发起 readback，不把 GPU 数据未到达解释为 0 ms。可每隔约 15–30 个实际提交帧读取一次，避免大量堆积 query。这个异步计时有额外提交/readback 成本，公开性能报告要写明采样开启状态。

CPU 提交时间另测 `performance.now()` 包围 `pipeline.render()`；它不能命名为 GPU 帧耗时。帧间隔、GPU pass 时间、CPU 提交时间是三个不同指标。

调度与计时分离。按在途数量约束 GPU 提交，使用 `backend.device.queue.onSubmittedWorkDone()`；最多允许 2 个在途帧可避免重负载时无限排队。fence 是异步 promise，不能同步等待，也不能把这个间隔误当作 GPU render timestamp：

```ts
let inFlight = 0;
function submitIfReady() {
  if (document.hidden || inFlight >= 2 || !needsRender()) return;
  renderer.info.reset();
  pipeline.render();
  inFlight++;
  void backend.device.queue.onSubmittedWorkDone()
    .catch(reportGpuError)
    .finally(() => { inFlight--; });
}
```

控件与输入更新不应被 GPU fence 阻塞。`renderer.waitForGPU()` 已被移除，不要采用旧教程中的调用。

本地来源：`src/renderers/common/Renderer.js`、`Animation.js`、`Info.js`、`Backend.js` 与 `src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js`。

## 当前浏览器证据边界

本机 Playwright 清单为 Chromium 153.0.8010.12，配有 `libvk_swiftshader.so` 和 `vk_swiftshader_icd.json`。Chromium WebGPU 源码明确只在 `--enable-unsafe-webgpu` 时允许 SwiftShader fallback adapter。已有软件渲染检查参数可增加这一项；以实际 adapter 和 backend 为准。

Chrome 官方 Linux headless 真实 GPU 示例使用 `--use-angle=vulkan --enable-features=Vulkan --disable-vulkan-surface --enable-unsafe-webgpu`；这些是具体环境配置，不能把加参数视作显卡加速的证据。SwiftShader 上验证的画面/API 正确性、物理 GPU 上验证的性能分别记录。

- https://developer.chrome.com/blog/supercharge-web-ai-testing
- https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc
- https://github.com/chromium/chromium/blob/main/gpu/config/gpu_switches.cc

## 本场景复核与静态缓冲实测

以下是 2026-10-19 的源码/Node 核查，不能替代最新发布版本的画面与实际 GPU 帧时间。

### 合批后的索引复用

`batchStatic` 先统一为不带索引的 position/normal/color，按材质、阴影标记及空间 cell 合并，再用 `mergeVertices(geometry, 1e-5)` 合并完整属性元组。法线或颜色不同的顶点不会合并，不做三角形简化。已合并的 geometry 保留索引，三角形统计按 `index.count / 3` 计算。

实测场景：1,870 个源 Mesh，64 个静态 batch，190,325 个静态三角形，优化前后相同。水面不计入这个静态集合。

| 阶段 | 顶点数 | 属性与索引字节数 |
| --- | ---: | ---: |
| 不重复计算共享 geometry 的源数据 | 523,814 | 22,220,180 |
| 空间合批后、索引复用前 | 570,975 | 20,555,100 |
| 索引复用后的最终静态 geometry | 219,281 | 9,036,066 |

最终静态缓冲比合批未索引版本减少 11,519,034 字节，约 56.04%。源数据含 UV/原始索引，合批中去掉了未使用的 UV/tangent，所以源阶段与最终阶段的属性集合不同。这里量的是 CPU BufferGeometry 对应的属性和索引数组，**不是整个 GPU 的显存总量**，也不是已测得的 GPU 帧时间改善；纹理、阴影、MSAA、驱动开销等均不在内。

返回值保持旧的 `sourceMeshes/batches/triangles`，新增 `geometryBuffers.sourceUnique`、`beforeWeld`、`batched`，每项含 `vertices/bytes`。检查通过：TypeScript；实际源三角形数与输出一致；所有坐标/属性/包围球有限；所有索引在范围内；计数与实际数组一致；重合位置但法线/颜色不同的测试三角形保留分离顶点。

空间划分按源物体 origin 归 cell，不是切分每个三角形。源中使用世界坐标而 origin 为零的道路与山脊会形成较大包围球；本次核查分别只有约 1,862/2,400 个三角形，不宜单凭大 bounds 引入复杂切片。主体最大的 caster batch 约 31,268 tris、64×19×59 m，近镜头下的可见提交比例才是进一步切分的依据。

### 阴影第二次初始化绘制

r186 `ShadowNode.updateShadow()` 在绘制前保存 depth texture 的 version，绘制后只有 version 没变时才清除 `shadow.needsUpdate`。`Textures.updateRenderTarget()` 初次登记尺寸和 sample count 时会设置 `depthTexture.needsUpdate`，使 version 增加。因此首次阴影绘制可能保留 needsUpdate，第二帧再绘制后才清掉。判断静态阴影缓存至少看第 3/4 帧，不能仅以第 2 帧还有阴影 pass 推断缓存失效。

早期 `lighting.snapshot().shadowUpdates` 只数手动设置 needsUpdate 的请求，不代表真实阴影 pass 次数。现已改名为 `shadowInvalidations`，另提供 `shadowNeedsUpdate`；公开检查同时验证稳定后的 pass/triangle 数。

### 计时与材质对照的解释

早期主循环先等待 `queue.onSubmittedWorkDone()`，再等待 timestamp readback 才释放提交 gate；这样 GPU 计时本身位于交互渲染的串行路径。最终实现已将两者分开：队列完成就释放绘制许可，timestamp 独立保存单个 promise 和对应帧序号。日常每 15 次实际绘制采样一次；公开测量工具调用 `draw()` 时单独等待该帧的计时完成，验证 `gpuSampleFrame === submitted`。

`?shading=diffuse` 的 Lambert 对照还改变了环境光响应：`MeshStandardNodeMaterial.setupEnvironment()` 使用 `scene.environment`，`MeshLambertNodeMaterial` 的默认环境映射只检查材质自己的 `envMap`，当前 matte 未设置。它并非完全相同间接光下的 BRDF 单变量测试；需按最终阴面层次、颜色与整体成本选择，不能仅从计时宣称等画质优化。

浏览器排障已找到具体环境原因：使用 ANGLE SwiftShader 时 compositor 的 SharedImage factory 不支持所需 WebGPU swapchain usage，造成 Dawn Instance shutdown。对齐 Vulkan compositor 后才得到真实 WebGPU SwiftShader 运行证据。`Instance dropped in popErrorScope` 是关闭后的后续错误，不应据此删除正常的 PMREM/SSAO 生命周期代码。

## 独立公开发布

首次：`npm run build && node tools/publish.mjs --launcher`。后续：`npm run publish`。

发布器只把新场景写入 `/games/mining-surface/`；`--launcher` 在临时目录单独构建 launcher，然后只更新根 `assets/` 和最后的 `index.html`。不会调用 host 的完整多游戏 build。所有其他已发布游戏文件发布前后均做 SHA-256 校验，公开下载核验记录在 `artifacts/public-release.json`。

## 首版公开测量（留档）

2026-10-19，公开构建 `index-BXlIn7Fr.js`。在 1440×900、DPR 1 的 Chromium 中，实际适配器为 `vendor: google / architecture: swiftshader`，实际 backend 为 WebGPU。以下是软件渲染上的五次暖帧，不是物理 GPU 的 FPS 预测。测量工具强制采样并核对帧号；CPU 提交与 GPU render timestamp 分别记录。

| 同一全景镜头 | 默认 AO 关闭 | AO 开启 |
| --- | ---: | ---: |
| 绘制调用 | 52 | 106 |
| Render passes | 2 | 6 |
| 每帧提交三角面（含重复 pass） | 186,746 | 373,494 |
| CPU 提交范围 | 0.90–3.40 ms | 2.10–6.70 ms |
| GPU render timestamp 中位数 | 1,096.56 ms | 1,736.95 ms |
| Three.js 跟踪的资源分配 | 59.09 MiB | 89.57 MiB |

软件适配器非常慢，不能把这些耗时换算为桌面显卡的性能结论。AO 在本构图中改善有限，却令绘制与几何遍历近乎翻倍，因此默认关闭；调试开启过 AO 的标签页可能继续持有其 render targets，关闭效果不表示这些分配立即释放。

材质选择的先前公开 A/B 位于 `artifacts/standard-profile/report.json` 和 `artifacts/diffuse-profile/report.json`，使用同一早期构建、镜头、太阳参数和 55 次绘制。Standard 的 GPU timestamp 中位数为 2,564.91 ms，Lambert 为 1,021.39 ms。这个实验包含间接光响应变化，不能称作完全等画质替换。最终选择 Lambert 哑光表面，并重新调高半球补光，以保留阴面细节；金属和水面仍使用标准材质。最终镜头、河水与索引优化已变化，应以当前构建表格作为最终测量。

最终公开检查八组通过：真实 WebGPU 初始化、暖帧阴影缓存、静止两秒零新增场景绘制、四个视角、光照与 AO 对照、真实鼠标环视、1920×1080 窗口、站点列表与两个原 Mining 入口。页面/GPU 错误为零，最后截图使用默认晴日且 AO 关闭。已人工查看全景、桥、矿井、宠物小院和暖阳画面；修正了近景树冠遮挡与镜头裁切。没有进行手机、Safari 或物理 GPU 验收。

发布器校验了 1,096 个其他游戏文件的哈希均未改变，并公开下载核对当前入口、JS、CSS 和 launcher 资源。模型、纹理生成源及构建文件的 SHA-256 记录在 `artifacts/asset-manifest.json`。

## Roblox 厚体块与轻美漫迭代

同日按用户反馈改为更清楚的对比与粗轮廓，最终公开构建 `index-8CoE3HTM.js`。没有使用 Dream Loop 或其他场景 skill。旧截图及报告保存于 `artifacts/before-bold/public/`，本次最终报告仍为 `artifacts/public/report.json`。

色彩使用清绿草地、冷蓝远山、亮橙屋顶、青蓝屋顶和深蓝结构边。雾密度保持 0.0028；调整的是色块关系、主光/补光配色及色调映射。公开相同机位比较 Neutral、ACES、Linear 后选择 Neutral，截图见 `artifacts/bold-v1/overview.png` 与 `tone-*.png`，不把单纯增加饱和度当作唯一处理。

屋檐、门窗框、桥栏、矿架和矿轮加粗；屋顶缝、桥板和矿轮辐条减少；树冠用少量完整大面，花朵变大且数量减少。线条层级由真实几何建立，无新增全屏描边或其他后处理。近景验证发现外门框加厚后遮住彩色门板，已将其后移并在最终公开图确认修复。

全场景共 169,865 三角面（静态 162,065，水 7,800），64 个静态批次。静态几何缓冲为 6,453,066 字节；几何和细线减少来自造型方向变化，不是按性能预算降低本轮模型质量。

在同样的 Chromium WebGPU / SwiftShader、1440×900、DPR 1 环境下，最终五次暖帧记录如下。GPU 时间是软件适配器的实际 render timestamp，不是物理 GPU 帧率预测。

| 同一全景镜头 | 默认 AO 关闭 | AO 开启 |
| --- | ---: | ---: |
| 绘制调用 | 52 | 106 |
| Render passes | 2 | 6 |
| 每帧提交三角面 | 159,486 | 318,974 |
| CPU 提交范围 | 0.70–2.00 ms | 1.80–4.50 ms |
| GPU render timestamp 中位数 | 1,063.25 ms | 1,674.05 ms |
| Three.js 跟踪的资源分配 | 56.53 MiB | 87.01 MiB |

最终八组公开检查通过，页面/GPU 错误为零；四个视角、光照切换、鼠标环视、1080p 和默认 Neutral/AO 关闭均已确认。源文件、构建产物、公开下载哈希与浏览器加载的 JS 一致。其他 1,096 个已发布游戏文件保持不变。没有运行手机或物理 GPU 验收。

## 轻像素迭代

用户认可上一版后提出进一步像素化。本轮保留全部配色、光照、几何与镜头，在右上角增加「原画 / 轻像素 / 强像素」。默认 2 CSS px 一格；3 CSS px 保留更明显的复古效果。三档公开同机位图见 `artifacts/pixel-compare/`；上一版原始报告和截图保存在 `artifacts/before-pixel/`。

实际使用 `PassNode` 渲染到较小纹理，`samples: 0`，min/mag 都为 `NearestFilter`，再由 `RenderPipeline` 输出到完整画布。比例为 `1 / (CSS 像素格尺寸 × renderer DPR)`；resize 重新读取 capped DPR。1440×900 的场景颜色目标分别是原画 1440×900、轻像素 720×450、强像素 480×300。像素模式减少片元采样，不改变任何模型，也不先画全分辨率再量化 UV。

`RenderPipeline` 在内部关闭 tone mapping / 输出色空间转换，最终只执行一次 `renderOutput`。没有新增全屏边缘检测、颜色量化或模糊；现有几何粗边与 Neutral 色调映射继续生效。HTML UI 在场景画布之外，文字不参与像素化。原画分支仍直接调用原来的 `renderer.render(scene, camera)`。

AO 依旧默认关闭。诊断开启时，法线/深度预通道与场景通道使用相同比例，SSAO 独立设置 `.5 * scale`，避免只降低输入而仍以全分辨率计算 AO。原画与像素颜色通道各自固定 MSAA 配置，因为 r186 在 pass setup 时赋值 samples，不能依靠编译后修改 options 切换它。使用过的诊断通道可能保留其已分配资源；这与每帧绘制成本分别记录。

源码依据：父目录 `node_modules/three/src/nodes/display/PassNode.js` 的 `updateBefore` / `setSize`；`src/renderers/common/RenderPipeline.js` 的 `render` / `_updateContext`；`examples/jsm/tsl/display/SSAONode.js` 的尺寸更新。现成 `PixelationPassNode` 还添加法线 MRT 和相邻像素边缘采样，本轮不需要这些额外效果。

公开静帧评审覆盖三档全景和两档溪桥、宠物院。2 px 在产生明显像素边缘的同时保留桥栏空隙、井架轮辐、圆窗和门把；3 px 在全景中使屋顶接缝、高光和花丛更碎，因此选择 2 px 为默认。转镜仍有低分辨率栅格的离散步进，没有引入需要持续历史帧的时域滤镜。

最终公开构建 `index-Cn3dEXh6.js`，Chromium WebGPU / SwiftShader，1440×900、DPR 1、同机位晴日、AO 关闭，每档三次暖帧：

| 档位 | 场景渲染尺寸 | CPU 提交范围 | GPU render timestamp 中位数 |
| --- | ---: | ---: | ---: |
| 原画 | 1440×900 | 1.40–2.00 ms | 1049.65 ms |
| 轻像素 | 720×450 | 0.90–1.10 ms | 240.52 ms |
| 强像素 | 480×300 | 1.00–2.00 ms | 166.16 ms |

三档均为 52 draws、2 render passes、159,486 个提交三角面；模型未变化。软件适配器上的成本降低不能换算为物理 GPU 的 FPS。最终报告 `artifacts/public/report.json` 的 11 组公开检查通过、页面/GPU 错误为零，覆盖三档 UI 切换、空闲停止、四视角、光照、AO、鼠标环视、奇数窗口、1080p、DPR 1.5 和 launcher。未运行手机检查。源文件、构建产物、公开下载与浏览器 bundle 哈希一致；1,096 个其他游戏文件未变化。

## 模型与原始贴图像素化（取代上一节后处理方案）

用户否定全屏像素化，明确要求改原始模型和贴图，随后选择 Roblox 厚实体与 Minecraft 方块/阶梯轮廓适度融合。上一节仅保留历史证据，已经不代表当前默认画面。

本轮移除了像素输出 pass、URL 档位与切换 UI。建筑、矿架、桥、蛋、自然模型均由 Blender 5.1.2 脚本重新制作，保留既定布局与颜色关系。两张 256×256 小图集由成组矩形、瓦片、木纹与岩纹绘制，没有将旧网格减面或重新输出冒充新资产。地面、河岸、矿坑、水面采用新的阶梯几何与 512² / 64² 世界 UV 像素贴图。

图集使用最近邻放大与最近邻 mip 层缩小，粗像素始终附着在物体表面；显示分辨率、文字和鼠标控制保持正常。静态合批现在保留 UV，并在位置、法线、颜色、UV 完整元组相同时才共享顶点；不能继续采用旧版直接删除 UV 的处理。资产请求包含构建时内容哈希。源码、GLB、Blender 文件、图集和生成器均有 SHA-256，构建器检查 provenance 与磁盘内容一致。

第一轮公开图见 `artifacts/blockcraft-v1/`：新建筑、门窗、树冠和贴图方向成立，但远山规则方柱像墙体、岩石同心台阶重复、蛋像层叠托盘。第二轮针对这些具体问题修正：远山由连接的宽斜面和少量短平台组成；岩石变为偏侧肩部与大断面、苔藓只保留顶部；蛋改为连续实体八边形轮廓，屋顶几何也消除自交与零面积面。没有通过新的全屏滤镜掩盖这些模型问题。

资产来源：`tools/blender/build_architecture.py`、`tools/blender/build_nature.py`、`source-art/*.blend`；资源与模型面数见 `artifacts/architecture-asset.json` / `nature-asset.json`；地形纹理原始 RGBA 字节哈希与几何验证见 `artifacts/ground-asset.json`。普通场景保持常驻，材质与空间批次共享，阴影缓存和按需提交继续使用。

最终公开构建 `index-CNgFUCyy.js`，全场景 167,346 三角面，74 个静态空间批次（67 个保留 UV 的纹理批次），水面 3,158 三角面。静态顶点/索引数组 8,201,492 字节。以下为 Chromium WebGPU / SwiftShader、1440×900、DPR 1 的三次暖帧，软件适配器数据不用于物理 GPU 帧率预测：

| SSAO | draws | passes | CPU 提交范围 | GPU render timestamp 中位数 |
| --- | ---: | ---: | ---: | ---: |
| 关闭（默认） | 61 | 2 | 0.80–3.30 ms | 1017.80 ms |
| 开启 | 124 | 6 | 2.30–3.80 ms | 1608.47 ms |

公开检查 10 组通过，页面/GPU 错误为零；四个主要视角、额外侧面与宠物馆背面、光照/AO、鼠标、1080p、DPR 1.5 和 launcher 均已检查。最终图见 `artifacts/public/09-clean-overview-1080.png`。源文件、Blender 资产、构建产物、公开下载哈希与浏览器实际模型版本一致；1,096 个其他游戏文件未变化。只检查电脑端，没有物理 GPU FPS 承诺。

## 进一步偏向 Roblox 的模型修订

用户认可上一版融合方向后要求更偏 Roblox。本轮保留布局、光照、配色与正常分辨率，修改原始几何和贴图：屋顶采用连续宽坡面与粗深色檐口，门窗改为切角框，矿轮改为十二边粗轮圈与六根辐条，桥恢复浅拱宽板。树冠由阶梯块改为少量饱满削角体，松树使用三层完整锥面。图集与草地减少碎纹，保留低对比像素点缀。

河岸由真实连续斜面、草皮倒角和共享边界构成，草地沿边界裁切；道路嵌入地面几何，不叠加共面覆盖层。矿坑改为宽阔的十六边台阶。`tools/check-ground-assets.mjs` 检查实际 Float32 几何：无反面、退化面或坍缩 UV；344 条河岸边界全部连续，最大高度差约 8.09e-7 m。模型面数变化来自本轮重新设计，未用 Decimate 或按性能预算削减造型。

建筑源资产 9,812 三角面、537 个部件、1,050,084 字节 GLB；自然库 1,812 三角面、124,596 字节 GLB。两张 256² 图集、Blender 源文件和生成器哈希均已记录。上一版完整源文件、资源和公开截图保存在 `artifacts/before-roblox-shift/`，第一轮公开截图为 `artifacts/roblox-v1/`。

最终公开构建 `index-BTJ9oEce.js`。场景共 78,925 三角面（静态 78,753，水面 172），70 个静态空间批次，其中 63 个保留纹理 UV；静态属性与索引数组 5,401,190 字节。缓存阴影、常驻场景、按需提交、最多一帧在途继续保留。以下是 Chromium WebGPU / SwiftShader、1440×900、DPR 1、同一全景的三次暖帧；软件适配器时间不能换算成用户显卡 FPS。

| SSAO | draws | passes | CPU 提交范围 | GPU render timestamp 中位数 |
| --- | ---: | ---: | ---: | ---: |
| 关闭（默认） | 59 | 2 | 1.20–3.30 ms | 866.88 ms |
| 开启 | 120 | 6 | 2.40–3.60 ms | 1361.06 ms |

10 组公开检查全部通过，页面/GPU 错误为零。人工查看了全景、桥、矿井、宠物馆、额外侧面与背面，独立静帧评审未发现需要返工的可见缺陷。鼠标环视、光照/AO、静止零绘制、1080p、DPR 1.5 与公开列表均通过。源码、Blender 资源、构建产物、公开下载和浏览器实际版本一致，1,096 个其他游戏文件保持原哈希。汇总为 `artifacts/roblox-final-verification.json`，最终截图为 `artifacts/public/09-clean-overview-1080.png`。只做电脑端检查，未作物理 GPU 帧率验收。
