# S1.9：山谷表层整体重构（已作废）

用户明确废弃本版。以下仅为历史记录；当前方向见 `phase-surface-quarry.md`，运行时不再加载 Sunvale 模型。

用户授权整套重做。旧草甸摆件布局不再作为表层生产入口，采用 `docs/art/style.md` 的山谷矿营方向。

## 场景与资产

- 连续山谷高度场、木石工坊、交易所、风车、吊架、矿车、河流与拱桥、分枝树木及弯曲草叶。出生点为平地；保留中心 16×16 米、8×8 格矿口。
- Blender 构建脚本：`tools/blender/build_valley.py`；编辑源：`assets-source/valley/sunvale.blend`；压缩模型：`assets-source/valley/sunvale.glb`；独立碰撞描述：`sunvale-collision.json`。
- 建筑和曲线在离线阶段完成细分、倒角、平滑法线与材质合并。土路使用离线软边遮罩融入地表材质，不叠加白色几何带。远山后移，村庄后侧增加树林，侧墙补齐窗框与木构。顶点色带有轻量的上下表面明暗，不宣称是光线追踪 AO。
- 不再在浏览器生成表层全部网格，也不执行旧表层启动 AO。旧版本公开诊断记录为 78,566,310 次探测、约 4451 ms AO；新表层该项为零。
- 最终模型约 193 万三角形、20 个材质批次。Meshopt GLB 为 12.57 MB，运行时加载 `src/game/assets/sunvale.glb.gz`，实际传输约 4.28 MB；浏览器先 gzip 解压再 Meshopt 解码。体量来自完整建筑、山谷和植被；模型解码和下载分别计时。普通场景始终驻留，碰撞保持独立近距离管理。

## 图像生成

- 本轮通过 imagegen 技能的 API / bundled CLI 路径，实际调用 `gpt-image-2` 生成了场景参考和草地纹理。调用成功，不是工具占位或手工替代图。
- 原始输出：`output/imagegen/sunvale-concept.png`、`output/imagegen/sunvale-meadow-albedo.png`。
- 场景参考另存到 `docs/art/references/sunvale-concept.png`；它是美术方向参考，不是游戏截图，也尚未经用户认可为最终标准。
- 完整提示词及参数：`docs/art/imagegen-prompts.jsonl`。
- `tools/blender/prepare_meadow_texture.py` 使用 Pillow 对纹理边缘做周期处理并转成 WebP；运行时贴图为 `src/game/assets/meadow-albedo.webp`，约 150 KB。GLSL 以世界坐标采样，仅影响草地色区，不把山体岩石刷绿。

## 渲染

- 天空 shader 生成蓝天、积云、太阳和地平线颜色；一次捕获到 512 立方体天空盒，再通过 PMREM 生成同源环境照明，替代与场景无关的室内反射图。
- 暖色太阳、冷色天空光、绿色地面反弹色，显式使用 Neutral tone mapping。
- 木、石、布、草、叶、水、金属分别处理粗糙度与高光。地面保持非金属哑光；植被增加背光透亮，草叶轻摆，水面有动画法线与波纹。
- 表层不使用遮挡远景的距离雾，相机远平面仍为 10000。普通景物不按玩家距离卸载。

## 模块边界与诊断

- `StaticSurface` 仅负责模型/贴图加载、材质装配与释放。
- `SurfaceAssetPlan` 提供独立碰撞和与游戏售卖坐标对齐的圆圈/标识。山坡碰撞按小块近距离启停，与视觉模型无关。
- 体素、矿物、背包和售卖规则不写入 GLB。GLB 地形必须完整留出矿井口。
- 调试 snapshot 提供资产字节数、下载时间、解码装配时间、天空捕获 CPU 提交时间、首个可玩时刻与渲染统计。首个可玩时间受浏览器和 GPU 条件影响，不能直接当真机性能结论。
- 增加 `surfaceHeight()` 用于检查实际加载的场景几何和碰撞位置；验证相机可用 `look()` 指定可重复视角。

## 验证与发布

- `npm test`：147 项通过，包括新模型碰撞的出生点、售卖中心、完整矿口及山坡法线检查。
- `npm run publish:preview` 已发布公开测试入口并逐资源核对哈希；正式 Mining 哈希保持不变。
- 首轮完整公开检查由 `tools/check-sunvale.cjs` 执行，结果保存在 `artifacts/sunvale-draco-report.json`：电脑/手机首屏、64 格入口几何留空、挖矿与自动售卖、山坡碰撞、远处场景驻留、地下返回地表和退出游戏列表均通过，运行/着色器错误为零。
- 首轮公开首屏发现山体过近、路面边缘生硬，随后进行了上述整组修正。首轮 Draco 解码装配约 9.8 秒，已改成 Meshopt + gzip，最终加载数据见最终公开检查记录。
- 最终资产补跑 7 项相关静态检查通过；新的公开画面/加载/山坡/入口检查记录在 `artifacts/sunvale-public-report.json`，待检查结束补充。
- 测试入口：https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html ，游戏列表中与正式 Mining 并列。

重建命令：`npm run art:build`（Blender 5.1、Python Pillow、固定版本 glTF Transform 4.5.1）。图像生成原稿作为输入保留；运行时不调用图像 API 或 Blender。
