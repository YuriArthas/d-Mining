import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { WorldId } from '../content/worldJourney.ts';
import { itemDefinition } from '../application/items.ts';
import { GameButton } from './GameButton.tsx';
import './journey.css';
const number=(n:number)=>n.toLocaleString('zh-CN');
function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  const root=useRef<HTMLElement>(null);useEffect(()=>{root.current?.focus();},[]);
  return <div className="upgrade-backdrop journey-backdrop"><section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="upgrade-panel journey-panel" onKeyDown={e=>{
    if(e.key==='Escape'){e.preventDefault();onClose();}
    if(e.key==='Tab'){const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)')];if(!controls.length)return;const i=controls.indexOf(document.activeElement as HTMLElement);e.preventDefault();controls[(i+(e.shiftKey?controls.length-1:1))%controls.length]?.focus();}
  }}><header><h1>{title}</h1><GameButton onPress={onClose} aria-label={`关闭${title}`}>关闭</GameButton></header>{children}</section></div>;
}
export function WorldPanel({session,onClose}:{session:GameSession;onClose:()=>void}) {
  const state=useSyncExternalStore(session.subscribe,session.getSnapshot);
  const [selected,setSelected]=useState<WorldId>(state.atMineEntrance??(state.currentWorld===1?2:state.currentWorld));
  const [confirm,setConfirm]=useState(false),[message,setMessage]=useState('');
  const world=state.worlds.find(w=>w.id===selected)!;
  const ready=world.areaOpen&&world.materials.every(m=>m.owned>=m.count)&&state.coins>=world.coins;
  const atEntrance=state.atMineEntrance===world.id;
  return <Dialog title="世界与矿区" onClose={onClose}>
    <nav className="journey-tabs">{state.worlds.map(w=><GameButton key={w.id} aria-pressed={selected===w.id} onPress={()=>{setSelected(w.id);setConfirm(false);setMessage('');}}>{w.name}{state.currentWorld===w.id?' · 当前位置':''}</GameButton>)}</nav>
    {confirm?<section className="journey-confirm"><h2>永久开放{world.name}矿区</h2><p>确认后扣除以下资源。保留中的材料也会用于这次缴纳。</p>
      <ul className="journey-materials">{world.materials.map(m=><li key={m.itemId}><strong>{m.name}</strong><span>扣除 {number(m.count)}<small>缴纳后剩余 {number(Math.max(0,m.owned-m.count))}</small></span></li>)}</ul>
      <p className="journey-amount">扣除 {number(world.coins)} 金币</p><p>缴纳后剩余 {number(Math.max(0,state.coins-world.coins))} 金币。</p><p>累计挖掘量不变，矿区永久开放，以后无需再次缴纳。</p>
      <GameButton disabled={!ready} onPress={()=>{
        const result=session.unlockWorldMine(world.id);setConfirm(false);
        setMessage(result.status==='opened'?'矿区已开放，可以下矿了。':result.status==='already-open'?'矿区已经开放，没有重复扣除。':result.status==='away'?'请回到这个世界的矿口缴纳。':'条件尚未满足，没有扣除材料或金币。');
      }}>确认缴纳</GameButton><GameButton onPress={()=>setConfirm(false)}>取消</GameButton>
    </section>:<><section className="journey-condition"><h2>{world.name}外门</h2>
      <p className="journey-amount">{world.id===1?'初始开放':`累计挖掘量 ${number(state.minedVolume)} / ${number(world.mined)}`}</p>
      {world.id!==1&&<><progress value={Math.min(state.minedVolume,world.mined)} max={world.mined}/><p>{world.areaOpen?'外门已打开，可以步行进入这个世界。':`还需 ${number(world.remaining)} 挖掘量。继续采集更深层矿产，会积累得更快。`}</p><small>按采集物占用的背包容量累计，出售不减少。达标时外门自动打开，不消耗累计量。</small></>}
      {world.areaOpen&&state.currentWorld!==world.id&&<GameButton disabled={!state.atHome} onPress={()=>{if(session.travelWorld(world.id)==='travelling')onClose();}}>传送到{world.name}地表</GameButton>}
      {world.areaOpen&&!state.atHome&&state.currentWorld!==world.id&&<p>可直接走过去；回本世界地表旅行点也可传送。</p>}
    </section>
    <section className="journey-condition"><h2>{world.name}矿区</h2>
      {world.mineOpen?<p className="journey-success">矿区已永久开放，无需再次缴纳。{world.id>1?`基础矿产需要 Lv.${(world.id-1)*10} 工具。`:''}</p>:<>
        <p>进入世界后，在矿口缴纳以下材料和金币，即可永久开放矿区。</p>
        <ul className="journey-materials">{world.materials.map(m=><li key={m.itemId}><span><strong>{m.name}</strong><small>第 {world.id-1} 世界 · 地下第 {m.layer} 层</small></span><span>{number(m.owned)} / {number(m.count)}<small>{m.owned>=m.count?'已集齐':`还差 ${number(m.count-m.owned)}`} · 已保留 {number(m.reserved)}</small></span></li>)}</ul>
        <p className="journey-amount">金币 {number(state.coins)} / {number(world.coins)}</p>
        {state.coins<world.coins&&<p>还差 {number(world.coins-state.coins)} 金币</p>}
        <GameButton onPress={()=>{session.reserveWorldMaterials(world.id);setMessage('已按要求保留材料；以后挖到的会自动补足，多余部分仍可出售。');}}>保留这些材料</GameButton>
        {!world.areaOpen?<p>先达到累计挖掘量要求，打开外门。</p>:!atEntrance?<p>缴纳地点：{world.name}矿口。进入世界后沿路走到矿口查看。</p>:<GameButton disabled={!ready} onPress={()=>setConfirm(true)}>缴纳并永久开放矿区</GameButton>}
      </>}
    </section></>}<p role="status">{message}</p>
  </Dialog>;
}
export function MineralPanel({session,onClose}:{session:GameSession;onClose:()=>void}) {
  const state=useSyncExternalStore(session.subscribe,session.getSnapshot),entries=Object.entries(state.inventory.items);
  return <Dialog title="矿物背包" onClose={onClose}><p>已用容量 {number(state.inventory.used)} / {number(state.inventory.capacity)}。保留的矿产不会被自动出售。</p>
    {!entries.length?<p>背包里还没有矿产。</p>:<ul className="journey-materials">{entries.map(([id,count])=>{
      const item=itemDefinition(id),reservation=state.mineralReservations[id];
      const needed=state.worlds.some(w=>!w.mineOpen&&w.materials.some(m=>m.itemId===id));
      return <li key={id}><span><strong>{item.name} × {number(count)}</strong><small>保留 {number(reservation.reserved)} · 可售 {number(reservation.sellable)}</small></span><select aria-label={`${item.name}保留方式`} value={reservation.mode} onChange={e=>session.reserveMineral(id,e.target.value as 'none'|'needed'|'all')}><option value="none">不保留</option>{needed&&<option value="needed">保留矿区所需数量</option>}<option value="all">全部保留</option></select></li>;
    })}</ul>}
    <p>可出售 {state.sale.status==='quoted'?number(state.sale.count):'—'} 件，预计获得 {state.sale.status==='quoted'?number(state.sale.coins):'—'} 金币。</p>
    {state.inSellZone?<><p>在售卖区调整保留后，由你确认出售。</p><GameButton onPress={session.sellAvailable} disabled={state.sale.status!=='quoted'||state.sale.count===0}>出售可售矿产</GameButton></>:<p>走进售卖区会自动出售可售部分。</p>}
    <p role="status">{state.notice}</p>
  </Dialog>;
}
