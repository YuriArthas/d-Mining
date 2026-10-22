import { Group, MathUtils, Mesh, Vector3, type BufferGeometry, type Camera } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { petLook } from '../content/petLooks.ts';
import { PetModel, PetTextures } from './pets/PetModel.ts';

export type FollowerPet = Readonly<{ id: string; speciesId: string; level: number; slot: number }>;
type Follower = {
  pet: FollowerPet; model: PetModel; placed: boolean;
  from: Vector3; to: Vector3; hop: number; hopping: boolean; hopSeconds: number; hopHeight: number;
  landed: number; yaw: number; idleHopIn: number;
};

const CUBE_URL = new URL('../assets/pets/pet-cube.glb', import.meta.url).href;
const HOP_SECONDS = .34;

/** Equipped pets hop after the miner and turn to face the camera when the miner stops. Read-only
 *  presentation: no inventory rules, mining, collision or frame loop of its own. */
export class PetFollowers {
  readonly group = new Group();
  private readonly followers = new Map<string, Follower>();
  private readonly textures = new PetTextures();
  private readonly geometry: BufferGeometry;
  private readonly random: () => number;
  private readonly target = new Vector3();
  private readonly previousFeet = new Vector3();
  private hasFeet = false;
  private ground = 0;
  private playerSpeed = 0;

  /** The shared rounded-cube body made in Blender (tools/build-pet-cube.py). */
  static async loadBody(signal: AbortSignal) {
    const response = await fetch(CUBE_URL, { signal });
    if (!response.ok) throw Error(`宠物模型加载失败：HTTP ${response.status}`);
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
    let geometry: BufferGeometry | null = null;
    gltf.scene.traverse(object => { if (!geometry && object instanceof Mesh) geometry = object.geometry; });
    if (!geometry) throw Error('宠物模型缺少身体网格');
    return geometry as BufferGeometry;
  }

  constructor(geometry: BufferGeometry, random: () => number = Math.random) {
    this.geometry = geometry; this.random = random;
    this.group.name = 'equipped-pet-followers';
  }

  sync(pets: readonly FollowerPet[]) {
    const ids = new Set(pets.map(pet => pet.id));
    for (const [id, follower] of this.followers) if (!ids.has(id)) { follower.model.dispose(); this.followers.delete(id); }
    for (const pet of pets) {
      let follower = this.followers.get(pet.id);
      if (follower && (follower.pet.speciesId !== pet.speciesId || follower.pet.level !== pet.level)) {
        follower.model.dispose(); this.followers.delete(pet.id); follower = undefined;
      }
      if (follower) { follower.pet = pet; continue; }
      const model = new PetModel(petLook(pet.speciesId), this.geometry, this.textures, this.random);
      model.group.visible = false; this.group.add(model.group);
      this.followers.set(pet.id, {
        pet, model, placed: false, from: new Vector3(), to: new Vector3(), hop: 0, hopping: false, hopSeconds: HOP_SECONDS,
        hopHeight: model.look.rarity === 'legendary' ? .42 : .3, landed: 0, yaw: 0, idleHopIn: 1 + this.random() * 3,
      });
    }
  }

  update(feet: readonly number[], facing: number, camera: Camera, delta: number, travelling: boolean, grounded = true) {
    this.target.set(feet[0], feet[1], feet[2]);
    const jumpAway = travelling || !this.hasFeet || this.previousFeet.distanceToSquared(this.target) > 64;
    const moved = this.hasFeet && delta > 0 ? Math.hypot(feet[0] - this.previousFeet.x, feet[2] - this.previousFeet.z) / delta : 0;
    this.playerSpeed = jumpAway ? 0 : MathUtils.damp(this.playerSpeed, moved, 10, delta);
    // Pets stay on the ground while the miner is in the air.
    if (jumpAway || grounded) this.ground = feet[1];
    this.previousFeet.copy(this.target); this.hasFeet = true;
    for (const follower of this.followers.values()) {
      const { model } = follower, slot = follower.pet.slot;
      // In transit the pets wait out of sight and land beside the miner on arrival.
      if (travelling) { model.group.visible = false; follower.placed = false; continue; }
      // The avatar faces -Z at yaw 0; a small arc behind it.
      const side = slot === 0 ? -1.35 : slot === 1 ? 1.35 : 0, behind = slot < 2 ? 1.5 : 2.45;
      const tx = feet[0] + Math.cos(facing) * side + Math.sin(facing) * behind;
      const tz = feet[2] - Math.sin(facing) * side + Math.cos(facing) * behind;
      const position = model.group.position;
      if (jumpAway || !follower.placed) {
        position.set(tx, this.ground, tz); follower.placed = true; follower.hopping = false; follower.landed = 0;
        follower.yaw = facing; model.group.visible = true;
      }
      const dx = tx - position.x, dz = tz - position.z, distance = Math.hypot(dx, dz);
      if (!follower.hopping && distance > .3) {
        // Longer, quicker hops when far behind, so a running miner does not leave the pets.
        const step = Math.min(distance, .7 + distance * .75, 3.4);
        follower.from.set(position.x, this.ground, position.z);
        follower.to.set(position.x + dx / distance * step, this.ground, position.z + dz / distance * step);
        follower.hopSeconds = HOP_SECONDS * (distance > 3 ? .8 : 1);
        follower.hop = 0; follower.hopping = true;
      } else if (!follower.hopping && this.playerSpeed < .3 && (follower.idleHopIn -= delta) <= 0) {
        // Now and then a little hop on the spot.
        follower.from.set(position.x, this.ground, position.z); follower.to.copy(follower.from);
        follower.hopSeconds = HOP_SECONDS * .8; follower.hop = 0; follower.hopping = true;
        follower.idleHopIn = 2.5 + this.random() * 3.5;
      }
      let lift = 0, stretch = 0;
      if (follower.hopping) {
        follower.hop = Math.min(1, follower.hop + delta / follower.hopSeconds);
        const t = follower.hop, ease = t * t * (3 - 2 * t), height = follower.to.equals(follower.from) ? follower.hopHeight * .45 : follower.hopHeight;
        position.set(MathUtils.lerp(follower.from.x, follower.to.x, ease), this.ground, MathUtils.lerp(follower.from.z, follower.to.z, ease));
        lift = Math.sin(t * Math.PI) * height;
        stretch = Math.sin(Math.min(1, t * 2) * Math.PI) * .12;
        if (t >= 1) { follower.hopping = false; follower.landed = 1; }
      } else position.y = this.ground;
      position.y = this.ground + lift;
      follower.landed = Math.max(0, follower.landed - delta * 7);
      // Squash on landing, stretch on take-off, keeping the volume.
      const sy = 1 + stretch - follower.landed * .22, sxz = 1 / Math.sqrt(sy);
      model.pose.scale.set(sxz, sy, sxz);
      // Face the hop; once the miner stops, turn to face the camera so the faces are seen.
      const hopDx = follower.to.x - follower.from.x, hopDz = follower.to.z - follower.from.z;
      const desired = follower.hopping && Math.hypot(hopDx, hopDz) > .05 ? Math.atan2(hopDx, hopDz)
        : this.playerSpeed < .3 ? Math.atan2(camera.position.x - position.x, camera.position.z - position.z) : follower.yaw;
      const turn = Math.atan2(Math.sin(desired - follower.yaw), Math.cos(desired - follower.yaw));
      follower.yaw += turn * (1 - Math.exp(-9 * delta));
      model.group.rotation.y = follower.yaw;
      model.update(delta);
    }
  }

  diagnostics() {
    return [...this.followers.values()].map(({ pet, model, hopping }) => ({
      ...pet, ...model.diagnostics(), position: model.group.position.toArray(), visible: model.group.visible, hopping,
      yaw: model.group.rotation.y, squash: model.pose.scale.y,
    }));
  }

  dispose() {
    for (const follower of this.followers.values()) follower.model.dispose();
    this.followers.clear(); this.textures.dispose(); this.geometry.dispose(); this.group.removeFromParent();
  }
}
