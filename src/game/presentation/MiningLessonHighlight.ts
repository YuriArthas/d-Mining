import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3, type PerspectiveCamera } from 'three';
import { createSelectionOutline } from './SelectionOutline.ts';
import { selectCell, SELECTION } from '../terrain/selection.ts';
import { CELL, type Coord } from '../terrain/SparseWorld.ts';
import { oreDefinition } from '../application/items.ts';

import { tr } from '../i18n/i18n.ts';
type Terrain = { cell(c:Coord):number|null; canMine(c:Coord):boolean };
export class MiningLessonHighlight {
  readonly group=new Group();
  readonly outline=createSelectionOutline();
  readonly fill=new Mesh(new BoxGeometry(CELL+.025,CELL+.025,CELL+.025),new MeshBasicMaterial({color:'#ffe45c',transparent:true,opacity:.32,depthWrite:false,toneMapped:false}));
  cell:Coord|null=null;
  anchor:Coord|null=null;
  private readonly point=new Vector3();
  private readonly projected=new Vector3();
  private readonly direction=new Vector3();
  private nextSearch=0;
  constructor() {
    this.group.name='onboarding-mine-highlight';this.group.visible=false;
    this.outline.material.color.set('#ffe45c');this.outline.material.linewidth=5;
    this.outline.visible=true;this.outline.renderOrder=5;this.fill.renderOrder=4;
    this.group.add(this.fill,this.outline);
  }
  private candidate(cell:Coord,camera:PerspectiveCamera,feet:readonly number[],terrain:Terrain,level:number) {
    const kind=terrain.cell(cell);
    if(!kind||!terrain.canMine(cell)||(oreDefinition(kind).requiredLevel??0)>level)return null;
    this.point.set((cell[0]+.5)*CELL,(cell[1]+.5)*CELL,(cell[2]+.5)*CELL);
    if(this.point.distanceToSquared(this.direction.set(feet[0],feet[1]+1,feet[2]))>(SELECTION.reach+CELL)**2)return null;
    const center:Coord=this.point.toArray();
    let best:{cost:number;point:Coord}|null=null;
    // Aim at an exposed face, not the cell centre behind the front lip/neighbor.
    for(const face of [[0,1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,-1,0]] as const){
      if(terrain.cell(cell.map((v,i)=>v+face[i]) as unknown as Coord))continue;
      this.point.set(...center.map((v,i)=>v+face[i]*(CELL*.5-.015)) as [number,number,number]);
      this.projected.copy(this.point).project(camera);
      if(this.projected.z < -1 || this.projected.z > 1 || Math.abs(this.projected.x)>.8 || this.projected.y<-.78 || this.projected.y>.35)continue;
      this.direction.copy(this.point).sub(camera.position).normalize();
      const hit=selectCell(camera.position.toArray(),this.direction.toArray(),[feet[0],feet[1]+1,feet[2]],c=>terrain.cell(c));
      if(!hit||hit.some((v,i)=>v!==cell[i]))continue;
      const cost=Math.abs(Math.abs(this.projected.x)-.25)+Math.abs(this.projected.y+.28);
      if(!best||cost<best.cost)best={cost,point:this.point.toArray()};
    }
    return best;
  }
  update(camera:PerspectiveCamera,feet:readonly number[],selected:Coord|null,terrain:Terrain,level:number,element:HTMLElement|null,enabled:boolean) {
    this.group.visible=false;
    if(!enabled||!element){this.cell=null;this.anchor=null;return;}
    const now=performance.now();
    const selectedFace=selected?this.candidate(selected,camera,feet,terrain,level):null;
    const currentFace=selectedFace??(this.cell?this.candidate(this.cell,camera,feet,terrain,level):null);
    if(selectedFace)this.cell=selected;
    if(!currentFace)this.cell=null;
    this.anchor=currentFace?.point??null;
    if(!this.cell&&now>=this.nextSearch){
      this.nextSearch=now+250;
      let score=Infinity;
      const cx=Math.floor(feet[0]/CELL),cy=Math.floor(feet[1]/CELL),cz=Math.floor(feet[2]/CELL),r=Math.ceil(SELECTION.reach/CELL);
      for(let y=cy-r;y<=cy+1;y++)for(let x=cx-r;x<=cx+r;x++)for(let z=cz-r;z<=cz+r;z++){
        const c:Coord=[x,y,z],face=this.candidate(c,camera,feet,terrain,level);
        if(face&&face.cost<score){score=face.cost;this.cell=c;this.anchor=face.point;}
      }
    }
    element.dataset.hasTarget=String(!!this.cell);
    element.style.visibility='visible';
    const caption=element.querySelector('.guide-dig-caption');
    const touch=element.dataset.input==='touch';
    if(!this.cell){
      element.style.left='50%';element.style.top='70%';element.dataset.below='false';
      if(caption)caption.textContent=touch?tr('拖动观察，寻找可挖方块'):tr('按住右键向下看，寻找可挖方块');
      return;
    }
    this.group.visible=true;
    this.group.position.set(...this.cell.map(v=>(v+.5)*CELL) as [number,number,number]);
    this.fill.material.opacity=.25+.13*(.5+.5*Math.sin(now*.005));
    this.projected.set(...this.anchor!).project(camera);
    element.style.left=`${(this.projected.x+1)*50}%`;element.style.top=`${(1-this.projected.y)*50}%`;
    element.dataset.cell=this.cell.join(',');
    // In the upper half of the screen the caption goes under the ring, clear of the place plate at the top.
    element.dataset.below=String(this.projected.y>0);
    if(caption)caption.textContent=touch?tr('长按这里挖矿'):tr('鼠标移到这里 · 按住左键');
  }
  dispose(){this.fill.geometry.dispose();this.fill.material.dispose();this.outline.geometry.dispose();this.outline.material.dispose();this.group.removeFromParent();}
}
