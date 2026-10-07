import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, Quaternion } from 'three';
import { createWorldText } from '../../src/game/presentation/WorldText.ts';
import { EggStandLabels } from '../../src/game/presentation/EggStandLabels.ts';
import { WorldPromptProjector } from '../../src/game/presentation/WorldPromptProjector.ts';
import { disposeScenery } from '../../src/game/presentation/disposeScenery.ts';
import { PET_DISPLAYS } from '../../src/game/world/SurfaceHub.ts';
import { PET_CONTENT } from '../../src/game/content/pets.ts';
import { SESSION_CONTENT } from '../../src/game/world/sessionContent.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';

test('all egg labels retain extruded geometry and front/side colors in one draw', () => {
  const labels = new EggStandLabels(PET_DISPLAYS, PET_CONTENT.eggs);
  try {
    assert.equal(labels.group.children.length, 1);
    assert.equal(labels.diagnostics().draws, 1);
    assert.equal(labels.diagnostics().triangles, 42432);
    const mesh = labels.group.children[0], geometry = mesh.geometry;
    assert.equal(mesh.material.map, null);
    assert.equal(mesh.material.vertexColors, true);
    assert.equal(geometry.groups.length, 0);
    let vertexOffset = 0, indexOffset = 0;
    for (const stand of PET_DISPLAYS) {
      const offer = PET_CONTENT.eggs.find(offer => offer.id === stand.eggId);
      const source = createWorldText({ at: [0,0,0], width: 2.1, title: offer.name, subtitle: `${offer.price} 金币`, color: '#fff4b8', background: '#20384d' }, { bevel: false });
      try {
        for (const line of source.children) {
          const positions = line.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            const actual = new Vector3().fromBufferAttribute(geometry.attributes.position, vertexOffset + i);
            assert.deepEqual(actual.toArray(), new Vector3().fromBufferAttribute(positions, i).toArray());
            const anchor = new Vector3().fromBufferAttribute(geometry.attributes.labelAnchor, vertexOffset + i);
            assert.ok(anchor.distanceTo(new Vector3(stand.x, stand.y + 3.95 + line.position.y, stand.z)) < 1e-5);
          }
          for (const range of line.geometry.groups) for (let i = range.start; i < range.start + range.count; i++) {
            const vertex = line.geometry.index.getX(i);
            assert.equal(geometry.index.getX(indexOffset + i), vertexOffset + vertex);
            const color = new Vector3().fromBufferAttribute(geometry.attributes.color, vertexOffset + vertex);
            assert.ok(color.distanceTo(new Vector3(...line.material[range.materialIndex].color.toArray())) < 1e-6);
          }
          vertexOffset += positions.count; indexOffset += line.geometry.index.count;
        }
      } finally { disposeScenery(source); }
    }
    assert.equal(geometry.index.count, indexOffset);
    assert.equal(geometry.attributes.position.count, vertexOffset);
  } finally { disposeScenery(labels.group); }
});

test('GPU billboards retain world anchors, camera orientation and conservative bounds without buffer updates', () => {
  const labels = new EggStandLabels(PET_DISPLAYS, PET_CONTENT.eggs);
  try {
    const geometry = labels.group.children[0].geometry;
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
    assert.equal(labels.diagnostics().labelCount, 18);
    assert.equal(labels.diagnostics().draws, 1);
  } finally { disposeScenery(labels.group); }
});

test('empty label sets draw nothing and batch resources release once', () => {
  const empty = new EggStandLabels([], PET_CONTENT.eggs);
  assert.equal(empty.diagnostics().draws, 0); disposeScenery(empty.group);
  const labels = new EggStandLabels(PET_DISPLAYS, PET_CONTENT.eggs), mesh = labels.group.children[0];
  let geometries = 0, materials = 0;
  mesh.geometry.addEventListener('dispose', () => geometries++);
  mesh.material.addEventListener('dispose', () => materials++);
  disposeScenery(labels.group); assert.equal(geometries, 1); assert.equal(materials, 1);
  assert.throws(() => new EggStandLabels([{...PET_DISPLAYS[0], eggId:'missing'}], PET_CONTENT.eggs), /缺少文字配置/);
});

test('world prompt follows projection and hides outside view without edge clamping', () => {
  const projector = new WorldPromptProjector(), element = { style: {} };
  const camera = new PerspectiveCamera(60, 16 / 9, .1, 100); camera.updateMatrixWorld();
  projector.update(camera, [0, 0, -10], element);
  assert.equal(element.style.visibility, 'visible'); assert.equal(element.style.left, '50%'); assert.equal(element.style.top, '50%');
  projector.update(camera, [2, 1, -10], element); assert.ok(parseFloat(element.style.left) > 50); assert.ok(parseFloat(element.style.top) < 50);
  for (const anchor of [[0, 0, 10], [100, 0, -10], null]) {
    projector.update(camera, anchor, element); assert.equal(element.style.visibility, 'hidden');
  }
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
