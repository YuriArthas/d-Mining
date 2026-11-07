export type DistrictPipeline='reference'|'fused'|'static';
export type DistrictDiagnostic='none'|'no-halo'|'no-environment'|'no-shadow'|'baked-material';
export type DistrictVariant={id:string;label:string;pipeline:DistrictPipeline;diagnostic:DistrictDiagnostic;diagnosticOnly:boolean};

// Independent removals against the same new baseline. Diagnostic images are
// deliberately incomplete and are never selected by the normal scene UI.
export const districtVariants:readonly DistrictVariant[]=[
  {id:'fused',label:'上一版光晕',pipeline:'fused',diagnostic:'none',diagnosticOnly:false},
  {id:'static',label:'半分辨率光晕',pipeline:'static',diagnostic:'none',diagnosticOnly:false},
  {id:'no-halo',label:'诊断：无光晕',pipeline:'static',diagnostic:'no-halo',diagnosticOnly:true},
  {id:'no-environment',label:'诊断：无环境光与反射',pipeline:'static',diagnostic:'no-environment',diagnosticOnly:true},
  {id:'no-shadow',label:'诊断：无月光阴影采样',pipeline:'static',diagnostic:'no-shadow',diagnosticOnly:true},
  {id:'baked-material',label:'诊断：仅贴图与烘焙光',pipeline:'static',diagnostic:'baked-material',diagnosticOnly:true},
];
export function districtComparisonVariants(mode:'day'|'night'){
  return districtVariants.filter(v=>mode==='night'||v.id!=='baked-material');
}
export function balancedDistrictOrder(variants:readonly DistrictVariant[]){
  return [...variants,...variants.slice().reverse()];
}
