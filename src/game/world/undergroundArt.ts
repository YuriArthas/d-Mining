import { Planner, METAL, CREAM, WOOD } from './sceneryKit.ts';
import type { Theme } from '../content/themes.ts';
import type { RestRoom } from './rooms.ts';
function pebble(p:Planner,x:number,z:number,color:string,s=.5){p.shape('rock',[x,s*.28,z],[s,s*.5,s*.75],color,[.1,x,.08]);}
function fern(p:Planner,x:number,y:number,z:number,color:string,s=1) {
  for(let i=0;i<5;i++){const a=i*1.2;p.shape('cone',[x+Math.cos(a)*s*.25,y+s*.3,z+Math.sin(a)*s*.25],[s*.11,s*.8,s*.12],color,[Math.sin(a)*.55,a,Math.cos(a)*.55]);}
}
function barrel(p:Planner,x:number,z:number){
  p.shape('cylinder',[x,.75,z],[.65,1.5,.65],WOOD);
  for(const y of [.22,1.2])p.shape('ring',[x,y,z],[.68,.055,.68],METAL);
  p.shape('cylinder',[x,1.52,z],[.59,.03,.59],CREAM);
  p.plan.solids.push({at:[x,.75,z],half:[.65,.75,.65],yaw:0});
}
export function polishRoom(p:Planner,t:Theme,room:RestRoom){
  // Curated edge details keep the central excavation and service approaches clear.
  for(let i=0;i<18;i++){
    const x=i%2?-17.1:17.1,z=-16+Math.floor(i/2)*3.5;
    pebble(p,x,z,t.rock,.3+(i%3)*.17);
  }
  for(const x of [-18.7,18.7])for(const z of [-14,-4,6,16]){
    for(const y of [1.3,6.8]){
      p.box([x,y,z],[.82,.18,.82],METAL);
      p.shape('cylinder',[x,y,z+.43],[.065,.045,.065],CREAM,[Math.PI/2,0,0]);
    }
  }
  // The foreground is a designed arrival apron rather than a featureless plane.
  const floorRgb=parseInt(t.floor.slice(1),16),paving='#'+[16,8,0].map(shift=>Math.min(255,Math.round(((floorRgb>>shift)&255)*1.045)).toString(16).padStart(2,'0')).join('');
  for(let i=0;i<7;i++)for(let j=0;j<3;j++){
    const x=-4.5+i*1.5,z=12.2+j*1.8;
    p.box([x,.012,z],[1.46,.025,1.73],paving);
  }
  // Hanging cables and small pennants join the two walls without closing the shaft.
  if(['timber','mushroom','machine'].includes(t.motif)){
    for(let i=0;i<16;i++){
      const x=-18+i*2.4,y=8.7-1.7*(1-(x/18)**2),next=x+2.4,ny=8.7-1.7*(1-(next/18)**2);
      p.beam([x,y,-16],[next,ny,-16],.055,METAL);
      if(i%3===1 && Math.abs(x)>5)p.lantern(x,y-.6,-16,t);
    }
  }
  if(t.motif==='timber'){
    barrel(p,-14,-10);barrel(p,-15.3,-11.6);
    // A tool rack, stacked timber and a real winding drum tell a working-mine story.
    for(const x of [-16.5,-10.5])p.box([x,2.2,-17.8],[.18,4.4,.18],WOOD,true);
    for(const y of [1.5,3.5])p.box([-13.5,y,-17.8],[6.3,.22,.2],WOOD);
    for(let i=0;i<4;i++){
      const x=-16+i*1.45;p.beam([x,1.5,-17.5],[x+.3,3.35,-17.5],.12,CREAM);
      p.box([x+.28,3.2,-17.5],[.85,.2,.18],METAL,false,[0,0,.1]);
    }
    for(let i=0;i<6;i++)p.shape('cylinder',[11+(i%3)*.9,.5+Math.floor(i/3)*.75,-17],[.43,3,.43],WOOD,[Math.PI/2,0,0]);
    for(const x of [-3,3])p.box([x,1.6,-17],[.4,3.2,.7],METAL,true);
    p.shape('cylinder',[0,2.3,-17],[1.1,5.5,1.1],'#aa8d60',[0,0,Math.PI/2]);
    p.plan.solids.push({at:[0,2.3,-17],half:[2.7,1.1,1.1],yaw:0});
    for(const x of [-2.6,2.6])p.shape('cylinder',[x,2.3,-17],[1.4,.2,1.4],METAL,[0,0,Math.PI/2]);
    for(let x=-2;x<=2;x+=.2)p.shape('torus',[x,2.3,-17],[1.13,.04,Math.PI*2],'#745738',[0,Math.PI/2,0]);
  }
  if(t.motif==='mushroom'){
    // Dense little colonies and gills make the giants belong to an ecosystem.
    for(let i=0;i<28;i++){
      const side=i%2?1:-1,x=side*(12+(i%5)*1.1),z=-16+Math.floor(i/5)*4,h=.55+(i%4)*.34;
      p.shape('cylinder',[x,h*.4,z],[.12,h*.8,.12],CREAM);
      p.shape('cap',[x,h*.8,z],[h*.5,h*.26,h*.5],i%3?'#b97891':'#6fb3aa');
      fern(p,x+.7,0,z,'#4f8973',.65);
    }
    for(const x of [-15,15]){
      p.shape('foliage',[x,.4,-14],[3,.45,2.5],'#527f69');
      for(let i=0;i<6;i++)p.shape('rock',[x+(i%3)*.7-1,1+(i%2)*.3,-15+Math.floor(i/3)], [.1,.1,.1],t.accent,[0,0,0],true);
    }
  }
  if(['crystal','ice','core'].includes(t.motif)){
    for(let i=0;i<14;i++){
      const x=(i%2?1:-1)*(12+(i%3)*1.5),z=-17+Math.floor(i/2)*4.5;
      p.crystal(x,0,z,.6+(i%4)*.5,i%3?t.accent:t.rock);
      pebble(p,x+.6,z+.4,t.rock,.75);
    }
    if(t.motif==='ice'){
      for(let i=0;i<15;i++){const x=-17+i*2.4;p.shape('cone',[x,9.5-(i%3)*.25,-18],[.35,2+(i%4)*.6,.35],'#c9e4e9',[Math.PI,0,0]);}
      for(const x of [-14,14])p.shape('rock',[x,.18,-12],[4,.2,3],'#c6dedb');
    }
    if(t.motif==='crystal'){
      for(const x of [-15,15])p.shape('foliage',[x,.3,-14],[3,.4,2.5],'#626980');
      p.shape('torus',[0,5.2,-18.5],[3.6,.12,Math.PI*2],t.accent,[0,0,0],true);
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;p.crystal(Math.cos(a)*3.5,5.2+Math.sin(a)*3.5,-18.4,.5,t.accent);}
    }
    if(t.motif==='core'){
      for(const r of [3.8,4.7])p.shape('torus',[0,4.3,-16],[r,.08,Math.PI*2],t.accent,[0,r*.2,.3],true);
      for(const x of [-8,8]){p.box([x,.3,-17],[3,.6,3],t.wood,true);p.crystal(x,.6,-17,3.5,t.accent);}
    }
  }
  if(t.motif==='ruins'){
    // A framed, patterned doorway gives the ruins an architectural focal point.
    for(const x of [-4.8,4.8])for(let j=0;j<5;j++)p.box([x,.8+j*1.55,-18],[1.3,1.5,1.5],j%2?'#b7a582':'#c8b894',true);
    p.box([0,8.5,-18],[11.4,1.5,1.8],'#c8b894');
    for(let i=0;i<7;i++)p.box([-4.2+i*1.4,8.6,-17.04],[.5,.5,.05],t.accent,false,[0,0,Math.PI/4]);
    for(const x of [-13,13])for(let j=0;j<6;j++)p.box([x,1.6+j,-11.86],[1.4,.06,.025],'#ac946e');
    for(const x of [-17,17])for(let j=0;j<4;j++)fern(p,x,.1,-17+j*1.4,'#698973',.8);
  }
  if(t.motif==='lava'){
    // Inset glow, forged fittings and stacked black rock suggest heat without hazard rules.
    for(const x of [-16,16]){
      p.box([x,.06,-7],[.45,.1,13],t.accent,false,[0,0,0],true);
      for(let z=-13;z<0;z+=1.2)p.box([x,.15,z],[1,.13,.14],METAL);
      for(let i=0;i<5;i++)pebble(p,x-1,-16+i*1.4,'#484750',1.1);
    }
    for(const x of [-10,10]){
      p.shape('cylinder',[x,1.1,-17],[1.3,2.2,1.3],METAL);
      p.shape('cap',[x,2.2,-17],[1.1,.3,1.1],t.accent,[0,0,0],true);
      p.plan.solids.push({at:[x,1.1,-17],half:[1.3,1.1,1.3],yaw:0});
    }
  }
  if(t.motif==='fossil'){
    // Curved ribs, vertebrae and individual teeth replace the stick-figure skeleton.
    for(const x of [-13,13])for(const z of [-14,-10,-6])p.shape('torus',[x,3.5,z],[2.5,.23,Math.PI],t.accent,[0,0,x<0?-.3:.3]);
    for(let i=0;i<8;i++)p.shape('rock',[-5+i*1.4,.4,-17],[.5,.4,.45],CREAM);
    for(let i=0;i<7;i++)p.shape('cone',[-2+i*.65,1.45,-13.65],[.18,.8,.18],CREAM,[Math.PI,0,0]);
    for(const x of [-3,3])p.shape('cone',[x,4.8,-16],[.45,3,.45],CREAM,[0,0,x<0?-.65:.65]);
    p.shape('rock',[0,2.9,-13.55],[.45,.7,.16],'#61544b');
  }
  if(t.motif==='machine'){
    // Pipes, gear teeth and instrument panels turn simple boxes into machines.
    for(const x of [-13,13]){
      for(const y of [.4,3.5])p.box([x,y,-11.45],[3.7,.14,.1],CREAM);
      for(let i=0;i<4;i++)p.box([x-1.3+i*.8,1.5,-11.42],[.33,1.25,.12],METAL);
      for(let i=0;i<3;i++)p.shape('cylinder',[x-1+i,3,-11.3],[.17,.08,.17],i%2?CREAM:t.accent,[Math.PI/2,0,0],true);
      p.shape('torus',[x,5,-17],[3,.35,Math.PI*2],METAL);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;p.box([x+Math.cos(a)*3,5+Math.sin(a)*3,-17],[.7,.7,.7],CREAM,false,[0,0,a]);}
    }
    for(const x of [-17,17]){p.shape('cylinder',[x,7,-17],[.28,10,.28],METAL,[0,0,Math.PI/2]);p.shape('cylinder',[x,4,-17],[.3,6,.3],METAL);}
  }
  // Only a scene label carries depth. The art recipe remains reusable at any depth.
  void room;
}
