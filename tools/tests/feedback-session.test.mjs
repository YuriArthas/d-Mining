import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { CAPSULE_MACHINE_ZONE } from '../../src/game/content/feedbackFacilities.ts';
import { createInviteCode } from '../../src/game/logic/InviteCode.ts';
import { pickaxeStats } from '../../src/game/logic/Pickaxe.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
const SESSION_CONTENT = GAME_CONTENT.session;

const at=(s,z)=>s.updatePosition([z.x,z.y,z.z],true);
const meadow=SESSION_CONTENT.eggStations.find(s=>s.eggId==='meadow-egg').zone;
function fixture(roll=0,change=()=>{}){
  const base=GameSession.createNew(SESSION_CONTENT).exportProgress();
  base.wallet.balances.gold=10000;base.rewards.balance=10;change(base);
  let ids=0;
  const s=new GameSession(SESSION_CONTENT,50,undefined,{random:()=>.5,createPetId:()=>`feedback-${++ids}`,rewards:{random:()=>roll}},base);
  return s;
}
test('depth alone unlocks travel and eggs; old depth fills missing unlocks while preserving prior grants',()=>{
  const s=fixture();s.updatePosition([90,-100,90],false);
  assert.equal(s.getSnapshot().destinations[0].unlocked,true);
  assert.equal(s.pets.getSnapshot().eggs.find(e=>e.id==='pebble-egg').unlocked,true);
  const old=s.exportProgress();old.worldExploration[1]={...old.worldExploration[1],maxDepth:200,unlockedDestinationIds:[]};
  const restored=GameSession.fromData(old,SESSION_CONTENT);
  assert.deepEqual(restored.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),['old_mine','fungal']);
  // Saves from before the leaderboard was retired still load, and it is not written back.
  const legacy=GameSession.fromData({...restored.exportProgress(),challengeBoard:{version:1,miners:[{id:'a',name:'铁锹阿林',depth:900}]}},SESSION_CONTENT);
  assert.equal('challengeBoard' in legacy.exportProgress(),false);
  assert.equal('challengeBoard' in legacy.getSnapshot(),false);
});
test('capsule coins use historical stage and one debit survives reload without re-awarding',()=>{
  const s=fixture();s.updatePosition([80,-800,80],false);at(s,CAPSULE_MACHINE_ZONE);
  const before=s.getSnapshot(),result=s.spinCapsule();assert.equal(result.status,'spun');
  const prize=ECONOMY.layers[5].capsuleCoins;assert.equal(result.coinReward,prize);assert.equal(s.getSnapshot().coins,before.coins+prize);
  assert.equal(s.getSnapshot().rewards.balance,9);
  const restored=GameSession.fromData(s.exportProgress(),SESSION_CONTENT);
  assert.equal(restored.getSnapshot().coins,s.getSnapshot().coins);
  assert.equal(restored.getSnapshot().rewards.balance,9);
  assert.equal(restored.getSnapshot().onboarding.soldOnce,false);
});
test('permanent mining applies real speed and overflow power, duplicates only grant coins',()=>{
  const s=fixture(.76);at(s,CAPSULE_MACHINE_ZONE);
  assert.equal(s.getSnapshot().miningStats.speed,2);assert.equal(s.spinCapsule().reward,'mining');
  assert.equal(s.getSnapshot().miningStats.speed,3);
  assert.equal(s.spinCapsule().duplicate,true);assert.equal(s.getSnapshot().miningStats.speed,3);
  const save=s.exportProgress();save.pickaxe.level=16;delete save.equipment; /* Legacy active-gear fixture. */
  const high=GameSession.fromData(save,SESSION_CONTENT).getSnapshot().miningStats;
  assert.equal(high.speed,8);assert.equal(high.power,pickaxeStats(16,1.5).power);assert.ok(high.power>pickaxeStats(16).power);
});
test('lucky displayed probability is used by actual egg draw and expires; remote buying rejects',()=>{
  const s=fixture(0,p=>{p.rewards.timed.luck=1;});
  const rare=()=>s.pets.getSnapshot().eggs.find(e=>e.id==='meadow-egg').outcomes.filter(o=>o.rarity!=='common').reduce((a,o)=>a+o.probability,0);
  assert.ok(Math.abs(rare()-.6)<1e-12);assert.equal(s.pets.hatch('meadow-egg').status,'unavailable');
  at(s,meadow);const pet=s.pets.hatch('meadow-egg');assert.equal(pet.status,'hatched');assert.equal(pet.pet.speciesId,'amber-fox');
  s.advanceOnline(1);assert.ok(Math.abs(rare()-.3)<1e-12);
});
test('automatic hatch pays once per interval, stops away, and does not resume from save',()=>{
  const s=fixture(0,p=>{p.rewards.permanent.autoHatch=true;});
  assert.equal(s.setAutoHatch(true),false);at(s,meadow);assert.equal(s.setAutoHatch(true),true);
  const before=s.getSnapshot().coins;s.advanceOnline(2);
  assert.equal(s.pets.getSnapshot().pets.length,1);assert.equal(s.getSnapshot().coins,before-SESSION_CONTENT.petContent.eggs.find(e=>e.id==='meadow-egg').price);
  at(s,{x:0,y:0,z:40});s.advanceOnline(10);assert.equal(s.pets.getSnapshot().pets.length,1);assert.equal(s.getSnapshot().autoHatch,null);
  at(s,meadow);s.setAutoHatch(true);
  const restored=GameSession.fromData(s.exportProgress(),SESSION_CONTENT);assert.equal(restored.getSnapshot().autoHatch,null);
});
test('teleporting from a mine never bypasses a locked layer; movement reward actually reaches the movement port',()=>{
  const s=fixture(.81,p=>{p.rewards.timed.speed=2;});
  assert.equal(s.getMovementMultiplier(),2);s.advanceOnline(2);assert.equal(s.getMovementMultiplier(),1);
  at(s,CAPSULE_MACHINE_ZONE);assert.equal(s.spinCapsule().reward,'sell');
  s.updatePosition([90,-100,90],false);s.updatePosition([0,-20,0],false);
  const calls=[];s.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining:()=>{},travelTo:p=>calls.push(p)});
  assert.equal(s.travelTo('fungal'),'locked');assert.equal(s.travelTo('old_mine'),'travelling');assert.equal(calls.length,1);
});
test('failed copy awards nothing; successful platform copies share one reward; invite only awards recipient',async()=>{
  const s=fixture(),old=Object.getOwnPropertyDescriptor(globalThis,'navigator');let text='';
  try{
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{throw Error('denied');}}}});
    const before=s.getSnapshot().rewards.balance;assert.equal((await s.shareReward('wechat')).status,'clipboard-failed');assert.equal(s.getSnapshot().rewards.balance,before);
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>{text=value;}}}});
    assert.equal((await s.shareReward('wechat')).status,'claimed');assert.match(text,/MINING:1:/);assert.equal((await s.shareReward('douyin')).status,'already-claimed');
    assert.equal(s.getSnapshot().rewards.balance,before+1);
    assert.equal(s.redeemInvite(s.getSnapshot().rewards.inviteCode).status,'self-invite');
    assert.equal(s.redeemInvite(createInviteCode('other-miner-123')).status,'claimed');assert.equal(s.getSnapshot().rewards.balance,before+3);
    assert.equal(s.redeemInvite(createInviteCode('third-miner-456')).status,'already-claimed');
  }finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
});
test('the double-sale boost doubles the quote and the coins of a sale while it runs, and only then',()=>{
  const sell=SESSION_CONTENT.sales[0];
  const sale=boost=>{
    const s=fixture(0,p=>{p.wallet.balances.gold=0;p.rewards.timed.sell=boost;});
    s.collected(Array.from({length:4},()=>({kind:64})));
    const quoted=s.getSnapshot().sale;at(s,sell);
    return {quoted:quoted.coins,coins:s.getSnapshot().coins};
  };
  const plain=sale(0),doubled=sale(60);
  assert.ok(plain.coins>0);assert.equal(plain.quoted,plain.coins);
  assert.equal(doubled.quoted,plain.quoted*2);assert.equal(doubled.coins,plain.coins*2);
});
