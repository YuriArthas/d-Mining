import { Material, Mesh, type Group, type PerspectiveCamera } from "three";
import { ThirdPersonCamera } from "../ThirdPersonCamera.ts";
import type { CharacterPhysics } from "../validation/physics.ts";
import type { GameInput } from "../GameInput.ts";
import { GAME_CONFIG } from "../config.ts";
import { MOVEMENT } from "../movement.ts";

export class CameraView {
  readonly rig = new ThirdPersonCamera();
  readonly angles = {
    yaw: Number(GAME_CONFIG.camera.initialYaw),
    pitch: Number(GAME_CONFIG.camera.initialPitch),
  };
  look(yaw: number, pitch: number) {
    this.angles.yaw = yaw;
    this.angles.pitch = Math.max(
      GAME_CONFIG.camera.minPitch,
      Math.min(GAME_CONFIG.camera.maxPitch, pitch),
    );
  }
  consumeLook(input: GameInput) {
    const look = input.consumeLook();
    this.look(
      (this.angles.yaw - look.x) % (Math.PI * 2),
      this.angles.pitch + look.y,
    );
  }
  prepare(physics: CharacterPhysics, camera: PerspectiveCamera) {
    this.apply(physics, physics.feet(), camera, 0.1);
  }
  private apply(
    physics: CharacterPhysics,
    feet: readonly number[],
    camera: PerspectiveCamera,
    delta: number,
  ) {
    const rig = this.rig;
    rig.update(
      physics.world,
      physics.collider,
      feet,
      this.angles.yaw,
      this.angles.pitch,
      delta,
      camera.aspect,
    );
    if (camera.near !== rig.near) {
      camera.near = rig.near;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(rig.position);
    camera.lookAt(rig.position.clone().sub(rig.direction));
  }
  update(
    physics: CharacterPhysics,
    feet: readonly number[],
    facing: number,
    avatar: Group,
    contactShadow: Mesh | null,
    camera: PerspectiveCamera,
    delta: number,
  ) {
    const turn = Math.atan2(
      Math.sin(facing - avatar.rotation.y),
      Math.cos(facing - avatar.rotation.y),
    );
    avatar.rotation.y += turn * (1 - Math.exp(-MOVEMENT.turnSharpness * delta));
    avatar.position.set(...(feet as [number, number, number]));
    this.apply(physics, feet, camera, delta);
    avatar.visible = this.rig.avatarOpacity > 0.001;
    avatar.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material = object.material as Material;
      material.opacity = this.rig.avatarOpacity;
      material.depthWrite =
        object !== contactShadow && this.rig.avatarOpacity >= 1;
    });
  }
}
