import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rockProfile, type RockProfile } from '../world/rockProfile.ts';
import { BufferGeometry, CylinderGeometry, DodecahedronGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, SphereGeometry, LatheGeometry, Vector2, Vector3, CatmullRomCurve3, TubeGeometry } from 'three';

// Model-space building blocks for surface art. All are merged by material by SceneryMesh.
export function crownGeometry() {
  const g=new SphereGeometry(1,80,48),p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x);
    const lobes=1+.12*Math.cos(a*3+.7)*(1-y*y)+.045*Math.sin(a*5-y*3);
    p.setXYZ(i,x*lobes+.07*y,y*.94+.045*Math.cos(a*3)*(1-y*y),z*lobes);
  }
  g.computeVertexNormals();return g;
}
export function cutRockGeometry(kind:RockProfile='rock') {
  const {vertices,indices}=rockProfile(kind,[1,1,1],96,56);
  const source=new BufferGeometry();source.setAttribute('position',new Float32BufferAttribute(vertices,3));source.setIndex(indices);
  const g=mergeVertices(source,.00001);source.dispose();g.computeVertexNormals();
  g.setAttribute('uv',new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));return g;
}
export function horizonGeometry() {
  const {vertices,indices}=rockProfile('bluff',[1,1,1],32,18);
  const source=new BufferGeometry();source.setAttribute('position',new Float32BufferAttribute(vertices,3));source.setIndex(indices);
  const g=mergeVertices(source,.00001);source.dispose();g.computeVertexNormals();
  g.setAttribute('uv',new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));return g;
}
// A single continuous landscape outside the playable clearing. The inner edge
// is irregular and low, then rises over distance into broad asymmetric hills;
// it has no vertical face and therefore reads as terrain instead of a wall.
export function terrainBackdropGeometry() {
  const sectors=160,rings=22,positions:number[]=[],indices:number[]=[];
  const inner=(a:number)=>42+5*Math.sin(a*2.0+.7)+3*Math.sin(a*5.0-1.4);
  const field=(r:number,a:number)=>{
    const t=Math.max(0,Math.min(1,(r-34)/145));
    const rise=t*t*(3-2*t);
    const peak=.5+.5*Math.sin(a*1.7+1.4*Math.sin(a*2.9-1.1));
    const ridge=.5+.5*Math.sin(a*3.9-1.2*Math.sin(a*1.3+2.4));
    return rise*(4+16*peak*peak+8*ridge*ridge)+2.5*Math.sin(a*7.0+r*.045)+1.4*Math.cos(a*11.0-r*.025);
  };
  for(let j=0;j<=rings;j++){
    const t=j/rings,r=34+t*145;
    for(let i=0;i<=sectors;i++){
      const a=i/sectors*Math.PI*2;
      const edge=inner(a),rad=Math.max(r,edge);
      positions.push(Math.sin(a)*rad,Math.max(0,field(rad,a)),Math.cos(a)*rad);
    }
  }
  for(let j=0;j<rings;j++)for(let i=0;i<sectors;i++){
    const a=j*(sectors+1)+i,b=a+sectors+1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  g.setAttribute('uv',new Float32BufferAttribute(new Float32Array(positions.length/3*2),2));return g;
}
export function trunkGeometry() { return new CylinderGeometry(.55,1,1,64,12).translate(0,.5,0); }
export function archGeometry() {
  const path=new Shape();path.moveTo(-.5,-.23);path.quadraticCurveTo(-.5,-.13,-.45,-.08);path.quadraticCurveTo(0,.57,.45,-.08);path.quadraticCurveTo(.5,-.13,.5,-.23);
  path.lineTo(.5,-.4);path.quadraticCurveTo(0,.12,-.5,-.4);path.closePath();
  const g=new ExtrudeGeometry(path,{depth:1,steps:1,curveSegments:64,bevelEnabled:true,bevelSegments:8,bevelSize:.018,bevelThickness:.04});
  g.translate(0,0,-.5);return g;
}
export function awningGeometry() {
  // Rounded roof plan with a scalloped front edge, extruded as one thick shell.
  const path=new Shape();path.moveTo(-.5,-.4);path.quadraticCurveTo(-.5,-.5,-.4,-.5);path.lineTo(.4,-.5);path.quadraticCurveTo(.5,-.5,.5,-.4);path.lineTo(.5,.28);
  for(let i=0;i<6;i++){const x=.5-i/6;path.quadraticCurveTo(x-1/12,.57,x-1/6,.28);}
  path.lineTo(-.5,-.4);path.closePath();
  return new ExtrudeGeometry(path,{depth:1,steps:1,curveSegments:32,bevelEnabled:true,bevelSegments:8,bevelSize:.02,bevelThickness:.08}).rotateX(-Math.PI/2).translate(0,-.5,0);
}
export function gemGeometry() {
  // Separate from terrain ores: a decorative cut stone with wide planar faces.
  return new DodecahedronGeometry(1,0);
}

// Authored profiles and swept curves keep each landmark's silhouette independent of placement.
export function profileGeometry(contour:[number,number][]) {
  // Round profile corners as well as the circular cross section. More angular slices
  // alone cannot remove the horizontal creases of a coarse profile.
  const points:Vector2[]=[new Vector2(...contour[0])];
  for(let i=1;i<contour.length-1;i++){
    const previous=new Vector2(...contour[i-1]),corner=new Vector2(...contour[i]),next=new Vector2(...contour[i+1]);
    const a=corner.clone().lerp(previous,.22),b=corner.clone().lerp(next,.22);points.push(a);
    for(let j=1;j<=10;j++){const t=j/10;points.push(a.clone().multiplyScalar((1-t)**2).addScaledVector(corner,2*t*(1-t)).addScaledVector(b,t*t));}
  }
  points.push(new Vector2(...contour.at(-1)!));return new LatheGeometry(points,128);
}
export function sweepGeometry(path:[number,number,number][],radii:number[]) {
  const curve=new CatmullRomCurve3(path.map(p=>new Vector3(...p)));
  const segments=Math.max(48,Math.min(384,Math.ceil(curve.getLength()*14))),sides=48;
  const g=new TubeGeometry(curve,segments,1,sides,false),p=g.getAttribute('position');
  for(let i=0;i<=segments;i++){
    const t=i/segments,center=curve.getPointAt(t),f=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(f));
    const radius=radii[j]+(radii[j+1]-radii[j])*(f-j);
    for(let k=0;k<=sides;k++){
      const index=i*(sides+1)+k;
      p.setXYZ(index,center.x+(p.getX(index)-center.x)*radius,center.y+(p.getY(index)-center.y)*radius,center.z+(p.getZ(index)-center.z)*radius);
    }
  }
  g.computeVertexNormals();return g;
}
export function contourGeometry(contour:[number,number][],floor:boolean) {
  const outline=floor?new CatmullRomCurve3(contour.map(p=>new Vector3(p[0],p[1],0)),true,'centripetal').getPoints(contour.length*16).map(p=>new Vector2(p.x,p.y)):contour.map(p=>new Vector2(...p));
  const path=new Shape(outline);path.closePath();
  const g=new ExtrudeGeometry(path,{depth:1,steps:1,bevelEnabled:true,bevelSegments:8,bevelSize:.04,bevelThickness:.08,curveSegments:12});
  if(floor)g.rotateX(-Math.PI/2);else g.translate(0,0,-.5);
  return g;
}
export function leafGeometry() {
  const g=new SphereGeometry(1,32,24),p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=(y+1)*.5;
    p.setXYZ(i,x*Math.pow(Math.sin(Math.PI*t),.5)*.44,y+1,z*.10+.3*t*t);
  }
  g.computeVertexNormals();return g;
}
export function cartShellGeometry() {
  // Open, rolled-lip hopper with a tapered belly, modelled as one continuous shell.
  const points:[[number,number],...[number,number][]]=[[0,.08],[.62,.08],[.74,.13],[.82,.35],[1,.90],[1.02,.98],[.98,1.04],[.92,1.04],[.88,.94],[.72,.35],[.63,.24],[0,.24]];
  const g=profileGeometry(points),p=g.getAttribute('position');
  // Convert the circular cross section into a rounded rectangular tub.
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),r=Math.hypot(x,z);
    p.setXYZ(i,Math.sign(Math.cos(a))*Math.sqrt(Math.abs(Math.cos(a)))*r,p.getY(i),Math.sign(Math.sin(a))*Math.sqrt(Math.abs(Math.sin(a)))*r);
  }
  g.computeVertexNormals();return g;
}

export function trailGeometry(path:[number,number,number][],width:number) {
  const curve=new CatmullRomCurve3(path.map(p=>new Vector3(...p))),n=Math.ceil(curve.getLength()*12),positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let i=0;i<=n;i++){
    const t=i/n,p=curve.getPointAt(t),d=curve.getTangentAt(t),w=width*.5*(1+.10*Math.sin(t*15));
    for(const side of [-1,1]){positions.push(p.x+d.z*w*side,.026,p.z-d.x*w*side);uv.push(t,(side+1)*.5);}
    if(i<n){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
