import {addAuthoredRoom} from './AuthoredRoomView.ts';
import {createWorldText} from './WorldText.ts';
import { compactSceneryGeometry } from './compactSceneryGeometry.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, SphereGeometry, TorusGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Euler, Matrix4, RingGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneryPlan, Shape } from '../world/scenery.ts';

/** One shape's geometry in plan space, with its colour baked into the vertices. `plastic` plans use crisp boxes
 *  and smooth rocks and cylinders; the default style bevels larger boxes and facets the rocks. */
export function sceneryShapeGeometry(s:Shape,plastic=false) {
  let g:BufferGeometry;
  switch(s.type){
    case 'box':g=plastic?new BoxGeometry(...s.size):Math.min(...s.size)>=.3?new RoundedBoxGeometry(...s.size,1,Math.min(.08,Math.min(...s.size)*.14)):new BoxGeometry(...s.size);break;
    case 'rock':g=(plastic?(Math.max(...s.size)>.5?new RoundedBoxGeometry(1.6,1.45,1.5,1,.16):new BoxGeometry(1.6,1.45,1.5)):new DodecahedronGeometry(1,0)).scale(...s.size);break;
    case 'cylinder':g=new CylinderGeometry(1,1,1,plastic&&Math.max(...s.size)>.6?12:6).scale(...s.size);break;
    case 'cap':g=new SphereGeometry(1,96,48,0,Math.PI*2,0,Math.PI/2).scale(...s.size);break;
    case 'torus':g=new TorusGeometry(s.size[0],s.size[1],32,160,s.size[2]);break;
    case 'ring':g=new RingGeometry(s.size[0]-s.size[1],s.size[0],160).rotateX(-Math.PI/2);break;
  }
  // Faceted rocks shade each face a little differently, so their triangle corners are separate.
  const faceted=!plastic&&s.type==='rock';
  if(g.index&&faceted){const flat=g.toNonIndexed();g.dispose();g=flat;}
  // Vertex colors permit hundreds of different painted parts in one draw call.
  const color=new Color(s.color),colors=new Float32Array(g.getAttribute('position').count*3);
  for(let i=0;i<colors.length;i+=3){
    const face=Math.floor(i/9),variation=faceted?.91+((face*13)%9)*.017:1;
    colors[i]=color.r*variation;colors[i+1]=color.g*variation;colors[i+2]=color.b*variation;
  }
  g.setAttribute('color',new BufferAttribute(colors,3));
  g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...(s.rotation??[0,0,0]))));
  g.translate(...s.at);
  return compactSceneryGeometry(g);
}
export function createScenery(plan:SceneryPlan):Group {
  const group=new Group(),plastic=plan.style==='plastic';
  const prepared=plan.shapes.map(shape=>({shape,geometry:sceneryShapeGeometry(shape,plastic)}));
  for(const glow of [false,true]){
    const pieces=prepared.filter(p=>!!p.shape.glow===glow).map(p=>p.geometry);
    if(!pieces.length)continue;
    const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
    if(!merged)throw new Error('场景几何合并失败');
    merged.computeBoundingSphere();
    const mesh=new Mesh(merged,glow?new MeshBasicMaterial({vertexColors:true}):new MeshStandardMaterial({vertexColors:true,roughness:plastic?.48:1,metalness:0,flatShading:!plastic}));
    mesh.castShadow=!glow;mesh.receiveShadow=!glow;group.add(mesh);
  }
  if(plan.authored)addAuthoredRoom(group,plan.authored);
  for(const sign of plan.signs)group.add(createWorldText(sign));
  return group;
}
export { disposeScenery } from './disposeScenery.ts';
