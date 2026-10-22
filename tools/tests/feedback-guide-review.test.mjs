import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { SESSION_CONTENT } from '../../src/game/world/sessionContent.ts';

function sessionWith(change=()=>{}) {
  const data=GameSession.createNew(SESSION_CONTENT).exportProgress();
  data.wallet.coins=1000;data.pickaxe.level=2;data.inventory.capacity=100;data.exploration.maxDepth=20;
  data.onboarding={...data.onboarding,minedOnce:true,soldOnce:true,minedCount:3};
  change(data);
  delete data.equipment; // Legacy fixture sets the active gear directly.
  let serial=0;
  return new GameSession(SESSION_CONTENT,50,undefined,{random:()=>0,createPetId:()=>`guide-review-${++serial}`},data);
}
function atEgg(session,id='meadow-egg') {
  const z=SESSION_CONTENT.eggStations.find(s=>s.eggId===id).zone;
  session.updatePosition([z.x,z.y,z.z],true);
}

test('manual egg route overrides and cancels without advancing or skipping the pending long-task lesson',()=>{
  const session=sessionWith();session.updatePosition([0,0,46],true);
  const progress=session.exportProgress(),commits=[];
  session.onProgressCommitted(change=>commits.push(change));
  assert.equal(session.getSnapshot().guide.id,'long-task');
  assert.equal(session.guideToEgg('meadow-egg'),true);
  assert.equal(session.getSnapshot().guide.id,'egg');
  assert.equal(session.getSnapshot().guide.marker,'egg');
  assert.equal(session.getSnapshot().requestedEgg,'meadow-egg');
  const route=session.getSnapshot().guideDestination;
  assert.equal(session.guideToEgg('pebble-egg'),false);
  assert.equal(session.guideToEgg('missing-egg'),false);
  assert.deepEqual(session.getSnapshot().guideDestination,route);
  session.acknowledgeLongMiningTask();
  assert.equal(session.getSnapshot().onboarding.longTaskIntroduced,false);
  session.cancelEggGuide();
  assert.equal(session.getSnapshot().requestedEgg,null);
  assert.equal(session.getSnapshot().guide.id,'long-task');
  assert.equal(commits.length,0);assert.deepEqual(session.exportProgress(),progress);
  session.acknowledgeLongMiningTask();
  assert.equal(session.getSnapshot().onboarding.longTaskIntroduced,true);
  assert.equal(session.getSnapshot().onboarding.minedCount,3);
  assert.equal(session.getSnapshot().guide.id,'egg');
});

test('manual egg route stays coherent across underground return and hatch resumes the pending pet lesson',()=>{
  const session=sessionWith(data=>{data.onboarding.longTaskIntroduced=true;});
  session.updatePosition([0,-20,0],false);
  assert.equal(session.guideToEgg('meadow-egg'),true);
  assert.equal(session.getSnapshot().guide.highlight,'return');
  assert.equal(session.getSnapshot().guideAnchor,null);
  assert.equal(session.getSnapshot().guideDestination,null);
  session.resetPosition();atEgg(session);
  assert.equal(session.getSnapshot().requestedEgg,'meadow-egg');
  assert.equal(session.getSnapshot().guide.marker,'egg');
  const acquired=session.pets.hatch('meadow-egg');assert.equal(acquired.status,'hatched');
  assert.equal(session.getSnapshot().requestedEgg,null);
  assert.equal(session.getSnapshot().guide.id,'equip');
  session.pets.equip(acquired.pet.id);
  assert.equal(session.getSnapshot().onboarding.status,'completed');
  assert.equal(session.getSnapshot().onboarding.minedCount,3);
});

test('completed and skipped tutorials remain unchanged by explicit egg routing, cancellation and reload',()=>{
  for(const status of ['completed','skipped']) {
    const session=sessionWith(data=>{data.onboarding.status=status;});
    session.updatePosition([0,0,46],true);
    const before=session.exportProgress();
    assert.equal(session.guideToEgg('meadow-egg'),true);
    assert.equal(session.getSnapshot().onboarding.status,status);
    session.cancelEggGuide();
    assert.equal(session.getSnapshot().guide,null);
    assert.deepEqual(session.exportProgress(),before);
    session.guideToEgg('meadow-egg');
    const restored=GameSession.fromData(session.exportProgress(),SESSION_CONTENT);
    assert.equal(restored.getSnapshot().requestedEgg,null);
    assert.equal(restored.getSnapshot().onboarding.status,status);
    restored.setSuspended(true);
    assert.equal(restored.guideToEgg('meadow-egg'),false);
    assert.equal(restored.getSnapshot().requestedEgg,null);
  }
});
