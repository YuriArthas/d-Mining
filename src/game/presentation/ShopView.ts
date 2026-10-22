import { Box3, Color, DirectionalLight, Group, HemisphereLight, MathUtils, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector2, Vector3, type WebGLRenderer } from 'three';
import type { ShopCategory, ShopItem } from '../content/shopCatalog.ts';
import { EQUIPMENT_URL, SHOWROOM_URL, loadShopAsset, requiredModel } from './EquipmentModels.ts';
import { disposeScenery } from './disposeScenery.ts';

type ShopState=Readonly<{mode:'closed'|'categories'|ShopCategory;index:number;ready:boolean;error:string|null}>;
/** Presentation state only. Shares the game's renderer/RAF; never edits the world or saves. */
export class ShopView {
  private state:ShopState={mode:'closed',index:0,ready:false,error:null};
  private listeners=new Set<()=>void>();
  readonly scene=new Scene();
  private camera=new PerspectiveCamera(38,2,.1,150);
  private strip=new Group();
  private sources:Group[]=[];
  private abort:AbortController|null=null;
  private items:readonly ShopItem[]=[];
  private position=0;
  private builtCategory:ShopCategory|null=null;
  private clock=0;
  private size=new Vector2();
  frames=0;
  constructor() {
    this.scene.background=new Color('#b87e52');
    this.scene.add(new HemisphereLight('#f7f5e1','#5b667b',2.0));
    const sun=new DirectionalLight('#fff2d6',2.3);sun.position.set(-5,9,7);this.scene.add(sun);
    const fill=new DirectionalLight('#b7dfff',.6);fill.position.set(6,4,1);this.scene.add(fill);
    this.scene.add(this.strip);
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
      const stage=requiredModel(this.sources[1],'ShowroomStage').clone(true);stage.name='shop-stage';this.scene.add(stage);
      this.set({ready:true});
      if(this.showroom)this.build(this.state.mode as ShopCategory);
    }catch(error){this.fail(error);}
  }
  private fail(error:unknown) {
    this.strip.clear();this.scene.getObjectByName('shop-stage')?.removeFromParent();
    for(const source of this.sources)disposeScenery(source);
    this.sources=[];this.builtCategory=null;this.set({ready:false,error:String(error)});
  }
  private build(category:ShopCategory) {
    if(category===this.builtCategory&&this.strip.children.length===this.items.length)return;
    this.strip.clear();this.builtCategory=category;this.position=this.state.index;
    for(const [index,item] of this.items.entries()) {
      const station=new Group();station.position.x=index*6.6;
      const cart=requiredModel(this.sources[1],'ShowCart').clone(true);station.add(cart);
      const product=requiredModel(this.sources[0],item.model).clone(true);product.name='product';
      if(category==='tools')product.rotation.y=Math.PI/2;
      product.updateMatrixWorld(true);const bounds=new Box3().setFromObject(product),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
      const scale=(category==='tools'?2.20:2.0)/Math.max(size.y,size.x);
      product.scale.setScalar(scale);product.position.set(-center.x*scale,2.15-bounds.min.y*scale,-center.z*scale);
      station.add(product);station.userData.item=item.id;station.userData.model=item.model;this.strip.add(station);
    }
  }
  render(gl:WebGLRenderer,delta:number) {
    if(!this.showroom||!this.state.ready||this.state.error)return false;
    gl.getSize(this.size);const aspect=this.size.x/this.size.y;
    this.camera.aspect=aspect;this.camera.position.set(0,4.0,15.0);this.camera.lookAt(0,1.8,0);this.camera.updateProjectionMatrix();
    this.position=MathUtils.damp(this.position,this.state.index,12,Math.min(delta,.06));this.strip.position.x=-this.position*6.6;
    this.clock+=Math.min(delta,.06);
    for(const station of this.strip.children){const product=station.getObjectByName('product');if(product)product.rotation.y=(this.builtCategory==='tools'?Math.PI/2:0)+.18*Math.sin(this.clock*.65);}
    gl.render(this.scene,this.camera);this.frames++;return true;
  }
  diagnostics(){return {...this.state,frames:this.frames,displayedIndex:this.position,current:this.items[this.state.index]?.id,next:this.items[this.state.index+1]?.id,models:this.strip.children.map(o=>({id:o.userData.item,model:o.userData.model,x:o.position.x+this.strip.position.x}))};}
  dispose(){
    this.abort?.abort();this.abort=null;this.strip.clear();this.scene.getObjectByName('shop-stage')?.removeFromParent();
    for(const source of this.sources)disposeScenery(source);this.sources=[];this.builtCategory=null;
    this.set({mode:'closed',ready:false,error:null});
  }
}
