import { JOURNEY_CAPACITIES, JOURNEY_TOOL_PRICES } from './journeyResources.ts';
import { pickaxeStats } from '../logic/Pickaxe.ts';
import { upgradePrice, STAGES } from './progression.ts';

export type ShopCategory = 'tools' | 'backpacks';
export type ShopItem = Readonly<{ id: string; category: ShopCategory; level: number; model: string; name: string; description: string; price: number; power?: number; speed?: number; capacity?: number }>;
const tools = ['矿工镐','石刃镐','铜刃镐','精铁镐','翡翠镐','银翼镐','水晶镐','双锋镐','熔火镐','黑曜镐'];
const bags = ['帆布背包','旅行背包','矿工行囊','加固背包','矿石木桶','铁箍矿桶','合金箱包','勘探储罐','水晶储罐','矿藏保险箱'];
const prefix = (level: number) => level <= 10 ? '' : level <= 20 ? '精工·' : '星辉·';
export const equipmentModel = (kind: ShopCategory, level: number) => `${kind === 'tools' ? 'Tool' : 'Bag'}${String(Math.min(30,level)).padStart(2,'0')}`;
export function shopTools(journey: boolean, highestLevel: number): readonly ShopItem[] {
  // The live journey has 30 tiers. Older worlds retain their original curve.
  const count = journey ? 30 : Math.max(30,highestLevel + 1);
  return Array.from({length:count},(_,i) => {
    const level=i+1,stats=pickaxeStats(level);
    return Object.freeze({id:`tool-${level}`,category:'tools' as const,level,model:equipmentModel('tools',level),
      name:level<=30?prefix(level)+tools[i%10]:`进阶矿镐 ${level}`,description:level===1?'从第一块矿石开始，踏上你的采矿旅程。':'换上更有力的矿镐，继续探索矿谷深处。',
      price:level===1?0:journey?JOURNEY_TOOL_PRICES[i]:upgradePrice(level-1),power:stats.power,speed:stats.speed});
  });
}
export function shopBackpacks(journey: boolean, initialCapacity = 50): readonly ShopItem[] {
  const capacities=journey?JOURNEY_CAPACITIES:[initialCapacity,...STAGES.map(s=>s.capacity).filter(c=>c>initialCapacity)];
  return capacities.map((capacity,i)=>Object.freeze({id:i===0?'starter-bag':journey?`journey-bag-${i+1}`:`bag-${capacity}`,category:'backpacks' as const,
    level:i+1,model:equipmentModel('backpacks',i+1),name:prefix(i+1)+bags[i%10],description:i===0?'轻便结实，装好这趟旅程的第一份收获。':'为下一趟采矿准备更多空间。',capacity,
    price:i===0?0:journey?Math.max(50,JOURNEY_TOOL_PRICES[i]):STAGES.find(s=>s.capacity===capacity)!.basePrice*100}));
}
