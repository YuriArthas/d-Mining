import type {Group} from 'three';
import type {WorldId} from '../content/worldJourney.ts';
/** Session-owned presentation contract, independent of any surface art implementation. */
export interface SurfaceScene {
 group:Group;
 details:{
  update(elapsed:number,bakedShadows:boolean):void;
  beginDraw():void;
  diagnostics():unknown;
 };
 retain():void;
 dispose():void;
 /** Starts loading a world's scene (once, models counted to `onProgress`); resolves with the part added to
  *  `group` (null if nothing new). */
 loadWorld?(world:WorldId,onProgress?:(done:number,total:number)=>void):Promise<Group|null>;
 worldReady?(world:WorldId):boolean;
}
