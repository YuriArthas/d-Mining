import { Planner, type Shape, type V3 } from './sceneryKit.ts';
export const PALETTE={ivory:'#fff0c9',teal:'#258c83',deep:'#244b53',mint:'#a9ded0',gold:'#efb550',orange:'#d87944',stone:'#b69e8b'};
export function sculpt(p:Planner,type:Shape['type'],at:V3,size:V3,color:string,material?:Shape['material'],rotation:V3=[0,0,0]) {
  const s:Shape={type,at,size,color,material,rotation};p.plan.shapes.push(s);return s;
}
export function lathe(p:Planner,at:V3,size:V3,color:string,contour:[number,number][],material?:Shape['material'],rotation:V3=[0,0,0]) {
  return Object.assign(sculpt(p,'lathe',at,size,color,material,rotation),{contour});
}
export function tube(p:Planner,at:V3,path:V3[],radii:number[],color:string,material?:Shape['material']) {
  return Object.assign(sculpt(p,'sweep',at,[1,1,1],color,material),{path,radii});
}
export function slab(p:Planner,at:V3,contour:[number,number][],thickness:number,color:string) {
  return Object.assign(sculpt(p,'slab',at,[1,thickness,1],color,'stone'),{contour:contour.map(([x,z])=>[x,-z] as [number,number])});
}
export function oval(p:Planner,x:number,z:number,rx:number,rz:number,color:string,y=.025) {
  const points:[number,number][]=Array.from({length:40},(_,i)=>{const a=i/40*Math.PI*2;return [Math.cos(a)*rx,Math.sin(a)*rz]});
  slab(p,[x,y,z],points,.025,color);
}
export function solid(p:Planner,at:V3,half:V3){p.plan.solids.push({at,half,yaw:0})}
export function plaque(p:Planner,at:V3,w:number,h:number,color:string,depth=.32) {
  const contour:[number,number][]=[[-.5,-.22],[-.48,-.38],[-.32,-.42],[0,-.5],[.32,-.42],[.48,-.38],[.5,-.22],[.5,.23],[.43,.37],[.2,.42],[0,.52],[-.2,.42],[-.43,.37],[-.5,.23]];
  Object.assign(sculpt(p,'plaque',at,[w,h,depth],color),{contour});
}
export function badge(p:Planner,at:V3,w:number,title:string,subtitle:string,color:string,yaw=0) {
  const first=p.plan.shapes.length;
  plaque(p,[at[0],at[1],at[2]-.20],w+1,w*.4,PALETTE.gold,.38);
  plaque(p,[at[0],at[1],at[2]+.035],w+.68,w*.34,PALETTE.ivory,.12);
  p.plan.signs.push({at:[at[0],at[1],at[2]+.14],width:w,title,subtitle,color:PALETTE.ivory,background:color,style:'facility',yaw});
  if(yaw){
    for(const part of p.plan.shapes.slice(first)){const dx=part.at[0]-at[0],dz=part.at[2]-at[2];part.at[0]=at[0]+Math.cos(yaw)*dx+Math.sin(yaw)*dz;part.at[2]=at[2]-Math.sin(yaw)*dx+Math.cos(yaw)*dz;part.rotation=[0,yaw,0];}
    const sign=p.plan.signs.at(-1)!;sign.at=[at[0]+Math.sin(yaw)*.14,at[1],at[2]+Math.cos(yaw)*.14];
  }
}
export function cog(p:Planner,at:V3,r:number,color:string) {
  const contour:[number,number][]=[];
  for(let i=0;i<64;i++){const a=i/64*Math.PI*2,rad=i%4<2?1:.88;contour.push([Math.cos(a)*rad,Math.sin(a)*rad]);}
  Object.assign(sculpt(p,'plaque',at,[r,r,.26],color,'metal'),{contour});
  sculpt(p,'cylinder',[at[0],at[1],at[2]+.20],[r*.70,.16,r*.70],PALETTE.deep,'metal',[Math.PI/2,0,0]);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;tube(p,[at[0],at[1],at[2]+.31],[[Math.cos(a)*r*.14,Math.sin(a)*r*.14,0],[Math.cos(a)*r*.43,Math.sin(a)*r*.43,0],[Math.cos(a)*r*.66,Math.sin(a)*r*.66,0]],[r*.065,r*.065],color,'metal');}
  sculpt(p,'cylinder',[at[0],at[1],at[2]+.38],[r*.19,.18,r*.19],PALETTE.ivory,'metal',[Math.PI/2,0,0]);
}
export function crystalCluster(p:Planner,x:number,y:number,z:number,s:number) {
  for(const [dx,dz,h,lean,c] of [[0,0,1.5,-.12,'#64cfc1'],[-.5,.1,1,-.38,'#a2e4c6'],[.5,.2,.82,.37,'#3eafa7'],[.08,.45,.6,.18,'#c3eee0']] as const){
    sculpt(p,'crystal',[x+dx*s,y,z+dz*s],[s*.32,h*s,s*.32],c,undefined,[.14,dx,lean]);
  }
}
export function plant(p:Planner,x:number,z:number,s=1,base=0) {
  for(let i=0;i<5;i++){
    const a=i*2.4+x,lean=.5+(i%2)*.25;
    sculpt(p,'leaf',[x,base,z],[s*.42,s*(.55+(i%3)*.13),s],i%2?'#589951':'#8eb952','leaves',[Math.cos(a)*lean,a,Math.sin(a)*lean]);
  }
}
export function tree(p:Planner,x:number,z:number,h:number,base=0) {
  const s=h/10,origin:V3=[x,base,z];
  tube(p,origin,[[0,0,0],[-.3*s,2*s,0],[.45*s,4.1*s,.18*s],[.2*s,6.3*s,0]],[.72*s,.52*s,.29*s,.04*s],'#966b44','wood');
  solid(p,[x,base+2.3*s,z],[.75*s,2.3*s,.65*s]);
  for(const side of [-1,1])tube(p,origin,[[0,2*s,0],[side*.9*s,3.8*s,.1],[side*2*s,5.6*s,.2],[side*2.8*s,6.2*s,.3]],[.36*s,.24*s,.12*s,.01],'#a77a48','wood');
  // Flat-bottomed, overlapping leaf masses create a deliberately broad, wind-swept silhouette.
  for(const [dx,dy,dz,w,hh,c] of [[-2.2,6,.2,2.5,1.55,'#42915b'],[1.9,6.4,.15,2.8,1.85,'#66a94e'],[.2,8,-.4,3.25,1.8,'#92c65a'],[-1.3,8.9,-.15,2,1.25,'#b2d569']] as const){
    sculpt(p,'crown',[x+dx*s,base+dy*s,z+dz*s],[w*s,hh*s,2.35*s],c,'leaves',[0,x*.23,.08]);
  }
  for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;tube(p,origin,[[Math.cos(a)*1.4*s,0,Math.sin(a)*1.4*s],[Math.cos(a)*.5*s,.18*s,Math.sin(a)*.5*s],[0,.65*s,0]],[.02,.18*s,.27*s],'#987348','wood');}
}
