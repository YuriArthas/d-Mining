export type PassTiming={label:string;samples:number;ms:number;startMs:number;endMs:number};
export type QueryRecord={label:string;samples:number;offset:number};
export type FrameTiming={frameMs:number;passSumMs:number;overlapMs:number;passes:PassTiming[]};

/** Pass intervals can overlap on tiled/pipelined GPUs. Their sum is not frame time. */
export function summarizeFrame(records:QueryRecord[],times:BigUint64Array):FrameTiming{
  if(records.length===0)throw Error('GPU frame has no timestamp records');
  const intervals=records.map(r=>{
    const start=times[r.offset],end=times[r.offset+1];
    if(start===undefined||end===undefined||end<start)throw Error(`Invalid GPU timestamps: ${r.label}`);
    return {...r,start,end};
  });
  const ordered=[...intervals].sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
  const first=ordered[0].start;
  let last=ordered[0].end,segmentStart=first,segmentEnd=last,union=0n,sum=0n;
  for(const p of ordered){
    sum+=p.end-p.start;if(p.end>last)last=p.end;
    if(p.start>segmentEnd){union+=segmentEnd-segmentStart;segmentStart=p.start;segmentEnd=p.end;}
    else if(p.end>segmentEnd)segmentEnd=p.end;
  }
  union+=segmentEnd-segmentStart;
  return {frameMs:Number(last-first)/1e6,passSumMs:Number(sum)/1e6,overlapMs:Number(sum-union)/1e6,
    passes:intervals.map(p=>({label:p.label,samples:p.samples,ms:Number(p.end-p.start)/1e6,startMs:Number(p.start-first)/1e6,endMs:Number(p.end-first)/1e6}))};
}
