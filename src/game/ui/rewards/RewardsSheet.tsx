import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../../application/GameSession.ts';
import { CAPSULE_REWARDS, ONLINE_REWARD_MINUTES, ONLINE_REWARDS, REWARD_CONFIG, SIGNIN_REWARDS } from '../../content/rewards.ts';
import type { RewardClaimResult, SpinResult } from '../../logic/Rewards.ts';
import { formatNumber as number } from '../../presentation/formatNumber.ts';
import { PriceButton, UiButton } from '../kit/controls.tsx';
import { Icon, type IconKind } from '../kit/icons.tsx';
import { Bar, Chip, Sheet, type SheetTab } from '../kit/panel.tsx';
import './rewards.css';

import { claimableRewards, readyOnlineRewards, rewardsTabFor, signin, type RewardsTab } from './rewardState.ts';
import { currencyIcon, currencyName } from '../currency.ts';
import type { CurrencyId } from '../../content/economy.ts';
import { tr , resolveText } from '../../i18n/i18n.ts';
export { claimableRewards, rewardsTabFor, type RewardsTab };
type Claim = RewardClaimResult | { status: 'clipboard-failed' | 'unavailable' };
const clock = (seconds: number) => { const s = Math.max(0, Math.ceil(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function claimText(result: Claim, done: string) {
  switch (result.status) {
    case 'claimed': return tr("msg.done_you_got_amount_lucky_coins", { done: done, amount: result.amount });
    case 'already-claimed': return tr("msg.you_ve_already_claimed_this_reward");
    case 'not-ready': return tr("msg.not_online_long_enough_yet_keep_playing");
    case 'clock-reversed': return tr("msg.your_device_date_is_earlier_than_your_last_reward_please_che");
    case 'invalid-invite': return tr("msg.no_valid_invite_code_found_paste_your_friend_s_message_as_is");
    case 'self-invite': return tr("msg.you_can_t_redeem_your_own_invite_code");
    case 'clipboard-failed': return tr("msg.couldn_t_copy_allow_clipboard_access_and_try_again");
    case 'unavailable': return tr("msg.can_t_claim_right_now_try_again_in_a_moment");
  }
}

export function RewardsSheet({ session, tab, onTab, onClose }: { session: GameSession; tab: RewardsTab; onTab(tab: RewardsTab): void; onClose(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot), rewards = state.rewards;
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState(''), [copying, setCopying] = useState(false), copyingRef = useRef(false);
  const online = readyOnlineRewards(rewards);
  const day = signin(rewards);
  useEffect(() => setMessage(''), [tab]);
  const claim = (action: () => Claim, done: string) => { try { setMessage(claimText(action(), done)); } catch (error) { setMessage(tr("msg.something_failed_error", { error: String(error) })); } };
  const share = async (platform: 'wechat' | 'douyin') => {
    if (copyingRef.current) return; copyingRef.current = true; setCopying(true);
    try { setMessage(claimText(await session.shareReward(platform), tr("msg.message_copied"))); } catch (error) { setMessage(tr("msg.something_failed_error", { error: String(error) })); }
    finally { copyingRef.current = false; setCopying(false); }
  };
  const tabs: SheetTab<RewardsTab>[] = [
    { id: 'online', label: tr("msg.online"), icon: 'gift', badge: online || undefined },
    { id: 'signin', label: tr("msg.sign_in"), icon: 'luck', badge: day.signedToday ? undefined : 1 },
    { id: 'invite', label: tr("msg.invite"), icon: 'paw' },
  ];
  return <Sheet title={tr("msg.rewards")} tabs={tabs} tab={tab} onTab={onTab} onClose={onClose} className="rewards-sheet">
    <div className="ui-row rewards-head"><Chip icon="luck">{tr("msg.lucky_coins")} <b>{number(rewards.balance)}</b></Chip>
 <span className="ui-hint">{tab === 'online' ? tr("msg.online_today_onlineseconds_each_tier_once_a_day", { onlineSeconds: clock(rewards.onlineSeconds) }) : tab === 'signin' ? tr("msg.sign_in_7_days_in_a_row_per_round_miss_a_day_and_you_start_a") : tr("msg.share_daily_sharereward_redeem_a_friend_s_code_invitereward", { shareReward: REWARD_CONFIG.shareReward, inviteReward: REWARD_CONFIG.inviteReward })}</span></div>
    {tab === 'online' && <div className="ui-cards rewards-cards">{ONLINE_REWARD_MINUTES.map(minutes => {
      const claimed = rewards.onlineClaimed.includes(minutes), ready = !claimed && rewards.onlineSeconds >= minutes * 60;
      return <div key={minutes} className="ui-card-tile reward-card" data-state={claimed ? 'claimed' : ready ? 'ready' : 'waiting'}>
        <h4 className="ui-outline">{tr("msg.n_min", { n: minutes })}</h4><Icon kind="luck" className="ui-icon ui-card-art" /><b className="ui-outline">×{ONLINE_REWARDS[minutes]}</b>
        {claimed ? <span className="ui-stamp">{tr("msg.claimed")}</span> : ready ? <UiButton size="s" tone="green" onPress={() => claim(() => session.claimOnlineReward(minutes), tr("msg.claimed_097c4d58"))}>{tr("msg.claim")}</UiButton>
          : <Bar value={rewards.onlineSeconds} max={minutes * 60}>{clock(minutes * 60 - rewards.onlineSeconds)}</Bar>}
      </div>;
    })}</div>}
    {tab === 'signin' && <div className="rewards-days">{SIGNIN_REWARDS.map((amount, index) => {
      const claimed = index < day.index || (index === day.index && day.signedToday), current = index === day.index && !day.signedToday;
      return <div key={index} className="ui-card-tile reward-card" data-state={claimed ? 'claimed' : current ? 'ready' : 'waiting'} data-last={index === SIGNIN_REWARDS.length - 1 || undefined}>
        <h4 className="ui-outline">{tr("msg.day_n", { n: index + 1 })}</h4><Icon kind="luck" className="ui-icon ui-card-art" /><b className="ui-outline">×{amount}</b>
        {claimed ? <span className="ui-stamp">{tr("msg.signed_in")}</span> : current ? <UiButton size="s" tone="green" onPress={() => claim(() => session.claimDailyReward(), tr("msg.signed_in_ac1ea22a"))}>{tr("msg.claim")}</UiButton> : <small className="reward-later">{tr("msg.tomorrow")}</small>}
      </div>;
    })}</div>}
    {tab === 'invite' && <div className="rewards-invite">
      <div className="ui-well rewards-share"><b className="ui-outline">{tr("msg.invite_friends_to_dig")}</b><span className="ui-hint">{tr("msg.copy_the_message_and_send_it_to_a_friend_your_first_share_ea", { n: REWARD_CONFIG.shareReward })}</span>
        <div className="ui-row"><UiButton size="s" tone="green" disabled={copying} onPress={() => { void share('wechat'); }}>{tr("msg.copy_wechat_message")}</UiButton><UiButton size="s" tone="blue" disabled={copying} onPress={() => { void share('douyin'); }}>{tr("msg.copy_douyin_message")}</UiButton></div></div>
      <div className="ui-well rewards-share"><b className="ui-outline">{tr("msg.redeem_a_friend_s_invite_code")}</b>
        {rewards.redeemedInviteId !== null ? <span className="ui-stamp">{tr("msg.invite_reward_claimed")}</span> : <>
          <textarea className="ui-input" aria-label={tr("msg.paste_an_invite_code_or_message")} value={invite} maxLength={4096} rows={2} spellCheck={false} autoComplete="off" placeholder={tr("msg.paste_your_friend_s_message_or_mining_1")} onChange={event => setInvite(event.target.value)} />
          <UiButton size="s" tone="orange" disabled={!invite.trim()} onPress={() => claim(() => session.redeemInvite(invite), tr("msg.redeemed"))}>{tr("msg.redeem_n_lucky_coins", { n: REWARD_CONFIG.inviteReward })}</UiButton></>}
      </div>
    </div>}
    {message && <output key={message} className="ui-toast rewards-toast ui-pop" role="status">{message}</output>}
    <div className="rewards-capsule">
      <CapsuleArt />
      <span>{tr("msg.spend_lucky_coins_at_the_capsule_machine_on_the_surface_mone")}</span>
      <UiButton size="s" tone="purple" icon="gift" onPress={() => { if (session.goTo('capsule') === 'travelling') onClose(); }}>{tr("msg.go_to_machine")}</UiButton>
    </div>
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
  const unit = currencyName(state.capsuleCurrency), minutes = tr("msg.n_min", { n: REWARD_CONFIG.timedDurationSeconds / 60 });
  const note: Record<string, string> = { coins: `${number(state.capsuleCoins)} ${unit}`, speed: minutes, mining: tr("msg.permanent"), sell: minutes, autoHatch: tr("msg.permanent"), luck: minutes };
  const spin = () => {
    try {
      const outcome = session.spinCapsule();
      if (outcome.status === 'spun') { setResult(outcome); setMessage(''); return; }
      setMessage({ away: tr("msg.walk_up_to_the_capsule_machine_first"), unavailable: tr("msg.can_t_spin_right_now"), overflow: tr("msg.unit_is_at_its_limit_no_lucky_coins_were_spent", { unit: unit }), 'insufficient-currency': '' }[outcome.status]);
    } catch (error) { setMessage(tr("msg.something_failed_error", { error: String(error) })); }
  };
  const prize = result ? CAPSULE_REWARDS.find(r => r.id === result.reward)! : null;
  return <>
    <Sheet title={tr("msg.lucky_capsule_machine")} subtitle={tr("msg.one_prize_per_spin_permanent_perks_you_already_own_turn_into", { unit: unit })} size="m" className="capsule-sheet" onClose={onClose} footer={<>
      <Chip icon="luck">{tr("msg.lucky_coins")} <b>{number(rewards.balance)}</b></Chip>
      <span className="ui-hint" role="status">{message || (!state.atMachine ? tr("msg.walk_up_to_the_capsule_machine_to_spin") : '')}</span><span className="ui-grow" />
      <PriceButton verb={tr("msg.spin")} price={REWARD_CONFIG.spinCost} currency="luck" tone="purple" className="capsule-spin" disabled={!state.atMachine || rewards.balance < REWARD_CONFIG.spinCost}
        aria-label={tr("msg.spin_n_lucky_coins", { n: REWARD_CONFIG.spinCost })} onPress={spin} />
    </>}>
      <div className="capsule-layout"><CapsuleArt />
        <div className="capsule-prizes">{CAPSULE_REWARDS.map(reward => {
          const owned = PERMANENT.has(reward.id) && rewards.permanent[reward.id as keyof typeof rewards.permanent];
          const timed = reward.id === 'speed' || reward.id === 'luck' || reward.id === 'sell' ? rewards.timed[reward.id] : 0;
          return <div key={reward.id} className="ui-card-tile capsule-prize" data-kind={PERMANENT.has(reward.id) ? 'permanent' : reward.id === 'coins' ? 'coins' : 'timed'}>
            <Icon kind={prizeIcon(reward.id, state.capsuleCurrency)} className="ui-icon capsule-prize-art" />
            <div><b className="ui-outline">{reward.id === 'coins' ? unit : resolveText(reward.name)}</b><strong className="ui-outline">{reward.weight}%</strong><small>{owned ? tr("msg.owned") : timed > 0 ? tr("msg.timed_left", { timed: clock(timed) }) : note[reward.id]}</small></div>
          </div>;
        })}</div>
      </div>
    </Sheet>
    {result && prize && <div className="hatch" data-rarity={PERMANENT.has(result.reward) ? 'epic' : result.reward === 'coins' ? 'legendary' : 'rare'} data-done="true" role="dialog" aria-modal="true" aria-label={tr("msg.you_got_name", { name: prize.name })}>
      <div className="hatch-rays" /><div className="hatch-stage"><div className="hatch-result">
        <div className="hatch-ribbon ui-outline">{result.duplicate ? tr("msg.owned_turns_into_unit", { unit: unit }) : tr("msg.you_got_it")}</div>
        <Icon kind={prizeIcon(result.reward, state.capsuleCurrency)} className="ui-icon capsule-reveal-art" />
        <h2 className="ui-outline">{result.duplicate || result.reward === 'coins' ? `${number(result.coinReward)} ${unit}` : resolveText(prize.name)}</h2>
        <span className="ui-hint">{result.duplicate ? tr("msg.you_already_own_name_so_you_got_unit_instead", { name: prize.name, unit: unit }) : result.reward === 'coins' ? tr("msg.unit_received", { unit: unit }) : result.durationSeconds > 0 ? tr("msg.duration_durationseconds_min", { durationSeconds: result.durationSeconds / 60 }) : tr("msg.permanent_f2d29d83")}</span>
        <div className="ui-row hatch-actions"><UiButton size="m" tone="white" onPress={() => setResult(null)}>{tr("msg.ok")}</UiButton>
          <PriceButton verb={tr("msg.spin_again")} price={REWARD_CONFIG.spinCost} currency="luck" tone="purple" disabled={rewards.balance < REWARD_CONFIG.spinCost} onPress={() => { setResult(null); spin(); }} /></div>
      </div></div>
    </div>}
  </>;
}

function CapsuleArt() {
  const balls: [string, number, number][] = [['#ff6c9c', 44, 52], ['#ffd447', 66, 46], ['#53d8f2', 56, 66], ['#8be06e', 76, 66], ['#b67cf2', 38, 72]];
  return <svg className="capsule-art" viewBox="0 0 120 140" aria-hidden="true">
    <path d="M30 92h60l8 34H22Z" fill="#ef5a5a" stroke="#1b2340" strokeWidth="5" strokeLinejoin="round" />
    <circle cx="60" cy="56" r="40" fill="#dff6ff" fillOpacity=".85" stroke="#1b2340" strokeWidth="5" />
    {balls.map(([c, x, y]) => <circle key={`${x}:${y}`} cx={x} cy={y} r="10" fill={c} stroke="#1b2340" strokeWidth="3" />)}
    <path d="M36 34c5-8 12-12 20-13" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" />
    <rect x="50" y="104" width="20" height="14" rx="4" fill="#ffd447" stroke="#1b2340" strokeWidth="3" /><rect x="26" y="88" width="68" height="10" rx="4" fill="#c63e4a" stroke="#1b2340" strokeWidth="4" />
  </svg>;
}
