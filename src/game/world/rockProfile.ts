export type RockProfile='rock'|'bluff'|'grassTop';
// A continuous weathered shape, sampled independently for visual geometry and physics hulls.
export function rockProfile(kind:RockProfile='rock',size:readonly number[]=[1,1,1],sides=24,rings=16) {
  const vertices:number[]=[],indices:number[]=[];
  for(let j=0;j<=rings;j++){
    const theta=j/rings*Math.PI,up=(1-Math.cos(theta))*.5;
    const y=Math.max(0,up*1.12-.12),radius=Math.pow(Math.sin(theta),kind==='bluff'?.48:.72);
    for(let i=0;i<sides;i++){
      const a=i/sides*Math.PI*2;
      const wave=1+.06*Math.sin(a*3+.8)+.035*Math.cos(a*5-2*up)+.028*Math.sin(up*8+a*2);
      vertices.push((Math.cos(a)*radius*wave*.5+.055*Math.sin(up*2.6))*size[0],y*size[1],(Math.sin(a)*radius*wave*.5+.025*Math.sin(up*4))*size[2]);
    }
  }
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){
    const a=j*sides+i,b=j*sides+(i+1)%sides,c=a+sides,d=b+sides;
    indices.push(a,c,b,b,c,d);
  }
  return {vertices,indices};
}
