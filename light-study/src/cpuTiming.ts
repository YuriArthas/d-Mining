export type CpuStage={label:string;inclusiveMs:number;exclusiveMs:number};

/** Inspector calls nest (the composite renders its inputs). Subtract children
 * before attributing CPU cost, so a stage is never charged twice. */
export class CpuStageTimer {
  private stack:{uid:string;label:string;start:number;children:number}[]=[];
  private stages:CpuStage[]=[];
  reset(){this.stack=[];this.stages=[];}
  begin(uid:string,label:string,now:number){this.stack.push({uid,label,start:now,children:0});}
  end(uid:string,now:number){
    const entry=this.stack.pop();
    if(!entry||entry.uid!==uid)throw Error('CPU render-stage nesting mismatch');
    const inclusiveMs=Math.max(0,now-entry.start);
    this.stages.push({label:entry.label,inclusiveMs,exclusiveMs:Math.max(0,inclusiveMs-entry.children)});
    const parent=this.stack.at(-1);if(parent)parent.children+=inclusiveMs;
  }
  finish(){
    if(this.stack.length)throw Error('CPU render-stage timing is incomplete');
    return this.stages;
  }
}
