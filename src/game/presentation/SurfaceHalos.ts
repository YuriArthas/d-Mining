import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Matrix4, Mesh, Quaternion, ShaderMaterial, Vector3 } from 'three';
import glow from '../content/pinewind/architecture-glow.json' with { type: 'json' };
import type { AuthoredInstance } from '../content/authoredSurface.ts';

type Halo = { node: string; at: [number, number, number]; size: number; color: string };

/** Soft halos round the valley's lights (lamp glass, the beacon, the magma; listed by the Blender build in each
 *  model's own frame): one camera-facing quad each, `size` metres across, fading from the middle, added on top
 *  of the scene without writing depth. All of them are one mesh and one draw. */
export function surfaceHalos(instances: readonly AuthoredInstance[]): Mesh | null {
  const center: number[] = [], corner: number[] = [], tint: number[] = [], index: number[] = [];
  const m = new Matrix4(), p = new Vector3(), c = new Color();
  for (const instance of instances) {
    if (instance.asset !== 'pinewind-architecture') continue;
    m.compose(new Vector3(...instance.at), new Quaternion(...instance.rotation), new Vector3(...instance.scale));
    for (const h of glow.halos as Halo[]) {
      if (h.node !== instance.node) continue;
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
