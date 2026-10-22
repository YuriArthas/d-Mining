# 松风矿谷 Roblox HUD

用户要求去掉 UI 底板，先用 Image 2.5 画参考，再照着布局实现。本轮继续在 `surface-roblox` 独立 worktree 上修改，不更换游戏基线。

## 参考图

使用 `imagegen` 技能的 CLI，通过已配置 Images API 调用用户指定的 **gpt-image-2.5**。输入为上一版公开截图，输出只用于 HUD 构图参考。

- [生成图](../output/imagegen/pinewind-hud-20261021/roblox-hud-reference.png)
- [完整提示词](../output/imagegen/pinewind-hud-20261021/prompt.txt)
- [模型、输入、输出尺寸与 SHA-256](../output/imagegen/pinewind-hud-20261021/generation.json)

参考图的布局：左上世界/深度/金币/容量，左侧 2×3 功能图标，右上无底板目标，底部装备与返回地表，右上角设置/帮助/退出。图像生成对背景有艺术化重绘；实际游戏场景、矿井和角色资源不随参考图替换。

## 实现

常驻 HUD 容器移除背景、边框和投影，以描边文字、独立图标和窄容量条维持可读性。`InventoryHud` 继续读取原会话快照，`SessionUi` 继续使用原有 modal、按 E、引导和自动开蛋状态路径；只重排入口。详细功能窗口保留原有内容和交互。

`HudIcon.tsx` 使用原生 SVG 延续已有装备图标；`robloxHud.css` 承载新布局。左边六个入口为升级、宠物、世界、矿物、奖励、传送，按钮区域至少 44px。右上目标和矿石血量、拾取提示也去掉大底板。实时性能/输入/验证面板只在 `debug=1` 下的折叠调试入口内显示，普通玩家入口不渲染这些面板。画面设置折叠到齿轮中，保留原设置行为。

本轮仅改动 4 个既有 UI 文件：`App.tsx`、`InventoryHud.tsx`、`SessionUi.tsx`、`OnboardingUi.tsx`，新增 2 个 UI 文件。发布工具新增可指定记录路径，保留上一轮发布证据。与场景交付时的清单核对，玩法、存档、物理、角色及场景文件保持原样。

## 公开检查

先发布到 [独立试玩入口](https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html)，再进行浏览器验证。没有覆盖正式 Mining、mining-test 或场景参考入口。

构建/类型检查通过。浏览器使用仓库 Playwright 流程，桌面 Chromium / SwiftShader；T3 `preview_open` 返回主机 AppArmor 阻止 sandbox 的明确错误。检查两种桌面尺寸 1440×900、1280×720，HUD 无大底板、各区不重叠、中央可拖动镜头，六个入口与帮助开关、设置、引导、E 查看蛋概率、矿石结算后的容量/矿石图标/售价、返回地表，以及无 debug 的默认入口。

证据：[公开检查记录](../artifacts/pinewind-hud-public/report.json)、[默认玩家截图](../artifacts/pinewind-hud-public/06-normal-player.png)、[夜景截图](../artifacts/pinewind-hud-public/03-hud-night.png)、[独立发布记录](../artifacts/pinewind-hud-release.json)。采矿测试通过现有 debug hit 走主线结算；不把它算作鼠标瞄准验收。未进行手机或物理 GPU 性能测试。
