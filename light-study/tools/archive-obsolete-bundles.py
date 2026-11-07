"""Archive only obsolete hashed JS/CSS in mining-light, retaining two releases.
Original model/texture files and every other game are outside this operation.
"""
import hashlib,json,re,tarfile,time
from pathlib import Path

project=Path(__file__).resolve().parents[1]
public=project.parent.parent/'d-game1/dist/games/mining-light'
current=project/'dist'
keep={str(p.relative_to(current)) for p in current.rglob('*') if p.is_file()}
previous=json.loads((project/'artifacts/static-continuous/before/public-release.json').read_text())
for entry in previous['verified']:
 if entry['file'].startswith('games/mining-light/'):
  keep.add(entry['file'].removeprefix('games/mining-light/'))
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[p for p in (public/'assets').iterdir() if p.is_file() and not p.is_symlink() and re.fullmatch(r'(index|main|street|style)-[A-Za-z0-9_-]+\.(js|css)',p.name) and str(p.relative_to(public)) not in keep]
records=[{'file':str(p.relative_to(public)),'bytes':p.stat().st_size,'sha256':digest(p)} for p in files]
out=project/'artifacts/static-continuous';out.mkdir(parents=True,exist_ok=True)
archive=out/f'obsolete-bundles-{time.time_ns()}.tar.gz'
with tarfile.open(archive,'w:gz',compresslevel=9) as tar:
 for p in files:tar.add(p,arcname=str(p.relative_to(public)),recursive=False)
with tarfile.open(archive,'r:gz') as tar:
 for item in records:
  if hashlib.sha256(tar.extractfile(item['file']).read()).hexdigest()!=item['sha256']:raise RuntimeError('Archive verification failed')
for item in records:
 p=public/item['file']
 if digest(p)!=item['sha256']:raise RuntimeError('Published file changed while archiving')
for item in records:(public/item['file']).unlink()
summary={'archive':str(archive),'archiveBytes':archive.stat().st_size,'removedBytes':sum(r['bytes'] for r in records),'removedFiles':records,'keptReleaseFiles':sorted(keep),'publicBytesAfter':sum(p.stat().st_size for p in public.rglob('*') if p.is_file())}
(out/'bundle-archive.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['removedFiles','keptReleaseFiles']}))
