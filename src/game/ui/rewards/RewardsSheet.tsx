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
import { currencyIcon, currencyName } from '../currency.ts';
import type { CurrencyId } from '../../content/economy.ts';
import { tr } from '../../i18n/i18n.ts';
export { claimableRewards, rewardsTabFor, type RewardsTab };
type Claim = RewardClaimResult | { status: 'clipboard-failed' | 'unavailable' };
const clock = (seconds: number) => { const s = Math.max(0, Math.ceil(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function claimText(result: Claim, done: string) {
  switch (result.status) {
    case 'claimed': return tr('{done}，获得 {amount} 枚幸运币！', { done: done, amount: result.amount });
    case 'already-claimed': return tr('这项奖励已经领过了');
    case 'not-ready': return tr('在线时间还不够，继续玩就好');
    case 'clock-reversed': return tr('设备日期早于上次领奖记录，请检查日期');
    case 'invalid-invite': return tr('没识别到有效的邀请码，请粘贴朋友分享的原文');
    case 'self-invite': return tr('不能兑换自己的邀请码');
    case 'clipboard-failed': return tr('复制失败，请允许剪贴板权限后重试');
    case 'unavailable': return tr('现在无法领取，请稍后再试');
  }
}

export function RewardsSheet({ session, tab, onTab, onClose }: { session: GameSession; tab: RewardsTab; onTab(tab: RewardsTab): void; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), rewards = state.rewards;
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState(''), [copying, setCopying] = useState(false), copyingRef = useRef(false);
  const online = readyOnlineRewards(rewards);
  const day = signin(rewards);
  useEffect(() => setMessage(''), [tab]);
  const claim = (action: () => Claim, done: string) => { try { setMessage(claimText(action(), done)); } catch (error) { setMessage(tr('操作失败：{error}', { error: String(error) })); } };
  const share = async (platform: 'wechat' | 'douyin') => {
    if (copyingRef.current) return; copyingRef.current = true; setCopying(true);
    try { setMessage(claimText(await session.shareReward(platform), tr('文案已复制'))); } catch (error) { setMessage(tr('操作失败：{error}', { error: String(error) })); }
    finally { copyingRef.current = false; setCopying(false); }
  };
  const tabs: SheetTab<RewardsTab>[] = [
    { id: 'online', label: tr('在线'), icon: 'gift', badge: online || undefined },
    { id: 'signin', label: tr('签到'), icon: 'luck', badge: day.signedToday ? undefined : 1 },
    { id: 'invite', label: tr('邀请'), icon: 'paw' },
  ];
  const footer = <><span className="ui-hint" role="status">{message || tr('幸运币在地表扭蛋机抽奖：货币、加速、永久挖矿加速、双倍出售……')}</span><span className="ui-grow" />
    <UiButton size="s" tone="purple" icon="gift" onPress={() => { if (session.goTo('capsule') === 'travelling') onClose(); }}>{tr('传送到扭蛋机')}</UiButton></>;
  return <Sheet title={tr('奖励')} tabs={tabs} tab={tab} onTab={onTab} onClose={onClose} footer={footer}>
    <div className="ui-row"><Chip icon="luck">{tr('幸运币')} <b>{number(rewards.balance)}</b></Chip>
      <span className="ui-hint">{tab === 'online' ? tr('今日在线 {onlineSeconds} · 每档每天领一次', { onlineSeconds: clock(rewards.onlineSeconds) }) : tab === 'signin' ? tr('连续签到 7 天一轮，断签从第 1 天重新开始') : tr('分享每天 +{shareReward}，兑换朋友的邀请码 +{inviteReward}', { shareReward: REWARD_CONFIG.shareReward, inviteReward: REWARD_CONFIG.inviteReward })}</span></div>
    {tab === 'online' && <div className="ui-cards rewards-cards">{ONLINE_REWARD_MINUTES.map(minutes => {
      const claimed = rewards.onlineClaimed.includes(minutes), ready = !claimed && rewards.onlineSeconds >= minutes * 60;
      return <div key={minutes} className="ui-card-tile" data-ready={ready ? '' : undefined} style={ready ? { '--c': '#ffd447', '--c-lo': '#f08a14' } as CSSProperties : undefined}>
        <h4 className="ui-outline">{tr('{n} 分钟', { n: minutes })}</h4><Icon kind="luck" className="ui-icon ui-card-art" /><b className="ui-outline">×{ONLINE_REWARDS[minutes]}</b>
        {claimed ? <span className="ui-stamp">{tr('已领取')}</span> : ready ? <UiButton size="s" tone="green" onPress={() => claim(() => session.claimOnlineReward(minutes), tr('领取成功'))}>{tr('领取')}</UiButton>
          : <Bar value={rewards.onlineSeconds} max={minutes * 60}>{clock(minutes * 60 - rewards.onlineSeconds)}</Bar>}
      </div>;
    })}</div>}
    {tab === 'signin' && <div className="rewards-days">{SIGNIN_REWARDS.map((amount, index) => {
      const claimed = index < day.index || (index === day.index && day.signedToday), current = index === day.index && !day.signedToday;
      return <div key={index} className="ui-card-tile" data-ready={current ? '' : undefined} style={current ? { '--c': '#ffd447', '--c-lo': '#f08a14' } as CSSProperties : undefined}>
        <h4 className="ui-outline">{tr('第 {n} 天', { n: index + 1 })}</h4><Icon kind="luck" className="ui-icon ui-card-art" /><b className="ui-outline">×{amount}</b>
        {claimed ? <span className="ui-stamp">{tr('已签')}</span> : current ? <UiButton size="s" tone="green" onPress={() => claim(() => session.claimDailyReward(), tr('签到成功'))}>{tr('签到')}</UiButton> : <small>　</small>}
      </div>;
    })}</div>}
    {tab === 'invite' && <div className="rewards-invite">
      <div className="ui-well rewards-share"><b className="ui-outline">{tr('邀请朋友一起挖矿')}</b><span className="ui-hint">{tr('复制文案发给朋友，每天第一次分享得 {n} 枚幸运币。', { n: REWARD_CONFIG.shareReward })}</span>
        <div className="ui-row"><UiButton size="s" tone="green" disabled={copying} onPress={() => { void share('wechat'); }}>{tr('复制微信文案')}</UiButton><UiButton size="s" tone="blue" disabled={copying} onPress={() => { void share('douyin'); }}>{tr('复制抖音文案')}</UiButton></div></div>
      <div className="ui-well rewards-share"><b className="ui-outline">{tr('兑换朋友的邀请码')}</b>
        {rewards.redeemedInviteId !== null ? <span className="ui-stamp">{tr('邀请奖励已领取')}</span> : <>
          <textarea className="ui-input" aria-label={tr('粘贴邀请码或分享文案')} value={invite} maxLength={4096} rows={2} spellCheck={false} autoComplete="off" placeholder={tr('粘贴朋友分享的文案或 MINING:1:…')} onChange={event => setInvite(event.target.value)} />
          <UiButton size="s" tone="orange" disabled={!invite.trim()} onPress={() => claim(() => session.redeemInvite(invite), tr('兑换成功'))}>{tr('兑换 {n} 枚幸运币', { n: REWARD_CONFIG.inviteReward })}</UiButton></>}
      </div>
    </div>}
  </Sheet>;
}

const PRIZE_ICON: Record<string, IconKind> = { coins: 'coin', speed: 'bolt', mining: 'pickaxe', sell: 'coin', autoHatch: 'paw', luck: 'clover' };
const prizeIcon = (id: string, currency: CurrencyId) => id === 'coins' || id === 'sell' ? currencyIcon(currency) : PRIZE_ICON[id];
const PERMANENT = new Set(['mining', 'autoHatch']);
type Spun = Extract<SpinResult, { status: 'spun' }>;

/** Capsule machine: the prize table on one screen and a quick reveal for each spin. */
export function CapsuleSheet({ session, onClose }: { session: GameSession; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), rewards = state.rewards;
  const [result, setResult] = useState<Spun | null>(null), [message, setMessage] = useState('');
  const unit = currencyName(state.capsuleCurrency), minutes = tr('{timedDurationSeconds} 分钟', { timedDurationSeconds: REWARD_CONFIG.timedDurationSeconds / 60 });
  const note: Record<string, string> = { coins: `${number(state.capsuleCoins)} ${unit}`, speed: minutes, mining: tr('永久'), sell: minutes, autoHatch: tr('永久'), luck: minutes };
  const spin = () => {
    try {
      const outcome = session.spinCapsule();
      if (outcome.status === 'spun') { setResult(outcome); setMessage(''); return; }
      setMessage({ away: tr('先走到扭蛋机旁边'), unavailable: tr('现在无法抽奖'), overflow: tr('{unit}已达上限，这次没扣幸运币', { unit: unit }), 'insufficient-currency': '' }[outcome.status]);
    } catch (error) { setMessage(tr('操作失败：{error}', { error: String(error) })); }
  };
  const prize = result ? CAPSULE_REWARDS.find(r => r.id === result.reward)! : null;
  return <>
    <Sheet title={tr('幸运扭蛋机')} subtitle={tr('每次抽一项；已拥有的永久权益会换成{unit}', { unit: unit })} size="m" className="capsule-sheet" onClose={onClose} footer={<>
      <Chip icon="luck">{tr('幸运币')} <b>{number(rewards.balance)}</b></Chip>
      <span className="ui-hint" role="status">{message || (!state.atMachine ? tr('走到扭蛋机旁边才能抽') : '')}</span><span className="ui-grow" />
      <UiButton size="m" tone="purple" icon="luck" disabled={!state.atMachine || rewards.balance < REWARD_CONFIG.spinCost} onPress={spin}>{tr('抽一次 · {n} 幸运币', { n: REWARD_CONFIG.spinCost })}</UiButton>
    </>}>
      <div className="capsule-layout"><CapsuleArt />
        <div className="capsule-prizes">{CAPSULE_REWARDS.map(reward => {
          const owned = PERMANENT.has(reward.id) && rewards.permanent[reward.id as keyof typeof rewards.permanent];
          const timed = reward.id === 'speed' || reward.id === 'luck' || reward.id === 'sell' ? rewards.timed[reward.id] : 0;
          return <div key={reward.id} className="ui-card-tile capsule-prize" data-kind={PERMANENT.has(reward.id) ? 'permanent' : reward.id === 'coins' ? 'coins' : 'timed'}>
            <Icon kind={prizeIcon(reward.id, state.capsuleCurrency)} className="ui-icon capsule-prize-art" />
            <div><b className="ui-outline">{reward.id === 'coins' ? unit : reward.name}</b><strong className="ui-outline">{reward.weight}%</strong><small>{owned ? tr('已拥有') : timed > 0 ? tr('剩余 {timed}', { timed: clock(timed) }) : note[reward.id]}</small></div>
          </div>;
        })}</div>
      </div>
    </Sheet>
    {result && prize && <div className="hatch" data-rarity={PERMANENT.has(result.reward) ? 'epic' : result.reward === 'coins' ? 'legendary' : 'rare'} data-done="true" role="dialog" aria-modal="true" aria-label={tr('抽到：{name}', { name: prize.name })}>
      <div className="hatch-rays" /><div className="hatch-stage"><div className="hatch-result">
        <div className="hatch-ribbon ui-outline">{result.duplicate ? tr('已拥有 · 换成{unit}', { unit: unit }) : tr('抽到啦！')}</div>
        <Icon kind={prizeIcon(result.reward, state.capsuleCurrency)} className="ui-icon capsule-reveal-art" />
        <h2 className="ui-outline">{result.duplicate || result.reward === 'coins' ? `${number(result.coinReward)} ${unit}` : prize.name}</h2>
        <span className="ui-hint">{result.duplicate ? tr('{name}已经拥有，换成了{unit}', { name: prize.name, unit: unit }) : result.reward === 'coins' ? tr('{unit}已到账', { unit: unit }) : result.durationSeconds > 0 ? tr('持续时间增加 {durationSeconds} 分钟', { durationSeconds: result.durationSeconds / 60 }) : tr('永久生效')}</span>
        <div className="ui-row hatch-actions"><UiButton size="m" tone="steel" onPress={() => setResult(null)}>{tr('好的')}</UiButton>
          <UiButton size="m" tone="purple" icon="gift" disabled={rewards.balance < REWARD_CONFIG.spinCost} onPress={() => { setResult(null); spin(); }}>{tr('再抽一次')}</UiButton></div>
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
