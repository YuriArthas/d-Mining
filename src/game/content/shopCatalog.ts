import { JOURNEY_CAPACITIES, JOURNEY_TOOL_PRICES } from './journeyResources.ts';
import { pickaxeStats } from '../logic/Pickaxe.ts';

export type ShopCategory = 'tools' | 'backpacks';
/** How the miner works a tool: a pick's overhead swing, or a drill held out and shaking. */
export type ToolMotion = 'swing' | 'drill';
export type ShopItem = Readonly<{ id: string; category: ShopCategory; level: number; model: string; name: string; description: string; price: number; power?: number; speed?: number; capacity?: number; motion?: ToolMotion }>;
type Entry = readonly [name: string, description: string, motion?: ToolMotion];
// World 1 (levels 1-10): joke items from home and kitchen; level 1 stays a plain pick so a new player knows what it is.
const WORLD1_TOOLS: readonly Entry[] = [
  ['老木镐', '爷爷传下来的老镐子，从第一块矿石挖起。'],
  ['不粘锅', '敲矿砰砰响，矿渣一点都不粘。'],
  ['硬法棍', '放了三天的法棍，比石头还硬。'],
  ['翻身咸鱼', '咸鱼也要翻身，先从挖矿开始。'],
  ['通天搋子', '没有什么是一搋子解决不了的。'],
  ['巨无霸棒棒糖', '舔一口，再敲一下。'],
  ['狂暴打蛋器', '开到最大档，矿石也能打发。', 'drill'],
  ['瓜瓜锤', '熟透了，一锤一个准。'],
  ['嘎嘎鸭锤', '每敲一下，心里都会嘎一声。'],
  ['霸王龙骨', '从地底挖出来的，再拿去挖地底。'],
];
const WORLD1_BAGS: readonly Entry[] = [
  ['麻布袋', '扎紧袋口，装好这趟旅程的第一份收获。'],
  ['快递纸箱', '包邮到家，就是不太防水。'],
  ['野餐篮', '装满矿石，比三明治还香。'],
  ['金鱼缸', '金鱼表示：矿石压着有点挤。'],
  ['西瓜背包', '拉开拉链，里面全是矿，没有瓜瓤。'],
  ['小猪存钱罐', '能装的可不只是硬币。'],
  ['复古冰箱', '冷藏保鲜，矿石不会变质。'],
  ['滚筒洗衣机', '把矿石洗得亮晶晶。'],
  ['扭蛋机', '投一颗矿，出一颗矿。'],
  ['海盗宝箱', '宝藏太多，盖子都合不上了。'],
];
// Levels 11-30 keep the old pick and bag series until worlds 2 and 3 get their own sets.
const tools = ['矿工镐','石刃镐','铜刃镐','精铁镐','翡翠镐','银翼镐','水晶镐','双锋镐','熔火镐','黑曜镐'];
const bags = ['帆布背包','旅行背包','矿工行囊','加固背包','矿石木桶','铁箍矿桶','合金箱包','勘探储罐','水晶储罐','矿藏保险箱'];
const prefix = (level: number) => level <= 20 ? '精工·' : '星辉·';
const entry = (set: readonly Entry[], series: readonly string[], level: number, later: string): Entry =>
  level <= set.length ? set[level - 1] : [prefix(level) + series[(level - 1) % 10], later];
export const equipmentModel = (kind: ShopCategory, level: number) => `${kind === 'tools' ? 'Tool' : 'Bag'}${String(Math.min(30,level)).padStart(2,'0')}`;
export const toolMotion = (level: number): ToolMotion => entry(WORLD1_TOOLS, tools, level, '')[2] ?? 'swing';
/** The 30 pickaxes of the journey economy. */
export function shopTools(): readonly ShopItem[] {
  return Array.from({length:30},(_,i) => {
    const level=i+1,stats=pickaxeStats(level),[name,description]=entry(WORLD1_TOOLS,tools,level,'换上更有力的矿镐，继续探索矿谷深处。');
    return Object.freeze({id:`tool-${level}`,category:'tools' as const,level,model:equipmentModel('tools',level),name,description,
      price:level===1?0:JOURNEY_TOOL_PRICES[i],power:stats.power,speed:stats.speed,motion:toolMotion(level)});
  });
}
/** The backpacks of the journey economy, one per capacity step. */
export function shopBackpacks(): readonly ShopItem[] {
  return JOURNEY_CAPACITIES.map((capacity,i)=>{
    const [name,description]=entry(WORLD1_BAGS,bags,i+1,'为下一趟采矿准备更多空间。');
    return Object.freeze({id:i===0?'starter-bag':`journey-bag-${i+1}`,category:'backpacks' as const,
      level:i+1,model:equipmentModel('backpacks',i+1),name,description,capacity,
      price:i===0?0:Math.max(50,JOURNEY_TOOL_PRICES[i])});
  });
}
