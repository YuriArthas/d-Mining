import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { CAPSULE_MACHINE_AT, CAPSULE_MACHINE_YAW } from '../content/feedbackFacilities.ts';
import { disposeScenery } from './disposeScenery.ts';

// The capsule machine's label, clear above the cabinet's roof; the authored scene supplies the cabinet. No distance-based visibility/unloading.
export class FeedbackFixtures {
  readonly group = new Group();
  constructor() {
    this.group.name = 'mining-feedback-fixtures';
    const machine = new Group(); machine.name = 'capsule-machine'; machine.position.set(...CAPSULE_MACHINE_AT); machine.rotation.y = CAPSULE_MACHINE_YAW;
    const label=document.createElement('canvas');label.width=512;label.height=128;
    const ctx=label.getContext('2d');if(!ctx)throw Error('无法绘制扭蛋机标签');
    ctx.fillStyle='#37244f';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff2b3';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.fillText('幸运扭蛋',256,54);ctx.font='28px sans-serif';ctx.fillText('1 枚幸运币 · 靠近按 E',256,100);
    const map=new CanvasTexture(label);map.colorSpace=SRGBColorSpace;
    const sign=new Mesh(new PlaneGeometry(3.5,.875),new MeshBasicMaterial({map,toneMapped:false}));sign.position.set(0,5.25,.1);machine.add(sign);
    this.group.add(machine);
  }
  dispose(){this.group.removeFromParent();disposeScenery(this.group);}
}
