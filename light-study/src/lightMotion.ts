export type MotionMode='off'|'paused'|'moving';
export const MOTION_PERIOD=32;
/** Seconds, independent of frame rate. Pause/visibility changes reset the clock
 * anchor so a hidden tab never jumps along the route on return. */
export class LightMotion {
  mode:MotionMode='paused';
  seconds=0;
  private previous:number|null=null;
  setMode(mode:MotionMode){this.mode=mode;this.resetClock();}
  resetClock(){this.previous=null;}
  tick(nowMs:number){
    if(this.mode==='moving'&&this.previous!==null)this.seconds+=(nowMs-this.previous)/1000;
    this.previous=nowMs;
    return this.pose();
  }
  seek(seconds:number){if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid lantern time');this.seconds=seconds;this.resetClock();return this.pose();}
  pose():[number,number,number]{const phase=this.seconds/MOTION_PERIOD*Math.PI*2;return [.65,1.12,-3+10*Math.cos(phase)];}
}
