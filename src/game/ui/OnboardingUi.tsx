import { useEffect, useSyncExternalStore, type RefObject } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { DepthGoal } from '../application/OnboardingGuide.ts';
import { LONG_MINING_GOAL } from '../logic/Onboarding.ts';
import { GameButton } from './GameButton.tsx';
import { PetDialog } from './pets/PetDialog.tsx';
import './onboarding.css';
import arrowUrl from '../assets/guide-arrow/roblox-arrow-v1.webp';
const touchControls = window.matchMedia('(any-pointer: coarse)');
const subscribeTouch = (notify: () => void) => { touchControls.addEventListener('change', notify); return () => touchControls.removeEventListener('change', notify); };
const getTouch = () => touchControls.matches;
function useTouchControls() { return useSyncExternalStore(subscribeTouch, getTouch); }
function LeftMouseHint() {
 return <svg className="guide-left-mouse" viewBox="0 0 52 70" aria-hidden="true"><path d="M26 3C13 3 5 12 5 25V43C5 57 13 66 26 66S47 57 47 43V25C47 12 39 3 26 3Z" fill="#173e40" stroke="#fff4c6" strokeWidth="3"/><path className="guide-left-button" d="M25 5C13 5 7 13 7 25V31H25Z" fill="#ffdc60"/><path d="M26 4V32H46M6 32H26" fill="none" stroke="#fff4c6" strokeWidth="2"/><rect x="23" y="16" width="6" height="13" rx="3" fill="#fff4c6"/></svg>;
}
export function GuideCard({session,state,hidden,marker}:{session:GameSession;state:ReturnType<GameSession['getSnapshot']>;hidden:boolean;marker:RefObject<HTMLDivElement|null>}) {
 const touch = useTouchControls();
 useEffect(()=>{
  if(hidden||(state.requestedEgg||state.requestedShop)||!state.guideCompletionPending)return;
  const timer=setTimeout(session.dismissGuideCompletion,5000);return ()=>clearTimeout(timer);
 },[hidden,(state.requestedEgg||state.requestedShop),state.guideCompletionPending,session]);
 if(hidden)return null;
 if(!(state.requestedEgg||state.requestedShop)&&state.guideCompletionPending)return <aside className="guide-card guide-complete" role="status"><strong>基础教学完成！</strong><p>当前宠物力量加成 +{session.pets.getSnapshot().bonus.powerBonusBps / 100}% · 实际挖矿力量 {state.miningStats.power}。继续向下，解锁新矿层和宠物蛋。</p><GameButton aria-label="关闭引导完成提示" onPress={session.dismissGuideCompletion}>知道了</GameButton></aside>;
 const guide=state.guide;if(!guide)return null;
 const title=!touch?guide.title:guide.id==='dig'?'长按发光方块，挖下第一块矿':guide.id==='long-task'?'长期目标：采矿 100 块':guide.title;
 const detail=!touch?guide.detail:guide.id==='mine'?'左侧摇杆移动 · 右侧拖动观察':guide.id==='dig'?'手指按住方块，直到它碎掉':guide.id==='long-task'?`已采 ${state.onboarding.minedCount} 块，可边探索边完成。`:guide.detail.replace(/靠近(?:后)?按 E/g,'靠近后点“查看”').replace('无需按 E','无需点按钮');
 const eggName=session.pets.getSnapshot().eggs.find(egg=>egg.id===state.guideEggId)?.name;
 return <><aside className="guide-card" aria-label="当前引导" data-testid="guide-card" data-step={guide.id}>
   <span className="guide-kicker">{(state.requestedEgg||state.requestedShop)?(state.requestedShop?'前往商店':'前往蛋台'):guide.phase==='pets'?'宠物帮手':'当前目标'}</span><strong>{title}</strong><p>{detail}</p>
   {guide.id==='dig'&&!touch&&<div className="guide-mouse-instruction"><LeftMouseHint/><div><b>按住左键</b><span>持续挖掘，直到方块碎掉</span></div></div>}
   {guide.id==='long-task'&&<GameButton className="guide-continue" onPress={session.acknowledgeLongMiningTask}>继续：认识宠物</GameButton>}
   <GameButton className={(state.requestedEgg||state.requestedShop)?'guide-cancel':'guide-skip'} onPress={(state.requestedEgg||state.requestedShop)?session.cancelEggGuide:session.skipOnboarding}>{(state.requestedEgg||state.requestedShop)?'取消指引':'跳过引导'}</GameButton>
  </aside>{guide.id==='dig'?<div key="dig" ref={marker} className="guide-dig-marker" data-input={touch?'touch':'mouse'} style={{visibility:'hidden'}} aria-hidden="true"><span className="guide-dig-ring"/><b className="guide-dig-caption">{touch?'长按这里挖矿':'鼠标移到这里 · 按住左键'}</b></div>:guide.marker&&state.guideAnchor&&<div key="destination" ref={marker} className="guide-marker" style={{visibility:'hidden'}} aria-hidden="true"><span className="guide-marker-arrow"><img src={arrowUrl} className="guide-arrow-image" alt="" /></span><b>{guide.marker==='mine'?'矿坑入口':guide.marker==='sell'?'售卖圈':guide.marker==='shop'?'商店':eggName}</b><small className="guide-offscreen">朝这个方向</small></div>}</>;
}
export function DepthGoalCard({goal,minedCount,showMiningTask}:{goal:DepthGoal|null;minedCount:number;showMiningTask:boolean}) {
 if(!goal&&!showMiningTask)return null;
 return <aside className="journey-goals" aria-label="探索目标" data-testid="journey-goals">
  {goal&&<div className="journey-depth"><span className="guide-kicker">下一矿层</span><strong>向 {goal.name} 进发</strong><p>历史最深 {Math.floor(goal.currentDepth)} / {goal.depth} 米</p><progress aria-label={`解锁${goal.name}的深度进度`} value={goal.currentDepth} max={goal.depth}/><p>到达后同时开放该层传送和宠物蛋。</p></div>}
  {showMiningTask&&<div className="journey-mining"><strong>{minedCount>=LONG_MINING_GOAL?'百块采矿目标已完成':'长期目标：采矿 100 块'}</strong><span>累计 {minedCount} 块{minedCount<LONG_MINING_GOAL?` / ${LONG_MINING_GOAL}`:''}</span></div>}
 </aside>;
}
export function OnboardingHelp({session,onClose}:{session:GameSession;onClose():void}) {
 const touch=useTouchControls();
 const status=session.getSnapshot().onboarding.status;
 return <PetDialog title="操作帮助" onClose={onClose} className="guide-help">
  <p>{touch?'左侧摇杆移动 · 右下按钮跳跃 · 右侧空白处拖动观察':'WASD 移动 · 空格跳跃 · 按住右键拖动观察'}</p>
  <p>{touch?'点一下方块敲击，长按持续挖矿。可以一边移动，一边拖动观察。':'鼠标指向方块，按住左键挖掘。'}矿物会自动装进背包。</p>
  <ol><li>带上矿石，点击“返回地表”，再走进金色圆圈自动出售。地下休整房间也能卖矿。</li><li>走进蓝色 Shop 圈，选择工具或背包商店。左右切换查看装备，用金币购买。升级镐子会提高力量，部分等级还会提高攻速；购买后自动生效。</li><li>继续向下挖到 20 米，尝试一次带回更多矿石。累计采矿 100 块是长期目标，不影响继续认识宠物。</li><li>{touch?'靠近蛋台，点“查看宠物蛋”查看真实概率。':'靠近蛋台按 E 查看真实概率。'}开蛋后进入“宠物”，装备后才会增加挖矿力量。</li><li>历史最深深度达到下一层门槛，就永久解锁该层、对应传送和宠物蛋；返回地表也会保留。进度自动保存。</li></ol>
  {status==='active'?<GameButton className="pet-secondary" onPress={()=>{session.skipOnboarding();onClose();}}>跳过引导</GameButton>:(status==='skipped'||status==='legacy')?<GameButton className="pet-primary" onPress={()=>{session.resumeOnboarding();onClose();}}>{status==='legacy'?'开启引导':'继续引导'}</GameButton>:<p>基础引导已完成，可以自由探索。</p>}
 </PetDialog>;
}
