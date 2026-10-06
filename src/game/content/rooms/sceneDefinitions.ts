import core from './core.scene.json' with {type:'json'};
import machinery from './machinery.scene.json' with {type:'json'};
import fossil from './fossil.scene.json' with {type:'json'};
import volcanic from './volcanic.scene.json' with {type:'json'};
import frozen from './frozen.scene.json' with {type:'json'};
import ruins from './ruins.scene.json' with {type:'json'};
import crystal from './crystal.scene.json' with {type:'json'};
import fungal from './fungal.scene.json' with {type:'json'};
import {OLD_MINE_SCENE} from './oldMine.ts';
import type {RoomSceneDefinition, RoomFacilities} from './authoredRoom.ts';

export const ROOM_SCENES: Readonly<Record<string, RoomSceneDefinition>> = {
  'ruins-station-v1': ruins as RoomSceneDefinition,
  'frozen-station-v1': frozen as RoomSceneDefinition,
  'volcanic-station-v1': volcanic as RoomSceneDefinition,
  'fossil-station-v1': fossil as RoomSceneDefinition,
  'machinery-station-v1': machinery as RoomSceneDefinition,
  'core-station-v1': core as RoomSceneDefinition,
  'timber-station-v2': OLD_MINE_SCENE,
  'fungal-station-v1': fungal as RoomSceneDefinition,
  'crystal-station-v1': crystal as RoomSceneDefinition,
};
// Existing layers retain their previous layout until their art is migrated.
export const LEGACY_ROOM_REFERENCE = [40,20,40] as const;
export const LEGACY_ROOM_FACILITIES: RoomFacilities = {
  spawn: {at:[0,0,11],clearance:.1},
  sell: {at:[-12,0,12],radius:1.7,heightTolerance:.25,hysteresis:.25},
  shop: {at:[12,0,12],radius:1.7,heightTolerance:.25,hysteresis:.25},
};
const vector=(v:readonly number[])=>v.length===3&&v.every(Number.isFinite);
export function validateRoomScene(id:string,scene:RoomSceneDefinition){
  const fail=(field:string):never=>{throw Error(`无效房间场景 ${id}: ${field}`);};
  if(!scene.asset||!vector(scene.referenceSize)||scene.referenceSize.some(v=>v<=0))fail('referenceSize/asset');
  const f=scene.facilities;
  if(!vector(f.spawn.at)||!Number.isFinite(f.spawn.clearance)||f.spawn.clearance<0)fail('spawn');
  for(const zone of [f.sell,f.shop])if(zone&&(!vector(zone.at)||![zone.radius,zone.heightTolerance,zone.hysteresis].every(Number.isFinite)||zone.radius<=0||zone.heightTolerance<0||zone.hysteresis<0))fail('zone');
  const anchor=(a:string)=>['room','spawn','sell','shop'].includes(a)&&(a!=='shop'||!!f.shop);
  for(const sign of scene.signs)if(!anchor(sign.anchor)||!vector(sign.offset)||!(sign.width>0)||!Number.isFinite(sign.width)||/\{(?!name\}|number\}|depth\})/.test(sign.title+sign.subtitle))fail('sign');
  for(const ring of scene.rings)if(!['sell','shop'].includes(ring.anchor)||!anchor(ring.anchor)||!vector(ring.offset)||!Number.isFinite(ring.height)||ring.height<=0)fail('ring');
  const {atlas,surface,lighting:l}=scene.render;
  if(!Number.isInteger(atlas.columns)||!Number.isInteger(atlas.rows)||atlas.columns<1||atlas.rows<1||!Number.isFinite(atlas.gutter)||atlas.gutter<0||!Number.isFinite(atlas.repeat)||atlas.repeat<=0)fail('atlas');
  if(!Object.values(surface).every(v=>Number.isFinite(v)&&v>=0)||surface.roughness>1||surface.metalness>1)fail('surface');
  if(!Number.isInteger(l.resolution)||l.resolution<1||l.resolution>512||!vector(l.color)||l.color.some(v=>v<0))fail('lighting');
  if(![l.lampStrength,l.horizontalFalloff,l.height,l.verticalFalloff,...Object.values(l.ceiling),...Object.values(l.contact)].every(Number.isFinite)||l.horizontalFalloff<=0||l.lampStrength<0||l.verticalFalloff<0||l.contact.falloff<0||l.contact.strength<0||l.contact.strength>1||l.contact.maxHalfHeight<=0||l.contact.fadeTo<=l.contact.fadeFrom||l.ceiling.to<=l.ceiling.from||l.ceiling.bottomBrightness<0||l.ceiling.topBrightness<0)fail('lighting falloff');
}
export function roomScene(id:string,definitions:Readonly<Record<string,RoomSceneDefinition>>=ROOM_SCENES){
  const scene=definitions[id];
  if(!scene)throw Error(`未知房间场景: ${id}`);
  validateRoomScene(id,scene);
  return scene;
}
