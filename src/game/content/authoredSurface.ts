import type {V3} from '../world/sceneryKit.ts';
/** Data-only interface for authored surface variants. No renderer objects or globals. */
export type AuthoredInstance = {
 asset:string;node?:string;at:V3;rotation:[number,number,number,number];scale:V3;
 portalId?:string;ground?:boolean;
};
export type AuthoredSurface = {
 version:string;instances:readonly AuthoredInstance[];groundAssets:readonly string[];
 opensSpawnPassage:boolean;
};
