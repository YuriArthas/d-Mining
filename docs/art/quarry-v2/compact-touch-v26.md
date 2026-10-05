# V26 — 紧凑 HUD 与触摸命中修复

## 问题与处理

- 顶部 header 的矩形铺满屏幕宽度；左侧性能信息撑高了整条区域，透明部分也会拦截触摸。`bindInput` 的 `elementFromPoint` 检查把经过它的镜头/挖矿手势取消。
- header 和背包纯信息部分改为 `pointer-events: none`，仅按钮、详情开关、展开的详情及背包滚动列表接收事件。升级/传送对话框仍隔离游戏输入。
- 性能常驻只显示 FPS / 帧时间；细项与诊断放在“详情”。背包宽 180px，字体、间距、设置按钮及升级/传送弹窗缩小；摇杆和跳跃触摸面积保留。
- 原先短点按不会攻击。本次在正常 pointerup 且手势仍为 pending 时，保存一次瞄准敲击，下一帧走既有选格与 `session.hit`。长按仍连续挖，拖动仍观察；长按后的滑动选矿行为保留。取消、丢失捕获、经过交互 UI、reset 或长按结束不生成额外点按。攻速、距离和满背包判定仍归原有模块。

## 验证

- input / touch-gesture / selection / mining-combat：39 项通过。
- TypeScript、Vite 构建及公开资源哈希校验通过，仅发布 mining-test。
- `tools/check-compact-touch.cjs` 对公开入口使用 Chromium CDP 触摸事件，覆盖透明 header、双指移动/转镜头、短点按伤害、取消、长按释放、升级按钮隔离。
- `artifacts/compact-touch-v26/hud.png`：公开入口 844×390 HUD；header 高 88px，背包 180×114px。
- 软件 GPU 环境的渲染很慢，手势派发期间临时暂停测试页 RAF，之后恢复游戏帧消费输入，避免测试机器慢帧把拖动误判为长按。该开关只由验证脚本注入，未进入游戏代码。截图的 FPS 不作为设备性能结论。
- 桌面浏览器触摸回归不代表 iPhone Edge 的真实手感验收。
