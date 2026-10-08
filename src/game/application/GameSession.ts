import type { ProgressDataV1 } from './SessionProgress.ts';
import { versionOne } from '../logic/data.ts';
import { PetCommands } from './PetCommands.ts';
import type { SessionContent, Destination, EggStation } from "./SessionContent.ts";
import { PetService } from "./PetService.ts";
import { PetUiAdapter } from "./PetUiAdapter.ts";
import { MiningAttributes } from "./MiningAttributes.ts";
import { Exploration } from "../logic/Exploration.ts";
import { Inventory } from "../logic/Inventory.ts";
import { Wallet } from "../logic/Wallet.ts";
import { ZoneDetector } from "../logic/ZoneDetector.ts";
import { Mining } from "./Mining.ts";
import { quoteSale, sellAll } from "./Sale.ts";
import { backpackOffer, upgradeBackpack } from "./BackpackUpgrade.ts";
import { Pickaxe } from "../logic/Pickaxe.ts";
import { MiningCombat } from "./MiningCombat.ts";
import { pickaxeOffer, upgradePickaxe } from "./PickaxeUpgrade.ts";
import { oreDrops, oreDefinition, itemVolume, itemPrice } from "./items.ts";
import type { Coord } from "../terrain/SparseWorld.ts";
export type WorldCommands = {
  cell(target: Coord): number | null;
  canMine?(target: Coord): boolean;
  pending(target: Coord): boolean;
  mine(targets: readonly Coord[]): boolean;
  cancelMining(): void;
  returnToSurface(): void;
  travelTo?(feet: Coord): void;
};
export class GameSession {
  readonly pets: PetUiAdapter;
  private readonly petService: PetService;
  private progressListeners = new Set<(change: { urgent: boolean }) => void>();
  suspended = false;
  setSuspended(value: boolean) { this.suspended = value; if (value) this.world?.cancelMining(); }
  onProgressCommitted = (listener: (change: { urgent: boolean }) => void) => {
    this.progressListeners.add(listener);
    return () => { this.progressListeners.delete(listener); };
  };
  private committed(urgent: boolean) { for (const listener of this.progressListeners) listener({ urgent }); }
  exportProgress(): ProgressDataV1 {
    return { version: 1 as const, wallet: this.wallet.exportData(), inventory: this.inventory.exportData(),
      pickaxe: this.pickaxe.exportData(), pets: this.petService.exportData(), exploration: this.exploration.exportData() };
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
  private readonly exploration: Exploration;
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
  }> | null = null;
  private lastHit = 0;
  private clock: () => number;
  private snapshot;
  constructor(
    content: SessionContent,
    capacity = 50,
    clock: () => number = () => performance.now() / 1000,
    petDependencies: { random?: () => number; createPetId?: () => string } = {},
    saved?: unknown,
  ) {
    this.content = content;
    const data = saved === undefined ? null : versionOne(saved);
    this.wallet = data ? Wallet.fromData(data.wallet) : new Wallet(content.initialCoins ?? 0);
    this.pickaxe = data ? Pickaxe.fromData(data.pickaxe) : new Pickaxe();
    this.inventory = data ? Inventory.fromData(data.inventory, itemVolume) : new Inventory(capacity, itemVolume);
    this.exploration = data ? Exploration.fromData(data.exploration, content.destinations, content.initiallyUnlocked) : new Exploration(content.destinations, content.initiallyUnlocked);
    const petService = new PetService({
      content: content.petContent ?? { pets: [], eggs: [], equipSlots: 3 },
      wallet: this.wallet,
      random: petDependencies.random ?? Math.random,
      createPetId: petDependencies.createPetId ?? (() => crypto.randomUUID()),
    });
    this.petService = petService;
    if (data) petService.restoreData(data.pets);
    this.miningAttributes = new MiningAttributes(this.pickaxe.getSnapshot, petService.getBonus);
    this.pets = new PetUiAdapter(petService, {
      balance: () => this.wallet.getBalance(),
      baseStats: this.pickaxe.getSnapshot,
      effectiveStats: this.miningAttributes.getSnapshot,
      commands: new PetCommands(petService, () => { this.committed(true); this.publish(); }, () => !this.suspended),
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
      read: (cell) => {
        const kind = this.mineableKind(cell);
        return kind
          ? { key: cell.join(","), maximum: oreDefinition(kind).maxHp }
          : null;
      },
      pending: (cell) => this.world?.pending(cell) ?? false,
      destroy: (cell) => this.world?.mine([cell]) ?? false,
    });
    this.snapshot = this.makeSnapshot();
  }
  private makeSnapshot() {
    return Object.freeze({
      inventory: this.inventory.getSnapshot(),
      coins: this.wallet.getBalance(),
      sale: quoteSale(this.inventory.getSnapshot().items, itemPrice),
      inSellZone: this.inSellZone,
      atHome: this.atHome,
      shopId: this.shopId,
      eggId: this.eggId,
      eggStation: this.eggStation,
      miningStats: this.miningAttributes.getSnapshot(),
      depth: this.depth,
      destinations: this.content.destinations.map((r) => ({
        id: r.id,
        name: r.name,
        depth: r.depth,
        unlocked: this.exploration.has(r.id),
      })),
      notice: this.notice,
      target: this.targetView,
      hitSerial: this.lastHit,
      pickaxe: this.pickaxe.getSnapshot(),
      pickaxeUpgrade: pickaxeOffer(
        this.pickaxe.getSnapshot().level,
        this.wallet.getBalance(),
      ),
      backpackUpgrade: backpackOffer(
        this.inventory.capacity,
        this.wallet.getBalance(),
      ),
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
    if (this.targetView?.key === key && this.targetView.hp === hp) return false;
    this.targetView = Object.freeze({
      key,
      name: item.name,
      hp,
      maximum: item.maxHp,
      volume: item.volume,
      price: item.price,
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
    } else if (
      result.status === "full" &&
      this.notice !== "背包已满，前往售卖点出售"
    ) {
      this.notice = "背包已满，前往售卖点出售";
      this.publish();
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
  // Called once, after terrain has actually removed these cells. Never checks isFull.
  collected = (resources: readonly { kind: number; cell?: Coord }[]) => {
    this.mining.collected(resources);
    if (resources.length) this.committed(false);
    for (const resource of resources)
      if (resource.cell) this.combat.destroyed(resource.cell.join(","));
    this.refreshTarget();
    this.notice = this.inventory.isFull() ? "背包已满，前往售卖点出售" : "";
    this.publish();
  };
  upgradePickaxe = (expectedLevel: number) => {
    if (this.suspended) return { status: 'stale' } as const;
    const result = upgradePickaxe(expectedLevel, this.pickaxe, this.wallet);
    if (result.status === "upgraded") {
      this.committed(true);
      this.notice = `镐子提升至 Lv.${result.level}`;
      this.publish();
    }
    return result;
  };
  upgradeBackpack = (tierId: string) => {
    if (this.suspended) return { status: 'stale' } as const;
    const result = upgradeBackpack(tierId, this.inventory, this.wallet);
    if (result.status === "upgraded") {
      this.committed(true);
      this.notice = `背包容量提升至 ${result.capacity}`;
      this.publish();
    }
    return result;
  };
  updatePosition(feet: readonly number[], grounded: boolean) {
    if (this.suspended) return;
    let changed = false;
    const depth = Math.max(0, Math.floor(-feet[1]));
    if (depth !== this.depth) {
      this.depth = depth;
      changed = true;
    }
    // Rapier leaves a small contact skin above a floor. Count standing on the
    // milestone floor as reaching it; airborne depth has no such tolerance.
    const oldMaximum = this.exploration.maxDepth;
    const added = this.exploration.visit(
      Math.max(0, -feet[1] + (grounded ? 0.04 : 0)),
    );
    if (this.exploration.maxDepth !== oldMaximum || added.length) this.committed(added.length > 0);
    if (added.length) {
      this.notice = `已解锁 ${this.content.destinations.find((r) => r.id === added.at(-1))!.name}，可回家传送`;
      changed = true;
    }
    const homeEvent = this.home.update(feet, grounded);
    if (homeEvent) {
      this.atHome = homeEvent === "enter";
      changed = true;
    }
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
      const result = sellAll(this.inventory, this.wallet, itemPrice);
      if (result.status === "sold") this.committed(true);
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
        : `到达 ${room.depth} 米后解锁 ${room.name}`;
      changed = true;
    }
    if (changed) this.publish();
  }
  resetPosition() {
    this.targetCell = null;
    this.targetView = null;
    for (const zone of this.zones) zone.reset();
    for (const shop of this.shops) shop.detector.reset();
    for (const station of this.eggStations) station.detector.reset();
    this.eggId = null;
    this.eggStation = null;
    this.home.reset();
    this.atHome = false;
    this.shopId = null;
    this.inSellZone = false;
    this.publish();
  }
  travelTo = (id: string) => {
    if (this.suspended) return "unavailable" as const;
    const room = this.content.destinations.find((r) => r.id === id);
    if (!room || !this.exploration.has(id)) return "locked" as const;
    if (!this.atHome) return "away" as const;
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
    this.world.returnToSurface();
    this.resetPosition();
    this.notice = "走进金色圆圈出售，或踩左侧圆盘前往已解锁层";
    this.publish();
  };
}
