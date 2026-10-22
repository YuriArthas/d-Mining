import { useRef, useState, useSyncExternalStore } from 'react';
import { CAPSULE_REWARDS, ONLINE_REWARD_MINUTES, REWARD_CONFIG, SIGNIN_REWARDS, type OnlineRewardMinutes } from '../content/rewards.ts';
import type { RewardClaimResult, Rewards, SpinResult } from '../logic/Rewards.ts';
import { formatNumber } from '../presentation/formatNumber.ts';
import { GameButton } from './GameButton.tsx';
import { EquipmentIcon } from './InventoryIcons.tsx';
import { PetDialog } from './pets/PetDialog.tsx';
import './rewards.css';

type ClaimResult = RewardClaimResult | { status: 'clipboard-failed' | 'unavailable' };
type CapsuleResult = SpinResult | { status: 'away' | 'unavailable' | 'overflow' };
export type RewardsUiApi = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): { rewards: ReturnType<Rewards['getSnapshot']>; capsuleCoins: number; atMachine: boolean };
  claimOnlineReward(minutes: OnlineRewardMinutes): ClaimResult;
  claimDailyReward(): ClaimResult;
  shareReward(platform: 'wechat' | 'douyin'): Promise<ClaimResult>;
  redeemInvite(text: string): ClaimResult;
  spinCapsule(): CapsuleResult;
};
type Notice = { kind: 'success' | 'error' | 'info'; text: string };

function TokenIcon() {
  return <svg className="reward-token-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28 9v14l-12 7L4 23V9Z" fill="#b0a0ff" stroke="#50378a" strokeWidth="2" /><path d="m16 8 3 5 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z" fill="#fff5bd" /></svg>;
}

function clockLabel(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, '0')}`;
}

function claimNotice(result: ClaimResult, action: string): Notice {
  switch (result.status) {
    case 'claimed': return { kind: 'success', text: `${action}，获得 ${result.amount} 枚幸运币！` };
    case 'already-claimed': return { kind: 'info', text: action === '文案已复制' ? '文案已复制。今天的分享奖励已经领取。' : '这项奖励已经领取，不能重复领取。' };
    case 'not-ready': return { kind: 'info', text: '在线时间还未达到要求，继续游玩即可。' };
    case 'clock-reversed': return { kind: 'error', text: '当前日期早于上次奖励记录，请检查设备日期。' };
    case 'invalid-invite': return { kind: 'error', text: '没有识别到完整有效的邀请码，请粘贴朋友分享的原文。' };
    case 'self-invite': return { kind: 'error', text: '不能兑换自己的邀请码，请使用朋友分享的口令。' };
    case 'clipboard-failed': return { kind: 'error', text: '复制失败，未发放分享奖励。请允许剪贴板访问后重试。' };
    case 'unavailable': return { kind: 'error', text: '当前无法领取奖励，请关闭其他操作后重试。' };
  }
}

function errorNotice(error: unknown): Notice {
  return { kind: 'error', text: `操作失败：${error instanceof Error ? error.message : String(error)}` };
}

function RewardBalance({ balance }: { balance: number }) {
  return <div className="reward-balance"><TokenIcon /><div><span>我的幸运币</span><strong>{formatNumber(balance)}</strong></div><p>在地表扭蛋机使用<br />每次抽取消耗 {REWARD_CONFIG.spinCost} 枚</p></div>;
}

export function RewardsPanel({ session, onClose }: { session: RewardsUiApi; onClose(): void }) {
  const { rewards } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [inviteText, setInviteText] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copying, setCopying] = useState<'wechat' | 'douyin' | null>(null);
  const copyingRef = useRef(false);
  const signedToday = rewards.lastSigninDay === rewards.day;
  const consecutive = rewards.lastSigninDay !== null && Date.parse(rewards.day) - Date.parse(rewards.lastSigninDay) === 86400000;
  const claimDay = signedToday ? rewards.signinStreak : consecutive ? rewards.signinStreak + 1 : 1;
  const cycleIndex = (claimDay - 1) % SIGNIN_REWARDS.length;
  const sharedToday = rewards.lastShareDay === rewards.day;
  function claim(action: () => ClaimResult, label = '领取成功') {
    try { setNotice(claimNotice(action(), label)); } catch (error) { setNotice(errorNotice(error)); }
  }
  async function share(platform: 'wechat' | 'douyin') {
    if (copyingRef.current) return;
    copyingRef.current = true; setCopying(platform); setNotice(null);
    try { setNotice(claimNotice(await session.shareReward(platform), '文案已复制')); }
    catch (error) { setNotice(errorNotice(error)); }
    finally { copyingRef.current = false; setCopying(null); }
  }

  return <PetDialog title="游玩奖励" onClose={onClose} className="rewards-panel">
    <RewardBalance balance={rewards.balance} />
    <div className="rewards-content">
      <section className="reward-section" aria-labelledby="reward-online-title">
        <div className="reward-section-heading"><div><h2 id="reward-online-title">在线奖励</h2><p>今日累计 {clockLabel(rewards.onlineSeconds)}，每档每天领取一次。</p></div></div>
        <div className="reward-online-grid">{ONLINE_REWARD_MINUTES.map(minutes => {
          const claimed = rewards.onlineClaimed.includes(minutes), ready = rewards.onlineSeconds >= minutes * 60;
          return <div className="reward-online-card" key={minutes} data-claimed={claimed}>
            <strong>{minutes} 分钟</strong><span><TokenIcon />{REWARD_CONFIG.onlineReward} 枚</span>
            <progress max={minutes * 60} value={Math.min(rewards.onlineSeconds, minutes * 60)} aria-label={`${minutes} 分钟在线奖励进度`} />
            <GameButton blurAfterPress={false} className="pet-primary" disabled={claimed || !ready} onPress={() => claim(() => session.claimOnlineReward(minutes))}>{claimed ? '已领取' : ready ? '领取奖励' : `还差 ${clockLabel(minutes * 60 - rewards.onlineSeconds)}`}</GameButton>
          </div>;
        })}</div>
      </section>

      <section className="reward-section" aria-labelledby="reward-signin-title">
        <div className="reward-section-heading"><div><h2 id="reward-signin-title">每日签到</h2><p>{signedToday ? `已连续签到 ${rewards.signinStreak} 天` : `签到后为连续第 ${claimDay} 天`} · 七天循环，断签重新开始。</p></div>
          <GameButton blurAfterPress={false} className="pet-primary" disabled={signedToday} onPress={() => claim(() => session.claimDailyReward(), '签到成功')}>{signedToday ? '今日已签到' : `签到领取 ${SIGNIN_REWARDS[cycleIndex]} 枚`}</GameButton>
        </div>
        <div className="reward-signin-days" aria-label="七日签到奖励">{SIGNIN_REWARDS.map((amount, index) => <div key={index} data-current={index === cycleIndex} data-claimed={index < cycleIndex || (index === cycleIndex && signedToday)}><span>第 {index + 1} 天</span><strong>{amount} 枚</strong><small>{index < cycleIndex || (index === cycleIndex && signedToday) ? '已领取' : index === cycleIndex ? '本次奖励' : '连续签到'}</small></div>)}</div>
      </section>

      <section className="reward-section" aria-labelledby="reward-share-title">
        <div className="reward-section-heading"><div><h2 id="reward-share-title">邀请朋友一起挖矿</h2><p>复制文案即完成分享，每日获得 {REWARD_CONFIG.shareReward} 枚幸运币。微信与抖音共用每日次数。</p></div></div>
        <div className="reward-share-buttons">
          <GameButton blurAfterPress={false} className="pet-secondary" disabled={copying !== null} onPress={() => { void share('wechat'); }}>{copying === 'wechat' ? '正在复制…' : '复制微信分享文案'}</GameButton>
          <GameButton blurAfterPress={false} className="pet-secondary" disabled={copying !== null} onPress={() => { void share('douyin'); }}>{copying === 'douyin' ? '正在复制…' : '复制抖音分享文案'}</GameButton>
        </div>
        <p className="reward-helper">{sharedToday ? '今日分享奖励已领取，仍可继续复制分享。' : '复制后粘贴到微信或抖音，分享你的游戏链接和邀请码。'}</p>
      </section>

      <section className="reward-section" aria-labelledby="reward-invite-title">
        <div className="reward-section-heading"><div><h2 id="reward-invite-title">兑换朋友的邀请码</h2><p>兑换成功获得 {REWARD_CONFIG.inviteReward} 枚幸运币。每个存档一次，不能使用自己的邀请码。</p></div></div>
        {rewards.redeemedInviteId !== null ? <p className="reward-redeemed">✓ 邀请奖励已领取</p> : <div className="reward-invite-entry">
          <label htmlFor="reward-invite-input">粘贴邀请码或完整分享文案</label>
          <textarea id="reward-invite-input" value={inviteText} maxLength={4096} rows={3} spellCheck={false} autoComplete="off" placeholder="MINING:1:…" onChange={event => setInviteText(event.target.value)} />
          <GameButton blurAfterPress={false} className="pet-primary" disabled={!inviteText.trim()} onPress={() => claim(() => session.redeemInvite(inviteText), '兑换成功')}>兑换 {REWARD_CONFIG.inviteReward} 枚幸运币</GameButton>
        </div>}
      </section>
    </div>
    <footer className="reward-notice" role="status" aria-live="polite" data-kind={notice?.kind}>{notice?.text ?? '获得幸运币后，前往地表扭蛋机抽取奖励。'}</footer>
  </PetDialog>;
}

const REWARD_SYMBOLS = { coins: '◉', speed: 'ϟ', mining: '⛏', travel: '◎', autoHatch: '◒', luck: '✦' } as const;

export function CapsulePanel({ session, onClose }: { session: RewardsUiApi; onClose(): void }) {
  const { rewards, capsuleCoins, atMachine } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [result, setResult] = useState<Extract<SpinResult, { status: 'spun' }> | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  function spin() {
    setResult(null);
    try {
      const outcome = session.spinCapsule();
      if (outcome.status === 'spun') { setResult(outcome); setNotice(null); return; }
      const errors = { away: '请先靠近地表扭蛋机。', unavailable: '当前无法抽奖，请关闭其他操作后重试。', overflow: '金币数量已达到上限，本次未扣幸运币。', 'insufficient-currency': '幸运币不足，领取在线、签到或分享奖励后再来。' };
      setNotice({ kind: 'error', text: errors[outcome.status] });
    } catch (error) { setNotice(errorNotice(error)); }
  }
  const name = result ? CAPSULE_REWARDS.find(reward => reward.id === result.reward)!.name : '';
  const descriptions = {
    coins: `${formatNumber(capsuleCoins)} 金币 · 随最深层成长`,
    speed: '持续 5 分钟，重复获得会延长时间',
    mining: '永久获得，不重复叠加',
    travel: '随时前往已解锁层',
    autoHatch: '在蛋台连续购买，仍消耗金币',
    luck: '持续 5 分钟，稀有及以上宠物生效',
  };
  return <PetDialog title="幸运扭蛋机" onClose={onClose} className="rewards-panel capsule-panel">
    <RewardBalance balance={rewards.balance} />
    <div className="rewards-content">
      <p className="capsule-intro">每次抽取获得一项奖励。永久权益重复抽到，转换为 {formatNumber(capsuleCoins)} 金币。</p>
      <div className="capsule-reward-grid" aria-label="扭蛋奖励及概率">{CAPSULE_REWARDS.map(reward => {
        const permanent = reward.id === 'mining' || reward.id === 'travel' || reward.id === 'autoHatch';
        const timed = reward.id === 'speed' || reward.id === 'luck' ? rewards.timed[reward.id] : 0;
        const owned = permanent && rewards.permanent[reward.id as keyof typeof rewards.permanent];
        return <div className="capsule-reward-card" key={reward.id} data-owned={owned}>
          <div className="capsule-reward-top"><span className="capsule-reward-symbol" aria-hidden="true">{reward.id === 'mining' ? <EquipmentIcon kind="pickaxe" /> : REWARD_SYMBOLS[reward.id]}</span><strong>{reward.weight}%</strong></div>
          <h2>{reward.name}</h2><p>{descriptions[reward.id]}</p>
          <small>{permanent ? owned ? '✓ 永久权益已获得' : '永久权益' : timed > 0 ? `剩余 ${clockLabel(timed)}` : reward.id === 'coins' ? '立即获得金币' : '仅在线消耗时间'}</small>
        </div>;
      })}</div>
      <div className="capsule-result" role="status" aria-live="polite" data-kind={notice?.kind}>
        {result ? <><strong>{result.duplicate ? `${name} · 已拥有` : result.reward === 'coins' ? `获得 ${formatNumber(result.coinReward)} 金币` : `获得 ${name}`}</strong><p>{result.duplicate ? `已转换为 ${formatNumber(result.coinReward)} 金币。` : result.reward === 'coins' ? '金币已加入余额。' : result.durationSeconds > 0 ? `有效时间增加 ${result.durationSeconds / 60} 分钟，剩余时间会随存档保留。` : '永久权益已解锁。'}</p></> : <p>{notice?.text ?? '准备好了吗？看看这次会获得什么。'}</p>}
      </div>
    </div>
    <footer className="capsule-footer"><p>{!atMachine ? '靠近地表扭蛋机后可以抽取。' : rewards.balance < REWARD_CONFIG.spinCost ? '幸运币不足，可从游玩奖励中获取。' : '稀有宠物的实际开蛋概率可在蛋台查看。'}</p>
      <GameButton blurAfterPress={false} className="pet-primary capsule-spin-button" disabled={!atMachine || rewards.balance < REWARD_CONFIG.spinCost} onPress={spin}><TokenIcon />消耗 {REWARD_CONFIG.spinCost} 枚 · 抽取一次</GameButton>
    </footer>
  </PetDialog>;
}
