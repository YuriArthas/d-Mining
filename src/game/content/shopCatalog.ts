import { pickaxeStats } from '../logic/Pickaxe.ts';
import { ECONOMY, type CurrencyId } from './economy.ts';

import { tr } from '../i18n/i18n.ts';
export type ShopCategory = 'tools' | 'backpacks';
/** How the miner works a tool: a pick's overhead swing, or a drill held out and shaking. */
export type ToolMotion = 'swing' | 'drill';
export type ShopItem = Readonly<{ id: string; category: ShopCategory; level: number; model: string; name: string; description: string; price: number; currency: CurrencyId; power?: number; speed?: number; capacity?: number; motion?: ToolMotion }>;
type Entry = readonly [name: string, description: string, motion?: ToolMotion];
// World 1 (levels 1-10): joke items from home and kitchen, level 1 a plain pick so a new player knows what it is;
// world 2 (11-20): machines; world 3 (21-30): fantasy and space.
const TOOLS: readonly Entry[] = [
  [tr('老木镐'), tr('爷爷传下来的老镐子，从第一块矿石挖起。')],
  [tr('扎手仙人掌'), tr('连矿石都怕被它扎一下。')],
  [tr('硬法棍'), tr('放了三天的法棍，比石头还硬。')],
  [tr('翻身咸鱼'), tr('咸鱼也要翻身，先从挖矿开始。')],
  [tr('通天搋子'), tr('没有什么是一搋子解决不了的。')],
  [tr('巨无霸棒棒糖'), tr('舔一口，再敲一下。')],
  [tr('狂暴打蛋器'), tr('开到最大档，矿石也能打发。'), 'drill'],
  [tr('瓜瓜锤'), tr('熟透了，一锤一个准。')],
  [tr('嘎嘎鸭锤'), tr('每敲一下，心里都会嘎一声。')],
  [tr('霸王龙骨'), tr('从地底挖出来的，再拿去挖地底。')],
  [tr('大扳手'), tr('拧不开的矿，就敲开它。')],
  [tr('冲击电钻'), tr('开足马力，咚咚咚咚咚！'), 'drill'],
  [tr('链锯'), tr('嗡——矿石排好队。'), 'drill'],
  [tr('马蹄磁铁'), tr('矿石自己会飞过来（大概）。')],
  [tr('机械爪'), tr('抓娃娃机同款，这次一定抓得到。')],
  [tr('霓虹路牌'), tr('前方施工，请绕行——矿石除外。')],
  [tr('激光剑'), tr('嗡嗡作响，切矿如切豆腐。')],
  [tr('火箭锤'), tr('点火加速，一锤到底。')],
  [tr('齿轮战斧'), tr('齿轮一转，矿脉全断。')],
  [tr('等离子钻'), tr('等离子高温，岩石直接融化。'), 'drill'],
  [tr('冰淇淋甜筒'), tr('化掉之前，赶紧挖完。')],
  [tr('彩虹镐'), tr('雨过天晴，矿石也闪闪发亮。')],
  [tr('章鱼触手'), tr('软软的，一拍就吸住矿石。')],
  [tr('星星魔杖'), tr('叮！矿石变成了金币（并没有）。')],
  [tr('闪电三叉戟'), tr('雷电加持，一叉三块。')],
  [tr('龙骨镰'), tr('远古巨龙的獠牙，锋利依旧。')],
  [tr('独角兽角钻'), tr('转起来比钻头还快，还会闪光。'), 'drill'],
  [tr('怀表镐'), tr('时间加速，一秒挖十下。')],
  [tr('黑洞锤'), tr('连光都逃不掉，何况矿石。')],
  [tr('银河之镐'), tr('握住整条银河，挖穿世界尽头。')],
];
const BAGS: readonly Entry[] = [
  [tr('麻布袋'), tr('扎紧袋口，装好这趟旅程的第一份收获。')],
  [tr('快递纸箱'), tr('包邮到家，就是不太防水。')],
  [tr('野餐篮'), tr('装满矿石，比三明治还香。')],
  [tr('金鱼缸'), tr('金鱼表示：矿石压着有点挤。')],
  [tr('西瓜背包'), tr('拉开拉链，里面全是矿，没有瓜瓤。')],
  [tr('小猪存钱罐'), tr('能装的可不只是硬币。')],
  [tr('复古冰箱'), tr('冷藏保鲜，矿石不会变质。')],
  [tr('滚筒洗衣机'), tr('把矿石洗得亮晶晶。')],
  [tr('扭蛋机'), tr('投一颗矿，出一颗矿。')],
  [tr('海盗宝箱'), tr('宝藏太多，盖子都合不上了。')],
  [tr('工具箱'), tr('螺丝刀、扳手，还有一堆矿。')],
  [tr('油桶'), tr('别问里面绿色的是什么。')],
  [tr('喷气背包'), tr('背着矿石也能飞（暂时不能）。')],
  [tr('微波炉'), tr('叮！矿石热好了。')],
  [tr('电池组'), tr('电量就是装载量，满格了就去卖。')],
  [tr('机器人背包'), tr('它会帮你记住每一块矿。')],
  [tr('卫星锅'), tr('信号满格，矿脉一览无余。')],
  [tr('迷你集装箱'), tr('小小一个，能装一船矿。')],
  [tr('反应堆舱'), tr('发着绿光，越装越亮。')],
  [tr('火箭'), tr('矿石装满，准备发射。')],
  [tr('云朵'), tr('轻飘飘的，偶尔下点小雨。')],
  [tr('南瓜灯'), tr('一到地下就笑得特别亮。')],
  [tr('蜂巢'), tr('蜜蜂负责看守，矿石不会丢。')],
  [tr('水母'), tr('矿石在里面慢慢漂浮。')],
  [tr('带环星球'), tr('背着一颗星球去挖矿。')],
  [tr('龙蛋'), tr('里面好像有什么在偷看。')],
  [tr('魔法书'), tr('翻开一页，多装一层。')],
  [tr('沙漏'), tr('沙子越多，收获越多。')],
  [tr('迷你传送门'), tr('矿石直接传送进去。')],
  [tr('黑洞罐'), tr('装多少都装得下（理论上）。')],
];
export const equipmentModel = (kind: ShopCategory, level: number) => `${kind === 'tools' ? 'Tool' : 'Bag'}${String(Math.min(30,level)).padStart(2,'0')}`;
export const toolMotion = (level: number): ToolMotion => TOOLS[Math.min(30, level) - 1][2] ?? 'swing';
/** The 30 pickaxes; price, currency, damage and speed from economy.json. */
export function shopTools(): readonly ShopItem[] {
  return ECONOMY.tools.map((tool,i) => {
    const level=i+1,stats=pickaxeStats(level),[name,description]=TOOLS[i];
    return Object.freeze({id:`tool-${level}`,category:'tools' as const,level,model:equipmentModel('tools',level),name,description,
      price:tool.price,currency:tool.currency,power:stats.power,speed:stats.speed,motion:toolMotion(level)});
  });
}
/** The 30 backpacks, ten per world, counted in blocks (economy.json). */
export function shopBackpacks(): readonly ShopItem[] {
  return ECONOMY.bags.map((bag,i)=>{
    const [name,description]=BAGS[i];
    return Object.freeze({id:i===0?'starter-bag':`journey-bag-${i+1}`,category:'backpacks' as const,
      level:i+1,model:equipmentModel('backpacks',i+1),name,description,capacity:bag.capacity,price:bag.price,currency:bag.currency});
  });
}
