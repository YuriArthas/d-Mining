import { Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SpotLight, Vector2, Vector3, type Object3D, type WebGLRenderer } from 'three';
import type { ShopCategory, ShopItem } from '../content/shopCatalog.ts';
import { EQUIPMENT_URL, SHOWROOM_URL, loadShopAsset, requiredModel } from './EquipmentModels.ts';
import { disposeScenery } from './disposeScenery.ts';

type ShopState=Readonly<{mode:'closed'|'categories'|ShopCategory;index:number;ready:boolean;error:string|null}>;

/** Carts stand still along one long track, one bay each; the camera travels. */
export const SHOWROOM = {
  spacing: 6.6,
  /** The authored stage (48 m) repeats every 46.2 m: its back wall's pitch, seven bays. */
  tile: 46.2,
  /** Camera spring: underdamped, so a glide speeds up, eases in and settles with the slightest overshoot.
   *  Its pull is capped at `reach` metres, so a jump across many bays cruises (at most about 60 m/s) instead
   *  of whipping past. */
  spring: { omega: 8.5, damping: .82, reach: 12 },
} as const;
/** Timber frame parts of the stage: taken out of the repeating backdrop and set between the bays instead. */
const FRAME = /^(MinePost|Beam|PostIron|LampRoof|LampGlow)/;

/** One step of a damped spring pulling `x` toward `target` (semi-implicit, sub-stepped for stability). */
export function springStep(x: number, v: number, target: number, dt: number, omega: number = SHOWROOM.spring.omega, damping: number = SHOWROOM.spring.damping, reach: number = SHOWROOM.spring.reach) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
  for (let i = 0; i < steps; i++) { v += (-2 * damping * omega * v - omega * omega * Math.max(-reach, Math.min(reach, x - target))) * h; x += v * h; }
  return [x, v] as const;
}
const damp = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);

/** Presentation state only. Shares the game's renderer/RAF; never edits the world or saves. */
export class ShopView {
  private state:ShopState={mode:'closed',index:0,ready:false,error:null};
  private listeners=new Set<()=>void>();
  readonly scene=new Scene();
  private camera=new PerspectiveCamera(34,2,.1,200);
  private strip=new Group();
  private stage=new Group();
  private sources:Group[]=[];
  private abort:AbortController|null=null;
  private items:readonly ShopItem[]=[];
  /** The shelf built: its category and items (a counter's shelf changes when its newest pickaxe does). */
  private builtCategory:string|null=null;
  private clock=0;
  private size=new Vector2();
  /** Camera rig: position along the track (m) and its speed; `intro` eases the opening dolly-in. */
  private rig={x:0,v:0,intro:0,px:0,py:0};
  private pointer=new Vector2();
  private spot=new SpotLight('#fff1d2',0,0,.36,.7,0);
  private look=new Vector3();
  frames=0;
  constructor() {
    this.scene.background=new Color('#7a4f35');
    this.scene.add(new HemisphereLight('#f7f0dc','#4b5468',1.0));
    const sun=new DirectionalLight('#fff2d6',1.0);sun.position.set(-5,9,7);this.scene.add(sun);
    const fill=new DirectionalLight('#b7dfff',.5);fill.position.set(6,4,1);this.scene.add(fill);
    // The selected item stands in its own pool of warm light.
    this.spot.position.set(0,10,6);this.scene.add(this.spot,this.spot.target);
    this.scene.add(this.stage,this.strip);
  }
  getSnapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private set(change:Partial<ShopState>){this.state={...this.state,...change};for(const l of this.listeners)l();}
  get active(){return this.state.mode!=='closed';}
  get showroom(){return this.state.mode==='tools'||this.state.mode==='backpacks';}
  categories=()=>this.set({mode:'categories'});
  close=()=>this.set({mode:'closed'});
  show=(category:ShopCategory,items:readonly ShopItem[],index:number)=>{
    this.items=items;this.set({mode:category,index:Math.max(0,Math.min(items.length-1,index))});
    if(this.state.ready){try{this.build(category);}catch(error){this.fail(error);}}else void this.load();
  };
  select=(index:number)=>this.set({index:Math.max(0,Math.min(this.items.length-1,index))});
  /** Pointer position over the showroom, -1..1 each way: the camera leans a little toward it. */
  setPointer=(x:number,y:number)=>{this.pointer.set(Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y)));};
  retry=()=>{this.set({error:null});void this.load();};
  private async load() {
    if(this.abort||this.state.ready)return;
    const abort=this.abort=new AbortController();
    const loaded=await Promise.allSettled([EQUIPMENT_URL,SHOWROOM_URL].map(u=>loadShopAsset(u,abort.signal)));
    if(abort.signal.aborted){for(const x of loaded)if(x.status==='fulfilled')disposeScenery(x.value);return;}
    this.abort=null;
    const bad=loaded.find(x=>x.status==='rejected');
    if(bad?.status==='rejected'){for(const x of loaded)if(x.status==='fulfilled')disposeScenery(x.value);this.set({error:String(bad.reason)});return;}
    this.sources=loaded.map(x=>(x as PromiseFulfilledResult<Group>).value);
    try {
      for(const root of this.sources)root.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof MeshStandardMaterial){m.roughness=.86;m.metalness=0;}});
      requiredModel(this.sources[1],'ShowroomStage');
      this.set({ready:true});
      if(this.showroom)this.build(this.state.mode as ShopCategory);
    }catch(error){this.fail(error);}
  }
  private fail(error:unknown) {
    this.strip.clear();this.stage.clear();
    for(const source of this.sources)disposeScenery(source);
    this.sources=[];this.builtCategory=null;this.set({ready:false,error:String(error)});
  }
  /** The long track: the stage's floor, rails and wall repeated every tile, and a timber frame with its lamps
   *  between every two bays, so each item stands in a bay of its own. */
  private buildStage(count:number) {
    this.stage.clear();
    const source=requiredModel(this.sources[1],'ShowroomStage'),backdrop=new Group(),frame=new Group();
    for(const part of source.children){
      if(!FRAME.test(part.name)){backdrop.add(part.clone(true));continue;}
      // One frame: the post set the authored stage stands at x = -13, moved to the origin.
      if(Math.abs(part.position.x+13)>.6)continue;
      const copy=part.clone(true);copy.position.x+=13;
      // Beams meet end to end over the bay pitch.
      if(part.name.startsWith('Beam'))copy.scale.x*=SHOWROOM.spacing/6.8;
      frame.add(copy);
    }
    const from=-24,to=(count-1)*SHOWROOM.spacing+24;
    for(let x=from,i=0;x<to+SHOWROOM.tile;x+=SHOWROOM.tile,i++){
      // Neighbouring tiles overlap a little; alternate ones sit a hair higher so coplanar floors never fight.
      const tile=backdrop.clone(true);tile.position.set(x,(i%2)*.004,0);this.stage.add(tile);
    }
    for(let i=0;i<=count;i++){const f=frame.clone(true);f.position.x=(i-.5)*SHOWROOM.spacing;this.stage.add(f);}
  }
  private build(category:ShopCategory) {
    const shelf=`${category}:${this.items.map(i=>i.id).join(',')}`;
    if(shelf===this.builtCategory)return;
    this.strip.clear();this.builtCategory=shelf;
    this.buildStage(this.items.length);
    for(const [index,item] of this.items.entries()) {
      const station=new Group();station.position.x=index*SHOWROOM.spacing;
      const cart=requiredModel(this.sources[1],'ShowCart').clone(true);station.add(cart);
      const product=requiredModel(this.sources[0],item.model).clone(true);product.name='product';
      // Clubs lean in the hand ('Hold'); on the cart every tool stands upright, turned three-quarters to the camera.
      // Node names repeat between models, so the loader numbers them (Hold, Hold001, ...).
      product.children.find(o=>o.name.startsWith('Hold'))?.quaternion.identity();
      if(category==='tools')product.rotation.y=Math.PI/2-.5;
      product.updateMatrixWorld(true);const bounds=new Box3().setFromObject(product),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
      const scale=(category==='tools'?1.9:2.0)/Math.max(size.y,size.x);
      // A pivot keeps the product's centre on its turntable axis.
      const pivot=new Group();pivot.name='turntable';pivot.position.y=2.15+size.y*scale/2;
      product.scale.setScalar(scale);product.position.copy(center).multiplyScalar(-scale);
      pivot.add(product);station.add(pivot);
      const spinners:Object3D[]=[];product.traverse(o=>{if(o.name.startsWith('Spin'))spinners.push(o);});
      station.userData={item:item.id,model:item.model,focus:index===this.state.index?1:0,spin:0,baseY:pivot.position.y,scale:1,spinners};
      this.strip.add(station);
    }
    // Open on the current item with a short dolly-in.
    this.rig.x=this.state.index*SHOWROOM.spacing;this.rig.v=0;this.rig.intro=0;
  }
  render(gl:WebGLRenderer,delta:number) {
    if(!this.showroom||!this.state.ready||this.state.error)return false;
    const dt=Math.min(delta,.05),rig=this.rig;
    gl.getSize(this.size);this.camera.aspect=this.size.x/this.size.y;
    this.clock+=dt;
    [rig.x,rig.v]=springStep(rig.x,rig.v,this.state.index*SHOWROOM.spacing,dt);
    rig.intro=damp(rig.intro,1,2.4,dt);rig.px=damp(rig.px,this.pointer.x,3,dt);rig.py=damp(rig.py,this.pointer.y,3,dt);
    const travel=Math.min(1,Math.abs(rig.v)/16),open=1-(1-rig.intro)**3;
    // Straight in front of the bay, the cart in the middle of the screen with its neighbours at the edges and
    // room below for the numbers and the buy button. The camera pulls back while it travels and looks a little
    // ahead the way it is going, drifts slightly when idle and leans toward the pointer.
    const narrow=this.camera.aspect<1.2;
    const sway=Math.sin(this.clock*.32)*.08,bob=Math.sin(this.clock*.41)*.04;
    this.camera.position.set(rig.x+sway+rig.px*.35,4.1+bob+.7*travel+2*(1-open)-rig.py*.25,(narrow?18:14)+3.2*travel+7*(1-open));
    this.look.set(rig.x+Math.max(-3,Math.min(3,rig.v*.05))+rig.px*.15,1.95-rig.py*.1,0);
    this.camera.lookAt(this.look);this.camera.updateProjectionMatrix();
    const spotX=rig.x;this.spot.position.set(spotX,10,6);this.spot.target.position.set(spotX,2.6,0);this.spot.target.updateMatrixWorld();
    this.spot.intensity=damp(this.spot.intensity,5,4,dt);
    for(const [index,station] of this.strip.children.entries()){
      const data=station.userData as {focus:number;spin:number;baseY:number;spinners:Object3D[]},pivot=station.getObjectByName('turntable');
      for(const spinner of data.spinners)spinner.rotateY(dt*8);
      if(!pivot)continue;
      data.focus=damp(data.focus,index===this.state.index?1:0,6,dt);
      // The selected item rises and turns on its turntable; the others rest, swaying gently.
      data.spin+=dt*.75*data.focus;
      pivot.rotation.y=data.spin+(1-data.focus)*.18*Math.sin(this.clock*.65+index);
      pivot.position.y=data.baseY+.32*data.focus+.06*data.focus*Math.sin(this.clock*1.6);
      pivot.scale.setScalar(.86+.14*data.focus);
    }
    gl.render(this.scene,this.camera);this.frames++;return true;
  }
  diagnostics(){return {...this.state,frames:this.frames,displayedIndex:this.rig.x/SHOWROOM.spacing,cameraSpeed:this.rig.v,current:this.items[this.state.index]?.id,next:this.items[this.state.index+1]?.id,
    camera:this.camera.position.toArray(),stageParts:this.stage.children.length,
    models:this.strip.children.map(o=>({id:o.userData.item,model:o.userData.model,x:o.position.x,focus:o.userData.focus}))};}
  dispose(){
    this.abort?.abort();this.abort=null;this.strip.clear();this.stage.clear();
    for(const source of this.sources)disposeScenery(source);this.sources=[];this.builtCategory=null;
    this.set({mode:'closed',ready:false,error:null});
  }
}
