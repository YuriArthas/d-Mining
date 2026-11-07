import {statistics} from './performanceHistory.ts';
/** Render submissions, not monitor presentation or 1000 / GPU time. Exclude
 * idle/hidden intervals by resetting the predecessor at each discontinuity. */
export class FrameCadence {
  private previous:number|null=null;
  private intervals:{at:number;ms:number}[]=[];
  reset(){this.previous=null;this.intervals=[];}
  add(now:number){
    if(this.previous!==null)this.intervals.push({at:now,ms:now-this.previous});
    this.previous=now;
    while(this.intervals.length>1&&this.intervals[0].at<now-2000)this.intervals.shift();
  }
  snapshot(){return summarizeIntervals(this.intervals.map(x=>x.ms));}
}
export function summarizeIntervals(intervals:number[]){
  const elapsed=intervals.reduce((a,b)=>a+b,0);
  return {fps:elapsed>0?intervals.length*1000/elapsed:null,intervalMs:statistics(intervals),elapsedMs:elapsed};
}
