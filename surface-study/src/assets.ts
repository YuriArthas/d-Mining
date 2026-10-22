import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** New Blender sources and authored pixel atlases; never screen pixelation. */
export async function loadBlockcraftAssets() {
  const loader=new GLTFLoader();
  const base=new URL('./assets/blockcraft/',document.baseURI);
  const url=(name:'architecture'|'nature')=>{const result=new URL(`${name}.glb`,base);result.searchParams.set('v',__ASSET_REVISIONS__[name]);return result.href;};
  const [architecture,nature]=await Promise.all([
    loader.loadAsync(url('architecture')),
    loader.loadAsync(url('nature')),
  ]);
  const materials=new Map<THREE.Material,THREE.MeshLambertMaterial>();
  const textures=new Set<THREE.Texture>();
  const meshStats:{name:string;triangles:number}[]=[];
  for(const gltf of [architecture,nature])gltf.scene.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const source=object.material as THREE.MeshStandardMaterial;
    if(Array.isArray(source))throw Error(`Asset ${object.name} must have one atlas material`);
    if(!object.geometry.hasAttribute('uv')||!source.map)throw Error(`Asset ${object.name} is missing its authored UV or atlas`);
    if(source.transparent)throw Error(`Asset ${object.name} must be opaque`);
    let material=materials.get(source);
    if(!material){
      const map=source.map;
      // Keep painted texels crisp nearby. Mip levels suppress distant shimmer
      // without applying any filter or resolution change to the scene output.
      map.magFilter=THREE.NearestFilter;map.minFilter=THREE.NearestMipmapNearestFilter;
      map.generateMipmaps=true;map.anisotropy=1;map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;
      material=new THREE.MeshLambertMaterial({map,color:source.color,vertexColors:object.geometry.hasAttribute('color'),name:source.name});
      materials.set(source,material);textures.add(map);
    }
    object.material=material;object.castShadow=true;object.receiveShadow=true;
    meshStats.push({name:object.name,triangles:(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3});
  });
  for(const material of materials.keys())material.dispose();
  const required=['tree_oak','tree_pine','bush','rock_a','rock_b','cliff','flower_yellow','flower_ivory','flower_purple','grass'];
  const models=new Map(required.map(name=>{
    const model=nature.scene.getObjectByName(name);
    if(!model)throw Error(`Nature asset ${name} is missing`);
    return [name,model] as const;
  }));
  return {
    architecture:architecture.scene,
    nature:(name:string)=>{
      const model=models.get(name);if(!model)throw Error(`Unknown nature asset ${name}`);
      return model.clone(true);
    },
    snapshot:()=>({method:'Blender authored meshes and pixel atlases',postPixelation:false,revisions:__ASSET_REVISIONS__,models:meshStats,atlases:[...textures].map(t=>{const image=t.image as {width:number;height:number};return {name:t.name,width:image.width,height:image.height,magFilter:'nearest',minFilter:'nearest-mipmap-nearest'};})}),
  };
}
