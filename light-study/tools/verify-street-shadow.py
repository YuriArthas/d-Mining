from pathlib import Path
import hashlib, json, statistics
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
artifacts = root/'artifacts'
out = artifacts/'static-shadow-final'
r = json.loads((out/'report.json').read_text())
assert r.get('completedAt') and not r['errors'] and not r['warnings']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
diffs = {}
def compare(name, first, second, exact=False):
    a = np.array(Image.open(first).convert('RGB')).astype(int)
    b = np.array(Image.open(second).convert('RGB')).astype(int)
    d = np.abs(a-b)
    diffs[name] = dict(mean=float(d.mean()),p99=float(np.percentile(d,99)),maximum=int(d.max()),changedChannels=int(np.count_nonzero(d)))
    if exact: assert not np.any(d), (name,diffs[name])

for v in ['entrance','walk','lamp']:
    compare('cached_vs_live_'+v,out/f'cached-night-{v}.png',out/f'live-night-{v}.png')
    compare('day_unchanged_'+v,out/f'cached-day-{v}.png',artifacts/f'day-r1/day-{v}.png',True)
for name in ['night-restored','night-ao-restored','night-controls-restored']:
    compare(name,out/'cached-night-entrance.png',out/f'cached-{name}.png',True)
compare('live_matches_approved',out/'live-night-entrance.png',artifacts/'day-r1/night-preserved.png',True)
scope = json.loads((artifacts/'before-night-performance/scope.json').read_text())
changes = [p for p,h in scope.items() if sha(root.parent/p)!=h]
assert not changes,changes
for b in r['bundles']:
    assert sha(root/'dist/assets'/b['url'].rsplit('/',1)[1])==b['sha256']
shader_checks = {}
for mode in ['cached','live']:
    shaders = [p.read_text() for p in (out/(mode+'-shaders')).glob('*.wgsl')]
    # Attribute names exist only in the vertex module. Identify fragment
    # families with their captured Three material labels, not vertex names.
    street_labels = ('fragment_iron','fragment_canvas_red','fragment_plaster_blue','fragment_limestone','fragment_street lantern')
    atlas = [(out/(mode+'-shaders')/m['file']).read_text() for m in r[mode+'Shaders'] if m['label'].startswith(street_labels)]
    if mode=='cached':
        assert len(atlas)>=7 and any('uv1' in s for s in shaders)
        assert all('texture_depth_cube' not in s and 'i < 24' not in s for s in atlas)
    shader_checks[mode] = dict(fragmentShaders=sum('@fragment' in s for s in shaders),atlasFragments=len(atlas),pcssFragments=sum('i < 24' in s for s in shaders))
medians = {p['mode']:statistics.median(f['gpuMs'] for f in p['frames']) for p in r['profiles']}
result = dict(imageComparisons=diffs,protectedWorkspaceFiles=len(scope),outsideChanges=changes,browserBundlesMatchBuild=True,shaders=shader_checks,gpuMedianMs=medians,reduction=1-medians['cached']/medians['live'],gpuEnvironment='Chromium Vulkan SwiftShader; not laptop GPU',geometry=json.loads((artifacts/'static-shadow-bake/geometry-check.json').read_text()))
(out/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
