# P5 本地存档实施与 Review

日期：2026-10-08。设计：[存档 Draft](draft-save-system.md)。

状态：P5.1–P5.6 已完成并通过 review 与公开电脑端自动验收。测试版先发布，正式版未覆盖。

## 实际结构

- `application/SessionProgress.ts`：独立的玩家持久化 DTO，不依赖活会话或 UI。
- Wallet / Pickaxe / Inventory / Exploration / PetService：各自校验和导出事实；`GameSession.createNew/fromData` 区分新档和恢复。
- `application/PetCommands.ts`：执行宠物应用命令并报告完成；PetUiAdapter 只转发命令、构建表现快照。
- `terrain/WorldSaveCodec.ts`：显式区域坐标与 Uint16 区间编码；保护格、越界、重复区间校验。
- `terrain/WorldSaveChanges.ts`：修改区域序号；捕获后继续发生的变化不会被旧写入确认清除。
- `persistence/WorldSaveSource.ts`：协调器只获得捕获/确认能力，不获得挖矿、渲染或碰撞操作。
- `IndexedDbSaveStore`：head / progress / regions 同事务读写，事务内比较 revision，只以 complete 为成功；请求 strict durability。
- `SaveCoordinator`：普通约 2 秒、重要命令尽快、一次写入在途、失败有限退避、显式 flush/stop。
- `SaveBootstrap` / `SaveOwnership`：先获得整会话 Web Lock，再读取/验证并构造候选状态。候选世界验证按时间分片，随后注入 TerrainStream。
- `ui/SaveEntry.tsx`：启动、取消/重挂载、页面隐藏/离开与 BFCache 重新读取。App 在退出前冻结命令、取消 pending、flush，最后释放 Canvas、数据库和锁。

保存金币、背包容量/物品、镐子等级、宠物实例/装备、真实探索、种子/生成版本和稀疏删除区域。恢复回地表，不恢复部分 HP/冷却/位置/动画。开蛋 RNG 不持久化。

当前试玩预开放访问权仍保留；它与 earned 解锁分离，不自动写成玩家探索记录。

## Review 发现并修正

本轮为代码自评与测试，不声称有独立 reviewer。

1. **缺失 progress 不能走新玩家构造。** `fromData` 先要求明确的 version 1 数据，缺字段/未知 ID/旧地图版本均拒绝，保留原档。
2. **旧写入不能清除新挖掘。** 进度与区域分别以捕获序号确认，保存失败保留 dirty，不重复执行售卖或抽奖。
3. **慢写入不能造成连续保存。** 写入期间的普通变化保留自己的保存期限；urgent 才在上一笔完成后尽快写。回归测试覆盖持续修改和慢 Promise。
4. **保存状态通知重入。** 在发布 saving 状态前登记在途 Promise；订阅者再次 flush 复用同一笔写入。
5. **运行故障不能被旧成功回调掩盖。** fatal/conflict 阻止后续写入并冻结命令；旧事务即使完成，也不能把错误状态改回“已保存”。
6. **React 初始化副作用与锁释放。** 读档在 effect 中运行，重挂载等待前次 bootstrap/close，取消的晚到结果不接管新会话。
7. **临时场景与正式档混用。** production/test/acceptance/samples 使用不同命名空间；验收脚本只操作其 runId 下的数据库。
8. **异步写入不等于自动原子。** 实际浏览器注入 request success 后的 transaction.abort，确认三个 store 都保留旧提交；并发相同 expectedRevision 只有一笔成功。

没有为本期加入后端、通用 Saveable 基类、每镐操作日志、历史备份/多槽 UI，或默认申请 persistent-storage 权限。

## 验证记录

- `npm test`：341 项通过，包含 18 项新增存档测试。既有流式地形/取消/采集测试覆盖相关提交路径。
- `npm run publish:preview`：TypeScript/build 通过，公共资源逐项 hash 核对；脚本确认正式 Mining 未改变。
- `node tools/saves/check-public.cjs`：公开地址使用独立 `?debug=1&saveTest=<runId>`；报告 `artifacts/saves/public-report.json`。
- 最终公开复验 `save-1791479008759`：8 组检查全部通过、pageerror 为 0，浏览器确认 durability=strict。覆盖双标签互斥、原生 IDB 原子中断/序号冲突、6 格真实挖掘与掉落刷新恢复、可见开蛋/装备自动保存、售卖、配额故障/退出重试、渲染进程崩溃后的恢复、未知版本不覆盖。
- `node tools/saves/check-lifecycle.cjs`：公开加载途中导航取消、浏览器 Back 重进、注入 persisted-pageshow 后强制重读均通过，报告 `artifacts/saves/lifecycle-report.json`。本次 Chromium 的 Back 没有实际命中 BFCache；缓存恢复守卫通过事件注入单独验证，不混称为真实缓存命中。
- 在最终全套 341 项通过后，为既有流式取消测试补充存档断言；针对该文件的 9 项复验全部通过，证明 pending 格子不进入已提交世界 DTO。
- 画面证据：`artifacts/saves/restored-game.png`；检查的是公开电脑端，正常游戏不出现保存说明面板。软件渲染截图出现过超时，默认验收脚本已改为只核对状态/交互；需要重新截图时显式设置 CAPTURE_SAVE_SCREENSHOT=1，不因重复截图阻塞存档检查。
- `node tools/saves/benchmark.mjs`：纯数据基准，约 99,602 个删除格子、3,119 个区域、49,848 字节区间载荷；5,000 只宠物下捕获 P95 约 0.42ms、最大约 1.10ms，候选世界完整验证约 52.6ms。只说明此服务器上数据路径成本，不等于浏览器或手机帧率验收。

## 边界

- v1 没有历史迁移可执行；已实现格式/生成兼容门槛，不承诺迁移任意旧地图。
- 普通前台自动保存、主动退出和已提交事务恢复有验证；尚未提交的尾部变化遇到崩溃仍可能丢失。
- 默认浏览器存储仍可能被用户清理或浏览器驱逐；不提供跨设备同步或永久备份。
- 当前未进行手机存储/后台压力验收，不以电脑 SwiftShader 测试证明 iPhone 性能。
