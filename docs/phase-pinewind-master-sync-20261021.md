# 松风矿谷：再次同步 master 工作目录

用户要求“再合 mian 的”。按此前明确选择的基线，将 `/root/threejs_space/d-Mining` 的 **master 主工作目录（包含未提交进展）同步到当前 worktree**；没有反向合回主工作目录。

## 基线与可恢复记录

源和目标的提交均为 `25c23697a46c386d75609b3e6456e190722e119f`。以首次分出时的 `artifacts/master-baseline/manifest.json`（2026-10-21 14:07:03 UTC）为共同基线，逐文件比较源和目标，捕获 2026-10-21 16:05:29 UTC 的主工作目录增量。

[同步清单](../artifacts/master-sync-20261021T160529Z/manifest.json) 记录 21 个文件、原始/目标/主线 SHA256、零冲突。`before.tar.gz` 保存覆盖前内容，`incoming.tar.gz` 保存主线输入；同目录保留完整主线文件清单与执行脚本。捕获及同步时核对源目录、两边 Git index 均未改动，目标中不属于本次同步的文件未变。首次 master 基线记录保持独立，没有用本次增量覆盖。

这是对未提交工作目录的三方同步，没有新增 Git merge commit，也没有提交、推送或修改主工作目录。

## 本次同步内容与架构边界

- 矿工脚部方向、膝关节位置和动作修正：角色 GLB、Blender 源文件、绑定脚本、RAB 挖矿动作、资源清单和角色文档。
- 基础镐：Blender 源文件、生成脚本、64×64 图集、456 三角面 GLB 与清单。挂载到角色 `RightHand`。
- `MinerMiningLayer` 将挖矿动作应用到上身，腿部继续使用原来的行走/跑步动作；`MinerAvatar` 接入镐和动作层。
- `MiningInteraction` 仅在原 `session.hit` 返回有实际伤害的成功命中后提供挥镐信号；`updateGame` 把信号交给角色，并在暂停时取消动作。伤害、冷却、库存结算仍由原有玩法层管理。
- 同步主线对应的资产/动作测试和浏览器脚本。本轮公开验收另写手机触控脚本，没有运行桌面脚本作为手机验收。

松风矿谷场景、手机横屏 HUD、触控提示、长按选字保护和弹窗关闭防穿透均保留。此次未改场景装配、控制器、存档和经济实现；运行时变化仅为上述主线已有的动作信号接入。全部 21 个输入文件均保持捕获主线的原始字节，见 [同步后核对](../artifacts/master-sync-20261021T160529Z/post-validation-source-integrity.json)。

## 发布与检查

构建/类型检查通过。10 项角色资产与动作单元测试通过，覆盖脚底方向、膝轴、完整骨骼权重、动作循环、变形尺度、挥镐位移、保持腿部动作及只响应真实命中；这些属于静态/CPU 证据，不作为手机体验证明。日志保存在同步证据目录。

已先发布至 [独立公开试玩入口](https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html)，再进行手机浏览器检查。[发布记录](../artifacts/pinewind-master-sync-release.json) 包含公网哈希核对，以及其他游戏未变的保护记录。正式 Mining、mining-test、mining-surface 对照和其他入口未被覆盖。

手机检查使用 `tools/check-master-sync-mobile.cjs`，Android UA、触控、横屏 844×390 / 640×320、Chromium/SwiftShader。T3 浏览器的 AppArmor 阻止和设备工具关闭情况已在此前手机记录中确认，因此继续仓库的 Playwright 公网验证流程。这不是实体手机、Safari 或真实 GPU 性能证明。

首次检查的报告及截图保留于 `artifacts/pinewind-master-sync-mobile/`。资产哈希、布局、摇杆、长按采矿和实际命中对应挥镐已通过；接续双指场景时脚本仍假定原地表，未适应前一步挖低的地形，导致目标查找断言失败。只修正测试脚本，按角色当前深度寻找可达矿块，未修改游戏来适配测试。

最终 [手机复查报告](../artifacts/pinewind-master-sync-mobile-r2/report.json) 的 7 组检查通过，页面/console 错误为空：

- 公网响应的角色和镐 SHA256 与同步后的资源清单一致；16 骨骼、11,678 三角面、两张贴图、右手挂载匹配。
- 两种手机横屏尺寸的 HUD、目标提示、摇杆、跳跃和返回按钮均在视口内；截图人工检查保留松风矿谷与无大底板 HUD。
- 实际手指摇杆产生位移和行走动作；松手归零并回到待机。
- 手指长按实际矿块获得矿石，镐尖位置随动作变化，每次生效命中对应一次挥镐，松手后动作结束。
- 双指同时摇杆移动与长按矿块，腿部行走与上身挖矿同时生效。
- 按住天空不产生假挥镐；点击返回地表后库存一致、挖矿动作不残留。该手机路径在返回前已松手，不单独证明“挥镐进行中点击返回”的中断时序；传送取消由上述 CPU 测试覆盖。
- 帮助文字长按 850ms 无选区；触摸关闭帮助不会打开后方设置。

采矿仅用 debug teleport/look 设置测试起点与镜头，实际采矿和移动通过触摸输入完成，没有 debug hit/mine。证据截图：[小横屏](../artifacts/pinewind-master-sync-mobile-r2/01-phone-640x320.png)、[长按采矿](../artifacts/pinewind-master-sync-mobile-r2/03-phone-touch-mining.png)、[双指边走边挖](../artifacts/pinewind-master-sync-mobile-r2/04-phone-moving-and-mining.png)。本次只做同步相关定向检查，没有宣称重跑之前全部手机流程或完成实体手机验收。
