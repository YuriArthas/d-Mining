# 松风矿街 · 光照材质样板

[打开公开街景](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html) · [保留的小院对照](https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?scene=courtyard&light=night&study=both&view=wall) · [公开列表](https://w-sunjun-public.dev.clock-p.com/)

默认入口现在是一段 33.6 米长的矿镇街景。六间新建店铺、街尾钟门、石板路、长椅、木桶和三盏路灯，沿用已认可的暖灯、冷色暗部、石材与粉刷墙，以及随遮挡距离展开的柔影。底部提供街口、街中、灯下机位和昼夜切换；拖动环视、滚轮靠近、右键平移，H 隐藏界面。模型全部常驻。

街景与小院都属于独立 WebGPU 美术样板，尚未接入 Mining 游戏逻辑。街景资产与验证记录见 [street.md](docs/street.md)。小院历史参数与对照继续保留如下。

独立 Three.js 0.186.1 + WebGPU 场景，重点研究方向光与石板、粉刷墙、木材的相互作用。保留粗厚简洁的游戏造型；未接入 Mining 游戏逻辑。原松风矿谷与正式/测试 Mining 入口独立保留。

鼠标拖动环视、滚轮靠近、右键平移。底部提供小院、石板、墙角三个视角；晴日/暖阳/夜晚切换光源与冷暖关系；表面细节/纯色对照在相同模型、镜头、光照下切换纹理与表面起伏。另有原版 / 只改光 / 只改材质 / 一起改四组夜景对照，切换不移动镜头。H 隐藏界面，性能按钮显示当前渲染计数。

## 制作与构建

```bash
npm ci --ignore-scripts
npm run build
npm run publish
```

首次发布并注册列表用 `npm run publish:first`。发布器仅替换 `/games/mining-light/`，对其他游戏逐文件校验哈希，公共 HTTP 下载也逐文件核验。

```bash
blender -b --python tools/blender/build_street.py
blender -b --python tools/blender/build_courtyard.py
blender -b --python tools/blender/build_focused_lantern.py
python tools/build-materials.py
```

贴图脚本需要 NumPy 与 Pillow。原始小院 Blender 几何共 20,258 三角面、186 个源网格；前移灯架另有 1,696 三角面、16 个源网格。两种灯具都常驻，按对照状态切换可见性。真实石板缝、倒角、门窗洞口和墙角提供大尺度形体；纹理只补充材质起伏，不烘焙方向光或假砖缝。原始 Blend、脚本、GLB、面数与资源哈希在 `source-art/`、`tools/`、`artifacts/courtyard-asset.json` 和 `artifacts/focused-lantern-asset.json`。

原版有 21 张贴图：石灰石、砂岩、蓝墙、米白墙各为 512² 的底色/法线/粗糙度；木头、漆木、陶土使用 256²。改进材质为前四种表面另做 12 张 512² 贴图，两组共享其余资源，总计常驻 33 张、下载约 1.88 MB，RGBA 含 mip 估算 36.7 MB；这不代表整个渲染器显存占用。1 UV 单位对应 1 米，法线来自以米计量的高度变化。底色为 sRGB，法线/粗糙度为非颜色数据；线性采样、mip 与 4× anisotropy 保持斜视稳定。

所有资产为本项目新制作，没有使用参考作品的付费源码或资产，没有使用 Tripo 或 Decimate。模型与纹理 URL 携带内容哈希，构建验证源记录与磁盘哈希一致。

## 光照与性能

- 单一方向光承担日光/月光，昼夜各保留一张初始化生成的半浮点天空环境；切换不重建 PMREM，没有叠加另一套半球灯。晴日与暖阳保留冷色环境填充；夜晚用较弱冷月光与暖壁灯照出表面。
- 2048² PCF 方向光阴影紧密包围小院，灯笼使用 1024² × 6 面的点光源阴影。场景和光源不动时缓存，两种天空也复用；切换模式只更新变化的阴影。点光源仍有逐像素阴影采样成本，不能把缓存视为零开销。
- 为近似灯罩的面状漫射，金属灯框不向自身壁灯投出放大的硬条纹；它仍向月光/日光投影。墙、门窗、长椅、盆栽保留壁灯投影。玻璃发光强度随昼夜切换。
- 默认接触 SSAO 使用几何法线、半分辨率和 12 samples，通过 `builtinAOContext` 只影响间接光，保留直射光亮度。可用 `?ao=0` 作成本对照。
- Native resolution，DPR 上限 1.5，使用 Neutral tone mapping。“只改光 / 一起改”给可见灯芯添加小范围光晕：深度测试后的 emissive 附件，经半分辨率横纵两次 Gaussian blur 合成。墙、地面和反光不参与发光；关闭 AO 仍保留灯芯光晕。原版/白天不叠加光晕。没有像素化、景深或全屏颜色滤镜。
- 静止不提交新场景帧，最多一帧在途；时间戳回读不阻塞输入。所有模型常驻，没有按距离卸载。

`?view=wall` / `?view=ground`、`?light=golden` / `?light=night`、`?study=baseline|light|material|both`、`?detail=0` 可直接定位对照状态。只有 WebGPU 实现，适配器不可用或资产错误会明确报错。

## 公开验证

先发布公开，再检查画面。T3 预览受主机 AppArmor 限制，本轮使用现有 Playwright Chromium/Vulkan SwiftShader 流程：

```bash
GPU_VULKAN=1 EXTRA_VIEWS=1 node tools/check-public.cjs
GPU_VULKAN=1 node tools/check-night.cjs
GPU_VULKAN=1 QUICK_ONLY=1 ARTIFACT_DIR=../artifacts/night-final node tools/check-comparison.cjs
GPU_VULKAN=1 RUNTIME_ONLY=1 ARTIFACT_DIR=../artifacts/night-final/runtime node tools/check-comparison.cjs
```

`QUICK_ONLY=1` 保存四组与近景/背面图；`RUNTIME_ONLY=1` 检查昼夜恢复、材质切换、静止缓存、AO 和 1080p。慢软件适配器分两段运行，使用独立目录；每组断言通过后保存报告，只有全段完成才写 `completedAt`，被终止的运行不能算完成。当前有限尺寸灯影见 `artifacts/soft-shadow-final/`；L1–L4 四组对照见 `artifacts/night-final/`，来源见 `artifacts/asset-manifest.json`，发布见 `artifacts/public-release.json`。历史白天基线见 `artifacts/before-night/public/report.json`，历史夜晚原版见 `artifacts/night-public/report.json`。软件适配器测量不代表物理 GPU FPS。按用户要求只检查电脑端。

灯体尺寸软影的公开专项检查分两段运行：

```bash
ARTIFACT_DIR=../artifacts/soft-shadow-final node tools/check-lamp-shadow.cjs
RUNTIME_ONLY=1 ARTIFACT_DIR=../artifacts/soft-shadow-final/runtime node tools/check-lamp-shadow.cjs
python3 tools/verify-lamp-shadow.py
```

`window.__lightStudy.softShadows(false/true)` 仅供同灯同机位采样成本与截图比较；默认开启，只作用于 focused 夜景。交互页面不增加技术选项。
