import {
  Group,
  Mesh,
  Texture,
  type BufferGeometry,
  type Material,
} from "three";
import { disposeScenery, type SceneryResources } from "./disposeScenery.ts";

// Session-scoped ownership, not a global cache. Retains resources even when batching or
// per-instance styling replaces the node/material that originally referenced them.
export class SceneAssetBundle {
  private readonly resources: SceneryResources = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
  };
  private disposed = false;
  retain(root: Group) {
    if (this.disposed) throw Error("Asset bundle disposed");
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      this.resources.geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        this.resources.materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof Texture) this.resources.textures.add(value);
      }
    });
  }
  dispose(root: Group, externalTextures: ReadonlySet<Texture>) {
    if (this.disposed) return;
    this.disposed = true;
    disposeScenery(root, this.resources, externalTextures);
    this.resources.geometries.clear();
    this.resources.materials.clear();
    this.resources.textures.clear();
  }
}
