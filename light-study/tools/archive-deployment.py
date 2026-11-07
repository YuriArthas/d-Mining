"""Keep a verified rollback archive before replacing the public street package."""
import hashlib
import json
import sys
import tarfile
import time
from pathlib import Path

source, output = map(Path, sys.argv[1:3])
output.mkdir(parents=True, exist_ok=True)
archive = output / f'previous-deployment-{time.time_ns()}.tar.gz'
files = sorted(path for path in source.rglob('*') if path.is_file())
records = []
for path in files:
    if path.is_symlink():
        raise ValueError(f'Unexpected symlink: {path}')
    records.append({'file': str(path.relative_to(source)), 'bytes': path.stat().st_size,
                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
with tarfile.open(archive, 'w:gz', compresslevel=9) as tar:
    for record in records:
        tar.add(source / record['file'], arcname=record['file'], recursive=False)
with tarfile.open(archive, 'r:gz') as tar:
    if sorted(tar.getnames()) != sorted(record['file'] for record in records):
        raise ValueError('Archive file list mismatch')
    for record in records:
        content = tar.extractfile(record['file']).read()
        if len(content) != record['bytes'] or hashlib.sha256(content).hexdigest() != record['sha256']:
            raise ValueError(f'Archive verification failed: {record["file"]}')
report = {'archive': str(archive), 'archiveBytes': archive.stat().st_size, 'verified': True,
          'source': str(source), 'originalBytes': sum(record['bytes'] for record in records), 'files': records}
archive.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'archive': str(archive), 'archiveBytes': report['archiveBytes'], 'originalBytes': report['originalBytes']}))
