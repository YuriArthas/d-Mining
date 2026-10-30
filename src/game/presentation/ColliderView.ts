import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from 'three';
import type { RAPIER } from '../validation/physics.ts';

/** Testing aid (?debug=1, the unlock page's 显示碰撞): the colliders of the scenery near the player, drawn as lines
 *  through everything, Rapier's own debug view filtered to the colliders `shows` picks (the models' and the scenes'
 *  shapes; not the voxel terrain's, nor the valley's ground). Redrawn a few times a second while on. */
let shown = false;
const listeners = new Set<() => void>();
export const colliderViewShown = () => shown;
export function toggleColliderView() { shown = !shown; for (const listener of listeners) listener(); }

export class ColliderView {
  readonly lines = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: .85, toneMapped: false }));
  private frame = 0;
  private readonly world: RAPIER.World;
  private readonly shows: (collider: RAPIER.Collider) => boolean;
  private readonly onToggle = () => { this.lines.visible = shown; this.frame = 0; };
  constructor(world: RAPIER.World, shows: (collider: RAPIER.Collider) => boolean) {
    this.world = world; this.shows = shows;
    this.lines.name = 'Collider view'; this.lines.renderOrder = 999; this.lines.frustumCulled = false; this.lines.visible = shown;
    listeners.add(this.onToggle);
  }
  update() {
    if (!shown || this.frame++ % 12) return;
    const { vertices, colors } = this.world.debugRender(undefined, this.shows), geometry = this.lines.geometry;
    geometry.setAttribute('position', new BufferAttribute(vertices.slice(), 3));
    geometry.setAttribute('color', new BufferAttribute(colors.slice(), 4));
  }
  dispose() {
    listeners.delete(this.onToggle);
    this.lines.removeFromParent(); this.lines.geometry.dispose(); (this.lines.material as LineBasicMaterial).dispose();
  }
}
