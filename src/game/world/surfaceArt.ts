import { rockProfile } from './rockProfile.ts';
import { Planner, type SceneryPlan, type V3 } from './sceneryKit.ts';
import { SURFACE_SELL } from './rooms.ts';
import { SURFACE_TRAILS } from './surfaceLayout.ts';
import { PALETTE as C, sculpt as s, lathe, tube, oval, solid, badge, cog, crystalCluster, plant, tree } from './surfaceSculptures.ts';

function rock(p:Planner,x:number,y:number,z:number,w:number,h:number,d:number,color=C.stone,yaw=0,kind:'rock'|'bluff'='rock') {
  s(p,kind==='rock'?'cutRock':'bluff',[x,y,z],[w,h,d],color,'stone',[0,yaw,0]);
  const hull=rockProfile(kind,[w,h,d]).vertices;
  for(let i=1;i<hull.length;i+=3)hull[i]-=h/2;
  p.plan.solids.push({at:[x,y+h/2,z],half:[w*.65,h/2,d*.65],yaw,hull});
}
function sale(p:Planner) {
  const {x,z}=SURFACE_SELL,back=z-4.5;
  oval(p,x,back+1,5.4,5.9,'#bca381');oval(p,x,back+1,5.08,5.58,'#dfcba3',.058);
  // Turned plinth and a pear-shaped enamel counter, with a single sweeping copper canopy.
  lathe(p,[x,0,back],[2.85,1,1.8],C.deep,[[0,0],[.87,0],[1,.16],[1,.4],[.92,.57],[0,.57]]);
  lathe(p,[x,.48,back],[2.62,1,1.55],'#b77b50',[[0,0],[.85,0],[.92,.3],[1,1.2],[.97,1.6],[.85,1.9],[0,1.9]],'wood');
  solid(p,[x,1.2,back],[2.5,1.2,1.4]);
  lathe(p,[x,2.27,back],[2.95,1,1.84],C.ivory,[[0,0],[.87,0],[1,.1],[1,.28],[.94,.39],[0,.39]]);
  for(const side of [-1,1]){
    tube(p,[x+side*2.2,2.3,back],[[0,0,0],[side*.12,1.1,-.15],[side*.15,2.2,-.4],[0,2.8,-.45]],[.14,.12,.11],C.gold,'metal');
    tube(p,[x+side*2.2,3.6,back],[[0,0,0],[-side*.45,.3,.2],[-side*.64,.7,.2],[-side*.28,.94,.2]],[.09,.09,.025],C.deep);
  }
  const roof:[number,number][]=[[0,.3],[.7,.3],[.99,.05],[1.03,.11],[1,.27],[.82,.40],[.66,.80],[.49,1.25],[.33,1.50],[0,1.56]];
  lathe(p,[x,4.65,back-.3],[3.7,1,2.15],C.orange,roof,'canvas');
  lathe(p,[x,4.65,back-.3],[3.78,1,2.21],C.gold,[[.94,.05],[1,.05],[1.025,.13],[1,.23],[.95,.23]],'metal');
  lathe(p,[x,5.32,back-.3],[2.6,1,1.54],C.ivory,[[.92,0],[1,.05],[.84,.26],[.73,.4],[.68,.4]]);
  badge(p,[x,4.01,back+2.08],4.6,'矿石交易所','S E L L   Y O U R   O R E',C.orange);
  // A pile of coins forms the rooftop silhouette, with a large stamped centre coin.
  for(let i=0;i<3;i++)s(p,'cylinder',[x+.35,6.23+i*.16,back-.35],[.85-i*.08,.14,.85-i*.08],C.gold,'metal');
  s(p,'cylinder',[x-.26,7.15,back-.3],[.92,.22,.92],C.gold,'metal',[Math.PI/2,0,-.2]);
  s(p,'torus',[x-.26,7.15,back-.16],[.76,.065,Math.PI*2],C.ivory,'metal');
  s(p,'gem',[x-.26,7.15,back-.05],[.32,.52,.11],'#ffe9a0','metal');
  for(let i=0;i<3;i++)s(p,'gem',[x-1.2+i*.7,2.94,back+.4],[.37,.40,.35],['#65c9b6','#f5c568','#97bbcf'][i]);
  // Weighing bowl and balanced arm beside the counter.
  const bx=x+3.7,bz=back+.2;
  lathe(p,[bx,0,bz],[.72,1,.72],C.deep,[[0,0],[1,0],[1,.2],[.6,.3],[.3,1.9],[.4,2],[0,2]]);
  tube(p,[bx,2,bz],[[-.8,.1,0],[0,.3,0],[.8,.1,0]],[.08,.08],C.gold,'metal');
  for(const dx of [-.75,.75]){
    tube(p,[bx+dx,1.66,bz],[[0,0,0],[0,.25,0],[0,.5,0]],[.025,.025],C.gold,'metal');
    lathe(p,[bx+dx,1.3,bz],[.46,.35,.46],C.gold,[[0,0],[.45,.15],[.9,.55],[1,.9],[.9,1],[.8,.65],[0,.25]],'metal');
  }
  for(const r of [1.7,1.94])p.shape('ring',[x,.10,z],[r,r===1.7?.14:.035,r],'#ffe4a0',[0,0,0],true);
}
function cartRecipe(p:Planner) {
  // Rails curl into the loading bay. Sleepers follow the track, with a physical end stop.
  for(const dx of [-1.05,1.05])tube(p,[15,0,0],[[dx,.13,2],[dx,.13,-3],[dx,.13,-8],[dx+1.2,.13,-13],[dx+5,.13,-16]],[.08,.08],C.deep,'metal');
  for(let z=-12;z<3;z+=1.45){const shift=z<-8?(z+8)**2*.055:0;tube(p,[15+shift,.075,z],[[-1.5,0,0],[0,0,0],[1.5,0,0]],[.14,.14],'#9b7b55','wood');}
  tube(p,[15,0,1.8],[[-1.45,.2,0],[-.8,.85,0],[.8,.85,0],[1.45,.2,0]],[.16,.16],C.gold,'metal');
  s(p,'cartShell',[15,.65,-4.3],[2.0,2.2,2.4],C.teal);
  s(p,'cartShell',[15,2.78,-4.3],[2.05,.22,2.46],C.ivory);
  solid(p,[15,1.5,-4.3],[1.9,1.5,2.25]);
  for(const x of [12.94,17.06])for(const z of [-5.8,-2.8]){
    s(p,'cylinder',[x,.65,z],[.65,.32,.65],C.deep,'metal',[0,0,Math.PI/2]);
    s(p,'cylinder',[x+(x<15?-.19:.19),.65,z],[.37,.08,.37],C.gold,'metal',[0,0,Math.PI/2]);
    s(p,'cylinder',[x+(x<15?-.24:.24),.65,z],[.13,.09,.13],C.ivory,'metal',[0,0,Math.PI/2]);
  }
  crystalCluster(p,15,2.1,-4.5,1.45);
  for(const dx of [-1.5,1.5])for(const z of [-6,-2.6])s(p,'gem',[15+dx,2.25,z],[.13,.13,.13],C.gold,'metal');
  // Circular cargo seal follows the cart's front face.
  s(p,'cylinder',[15,1.95,-1.94],[.62,.12,.62],C.gold,'metal',[Math.PI/2,0,0]);
  s(p,'gem',[15,1.95,-1.84],[.28,.39,.12],C.ivory);
  rock(p,20,0,-15,5,1.7,4,'#bfa58b');crystalCluster(p,20,1,-15,2);
}
function windingEngine(p:Planner) {
  // A purpose-built winding machine connects the ornamental gate to a working mine.
  const x=-23,z=-12;
  oval(p,x-.4,z,4.9,3.3,'#c6b18d');
  lathe(p,[x-2.4,2.1,z],[1.25,1,1.25],C.teal,[[0,0],[.65,0],[.93,.22],[1,.6],[1,3.6],[.9,3.9],[.55,4.1],[0,4.1]],undefined,[0,0,-Math.PI/2]);
  for(const dx of [-1.8,1.2]){
    s(p,'torus',[x+dx,2.1,z],[1.27,.12,Math.PI*2],C.gold,'metal',[0,Math.PI/2,0]);
    lathe(p,[x+dx,0,z],[1.18,.8,1.05],C.deep,[[0,0],[1,0],[1,.3],[.85,.7],[.7,1],[0,1]]);
  }
  cog(p,[x+.25,2.0,z+1.38],1.45,C.gold);
  // Cast flared exhaust and a pressure dial, all from revolved/swept profiles.
  tube(p,[x-1.75,2.85,z],[[0,0,0],[0,1,0],[-.35,1.7,0],[-.35,2.5,0]],[.34,.34,.28,.30],C.deep,'metal');
  lathe(p,[x-2.1,5.1,z],[.65,.6,.65],C.gold,[[.42,0],[.54,0],[.65,.3],[1,.65],[1,1],[.8,1],[.45,.4]],'metal');
  s(p,'cylinder',[x-1.4,3.12,z+.96],[.52,.17,.52],C.gold,'metal',[Math.PI/2,0,0]);
  s(p,'cylinder',[x-1.4,3.12,z+1.06],[.43,.04,.43],C.ivory,undefined,[Math.PI/2,0,0]);
  tube(p,[x-1.4,3.12,z+1.1],[[0,0,0],[-.12,.16,0],[-.2,.25,0]],[.028,.028],C.orange);
  for(let i=0;i<7;i++){const a=-.4+i*.65;s(p,'gem',[x-1.4+Math.cos(a)*.33,3.12+Math.sin(a)*.33,z+1.1],[.025,.04,.02],C.deep);}
  tube(p,[0,0,0],[[x+1.7,2,z],[x+3,1.4,z],[x+3,.35,z+2],[-13,.35,-12],[-10,1,-10]],[.16,.16],C.gold,'metal');
  solid(p,[x-.2,1.75,z],[2.65,1.75,1.2]);
}

function cart(p:Planner) {
  const local=new Planner();cartRecipe(local);
  for(const shape of local.plan.shapes)shape.at[0]-=33;
  for(const shape of local.plan.solids)shape.at[0]-=33;
  p.plan.shapes.push(...local.plan.shapes);p.plan.solids.push(...local.plan.solids);
}
function mineEdge(p:Planner){
  // Rounded timber coping sits entirely outside the 16 m opening; front stays open.
  for(const x of [-8.5,8.5])tube(p,[x,.18,0],[[0,0,-8.4],[0,0,0],[0,0,8.2]],[.22,.22],'#94724b','wood');
  tube(p,[0,.18,-8.5],[[-8.4,0,0],[0,0,0],[8.4,0,0]],[.22,.22],'#94724b','wood');
  // A compact wooden derrick marks one corner rather than closing the skyline.
  for(const [x,z] of [[-10,-10],[-13,-11]]){
    tube(p,[x,0,z],[[0,0,0],[.15,2,0],[.3,5.8,.2]],[.34,.27,.23],'#95663f','wood');solid(p,[x,2.5,z],[.4,2.5,.4]);
  }
  tube(p,[0,0,0],[[-13,5.8,-11],[-10,6,-10],[-6,6.1,-9]],[.29,.29],'#b18b57','wood');
  tube(p,[0,0,0],[[-12.8,3,-11],[-10,4.8,-10],[-7,6,-9]],[.15,.15],'#91683f','wood');
  s(p,'torus',[-6,5.6,-9],[.5,.095,Math.PI*2],C.deep,'metal');
  tube(p,[-6,1.1,-9],[[0,0,0],[0,2,0],[0,4.4,0]],[.033,.033],'#ac9470','wood');
  badge(p,[-10.7,2.5,8.8],3.2,'翡翠矿场','EMERALD MINE',C.teal,.22);
  tube(p,[-10.7,0,8.5],[[0,0,0],[0,1.5,0],[0,3,0]],[.15,.15],'#966b44','wood');
}
function environment(p:Planner){
  // Open woodland at eye level. Rounded boulders sit in planting, not in the central vista.
  for(const [x,z,w,h,d] of [[-29,-20,10,4,8],[29,-29,12,5,10],[36,7,9,3,8],[-28,16,7,2.8,6],[25,28,8,3,6],[-6,-32,9,2.7,6],[15,-39,12,4,9]]){
    rock(p,x,0,z,w,h,d,'#b4ab91',x*.11);plant(p,x-w*.65,z+1,1.2);
  }
  for(const [x,z,h] of [[-29,-8,13],[-27,5,11],[-26,27,12],[-8,35,14],[13,35,11],[31,23,14],[34,-8,12],[20,-35,11],[1,-37,13],[-17,-32,12],[-38,-31,15],[43,-34,15],[-43,32,16],[39,43,14]])tree(p,x,z,h);
  // A continuous near horizon closes the playable bowl. The low-poly profile is
  // intentionally varied per segment so the edge reads as a valley, not a wall.
  for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2,r=78+(i%3)*2,x=Math.sin(a)*r,z=Math.cos(a)*r;
    const h=25+(i%5)*2;
    p.shape('horizon',[x,11+(i%4)*.8,z],[18,h,15],i%2?'#667d6d':'#778f78',[0,a,0]);
    p.plan.shapes.at(-1)!.material='stone';
  }
  // Broad smooth hills and a complete mountain ring well beyond the old 80 m clip plane.
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2,r=164+Math.sin(i*7.1)*30,x=Math.sin(a)*r,z=Math.cos(a)*r;
    const h=24+(Math.sin(i*3.7)+1)*10;
    s(p,'cutRock',[x,-5,z],[62+(i%3)*10,h,54],i%3?'#8aab98':'#a3b9a3','stone',[0,a,0]);
  }
  for(let i=0;i<13;i++){
    const a=i/13*Math.PI*2+.2,r=74+(i%3)*7;
    rock(p,Math.sin(a)*r,-4,Math.cos(a)*r,28,11+(i%4)*3,25,i%2?'#73a455':'#87ae63',a);
    p.plan.shapes.at(-1)!.material='ground';
  }
  for(const [x,z] of [[-23,16],[-22,29],[20,25],[29,17],[28,-8],[8,-28],[-17,-26]]){
    s(p,'crown',[x,.55,z],[1.6,.8,1.3],'#4e8c49','leaves');
    plant(p,x+1.4,z+.6,.8);
    for(let i=0;i<5;i++){
      const xx=x-1.4+i*.6,zz=z+1.6+(i%2)*.35;
      tube(p,[xx,0,zz],[[0,0,0],[.03,.3,0],[.08,.65,0]],[.025,.01],'#5c8b41','leaves');
      for(let j=0;j<5;j++){const a=j/5*Math.PI*2;s(p,'crown',[xx+.08+Math.cos(a)*.12,.65,zz+Math.sin(a)*.12],[.14,.055,.1],i%2?'#f2d181':'#f3efdc');}
    }
  }
  crystalCluster(p,-25,0,-19,1.5);crystalCluster(p,30,0,-28,1.8);
}
function spring(p:Planner){
  const x=24,z=-22;
  rock(p,x,0,z-3,5,3.8,4,'#aba58e');
  oval(p,x,z,4.2,3,'#b6ab84');
  oval(p,x,z,3.7,2.5,'#62babb',.08);p.plan.shapes.at(-1)!.material='water';
  const water=tube(p,[x,0,z],[[0,3.65,-3],[0,3.4,-1.8],[.05,1.8,-1.5],[0,.13,-.4]],[.65,.62,.53,.9],'#95d9d2','water');water.size[2]=.55;
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;rock(p,x+Math.cos(a)*4,0,z+Math.sin(a)*2.8,1.1,.5,.9,'#c6b99a',a);}
  plant(p,x-3.8,z,1.3);plant(p,x+3.7,z+1.5,1.1);
}
export function buildSurface():SceneryPlan {
  const p=new Planner();p.plan.style='sculpted';p.plan.meadow=true;
  for(const trail of SURFACE_TRAILS)Object.assign(s(p,'trail',[0,0,0],[trail.width,1,1],'#c6ac7e','trail'),{path:trail.points});
  mineEdge(p);sale(p);cart(p);windingEngine(p);environment(p);spring(p);
  return p.plan;
}
