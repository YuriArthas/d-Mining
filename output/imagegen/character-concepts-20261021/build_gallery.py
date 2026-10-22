import hashlib
import html
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
base = 'https://w-sunjun-public.dev.clock-p.com/art/mining-characters-20261021/'
items = json.loads((root / 'candidates.json').read_text())
records = []
for item in items:
    path = root / item['file']
    with Image.open(path) as im:
        im.verify()
    with Image.open(path) as im:
        width, height = im.size
        preview = im.convert('RGB')
        preview.thumbnail((640, 960))
        preview.save(root / (path.stem + '.webp'), 'WEBP', quality=88)
    records.append({**item, 'width': width, 'height': height, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

css = '''
*{box-sizing:border-box}html{background:transparent}body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:var(--foreground,#24312d);background:transparent}a{color:inherit}button{font:inherit;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.candidate{overflow:hidden;border:1px solid var(--border,#dddcd4);border-radius:16px;background:var(--card,#fff)}.image-link{display:block;border:0;padding:0;width:100%;background:#ebe9e4;cursor:zoom-in}.image-link img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:contain}.copy{padding:18px}.label{display:flex;align-items:center;gap:10px;margin:0 0 8px;font-size:19px}.letter{display:inline-grid;place-items:center;background:var(--secondary,#edf0ea);border-radius:7px;width:30px;height:30px;font-size:16px}.copy p{margin:0;font-size:14px;line-height:1.65;color:var(--muted-foreground,#64716a)}.launch{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px 0;font-size:14px;color:var(--muted-foreground,#64716a)}.launch a{font-weight:600;text-underline-offset:4px}a:focus-visible,button:focus-visible{outline:3px solid #5a8c76;outline-offset:4px}@media(min-width:1100px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:520px){.grid{gap:10px}.copy{padding:12px}.label{font-size:16px;gap:6px}.letter{width:25px;height:25px;font-size:14px}.copy p{font-size:12px}.launch{align-items:start;flex-direction:column;gap:6px}}
'''

def cards(inline=False):
    result = []
    for item in items:
        title = html.escape(item['title'])
        description = html.escape(item['description'])
        thumb = Path(item['file']).stem + '.webp'
        if inline:
            opener = f'<a class="image-link" href="{base}#{item["id"]}" target="_blank" rel="noopener">'
            closer = '</a>'
        else:
            opener = f'<button class="image-link" type="button" data-candidate="{item["id"]}" aria-label="放大 {item["id"]} {title}">'
            closer = '</button>'
        result.append(f'<article class="candidate">{opener}<img src="{base if inline else ""}{thumb}" alt="{item["id"]} · {title}，完整人物概念图" width="640" height="960">{closer}<div class="copy"><h2 class="label"><span class="letter">{item["id"]}</span>{title}</h2><p>{description}</p></div></article>')
    return '<div class="grid">' + ''.join(result) + '</div>'

inline = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body>{cards(True)}<div class="launch"><span>Image 2.5 · 人物概念图，点击查看大图</span><a href="{base}" target="_blank" rel="noopener">独立打开画廊 ↗</a></div><script>Promise.all([...document.images].map(i=>i.decode().then(()=>({{ok:true,width:i.naturalWidth,height:i.naturalHeight}})).catch(()=>({{ok:false}})))).then(images=>console.log(JSON.stringify({{images,horizontalOverflow:document.documentElement.scrollWidth>innerWidth}})))</script></body></html>'''
(root / 'inline.html').write_text(inline, encoding='utf-8')

standalone_css = '''
html{background:#f5f4ef}body{color:#24312d}.page{max-width:1520px;margin:auto;padding:48px 32px 32px}.eyebrow{font-size:12px;letter-spacing:.15em;color:#6d7a70;font-weight:700}h1{font-size:34px;letter-spacing:-.03em;margin:8px 0 12px}header p{font-size:15px;color:#64716a;line-height:1.7;margin:0 0 30px}.note{margin:24px 0 0;font-size:13px;color:#6c786f}dialog{border:0;padding:0;border-radius:18px;width:min(1000px,94vw);max-height:94vh;background:#f5f4ef;color:#24312d;overflow:auto}dialog::backdrop{background:rgba(14,24,19,.82)}.modal-bar{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 20px;background:rgba(245,244,239,.97);z-index:1}.modal-bar h2{font-size:18px;margin:0}.actions{display:flex;gap:10px;align-items:center}.actions button,.actions a{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:8px 12px;border:1px solid #d5d9d0;background:white;border-radius:8px;text-decoration:none;font-size:14px}.full-image{display:block;max-width:100%;max-height:calc(94vh - 84px);width:auto;height:auto;margin:0 auto;object-fit:contain}@media(max-width:700px){.page{padding:28px 16px}h1{font-size:28px}.modal-bar{padding:10px}.modal-bar h2{font-size:14px}.actions{gap:4px}.actions button,.actions a{padding:8px}}
'''
script = '''
const items=__ITEMS__;const dialog=document.querySelector('dialog');const full=document.querySelector('.full-image');const title=document.querySelector('#modal-title');const download=document.querySelector('#download');let current=0;
function show(id){const idx=items.findIndex(i=>i.id===id);if(idx<0)return;current=idx;const item=items[idx];full.src=item.file;full.alt=item.id+' · '+item.title;title.textContent=full.alt;download.href=item.file;download.download=item.file;if(!dialog.open)dialog.showModal();history.replaceState(null,'','#'+id)}
function close(){dialog.close();history.replaceState(null,'',location.pathname)}
document.querySelectorAll('[data-candidate]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.candidate)));
document.querySelector('#close').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
document.querySelector('#previous').addEventListener('click',()=>show(items[(current+items.length-1)%items.length].id));document.querySelector('#next').addEventListener('click',()=>show(items[(current+1)%items.length].id));document.addEventListener('keydown',e=>{if(!dialog.open)return;if(e.key==='ArrowLeft')show(items[(current+items.length-1)%items.length].id);if(e.key==='ArrowRight')show(items[(current+1)%items.length].id)});if(location.hash)show(location.hash.slice(1));
'''.replace('__ITEMS__', json.dumps(items, ensure_ascii=False))
standalone = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mining · 人物候选</title><style>{css}{standalone_css}</style></head><body><main class="page"><header><div class="eyebrow">MINING · CHARACTER CONCEPTS</div><h1>四种人物方向</h1><p>比较人物的轮廓、比例与服装。点击图片放大，再用左右箭头切换。</p></header>{cards()}<p class="note">Image 2.5 生成的外观概念图，尚未制作三维模型。镐子与背包将作为独立装备制作。</p></main><dialog aria-labelledby="modal-title"><div class="modal-bar"><h2 id="modal-title"></h2><div class="actions"><button id="previous" aria-label="上一张">←</button><button id="next" aria-label="下一张">→</button><a id="download" download>原图</a><button id="close" aria-label="关闭大图">✕</button></div></div><img class="full-image" alt=""></dialog><script>{script}</script></body></html>'''
(root / 'index.html').write_text(standalone, encoding='utf-8')
manifest = {'model': 'gpt-image-2.5-sunburst', 'execution': 'imagegen skill CLI / generate-batch', 'size_requested': '1024x1536', 'quality_requested': 'high', 'prompt_set': 'prompts.jsonl', 'gallery': base, 'validation': 'Image files decoded and dimensions checked; gallery checked in browser; images intentionally not loaded into conversation context.', 'candidates': records}
(root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'images': [{k:v for k,v in r.items() if k in ['id','file','width','height','bytes']} for r in records], 'gallery': base}, ensure_ascii=False))
