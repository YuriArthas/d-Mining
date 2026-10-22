import { Onboarding } from '../logic/Onboarding.ts';
import { EquipmentCollection } from '../logic/EquipmentCollection.ts';
import { shopTools, shopBackpacks, type ShopCategory } from '../content/shopCatalog.ts';
import { WorldProgress } from '../logic/WorldProgress.ts';
import { MineralReservation } from '../logic/MineralReservation.ts';
import { WORLD_REQUIREMENTS, worldRequirement, worldAtZ, worldAtFeet, worldSpawn, type WorldId } from '../content/worldJourney.ts';
import { JOURNEY_TOOL_PRICES, JOURNEY_BACKPACKS } from '../content/journeyResources.ts';
import { ChallengeBoard } from '../logic/ChallengeBoard.ts';
import { Rewards, type RewardOptions, type RewardClaimResult } from '../logic/Rewards.ts';
import { stageCoinReward, type OnlineRewardMinutes } from '../content/rewards.ts';
import { STAGES } from '../content/progression.ts';
import { CAPSULE_MACHINE_ZONE } from '../content/feedbackFacilities.ts';
import { selectGuide, type GuideTarget } from './OnboardingGuide.ts';
import type { ProgressDataV1 } from './SessionProgress.ts';
import { versionOne } from '../logic/data.ts';
import { PetCommands } from './PetCommands.ts';
import type { SessionContent, Destination, EggStation } from "./SessionContent.ts";
import { PetService } from "./PetService.ts";
import { PetUiAdapter } from "./PetUiAdapter.ts";
import { MiningAttributes } from "./MiningAttributes.ts";
import { Exploration } from "../logic/Exploration.ts";
import { playerDepthAtFeet } from "../logic/PlayerDepth.ts";
import { Inventory } from "../logic/Inventory.ts";
import { Wallet } from "../logic/Wallet.ts";
import { ZoneDetector } from "../logic/ZoneDetector.ts";
import { Mining } from "./Mining.ts";
import { quoteSale, sellAll } from "./Sale.ts";
import { BACKPACK_TIERS, backpackOffer } from "./BackpackUpgrade.ts";
import { Pickaxe, pickaxeStats } from "../logic/Pickaxe.ts";
import { MiningCombat } from "./MiningCombat.ts";
import { pickaxeOffer } from "./PickaxeUpgrade.ts";
import { oreDrops, oreDefinition, itemDefinition, ORE_ITEMS, itemVolume, itemPrice } from "./items.ts";
import type { Coord } from "../terrain/SparseWorld.ts";
export type WorldCommands = {
  cell(target: Coord): number | null;
  canMine?(target: Coord): boolean;
  pending(target: Coord): boolean;
  mine(targets: readonly Coord[]): boolean;
  cancelMining(): void;
  returnToSurface(): void;
  /** Teleport; `lookAt` turns the camera toward what the player came to use. */
  travelTo?(feet: Coord, lookAt?: Coord): void;
};
export type SessionFeedback =
  | Readonly<{ type: 'sold'; coins: number; count: number }>
  | Readonly<{ type: 'purchased' }>
  | Readonly<{ type: 'reward' }>
  | Readonly<{ type: 'hatched'; tier: number; auto: boolean }>
  | Readonly<{ type: 'unlocked' }>
  | Readonly<{ type: 'denied'; reason: 'locked' | 'full' | 'coins' }>;

export class GameSession {
  private readonly equipment: EquipmentCollection;
  private readonly bagCatalog;
  private toolCatalog;
  private requestedShop = false;
  private readonly worldProgress: WorldProgress;
  private readonly reservations: MineralReservation;
  private currentWorld: WorldId = 1;
  private atMineEntrance: WorldId | null = null;
  private readonly explorations = new Map<WorldId, Exploration>();
  private get exploration() { return this.explorations.get(this.currentWorld)!; }
  private hasDestination = (id: string) => [...this.explorations.values()].some(e => e.has(id));
  private readonly homes: {worldId:WorldId;detector:ZoneDetector}[];
  private toolOffer() {
    if (!this.content.journey) return pickaxeOffer(this.equipment.toolLevel,this.wallet.getBalance());
    const level=this.equipment.toolLevel, price=JOURNEY_TOOL_PRICES[level] ?? 0;
    const next=level<30?pickaxeStats(level+1):null;
    return Object.freeze({next,price,canAfford:!!next&&this.wallet.getBalance()>=price});
  }
  private bagOffer() {
    if (!this.content.journey) return backpackOffer(this.equipment.backpackCapacity,this.wallet.getBalance());
    const next=JOURNEY_BACKPACKS.find(t=>t.capacity>this.equipment.backpackCapacity)??null;
    return Object.freeze({next,canAfford:!!next&&this.wallet.getBalance()>=next.price});
  }
  private readonly rewards: Rewards;
  private readonly machineZone = new ZoneDetector(CAPSULE_MACHINE_ZONE);
  private atMachine = false;
  private autoHatchEgg: string | null = null;
  private autoHatchElapsed = 0;
  private lastAutoHatch: Extract<import('./PetService.ts').HatchResult, {status:'hatched'}> | null = null;
  private onlineAccumulated = 0;
  private rewardEffects = {mining:false,travel:false,autoHatch:false,speed:false,luck:false};
  private syncRewardEffects() {
    const r=this.rewards.getSnapshot();
    this.rewardEffects={...r.permanent,speed:r.timed.speed>0,luck:r.timed.luck>0};
  }
  getMovementMultiplier = () => this.rewardEffects.speed ? 2 : 1;
  private baseStatsKey = '';
  private cachedBaseStats = pickaxeStats(1);
  private baseMiningStats = () => {
    const level=this.pickaxe.getSnapshot().level, boosted=this.rewardEffects.mining;
    const key=`${level}:${boosted}`;
    if(key!==this.baseStatsKey){this.baseStatsKey=key;this.cachedBaseStats=pickaxeStats(level,boosted?1.5:1);}
    return this.cachedBaseStats;
  };
  private readonly challengeBoard: ChallengeBoard;
  private readonly pickupListeners = new Set<(batch: readonly {itemId:string;count:number}[]) => void>();
  onOreCollected = (listener: (batch: readonly {itemId:string;count:number}[]) => void) => {
    this.pickupListeners.add(listener);
    return () => { this.pickupListeners.delete(listener); };
  };
  private readonly feedbackListeners = new Set<(event: SessionFeedback) => void>();
  /** Moments worth a sound or a flourish: sales, purchases, rewards, hatches, unlocks and refusals. */
  onFeedback = (listener: (event: SessionFeedback) => void) => {
    this.feedbackListeners.add(listener);
    return () => { this.feedbackListeners.delete(listener); };
  };
  private feedback(event: SessionFeedback) { for (const listener of this.feedbackListeners) listener(event); }
  private lastRefusal = -Infinity;
  /** Refusals repeat at most every 1.2 s, so holding a finger on a block does not buzz. */
  private refuse(reason: 'locked' | 'full') {
    const now = this.clock();
    if (now - this.lastRefusal < 1.2) return;
    this.lastRefusal = now;
    this.feedback({ type: 'denied', reason });
  }
  private petTier(pet: { speciesId: string }) { return ['common', 'rare', 'epic', 'legendary'].indexOf(this.petService.catalog.pet(pet.speciesId).rarity); }
  private requestedEgg: string | null = null;
  readonly pets: PetUiAdapter;
  private readonly onboarding: Onboarding;
  private guideLocation: 'surface'|'mine'|'room'|null = null;
  private nearMine = false;
  private atMine = false;
  private guideRoomId: string | null = null;
  private guideCompletionPending = false;
  private readonly petService: PetService;
  private progressListeners = new Set<(change: { urgent: boolean }) => void>();
  suspended = false;
  setSuspended(value: boolean) { this.suspended = value; if (value) { this.world?.cancelMining(); this.stopAutoHatch(); } }
  onProgressCommitted = (listener: (change: { urgent: boolean }) => void) => {
    this.progressListeners.add(listener);
    return () => { this.progressListeners.delete(listener); };
  };
  private committed(urgent: boolean) {
    if (this.petService.getEquipment().slots.some(id=>id!==null)) this.onboarding.record('equippedOnce');
    if (this.onboarding.settle(this.learningEvidence())) this.guideCompletionPending = true;
    for (const listener of this.progressListeners) listener({ urgent }); }
  exportProgress(): ProgressDataV1 {
    return { version: 1 as const, equipment:this.equipment.exportData(), rewards:this.rewards.exportData(), challengeBoard:this.challengeBoard.exportData(), wallet: this.wallet.exportData(), inventory: this.inventory.exportData(),
      onboarding: this.onboarding.getSnapshot(), pickaxe: this.pickaxe.exportData(), pets: this.petService.exportData(), exploration: this.explorations.get(1)!.exportData(),
      ...(this.content.journey?{worldProgress:this.worldProgress.exportData(),reservations:this.reservations.exportData(),worldExploration:Object.fromEntries([...this.explorations].map(([id,e])=>[id,e.exportData()]))}:{}) };
  }
  static createNew(content: SessionContent) { return new GameSession(content); }
  static fromData(data: unknown, content: SessionContent) { return new GameSession(content, 50, undefined, {}, versionOne(data)); }

  private readonly miningAttributes: MiningAttributes;
  private readonly eggStations: { station: EggStation; detector: ZoneDetector }[];
  private eggStation: EggStation | null = null;
  private eggId: string | null = null;
  private inventory: Inventory;
  private wallet: Wallet;
  private world: WorldCommands | null = null;
  private readonly content: SessionContent;
  private readonly zones: ZoneDetector[];
  private readonly portals: { id: string; detector: ZoneDetector }[];
  private readonly home: ZoneDetector;
  private readonly shops: { id: string; detector: ZoneDetector }[];
  private atHome = false;
  private shopId: string | null = null;
  private depth = 0;
  private inSellZone = false;
  private notice = "";
  private listeners = new Set<() => void>();
  private mining: Mining<Coord, { kind: number }>;
  private pickaxe = new Pickaxe();
  private combat: MiningCombat<Coord>;
  private targetCell: Coord | null = null;
  private targetView: Readonly<{
    key: string;
    name: string;
    hp: number;
    maximum: number;
    volume: number;
    price: number;
    requiredLevel: number;
    locked: boolean;
  }> | null = null;
  private lastHit = 0;
  private clock: () => number;
  private snapshot;
  constructor(
    content: SessionContent,
    capacity = 50,
    clock: () => number = () => performance.now() / 1000,
    petDependencies: { random?: () => number; createPetId?: () => string; rewards?: RewardOptions } = {},
    saved?: unknown,
  ) {
    this.content = content;
    const data = saved === undefined ? null : versionOne(saved);
    this.worldProgress = new WorldProgress(data?.worldProgress);
    this.reservations = new MineralReservation(data?.reservations,id=>ORE_ITEMS.some(r=>r.itemId===id));
    this.homes = (content.homes??[]).map(h=>({worldId:h.worldId,detector:new ZoneDetector(h.zone)}));
    this.challengeBoard = new ChallengeBoard(Math.random, data?.challengeBoard);
    this.rewards = data?.rewards === undefined ? new Rewards(petDependencies.rewards) : Rewards.fromData(data.rewards, petDependencies.rewards);
    this.syncRewardEffects();
    this.wallet = data ? Wallet.fromData(data.wallet) : new Wallet(content.initialCoins ?? 0);
    this.pickaxe = data ? Pickaxe.fromData(data.pickaxe) : new Pickaxe();
    this.inventory = data ? Inventory.fromData(data.inventory, itemVolume) : new Inventory(capacity, itemVolume);
    this.equipment = new EquipmentCollection(this.pickaxe.getSnapshot().level,this.inventory.capacity,data?.equipment);
    this.toolCatalog = shopTools(!!content.journey,this.equipment.toolLevel);
    this.bagCatalog = shopBackpacks(!!content.journey);
    if (content.journey) {
      const savedExplorations=data?.worldExploration as Record<string,unknown>|undefined;
      if(savedExplorations!==undefined&&(!savedExplorations||typeof savedExplorations!=='object'||Array.isArray(savedExplorations)))throw Error('世界探索记录错误');
      for (const w of WORLD_REQUIREMENTS) {
        const destinations=content.destinations.filter(d=>(d.worldId??1)===w.id), saved=savedExplorations?.[w.id]??(w.id===1?data?.exploration:undefined);
        this.explorations.set(w.id,saved===undefined?new Exploration(destinations):Exploration.fromData(saved,destinations));
      }
    } else this.explorations.set(1,data ? Exploration.fromData(data.exploration, content.destinations, content.initiallyUnlocked) : new Exploration(content.destinations, content.initiallyUnlocked));
    const petService = new PetService({
      content: content.petContent ?? { pets: [], eggs: [], equipSlots: 3 },
      wallet: this.wallet,
      hasDestination: this.hasDestination,
      lucky: () => this.rewardEffects.luck,
      random: petDependencies.random ?? Math.random,
      createPetId: petDependencies.createPetId ?? (() => crypto.randomUUID()),
    });
    this.petService = petService;
    if (data) petService.restoreData(data.pets);
    this.onboarding = new Onboarding(data?.onboarding, data !== null, this.learningEvidence());
    this.miningAttributes = new MiningAttributes(this.baseMiningStats, petService.getBonus);
    this.pets = new PetUiAdapter(petService, {
      balance: () => this.wallet.getBalance(),
      baseStats: this.baseMiningStats,
      effectiveStats: this.miningAttributes.getSnapshot,
      commands: this.withHatchFeedback(new PetCommands(petService, () => { this.requestedEgg=null; this.committed(true); this.publish(); }, () => !this.suspended, id => !this.content.eggStations?.length || this.eggId===id)),
      subscribe: this.subscribe,
    });
    this.eggStations = (content.eggStations ?? []).map(station => {
      if (!petService.catalog.egg(station.eggId)) throw Error(`蛋台引用未知蛋池: ${station.eggId}`);
      return { station, detector: new ZoneDetector(station.zone) };
    });
    this.zones = content.sales.map((zone) => new ZoneDetector(zone));
    this.portals = content.portals.map((p) => ({
      id: p.id,
      detector: new ZoneDetector(p.zone),
    }));
    this.home = new ZoneDetector(content.home);
    this.shops = content.shops.map((p) => ({
      id: p.id,
      detector: new ZoneDetector(p.zone),
    }));
    this.clock = clock;
    this.mining = new Mining(
      this.inventory,
      (targets) => this.world?.mine(targets) ?? false,
      oreDrops,
    );
    this.combat = new MiningCombat({
      isFull: () => this.inventory.isFull(),
      stats: this.miningAttributes.getSnapshot,
      level: () => this.pickaxe.getSnapshot().level,
      read: (cell) => {
        const kind = this.mineableKind(cell);
        return kind
          ? { key: cell.join(","), maximum: oreDefinition(kind).maxHp, requiredLevel: oreDefinition(kind).requiredLevel }
          : null;
      },
      pending: (cell) => this.world?.pending(cell) ?? false,
      destroy: (cell) => this.world?.mine([cell]) ?? false,
    });
    this.snapshot = this.makeSnapshot();
  }
  private learningEvidence() {
    return {coins:this.wallet.getBalance(),level:this.equipment.toolLevel,capacity:this.equipment.backpackCapacity,maxDepth:this.exploration.maxDepth,items:this.inventory.getSnapshot().totalCount,pets:this.petService.getInventory().count,equipped:this.petService.getEquipment().slots.some(id=>id!==null)};
  }
  acknowledgeLongMiningTask = () => {
    if (!this.suspended && this.snapshot.guide?.id === 'long-task' && this.onboarding.introduceLongTask(this.learningEvidence())) { this.committed(true); this.publish(); }
  };
  guideToEgg = (eggId: string) => {
    if (this.suspended || !this.petService.isUnlocked(eggId) || !this.content.eggStations?.some(s => s.eggId === eggId)) return false;
    this.requestedEgg = eggId;
    this.requestedShop = false;
    this.publish();
    return true;
  };
  guideToShop = () => { if(!this.suspended){this.requestedShop=true;this.requestedEgg=null;this.publish();} };
  cancelEggGuide = () => { this.requestedEgg = null; this.requestedShop=false; this.publish(); };
  dismissGuideCompletion = () => { if(this.guideCompletionPending){this.guideCompletionPending=false;this.publish();} };
  skipOnboarding = () => { if(!this.suspended&&this.onboarding.skip()){this.committed(true);this.publish();} };
  resumeOnboarding = () => { if(!this.suspended&&this.onboarding.resume(this.learningEvidence())){this.committed(true);this.publish();} };
  private makeSnapshot() {
    const bag=this.inventory.getSnapshot(), egg=this.content.petContent?.eggs.find(e=>e.id===(this.requestedEgg??this.content.onboarding?.eggId));
    let guide: GuideTarget|null=this.requestedEgg ? {id:'egg' as const,phase:'pets',title:`前往${egg!.name}蛋台`,detail:this.guideLocation==='surface'?'跟随箭头，靠近后按 E 购买':'先返回地表，再前往蛋台购买',...(this.guideLocation==='surface'?{marker:'egg' as const}:{highlight:'return' as const})} : selectGuide({learning:this.onboarding.getSnapshot(),location:this.guideLocation,nearMine:this.nearMine,atMine:this.atMine,hasTarget:!!this.targetView&&!this.targetView.locked,inSellZone:this.inSellZone,full:bag.isFull,items:bag.totalCount,coins:this.wallet.getBalance(),level:this.equipment.toolLevel,capacity:this.equipment.backpackCapacity,maxDepth:this.exploration.maxDepth,backpackPrice:this.bagOffer().next?.price??null,pets:this.petService.getInventory().count,upgradePrice:this.toolOffer().price,eggPrice:egg?.price??null});
    const station=this.content.eggStations?.find(s=>s.eggId===egg?.id);
    const room=this.content.destinations.find(d=>d.id===this.guideRoomId)?.roomBounds;
    const sale=this.guideLocation==='room'&&room?this.content.sales.find(s=>s.x>=room.minX&&s.x<room.maxX&&s.z>=room.minZ&&s.z<room.maxZ&&s.y>=room.floor&&s.y<room.ceiling):this.content.sales[0];
    const worldZ=this.content.journey?worldRequirement(this.currentWorld).z:0;
    const shop=this.content.shops.find(s=>this.guideLocation==='room'&&room?s.zone.x>=room.minX&&s.zone.x<room.maxX&&s.zone.z>=room.minZ&&s.zone.z<room.maxZ&&Math.abs(s.zone.y-room.floor)<1:s.zone.y>=-.1&&Math.abs(s.zone.z-worldZ)<100);
    if(this.requestedShop||guide?.id==='upgrade'||guide?.id==='backpack') {
      guide=this.guideLocation==='mine'||!shop
        ? {id:'return',title:'返回地表，前往装备商店',detail:'商店里可以挑选镐子和背包',highlight:'return'}
        : {id:guide?.id==='backpack'?'backpack':'shop',title:'去商店挑选新装备',detail:'点右边「商店」一键传送，或跟随箭头走过去',marker:'shop'};
    }
    const anchor:Coord|null=guide?.marker==='shop'&&shop?[shop.zone.x,shop.zone.y+1,shop.zone.z]:guide?.marker==='mine'?this.content.onboarding?.entrance??null:guide?.marker==='sell'&&sale?[sale.x,sale.y+1,sale.z]:guide?.marker==='egg'&&station?station.promptAnchor:null;
    const destination:Coord|null=guide?.marker==='egg'&&station?[station.zone.x,station.zone.y,station.zone.z]:anchor;

    return Object.freeze({
      equipment: this.equipment.exportData(), shopCatalog:{tools:this.toolCatalog,backpacks:this.bagCatalog}, requestedShop:this.requestedShop,
      journey: !!this.content.journey, currentWorld: this.currentWorld, atMineEntrance:this.atMineEntrance,
      minedVolume:this.worldProgress.minedVolume,
      worlds:this.content.journey?WORLD_REQUIREMENTS.map(w=>({...w,areaOpen:this.worldProgress.areaOpen(w.id),mineOpen:this.worldProgress.mineOpen(w.id),
        remaining:Math.max(0,w.mined-this.worldProgress.minedVolume),
        materials:w.materials.map(m=>({...m,name:itemDefinition(m.itemId).name,owned:bag.items[m.itemId]??0,reserved:this.reservations.quantity(m.itemId,bag.items[m.itemId]??0)}))})):[],
      mineralReservations:Object.fromEntries(Object.entries(bag.items).map(([id,n])=>[id,{reserved:this.reservations.quantity(id,n),sellable:n-this.reservations.quantity(id,n),mode:this.reservations.mode(id)}])),
      onboarding: this.onboarding.getSnapshot(), guide, guideAnchor: anchor, guideDestination: destination, guideEggId: egg?.id ?? null, guideCompletionPending: this.guideCompletionPending,
      inventory: this.inventory.getSnapshot(),
      backpackLevel: 1 + (this.content.journey?JOURNEY_BACKPACKS:BACKPACK_TIERS).filter(tier => tier.capacity <= bag.capacity).length,
      maxDepth: this.exploration.maxDepth,
      challengeBoard: this.challengeBoard.rows(this.exploration.maxDepth),
      rewards: this.rewards.getSnapshot(),
      capsuleCoins: this.capsuleCoinReward(),
      atMachine: this.atMachine,
      canTravel: this.canTravelNow(),
      autoHatch: this.autoHatchEgg,
      lastAutoHatch: this.lastAutoHatch,
      requestedEgg: this.requestedEgg,
      coins: this.wallet.getBalance(),
      sale: quoteSale(this.content.journey?this.reservations.sellable(bag.items):bag.items, itemPrice),
      inSellZone: this.inSellZone,
      atHome: this.atHome,
      shopId: this.shopId,
      eggId: this.eggId,
      eggStation: this.eggStation,
      miningStats: this.miningAttributes.getSnapshot(),
      depth: this.depth,
      location: this.guideLocation,
      destinations: this.content.destinations.filter(r=>!this.content.journey||(r.worldId??1)===this.currentWorld).map((r) => ({
        id: r.id,
        name: r.name,
        depth: r.depth,
        unlocked: this.exploration.has(r.id),
      })),
      notice: this.notice,
      target: this.targetView,
      hitSerial: this.lastHit,
      pickaxe: this.pickaxe.getSnapshot(),
      pickaxeUpgrade: this.toolOffer(),
      backpackUpgrade: this.bagOffer(),
    });
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish() {
    this.snapshot = this.makeSnapshot();
    for (const listener of this.listeners) listener();
  }
  attach(world: WorldCommands) {
    this.world = world;
    return () => {
      if (this.world === world) this.world = null;
    };
  }
  private mineableKind(cell: Coord) {
    if (this.content.journey) {
      const id=worldAtZ(cell[2]*2);
      if(id!==this.currentWorld||!this.worldProgress.mineOpen(id))return null;
    }
    return this.world?.canMine?.(cell) === false
      ? null
      : this.world?.cell(cell);
  }
  private refreshTarget() {
    const kind = this.targetCell && this.mineableKind(this.targetCell);
    const item = kind ? oreDefinition(kind) : null;
    const key = this.targetCell?.join(",") ?? "";
    const hp = item ? this.combat.health.get(key, item.maxHp) : 0;
    if (!item) {
      if (!this.targetView) return false;
      this.targetView = null;
      return true;
    }
    const requiredLevel = item.requiredLevel ?? 0, locked = this.pickaxe.getSnapshot().level < requiredLevel;
    if (this.targetView?.key === key && this.targetView.hp === hp && this.targetView.locked === locked) return false;
    this.targetView = Object.freeze({
      key,
      name: item.name,
      hp,
      maximum: item.maxHp,
      volume: item.volume,
      price: item.price,
      requiredLevel, locked,
    });
    return true;
  }
  selectTarget = (cell: Coord | null) => {
    this.targetCell = cell;
    if (this.refreshTarget()) this.publish();
  };
  hit = (cell: Coord) => {
    if (this.suspended || this.inSellZone) return { status: "unavailable" } as const;
    const result = this.combat.hit(cell, this.clock());
    if (result.status === "hit" || result.status === "breaking") {
      if (result.damage) this.lastHit++;
      this.notice = "";
      this.refreshTarget();
      this.publish();
    } else if (result.status === 'locked') {
      const text = `需要 Lv.${result.requiredLevel} 镐子`;
      if (this.notice !== text) { this.notice = text; this.publish(); }
      this.refuse('locked');
    } else if (result.status === "full") {
      if (this.notice !== "背包已满，前往售卖点出售") { this.notice = "背包已满，前往售卖点出售"; this.publish(); }
      this.refuse('full');
    }
    return result;
  };
  requestMine = (targets: readonly Coord[]) => {
    if (targets.length !== 1) return false; // Current pickaxe attacks one block.
    const result = this.hit(targets[0]);
    return result.status === "hit" || result.status === "breaking";
  };
  blockHealth = (cell: Coord) => {
    const kind = this.mineableKind(cell);
    return kind
      ? this.combat.health.get(cell.join(","), oreDefinition(kind).maxHp)
      : null;
  };
  observeBlockDamage = (
    listener: (
      damage: Readonly<{ cell: Coord; hp: number; maximum: number }>,
    ) => void,
  ) =>
    this.combat.health.observe((key, hp) => {
      const cell = key.split(",").map(Number) as unknown as Coord;
      const kind = hp === null ? null : this.mineableKind(cell);
      listener({
        cell,
        hp: hp ?? 0,
        maximum: kind ? oreDefinition(kind).maxHp : 0,
      });
    });
  combatDebug = () => ({
    damagedCells: this.combat.health.size,
    nextAttackAt: this.combat.cooldown.nextAt,
    now: this.clock(),
  });
  private withHatchFeedback(commands: PetCommands) {
    return {
      equip: commands.equip, unequip: commands.unequip, equipBest: commands.equipBest, unequipAll: commands.unequipAll,
      hatch: (id: string) => {
        const result = commands.hatch(id);
        if (result.status === 'hatched') this.feedback({ type: 'hatched', tier: this.petTier(result.pet), auto: false });
        else if (result.status === 'insufficient-coins') this.feedback({ type: 'denied', reason: 'coins' });
        return result;
      },
    };
  }
  private capsuleCoinReward() {
    const stage=this.content.destinations.filter(d=>this.exploration.maxDepth>=d.depth).length;
    return stageCoinReward(STAGES[Math.min(stage,STAGES.length-1)].basePrice);
  }
  private finishReward(result: RewardClaimResult) {
    if(result.status==='claimed'){this.committed(true);this.publish();this.feedback({type:'reward'});}
    return result;
  }
  claimOnlineReward = (minutes: OnlineRewardMinutes) => this.suspended ? {status:'unavailable' as const} : this.finishReward(this.rewards.claimOnline(minutes));
  claimDailyReward = () => this.suspended ? {status:'unavailable' as const} : this.finishReward(this.rewards.claimDaily());
  redeemInvite = (text: string) => this.suspended ? {status:'unavailable' as const} : this.finishReward(this.rewards.redeemInvite(text));
  shareReward = async (platform: 'wechat'|'douyin') => {
    if(this.suspended)return {status:'unavailable' as const};
    if(platform!=='wechat'&&platform!=='douyin')throw Error('未知分享平台');
    const name=platform==='wechat'?'微信':'抖音';
    const url=typeof location==='undefined'?'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html':new URL(location.pathname,location.origin).href;
    const text=`我在 Mining 挖到了 ${Math.floor(this.exploration.maxDepth)} 米！一起来挑战深度纪录。\n${url}\n邀请码：${this.rewards.getSnapshot().inviteCode}\n进入游戏，在“奖励”中粘贴口令领取幸运币。分享至${name}。`;
    try { await navigator.clipboard.writeText(text); }
    catch { return {status:'clipboard-failed' as const}; }
    if(this.suspended)return {status:'unavailable' as const};
    return this.finishReward(this.rewards.claimShare());
  };
  spinCapsule = () => {
    if(this.suspended)return {status:'unavailable' as const};
    if(!this.atMachine)return {status:'away' as const};
    const amount=this.capsuleCoinReward();
    if(!this.wallet.canCredit(amount))return {status:'overflow' as const};
    const result=this.rewards.spin(amount);
    if(result.status==='spun'){
      if(result.coinReward)this.wallet.credit(result.coinReward);
      this.syncRewardEffects();this.committed(true);this.publish();this.feedback({type:'reward'});
    }
    return result;
  };
  setAutoHatch = (enabled: boolean) => {
    if(!enabled){this.stopAutoHatch();this.publish();return true;}
    if(this.suspended||!this.rewardEffects.autoHatch||!this.eggId||!this.petService.isUnlocked(this.eggId))return false;
    this.autoHatchEgg=this.eggId;this.autoHatchElapsed=0;this.lastAutoHatch=null;this.publish();return true;
  };
  private stopAutoHatch(){this.autoHatchEgg=null;this.autoHatchElapsed=0;}
  advanceOnline = (seconds: number) => {
    if(this.suspended)return;
    if(!Number.isFinite(seconds)||seconds<0)throw Error('无效在线时长');
    // Save/render once per second, while remaining real elapsed time stays in
    // the session. No offline timestamp is turned into rewards on reload.
    this.onlineAccumulated+=seconds;
    if(this.onlineAccumulated<1)return;
    const elapsed=this.onlineAccumulated;this.onlineAccumulated=0;
    const result=this.rewards.advance(elapsed);this.syncRewardEffects();
    if(this.autoHatchEgg){
      this.autoHatchElapsed+=elapsed;
      if(this.autoHatchEgg!==this.eggId||!this.rewardEffects.autoHatch)this.stopAutoHatch();
      else if(this.autoHatchElapsed>=2){
        this.autoHatchElapsed=0;
        const hatched=this.petService.hatch(this.autoHatchEgg);
        if(hatched.status==='hatched'){this.lastAutoHatch=hatched;this.requestedEgg=null;this.committed(true);this.feedback({type:'hatched',tier:this.petTier(hatched.pet),auto:true});}
        else {this.stopAutoHatch();this.notice=hatched.status==='insufficient-coins'?'金币不足，自动孵蛋已停止':'蛋台不可用，自动孵蛋已停止';}
      }
    }
    if(result.changed)this.committed(false);
    this.publish();
  };
  // Called once, after terrain has actually removed these cells. Never checks isFull.
  collected = (resources: readonly { kind: number; cell?: Coord }[]) => {
    const wasFull=this.inventory.isFull();
    const volume=resources.reduce((n,r)=>n+oreDefinition(r.kind).volume,0);
    this.worldProgress.previewCollection(volume);
    this.mining.collected(resources);
    this.worldProgress.collect(volume);
    if (resources.length) { const first=!this.onboarding.getSnapshot().minedOnce; this.onboarding.recordCollected(resources.length); this.committed(first); }
    for (const resource of resources)
      if (resource.cell) this.combat.destroyed(resource.cell.join(","));
    this.refreshTarget();
    this.notice = this.inventory.isFull() ? "背包已满，前往售卖点出售" : "";
    this.publish();
    if (resources.length) for (const listener of this.pickupListeners) listener(oreDrops(resources));
    if (!wasFull && this.inventory.isFull()) this.refuse('full');
  };
  upgradePickaxe = (expectedLevel: number) => {
    if(this.suspended||expectedLevel!==this.equipment.toolLevel)return {status:'stale'} as const;
    const offer=this.toolOffer();
    if(!offer.next)return {status:'limit'} as const;
    if(!this.wallet.debit(offer.price)){this.feedback({type:'denied',reason:'coins'});return {status:'insufficient'} as const;}
    this.pickaxe.setLevel(offer.next.level);this.equipment.toolLevel=offer.next.level;
    if(!this.content.journey)this.toolCatalog=shopTools(false,this.equipment.toolLevel);
    this.committed(true);this.refreshTarget();this.publish();this.feedback({type:'purchased'});
    return {status:'upgraded',level:offer.next.level,spent:offer.price} as const;
  };
  upgradeBackpack = (tierId: string) => {
    if(this.suspended)return {status:'stale'} as const;
    const {next}=this.bagOffer();
    if(!next)return {status:'max'} as const;
    if(next.id!==tierId)return {status:'stale'} as const;
    if(!this.wallet.debit(next.price)){this.feedback({type:'denied',reason:'coins'});return {status:'insufficient'} as const;}
    this.inventory.setCapacity(next.capacity);this.equipment.backpackCapacity=next.capacity;
    this.committed(true);this.publish();this.feedback({type:'purchased'});
    return {status:'upgraded',capacity:next.capacity,spent:next.price} as const;
  };
  useShopItem = (category:ShopCategory,id:string) => {
    if(this.suspended||!this.shopId)return {status:'unavailable'} as const;
    const item=(category==='tools'?this.toolCatalog:this.bagCatalog).find(x=>x.id===id);
    if(!item)return {status:'unavailable'} as const;
    const owned=category==='tools'?item.level<=this.equipment.toolLevel:item.capacity!<=this.equipment.backpackCapacity;
    if(!owned) {
      if(category==='tools')return item.level===this.equipment.toolLevel+1?this.upgradePickaxe(this.equipment.toolLevel):{status:'locked'} as const;
      return item.id===this.bagOffer().next?.id?this.upgradeBackpack(item.id):{status:'locked'} as const;
    }
    if(category==='tools') {
      if(this.pickaxe.getSnapshot().level===item.level)return {status:'equipped'} as const;
      this.pickaxe.setLevel(item.level);this.refreshTarget();
    } else {
      if(this.inventory.getSnapshot().used>item.capacity!)return {status:'too-small'} as const;
      if(this.inventory.capacity===item.capacity)return {status:'equipped'} as const;
      this.inventory.setCapacity(item.capacity!);
    }
    this.committed(true);this.publish();return {status:'equipped'} as const;
  };
  updatePosition(feet: readonly number[], grounded: boolean) {
    if (this.suspended) return;
    let changed = false;
    if(this.content.journey){
      const id=worldAtFeet(feet);
      if(!this.worldProgress.areaOpen(id)||feet[1]<-1&&!this.worldProgress.mineOpen(id)){
        this.world?.travelTo?.(worldSpawn(this.worldProgress.areaOpen(id)?id:this.currentWorld));return;
      }
      if(id!==this.currentWorld){this.currentWorld=id;this.stopAutoHatch();changed=true;}
      const entrance=Math.abs(feet[0])<12&&Math.abs(Math.abs(feet[2]-worldRequirement(id).z)-12)<6&&Math.abs(feet[1])<2?id:null;
      if(entrance!==this.atMineEntrance){this.atMineEntrance=entrance;changed=true;}
    }
    const machineEvent=this.machineZone.update(feet,grounded);
    if(machineEvent){this.atMachine=machineEvent==='enter';changed=true;}
    const sampledDepth = playerDepthAtFeet(feet, grounded, this.content.destinations);
    const depth = Math.floor(sampledDepth);
    if (depth !== this.depth) {
      this.depth = depth;
      changed = true;
    }
    const oldMaximum = this.exploration.maxDepth;
    const bounded = this.content.destinations.some(d => d.roomBounds);
    const enteredRooms = bounded ? this.content.destinations.filter(d => {
      const b = d.roomBounds;
      return b && feet[0] >= b.minX && feet[0] < b.maxX && feet[2] >= b.minZ && feet[2] < b.maxZ
        && feet[1] >= b.floor - .04 && feet[1] < b.ceiling;
    }).map(d => d.id) : undefined;
    const location=feet[1]>=-.1?'surface':enteredRooms?.length?'room':'mine';
    const roomId=location==='room'?enteredRooms![0]:null;
    if(roomId!==this.guideRoomId){this.guideRoomId=roomId;changed=true;}
    const entrance=this.content.onboarding?.entrance;
    const area=this.content.onboarding?.mineArea;
    const atMine=!!area&&feet[0]>=area.minX-2&&feet[0]<=area.maxX+2&&feet[2]>=area.minZ-2&&feet[2]<=area.maxZ+4;
    if(atMine!==this.atMine){this.atMine=atMine;changed=true;}
    const near=!!entrance&&Math.hypot(feet[0]-entrance[0],feet[2]-entrance[2])<14;
    if(location!==this.guideLocation||near!==this.nearMine){this.guideLocation=location;this.nearMine=near;changed=true;}
    const added = this.exploration.visit(this.content.journey&&!this.worldProgress.mineOpen(this.currentWorld)?0:sampledDepth);
    if (this.exploration.maxDepth !== oldMaximum || added.length) { changed=true; this.committed(added.length > 0); }
    if (added.length) {
      this.notice = `已解锁 ${this.content.destinations.find((r) => r.id === added.at(-1))!.name}，回到地表可传送；对应宠物蛋已解锁`;
      changed = true;
      this.feedback({ type: 'unlocked' });
    }
    const homeEvent = this.home.update(feet, grounded);
    if (homeEvent) {
      this.atHome = homeEvent === "enter";
      changed = true;
    }
    if(this.content.journey){
      for(const h of this.homes)h.detector.update(feet,grounded);
      const inside=this.homes.some(h=>h.worldId===this.currentWorld&&h.detector.isInside);
      if(inside!==this.atHome){this.atHome=inside;changed=true;}
    }
    for (const shop of this.shops) shop.detector.update(feet, grounded);
    const activeShop =
      this.shops.find((shop) => shop.detector.isInside)?.id ?? null;
    if (activeShop !== this.shopId) {
      this.shopId = activeShop;
      if(activeShop)this.requestedShop=false;
      changed = true;
    }
    for (const station of this.eggStations) station.detector.update(feet, grounded);
    const activeEgg = this.eggStations.find(entry => entry.detector.isInside)?.station ?? null;
    if (activeEgg !== this.eggStation) {
      this.stopAutoHatch();
      this.eggStation = activeEgg;
      this.eggId = activeEgg?.eggId ?? null;
      changed = true;
    }
    let entered = false;
    for (const zone of this.zones) {
      const event = zone.update(feet, grounded);
      if (event) {
        entered ||= event === "enter";
        changed = true;
      }
    }
    this.inSellZone = this.zones.some((zone) => zone.isInside);
    if (entered) {
      this.world?.cancelMining();
      const result = this.executeSale();
      if (result.status === 'sold') { this.onboarding.record('soldOnce'); this.committed(true); this.feedback({ type: 'sold', coins: result.coins, count: result.count }); }
      this.notice =
        result.status === "sold"
          ? `出售 ${result.count} 件，获得 ${result.coins} 金币`
          : result.status === "empty"
            ? "没有可出售的矿物"
            : "金币数值超出范围";
    }
    let stepped: string | null = null;
    for (const portal of this.portals)
      if (portal.detector.update(feet, grounded) === "enter")
        stepped = portal.id;
    if (stepped) {
      const room = this.content.destinations.find((r) => r.id === stepped)!;
      if (this.exploration.has(stepped) && this.world?.travelTo) {
        this.beginTravel(room);
        return;
      }
      this.notice = this.exploration.has(stepped)
        ? "传送暂不可用"
        : `历史最深达到 ${room.depth} 米后解锁${room.name}`;
      changed = true;
    }
    if (changed) this.publish();
  }
  resetPosition() {
    this.stopAutoHatch();
    this.machineZone.reset(); this.atMachine=false;
    this.guideLocation = null;
    this.targetCell = null;
    this.targetView = null;
    for (const zone of this.zones) zone.reset();
    for (const shop of this.shops) shop.detector.reset();
    for (const station of this.eggStations) station.detector.reset();
    this.eggId = null;
    this.eggStation = null;
    this.home.reset();
    for(const h of this.homes)h.detector.reset();
    this.atMineEntrance=null;
    this.atHome = false;
    this.shopId = null;
    this.inSellZone = false;
    this.publish();
  }
  travelTo = (id: string) => {
    if (this.suspended) return "unavailable" as const;
    const room = this.content.destinations.find((r) => r.id === id);
    if (!room || !this.exploration.has(id)) return "locked" as const;
    if(this.content.journey&&((room.worldId??1)!==this.currentWorld||!this.worldProgress.mineOpen(this.currentWorld)))return 'locked' as const;
    if (!this.canTravelNow()) return "away" as const;
    if (!this.world?.travelTo) return "unavailable" as const;
    return this.beginTravel(room);
  };
  private beginTravel(room: Destination) {
    this.world!.cancelMining();
    this.world!.travelTo!(room.spawn);
    this.resetPosition();
    // Pad detectors keep their entry latch until feet actually leave the pad.
    this.notice = `前往 ${room.name}`;
    this.publish();
    return "travelling" as const;
  }
  returnToSurface = () => {
    if (this.suspended || !this.world) return;
    this.world.cancelMining();
    if(this.content.journey)this.world.travelTo?.(worldSpawn(this.currentWorld));
    else this.world.returnToSurface();
    this.resetPosition();
    this.notice = "走进金色圆圈出售，或踩左侧圆盘前往已解锁层";
    this.publish();
  };
  /** The surface hub doubles as the teleport station; portable travel works anywhere. */
  private canTravelNow() { return this.atHome || this.guideLocation === 'surface' || this.rewards.getSnapshot().permanent.travel; }
  private surfaceSpot(target: 'shop' | 'sale' | 'capsule' | { egg: string }): { feet: Coord; look: Coord } | null {
    const worldZ = this.content.journey ? worldRequirement(this.currentWorld).z : 0;
    const near = (zone: { y: number; z: number }) => zone.y >= -.1 && Math.abs(zone.z - worldZ) < 100;
    // Arrive facing the counter: zones may name their building; older content faces +Z buildings.
    const facingBuilding = (zone: { x: number; y: number; z: number; lookAt?: readonly [number, number, number] }) =>
      ({ feet: [zone.x, zone.y + .1, zone.z] as Coord, look: (zone.lookAt ?? [zone.x, zone.y + 1, zone.z - 6]) as Coord });
    if (target === 'shop') { const zone = this.content.shops.find(s => near(s.zone))?.zone; return zone ? facingBuilding(zone) : null; }
    if (target === 'sale') { const zone = this.content.sales.find(near); return zone ? facingBuilding(zone) : null; }
    if (target === 'capsule') return this.currentWorld === 1 ? facingBuilding(CAPSULE_MACHINE_ZONE) : null;
    if (!this.petService.isUnlocked(target.egg)) return null;
    const station = this.content.eggStations?.find(s => s.eggId === target.egg);
    return station ? { feet: [station.zone.x, station.zone.y + .1, station.zone.z], look: station.promptAnchor as Coord } : null;
  }
  /** Instant trip to a surface service, the way Roblox simulators offer Sell / Shop buttons. */
  goTo = (target: 'shop' | 'sale' | 'capsule' | { egg: string }) => {
    if (this.suspended || !this.world?.travelTo) return 'unavailable' as const;
    const spot = this.surfaceSpot(target);
    if (!spot) return 'unavailable' as const;
    this.requestedEgg = null; this.requestedShop = false;
    this.world.cancelMining();
    this.world.travelTo(spot.feet, spot.look);
    this.resetPosition();
    return 'travelling' as const;
  };
  travelWorld = (id: WorldId) => {
    if(this.suspended||!this.content.journey||!this.world?.travelTo)return 'unavailable' as const;
    if(!this.canTravelNow())return 'away' as const;
    if(!this.worldProgress.areaOpen(id))return 'locked' as const;
    this.world.cancelMining();this.world.travelTo(worldSpawn(id));
    return 'travelling' as const;
  };
  reserveWorldMaterials = (id: WorldId) => {
    if(this.suspended||!this.content.journey||this.worldProgress.mineOpen(id))return false;
    this.reservations.reserveWorld(id);this.committed(true);this.publish();return true;
  };
  reserveMineral = (id: string, mode: 'none'|'all'|'needed') => {
    if(this.suspended||!this.content.journey)return;
    this.reservations.set(id,mode);this.committed(true);this.publish();
  };
  private executeSale() {
    if(!this.content.journey)return sellAll(this.inventory,this.wallet,itemPrice);
    const items=this.reservations.sellable(this.inventory.getSnapshot().items), quote=quoteSale(items,itemPrice);
    if(quote.status==='overflow')return quote;
    if(!quote.count)return {status:'empty'} as const;
    if(!this.wallet.canCredit(quote.coins))return {status:'overflow'} as const;
    if(!this.inventory.remove(Object.entries(items).map(([itemId,count])=>({itemId,count}))))throw Error('售卖库存发生变化');
    this.wallet.credit(quote.coins);
    return {status:'sold',count:quote.count,coins:quote.coins} as const;
  }
  sellAvailable = () => {
    if(this.suspended||!this.inSellZone)return {status:'unavailable'} as const;
    const result=this.executeSale();
    if(result.status==='sold'){this.onboarding.record('soldOnce');this.committed(true);this.notice=`出售 ${result.count} 件，获得 ${result.coins} 金币`;}else this.notice=result.status==='empty'?'没有可出售的矿产，保留材料仍在背包中':'金币数值超出范围';
    this.publish();return result;
  };
  unlockWorldMine = (id: WorldId) => {
    if(this.suspended||!this.content.journey)return {status:'unavailable'} as const;
    if(this.worldProgress.mineOpen(id))return {status:'already-open'} as const;
    if(!this.worldProgress.areaOpen(id))return {status:'area-locked'} as const;
    if(this.atMineEntrance!==id||this.currentWorld!==id)return {status:'away'} as const;
    if(id>1&&!this.worldProgress.mineOpen((id-1) as WorldId))return {status:'previous-mine-locked'} as const;
    const requirement=worldRequirement(id),items=this.inventory.getSnapshot().items;
    if(requirement.materials.some(m=>(items[m.itemId]??0)<m.count))return {status:'insufficient-materials'} as const;
    if(this.wallet.getBalance()<requirement.coins)return {status:'insufficient-coins'} as const;
    // All checks precede this synchronous transfer. Reservations protect selling only.
    if(!this.inventory.remove(requirement.materials))throw Error('缴纳矿产发生变化');
    if(!this.wallet.debit(requirement.coins))throw Error('缴纳金币发生变化');
    this.worldProgress.openMine(id);this.reservations.finishWorld(id);
    this.notice=`${requirement.name}矿区已永久开放，可以下矿了`;
    this.committed(true);this.publish();return {status:'opened'} as const;
  };
}
