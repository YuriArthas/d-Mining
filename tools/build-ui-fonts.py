"""Subset the HUD display fonts to the characters the game actually renders.

Sources are pinned by URL and SHA-256 and cached under .tools/font-sources/
(git-ignored). Outputs land in src/game/assets/fonts/ together with a manifest
(source, license, instanced weight, charset, output hash) and the generated
@font-face sheet src/game/ui/kit/fonts.css. Every subset is renamed to
"Mining Display ..." so no Reserved Font Name is reused by a modified font.

Run after changing any player-visible text:  python3 tools/build-ui-fonts.py
Requires fonttools + brotli in .tools/fonttools (pip install --target).
"""
import hashlib
import io
import json
import pathlib
import re
import sys
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / '.tools/fonttools'))
from fontTools import subset  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.varLib import instancer  # noqa: E402

GOOGLE = 'https://raw.githubusercontent.com/google/fonts/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl'
CACHE = ROOT / '.tools/font-sources'
OUT = ROOT / 'src/game/assets/fonts'
CSS = ROOT / 'src/game/ui/kit/fonts.css'

# Latin digits and letters: Fredoka is the open-source successor of Roblox's FredokaOne.
DIGITS = dict(id='digits', name='Fredoka', file='mining-digits.woff2', axes={'wght': 600, 'wdth': 100},
              url=f'{GOOGLE}/fredoka/Fredoka%5Bwdth,wght%5D.ttf', sha256='2ba02e68b152868aef9ba28e24b3648c7d457fe6f25c761f2c2c53fb61a73fc8',
              license_url=f'{GOOGLE}/fredoka/OFL.txt', license_sha256='5c9e7eee5c6b25f4b05b8d53b2e470ea4962f9ced742d044a98f7d95d1375bab')
# Chinese display face, chosen by the user on 2026-10-22 (Noto Sans SC Black).
CJK = [
    dict(id='noto', name='Noto Sans SC Black', file='mining-cjk-noto.woff2', axes={'wght': 900},
         url=f'{GOOGLE}/notosanssc/NotoSansSC%5Bwght%5D.ttf', sha256='a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da',
         license_url=f'{GOOGLE}/notosanssc/OFL.txt', license_sha256='1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9'),
]
# Typographic punctuation that Fredoka draws in the same voice as its digits.
LATIN_EXTRA = {0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026}


def fetch(url, sha256):
    path = CACHE / sha256
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read()
        path.write_bytes(data)
    data = path.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    if actual != sha256:
        raise SystemExit(f'Checksum mismatch for {url}: {actual}')
    return data


def load(spec):
    data = fetch(spec['url'], spec['sha256'])
    if 'member' in spec:
        data = zipfile.ZipFile(io.BytesIO(data)).read(spec['member'])
    font = TTFont(io.BytesIO(data))
    if spec['axes']:
        font = instancer.instantiateVariableFont(font, spec['axes'])
    return font


def game_text():
    chars = {chr(c) for c in range(0x20, 0x7F)}
    for path in sorted((ROOT / 'src').rglob('*')):
        if path.suffix not in {'.ts', '.tsx', '.json', '.css'} or path.name in {'sign-font.json', 'authored.json'}:
            continue
        if path.parent == OUT or path == CSS:
            continue
        chars.update(c for c in path.read_text(encoding='utf-8') if ord(c) > 0x7E and not c.isspace())
    return chars


def ranges(codepoints):
    points = sorted(codepoints)
    out, start = [], None
    for i, cp in enumerate(points):
        if start is None:
            start = cp
        if i + 1 == len(points) or points[i + 1] != cp + 1:
            out.append(f'U+{start:X}' if start == cp else f'U+{start:X}-{cp:X}')
            start = None
    return ','.join(out)


def rename(font, family):
    table = font['name']
    postscript = re.sub(r'[^A-Za-z0-9-]', '', family.replace(' ', '-'))
    for record in list(table.names):
        if record.nameID in {1, 2, 3, 4, 6, 16, 17, 21, 22}:
            table.removeNames(nameID=record.nameID)
    for name_id, value in {1: family, 2: 'Regular', 3: f'{postscript};mining-subset', 4: family, 6: postscript}.items():
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)


def write_subset(spec, font, codepoints, family):
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['kern', 'liga', 'calt', 'locl', 'palt']
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.hinting = False
    options.desubroutinize = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(codepoints))
    subsetter.subset(font)
    rename(font, family)
    target = OUT / spec['file']
    font.flavor = 'woff2'
    font.recalcTimestamp = False  # keep source timestamps so rebuilds are byte-identical
    font.save(target)
    data = target.read_bytes()
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'licenses').mkdir(exist_ok=True)
    text = game_text()
    manifest = dict(generator='tools/build-ui-fonts.py', charset=''.join(sorted(text)), faces=[])

    digits_font = load(DIGITS)
    digits_cmap = digits_font.getBestCmap()
    latin = {ord(c) for c in text if (ord(c) < 0x100 or ord(c) in LATIN_EXTRA) and ord(c) in digits_cmap}
    rest = {ord(c) for c in text} - latin
    digits_out = write_subset(DIGITS, digits_font, latin, 'Mining Display Digits')
    (OUT / 'licenses' / 'fredoka-OFL.txt').write_bytes(fetch(DIGITS['license_url'], DIGITS['license_sha256']))
    manifest['faces'].append(dict(id='digits', source=DIGITS['name'], url=DIGITS['url'], sourceSha256=DIGITS['sha256'],
                                  axes=DIGITS['axes'], license='SIL OFL 1.1', glyphs=len(latin), unicodeRange=ranges(latin), **digits_out))

    css = ['/* Generated by tools/build-ui-fonts.py from the text in src/. Do not edit by hand. */']
    for spec in CJK:
        font = load(spec)
        cmap = font.getBestCmap()
        covered = {cp for cp in rest if cp in cmap}
        missing = ''.join(chr(cp) for cp in sorted(rest - covered))
        family = f"Mining Display {spec['id'].capitalize()}"
        out = write_subset(spec, font, covered, family)
        (OUT / 'licenses' / f"{spec['id']}-OFL.txt").write_bytes(fetch(spec['license_url'], spec['license_sha256']))
        manifest['faces'].append(dict(id=spec['id'], source=spec['name'], url=spec['url'], sourceSha256=spec['sha256'], axes=spec['axes'],
                                      license='SIL OFL 1.1', glyphs=len(covered), missing=missing, unicodeRange=ranges(covered), **out))
        for file, codepoints in ((spec['file'], covered), (DIGITS['file'], latin)):
            css.append(f'@font-face {{ font-family: "{family}"; src: url("../../assets/fonts/{file}") format("woff2"); '
                       f'font-weight: 100 900; font-display: swap; unicode-range: {ranges(codepoints)}; }}')
        print(f"{spec['id']:7} glyphs={len(covered):5} bytes={out['bytes']:7} missing={missing}")
    print(f"digits  glyphs={len(latin):5} bytes={digits_out['bytes']:7}")
    CSS.parent.mkdir(parents=True, exist_ok=True)
    CSS.write_text('\n'.join(css) + '\n', encoding='utf-8')
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
