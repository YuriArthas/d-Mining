import { BufferAttribute, BufferGeometry, Color, Group, Mesh, type Texture } from 'three';
import { surfaceGrassAllowed } from '../world/surfaceLayout.ts';
import { createSurfaceMaterial } from './SurfaceMaterial.ts';

// Ordinary visual landscape, independent of streamed mine chunks. The exact shaft
// aperture stays open; logical ground and all collision remain owned by terrain.
export function createMeadowGround(noise:Texture){
  const group=new Group();
  const floor=new BufferGeometry(),positions:number[]=[],colors:number[]=[];
  const green=new Color('#76b454');
  for(const [x0,z0,x1,z1] of [[-360,-360,-8,360],[8,-360,360,360],[-8,-360,8,-8],[-8,8,8,360]]){
    positions.push(x0,.008,z0,x0,.008,z1,x1,.008,z0,x1,.008,z0,x0,.008,z1,x1,.008,z1);
    for(let i=0;i<6;i++)colors.push(green.r,green.g,green.b);
  }
  floor.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));floor.computeVertexNormals();
  floor.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));
  floor.setAttribute('uv',new BufferAttribute(new Float32Array(positions.length/3*2),2));
  floor.setAttribute('artOcclusion',new BufferAttribute(new Float32Array(positions.length/3).fill(1),1));
  const ground=new Mesh(floor,createSurfaceMaterial('ground',noise));ground.receiveShadow=true;group.add(ground);
  const p:number[]=[],c:number[]=[],uv:number[]=[],ao:number[]=[],flex:number[]=[],indices:number[]=[];
  let seed=7219;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const palette=['#5b9345','#72a950','#8bb957','#a1c565'].map(v=>new Color(v));
  for(let i=0;i<12500;i++){
    const x=(random()-.5)*112,z=(random()-.5)*112;
    if(!surfaceGrassAllowed(x,z))continue;
    // Loose, irregular meadow patches rather than a uniformly tiled lawn.
    if(Math.sin(x*.33+Math.cos(z*.24))*Math.cos(z*.29)<-.3&&random()<.88)continue;
    for(let blade=0;blade<5;blade++){
      const angle=random()*Math.PI*2,h=.19+random()*.43,w=.025+random()*.035,bend=.10+random()*.20;
      const bx=x+(random()-.5)*.24,bz=z+(random()-.5)*.24,dx=Math.cos(angle),dz=Math.sin(angle),col=palette[Math.floor(random()*palette.length)],base=p.length/3;
      for(let j=0;j<=5;j++)for(const side of [-1,1]){
        const t=j/5,width=w*(1-t)**.7;
        p.push(bx+dx*bend*t*t-dz*side*width,.015+h*t,bz+dz*bend*t*t+dx*side*width);
        const light=.72+t*.28;c.push(col.r*light,col.g*light,col.b*light);uv.push((side+1)/2,t);ao.push(.7+.3*t);flex.push(t*t);
      }
      for(let j=0;j<5;j++){const a=base+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
  }
  const grass=new BufferGeometry();grass.setAttribute('position',new BufferAttribute(new Float32Array(p),3));grass.setIndex(indices);grass.computeVertexNormals();
  grass.setAttribute('color',new BufferAttribute(new Float32Array(c),3));grass.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));
  grass.setAttribute('artOcclusion',new BufferAttribute(new Float32Array(ao),1));grass.setAttribute('grassFlex',new BufferAttribute(new Float32Array(flex),1));
  const blades=new Mesh(grass,createSurfaceMaterial('grass',noise));blades.receiveShadow=true;group.add(blades);
  return group;
}
