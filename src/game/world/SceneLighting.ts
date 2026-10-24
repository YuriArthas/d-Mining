/** Daylight over the valley, chosen side by side on the public build (tools/check-lighting-tone): a strong
 *  warm-white sun from behind the arriving player, and a weak, nearly neutral sky/ground fill so shaded
 *  sides stay readable without a cyan haze. Intensities assume SURFACE_EXPOSURE. The surface is always day;
 *  underground, each layer has its own dark mood (EnvironmentController). */
export const SURFACE_DAYLIGHT={
 sunPosition:[-35,60,35] as [number,number,number],sunColor:'#ffeed2',sunIntensity:3.18,
 skyColor:'#d9e4ea',groundColor:'#867f5c',ambientIntensity:.38,environmentIntensity:.163,
} as const;
/** The surface light's values (tunable live through the debug lightingLook). */
export type SurfaceLook={sunPosition:readonly [number,number,number];sunColor:string;sunIntensity:number;skyColor:string;groundColor:string;ambientIntensity:number;environmentIntensity:number};
/** Renderer exposure under Neutral tone mapping. */
export const SURFACE_EXPOSURE=1.08;
