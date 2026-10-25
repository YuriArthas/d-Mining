import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, Group, Mesh, MeshStandardMaterial,
  NearestFilter, NoColorSpace, NormalBlending, PlaneGeometry, Points, PointsMaterial, SRGBColorSpace, Sprite, SpriteMaterial, Texture,
  type ColorSpace,
} from 'three';
import type { PetFace, PetLook, PetPattern, PetSparkle } from '../../content/petLooks.ts';
import { PATTERN_BASE, drawFace, drawGlow, drawPattern, drawSparkle, sparkleIsLight } from './petArt.ts';

/** Pet textures drawn once per face, pattern and sparkle, shared by every pet that uses them. */
export class PetTextures {
  private readonly cache = new Map<string, Texture>();
  private make(key: string, size: number, draw: (g: CanvasRenderingContext2D) => void, colorSpace: ColorSpace, pixel = false) {
    let texture = this.cache.get(key);
    if (texture) return texture;
    if (typeof document === 'undefined') texture = new Texture(); // headless tests: shape only
    else {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      draw(canvas.getContext('2d')!);
      texture = new CanvasTexture(canvas);
    }
    texture.colorSpace = colorSpace;
    if (pixel) { texture.magFilter = NearestFilter; texture.minFilter = NearestFilter; texture.generateMipmaps = false; }
    this.cache.set(key, texture);
    return texture;
  }
  face(face: PetFace, blink: boolean) { return this.make(`face:${face}:${blink}`, 128, g => { g.scale(.5, .5); drawFace(g, face, blink); }, SRGBColorSpace); }
  /** A multiplier around PATTERN_BASE, not a colour: read as raw data. */
  pattern(pattern: PetPattern) { return this.make(`pattern:${pattern}`, 32, g => drawPattern(g, pattern), NoColorSpace, true); }
  sparkle(kind: PetSparkle) { return this.make(`sparkle:${kind}`, 64, g => drawSparkle(g, kind), SRGBColorSpace); }
  glow() { return this.make('glow', 128, g => drawGlow(g), SRGBColorSpace); }
  dispose() { for (const texture of this.cache.values()) texture.dispose(); this.cache.clear(); }
}

const FACE_SIZE = 0.84;
const SPARKLE_COUNT: Readonly<Record<PetLook['rarity'], number>> = { common: 4, rare: 5, epic: 8, legendary: 13 };
const ROUGHNESS: Readonly<Record<PetLook['rarity'], number>> = { common: .85, rare: .62, epic: .52, legendary: .45 };

/** One pet: a rounded cube body and a separate face on its +Z side, with sparkles and a glow for the
 *  higher tiers. `group` is placed on the ground by the follower; `pose` squashes and stretches from the
 *  bottom, so the body and face hop together. */
export class PetModel {
  readonly group = new Group();
  readonly pose = new Group();
  readonly look: PetLook;
  private readonly shape = new Group();
  private readonly body: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly face: Mesh<PlaneGeometry, MeshStandardMaterial>;
  private readonly sparkles: Points<BufferGeometry, PointsMaterial> | null = null;
  private readonly glow: Sprite | null = null;
  private readonly seeds: Float32Array;
  private readonly open: Texture;
  private readonly closed: Texture;
  private readonly random: () => number;
  private time: number;
  private nextBlink: number;
  /** A golden pet: the body turns polished gold over its own pattern. */
  gild() {
    const m = this.body.material;
    m.color.lerp(new Color('#ffd34a'), .7); m.metalness = .55; m.roughness = Math.min(m.roughness, .32);
    m.emissive.set('#ffb000'); m.emissiveIntensity = .14; m.needsUpdate = true;
  }
  private blinkUntil = -1;

  constructor(look: PetLook, geometry: BufferGeometry, textures: PetTextures, random: () => number = Math.random) {
    this.look = look; this.random = random;
    this.time = random() * 10; this.nextBlink = this.time + 1.5 + random() * 3;
    this.group.name = `pet:${look.speciesId}`;
    const color = new Color(look.color);
    this.body = new Mesh(geometry, new MeshStandardMaterial({
      map: textures.pattern(look.pattern), color: color.clone().multiplyScalar(1 / PATTERN_BASE), roughness: ROUGHNESS[look.rarity], metalness: 0,
      emissive: color, emissiveIntensity: look.rarity === 'legendary' ? .16 : look.rarity === 'epic' ? .06 : 0,
    }));
    this.body.castShadow = true;
    this.open = textures.face(look.face, false); this.closed = textures.face(look.face, true);
    // The face is lit like the body, so it does not glow in the dark; it sits just in front of the +Z side.
    this.face = new Mesh(new PlaneGeometry(FACE_SIZE, FACE_SIZE), new MeshStandardMaterial({
      map: this.open, transparent: true, depthWrite: false, roughness: .7, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    this.face.position.set(0, .5, .5 + .002);
    this.shape.scale.setScalar(look.size);
    this.shape.add(this.body, this.face); this.pose.add(this.shape); this.group.add(this.pose);
    const count = look.particles ? SPARKLE_COUNT[look.rarity] : 0;
    this.seeds = Float32Array.from({ length: count * 2 }, () => random());
    if (count) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage));
      geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 4).fill(1), 4).setUsage(DynamicDrawUsage));
      const light = sparkleIsLight(look.sparkle);
      this.sparkles = new Points(geometry, new PointsMaterial({
        // With size attenuation a point spans size * (H / 2) / depth pixels: about half its world size at
        // the game's 55 degree view, so this reads as sparkles roughly a fifth of the pet across.
        map: textures.sparkle(look.sparkle), color: new Color(look.sparkleColor), size: look.size * (look.rarity === 'legendary' ? .44 : .36),
        vertexColors: true, transparent: true, depthWrite: false, blending: light ? AdditiveBlending : NormalBlending, alphaTest: .02,
      }));
      this.sparkles.frustumCulled = false;
      this.group.add(this.sparkles);
    }
    if (look.glow) {
      this.glow = new Sprite(new SpriteMaterial({ map: textures.glow(), color: color.clone().lerp(new Color('#ffffff'), .35), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: .35 }));
      this.glow.scale.setScalar(look.size * 1.9); this.glow.position.set(0, look.size * .5, 0);
      this.group.add(this.glow);
    }
    this.update(0);
  }

  get blinking() { return this.time < this.blinkUntil; }

  update(delta: number) {
    this.time += delta;
    if (this.time >= this.nextBlink) { this.blinkUntil = this.time + .13; this.nextBlink = this.time + 2.4 + this.random() * 3.2; }
    const map = this.blinking ? this.closed : this.open;
    if (this.face.material.map !== map) this.face.material.map = map;
    if (this.sparkles) {
      const size = this.look.size, position = this.sparkles.geometry.getAttribute('position') as BufferAttribute;
      const color = this.sparkles.geometry.getAttribute('color') as BufferAttribute, count = position.count;
      for (let i = 0; i < count; i++) {
        // Each sparkle circles the pet while it drifts up and fades in and out.
        const a = this.seeds[i * 2] * Math.PI * 2 + this.time * (.6 + this.seeds[i * 2 + 1] * .5);
        const rise = (this.time * .32 + this.seeds[i * 2 + 1]) % 1, r = size * (.64 + .12 * Math.sin(this.time * 1.7 + i));
        position.setXYZ(i, Math.cos(a) * r, size * (.08 + rise * 1.25), Math.sin(a) * r * .85);
        color.setW(i, Math.sin(rise * Math.PI));
      }
      position.needsUpdate = true; color.needsUpdate = true;
    }
    if (this.glow) (this.glow.material as SpriteMaterial).opacity = .32 + .08 * Math.sin(this.time * 2.2);
  }

  diagnostics() {
    return { speciesId: this.look.speciesId, face: this.look.face, rarity: this.look.rarity, size: this.look.size, blinking: this.blinking,
      sparkles: this.sparkles ? (this.sparkles.geometry.getAttribute('position') as BufferAttribute).count : 0, glow: !!this.glow };
  }

  /** The body geometry and the textures are shared and stay alive. */
  dispose() {
    this.body.material.dispose();
    this.face.geometry.dispose(); this.face.material.dispose();
    if (this.sparkles) { this.sparkles.geometry.dispose(); this.sparkles.material.dispose(); }
    if (this.glow) (this.glow.material as SpriteMaterial).dispose();
    this.group.removeFromParent(); this.group.clear();
  }
}
