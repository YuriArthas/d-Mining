export const TOUR_PERIOD=30;
type Point=[number,number];
// Central street, northern ring, eastern ring and the central crossing. The
// rounded corners stay within the 6 m road corridors, outside building plots.
const corners:Point[]=[[0,25],[-25,25],[-25,-25],[0,-25],[0,0],[25,0],[25,25]];
const path:Point[]=[];
const unit=(a:Point,b:Point):Point=>{const d=Math.hypot(b[0]-a[0],b[1]-a[1]);return [(b[0]-a[0])/d,(b[1]-a[1])/d];};
for(let i=0;i<corners.length;i++){
  const p=corners[i],before=unit(p,corners[(i+corners.length-1)%corners.length]),after=unit(p,corners[(i+1)%corners.length]);
  const a:Point=[p[0]+before[0]*2.2,p[1]+before[1]*2.2],b:Point=[p[0]+after[0]*2.2,p[1]+after[1]*2.2];
  for(let j=0;j<=24;j++){
    const t=j/24,s=1-t;
    path.push([s*s*a[0]+2*s*t*p[0]+t*t*b[0],s*s*a[1]+2*s*t*p[1]+t*t*b[1]]);
  }
}
path.push(path[0]);
const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
export const TOUR_LENGTH=lengths.at(-1)!;
function atDistance(value:number):Point{
  const d=((value%TOUR_LENGTH)+TOUR_LENGTH)%TOUR_LENGTH;
  let lo=0,hi=lengths.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(lengths[mid]>d)hi=mid;else lo=mid;}
  const t=(d-lengths[lo])/(lengths[hi]-lengths[lo]);return [path[lo][0]+(path[hi][0]-path[lo][0])*t,path[lo][1]+(path[hi][1]-path[lo][1])*t];
}
export function districtPose(seconds:number){
  if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid district tour time');
  const distance=seconds/TOUR_PERIOD*TOUR_LENGTH,eye=atDistance(distance);
  // Keep the dolly looking into the district, including the outer corners.
  // This interior focus never intersects the road route, avoiding a look-at
  // singularity while crossing the central junction.
  return {eye:[eye[0],2.65,eye[1]] as [number,number,number],target:[8,2.1,8] as [number,number,number]};
}
export class DistrictTour{
  running=false;seconds=0;private previous:number|null=null;
  resetClock(){this.previous=null;}
  setRunning(value:boolean){this.running=value;this.resetClock();}
  seek(seconds:number){districtPose(seconds);this.seconds=seconds;this.resetClock();}
  tick(nowMs:number){if(this.running&&this.previous!==null)this.seconds+=Math.max(0,nowMs-this.previous)/1000;this.previous=nowMs;return districtPose(this.seconds);}
}
