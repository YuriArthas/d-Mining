import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {QUARRY_PLACEMENTS} from '../../src/game/world/QuarryLayout.ts';
import {SurfaceDetails} from '../../src/game/presentation/SurfaceDetails.ts';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const mask=JSON.parse(read('src/game/assets/ground-details/contact-shadow.json'));
const selection=JSON.parse(read('assets-source/quarry-v2/contact-bake/selection.json'));
const result=JSON.parse(read('assets-source/quarry-v2/contact-bake/result.json'));
test('contact bake matches shipped meshes and current placements; changes require rebaking',()=>{
 assert.equal(createHash('sha256').update(read('src/game/assets/ground-details/contact-shadow.json')).digest('hex'),result.runtimeSha256);
 for(const p of selection.selected)assert.ok(QUARRY_PLACEMENTS.some(current=>JSON.stringify(current)===JSON.stringify(p)),'bake placement moved');
 for(const s of selection.sources)assert.equal(JSON.parse(read(`src/game/assets/camp/${s.asset}.manifest.json`)).sha256,s.transportSha256,'bake mesh changed');
 assert.equal(selection.selected.length,10);assert.equal(mask.size,512);
});
test('UV orientation places occlusion at the posts/buildings and leaves spawn/shaft clear',()=>{
 const bytes=Buffer.from(mask.data,'base64'),b=mask.bounds;
 const value=(x,z)=>bytes[Math.floor((b.maxZ-z)/(b.maxZ-b.minZ)*mask.size)*mask.size+Math.floor((x-b.minX)/(b.maxX-b.minX)*mask.size)];
 assert.equal(bytes.length,512*512);
 for(const [x,z] of [[-10,-10],[-10,10],[10,-10],[10,10],[-12,56],[8,56]])assert.ok(value(x,z)<120,`${x},${z} should be occluded`);
 for(const [x,z] of [[0,46],[0,0],[0,30],[20,0]])assert.ok(value(x,z)>250,`${x},${z} should remain clear`);
 assert.ok(bytes.filter(x=>x<253).length/bytes.length<.06,'bake must stay local');
});
test('bake toggle changes only uniform strength, is reusable across day/night and disposes texture',()=>{
 const details=new SurfaceDetails(),map=details.bakedContact.texture,uniform=details.bakedContact.strength;
 assert.equal(map.image.data.length,512*512);let disposed=false;map.addEventListener('dispose',()=>disposed=true);
 details.update('night',0,true);assert.ok(uniform.value>0);
 details.update('day',1,false);assert.equal(uniform.value,0);
 details.update('day',2,true);assert.ok(uniform.value>0);assert.equal(details.bakedContact.texture,map);
 assert.equal(details.diagnostics().bakedShadows.realtimeShadowMaps,0);details.dispose();assert.ok(disposed);
});
