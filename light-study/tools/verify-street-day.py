"""Match public daytime evidence to this build; preserve the approved night."""
from pathlib import Path
import datetime, hashlib, json, sys, urllib.request
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
directory = root / (sys.argv[1] if len(sys.argv) > 1 else 'artifacts/day-r1')
baseline = root / 'artifacts/before-day-refinement'
read = lambda p: json.loads(Path(p).read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
report = read(directory / 'report.json')
assert report.get('completedAt') and not report.get('failure'), report.get('failure')
assert not report['errors'] and not report['warnings']
manifest = read(root / 'artifacts/asset-manifest.json')
release = read(root / 'artifacts/public-release.json')
prior = read(baseline / 'artifacts/asset-manifest.json')
for record in manifest['sources'] + manifest['resources']:
    assert sha(root / record['file']) == record['sha256'], record['file']
for record in prior['resources'] + prior['sources']:
    if record['file'] != 'src/streetLighting.ts':
        assert sha(root / record['file']) == record['sha256'], record['file']
for record in manifest['artifacts']:
    assert sha(root / 'dist' / record['file']) == record['sha256']
    assert any(v['file'] == 'games/mining-light/' + record['file'] and v['sha256'] == record['sha256'] for v in release['verified'])
for bundle in report['bundles']:
    assert sha(root / 'dist/assets' / Path(bundle['url']).name) == bundle['sha256']
    assert hashlib.sha256(urllib.request.urlopen(bundle['url'], timeout=30).read()).hexdigest() == bundle['sha256']
protected = read(baseline / 'scope.json')
for name, digest in protected.items():
    assert sha(root.parent / name) == digest, name
for record in release['protectedGameFiles']:
    assert sha(root.parent.parent / 'd-game1/dist' / record['file']) == record['sha256'], record['file']
for view in report['views']:
    assert view['model']['revision'] == sha(root / 'public/assets/street.glb')
    assert view['model']['layoutRevision'] == sha(root / 'public/assets/street-layout.json')

pixels = lambda p: np.asarray(Image.open(p).convert('RGB'))
comparisons = {}
for name, a, b in [
    ('approvedNightPreserved', baseline / 'artifacts/street-final/runtime/night-before.png', directory / 'night-preserved.png'),
    ('dayRestored', directory / 'day-entrance.png', directory / 'day-restored.png'),
]:
    delta = np.abs(pixels(a).astype(np.int16) - pixels(b).astype(np.int16))
    comparisons[name] = {'maxChannelDelta': int(delta.max()), 'changedChannels': int(np.count_nonzero(delta))}
    assert not delta.any(), (name, comparisons[name])

# Fixed image patches document the visual change, not a physical lighting meter.
patches = {'sunlitPaving': [780, 545, 820, 575], 'shadedPaving': [450, 545, 490, 575], 'blueFacade': [25, 285, 100, 360]}
patch_stats = {}
for name, (x1, y1, x2, y2) in patches.items():
    stats = {}
    for version, p in [('before', baseline / 'artifacts/street-final/runtime/day.png'), ('after', directory / 'day-entrance.png')]:
        rgb = pixels(p)[y1:y2, x1:x2] / 255
        linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
        stats[version] = {'meanSRGB255': (rgb.mean(axis=(0, 1))*255).tolist(), 'meanLinearLuminance': float((linear @ np.array([.2126, .7152, .0722])).mean())}
    patch_stats[name] = {'rectangle': patches[name], **stats}

result = {'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'publicUrl': report['url'], 'bundles': report['bundles'], 'sourceBuildPublicBrowserMatch': True,
          'runtimeSourceChanged': ['src/streetLighting.ts'], 'resourcesUnchanged': len(prior['resources']),
          'protectedWorkspaceFiles': len(protected), 'protectedPublishedFiles': len(release['protectedGameFiles']),
          'pixelComparisons': comparisons, 'fixedImagePatchStats': patch_stats,
          'adapter': report['views'][0]['adapter'], 'checks': report['checks'],
          'checkerSha256': sha(root / 'tools/check-street-day.cjs')}
(directory / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
