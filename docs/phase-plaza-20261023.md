# 广场重排 · 水花 · 河尽头（2026-10-23）

用户要求：走进河水有水花；出售和商店换位；商店拆成镐子、背包两座房子；扭蛋机放到宠物屋位置，宠物屋不要（或改背包）；排行榜不要；河流尽头放简单的树。

## 阶段

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| A 水花 | 河里每一步踩出水滴和一圈涟漪；跳进水里大水花；刚踏进水里一下中水花。只在水面以下触发（与水声同一判断）。 | 完成 181c029 |
| B 广场 | 出售挪到东北（原商店位）；西侧并排两座店：铁匠铺卖镐子（原 Copper_Forge），背包店（原宠物屋改造，去掉蛋巢和蛋徽，换成背包徽和货架）；扭蛋机放到原宠物屋位置，面向通往蛋台的小路；去掉 PETS 浮字、排行榜模型/画布/碰撞/存档字段。背包店的圈直接打开背包页，镐子店打开工具页。 | 完成 |
| C 河尽头 | 西边峡谷里河流出谷处种几排简单树（粗干大冠，现有 tree_oak / tree_pine），挡住看到天空的缺口；东北端已被崖壁挡住，只补少量。 | 待做 |

每阶段：发布 mining-surface-play → 电脑端截图检查 → 提交。

## 决定

- 背包店用宠物屋的造型改造（用户允许"改成背包"），不新建第三种建筑；宠物屋原位置让给扭蛋机。
- 房顶浮字沿用英文：SELL / PICKAXE / BACKPACK。
- 旧存档里的排行榜数据读取时忽略，不报错。

## 资产记录（阶段 B）

- 背包店（Pack_Shop）与背包道具：Blender 自制，脚本 `surface-game-art/tools/blender/build_architecture.py`，源文件 `surface-game-art/source-art/architecture.blend`；无 Tripo，无 Decimate。
- 建筑合集 `architecture.glb`：17684 三角形，贴图 `architecture-atlas.png` 256×256（新增 1 格红色屋顶，图集 64 格已满）。
- 哈希：architecture.glb `90f7960a4b7354a974c5d1a5ed78d8f0c67846d4cfd9fa40bcb87923badd9e85`，atlas `933711b4d91e1bd7d3d8604f3a6a293824a11fe6acb5a1dcb6b44a2bb027dace`；其余见 `surface-game-art/provenance.json`。
- 去掉：Challenge_Board（排行榜）模型、宠物屋蛋巢与蛋徽、PETS 浮字。
