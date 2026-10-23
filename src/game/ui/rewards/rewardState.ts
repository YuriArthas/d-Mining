import { ONLINE_REWARD_MINUTES, SIGNIN_REWARDS } from '../../content/rewards.ts';
import type { RewardData } from '../../logic/Rewards.ts';

export type RewardsTab = 'online' | 'signin' | 'invite';
type RewardView = Pick<RewardData, 'day' | 'lastSigninDay' | 'signinStreak' | 'onlineClaimed' | 'onlineSeconds'>;

/** Today's sign-in: whether it is done, and which of the seven days it is (0-based). */
export function signin(rewards: RewardView) {
  const signedToday = rewards.lastSigninDay === rewards.day;
  const consecutive = rewards.lastSigninDay !== null && Date.parse(rewards.day) - Date.parse(rewards.lastSigninDay) === 86400000;
  const claimDay = signedToday ? rewards.signinStreak : consecutive ? rewards.signinStreak + 1 : 1;
  return { signedToday, index: (claimDay - 1) % SIGNIN_REWARDS.length };
}
/** Online gifts ready to collect. */
export function readyOnlineRewards(rewards: RewardView) {
  return ONLINE_REWARD_MINUTES.filter(m => !rewards.onlineClaimed.includes(m) && rewards.onlineSeconds >= m * 60).length;
}
/** Rewards a player can collect right now (HUD badge). */
export function claimableRewards(rewards: RewardView) {
  return readyOnlineRewards(rewards) + (signin(rewards).signedToday ? 0 : 1);
}
/** The tab the rewards sheet opens on: today's sign-in while it is unclaimed, otherwise the online gifts. */
export function rewardsTabFor(rewards: RewardView): RewardsTab {
  return signin(rewards).signedToday ? 'online' : 'signin';
}
