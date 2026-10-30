import test from 'node:test';
import assert from 'node:assert/strict';
import {roomPlan} from '../../src/game/world/scenery.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import {HALL_BY_LAYER,undergroundHall} from '../../src/game/content/underground/halls.ts';

const HALLS={old_mine:'old-mine-hall',fungal:'fungal-hall',crystal:'crystal-hall',ruins:'ruins-hall',frozen:'frozen-hall',volcanic:'volcanic-hall'};
const LATER={'world2.1':'automine-hall','world2.2':'gear-hall','world2.3':'refinery-hall','world2.4':'survey-hall','world2.5':'cryo-hall','world2.6':'reactor-hall'};
const allRooms=GAME_CONTENT.worlds.flatMap(w=>w.rooms);

test('every world 1 rest layer is an authored hall',()=>{
 assert.deepEqual(GAME_CONTENT.rooms.map(r=>r.sceneDefinition.hall),Object.values(HALLS));
 assert.deepEqual(HALL_BY_LAYER,{...HALLS,...LATER});
});

for(const [layer,id] of Object.entries({...HALLS,...LATER}).filter(([layer])=>layer!=='world2.1'))test(`${id}: no kit; its colliders keep the shaft open and the service rings free; rings, board and lights fit the hall`,()=>{
 const room=allRooms.find(r=>r.id===layer),plan=roomPlan(room),{hall,solids}=undergroundHall(id);
 assert.equal(plan.authored,undefined,'no kit');
 assert.equal(hall.id,layer);
 assert.deepEqual(room.spawn,[room.x,-room.depth+.1,room.z+12]);
 assert.equal(plan.signs[0].subtitle,`${String(room.number).padStart(2,'0')} / ${room.depth} 米`);
 assert.ok(Math.abs(plan.signs[0].at[2]-room.z-hall.board[2])<.5,'the name floats in front of the board');
 assert.equal(!!room.shop,!!hall.stalls.shop,'a stall for each service');
 assert.equal(plan.shapes.length,room.shop?2:1);
 assert.deepEqual([room.sell.x-room.x,room.sell.z-room.z].map(v=>+v.toFixed(6)),[hall.stalls.sell.ring[0],hall.stalls.sell.ring[2]]);
 if(room.shop)assert.deepEqual([room.shop.x-room.x,room.shop.z-room.z].map(v=>+v.toFixed(6)),[hall.stalls.shop.ring[0],hall.stalls.shop.ring[2]]);
 assert.ok(solids.length>40);
 // Nothing solid stands in the 16 m pit, except the floor ring's stones which stop at its edge.
 for(const s of plan.solids){const x=s.at[0]-room.x,z=s.at[2]-room.z;assert.ok(x+s.half[0]<=-8+1e-6||x-s.half[0]>=8-1e-6||z+s.half[2]<=-8+1e-6||z-s.half[2]>=8-1e-6,`solid in the pit at ${s.at}`);}
 // The rings and the spawn stand clear of every collider taller than the floor.
 for(const p of [room.sell,room.shop,{x:room.spawn[0],z:room.spawn[2]}].filter(Boolean))for(const s of plan.solids.filter(s=>s.half[1]>.1&&!s.hull))
  assert.ok(Math.abs(p.x-s.at[0])>s.half[0]+.3||Math.abs(p.z-s.at[2])>s.half[2]+.3,`${p.x},${p.z} blocked by ${s.at}`);
 for(const l of hall.lights)assert.ok(Math.abs(l.at[0])<20&&Math.abs(l.at[2])<20&&l.at[1]>0&&l.at[1]<20);
 assert.ok(hall.lights.length<=6,'fits the fixed light pool');
 const instance=GAME_CONTENT.surface.authored.instances.find(i=>i.asset===id);
 assert.deepEqual(instance.at,[room.x,-room.depth,room.z]);
 const session=new GameSession(GAME_CONTENT.session);
 session.attach({cell:()=>64,pending:()=>false,mine:()=>true,cancelMining(){},travelTo(){}});
 // A later world's hall is only reachable once that world is open.
 session.worldProgress.openThrough(room.worldId);
 session.updatePosition([room.sell.x,room.sell.y,room.sell.z],true);assert.equal(session.getSnapshot().inSellZone,true);
 if(room.shop){session.updatePosition([room.shop.x,room.shop.y,room.shop.z],true);assert.equal(session.getSnapshot().shopId,layer);}
});

test('world 2: its first layer is the automine hall, lit and placed under the tech base; the base carries its own colliders, rings and signs',async()=>{
 const room=GAME_CONTENT.worlds[1].rooms[0],{hall}=undergroundHall('automine-hall');
 assert.equal(room.id,'world2.1');assert.equal(room.sceneDefinition.hall,'automine-hall');assert.equal(room.name,'自动化矿道');
 assert.equal(room.shop,null);assert.ok(hall.lights.length<=6);
 assert.deepEqual(GAME_CONTENT.surface.authored.instances.find(i=>i.asset==='automine-hall').at,[room.x,-room.depth,room.z]);
 assert.deepEqual(GAME_CONTENT.surface.authored.instances.find(i=>i.asset==='tech-base').at,[0,0,224]);
 const {baseSurfacePlan}=await import('../../src/game/content/baseSurfaces.ts');
 const plan=baseSurfacePlan(2);
 assert.deepEqual(plan.signs.map(s=>s.title),['世界传送门','SELL','UPGRADE','传送站','第二世界']);
 // The service rings are the session's zones, clear of every collider; nothing solid in the shaft.
 for(const [i,zone] of [GAME_CONTENT.session.sales.find(z=>z.z>200),GAME_CONTENT.session.shops.find(s=>s.id==='world2.shop').zone].entries()){
  assert.deepEqual([plan.shapes[i*2].at[0],plan.shapes[i*2].at[2]],[zone.x,zone.z]);
  for(const s of plan.solids)assert.ok(Math.abs(zone.x-s.at[0])>s.half[0]+.3||Math.abs(zone.z-s.at[2])>s.half[2]+.3,`ring blocked by ${s.at}`);
 }
 for(const s of plan.solids)assert.ok(Math.abs(s.at[0])-s.half[0]>=8-1e-6||Math.abs(s.at[2]-224)-s.half[2]>=8-1e-6,`solid in the shaft at ${s.at}`);
});
