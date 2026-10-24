import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_CONTENT} from '../../src/game/content/gameContent.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';

const room=GAME_CONTENT.rooms.find(r=>r.id==='old_mine');
test('a new save starts with every layer locked; reaching a layer\'s depth admits travel to it',()=>{
 const session=new GameSession(GAME_CONTENT.session),moves=[];
 assert.deepEqual(session.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),[]);
 assert.equal(session.getSnapshot().depth,0);
 session.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining(){},travelTo:p=>moves.push(p)});
 assert.equal(session.travelTo('old_mine'),'locked');
 session.updatePosition([room.x,-room.depth+.027,room.z],true);
 assert.deepEqual(session.getSnapshot().destinations.filter(d=>d.unlocked).map(d=>d.id),['old_mine']);
 assert.equal(session.travelTo('old_mine'),'travelling');assert.deepEqual(moves,[room.spawn]);
});
