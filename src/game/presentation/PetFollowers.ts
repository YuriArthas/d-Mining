import { Group, Mesh, MeshLambertMaterial, SphereGeometry, Vector3, type Camera } from 'three';
import { petAppearance } from '../content/petAppearance.ts';
import { createWorldText } from './WorldText.ts';
import { disposeScenery } from './disposeScenery.ts';

export type FollowerPet = Readonly<{ id: string; speciesId: string; level: number; slot: number }>;
type Follower = { pet: FollowerPet; group: Group; label: Group; body: Mesh; placed: boolean };

// Read-only presentation. No inventory rules, mining, collision, or independent frame loop.
export class PetFollowers {
  readonly group = new Group();
  private readonly geometry = new SphereGeometry(1, 24, 16);
  private readonly followers = new Map<string, Follower>();
  private readonly target = new Vector3();
  private readonly previousFeet = new Vector3();
  private hasFeet = false;
  private time = 0;

  constructor() { this.group.name = 'equipped-pet-followers'; }

  sync(pets: readonly FollowerPet[]) {
    const ids = new Set(pets.map(pet => pet.id));
    for (const [id, follower] of this.followers) if (!ids.has(id)) {
      this.release(follower); this.followers.delete(id);
    }
    for (const pet of pets) {
      let follower = this.followers.get(pet.id);
      if (follower && (follower.pet.speciesId !== pet.speciesId || follower.pet.level !== pet.level)) {
        this.release(follower); this.followers.delete(pet.id); follower = undefined;
      }
      if (follower) { follower.pet = pet; continue; }
      const look = petAppearance(pet.speciesId), group = new Group();
      const body = new Mesh(this.geometry, new MeshLambertMaterial({ color: look.color }));
      body.scale.setScalar(look.radius);
      const label = createWorldText({ at: [0, look.radius + .5, 0], width: .26 * look.label.length, title: look.label, subtitle: '', color: '#fff5cf', background: '#183343' }, { bevel: false });
      label.add(createWorldText({ at: [0, -.24, 0], width: .42, title: `Lv.${pet.level}`, subtitle: '', color: '#dcebef', background: '#183343' }, { bevel: false }));
      group.add(body, label); group.name = `pet:${pet.id}`; group.visible = false;
      this.group.add(group);
      this.followers.set(pet.id, { pet, group, label, body, placed: false });
    }
  }

  update(feet: readonly number[], facing: number, camera: Camera, delta: number, travelling: boolean) {
    const dt = Math.min(.1, Math.max(0, delta));
    this.time += dt;
    this.target.set(feet[0], feet[1], feet[2]);
    const snap = travelling || !this.hasFeet || this.previousFeet.distanceToSquared(this.target) > 64;
    this.previousFeet.copy(this.target); this.hasFeet = true;
    for (const follower of this.followers.values()) {
      const slot = follower.pet.slot;
      // The avatar faces -Z at yaw 0; stagger a small arc behind it.
      const side = slot === 0 ? -1.25 : slot === 1 ? 1.25 : 0;
      const behind = slot < 2 ? 1.6 : 2.55;
      this.target.set(feet[0] + Math.cos(facing) * side + Math.sin(facing) * behind,
        feet[1] + 1.05 + Math.sin(this.time * 2.4 + slot * 1.7) * .1,
        feet[2] - Math.sin(facing) * side + Math.cos(facing) * behind);
      if (snap || !follower.placed) follower.group.position.copy(this.target);
      else follower.group.position.lerp(this.target, 1 - Math.exp(-8 * dt));
      follower.placed = true; follower.group.visible = !travelling;
      camera.getWorldQuaternion(follower.label.quaternion);
    }
  }

  diagnostics() {
    return [...this.followers.values()].map(({ pet, group }) => ({ ...pet, position: group.position.toArray(), visible: group.visible }));
  }

  private release(follower: Follower) {
    // Sphere geometry is shared; only this follower's material and label are owned here.
    (follower.body.material as MeshLambertMaterial).dispose();
    disposeScenery(follower.label);
    follower.group.removeFromParent(); follower.group.clear();
  }
  dispose() {
    for (const follower of this.followers.values()) this.release(follower);
    this.followers.clear(); this.geometry.dispose(); this.group.removeFromParent();
  }
}
