import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MinerAvatar } from '../../src/game/presentation/MinerAvatar.ts';
import { crossed, footContacts } from '../../src/game/presentation/minerSteps.ts';
import { footSurface, hubSurface, kindSurface } from '../../src/game/runtime/footSurface.ts';

const loader = new GLTFLoader().register(() => ({ name: 'cpu-test-textures', loadTexture: () => Promise.resolve(new Texture()) }));
const parse = name => { const b = readFileSync(new URL(`../../src/game/assets/${name}.glb`, import.meta.url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
async function avatar() {
  const a = Reflect.construct(MinerAvatar, await Promise.all(['character/miner-a', 'shop/equipment'].map(parse)));
  new Group().add(a.group); a.update([0, 0, 0], 0, true, false);
  return a;
}

test('从走路和跑步动画里找出两只脚落地的时刻：每个循环两步，相隔半个循环', async () => {
  const gltf = await parse('character/miner-a');
  for (const name of ['Walk', 'Run']) {
    const contacts = footContacts(gltf.scene, gltf.animations.find(c => c.name === name));
    assert.equal(contacts.length, 2);
    const gap = contacts[1] - contacts[0];
    assert.ok(gap > 0.4 && gap < 0.6, `${name} feet alternate: ${contacts.map(c => c.toFixed(2))}`);
  }
  assert.ok(crossed(0.9, 0.1, 0.05) && crossed(0.9, 0.1, 0.95) && !crossed(0.2, 0.4, 0.5) && crossed(0.2, 0.4, 0.4));
});

/** Moves the avatar in a straight line at `speed` m/s and counts footsteps. */
async function walk(speed, seconds, { grounded = true } = {}) {
  const a = await avatar(), dt = 1 / 60, feet = [0, 0, 0];
  let steps = 0, strength = 0;
  try {
    for (let t = 0; t < seconds; t += dt) {
      feet[2] -= speed * dt;
      a.update(feet, dt, grounded, false);
      const e = a.consumeEvents();
      if (e.step !== null) { steps++; strength = Math.max(strength, e.step); }
    }
  } finally { a.dispose(); }
  return { steps, strength };
}

test('角色走路和跑步时按动画落脚出脚步声：跑得越快步子越密越重，站着或在空中不出声', async () => {
  const idle = await walk(0, 3), slow = await walk(1.6, 6), run = await walk(6, 6), air = await walk(3, 3, { grounded: false });
  assert.equal(idle.steps, 0, 'standing still');
  assert.equal(air.steps, 0, 'in the air');
  assert.ok(slow.steps >= 6 && slow.steps <= 14, `walking: ${slow.steps} steps in 6 s`);
  assert.ok(run.steps >= 25 && run.steps <= 45, `running: ${run.steps} steps in 6 s`);
  assert.ok(run.strength > slow.strength, 'running steps land harder');
});

test('脚下材质：地表按广场布局分草地、沙地、小路、石板、木桥和台阶；地下按方块；休整站地板按主题', () => {
  assert.equal(hubSurface(30, -30, false), 'grass');
  assert.equal(hubSurface(3, 20, false), 'sand', 'the central plaza');
  assert.equal(hubSurface(0, 66, false), 'dirt', 'the path from the spawn');
  assert.equal(hubSurface(0, 16, false), 'stone', 'paving pad');
  assert.equal(hubSurface(0, 36.5, true), 'wood', 'the creek bridge');
  assert.equal(hubSurface(34, 30, true), 'stone', 'egg terrace');
  // World 1's rock, its coal and copper, and a gem (emerald).
  assert.deepEqual([64, 66, 67, 74].map(kindSurface), ['stone', 'stone', 'metal', 'crystal']);
  const cells = { '-1': 7 }, ports = theme => ({ cell: c => cells[c[1]] ?? 0, theme: () => theme, hub: f => f[1] > -0.6 });
  assert.equal(footSurface([3, 0.02, 20], ports('meadow_mine')), 'sand', 'hub floor uses the ground plan');
  cells['-401'] = 7;
  assert.equal(footSurface([3, -800 + 0.02, 20], ports('ancient_machine')), 'metal', 'machine station floor');
  cells['-402'] = 74;
  assert.equal(footSurface([3, -802 + 0.02, 20], ports('frozen_cave')), 'crystal', 'standing on a gem');
  assert.equal(footSurface([3, -804.5, 20], ports('timber_mine')), 'wood', 'on a station deck above the voxels');
});
