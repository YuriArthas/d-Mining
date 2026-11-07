# 松风矿谷 · Pinewind Quarry

[打开公开场景](https://w-sunjun-public.dev.clock-p.com/games/mining-surface/index.html) · [公开游戏列表](https://w-sunjun-public.dev.clock-p.com/)

独立的地表场景设计，使用 Three.js 0.186.1 和真正的 WebGPU。没有接入 Mining 的角色、存档、采矿、经济或任务逻辑。

当前方向更偏 Roblox 的厚实体与玩具比例，保留鲜绿草地、橙色与青蓝屋顶、深蓝结构边。建筑采用连续宽坡面、粗檐口和切角门窗；树冠是少量饱满大块，河岸是连续斜坡。建筑与自然模型在 Blender 中制作，小尺寸贴图只保留克制的像素点缀。画面按正常分辨率渲染，没有全屏像素后处理。

鼠标拖动环视，滚轮缩放，右键平移。底部提供全景、溪桥、矿井和宠物小院四个视角，以及晴日、暖阳两种光照。按 H 隐藏界面，右下角查看性能信息。需要支持 WebGPU 的桌面浏览器和可用图形适配器，初始化失败明确显示错误。

## 构建与公开发布

```bash
npm ci --ignore-scripts
npm run build
npm run publish
```

Blender 模型、贴图和 `.blend` 已保存，普通构建直接使用 GLB。重新制作资产：

```bash
blender -b --python tools/blender/build_architecture.py
blender -b --python tools/blender/build_nature.py
```

生成器同时更新各资产的三角面、尺寸、纹理与 SHA-256 记录。地形纹理在启动时由确定的绘制代码生成；修改地形后运行 `node tools/check-ground-assets.mjs`，核验几何、UV 与河岸接缝并更新 `artifacts/ground-asset.json` 的来源和原始 RGBA 字节哈希。没有使用 Tripo、旧游戏模型或 Decimate。

独立入口已在列表注册。发布器仅更新 `/games/mining-surface/`，公开下载核验资源哈希，同时保护其他游戏。两个 Mining 入口独立保留。GLB 请求携带构建时内容哈希，避免贴图/模型更新后仍读取旧缓存。

## 渲染与验证

- 全场景 78,925 三角面、70 个静态空间批次。共享小图集、静态空间合批；合批保留 UV、硬法线与颜色边界，不做几何减面。
- 图集近处采用最近邻，远处使用 mip 层抑制闪烁。界面与场景均正常分辨率输出，texel 固定在模型表面。
- 建筑与自然物件采用 Lambert 哑光材质，Neutral 色调映射，缓存 2048 阴影图与单次天空环境生成。
- 场景静止时不绘制，最多一帧在途；GPU timestamp 读取独立于交互提交。
- 默认关闭 SSAO；`?ao=1` 保留诊断对比。`?tone=aces` / `?tone=linear` 保留色调映射比较。
- 全场景常驻，不按距离卸载；空间批次只使用正常视锥裁剪。

先公开发布，再检查场景。T3 内置浏览器受主机 AppArmor 限制，当前使用既有 Playwright Chromium/Vulkan SwiftShader 检查公开入口：

```bash
GPU_VULKAN=1 node tools/check-public.cjs
```

公开报告和截图位于 `artifacts/public/`，发布哈希在 `artifacts/public-release.json`，源码/Blender/贴图追溯在 `artifacts/asset-manifest.json`。SwiftShader 是软件适配器，测量不能换算为用户显卡帧率。当前按用户要求只检查电脑端。

## 文件

- `tools/blender/`、`source-art/`：新模型生成脚本和 Blender 源文件。
- `public/assets/blockcraft/`：GLB 与两张 256px 像素图集。
- `src/assets.ts`：资产加载、材质和纹理采样。
- `src/landscape.ts`、`src/terrainTexture.ts`：连续河岸、矿坑地形、自然资产摆放和表面贴图。
- `src/kit.ts`：保留 UV 的静态合批。
- `src/lighting.ts`、`src/main.ts`：WebGPU 光照、镜头和按需提交。

设计修订与历次测量见 [渲染核查](docs/rendering-research.md)。上一版方块融合方案留档于 `artifacts/before-roblox-shift/`；已被用户否定的全屏像素化版本留档于 `artifacts/before-asset-pixel/`，不再代表当前方案。
