# 原作商店 UI 重构（2026-10-22）

本轮范围是用户新提供的三张原作截图：走进 Shop → 工具 / 背包 / 重生分类 → 全屏 3D 商品展厅。第三项按用户答复保留“重生商店·未开放”，不实现重生玩法。用户此前上传的整个 UI 档案继续保留；本轮没有声称其余所有界面已重构。

## 工作基线与边界

工作区 `/root/.t3/worktrees/d-Mining/surface-roblox`，分支 `codex/mining-surface-roblox`，HEAD `25c23697a46c386d75609b3e6456e190722e119f`。基于此前已同步主工作目录 master 未提交进展的松风矿谷版本，包括最新角色 / 挖矿动作与横屏手机 HUD。不是从 10 月 11 日的旧提交重新开始。

本轮开始前单独捕获 868 份源文件 / 工具 / 文档，见 `artifacts/shop-ui-baseline/manifest.json` 和 `before.tar.gz`。本轮差异见 `artifacts/shop-ui-delta.json`；继承的场景、玩法、角色改动不算作本轮新改动。没有提交、push 或写回 master。

公开试玩：<https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html>。发布器只更新该独立入口，核对首页列表及所有构建文件公开 SHA256；其余游戏发布文件哈希保持不变。正式 Mining、mining-test 和原 mining-surface 对照入口均未被替换。发布记录：`artifacts/pinewind-shop-release.json`。

## 截图 ZIP 备份

- 更新：`/root/uploads/Roblox场景与UI截图.zip`
- 追加前完整备份：`/root/uploads/Roblox场景与UI截图-追加商店前备份-20261022T062300Z.zip`
- 明细：`/root/uploads/Roblox场景与UI截图-商店追加记录-20261022T062300Z.json`
- 原有 48 个条目逐字节保留，新增 47/48/49 三张截图；现在共有 49 张截图及原 HTML/JSON，共 51 个 ZIP 条目。
- 更新后 SHA256：`bfb19ee13f21a9a6cc1c4fac55f89ef8fc6275ff29e8aece8b45b16e2277e280`。

## 玩家流程

HUD“商店”在场景外提供路线指引；走进实际 Shop 圈自动打开分类页。工具 / 背包进入全屏矿洞矿车展厅，中央展示当前商品，右侧是下一件商品的真实模型。左右按钮浏览，顶部切换分类 / 返回分类 / 关闭。名字与说明在顶部，力量 / 攻速或容量在底部，金币与背包用量常驻左下。

30 档工具、30 档背包沿用现有价格、容量与力量 / 攻速公式。商品按现有顺序购买，新购买自动装备。拥有的旧装备免费切换；按钮区分已装备、装备、购买、金币不足、需先买上一件。背包小于已有矿石占用时拒绝切换，不丢矿、不自动卖矿。

角色右手与上身骨骼挂载所选镐子 / 背包；原 16 骨骼、11,678 面角色及上下身挖矿 / 移动混合保留。关店恢复原场景位置与镜头；站在圈内不会立刻重新弹出，离开后再进入才自动打开。

## 架构与存档

- `ShopPanel.tsx` 只管理界面，调用 `GameSession.useShopItem(category,id)`；购买指向固定商品 ID，重复触控不能变成购买下一档。
- `GameSession` 校验当前真实商店范围、顺序、余额、容量，再通过原 Wallet / Pickaxe / Inventory 修改状态并触发统一保存。没有 UI 直接写 IndexedDB。
- `EquipmentCollection` 记录最高已购工具等级 / 背包容量，实际装备仍在原 Pickaxe / Inventory。旧存档没有该字段时，按旧版“只能顺序升级”的规则从原装备恢复拥有范围；存在但损坏的字段会报错，不吞数据。
- 新旧装备选择与收藏在本构建内完成刷新恢复验证；没有验证向旧版应用反向导入新增的收藏字段。
- `ShopView` 是独立展示场景，接入既有 R3F WebGLRenderer / RAF / RenderSubmission，未新增第二 Canvas、第二 renderer 或动画循环。世界对象始终保留，展厅可见时暂停角色 / 世界交互更新，在线奖励时间仍由原 session 推进。
- 游戏 `suspended` 仍用于保存冲突 / 退出，不拿它控制商店，否则购买会被禁止。环境提交确认只用于实际绘制了世界的帧，展厅帧不触发环境状态确认。
- 没有修改体素生成、碰撞架构、普通场景常驻机制、多世界门槛、经济曲线或宠物概率。旧 `UpgradePanel` 删除，避免两套购买界面同时存在。

## 模型来源

全部为本轮 Blender 自制，无旧场景复用 / Decimate / Tripo 假任务 ID。

- 生成脚本：`tools/build-shop-showroom.py`
- 可编辑源：`assets-source/shop-showroom/shop-equipment.blend`、`shop-showroom.blend`
- 60 件装备：总计 21,704 三角面，`src/game/assets/shop/equipment.glb`。
- 新矿洞、轨道与矿车：6,700 三角面，`src/game/assets/shop/showroom.glb`。
- 小图集：128 × 128，`assets-source/shop-showroom/shop-palette.png`。
- 每件模型面数及 GLB / Blender 源 / 图集 / 脚本的字节数与 SHA256：`src/game/assets/shop/manifest.json`。六份文件已逐项哈希复核。

## 验证

所有浏览器画面与交互检查均在先发布后的公开入口，使用手机横屏触控。T3 原生 preview 已在此会话确认受到主机 AppArmor 阻挡，沿用仓库 Playwright 流程。Android UA、isMobile、hasTouch，844×390 和 640×320，并注入左右及底部安全区。Chromium / SwiftShader 是手机浏览器模拟，不能当作真机、Safari 或物理 GPU 性能证据。

- TypeScript + Vite 构建通过，`git diff --check` 通过。
- 商店、教学、世界进程、存档、角色动画针对性测试 70/70 通过。
- 全量测试 480 项：476 通过、4 项旧场景失败。改动前快照重现同样四项：contact-bake 摆位、quarry 压缩资源清单、quarry 旧庭院碰撞、旧道路连接。不是本轮新回归，也没有用改断言掩盖。日志在 `artifacts/shop-checks/`。
- 手机脚本 `tools/check-shop-mobile.cjs` 使用独立 `saveTest=shop-时间戳` 数据库。真实触控进入商店、分类 / 上下件 / 跨分类 / 关闭 / 再进入、余额不足、每次购买一次扣款、免费换旧装备、刷新恢复、角色模型对应、缩小背包的内容保护、关店恢复移动、长按与点击穿透均有断言。
- 调试接口只设置起点 / 镜头；测试资金与矿石在卸载游戏后只写独立验收数据库。进入商店、浏览、购买与换装由触控执行，不改玩家存档。

最终公开手机截图及完整结果见 `artifacts/shop-mobile-release/`。


最终公开结果：`artifacts/shop-mobile-release/report.json` 的 7 组流程检查通过，页面脚本错误为 0；`artifacts/shop-mobile-retry/report.json` 的短横屏分类布局及人为中断资源后的重试检查也通过。实际手机截图已人工查看。末次发布公开校验 94 个文件，保护的其他游戏文件共 1,213 个，哈希未变。

旧测试夹具原先直接改活动镐子等级 / 背包容量；新增已购集合后，这些夹具显式去掉 `equipment` 字段以构造旧格式存档。新增测试单独验证新版集合的有效性、保存与损坏拒绝。地下背包教学断言调整为返回地表，符合本轮场景商店流程。
