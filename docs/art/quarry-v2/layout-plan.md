# 林地矿营：全新 Tripo 组件装配

旧表层场景完全作废。已删除旧场景模型、贴图、Blender 减面树、原始 quarry-v1 和 valley 资产目录；新组件不得引用其模型、纹理或布局。玩法矿口与售卖逻辑保持独立。

视线从平地出生点穿过中央 16×16 米矿口，左后方为矿洞门，右侧为收购棚，背后是不对称浅色岩脊；草坡和大块树冠在两侧及身后分组围合。前景布置低灌木和矿车，不用密集细叶填充。所有曲面来自 Tripo 成品，不用代码拼山、拼树。

| 组件 | 数量 | 布置 | Tripo 面数上限 |
| --- | ---: | --- | ---: |
| meadow-base | 1 | 中央平地，覆盖场景底面，材质裁出中央矿口 | 4,000 |
| mine-gate | 1 | 左后方 (-21,-13)，宽 11m | 7,000 |
| ore-pavilion | 1 | 右侧 (20,4)，宽 10m、高 7.5m，收购圆圈在前方 | 7,000 |
| rounded-ridge | 15 | 主山脊 (2,-36)，两侧近坡及四周远坡交错；单独设置高度和埋深 | 6,000 |
| terrain-slab | 2 | 出生点至矿口、矿口至收购棚的地面通路，厚度压到地平面 | 5,000 |
| crown-tree | 8 | 近景两侧、身后两组、后景两组；短干、完整树冠 | 3,000 |
| soft-shrub | 8 | 树根、建筑侧面、道路外缘 | 1,000 |
| ore-cart | 2 | 左路口及收购棚旁，宽约 3m | 3,500 |
| lantern-post | 3 | 矿口前角与服务路线转角 | 2,000 |

表中坐标为 (x,z)；准确位置、大小与独立碰撞体在 `QuarryLayout.ts`。普通场景全部常驻，渲染/碰撞分别管理。

制作规则：

- 所有模型必须有本轮的新 Tripo 任务 ID。crown-tree、rounded-ridge 与 soft-shrub 使用本轮 Image 2.5 参考图后送入 Tripo，其余为 Tripo 文生模型。
- 不再执行 Blender Decimate、网格简化或本地手工建模。仅缩放定位、贴图尺寸转换、KTX2 和 Meshopt 传输打包。
- 每张色图 512×512，法线 256×256，ORM 128×128；模型/贴图在同类实例间共享。
- 相机可见场景总面数与实例总面数分别统计；不能用文件尺寸代替运行时内存。
- 只有环境模型由 Tripo 生成；玩法体素、交互圆圈、UI 与天空光照仍属于游戏系统。

已淘汰本轮生成尝试：grass-floor 被 Tripo 分割为单独的道路；chunky-tree 仍含碎叶；north-rock-wall 仍为碎块堆叠；bush-bank 仍为尖叶簇；ridge-shoulder 的贴图带有塑料般亮斑。它们不得进入发布清单。

公开验证仅在 Mining 测试版电脑端进行。正式 Mining 不修改。


生成资料：

- [发布资源与 Tripo 任务 ID](assets.json)。每件均为新任务，原始模型保存在 `assets-source/quarry-v2/<name>/model.glb`。
- Image 2.5 Sunburst 通过 imagegen 技能的 API/CLI 路径生成参考图，Tripo 负责实际模型。
- [树提示词](references/crown-tree.txt)，图：`output/imagegen/camp-v2/crown-tree.png`。
- [岩脊提示词](references/rounded-ridge.txt)，图：`output/imagegen/camp-v2/rounded-ridge.png`。
- [灌木提示词](references/soft-shrub.txt)，图：`output/imagegen/camp-v2/soft-shrub.png`。
- 其他组件的完整文字提示词在 `tools/tripo/generate-quarry-v2.mjs` 及每件 `task.json` 中。

首轮公开检查后，草坡由等比缩放改为分别设定高度及埋深，保留天空；树冠宽度调整为 9～10m，收购棚缩至 10m。这里只调整装配变换，不改生成网格。

最终装配用 15 个新岩脊组件替换带亮斑草坡并补齐斜向边界；terrain-slab 不再作为整片地面，改作两处贴地服务通路。发布共 9 种组件、41 个实例。


验证记录：

- 全量 Node 测试 163 项通过；最后的装配调整后，资源预算与碰撞入口两项相关测试再次通过。
- 公开版本检查矿口、平地、挖矿与自动出售、普通场景常驻、地下往返及退出，通过且无页面错误。
- 41 个 Tripo 实例共 157,461 三角面；加交互圆圈/文字牌后，表层统计 157,783 三角面。出生视角 renderer 统计 125,532 三角面、50 次绘制；不作为硬件帧率证明。
- 表层共享几何 CPU 缓冲 662,084 字节；模型压缩纹理 mip 数据 4,129,488 字节；9 种模型传输 3.33 MiB。以上不是浏览器总内存。
- 发布脚本逐文件校验公开内容哈希，正式 Mining 哈希保持不变。
- 公开截图：`artifacts/camp-v2-arrival.png`、`artifacts/camp-v2-reverse.png`。这些是实际画面记录，不代表用户已经美术验收。

## 2026-10-04 细节扩充

上述 9 种/41 实例为首轮记录。当前已扩充到 **51 种独立 Tripo 模型、145 个实例**；新增 42 个采用组件，树木使用 8 张新 Image 2.5 参考图生成。见 [扩充布局](expansion-plan.md)、[最终结果](expansion-result.md) 和 [全部模型清单](assets.md)。

后续矿口施工区新增 12 个 Tripo 方木组件、33 个实例，当前总计 63 种模型 / 178 个实例。矿面同步改为粗颗粒岩层和碎矿脉，详见 [矿口施工区迭代](mine-worksite.md)。
