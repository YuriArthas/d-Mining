import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'assets-source/miner-d');
// Direction D (卡通小探险家), chosen by the user 2026-10-29 from the in-scene candidates; front A-pose reference.
const reference = resolve(root, 'output/imagegen/character-d-reference-20261029/ref-1.png');
await mkdir(output, { recursive: true });
let key = process.env.TRIPO_API_KEY;
if (!key) {
  const config = JSON.parse(await readFile('/root/.tripo/config.json', 'utf8'));
  key = config.profiles[config.active_profile]?.api_key;
}
if (!key) throw Error('Missing Tripo credential');
async function request(endpoint, init = {}) {
  const response = await fetch('https://api.tripo3d.com/v2/openapi' + endpoint, {
    ...init, headers: { authorization: `Bearer ${key}`, ...init.headers }, signal: AbortSignal.timeout(180000),
  });
  const result = await response.json();
  if (!response.ok || result.code !== 0) throw Error(`Tripo ${endpoint}: HTTP ${response.status}; ${result.message ?? result.error_msg ?? result.code}`);
  return result.data;
}
let record;
try { record = JSON.parse(await readFile(resolve(output, 'task.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!record) {
  const bytes = await readFile(reference);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'miner-d.png');
  const uploaded = await request('/upload/sts', { method: 'POST', body: form });
  const token = uploaded.image_token ?? uploaded.file_token;
  if (!token) throw Error('Missing uploaded image token');
  const recipe = {
    type: 'image_to_model', model_version: 'v3.0-20250812',
    file: { type: 'png', file_token: token },
    face_limit: 12000, texture: true, pbr: false, texture_quality: 'standard',
  };
  const task = await request('/task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(recipe) });
  if (!task.task_id) throw Error('Missing task ID');
  record = { taskId: task.task_id, createdAt: new Date().toISOString(), reference, referenceSha256: createHash('sha256').update(bytes).digest('hex'), recipe: { ...recipe, file: { type: 'png', source: reference } } };
  await writeFile(resolve(output, 'task.json'), JSON.stringify(record, null, 2));
}
console.log('Tripo miner D:', record.taskId);
let result;
const deadline = Date.now() + 20 * 60 * 1000;
while (Date.now() < deadline) {
  result = await request('/task/' + record.taskId);
  console.log(result.status, result.progress ?? '');
  await writeFile(resolve(output, 'status.json'), JSON.stringify({ taskId: record.taskId, status: result.status, progress: result.progress, checkedAt: new Date().toISOString() }, null, 2));
  if (result.status === 'success') break;
  if (['failed', 'banned', 'expired', 'cancelled', 'unknown'].includes(result.status)) throw Error(`Generation ${result.status}: ${result.error_msg ?? ''}`);
  await new Promise(r => setTimeout(r, 7000));
}
if (result.status !== 'success') throw Error('Generation timed out; rerun to resume the same task');
const url = result.output?.pbr_model ?? result.output?.model ?? result.output?.base_model;
if (!url) throw Error('Missing generated model');
const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
if (!response.ok) throw Error(`Model download: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.toString('ascii', 0, 4) !== 'glTF') throw Error('Expected GLB');
await writeFile(resolve(output, 'miner-d-original.glb'), bytes);
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
const triangles = gltf.meshes.flatMap(m => m.primitives).reduce((n, p) => n + gltf.accessors[p.indices ?? p.attributes.POSITION].count / 3, 0);
const manifest = { ...record, status: 'success', triangles, bytes: bytes.length, meshes: gltf.meshes.length, materials: gltf.materials?.length ?? 0, sha256: createHash('sha256').update(bytes).digest('hex') };
await writeFile(resolve(output, 'generation.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
