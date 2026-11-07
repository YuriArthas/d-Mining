type CameraPose={position:readonly number[];target:readonly number[]};
/** OrbitControls normalizes spherical coordinates on update/restore. Treat only
 * sub-micrometre roundoff as equal; actual movement must invalidate the run. */
export function sameBenchmarkCamera(a:CameraPose,b:CameraPose){
  return (['position','target'] as const).every(key=>a[key].length===3&&b[key].length===3&&a[key].every((value,i)=>Number.isFinite(value)&&Number.isFinite(b[key][i])&&Math.abs(value-b[key][i])<=1e-7));
}
