import type {Group} from 'three';
import type {SurfaceTime} from '../world/SceneLighting.ts';
/** Session-owned presentation contract, independent of any surface art implementation. */
export interface SurfaceScene {
 group:Group;
 details:{
  update(time:SurfaceTime,elapsed:number,shadows?:boolean,strength?:number,daylight?:number):void;
  beginDraw():void;
  diagnostics():unknown;
 };
 retain():void;
 dispose():void;
}
