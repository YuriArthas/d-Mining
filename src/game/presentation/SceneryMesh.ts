import { createMeadowGround } from './MeadowGround.ts';
import { compactSceneryGeometry } from './compactSceneryGeometry.ts';
import { stabilizeShadows } from './stableShadow.ts';
import { createSurfaceMaterial, createSurfaceNoise, SURFACE_SHADER_VERSION, type SurfaceFinish } from './SurfaceMaterial.ts';
import { bakeSurfaceOcclusion, createGroundContact } from './SurfaceOcclusion.ts';
import { crownGeometry, cutRockGeometry, horizonGeometry, terrainBackdropGeometry, trunkGeometry, archGeometry, awningGeometry, gemGeometry, profileGeometry, sweepGeometry, contourGeometry, leafGeometry, cartShellGeometry, trailGeometry } from './surfaceGeometry.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, ConeGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, Euler, Matrix4, RingGeometry, SRGBColorSpace, Vector3, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneryPlan, Shape } from '../world/scenery.ts';

function geometry(s:Shape,smooth:boolean,plastic:boolean,sculpted:boolean) {
  let g:BufferGeometry;
  switch(s.type){
    case 'trail':g=trailGeometry(s.path!,s.size[0]);break;
    case 'box':g=sculpted?new RoundedBoxGeometry(...s.size,2,s.bevel??Math.min(.2,Math.min(...s.size)*.22)):plastic?new BoxGeometry(...s.size):Math.min(...s.size)>=.3?new RoundedBoxGeometry(...s.size,1,Math.min(.08,Math.min(...s.size)*.14)):new BoxGeometry(...s.size);break;
    case 'lathe':g=profileGeometry(s.contour!).scale(...s.size);break;
    case 'sweep':g=sweepGeometry(s.path!,s.radii!).scale(...s.size);break;
    case 'slab':g=contourGeometry(s.contour!,true).scale(...s.size);break;
    case 'plaque':g=contourGeometry(s.contour!,false).scale(...s.size);break;
    case 'leaf':g=leafGeometry().scale(...s.size);break;
    case 'cartShell':g=cartShellGeometry().scale(...s.size);break;
    case 'crown':g=crownGeometry().scale(...s.size);break;
    case 'bluff':g=cutRockGeometry('bluff').scale(...s.size);break;
    case 'grassTop':g=cutRockGeometry('grassTop').scale(...s.size);break;
    case 'cutRock':g=cutRockGeometry().scale(...s.size);break;
    case 'horizon':g=horizonGeometry().scale(...s.size);break;
    case 'terrainBackdrop':g=terrainBackdropGeometry().scale(...s.size);break;
    case 'trunk':g=trunkGeometry().scale(...s.size);break;
    case 'arch':g=archGeometry().scale(...s.size);break;
    case 'awning':g=awningGeometry().scale(...s.size);break;
    case 'gem':g=gemGeometry().scale(...s.size);break;
    case 'cone':g=new ConeGeometry(1,1,6).scale(...s.size);break;
    case 'rock':g=(smooth?(Math.max(...s.size)>.5?new RoundedBoxGeometry(1.6,1.45,1.5,1,.16):new BoxGeometry(1.6,1.45,1.5)):new DodecahedronGeometry(1,0)).scale(...s.size);break;
    case 'cylinder':g=new CylinderGeometry(1,1,1,sculpted?96:smooth&&Math.max(...s.size)>.6?12:6).scale(...s.size);break;
    // Triangular prism: width centered on x, base at y=0, ridge at y=1.
    case 'gable':g=new CylinderGeometry(1,1,1,3).rotateX(-Math.PI/2).scale(1/Math.sqrt(3),2/3,1).translate(0,1/3,0).scale(...s.size);break;
    case 'foliage':g=(smooth?new SphereGeometry(1,10,6):new IcosahedronGeometry(1,1)).scale(...s.size);break;
    case 'cap':g=new SphereGeometry(1,96,48,0,Math.PI*2,0,Math.PI/2).scale(...s.size);break;
    case 'crystal':{
      const shaft=new CylinderGeometry(1,1,.68,6).translate(0,.34,0);
      const tip=new ConeGeometry(1,.32,6).translate(0,.84,0);
      g=mergeGeometries([shaft,tip],false)!;
      shaft.dispose();tip.dispose();g.scale(...s.size);break;
    }
    case 'torus':g=new TorusGeometry(s.size[0],s.size[1],32,160,s.size[2]);break;
    case 'ring':g=new RingGeometry(s.size[0]-s.size[1],s.size[0],160).rotateX(-Math.PI/2);break;
  }
  // Only the legacy per-face color variation needs separate triangle corners.
  if(g.index&&!smooth&&(s.type==='foliage'||s.type==='rock')){const flat=g.toNonIndexed();g.dispose();g=flat;}
  // Vertex colors permit hundreds of different painted parts in one draw call.
  const color=new Color(s.color),colors=new Float32Array(g.getAttribute('position').count*3);
  for(let i=0;i<colors.length;i+=3){
    const vertex=i/3, height=g.getAttribute('position').getY(vertex);
    const leafShade=s.type==='crown'?.84+.16*Math.max(0,Math.min(1,(height/s.size[1]+1)/2)):1;
    const rockShade=sculpted&&['bluff','cutRock'].includes(s.type)?.80+.25*Math.max(0,Math.min(1,height/s.size[1])):1;
    const terrainShade=sculpted&&s.type==='terrainBackdrop'?.72+.38*Math.max(0,Math.min(1,height/38)):1;
    const face=Math.floor(i/9),variation=rockShade*terrainShade*leafShade*(!smooth&&(s.type==='foliage'||s.type==='rock')? .91+((face*13)%9)*.017:1);
    colors[i]=color.r*variation;colors[i+1]=color.g*variation;colors[i+2]=color.b*variation;
  }
  g.setAttribute('color',new BufferAttribute(colors,3));
  g.applyMatrix4(new Matrix4().compose(new Vector3(...s.at),new Quaternion().setFromEuler(new Euler(...(s.rotation??[0,0,0]))),new Vector3(1,1,1)));
  return compactSceneryGeometry(g);
}
export function createScenery(plan:SceneryPlan):Group {
  const group=new Group(),plastic=plan.style==='plastic',sculpted=plan.style==='sculpted',smooth=sculpted||plastic||plan.style==='smooth';
  const prepared=plan.shapes.map(shape=>({shape,geometry:geometry(shape,smooth,plastic,sculpted)}));
  const noise=sculpted?createSurfaceNoise():null;
  if(sculpted){
    group.userData.surfaceShading={version:SURFACE_SHADER_VERSION,...bakeSurfaceOcclusion(prepared),contactMapSize:512};
    group.userData.disposeSurfaceNoise=()=>noise!.dispose();
    group.add(createGroundContact(prepared));
  }
  for(const category of ['default','stone','leaves','metal','water','wood','canvas','trail','ground','grass','glow']){
    const glow=category==='glow';
    const pieces=prepared.filter(p=>(p.shape.glow?'glow':p.shape.material??'default')===category).map(p=>p.geometry);
    if(!pieces.length)continue;
    const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
    if(!merged)throw new Error('场景几何合并失败');
    merged.computeBoundingSphere();
    const mesh=new Mesh(merged,glow?new MeshBasicMaterial({vertexColors:true}):sculpted?createSurfaceMaterial(category as SurfaceFinish,noise!):stabilizeShadows(new MeshStandardMaterial({vertexColors:true,side:category==='stone'?DoubleSide:undefined,roughness:category==='metal'?.3:category==='stone'?.92:category==='leaves'?.86:sculpted?.42:plastic?.48:smooth?.7:1,metalness:category==='metal'?.35:0,flatShading:!smooth})));
    mesh.castShadow=!glow&&!['water','trail','grass','ground'].includes(category);mesh.receiveShadow=!glow;group.add(mesh);
  }
  if(plan.meadow)group.add(createMeadowGround(noise!));
  for(const sign of plan.signs){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
    const ctx=canvas.getContext('2d')!;
    ctx.fillStyle=sign.background;ctx.fillRect(0,0,1024,256);
    if(sign.style==='facility'){
      const sheen=ctx.createLinearGradient(0,0,0,256);sheen.addColorStop(0,'#ffffff24');sheen.addColorStop(.5,'#ffffff00');sheen.addColorStop(1,'#071e3b20');ctx.fillStyle=sheen;ctx.fillRect(0,0,1024,256);
      ctx.strokeStyle='#ffffff99';ctx.lineWidth=7;ctx.beginPath();ctx.roundRect(9,9,1006,238,27);ctx.stroke();
      ctx.textAlign='center';ctx.lineJoin='round';ctx.font='900 112px sans-serif';
      ctx.strokeStyle='#18354d';ctx.lineWidth=12;ctx.strokeText(sign.title,512,137);
      ctx.fillStyle='#ffffff';ctx.fillText(sign.title,512,137);
      ctx.font='bold 34px sans-serif';ctx.fillText(sign.subtitle,512,209);
    }else{
    ctx.fillStyle='#00000014';for(let i=0;i<8;i++){ctx.fillRect(0,30+i*29,1024,2);ctx.fillRect(80+i*119,18,2,219);}
    ctx.strokeStyle='#00000044';ctx.lineWidth=10;ctx.strokeRect(5,5,1014,246);
    ctx.strokeStyle=sign.color;ctx.lineWidth=4;ctx.strokeRect(13,13,998,230);
    ctx.fillStyle='#fbefda';ctx.textAlign='center';ctx.font='bold 76px sans-serif';ctx.fillText(sign.title,512,121);
    ctx.fillStyle=sign.color;ctx.font='28px sans-serif';ctx.fillText(sign.subtitle,512,195);
    for(const x of [30,994])for(const y of [30,226]){ctx.fillStyle=sign.color;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}
    }
    const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
    const mesh=new Mesh(new PlaneGeometry(sign.width,sign.width/4),new MeshBasicMaterial({map:texture}));
    mesh.position.set(...sign.at);mesh.rotation.y=sign.yaw??0;group.add(mesh);
  }
  return group;
}
export { disposeScenery } from './disposeScenery.ts';
