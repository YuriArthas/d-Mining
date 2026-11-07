"""Tie the public street screenshots to source, artifacts, cached rendering and scope."""
from pathlib import Path
import hashlib, json, statistics, datetime, urllib.request
from PIL import Image
import numpy as np
root=Path(__file__).resolve().parents[1];directory=root/'artifacts/street-final'
read=lambda p:json.loads(Path(p).read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
reports=[read(directory/p) for p in ['report.json','runtime/report.json','performance/report.json','courtyard/report.json']]
manifest=read(root/'artifacts/asset-manifest.json');release=read(root/'artifacts/public-release.json')
for report in reports:
    assert report.get('completedAt') and not report.get('failure'), report.get('failure')
    assert not report['errors'] and not report['warnings'], report
    for view in report['views']:
        if view.get('scene')=='street':
            assert view['model']['revision']==sha(root/'public/assets/street.glb')
            assert view['model']['layoutRevision']==sha(root/'public/assets/street-layout.json')
    for bundle in report['bundles']:
        assert sha(root/'dist/assets'/Path(bundle['url']).name)==bundle['sha256']
        assert hashlib.sha256(urllib.request.urlopen(bundle['url'],timeout=30).read()).hexdigest()==bundle['sha256']
for record in manifest['sources']+manifest['resources']:assert sha(root/record['file'])==record['sha256'],record['file']
for record in manifest['artifacts']:
    assert sha(root/'dist'/record['file'])==record['sha256']
    assert any(v['file']=='games/mining-light/'+record['file'] and v['sha256']==record['sha256'] for v in release['verified'])
prior=read(root/'artifacts/before-street/asset-manifest.json')
for record in prior['resources']:assert sha(root/record['file'])==record['sha256'],record['file']
protected=read(root/'artifacts/before-night-refinement/workspace-protected.json')
for name,digest in protected.items():assert sha(root.parent/name)==digest,name
for record in release['protectedGameFiles']:assert sha(root.parent.parent/'d-game1/dist'/record['file'])==record['sha256'],record['file']
pairs={
 'aoRestoration':(directory/'runtime/night-before.png',directory/'runtime/ao-restored.png'),
 'nightRestoration':(directory/'runtime/night-before.png',directory/'runtime/night-restored.png'),
 'orbitRestoration':(directory/'runtime/night-before.png',directory/'runtime/orbit-restored.png'),
 'loopPreservesStreet':(directory/'entrance.png',root/'artifacts/street-unrolled-stable-env/night-before.png'),
 'loopPreservesWalk':(directory/'walk.png',root/'artifacts/street-before-env-cache/walk.png'),
 'loopPreservesLamp':(directory/'lamp.png',root/'artifacts/street-before-env-cache/lamp.png'),
 'courtyardPreserved':(directory/'courtyard/courtyard-wall.png',root/'artifacts/soft-shadow-final/wall.png'),
}
comparisons={}
for name,(a,b) in pairs.items():
    delta=np.abs(np.asarray(Image.open(a)).astype(np.int16)-np.asarray(Image.open(b)).astype(np.int16))
    comparisons[name]={'maxChannelDelta':int(delta.max()),'meanChannelDelta':float(delta.mean()),'changedChannels':int(np.count_nonzero(delta))}
    if name in ['loopPreservesWalk','loopPreservesLamp']:
        assert delta.max()<=1 and np.count_nonzero(delta)<=1,(name,comparisons[name])
    else:assert not delta.any(),(name,comparisons[name])
profile=reports[2]['profile'][0];frames=profile['frames']
old=read(root/'artifacts/street-unrolled-stable-env/report.json')['views'][0]
new=reports[0]['views'][0]
compilation={'unrolledShaderBytes':sum(s['bytes'] for s in old['compiledShaders']),'loopShaderBytes':sum(s['bytes'] for s in new['compiledShaders']),'unrolledBootMsSingleRun':old['bootMs'],'loopBootMsSingleRun':new['bootMs']}
for f in frames:assert f['render']['frameCalls']==8 and f['render']['drawCalls']==48
result={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'publicUrl':reports[0]['url'],'bundles':reports[0]['bundles'],
 'sourceBuildPublicBrowserMatch':True,'existingResourcesUnchanged':len(prior['resources']),'protectedWorkspaceFiles':len(protected),'protectedPublishedFiles':len(release['protectedGameFiles']),
 'pixelComparisons':comparisons,'model':reports[0]['views'][0]['model'],'profile':{'soft':profile['soft'],'gpuMedianMs':statistics.median(f['gpu'] for f in frames),'cpuMsRange':[min(f['cpu'] for f in frames),max(f['cpu'] for f in frames)],'draws':48,'passes':8,'memory':frames[0]['memory']},
 'compilation':compilation,
 'adapter':reports[2]['views'][0]['adapter'],'checks':[c for r in reports for c in r['checks']],'checkerSha256':sha(root/'tools/check-street.cjs')}
(directory/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
