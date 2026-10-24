import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GAME_CONTENT} from '../../src/game/content/gameContent.ts';

const directory=new URL('../../src/game/assets/camp/',import.meta.url);
test('every shipped scene model is one the game places, transported in exact parts',()=>{
 const files=readdirSync(directory).filter(name=>name.endsWith('.manifest.json'));
 const placed=new Set(GAME_CONTENT.surface.authored.instances.map(p=>p.asset));
 assert.deepEqual(files.map(f=>f.replace('.manifest.json','')).sort(),[...placed].sort());
 for(const file of files){
  const manifest=JSON.parse(readFileSync(new URL(file,directory)));
  const parts=manifest.parts.map(name=>readFileSync(new URL(name,directory)));
  assert.ok(parts.every(part=>part.length<=4*1024*1024),`${file}: parts stay under 4 MB`);
  const joined=Buffer.concat(parts);
  assert.equal(joined.length,manifest.bytes);
  assert.equal(createHash('sha256').update(joined).digest('hex'),manifest.sha256);
 }
 const shipped=readdirSync(directory).filter(name=>!name.endsWith('.manifest.json'));
 const referenced=new Set(files.flatMap(file=>JSON.parse(readFileSync(new URL(file,directory))).parts));
 assert.deepEqual(shipped.filter(name=>!referenced.has(name)),['pinewind-standing-light.png'],'no orphan parts');
});
