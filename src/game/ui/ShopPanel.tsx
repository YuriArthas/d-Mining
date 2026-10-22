import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameSession } from '../application/GameSession.ts';
import type { ShopCategory } from '../content/shopCatalog.ts';
import type { ShopView } from '../presentation/ShopView.ts';
import { formatNumber as number } from '../presentation/formatNumber.ts';
import { GameButton } from './GameButton.tsx';
import { HudIcon } from './HudIcon.tsx';
import './shop.css';

export function ShopPanel({session,view,onClose}:{session:GameSession;view:ShopView;onClose():void}) {
  const state=useSyncExternalStore(session.subscribe,session.getSnapshot);
  const display=useSyncExternalStore(view.subscribe,view.getSnapshot);
  const [message,setMessage]=useState('');
  useEffect(()=>{setMessage('');},[display.mode,display.index]);
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[onClose]);
  const open=(category:ShopCategory)=>{
    const items=state.shopCatalog[category];
    const index=items.findIndex(item=>category==='tools'?item.level===state.pickaxe.level:item.capacity===state.inventory.capacity);
    view.show(category,items,Math.max(0,index));
  };
  if(display.mode==='categories')return <section className="shop-chooser" role="dialog" aria-modal="true" aria-label="商店分类">
    <div className="shop-category-box">
      <h1>商店</h1><GameButton className="shop-close" aria-label="关闭商店" onPress={onClose}>×</GameButton>
      <div className="shop-categories">
        <GameButton className="shop-category" data-category="tools" onPress={()=>open('tools')}><HudIcon kind="upgrade"/><strong>工具商店</strong><span>挑选你的矿镐</span></GameButton>
        <GameButton className="shop-category" data-category="backpacks" onPress={()=>open('backpacks')}><HudIcon kind="backpack"/><strong>背包商店</strong><span>装下更多收获</span></GameButton>
        <GameButton className="shop-category" data-category="rebirth" disabled onPress={()=>{}}><span className="shop-rebirth-icon" aria-hidden="true">↻</span><strong>重生商店</strong><span>未开放</span></GameButton>
      </div>
    </div>
  </section>;
  if(display.mode!=='tools'&&display.mode!=='backpacks')return null;
  const category=display.mode,items=state.shopCatalog[category],item=items[display.index];
  const owned=category==='tools'?item.level<=state.equipment.toolLevel:item.capacity!<=state.equipment.backpackCapacity;
  const equipped=category==='tools'?item.level===state.pickaxe.level:item.capacity===state.inventory.capacity;
  const next=category==='tools'?item.level===state.equipment.toolLevel+1:item.id===state.backpackUpgrade.next?.id;
  const tooSmall=category==='backpacks'&&item.capacity!<state.inventory.used;
  const affordable=state.coins>=item.price;
  const blocked=equipped||tooSmall||(!owned&&(!next||!affordable))||!display.ready||!!display.error;
  const label=equipped?'已装备':owned?(tooSmall?'请先出售矿石':'装备'):!next?'先购买上一件':!affordable?'金币不足':'购买并装备';
  const purchase=()=>{
    const result=session.useShopItem(category,item.id);
    setMessage(result.status==='upgraded'?'购买成功，已装备':result.status==='equipped'?'已装备':result.status==='insufficient'?'金币不足':result.status==='too-small'?'背包放不下当前矿石，请先出售':result.status==='locked'?'请先购买上一件装备':'请重新进入商店');
  };
  return <section className="shop-showroom" role="dialog" aria-modal="true" aria-label={category==='tools'?'工具商店':'背包商店'} data-category={category} data-item={item.id}>
    <header className="shop-item-heading"><h1>{item.name}</h1><p>{item.description}</p></header>
    <nav className="shop-top-actions" aria-label="商店操作"><GameButton className="shop-category-back" onPress={view.categories}>分类</GameButton><GameButton className="shop-switch" aria-label={category==='tools'?'切换到背包商店':'切换到工具商店'} onPress={()=>open(category==='tools'?'backpacks':'tools')}><HudIcon kind={category==='tools'?'backpack':'upgrade'}/><span>{category==='tools'?'背包':'工具'}</span></GameButton><GameButton className="shop-close" aria-label="关闭商店" onPress={onClose}>×</GameButton></nav>
    <GameButton className="shop-arrow shop-prev" aria-label="上一件商品" disabled={display.index===0} onPress={()=>view.select(display.index-1)}>◀</GameButton>
    <GameButton className="shop-arrow shop-next" aria-label="下一件商品" disabled={display.index===items.length-1} onPress={()=>view.select(display.index+1)}>▶</GameButton>
    {!display.ready&&!display.error&&<div className="shop-loading" role="status">正在布置展厅…</div>}
    {display.error&&<div className="shop-loading" role="alert"><p>展厅资源加载失败</p><GameButton onPress={view.retry}>重新加载</GameButton></div>}
    <div className="shop-wallet" aria-label="随身资源"><div><HudIcon kind="backpack"/><strong>{number(state.inventory.used)} / {number(state.inventory.capacity)}</strong></div><div><HudIcon kind="coin"/><strong>{number(state.coins)}</strong></div></div>
    <footer className="shop-item-actions">
      <div className="shop-stats">{category==='tools'?<><span>力量 <b>+{number(item.power!)}</b></span><span>攻速 <b>{item.speed} / 秒</b></span></>:<span>容量 <b>{number(item.capacity!)}</b></span>}</div>
      <GameButton className="shop-buy" data-owned={owned} data-testid="shop-buy" disabled={blocked} onPress={purchase}>{!owned&&<span className="shop-price">◉ {number(item.price)}</span>}<strong>{label}</strong></GameButton>
      <div className="shop-feedback" role="status">{message||`${display.index+1} / ${items.length}${owned?' · 已拥有':''}`}</div>
    </footer>
  </section>;
}
