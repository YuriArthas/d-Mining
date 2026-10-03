import { Inventory } from '../logic/Inventory.ts';
import { Wallet } from '../logic/Wallet.ts';
import { ZoneDetector } from '../logic/ZoneDetector.ts';
import { Mining } from './Mining.ts';
import { quoteSale, sellAll } from './Sale.ts';
import { backpackOffer, upgradeBackpack } from './BackpackUpgrade.ts';
import { Pickaxe } from '../logic/Pickaxe.ts';
import { MiningCombat } from './MiningCombat.ts';
import { pickaxeOffer, upgradePickaxe } from './PickaxeUpgrade.ts';
import { oreDrops, oreDefinition, itemVolume, itemPrice, SELL_ZONE } from './items.ts';
import type { Coord } from '../terrain/SparseWorld.ts';
export type WorldCommands = { cell(target: Coord): number | null; pending(target: Coord): boolean; mine(targets: readonly Coord[]): boolean; cancelMining(): void; returnToSurface(): void };
export class GameSession {
  private inventory: Inventory;
  private wallet = new Wallet();
  private world: WorldCommands | null = null;
  private zone = new ZoneDetector(SELL_ZONE);
  private inSellZone = false;
  private notice = '';
  private listeners = new Set<() => void>();
  private mining: Mining<Coord, { kind: number }>;
  private pickaxe = new Pickaxe();
  private combat: MiningCombat<Coord>;
  private targetCell: Coord | null = null;
  private targetView: Readonly<{ key: string; name: string; hp: number; maximum: number; volume: number; price: number }> | null = null;
  private lastHit = 0;
  private clock: () => number;
  private snapshot;
  constructor(capacity = 50, clock: () => number = () => performance.now() / 1000) {
    this.clock = clock;
    this.inventory = new Inventory(capacity, itemVolume);
    this.mining = new Mining(this.inventory, targets => this.world?.mine(targets) ?? false, oreDrops);
    this.combat = new MiningCombat({
      isFull: () => this.inventory.isFull(), stats: this.pickaxe.getSnapshot,
      read: cell => { const kind = this.world?.cell(cell); return kind ? { key: cell.join(','), maximum: oreDefinition(kind).maxHp } : null; },
      pending: cell => this.world?.pending(cell) ?? false,
      destroy: cell => this.world?.mine([cell]) ?? false,
    });
    this.snapshot = this.makeSnapshot();
  }
  private makeSnapshot() { return Object.freeze({ inventory: this.inventory.getSnapshot(), coins: this.wallet.getBalance(), sale: quoteSale(this.inventory.getSnapshot().items, itemPrice), inSellZone: this.inSellZone, notice: this.notice, target: this.targetView, hitSerial: this.lastHit, pickaxe: this.pickaxe.getSnapshot(), pickaxeUpgrade: pickaxeOffer(this.pickaxe.getSnapshot().level, this.wallet.getBalance()), backpackUpgrade: backpackOffer(this.inventory.capacity, this.wallet.getBalance()) }); }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.snapshot = this.makeSnapshot(); for (const listener of this.listeners) listener(); }
  attach(world: WorldCommands) { this.world = world; return () => { if (this.world === world) this.world = null; }; }
  private refreshTarget() {
    const kind = this.targetCell && this.world?.cell(this.targetCell);
    const item = kind ? oreDefinition(kind) : null;
    const key = this.targetCell?.join(',') ?? '';
    const hp = item ? this.combat.health.get(key, item.maxHp) : 0;
    if (!item) { if (!this.targetView) return false; this.targetView = null; return true; }
    if (this.targetView?.key === key && this.targetView.hp === hp) return false;
    this.targetView = Object.freeze({ key, name: item.name, hp, maximum: item.maxHp, volume: item.volume, price: item.price }); return true;
  }
  selectTarget = (cell: Coord | null) => {
    this.targetCell = cell;
    if (this.refreshTarget()) this.publish();
  };
  hit = (cell: Coord) => {
    if (this.inSellZone) return { status: 'unavailable' } as const;
    const result = this.combat.hit(cell, this.clock());
    if (result.status === 'hit' || result.status === 'breaking') {
      if (result.damage) this.lastHit++;
      this.notice = ''; this.refreshTarget(); this.publish();
    } else if (result.status === 'full' && this.notice !== '背包已满，返回地表出售') {
      this.notice = '背包已满，返回地表出售'; this.publish();
    }
    return result;
  };
  requestMine = (targets: readonly Coord[]) => {
    if (targets.length !== 1) return false; // Current pickaxe attacks one block.
    const result = this.hit(targets[0]);
    return result.status === 'hit' || result.status === 'breaking';
  };
  blockHealth = (cell: Coord) => {
    const kind = this.world?.cell(cell);
    return kind ? this.combat.health.get(cell.join(','), oreDefinition(kind).maxHp) : null;
  };
  observeBlockDamage = (listener: (damage: Readonly<{ cell: Coord; hp: number; maximum: number }>) => void) =>
    this.combat.health.observe((key, hp) => {
      const cell = key.split(',').map(Number) as unknown as Coord;
      const kind = hp === null ? null : this.world?.cell(cell);
      listener({ cell, hp: hp ?? 0, maximum: kind ? oreDefinition(kind).maxHp : 0 });
    });
  combatDebug = () => ({ damagedCells: this.combat.health.size, nextAttackAt: this.combat.cooldown.nextAt, now: this.clock() });
  // Called once, after terrain has actually removed these cells. Never checks isFull.
  collected = (resources: readonly { kind: number; cell?: Coord }[]) => {
    this.mining.collected(resources);
    for (const resource of resources) if (resource.cell) this.combat.destroyed(resource.cell.join(','));
    this.refreshTarget();
    this.notice = this.inventory.isFull() ? '背包已满，返回地表出售' : '';
    this.publish();
  };
  upgradePickaxe = (expectedLevel: number) => {
    const result = upgradePickaxe(expectedLevel, this.pickaxe, this.wallet);
    if (result.status === 'upgraded') { this.notice = `镐子提升至 Lv.${result.level}`; this.publish(); }
    return result;
  };
  upgradeBackpack = (tierId: string) => {
    const result = upgradeBackpack(tierId, this.inventory, this.wallet);
    if (result.status === 'upgraded') {
      this.notice = `背包容量提升至 ${result.capacity}`;
      this.publish();
    }
    return result;
  };
  updatePosition(feet: readonly number[], grounded: boolean) {
    const event = this.zone.update(feet, grounded);
    if (!event) return;
    this.inSellZone = event === 'enter';
    if (this.inSellZone) {
      this.world?.cancelMining();
      const result = sellAll(this.inventory, this.wallet, itemPrice);
      this.notice = result.status === 'sold' ? `出售 ${result.count} 件，获得 ${result.coins} 金币` : result.status === 'empty' ? '没有可出售的矿物' : '金币数值超出范围';
    }
    this.publish();
  }
  resetPosition() { this.targetCell = null; this.targetView = null; this.zone.reset(); this.inSellZone = false; this.publish(); }
  returnToSurface = () => {
    if (!this.world) return;
    this.world.cancelMining(); this.world.returnToSurface();
    this.zone.reset(); this.inSellZone = false; this.notice = '走进地表金色圆圈即可出售'; this.publish();
  };
}
