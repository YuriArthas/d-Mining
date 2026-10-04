import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { RAPIER, type CharacterPhysics } from '../validation/physics.ts';
import { CELL, RENDER_SIZE, COLLISION_SIZE, SparseWorld } from './SparseWorld.ts';
import { createMineralMaterial } from './mineralMaterial.ts';
import { RegionPipeline, Measurements, type WorkerFactory } from './RegionPipeline.ts';
export type RenderResource = { mesh?: Mesh; wire?: Mesh; bytes: number; triangles: number };
export type CollisionResource = { collider?: RAPIER.Collider; bytes: number; triangles: number };
export class RenderTerrain {
  readonly group = new Group();
  readonly pipeline: RegionPipeline<RenderResource>;
  private readonly surface:ReturnType<typeof createMineralMaterial>;
  diagnostics() {
    const meshes = [...this.pipeline.residents.values()].flatMap(r => r.resource.mesh ? [r.resource.mesh] : []);
    return { materials: new Set(meshes.map(m => m.material)).size, atlases: new Set(meshes.map(m => (m.material as typeof this.surface.material).map)).size,
      atlasBytes: this.surface.atlasBytes, responseAtlasBytes:this.surface.responseAtlasBytes, regionMeshes: meshes.length };
  }
  private wireframe = false;
  private readonly wireMaterial = new MeshBasicMaterial({ color: '#213746', wireframe: true, depthWrite: false });
  private showWire(resource: RenderResource) {
    if (this.wireframe && resource.mesh && !resource.wire) {
      resource.wire = new Mesh(resource.mesh.geometry, this.wireMaterial);
      resource.wire.position.copy(resource.mesh.position); resource.wire.renderOrder = 1;
      this.group.add(resource.wire);
    }
    if (resource.wire) resource.wire.visible = this.wireframe;
  }
  setWireframe(enabled: boolean) {
    this.wireframe = enabled;
    this.surface.material.polygonOffset = enabled;
    this.surface.material.polygonOffsetFactor = 1; this.surface.material.polygonOffsetUnits = 1;
    for (const resident of this.pipeline.residents.values()) this.showWire(resident.resource);
  }
  constructor(world: SparseWorld, metrics: Measurements, factory: WorkerFactory) {
    this.surface=createMineralMaterial(world.generation.layers);
    this.pipeline = new RegionPipeline('render', RENDER_SIZE, 54, 78, 0, world, {
      prepare: ({ coord, mesh: m }) => {
        const resource: RenderResource = { bytes: m.positions.byteLength + m.normals.byteLength + m.uvs.byteLength + m.tiles.byteLength + m.indices.byteLength, triangles: m.indices.length / 3 };
        if (m.indices.length) {
          const geometry = new BufferGeometry();
          geometry.setAttribute('position', new BufferAttribute(m.positions, 3)); geometry.setAttribute('normal', new BufferAttribute(m.normals, 3));
          geometry.setAttribute('uv', new BufferAttribute(m.uvs, 2)); geometry.setAttribute('oreTile', new BufferAttribute(m.tiles, 1)); geometry.setIndex(new BufferAttribute(m.indices, 1)); geometry.computeBoundingSphere();
          resource.mesh = new Mesh(geometry, this.surface.material); resource.mesh.receiveShadow=true; resource.mesh.position.set(...coord.map(v => v * RENDER_SIZE * CELL) as [number, number, number]);
        }
        return resource;
      },
      activate: r => { if (r.mesh) this.group.add(r.mesh); this.showWire(r); },
      dispose: r => { r.wire?.removeFromParent(); if (r.mesh) { r.mesh.removeFromParent(); r.mesh.geometry.dispose(); } },
    }, metrics, factory);
  }
  dispose() { this.pipeline.dispose(); this.surface.dispose(); this.wireMaterial.dispose(); }
}
export class CollisionTerrain {
  readonly pipeline: RegionPipeline<CollisionResource>;
  readonly handles = new Set<number>();
  created = 0; removed = 0;
  constructor(world: SparseWorld, physics: CharacterPhysics, metrics: Measurements, factory: WorkerFactory) {
    this.pipeline = new RegionPipeline('collision', COLLISION_SIZE, 12, 22, 8, world, {
      prepare: ({ coord, mesh: m }) => {
        // No render geometry or material data retained; Rapier owns its internal copy.
        const r: CollisionResource = { bytes: m.positions.byteLength + m.indices.byteLength, triangles: m.indices.length / 3 };
        if (m.indices.length) {
          r.collider = physics.world.createCollider(RAPIER.ColliderDesc.trimesh(m.positions, m.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
            .setTranslation(...coord.map(v => v * COLLISION_SIZE * CELL) as [number, number, number]).setEnabled(false));
          this.created++;
        }
        return r;
      },
      activate: r => { if (r.collider) { r.collider.setEnabled(true); this.handles.add(r.collider.handle); } },
      dispose: r => { if (r.collider) { this.handles.delete(r.collider.handle); physics.world.removeCollider(r.collider, false); this.removed++; } },
    }, metrics, factory);
  }
  dispose() { this.pipeline.dispose(); }
}
