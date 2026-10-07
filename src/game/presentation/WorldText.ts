import {Color,Group,Mesh,MeshBasicMaterial} from 'three';
import {mergeGroups} from 'three/addons/utils/BufferGeometryUtils.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../assets/sign-font.json' with {type:'json'};
import type {Sign} from '../world/sceneryKit.ts';
const font=new FontLoader().parse(fontData);

// Real extruded glyphs, including their backs and sides. No canvas or UI plane.
export function createWorldText(sign:Sign,detail:{bevel?:boolean}={}){
 const group=new Group();group.name='world-text:'+sign.title;
 function line(text:string,width:number,y:number){
  for(const c of text)if(!font.data.glyphs[c])throw Error(`标识缺少字形: ${c}`);
  const geometry=new TextGeometry(text,{font,size:1,depth:.16,curveSegments:5,bevelEnabled:detail.bevel??true,bevelThickness:.012,bevelSize:.01,bevelSegments:1});
  // ExtrudeGeometry emits front/side groups for every glyph contour. Collapse
  // identical material ranges: still real 3D text, exactly the same triangles.
  if(typeof location==='undefined'||new URLSearchParams(location.search).get('textGroups')!=='0')mergeGroups(geometry);
  geometry.computeBoundingBox();const b=geometry.boundingBox!;
  const scale=width/Math.max(.01,b.max.x-b.min.x);
  geometry.translate(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,-.08);geometry.scale(scale,scale,scale);
  const color=new Color(sign.color);
  const mesh=new Mesh(geometry,[new MeshBasicMaterial({color}),new MeshBasicMaterial({color:color.clone().multiplyScalar(.42)})]);
  mesh.position.y=y;group.add(mesh);
 }
 line(sign.title,sign.width,0);
 if(sign.subtitle)line(sign.subtitle,sign.width*.7,-sign.width*.23);
 group.position.set(...sign.at);group.rotation.y=sign.yaw??0;
 group.userData.label={text:sign.title,extruded:true};
 return group;
}
