import type {V3} from '../world/sceneryKit.ts';
import type {WorldId} from './worldJourney.ts';
/** Data-only interface for authored surface variants. No renderer objects or globals. `world` is the world the
 *  instance belongs to (default 1); a later world's instances load the first time the player goes there. */
export type AuthoredInstance = {
 asset:string;node?:string;at:V3;rotation:[number,number,number,number];scale:V3;
 ground?:boolean;world?:WorldId;
};
/** Offline light bake carried by the authored assets (sun visibility and sky occlusion). */
export type AuthoredLight = {
 version:string;sun:readonly [number,number,number];sunRadiusDeg:number;aoRadius:number;
 ground:{x0:number;z0:number;size:number;resolution:number};lightmapSize:number;
 /** Characters' sun grid (pinewind-standing-light.png): resolution, sample height and floor height step. */
 standing:{resolution:number;height:number;heightStep:number;sha256:string};
};
export type AuthoredSurface = {
 version:string;instances:readonly AuthoredInstance[];light:AuthoredLight;
};
