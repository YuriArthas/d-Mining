import {formatNumber} from '../../src/game/presentation/formatNumber.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, Quaternion } from 'three';
import { createWorldText } from '../../src/game/presentation/WorldText.ts';
import { EggStandLabels, EGG_LABEL } from '../../src/game/presentation/EggStandLabels.ts';
import { disposeScenery } from '../../src/game/presentation/disposeScenery.ts';
import { PET_CONTENT } from '../../src/game/content/pets.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
const SESSION_CONTENT = GAME_CONTENT.session, PET_DISPLAYS = GAME_CONTENT.eggs;
import { GameSession } from '../../src/game/application/GameSession.ts';

test('egg labels keep extruded glyphs and front/side colours in one draw, plus one draw of plates', () => {
  const labels = new EggStandLabels(PET_DISPLAYS, PET_CONTENT.eggs);
  try {
    assert.equal(labels.group.children.length, 2);
    assert.equal(labels.diagnostics().draws, 2);
    assert.ok(labels.diagnostics().triangles > 20000);
    const [mesh, plates] = labels.group.children, geometry = mesh.geometry;
    assert.equal(mesh.material.map, null);
    assert.equal(mesh.material.vertexColors, true);
    assert.equal(geometry.groups.length, 0);
    assert.equal(plates.material.transparent, true); assert.equal(plates.material.depthWrite, false);
    let vertexOffset = 0, indexOffset = 0;
    for (const [slot, stand] of PET_DISPLAYS.entries()) {
      const offer = PET_CONTENT.eggs.find(offer => offer.id === stand.eggId), at = labels.diagnostics().labels[slot].at;
      // Each stand carries its named label (variant 1) then its mystery label (variant 2), same price.
      const named = createWorldText({ at: [0,0,0], width: EGG_LABEL.width, title: offer.name, subtitle: `${formatNumber(offer.price)} 金币`, color: EGG_LABEL.text, background: EGG_LABEL.plate }, { bevel: false });
      // The mystery label: a narrower "???" line over the named label's own price line.
      const mystery = createWorldText({ at: [0,0,0], width: EGG_LABEL.mysteryWidth, title: EGG_LABEL.mystery, subtitle: '', color: EGG_LABEL.text, background: EGG_LABEL.plate }, { bevel: false });
      for (const [variant, lines] of [[1, named.children], [2, [...mystery.children, named.children[1]]]]) {
      const source = variant === 1 ? named : mystery;
      try {
        for (const line of lines) {
          const positions = line.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            // Line offsets live in the billboard plane; every vertex of a label shares its anchor.
            const actual = new Vector3().fromBufferAttribute(geometry.attributes.position, vertexOffset + i);
            assert.ok(actual.distanceTo(new Vector3().fromBufferAttribute(positions, i).add(new Vector3(0, line.position.y, 0))) < 1e-5);
            assert.ok(Math.hypot(geometry.attributes.labelAnchor.getX(vertexOffset + i) - at[0], geometry.attributes.labelAnchor.getZ(vertexOffset + i) - at[2]) < 1e-5);
            assert.equal(geometry.attributes.labelSlot.getX(vertexOffset + i), slot);
            assert.equal(geometry.attributes.labelVariant.getX(vertexOffset + i), variant);
          }
          for (const range of line.geometry.groups) for (let i = range.start; i < range.start + range.count; i++) {
            const vertex = line.geometry.index.getX(i);
            assert.equal(geometry.index.getX(indexOffset + i), vertexOffset + vertex);
            const color = new Vector3().fromBufferAttribute(geometry.attributes.color, vertexOffset + vertex);
            assert.ok(color.distanceTo(new Vector3(...line.material[range.materialIndex].color.toArray())) < 1e-6);
          }
          vertexOffset += positions.count; indexOffset += line.geometry.index.count;
        }
      } finally { if (variant === 2) { disposeScenery(named); disposeScenery(mystery); } }
      }
    }
    assert.equal(geometry.index.count, indexOffset);
    assert.equal(geometry.attributes.position.count, vertexOffset);
  } finally { disposeScenery(labels.group); }
});

test('each label sits just above its egg on a plate behind the text; locked eggs read ??? over their price', () => {
  const labels = new EggStandLabels(PET_DISPLAYS, PET_CONTENT.eggs);
  try {
    const plates = labels.group.children[1].geometry, text = labels.group.children[0].geometry;
    const lowest = new Map(), behind = new Map(), front = new Map();
    for (let i = 0; i < plates.attributes.position.count; i++) {
      const slot = plates.attributes.labelSlot.getX(i), y = plates.attributes.position.getY(i) + plates.attributes.labelAnchor.getY(i), key = slot + ':' + plates.attributes.labelVariant.getX(i);
      lowest.set(slot, Math.min(lowest.get(slot) ?? Infinity, y)); behind.set(key, Math.max(behind.get(key) ?? -Infinity, plates.attributes.position.getZ(i)));
    }
    for (let i = 0; i < text.attributes.position.count; i++) {
      const key = text.attributes.labelSlot.getX(i) + ':' + text.attributes.labelVariant.getX(i);
      front.set(key, Math.min(front.get(key) ?? Infinity, text.attributes.position.getZ(i)));
    }
    for (const [slot, stand] of PET_DISPLAYS.entries()) {
      // The egg's top is 2.91 m above its stand.
      assert.ok(Math.abs(lowest.get(slot) - (stand.y + EGG_LABEL.plateBottom)) < 1e-4, `plate bottom above egg ${stand.eggId}`);
      assert.ok(lowest.get(slot) > stand.y + 2.91);
      for (const variant of [1, 2]) assert.ok(behind.get(slot + ':' + variant) < front.get(slot + ':' + variant), `plate lies behind the glyphs (${stand.eggId}, variant ${variant})`);
    }
    labels.setUnlocked(id => id === 'meadow-egg');
    assert.equal(labels.diagnostics().mystery, PET_DISPLAYS.filter(d => d.eggId !== 'meadow-egg').length);
    assert.equal(labels.diagnostics().labelCount, PET_DISPLAYS.length, 'locked eggs keep their labels');
    assert.equal(EGG_LABEL.mystery, '???');
    labels.setUnlocked(() => true); assert.equal(labels.diagnostics().mystery, 0);
  } finally { disposeScenery(labels.group); }
});

test('GPU billboards retain world anchors, camera orientation and conservative bounds without buffer updates', () => {
  const labels = new EggStandLabels(PET_DISPLAYS, PET_CONTENT.eggs);
  try {
    for (const geometry of labels.group.children.map(mesh => mesh.geometry)) {
      const camera = new PerspectiveCamera(60, 16/9, .1, 1000), rotation = new Quaternion();
      const position = geometry.attributes.position, anchors = geometry.attributes.labelAnchor;
      const versions = Object.values(geometry.attributes).map(attribute => attribute.version);
      for (const [x,y,z] of [[-100,10,100], [40,50,-40], [0,-30,0]]) {
        camera.position.set(x,y,z); camera.lookAt(30,5,25); camera.updateMatrixWorld(); camera.getWorldQuaternion(rotation);
        for (let i = 0; i < position.count; i += 37) {
          const offset = new Vector3().fromBufferAttribute(position, i), anchor = new Vector3().fromBufferAttribute(anchors,i);
          const oldWorld = offset.clone().applyQuaternion(rotation).add(anchor);
          assert.ok(geometry.boundingBox.containsPoint(oldWorld));
          assert.ok(geometry.boundingSphere.containsPoint(oldWorld));
          const shaderView = anchor.clone().applyMatrix4(camera.matrixWorldInverse).add(offset);
          assert.ok(oldWorld.applyMatrix4(camera.matrixWorldInverse).distanceTo(shaderView) < 1e-5);
        }
      }
      assert.deepEqual(Object.values(geometry.attributes).map(attribute => attribute.version), versions);
    }
    assert.equal(labels.diagnostics().labelCount, 16);
    assert.equal(labels.diagnostics().draws, 2);
  } finally { disposeScenery(labels.group); }
});

test('empty label sets draw nothing and batch resources release once', () => {
  const empty = new EggStandLabels([], PET_CONTENT.eggs);
  assert.equal(empty.diagnostics().draws, 0); disposeScenery(empty.group);
  const labels = new EggStandLabels(PET_DISPLAYS, PET_CONTENT.eggs);
  let geometries = 0, materials = 0;
  for (const mesh of labels.group.children) { mesh.geometry.addEventListener('dispose', () => geometries++); mesh.material.addEventListener('dispose', () => materials++); }
  disposeScenery(labels.group); assert.equal(geometries, 2); assert.equal(materials, 2);
  assert.throws(() => new EggStandLabels([{...PET_DISPLAYS[0], eggId:'missing'}], PET_CONTENT.eggs), /缺少文字配置/);
});

test('moving between independent eggs updates the offer and physical UI anchor', () => {
  const session = new GameSession(SESSION_CONTENT);
  const [first, second] = SESSION_CONTENT.eggStations;
  const enter = station => session.updatePosition([station.zone.x, station.zone.y, station.zone.z], true);
  enter(first); assert.equal(session.getSnapshot().eggStation.id, first.id);
  const before = session.getSnapshot();
  enter(second); assert.equal(session.getSnapshot().eggStation.id, second.id);
  assert.notEqual(session.getSnapshot(), before); assert.notEqual(before.eggId, session.getSnapshot().eggId);
  session.resetPosition(); assert.equal(session.getSnapshot().eggStation, null);
});

test('the mine label shows only while the mine is in view; off screen the ground arrow alone leads', async () => {
  const { GuideMarkerProjector } = await import('../../src/game/presentation/GuideMarkerProjector.ts');
  const projector = new GuideMarkerProjector(), element = { style: {}, dataset: {} };
  const camera = new PerspectiveCamera(60, 16 / 9, .1, 100); camera.updateMatrixWorld();
  projector.update(camera, [0, 0, -10], element);
  assert.equal(element.style.visibility, 'visible'); assert.equal(element.style.left, '50%'); assert.equal(element.style.top, '50%');
  for (const anchor of [[0, 0, 10], [100, 0, -10], null]) {
    projector.update(camera, anchor, element); assert.equal(element.style.visibility, 'hidden');
  }
});

test('locked eggs stand as black silhouettes: each stand owns its material, only what lies above the nest goes black', async () => {
  const { Group, Mesh, BoxGeometry, MeshStandardMaterial, ShaderLib, UniformsUtils } = await import('three');
  const { LockedEggs, EGG_BODY_FROM } = await import('../../src/game/presentation/LockedEggs.ts');
  const surface = new Group(), shared = new MeshStandardMaterial(), stands = [{ id: 'stand-a', eggId: 'a', x: 40, y: 2.6, z: 20 }, { id: 'stand-b', eggId: 'b', x: 28, y: .4, z: 18 }];
  for (const s of stands) { const root = new Group(); root.name = 'Egg_' + s.id; root.add(new Mesh(new BoxGeometry(), shared)); surface.add(root); }
  const eggs = new LockedEggs(surface, stands);
  const mesh = id => surface.getObjectByName('Egg_' + id).children[0];
  assert.notEqual(mesh('stand-a').material, shared); assert.notEqual(mesh('stand-a').material, mesh('stand-b').material);
  const shader = { uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms), vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader };
  mesh('stand-a').material.onBeforeCompile(shader, null);
  assert.match(shader.fragmentShader, /eggLocked \* step\( eggBodyFrom, vEggWorld\.y \)/);
  assert.match(shader.vertexShader, /vEggWorld = \( modelMatrix/);
  assert.equal(shader.uniforms.eggBodyFrom.value, 2.6 + EGG_BODY_FROM, 'the cut follows the stand height');
  // Quietly glossy with a faint rim and a sweeping streak measured from the stand's own centre.
  assert.match(shader.fragmentShader, /roughnessFactor = mix\( roughnessFactor, 0\.45, eggHidden \)/);
  assert.match(shader.fragmentShader, /eggRim/); assert.match(shader.fragmentShader, /eggGlint/);
  assert.deepEqual(shader.uniforms.eggCentre.value.toArray(), [40, 20]);
  eggs.setUnlocked(id => id === 'b');
  assert.equal(shader.uniforms.eggLocked.value, 1); assert.deepEqual(eggs.diagnostics().locked, ['a']);
  eggs.setUnlocked(() => true); assert.equal(shader.uniforms.eggLocked.value, 0);
  eggs.dispose();
});
