import { CustomToneMapping, NeutralToneMapping, ShaderChunk, type WebGLRenderer } from 'three';

/** Colour finishing folded into tone mapping: Neutral tone mapping, then a gentle midtone contrast
 *  and a boost to greens (grass, leaves) in display space. It runs inside each material's own
 *  shader, so it costs no extra pass or framebuffer copy; materials with toneMapped = false (the
 *  sky) are untouched. Values were chosen side by side on the public build (tools/check-lighting-tone). */
export const TONE_GRADE = { contrast: 0.45, saturation: 1.03, greenSaturation: 1.14 } as const;

const STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
const n = (x: number) => x.toFixed(4);
if (!ShaderChunk.tonemapping_pars_fragment.includes(STUB) && !ShaderChunk.tonemapping_pars_fragment.includes('mining-tone-grade')) {
  throw Error('three.js tone mapping chunk changed: update toneGrade.ts');
}
ShaderChunk.tonemapping_pars_fragment = ShaderChunk.tonemapping_pars_fragment.replace(STUB, `// mining-tone-grade
vec3 CustomToneMapping( vec3 color ) {
	vec3 c = NeutralToneMapping( color );
	// Grade in (approximately) display-encoded values, the space the look was judged in.
	vec3 d = pow( max( c, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
	float l = dot( d, vec3( 0.2126, 0.7152, 0.0722 ) );
	// Bounded S curve: black and white stay put.
	float shaped = l + ${n(TONE_GRADE.contrast)} * ( l - 0.5 ) * l * ( 1.0 - l );
	d *= shaped / max( l, 0.00001 );
	float green = smoothstep( 0.025, 0.22, d.g - max( d.r, d.b ) );
	d = mix( vec3( shaped ), d, mix( ${n(TONE_GRADE.saturation)}, ${n(TONE_GRADE.greenSaturation)}, green ) );
	// Softly contain values pushed past white instead of clipping single channels.
	float peak = max( d.r, max( d.g, d.b ) );
	if ( peak > 0.96 ) d *= ( 0.96 + 0.04 * ( 1.0 - exp( -( peak - 0.96 ) / 0.04 ) ) ) / peak;
	return pow( max( d, vec3( 0.0 ) ), vec3( 2.2 ) );
}`);

/** The game's tone mapping; `false` falls back to plain Neutral (for side-by-side checks). */
export function applyToneGrade(renderer: WebGLRenderer, enabled = true) {
  renderer.toneMapping = enabled ? CustomToneMapping : NeutralToneMapping;
}
