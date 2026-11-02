# 素材许可与交付范围

按本次用户明确要求，**不收集或附带 Tripo3D、Mixamo / ROMIXAMO 的授权证明资料**。第 4 项交付范围为素材来源、制作记录、真实任务/动作标识、面数、纹理尺寸、工作文件哈希及现有开源许可证清单。此说明不新增或宣称已取得任何授权。

| 对象 | 随包记录 | 许可资料范围 |
| --- | --- | --- |
| 自制场景、商店、宠物、装备和程序纹理 | Blender 工作文件、脚本、布局、生产统计和 SHA-256 | 保留生产来源，不编造第三方任务或许可证 |
| Tripo Miner A / D | 两个实际生成任务、创建时间、配方、参考图及哈希、生成网格、绑定工作文件和运行文件哈希 | 按用户要求不附账号/套餐或商用交付权利证明 |
| ROMIXAMO 四段动作 | Idle / Walk / Run / Mine 来源名、外部 ID、转换版本、动画 ID、片段区间和本地动作数据 | 按用户要求不附 Mixamo / ROMIXAMO 授权证明 |
| Fredoka / Noto Sans / 标牌字体 | 固定上游版本、来源哈希、原始许可证 | SIL OFL 等原文与署名要求保留在 licenses/fonts |
| 运行库、解码器与构建工具 | 锁文件、DEPENDENCIES.json、原始 LICENSE / NOTICE | 保留 MIT / Apache-2.0 / BSD 等现有许可证与要求，不删除原作者信息 |
| UI、音效、程序图形 | 本地源码和实际消费者 | Canvas / Web Audio / 几何制作代码随完整源工程保留 |

具体文件和元数据见 `public/provenance/asset-inventory.json`；机器可读的交付范围见 `public/provenance/authorization-status.json`。运行时不读取外部许可网站，也不下载素材。可核验的生产来源记录与授权证明是两类资料，本次只按上述范围整理。
