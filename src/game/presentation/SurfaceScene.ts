import type {Group} from 'three';
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
}
