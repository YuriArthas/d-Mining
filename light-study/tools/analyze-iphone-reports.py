import json,hashlib,math
from pathlib import Path
from statistics import median
ids=['ec7eebc5-b515-464a-9ca6-18900db2bcd0','c5a2218c-e9f5-4546-aef7-ffd656088941','6c52c2e2-882c-4355-ab7c-e8db8b06a713','31b285c3-2c39-4cbc-84fa-5731d6eacefb','1f0c8a59-cbd9-4827-91de-388e07e9b4ef']
root=Path('/root/threejs_space/d-game1/data/mining-light-reports');out=Path('/root/threejs_space/d-Mining/light-study/artifacts/iphone-reports')
reports=[];sources=[];frames={}
for id in ids:
 p=root/(id+'.json');d=json.loads(p.read_text());r=d['report'];reports.append(d)
 sources.append({'id':id,'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 assert r['device']['adapter']['vendor']=='apple' and 'iPhone' in r['device']['userAgent']
 assert r['build']['module'].endswith('street-BPXekKtl.js')
 for f in r['recentFrames']+[r['latestFrame']]:
  key=(f['frame'],f['startedAtMs'])
  assert key not in frames or frames[key]==f,'Conflicting overlapping histories'
  frames[key]=f
for f in frames.values():
 if f['gpu'] is None:continue
 intervals=sorted((p['startMs'],p['endMs']) for p in f['gpuPasses'])
 first=intervals[0][0];last=max(b for a,b in intervals);a,b=intervals[0];union=0
 for start,end in intervals[1:]:
  if start>b:union+=b-a;a,b=start,end
  else:b=max(b,end)
 union+=b-a;total=sum(end-start for start,end in intervals)
 for actual,expected in [(last-first,f['gpu']),(total,f['gpuPassSumMs']),(total-union,f['gpuOverlapMs'])]:assert abs(actual-expected)<.00002

def stats(rows):
 result={'count':len(rows)}
 for k in ['cpu','completionMs','gpu','gpuPassSumMs','gpuOverlapMs']:
  v=sorted(f[k] for f in rows if f.get(k) is not None)
  if v:result[k]={'n':len(v),'min':min(v),'median':median(v),'p90':v[math.ceil(len(v)*.9)-1],'max':max(v)}
 return result
latest=[r['report']['latestFrame'] for r in reports];history=sorted(frames.values(),key=lambda f:f['frame']);sampled=[f for f in history if f['gpu'] is not None]
tails=[f['gpu']-next(p['endMs'] for p in f['gpuPasses'] if p['label']=='Lighting + shadows') for f in latest]
analysis={'sources':sources,'device':reports[0]['report']['device'],'build':reports[0]['report']['build'],'viewport':latest[0]['context']['viewport'],'rows':[{'id':r['id'],'receivedAt':r['receivedAt'],'frame':r['report']['latestFrame']} for r in reports],'latestStats':stats(latest),'historyStats':stats(history),'sampledHistoryStats':stats(sampled),'unsampledHistoryStats':stats([f for f in history if f['gpu'] is None]),'history':history,'timingMathAudit':'Recomputed span/sum/union from all 15 sampled frame pass intervals; matched within 0.00002 ms.','deduplication':'Explicit five-report cohort only; identical (frame, startedAtMs) records merged after deep equality. No cross-session aggregation.','latestPostLightingTailMs':{'min':min(tails),'median':median(tails),'max':max(tails)},'limits':['Views differ; not a controlled before/after benchmark.','GPU span includes pipeline waits and timestamp instrumentation.','Pass intervals overlap and are not exclusive shader costs.','Completion includes CPU encode, queue work and callback scheduling; not FPS.','No CPU stack trace; cannot identify long-frame root cause.']}
(out/'20261020-1103-analysis.json').write_text(json.dumps(analysis,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in analysis.items() if k in ['latestStats','historyStats','sampledHistoryStats','latestPostLightingTailMs']},ensure_ascii=False))
