import { DEEPER_MINING_GOAL, LONG_MINING_GOAL, type OnboardingData } from '../logic/Onboarding.ts';

export type GuideTarget = Readonly<{
  id: 'shop' | 'mine' | 'dig' | 'fill' | 'sell' | 'return' | 'upgrade' | 'deepen' | 'backpack' | 'long-task' | 'egg' | 'equip' | 'earn';
  title: string; detail: string; phase?: 'loop' | 'pets';
  highlight?: 'return' | 'upgrade' | 'pets' | 'egg';
  marker?: 'shop' | 'mine' | 'sell' | 'egg';
}>;
export type GuideInput = {
  learning: OnboardingData; location: 'surface' | 'mine' | 'room' | null;
  nearMine: boolean; atMine?: boolean; hasTarget: boolean; inSellZone: boolean;
  full: boolean; items: number; coins: number; level: number; pets: number;
  capacity: number; maxDepth: number; upgradePrice: number; backpackPrice: number | null; eggPrice: number | null;
};

export function selectGuide(s: GuideInput): GuideTarget | null {
  if (s.learning.status !== 'active' || !s.location) return null;
  const mine = (): GuideTarget => s.location === 'surface' && !s.hasTarget && !s.atMine
    ? { id: 'mine', title: '去矿坑开始挖矿', detail: 'WASD 移动 · 右键拖动观察', marker: 'mine' }
    : { id: 'dig', title: '按住鼠标左键，挖下第一块矿', detail: '把鼠标移到发光方块上 · 右键拖动可调整视角' };
  const sell = (): GuideTarget => s.location === 'mine'
    ? { id: 'return', title: s.full ? '背包满了，点「出售」' : '带上矿石，点「出售」卖掉', detail: '一键传送到售卖圈自动卖出 · 也可以返回地表走过去', highlight: 'return' }
    : { id: 'sell', title: s.inSellZone ? '离开后再走进金色售卖圈' : '点「出售」或走进金色圆圈', detail: s.location === 'room' ? '跟随箭头，去这个房间的售卖圈' : '跟随箭头前往 · 自动卖矿，无需按 E', ...(!s.inSellZone ? { marker: 'sell' as const } : {}) };
  const earn = (price: number, goal: string, phase: 'loop' | 'pets' = 'loop'): GuideTarget => {
    if (s.items > 0 && (s.location === 'room' || (s.location === 'surface' && !s.nearMine))) return { ...sell(), phase };
    return { id: 'earn', phase, title: '继续挖矿、卖钱', detail: `再赚 ${Math.max(0, price - s.coins)} 金币，${goal}`, ...(s.location === 'surface' && !s.nearMine ? { marker: 'mine' as const } : {}) };
  };

  if (s.full && s.items > 0) return sell();
  if (!s.learning.minedOnce) return mine();
  if (!s.learning.soldOnce) return s.items > 0 ? sell() : mine();
  // Always finish the main loop before introducing pets, even if an egg is
  // cheaper or the player has already acquired/equipped one independently.
  if (s.level < 2) return s.coins >= s.upgradePrice
    ? { id: 'upgrade', title: '升级镐子，提高挖矿力量', detail: '点右边「商店」一键传送 · 买下一把镐子会自动装备', highlight: 'upgrade' }
    : earn(s.upgradePrice, '升级镐子');
  if (s.maxDepth < DEEPER_MINING_GOAL) return {
    id: 'deepen', title: `向下挖到 ${DEEPER_MINING_GOAL} 米`,
    detail: `历史最深 ${Math.floor(s.maxDepth)} / ${DEEPER_MINING_GOAL} 米 · 新镐子能更快击碎矿石`,
    ...(s.location === 'surface' ? { marker: 'mine' as const } : {}),
  };
  if (s.capacity <= 50 && s.backpackPrice !== null) return s.coins >= s.backpackPrice
    ? { id: 'backpack', title: '升级背包，一次带回更多矿石', detail: '点右边「商店」，选择「背包」挑下一件', highlight: 'upgrade' }
    : earn(s.backpackPrice, '扩充背包');
  if (!s.learning.longTaskIntroduced) return {
    id: 'long-task', title: `长期目标：累计采矿 ${LONG_MINING_GOAL} 块`,
    detail: `已记录 ${s.learning.minedCount} 块 · 可以边探索边完成，现在先认识能帮你挖矿的宠物。`,
  };
  if (!s.learning.equippedOnce && s.pets > 0) return {
    id: 'equip', phase: 'pets', title: '装备第一只宠物，提高挖矿力量',
    detail: '点右边「宠物」，选「一键最佳」 · 装备后才生效', highlight: 'pets',
  };
  if (!s.learning.equippedOnce && s.eggPrice !== null) {
    if (s.coins < s.eggPrice) return earn(s.eggPrice, '购买宠物蛋，获得挖矿帮手', 'pets');
    return s.location === 'surface'
      ? { id: 'egg', phase: 'pets', title: '到原野蛋台，获得第一只宠物', detail: '宠物能增加挖矿力量 · 靠近按 E，查看概率后购买', marker: 'egg', highlight: 'egg' }
      : { id: 'return', phase: 'pets', title: '返回地表，认识宠物', detail: '宠物能增加挖矿力量 · 第一颗原野蛋已经买得起了', highlight: 'return' };
  }
  return null;
}

export type DepthGoal = Readonly<{ id: string; name: string; depth: number; currentDepth: number; remainingDepth: number }>;
export function selectDepthGoal(maxDepth: number, destinations: readonly { id: string; name: string; depth: number; unlocked: boolean }[]): DepthGoal | null {
  // Preserve explicitly unlocked legacy destinations and select the nearest
  // remaining depth, independent of content table ordering or current floor.
  const next = destinations.filter(d => !d.unlocked && d.depth > maxDepth).sort((a, b) => a.depth - b.depth)[0];
  return next ? Object.freeze({ id: next.id, name: next.name, depth: next.depth, currentDepth: maxDepth, remainingDepth: next.depth - maxDepth }) : null;
}
