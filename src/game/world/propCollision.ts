import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Solid, V3 } from './sceneryKit.ts';

/** How a prop collides, as the function that builds it in Blender says (surface-game-art/tools/blender/collision.py):
 *  boxes and hulls in the prop's own frame (`solids`), its own triangles (`mesh`: the scene build turns them into a
 *  triangle solid), or nothing (`passable`, with the reason). Carried on the prop root as glTF extras. */
export type PropCollision = Readonly<{ solids?: readonly Solid[]; mesh?: boolean; passable?: string }>;

const round = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
const fromPoints = (points: readonly Vector3[], extra: Partial<Solid> = {}): Solid => {
  const bounds = new Box3().setFromPoints([...points]), c = bounds.getCenter(new Vector3()), h = bounds.getSize(new Vector3()).multiplyScalar(.5);
  return { at: c.toArray().map(round) as V3, half: h.toArray().map(v => round(Math.max(v, .01))) as V3, yaw: 0, ...extra };
};

/** A solid (in a prop's frame) where the prop stands: `matrix` takes the prop's frame into the scene's. A box keeps
 *  its shape while the turn is round Y only (and the scale keeps it square, if the box is turned in the prop);
 *  otherwise it becomes the hull of its corners. Hulls and triangles move point by point, turned by their own yaw
 *  first (as SceneryCollision turns them unplaced); the result carries no yaw of its own. */
export function placeSolid(solid: Solid, matrix: Matrix4): Solid {
  const position = new Vector3(), turn = new Quaternion(), scale = new Vector3();
  matrix.decompose(position, turn, scale);
  const at = new Vector3(...solid.at), own = new Matrix4().makeRotationY(solid.yaw);
  if (solid.triangles) {
    const { vertices, indices } = solid.triangles, points: Vector3[] = [];
    for (let i = 0; i < vertices.length; i += 3) points.push(new Vector3(vertices[i], vertices[i + 1], vertices[i + 2]).applyMatrix4(own).add(at).applyMatrix4(matrix));
    const placed = fromPoints(points), c = new Vector3(...placed.at);
    return { ...placed, triangles: { vertices: points.flatMap(p => p.sub(c).toArray().map(round)), indices: [...indices] } };
  }
  if (solid.hull) {
    const points: Vector3[] = [];
    for (let i = 0; i < solid.hull.length; i += 3) points.push(new Vector3(solid.hull[i], solid.hull[i + 1], solid.hull[i + 2]).applyMatrix4(own).add(at).applyMatrix4(matrix));
    const placed = fromPoints(points), c = new Vector3(...placed.at);
    return { ...placed, hull: points.flatMap(p => p.sub(c).toArray().map(round)) };
  }
  const yawOnly = Math.abs(turn.x) < 1e-6 && Math.abs(turn.z) < 1e-6, square = Math.abs(scale.x - scale.z) < 1e-6;
  if (yawOnly && (solid.yaw === 0 || square)) {
    const yaw = 2 * Math.atan2(turn.y, turn.w) + solid.yaw;
    return { at: at.applyMatrix4(matrix).toArray().map(round) as V3, half: solid.half.map((v, i) => round(v * Math.abs(scale.getComponent(i)))) as V3,
      yaw: round(Math.atan2(Math.sin(yaw), Math.cos(yaw))) };
  }
  const corners: Vector3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1])
    corners.push(new Vector3(x * solid.half[0], y * solid.half[1], z * solid.half[2]).applyMatrix4(own).add(at).applyMatrix4(matrix));
  const placed = fromPoints(corners), c = new Vector3(...placed.at);
  return { ...placed, hull: corners.flatMap(p => p.sub(c).toArray().map(round)) };
}

/** A prop's colliders where it stands; none if it is passable. Throws for a prop that never decided. */
export function placeProp(name: string, collision: PropCollision | undefined, matrix: Matrix4): Solid[] {
  if (!collision || !(collision.solids?.length || collision.mesh || collision.passable)) throw Error(`Prop ${name} has no collision decision (collision.py)`);
  if (collision.mesh) throw Error(`Prop ${name} collides with its own triangles: the scene build must turn them into a triangle solid`);
  return (collision.solids ?? []).map(s => placeSolid(s, matrix));
}

/** The matrix of a placement given as position, quaternion and scale (an authored instance). */
export const placement = (at: readonly number[], rotation: readonly number[], scale: readonly number[]) =>
  new Matrix4().compose(new Vector3(...at), new Quaternion(...rotation), new Vector3(...scale));
