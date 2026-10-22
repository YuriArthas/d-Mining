import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture} from 'three';
import {createCampContent} from '../../src/game/content/campContent.ts';
import {withPinewindSurface,PINEWIND_CAMP} from '../../src/game/content/pinewindSurface.ts';
import {PORTAL_SLOTS} from '../../src/game/content/portalSlots.ts';
import {LAYERS} from '../../src/game/content/layers.ts';
import {PINEWIND_PLAZA,PINEWIND_SERVICES,PINEWIND_FACILITIES,PINEWIND_PORTAL_SLOTS,PINEWIND_EGG_DISPLAYS,PINEWIND_EGG_TIERS,PINEWIND_TERRACE,PINEWIND_SPAWN} from '../../src/game/content/pinewind/hubLayout.ts';
import {assembleAuthoredSurface} from '../../src/game/presentation/assembleAuthoredSurface.ts';
import {initPhysics,CharacterPhysics,RAPIER} from '../../src/game/validation/physics.ts';
import {SceneryCollision} from '../../src/game/presentation/SceneryCollision.ts';
import {GameSession} from '../../src/game/application/GameSession.ts';

test('the hub owns world-1 surface zones; rules, rooms, worlds and the tutorial pass through unchanged',()=>{
 const base=createCampContent(),art=withPinewindSurface(base);
 for(const key of ['layers','rooms','returnPoint'])assert.equal(art[key],base[key],key);
 for(const key of ['destinations','petContent','onboarding','home','homes','journey'])assert.equal(art.session[key],base.session[key],key);
 assert.deepEqual(art.session.sales.slice(1),base.session.sales.slice(1),'room sale zones unchanged');
 assert.deepEqual(art.session.sales[0],PINEWIND_SERVICES.sale.trigger);
 assert.deepEqual(art.session.shops.find(s=>s.id==='surface-upgrade').zone,PINEWIND_SERVICES.shop.trigger);
 assert.deepEqual(art.session.shops.filter(s=>s.id!=='surface-upgrade'),base.session.shops.filter(s=>s.id!=='surface-upgrade'));
 assert.equal(art.session.eggStations.length,PINEWIND_EGG_DISPLAYS.length);
 assert.equal(art.surface.placements.length,0);
 assert.deepEqual([...new Set(art.surface.authored.instances.map(p=>p.asset))].sort(),['pinewind-architecture','pinewind-landscape']);
 // The live content carries the same zones into the game session.
 assert.deepEqual(PINEWIND_CAMP.session.sales[0],PINEWIND_SERVICES.sale.trigger);
});
test('portals follow the Pinewind slots for the visible model, both jamb colliders and the session zone',()=>{
 const base=createCampContent(LAYERS,{...PORTAL_SLOTS,core:{...PORTAL_SLOTS.core,x:-23,z:18,yaw:0}}),art=withPinewindSurface(base);
 for(const p of art.hub.portals){
  const slot=PINEWIND_PORTAL_SLOTS[p.id],model=art.surface.authored.instances.find(m=>m.portalId===p.id);
  assert.deepEqual(model.at,[slot.x,0,slot.z]);
  for(const sign of [-1,1]){const x=slot.x+Math.cos(slot.yaw)*1.05*sign,z=slot.z-Math.sin(slot.yaw)*1.05*sign;
   assert.ok(art.surface.plan.solids.some(s=>Math.abs(s.at[0]-x)<1e-9&&Math.abs(s.at[2]-z)<1e-9&&s.half[0]===.25),`${p.id} jamb`);}
  const zone=art.session.portals.find(q=>q.id===p.id).zone;assert.equal(zone.x,slot.x);assert.equal(zone.z,slot.z);
 }
});
test('plaza plan: services face the plaza without touching the mine, the headframe or each other',()=>{
 const footprint=(kind,size,forward)=>{const {x,z,yaw}=PINEWIND_FACILITIES[kind].anchor,f=[Math.sin(yaw),Math.cos(yaw)],s=[Math.cos(yaw),-Math.sin(yaw)],c=[x+f[0]*forward,z+f[1]*forward];
  return [[1,1],[1,-1],[-1,-1],[-1,1]].map(([a,b])=>[c[0]+s[0]*size[0]/2*a+f[0]*size[1]/2*b,c[1]+s[1]*size[0]/2*a+f[1]*size[1]/2*b]);};
 const sale=footprint('sale',[10.14,10.66],1.1),shop=footprint('shop',[8.35,6.78],0);
 const sat=(a,b)=>{for(const poly of [a,b])for(let i=0;i<4;i++){const p=poly[i],q=poly[(i+1)%4],n=[q[1]-p[1],p[0]-q[0]];
  const pa=a.map(v=>v[0]*n[0]+v[1]*n[1]),pb=b.map(v=>v[0]*n[0]+v[1]*n[1]);if(Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa))return false;}return true;};
 const rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
 assert.equal(sat(sale,shop),false,'sale and shop overlap');
 for(const [name,poly] of [['sale',sale],['shop',shop]]){
  assert.equal(sat(poly,rect(-11.7,11.7,-10.2,10.2)),false,`${name} touches the headframe`);
  const ring=PINEWIND_SERVICES[name].trigger;
  assert.ok(Math.hypot(ring.x-PINEWIND_PLAZA.x,ring.z-PINEWIND_PLAZA.z)<=PINEWIND_PLAZA.radius,`${name} ring on the plaza`);
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
 const content={authored:{version:'test',instances:[{asset:'test',node:'test',at:[3,0,4],rotation:[0,0,0,1],scale:[1,1,1],portalId:'core'}]},plan:{solids:[],shapes:[],signs:[]}};
 return {assets:{templates:new Map([['test',template]]),stats:[]},content,resources:[geometry,map,material]};
}
test('interactive roots survive assembly, retain later material clones, and dispose once per independent scene',()=>{
 const a=fake(),b=fake(),first=assembleAuthoredSurface(a.assets,a.content),second=assembleAuthoredSurface(b.assets,b.content),counts=new Map();
 for(const r of [...a.resources,...b.resources])r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)??0)+1));
 const portal=first.group.children.find(p=>p.userData.portalId==='core');assert.ok(portal);assert.deepEqual(portal.position.toArray(),[3,0,4]);
 const clone=portal.children[0].material.clone();let cloneDisposals=0;clone.addEventListener('dispose',()=>cloneDisposals++);portal.children[0].material=clone;
 first.retain();first.dispose();first.dispose();assert.equal(cloneDisposals,1);
 for(const r of a.resources)assert.equal(counts.get(r),1);for(const r of b.resources)assert.equal(counts.get(r),undefined);
 second.dispose();for(const r of b.resources)assert.equal(counts.get(r),1);
});
test('assembly rejects missing named nodes and releases already-loaded resources',()=>{
 const f=fake();f.content.authored.instances[0].node='missing';let disposed=0;f.resources[0].addEventListener('dispose',()=>disposed++);
 assert.throws(()=>assembleAuthoredSurface(f.assets,f.content),/Missing surface node/);assert.equal(disposed,1);
});
test('actual character collision: bridge, both services, every portal, the first egg and the top terrace without a jump',async()=>{
 await initPhysics();const physics=new CharacterPhysics(false,true),collisions=new SceneryCollision(physics,[{id:'surface',depth:0,plan:PINEWIND_CAMP.surface.plan}]);
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
  for(const p of PINEWIND_CAMP.session.portals){
   physics.teleport([PINEWIND_SPAWN.x,.1,PINEWIND_SPAWN.z]);
   assert.ok(walkTo(p.zone.x,p.zone.z,p.zone.radius*.6),`portal ${p.id} blocked at ${physics.feet()}`);
  }
  const first=PINEWIND_CAMP.session.eggStations.find(s=>s.eggId==='meadow-egg');
  physics.teleport([PINEWIND_PLAZA.x+6,.1,PINEWIND_PLAZA.z]);
  assert.ok(walkTo(first.zone.x,first.zone.z,first.zone.radius*.6),`first egg blocked at ${physics.feet()}`);
  assert.ok(Math.abs(physics.feet()[1]-first.zone.y)<first.zone.heightTolerance,'stands on the egg terrace');
  physics.teleport([23,.1,15.5]);for(let i=0;i<600&&physics.feet()[0]<42.6;i++){collisions.sync(physics.feet());physics.tick(0,1,-Math.PI/2,false,true);}
  assert.ok(physics.feet()[0]>42.6,`stairs blocked at ${physics.feet()}`);assert.ok(physics.feet()[1]>PINEWIND_EGG_TIERS[2].y-.1);
 }finally{collisions.dispose();physics.dispose();}
});
test('instant trips face the service building',()=>{
 const session=new GameSession(PINEWIND_CAMP.session);let trip=null;
 session.attach({cell:()=>0,pending:()=>false,mine:()=>false,cancelMining(){},returnToSurface(){},travelTo:(feet,look)=>{trip={feet,look};}});
 assert.equal(session.goTo('shop'),'travelling');
 assert.deepEqual(trip.look,PINEWIND_SERVICES.shop.center);
 assert.equal(trip.feet[0],PINEWIND_SERVICES.shop.trigger.x);
});
