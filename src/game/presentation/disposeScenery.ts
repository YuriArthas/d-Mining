import { SpotLight, InstancedMesh, Mesh, Texture, type Group, type BufferGeometry, type Material } from 'three';

export type SceneryResources={geometries:Set<BufferGeometry>;materials:Set<Material>;textures:Set<Texture>};
export function disposeScenery(group:Group,retained?:SceneryResources,externalTextures:ReadonlySet<Texture>=new Set()) {
  const geometries=retained?.geometries??new Set<BufferGeometry>(),materials=retained?.materials??new Set<Material>(),textures=retained?.textures??new Set<Texture>(),images=new Set<{close:()=>void}>();
  group.traverse(object=>{
    if(object instanceof InstancedMesh)object.dispose();
    if(object instanceof SpotLight)object.dispose();
    if(object instanceof Mesh){
      geometries.add(object.geometry);
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        materials.add(material);
        for(const value of Object.values(material))if(value instanceof Texture)textures.add(value);
      }
    }
    const disposeNoise=object.userData.disposeSurfaceNoise;
    delete object.userData.disposeSurfaceNoise;
    disposeNoise?.();
  });
  for(const texture of textures){
    if(externalTextures.has(texture))continue;
    const image=texture.source.data as {close?:()=>void}|null;
    if(image&&typeof image.close==='function')images.add(image as {close:()=>void});
    texture.dispose();
  }
  for(const image of images)image.close();
  for(const material of materials)material.dispose();
  for(const geometry of geometries)geometry.dispose();
  group.removeFromParent();
  group.clear();
}
