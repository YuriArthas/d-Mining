import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Matrix4, Mesh, Quaternion, ShaderMaterial, Vector3 } from 'three';
import glow from '../content/pinewind/architecture-glow.json' with { type: 'json' };
import type { AuthoredInstance } from '../content/authoredSurface.ts';
import { TECH_BASE } from '../content/world2/techBase.ts';
import { STAR_BASE } from '../content/world3/starBase.ts';

type Halo = { at: readonly [number, number, number]; size: number; color: string };

/** World 2's lights in the tech base's frame: each lamp post's lantern (4.7 m up, build_tech_base.py) and the
 *  beacon on the antenna mast (14.2 m above its foot). */
const TECH_BASE_HALOS: readonly Halo[] = [
  ...TECH_BASE.lamps.map(([x, z]) => ({ at: [x, 4.7, z] as const, size: 1.3, color: 'ffcf6a' })),
  { at: [TECH_BASE.beacon[0], TECH_BASE.beacon[1] + 14.2, TECH_BASE.beacon[2]], size: 1.6, color: 'ff9a3a' },
];
/** World 3's: each star lantern's heart (4.85 m up, build_star_base.py) and the fallen star over the shaft. */
const STAR_BASE_HALOS: readonly Halo[] = [
  ...STAR_BASE.lamps.map(([x, z]) => ({ at: [x, 4.85, z] as const, size: 1.4, color: 'ffcf6a' })),
  { at: STAR_BASE.star.at, size: 16, color: 'ffd86a' },
];
/** The halos an instance carries, in its own frame. */
function halosOf(instance: AuthoredInstance): readonly Halo[] {
  if (instance.asset === 'pinewind-architecture') return (glow.halos as unknown as (Halo & { node: string })[]).filter(h => h.node === instance.node);
  if (instance.asset === TECH_BASE.asset) return TECH_BASE_HALOS;
  if (instance.asset === STAR_BASE.asset) return STAR_BASE_HALOS;
  return [];
}

/** Soft halos round the worlds' lights (the valley's lamp glass, beacon and magma, listed by the Blender build in
 *  each model's own frame; world 2's lamps and beacon; world 3's lanterns and its fallen star): one camera-facing quad each, `size` metres across, fading
 *  from the middle, added on top of the scene without writing depth. All of one batch of instances are one mesh
 *  and one draw. */
export function surfaceHalos(instances: readonly AuthoredInstance[]): Mesh | null {
  const center: number[] = [], corner: number[] = [], tint: number[] = [], index: number[] = [];
  const m = new Matrix4(), p = new Vector3(), c = new Color();
  for (const instance of instances) {
    const halos = halosOf(instance);
    if (!halos.length) continue;
    m.compose(new Vector3(...instance.at), new Quaternion(...instance.rotation), new Vector3(...instance.scale));
    for (const h of halos) {
      p.set(...h.at).applyMatrix4(m); c.set(`#${h.color}`);
      const first = center.length / 3;
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { center.push(p.x, p.y, p.z); corner.push(x * h.size / 2, y * h.size / 2); tint.push(c.r, c.g, c.b); }
      index.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  }
  if (!index.length) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(center, 3));
  geometry.setAttribute('corner', new Float32BufferAttribute(corner, 2));
  geometry.setAttribute('tint', new Float32BufferAttribute(tint, 3));
  geometry.setIndex(index);
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    vertexShader: `attribute vec2 corner; attribute vec3 tint; varying vec2 vCorner; varying vec3 vTint;
      void main(){
        vCorner = sign( corner ); vTint = tint;
        vec4 view = modelViewMatrix * vec4( position, 1.0 );
        view.xy += corner;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `varying vec2 vCorner; varying vec3 vTint;
      void main(){
        float d = length( vCorner );
        float a = pow( max( 1.0 - d, 0.0 ), 2.2 ) * .55;
        gl_FragColor = vec4( vTint, a );
      }`,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'surface-halos'; mesh.frustumCulled = false; mesh.renderOrder = 4;
  return mesh;
}
