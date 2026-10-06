import test from 'node:test';
import assert from 'node:assert/strict';
import {initPhysics, CharacterPhysics} from '../../src/game/validation/physics.ts';
import {SceneryCollision} from '../../src/game/presentation/SceneryCollision.ts';
test('ordinary colliders use independent near/far hysteresis and release before borrowed world',async()=>{
 await initPhysics();const physics=new CharacterPhysics(false),base=physics.world.colliders.len();
 const sites=[{id:'test',depth:400,plan:{solids:[{at:[0,1,0],half:[1,1,1],yaw:0}],shapes:[],signs:[]}}];
 const collisions=new SceneryCollision(physics,sites);
 collisions.sync([0,0,0]);assert.equal(collisions.count,0);
 collisions.sync([0,-400,0]);assert.equal(collisions.count,1);assert.equal(physics.world.colliders.len(),base+1);
 collisions.sync([20,-400,0]);assert.equal(collisions.count,1);
 collisions.sync([40,-400,0]);assert.equal(collisions.count,0);
 collisions.sync([0,-400,0]);collisions.dispose();collisions.dispose();
 assert.equal(physics.world.colliders.len(),base);physics.dispose();
});
