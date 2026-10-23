import { Vector3, type Camera } from 'three';
// One DOM label over the mine while it is in view; hidden otherwise (the ground arrow leads the way).
// No extra RAF or React frame updates.
export class GuideMarkerProjector {
 private readonly point=new Vector3();
 private readonly view=new Vector3();
 update(camera:Camera,anchor:readonly [number,number,number]|null,element:HTMLElement|null) {
  if(!element)return;
  if(!anchor){element.style.visibility='hidden';return;}
  this.point.set(...anchor).project(camera);
  this.view.set(...anchor).applyMatrix4(camera.matrixWorldInverse);
  const inView=this.view.z<0&&Math.abs(this.point.x)<.9&&Math.abs(this.point.y)<.85;
  element.dataset.offscreen=String(!inView);
  if(!inView){element.style.visibility='hidden';return;}
  element.style.left=`${(this.point.x+1)*50}%`;element.style.top=`${(1-this.point.y)*50}%`;element.style.visibility='visible';
 }
}
