# 粗石板道路材质

道路沿用现有路径、碰撞与抬高路沿。铺装布局和配色参数在 `src/game/content/roadStyle.ts`，石材图集与 shader 分别负责表面图案和受光。

## 自制资源

- 生成：`python3 tools/art/build-road-stone.py`（Pillow，固定种子）。
- 产物：`src/game/assets/ground-details/road-stone.json`；无 Tripo 任务、无新增模型。
- 256×256 RGBA 数据图集，四种变体。每种源图为 30×30 像素块面，最近邻放大，加四像素边界延展。磁盘仅保存 64×64 的不重复像素，加载时无损还原为 256×256；回归测试核对完整像素哈希。
- R：粗块面与矿物色斑；G：浅凹凸；B：积土凹槽；A：局部边缘缺损。数据纹理不进行 sRGB 解码。
- 像素数据 SHA-256：`f695cc2b91bc75dad74e4d61c519c5bbc374132f909c4aaf4daf6081784cab3f`。
- 本轮构建 JS 增加约 24.9 KB（gzip 后约 3.4 KB）；显存约 341.3 KiB（含 mipmaps），地面与路沿共用，随 SurfaceDetails 释放；不增加 draw call、阴影光源或物理对象。

颜色、浅凹凸和局部破边共用一次纹理采样。近处使用最近邻保留像素面，远处使用 mipmaps 与显式梯度减少跳变；不添加连续绿缝或细密噪声。路沿复用相同石材图案，并在根部加入积土色。

## 验证

构建与 272 项测试通过（包括共用纹理的幂等释放）。公开入口的昼夜截图与运行记录保存在 `artifacts/road-material/`；软件渲染环境的帧率不代表设备性能。
