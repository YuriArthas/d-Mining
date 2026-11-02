import { ECONOMY } from '../content/economy.ts';
import { record } from './data.ts';
import type { EquipmentData } from './EquipmentCollection.ts';

/** Durable identity is a tier, never a balance-dependent capacity. */
export type EquipmentSaveData = {version:2;toolLevel:number;enhance:number;tools?:number[];backpackTier:number;equippedBackpackTier:number;backpackTiers?:number[]};
const LEGACY_CAPACITIES = [25,30,35,40,50,60,70,80,90,100,110,120,140,160,180,200,220,240,260,280,300,320,340,360,380,400,420,450,480,500];
export function capacityForTier(tier:unknown) {
  if(typeof tier!=='number'||!Number.isInteger(tier)||tier<1||tier>ECONOMY.bags.length)throw Error('背包档位无效');
  return ECONOMY.bags[tier-1].capacity;
}
export function tierForCapacity(capacity:number) {
  const tier=ECONOMY.bags.find(b=>b.capacity===capacity)?.tier;
  if(tier===undefined)throw Error('背包容量不属于装备目录');
  return tier;
}
/** Only the known pre-rebalance table is migrated; malformed saves are never guessed. */
export function restoreEquipment(inventory:unknown,equipment:unknown,activeTool:number) {
  const bag=record(inventory),saved=equipment===undefined?undefined:record(equipment);
  const legacyTier=(value:unknown)=>{const tier=LEGACY_CAPACITIES.indexOf(value as number)+1;if(!tier)throw Error('旧背包容量无效');return tier;};
  if(saved&&saved.version!==1&&saved.version!==2)throw Error('装备版本无效');
  const modern=saved?.version===2;
  const active=modern?saved.equippedBackpackTier:legacyTier(bag.capacity);
  const highest=modern?saved.backpackTier:legacyTier(saved?.backpackCapacity??bag.capacity);
  const owned=modern?saved.backpackTiers:saved?.backpacks;
  if(owned!==undefined&&!Array.isArray(owned))throw Error('背包购买记录无效');
  const capacities=owned===undefined?undefined:(owned as unknown[]).map(t=>capacityForTier(modern?t:legacyTier(t)));
  return {inventory:{...bag,capacity:capacityForTier(active)},equipment:{version:1,toolLevel:saved?.toolLevel??activeTool,
    enhance:saved?.enhance??0,backpackCapacity:capacityForTier(highest),
    ...(saved?.tools!==undefined?{tools:saved.tools}:{}),...(capacities?{backpacks:capacities}:{})} as EquipmentData};
}
export function saveEquipment(data:EquipmentData,activeCapacity:number):EquipmentSaveData {
  return {version:2,toolLevel:data.toolLevel,enhance:data.enhance,backpackTier:tierForCapacity(data.backpackCapacity),
    equippedBackpackTier:tierForCapacity(activeCapacity),...(data.tools?{tools:data.tools}:{}),
    ...(data.backpacks?{backpackTiers:data.backpacks.map(tierForCapacity)}:{})};
}
