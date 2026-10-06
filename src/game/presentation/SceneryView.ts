import type { SurfaceScene } from "./assembleSurface.ts";
import { yieldLoadingTask } from "./prepareShaders.ts";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import type { ScenerySite } from "./SceneryCollision.ts";
import { createScenery, disposeScenery } from "./SceneryMesh.ts";
import type { SurfaceTime } from "../world/SceneLighting.ts";
import { sceneryGeometryMemory } from "./sceneryGeometryMemory.ts";

// Ordinary scene props use independent visual/physical residency. The voxel floor
// remains owned by terrain; the meadow apron is visual only and has an open shaft.
export class SceneryView {
  readonly group = new Group();
  revision = 0;
  private visuals = new Map<string, Group>();
  private geometryMemory = new Map<
    string,
    ReturnType<typeof sceneryGeometryMemory>
  >();
  private readonly surface: SurfaceScene;
  private readonly sites: readonly ScenerySite[];
  constructor(surface: SurfaceScene, sites: readonly ScenerySite[]) {
    this.sites = sites;
    this.surface = surface;
    this.visuals.set("surface", surface.group);
    this.group.add(surface.group);
    this.geometryMemory.set("surface", sceneryGeometryMemory(surface.group));
    this.revision++;
  }
  private ensureVisual(site: ScenerySite) {
    if (this.visuals.has(site.id)) return;
    const view = createScenery(site.plan);
    view.position.y = -site.depth;
    this.visuals.set(site.id, view);
    this.group.add(view);
    this.revision++;
    this.geometryMemory.set(site.id, sceneryGeometryMemory(view));
  }
  async prepare(
    signal: AbortSignal,
    onProgress: (done: number, total: number) => void,
  ) {
    for (const [i, site] of this.sites.entries()) {
      await yieldLoadingTask(signal);
      this.ensureVisual(site);
      onProgress(i + 1, this.sites.length);
    }
  }
  updateSurface(
    time: SurfaceTime,
    elapsed: number,
    bakedShadowsEnabled: boolean,
  ) {
    this.surface.details.update(time, elapsed, bakedShadowsEnabled);
  }
  beginSurfaceDraw() {
    this.surface.details.beginDraw();
  }
  surfaceHeight(x: number, z: number) {
    const surface = this.visuals.get("surface");
    if (!surface) return null;
    surface.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(x, 250, z), new Vector3(0, -1, 0)),
      ground: Mesh[] = [];
    surface.traverse((o) => {
      if (o instanceof Mesh && o.userData.surfaceGround === true)
        ground.push(o);
    });
    return ray.intersectObjects(ground, false)[0]?.point.y ?? null;
  }
  diagnostics() {
    return {
      ponds: this.visuals.get("surface")?.userData.ponds ?? null,
      boundaryStitching:
        this.visuals.get("surface")?.userData.boundaryStitching ?? null,
      surfaceDetails: this.surface.details.diagnostics() ?? null,
      surfaceHub: this.visuals.get("surface")?.userData.hub ?? null,
      visuals: [...this.visuals.keys()],
      authoredRooms: Object.fromEntries([...this.visuals].filter(([,g])=>g.userData.authoredRoom).map(([id,g])=>[id,g.userData.authoredRoom])),
      geometryMemory: Object.fromEntries(this.geometryMemory),
      surfaceShading:
        this.visuals.get("surface")?.userData.surfaceShading ?? null,
    };
  }
  dispose() {
    for (const [id, group] of this.visuals)
      if (id !== "surface") disposeScenery(group);
    this.surface.dispose();
    this.visuals.clear();
    this.geometryMemory.clear();
    this.group.removeFromParent();
    this.group.clear();
  }
}
