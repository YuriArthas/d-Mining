import { Vector3, type Camera } from 'three';
// One DOM marker in the existing scene loop; no extra RAF or React frame updates.
export class GuideMarkerProjector {
 private readonly point=new Vector3();
 private readonly view=new Vector3();
 update(camera:Camera,anchor:readonly [number,number,number]|null,element:HTMLElement|null) {
  if(!element)return;
  if(!anchor){element.style.visibility='hidden';return;}
  this.point.set(...anchor).project(camera);
  this.view.set(...anchor).applyMatrix4(camera.matrixWorldInverse);
  let x=this.point.x,y=this.point.y;
  const behind=this.view.z>=0;
  if(behind){x=-x;y=-y;}
  if(!Number.isFinite(x)||!Number.isFinite(y)){x=0;y=-1;}
  const offscreen=behind||Math.abs(x)>.58||Math.abs(y)>.55;
  if(offscreen){if(Math.abs(x)+Math.abs(y)<.01)x=1;const factor=Math.max(Math.abs(x)/.58,Math.abs(y)/.55,.001);x/=factor;y/=factor;}
  element.dataset.offscreen=String(offscreen);
  element.style.setProperty('--guide-rotation',offscreen?`${Math.atan2(-x,-y)*180/Math.PI}deg`:'0deg');
  element.style.left=`${(x+1)*50}%`;element.style.top=`${(1-y)*50}%`;element.style.visibility='visible';
 }
}
