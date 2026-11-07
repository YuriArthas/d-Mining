"""Verify current public shadow evidence, restoration pixels and scope protection."""
from pathlib import Path
import hashlib, json, statistics, datetime, urllib.request
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
directory = root / 'artifacts/soft-shadow-final'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
read = lambda p: json.loads(Path(p).read_text())
views, runtime = [read(directory / p) for p in ['report.json', 'runtime/report.json']]
manifest = read(root / 'artifacts/asset-manifest.json')
release = read(root / 'artifacts/public-release.json')
prior = read(root / 'artifacts/before-soft-shadow/asset-manifest.json')
for report in [views, runtime]:
    assert report.get('completedAt') and not report.get('failure')
    assert report['errors'] == [] and report['warnings'] == []
    for bundle in report['bundles']:
        assert sha(root / 'dist/assets' / Path(bundle['url']).name) == bundle['sha256']
        assert hashlib.sha256(urllib.request.urlopen(bundle['url']).read()).hexdigest() == bundle['sha256']
for record in manifest['sources'] + manifest['resources']:
    assert sha(root / record['file']) == record['sha256'], record['file']
for record in manifest['artifacts']:
    assert sha(root / 'dist' / record['file']) == record['sha256']
    assert any(v['file'] == 'games/mining-light/' + record['file'] and v['sha256'] == record['sha256'] for v in release['verified'])
assert manifest['resources'] == prior['resources'], 'Geometry and material resources changed'
protected = read(root / 'artifacts/before-night-refinement/workspace-protected.json')
for name, digest in protected.items():
    assert sha(root.parent / name) == digest, name
for record in release['protectedGameFiles']:
    assert sha(root.parent.parent / 'd-game1/dist' / record['file']) == record['sha256'], record['file']
pixels = lambda p: np.asarray(Image.open(p)).astype(np.int16)
pairs = {
    'baseline': (directory/'runtime/baseline.png', root/'artifacts/night-final/01-courtyard-baseline-clean.png'),
    'sameLightHard': (directory/'runtime/wall-hard.png', root/'artifacts/night-final/05-wall-both-clean.png'),
    'aoRestoration': (directory/'wall.png', directory/'wall-restored.png'),
    'nightRestoration': (directory/'runtime/wall-soft.png', directory/'runtime/wall-night-restored.png'),
    'splitRuns': (directory/'wall.png', directory/'runtime/wall-soft.png'),
}
comparisons = {}
for name, (a, b) in pairs.items():
    delta = np.abs(pixels(a)-pixels(b))
    comparisons[name] = {'maxChannelDelta': int(delta.max()), 'meanChannelDelta': float(delta.mean())}
    assert not delta.any(), (name, comparisons[name])
profiles = []
for profile in runtime['profile']:
    frames = profile['frames']
    profiles.append({'soft':profile['soft'], 'gpuMedianMs':statistics.median(f['gpu'] for f in frames),
                     'cpuMsRange':[min(f['cpu'] for f in frames),max(f['cpu'] for f in frames)],
                     'draws':frames[0]['render']['drawCalls'],'passes':frames[0]['render']['frameCalls'],
                     'memory':frames[0]['memory']})
result = {'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'publicUrl':views['url'], 'bundles':views['bundles'], 'errors':[],
          'sourceBuildPublicBrowserMatch':True, 'resourcesUnchanged':len(manifest['resources']),
          'protectedWorkspaceFiles':len(protected), 'protectedPublishedFiles':len(release['protectedGameFiles']),
          'pixelComparisons':comparisons, 'profile1440Wall':profiles, 'adapter':runtime['profile'][0]['adapter'],
          'reports':['soft-shadow-final/report.json','soft-shadow-final/runtime/report.json'],
          'checks':list(dict.fromkeys(views['checks']+runtime['checks'])),
          'checkerSha256':sha(root/'tools/check-lamp-shadow.cjs')}
(directory/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
