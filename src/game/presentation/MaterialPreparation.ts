import type {MeshStandardMaterial} from 'three';

// Only remove channels whose multiplier makes them mathematically inactive.
// Shared packed textures remain owned by any other live material channel.
export function pruneInactiveMaps(material:MeshStandardMaterial){
 let removed=0;
 if(material.metalness===0&&material.metalnessMap){material.metalnessMap=null;removed++;}
 if(material.normalMap&&material.normalMapType===0&&material.normalScale.x===0&&material.normalScale.y===0){material.normalMap=null;removed++;}
 if(material.aoMap&&material.aoMapIntensity===0){material.aoMap=null;removed++;}
 return removed;
}
