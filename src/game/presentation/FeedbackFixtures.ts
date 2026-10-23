import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { CHALLENGE_BOARD_AT, CAPSULE_MACHINE_AT, CAPSULE_MACHINE_YAW } from '../content/feedbackFacilities.ts';
import type { ChallengeMiner } from '../logic/ChallengeBoard.ts';
import { disposeScenery } from './disposeScenery.ts';

// Live data labels; authored scene assets supply the furniture shells. Their labels render real session data; they never
// award currency or advance progression. No distance-based visibility/unloading.
export class FeedbackFixtures {
  readonly group = new Group();
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private lastDepth = -1;
  constructor() {
    this.group.name = 'mining-feedback-fixtures';
    this.canvas.width = 768; this.canvas.height = 896;
    this.texture = new CanvasTexture(this.canvas); this.texture.colorSpace = SRGBColorSpace;
    const board = new Group(); board.position.set(...CHALLENGE_BOARD_AT);
    const face = new Mesh(new PlaneGeometry(4.4,5.15),new MeshBasicMaterial({map:this.texture,toneMapped:false}));
    face.position.set(0,4,.18); board.add(face); this.group.add(board);

    const machine = new Group(); machine.name = 'capsule-machine'; machine.position.set(...CAPSULE_MACHINE_AT); machine.rotation.y = CAPSULE_MACHINE_YAW;
    const label=document.createElement('canvas');label.width=512;label.height=128;
    const ctx=label.getContext('2d');if(!ctx)throw Error('无法绘制扭蛋机标签');
    ctx.fillStyle='#37244f';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff2b3';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.fillText('幸运扭蛋',256,54);ctx.font='28px sans-serif';ctx.fillText('1 枚幸运币 · 靠近按 E',256,100);
    const map=new CanvasTexture(label);map.colorSpace=SRGBColorSpace;
    const sign=new Mesh(new PlaneGeometry(3.5,.875),new MeshBasicMaterial({map,toneMapped:false}));sign.position.set(0,4.9,.1);machine.add(sign);
    this.group.add(machine);
  }
  update(rows:readonly ChallengeMiner[],depth:number){
    const shown=Math.floor(depth);if(this.lastDepth===shown)return;this.lastDepth=shown;
    const c=this.canvas.getContext('2d');if(!c)throw Error('无法绘制矿工挑战榜');
    c.fillStyle='#192b30';c.fillRect(0,0,768,896);c.textAlign='center';c.fillStyle='#ffe7a2';c.font='bold 54px sans-serif';c.fillText('矿工挑战榜',384,88);
    c.fillStyle='#c3d4d0';c.font='26px sans-serif';c.fillText('单机挑战 · 历史最深',384,135);
    rows.forEach((r,i)=>{
      const y=174+i*78;c.fillStyle=r.id==='self'?'#365f65':i%2?'#20383e':'#243e43';c.fillRect(26,y,716,68);
      c.textAlign='left';c.fillStyle=r.id==='self'?'#ffeb9a':'#edf4ee';c.font=r.id==='self'?'bold 34px sans-serif':'32px sans-serif';c.fillText(`${i+1}  ${r.name}`,48,y+45);
      c.textAlign='right';c.fillText(`${r.depth} m`,716,y+45);
    });
    c.textAlign='center';c.fillStyle='#b2ccc5';c.font='25px sans-serif';c.fillText('继续向下，刷新你的纪录',384,856);this.texture.needsUpdate=true;
  }
  dispose(){this.group.removeFromParent();disposeScenery(this.group);}
}
