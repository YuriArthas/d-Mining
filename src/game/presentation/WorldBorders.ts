import { Group } from 'three';
import { RAPIER, type CharacterPhysics } from '../validation/physics.ts';
import { WORLD_REQUIREMENTS, worldGateZ } from '../content/worldJourney.ts';
import { PINEWIND_GATE } from '../content/pinewind/hubLayout.ts';
/** The worlds' borders on the surface: walls close every boundary between neighbouring worlds (a world is reached
 *  only by its portal). World 1's old gate in the south ridge is its portal: the gate model brings its own pillars,
 *  side walls and lintel (and the game leaves its doors out); here the opening is closed, behind the portal sheet
 *  (TeleportStations draws the disc). */
export class WorldBorders {
  readonly group=new Group();
  private readonly colliders:RAPIER.Collider[]=[];
  private readonly physics:CharacterPhysics;
  constructor(physics:CharacterPhysics) {
    this.physics=physics;
    const solid=(half:[number,number,number],at:[number,number,number])=>{this.colliders.push(physics.world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(...at)));};
    const gate=PINEWIND_GATE,half=gate.opening/2;
    for(const w of WORLD_REQUIREMENTS.slice(1)){
      const z=worldGateZ(w.id as 2|3);
      if(w.id===2)solid([half,gate.height/2,.4],[0,gate.height/2,z]);
      else solid([gate.wallTo,6,1],[0,6,z]);
      for(const sx of [-1,1]){const inner=gate.wallTo,outer=103,width=outer-inner;solid([width/2,6,1],[sx*(inner+width/2),6,z]);}
    }
  }
  owns(collider:RAPIER.Collider){return this.colliders.some(c=>c.handle===collider.handle);}
  dispose(){for(const c of this.colliders)this.physics.world.removeCollider(c,false);this.group.removeFromParent();}
}
