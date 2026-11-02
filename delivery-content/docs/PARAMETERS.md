# 核心内容与数值编辑

`parameter-catalog.json` 列出 `economy.json`、`GAME_CONFIG`、`MOVEMENT` 每个数值的当前值、单位、约束和实际读取文件。它是从源文件生成的只读索引，禁止把它作为第二份配置维护。更新索引：`node tools/generate-parameter-catalog.mjs`。

## 经济与进度

唯一数值源是 `src/game/content/economy.json`，由 `economy.ts` 在加载时验证。数组索引从 0 开始，工具 level / 背包 tier 从 1 开始，世界为 1–3，地层为 0–6。`isRound` 规则：非负安全整数，大于等于 100 时最多两位有效数字。

| 参数族 | 单位与取值规则 | 实际作用 |
| --- | --- | --- |
| `tools[].power`、`enhance[].power` | 每击 HP；正整齐数；工具和强化伤害分别递增 | `logic/Pickaxe.ts` 算每击伤害；`GameSession` 的挖矿结算读取 |
| `tools[].speed` | 击/秒；正数、逐级不降，最多首镐的 4 倍 | 挥镐冷却；宠物/道具速度超出上限时转为伤害，维持 DPS |
| `tools[].price`、`bags[].price` | 对应 currency 的币；整齐数；同世界逐级上涨，首件可为 0 | 商店报价与真实扣款 |
| `bags[].capacity` | 矿物件数；正整数并逐档增加 | 背包容量与满包判断 |
| `layers[].from`、`deepAt` | 米；深度为 2 米格长的整数倍；下层递增，岩盖位于本层区间内，末层为 null | 地形生成、房间位置、致密岩切换 |
| `layers[].gate` | 镐等级；门槛不倒退 | 仅控制本层矿石的开采；普通岩石、岩盖与通道不检查等级 |
| `layers[].rock/deep/ores[].hp` | HP；正整齐数 | 实际矿块生命与击碎时机 |
| `layers[].rock/deep/ores[].price` | 本世界币/件；正整齐数 | 物品估值与出售结算 |
| `layers[].oreChance` | 概率；严格位于 (0,1) | 确定性逐格矿物生成 |
| `layers[].ores[].weight` | 相对权重；正数 | 在矿物候选中按权重抽取，不直接当百分比 |
| `eggs[].price`、`pets[].weight` | 币/次、正整数相对权重 | 开蛋扣款与抽样；概率 = weight / 总权重 |
| `eggs[].pets[].bonusPct/miningPct` | 百分点；正整齐数 | 宠物售矿收益和挖矿速度；不同世界收益分别累计 |
| `worlds[].ticket` | price 为上一世界币；材料 count 为正整数；toolLevel 与新世界首层门槛一致 | 世界传送门的解锁报价、材料扣除与等级判断 |
| `petSlots`、`golden` | 槽位个数、合成只数、倍率 | 装备槽购买、金宠合成；倍率 >1、合成只数 >1 |
| `rebirth.stepPct` | 百分点/次；>0 | 当前规则是**售矿收益倍率**，每次加 50 百分点；不改变基础挖掘伤害或掉落件数 |
| `capsule`、`luckyCoins` | 次、秒、分钟、币、倍率、相对权重 | 扭蛋、计时增益、签到和在线奖励；均应为有限正数，权重为正整数 |

具体结构校验见 `validateEconomy`。本表同时包含编辑约束；不能假定所有任意错误输入都会被校验器拦下。新增物品/蛋/世界同时修改配套名称、外观、ID、地层与消费者；不能只往数字数组添加一行。

## 移动、相机与输入

`src/game/config.ts`：距离单位米，角度为弧度（`fov` 为度），鼠标/触控灵敏度为弧度/CSS 像素，`mineHoldMs` 为毫秒，摇杆尺寸为 CSS 像素。`stickDeadZone` 位于 [0,1)，`minPitch < maxPitch`，相机半径不应超过玩家半径。

`src/game/movement.ts`：速度为米/秒，重力为米/秒²，`step` 与 `maxFrameDelta` 为秒；`maxSteps >= maxFrameDelta / step`。碰撞 skin、台阶与落地吸附均使用米，不能凭 UI 感觉任意缩放。物理固定步长为 1/60 秒；渲染固定 60 帧上限，每秒调度预算最多 60 次，没有解除帧率上限的菜单项。渲染限帧不等于基准真机能达到 30–60 FPS。

## 地图与文本

`content/pinewind/hubLayout.ts` 维护地表交互点；`pinewind/authored.json` 是实际模型/碰撞装配数据，修改服务位置时要让场景、碰撞和交互区一致。`rooms/*.layout.json`、`rooms/*.scene.json` 与 `underground/*.json` 维护大厅布局/标牌和碰撞。变更离线建模布局后应重新生成对应本地资源，再构建。

文本使用 `tr()` 和 en/id/vi 资源，不在 JSX 中拼接未翻译中文。保存重载和语言切换分别验，不用截图代替数值实际读取验证。

## 多参数变更验证

在临时副本把首镐 power 从 10 改为 8、初始背包容量从 25 改为 20、原野蛋价格从 12 改为 15；重新构建并读取真实会话与商店/蛋的快照验证。该实验不修改本次交付的正式数值。具体执行结果随交付说明列出，基准设备性能仍须独立验收。
