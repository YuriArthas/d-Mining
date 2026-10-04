import {WORLD_DEPTH} from './layers.ts';
// Chance of a non-host resource; layer weights select its kind, not its density.
export const ORE_DENSITY={surface:.025,deep:.28,curve:.85} as const;
export function oreChanceAtDepth(depth:number){
 const t=Math.max(0,Math.min(1,depth/WORLD_DEPTH));
 return ORE_DENSITY.surface+(ORE_DENSITY.deep-ORE_DENSITY.surface)*Math.pow(t,ORE_DENSITY.curve);
}
