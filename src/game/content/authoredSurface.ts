import type {V3} from '../world/sceneryKit.ts';
/** Data-only interface for authored surface variants. No renderer objects or globals. */
export type AuthoredInstance = {
 asset:string;node?:string;at:V3;rotation:[number,number,number,number];scale:V3;
 portalId?:string;ground?:boolean;
};
/** Offline light bake carried by the authored assets (sun visibility and sky occlusion). */
export type AuthoredLight = {
 version:string;sun:readonly [number,number,number];sunRadiusDeg:number;aoRadius:number;
 ground:{x0:number;z0:number;size:number;resolution:number};lightmapSize:number;
 /** Characters' sun grid (pinewind-standing-light.png): resolution, sample height and floor height step. */
 standing:{resolution:number;height:number;heightStep:number;sha256:string};
};
export type AuthoredSurface = {
 version:string;instances:readonly AuthoredInstance[];groundAssets:readonly string[];
 opensSpawnPassage:boolean;light:AuthoredLight;
};
