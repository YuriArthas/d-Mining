"""Resize Tripo textures before GPU encoding; geometry stays byte-identical."""
import io,json,struct,sys
from pathlib import Path
from PIL import Image
p=Path(sys.argv[1]); b=p.read_bytes(); n=struct.unpack_from('<I',b,12)[0]; d=json.loads(b[20:20+n]); binary=b[28+n:]
scale=float(sys.argv[3]) if len(sys.argv)>3 else 1
roles={}
for m in d.get('materials',[]):
 for obj,key,size in [(m.get('pbrMetallicRoughness',{}),'baseColorTexture',512),(m,'normalTexture',256),(m.get('pbrMetallicRoughness',{}),'metallicRoughnessTexture',128),(m,'occlusionTexture',128),(m,'emissiveTexture',256)]:
  if key in obj:
   size=int(size*scale)
   tex=d['textures'][obj[key]['index']]; ix=tex.get('source',tex.get('extensions',{}).get('EXT_texture_webp',{}).get('source')); roles[ix]=max(size,roles.get(ix,0))
replace={}
for i,img in enumerate(d.get('images',[])):
 v=d['bufferViews'][img['bufferView']]; off=v.get('byteOffset',0)
 im=Image.open(io.BytesIO(binary[off:off+v['byteLength']])).convert('RGB'); im=im.resize((roles.get(i,256),)*2,Image.Resampling.LANCZOS)
 out=io.BytesIO(); im.save(out,format='PNG');replace[img['bufferView']]=out.getvalue();img['mimeType']='image/png'
for t in d.get('textures',[]):
 if 'EXT_texture_webp' in t.get('extensions',{}):t['source']=t['extensions'].pop('EXT_texture_webp')['source']
for field in ['extensionsUsed','extensionsRequired']:
 if field in d:d[field]=[x for x in d[field] if x!='EXT_texture_webp']
out=bytearray()
for i,v in enumerate(d['bufferViews']):
 off=v.get('byteOffset',0);data=replace.get(i,binary[off:off+v['byteLength']]);out.extend(b'\0'*(-len(out)%4));v['byteOffset']=len(out);v['byteLength']=len(data);out.extend(data)
d['buffers'][0]['byteLength']=len(out);out.extend(b'\0'*(-len(out)%4));j=json.dumps(d,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
Path(sys.argv[2]).write_bytes(struct.pack('<5I',0x46546c67,2,28+len(j)+len(out),len(j),0x4e4f534a)+j+struct.pack('<2I',len(out),0x004e4942)+out)
