# 松风矿谷：手机横屏修正

用户明确要求手机优先、验收只以手机为准，并补充“这是横屏游戏，不要弄竖屏”以及长按选字问题。已更新本 worktree 的 `AGENTS.md`，并按“记住”的要求写入用户记忆补充记录。

## 基线与范围

继续使用 `codex/mining-surface-roblox` 独立 worktree，基于用户选择的 master 主工作目录及其未提交进展。基线为 `25c23697a46c386d75609b3e6456e190722e119f`，快照记录于 `artifacts/master-baseline/manifest.json`。

本轮修改 `App.tsx`、`InventoryHud.tsx`、`OnboardingUi.tsx`、`SessionUi.tsx`、`GameButton.tsx`、`robloxHud.css` 和 `MiningLessonHighlight.ts`，均为 UI 排版、提示或 UI 事件处理。保留原横屏 shell/旋转策略、`bindInput`、`GameInput`、`TouchGesture`、瞄准坐标、摇杆、相机、玩法和存档路径。没有制作原生竖屏布局，没有修改场景资产或降低画质。

[本轮前快照](../artifacts/pinewind-mobile-baseline/manifest.json) 和 [逐文件增量](../artifacts/pinewind-mobile-changes.json) 区分本轮改动与继承的未提交代码。[核心代码比对](../artifacts/pinewind-mobile-core-integrity.json) 检查 70 份文件；唯一相对 master 快照的差异是此前场景迁移已记录的 `runtime/startGame.ts`，本轮未改。

## 玩家可见变化

- 手机横屏左上紧凑显示世界、深度、金币与背包容量；左侧常驻升级、宠物和更多。世界、矿物、奖励、传送放入更多；右上显示当前目标，底部留给移动、跳跃、返回。HUD 仍无大底板。
- 基于游戏 shell 实际高度压缩小屏布局，避免浏览器视口与横屏 shell 尺寸不一致。按钮至少 44px，支持安全区边距；次要装备/矿石详情通过原功能界面查看。
- 窄屏弹窗可用手指滚动，关闭栏固定可见。引导、操作帮助、寻找蛋台和矿块上的动态提示均使用触屏说法。跳过教学保留在帮助中，主动寻找蛋台的取消按钮仍在场景显示。
- 游戏区域使用 `user-select: none`、`-webkit-user-select: none`、`-webkit-touch-callout: none`；输入框/文本框保留编辑选择。原有游戏 context-menu 阻止规则保留。
- 手机测试发现关闭 GameButton 弹窗后的兼容 click 会落在后面的原生 settings/debug summary 上。沿用原 `GameButton` 共享触摸去重状态，在游戏根节点捕获并阻止该 click；新的真实触摸会重置拦截，因此仍可立即操作原生设置按钮。键盘激活的 detail=0 点击保留。

## 公开手机检查

每次可试玩修正都先发布到 [独立试玩入口](https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html) 再检查。入口保留在公开游戏列表中；正式 Mining、mining-test、mining-surface 对照及其他游戏未被覆盖。[最终发布记录](../artifacts/pinewind-mobile-release.json) 包含公开文件哈希和其他游戏保护核对。

设备工具明确返回 `Agent device access is turned off for this environment.`。T3 浏览器此前明确被主机 AppArmor 阻止，使用仓库 Playwright 流程访问公开 URL。所有本轮浏览器检查均为手机：Android UA、`isMobile`、触控和横屏；没有使用 PC 尺寸或鼠标键盘操作结果作为验收。使用 Chromium/SwiftShader，不是实体 Android/iPhone，不构成 Safari、真实 GPU 或手机帧率证明。

[完整手机流程记录](../artifacts/pinewind-mobile-public/report.json) 有 12 组通过检查，页面/console 错误为空，涵盖：

- 844×390、667×375、640×320、932×430 四种横屏；另注入左右各 44px、底部 21px 安全边距，检查 HUD、摇杆、跳跃按钮不重叠和可点范围。
- CDP 双指移动与拖镜头、实际角色位移、单次跳跃、松手清零，以及非主触点打开菜单。
- 六个功能入口与帮助、设置；640×320 的弹窗手指滚动、保持可见的关闭按钮；关闭弹窗不得打开后方设置/调试。
- 长按帮助文字 850ms 无选区；奖励文本框仍可编辑，未提交任何兑换或分享。
- 真实矿口的取消触摸和 UI 点击不采矿；手指按住实际可见方块完成采矿并更新容量，松手结束，点返回地表成功。只用 debug teleport 设置测试起点，采矿未调用 debug hit/mine。
- 点按附近蛋台直接显示 5 只宠物的概率；常驻蛋标签保留；普通无 debug 入口的手机菜单可用。

逐张检查截图后，发现矿块投影器每帧覆盖了 UI 中的触屏文案。最后一版仅为投影器传入输入类型并修改两条提示。[最终定向手机复查](../artifacts/pinewind-mobile-guide-public/report.json) 单独记录最后发布版本的手机 DPR 2、可挖/无目标两种提示和长按/关闭帮助检查；前述完整流程的行为代码和 CSS 没有再改。

截图：[小手机横屏](../artifacts/pinewind-mobile-public/01-landscape-640x320.png)、[正常手机入口](../artifacts/pinewind-mobile-public/10-normal-phone.png)、[可滚动帮助](../artifacts/pinewind-mobile-public/06-small-phone-help-scrolled.png)、[蛋概率](../artifacts/pinewind-mobile-public/09-egg-probabilities.png)。最终矿块提示以 `pinewind-mobile-guide-public/` 为准，完整流程中 `07-touch-mining-guide.png` 是修正动态文案前的证据。

构建/类型检查通过，只作为发布前检查。没有把编译结果、PC 历史报告或软件渲染帧数当作本轮手机体验/真机性能验收。
