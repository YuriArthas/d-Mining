# Mining 策划反馈实施 Phase

日期：2026-10-18；完成更新：2026-10-19。产品规则见 [Draft](draft-mining-feedback.md)。P0～P6 首版完成，以下记录实际实现及验证范围。

## P0：规则与基线

- 写入已确认裁决、首版数值、明确不做的美术范围和公开验收边界。
- 保存现有未提交修改快照；确认当前存档、引导、深度、宠物、光照与发布路径。
- 状态：完成。开始前工作树快照已保留，规则与首版参数已写入 Draft。

## P1：深度进度与教学

- 历史深度统一解锁层、传送和蛋，保留已解锁旧档。
- 新增深挖、扩包、长期采集及第二层教学；宠物教学放在基础循环后。
- 真实历史事实与奖励金币分离，刷新、跳过、提前完成保持正确。
- 验收：门槛前/到达/上返/恢复；无需找到休整房间；未解锁不能传送；教学能完成且不被长期任务卡住。
- 状态：完成。领域/整合测试及公开构造流程已通过，覆盖真实采集、售卖、升镐、20 米下降、扩包、长期任务介绍、开蛋与装备。

## P2：功能 HUD 与宠物获取

- 最多 10 种矿石格、采集浮字、镐子/背包等级；按用户追加裁决移除“查看背包”按钮及独立页面。
- 宠物图标与前往蛋台入口，保持现场购买。
- 验收：多种矿石、批次采集、售卖清空、刷新不补浮字、面板与移动输入隔离。
- 状态：首版完成。原公开 1440×900 与 1280×800 检查通过，覆盖 12 种矿石只占 10 个 HUD 格、售卖后清空、重载不补采集浮字。首版额外实现的完整背包已被用户要求移除；原报告及 `07-full-backpack.png` 仅为当时版本记录，不能作为移除后的验收证据。
- 移除验收：删除独立按钮、弹窗及专属样式，已发布测试版 `index-WTCofNr7.js`。构建和公开资源校验通过；公开桌面 Chromium / SwiftShader 检查空背包、12 种矿石构造存档、10 格上限、全部矿石出售，以及升级/宠物入口，3 组检查通过且无页面错误。证据：[`public-report.json`](../artifacts/remove-backpack-panel/public-report.json)、[`ten-slots-hud.png`](../artifacts/remove-backpack-panel/ten-slots-hud.png)。正式 Mining 未改变。

## P3：环境与挑战榜

- 自动昼夜和平滑过渡；矿口右侧榜牌与固定随机对手。
- 复核矿口第 2/3/15 格与地下第二主题层照明，区分修复与验证结论。
- 验收：日夜周期、地下可见、榜单排序及重载稳定；公开桌面截图。
- 状态：完成。公开昼夜交界、400/800 米房间、矿口第 2/3/8/14/15/16 格及 100 米竖井检查通过；深处基础光与调色在昼夜间不变。七名对手及自己的 800 米纪录保存、上返、刷新后保持正确。已查看代表截图。

## P4：特殊货币与奖励来源

- 存档扩展、在线计时、连续签到、微信/抖音复制分享、邀请码兑换。
- 复制分享文案成功才发奖、两平台共享每日限制、自码拒绝、每档一次、重载不重复。
- 验收：临界时间、跨日/断签、重复操作、剪贴板失败、合法/错误/自己/重复口令、重载恢复。
- 状态：完成。公开页面实际复制微信/抖音文案、跨存档兑换与重载通过；分享每日合计一次，兑换只奖励兑换者。在线 300 秒门槛使用构造计时触发后实际点击领取，跨日与断签由领域测试覆盖。

## P5：扭蛋与运行时权益

- 功能扭蛋机入口、概率展示、扣费结果；金币、永久与限时权益。
- 接入真实移动/挖矿/传送/蛋概率/自动购买，永久重复转金币。
- 验收：所有奖项、重复奖、余额不足、限时到期与保存；面板关闭不取消已结算奖励，不产生双结算。
- 状态：完成。公开实际抽取、扣费、结果与重载通过；自动孵蛋实际付费，关闭窗口及真实切换标签页后停止且不自行恢复。全部奖项及重复、到期、倍率效果由领域/整合测试覆盖，未声称公开随机抽中了全部奖项。

## P6：整体验收与公开交付

- 完成适配测试、类型/构建检查、针对性审查。
- 先发布 `/games/mining-test/index.html`，确认公开列表与正式入口资源未被覆盖，再检查公开场景与交互。
- 使用独立测试存档构造深度、权益、跨日条件；保留新档正常教学的验证。
- 记录报告、截图、真实通过项与剩余验证缺口；不把自动化/软件渲染解释为真人或硬件验收。
- 状态：完成。441/441 项测试通过，零跳过；类型、构建、差异检查通过。公开桌面验收覆盖下表 23 组检查，最终报告没有页面/控制台错误。测试入口位于公开游戏列表，正式 Mining 资源未被覆盖。

## 执行记录

- 开始前未提交文件快照：`/tmp/mining-feedback-baseline-20261018-230222`。此前引导与补光渐隐修改保留。

### 本轮实际发现并修正的问题

- 扭蛋机前既有路缘先被支撑检测命中，却不能真实支撑角色。现在继续查询脚下实际地面，保留坡度、距离、跳跃和头顶碰撞限制；公开原坐标回归通过。
- 昼夜环境贴图更新曾在画面提交被跳过时继续向 GPU 追加任务。现在随获准绘制的帧更新，只处理最新状态，并复用已分配的贴图；回归覆盖 3000 次被跳过的逻辑更新。
- 房间装饰地板和碰撞接触间隙使实际脚底略高于 400/800 米。历史深度与显示统一处理明确的接地窗口；房间视觉主题按其体积归属，空中进入不提前解锁，房间内跳跃不切回上一层照明。
- 第一主题层延伸到 400 米，原来即使矿口补光归零，基础光和调色仍受昼夜影响。现在沿既有 4～30 米曲线过渡到固定地下参数；30 米后环境贴图不再参与照明，可见天空独立保留。

### 公开验收记录

公开入口：[Mining 测试版](https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html)。公开列表：[游戏列表](https://w-sunjun-public.dev.clock-p.com/)。

| 范围 | 实际证据 | 报告 |
| --- | --- | --- |
| 教学、背包、宠物 | 5 组：新档、真实采集/出售、升镐/20 米/扩包、开蛋装备与续接、12 种矿物与 10 格 HUD；1440×900 和 1280×800 | [onboarding](../artifacts/mining-feedback/public-report-onboarding.json) |
| 奖励、分享、兑换、扭蛋 | 4 组：签到/在线领取、真实剪贴板、跨存档兑换及重载、实际随机抽奖扣费与持久化 | [claims](../artifacts/mining-feedback/public-report-claims.json) |
| 自动孵蛋 | 2 组：按正常价格实际购买，关闭和真实标签页失焦后停止，返回不自行恢复 | [auto](../artifacts/mining-feedback/public-report-auto.json) |
| 路缘及普通入口 | 3 组：原始故障坐标继续运行 30 个物理步仍正确接地，扭蛋 SVG 图标，普通 URL 无手动昼夜或调试全局对象 | [normal](../artifacts/mining-feedback/public-report-normal.json) |
| 昼夜、深层、榜单 | 5 组：自动启动、昼夜交界真实提交帧、400 米、800 米、榜单保存刷新；普通场景持续驻留 | [environment](../artifacts/mining-feedback/public-report-environment.json) |
| 矿口与第一层底光 | 4 组、14 次采样：浅层衰减、上返恢复、切换昼夜、30/32/100 米固定主光/环境光/调色且无地表环境贴图贡献 | [light fade](../artifacts/surface-light-fade/report.json) |

各功能在本轮对应的公开测试构建上逐项验收。最终环境报告使用入口资源 `assets/index-DLJBL-Sm.js`；最终矿口与 100 米照明复验在同次发布后完成。发布脚本核对公开资源哈希及正式入口未变化：[发布记录](../artifacts/preview-release.json)。[全套测试日志](../artifacts/mining-feedback/tests-final.log)与[构建发布日志](../artifacts/mining-feedback/publish-final.log)已保留。

代表截图：[`01-fresh.png`](../artifacts/mining-feedback/01-fresh.png)、[`06-ten-slots-1280.png`](../artifacts/mining-feedback/06-ten-slots-1280.png)、[`capsule-current-icons.png`](../artifacts/mining-feedback/capsule-current-icons.png)、[`31-surface-auto-dawn.png`](../artifacts/mining-feedback/31-surface-auto-dawn.png)、[`34-old-mine-night.png`](../artifacts/mining-feedback/34-old-mine-night.png)、[`35-fungal-day.png`](../artifacts/mining-feedback/35-fungal-day.png)、[`37-board-reloaded.png`](../artifacts/mining-feedback/37-board-reloaded.png)、[`night-15.png`](../artifacts/surface-light-fade/night-15.png)、[`day-100m.png`](../artifacts/surface-light-fade/day-100m.png)。

### 验证边界与复查方式

- 浏览器证据来自访问公开入口的桌面 Chromium / SwiftShader。失焦测试使用带窗口的 Chromium/Xvfb，触发真实 blur/focus；无头浏览器不能模拟这一点。没有进行手机、Safari 或物理 GPU 性能验收。
- 教学使用真实采集、出售、购买与装备路径；较深进度、货币、永久权益及挖空阶梯使用独立测试存档。在线门槛与昼夜交界采用构造计时，过渡截图使用受控浏览器时钟和真实 GPU 提交。不是从零自然玩满完整成长周期，也不是自然等待完整昼夜周期。
- 光照采样会传送到指定位置后等待真实物理落地，并返回浅层复查。它证明这些采样点及上返恢复，不代表连续徒步挖穿每一层的完整流程验证。房间跳跃与支撑边界另由真实 Rapier 回归覆盖。
- 全部扭蛋奖项、倍率、永久重复转金币、跨日、断签、余额不足、失败不发奖及存档边界由领域/整合测试覆盖。公开随机抽取实际获得金币；自动孵蛋使用已获权益的构造存档，不声称随机抽中了全部奖项。
- 首版经济参数仍需后续自然试玩调节；纯美术模型与动画重做不在本轮范围内。

复查命令：`npm test`；发布先运行 `npm run publish:preview`，再运行 `FEEDBACK_HEADFUL=1 xvfb-run -a node tools/check-feedback.cjs` 和 `node tools/check-surface-light-fade.cjs`。浏览器脚本始终访问公开测试入口。

旧失败记录作为诊断保留，不计入通过报告：无头失焦限制由 `auto` 的真实标签页检查替代；`public-report-rewards.json` 的原路缘失败由 `normal` 原坐标及 `claims` 完整结算回归关闭；环境 GPU 积压、受控时钟等待和房间深度失败由最终 `environment` 报告关闭；新增竖井夹具越过可挖边界的脚本错误已修正，最终 `light fade` 报告通过。

### 追加修复：营地边界导致升级按钮移位

原 HUD 在离开营地时移除“传送”，两列布局随即重排，“升级”从第二行左侧跳到第一行右侧。现在四个按钮固定占位；传送不可用时置灰并提示返回地表营地，已有便携传送权益仍可在外使用。升级购买和商店区域弹窗规则保持原有行为。

已发布公开测试版 `index-Bwdc1qrB.js`，发布校验确认正式 Mining 未改变。14 项相关逻辑测试与 5 组公开桌面 Chromium / SwiftShader 检查通过：实际步行跨出营地前后按钮坐标一致、升级均能打开、返回后传送恢复、商店进出正常、地下升级可用、便携传送与镐子/背包购买正常。权益与购买使用隔离构造存档。证据：[`public-report.json`](../artifacts/upgrade-ui/public-report.json)、[`after-crossroads.png`](../artifacts/upgrade-ui/after-crossroads.png)、[`after-away.png`](../artifacts/upgrade-ui/after-away.png)。
