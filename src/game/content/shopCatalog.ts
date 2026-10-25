import { JOURNEY_CAPACITIES, JOURNEY_TOOL_PRICES } from './journeyResources.ts';
import { pickaxeStats } from '../logic/Pickaxe.ts';

export type ShopCategory = 'tools' | 'backpacks';
/** How the miner works a tool: a pick's overhead swing, or a drill held out and shaking. */
export type ToolMotion = 'swing' | 'drill';
export type ShopItem = Readonly<{ id: string; category: ShopCategory; level: number; model: string; name: string; description: string; price: number; power?: number; speed?: number; capacity?: number; motion?: ToolMotion }>;
type Entry = readonly [name: string, description: string, motion?: ToolMotion];
// World 1 (levels 1-10): joke items from home and kitchen, level 1 a plain pick so a new player knows what it is;
// world 2 (11-20): machines; world 3 (21-30): fantasy and space.
const TOOLS: readonly Entry[] = [
  ['老木镐', '爷爷传下来的老镐子，从第一块矿石挖起。'],
  ['扎手仙人掌', '连矿石都怕被它扎一下。'],
  ['硬法棍', '放了三天的法棍，比石头还硬。'],
  ['翻身咸鱼', '咸鱼也要翻身，先从挖矿开始。'],
  ['通天搋子', '没有什么是一搋子解决不了的。'],
  ['巨无霸棒棒糖', '舔一口，再敲一下。'],
  ['狂暴打蛋器', '开到最大档，矿石也能打发。', 'drill'],
  ['瓜瓜锤', '熟透了，一锤一个准。'],
  ['嘎嘎鸭锤', '每敲一下，心里都会嘎一声。'],
  ['霸王龙骨', '从地底挖出来的，再拿去挖地底。'],
  ['大扳手', '拧不开的矿，就敲开它。'],
  ['冲击电钻', '开足马力，咚咚咚咚咚！', 'drill'],
  ['链锯', '嗡——矿石排好队。', 'drill'],
  ['马蹄磁铁', '矿石自己会飞过来（大概）。'],
  ['机械爪', '抓娃娃机同款，这次一定抓得到。'],
  ['霓虹路牌', '前方施工，请绕行——矿石除外。'],
  ['激光剑', '嗡嗡作响，切矿如切豆腐。'],
  ['火箭锤', '点火加速，一锤到底。'],
  ['齿轮战斧', '齿轮一转，矿脉全断。'],
  ['等离子钻', '等离子高温，岩石直接融化。', 'drill'],
  ['冰淇淋甜筒', '化掉之前，赶紧挖完。'],
  ['彩虹镐', '雨过天晴，矿石也闪闪发亮。'],
  ['章鱼触手', '软软的，一拍就吸住矿石。'],
  ['星星魔杖', '叮！矿石变成了金币（并没有）。'],
  ['闪电三叉戟', '雷电加持，一叉三块。'],
  ['龙骨镰', '远古巨龙的獠牙，锋利依旧。'],
  ['独角兽角钻', '转起来比钻头还快，还会闪光。', 'drill'],
  ['怀表镐', '时间加速，一秒挖十下。'],
  ['黑洞锤', '连光都逃不掉，何况矿石。'],
  ['银河之镐', '握住整条银河，挖穿世界尽头。'],
];
const BAGS: readonly Entry[] = [
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
  ['工具箱', '螺丝刀、扳手，还有一堆矿。'],
  ['油桶', '别问里面绿色的是什么。'],
  ['喷气背包', '背着矿石也能飞（暂时不能）。'],
  ['微波炉', '叮！矿石热好了。'],
  ['电池组', '电量就是装载量，满格了就去卖。'],
  ['机器人背包', '它会帮你记住每一块矿。'],
  ['卫星锅', '信号满格，矿脉一览无余。'],
  ['迷你集装箱', '小小一个，能装一船矿。'],
  ['反应堆舱', '发着绿光，越装越亮。'],
  ['火箭', '矿石装满，准备发射。'],
  ['云朵', '轻飘飘的，偶尔下点小雨。'],
  ['南瓜灯', '一到地下就笑得特别亮。'],
  ['蜂巢', '蜜蜂负责看守，矿石不会丢。'],
  ['水母', '矿石在里面慢慢漂浮。'],
  ['带环星球', '背着一颗星球去挖矿。'],
  ['龙蛋', '里面好像有什么在偷看。'],
  ['魔法书', '翻开一页，多装一层。'],
  ['沙漏', '沙子越多，收获越多。'],
  ['迷你传送门', '矿石直接传送进去。'],
  ['黑洞罐', '装多少都装得下（理论上）。'],
];
export const equipmentModel = (kind: ShopCategory, level: number) => `${kind === 'tools' ? 'Tool' : 'Bag'}${String(Math.min(30,level)).padStart(2,'0')}`;
export const toolMotion = (level: number): ToolMotion => TOOLS[Math.min(30, level) - 1][2] ?? 'swing';
/** The 30 pickaxes of the journey economy. */
export function shopTools(): readonly ShopItem[] {
  return Array.from({length:30},(_,i) => {
    const level=i+1,stats=pickaxeStats(level),[name,description]=TOOLS[i];
    return Object.freeze({id:`tool-${level}`,category:'tools' as const,level,model:equipmentModel('tools',level),name,description,
      price:level===1?0:JOURNEY_TOOL_PRICES[i],power:stats.power,speed:stats.speed,motion:toolMotion(level)});
  });
}
/** The backpacks of the journey economy, one per capacity step. */
export function shopBackpacks(): readonly ShopItem[] {
  return JOURNEY_CAPACITIES.map((capacity,i)=>{
    const [name,description]=BAGS[i];
    return Object.freeze({id:i===0?'starter-bag':`journey-bag-${i+1}`,category:'backpacks' as const,
      level:i+1,model:equipmentModel('backpacks',i+1),name,description,capacity,
      price:i===0?0:Math.max(50,JOURNEY_TOOL_PRICES[i])});
  });
}
