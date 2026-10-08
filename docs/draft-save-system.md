# P5 存档架构与实施 Draft

状态：P5.1–P5.6 已实现并完成公开电脑端自动验收；实机边界见实施记录。日期：2026-10-08。

实施与 review 证据见 [P5 实施记录](phase5-save-review.md)。本文保留设计边界并同步实际 API。关联：[MVP 总 Draft](draft-mining-mvp.md)、[宠物 API Draft](draft-pet-api.md)。

## 1. 目标与首版边界

- 纯客户端、IndexedDB、本机单个自动存档槽；不依赖日志服务器、账号或云服务。
- 金币、背包、镐子、宠物、探索和挖掘变化持续保留；各模块独立定义自己的持久化数据。
- 保存已完成的业务事实，不保存场景对象、UI 快照、物理状态或 Worker 任务。
- 数据库只写变化的矿坑区域；玩家进度与这些区域必须原子提交。
- 首版行为：重新进入回地表出生点；保留矿坑与已解锁层；未破坏方块恢复满血。精确位置续玩、部分伤害续存不进入首版。
- 正式、测试、自动验收存档隔离。一个存档空间只允许一个可写会话。
- 不做手动多槽、清档 UI、导入导出 UI、历史回滚 UI、反作弊、防回档抽奖、离线收益。模块级 DTO 导入/导出仍需要。
- 本地浏览器存储不等于备份：清理站点数据、换域名/浏览器/设备不能自动恢复。正常游玩不常驻说明面板；失败时给出短提示与可执行操作。

## 2. 实施前代码核对

| 当前位置 | 已有能力 / 缺口 | 设计要求 |
|---|---|---|
| `logic/Inventory.ts` | `exportData/fromData`；超容量有效 | 复用，不重新套背包准入规则 |
| `application/PetService.ts` | 完整库存/装备 DTO、候选状态校验后恢复 | 会话保留服务引用；不从宠物 UI 拼存档 |
| `application/PetUiAdapter.ts` | 目前适配器调用服务执行开蛋/装备，再通知 UI | 操作入口收拢到应用层，UI 适配器只转发命令和构建表现快照 |
| `logic/Wallet.ts`、`Pickaxe.ts` | 构造时可注入余额/等级；没有完整导出契约 | 补明确 DTO/校验；不把存储依赖放进去 |
| `logic/Exploration.ts` | 有最大深度和解锁 Set，没有导出/恢复；最大深度变化不一定新增解锁 | 独立汇报持久化变化，不能依赖 UI 是否 publish |
| `terrain/SparseWorld.ts` | 稀疏区间删除；`snapshot` 是附近 Worker 输入且可包含 pending | 新增已提交状态导出/恢复；禁止把现有附近 snapshot 当存档 |
| `validation/TerrainStream.ts` | `world.remove → collision/render commit → onExcavated` 在同一同步段 | 成功回调入包后才到达保存边界；不能在 remove 通知里立即保存 |
| `runtime/startGame.ts` | TerrainStream 内部新建 SparseWorld，然后准备出生点 | 注入已恢复的逻辑世界，再启动区域准备；避免渲染过一次新世界才覆盖旧档 |
| `App.tsx` | React 初始化直接构造新会话；退出先卸载 Canvas | 会话初始化前完成读档/验证；退出先冻结业务、保存，再销毁资源 |
| `content/initialAccess.ts` | 当前 9 个地下层均预先解锁供试玩，且与发布 URL 无关 | 试玩访问权与真实探索解锁分离，不偷偷取消现有试玩权限 |

现阶段没有旧版持久化存档需要迁移。运行中的未保存会话不能承诺跨首次刷新保留。

## 3. 实际保存的数据

### 3.1 玩家进度

```ts
type ProgressDataV1 = {
  version: 1;
  wallet: { version: 1; coins: number };
  inventory: InventoryDataV1; // {version:1, capacity, items:{[itemId]:count}}
  pickaxe: { version: 1; level: number };
  pets: PetStateDataV1; // 已有 inventory + equipment DTO，含各自版本
  exploration: {
    version: 1;
    maxDepth: number;
    unlockedDestinationIds: string[];
  };
};
```

| 字段 | 事实来源 | 约束 / 恢复行为 |
|---|---|---|
| `wallet.coins` | Wallet 余额 | 非负安全整数；仅新档初始化 200 金币 |
| `inventory.capacity` | 背包实际容量 | 非负安全整数；不从当前商店档位反推 |
| `inventory.items` | 稳定物品 ID → 数量 | 正安全整数；校验物品 ID；恢复后允许超过容量 |
| `pickaxe.level` | 镐子等级 | 正安全整数；当前公式能安全算出属性 |
| `pets.inventory.pets` | 每只 `{id,speciesId,level}` | 唯一实例 ID；种类存在；首版等级仍为 1 |
| `pets.equipment.slots` | 有序宠物实例 ID / null | 长度符合配置；引用已拥有宠物；不可重复装备同一实例 |
| `exploration.maxDepth` | 真正达到的历史最大深度 | 有限非负数，保留现有到达判定精度 |
| `exploration.unlockedDestinationIds` | 真正获得的解锁 | 稳定 ID、无重复；既得解锁不因以后调整深度而收回 |

不保存：背包 used/full/totalCount、价格、物品体积、镐子实际攻击/攻速、宠物总加成、名称、颜色、概率、UI 排序/选择、蛋台距离。

最大深度和已解锁 ID 都是事实：不要求按当前层深反向验证两者完全一致，也不在读档时根据新配置无条件授予更多解锁。

试玩访问权是会话配置，与持久化的 earned 解锁取并集供传送判断；导出时只存 earned 集合。保持当前预开放层可访问，但不把它们写成“玩家曾挖到这一层”。真正到达时仍可记入 earned。两类来源即使 ID 相同也不能互相抵消。

### 3.2 世界身份与稀疏修改

```ts
type SaveHeadV1 = {
  formatVersion: 1;
  revision: number;       // 数据库提交序号；不是帧号或 Date.now()
  savedAt: number;        // 展示/诊断用时间，不参与并发判断
  world: {
    generationVersion: number;
    seed: number;
    regionEncoding: 1;
  };
  regionCount: number;    // 已持久化修改区域总数，用于检测缺失记录
};

type RegionDataV1 = {
  region: [number, number, number];
  // null = 4096 个索引均删除；非 null 为闭区间 [start,end,...]
  removed: Uint16Array | null;
};
```

持久化区域的边长固定为 16，`regionEncoding:1` 明确编码：

- 区域坐标为格子坐标除以 16 向负无穷取整。
- 局部坐标各为 0..15，索引为 `x + 16 * (y + 16 * z)`，索引范围 0..4095。
- 区间长度必须为偶数，排序、互不重叠、相邻区间规范化合并；空区间不建立区域记录。
- 解码先校验原始类型、整数范围和长度，再构造 TypedArray，避免溢出截断把坏值变成合法索引；区域 key 与值中的坐标必须一致。
- `null` 只能表达整个区域的真实删除，不能用来偷懒表示“本区域部分有效格子删除”。边界区域/含保护层区域不能随意折算成全空。
- 持久化使用显式 `[rx,ry,rz]`，不暴露 SparseWorld 当前硬编码的数字 bucket key。渲染/碰撞区域大小不影响存档编码。
- 保存的区间必须属于当前兼容生成规则下可挖的格子；不能通过坏档删除保护地板。验证只遍历已修改区域，避免扫描 2000 万格的默认世界。
- 世界种子和生成版本确定默认世界，记录只表示删除。默认房间空洞、预挖入口和主题概率表不复制到每份档。
- 当前生成版本为 8。生成版本的范围必须包括：层深/范围、矿种分布、房间开洞、保护层、预挖形状、坐标编码有关规则；任一改变不能只改配置而沿用兼容版本。
- `samples` 验证世界不属于正式世界；专用验收/诊断会话使用隔离空间或显式内存模式，不可读写正式/用户测试档。

修改区域全部恢复到轻量逻辑索引；只在角色附近重建渲染和碰撞。常规美术场景继续遵守原有加载策略。

不保存模型、贴图、合并几何、Collider、Worker 消息/版本、队列、半挖方块 HP、角色精确位置/速度、宠物跟随位置、相机、选择高亮。

首版不存开蛋 RNG 状态：现有 Math.random 无可恢复状态，保存已抽出的宠物结果即可。本期不更换抽奖算法，也不承诺崩溃后重抽相同结果或防回档；世界的 seed 仍保存。日后需要确定性抽奖时，另做版本化随机状态。

## 4. 架构与 API

### 4.1 依赖与归属

```text
逻辑模块 ──DTO──→ GameSession 进度组合
SparseWorld ──已提交删除记录──→ 世界变化跟踪
                         ↓
              SaveCoordinator（保存调度）
                         ↓ SaveStore 接口
              IndexedDbSaveStore（数据库）

SaveBootstrap：获取写权限 → 读档 → 迁移/验证 → 构造会话和逻辑世界
UI：只发业务命令、读取保存状态；不拼档、不直接写数据库
```

建议文件职责（实施时允许合并很小的纯函数文件，不要求每项都建类）：

| 位置 | 责任 |
|---|---|
| 各逻辑模块及其 DTO | 自身 export/fromData；普通数据校验 |
| `application/GameSession.ts` | 持有业务服务、组装 ProgressData、业务命令完成通知 |
| `terrain/WorldSaveCodec.ts` | 稳定区域格式与内部索引转换、验证 |
| `terrain/WorldSaveChanges.ts` | 区域修改序号、捕获/确认脏区域；无数据库依赖 |
| `persistence/saveTypes.ts` | 存档头、写入批次、结果类型；不放游戏数值 |
| `persistence/saveMigrations.ts` | 明确版本链和兼容判定，纯转换函数 |
| `persistence/SaveStore.ts`、`IndexedDbSaveStore.ts` | 存储端口、数据库实现 |
| `persistence/SaveCoordinator.ts` | 合并请求、一次写入在途、确认 revision、重试状态 |
| `persistence/SaveBootstrap.ts` | 读档、新档、候选状态构造与取消清理 |
| `persistence/SaveOwnership.ts` | Web Lock 生命周期；不拥有游戏状态 |
| runtime/App 的窄接入层 | 装配端口、更新末尾检查点、退出时序 |

不新增全局事件总线、通用事务框架、实体注册扫描、继承式 Saveable 基类。`SaveCoordinator` 不认识蛋价、售卖流程、区块合并或 Three.js。

### 4.2 业务端口

当前实现的主要 API（依赖参数省略细节）：

```ts
// 叶模块复用已有风格；小模块可以用纯 DTO 编解码函数。
exportData(): ModuleData;
static fromData(data: unknown, dependencies): Module;

// GameSession：两条明确的构造路径，共享内部装配代码。
static createNew(content): GameSession;
static fromData(data: unknown, content): GameSession;
exportProgress(): ProgressDataV1;
onProgressCommitted(listener: (change: { urgent: boolean }) => void): () => void;
```

- `createNew` 才使用初始金币/背包/镐子配置。`fromData` 不先发新手资源再覆盖。
- `PetService` 保留为会话内部字段；UI 命令通过会话应用端口调用它。成功后报告业务变化，UI 适配器不承担保存通知。
- Wallet/Inventory 等叶模块不主动写存档；售卖的背包扣除与金币增加都结束后由应用层报告一次变化。
- 最深深度增长但没有新解锁也要报告变化；新解锁为 urgent，单纯深度增长为普通变化。
- 目标高亮、当前深度下降、提示文案改变、弹窗关闭不产生持久化通知。
- debug 的状态修改也要走同一应用端口，或只在隔离会话使用。禁止绕过通知偷偷改持久化对象。

### 4.3 世界端口与捕获

```ts
type WorldSaveCapture = {
  regions: readonly RegionDataV1[];
  totalRegionCount: number;
  token: WorldCaptureToken; // 内存令牌：本次各区域修改序号，不写数据库
};

captureChanges(): WorldSaveCapture;
hasUnsavedChanges(): boolean;
acknowledgeChanges(token: WorldCaptureToken): void;
// Bootstrap 对尚未交给运行时的候选世界逐区恢复；初始 dirty 集合为空。
restoreRegion(data: unknown): void;
```

- dirty 跟踪记录修改区域，不依赖渲染常驻表，也不因远处卸载而清除。
- 当前区间更新会建立新数组，可保留旧版本引用；捕获端不能把可被原地修改的 TypedArray 暴露给异步存储。实施时明确只读所有权或复制变化区间。
- `acknowledgeChanges` 只清除仍等于本次捕获序号的区域。写入期间再次修改的同一区域继续 dirty。
- 只保存已经实际删除的记录。Worker 暂存和排队请求不进入 capture。

### 4.4 存储接口

```ts
type SaveBatchV1 = {
  expectedRevision: number | null; // null 表示要求数据库中确实不存在旧档
  head: SaveHeadV1;
  progress: ProgressDataV1;
  regions: readonly RegionDataV1[]; // 变化区域的完整最新记录，不是操作日志
};

interface SaveStore {
  read(): Promise<SaveRead>; // missing / found；失败 reject，found 内容仍按 unknown 校验
  commit(batch: SaveBatchV1): Promise<void>; // complete 才 resolve，失败/SaveConflict reject
  close(): void;
}

// 协调器面向生命周期，不暴露数据库连接给游戏和 UI。
requestSave(urgent: boolean): void;
flush(): Promise<void>; // 成功或 reject；用于显式退出/重试
getStatus(): SaveStatus;
subscribe(listener: () => void): () => void;
stop(): Promise<void>; // 禁止新写入并等待在途完成，不等于 flush
```

`SaveStatus` 区分 idle / dirty / saving / failed / conflicted，只有 transaction.complete 后才更新已保存 revision/时间。格式错误、未知版本、读失败、写失败和多标签页冲突不能都转成 missing。

## 5. 数据库组织与提交规则

每个命名空间一个数据库，首版一个 slot，三个 object store：

| Store | Key | Value |
|---|---|---|
| `head` | `main` | SaveHeadV1 |
| `progress` | `main` | `{revision, data: ProgressDataV1}` |
| `regions` | `[rx,ry,rz]` | `{writtenRevision, data: RegionDataV1}` |

- 数据库名例：`mining:production`、`mining:test`、`mining:acceptance:<runId>`。来自明确发布/测试配置，不能按资源 hash/build 时间每次换名字。
- 同源下路径不隔离 IndexedDB，不能把 `/mining/` 与 `/mining-test/` 当成天然隔离。
- 数据库 schema version、存档 formatVersion、世界 generationVersion 各管一件事，不能混成一个版本。
- `read` 用同一次只读事务读取三类记录，避免混用不同 revision。没有 head 但存在其他记录是损坏，不是新档；progress.revision 必须等于 head.revision，region.writtenRevision 不得超过 head.revision，区域计数一致。
- 一个 readwrite 事务覆盖三个 store：读取当前 head 检查 expectedRevision，再写进度、变化区域、head；revision 从 1 开始逐次 +1。
- 所有编码/异步准备放在创建事务之前；比较 head 和排队写操作在事务活跃的请求回调中完成。事务里不能 await 网络、定时器或无关异步任务。
- 某条 put 成功不代表整个提交成功。以事务 complete 为成功，以 abort/error 为失败；不能吞掉请求错误继续写半份档。
- readwrite 冲突会由 IndexedDB 串行化；expectedRevision 比较与写入必须在同一事务内，不能先查询再另开事务。
- 首版不按帧写、不对整个世界 JSON.stringify，也不建每一镐的无限日志。没有变化不提交。
- 支持时对存档事务请求标准 `durability:'strict'`；不使用非标准 readwriteflush。适配器记录实际支持情况，无法获得强持久性时不宣称断电零丢失。
- regionCount 检查可发现缺失记录等结构损坏；首版不承诺发现所有人为篡改，也不为此建立全档密码学签名。

## 6. 保存时序、失败与退出

### 6.1 稳定检查点

```text
业务操作同步完成 → 标记 progress / world 变化
主线程当前完整调用栈结束 → 同步捕获进度 + 世界变化
离线准备 DTO → 单次数据库事务 → 成功确认捕获令牌
```

挖矿当前是 `world.remove → 渲染/碰撞版本切换 → session.collected`。通知只能标记变化；不能在 world.remove 的中间观察者内立刻 capture。正常请求通过延后的定时任务，在当前完整调用栈结束后捕获，不在业务通知中同步 capture；flush 也只能在完整业务边界调用。无需为存档再增加一个 RAF owner。

同一次同步捕获中不能 await。后续写入可以异步，游戏继续；快照内容保持不变。同一会话始终最多一笔写在途，额外请求合并为待保存标记，不积累完整快照队列。

协调器在收到 `onProgressCommitted` 时递增自己的进度变化序号；捕获令牌包含该序号和 WorldCaptureToken。进度变化序号、区域变化序号是内存确认工具，数据库 head.revision 是提交序号，三者不能混用。会话模块无需保存“数据库已经写到哪一版”。

若捕获 A 后又发生 B：A 成功只能确认 A 的进度序号与区域令牌，B 必须继续保存。A 失败保留所有脏标记，重试捕获当前完整进度与尚未确认的区域，不回滚已经成功的游戏操作。

若实际删除后的入包或资源提交意外抛错，不能把半完成状态当正常存档写出；进入明确错误状态、禁止继续覆盖最后好档。这里采用失败即停止的边界，不在存档阶段发明补发矿物/重造方块的兜底逻辑。异常前的业务数据校验仍归对应模块。

### 6.2 触发与时间边界

- 普通变化：从第一笔未保存变化起，约 2 秒到期安排保存；持续挖矿不能反复重置 debounce 使保存永远不发生。
- 开蛋、售卖、升级、装备、真实新解锁：下一个稳定检查点立即安排保存；同一检查点的多次变化可合并。
- 写入中来的 urgent 请求，在前一笔完成后尽快再捕获提交。普通变化继续按首次未保存变化的约 2 秒期限调度，避免慢存储把持续挖矿放大成连续数据库写入。
- 页面 hidden/pagehide 仅作尽力补存，不依赖 beforeunload，也不恢复暂停/继续或后台模拟玩法。
- “2 秒”是前台正常运行时的调度目标，不是强制杀进程、浏览器冻结、存储缓慢时的零丢失承诺。
- 写失败保留变化，短提示“保存失败”与重试；采用有上限的退避重试，配额/版本等持续错误不每帧轰炸。长期失败期间不创建无限待写快照。

### 6.3 主动退出

1. 禁止新业务命令并重置输入；停止逻辑更新，不继续获得深度或踩圈售卖。
2. 取消尚未提交的挖掘任务；已经提交并入包的操作不撤回。
3. 在稳定边界 flush，等待在途和最终快照完成。
4. 成功后销毁运行时、关闭数据库、释放写锁，再返回游戏列表。
5. 失败时保留会话与旧档，简短提供“重试 / 返回游戏 / 不保存退出”。不能卡死在没有选择的退出页，也不能假称已保存。

不能在 Canvas/世界销毁后才读取背包或矿坑。协调器 `stop` 与会话 `close` 负责结束写入/释放资源，不承担 flush；保存需先明确完成。

## 7. 初始化、版本和多标签页

### 7.1 启动

获取命名空间写锁 → 读取一致记录 → 检查版本 → 迁移纯数据 → 完整校验并构造候选业务对象与逻辑世界 → 交给运行时 → 准备出生点附近地形 → 开放操作。

- 资产下载可与读档并行，但第一批地形 Worker 输入必须使用恢复后的世界。
- 只有所有 store 均为空才创建新档；新档初始状态先提交成功再允许业务操作。
- 无法读档时提供重试/退出；不能猜“新玩家”而发 200 金币并开始写入。
- 取消加载/React 重挂载不能留下重复协调器、监听器、写锁或幽灵写入；晚到的异步结果按 bootstrap 代次失效。
- 不把 React 渲染函数/useState 初始化函数当数据库写入入口。
- 大存档的候选验证可以在开放操作前分片执行并报告加载进度；不得先开放一半恢复的会话。逻辑索引轻量恢复，渲染/碰撞仍只准备附近。

### 7.2 版本策略

- v1 没有历史存档迁移负担，但必须支持“拒绝未知新版本”和纯函数迁移入口。
- 颜色、UI、模型变更通常不影响存档。力量/价格等配置变化用当前配置重新计算，不保存数值配置副本。
- 稳定物品/宠物/楼层 ID 删除或改名、装备槽数变化必须显式迁移，不能丢弃未知条目或截断装备。
- 世界生成版本变化不能把旧删除坐标直接套进新地图，也不能自动清空矿坑只保留玩家进度。首版无迁移器时明确拒绝并保留旧档。
- 兼容迁移在候选数据上执行；验证成功后原子提交新版本，再开放游戏。需要全量替换区域时使用单独迁移路径，事务失败保留原档；常规增量 API 不兼任世界重置。
- 数据库连接收到 versionchange 时停止写入并关闭连接，提示刷新；打开遇到 blocked 时给明确提示，不无限停留在加载条。

### 7.3 单写者

- 用同名 Web Lock 覆盖整个可写会话，从读取存档之前持有到最终保存/关闭结束；不只给每次 put 加锁。
- 使用 `ifAvailable`，第二个标签页明确提示“游戏已在其他标签页打开”，提供重试/返回；不让两个独立进度静默互相覆盖。
- expectedRevision 是第二层校验；发现不一致停止自动覆盖，不自动合并两个矿坑或“取最大金币”。
- 目标浏览器通过能力检测确认 Web Locks。不可用时明确返回不支持的可写初始化结果，不临时实现容易错的 localStorage 心跳锁；兼容替代另行评估。
- 普通 hidden 不主动交接锁，防止切回旧标签页覆盖新会话。pagehide/BFCache 路径将会话写权限失效；恢复时重新获取锁并重新读档，不能继续写冻结前的内存副本。
- pagehide 的失效是禁止新业务和常规定时保存，只允许最后一次尽力 flush，不是立刻假定在途写入已完成。flush 后关闭连接并释放锁；恢复前先排空/取消旧 bootstrap，释放旧所有权，再重新获取。页面终止可能打断这条清理链，所以正常前台自动保存仍是可靠性的基础。
- 后台页面无法释放时，第二页提示关闭原页，不强抢锁；显式退出先完成保存再释放。

## 8. 性能与可靠性边界

- 持久化大小随实际挖掘增长，不随理论体素数线性展开。区间编码不是所有分布都最省；棋盘式碎挖也纳入数据量与读档测试。
- 常规保存成本为当前玩家数据 + 本次修改区域，不能无条件遍历全部历史区域；无变化的区域不复制不重写。
- IndexedDB 异步不代表主线程零成本：DTO 构造、TypedArray 复制和 structured clone 都需计时，游戏帧时间单独检查。
- 记录 capture/入队主线程时间、事务耗时、修改区域数/字节、加载验证耗时、未保存时长。测试用调试接口，正常 UI 不堆统计。
- 在已有基准环境测正常挖掘、集中区域、跨区、碎挖和大量宠物；目标正常保存不引入可见周期卡顿。极端恢复允许显示加载进度，不把大循环藏进首个可操作帧。
- 首版不预先引入数据库 Worker；发现主线程复制/编码确为瓶颈再针对性调整，异步 API 名称本身不能当性能证据。
- 浏览器事务完成和持久存储授权是不同概念。`navigator.storage.persist()` 可降低自动驱逐风险，但可能触发浏览器提示，不在本轮悄悄申请；是否加用户主动入口后续决定。
- 不自动删除旧存档来腾出容量；不以清掉矿坑作为写失败的恢复策略。

## 9. Phase、交付与验收

P5.1–P5.6 已实现，公开验收及未覆盖边界见实施文档。难度是百分制工程判断，不是工时，也不能相加。

| Phase | 交付范围 | 完成条件 | 难度 /100 |
|---|---|---|---:|
| P5.1 业务数据契约 | ProgressData、Wallet/Pickaxe/Exploration 导入导出、会话 new/restore、宠物命令归属、earned 与试玩访问权分离 | 跨模块 round-trip；坏数据不替换会话；200 金币仅新档；超容量不丢物品；纯 UI 变化不标记保存 | 43 |
| P5.2 世界数据契约 | 稳定区域 codec、已提交世界恢复、区域修改序号/capture/ack、TerrainStream 世界注入 | 负坐标/边界/全空/碎区间正确；保护格不可删；pending 不入档；写入期间再修改不被误清脏 | 57 |
| P5.3 存储基础 | 命名空间、三 store、原子 read/commit、revision 比较、格式/版本校验、Web Lock | 注入事务中途失败后仍读到完整旧档；request success 后 abort 不报成功；两标签不双写；未知版本不覆盖 | 61 |
| P5.4 保存调度与业务接入 | 协调器、完整更新后检查点、普通/urgent 通知、串行合并、失败保留、异常禁止覆盖 | 同步业务边界准确；持续挖掘不饿死保存；A 保存中发生 B 不丢；无空闲写；开蛋/售卖/采集一致 | 64 |
| P5.5 加载、退出与轻量 UI | 读档后装配、首次建档、取消/重挂载、退出 flush、hidden/BFCache/versionchange | 恢复之前不开放业务/不生成错误地形；退出不先销毁；失败有退路；锁/连接/监听器无泄漏 | 61 |
| P5.6 公网集成验收 | 公开测试入口、隔离验收档、刷新/退出/崩溃/失败/性能证据、文档更新 | 按下表验证；列清自动验证与实机未知项；不污染用户测试档/正式档 | 52 |

依赖：P5.1 → P5.2 → P5.3 → P5.4 → P5.5 → P5.6。每步先 review 该边界再继续，不把后续 UI 顺手塞进底层阶段。

P5.1/2 可做纯模块测试；任何可试玩接入在场景或交互检查之前先发布公开测试入口。隔离验收可以在既有公开入口使用测试命名空间；若新增独立入口必须加入游戏列表。未经授权不覆盖正式版。当前视觉/交互检查按电脑端执行，不声称完成 iPhone 浏览器持久化可靠性验收。

### 集成验证矩阵

| 场景 | 要验证的结果 |
|---|---|
| 新档、刷新、多次重进 | 第一次 200 金币；消费后余额保持；恢复不额外发放 |
| 矿物背包超容量 | 数量/容量原样保留，占用按当前定义计算 |
| 跨区域连续挖掘 | 掉落与删除对应；刷新后洞仍在；远处卸载不影响保存 |
| 挖掘 pending 时保存/退出 | 没提交的格子与掉落都不入档；已提交的两者一起在档 |
| 开蛋、售卖、升级、装备后刷新 | 每笔操作同时恢复其所有结果，没有扣钱但丢宠物等半份状态 |
| 最大深度增长、真实解锁、试玩预开放 | 深度可存；earned 单独恢复；试玩权限不污染 earned |
| 写 A 阻塞时产生 B | A 成功不清 B，后续恢复包含 B；失败重试也不重复发奖 |
| 实际浏览器 IDB 事务故障 | 即使部分 request 已成功，事务 abort 后三个 store 保持原档 |
| 两标签页、重复挂载、页面后退恢复 | 不双写、不拿过时内存覆盖；清理后可重新获得写权限 |
| 损坏字段/未知 ID/版本/缺失区域 | 显式错误，旧数据原样保留；不误建新档 |
| 只读可用但写配额耗尽 | 会话变化保留，失败可重试；不假报 saved、不自动清空 |
| 异常杀掉标签页 | 恢复最后完成的事务；允许尚未提交的尾部操作丢失，不允许半笔交易 |
| 较大碎挖档和较多宠物 | 记录大小、加载耗时和保存时帧时间；不复制未修改的整个世界 |

## 10. Review 结论与最佳实践对照

本节是当前代码阅读 + 浏览器官方资料核对后的设计自评，不是独立 reviewer 或运行时验收。

**结论：版本化 DTO、应用层一致快照、IndexedDB 多 store 原子事务、单写者、脏区域增量保存，适合本项目。不是把所有“持久化最佳实践”一股脑搬进来。** 不需要服务端、事件溯源、每镐日志或通用存档框架。

评审发现并已纳入正文的关键修正：

| 隐患 | 已写入的处理 | 是否阻塞实施 |
|---|---|---|
| 订阅 UI publish 会漏深度，又因选格频繁保存 | 独立业务完成通知；dirty/checkpoint 分离 | 否，P5.1/4 接入 |
| 宠物服务藏在 UI 适配器调用路径 | 应用层持有/执行命令，表现只转发 | 否，P5.1 局部调整 |
| 试玩全解锁变成永久进度 | effective 与 earned 分开 | 否，默认保留现有试玩访问 |
| 新手初始化后再覆盖旧档 | 明确 createNew/fromData；读档前不建可玩会话 | 否 |
| 地形 snapshot 只有附近且混入 pending | 独立全局逻辑数据契约，存已提交变动区域 | 否 |
| A 保存成功清掉 B 的新变动 | 进度序号 + 每区域捕获令牌比较确认 | 否 |
| IndexedDB 事务自动结束 / 单请求成功被误报 | 事务内不 await 无关任务；只认 complete | 否 |
| 只加每次写入锁，两个旧会话仍轮流覆盖 | 整会话写锁 + 同事务 revision 比较 | 否 |
| 格式版本没变却挪了层深/房间 | 独立世界生成兼容门槛，无迁移时保留并拒绝 | 否，但未来改地图需遵守 |
| 数据库完成被说成永不丢档 | 区分原子性、durability、驱逐与用户清理 | 否，不承诺不存在的保证 |
| 旧文档要求位置/RNG，首版范围含糊 | 明确回地表、半损伤重置、首版不存开蛋 RNG | 否，作为本 Draft 默认方案 |

浏览器机制来源（2026-10-08 查阅；不是本项目已经通过这些验证）：

1. [MDN：Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)：事务范围、同源存储、数据库升级 blocked/versionchange。
2. [MDN：IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction)：active/inactive 生命周期、自动提交、complete/abort 和持久性边界。
3. [MDN：IDBDatabase.transaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction)：标准 durability 的 strict/relaxed/default。
4. [MDN：Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)：同源锁、整段异步任务锁生命周期与 ifAvailable。
5. [MDN：visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)：hidden 是会话结束的合适观察点，不等于异步写入必定完成。
6. [MDN：Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)：best-effort 存储、配额、驱逐、persist 的浏览器差异。

当前没有必须让用户裁决的架构问题；恢复回地表、单档、测试/正式隔离等按本文默认方案推进即可。若以后要精确位置续玩、可切换多档或清档，再单独扩范围。

## 11. 最终难度评估

**总体 60/100，属于中等偏上。** 相比最初粗估 55，增加的主要是现有 UI/业务命令归属调整、试玩解锁来源分离、恢复时世界注入，以及页面/写锁生命周期，读写 IndexedDB 本身不是最大难点。

- 数据契约与单模块恢复：低到中等，已有背包/宠物接口可复用。
- 世界增量与一致保存：中等偏上；最重要是捕获/确认的时序和不把 pending 写进去。
- 启动、退出、多标签页：中等偏上；必须与现有资源释放流程协调。
- UI 工作量小，只接加载和必要错误状态；不扩展宠物背包改版。
- 未来跨世界生成版本的实际地图迁移不包含在 60 分内；本期只建立兼容检查与迁移边界，绝不假称可以自动迁任意旧地图。

实施完成以纯模块测试、真实浏览器数据库故障测试和公开电脑端完整流程证据为准。文档 review 不能替代这些证据。
