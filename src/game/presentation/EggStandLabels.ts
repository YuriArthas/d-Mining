import { formatNumber } from './formatNumber.ts';
import { MYSTERY_EGG_NAME } from '../content/petAppearance.ts';
import { Box3, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Sphere, Vector3, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWorldText } from './WorldText.ts';
import { disposeScenery } from './disposeScenery.ts';
import { currencyName, type CurrencyId } from '../content/economy.ts';

type Stand = Readonly<{ id: string; eggId: string; x: number; y: number; z: number }>;
type Offer = Readonly<{ id: string; name: string; price: number; currency: CurrencyId }>;

/** Overhead name and price of every egg, always shown: compact, sitting just above the egg (its top is
 *  2.91 m above the stand), on a dark rounded plate so it reads over the trees and the eggs on the tiers
 *  behind. An egg the player has not unlocked yet is a mystery: its name reads `mystery`, its price stays. */
export const EGG_LABEL = { width: 1.7, plateBottom: 3.05, padding: .14, plate: '#13263a', plateOpacity: .74, text: '#fff4b8', mystery: MYSTERY_EGG_NAME, mysteryWidth: 1 } as const;
/** Each stand carries both labels; the GPU shows the named one once the egg is unlocked, the mystery one before. */
const NAMED = 1, MYSTERY = 2;

const BILLBOARD = `
  vec4 mvPosition = modelViewMatrix * vec4(labelAnchor, 1.0);
  // The label that does not apply collapses to its anchor (named while locked, mystery once unlocked).
  mvPosition.xyz += transformed * (labelVariant < 1.5 ? 1.0 - eggLocked : eggLocked);
  gl_Position = projectionMatrix * mvPosition;
`;

// Two static batches for all labels: extruded glyphs (vertex colours) and their plates. Each vertex keeps
// its label's anchor, slot and variant; the camera matrices orient them in the shader and one uniform per
// slot says whether the egg is still locked.
export class EggStandLabels {
  readonly group = new Group();
  private triangles = 0;
  private readonly locked: { value: number[] };
  private readonly slots: readonly string[];

  constructor(stands: readonly Stand[], offers: readonly Offer[]) {
    this.group.name = 'egg-overhead-labels';
    this.slots = stands.map(stand => stand.eggId);
    this.locked = { value: stands.map(() => 0) };
    const labels: { at: [number, number, number]; eggId: string; id: string; extruded: true }[] = [];
    const templates = new Map<string, { group: Group; bounds: Box3 }>();
    const textParts: BufferGeometry[] = [], plateParts: BufferGeometry[] = [];
    const bounds = new Box3(), point = new Vector3();
    try {
      stands.forEach((stand, slot) => {
        const offer = offers.find(offer => offer.id === stand.eggId);
        if (!offer) throw Error(`蛋台缺少文字配置: ${stand.eggId}`);
        for (const variant of [NAMED, MYSTERY]) {
          const key = `${stand.eggId}|${variant}`;
          let template = templates.get(key);
          if (!template) {
            const text = { at: [0, 0, 0] as [number, number, number], color: EGG_LABEL.text, background: EGG_LABEL.plate };
            const group = variant === NAMED
              ? createWorldText({ ...text, width: EGG_LABEL.width, title: offer.name, subtitle: `${formatNumber(offer.price)} ${currencyName(offer.currency)}` }, { bevel: false })
              // "???" fitted to the full width would tower over the price: it gets a narrower line, about as
              // tall as an egg's name, over the very same price line.
              : createWorldText({ ...text, width: EGG_LABEL.mysteryWidth, title: EGG_LABEL.mystery, subtitle: '' }, { bevel: false });
            if (variant === MYSTERY) group.add(templates.get(`${stand.eggId}|${NAMED}`)!.group.children[1].clone());
            const box = new Box3();
            for (const line of group.children as Mesh[]) {
              line.geometry.computeBoundingBox();
              box.union(line.geometry.boundingBox!.clone().translate(line.position));
            }
            template = { group, bounds: box };
            templates.set(key, template);
          }
          // The plate's lower edge sits just above the egg; text lines keep their offsets above that.
          const lift = stand.y + EGG_LABEL.plateBottom + EGG_LABEL.padding - template.bounds.min.y;
          if (variant === NAMED) labels.push({ ...stand, at: [stand.x, lift, stand.z], extruded: true });
          let radius = 0;
          const tag = (geometry: BufferGeometry) => {
            const position = geometry.getAttribute('position'), anchors = new Float32Array(position.count * 3);
            for (let i = 0; i < position.count; i++) {
              anchors.set([stand.x, lift, stand.z], i * 3);
              radius = Math.max(radius, point.fromBufferAttribute(position, i).length());
            }
            geometry.setAttribute('labelAnchor', new Float32BufferAttribute(anchors, 3));
            geometry.setAttribute('labelSlot', new Float32BufferAttribute(new Float32Array(position.count).fill(slot), 1));
            geometry.setAttribute('labelVariant', new Float32BufferAttribute(new Float32Array(position.count).fill(variant), 1));
            // Offsets rotate on the GPU: enclose every orientation around the anchor.
            bounds.expandByPoint(point.set(stand.x - radius, lift - radius, stand.z - radius));
            bounds.expandByPoint(point.set(stand.x + radius, lift + radius, stand.z + radius));
          };
          for (const line of template.group.children) {
            const glyph = line as Mesh<BufferGeometry, MeshBasicMaterial[]>;
            const geometry = glyph.geometry.clone();
            const position = geometry.getAttribute('position'), index = geometry.getIndex(), colors = new Float32Array(position.count * 3);
            // Preserve front/back and side colours, replacing material groups with vertex colours.
            for (const range of geometry.groups) {
              const color = glyph.material[range.materialIndex!].color;
              for (let i = range.start; i < range.start + range.count; i++) color.toArray(colors, (index ? index.getX(i) : i) * 3);
            }
            geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
            geometry.deleteAttribute('normal'); geometry.deleteAttribute('uv'); geometry.clearGroups();
            // Lines and plate share one anchor; line offsets live in the billboard plane, so the text never
            // tilts out of its plate when the camera looks up or down.
            geometry.translate(0, glyph.position.y, 0);
            tag(geometry);
            textParts.push(geometry);
          }
          plateParts.push(plateGeometry(template.bounds, tag));
        }
      });
      this.group.userData.labels = labels;
      if (!textParts.length) return;
      const text = mergeGeometries(textParts, false), plates = mergeGeometries(plateParts, false);
      if (!text || !plates) throw Error('蛋台文字几何合批失败');
      for (const geometry of [text, plates]) { geometry.boundingBox = bounds.clone(); geometry.boundingSphere = bounds.getBoundingSphere(new Sphere()); }
      const textMaterial = this.billboard(new MeshBasicMaterial({ vertexColors: true }), 'egg-label-text-v4');
      // Drawn after the opaque glyphs: a plate in front of an egg shades it, glyphs stay on top of their plate.
      const plateMaterial = this.billboard(new MeshBasicMaterial({ color: EGG_LABEL.plate, transparent: true, opacity: EGG_LABEL.plateOpacity, depthWrite: false }), 'egg-label-plate-v3');
      const textMesh = new Mesh(text, textMaterial), plateMesh = new Mesh(plates, plateMaterial);
      textMesh.name = 'egg-labels-batched'; plateMesh.name = 'egg-label-plates';
      this.triangles = (text.index?.count ?? text.getAttribute('position').count) / 3;
      this.group.add(textMesh, plateMesh);
    } finally {
      for (const geometry of [...textParts, ...plateParts]) geometry.dispose();
      for (const template of templates.values()) disposeScenery(template.group);
    }
  }

  /** Eggs not unlocked yet read `???` over their price; unlocked ones show their name. */
  setUnlocked(unlocked: (eggId: string) => boolean) {
    this.slots.forEach((eggId, slot) => { this.locked.value[slot] = unlocked(eggId) ? 0 : 1; });
  }

  diagnostics() {
    return { labels: this.group.userData.labels, labelCount: this.group.userData.labels.length, draws: this.group.children.length, triangles: this.triangles, mystery: this.locked.value.filter(Boolean).length };
  }

  private billboard<T extends Material>(material: T, key: string) {
    const slots = Math.max(1, this.slots.length);
    material.onBeforeCompile = shader => {
      shader.uniforms.labelLocked = this.locked;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nattribute vec3 labelAnchor;\nattribute float labelSlot;\nattribute float labelVariant;\nuniform float labelLocked[${slots}];`)
        .replace('#include <project_vertex>', `float eggLocked = labelLocked[int(labelSlot + 0.5)];\n${BILLBOARD}`);
    };
    material.customProgramCacheKey = () => `${key}-${slots}`;
    return material;
  }
}

/** A rounded plate behind one label's text block (its lines' union `bounds`), padded, slightly behind the glyphs. */
function plateGeometry(bounds: Box3, tag: (geometry: BufferGeometry) => void) {
  const p = EGG_LABEL.padding, x0 = bounds.min.x - p, x1 = bounds.max.x + p, y0 = bounds.min.y - p, y1 = bounds.max.y + p, r = Math.min(.18, (y1 - y0) / 3);
  const shape = new Shape();
  shape.moveTo(x0 + r, y0); shape.lineTo(x1 - r, y0); shape.quadraticCurveTo(x1, y0, x1, y0 + r);
  shape.lineTo(x1, y1 - r); shape.quadraticCurveTo(x1, y1, x1 - r, y1); shape.lineTo(x0 + r, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - r); shape.lineTo(x0, y0 + r); shape.quadraticCurveTo(x0, y0, x0 + r, y0);
  const geometry = new ShapeGeometry(shape, 4);
  geometry.translate(0, 0, bounds.min.z - .04);
  geometry.deleteAttribute('normal'); geometry.deleteAttribute('uv');
  tag(geometry);
  return geometry;
}
