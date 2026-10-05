import {yieldLoadingTask} from './prepareShaders.ts';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import { RAPIER, type CharacterPhysics } from '../validation/physics.ts';
import { ROOMS } from '../world/rooms.ts';
import { roomPlan, type SceneryPlan } from '../world/scenery.ts';
import { surfacePlan } from '../world/SurfaceAssetPlan.ts';
import { createScenery, disposeScenery } from './SceneryMesh.ts';
import type {SurfaceDetails} from './SurfaceDetails.ts';
import type {SurfaceTime} from '../world/SceneLighting.ts';
import { sceneryGeometryMemory } from './sceneryGeometryMemory.ts';

// Ordinary scene props use independent visual/physical residency. The voxel floor
// remains owned by terrain; the meadow apron is visual only and has an open shaft.
export class RoomFacilities {
  readonly group = new Group();
  revision=0;
  private visuals = new Map<string, Group>();
  private physical = new Map<string,RAPIER.Collider[]>();
  private plans = new Map<string,SceneryPlan>();
  private geometryMemory = new Map<string,ReturnType<typeof sceneryGeometryMemory>>();
  private readonly physics:CharacterPhysics;
  private readonly sites = [{id:'surface',depth:0},...ROOMS];
  constructor(physics:CharacterPhysics,surface:Group){this.physics=physics;this.visuals.set('surface',surface);this.group.add(surface);this.geometryMemory.set('surface',sceneryGeometryMemory(surface));this.revision++;}
  private plan(id:string) {
    let plan=this.plans.get(id);
    if(!plan){plan=id==='surface'?surfacePlan():roomPlan(ROOMS.find(r=>r.id===id)!);this.plans.set(id,plan);}
    return plan;
  }
  private ensureVisual(site:{id:string;depth:number}){
    if(this.visuals.has(site.id))return;
    const view=createScenery(this.plan(site.id));view.position.y=-site.depth;
    this.visuals.set(site.id,view);this.group.add(view);this.revision++;
    this.geometryMemory.set(site.id,sceneryGeometryMemory(view));
  }
  async prepare(signal:AbortSignal,onProgress:(done:number,total:number)=>void){
    for(const [i,site] of this.sites.entries()){
      await yieldLoadingTask(signal);this.ensureVisual(site);onProgress(i+1,this.sites.length);
    }
  }
  sync(feet:readonly number[]){
    for(const site of this.sites){
      const plan=this.plan(site.id);
      this.ensureVisual(site);
      // All authored scenery remains resident for the session; distance never controls visibility.
      // Per-prop culling keeps distant physics off even within a large site.
      for(const [i,solid] of plan.solids.entries()){
        const key=site.id+':'+i;
        const distance=Math.max(Math.abs(feet[0]-solid.at[0])-solid.half[0],Math.abs(feet[1]+site.depth-solid.at[1])-solid.half[1],Math.abs(feet[2]-solid.at[2])-solid.half[2],0);
        if(distance<=12&&!this.physical.has(key)){
          const shape=solid.triangles?RAPIER.ColliderDesc.trimesh(new Float32Array(solid.triangles.vertices),new Uint32Array(solid.triangles.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES):solid.hull?RAPIER.ColliderDesc.convexHull(new Float32Array(solid.hull)):RAPIER.ColliderDesc.cuboid(...solid.half);
          if(!shape)throw new Error('场景岩石凸包构建失败');
          const desc=shape.setTranslation(solid.at[0],solid.at[1]-site.depth,solid.at[2]).setRotation({x:0,y:Math.sin(solid.yaw/2),z:0,w:Math.cos(solid.yaw/2)});
          this.physical.set(key,[this.physics.world.createCollider(desc)]);
        }
        if(distance>22&&this.physical.has(key)){for(const c of this.physical.get(key)!)this.physics.world.removeCollider(c,false);this.physical.delete(key);}
      }

    }
  }
  updateSurface(time:SurfaceTime,elapsed:number,bakedShadowsEnabled:boolean){(this.visuals.get('surface')?.userData.surfaceDetails as SurfaceDetails|undefined)?.update(time,elapsed,bakedShadowsEnabled);}
  beginSurfaceDraw(){(this.visuals.get('surface')?.userData.surfaceDetails as SurfaceDetails|undefined)?.beginDraw();}
  surfaceHeight(x:number,z:number){
    const surface=this.visuals.get('surface');if(!surface)return null;surface.updateMatrixWorld(true);
    const ray=new Raycaster(new Vector3(x,250,z),new Vector3(0,-1,0)),ground:Mesh[]=[];
    surface.traverse(o=>{if(o instanceof Mesh&&o.userData.surfaceGround===true)ground.push(o);});
    return ray.intersectObjects(ground,false)[0]?.point.y??null;
  }
  diagnostics(){return {ponds:this.visuals.get('surface')?.userData.ponds??null,boundaryStitching:this.visuals.get('surface')?.userData.boundaryStitching??null,surfaceDetails:(this.visuals.get('surface')?.userData.surfaceDetails as SurfaceDetails|undefined)?.diagnostics()??null,surfaceHub:this.visuals.get('surface')?.userData.hub??null,visuals:[...this.visuals.keys()],geometryMemory:Object.fromEntries(this.geometryMemory),colliders:this.physical.size,surfaceShading:this.visuals.get('surface')?.userData.surfaceShading??null};}
  dispose(){for(const g of this.visuals.values())disposeScenery(g);this.visuals.clear();for(const list of this.physical.values())for(const c of list)this.physics.world.removeCollider(c,false);this.physical.clear();this.plans.clear();this.geometryMemory.clear();}
}
