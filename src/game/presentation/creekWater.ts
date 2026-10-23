import type { MeshStandardMaterial } from 'three';

/** World 1's creek (the landscape's `Creek water`, sunk 0.4 m below the meadow). Its `_creek` attribute holds
 *  across (0 at one bank, 1 at the other) and along (metres downstream). The material's own shader draws a
 *  stylised stream on it: light turquoise shallows at the banks deepening to blue mid-stream, streaks and
 *  sun glints drifting downstream, and broken foam with a wobbling edge along both banks.
 *  It stays a lit standard material: the baked shadows of the banks and the bridge fall on it, and with a
 *  low roughness the sky shows in it at grazing angles through the scene's environment light. */
const uniforms = { creekTime: { value: 0 } };
/** Per frame, with any monotonic clock in seconds. */
export function setCreekTime(seconds: number) { uniforms.creekTime.value = seconds % 4096; }

const CREEK_COLOR = `uniform float creekTime;
varying vec2 vCreek;
// Sine-free hash on a lattice wrapped to 0..288: along the creek and over time the coordinates grow into
// the thousands, where the usual sin() hash loses precision and collapses into lines along the flow.
float creekHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * 0.1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float creekNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	vec2 a = mod( i, 289.0 ), b = mod( i + 1.0, 289.0 );
	return mix( mix( creekHash( a ), creekHash( vec2( b.x, a.y ) ), f.x ), mix( creekHash( vec2( a.x, b.y ) ), creekHash( b ), f.x ), f.y );
}
vec3 creekColor( vec2 w, float t ) {
	float mid = 1.0 - abs( w.x * 2.0 - 1.0 );
	vec3 c = mix( vec3( 0.16, 0.62, 0.62 ), vec3( 0.015, 0.26, 0.42 ), smoothstep( 0.05, 0.8, mid ) );
	// Each layer drifts at one speed: a speed varying across the stream, multiplied by a growing time,
	// shears the pattern into hairlines along the flow.
	// Broad, soft streaks drifting downstream.
	float streak = creekNoise( vec2( w.x * 4.5, w.y * 0.32 - t * 0.55 ) );
	c += vec3( 0.07, 0.12, 0.12 ) * smoothstep( 0.58, 0.8, streak ) * ( 0.3 + 0.7 * mid );
	// Foam: a broken band along each bank with a wobbling edge, and a few flecks drifting off it.
	float wobble = ( creekNoise( vec2( w.y * 0.9 - t * 0.5, w.x * 4.0 ) ) - 0.5 ) * 0.06;
	float band = 1.0 - smoothstep( 0.05 + wobble, 0.10 + wobble, mid );
	float breakup = smoothstep( 0.3, 0.7, creekNoise( vec2( w.y * 2.2 - t * 0.8, w.x * 9.0 ) ) );
	float fleck = smoothstep( 0.82, 0.9, creekNoise( vec2( w.x * 18.0, w.y * 1.6 - t * 0.7 ) ) ) * ( 1.0 - smoothstep( 0.1, 0.3, mid ) );
	c = mix( c, vec3( 0.86, 0.95, 0.96 ), clamp( band * ( 0.55 + 0.45 * breakup ) + fleck * 0.7, 0.0, 0.92 ) );
	// Sparse sun glints sliding downstream.
	float glint = creekNoise( vec2( w.x * 26.0, w.y * 3.2 - t * 1.6 ) );
	return c + vec3( 0.45 ) * smoothstep( 0.92, 0.975, glint ) * smoothstep( 0.2, 0.6, mid );
}
`;

export function applyCreekWater(material: MeshStandardMaterial) {
  if (material.userData.creekWater) return;
  material.userData.creekWater = true;
  material.color.set('#ffffff'); material.roughness = .22; material.metalness = 0; material.envMapIntensity = .55;
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute vec2 _creek;\nvarying vec2 vCreek;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvCreek = _creek;');
    shader.fragmentShader = CREEK_COLOR + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb = creekColor( vCreek, creekTime );');
  };
  material.customProgramCacheKey = () => `${previousKey.call(material)}|creek-water-v4`;
}
