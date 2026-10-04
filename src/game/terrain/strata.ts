import { CELL } from './grid.ts';
import { LAYERS, layerAtDepth, type Layer } from '../content/layers.ts';
import {oreChanceAtDepth} from '../content/oreDistribution.ts';
export const STRATA = LAYERS;
export const stratumAtDepth = layerAtDepth;
const weightTotals=new WeakMap<Layer,number>();
// Avalanche every bit of the exact cell coordinate. Never quantize into veins.
export function mineralRoll(x:number,y:number,z:number,seed:number){
 let h=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791)^seed;
 h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);
 return ((h^(h>>>16))>>>0)/4294967296;
}
export function generatedMineral(x: number, y: number, z: number, seed: number, layers: readonly Layer[] = LAYERS) {
 const depth=-(y+1)*CELL,layer=layerAtDepth(depth,layers);
 const roll=mineralRoll(x,y,z,seed),chance=oreChanceAtDepth(depth);
 if(roll>=chance||!layer.ores.length)return layer.base;
 let total=weightTotals.get(layer);
 if(total===undefined){total=layer.ores.reduce((n,o)=>n+o.weight,0);weightTotals.set(layer,total);}
 let weighted=roll/chance*total;
 for(const ore of layer.ores){weighted-=ore.weight;if(weighted<0)return ore.kind;}
 return layer.base;
}
