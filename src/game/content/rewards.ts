import { ECONOMY } from './economy.ts';
import { message, type TextRef } from '../i18n/messages.ts';
// Lucky coins and the capsule machine; every amount, weight and multiplier is in economy.json.
const LUCKY = ECONOMY.luckyCoins, CAPSULE = ECONOMY.capsule;
export const ONLINE_REWARD_MINUTES: readonly number[] = Object.freeze(LUCKY.online.map(o => o.minutes));
export type OnlineRewardMinutes = number;
export const SIGNIN_REWARDS: readonly number[] = LUCKY.signin;
/** Lucky coins for each online tier: longer play is worth more. */
export const ONLINE_REWARDS: Readonly<Record<number, number>> = Object.freeze(Object.fromEntries(LUCKY.online.map(o => [o.minutes, o.coins])));
export const REWARD_CONFIG = Object.freeze({
  spinCost: CAPSULE.spinCost,
  shareReward: LUCKY.share,
  inviteReward: LUCKY.invite,
  timedDurationSeconds: CAPSULE.timedSeconds,
  movementMultiplier: CAPSULE.movementMultiplier,
  miningMultiplier: CAPSULE.miningSpeedMultiplier,
  luckMultiplier: CAPSULE.luckMultiplier,
  /** Every sale while the capsule's double-sale boost runs. */
  sellMultiplier: CAPSULE.sellMultiplier,
});
const PRIZE_NAMES = {
  // The coin prize pays the current world's currency, about two minutes of income at its deepest layer reached.
  coins: message("msg.money"),
  speed: message("msg.move_speed_x", { x: CAPSULE.movementMultiplier }),
  mining: message("msg.permanent_mining_speed_x", { x: CAPSULE.miningSpeedMultiplier }),
  // Was “便携传送” (teleport anywhere), which every player now has; a timed double sale instead.
  sell: message("msg.sell_income_x", { x: CAPSULE.sellMultiplier }),
  autoHatch: message("msg.auto_hatch"),
  luck: message("msg.rare_pet_chance_x", { x: CAPSULE.luckMultiplier }),
} as const;
export type CapsuleRewardId = keyof typeof PRIZE_NAMES;
export const CAPSULE_REWARDS: readonly Readonly<{ id: CapsuleRewardId; name: TextRef; weight: number }>[] = Object.freeze(CAPSULE.prizes.map(p => {
  if (!(p.id in PRIZE_NAMES)) throw Error(`economy.json: 未知扭蛋奖品 ${p.id}`);
  return Object.freeze({ id: p.id as CapsuleRewardId, name: PRIZE_NAMES[p.id as CapsuleRewardId], weight: p.weight });
}));
