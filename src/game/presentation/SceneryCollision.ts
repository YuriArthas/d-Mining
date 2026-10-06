import { RAPIER, type CharacterPhysics } from "../validation/physics.ts";
import type { SceneryPlan } from "../world/sceneryKit.ts";

export type ScenerySite = Readonly<{
  id: string;
  depth: number;
  plan: SceneryPlan;
}>;

// Borrow the world. Own only these ordinary-prop collider handles; voxel physics is separate.
export class SceneryCollision {
  private readonly physics: CharacterPhysics;
  private readonly entries;
  private readonly handles = new Map<string, RAPIER.Collider>();
  constructor(physics: CharacterPhysics, sites: readonly ScenerySite[]) {
    this.physics = physics;
    this.entries = sites.flatMap((site) =>
      site.plan.solids.map((solid, i) => ({
        key: `${site.id}:${i}`,
        depth: site.depth,
        solid,
      })),
    );
  }
  sync(feet: readonly number[]) {
    for (const { key, depth, solid } of this.entries) {
      const distance = Math.max(
        Math.abs(feet[0] - solid.at[0]) - solid.half[0],
        Math.abs(feet[1] + depth - solid.at[1]) - solid.half[1],
        Math.abs(feet[2] - solid.at[2]) - solid.half[2],
        0,
      );
      if (distance <= 12 && !this.handles.has(key)) {
        const shape = solid.triangles
          ? RAPIER.ColliderDesc.trimesh(
              new Float32Array(solid.triangles.vertices),
              new Uint32Array(solid.triangles.indices),
              RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
            )
          : solid.hull
            ? RAPIER.ColliderDesc.convexHull(new Float32Array(solid.hull))
            : RAPIER.ColliderDesc.cuboid(...solid.half);
        if (!shape) throw new Error(`场景碰撞凸包构建失败: ${key}`);
        shape.setTranslation(solid.at[0], solid.at[1] - depth, solid.at[2]);
        shape.setRotation({
          x: 0,
          y: Math.sin(solid.yaw / 2),
          z: 0,
          w: Math.cos(solid.yaw / 2),
        });
        this.handles.set(key, this.physics.world.createCollider(shape));
      }
      if (distance > 22 && this.handles.has(key)) {
        this.physics.world.removeCollider(this.handles.get(key)!, false);
        this.handles.delete(key);
      }
    }
  }
  get count() {
    return this.handles.size;
  }
  dispose() {
    for (const collider of this.handles.values())
      this.physics.world.removeCollider(collider, false);
    this.handles.clear();
  }
}
