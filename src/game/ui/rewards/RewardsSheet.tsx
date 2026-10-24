import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { CAPSULE_REWARDS, ONLINE_REWARD_MINUTES, ONLINE_REWARDS, REWARD_CONFIG, SIGNIN_REWARDS } from '../../content/rewards.ts';
import type { RewardClaimResult, SpinResult } from '../../logic/Rewards.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { UiButton } from '../kit/controls.tsx';
import { Icon, type IconKind } from '../kit/icons.tsx';
import { Bar, Chip, Sheet, type SheetTab } from '../kit/panel.tsx';
import './rewards.css';

import { claimableRewards, readyOnlineRewards, rewardsTabFor, signin, type RewardsTab } from './rewardState.ts';
export { claimableRewards, rewardsTabFor, type RewardsTab };
type Claim = RewardClaimResult | { status: 'clipboard-failed' | 'unavailable' };
const clock = (seconds: number) => { const s = Math.max(0, Math.ceil(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function claimText(result: Claim, done: string) {
  switch (result.status) {
    case 'claimed': return `${done}，获得 ${result.amount} 枚幸运币！`;
    case 'already-claimed': return '这项奖励已经领过了';
    case 'not-ready': return '在线时间还不够，继续玩就好';
    case 'clock-reversed': return '设备日期早于上次领奖记录，请检查日期';
    case 'invalid-invite': return '没识别到有效的邀请码，请粘贴朋友分享的原文';
    case 'self-invite': return '不能兑换自己的邀请码';
    case 'clipboard-failed': return '复制失败，请允许剪贴板权限后重试';
    case 'unavailable': return '现在无法领取，请稍后再试';
  }
}

export function RewardsSheet({ session, tab, onTab, onClose }: { session: GameSession; tab: RewardsTab; onTab(tab: RewardsTab): void; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), rewards = state.rewards;
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState(''), [copying, setCopying] = useState(false), copyingRef = useRef(false);
  const online = readyOnlineRewards(rewards);
  const day = signin(rewards);
  useEffect(() => setMessage(''), [tab]);
  const claim = (action: () => Claim, done: string) => { try { setMessage(claimText(action(), done)); } catch (error) { setMessage(`操作失败：${String(error)}`); } };
  const share = async (platform: 'wechat' | 'douyin') => {
    if (copyingRef.current) return; copyingRef.current = true; setCopying(true);
    try { setMessage(claimText(await session.shareReward(platform), '文案已复制')); } catch (error) { setMessage(`操作失败：${String(error)}`); }
    finally { copyingRef.current = false; setCopying(false); }
  };
  const tabs: SheetTab<RewardsTab>[] = [
    { id: 'online', label: '在线', icon: 'gift', badge: online || undefined },
    { id: 'signin', label: '签到', icon: 'luck', badge: day.signedToday ? undefined : 1 },
    { id: 'invite', label: '邀请', icon: 'paw' },
  ];
  const footer = <><span className="ui-hint" role="status">{message || '幸运币在地表扭蛋机抽奖：金币、加速、永久挖矿加速、双倍出售……'}</span><span className="ui-grow" />
    <UiButton size="s" tone="pink" icon="gift" onPress={() => { if (session.goTo('capsule') === 'travelling') onClose(); }}>传送到扭蛋机</UiButton></>;
  return <Sheet title="奖励" tabs={tabs} tab={tab} onTab={onTab} onClose={onClose} footer={footer}>
    <div className="ui-row"><Chip icon="luck">幸运币 <b>{number(rewards.balance)}</b></Chip>
      <span className="ui-hint">{tab === 'online' ? `今日在线 ${clock(rewards.onlineSeconds)} · 每档每天领一次` : tab === 'signin' ? '连续签到 7 天一轮，断签从第 1 天重新开始' : `分享每天 +${REWARD_CONFIG.shareReward}，兑换朋友的邀请码 +${REWARD_CONFIG.inviteReward}`}</span></div>
    {tab === 'online' && <div className="ui-cards rewards-cards">{ONLINE_REWARD_MINUTES.map(minutes => {
      const claimed = rewards.onlineClaimed.includes(minutes), ready = !claimed && rewards.onlineSeconds >= minutes * 60;
      return <div key={minutes} className="ui-card-tile" data-ready={ready ? '' : undefined} style={ready ? { '--c': '#ffd447', '--c-lo': '#f08a14' } as CSSProperties : undefined}>
        <h4 className="ui-outline">{minutes} 分钟</h4><Icon kind="luck" className="ui-icon ui-card-art" /><b className="ui-outline">×{ONLINE_REWARDS[minutes]}</b>
        {claimed ? <span className="ui-stamp">已领取</span> : ready ? <UiButton size="s" tone="green" onPress={() => claim(() => session.claimOnlineReward(minutes), '领取成功')}>领取</UiButton>
          : <Bar value={rewards.onlineSeconds} max={minutes * 60}>{clock(minutes * 60 - rewards.onlineSeconds)}</Bar>}
      </div>;
    })}</div>}
    {tab === 'signin' && <div className="rewards-days">{SIGNIN_REWARDS.map((amount, index) => {
      const claimed = index < day.index || (index === day.index && day.signedToday), current = index === day.index && !day.signedToday;
      return <div key={index} className="ui-card-tile" data-ready={current ? '' : undefined} style={current ? { '--c': '#ffd447', '--c-lo': '#f08a14' } as CSSProperties : undefined}>
        <h4 className="ui-outline">第 {index + 1} 天</h4><Icon kind="luck" className="ui-icon ui-card-art" /><b className="ui-outline">×{amount}</b>
        {claimed ? <span className="ui-stamp">已签</span> : current ? <UiButton size="s" tone="green" onPress={() => claim(() => session.claimDailyReward(), '签到成功')}>签到</UiButton> : <small>　</small>}
      </div>;
    })}</div>}
    {tab === 'invite' && <div className="rewards-invite">
      <div className="ui-well rewards-share"><b className="ui-outline">邀请朋友一起挖矿</b><span className="ui-hint">复制文案发给朋友，每天第一次分享得 {REWARD_CONFIG.shareReward} 枚幸运币。</span>
        <div className="ui-row"><UiButton size="s" tone="green" disabled={copying} onPress={() => { void share('wechat'); }}>复制微信文案</UiButton><UiButton size="s" tone="blue" disabled={copying} onPress={() => { void share('douyin'); }}>复制抖音文案</UiButton></div></div>
      <div className="ui-well rewards-share"><b className="ui-outline">兑换朋友的邀请码</b>
        {rewards.redeemedInviteId !== null ? <span className="ui-stamp">邀请奖励已领取</span> : <>
          <textarea className="ui-input" aria-label="粘贴邀请码或分享文案" value={invite} maxLength={4096} rows={2} spellCheck={false} autoComplete="off" placeholder="粘贴朋友分享的文案或 MINING:1:…" onChange={event => setInvite(event.target.value)} />
          <UiButton size="s" tone="orange" disabled={!invite.trim()} onPress={() => claim(() => session.redeemInvite(invite), '兑换成功')}>兑换 {REWARD_CONFIG.inviteReward} 枚幸运币</UiButton></>}
      </div>
    </div>}
  </Sheet>;
}

const PRIZE_ICON: Record<string, IconKind> = { coins: 'coin', speed: 'bolt', mining: 'pickaxe', sell: 'coin', autoHatch: 'paw', luck: 'clover' };
const PERMANENT = new Set(['mining', 'autoHatch']);
type Spun = Extract<SpinResult, { status: 'spun' }>;

/** Capsule machine: the prize table on one screen and a quick reveal for each spin. */
export function CapsuleSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), rewards = state.rewards;
  const [result, setResult] = useState<Spun | null>(null), [message, setMessage] = useState('');
  const note: Record<string, string> = { coins: `${number(state.capsuleCoins)} 金币`, speed: '5 分钟', mining: '永久', sell: '5 分钟', autoHatch: '永久', luck: '5 分钟' };
  const spin = () => {
    try {
      const outcome = session.spinCapsule();
      if (outcome.status === 'spun') { setResult(outcome); setMessage(''); return; }
      setMessage({ away: '先走到扭蛋机旁边', unavailable: '现在无法抽奖', overflow: '金币已达上限，这次没扣幸运币', 'insufficient-currency': '幸运币不够，去奖励里领一些吧' }[outcome.status]);
    } catch (error) { setMessage(`操作失败：${String(error)}`); }
  };
  const prize = result ? CAPSULE_REWARDS.find(r => r.id === result.reward)! : null;
  return <>
    <Sheet title="幸运扭蛋机" subtitle="每次抽一项；已拥有的永久权益会换成金币" size="m" className="capsule-sheet" onClose={onClose} footer={<>
      <Chip icon="luck">幸运币 <b>{number(rewards.balance)}</b></Chip>
      <span className="ui-hint" role="status">{message || (!state.atMachine ? '走到扭蛋机旁边才能抽' : rewards.balance < REWARD_CONFIG.spinCost ? '幸运币不够，去奖励里领一些吧' : '')}</span><span className="ui-grow" />
      <UiButton size="m" tone="pink" icon="luck" disabled={!state.atMachine || rewards.balance < REWARD_CONFIG.spinCost} onPress={spin}>抽一次 · {REWARD_CONFIG.spinCost} 幸运币</UiButton>
    </>}>
      <div className="capsule-layout"><CapsuleArt />
        <div className="capsule-prizes">{CAPSULE_REWARDS.map(reward => {
          const owned = PERMANENT.has(reward.id) && rewards.permanent[reward.id as keyof typeof rewards.permanent];
          const timed = reward.id === 'speed' || reward.id === 'luck' || reward.id === 'sell' ? rewards.timed[reward.id] : 0;
          return <div key={reward.id} className="ui-card-tile capsule-prize" data-kind={PERMANENT.has(reward.id) ? 'permanent' : reward.id === 'coins' ? 'coins' : 'timed'}>
            <Icon kind={PRIZE_ICON[reward.id]} className="ui-icon capsule-prize-art" />
            <div><b className="ui-outline">{reward.name}</b><strong className="ui-outline">{reward.weight}%</strong><small>{owned ? '已拥有' : timed > 0 ? `剩余 ${clock(timed)}` : note[reward.id]}</small></div>
          </div>;
        })}</div>
      </div>
    </Sheet>
    {result && prize && <div className="hatch" data-rarity={PERMANENT.has(result.reward) ? 'epic' : result.reward === 'coins' ? 'legendary' : 'rare'} data-done="true" role="dialog" aria-modal="true" aria-label={`抽到：${prize.name}`}>
      <div className="hatch-rays" /><div className="hatch-stage"><div className="hatch-result">
        <div className="hatch-ribbon ui-outline">{result.duplicate ? '已拥有 · 换成金币' : '抽到啦！'}</div>
        <Icon kind={PRIZE_ICON[result.reward]} className="ui-icon capsule-reveal-art" />
        <h2 className="ui-outline">{result.duplicate || result.reward === 'coins' ? `${number(result.coinReward)} 金币` : prize.name}</h2>
        <span className="ui-hint">{result.duplicate ? `${prize.name}已经拥有，换成了金币` : result.reward === 'coins' ? '金币已到账' : result.durationSeconds > 0 ? `持续时间增加 ${result.durationSeconds / 60} 分钟` : '永久生效'}</span>
        <div className="ui-row hatch-actions"><UiButton size="m" tone="steel" onPress={() => setResult(null)}>好的</UiButton>
          <UiButton size="m" tone="pink" icon="gift" disabled={rewards.balance < REWARD_CONFIG.spinCost} onPress={() => { setResult(null); spin(); }}>再抽一次</UiButton></div>
      </div></div>
    </div>}
  </>;
}

function CapsuleArt() {
  const balls: [string, number, number][] = [['#ff6c9c', 44, 52], ['#ffd447', 66, 46], ['#53d8f2', 56, 66], ['#8be06e', 76, 66], ['#b67cf2', 38, 72]];
  return <svg className="capsule-art" viewBox="0 0 120 140" aria-hidden="true">
    <ellipse cx="60" cy="130" rx="44" ry="7" fill="#0b1d33" opacity=".3" />
    <path d="M30 92h60l8 34H22Z" fill="#ef5a5a" stroke="#13355d" strokeWidth="5" strokeLinejoin="round" />
    <circle cx="60" cy="56" r="40" fill="#dff6ff" fillOpacity=".85" stroke="#13355d" strokeWidth="5" />
    {balls.map(([c, x, y]) => <circle key={`${x}:${y}`} cx={x} cy={y} r="10" fill={c} stroke="#13355d" strokeWidth="3" />)}
    <path d="M36 34c5-8 12-12 20-13" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" />
    <rect x="50" y="104" width="20" height="14" rx="4" fill="#ffd447" stroke="#13355d" strokeWidth="3" /><rect x="26" y="88" width="68" height="10" rx="4" fill="#c63e4a" stroke="#13355d" strokeWidth="4" />
  </svg>;
}
