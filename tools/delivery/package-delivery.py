from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib, json, gzip, re, base64, subprocess, io
import sys
from datetime import datetime
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / '.tools/fonttools'))
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'exports/mining-master-delivery-r10-20261104'
AUDIT = ROOT / 'artifacts/mining-master-r10-20261104'
AUDIT.mkdir(parents=True, exist_ok=True)
release_time = datetime.fromisoformat(json.loads((SOURCE / 'DELIVERY.json').read_text())['buildTime'].replace('Z', '+00:00')).timetuple()[:6]
hash_bytes = lambda b: hashlib.sha256(b).hexdigest()
def files(root):
    return sorted(p for p in root.rglob('*') if p.is_file() and 'node_modules' not in p.relative_to(root).parts)
source_files = [p for p in files(SOURCE) if p.name != 'CONTENTS.sha256']
(SOURCE / 'CONTENTS.sha256').write_text(''.join(hash_bytes(p.read_bytes()) + '  ' + p.relative_to(SOURCE).as_posix() + '\n' for p in source_files))

archives = []
for name, items, relative in [
    ('mining-master-complete-r10-20261104.zip', files(SOURCE), SOURCE),
    ('mining-master-dist-r10-20261104.zip', files(SOURCE / 'dist'), SOURCE),
]:
    target = ROOT / 'exports' / name
    with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=6) as z:
        for p in items:
            rel = p.relative_to(relative).as_posix()
            assert not p.is_symlink(), f'Symlink in archive: {rel}'
            assert not any(part in ['node_modules', '.git', '.cache', '__pycache__'] for part in Path(rel).parts)
            info = ZipInfo(rel, date_time=release_time)
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, p.read_bytes(), compresslevel=6)
    with ZipFile(target) as z:
        assert z.testzip() is None
        members = {n: z.read(n) for n in z.namelist()}
    if 'complete' in name:
        for required in ['package.json', 'package-lock.json', 'README.md', 'docs/SOURCE_GUIDE.md', 'docs/PARAMETERS.md',
                         'docs/parameter-catalog.json', 'ASSET_PROVENANCE.md', 'src/App.tsx', 'src/game/content/economy.json', 'dist/index.html']:
            assert required in members, required
    else: assert all(n.startswith('dist/') for n in members)
    report = {'archive': name, 'bytes': target.stat().st_size, 'sha256': hash_bytes(target.read_bytes()),
              'files': len(members), 'uncompressedBytes': sum(map(len, members.values())), 'crcOk': True,
              'keywordHits': [], 'externalGlbUris': [], 'decodedScenes': 0, 'decodedJsBlobs': 0, 'decodedBlends': 0, 'decodedFonts': 0}
    keywords = re.compile(rb'sunjun|yuriarthas|clock-p', re.I)
    def scan(data, label):
        if keywords.search(data): report['keywordHits'].append(label)
    def glb(data, label):
        assert data[:4] == b'glTF' and int.from_bytes(data[8:12], 'little') == len(data)
        doc = json.loads(data[20:20+int.from_bytes(data[12:16], 'little')])
        for entry in doc.get('images', []) + doc.get('buffers', []):
            uri = entry.get('uri')
            if uri and not uri.startswith('data:'): report['externalGlbUris'].append({'file': label, 'uri': uri})
        scan(data, label)
    for name, data in members.items():
        scan(data, name)
        if name.endswith('.part'):
            glb(gzip.decompress(data), name + ' decoded'); report['decodedScenes'] += 1
        elif name.endswith('.glb'): glb(data, name)
        elif name.endswith('.blend'):
            if data.startswith(bytes.fromhex('28b52ffd')):
                data = subprocess.run(['zstd', '-q', '-d', '-c'], input=data, capture_output=True, check=True).stdout
            assert data.startswith(b'BLENDER')
            scan(data, name + ' decoded'); report['decodedBlends'] += 1
            assert b'/root/' not in data and b'/Users/' not in data
        elif name.endswith('.woff2'):
            font = TTFont(io.BytesIO(data))
            for record in font['name'].names:
                scan(record.toUnicode().encode(), name + ' font name table')
            report['decodedFonts'] += 1
        elif name.endswith('.js'):
            for i, match in enumerate(re.finditer(rb'[A-Za-z0-9+/]{128,}={0,2}', data)):
                try: blob = base64.b64decode(match[0], validate=True)
                except Exception: continue
                scan(blob, name + f' base64 {i}'); report['decodedJsBlobs'] += 1
    assert not report['keywordHits'], report['keywordHits']
    assert not report['externalGlbUris'], report['externalGlbUris']
    archives.append(report)
(AUDIT / 'archive-review.json').write_text(json.dumps(archives, ensure_ascii=False, indent=2) + '\n')
(ROOT / 'exports/mining-master-r10-20261104.sha256').write_text(''.join(a['sha256'] + '  ' + a['archive'] + '\n' for a in archives))
print(json.dumps(archives, ensure_ascii=False, indent=2))
