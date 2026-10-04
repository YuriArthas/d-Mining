import type { Theme } from '../content/themes.ts';
export type V3 = [number,number,number];
export type Shape = { type:'box'|'cone'|'rock'|'cylinder'|'ring'|'foliage'|'cap'|'torus'|'crystal'|'gable'|'crown'|'cutRock'|'horizon'|'terrainBackdrop'|'trunk'|'arch'|'awning'|'gem'|'bluff'|'grassTop'|'lathe'|'sweep'|'slab'|'plaque'|'leaf'|'cartShell'|'trail'; at:V3; size:V3; color:string; rotation?:V3; glow?:boolean; bevel?:number; material?:'stone'|'leaves'|'metal'|'water'|'wood'|'canvas'|'trail'|'ground'|'grass'; contour?:[number,number][]; path?:V3[]; radii?:number[] };
export type Solid = { at:V3; half:V3; yaw:number; hull?:number[]; triangles?:{vertices:number[];indices:number[]} };
export type Sign = { at:V3; width:number; title:string; subtitle:string; color:string; background:string; style?:'facility'; yaw?:number };
export type SceneryPlan = { shapes:Shape[]; solids:Solid[]; signs:Sign[]; style?:'smooth'|'plastic'|'sculpted'; meadow?:boolean };
export const WOOD='#986b48', DARK='#594536', METAL='#425658', CREAM='#f0ddb0';
// Pure descriptors shared by visual and physical residency. No Three.js/Rapier dependency.
export class Planner {
  readonly plan:SceneryPlan={shapes:[],solids:[],signs:[]};
  box(at:V3,size:V3,color:string,solid=false,rotation:V3=[0,0,0],glow=false) {
    this.plan.shapes.push({type:'box',at,size,color,rotation,glow});
    if(solid)this.plan.solids.push({at,half:size.map(v=>v/2) as V3,yaw:rotation[1]});
  }
  shape(type:Shape['type'],at:V3,size:V3,color:string,rotation:V3=[0,0,0],glow=false) { this.plan.shapes.push({type,at,size,color,rotation,glow}); }
  beam(a:V3,b:V3,width:number,color:string) {
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
    this.box(a.map((v,i)=>(v+b[i])/2) as V3,[width,length,width],color,false,[Math.atan2(dz,dy),0,-Math.asin(dx/length)]);
  }
  sign(at:V3,width:number,title:string,subtitle:string,t:Theme) {
    this.plan.signs.push({at,width,title,subtitle,color:t.accent,background:t.wood});
  }
  lantern(x:number,y:number,z:number,t:Theme) {
    this.box([x,y+.4,z],[.16,.5,.16],t.wood);
    this.box([x,y,z],[.5,.65,.5],t.accent,false,[0,0,0],true);
    for(const dy of [-.4,.4])this.box([x,y+dy,z],[.7,.12,.7],METAL);
    for(const dx of [-.27,.27])for(const dz of [-.27,.27])this.box([x+dx,y,z+dz],[.08,.8,.08],METAL);
  }
  crate(x:number,y:number,z:number,s=1) {
    this.box([x,y+s*.5,z],[s,s,s],WOOD,true);
    for(const dz of [-.51,.51]){
      for(const dx of [-.42,.42])this.box([x+s*dx,y+s*.5,z+s*dz],[s*.13,s,s*.06],CREAM);
      for(const dy of [.08,.92])this.box([x,y+s*dy,z+s*dz],[s,s*.14,s*.06],CREAM);
    }
    for(const dz of [-.55,.55]){
      this.beam([x-s*.36,y+s*.18,z+s*dz],[x+s*.36,y+s*.82,z+s*dz],s*.09,CREAM);
      for(const dx of [-.4,.4])for(const dy of [.15,.85])this.shape('cylinder',[x+s*dx,y+s*dy,z+s*dz],[s*.025,s*.03,s*.025],METAL,[Math.PI/2,0,0]);
    }
  }
  barrel(x:number,y:number,z:number) {
    this.shape('cylinder',[x,y+.6,z],[.5,1.2,.5],WOOD);
    this.plan.solids.push({at:[x,y+.6,z],half:[.5,.6,.5],yaw:0});
    for(const dy of [.2,1])this.shape('ring',[x,y+dy,z],[.53,.055,.53],METAL);
  }
  crystal(x:number,y:number,z:number,h:number,color:string) {
    this.shape('crystal',[x,y,z],[h*.23,h,h*.23],color,[0,x*.17,.09*Math.sin(x+z)]);
  }
  booth(x:number,y:number,z:number,t:Theme,shop:boolean) {
    // The activation circle sits IN FRONT of the counter, never inside its collider.
    const rear=z-3.4;
    for(const dx of [-2,2])this.box([x+dx,y+2.3,rear],[.3,4.6,.3],t.wood,true);
    this.box([x,y+1,rear],[4.2,2,1.5],t.wood,true);
    this.box([x,y+2.04,rear],[4.6,.16,1.8],CREAM);
    for(let i=0;i<7;i++)this.box([x-1.8+i*.6,y+4,rear],[.59,.15,2.8],i%2?CREAM:(shop?'#659e96':'#bf7955'),false,[.13,0,0]);
    this.box([x,y+3.82,rear+1.42],[4.2,.38,.12],shop?'#659e96':'#bf7955');
    this.sign([x,y+3,rear+.85],3.6,shop?'装备工坊':'矿石收购',shop?'UPGRADES':'ORE EXCHANGE',t);
    for(const dx of [-1.25,1.25])this.lantern(x+dx,y+3,rear+1,t);
    this.shape('ring',[x,y+.045,z],[1.7,.12,1.7],shop?'#95d9c6':'#f1ca76',[0,0,0],true);
    this.shape('ring',[x,y+.035,z],[1.95,.025,1.95],shop?'#95d9c6':'#f1ca76',[0,0,0],true);
    for(let i=0;i<3;i++)this.shape('rock',[x-.8+i*.7,y+2.3,rear],[.4,.35,.35],shop?METAL:['#e6b956','#bcdce0','#c4774d'][i]);
    this.crate(x-3,y,rear,.95);
    this.barrel(x+3,y,rear);
    for(let i=0;i<8;i++)this.box([x-1.85+i*.53,y+1,rear+.77],[.48,1.75,.06],i%3?t.wood:WOOD);
    for(const dy of [.25,1.65])this.box([x,y+dy,rear+.83],[4.2,.13,.08],CREAM);
    for(const dx of [-1.8,1.8])for(const dy of [.25,1.65])this.shape('cylinder',[x+dx,y+dy,rear+.89],[.055,.03,.055],METAL,[Math.PI/2,0,0]);
    for(const dx of [-2,2])this.beam([x+dx,y+2.9,rear],[x+dx,y+3.9,rear+1.3],.14,CREAM);
    this.shape('cylinder',[x+.9,y+2.2,rear+.3],[.3,.16,.3],METAL);
    this.box([x+.9,y+2.55,rear+.3],[.065,.7,.065],METAL);
    this.box([x+.9,y+2.88,rear+.3],[1,.065,.065],METAL);
    for(const dx of [.45,1.35]){this.box([x+dx,y+2.65,rear+.3],[.025,.4,.025],CREAM);this.shape('cap',[x+dx,y+2.4,rear+.3],[.24,.08,.24],CREAM,[Math.PI,0,0]);}

  }
  rim(t:Theme) {
    // Low edge trim stays outside the full 8x8 diggable square. Leave the near side open.
    for(const x of [-8.25,8.25])this.box([x,.14,0],[.4,.28,16.6],t.wood);
    this.box([0,.14,-8.25],[16.9,.28,.4],t.wood);
    for(const x of [-8.5,8.5])for(const z of [-8.5,8.5]){
      this.box([x,.55,z],[.7,1.1,.7],t.wood,true);
      this.box([x,1.13,z],[.85,.1,.85],t.accent);
    }
  }
}
