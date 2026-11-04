import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { worldPortal, worldSpawn } from '../../src/game/content/worldJourney.ts';
import { quoteCurrencySale, sellCurrencyItems } from '../../src/game/application/Sale.ts';
import { itemCurrency, itemPrice, itemVolume } from '../../src/game/application/items.ts';
import { Inventory } from '../../src/game/logic/Inventory.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
const content = GAME_CONTENT.session;
const originItems = { 'journey.obsidian': 1, 'journey.tin': 2, 'journey.stardust': 3 };
function fixture(items = originItems) {
  const data = new GameSession(content).exportProgress();
  data.wallet.balances = { gold: 0, tech: 0, star: 0 };
  data.worldProgress = { version: 2, openWorlds: [1,2,3] };
  data.inventory.items = { ...items };
  data.onboarding = {...data.onboarding,status:'skipped'};
  const s = GameSession.fromData(data, content), trips = [];
  s.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining(){},travelTo:p=>trips.push(p)});
  return {s, arrive:()=>s.updatePosition(trips.at(-1),true)};
}
function travel(s, arrive, world) {
  const z = worldPortal(s.getSnapshot().currentWorld).zone;
  s.updatePosition([z.x,z.y,z.z],true);
  assert.equal(s.travelWorld(world),'travelling');arrive();
}
function sell(s, arrive) { assert.equal(s.goTo('sale'),'travelling');arrive(); }
test('one W1 obsidian carried through the portal and sold in W2 pays 17000 gold, no tech; reload never repeats it',()=>{
  const {s,arrive}=fixture({'journey.obsidian':1});
  travel(s,arrive,2);
  assert.deepEqual(s.getSnapshot().sale.payouts,[{currency:'gold',coins:17000}]);
  sell(s,arrive);
  assert.deepEqual(s.getSnapshot().balances,{gold:17000,tech:0,star:0});
  assert.equal(s.getSnapshot().inventory.totalCount,0);
  assert.equal(s.sellAvailable().status,'empty');
  const restored=GameSession.fromData(s.exportProgress(),content);
  restored.updatePosition(worldSpawn(2),true);
  assert.deepEqual(restored.getSnapshot().balances,{gold:17000,tech:0,star:0});
});
test('mixed bag pays all origin currencies in any world; quote, receipt and save agree, locks stay',()=>{
  for(const world of [1,2,3]) {
    const {s,arrive}=fixture({...originItems,'journey.rock.0':2});
    s.lockItem('journey.rock.0');
    if(world!==1)travel(s,arrive,world);
    const quote=s.getSnapshot().sale,events=[];let commits=0;
    s.onFeedback(e=>{if(e.type==='sold')events.push(e)});s.onProgressCommitted(()=>commits++);
    sell(s,arrive);
    assert.deepEqual(s.getSnapshot().balances,{gold:17000,tech:6,star:9});
    assert.deepEqual(s.getSnapshot().inventory.items,{'journey.rock.0':2});
    assert.deepEqual(events,[{type:'sold',count:6,payouts:quote.payouts}]);
    assert.ok(s.getSnapshot().notice.includes('17000'));
    assert.equal(commits,1);
    assert.deepEqual(GameSession.fromData(s.exportProgress(),content).getSnapshot().balances,s.getSnapshot().balances);
  }
});
test('origin currency selects pet bonus, then rebirth and double-sale boost, regardless of location',()=>{
  const {s:initial}=fixture();const data=initial.exportProgress();
  data.pets.inventory.pets=[{id:'g',speciesId:'moss-slime',level:1}];data.pets.equipment.slots=['g',null,null];
  data.rebirth={version:2,count:1};data.rewards.timed.sell=60;
  const s=GameSession.fromData(data,content),bonus=s.pets.getSnapshot().bonus;
  for(const world of [1,2,3]) {
    s.updatePosition(worldSpawn(world),true);
    assert.deepEqual(s.getSnapshot().sale.payouts,[
      {currency:'gold',coins:Math.round(17000*(1+bonus.gold/100)*1.5*2)},
      {currency:'tech',coins:18},{currency:'star',coins:27}]);
  }
});
test('overflow in any one wallet or quote leaves every currency and item untouched',()=>{
  for(const currency of ['gold','tech','star']) {
    const bag=new Inventory(25,itemVolume);bag.add(Object.entries(originItems).map(([itemId,count])=>({itemId,count})));
    const wallet=new Wallet({[currency]:Number.MAX_SAFE_INTEGER}),before=bag.getSnapshot(),money=wallet.getBalances();
    assert.equal(sellCurrencyItems(bag,wallet,itemPrice,itemCurrency,bag.sellable(),()=>1).status,'overflow');
    assert.equal(bag.getSnapshot(),before);assert.deepEqual(wallet.getBalances(),money);
    assert.equal(sellCurrencyItems(bag,wallet,itemPrice,itemCurrency,bag.sellable(),()=>Number.MAX_VALUE).status,'overflow');
    assert.equal(bag.getSnapshot(),before);assert.deepEqual(wallet.getBalances(),money);
  }
});
test('round once per currency, not per block or across incompatible currencies',()=>{
  const quote=quoteCurrencySale({'journey.rock.0':1,'journey.rock.1':1,'journey.rock.7':1},itemPrice,itemCurrency,()=>1.5);
  assert.deepEqual(quote,{status:'quoted',count:3,payouts:[{currency:'gold',coins:3},{currency:'tech',coins:2}]});
});
