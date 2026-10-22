import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture} from 'three';
import {createCampContent} from '../../src/game/content/campContent.ts';
import {withPinewindSurface,PINEWIND_CAMP} from '../../src/game/content/pinewindSurface.ts';
import {PORTAL_SLOTS} from '../../src/game/content/portalSlots.ts';
import {LAYERS} from '../../src/game/content/layers.ts';
import {assembleAuthoredSurface} from '../../src/game/presentation/assembleAuthoredSurface.ts';
import {initPhysics,CharacterPhysics,RAPIER} from '../../src/game/validation/physics.ts';
import {SceneryCollision} from '../../src/game/presentation/SceneryCollision.ts';

test('surface composition preserves exact game, world and tutorial inputs',()=>{
 const base=createCampContent(),art=withPinewindSurface(base);
 for(const key of ['session','layers','rooms','hub','returnPoint'])assert.equal(art[key],base[key],key);
 assert.equal(art.surface.placements.length,0);
 assert.deepEqual([...new Set(art.surface.authored.instances.map(p=>p.asset))].sort(),['pinewind-architecture','pinewind-landscape']);
});
test('injected portal position drives the visible model and both jamb colliders',()=>{
 const base=createCampContent(LAYERS,{...PORTAL_SLOTS,core:{...PORTAL_SLOTS.core,x:-23,z:18,yaw:0}}),art=withPinewindSurface(base);
 const model=art.surface.authored.instances.find(p=>p.portalId==='core');assert.deepEqual(model.at,[-23,0,18]);
 for(const x of [-24.05,-21.95])assert.ok(art.surface.plan.solids.some(s=>Math.abs(s.at[0]-x)<1e-9&&s.at[2]===18&&s.half[0]===.25));
 assert.equal(base.session.portals.find(p=>p.id==='core').zone.x,-23);
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
test('actual character collision walks the bridge and all pet stairs without a jump',async()=>{
 await initPhysics();const physics=new CharacterPhysics(false,true),collisions=new SceneryCollision(physics,[{id:'surface',depth:0,plan:PINEWIND_CAMP.surface.plan}]);
 // The production voxel floor outside the mine is at y=0.
 physics.world.createCollider(RAPIER.ColliderDesc.cuboid(100,1,100).setTranslation(0,-1,0));
 try{
  physics.teleport([0,.1,46]);let maxY=0;
  for(let i=0;i<600&&physics.feet()[2]>12;i++){collisions.sync(physics.feet());physics.tick(0,1,0,false,true);maxY=Math.max(maxY,physics.feet()[1]);}
  assert.ok(physics.feet()[2]<12,`bridge blocked at ${physics.feet()}`);assert.ok(maxY>1,'must stand on raised bridge');
  physics.teleport([23,.1,44.5]);for(let i=0;i<500&&physics.feet()[0]<42.6;i++){collisions.sync(physics.feet());physics.tick(0,1,-Math.PI/2,false,true);}
  assert.ok(physics.feet()[0]>42.6,`stairs blocked at ${physics.feet()}`);assert.ok(physics.feet()[1]>3.95);
 }finally{collisions.dispose();physics.dispose();}
});
