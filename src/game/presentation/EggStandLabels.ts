import { Box3, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Sphere, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWorldText } from './WorldText.ts';
import { disposeScenery } from './disposeScenery.ts';

type Stand = Readonly<{ id: string; eggId: string; x: number; y: number; z: number }>;
type Offer = Readonly<{ id: string; name: string; price: number }>;

// One static geometry/material for all extruded names and prices. Each vertex
// retains its label's anchor; the camera matrices orient glyphs in the shader.
export class EggStandLabels {
  readonly group = new Group();
  private triangles = 0;

  constructor(stands: readonly Stand[], offers: readonly Offer[]) {
    this.group.name = 'egg-overhead-labels';
    this.group.userData.labels = stands.map(stand => ({ ...stand, at: [stand.x, stand.y + 3.95, stand.z], extruded: true }));
    const templates = new Map<string, Group>();
    const parts: BufferGeometry[] = [];
    const bounds = new Box3(), point = new Vector3();
    try {
      for (const stand of stands) {
        let template = templates.get(stand.eggId);
        if (!template) {
          const offer = offers.find(offer => offer.id === stand.eggId);
          if (!offer) throw Error(`蛋台缺少文字配置: ${stand.eggId}`);
          template = createWorldText({
            at: [0, 0, 0], width: 2.1, title: offer.name, subtitle: `${offer.price} 金币`, color: '#fff4b8', background: '#20384d',
          }, { bevel: false });
          templates.set(offer.id, template);
        }
        for (const line of template.children) {
          const glyph = line as Mesh<BufferGeometry, MeshBasicMaterial[]>;
          const geometry = glyph.geometry.clone();
          parts.push(geometry);
          const position = geometry.getAttribute('position'), index = geometry.getIndex();
          const colors = new Float32Array(position.count * 3), anchors = new Float32Array(position.count * 3);
          // Preserve front/back and side colors, replacing material groups with vertex colors.
          for (const range of geometry.groups) {
            const color = glyph.material[range.materialIndex!].color;
            for (let i = range.start; i < range.start + range.count; i++) color.toArray(colors, (index ? index.getX(i) : i) * 3);
          }
          const x = stand.x, y = stand.y + 3.95 + glyph.position.y, z = stand.z;
          let radius = 0;
          for (let i = 0; i < position.count; i++) {
            anchors.set([x, y, z], i * 3);
            radius = Math.max(radius, point.fromBufferAttribute(position, i).length());
          }
          // Glyph offsets rotate on the GPU. Enclose every possible orientation,
          // rather than computing a (wrong) bound from the local offsets alone.
          bounds.expandByPoint(point.set(x - radius, y - radius, z - radius));
          bounds.expandByPoint(point.set(x + radius, y + radius, z + radius));
          geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
          geometry.setAttribute('labelAnchor', new Float32BufferAttribute(anchors, 3));
          geometry.deleteAttribute('normal'); geometry.deleteAttribute('uv');
          geometry.clearGroups();
        }
      }
      if (!parts.length) return;
      const geometry = mergeGeometries(parts, false);
      if (!geometry) throw Error('蛋台文字几何合批失败');
      geometry.boundingBox = bounds;
      geometry.boundingSphere = bounds.getBoundingSphere(new Sphere());
      const material = new MeshBasicMaterial({ vertexColors: true });
      material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute vec3 labelAnchor;')
          .replace('#include <project_vertex>', `
            vec4 mvPosition = modelViewMatrix * vec4(labelAnchor, 1.0);
            mvPosition.xyz += transformed;
            gl_Position = projectionMatrix * mvPosition;
          `);
      };
      material.customProgramCacheKey = () => 'egg-extruded-billboard-batch-v1';
      const mesh = new Mesh(geometry, material);
      mesh.name = 'egg-labels-batched';
      this.triangles = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
      this.group.add(mesh);
    } finally {
      for (const geometry of parts) geometry.dispose();
      for (const template of templates.values()) disposeScenery(template);
    }
  }

  diagnostics() {
    return { labels: this.group.userData.labels, labelCount: this.group.userData.labels.length, draws: this.group.children.length, triangles: this.triangles };
  }
}
