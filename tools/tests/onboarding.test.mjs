import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { SESSION_CONTENT } from '../../src/game/world/sessionContent.ts';
import { selectGuide, selectDepthGoal } from '../../src/game/application/OnboardingGuide.ts';
import { Onboarding } from '../../src/game/logic/Onboarding.ts';
const evidence={coins:0,level:1,capacity:50,items:0,pets:0,equipped:false,maxDepth:0};
const learned={version:1,status:'active',minedOnce:true,soldOnce:true,equippedOnce:false,longTaskIntroduced:false,minedCount:0};
const loopDone={level:2,capacity:100,maxDepth:20};
const petLesson={...loopDone,learning:{...learned,longTaskIntroduced:true}};
const guide=(extra={})=>selectGuide({learning:learned,location:'surface',nearMine:false,hasTarget:false,inSellZone:false,full:false,items:0,coins:0,level:1,pets:0,capacity:50,maxDepth:0,backpackPrice:100,upgradePrice:100,eggPrice:80,...extra});
test('tutorial completes the main loop before pets and never treats uncashed ore as coins',()=>{
 assert.equal(guide({coins:80}).id,'earn');assert.equal(guide({coins:100}).id,'upgrade');
 assert.equal(guide({coins:79,items:2}).id,'sell');assert.match(guide({coins:79}).detail,/再赚 21 金币/);
 assert.equal(guide({coins:0,pets:1}).id,'earn');
 assert.equal(guide({coins:100,items:2}).id,'upgrade');
 assert.equal(guide({full:true,items:50,location:'mine'}).id,'return');
 assert.equal(guide({full:true,items:50,location:'room'}).id,'sell');
 assert.equal(guide({learning:{...learned,equippedOnce:true},coins:80}).id,'earn');
 assert.equal(guide({...petLesson,coins:80}).id,'egg');
 assert.equal(guide({...petLesson,coins:0,pets:1}).id,'equip');
});
test('location uses current room/surface, underground guides never have surface anchors',()=>{
 assert.equal(guide({...petLesson,coins:80,location:'mine'}).marker,undefined);
 assert.equal(guide({full:true,items:50,location:'room'}).marker,'sell');
 assert.equal(guide({location:null}),null);
 assert.equal(guide({learning:{...learned,minedOnce:false,soldOnce:false},nearMine:true}).id,'mine');
 assert.equal(guide({learning:{...learned,minedOnce:false,soldOnce:false},hasTarget:true}).id,'dig');
 const s=new GameSession(SESSION_CONTENT);s.updatePosition(SESSION_CONTENT.destinations[0].spawn,true);
 assert.equal(s.getSnapshot().guideAnchor,null);
 s.updatePosition([0,0,46],true);assert.equal(s.getSnapshot().guide.marker,'mine');
});
test('only receipt and successful sale record progress before save capture',()=>{
 const s=new GameSession(SESSION_CONTENT);s.attach({cell:()=>8,pending:()=>false,mine:()=>true,cancelMining(){},returnToSurface(){}});
 s.updatePosition([0,0,46],true);s.hit([0,-5,0]);assert.equal(s.exportProgress().onboarding.minedOnce,false);
 const captures=[],urgencies=[];s.onProgressCommitted(({urgent})=>{captures.push(s.exportProgress());urgencies.push(urgent);});
 s.collected([{kind:8}]);assert.equal(urgencies.at(-1),true);assert.equal(captures.at(-1).onboarding.minedOnce,true);
 assert.equal(captures.at(-1).onboarding.minedCount,1);
 const sale=SESSION_CONTENT.sales[0];s.updatePosition([sale.x,sale.y,sale.z],true);
 assert.equal(captures.at(-1).wallet.coins,1);assert.equal(captures.at(-1).onboarding.soldOnce,true);
 assert.equal(captures.at(-1).inventory.items['ore.dirt'],undefined);
 const restored=GameSession.fromData(s.exportProgress(),SESSION_CONTENT);assert.deepEqual(restored.exportProgress(),s.exportProgress());
});
test('empty sale, failed queue and locked mineral do not complete learning',()=>{
 const s=new GameSession(SESSION_CONTENT),sale=SESSION_CONTENT.sales[0];s.updatePosition([sale.x,sale.y,sale.z],true);assert.equal(s.exportProgress().onboarding.soldOnce,false);
 s.updatePosition([0,0,0],true);s.attach({cell:()=>17,pending:()=>false,mine:()=>false,cancelMining(){},returnToSurface(){}});
 assert.equal(s.hit([0,-201,0]).status,'locked');assert.equal(s.exportProgress().onboarding.minedOnce,false);
 s.attach({cell:()=>8,pending:()=>false,mine:()=>false,cancelMining(){},returnToSurface(){}});
 assert.equal(s.hit([0,-5,0]).status,'unavailable');assert.equal(s.exportProgress().onboarding.minedOnce,false);
});
test('legacy saves remain quiet, explicit skip survives reload; malformed records fail',()=>{
 const old=new GameSession(SESSION_CONTENT).exportProgress();delete old.onboarding;
 let s=GameSession.fromData(old,SESSION_CONTENT);assert.equal(s.getSnapshot().onboarding.status,'legacy');
 s.resumeOnboarding();assert.equal(s.getSnapshot().onboarding.status,'active');s.skipOnboarding();
 s=GameSession.fromData(s.exportProgress(),SESSION_CONTENT);assert.equal(s.getSnapshot().onboarding.status,'skipped');
 s.resumeOnboarding();assert.equal(s.getSnapshot().onboarding.status,'active');
 for(const bad of [null,{}, {version:2}, {...learned,minedOnce:'yes'}])assert.throws(()=>GameSession.fromData({...old,onboarding:bad},SESSION_CONTENT));
 old.wallet.coins=10;s=GameSession.fromData(old,SESSION_CONTENT);assert.equal(s.getSnapshot().onboarding.status,'legacy');assert.equal(s.getSnapshot().onboarding.soldOnce,false);
});
test('equip is learned at settlement; completion wins over full bag and never replays on restore',()=>{
 const data=new GameSession(SESSION_CONTENT).exportProgress();delete data.equipment; /* Legacy fixture supplies active gear directly. */data.wallet.coins=80;data.onboarding={...learned,longTaskIntroduced:true};data.inventory.capacity=100;data.exploration.maxDepth=20;
 const s=new GameSession(SESSION_CONTENT,50,()=>0,{random:()=>0,createPetId:()=> 'first'},data);
 const station=SESSION_CONTENT.eggStations.find(station=>station.eggId==='meadow-egg');
 s.updatePosition([station.zone.x,station.zone.y,station.zone.z],true);
 const captures=[];s.onProgressCommitted(()=>captures.push(s.exportProgress()));
 const hatch=s.pets.hatch('meadow-egg');assert.equal(hatch.status,'hatched');assert.equal(s.getSnapshot().onboarding.equippedOnce,false);
 s.pets.equipBest();assert.equal(captures.at(-1).onboarding.equippedOnce,true);
 s.pets.unequipAll();assert.equal(s.getSnapshot().onboarding.equippedOnce,true);
 const upgraded=s.exportProgress();upgraded.wallet.coins=100;
 const ready=GameSession.fromData(upgraded,SESSION_CONTENT);ready.updatePosition([0,0,46],true);ready.upgradePickaxe(1);
 assert.equal(ready.getSnapshot().onboarding.status,'completed');assert.equal(ready.getSnapshot().guide,null);assert.equal(ready.getSnapshot().guideCompletionPending,true);
 const restored=GameSession.fromData(ready.exportProgress(),SESSION_CONTENT);assert.equal(restored.getSnapshot().guideCompletionPending,false);
 restored.resumeOnboarding();assert.equal(restored.getSnapshot().guideCompletionPending,false);
});
test('history stays learned after spending all money and removing pets; skipped does not celebrate',()=>{
 const history=new Onboarding({...learned,equippedOnce:true,longTaskIntroduced:true,status:'skipped'},true,evidence);
 history.settle({...evidence,...loopDone});assert.equal(history.getSnapshot().status,'skipped');
 history.resume({...evidence,...loopDone});assert.equal(history.getSnapshot().status,'completed');assert.equal(history.getSnapshot().soldOnce,true);
});

test('navigation points at interaction zones and the current room sale, never another floor',()=>{
 const data=new GameSession(SESSION_CONTENT).exportProgress();delete data.equipment; /* Legacy fixture supplies active gear directly. */data.onboarding={...learned,longTaskIntroduced:true};data.wallet.coins=80;data.pickaxe.level=2;data.inventory.capacity=100;data.exploration.maxDepth=20;
 const eggSession=GameSession.fromData(data,SESSION_CONTENT);eggSession.updatePosition([0,0,46],true);
 const station=SESSION_CONTENT.eggStations.find(s=>s.eggId==='meadow-egg');
 assert.deepEqual(eggSession.getSnapshot().guideDestination,[station.zone.x,station.zone.y,station.zone.z]);
 data.inventory.items={'ore.soil':100};
 const s=GameSession.fromData(data,SESSION_CONTENT);
 for(const room of SESSION_CONTENT.destinations){
  s.updatePosition(room.spawn,true);
  const anchor=s.getSnapshot().guideAnchor,b=room.roomBounds;
  assert.ok(anchor,'room sale has a navigation anchor');
  assert.ok(anchor[0]>=b.minX&&anchor[0]<b.maxX&&anchor[2]>=b.minZ&&anchor[2]<b.maxZ);
  assert.ok(anchor[1]>=b.floor&&anchor[1]<b.ceiling);
 }
 s.updatePosition([0,-20,0],true);assert.equal(s.getSnapshot().guideAnchor,null);
 s.skipOnboarding();assert.equal(s.getSnapshot().guideDestination,null);
});

test('arriving at the mine teaches left mouse before the pointer has selected a block',()=>{
 const learning={...learned,minedOnce:false,soldOnce:false};
 assert.equal(guide({learning,atMine:true,hasTarget:false}).id,'dig');
 assert.equal(guide({learning,atMine:true,hasTarget:true}).id,'dig');
 assert.equal(guide({learning,atMine:false,hasTarget:false}).id,'mine');
 const s=new GameSession(SESSION_CONTENT);
 s.updatePosition([0,0,46],true);assert.equal(s.getSnapshot().guide.id,'mine');
 s.updatePosition([0,0,11],true);assert.equal(s.getSnapshot().guide.id,'dig');assert.equal(s.getSnapshot().guideDestination,null);
 assert.equal(s.getSnapshot().onboarding.minedOnce,false);
 s.selectTarget(null);assert.equal(s.getSnapshot().guide.id,'dig');
});

test('main loop orders first upgrade, deeper mining, backpack and task introduction',()=>{
 assert.equal(guide({coins:100,pets:1}).id,'upgrade');
 assert.equal(guide({level:2,coins:100}).id,'deepen');
 assert.equal(guide({level:2,maxDepth:19.99,coins:100}).id,'deepen');
 assert.equal(guide({level:2,maxDepth:20,coins:99}).id,'earn');
 assert.equal(guide({level:2,maxDepth:20,coins:100}).id,'backpack');
 assert.equal(guide({...loopDone}).id,'long-task');
 assert.equal(guide({...loopDone,pets:1}).id,'long-task');
 assert.equal(guide({...petLesson,pets:1}).id,'equip');
 // Early depth and backpack completion require no repeated upgrade or trip.
 assert.equal(guide({...loopDone,maxDepth:900,capacity:600,pets:1}).id,'long-task');
 assert.equal(guide({...loopDone,maxDepth:900,capacity:600,location:'surface'}).marker,undefined);
});

test('long task acknowledgment advances without requiring 100 blocks and cannot bypass the loop',()=>{
 const learning=new Onboarding(undefined,false,evidence);
 assert.equal(learning.introduceLongTask({...evidence,...loopDone}),false);
 learning.recordCollected(1);learning.record('soldOnce');
 for(const partial of [{level:1},{maxDepth:19},{capacity:50}]){
  assert.equal(learning.introduceLongTask({...evidence,...loopDone,...partial}),false);
 }
 assert.equal(learning.introduceLongTask({...evidence,...loopDone}),true);
 assert.equal(learning.introduceLongTask({...evidence,...loopDone}),false);
 assert.equal(learning.getSnapshot().minedCount,1);
 assert.equal(guide({...loopDone,learning:learning.getSnapshot(),coins:80}).id,'egg');
 assert.equal(learning.settle({...evidence,...loopDone}),false);
 learning.record('equippedOnce');assert.equal(learning.settle({...evidence,...loopDone}),true);
 assert.equal(learning.getSnapshot().status,'completed');
});

test('acknowledgment persists and precompleted pet equipment finishes only after introducing the task',()=>{
 const data=new GameSession(SESSION_CONTENT).exportProgress();delete data.equipment; /* Legacy fixture supplies active gear directly. */
 data.onboarding={...learned,equippedOnce:true};data.pickaxe.level=2;data.inventory.capacity=100;data.exploration.maxDepth=20;
 const session=GameSession.fromData(data,SESSION_CONTENT);session.updatePosition([0,0,46],true);
 assert.equal(session.getSnapshot().guide.id,'long-task');
 const captures=[];session.onProgressCommitted(()=>captures.push(session.exportProgress()));
 session.acknowledgeLongMiningTask();
 assert.equal(captures.at(-1).onboarding.longTaskIntroduced,true);
 assert.equal(captures.at(-1).onboarding.status,'completed');
 assert.equal(captures.at(-1).onboarding.minedCount,0);
 assert.equal(session.getSnapshot().guideCompletionPending,true);
 session.acknowledgeLongMiningTask();assert.equal(captures.length,1);
 const restored=GameSession.fromData(session.exportProgress(),SESSION_CONTENT);
 assert.equal(restored.getSnapshot().guideCompletionPending,false);
});

test('legacy facts are not inferred from reward money, purchased upgrades or pets',()=>{
 const rich={...evidence,...loopDone,coins:9999,pets:3};
 const history=new Onboarding(undefined,true,rich);
 assert.equal(history.getSnapshot().status,'legacy');
 assert.equal(history.getSnapshot().soldOnce,false);
 assert.equal(history.getSnapshot().minedOnce,false);
 history.resume({...rich,equipped:true,items:7});
 assert.equal(history.getSnapshot().soldOnce,false);
 assert.equal(history.getSnapshot().minedOnce,true);
 assert.equal(history.getSnapshot().equippedOnce,true);
 assert.equal(history.getSnapshot().minedCount,0);
});

test('older tutorial saves normalize new fields without fabricating counts or replaying completion',()=>{
 const old={version:1,status:'completed',minedOnce:true,soldOnce:true,equippedOnce:true};
 const history=new Onboarding(old,true,{...evidence,items:50});
 assert.deepEqual(history.getSnapshot(),{...old,longTaskIntroduced:false,minedCount:0});
 assert.equal(history.resume(evidence),false);assert.equal(history.settle(evidence),false);
 history.recordCollected(3);assert.equal(history.getSnapshot().minedCount,3);
 const restored=new Onboarding(history.getSnapshot(),true,evidence);
 assert.equal(restored.getSnapshot().minedCount,3);assert.equal(restored.getSnapshot().status,'completed');
 for(const extra of [{minedCount:-1},{minedCount:1.2},{minedCount:'5'},{minedCount:null},{minedCount:Infinity},{longTaskIntroduced:null},{longTaskIntroduced:1}]){
  assert.throws(()=>new Onboarding({...old,...extra},true,evidence),/存档数据错误/);
 }
});

test('verified collection counts persist after skipping and reject invalid increments',()=>{
 const history=new Onboarding(undefined,false,evidence);
 const initial=history.getSnapshot();assert.equal(history.recordCollected(0),false);assert.equal(history.getSnapshot(),initial);
 history.recordCollected(3);history.skip();history.recordCollected(4);
 assert.equal(history.getSnapshot().minedCount,7);assert.equal(history.getSnapshot().status,'skipped');
 const restored=new Onboarding(history.getSnapshot(),true,evidence);
 assert.equal(restored.getSnapshot().minedCount,7);restored.resume(evidence);
 assert.equal(restored.getSnapshot().minedOnce,true);assert.equal(restored.getSnapshot().soldOnce,false);
 for(const count of [-1,1.5,Infinity,NaN,'2'])assert.throws(()=>restored.recordCollected(count),/数量错误/);
 const maximum=new Onboarding({...learned,minedCount:Number.MAX_SAFE_INTEGER},true,evidence);
 assert.throws(()=>maximum.recordCollected(1),/数量错误/);
});

test('first collection immediately offers return and sale, including room-specific guidance',()=>{
 const learning={...learned,soldOnce:false};
 assert.equal(guide({learning,items:1,location:'mine'}).id,'return');
 assert.equal(guide({learning,items:1,location:'surface'}).marker,'sell');
 assert.equal(guide({learning,items:1,location:'room'}).marker,'sell');
 assert.equal(guide({learning,items:1,location:'room',inSellZone:true}).marker,undefined);
 assert.equal(guide({learning,items:0,location:'surface'}).id,'mine');
});

test('next-depth goal uses historical progress and skips already unlocked legacy layers',()=>{
 const destinations=[
  {id:'deep',name:'深层',depth:800,unlocked:false},
  {id:'early',name:'浅层',depth:100,unlocked:false},
  {id:'legacy',name:'旧档已开层',depth:400,unlocked:true},
 ];
 assert.deepEqual(selectDepthGoal(20,destinations),{id:'early',name:'浅层',depth:100,currentDepth:20,remainingDepth:80});
 assert.equal(selectDepthGoal(100,destinations.map(d=>d.id==='early'?{...d,unlocked:true}:d)).id,'deep');
 assert.equal(selectDepthGoal(800,destinations.map(d=>({...d,unlocked:true}))),null);
 assert.equal(selectDepthGoal(0,[]),null);
 assert.equal(destinations[0].id,'deep');
});

test('ground contact crossing the 20m milestone publishes the new guide even within the same depth metre',()=>{
 const data=new GameSession(SESSION_CONTENT).exportProgress();delete data.equipment; /* Legacy fixture supplies active gear directly. */
 data.onboarding={...learned};data.pickaxe.level=2;data.wallet.coins=100;
 const session=GameSession.fromData(data,SESSION_CONTENT);
 session.updatePosition([0,-19.99,0],false);assert.equal(session.getSnapshot().guide.id,'deepen');
 session.updatePosition([0,-19.99,0],true);
 assert.ok(session.getSnapshot().maxDepth>=20);
 assert.equal(session.getSnapshot().maxDepth,session.exportProgress().exploration.maxDepth);
 assert.equal(session.getSnapshot().guide.id,'return'); // The learned backpack step now directs the player out of the mine to a shop.
});
