import test from 'node:test';
import assert from 'node:assert/strict';
import { depthRoutePosition } from '../../src/game/ui/hud/depthRoute.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { shopTools } from '../../src/game/content/shopCatalog.ts';
import { resolveText } from '../../src/game/i18n/i18n.ts';
import { resourceByKind } from '../../src/game/content/resources.ts';
test('depth route interpolates current metres, clamps its ends and keeps discovered nodes when returning',()=>{
 const nodes=[60,140,260,420,620,860].map(depth=>({depth}));
 assert.equal(depthRoutePosition(0,nodes),0);assert.ok(Math.abs(depthRoutePosition(60,nodes)-100/6)<1e-9);
 assert.ok(Math.abs(depthRoutePosition(100,nodes)-25)<1e-9);assert.equal(depthRoutePosition(999,nodes),100);
 const s=new GameSession(GAME_CONTENT.session),room=GAME_CONTENT.session.destinations[0];
 s.devUnlockLayer(room.id);const before=s.getSnapshot().destinations;
 s.updatePosition([0,.1,0],true);assert.equal(s.getSnapshot().depth,0);
 assert.deepEqual(s.getSnapshot().destinations.map(d=>d.unlocked),before.map(d=>d.unlocked));
});
test('locked mining target carries the actual required shop tool name',()=>{
 const s=new GameSession(GAME_CONTENT.session),kind=74,ore=resourceByKind(kind);
 s.attach({cell:()=>kind,pending:()=>false,mine:()=>true,cancelMining(){}});
 s.selectTarget([0,-1,0]);const target=s.getSnapshot().target;
 assert.equal(target.locked,true);assert.equal(target.requiredToolName,resolveText(shopTools()[ore.requiredLevel-1].name));assert.ok(target.requiredToolName.length>0);
});
