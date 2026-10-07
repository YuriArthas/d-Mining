# 宠物 API 与实现阶段 Draft

状态：设计与实现记录。P4A～P4F 已实现，公开验证记录见文末；P4G 球体跟随与独立蛋池扩展已实现，当前复查记录见第 11 节。2026-10-06。

承接 [MVP 的 P4](draft-mining-mvp.md#p4简单宠物)。按 API、数据结构、职责边界和 phase 推进；先实现可独立测试的逻辑，再接挖矿和 UI。难度统一用 100 分制，分数表示实现与验证复杂度，不是完成比例。

## 1. 目标与范围

已确认：宠物通过开蛋获得，主要提供加成；API 与 UI 分离；宠物图片先用文字占位，UI 布局参考现代 Roblox。矿物背包与宠物库存是两个独立模块。

以下是本 draft 提出的首版默认值，已按本轮实施授权落地，尚未进行数值平衡；全部放配置中：

| 项目 | 首版方案 |
| --- | --- |
| 蛋池 | 18 种独立定价的蛋，每蛋 5 种宠物，共 90 种；不设数值档位 |
| 装备 | 3 个槽位；相同种类可以同时装备，同一实例只能占一个槽 |
| 重复获取 | 每次生成独立实例，不自动合并、不转成碎片 |
| 等级 | 保留 `level` 字段，首版仅允许 1；不做升级 API |
| 加成 | 只增加挖矿力量；攻速、售价、容量暂不受影响 |
| 叠加 | 所有已装备宠物的力量百分比相加，再作用于镐子基础力量 |
| 库存 | 首版不设宠物库存玩法上限；入库 API 不做容量拒收 |
| 开蛋 | 单次开 1 个；底层入库支持批量，不因此增加批量开蛋功能 |
| 入库后 | 不自动装备，不静默替换现有宠物；玩家手动装备或“一键最佳” |
| 持久化 | 本期做版本化数据导入/导出，不接浏览器存储 |

首版不做合成、升级、删除 UI、锁定、交易、自动开蛋、保底、宠物战斗、正式宠物模型。球体跟随已接入，正式模型可通过表现配置替换。

## 2. 现有代码的接入点

- `src/game/logic/Inventory.ts`：矿物按种类计数，已经支持批量入库。宠物需要独立身份，因此另建 `PetInventory`，不扩展矿物 `Inventory`。
- `src/game/logic/Wallet.ts`：复用 `getBalance()/debit()`，宠物模块不另存金币。
- `src/game/logic/Pickaxe.ts`：继续只保存镐子等级和基础属性。
- `src/game/application/MiningCombat.ts`：已经注入 `stats(): { power, speed }`，将其接到有效属性读取函数即可。
- `src/game/logic/BlockHealth.ts`：伤害必须是正安全整数；宠物力量需明确整数化后再传入。
- `src/game/application/GameSession.ts`：负责组装依赖与统一发布会话变更，不承担抽奖、排序和装备规则。
- `src/game/world/SurfaceHub.ts`：已有蛋展示摆放，目前不是开蛋系统。展示配置以后引用稳定 `eggId`，不能靠模型名称或摆放索引识别蛋池。

## 3. 数据结构

以下 TypeScript 描述当前契约，具体实现路径见文末。所有返回的对象及嵌套数组只读，调用者不能借助引用修改内部状态。

### 3.1 配置：种类与蛋池

```ts
type PetId = string;       // 单只实例，如 pet-000042
type PetSpeciesId = string; // 种类，如 moss-slime，不能用展示名称当 ID
type EggId = string;
type PetRarity = 'common' | 'rare' | 'epic' | 'legendary';

type PetDefinition = Readonly<{
  id: PetSpeciesId;
  name: string;
  rarity: PetRarity;
  powerBonusBps: number; // 非负安全整数；100 bps = 1%，1000 = 10%
}>;

type EggDefinition = Readonly<{
  id: EggId;
  name: string;
  price: number; // 非负安全整数金币
  outcomes: readonly Readonly<{
    speciesId: PetSpeciesId;
    weight: number; // 正安全整数，概率 = weight / 总权重
  }>[];
}>;

type PetContent = Readonly<{
  pets: readonly PetDefinition[];
  eggs: readonly EggDefinition[];
  equipSlots: number; // 正安全整数，首版 3
}>;
```

配置装配时统一校验：ID 非空且唯一、引用存在、蛋池非空、同一蛋池不重复种类、权重和不溢出、价格/加成合法、装备槽数合法。无效配置直接报错，不自动补宠物或偷偷跳过条目。

逻辑配置不包含 Three.js 对象、模型路径、颜色、UI 坐标。稀有度颜色与未来图片资源放表现映射，通过 `speciesId/rarity` 关联。

### 3.2 运行时：拥有的实例与装备引用

```ts
type PetInstance = Readonly<{
  id: PetId;
  speciesId: PetSpeciesId;
  level: 1; // 首版有意限定；真正做养成时再升级契约
}>;

type PetInventorySnapshot = Readonly<{
  pets: readonly PetInstance[];
  count: number;
}>;

type PetEquipmentSnapshot = Readonly<{
  slots: readonly (PetId | null)[]; // 固定长度，数组下标就是槽位
}>;

type PetBonus = Readonly<{ powerBonusBps: number }>;
type MiningStats = Readonly<{ power: number; speed: number }>;
```

库存内部用 `Map<PetId, PetInstance>` 支持身份查询，不用数组下标作为身份。装备只存 ID，不保存一份宠物副本。库存与装备分别维护缓存快照，仅数据变化时创建新快照。

名字、稀有度、加成从配置读取；不在实例上复制，以免数值修改后出现两份真相。

### 3.3 可序列化 DTO

```ts
type PetInventoryDataV1 = {
  version: 1;
  pets: Array<{ id: string; speciesId: string; level: 1 }>;
};
type PetEquipmentDataV1 = {
  version: 1;
  slots: Array<string | null>;
};
type PetStateDataV1 = {
  version: 1;
  inventory: PetInventoryDataV1;
  equipment: PetEquipmentDataV1;
};
```

只存源数据，不存 `count`、力量总和、可购买状态、UI 选中项、跟随位置或动画进度。槽位容量来自配置，导入的数组长度必须与当前配置一致；以后修改容量时走显式迁移，不能静默截掉宠物。

导入必须先构造候选库存/装备并完成交叉校验，再替换当前状态：重复实例 ID、未知种类、非法等级、重复装备、装备引用未拥有宠物、未知版本等均失败，原状态不动。

这是宠物部分的 DTO，不是完整存档。未来 P5 要将金币、宠物、世界修改与随机状态放在一致的游戏快照中；ID 生成器需在恢复后保证不与现有 ID 冲突。现在不宣称已实现刷新恢复或防回档抽奖。

## 4. 模块 API 与责任

依赖方向：`配置 → 纯逻辑 → 宠物应用服务 → 会话组装/界面适配 → React 与场景`。纯逻辑不导入 React、Three.js、GameSession 或浏览器存储。

### 4.1 PetInventory：只管理拥有关系

```ts
class PetInventory {
  get(id: PetId): PetInstance | null;
  has(id: PetId): boolean;
  getSnapshot(): PetInventorySnapshot;
  add(pets: readonly PetInstance[]): void;
  remove(ids: readonly PetId[]): boolean;
  exportData(): PetInventoryDataV1;
  static fromData(value: unknown): PetInventory;
}
```

- `add`：先检查整个批次，全部合法后一次入库；空批次不做事。批内或已有 ID 冲突、非法数据抛错，整批不写入。没有金币、装备位或容量检查。
- 不拒收有效奖励与拒绝非法数据是两回事：一批可以放任意多只有效宠物；同一实例 ID 重复提交属于调用错误，不能覆盖原宠物。
- `remove`：任一 ID 不存在返回 `false`，全部不变；空批次成功但不触发更新；重复 ID 属于非法参数。首版无删除 UI，保留此底层能力供未来用例组合。
- 只验证实例自身的数据形状；种类是否属于本游戏内容，由应用层/整体恢复校验。库存不认识钱包、蛋池或装备。

### 4.2 PetEquipment：只管理槽位

```ts
type EquipResult =
  | Readonly<{ status: 'equipped'; slot: number }>
  | Readonly<{ status: 'already-equipped'; slot: number }>
  | Readonly<{ status: 'full' }>;

class PetEquipment {
  constructor(slotCount: number);
  getSnapshot(): PetEquipmentSnapshot;
  equip(id: PetId): EquipResult; // 首个空位；满了不替换
  unequip(id: PetId): boolean;   // 返回是否发生变更
  clear(): boolean;
  replace(slots: readonly (PetId | null)[]): boolean;
  exportData(): PetEquipmentDataV1;
  static fromData(value: unknown, slotCount: number): PetEquipment;
}
```

不直接依赖库存；底层只保证槽位长度正确、ID 格式有效、同一 ID 不重复。`replace` 全量验证后一次替换，返回是否有变化，用于一键最佳与恢复。

应用服务在装备前确认拥有该实例。UI 不获得这两个可变容器；不能绕过拥有关系校验。移除宠物的应用命令必须同时清掉对应槽位，最后发布一次变更，不能留下悬空装备引用。

### 4.3 抽奖与属性：纯函数

```ts
function drawEgg(egg: EggDefinition, roll: number): PetSpeciesId;
// roll 是注入随机源产生的 [0, 1) 有限数；按配置顺序累计权重，左闭右开。

function calculatePetBonus(
  equipped: readonly PetInstance[],
  definition: (id: PetSpeciesId) => PetDefinition,
): PetBonus;

function calculateMiningStats(base: MiningStats, bonus: PetBonus): MiningStats;

function selectBestPets(
  owned: readonly PetInstance[],
  definition: (id: PetSpeciesId) => PetDefinition,
  slotCount: number,
): readonly PetId[];
```

首版计算：`power = floor(base.power × (10000 + totalBonusBps) / 10000)`；先叠加，再只取整一次。攻速原样返回。例：基础力量 15，两个宠物分别 +10%、+20%，有效力量为 19；卸下后恢复 15。

不分别取整每只宠物的贡献，也不把加成写回 `Pickaxe`。中间乘除使用 BigInt 避免整数精度丢失，最终力量仍检查为安全整数；超出最终表示范围明确报错，不静默截断到上限。装备变化只影响下一次攻击，不补算旧伤害、不重置冷却。

最佳排序按 `powerBonusBps` 降序，同分按 `id` 的固定字典序升序（不用受语言环境影响的排序）；取前 N 个，剩余槽位清空。首版都为 Lv.1，等级与稀有度不额外参与战力。库存为空时清空装备。

### 4.4 PetService：同步应用命令

```ts
type HatchResult =
  | Readonly<{ status: 'hatched'; eggId: EggId; pet: PetInstance; spent: number }>
  | Readonly<{ status: 'unknown-egg' | 'insufficient-coins' }>;

type EquipOwnedResult = EquipResult | Readonly<{ status: 'not-owned' }>;

type PetServiceDependencies = {
  content: PetContent;
  wallet: Pick<Wallet, 'getBalance' | 'debit'>;
  random: () => number;
  createPetId: () => PetId;
};

class PetService {
  constructor(deps: PetServiceDependencies);
  getInventory(): PetInventorySnapshot;
  getEquipment(): PetEquipmentSnapshot;
  getBonus(): PetBonus;
  hatch(eggId: EggId): HatchResult;
  grant(pets: readonly PetInstance[]): void;
  equip(id: PetId): EquipOwnedResult;
  unequip(id: PetId): boolean;
  equipBest(): boolean;
  unequipAll(): boolean;
  remove(ids: readonly PetId[]): boolean;
  exportData(): PetStateDataV1;
  restoreData(value: unknown): void;
}
```

`grant` 是业务奖励入口，校验种类并批量入库，不收费、不随机、不自动装备。已有奖励不因装备位满而丢失。`remove` 先检查完整批次，再移除实例及其装备引用；不涉及矿物背包。

`hatch` 顺序固定：

1. 检查蛋池存在与当前金币；不足则立即返回，库存不变，不消耗随机数。
2. 使用注入随机源抽出种类，生成 ID；检查随机值、ID 冲突和待入库数据，准备完成的结果。
3. 同一个同步调用内扣款、入库并返回结果；使用现有同步 `Wallet`，没有 `await`，中间不调监听器/动画/可重入回调。扣款返回失败时不入库。
4. 会话在命令完成后统一发布，UI 此时才能播放结果动画。

不引入异步任务、事务框架或通用事件总线。ID 工厂、随机源错误和非法配置属于编程/配置异常，必须在扣款前暴露；测试这些路径不会产生半笔扣款。这里只保证同步业务结算的一致性，不承诺进程崩溃时的数据持久化。

每次 `hatch` 调用都是独立购买。UI 可在结果展示期间禁用按钮，不能把按钮防连点当成 API 幂等保证。关闭界面、离开蛋台、跳过动画均不改变已结算结果，不从动画结束回调发奖励。

首版所有已配置蛋池均可购买，场景接近蛋台只负责打开入口，不给 API 添加距离/碰撞依赖。未来若做蛋池解锁，在应用层增加规则；不能让 React 持有唯一的购买许可判断。

## 5. 面向 UI 的接口

```ts
type PetCardView = Readonly<{
  pet: PetInstance;
  name: string;
  rarity: PetRarity;
  powerBonusBps: number;
  equippedSlot: number | null;
}>;
type EggOfferView = Readonly<{
  id: EggId;
  name: string;
  price: number;
  canAfford: boolean;
  outcomes: readonly Readonly<{
    speciesId: PetSpeciesId;
    name: string;
    rarity: PetRarity;
    probability: number; // [0, 1]；UI 决定百分比的显示精度
    powerBonusBps: number;
  }>[];
}>;
type PetPanelSnapshot = Readonly<{
  coins: number;
  pets: readonly PetCardView[];
  slots: readonly (PetId | null)[];
  bonus: PetBonus;
  baseStats: MiningStats;
  effectiveStats: MiningStats;
  eggs: readonly EggOfferView[];
}>;

interface PetUiApi {
  getSnapshot(): PetPanelSnapshot;
  subscribe(listener: () => void): () => void;
  hatch(eggId: EggId): HatchResult;
  equip(id: PetId): EquipOwnedResult;
  unequip(id: PetId): boolean;
  equipBest(): boolean;
  unequipAll(): boolean;
}
```

UI 接口不暴露 `grant/remove/restoreData`，也不暴露 Wallet 或可变容器。UI 不自己抽奖、扣金币、写宠物状态、计算可装备数量或重写力量叠加公式。预览的 `canAfford` 只用于显示，命令必须按最新余额重查。

界面选中的宠物 ID、分页、展开的蛋池、动画进度属于 React 局部表现状态，不进入存档。布局：顶部装备槽和总加成，中间宠物卡片网格，右侧选中详情与装备按钮，底部“一键最佳/全部卸下”；蛋池页展示价格、概率和结果。卡片用大号名字/文字徽记占位，留出未来统一图片区域；用稀有度色条、清楚的按钮层级与紧凑间距表达 Roblox 风格，不堆满常驻 HUD。

## 6. 会话与生命周期

- `PetService` 不持有事件循环与 UI 订阅；普通类维护状态，纯函数处理计算。
- `GameSession` 持有服务并调用命令，成功变更后用现有 `publish()` 通知。售卖、升级等原有命令仍走原通知出口。
- 新建小型 `PetUiAdapter` 实现 `PetUiApi`，订阅会话并缓存只读面板快照；只在宠物、金币或镐子属性变化时更新。挖矿瞄准、移动和每帧位置变化不能重建整份宠物列表。
- `getSnapshot()` 在无变更时返回相同引用，满足 React 外部 store 语义；监听取消与 adapter 销毁时释放会话订阅。无变化/失败命令不引发宠物视图更新。
- 独立的 `MiningAttributes` 组合基础属性与宠物加成，不属于 UI adapter。挖矿的 `stats` 注入它的读取函数，UI 也只读该结果；装备或镐子变化时更新计算缓存，攻击时直接读取，不在每次敲击时排序库存。
- 内容通过独立 `PetContent` 注入，场景通过 `eggId` 关联；不把宠物种类写进 `SurfaceHub` 或矿层生成器。
- 球体跟随后续只读装备快照，以 `PetId` 管理表现对象的创建/销毁；不拥有宠物身份，不开刚体、寻路或真实宠物灯光。

## 7. Phase 与难度

阶段顺序为 P4A → P4B → P4C → P4D → P4E → P4F。A～D 是 API 与接入，E～F 才做用户界面。可以逐阶段交付，不需要一次实现全部文件。

| Phase | 交付范围 | 验收条件 | 难度 /100 |
| --- | --- | --- | ---: |
| P4A 配置与契约 | ID、种类/蛋池配置、实例与 DTO、配置校验、默认数值 | 独立导入不需要 React/Three；错误引用与非法权重可定位；模型配置只引用 eggId | 24 |
| P4B 库存与装备 | PetInventory、PetEquipment、导入导出、基础纯函数 | 同种多实例、整批入库、重复 ID、满位、装备唯一性、快照不可变和 DTO 往返测试通过 | 39 |
| P4C 开蛋应用服务 | PetService、注入 RNG/ID、同步结算、最佳装备、整体恢复 | 权重边界可复现；不足不扣款；非法 ID 不扣款；整批移除无悬空装备；坏存档不替换当前状态 | 48 |
| P4D 挖矿与会话接入 | 有效属性读取、单一通知出口、PetUiAdapter | 基础镐子不变；装备/卸下真实改变伤害；冷却与背包逻辑不变；售卖后可购买状态刷新；无逐帧全库存计算 | 46 |
| P4E 文字宠物面板 | 网格、详情、装备槽、最佳/卸下、空状态 | UI 仅调用 PetUiApi；重复宠物可区分；满位明确反馈；关闭再打开不丢状态 | 38 |
| P4F 蛋区入口与结果展示 | 现有蛋台绑定 eggId、价格/概率、购买与轻量结果展示 | 钱币→开蛋→装备→挖矿闭环；关窗/离开不丢奖励；重新挂载 UI 不重复购买 | 42 |
| P4G 球体跟随（已实现） | 球体 + LVL，少量装备宠物跟随 | 只读装备；无物理/寻路；卸下与退出释放对象；不阻塞 A～F | 30 |

总体难度：**52/100**，不是各阶段相加。主要难点是跨库存/装备的一致性、开蛋扣款边界、现有伤害整数约束和 UI 快照生命周期；抽奖公式与卡片绘制本身较简单。复杂养成、持久化与大量美术均不在本轮，因此没有必要引入通用能力系统或事务基础设施。

P4D 以后产生可试玩变化时，先发布到公开 [Mining 测试版](https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html)，再做电脑端交互验证，并保留游戏列表入口；不覆盖正式版。API 的自动测试、公开版本可操作证据、用户视觉认可分别记录，互不替代。设计文档本身不需要发布游戏。

## 8. 实施前自检与必要测试

| 边界 | 要证明的行为 |
| --- | --- |
| 奖励与入库 | 批量 grant 不受装备满位影响；全部校验成功再写入；同种不同 ID 合法 |
| 装备与拥有关系 | 未拥有不能装备；同实例不能占两槽；满位不静默替换；移除自动清理对应装备 |
| 随机边界 | 0、每个累计权重边界、接近 1；非法随机数报错；不靠少量随机统计测试概率 |
| 钱币结算 | 金币恰好够、不足、ID 冲突；成功恰扣一次/入库一次；关闭动画不执行第二次命令 |
| 最佳装备 | 少于槽数、同分、多只同种、空库存；同输入顺序不同也得到相同选择 |
| 加成与挖矿 | 叠加后单次向下取整；取整后伤害是正安全整数；卸下恢复；冷却和已有方块伤害保留 |
| 数据恢复 | DTO 往返、重复 ID、未知种类/版本、错槽数/悬空引用；失败不改变活状态 |
| UI 生命周期 | 钱币改变刷新 offer；普通瞄准不重建宠物列表；重挂载不重复订阅或购买 |

实现以简单类与纯函数组合为主，不设继承体系。模块只接收自身需要的输入，不依赖完整 GameSession。未来加入新的奖励来源、蛋池或美术时，应分别通过 `grant`、内容配置、表现映射扩展，不去修改库存与挖矿算法。


## 9. 实现落点与验证记录（2026-10-06）

| 职责 | 文件 |
| --- | --- |
| 可调整种类、价格、概率、槽位 | `src/game/content/pets.ts` |
| 类型、校验、库存、装备与纯计算 | `src/game/logic/pets/` |
| 同步开蛋、奖励、拥有关系、整体恢复 | `src/game/application/PetService.ts` |
| 有效挖矿属性及缓存 | `src/game/application/MiningAttributes.ts` |
| UI 只读快照、命令、订阅适配 | `src/game/application/PetUiAdapter.ts` |
| 文字宠物面板、蛋台面板与样式 | `src/game/ui/pets/` |
| 蛋台模型的业务 ID 与触发区 | `src/game/world/SurfaceHub.ts`、`src/game/world/sessionContent.ts` |
| 规则与会话回归测试 | `tools/tests/pets.test.mjs` |
| 公开电脑交互检查脚本 | `tools/pets/check-public.cjs` |

初版数值（现已由第 11 节扩展）：原野蛋 10 金币，苔团/矿洞鼹鼠/琥珀狐/晶羽猫头鹰/月光幼龙的概率分别为 40/30/20/8/2%，力量加成分别为 10/15/25/40/75%。3 个装备位，所有宠物 Lv.1。现有蛋展示模型先统一绑定同一个原野蛋池，不根据模型颜色猜测奖励。

面板按 24 只分页，只有可见页创建卡片 DOM；不在每帧刷新库存。每个蛋上方常驻立体名称与价格，靠近后再出现“E / 点击查看”入口；主动打开居中开蛋弹窗，每只宠物的抽取概率直接显示在头像下方，无折叠开关；属性在宠物详情与开蛋结果中显示。离开蛋台后入口与开蛋弹窗关闭；背包旁保留独立“宠物”按钮。开蛋结果页关闭不影响已经入库的宠物，再次打开 UI 不重复结算。

自动检查：新增 15 项宠物测试，全量 312 项通过；TypeScript/Vite 构建通过。公开版本的资源哈希由发布脚本逐一核对，正式 Mining 未改变。公开电脑浏览器已验证：空库存、余额不足、实际挖矿售卖获得 40 金币、购买 4 次、重复宠物、装备满位、一键最佳、卸下恢复、关闭结果后离开再返回、重新打开不重复奖励。最终公开复验抽到的最佳组合为 +125%，力量从 10 到 22（统一向下取整）、攻速仍为 2；另验证实际命中伤害不超过剩余血量。随机结果不是固定测试赠送。

运行环境为无硬件 GPU 的桌面 Chromium/SwiftShader，使用现有诊断的单帧 fenced 提交控制软件渲染队列，不能作为真机性能结论。报告与截图位于 `artifacts/pets/`，视觉质量仍由用户验收。

未实现：浏览器存档、宠物养成；当前数据只在本次游戏会话中保留。导入导出 API 已具备，不等于存档功能已完成。


## 10. Roblox 交互修订（2026-10-06）

产品定位是 Roblox 游戏移植到 Web，Web 是运行载体，不是套用网站侧边面板的理由。

- 场景层：每个蛋上方的名称与价格常驻，不依赖接近状态；使用有厚度的文字，不添加信息板。18 个蛋台共用文字几何，采用实例绘制，不生成 18 张贴图。
- 接近层：只在当前蛋台上方出现一个 E/点击入口，随相机投影移动；离开或目标在视野外时隐藏，不贴到屏幕边缘。玩家仍可移动、观察，不自动抢焦点。
- 交互层：主动查看后打开紧凑居中弹窗，直接显示宠物头像、名称、抽取概率、蛋价与开蛋操作；不提供概率折叠按钮。
- 结果层：只显示本次获得的宠物、加成及下一步操作；完整装备管理仍在宠物背包。
- 技术边界：PetService 与结算 API 不变；场景配置新增独立蛋台 ID 与提示锚点，同一蛋池的不同蛋台不能共用位置。投影复用现有帧循环，不逐帧驱动 React，不新增 RAF 循环。

验证：新增文字实例共享、投影越界隐藏、同池不同蛋台锚点切换三项测试，全量 315 项通过。公开电脑检查包含靠近不自动弹窗、E 与点击查看、居中布局、详情按需展开、开蛋/装备闭环；完整开蛋回归见 `artifacts/pets/public-report.json`，蛋台交互复查见 `artifacts/pets/egg-layout-report.json`，均通过。最新修订为 18 个蛋台均常驻两行立体字，合计 4 次绘制、37,296 个三角面；蛋模型与其他场景不按距离裁剪。最后一轮文字显示调整后的 18 项定向测试也通过。

游戏根容器统一在捕获阶段阻止浏览器默认右键菜单，覆盖场景、HUD、按钮与弹窗；不拦截鼠标右键拖动观察。

### 游戏界面精简

蛋弹窗不重复显示持有金币，不保留常驻说明栏；仅在操作失败时显示必要反馈。宠物界面移除装饰副标题、实例编号与加成计算说明，保留名称、稀有度、力量和装备操作。关闭按钮固定在标题栏右上角，叉号使用居中 SVG，避免字体基线及标题高度引起偏移。

公开测试版的 UI 专项检查通过：持有金币提示不再出现；详情展开前后，关闭按钮相对标题栏的右侧/顶部偏移与叉号中心偏移均为 0；关闭点击、右键屏蔽和离开蛋台正常。此次服务器 SwiftShader 的绘制等待及截图超时，最终以公开页面的 DOM 几何和实际交互验证，未完成新版截图验收；记录见 `artifacts/pets/egg-layout-report.json`（`uiOnly: true`）。


## 11. 独立蛋池、圆形头像与球体跟随

每个蛋台绑定独立 eggId；售价、概率和力量均显式配置，不按展台行号、稀有度或所谓档位生成。台阶的层数仅是场景排布。当前数值为可玩初值，未作为经济平衡验收。各蛋均可直接用金币购买，不新增深度锁。

| 蛋 | 金币价格 | 宠物（按池中顺序） | 力量加成 | 概率 |
| --- | ---: | --- | --- | --- |
| 原野蛋 | 10 | 苔团、矿洞鼹鼠、琥珀狐、晶羽猫头鹰、月光幼龙 | +10% / +15% / +25% / +40% / +75% | 40% / 30% / 20% / 8% / 2% |
| 卵石蛋 | 35 | 石团、砂鼠、斑岩兔、青石龟、磐岩熊 | +16% / +23% / +36% / +60% / +100% | 42% / 28% / 20% / 8% / 2% |
| 铜矿蛋 | 95 | 铜团、铜尾鼠、赤铜狐、黄铜鸟、铜角牛 | +25% / +35% / +55% / +85% / +140% | 38% / 32% / 20% / 8% / 2% |
| 琥珀蛋 | 180 | 蜜团、琥珀蜂、蜜蜡兔、金翅蝶、琥珀狮 | +34% / +48% / +75% / +115% / +185% | 45% / 25% / 19% / 9% / 2% |
| 潮汐蛋 | 280 | 水团、泡泡鱼、珊瑚蟹、浪花鲸、潮汐龙 | +40% / +60% / +95% / +145% / +240% | 40% / 30% / 18% / 10% / 2% |
| 火花蛋 | 450 | 火团、炭球鼠、火尾狐、赤焰鸟、火花龙 | +50% / +75% / +115% / +180% / +290% | 44% / 28% / 18% / 8% / 2% |
| 蘑菇蛋 | 120 | 菇团、伞菇鼠、绒菇兔、荧光蛙、蘑菇鹿 | +28% / +40% / +62% / +100% / +160% | 40% / 33% / 18% / 7% / 2% |
| 白银蛋 | 600 | 银团、银尾鼠、银耳兔、银羽鹰、银角鹿 | +60% / +85% / +135% / +210% / +340% | 40% / 30% / 20% / 8% / 2% |
| 水晶蛋 | 900 | 晶团、晶壳虫、紫晶狐、晶羽鹤、水晶龙 | +75% / +110% / +165% / +255% / +410% | 43% / 29% / 18% / 8% / 2% |
| 冰霜蛋 | 1700 | 雪团、冰尾鼠、雪绒兔、冰羽鹰、霜角熊 | +100% / +145% / +220% / +345% / +550% | 40% / 30% / 20% / 8% / 2% |
| 翡翠蛋 | 2400 | 翠团、玉壳虫、翠尾狐、碧羽雀、翡翠鹿 | +125% / +180% / +280% / +430% / +680% | 46% / 26% / 18% / 8% / 2% |
| 月光蛋 | 3600 | 月团、月耳兔、月影猫、月羽枭、月冠龙 | +150% / +225% / +340% / +520% / +850% | 40% / 31% / 19% / 8% / 2% |
| 遗迹蛋 | 2100 | 砂团、石纹鼠、古印猫、符文鹰、遗迹兽 | +115% / +170% / +255% / +400% / +650% | 42% / 30% / 18% / 8% / 2% |
| 熔岩蛋 | 4800 | 熔团、熔壳虫、岩浆蜥、熔翼蝠、熔岩龙 | +180% / +265% / +400% / +620% / +1000% | 40% / 30% / 19% / 9% / 2% |
| 化石蛋 | 6500 | 骨团、骨尾鼠、化石龟、骨翼鸟、远古龙 | +210% / +310% / +470% / +730% / +1150% | 43% / 29% / 18% / 8% / 2% |
| 齿轮蛋 | 9500 | 铁团、发条鼠、齿轮猫、机械鹰、钢铁熊 | +250% / +365% / +560% / +850% / +1350% | 40% / 32% / 18% / 8% / 2% |
| 星辉蛋 | 14500 | 星团、星耳兔、星尾狐、星羽鲸、星辉龙 | +290% / +430% / +650% / +1000% / +1600% | 45% / 27% / 18% / 8% / 2% |
| 地心蛋 | 22000 | 核团、辉壳虫、地心狮、耀羽凰、地心巨龙 | +340% / +500% / +760% / +1200% / +1900% | 40% / 30% / 20% / 8% / 2% |

职责：`content/pets.ts` 仅含玩法数值，`content/petAppearance.ts` 含球体颜色、简称、尺寸和展台外观映射。`PetPortrait` 以 CSS 圆形复用同一颜色与简称，无图片下载和独立 WebGL 上下文。`PetFollowers` 只接收装备实例投影，以实例 ID 维护对象；共享球体几何，不启用刚体、寻路、阴影或真实灯光。更新使用现有帧循环，装备改变时同步对象，卸下与退出释放资源；大距离传送立即重置跟随队列。

三个装备位与百分比相加规则保持不变。所有宠物仍为 Lv.1，不含升级、合成、自动开蛋或自动装备。新增 3 项回归覆盖 18 蛋独立扣款及完整抽取池、表现资源生命周期、跟随插值和传送重置；全量 318 项通过。

公开发布与验收记录：已发布 Mining 测试版并保持正式入口不变。电脑公开回归通过：原野蛋/卵石蛋切换显示各自价格及奖励，真实采矿出售 40 金币，开蛋四次，装备满位、一键最佳、全部卸下、重开背包、实际伤害加成与传送后跟随重置。运行时无 pageerror；截图包含圆形头像、宠物背包和矿坑前的三个跟随球体，名称与等级独立排列。报告 `artifacts/pets/public-report.json`，截图 `egg-offer.png`、`equipped.png`、`followers.png`。服务器 Chromium/SwiftShader 使用测试脚本的 flush 和 fenced 提交，不作为真机性能证据。18 个常驻蛋台标签共 42,432 三角面、72 次绘制，不按距离隐藏。

## 12. 蛋台立体文字合批

已将 18 个蛋台的 36 行文字合为一个几何体、一个顶点色材质，全部入镜时由 72 次绘制降为 1 次。每顶点保存该行文字的中心，vertex shader 在相机空间添加原有字形偏移；保留原位置、字形厚度及正侧面颜色，无贴图化、无距离隐藏。去除每帧实例矩阵更新；整个批次使用包住所有旋转方向的静态边界。临时几何/材质构造后释放，最终资源由原有场景生命周期释放。文字三角面总量仍为 42,432。

相同公开入口、960×540 视口、无装备宠物，四个固定视角的 draw calls：

| 视角 | 修改前 | 修改后 | 提交三角面（前 → 后） |
| --- | ---: | ---: | ---: |
| 出生点 | 259 | 252 | 349,322 → 387,642 |
| 蛋区 | 181 | 130 | 184,291 → 196,431 |
| 矿坑 | 111 | 111 | 198,815 → 198,815 |
| 回看广场 | 247 | 232 | 208,219 → 241,199 |

合批后按整组视锥剔除，会多提交一部分不在画面中的文字三角；没有增加模型面数或可见片元。这是减少绘制提交与粗化剔除粒度的取舍，不声称此次证明手机帧率提升。数据包含 1 次调色 pass，反射 pass 为 0。剩余 draw calls 主要仍需另行分析场景物件，不把“最多减少 71 次”当作每个视角都减少 71 次。

验证：5 项定向测试通过，逐顶点、逐索引及颜色比对原文字，检查旋转后的边界和资源释放；构建通过。先发布 Mining 测试版后，公开运行 4 视角统计并检查蛋区截图，shader/页面无错误，文字仍常驻并朝向镜头。记录 `artifacts/pets/draw-counts-before-batch.json`、`draw-counts-after-batch.json`、`egg-labels-batched.png`；复测脚本 `tools/pets/check-drawcalls.cjs`。正式版未覆盖。


## 13. 初始金币与直接显示概率

新游戏初始 200 金币，由 SessionContent.initialCoins 配置，在 GameSession 创建钱包时初始化一次；不由 UI 发放，不因重复靠近、开关弹窗或订阅刷新再次发放。按 E 或点击打开蛋界面，直接显示每只宠物的概率；删除“查看概率与属性”开关。界面只保留头像、名字、概率、价格和开蛋操作，力量属性在宠物详情与开蛋结果查看。

本轮验证：全量 323 项测试通过；公开电脑版确认新局余额 200，E 弹窗直接显示 40%/30%/20%/8%/2%，不存在折叠按钮。购买原野蛋后余额 190，返回蛋台、离开再打开仍为 190；右键屏蔽与关闭按钮定位回归通过。报告 `artifacts/pets/egg-layout-report.json`，截图 `artifacts/pets/egg-offer.png`。宠物背包的装备、整理与界面重构仍处于讨论阶段，本轮未改动。
