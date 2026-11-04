import { restoreEquipment, saveEquipment } from '../logic/EquipmentSave.ts';
import { TIP_IDS, type TipId, Onboarding } from '../logic/Onboarding.ts';
import { EquipmentCollection } from '../logic/EquipmentCollection.ts';
import { shopTools, shopBackpacks, type ShopCategory, type ShopItem } from '../content/shopCatalog.ts';
import { WorldProgress } from '../logic/WorldProgress.ts';
import { MaterialStore } from '../logic/MaterialStore.ts';
import { WORLD_REQUIREMENTS, worldRequirement, worldAtZ, worldAtFeet, worldSpawn, type WorldId } from '../content/worldJourney.ts';
import { Rewards, type RewardOptions, type RewardClaimResult } from '../logic/Rewards.ts';
import { RebirthRecord, rebirthMultiplier } from '../logic/Rebirth.ts';
import { REWARD_CONFIG, type OnlineRewardMinutes } from '../content/rewards.ts';
import { ECONOMY, currencyText, layerEconomy, type CurrencyId } from '../content/economy.ts';
import { CAPSULE_MACHINE_ZONE } from '../content/feedbackFacilities.ts';
import { CELL } from '../terrain/grid.ts';
import { TIP_GAP, TIP_SECONDS, nextTip, tipLearned, tipRelevant, tipView, type TipState } from './Tips.ts';
import type { ProgressDataV1 } from './SessionProgress.ts';
import { record } from '../logic/data.ts';
import { PetCommands } from './PetCommands.ts';
import type { SessionContent, Destination, EggStation } from "./SessionContent.ts";
import { PetService } from "./PetService.ts";
import { PetUiAdapter } from "./PetUiAdapter.ts";
import { Exploration } from "../logic/Exploration.ts";
import { environmentDepthAtFeet, playerDepthAtFeet } from "../logic/PlayerDepth.ts";
import { Inventory } from "../logic/Inventory.ts";
import { Wallet } from "../logic/Wallet.ts";
import { ZoneDetector } from "../logic/ZoneDetector.ts";
import { Mining } from "./Mining.ts";
import { quoteCurrencySale, sellCurrencyItems, type SalePayout } from "./Sale.ts";
import { Pickaxe, pickaxeStats } from "../logic/Pickaxe.ts";
import { MiningCombat } from "./MiningCombat.ts";
import { oreDrops, oreDefinition, itemDefinition, itemVolume, itemPrice, itemCurrency, ORE_ITEMS } from "./items.ts";
import type { Coord } from "../terrain/SparseWorld.ts";
import { tr, resolveText } from '../i18n/i18n.ts';
import { message, type TextRef } from '../i18n/messages.ts';
type WorldCommands = {
  cell(target: Coord): number | null;
  canMine?(target: Coord): boolean;
  pending(target: Coord): boolean;
  mine(targets: readonly Coord[]): boolean;
  cancelMining(): void;
  /** Blocks broken but not collected yet (their ore is on its way to the bag). */
  pendingVolume?(volume: (kind: number) => number): number;
  /** Teleport; `lookAt` turns the camera toward what the player came to use. */
  travelTo?(feet: Coord, lookAt?: Coord): void;
};
const knownItem = (itemId: string) => ORE_ITEMS.some(item => item.itemId === itemId);
export type SessionFeedback =
  | Readonly<{ type: 'sold'; payouts: readonly SalePayout[]; count: number }>
  | Readonly<{ type: 'purchased' }>
  | Readonly<{ type: 'reward' }>
  | Readonly<{ type: 'hatched'; tier: number; auto: boolean }>
  | Readonly<{ type: 'unlocked' }>
  | Readonly<{ type: 'reborn'; count: number; multiplier: number }>
  | Readonly<{ type: 'denied'; reason: 'locked' | 'full' | 'coins' }>;

export class GameSession {
  private readonly equipment: EquipmentCollection;
  private readonly bagCatalog;
  private readonly toolCatalog;
  private readonly worldProgress: WorldProgress;
  private readonly materials: MaterialStore;
  /** What the last collection put into the material store (for its notice). */
  private stored: readonly { itemId: string; count: number }[] = [];
  private currentWorld: WorldId = 1;
  private readonly explorations = new Map<WorldId, Exploration>();
  private get exploration() { return this.explorations.get(this.currentWorld)!; }
  private hasDestination = (id: string) => [...this.explorations.values()].some(e => e.has(id));
  private readonly homes: {worldId:WorldId;detector:ZoneDetector}[];
  private readonly stations: {worldId:WorldId;detector:ZoneDetector}[];
  private atStation = false;
  private readonly portals: {worldId:WorldId;detector:ZoneDetector}[];
  private atPortal = false;
  /** The next pickaxe: its price is in the currency of the world it belongs to (levels 1-10 gold, ...). */
  private toolOffer() {
    const level=this.equipment.toolLevel, tool=ECONOMY.tools[level];
    const next=tool?pickaxeStats(level+1):null, price=tool?.price??0, currency=tool?.currency??this.currency;
    return Object.freeze({next,price,currency,canAfford:!!next&&this.wallet.getBalance(currency)>=price});
  }
  /** The next enhancement of the newest pickaxe (+1..+3): more damage, same model and gate; paid in its currency. */
  private enhanceOffer() {
    const level=this.equipment.toolLevel, tool=ECONOMY.tools[level-1], enhance=this.equipment.enhance, step=tool.enhance[enhance];
    const next=step?Object.freeze({enhance:enhance+1,price:step.price,currency:tool.currency,power:step.power}):null;
    return Object.freeze({level,enhance,max:tool.enhance.length,next,canAfford:!!next&&this.wallet.getBalance(tool.currency)>=next.price});
  }
  /** The next pet slot to buy (4th in world 2, 5th in world 3): its price in that world's currency, once the player
   *  has reached the layer where it unlocks. */
  private petSlotOffer() {
    const slots=this.petService.getEquipment().slots.length, slot=ECONOMY.petSlots[slots-ECONOMY.start.petSlots];
    if(!slot)return null;
    const room=this.content.destinations.filter(d=>d.worldId===slot.world)[slot.layer-1];
    const unlocked=!!room&&this.worldProgress.isOpen(slot.world as WorldId)&&!!this.explorations.get(slot.world as WorldId)?.has(room.id);
    return Object.freeze({slot:slot.slot,price:slot.price,currency:slot.currency,unlocked,unlockName:tr("msg.name2_in_name", { name: worldRequirement(slot.world as WorldId).name, name2: room?.name??'' }),
      canAfford:unlocked&&this.wallet.getBalance(slot.currency)>=slot.price});
  }
  /** Buys the next pet slot; `expectedSlots` guards against a stale panel. */
  buyPetSlot = (expectedSlots: number) => {
    if(this.suspended||expectedSlots!==this.petService.getEquipment().slots.length)return {status:'stale'} as const;
    const offer=this.petSlotOffer();
    if(!offer)return {status:'max'} as const;
    if(!offer.unlocked)return {status:'locked'} as const;
    if(!this.wallet.debit(offer.currency,offer.price)){this.feedback({type:'denied',reason:'coins'});return {status:'insufficient'} as const;}
    this.petService.addSlot();this.committed(true);this.publish();this.feedback({type:'purchased'});
    return {status:'bought',slots:this.petService.getEquipment().slots.length} as const;
  };
  private bagOffer() {
    const next=this.bagCatalog.find(t=>t.capacity!>this.equipment.backpackCapacity)??null;
    return Object.freeze({next,canAfford:!!next&&this.wallet.getBalance(next.currency)>=next.price});
  }
  /** What ore sells for in the current world. */
  private get currency(): CurrencyId { return worldRequirement(this.currentWorld).currency; }
  private readonly rewards: Rewards;
  private readonly machineZone = new ZoneDetector(CAPSULE_MACHINE_ZONE);
  private atMachine = false;
  private autoHatchEgg: string | null = null;
  private autoHatchElapsed = 0;
  private lastAutoHatch: Extract<import('./PetService.ts').HatchResult, {status:'hatched'}> | null = null;
  private onlineAccumulated = 0;
  private rewardEffects = {mining:false,autoHatch:false,speed:false,luck:false,sell:false};
  private syncRewardEffects() {
    const r=this.rewards.getSnapshot();
    this.rewardEffects={mining:r.permanent.mining,autoHatch:r.permanent.autoHatch,speed:r.timed.speed>0,luck:r.timed.luck>0,sell:r.timed.sell>0};
  }
  /** Everything ore sells for right now is multiplied by: the equipped pets' bonus in the ore's currency, the
   *  rebirths, and the capsule's double-sale boost while it runs. */
  private saleMultiplier(currency: CurrencyId = this.currency) {
    return (1+this.petService.getBonus()[currency]/100)*rebirthMultiplier(this.rebirthRecord.count)*(this.rewardEffects.sell?REWARD_CONFIG.sellMultiplier:1);
  }
  private readonly rebirthRecord: RebirthRecord;
  /** World 3's last layer, which (with the last pickaxe) completes the journey. */
  private readonly finalLayer = (() => { const r=ECONOMY.rebirth; return this.content.destinations.filter(d=>d.worldId===r.world)[r.layer-1]?.id ?? null; });
  /** The rebirth offer: the HUD button shows once world 3 is open; rebirth needs the journey complete. */
  private rebirthView() {
    const count=this.rebirthRecord.count,r=ECONOMY.rebirth,final=this.finalLayer();
    const reached=!!final&&this.worldProgress.isOpen(r.world)&&!!this.explorations.get(r.world)?.has(final), level=this.equipment.toolLevel>=r.toolLevel;
    return Object.freeze({count,multiplier:rebirthMultiplier(count),nextMultiplier:rebirthMultiplier(count+1),
      toolLevel:r.toolLevel,layerName:(()=>{const name=this.content.destinations.find(d=>d.id===final)?.name;return name?resolveText(name):'';})(),reached,level,
      ready:reached&&level,shown:this.worldProgress.isOpen(r.world)||count>0});
  }
  getMovementMultiplier = () => this.rewardEffects.speed ? 2 : 1;
  private baseStatsKey = '';
  private cachedBaseStats = pickaxeStats(1);
  private baseMiningStats = () => {
    // The pickaxe, times the capsule's mining boost and the equipped pets' mining bonus (speed to the cap, then damage).
    const level=this.pickaxe.getSnapshot().level, boosted=this.rewardEffects.mining, pets=this.petService?.getBonus().mining ?? 0;
    const enhance=this.pickaxe.getSnapshot().enhance, key=`${level}:${enhance}:${boosted}:${pets}`;
    if(key!==this.baseStatsKey){this.baseStatsKey=key;this.cachedBaseStats=pickaxeStats(level,(boosted?REWARD_CONFIG.miningMultiplier:1)*(1+pets/100),enhance);}
    return this.cachedBaseStats;
  };
  private readonly pickupListeners = new Set<(batch: readonly {itemId:string;count:number}[], stored: readonly {itemId:string;count:number}[]) => void>();
  /** Ore that reached the bag or, for ticket minerals, the material store (`stored`, a part of `batch`). */
  onOreCollected = (listener: (batch: readonly {itemId:string;count:number}[], stored: readonly {itemId:string;count:number}[]) => void) => {
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
  /** The one tip on screen, when it appeared, and the quiet time before another may follow, on the tips' clock: it
   *  stands still while a panel or the loading screen covers the game (since when, and for how long in all). */
  private tip: TipId | null = null;
  private tipSince = 0;
  private tipQuietUntil = 0;
  private tipsCovered: number | null = null;
  private tipsCoveredFor = 0;
  private tipClock() { return (this.tipsCovered ?? this.clock()) - this.tipsCoveredFor; }
  readonly pets: PetUiAdapter;
  private readonly onboarding: Onboarding;
  private guideLocation: 'surface'|'mine'|'room'|null = null;
  private nearMine = false;
  private atMine = false;
  private guideRoomId: string | null = null;
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
    for (const listener of this.progressListeners) listener({ urgent }); }
  exportProgress(): ProgressDataV1 {
    return { version: 2 as const, equipment:saveEquipment(this.equipment.exportData(),this.inventory.capacity), rewards:this.rewards.exportData(), wallet: this.wallet.exportData(), inventory: this.inventory.exportData(),
      onboarding: this.onboarding.getSnapshot(), rebirth: this.rebirthRecord.exportData(), pickaxe: this.pickaxe.exportData(), pets: this.petService.exportData(), exploration: this.explorations.get(1)!.exportData(),
      worldProgress:this.worldProgress.exportData(),materials:this.materials.exportData(),worldExploration:Object.fromEntries([...this.explorations].map(([id,e])=>[id,e.exportData()])) };
  }
  static createNew(content: SessionContent) { return new GameSession(content); }
  static fromData(data: unknown, content: SessionContent) { return new GameSession(content, undefined, undefined, {}, record(data)); }

  private readonly eggStations: { station: EggStation; detector: ZoneDetector }[];
  private eggStation: EggStation | null = null;
  private eggId: string | null = null;
  private inventory: Inventory;
  private wallet: Wallet;
  private world: WorldCommands | null = null;
  private readonly content: SessionContent;
  private readonly zones: ZoneDetector[];
  private readonly shops: { id: string; detector: ZoneDetector }[];
  private atHome = false;
  private shopId: string | null = null;
  private depth = 0;
  private positionDepth = 0;
  private inSellZone = false;
  private notice: TextRef | null = null;
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
    requiredToolName: string;
    locked: boolean;
  }> | null = null;
  private lastHit = 0;
  private clock: () => number;
  private snapshot;
  constructor(
    content: SessionContent,
    capacity = ECONOMY.bags[0].capacity,
    clock: () => number = () => performance.now() / 1000,
    petDependencies: { random?: () => number; createPetId?: () => string; rewards?: RewardOptions } = {},
    saved?: unknown,
  ) {
    this.content = content;
    const data = saved === undefined ? null : record(saved);
    // Saves of the economy before v2 are never read (saveNamespace keeps them apart); this guards test fixtures.
    if (data && data.version !== 2) throw Error('不支持的进度版本');
    this.worldProgress = new WorldProgress(data?.worldProgress);
    this.materials = data?.materials === undefined ? new MaterialStore() : MaterialStore.fromData(data.materials);
    this.homes = (content.homes??[]).map(h=>({worldId:h.worldId,detector:new ZoneDetector(h.zone)}));
    this.stations = (content.stations??[]).map(h=>({worldId:h.worldId,detector:new ZoneDetector(h.zone)}));
    this.portals = (content.portals??[]).map(h=>({worldId:h.worldId,detector:new ZoneDetector(h.zone)}));
    this.rebirthRecord = new RebirthRecord(data?.rebirth);
    this.rewards = data?.rewards === undefined ? new Rewards(petDependencies.rewards) : Rewards.fromData(data.rewards, petDependencies.rewards);
    this.syncRewardEffects();
    this.wallet = data ? Wallet.fromData(data.wallet) : new Wallet({ gold: content.initialCoins });
    this.pickaxe = data ? Pickaxe.fromData(data.pickaxe) : new Pickaxe();
    const restored=data?restoreEquipment(data.inventory,data.equipment,this.pickaxe.getSnapshot().level):null;
    this.inventory = restored ? Inventory.fromData(restored.inventory, itemVolume) : new Inventory(capacity, itemVolume);
    // A save from before the locks: what the store was still gathering stays locked, so it goes on being kept.
    for (const id of this.materials.kinds()) if (this.materials.count(id) < this.ticketNeed(id)) this.inventory.setLocked(id, true);
    this.equipment = new EquipmentCollection(this.pickaxe.getSnapshot().level,this.inventory.capacity,restored?.equipment);
    { const worn=this.pickaxe.getSnapshot();
      if(worn.enhance&&(worn.level!==this.equipment.toolLevel||worn.enhance!==this.equipment.enhance))throw Error('镐子强化与已购记录不一致'); }
    this.toolCatalog = shopTools();
    this.bagCatalog = shopBackpacks();
    {
      const savedExplorations=data?.worldExploration as Record<string,unknown>|undefined;
      if(savedExplorations!==undefined&&(!savedExplorations||typeof savedExplorations!=='object'||Array.isArray(savedExplorations)))throw Error('世界探索记录错误');
      for (const w of WORLD_REQUIREMENTS) {
        const destinations=content.destinations.filter(d=>d.worldId===w.id), saved=savedExplorations?.[w.id]??(w.id===1?data?.exploration:undefined);
        this.explorations.set(w.id,saved===undefined?new Exploration(destinations):Exploration.fromData(saved,destinations));
      }
    }
    const petService = new PetService({
      content: content.petContent,
      wallet: this.wallet,
      hasDestination: this.hasDestination,
      worldOpen: world => this.worldProgress.isOpen(world as WorldId),
      currency: () => this.currency,
      lucky: () => this.rewardEffects.luck,
      random: petDependencies.random ?? Math.random,
      createPetId: petDependencies.createPetId ?? (() => crypto.randomUUID()),
    });
    this.petService = petService;
    if (data) petService.restoreData(data.pets);
    this.onboarding = new Onboarding(data?.onboarding, data !== null, this.learningEvidence());
    this.pets = new PetUiAdapter(petService, {
      balances: () => this.wallet.getBalances(),
      currency: () => this.currency,
      commands: this.withHatchFeedback(new PetCommands(petService, () => { this.committed(true); this.publish(); }, () => !this.suspended, id => this.eggId===id)),
      subscribe: this.subscribe,
    });
    this.eggStations = content.eggStations.map(station => {
      if (!petService.catalog.egg(station.eggId)) throw Error(`蛋台引用未知蛋池: ${station.eggId}`);
      return { station, detector: new ZoneDetector(station.zone) };
    });
    this.zones = content.sales.map((zone) => new ZoneDetector(zone));
    this.shops = content.shops.map((p) => ({
      id: p.id,
      detector: new ZoneDetector(p.zone),
    }));
    this.clock = clock;
    // Locked ore a ticket still lacks goes to the material store; the rest to the bag.
    this.mining = new Mining(
      { isFull: () => this.bagFull(), add: batch => { const { stored, rest } = this.materials.take(batch, id => this.storeWants(id)); this.inventory.add(rest); this.stored = stored; this.storeFilled(stored); } },
      (targets) => this.world?.mine(targets) ?? false,
      oreDrops,
    );
    this.combat = new MiningCombat({
      isFull: () => this.bagFull(),
      stats: this.baseMiningStats,
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
    return {level:this.equipment.toolLevel,pets:this.petService.getInventory().count,equipped:this.petService.getEquipment().slots.some(id=>id!==null)};
  }
  private tipState(): TipState {
    const bag=this.inventory.getSnapshot(), facts=this.onboarding.getSnapshot();
    const egg=this.firstEggOffer();
    const nextWorld=WORLD_REQUIREMENTS.find(w=>!this.worldProgress.isOpen(w.id)&&this.worldProgress.unlockable(w.id));
    const ticket=nextWorld?.ticket;
    const ready=!!ticket&&this.equipment.toolLevel>=ticket.toolLevel&&this.wallet.getBalance(ticket.currency)>=ticket.price
      &&nextWorld!.materials.every(m=>this.materials.count(m.itemId)+(bag.items[m.itemId]??0)>=m.count);
    return {seen:id=>this.onboarding.has(id),location:this.guideLocation,atMine:this.atMine,minedOnce:facts.minedOnce,soldOnce:facts.soldOnce,
      full:bag.isFull,items:bag.totalCount,coins:this.wallet.getBalance(this.currency),level:this.equipment.toolLevel,upgradePrice:this.toolOffer().price,
      pets:this.petService.getInventory().count,eggPrice:egg?.price??null,
      layerUnlocked:this.content.destinations.some(d=>d.worldId===this.currentWorld&&this.exploration.has(d.id)),
      atStation:this.atStation,atPortal:this.atPortal,highestWorld:Math.max(...WORLD_REQUIREMENTS.filter(w=>this.worldProgress.isOpen(w.id)).map(w=>w.id)),
      readyWorld:ready&&nextWorld!.id!==1?nextWorld!.id as 2|3:null};
  }
  /** An available egg in this world's currency, cheapest first; a tutorial never advertises a locked offer. */
  private firstEggOffer() {
    return this.content.petContent.eggs.filter(e=>e.currency===this.currency&&this.petService.isUnlocked(e.id))
      .sort((a,b)=>a.price-b.price)[0];
  }
  /** At most one tip on screen, each shown once per save. It ends when the player does the thing,
   *  taps it away, or after a few seconds; something the player already did never gets a tip.
   *  Tips ended by the player's own action follow from saved facts (first block, first sale, pickaxe
   *  level, pets) and ride along with the next save; only a tip that merely timed out saves at once. */
  private updateTips() {
    if (this.suspended) return;
    const state=this.tipState(), now=this.tipClock();
    for (const id of TIP_IDS) if (id!==this.tip && tipLearned(id,state)) this.onboarding.markSeen(id);
    if (this.tip && tipLearned(this.tip,state)) this.endTip(now);
    // A full bag or a spent balance can interrupt advice. Retry it later, without recording it as seen.
    else if (this.tip && (state.full && this.tip!=='sell' || !tipRelevant(this.tip,state))) this.tip=null;
    else if (this.tip && now-this.tipSince>=TIP_SECONDS[this.tip] && this.endTip(now)) this.committed(false);
    if (!this.tip && this.tipsCovered===null && now>=this.tipQuietUntil) {
      const next=nextTip(state);
      if (next) { this.tip=next; this.tipSince=now; }
    }
  }
  private endTip(now: number) {
    const changed=!!this.tip&&this.onboarding.markSeen(this.tip);
    this.tip=null; this.tipQuietUntil=now+TIP_GAP;
    return changed;
  }
  /** A transient notice from the runtime (e.g. a world's scene still loading on the way there). */
  announce = (text: TextRef) => {
    if (this.notice !== text) { this.notice = text; this.publish(); }
  };
  /** The player tapped the tip away, or used the control it points at. */
  dismissTip = (id?: TipId) => {
    if (!this.tip || (id && id !== this.tip)) return;
    if (this.endTip(this.tipClock())) this.committed(false);
    this.publish();
  };
  /** The UI covers the game (a panel, the loading screen, the page in the background) or shows it again. While it is
   *  covered no tip starts and a tip's seconds stand still; a cover that comes during the quiet after a tip restarts
   *  the quiet when it goes: closing the shop a tip led to does not bring the next tip straight away. */
  coverTips = (covered: boolean) => {
    if (covered === (this.tipsCovered !== null)) return;
    if (covered) { this.tipsCovered = this.clock(); return; }
    this.tipsCoveredFor += this.clock() - this.tipsCovered!; this.tipsCovered = null;
    const now = this.tipClock();
    if (this.tipQuietUntil > now) this.tipQuietUntil = now + TIP_GAP;
    this.publish();
  };
  private makeSnapshot() {
    const bag=this.inventory.getSnapshot(), tip=this.tip?tipView(this.tip,this.tipState()):null;
    return Object.freeze({
      equipment: this.equipment.exportData(), shopCatalog:{tools:this.toolCatalog,backpacks:this.bagCatalog}, shopStock:this.shopStock(),
      currentWorld: this.currentWorld,
      // Worlds past the next one to unlock stay unknown: no name, no price (the portal shows ???).
      worlds:WORLD_REQUIREMENTS.map(w=>({...w,name:resolveText(w.name),title:resolveText(w.title),open:this.worldProgress.isOpen(w.id),known:this.worldProgress.isOpen(w.id)||this.worldProgress.unlockable(w.id),
        ticketBalance:w.ticket?this.wallet.getBalance(w.ticket.currency):0,toolLevel:this.equipment.toolLevel,
        // The ticket takes the store's first, then the bag's (a mineral not locked but still in the bag counts too).
        materials:w.materials.map(m=>({...m,name:resolveText(itemDefinition(m.itemId).name),owned:this.materials.count(m.itemId)+(bag.items[m.itemId]??0)}))})),
      /** 材料仓: what the tickets of the worlds not open yet ask for, how much of it is stored, and which are locked. */
      materials:this.storeView(),
      onboarding: this.onboarding.getSnapshot(), tip,
      // The first-dig tip points across the map at the mine until the player gets there.
      tipAnchor: tip?.anchor==='mine'?this.content.onboarding.entrance:null,
      inventory: this.inventory.getSnapshot(),
      backpackLevel: Math.max(1, ECONOMY.bags.filter(tier => tier.capacity <= bag.capacity).length),
      rebirth: this.rebirthView(),
      maxDepth: this.exploration.maxDepth,
      rewards: this.rewards.getSnapshot(),
      capsuleCoins: this.capsuleCoinReward(),
      capsuleCurrency: worldRequirement(this.capsuleWorld()).currency,
      atMachine: this.atMachine,
      autoHatch: this.autoHatchEgg,
      lastAutoHatch: this.lastAutoHatch,
      /** The current world's currency, what its ore sells for, and the balance in it. */
      currency: this.currency,
      coins: this.wallet.getBalance(this.currency),
      balances: this.wallet.getBalances(),
      saleMultiplier: this.saleMultiplier(),
      /** What the bag sells for: every kind but the locked ones. */
      sale: quoteCurrencySale(this.inventory.sellable(), itemPrice, itemCurrency, c => this.saleMultiplier(c)),
      inSellZone: this.inSellZone,
      atHome: this.atHome,
      /** Standing on the current world's teleport station pad. */
      atStation: this.atStation,
      /** Standing in front of the current world's portal to the other worlds. */
      atPortal: this.atPortal,
      shopId: this.shopId,
      /** The page the shop counter the player stands at opens on. */
      shopCategory: this.content.shops.find(s => s.id === this.shopId)?.category ?? 'tools',
      eggId: this.eggId,
      eggStation: this.eggStation,
      miningStats: this.baseMiningStats(),
      depth: this.depth,
      location: this.guideLocation,
      destinations: this.content.destinations.filter(r=>r.worldId===this.currentWorld).map((r) => ({
        id: r.id,
        name: resolveText(r.name),
        depth: r.depth,
        theme: r.theme,
        hasShop: !!r.shop,
        unlocked: this.exploration.has(r.id),
      })),
      notice: this.notice ? resolveText(this.notice) : '',
      noticeKind: this.notice?.id === 'msg.material_store_count_name_itemid_itemid2' ? 'materials' : null,
      target: this.targetView,
      hitSerial: this.lastHit,
      pickaxe: this.pickaxe.getSnapshot(),
      pickaxeUpgrade: this.toolOffer(),
      pickaxeEnhance: this.enhanceOffer(),
      petSlot: this.petSlotOffer(),
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
    this.updateTips();
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
    const id=worldAtZ(cell[2]*CELL);
    if(id!==this.currentWorld||!this.worldProgress.isOpen(id))return null;
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
      name: resolveText(item.name),
      hp,
      maximum: item.maxHp,
      volume: item.volume,
      price: item.price,
      requiredLevel, requiredToolName: requiredLevel ? resolveText(this.toolCatalog[requiredLevel - 1].name) : "", locked,
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
      this.notice = null;
      this.refreshTarget();
      this.publish();
    } else if (result.status === 'locked') {
      // The plate over the block says it (MiningOverlay), not a notice.
      this.refuse('locked');
    } else if (result.status === "full") {
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
      mergeGolden: (speciesId: string) => {
        const result = commands.mergeGolden(speciesId);
        if (result.status === 'merged') this.feedback({ type: 'hatched', tier: 3, auto: false });
        return result;
      },
      hatch: (id: string) => {
        const result = commands.hatch(id);
        if (result.status === 'hatched') this.feedback({ type: 'hatched', tier: this.petTier(result.pet), auto: false });
        else if (result.status === 'insufficient-coins') this.feedback({ type: 'denied', reason: 'coins' });
        return result;
      },
    };
  }
  /** The capsule machine stands in world 1 but pays where the player is heading: the furthest open world. */
  private capsuleWorld(): WorldId { return [...WORLD_REQUIREMENTS].reverse().find(w=>this.worldProgress.isOpen(w.id))!.id; }
  /** The capsule's coin prize, in that world's currency: about two minutes of income at the deepest layer reached
   *  there (economy.json `capsuleCoins`). */
  private capsuleCoinReward() {
    const world=this.capsuleWorld(),explored=this.explorations.get(world)!;
    const layer=this.content.destinations.filter(d=>d.worldId===world&&explored.has(d.id)).length;
    return layerEconomy(world,Math.min(layer,6)).capsuleCoins;
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
    const name=platform==='wechat'?tr("msg.wechat"):tr("msg.douyin");
    if(typeof location==='undefined')throw Error('Sharing requires the current browser page URL');
    const url=new URL(location.pathname,location.origin).href;
    const text=tr("msg.i_dug_down_maxdepth_m_in_mining_come_beat_my_depth_record_ur", { maxDepth: Math.floor(this.exploration.maxDepth), url: url, inviteCode: this.rewards.getSnapshot().inviteCode, name: name });
    try { await navigator.clipboard.writeText(text); }
    catch { return {status:'clipboard-failed' as const}; }
    if(this.suspended)return {status:'unavailable' as const};
    return this.finishReward(this.rewards.claimShare());
  };
  spinCapsule = () => {
    if(this.suspended)return {status:'unavailable' as const};
    if(!this.atMachine)return {status:'away' as const};
    const amount=this.capsuleCoinReward(),currency=worldRequirement(this.capsuleWorld()).currency;
    if(!this.wallet.canCredit(currency,amount))return {status:'overflow' as const};
    const result=this.rewards.spin(amount);
    if(result.status==='spun'){
      if(result.coinReward)this.wallet.credit(currency,result.coinReward);
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
        if(hatched.status==='hatched'){this.lastAutoHatch=hatched;this.committed(true);this.feedback({type:'hatched',tier:this.petTier(hatched.pet),auto:true});}
        else {this.stopAutoHatch();this.notice=message("msg.auto_hatch_stopped");}
      }
    }
    if(result.changed)this.committed(false);
    this.publish();
  };
  /** Full: the bag, counting the blocks already broken whose ore is still on its way, so subsequent swings stop at capacity. The last admitted whole block may overflow; its yield is never truncated. */
  private bagFull() {
    const bag=this.inventory.getSnapshot();
    return bag.used+(this.world?.pendingVolume?.(kind => oreDefinition(kind).volume)??0)>=bag.capacity;
  }
  /** How many of a mineral the tickets of the worlds not open yet ask for. */
  private ticketNeed(itemId: string) {
    return WORLD_REQUIREMENTS.filter(w=>!this.worldProgress.isOpen(w.id)).flatMap(w=>w.materials).filter(m=>m.itemId===itemId).reduce((n,m)=>n+m.count,0);
  }
  private storeView() {
    // The next world's minerals, and any other ticket's once some of it is stored (a later world stays unnamed).
    const closed=WORLD_REQUIREMENTS.filter(w=>!this.worldProgress.isOpen(w.id));
    const ids=[...new Set(closed.flatMap(w=>w.materials.map(m=>m.itemId)))]
      .filter(id=>this.materials.count(id)>0||closed.some(w=>this.worldProgress.unlockable(w.id)&&w.materials.some(m=>m.itemId===id)));
    return ids.map(itemId=>({itemId,name:resolveText(itemDefinition(itemId).name),stored:this.materials.count(itemId),needed:this.ticketNeed(itemId),locked:this.inventory.isLocked(itemId)}));
  }
  /** How many more of a mineral the store takes: what the tickets lack, once the player locked it. */
  private storeWants(itemId: string) { return this.inventory.isLocked(itemId)?this.ticketNeed(itemId):0; }
  /** A mineral whose store this just filled unlocks: the tickets have all of it, so more of it sells like any ore
   *  (kept locked, it would pile up in the bag, and unlocking it would give back the store's). */
  private storeFilled(stored: readonly { itemId: string }[]) {
    for (const { itemId } of stored) if (this.materials.count(itemId) >= this.ticketNeed(itemId)) this.inventory.setLocked(itemId, false);
  }
  /** Locks a kind of ore (2026-10-31: any kind, rock too): a sale leaves it in the bag. A mineral a ticket still lacks
   *  goes into the material store instead (what the bag holds of it at once, and every one dug from now on), where it
   *  takes no space, until the store has all the tickets need; then it unlocks by itself. */
  lockItem = (itemId: string) => {
    if(this.suspended||!knownItem(itemId))return {status:'unavailable'} as const;
    this.inventory.setLocked(itemId,true);
    const held=this.inventory.getSnapshot().items[itemId]??0;
    const {stored}=held?this.materials.take([{itemId,count:held}],id=>this.storeWants(id)):{stored:[]};
    if(stored.length&&!this.inventory.remove(stored))throw Error('背包矿物发生变化');
    this.storeFilled(stored);
    this.committed(true);this.publish();return {status:'locked',stored:stored[0]?.count??0} as const;
  };
  /** Unlocks a kind: the next sale sells it, what the material store kept of it back in the bag first. */
  unlockItem = (itemId: string) => {
    if(this.suspended||!this.inventory.isLocked(itemId))return {status:'unavailable'} as const;
    this.inventory.setLocked(itemId,false);
    const released=this.materials.release(itemId);
    if(released)this.inventory.add([{itemId,count:released}]);
    this.committed(true);this.publish();return {status:'unlocked',released} as const;
  };
  // Called once, after terrain has actually removed these cells. Never checks isFull.
  collected = (resources: readonly { kind: number; cell?: Coord }[]) => {
    const wasFull=this.inventory.isFull();
    this.stored=[];
    this.mining.collected(resources);
    if (resources.length) { const first=!this.onboarding.getSnapshot().minedOnce; this.onboarding.recordCollected(resources.length); this.committed(first); }
    for (const resource of resources)
      if (resource.cell) this.combat.destroyed(resource.cell.join(","));
    this.refreshTarget();
    this.notice = this.inventory.isFull() ? message("msg.bag_full_go_sell") : null;
    // Ticket ore says where it went: the store, and how much of it the tickets still lack.
    const kept=this.stored.at(-1);
    if (kept) this.notice = message("msg.material_store_count_name_itemid_itemid2", { count: this.stored.reduce((n,s)=>n+s.count,0), name: itemDefinition(kept.itemId).name, itemId: this.materials.count(kept.itemId), itemId2: this.ticketNeed(kept.itemId) });
    this.publish();
    if (resources.length) for (const listener of this.pickupListeners) listener(oreDrops(resources), this.stored);
    if (!wasFull && this.inventory.isFull()) this.refuse('full');
  };
  upgradePickaxe = (expectedLevel: number) => {
    if(this.suspended||expectedLevel!==this.equipment.toolLevel)return {status:'stale'} as const;
    const offer=this.toolOffer();
    if(!offer.next)return {status:'limit'} as const;
    if(!this.wallet.debit(offer.currency,offer.price)){this.feedback({type:'denied',reason:'coins'});return {status:'insufficient'} as const;}
    this.pickaxe.setLevel(offer.next.level);this.equipment.buyTool(offer.next.level);
    this.committed(true);this.refreshTarget();this.publish();this.feedback({type:'purchased'});
    return {status:'upgraded',level:offer.next.level,spent:offer.price} as const;
  };
  /** Enhances the newest pickaxe once (and equips it). `expected*` guard against a stale panel buying twice. */
  enhancePickaxe = (expectedLevel: number, expectedEnhance: number) => {
    if(this.suspended||expectedLevel!==this.equipment.toolLevel||expectedEnhance!==this.equipment.enhance)return {status:'stale'} as const;
    if(!this.shopStock()?.tools.some(t=>t.level===expectedLevel))return {status:'away'} as const;
    const offer=this.enhanceOffer();
    if(!offer.next)return {status:'max'} as const;
    if(!this.wallet.debit(offer.next.currency,offer.next.price)){this.feedback({type:'denied',reason:'coins'});return {status:'insufficient'} as const;}
    this.equipment.enhance=offer.next.enhance;this.pickaxe.setLevel(offer.level,offer.next.enhance);
    this.committed(true);this.refreshTarget();this.publish();this.feedback({type:'purchased'});
    return {status:'enhanced',level:offer.level,enhance:offer.next.enhance,spent:offer.next.price} as const;
  };
  upgradeBackpack = (tierId: string) => {
    if(this.suspended)return {status:'stale'} as const;
    const {next}=this.bagOffer();
    if(!next)return {status:'max'} as const;
    if(next.id!==tierId)return {status:'stale'} as const;
    if(!this.wallet.debit(next.currency,next.price)){this.feedback({type:'denied',reason:'coins'});return {status:'insufficient'} as const;}
    this.inventory.setCapacity(next.capacity!);this.equipment.buyBackpack(next.capacity!);
    this.committed(true);this.publish();this.feedback({type:'purchased'});
    return {status:'upgraded',capacity:next.capacity!,spent:next.price} as const;
  };
  /** The shop counters open in a world: its surface's, and those of its halls of layers 2 and 4 once reached. */
  private openShops(world: WorldId) {
    return this.content.shops.filter(s => s.world === world && (s.layer === 0 || !!this.explorations.get(world)?.has(s.id)));
  }
  /** What the counter the player stands at sells (economy.json `shop`: its world and layer), and the newest pickaxe
   *  of that world, which every shop of the world enhances. Null away from a counter. */
  private shopStock() {
    const counter = this.content.shops.find(s => s.id === this.shopId);
    if (!counter) return null;
    const sells = (item: ShopItem) => item.world === counter.world && item.shop === counter.layer;
    return Object.freeze({
      tools: this.toolCatalog.filter(t => sells(t) || (t.level === this.equipment.toolLevel && t.world === counter.world)),
      backpacks: this.bagCatalog.filter(sells),
    });
  }
  /** The shop button: to the furthest shop open in this world (on world 1's surface, the counter of the page asked
   *  for); with 'next', to the one selling the next pickaxe or backpack, when it is open. 'here' if already there. */
  goToShop = (category: ShopCategory = 'tools', aim: 'furthest' | 'next' = 'furthest') => {
    if (this.suspended || !this.world?.travelTo) return 'unavailable' as const;
    const open = this.openShops(this.currentWorld);
    const atLayer = (layer: number) => open.filter(s => s.layer === layer).sort((a, b) => +(b.category === category) - +(a.category === category))[0];
    let target = atLayer(Math.max(...open.map(s => s.layer)));
    if (aim === 'next') {
      const next = category === 'tools' ? this.toolCatalog[this.equipment.toolLevel] : this.bagCatalog.find(b => b.id === this.bagOffer().next?.id);
      if (next && next.world === this.currentWorld) target = atLayer(next.shop) ?? target;
    }
    if (!target) return 'unavailable' as const;
    if (target.id === this.shopId) return 'here' as const;
    const z = target.zone;
    this.world.cancelMining();
    this.world.travelTo([z.x, z.y + .1, z.z], z.lookAt ?? [z.x, z.y + 1, z.z - 6]);
    this.resetPosition();
    return 'travelling' as const;
  };
  useShopItem = (category:ShopCategory,id:string) => {
    // Bought and worn at a counter, from what that counter sells (the shop button takes the player to one).
    if(this.suspended)return {status:'unavailable'} as const;
    const stock=this.shopStock();
    if(!stock)return {status:'away'} as const;
    const item=stock[category].find(x=>x.id===id);
    if(!item)return {status:'unavailable'} as const;
    const owned=category==='tools'?this.equipment.ownsTool(item.level):this.equipment.ownsBackpack(item.capacity!);
    if(!owned) {
      if(category==='backpacks'&&item.capacity!<this.inventory.getSnapshot().used&&item.capacity!<this.inventory.capacity)return {status:'too-small'} as const;
      if(!this.wallet.debit(item.currency,item.price)){this.feedback({type:'denied',reason:'coins'});return {status:'insufficient'} as const;}
      if(category==='tools') {this.equipment.buyTool(item.level);this.pickaxe.setLevel(item.level,item.level===this.equipment.toolLevel?this.equipment.enhance:0);this.refreshTarget();}
      else {this.equipment.buyBackpack(item.capacity!);this.inventory.setCapacity(item.capacity!);}
      this.committed(true);this.publish();this.feedback({type:'purchased'});
      return category==='tools'?{status:'upgraded',level:item.level,spent:item.price} as const:{status:'upgraded',capacity:item.capacity!,spent:item.price} as const;
    }
    if(category==='tools') {
      if(this.pickaxe.getSnapshot().level===item.level)return {status:'equipped'} as const;
      this.pickaxe.setLevel(item.level,item.level===this.equipment.toolLevel?this.equipment.enhance:0);this.refreshTarget();
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
    const world=worldAtFeet(feet);
    if(!this.worldProgress.isOpen(world)){this.world?.travelTo?.(worldSpawn(this.currentWorld));return;}
    if(world!==this.currentWorld){this.currentWorld=world;this.stopAutoHatch();changed=true;}
    const machineEvent=this.machineZone.update(feet,grounded);
    if(machineEvent){this.atMachine=machineEvent==='enter';changed=true;}
    const sampledDepth = playerDepthAtFeet(feet, grounded, this.content.destinations);
    // Sell's floor: anywhere inside a hall is on its floor, on a step or a crate, mid-jump or just arrived and not yet
    // landed (2026-11-02: a player in the mushroom cave stood on something and Sell sent them up to the old mine).
    this.positionDepth = environmentDepthAtFeet(feet, grounded, this.content.destinations);
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
    const location=feet[1]>=-.1||feet[1]>=-1.2&&this.onSunkenSurface(feet)?'surface':enteredRooms?.length?'room':'mine';
    const roomId=location==='room'?enteredRooms![0]:null;
    if(roomId!==this.guideRoomId){this.guideRoomId=roomId;changed=true;}
    const {entrance,mineArea:area}=this.content.onboarding;
    const atMine=feet[0]>=area.minX-2&&feet[0]<=area.maxX+2&&feet[2]>=area.minZ-2&&feet[2]<=area.maxZ+4;
    if(atMine!==this.atMine){this.atMine=atMine;changed=true;}
    const near=Math.hypot(feet[0]-entrance[0],feet[2]-entrance[2])<14;
    if(location!==this.guideLocation||near!==this.nearMine){this.guideLocation=location;this.nearMine=near;changed=true;}
    const added = this.exploration.visit(sampledDepth);
    if (this.exploration.maxDepth !== oldMaximum || added.length) { changed=true; this.committed(added.length > 0); }
    if (added.length) {
      this.notice = message("msg.name_unlocked_teleport_there_from_the_surface_its_pet_egg_is", { name: this.content.destinations.find((r) => r.id === added.at(-1))!.name });
      changed = true;
      this.feedback({ type: 'unlocked' });
    }
    for(const h of this.homes)h.detector.update(feet,grounded);
    const inside=this.homes.some(h=>h.worldId===this.currentWorld&&h.detector.isInside);
    if(inside!==this.atHome){this.atHome=inside;changed=true;}
    for(const st of this.stations)st.detector.update(feet,grounded);
    const onPad=this.stations.some(st=>st.worldId===this.currentWorld&&st.detector.isInside);
    if(onPad!==this.atStation){this.atStation=onPad;changed=true;if(onPad&&this.onboarding.markSeen('station'))this.committed(false);}
    for(const p of this.portals)p.detector.update(feet,grounded);
    const atPortal=this.portals.some(p=>p.worldId===this.currentWorld&&p.detector.isInside);
    if(atPortal!==this.atPortal){this.atPortal=atPortal;changed=true;if(atPortal&&this.onboarding.markSeen('portal'))this.committed(false);}
    for (const shop of this.shops) shop.detector.update(feet, grounded);
    const activeShop =
      this.shops.find((shop) => shop.detector.isInside)?.id ?? null;
    if (activeShop !== this.shopId) {
      this.shopId = activeShop;
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
      this.executeSale();
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
    for(const h of this.homes)h.detector.reset();
    for(const st of this.stations)st.detector.reset();this.atStation=false;
    for(const p of this.portals)p.detector.reset();this.atPortal=false;
    this.atHome = false;
    this.shopId = null;
    this.inSellZone = false;
    this.publish();
  }
  travelTo = (id: string) => {
    if (this.suspended) return "unavailable" as const;
    const room = this.content.destinations.find((r) => r.id === id);
    if (!room || !this.exploration.has(id)) return "locked" as const;
    if(room.worldId!==this.currentWorld)return 'locked' as const;
    if (!this.world?.travelTo) return "unavailable" as const;
    return this.beginTravel(room);
  };
  private beginTravel(room: Destination) {
    this.world!.cancelMining();
    this.world!.travelTo!(room.spawn);
    this.resetPosition();
    // Pad detectors keep their entry latch until feet actually leave the pad.
    this.notice = message("msg.go_to_name", { name: room.name });
    this.publish();
    return "travelling" as const;
  }
  returnToSurface = () => {
    if (this.suspended || !this.world) return;
    this.world.cancelMining();
    this.world.travelTo?.(worldSpawn(this.currentWorld));
    this.resetPosition();
    this.notice = null;
    this.publish();
  };
  /** The surface hub doubles as the teleport station; portable travel works anywhere. */
  private sunken: ReadonlySet<string> | null = null;
  /** In a sunken stretch of the surface (the creek), where the voxel floor sits no higher than -2 m. */
  private onSunkenSurface(feet: readonly number[]) {
    const cells = this.content.sunkenSurface;
    if (!cells.length) return false;
    if (!this.sunken) { const keys = new Set<string>(); for (let i = 0; i + 1 < cells.length; i += 2) keys.add(cells[i] + ',' + cells[i + 1]); this.sunken = keys; }
    return this.sunken.has(Math.floor(feet[0] / CELL) + ',' + Math.floor(feet[2] / CELL));
  }
  private serviceSpot(target: 'shop' | 'sale' | 'capsule' | 'station' | 'portal' | { egg: string }): { feet: Coord; look: Coord } | null {
    const worldZ = worldRequirement(this.currentWorld).z;
    const near = (zone: { y: number; z: number }) => zone.y >= -.1 && Math.abs(zone.z - worldZ) < 100;
    // Arrive facing the counter: zones may name their building; older content faces +Z buildings.
    const facingBuilding = (zone: { x: number; y: number; z: number; lookAt?: readonly [number, number, number] }) =>
      ({ feet: [zone.x, zone.y + .1, zone.z] as Coord, look: (zone.lookAt ?? [zone.x, zone.y + 1, zone.z - 6]) as Coord });
    if (target === 'shop') { const zone = this.content.shops.find(s => near(s.zone))?.zone; return zone ? facingBuilding(zone) : null; }
    if (target === 'sale') {
      // Go upward from the current position, including the floor being stood on; past exploration is irrelevant.
      const zone = this.content.sales
        .filter(zone => worldAtZ(zone.z) === this.currentWorld && zone.y >= -this.positionDepth)
        .sort((a, b) => a.y - b.y)[0];
      return zone ? facingBuilding(zone) : null;
    }
    if (target === 'capsule') return this.currentWorld === 1 ? facingBuilding(CAPSULE_MACHINE_ZONE) : null;
    if (target === 'station' || target === 'portal') {
      const zone=(target==='station'?this.content.stations:this.content.portals).find(s=>s.worldId===this.currentWorld)?.zone;
      return zone?facingBuilding(zone):null;
    }
    if (!this.petService.isUnlocked(target.egg)) return null;
    const station = this.content.eggStations.find(s => s.eggId === target.egg);
    return station ? { feet: [station.zone.x, station.zone.y + .1, station.zone.z], look: station.promptAnchor as Coord } : null;
  }
  /** Instant trip to a service; Sell uses the first sale floor upward in the current world. */
  goTo = (target: 'shop' | 'sale' | 'capsule' | 'station' | 'portal' | { egg: string }) => {
    if (this.suspended || !this.world?.travelTo) return 'unavailable' as const;
    const spot = this.serviceSpot(target);
    if (!spot) return 'unavailable' as const;
    this.world.cancelMining();
    this.world.travelTo(spot.feet, spot.look);
    this.resetPosition();
    return 'travelling' as const;
  };
  /** Tips only take the player to an entrance. Buying an egg and paying a world ticket remain explicit actions. */
  followTip = (id: TipId) => {
    const state=this.tipState();
    if(this.suspended||id!==this.tip||tipLearned(id,state)||!tipRelevant(id,state)||id==='dig'||id==='sell')return false;
    const egg=id==='pets'?this.firstEggOffer():null;
    if(id==='pets'&&!egg)return false;
    const result=id==='shop'?this.goToShop('tools'):this.goTo(egg?{egg:egg.id}:id==='station'?'station':'portal');
    if(result!=='travelling'&&result!=='here')return false;
    // Travel resets the location and may already have hidden the active tip. Persist the action by its ID.
    const changed=this.onboarding.markSeen(id);
    if(this.tip===id)this.tip=null;
    this.tipQuietUntil=this.tipClock()+TIP_GAP;
    if(changed)this.committed(false);
    this.publish();
    return true;
  };
  /** Rebirth, once the journey is complete: every currency, the tool, the backpack and the ore in it, the worlds
   *  past the first, every layer reached and the kept minerals go; pets and pet slots stay. Ore then sells for the
   *  next multiplier, and the player starts again at world 1's spawn. */
  rebirth = (expectedCount: number) => {
    if(this.suspended||expectedCount!==this.rebirthRecord.count)return {status:'stale'} as const;
    if(!this.rebirthView().ready){this.feedback({type:'denied',reason:'locked'});return {status:'locked'} as const;}
    this.world?.cancelMining();
    this.wallet.clear();
    this.inventory.remove(Object.entries(this.inventory.getSnapshot().items).map(([itemId,count])=>({itemId,count})));
    for(const id of this.inventory.getSnapshot().locked)this.inventory.setLocked(id,false);
    const starter=ECONOMY.bags[0].capacity;
    this.inventory.setCapacity(starter);this.pickaxe.setLevel(1);this.equipment.reset(1,starter);
    this.worldProgress.reset();this.materials.clear();
    for(const w of WORLD_REQUIREMENTS)this.explorations.set(w.id,new Exploration(this.content.destinations.filter(d=>d.worldId===w.id)));
    this.currentWorld=1;
    this.rebirthRecord.count++;
    this.world?.travelTo?.(worldSpawn(1));this.resetPosition();
    this.refreshTarget();this.committed(true);this.publish();
    const count=this.rebirthRecord.count,multiplier=rebirthMultiplier(count);
    this.feedback({type:'reborn',count,multiplier});
    return {status:'reborn',count,multiplier} as const;
  };
  /** From a world portal to another unlocked world: arrive at its spawn, facing its mine. */
  travelWorld = (id: WorldId) => {
    if(this.suspended||!this.world?.travelTo)return 'unavailable' as const;
    if(!this.worldProgress.isOpen(id))return 'locked' as const;
    if(!this.atPortal)return 'away' as const;
    this.world.cancelMining();
    this.world.travelTo(worldSpawn(id));
    this.resetPosition();
    return 'travelling' as const;
  };
  /** The test unlock page: every world and layer with its state. */
  devUnlocks = () => {
    return WORLD_REQUIREMENTS.map(w=>({id:w.id,name:resolveText(w.name),open:this.worldProgress.isOpen(w.id),
      layers:this.content.destinations.filter(d=>d.worldId===w.id).map(d=>({id:d.id,name:resolveText(d.name),depth:d.depth,unlocked:!!this.explorations.get(w.id)?.has(d.id)}))}));
  };
  /** Test shortcut: adds the current world's currency (debug page only). */
  devGrantCoins = (coins: number) => {
    if(!this.wallet.canCredit(this.currency,coins))return false;
    this.wallet.credit(this.currency,coins);this.committed(true);this.publish();return true;
  };
  /** Test shortcut: opens a world (and the ones before it) as if its requirements were paid. */
  devUnlockWorld = (id: WorldId) => {
    this.worldProgress.openThrough(id);this.committed(true);this.publish();
  };
  /** Test shortcut: unlocks one layer (and its world), or every layer when no id is given. */
  devUnlockLayer = (id?: string) => {
    const rooms=this.content.destinations.filter(d=>id===undefined||d.id===id);
    for(const room of rooms){
      const world=room.worldId;
      this.worldProgress.openThrough(world);
      this.explorations.get(world)?.grant(room.id);
    }
    this.committed(true);this.publish();
  };
  /** Test shortcut: every world past the first and every layer locked again, as at a fresh start, and the player back
   *  at world 1's spawn; money, tools, bag, material store and pets stay. */
  devResetUnlocks = () => {
    this.world?.cancelMining();
    this.worldProgress.reset();
    for(const w of WORLD_REQUIREMENTS)this.explorations.set(w.id,new Exploration(this.content.destinations.filter(d=>d.worldId===w.id)));
    this.currentWorld=1;
    this.world?.travelTo?.(worldSpawn(1));this.resetPosition();
    this.refreshTarget();this.committed(true);this.publish();
  };
  /** Sells the whole bag (ticket minerals wait in the material store, never in the bag), stepping into the sell ring
   *  or with 全部出售 standing in it: the same save, coins flying into the counter and notice either way. */
  private executeSale() {
    const result=sellCurrencyItems(this.inventory,this.wallet,itemPrice,itemCurrency,this.inventory.sellable(),c => this.saleMultiplier(c));
    if(result.status==='sold'){this.onboarding.record('soldOnce');this.committed(true);this.feedback({ type: 'sold', payouts: result.payouts, count: result.count });}
    this.notice=result.status==='sold'?message("msg.sold_count_items_for_payouts", { count: result.count, payouts: result.payouts.map(p => message("msg.sale_payout", { coins: p.coins, currency: currencyText(p.currency) })).reduce((left, right) => message("msg.sale_payout_join", { left, right })) })
      :result.status==='empty'?(this.inventory.getSnapshot().totalCount?message("msg.locked_ore_is_never_sold"):message("msg.nothing_to_sell")):message("msg.amount_out_of_range");
    return result;
  }
  sellAvailable = () => {
    if(this.suspended||!this.inSellZone)return {status:'unavailable'} as const;
    const result=this.executeSale();
    this.publish();return result;
  };
  /** Pays a world's price at a portal and opens it for good. */
  unlockWorld = (id: WorldId) => {
    if(this.suspended)return {status:'unavailable'} as const;
    if(this.worldProgress.isOpen(id))return {status:'already-open'} as const;
    if(!this.worldProgress.unlockable(id))return {status:'previous-locked'} as const;
    if(!this.atPortal)return {status:'away'} as const;
    const requirement=worldRequirement(id),ticket=requirement.ticket!;
    if(this.equipment.toolLevel<ticket.toolLevel)return {status:'insufficient-level'} as const;
    const bag=this.inventory.getSnapshot().items;
    if(requirement.materials.some(m=>this.materials.count(m.itemId)+(bag[m.itemId]??0)<m.count))return {status:'insufficient-materials'} as const;
    if(this.wallet.getBalance(ticket.currency)<ticket.price)return {status:'insufficient-coins'} as const;
    // All checks precede this synchronous transfer: the minerals come out of the material store, the rest the bag.
    const rest=this.materials.pay(requirement.materials);
    if(rest.length&&!this.inventory.remove(rest))throw Error('缴纳矿产发生变化');
    if(!this.wallet.debit(ticket.currency,ticket.price))throw Error('缴纳货币发生变化');
    this.worldProgress.unlock(id);
    this.notice=message("msg.name_is_open_you_can_teleport_there_now", { name: requirement.name });
    this.committed(true);this.publish();return {status:'opened'} as const;
  };
}
