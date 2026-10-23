import {
  CAPSULE_REWARDS, ONLINE_REWARD_MINUTES, REWARD_CONFIG, SIGNIN_REWARDS,
  type CapsuleRewardId, type OnlineRewardMinutes,
} from '../content/rewards.ts';
import { createInviteCode, parseInviteCode, validateInviteId } from './InviteCode.ts';

export type RewardData = {
  version: 1;
  balance: number;
  inviteId: string;
  day: string;
  onlineSeconds: number;
  onlineClaimed: OnlineRewardMinutes[];
  lastSigninDay: string | null;
  signinStreak: number;
  lastShareDay: string | null;
  redeemedInviteId: string | null;
  /** `travel` is a retired prize (teleporting is free for everyone); kept so older saves still load. */
  permanent: { mining: boolean; travel: boolean; autoHatch: boolean };
  timed: { speed: number; luck: number; sell: number };
};
export type RewardOptions = {
  day?: () => string;
  random?: () => number;
  createInviteId?: () => string;
};
export type RewardClaimResult =
  | { status: 'claimed'; amount: number }
  | { status: 'already-claimed' | 'not-ready' | 'clock-reversed' | 'invalid-invite' | 'self-invite' };
export type SpinResult =
  | { status: 'spun'; reward: CapsuleRewardId; duplicate: boolean; coinReward: number; cost: number; durationSeconds: number }
  | { status: 'insufficient-currency' };

export function localRewardDay(date = new Date()) {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function dayNumber(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('奖励日期无效');
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) throw new Error('奖励日期无效');
  return milliseconds / 86400000;
}
function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label}必须是非负安全整数`);
  return value;
}
function seconds(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw new Error(`${label}无效`);
  return value;
}
function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}无效`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) throw new Error(`${label}字段无效`);
  return value as Record<string, unknown>;
}
function clone(data: RewardData): RewardData {
  return { ...data, onlineClaimed: [...data.onlineClaimed], permanent: { ...data.permanent }, timed: { ...data.timed } };
}

function readData(value: unknown): RewardData {
  const data = record(value, ['version', 'balance', 'inviteId', 'day', 'onlineSeconds', 'onlineClaimed', 'lastSigninDay', 'signinStreak', 'lastShareDay', 'redeemedInviteId', 'permanent', 'timed'], '奖励存档');
  if (data.version !== 1) throw new Error('不支持的奖励存档版本');
  const currentDay = dayNumber(data.day);
  integer(data.balance, '特殊货币');
  validateInviteId(data.inviteId);
  seconds(data.onlineSeconds, '在线时长');
  if (!Array.isArray(data.onlineClaimed) || Array.from(data.onlineClaimed).some(minute => !ONLINE_REWARD_MINUTES.includes(minute)) || new Set(data.onlineClaimed).size !== data.onlineClaimed.length) throw new Error('在线奖励领取记录无效');
  if (data.onlineClaimed.some(minute => minute * 60 > (data.onlineSeconds as number))) throw new Error('在线奖励记录超过已累计时长');
  const streak = integer(data.signinStreak, '连续签到天数');
  for (const key of ['lastSigninDay', 'lastShareDay']) {
    if (data[key] !== null && dayNumber(data[key]) > currentDay) throw new Error('领取日期不能晚于奖励日期');
  }
  if ((data.lastSigninDay === null) !== (streak === 0)) throw new Error('签到天数与日期不一致');
  if (data.redeemedInviteId !== null) {
    validateInviteId(data.redeemedInviteId);
    if (data.redeemedInviteId === data.inviteId) throw new Error('邀请记录不能兑换自身');
  }
  const permanent = record(data.permanent, ['mining', 'travel', 'autoHatch'], '永久权益');
  if (Object.values(permanent).some(value => typeof value !== 'boolean')) throw new Error('永久权益标记无效');
  // Saves from before the double-sale boost have no `sell` timer.
  const legacy = !!data.timed && typeof data.timed === 'object' && !('sell' in data.timed);
  const timed = record(data.timed, legacy ? ['speed', 'luck'] : ['speed', 'luck', 'sell'], '限时权益');
  const restoredTimed = { speed: seconds(timed.speed, '移速剩余时间'), luck: seconds(timed.luck, '幸运剩余时间'), sell: legacy ? 0 : seconds(timed.sell, '双倍出售剩余时间') };
  return clone({ ...data, timed: restoredTimed } as RewardData);
}

/** Session-owned domain state. Callers persist it together with any awarded coins. */
export class Rewards {
  private data: RewardData;
  private readonly today: () => string;
  private readonly random: () => number;

  constructor(options: RewardOptions = {}, restored?: RewardData) {
    this.today = options.day ?? localRewardDay;
    this.random = options.random ?? Math.random;
    if (restored !== undefined) {
      this.data = readData(restored);
    } else {
      const day = this.today(); dayNumber(day);
      const inviteId = validateInviteId((options.createInviteId ?? (() => crypto.randomUUID().replaceAll('-', '')))());
      this.data = {
        version: 1, balance: 0, inviteId, day, onlineSeconds: 0, onlineClaimed: [],
        lastSigninDay: null, signinStreak: 0, lastShareDay: null, redeemedInviteId: null,
        permanent: { mining: false, travel: false, autoHatch: false }, timed: { speed: 0, luck: 0, sell: 0 },
      };
    }
  }

  /** Missing legacy data must explicitly use the new-state constructor at the session boundary. */
  static fromData(value: unknown, options: RewardOptions = {}) { return new Rewards(options, readData(value)); }
  exportData(): RewardData { return clone(this.data); }
  getSnapshot() { return { ...this.exportData(), inviteCode: createInviteCode(this.data.inviteId) }; }

  private onDay(day: string): RewardData | null {
    const number = dayNumber(day), current = dayNumber(this.data.day);
    // A backwards local date never reopens an already visited reward day.
    if (number < current) return null;
    const data = clone(this.data);
    if (number > current) { data.day = day; data.onlineSeconds = 0; data.onlineClaimed = []; }
    return data;
  }

  /** The caller supplies actual simulated/foreground elapsed time, never wall-time since save. */
  advance(elapsedSeconds: number, day = this.today()): { changed: boolean; clockReversed: boolean } {
    seconds(elapsedSeconds, '本次在线时长');
    const draft = this.onDay(day), clockReversed = draft === null;
    const data = draft ?? clone(this.data);
    if (!clockReversed) data.onlineSeconds = seconds(data.onlineSeconds + elapsedSeconds, '累计在线时长');
    data.timed.speed = Math.max(0, data.timed.speed - elapsedSeconds);
    data.timed.luck = Math.max(0, data.timed.luck - elapsedSeconds);
    data.timed.sell = Math.max(0, data.timed.sell - elapsedSeconds);
    const changed = data.day !== this.data.day || data.onlineSeconds !== this.data.onlineSeconds || data.timed.speed !== this.data.timed.speed || data.timed.luck !== this.data.timed.luck || data.timed.sell !== this.data.timed.sell;
    if (changed) this.data = data;
    return { changed, clockReversed };
  }

  claimOnline(minutes: OnlineRewardMinutes, day = this.today()): RewardClaimResult {
    if (!ONLINE_REWARD_MINUTES.includes(minutes)) throw new Error('未知在线奖励档位');
    const data = this.onDay(day);
    if (!data) return { status: 'clock-reversed' };
    if (data.onlineClaimed.includes(minutes)) return { status: 'already-claimed' };
    if (data.onlineSeconds < minutes * 60) return { status: 'not-ready' };
    data.balance = integer(data.balance + REWARD_CONFIG.onlineReward, '特殊货币');
    data.onlineClaimed.push(minutes);
    this.data = data;
    return { status: 'claimed', amount: REWARD_CONFIG.onlineReward };
  }

  claimDaily(day = this.today()): RewardClaimResult {
    const data = this.onDay(day);
    if (!data) return { status: 'clock-reversed' };
    if (data.lastSigninDay === day) return { status: 'already-claimed' };
    const consecutive = data.lastSigninDay !== null && dayNumber(day) - dayNumber(data.lastSigninDay) === 1;
    data.signinStreak = consecutive ? integer(data.signinStreak + 1, '连续签到天数') : 1;
    const amount = SIGNIN_REWARDS[(data.signinStreak - 1) % SIGNIN_REWARDS.length];
    data.balance = integer(data.balance + amount, '特殊货币');
    data.lastSigninDay = day;
    this.data = data;
    return { status: 'claimed', amount };
  }

  /** Invoke only after the platform share text was successfully written to the clipboard. */
  claimShare(day = this.today()): RewardClaimResult {
    const data = this.onDay(day);
    if (!data) return { status: 'clock-reversed' };
    if (data.lastShareDay === day) return { status: 'already-claimed' };
    data.balance = integer(data.balance + REWARD_CONFIG.shareReward, '特殊货币');
    data.lastShareDay = day;
    this.data = data;
    return { status: 'claimed', amount: REWARD_CONFIG.shareReward };
  }

  redeemInvite(text: string): RewardClaimResult {
    const inviteId = parseInviteCode(text);
    if (inviteId === null) return { status: 'invalid-invite' };
    if (inviteId === this.data.inviteId) return { status: 'self-invite' };
    if (this.data.redeemedInviteId !== null) return { status: 'already-claimed' };
    const data = clone(this.data);
    data.balance = integer(data.balance + REWARD_CONFIG.inviteReward, '特殊货币');
    data.redeemedInviteId = inviteId;
    this.data = data;
    return { status: 'claimed', amount: REWARD_CONFIG.inviteReward };
  }

  /** Check the receiving wallet's capacity before calling, then settle returned coins with this state. */
  spin(coinReward: number): SpinResult {
    integer(coinReward, '金币奖励');
    if (coinReward === 0) throw new Error('金币奖励必须大于零');
    if (this.data.balance < REWARD_CONFIG.spinCost) return { status: 'insufficient-currency' };
    const sample = this.random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('抽奖随机数必须在 [0, 1) 内');
    const total = CAPSULE_REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
    let cursor = sample * total;
    const selected = CAPSULE_REWARDS.find(reward => { cursor -= reward.weight; return cursor < 0; });
    if (!selected) throw new Error('抽奖权重未覆盖随机数');
    const data = clone(this.data), reward = selected.id;
    let duplicate = false, awardedCoins = 0, durationSeconds = 0;
    if (reward === 'coins') awardedCoins = coinReward;
    else if (reward === 'speed' || reward === 'luck' || reward === 'sell') {
      data.timed[reward] = seconds(data.timed[reward] + REWARD_CONFIG.timedDurationSeconds, '限时权益剩余时间');
      durationSeconds = REWARD_CONFIG.timedDurationSeconds;
    } else {
      duplicate = data.permanent[reward];
      if (duplicate) awardedCoins = coinReward;
      else data.permanent[reward] = true;
    }
    data.balance -= REWARD_CONFIG.spinCost;
    this.data = data;
    return { status: 'spun', reward, duplicate, coinReward: awardedCoins, cost: REWARD_CONFIG.spinCost, durationSeconds };
  }
}
