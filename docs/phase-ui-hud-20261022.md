# UI 改造第 0–2 步：检查点、字体与组件规范、HUD 重做（2026-10-22）

用户决定画风先保持松风矿谷现状，UI 与布局一部分一部分地改，可以大改包括代码架构。本轮做第 0、1、2 步。工作区 `/root/.t3/worktrees/d-Mining/surface-roblox`，分支 `codex/mining-surface-roblox`。

## 第 0 步：检查点

`273024e` 提交了 25c2369 之后全部未提交进展（290 个文件：松风矿谷地表、手机横屏 HUD、商店展厅、挖矿动作同步、引导与世界进程、测试、工具、美术源和阶段文档）。`light-study/`（独立夜间光照样板，约 116 MB 二进制）和 Blender `.blend1` 备份没有纳入，仍留在磁盘上。没有推送。

## 第 1 步：字体与组件规范

- 规范见 [docs/ui-kit.md](ui-kit.md)。配色、描边、按钮体积取自原作截图（02 主界面、04 宠物背包、47/48 商店）。
- 字体：数字和英文用 Fredoka 600；中文默认思源黑体 Black（Noto Sans SC 900）。另有三款可在游戏里切换对比：`?uiFont=qingke`（站酷庆科黄油体）、`kuaile`（站酷快乐体）、`chill`（寒蝉半圆体）。全部 SIL OFL 1.1。
- `tools/build-ui-fonts.py` 按 `src/` 里实际出现的字符做子集（当前 851 个字符），源文件按 URL + SHA-256 锁定，缓存在已忽略的 `.tools/font-sources/`。子集大小：思源黑体 119 KB、庆科 127 KB、快乐体 91 KB、寒蝉 154 KB、Fredoka 10 KB；只有选中的中文字体会被下载。子集内部字体名全部改为 “Mining Display …”，避开寒蝉的保留字体名。
- `tools/tests/ui-fonts.test.mjs` 检查 `src/` 新增文字是否已进入子集。

## 第 2 步：HUD 重做

新结构：`src/game/ui/kit/`（组件层）+ `src/game/ui/hud/`（`Hud.tsx`、`SystemMenu.tsx`、`hud.css`）。删除 `InventoryHud.tsx`、`HudIcon.tsx`、`robloxHud.css`、`inventory.css`；仍在使用的旧弹窗手机规则和场景引导文字样式移到 `legacy.css`，后续弹窗步骤逐个替换。

- 左上：背包胶囊条（容量填充，满时变金色；点按打开矿物背包，“+”走原有商店路线指引）、金币胶囊条、增益、目标卡（引导卡/深度目标卡改为有实体的卡片）。
- 顶部居中：世界名 + 深度，地表显示“地表”。
- 右上：帮助、设置。设置里是帧率上限、阴影和**退出游戏**；调试模式额外显示画面和昼夜。原来红色醒目的退出键移除。
- 右侧：宠物、商店、奖励、更多（世界 / 传送 / 矿物）。电脑宽屏全部直接显示，不折叠。
- 底部居中：挖矿目标卡、扭蛋 / 矿区要求按钮、短暂通知（4.5 秒后消失，不再常驻“走进金色圆圈自动出售”）、**返回地表只在地下出现**。
  （2026-10-22 后续调整：挖矿目标卡移到顶部深度下方，与新获得矿石提示叠在一起，不再挡住正在挥镐的角色。）
- 摇杆去掉“移动”文字；跳跃键换成向上箭头图标。
- 会话快照新增 `location`（surface / mine / room），HUD 据此判断是否显示返回地表。
- `GuideCard` 与场景内指引箭头拆成 `GuideCard` / `GuideMarker`，卡片放进 HUD，箭头仍在场景层由投影器定位。
- 引导高亮沿用 `data-guide-action`（return / upgrade / pets），点击防穿透沿用 `GameButton`。
  （2026-10-22 后续调整：强制引导链改为四条一次性提示，高亮改用 `data-tip-target`，见 docs/phase-tips-20261022.md。）

## 验证

- TypeScript + Vite 构建通过。全量测试 480 项：476 通过，4 项失败与改动前相同（contact-bake 摆位、quarry 压缩资源清单、quarry 旧庭院碰撞、旧道路连接）。新增字体测试 2 项通过。
- 先发布到 [独立试玩入口](https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html)，发布记录 `artifacts/ui-hud-v2-release.json`，其他游戏文件哈希未变。正式 Mining、mining-test 未覆盖。
- 手机检查 `tools/check-ui-hud-v2-mobile.cjs`：Android UA、isMobile、触控、横屏、DPR 2、Chromium/SwiftShader，访问公开入口。7 组全部通过，页面/console 错误为 0，报告 `artifacts/ui-hud-v2-mobile/report.json`：
  - 844×390、667×375、640×320、932×430 及注入左右 44px / 底部 21px 安全区：HUD 各区在视口内，互不重叠，也不压摇杆和跳跃键；所有 HUD 按钮 ≥ 44px；画面中央仍是拖动视角区。
  - 更多展开 / 收起；设置面板含退出并可滚动到；点空白处关闭设置且不触发其他操作；帮助打开关闭无点击穿透。
  - 背包条打开矿物背包；“+”启动商店指引并可取消。
  - 进入矿井后深度显示米数、出现返回地表，点按返回后按钮消失。
  - 摇杆触控移动并归零；长按 HUD 文字 850ms 不选中。
  - 三款备选字体按参数按需加载并截图对比（`08-font-compare.png`）。
- 调试接口只用于设置测试起点和镜头；交互全部用触控完成。电脑 1440×900 只截了一张参考图（`09-desktop-1440x900-reference.png`），不作为验收。
- 这是手机浏览器模拟，不是真机、Safari 或真实 GPU 证据。

## 尚未覆盖

- 背包满（金色）和增益条只在代码里实现，本轮没有在公开版本上造出对应状态截图。
- 宠物、蛋、世界、矿物、传送、奖励、帮助等弹窗仍是旧样式（第 4–6 步）；蛋台名称价格等场景标签未改（第 7、11 步）。
- 旧检查脚本里引用 `.hud-settings`、`.hud-exit`、`.hud-action` 的步骤已过时；`styles.css` 里旧 HUD 的无用样式还没清理。

## 字体定稿

用户选 A：思源黑体 Black + Fredoka。已删除庆科、快乐体、寒蝉三个子集、`?uiFont=` 参数和对应样式；构建器只生成两个子集（思源黑体约 119 KB、Fredoka 约 10 KB），重建结果逐字节可复现。
