import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, ShaderMaterial } from 'three';
import type { Shape } from '../world/sceneryKit.ts';

const SEGMENTS = 64;
/** The rim's outer edge, where the curtain stands, as a fraction of the radius: the dark outline beyond it ends at
 *  the radius, so the pad shows exactly where it works and stays off props built round the trigger. */
const RIM = .89;
/** Dark outline colour, the signs' plate navy: it keeps a light pad readable on the pale sand. */
const INK = '#18283d';
/** One clock for every pad, read as they are drawn. */
const time = { value: 0 };

/** The sell and shop pads players step into (2026-11-01: the thin glowing line before them did not read on the
 *  plaza's sand or from the third-person camera's low angle): a tinted floor with a ripple running out to a thick
 *  bright rim between dark outlines, and a low curtain of light round the rim, fading upward. All pads of one plan
 *  are one mesh and one draw. `size[0]` is the radius, `size[1]` the curtain's height (PAD_CURTAIN); `at` the floor's centre. */
export function servicePads(pads: readonly Shape[]): Mesh | null {
  if (!pads.length) return null;
  const position: number[] = [], local: number[] = [], side: number[] = [], tint: number[] = [], floor: number[] = [], wall: number[] = [];
  const c = new Color();
  const vertex = (x: number, y: number, z: number, u: number, v: number, s: number) => {
    position.push(x, y, z); local.push(u, v); side.push(s); tint.push(c.r, c.g, c.b);
    return position.length / 3 - 1;
  };
  for (const pad of pads) {
    const [x, y, z] = pad.at, [radius, curtain] = pad.size;
    c.set(pad.color);
    const centre = vertex(x, y, z, 0, 0, 0), edge: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i / SEGMENTS * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      edge.push(vertex(x + dx * radius, y, z + dz * radius, dx, dz, 0));
    }
    for (let i = 0; i < SEGMENTS; i++) floor.push(centre, edge[(i + 1) % SEGMENTS], edge[i]);
    const base: number[] = [], top: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = i / SEGMENTS * Math.PI * 2, dx = Math.cos(a) * radius * RIM, dz = Math.sin(a) * radius * RIM;
      base.push(vertex(x + dx, y, z + dz, i / SEGMENTS, 0, 1));
      top.push(vertex(x + dx, y + curtain, z + dz, i / SEGMENTS, 1, 1));
    }
    for (let i = 0; i < SEGMENTS; i++) wall.push(base[i], base[i + 1], top[i + 1], base[i], top[i + 1], top[i]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('local', new Float32BufferAttribute(local, 2));
  geometry.setAttribute('side', new Float32BufferAttribute(side, 1));
  geometry.setAttribute('tint', new Float32BufferAttribute(tint, 3));
  // Floors first, then the curtains over them.
  geometry.setIndex([...floor, ...wall]);
  geometry.computeBoundingSphere();
  const material = new ShaderMaterial({
    uniforms: { uTime: time, uInk: { value: new Color(INK) } },
    // Untoned, like a sign's word: the tone curve dulled the light pad colours into the sand.
    transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false,
    vertexShader: `attribute vec2 local; attribute float side; attribute vec3 tint;
      varying vec2 vLocal; varying float vSide; varying vec3 vTint;
      void main(){
        vLocal = local; vSide = side; vTint = tint;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uInk;
      varying vec2 vLocal; varying float vSide; varying vec3 vTint;
      void main(){
        // The pads' colours are the signs' light ones: deepen and saturate them so they stand off the pale sand.
        float grey = dot( vTint, vec3( .2126, .7152, .0722 ) );
        // The bright one is the same hue lifted, not mixed toward white (that turned orange pink).
        vec3 deep = clamp( mix( vec3( grey ), vTint, 1.9 ), 0.0, 1.0 ) * .74, bright = min( deep * 1.35 + .04, vec3( 1.0 ) );
        vec4 c;
        if ( vSide > .5 ) {
          // The curtain: a glow strongest at the floor and soon gone (a stronger one read as a pane of glass from the
          // side), bands of light rising through it.
          float h = vLocal.y, rise = sin( ( h * 1.6 - uTime * .7 ) * 6.2832 ) * .5 + .5;
          c = vec4( mix( deep, bright, rise ), pow( 1.0 - h, 1.7 ) * ( .42 + .22 * rise ) );
        } else {
          float d = length( vLocal ), aa = fwidth( d ) * 1.2;
          // Coloured floor, stronger toward the rim, and a light ripple running out from the middle.
          c = vec4( deep, .62 + .2 * smoothstep( .18, .66, d ) );
          float run = fract( uTime * .55 ), ripple = ( 1.0 - smoothstep( .03, .03 + aa + .02, abs( d - run * .64 ) ) ) * ( 1.0 - run );
          c = mix( c, vec4( mix( bright, vec3( 1.0 ), .5 ), .95 ), ripple * .85 );
          // Thick bright rim between two dark outlines, the outer one ending at the radius.
          float rim = smoothstep( .71 - aa, .71 + aa, d ) * ( 1.0 - smoothstep( ${RIM} - aa, ${RIM} + aa, d ) );
          c = mix( c, vec4( bright * ( .93 + .07 * sin( uTime * 3.0 ) ), 1.0 ), rim );
          float ink = smoothstep( .66 - aa, .66 + aa, d ) * ( 1.0 - smoothstep( .71 - aa, .71 + aa, d ) )
            + smoothstep( ${RIM} - aa, ${RIM} + aa, d );
          c = mix( c, vec4( uInk, .9 ), clamp( ink, 0.0, 1.0 ) );
          c.a *= 1.0 - smoothstep( 1.0 - aa, 1.0, d );
        }
        gl_FragColor = c;
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'service-pads'; mesh.renderOrder = 3;
  mesh.onBeforeRender = () => { time.value = performance.now() / 1000 % 4096; };
  return mesh;
}
