import { BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Group, InstancedMesh, Mesh, Object3D, Shape, Vector2 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { along, guideRoute, routeLength } from '../world/guideRoute.ts';

/** The first-dig guide (2026-10-29, the user's pick from in-scene mock-ups): a dotted line of chunky white chevrons
 *  with a dark-blue rim, along the way to the mine (over the creek by the bridge, each chevron on the surface under
 *  it, so it rides the bridge's arch instead of cutting through it), sliding forward; over the mine a big white
 *  arrow points down and bobs. Unlit and opaque: it reads on sand, grass and wood alike. */
const FACE = '#ffffff', RIM = '#22356e';
const SPACING = 1.7, SPEED = 1.6, SIZE = 1, LIFT = .26, TILT = .6, RAMP = 1.4, NEAR = 1.2;
export const GUIDE_CHEVRONS = 48;

/** A closed counter-clockwise outline pushed out by `w` (mitred corners): the rim behind the face. */
function grow(points: readonly Vector2[], w: number) {
  return points.map((p, i) => {
    const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    const a = p.clone().sub(prev).normalize(), b = next.clone().sub(p).normalize();
    const out = new Vector2(a.y, -a.x).add(new Vector2(b.y, -b.x)).normalize();
    return p.clone().add(out.multiplyScalar(w / Math.max(out.dot(new Vector2(a.y, -a.x)), .35)));
  });
}
/** The white face in front of its dark rim, extruded toward +Z, coloured per vertex. */
function piece(points: readonly Vector2[], rim: number, depth: number) {
  const part = (outline: readonly Vector2[], colour: string, from: number, thickness: number) => {
    const g = new ExtrudeGeometry(new Shape([...outline]), { depth: thickness, bevelEnabled: false }).translate(0, 0, from);
    const c = new Color(colour), n = g.getAttribute('position').count;
    g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => c.toArray()[i % 3]), 3));
    return g;
  };
  return mergeGeometries([part(points, FACE, 0, depth), part(grow(points, rim), RIM, -depth * .4, depth)])!;
}
/** A chevron one metre wide pointing +Z, lying flat, its face up. */
export function chevronGeometry(): BufferGeometry {
  const v = [[0, .35], [-.5, -.15], [-.5, -.46], [0, .04], [.5, -.46], [.5, -.15]].map(([x, y]) => new Vector2(x, y));
  return piece(v, .07, .08).rotateX(-Math.PI / 2).rotateY(Math.PI);
}
/** The arrow over the mine: pointing down, its face toward +Z (turned to the camera). */
export function markerGeometry(): BufferGeometry {
  const v = [[0, -.6], [.42, -.12], [.16, -.12], [.16, .45], [-.16, .45], [-.16, -.12], [-.42, -.12]].map(([x, y]) => new Vector2(x, y));
  return piece(v, .07, .12);
}

const dummy = new Object3D();
/** Lays the chevrons along the way from `feet` to `target` this frame. `surface(x, z)` is the height of what stands
 *  there (null where nothing is known: the last height carries on). */
export function updateGuidePath(group: Group, feet: readonly number[], target: readonly number[], camera: readonly number[], time: number,
  surface: (x: number, z: number) => number | null) {
  const [chevrons, marker] = group.children as [InstancedMesh, Mesh];
  const route = guideRoute(feet, target), length = routeLength(route), end = length - NEAR;
  let last = feet[1], count = 0;
  const height = (x: number, z: number) => (last = surface(x, z) ?? last);
  for (let s = NEAR + (time * SPEED) % SPACING; s <= end && count < GUIDE_CHEVRONS; s += SPACING) {
    const p = along(route, s), y = height(p.x, p.z), ahead = along(route, s + .4), slope = Math.atan2((surface(ahead.x, ahead.z) ?? y) - y, .4);
    const k = Math.min(1, (s - NEAR) / RAMP, (end - s) / RAMP);
    dummy.position.set(p.x, y + LIFT, p.z);
    dummy.rotation.set(-(TILT + slope), Math.atan2(p.dx, p.dz), 0, 'YXZ');
    dummy.scale.setScalar(SIZE * Math.max(.05, k));
    dummy.updateMatrix(); chevrons.setMatrixAt(count++, dummy.matrix);
  }
  chevrons.count = count; chevrons.instanceMatrix.needsUpdate = true;
  const ground = surface(target[0], target[2]) ?? target[1];
  marker.position.set(target[0], ground + 2.6 + .25 * Math.sin(time * 2.6), target[2]);
  marker.rotation.set(0, Math.atan2(camera[0] - target[0], camera[2] - target[2]), 0);
  marker.scale.setScalar(1.6);
  group.userData.route = route.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]);
  group.userData.chevrons = count;
  group.userData.marker = marker.position.toArray();
}

