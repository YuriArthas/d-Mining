import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture} from 'three';
import {GAME_CONTENT} from '../../src/game/content/gameContent.ts';
import {PINEWIND_PLAZA,PINEWIND_SERVICES,PINEWIND_FACILITIES,PINEWIND_STATION,PINEWIND_EGG_DISPLAYS,PINEWIND_EGG_TIERS,PINEWIND_TERRACE,PINEWIND_SPAWN} from '../../src/game/content/pinewind/hubLayout.ts';
import {assembleAuthoredSurface} from '../../src/game/presentation/assembleAuthoredSurface.ts';
import {initPhysics,CharacterPhysics,RAPIER} from '../../src/game/validation/physics.ts';
import {SceneryCollision} from '../../src/game/presentation/SceneryCollision.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';

test('world 1 surface services are the Pinewind buildings; the halls ship with the surface art',()=>{
 const session=GAME_CONTENT.session;
 assert.deepEqual(session.sales[0],PINEWIND_SERVICES.sale.trigger);
 // The pickaxe forge opens on tools, the pack shop beside it on backpacks.
 assert.deepEqual(session.shops.slice(0,2).map(s=>[s.id,s.category]),[['surface-upgrade','tools'],['surface-bags','backpacks']]);
 assert.deepEqual(session.shops[0].zone,PINEWIND_SERVICES.shop.trigger);
 assert.deepEqual(session.shops[1].zone,PINEWIND_SERVICES.bags.trigger);
 // Every room keeps its own counters.
 for(const room of GAME_CONTENT.worlds.flatMap(w=>w.rooms)){
  assert.ok(session.sales.some(z=>z.x===room.sell.x&&z.z===room.sell.z&&z.y===room.sell.y),room.id);
  if(room.shop)assert.ok(session.shops.some(s=>s.id===room.id),room.id);
 }
 assert.equal(session.eggStations.length,PINEWIND_EGG_DISPLAYS.length);
 assert.deepEqual([...new Set(GAME_CONTENT.surface.authored.instances.map(p=>p.asset))].sort(),['automine-hall','crystal-hall','frozen-hall','fungal-hall','old-mine-hall','pinewind-architecture','pinewind-landscape','ruins-hall','tech-base','volcanic-hall']);
});
test('one teleport station west of the spawn, its model, pillars and pad where the session expects them',async()=>{
 const {worldStation}=await import('../../src/game/content/worldJourney.ts');
 const st=worldStation(1),model=GAME_CONTENT.surface.authored.instances.find(i=>i.node==='Teleport_Station');
 assert.deepEqual(model.at,[st.x,0,st.z]);assert.equal(PINEWIND_STATION.x,st.x);
 assert.deepEqual(GAME_CONTENT.session.stations.map(s=>s.worldId),[1,2,3]);
 assert.deepEqual(GAME_CONTENT.session.stations[0].zone,st.zone);
 // The station faces the spawn and its pad lies between them.
 const toSpawn=Math.atan2(PINEWIND_SPAWN.x-st.x,PINEWIND_SPAWN.z-st.z);assert.ok(Math.abs(st.yaw-toSpawn)<1e-9);
 assert.ok(Math.hypot(st.zone.x-PINEWIND_SPAWN.x,st.zone.z-PINEWIND_SPAWN.z)<Math.hypot(st.x-PINEWIND_SPAWN.x,st.z-PINEWIND_SPAWN.z));
 assert.equal(GAME_CONTENT.surface.plan.solids.filter(s=>Math.hypot(s.at[0]-st.x,s.at[2]-st.z)<2.5&&s.half[0]===.45).length,2,'two pillars');
});
test('plaza plan: services face the plaza without touching the mine, the headframe or each other',()=>{
 const footprint=(kind,size,forward)=>{const {x,z,yaw}=PINEWIND_FACILITIES[kind].anchor,f=[Math.sin(yaw),Math.cos(yaw)],s=[Math.cos(yaw),-Math.sin(yaw)],c=[x+f[0]*forward,z+f[1]*forward];
  return [[1,1],[1,-1],[-1,-1],[-1,1]].map(([a,b])=>[c[0]+s[0]*size[0]/2*a+f[0]*size[1]/2*b,c[1]+s[1]*size[0]/2*a+f[1]*size[1]/2*b]);};
 const sale=footprint('sale',[10.14,10.66],1.1),shop=footprint('shop',[8.35,6.78],0),bags=footprint('bags',[8.9,8.6],.8);
 const sat=(a,b)=>{for(const poly of [a,b])for(let i=0;i<4;i++){const p=poly[i],q=poly[(i+1)%4],n=[q[1]-p[1],p[0]-q[0]];
  const pa=a.map(v=>v[0]*n[0]+v[1]*n[1]),pb=b.map(v=>v[0]*n[0]+v[1]*n[1]);if(Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa))return false;}return true;};
 const rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
 for(const [a,b,name] of [[sale,shop,'sale/shop'],[sale,bags,'sale/bags'],[shop,bags,'shop/bags']])assert.equal(sat(a,b),false,`${name} overlap`);
 // The terrace stairs and terraces keep a walkway (2 m) to the capsule machine behind the sell house.
 const grow=(poly,by)=>{const c=poly.reduce((a,v)=>[a[0]+v[0]/4,a[1]+v[1]/4],[0,0]);return poly.map(v=>{const d=Math.hypot(v[0]-c[0],v[1]-c[1]);return [v[0]+(v[0]-c[0])/d*by,v[1]+(v[1]-c[1])/d*by];});};
 assert.equal(sat(grow(sale,2),rect(25,43,14,43)),false,'sell house leaves a walkway past the terrace stairs');
 for(const [name,poly] of [['sale',sale],['shop',shop],['bags',bags]]){
  // The headframe's corner piers stand within 11.2 x 9.3 m of the mine centre.
  assert.equal(sat(poly,rect(-11.2,11.2,-9.3,9.3)),false,`${name} touches the headframe`);
  const ring=PINEWIND_SERVICES[name].trigger;
  assert.ok(Math.hypot(ring.x-PINEWIND_PLAZA.x,ring.z-PINEWIND_PLAZA.z)<=PINEWIND_PLAZA.radius+.5,`${name} ring on the plaza`);
  const facing=PINEWIND_FACILITIES[name].anchor.yaw,toPlaza=Math.atan2(PINEWIND_PLAZA.x-ring.x,PINEWIND_PLAZA.z-ring.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(facing-toPlaza),Math.cos(facing-toPlaza)))<.5,`${name} faces the plaza`);
 }
});
test('egg rows step up and alternate by half a bay, so overhead labels never stack',()=>{
 const byTier=PINEWIND_EGG_TIERS.map(t=>PINEWIND_EGG_DISPLAYS.filter(e=>e.tier===t.tier));
 for(let i=1;i<byTier.length;i++){
  assert.ok(PINEWIND_EGG_TIERS[i].y-PINEWIND_EGG_TIERS[i-1].y>=2,'tiers rise at least 2 m');
  for(const a of byTier[i])for(const b of byTier[i-1])assert.ok(Math.abs(a.z-b.z)>=1.9,`${a.eggId} sits between ${b.eggId}`);
 }
 for(const e of PINEWIND_EGG_DISPLAYS)assert.ok(e.z-1.23>=PINEWIND_TERRACE.minZ&&e.z+1.23<=PINEWIND_TERRACE.maxZ,`${e.eggId} on its terrace`);
 // Progression: the first-world eggs fill the two lower rows; cheapest first.
 assert.deepEqual(byTier[0].map(e=>e.eggId).slice(0,2),['meadow-egg','pebble-egg']);
 assert.ok(byTier[2].every(e=>['amber-egg','fossil-egg','silver-egg','gear-egg','star-egg','core-egg'].includes(e.eggId)));
});
function fake(){
 const template=new Group(),node=new Group(),geometry=new BoxGeometry(),map=new Texture(),material=new MeshStandardMaterial({map});node.name='test';node.add(new Mesh(geometry,material));template.add(node);
 const content={authored:{version:'test',instances:[{asset:'test',node:'test',at:[3,0,4],rotation:[0,0,0,1],scale:[1,1,1]}]},plan:{solids:[],shapes:[],signs:[]}};
 return {assets:{templates:new Map([['test',template]]),stats:[]},content,resources:[geometry,map,material]};
}
test('placed roots survive assembly, retain later material clones, and dispose once per independent scene',()=>{
 const a=fake(),b=fake(),first=assembleAuthoredSurface(a.assets,a.content),second=assembleAuthoredSurface(b.assets,b.content),counts=new Map();
 for(const r of [...a.resources,...b.resources])r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)??0)+1));
 const root=first.group.children.find(p=>p.name==='test');assert.ok(root);assert.deepEqual(root.position.toArray(),[3,0,4]);
 const clone=root.children[0].material.clone();let cloneDisposals=0;clone.addEventListener('dispose',()=>cloneDisposals++);root.children[0].material=clone;
 first.retain();first.dispose();first.dispose();assert.equal(cloneDisposals,1);
 for(const r of a.resources)assert.equal(counts.get(r),1);for(const r of b.resources)assert.equal(counts.get(r),undefined);
 second.dispose();for(const r of b.resources)assert.equal(counts.get(r),1);
});
test('assembly rejects missing named nodes and releases already-loaded resources',()=>{
 const f=fake();f.content.authored.instances[0].node='missing';let disposed=0;f.resources[0].addEventListener('dispose',()=>disposed++);
 assert.throws(()=>assembleAuthoredSurface(f.assets,f.content),/Missing surface node/);assert.equal(disposed,1);
});
test('actual character collision: bridge, both services, the teleport station, the first egg and the top terrace without a jump',async()=>{
 await initPhysics();const physics=new CharacterPhysics(),collisions=new SceneryCollision(physics,[{id:'surface',depth:0,plan:GAME_CONTENT.surface.plan}]);
 // The production voxel floor outside the mine is at y=0.
 physics.world.createCollider(RAPIER.ColliderDesc.cuboid(100,1,100).setTranslation(0,-1,0));
 // Steer like a player: movement direction for yaw ψ is (-sin ψ, -cos ψ).
 const walkTo=(x,z,reach=.6,ticks=900)=>{for(let i=0;i<ticks;i++){const f=physics.feet(),dx=x-f[0],dz=z-f[2];if(Math.hypot(dx,dz)<reach)return true;collisions.sync(f);physics.tick(0,1,Math.atan2(-dx,-dz),false,true);}return false;};
 try{
  physics.teleport([0,.1,46]);let maxY=0;
  for(let i=0;i<600&&physics.feet()[2]>12;i++){collisions.sync(physics.feet());physics.tick(0,1,0,false,true);maxY=Math.max(maxY,physics.feet()[1]);}
  assert.ok(physics.feet()[2]<12,`bridge blocked at ${physics.feet()}`);assert.ok(maxY>1,'must stand on raised bridge');
  for(const kind of ['sale','shop']){
   physics.teleport([PINEWIND_PLAZA.x,.1,PINEWIND_PLAZA.z]);const ring=PINEWIND_SERVICES[kind].trigger;
   assert.ok(walkTo(ring.x,ring.z,ring.radius*.6),`${kind} ring blocked at ${physics.feet()}`);
  }
  const pad=GAME_CONTENT.session.stations[0].zone;
  physics.teleport([PINEWIND_SPAWN.x,.1,PINEWIND_SPAWN.z]);
  assert.ok(walkTo(pad.x,pad.z,pad.radius*.6),`station pad blocked at ${physics.feet()}`);
  const first=GAME_CONTENT.session.eggStations.find(s=>s.eggId==='meadow-egg');
  physics.teleport([PINEWIND_PLAZA.x+6,.1,PINEWIND_PLAZA.z]);
  assert.ok(walkTo(first.zone.x,first.zone.z,first.zone.radius*.6),`first egg blocked at ${physics.feet()}`);
  assert.ok(Math.abs(physics.feet()[1]-first.zone.y)<first.zone.heightTolerance,'stands on the egg terrace');
  physics.teleport([23,.1,15.5]);for(let i=0;i<600&&physics.feet()[0]<42.6;i++){collisions.sync(physics.feet());physics.tick(0,1,-Math.PI/2,false,true);}
  assert.ok(physics.feet()[0]>42.6,`stairs blocked at ${physics.feet()}`);assert.ok(physics.feet()[1]>PINEWIND_EGG_TIERS[2].y-.1);
 }finally{collisions.dispose();physics.dispose();}
});
test('the bridge deck leaves the path at ground level and arches gently; the feet stay on the boards on every lane, both ways',async()=>{
 await initPhysics();
 const {PINEWIND_BRIDGE:B}=await import('../../src/game/content/pinewind/hubLayout.ts');
 const plan=GAME_CONTENT.surface.plan,x0=B.x-4,x1=B.x+4,z0=B.z-B.halfSpan-4,z1=B.z+B.halfSpan+4;
 // Visible surfaces around the bridge: the colliders are the authored meshes themselves (deck, rails, ground).
 const tris=[];
 for(const s of plan.solids.filter(s=>s.triangles)){const {vertices:v,indices:I}=s.triangles;
  for(let t=0;t<I.length;t+=3){const tri=[0,1,2].flatMap(k=>[0,1,2].map(a=>v[I[t+k]*3+a]+s.at[a]));
   if(Math.max(tri[0],tri[3],tri[6])>x0&&Math.min(tri[0],tri[3],tri[6])<x1&&Math.max(tri[2],tri[5],tri[8])>z0&&Math.min(tri[2],tri[5],tri[8])<z1)tris.push(tri);}}
 const top=(x,z)=>{let best=0;for(const [ax,ay,az,bx,by,bz,cx,cy,cz] of tris){const d=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);if(Math.abs(d)<1e-12)continue;
  const u=((z-az)*(cx-ax)-(x-ax)*(cz-az))/d,w=((bz-az)*(x-ax)-(bx-ax)*(z-az))/d;if(u>=0&&w>=0&&u+w<=1)best=Math.max(best,ay+u*(by-ay)+w*(cy-ay));}return best;};
 // Board seams are 3.5 cm wide: read the deck at the highest of three nearby points.
 const deck=(x,z)=>Math.max(top(x,z-.02),top(x,z),top(x,z+.02));
 for(const end of [-1,1]){
  const step=deck(B.x,B.z+end*(B.halfSpan-.05))-top(B.x,B.z+end*(B.halfSpan+.3));
  assert.ok(Math.abs(step)<.03,`no step where the deck meets the path (${step.toFixed(3)} m)`);
 }
 assert.ok(deck(B.x,B.z)>B.rise-.05&&deck(B.x,B.z)<B.rise+.1,'deck rises to its crown');
 for(let z=-B.halfSpan;z<B.halfSpan;z+=.25){const slope=Math.abs(deck(B.x,B.z+z+.25)-deck(B.x,B.z+z))/.25;assert.ok(slope<Math.tan(20*Math.PI/180),`slope ${slope.toFixed(2)} at ${z}`);}
 const physics=new CharacterPhysics(),collisions=new SceneryCollision(physics,[{id:'surface',depth:0,plan}]);
 physics.world.createCollider(RAPIER.ColliderDesc.cuboid(100,1,100).setTranslation(0,-1,0));
 try{
  for(const dir of [-1,1])for(const x of [-1.6,-.8,0,.8,1.6]){
   const start=B.z-dir*(B.halfSpan+3),goal=B.z+dir*(B.halfSpan+2);
   physics.teleport([x,.3,start]);let sink=-1,air=0,ticks=0;
   for(let i=0;i<500&&(goal-physics.feet()[2])*dir>0;i++){
    collisions.sync(physics.feet());physics.tick(0,1,dir<0?0:Math.PI,false,true);
    const f=physics.feet();if(i<20)continue;ticks++;sink=Math.max(sink,top(f[0],f[2])-f[1]);if(!physics.grounded)air++;
   }
   assert.ok((goal-physics.feet()[2])*dir<=0,`lane ${x} heading ${dir}: stopped at ${physics.feet()}`);
   assert.ok(sink<.005,`lane ${x} heading ${dir}: feet ${sink.toFixed(3)} m inside the visible surface`);
   assert.ok(air<=ticks*.02,`lane ${x} heading ${dir}: airborne for ${air} of ${ticks} steps`);
  }
 }finally{collisions.dispose();physics.dispose();}
});
test('cliffs enclose the valley outside the play area: the pass and the creek gorges stay open, and the walls stop the character',async()=>{
 const hulls=GAME_CONTENT.surface.plan.solids.filter(s=>s.hull);
 assert.ok(hulls.length>50,`${hulls.length} cliff columns`);
 const gap=(s,x,z)=>Math.hypot(Math.max(0,Math.abs(x-s.at[0])-s.half[0]),Math.max(0,Math.abs(z-s.at[2])-s.half[2]));
 for(const s of hulls){
  assert.ok(gap(s,PINEWIND_PLAZA.x,PINEWIND_PLAZA.z)>PINEWIND_PLAZA.radius+15,`column at ${s.at} crowds the plaza`);
  assert.ok(gap(s,PINEWIND_SPAWN.x,PINEWIND_SPAWN.z)>20,`column at ${s.at} crowds the spawn`);
  // The pass through the gate and the route beyond it.
  assert.ok(Math.abs(s.at[0])-s.half[0]>7||s.at[2]+s.half[2]<60,`column at ${s.at} blocks the pass`);
  // The creek enters in the north-east and leaves in the west through gorges.
  for(const [x,z] of [[61,-50],[-70,55]])assert.ok(gap(s,x,z)>2,`column at ${s.at} dams the creek`);
 }
 for(const zone of [...GAME_CONTENT.session.stations.map(s=>s.zone),...GAME_CONTENT.session.eggStations.map(e=>e.zone),...Object.values(PINEWIND_SERVICES).map(s=>s.trigger)])
  for(const s of hulls)assert.ok(gap(s,zone.x,zone.z)>10);
 await initPhysics();const physics=new CharacterPhysics(),collisions=new SceneryCollision(physics,[{id:'surface',depth:0,plan:GAME_CONTENT.surface.plan}]);
 physics.world.createCollider(RAPIER.ColliderDesc.cuboid(100,1,100).setTranslation(0,-1,0));
 try{
  // Walk north behind the mine and west behind the sale house: the cliffs stop both walks.
  for(const [start,yaw,axis,limit] of [[[0,.1,-14],0,2,-62],[[-30,.1,0],Math.PI/2,0,-70]]){
   physics.teleport(start);
   for(let i=0;i<900;i++){collisions.sync(physics.feet());physics.tick(0,1,yaw,false,true);}
   assert.ok(physics.feet()[axis]>limit,`walked through the cliffs to ${physics.feet()}`);
  }
 }finally{collisions.dispose();physics.dispose();}
});
test('instant trips face the service building',()=>{
 const session=new GameSession(GAME_CONTENT.session);let trip=null;
 session.attach({cell:()=>0,pending:()=>false,mine:()=>false,cancelMining(){},travelTo:(feet,look)=>{trip={feet,look};}});
 assert.equal(session.goTo('shop'),'travelling');
 assert.deepEqual(trip.look,PINEWIND_SERVICES.shop.center);
 assert.equal(trip.feet[0],PINEWIND_SERVICES.shop.trigger.x);
});

test('布局 v5：出售在东北，镐子店和背包店在西侧，从出生点看分在矿架两边；扭蛋机在原宠物屋位置，避开矿架和房子；没有排行榜', async () => {
 const { PINEWIND_GATE } = await import('../../src/game/content/pinewind/hubLayout.ts');
 const { worldGateZ } = await import('../../src/game/content/worldJourney.ts');
 const facilities = await import('../../src/game/content/feedbackFacilities.ts'), { CAPSULE_MACHINE_AT, CAPSULE_MACHINE_ZONE } = facilities;
 assert.equal('CHALLENGE_BOARD_AT' in facilities, false, 'the leaderboard is gone');
 // The default arrival view looks north from just behind the spawn.
 const eye = [PINEWIND_SPAWN.x, PINEWIND_SPAWN.z + 6], bearing = ([x, z]) => Math.atan2(x - eye[0], eye[1] - z);
 const sale = PINEWIND_SERVICES.sale.center, shop = PINEWIND_SERVICES.shop.center, bags = PINEWIND_SERVICES.bags.center;
 assert.ok(sale[0] > 8 && shop[0] < -8 && bags[0] < -8, `sell east, both shops west of the mine: ${sale} / ${shop} / ${bags}`);
 const apart = Math.abs(bearing([shop[0], shop[2]]) - bearing([sale[0], sale[2]])) * 180 / Math.PI;
 assert.ok(apart > 35, `from the spawn the two buildings are ${apart.toFixed(0)}° apart`);
 // The capsule clears the headframe footprint (11.7 x 10.2), the buildings and the terrace stairs.
 const headframe = (x, z, r) => Math.abs(x) < 11.7 + r && Math.abs(z) < 10.2 + r;
 assert.ok(!headframe(CAPSULE_MACHINE_AT[0], CAPSULE_MACHINE_AT[2], 1.3), 'capsule clear of the headframe');
 for (const service of [sale, shop, bags]) assert.ok(Math.hypot(CAPSULE_MACHINE_AT[0] - service[0], CAPSULE_MACHINE_AT[2] - service[2]) > 6.5, `capsule clear of ${service}`);
 assert.ok(CAPSULE_MACHINE_AT[2] + 1.3 < 14, 'capsule north of the terrace stairs');
 const roots0 = GAME_CONTENT.surface.authored.instances.map(i => i.node);
 for (const gone of ['Challenge_Board', 'Pet_Conservatory']) assert.equal(roots0.includes(gone), false, gone);
 assert.equal(GAME_CONTENT.surface.plan.signs.some(s => s.title === 'PETS'), false, 'no PETS sign');
 assert.deepEqual(GAME_CONTENT.surface.plan.signs.map(s => s.title).sort(), ['BACKPACK', 'PICKAXE', 'SELL', '传送站']);
 assert.ok(Math.hypot(CAPSULE_MACHINE_ZONE.x - CAPSULE_MACHINE_AT[0], CAPSULE_MACHINE_ZONE.z - CAPSULE_MACHINE_AT[2]) < 2, 'capsule zone in front of it');
 // The authored gate stands on the gameplay gate line, its doors hinged at the opening's edges.
 assert.equal(PINEWIND_GATE.z, worldGateZ(2));
 const roots = new Map(GAME_CONTENT.surface.authored.instances.map(i => [i.node, i]));
 assert.deepEqual(roots.get('World_Gate').at, [PINEWIND_GATE.x, 0, PINEWIND_GATE.z]);
 for (const [node, sx] of [['World_Gate_DoorL', -1], ['World_Gate_DoorR', 1]])
  assert.deepEqual(roots.get(node).at, [PINEWIND_GATE.x + sx * PINEWIND_GATE.opening / 2, 0, PINEWIND_GATE.z], node);
});
