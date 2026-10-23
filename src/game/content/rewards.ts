/** First-playtest economy values, not source-game parity or a balanced economy. */
export const ONLINE_REWARD_MINUTES = [5, 10, 20, 30] as const;
export type OnlineRewardMinutes = typeof ONLINE_REWARD_MINUTES[number];
export const SIGNIN_REWARDS = [1, 1, 1, 2, 2, 2, 3] as const;
export const REWARD_CONFIG = Object.freeze({
  spinCost: 1,
  onlineReward: 1,
  shareReward: 1,
  inviteReward: 2,
  timedDurationSeconds: 300,
  coinStagePriceMultiplier: 100,
  movementMultiplier: 2,
  miningMultiplier: 1.5,
  luckMultiplier: 2,
  /** Coins from every sale while the capsule's double-sale boost runs. */
  sellMultiplier: 2,
});

export const CAPSULE_REWARDS = [
  { id: 'coins', name: '金币', weight: 65 },
  { id: 'speed', name: '移动速度 ×2', weight: 10 },
  { id: 'mining', name: '永久挖矿速度 ×1.5', weight: 5 },
  // Was “便携传送” (teleport anywhere), which every player now has; a timed double sale instead.
  { id: 'sell', name: '出售金币 ×2', weight: 5 },
  { id: 'autoHatch', name: '自动孵蛋', weight: 5 },
  { id: 'luck', name: '稀有宠物概率 ×2', weight: 10 },
] as const;
export type CapsuleRewardId = typeof CAPSULE_REWARDS[number]['id'];

/** Call with the shallow ore price of the deepest historically reached stage. */
export function stageCoinReward(stageBasePrice: number) {
  const result = stageBasePrice * REWARD_CONFIG.coinStagePriceMultiplier;
  if (!Number.isSafeInteger(stageBasePrice) || stageBasePrice <= 0 || !Number.isSafeInteger(result)) {
    throw new Error('阶段矿价必须是有效正整数，金币奖励不能溢出');
  }
  return result;
}
