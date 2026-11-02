# 素材来源与生产记录

本次补齐可核验来源资料和精选工作文件。按用户要求不附 Tripo3D、Mixamo / ROMIXAMO 授权证明；保留真实生产来源和现有开源许可。交付范围见 `ASSET_AUTHORIZATION.md`，机器可读说明见 `public/provenance/authorization-status.json`。

`public/provenance/asset-inventory.json` 记录全部本地素材文件哈希、场景/角色/商店/宠物生产元数据、面数、贴图尺寸、生成任务与动作来源、原工作文件和交付副本哈希。该目录随构建复制到 dist；工作文件本体只在完整源码包中。

| 素材 | 生产来源 | 工作文件与记录 |
| --- | --- | --- |
| 松风矿谷建筑/自然/地形 | Blender 自制建筑和自然套件，离线 Three.js 生成地形、实例和烘焙光照；未使用 Tripo | `surface-game-art/source-art/`、`surface-game-art/tools/`、小尺寸图集、布局和 `*-asset.json`；运行建筑 18,920 面，地景 166,307 面 |
| 地下大厅、世界 2/3 基地与蛋台 | Blender 自制道具 + 离线洞壳/场景脚本 | 同一 art 目录；运行 `src/game/assets/scene/*.manifest.json` 保留每组面数、KTX2 和打包哈希 |
| Miner D | Tripo 任务 `84856ff3-6c37-4b7f-a198-5f7d00dc3443`；Blender 绑定与 A 权重转移 | 创建于 2026-10-29；11,912 面、16 骨骼、2048² 纹理；`assets-source/miner-d/`、`tools/rig-miner-d.py` |
| Miner A（D 的绑定与纹理来源之一） | Tripo 任务 `b054bf79-1490-4bf9-8774-287dd54f35f2`；Blender 绑定 | 创建于 2026-10-21；11,678 面、2048² 纹理；`assets-source/miner-a/`、`tools/rig-miner-a.py` |
| 角色四段动作 | ROMIXAMO，`ROMIXAMO_R15_SOURCE_V1`，本地重定向与片段处理 | Idle 4748、Walk 4768、Run 4472、Mine 4698；真实外部 ID、时间区间保留在角色 manifest；本地动作 JSON 随工作文件保留 |
| 商店展台与 30 套装备 | Blender 自行建模 | `assets-source/shop-showroom/`、`tools/build-shop-showroom.py`、`tools/build-equipment.py`；展台 6,700 面，贴图 128²；装备图集 256² |
| 宠物基础体 | Blender 自行建模，外观由运行代码绘制 | `assets-source/pets/pet-cube.blend`、`tools/build-pet-cube.py`；300 面，无外部贴图 |
| 字体 | Fredoka、Noto Sans，固定 Google Fonts 版本；标牌字体保留原文件许可 | `src/game/assets/fonts/manifest.json`、`licenses/fonts/`；原署名与许可证不删除 |
| UI、矿石/宠物纹理、音频 | 随工程的程序几何/Canvas/Web Audio 与本地源文件 | `src/game/presentation/`、`terrain/`、`audio/` 和 `ui/` |

全部运行 GLB、场景 bundle、字体和贴图保持先前交付资源字节，没有减面或降低分辨率。Blender 工作文件副本仅清除内部绝对路径和私有动画服务 URL；保留真实 provider、任务 ID、动作 ID、转换信息、权重和动画。清理前后哈希分别保留，不能将工作文件副本哈希冒充原始生产哈希。

普通游戏构建只消费已保留的本地运行资产，不需要重跑美术生成或访问外部服务。美术脚本和 `.blend` 用于接续编辑和来源核对；需要 Blender 5.1.2、KTX-Software 4.4.2 等另外安装的离线工具，未在本次验证完整美术重新生成流水线。`npm ci` / `npm run build` 的复现验证只针对游戏构建。
