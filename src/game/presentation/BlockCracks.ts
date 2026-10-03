import { BoxGeometry, DataTexture, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, NearestFilter, RGBAFormat, ShaderChunk, SRGBColorSpace } from 'three';
import { CELL, RENDER_SIZE, chunkKey, regionOf, type Coord } from '../terrain/SparseWorld.ts';
import { crackAtlas, crackStage, CRACK_STAGES, CRACK_TILE } from './cracks.ts';
export type BlockDamage = Readonly<{ cell: Coord; hp: number; maximum: number }>;
type Mark = { cell: Coord; stage: number };
type Resident = { coord: Coord; resource: { mesh?: unknown } };
type Overlay = { mesh: InstancedMesh; stages: InstancedBufferAttribute; capacity: number };
// Disposable projection of damage. No gameplay state, terrain mutation or physics dependency.
export class BlockCracks {
  readonly group = new Group();
  private buckets = new Map<string, Map<string, Mark>>();
  private dirty = new Set<string>();
  private active = new Map<string, Overlay>();
  private texture: DataTexture;
  private material: MeshBasicMaterial;
  private matrix = new Matrix4();
  private updates = 0;
  constructor() {
    this.texture = new DataTexture(crackAtlas(), CRACK_TILE * CRACK_STAGES, CRACK_TILE, RGBAFormat);
    this.texture.colorSpace = SRGBColorSpace; this.texture.magFilter = this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false; this.texture.needsUpdate = true;
    this.material = new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float crackTile;\nvarying float vCrackTile;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvCrackTile = crackTile;');
      shader.fragmentShader = 'varying float vCrackTile;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )',
        `texture2D( map, vec2((vCrackTile + clamp(vMapUv.x, 0.015625, 0.984375)) / ${CRACK_STAGES.toFixed(1)}, clamp(vMapUv.y, 0.015625, 0.984375)))`) + '\nif (diffuseColor.a < 0.01) discard;');
    };
    this.material.customProgramCacheKey = () => 'block-cracks-v1';
  }
  setDamage = ({ cell, hp, maximum }: BlockDamage) => {
    const region = chunkKey(regionOf(cell, RENDER_SIZE)), key = chunkKey(cell), stage = maximum > 0 ? crackStage(hp, maximum) : 0;
    let bucket = this.buckets.get(region);
    if (stage) {
      if (bucket?.get(key)?.stage === stage) return;
      if (!bucket) this.buckets.set(region, bucket = new Map());
      bucket.set(key, { cell: [...cell], stage });
    } else {
      if (!bucket?.delete(key)) return;
      if (!bucket.size) this.buckets.delete(region);
    }
    this.dirty.add(region);
  };
  private remove(key: string, overlay: Overlay) {
    overlay.mesh.removeFromParent(); overlay.mesh.geometry.dispose(); overlay.mesh.dispose(); this.active.delete(key);
  }
  // Only visit resident regions; no scan of all damage accumulated across the mine.
  sync(residents: ReadonlyMap<string, Resident>) {
    for (const [key, overlay] of this.active) if (!residents.get(key)?.resource.mesh || !this.buckets.has(key)) this.remove(key, overlay);
    for (const [key, resident] of residents) {
      const bucket = this.buckets.get(key);
      if (!bucket || !resident.resource.mesh || (this.active.has(key) && !this.dirty.has(key))) continue;
      let overlay = this.active.get(key);
      if (!overlay || overlay.capacity < bucket.size) {
        if (overlay) this.remove(key, overlay);
        const capacity = 2 ** Math.ceil(Math.log2(bucket.size)), geometry = new BoxGeometry(CELL, CELL, CELL);
        const stages = new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
        geometry.setAttribute('crackTile', stages);
        const mesh = new InstancedMesh(geometry, this.material, capacity); mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.position.set(...resident.coord.map(v => v * RENDER_SIZE * CELL) as [number, number, number]);
        mesh.renderOrder = 2; this.group.add(mesh); overlay = { mesh, stages, capacity }; this.active.set(key, overlay);
      }
      let i = 0;
      for (const { cell, stage } of bucket.values()) {
        this.matrix.makeTranslation(...cell.map((v, axis) => (v - resident.coord[axis] * RENDER_SIZE + 0.5) * CELL) as [number, number, number]);
        overlay.mesh.setMatrixAt(i, this.matrix); overlay.stages.setX(i++, stage - 1);
      }
      overlay.mesh.count = i; overlay.mesh.instanceMatrix.needsUpdate = true; overlay.stages.needsUpdate = true;
      overlay.mesh.computeBoundingSphere(); this.updates++;
    }
    this.dirty.clear();
  }
  diagnostics() {
    return { regions: this.active.size, instances: [...this.active.values()].reduce((n, r) => n + r.mesh.count, 0),
      instanceBytes: [...this.active.values()].reduce((n, r) => n + r.capacity * 68, 0), atlasBytes: CRACK_TILE * CRACK_TILE * CRACK_STAGES * 4, updates: this.updates };
  }
  dispose() { for (const [key, overlay] of this.active) this.remove(key, overlay); this.buckets.clear(); this.dirty.clear(); this.material.dispose(); this.texture.dispose(); }
}
