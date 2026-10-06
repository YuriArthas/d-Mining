import { RESOURCES, resourceByKind, resourceById } from '../content/resources.ts';
export const ORE_ITEMS = RESOURCES;
export const itemDefinition = resourceById;
export const oreDefinition = resourceByKind;
export const itemVolume = (id: string) => resourceById(id).volume;
export const itemPrice = (id: string) => resourceById(id).price;
export function oreDrops(resources: readonly {kind:number}[]) { return resources.map(({kind})=>({itemId:resourceByKind(kind).itemId,count:1})); }
