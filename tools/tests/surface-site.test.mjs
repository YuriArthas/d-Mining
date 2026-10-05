import test from 'node:test';
import assert from 'node:assert/strict';
import {SURFACE_SITE} from '../../src/game/world/SurfaceSite.ts';
import {PET_AREA,PORTAL_AREA,HUB_PLACEMENTS,HUB_FENCES} from '../../src/game/world/SurfaceHub.ts';
import {PET_TERRACE_PLACEMENTS} from '../../src/game/world/PetTerraces.ts';
import {BOUNDARY_PLACEMENTS} from '../../src/game/world/TimberBoundary.ts';
import {footprint,intersects} from '../../src/game/world/CampLayout.ts';
import {CAMP_DECORATIONS,QUARRY_SOLIDS} from '../../src/game/world/QuarryLayout.ts';
import {CharacterPhysics,initPhysics,RAPIER} from '../../src/game/validation/physics.ts';

test('functional display, fences and trees respect the shared site buffer',()=>{
 const floor=SURFACE_SITE.interior,b=SURFACE_SITE.buffer;
 for(const p of [...HUB_PLACEMENTS,...HUB_FENCES,...PET_TERRACE_PLACEMENTS]){
  const r=footprint(p);
  assert.ok(r.minX-floor.minX>=b&&floor.maxX-r.maxX>=b&&r.minZ-floor.minZ>=b&&floor.maxZ-r.maxZ>=b,`${p.asset}@${p.x},${p.z}: crowded boundary`);
 }
 for(const p of CAMP_DECORATIONS.filter(p=>(p.y??0)>3))for(const area of [PET_AREA,PORTAL_AREA])assert.equal(intersects(footprint(p),area),false);
 for(const p of BOUNDARY_PLACEMENTS){
  const r=footprint(p);
  assert.ok(r.minX>=-SURFACE_SITE.grounds.width/2&&r.maxX<=SURFACE_SITE.grounds.width/2&&r.minZ>=-SURFACE_SITE.grounds.depth/2&&r.maxZ<=SURFACE_SITE.grounds.depth/2);
 }
});

test('both staircases can be climbed and descended with the real capsule, without jumping',async()=>{
 await initPhysics();
 for(const z of [15.5,44.5]){
  const p=new CharacterPhysics(false);
  try{
   p.world.createCollider(RAPIER.ColliderDesc.cuboid(90,.5,90).setTranslation(0,-.5,0));
   for(const s of QUARRY_SOLIDS)p.world.createCollider(RAPIER.ColliderDesc.cuboid(...s.half).setTranslation(...s.at).setRotation({x:0,y:Math.sin(s.yaw/2),z:0,w:Math.cos(s.yaw/2)}));
   p.teleport([23.5,.1,z]);for(let i=0;i<20;i++)p.tick(0,0,0,false,true);
   for(let i=0;i<500&&p.feet()[0]<42.5;i++)p.tick(1,0,0,false,true);
   assert.ok(p.feet()[0]>42.5,`stuck ascending ${JSON.stringify(p.feet())}`);
   assert.ok(p.feet()[1]>3.9&&p.feet()[1]<4.2);
   for(let i=0;i<500&&p.feet()[0]>23.5;i++)p.tick(-1,0,0,false,true);
   for(let i=0;i<20;i++)p.tick(0,0,0,false,true);
   assert.ok(p.feet()[0]<23.5,`stuck descending ${JSON.stringify(p.feet())}`);
   assert.ok(p.feet()[1]<.1);
  }finally{p.dispose();}
 }
});
