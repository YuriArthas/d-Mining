"""Audit one schema-2 report without mixing sessions or QA devices."""
import sys,json,math,hashlib,statistics
from pathlib import Path
source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
saved=json.loads(source.read_text());r=saved['report'];h=r['history'];assert r['schemaVersion'] in [2,3]
frames=[dict(zip(h['columns'],row)) for row in h['rows']]
assert len(frames)==h['frameCount'] and len({f['frame'] for f in frames})==len(frames)
for f in frames:f['cpuStages']=[{'label':h['stageLabels'][s[0]],'inclusiveMs':s[1],'exclusiveMs':s[2]} for s in f['cpuStages']]
def stats(fs,key):
 v=sorted(f[key] for f in fs if f[key] is not None)
 return {'count':len(v),'median':statistics.median(v) if v else None,'p95':v[math.ceil(len(v)*.95)-1] if v else None,'max':max(v) if v else None}
for group in h['summary']:
 fs=[f for f in frames if f['settings']==group['context'] and f['reason']==group['reason']]
 for name,key in [('cpu','cpu'),('completion','completionMs'),('gpu','gpu')]:
  expected=stats(fs,key);assert expected['count']==group[name]['count']
  for k in ['median','p95','max']:
   actual=group[name][k];assert actual is None if expected[k] is None else abs(actual-expected[k])<.00101
for f in frames:
 assert abs(f['cpu']-f['cpuOutsideStagesMs']-sum(s['exclusiveMs'] for s in f['cpuStages']))<.04
full={f['frame']:f for f in r['recentFrames']+[r['latestFrame']]};audits=[];missingDetails=[]
for f in frames:
 if f['gpu'] is None:continue
 if f['frame'] not in full:
  missingDetails.append(f['frame']);continue
 detail=full[f['frame']];intervals=sorted((p['startMs'],p['endMs']) for p in detail['gpuPasses']);a,b=intervals[0];union=0
 for start,end in intervals[1:]:
  if start>b:union+=b-a;a,b=start,end
  else:b=max(b,end)
 union+=b-a;span=max(e for s,e in intervals)-intervals[0][0];total=sum(e-s for s,e in intervals)
 for key,value in [('gpu',span),('gpuPassSumMs',total),('gpuOverlapMs',total-union)]:assert abs(f[key]-value)<.00101
 audits.append({'frame':f['frame'],'spanMs':span,'intervalUnionMs':union,'gapsMs':span-union,'sumMs':total,'overlapMs':total-union})
interaction=[f for f in frames if f['reason'] in ['interaction','animation']];noCreation=[f for f in interaction if not(f['newPipelines'] or f['newPrograms'])]
result={'id':saved['id'],'receivedAt':saved['receivedAt'],'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sessionId':r['sessionId'],'build':r['build'],'device':r['device'],'contexts':h['contexts'],'frameCount':len(frames),'wallSpanMs':h['wallSpanMs'],'gpuSamples':sum(f['gpu'] is not None for f in frames),'gpuAuditedSamples':len(audits),
 'interactionStats':{k:stats(interaction,k) for k in ['cpu','completionMs','gpu']},'noCreationInteractionStats':{k:stats(noCreation,k) for k in ['cpu','completionMs','gpu']},'creationFrames':[f for f in frames if f['newPipelines'] or f['newPrograms']],'frames':frames,'gpuAudit':audits,'gpuAuditMissingDetails':missingDetails,'runtimeErrors':r['scene']['errors'],
 'limits':['CPU stages locate synchronous elapsed time but are not native driver/compiler stacks.','Pipeline and program counters show creation, not exclusive creation duration.','GPU intervals overlap; elapsed span includes idle gaps.','Different camera positions do not constitute a controlled GPU optimization comparison.']}
(out/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['id','frameCount','wallSpanMs','gpuSamples','interactionStats','noCreationInteractionStats','runtimeErrors']},ensure_ascii=False))
